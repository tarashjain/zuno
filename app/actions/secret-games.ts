'use server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireRoomActor, requireRoomHost } from '@/lib/room-auth'

type Team = 'red' | 'blue' | 'neutral' | 'assassin'
type ImposterSecret = { kind: 'imposter'; pairId: number; imposterId: number }
type ImposterPublic = { kind: 'imposter'; roundKey: string; revealed: boolean }
type CodenamesSecret = { kind: 'codenames'; teams: Record<string, Team> }
type CodenamesPublic = {
  kind: 'codenames'
  grid: { id: number; word: string }[]
  revealed: Record<string, Team>
}

const asInputJson = (value: unknown) => value as Prisma.InputJsonValue
const shuffle = <T,>(values: T[]) => [...values].sort(() => Math.random() - 0.5)

export async function startImposterRound(sessionId: string): Promise<ImposterPublic> {
  const { room } = await requireRoomHost(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { game: true, players: { select: { id: true } } },
  })
  if (!session || session.game.slug !== 'imposter') throw new Error('Invalid game room.')
  if (session.players.length === 0) throw new Error('Add at least one player.')

  const pairs = await prisma.gameWord.findMany({
    where: { gameId: session.gameId, pairWord: { not: null } },
    select: { id: true },
  })
  if (pairs.length === 0) throw new Error('No Imposter word pairs are configured.')

  const pair = pairs[Math.floor(Math.random() * pairs.length)]
  const imposter = session.players[Math.floor(Math.random() * session.players.length)]
  const publicState: ImposterPublic = { kind: 'imposter', roundKey: randomUUID(), revealed: false }
  const secretState: ImposterSecret = { kind: 'imposter', pairId: pair.id, imposterId: imposter.id }

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { boardState: asInputJson(publicState), secretState: asInputJson(secretState) },
  })
  return publicState
}

export async function getImposterSecret(sessionId: string, requestedPlayerId: number) {
  const actor = await requireRoomActor(sessionId)
  const mayRead = actor.playerId === requestedPlayerId || (actor.isHost && actor.room.mode === 'local')
  if (!mayRead) throw new Error('You may only reveal your own word.')

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      boardState: true,
      secretState: true,
      players: { select: { id: true, guestName: true } },
    },
  })
  const publicState = session?.boardState as ImposterPublic | null
  const secretState = session?.secretState as ImposterSecret | null
  if (!session || publicState?.kind !== 'imposter' || secretState?.kind !== 'imposter') {
    throw new Error('No Imposter round is active.')
  }
  if (!session.players.some(player => player.id === requestedPlayerId)) {
    throw new Error('Player does not belong to this room.')
  }

  const pair = await prisma.gameWord.findUnique({
    where: { id: secretState.pairId },
    select: { word: true, pairWord: true },
  })
  if (!pair?.pairWord) throw new Error('Imposter words are unavailable.')

  const imposter = session.players.find(player => player.id === secretState.imposterId)
  return {
    word: requestedPlayerId === secretState.imposterId ? pair.pairWord : pair.word,
    isImposter: requestedPlayerId === secretState.imposterId,
    reveal: publicState.revealed
      ? { imposterName: imposter?.guestName ?? 'Unknown', regularWord: pair.word, imposterWord: pair.pairWord }
      : null,
  }
}

export async function revealImposterRound(sessionId: string) {
  await requireRoomHost(sessionId)
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { boardState: true, secretState: true, players: { select: { id: true, guestName: true } } },
  })
  const publicState = session?.boardState as ImposterPublic | null
  const secretState = session?.secretState as ImposterSecret | null
  if (!session || publicState?.kind !== 'imposter' || secretState?.kind !== 'imposter') {
    throw new Error('No Imposter round is active.')
  }

  const nextState: ImposterPublic = { ...publicState, revealed: true }
  const pair = await prisma.gameWord.findUnique({
    where: { id: secretState.pairId },
    select: { word: true, pairWord: true },
  })
  const imposter = session.players.find(player => player.id === secretState.imposterId)
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })

  return {
    state: nextState,
    reveal: {
      imposterName: imposter?.guestName ?? 'Unknown',
      regularWord: pair?.word ?? '',
      imposterWord: pair?.pairWord ?? '',
    },
  }
}

export async function startCodenamesGame(sessionId: string): Promise<CodenamesPublic> {
  const { room } = await requireRoomHost(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { game: true },
  })
  if (!session || session.game.slug !== 'bollywood-code-names') throw new Error('Invalid game room.')

  const words = shuffle(await prisma.gameWord.findMany({
    where: { gameId: session.gameId },
    select: { id: true, word: true },
  })).slice(0, 25)
  if (words.length < 25) throw new Error('At least 25 Codenames words are required.')

  const teams = shuffle<Team>([
    ...Array(9).fill('red' as Team),
    ...Array(8).fill('blue' as Team),
    ...Array(7).fill('neutral' as Team),
    'assassin',
  ])
  const assignments = Object.fromEntries(words.map((word, index) => [String(word.id), teams[index]]))
  const publicState: CodenamesPublic = { kind: 'codenames', grid: words, revealed: {} }
  const secretState: CodenamesSecret = { kind: 'codenames', teams: assignments }

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { boardState: asInputJson(publicState), secretState: asInputJson(secretState) },
  })
  return publicState
}

export async function revealCodenamesCard(sessionId: string, cardId: number): Promise<CodenamesPublic> {
  await requireRoomActor(sessionId)
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { boardState: true, secretState: true },
  })
  const publicState = session?.boardState as CodenamesPublic | null
  const secretState = session?.secretState as CodenamesSecret | null
  if (!session || publicState?.kind !== 'codenames' || secretState?.kind !== 'codenames') {
    throw new Error('No Codenames game is active.')
  }
  if (!publicState.grid.some(card => card.id === cardId)) throw new Error('Card is not on this board.')

  const team = secretState.teams[String(cardId)]
  if (!team) throw new Error('Card assignment is unavailable.')
  const nextState: CodenamesPublic = {
    ...publicState,
    revealed: { ...publicState.revealed, [String(cardId)]: team },
  }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  return nextState
}

export async function getCodenamesSpymasterGrid(sessionId: string) {
  await requireRoomHost(sessionId)
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { secretState: true } })
  const secretState = session?.secretState as CodenamesSecret | null
  if (secretState?.kind !== 'codenames') throw new Error('No Codenames game is active.')
  return secretState.teams
}
