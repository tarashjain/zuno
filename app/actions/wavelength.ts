'use server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireRoomActor, requireRoomHost } from '@/lib/room-auth'
import { revalidatePath } from 'next/cache'

type WavelengthPublic = {
  kind: 'wavelength'
  spectrum: string
  psychicId: number
  revealed: boolean
  pointer?: number | null
}

type WavelengthSecret = {
  kind: 'wavelength'
  target: number
  band: number
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
  const spectrum = `${chosen.leftLabel} → ${chosen.rightLabel}`
  const psychic = session.players[Math.floor(Math.random() * session.players.length)]
  const publicState: WavelengthPublic = { kind: 'wavelength', spectrum, psychicId: psychic.id, revealed: false }
  // default teams: assign by join order alternating A/B
  const teams: Record<string, string> = Object.fromEntries(session.players.map((p, i) => [String(p.id), i % 2 === 0 ? 'A' : 'B']))
  ;(publicState as any).teams = teams
  const secretState: WavelengthSecret = { kind: 'wavelength', target: Math.floor(Math.random() * 101), band: 12 }

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

export async function revealWavelengthRound(sessionId: string, pointer: number, otherTeamGuess?: 'left' | 'right') {
  await requireRoomHost(sessionId)
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { id: true, boardState: true, secretState: true, players: { include: { scores: true } } },
  })
  const publicState = session?.boardState as WavelengthPublic | null
  const secretState = session?.secretState as WavelengthSecret | null
  if (!session || publicState?.kind !== 'wavelength' || secretState?.kind !== 'wavelength') throw new Error('No Wavelength round is active.')

  // compute points based on distance
  const dist = Math.abs(pointer - secretState.target)
  let points = 0
  if (dist <= secretState.band / 2) points = 4
  else if (dist <= secretState.band * 1.5) points = 3
  else if (dist <= secretState.band * 2.5) points = 2

  // assign teams by join order alternating
  const players = session.players
  const teamOf = (pId: number) => players.findIndex(p => p.id === pId) % 2 === 0 ? 'A' : 'B'
  const psychicTeam = teamOf(publicState.psychicId)
  const otherTeam = psychicTeam === 'A' ? 'B' : 'A'

  // award points to all players on psychicTeam
  const round = Math.max(0, ...players.flatMap(p => p.scores.map(s => s.round))) + 1
  if (points > 0) {
    await prisma.$transaction(players.filter(p => teamOf(p.id) === psychicTeam).map(p => prisma.score.create({ data: { playerId: p.id, points, round, notes: 'Wavelength round' } })))
  }

  // other team bonus guess
  if (otherTeamGuess) {
    const otherCorrect = (otherTeamGuess === 'left' && secretState.target < pointer) || (otherTeamGuess === 'right' && secretState.target > pointer)
    if (otherCorrect) {
      await prisma.$transaction(players.filter(p => teamOf(p.id) === otherTeam).map(p => prisma.score.create({ data: { playerId: p.id, points: 1, round, notes: 'Wavelength other-team bonus' } })))
    }
  }

  const nextState: WavelengthPublic = { ...publicState, revealed: true, pointer }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)

  return { state: nextState, awarded: points }
}
