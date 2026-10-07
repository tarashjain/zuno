'use server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireRoomActor, requireRoomHost } from '@/lib/room-auth'
import { revalidatePath } from 'next/cache'

const ELIMINATION_THRESHOLD = 100

export type HundredPointsPublic = {
  kind: 'hundred-points'
  round: number
  roundKey: string
  entries: Record<string, number | null>
  eliminated: number[]
  winnerIds: number[] | null
}

const asInputJson = (v: unknown) => v as Prisma.InputJsonValue

function defaultState(activePlayerIds: number[], eliminated: number[]): HundredPointsPublic {
  return {
    kind: 'hundred-points',
    round: 1,
    roundKey: randomUUID(),
    entries: Object.fromEntries(activePlayerIds.map(id => [String(id), null])),
    eliminated,
    winnerIds: null,
  }
}

async function getOrInitState(sessionId: string) {
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, include: { players: { include: { scores: true } } } })
  if (!session) throw new Error('Session not found')
  const existing = session.boardState as HundredPointsPublic | null
  if (existing?.kind === 'hundred-points') return { session, state: existing }

  const state = defaultState(session.players.map(p => p.id), [])
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(state) } })
  return { session, state }
}

function totalOf(player: { scores: { points: number }[] }) {
  return player.scores.reduce((sum, s) => sum + s.points, 0)
}

export async function submitHundredPointsEntry(sessionId: string, playerId: number, points: number) {
  const actor = await requireRoomActor(sessionId)
  if (actor.room.status !== 'active') throw new Error('The game is not active.')
  const allowed = actor.playerId === playerId || (actor.isHost && actor.room.mode === 'local')
  if (!allowed) throw new Error('You can only enter your own points.')

  const { state } = await getOrInitState(sessionId)
  if (state.winnerIds) throw new Error('The game is already over.')
  if (!Object.prototype.hasOwnProperty.call(state.entries, String(playerId))) {
    throw new Error('That player is not active in this round.')
  }

  const nextState: HundredPointsPublic = { ...state, entries: { ...state.entries, [String(playerId)]: points } }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return nextState
}

export async function completeHundredPointsRound(sessionId: string) {
  await requireRoomHost(sessionId)
  const { state } = await getOrInitState(sessionId)
  if (state.winnerIds) throw new Error('The game is already over.')

  const activeIds = Object.keys(state.entries).map(Number)
  for (const id of activeIds) {
    if (state.entries[String(id)] === null) throw new Error('Every remaining player needs to enter their points before completing the round.')
  }

  for (const id of activeIds) {
    const points = state.entries[String(id)] as number
    await prisma.score.create({ data: { playerId: id, round: state.round, points, notes: `Round ${state.round}` } })
  }

  const updatedPlayers = await prisma.sessionPlayer.findMany({ where: { id: { in: activeIds } }, include: { scores: true } })
  const newlyEliminated = updatedPlayers.filter(p => totalOf(p) >= ELIMINATION_THRESHOLD).map(p => p.id)
  const eliminated = [...state.eliminated, ...newlyEliminated]
  const remaining = activeIds.filter(id => !newlyEliminated.includes(id))

  let winnerIds: number[] | null = null
  if (remaining.length === 1) {
    winnerIds = remaining
  } else if (remaining.length === 0) {
    // Everyone still standing busted in the same round — the one(s) with the lowest total "lasted longest."
    const minTotal = Math.min(...updatedPlayers.map(totalOf))
    winnerIds = updatedPlayers.filter(p => totalOf(p) === minTotal).map(p => p.id)
  }

  const nextState: HundredPointsPublic = winnerIds
    ? { kind: 'hundred-points', round: state.round, roundKey: randomUUID(), entries: {}, eliminated, winnerIds }
    : { ...defaultState(remaining, eliminated), round: state.round + 1 }

  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return nextState
}
