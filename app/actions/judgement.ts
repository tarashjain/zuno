'use server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireRoomActor, requireRoomHost } from '@/lib/room-auth'
import { revalidatePath } from 'next/cache'

export type JudgementPublic = {
  kind: 'judgement'
  round: number
  roundKey: string
  bids: Record<string, number | null>
  won: Record<string, number | null>
}

const asInputJson = (v: unknown) => v as Prisma.InputJsonValue

function defaultState(playerIds: number[]): JudgementPublic {
  return {
    kind: 'judgement',
    round: 1,
    roundKey: randomUUID(),
    bids: Object.fromEntries(playerIds.map(id => [String(id), null])),
    won: Object.fromEntries(playerIds.map(id => [String(id), null])),
  }
}

async function getOrInitState(sessionId: string) {
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, include: { players: true } })
  if (!session) throw new Error('Session not found')
  const existing = session.boardState as JudgementPublic | null
  if (existing?.kind === 'judgement') return { session, state: existing }

  const state = defaultState(session.players.map(p => p.id))
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(state) } })
  return { session, state }
}

export async function submitJudgementBid(sessionId: string, playerId: number, bid: number) {
  const actor = await requireRoomActor(sessionId)
  if (actor.room.status !== 'active') throw new Error('The game is not active.')
  const allowed = actor.playerId === playerId || (actor.isHost && actor.room.mode === 'local')
  if (!allowed) throw new Error('You can only enter your own bid.')

  const { state } = await getOrInitState(sessionId)
  if (!Object.prototype.hasOwnProperty.call(state.bids, String(playerId))) throw new Error('Player does not belong to this room.')

  const nextState: JudgementPublic = { ...state, bids: { ...state.bids, [String(playerId)]: bid } }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return nextState
}

export async function submitJudgementWon(sessionId: string, playerId: number, won: number) {
  const { room, isHost } = await requireRoomActor(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')
  if (!isHost) throw new Error('Only the host records tricks won.')

  const { state } = await getOrInitState(sessionId)
  if (!Object.prototype.hasOwnProperty.call(state.won, String(playerId))) throw new Error('Player does not belong to this room.')

  const nextState: JudgementPublic = { ...state, won: { ...state.won, [String(playerId)]: won } }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return nextState
}

export async function completeJudgementRound(sessionId: string) {
  await requireRoomHost(sessionId)
  const { session, state } = await getOrInitState(sessionId)

  for (const player of session.players) {
    const key = String(player.id)
    if (state.bids[key] === null || state.won[key] === null) {
      throw new Error('Every player needs a bid and a tricks-won value before completing the round.')
    }
  }

  for (const player of session.players) {
    const key = String(player.id)
    const bid = state.bids[key] as number
    const won = state.won[key] as number
    const points = bid === won ? 10 + won : 0
    await prisma.score.create({ data: { playerId: player.id, round: state.round, points, notes: `Bid: ${bid}, Won: ${won}` } })
  }

  const nextState = defaultState(session.players.map(p => p.id))
  nextState.round = state.round + 1
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return nextState
}
