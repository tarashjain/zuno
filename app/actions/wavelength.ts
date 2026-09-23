'use server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireRoomActor, requireRoomHost } from '@/lib/room-auth'
import { revalidatePath } from 'next/cache'

type WavelengthPublic = {
  kind: 'wavelength'
  spectrum: [string, string] // [left, right]
  psychicId: number
  phase: 'psychic-set' | 'team-guess' | 'revealed'
  pointer?: number | null
  target?: number | null // revealed only after phase is 'revealed'
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
  if (session.players.length === 0) throw new Error('Add at least one player.')

  const spectra = await prisma.wavelengthSpectrum.findMany({ select: { leftLabel: true, rightLabel: true } })
  if (spectra.length === 0) throw new Error('No Wavelength spectra are configured.')
  const chosen = spectra[Math.floor(Math.random() * spectra.length)]
  const psychic = session.players[Math.floor(Math.random() * session.players.length)]

  const teams: Record<string, 'A' | 'B'> = Object.fromEntries(session.players.map((p, i) => [String(p.id), i % 2 === 0 ? 'A' : 'B']))

  const publicState: WavelengthPublic = {
    kind: 'wavelength',
    spectrum: [chosen.leftLabel, chosen.rightLabel],
    psychicId: psychic.id,
    phase: 'psychic-set',
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

  return { target: secretState.target, band: secretState.band }
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

export async function assignWavelengthTeams(sessionId: string, teams: Record<string, 'A' | 'B'>) {
  await requireRoomHost(sessionId)
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true } })
  const publicState = session?.boardState as WavelengthPublic | null
  if (!session || publicState?.kind !== 'wavelength') throw new Error('No Wavelength round is active.')

  const nextState = { ...publicState, teams }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return nextState
}

export async function setWavelengthPointer(sessionId: string, pointer: number) {
  const { room } = await requireRoomActor(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true } })
  const publicState = session?.boardState as WavelengthPublic | null
  if (!session || publicState?.kind !== 'wavelength') throw new Error('No Wavelength round is active.')

  const nextState = { ...publicState, pointer }
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
