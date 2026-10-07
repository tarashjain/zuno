'use server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireRoomActor, requireRoomHost } from '@/lib/room-auth'
import { revalidatePath } from 'next/cache'

type WavelengthPublic = {
  kind: 'wavelength'
  roundKey: string
  spectrum: [string, string] // [left, right]
  psychicId: number
  phase: 'psychic-set' | 'team-guess' | 'revealed'
  pointer?: number | null
  target?: number | null // revealed only once phase is 'revealed'
  teams?: Record<string, 'A' | 'B'>
}

type WavelengthSecret = {
  kind: 'wavelength'
  target: number
}

const asInputJson = (v: unknown) => v as Prisma.InputJsonValue

export async function startWavelengthRound(sessionId: string): Promise<WavelengthPublic> {
  const { room } = await requireRoomHost(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, include: { players: true } })
  if (!session) throw new Error('Session not found')

  const isLocal = room.mode === 'local'
  if (isLocal) {
    if (session.players.length < 2) throw new Error('Add at least two players so they can be split into two teams.')
  } else if (session.players.length < 4) {
    throw new Error('Share-code Wavelength needs at least 4 players split into two teams.')
  }

  const spectra = await prisma.wavelengthSpectrum.findMany({ select: { leftLabel: true, rightLabel: true } })
  if (spectra.length === 0) throw new Error('No Wavelength spectra are configured.')
  const chosen = spectra[Math.floor(Math.random() * spectra.length)]
  const psychic = session.players[Math.floor(Math.random() * session.players.length)]

  // Divide players into two teams by join order (alternating), so every round has balanced sides.
  const teams: Record<string, 'A' | 'B'> = Object.fromEntries(session.players.map((p, i) => [String(p.id), i % 2 === 0 ? 'A' : 'B']))

  const publicState: WavelengthPublic = {
    kind: 'wavelength',
    roundKey: randomUUID(),
    spectrum: [chosen.leftLabel, chosen.rightLabel],
    psychicId: psychic.id,
    // Local (pass-and-play) skips the separate "psychic sets clue" gate — one shared device,
    // so the psychic can just hide/peek the target and hand it over without a network round-trip.
    phase: isLocal ? 'team-guess' : 'psychic-set',
    pointer: isLocal ? 50 : null,
    teams,
  }

  const secretState: WavelengthSecret = {
    kind: 'wavelength',
    target: Math.floor(Math.random() * 101),
  }

  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(publicState), secretState: asInputJson(secretState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return publicState
}

export async function getWavelengthSecret(sessionId: string, requestedPlayerId: number) {
  const actor = await requireRoomActor(sessionId)
  const mayRead = actor.playerId === requestedPlayerId || (actor.isHost && actor.room.mode === 'local')
  if (!mayRead) throw new Error('You may only reveal the secret to the Psychic or the host (local mode).')

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true, secretState: true, players: { select: { id: true, guestName: true } } } })
  const publicState = session?.boardState as WavelengthPublic | null
  const secretState = session?.secretState as WavelengthSecret | null
  if (!session || publicState?.kind !== 'wavelength' || secretState?.kind !== 'wavelength') throw new Error('No Wavelength round is active.')
  if (!session.players.some(p => p.id === requestedPlayerId)) throw new Error('Player does not belong to this room.')

  return { target: secretState.target }
}

export async function startTeamGuessing(sessionId: string) {
  const actor = await requireRoomActor(sessionId)
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true } })
  const publicState = session?.boardState as WavelengthPublic | null
  if (!session || publicState?.kind !== 'wavelength') throw new Error('No Wavelength round is active.')
  if (publicState.psychicId !== actor.playerId && !actor.isHost) throw new Error('Only the Psychic can start team guessing.')
  if (publicState.phase !== 'psychic-set') throw new Error('Team guessing has already started.')

  const nextState: WavelengthPublic = { ...publicState, phase: 'team-guess', pointer: 50 }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return nextState
}

export async function setWavelengthPointer(sessionId: string, pointer: number) {
  const actor = await requireRoomActor(sessionId)
  if (actor.room.status !== 'active') throw new Error('The game is not active.')

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true } })
  const publicState = session?.boardState as WavelengthPublic | null
  if (!session || publicState?.kind !== 'wavelength') throw new Error('No Wavelength round is active.')
  if (publicState.phase !== 'team-guess') throw new Error('Not in the guessing phase.')

  // Local mode trusts the host to move the pointer for whichever team is huddled around the
  // shared device. In a share-code room, only the psychic's own teammates may move it —
  // not the psychic (who already knows the target) and not the opposing team.
  const isLocalHost = actor.isHost && actor.room.mode === 'local'
  if (!isLocalHost) {
    if (!actor.playerId) throw new Error('Join as a player to move the pointer.')
    if (actor.playerId === publicState.psychicId) throw new Error('The Psychic cannot move the pointer.')
    const psychicTeam = publicState.teams?.[String(publicState.psychicId)]
    const myTeam = publicState.teams?.[String(actor.playerId)]
    if (!myTeam || myTeam !== psychicTeam) throw new Error("Only the Psychic's team can move the pointer.")
  }

  const nextState: WavelengthPublic = { ...publicState, pointer }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return nextState
}

export async function revealWavelengthRound(sessionId: string) {
  await requireRoomHost(sessionId)
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { id: true, boardState: true, secretState: true, players: { include: { scores: true } } },
  })
  const publicState = session?.boardState as WavelengthPublic | null
  const secretState = session?.secretState as WavelengthSecret | null
  if (!session || publicState?.kind !== 'wavelength' || secretState?.kind !== 'wavelength') throw new Error('No Wavelength round is active.')
  if (publicState.phase !== 'team-guess') throw new Error('Team must be guessing first.')
  if (publicState.pointer === undefined || publicState.pointer === null) throw new Error('Team must set the pointer.')

  // compute points based on distance from target
  const pointer = publicState.pointer
  const target = secretState.target
  const dist = Math.abs(pointer - target)
  let points = 0
  if (dist <= 4) points = 4
  else if (dist <= 12) points = 3
  else if (dist <= 25) points = 2

  const players = session.players
  const teamOf = (pId: number) => publicState.teams?.[String(pId)] ?? (players.findIndex(p => p.id === pId) % 2 === 0 ? 'A' : 'B')
  const psychicTeam = teamOf(publicState.psychicId)

  // award points to all players on psychicTeam
  const round = Math.max(0, ...players.flatMap(p => p.scores.map(s => s.round))) + 1
  if (points > 0) {
    await prisma.$transaction(players.filter(p => teamOf(p.id) === psychicTeam).map(p => prisma.score.create({ data: { playerId: p.id, points, round, notes: 'Wavelength' } })))
  }

  const nextState: WavelengthPublic = { ...publicState, phase: 'revealed', target, pointer }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)

  return { state: nextState, points, distance: dist }
}
