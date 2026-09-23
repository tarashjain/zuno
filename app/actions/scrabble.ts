'use server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireRoomActor, requireRoomHost } from '@/lib/room-auth'
import { revalidatePath } from 'next/cache'
import {
  BLANK, RACK_SIZE,
  createShuffledBag, drawTiles, emptyBoard, shuffle, sumRackValue, validatePlacement,
  type Board, type Placement,
} from '@/lib/scrabble'

export type ScrabblePublic = {
  kind: 'scrabble'
  phase: 'lobby' | 'playing' | 'finished'
  turnKey: string
  board: Board
  turnOrder: number[]
  turnIndex: number
  bagCount: number
  rackCounts: Record<string, number>
  consecutivePasses: number
  lastMove: { playerId: number; type: 'play' | 'exchange' | 'pass'; words: string[]; score: number } | null
  winnerIds: number[] | null
}

type ScrabbleSecret = {
  kind: 'scrabble'
  bag: string[]
  racks: Record<string, string[]>
}

const asInputJson = (v: unknown) => v as Prisma.InputJsonValue

async function assertActingAsPlayer(sessionId: string, playerId: number) {
  const actor = await requireRoomActor(sessionId)
  const allowed = actor.playerId === playerId || (actor.isHost && actor.room.mode === 'local')
  if (!allowed) throw new Error('You can only act as your own player.')
  return actor
}

function letterRank(letter: string): number {
  if (letter === BLANK) return 0
  return letter.charCodeAt(0) - 'A'.charCodeAt(0) + 1
}

function determineFirstPlayerIndex(playerCount: number): number {
  let candidates = Array.from({ length: playerCount }, (_, i) => i)
  while (candidates.length > 1) {
    const drawBag = createShuffledBag()
    const draws = candidates.map((_, idx) => drawBag[idx])
    const ranks = draws.map(letterRank)
    const minRank = Math.min(...ranks)
    candidates = candidates.filter((_, idx) => ranks[idx] === minRank)
  }
  return candidates[0]
}

function nextRound(players: { scores: { round: number }[] }[]) {
  return Math.max(0, ...players.flatMap(p => p.scores.map(s => s.round))) + 1
}

// Ends the game: penalizes every player still holding tiles, and — if someone went out by
// emptying their rack — awards them the sum of everyone else's leftover tile values.
async function tallyEndGame(
  players: { id: number; scores: { round: number }[] }[],
  racks: Record<string, string[]>,
  wentOutPlayerId: number | null,
) {
  const round = nextRound(players)
  const rows: Prisma.ScoreCreateManyInput[] = []
  let bonusPool = 0

  for (const player of players) {
    if (player.id === wentOutPlayerId) continue
    const rackValue = sumRackValue(racks[String(player.id)] ?? [])
    if (rackValue > 0) {
      rows.push({ playerId: player.id, round, points: -rackValue, notes: 'Unplayed tile penalty' })
      bonusPool += rackValue
    }
  }
  if (wentOutPlayerId !== null && bonusPool > 0) {
    rows.push({ playerId: wentOutPlayerId, round, points: bonusPool, notes: "Opponents' leftover tiles" })
  }
  if (rows.length > 0) {
    await prisma.score.createMany({ data: rows })
  }

  // Winner(s) = highest cumulative score across all rounds, including what was just written.
  const totals = new Map<number, number>()
  for (const player of players) totals.set(player.id, 0)
  const allScores = await prisma.score.findMany({ where: { playerId: { in: players.map(p => p.id) } } })
  for (const s of allScores) totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.points)
  const maxTotal = Math.max(...Array.from(totals.values()))
  const winnerIds = players.filter(p => totals.get(p.id) === maxTotal).map(p => p.id)
  return winnerIds
}

export async function startScrabbleGame(sessionId: string): Promise<ScrabblePublic> {
  const { room } = await requireRoomHost(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, include: { players: true } })
  if (!session) throw new Error('Session not found')

  const existing = session.boardState as ScrabblePublic | null
  if (existing?.kind === 'scrabble' && existing.phase === 'playing') {
    throw new Error('A game is already in progress.')
  }

  if (session.players.length < 2 || session.players.length > 4) {
    throw new Error('Scrabble needs 2 to 4 players.')
  }

  const bag = createShuffledBag()
  const turnOrder = session.players.map(p => p.id)
  const firstIndex = determineFirstPlayerIndex(turnOrder.length)

  const racks: Record<string, string[]> = {}
  let remainingBag = bag
  for (const player of session.players) {
    const { drawn, remaining } = drawTiles(remainingBag, RACK_SIZE)
    racks[String(player.id)] = drawn
    remainingBag = remaining
  }

  const publicState: ScrabblePublic = {
    kind: 'scrabble',
    phase: 'playing',
    turnKey: randomUUID(),
    board: emptyBoard(),
    turnOrder,
    turnIndex: firstIndex,
    bagCount: remainingBag.length,
    rackCounts: Object.fromEntries(turnOrder.map(id => [String(id), RACK_SIZE])),
    consecutivePasses: 0,
    lastMove: null,
    winnerIds: null,
  }

  const secretState: ScrabbleSecret = { kind: 'scrabble', bag: remainingBag, racks }

  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(publicState), secretState: asInputJson(secretState) } })
  revalidatePath(`/room/${sessionId}/play`)
  return publicState
}

export async function getScrabbleRack(sessionId: string, requestedPlayerId: number): Promise<{ rack: string[] }> {
  const actor = await requireRoomActor(sessionId)
  const mayRead = actor.playerId === requestedPlayerId || (actor.isHost && actor.room.mode === 'local')
  if (!mayRead) throw new Error('You may only view your own tiles (or the host, in local mode).')

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true, secretState: true, players: { select: { id: true } } } })
  const publicState = session?.boardState as ScrabblePublic | null
  const secretState = session?.secretState as ScrabbleSecret | null
  if (!session || publicState?.kind !== 'scrabble' || secretState?.kind !== 'scrabble') throw new Error('No Scrabble game is active.')
  if (!session.players.some(p => p.id === requestedPlayerId)) throw new Error('Player does not belong to this room.')

  return { rack: secretState.racks[String(requestedPlayerId)] ?? [] }
}

export async function playScrabbleWord(sessionId: string, playerId: number, placements: Placement[]) {
  const actor = await assertActingAsPlayer(sessionId, playerId)
  if (actor.room.status !== 'active') throw new Error('The game is not active.')

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { boardState: true, secretState: true, players: { include: { scores: true } } },
  })
  const publicState = session?.boardState as ScrabblePublic | null
  const secretState = session?.secretState as ScrabbleSecret | null
  if (!session || publicState?.kind !== 'scrabble' || secretState?.kind !== 'scrabble') throw new Error('No Scrabble game is active.')
  if (publicState.phase !== 'playing') throw new Error('The game is not in progress.')
  if (publicState.turnOrder[publicState.turnIndex] !== playerId) throw new Error("It's not your turn.")

  const rack = [...(secretState.racks[String(playerId)] ?? [])]
  for (const p of placements) {
    const token = p.isBlank ? BLANK : p.letter.toUpperCase()
    const idx = rack.indexOf(token)
    if (idx === -1) throw new Error("You don't have that tile.")
    rack.splice(idx, 1)
  }

  const isFirstMove = publicState.board.every(row => row.every(cell => cell === null))
  const validation = validatePlacement(publicState.board, placements, isFirstMove)
  if (!validation.ok) throw new Error(validation.error)

  const nextBoard: Board = publicState.board.map(row => [...row])
  for (const p of placements) {
    nextBoard[p.row][p.col] = { letter: p.letter.toUpperCase(), isBlank: p.isBlank }
  }

  const { drawn, remaining: bagAfterDraw } = drawTiles(secretState.bag, placements.length)
  const newRack = [...rack, ...drawn]

  const round = nextRound(session.players)
  await prisma.score.create({
    data: { playerId, round, points: validation.result.totalScore, notes: validation.result.words.map(w => w.text).join(' + ') },
  })

  const gameEnds = bagAfterDraw.length === 0 && newRack.length === 0

  let winnerIds: number[] | null = null
  let nextTurnIndex = publicState.turnIndex
  const nextRacks: Record<string, string[]> = { ...secretState.racks, [String(playerId)]: newRack }

  if (gameEnds) {
    winnerIds = await tallyEndGame(session.players, nextRacks, playerId)
  } else {
    nextTurnIndex = (publicState.turnIndex + 1) % publicState.turnOrder.length
  }

  const nextPublic: ScrabblePublic = {
    ...publicState,
    turnKey: randomUUID(),
    board: nextBoard,
    turnIndex: nextTurnIndex,
    bagCount: bagAfterDraw.length,
    rackCounts: { ...publicState.rackCounts, [String(playerId)]: newRack.length },
    consecutivePasses: 0,
    lastMove: { playerId, type: 'play', words: validation.result.words.map(w => w.text), score: validation.result.totalScore },
    phase: gameEnds ? 'finished' : 'playing',
    winnerIds,
  }
  const nextSecret: ScrabbleSecret = { kind: 'scrabble', bag: bagAfterDraw, racks: nextRacks }

  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextPublic), secretState: asInputJson(nextSecret) } })
  revalidatePath(`/room/${sessionId}/play`)

  return { state: nextPublic, rack: newRack, score: validation.result.totalScore, words: validation.result.words.map(w => w.text) }
}

export async function exchangeScrabbleTiles(sessionId: string, playerId: number, letters: string[]) {
  const actor = await assertActingAsPlayer(sessionId, playerId)
  if (actor.room.status !== 'active') throw new Error('The game is not active.')

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true, secretState: true } })
  const publicState = session?.boardState as ScrabblePublic | null
  const secretState = session?.secretState as ScrabbleSecret | null
  if (!session || publicState?.kind !== 'scrabble' || secretState?.kind !== 'scrabble') throw new Error('No Scrabble game is active.')
  if (publicState.phase !== 'playing') throw new Error('The game is not in progress.')
  if (publicState.turnOrder[publicState.turnIndex] !== playerId) throw new Error("It's not your turn.")
  if (letters.length === 0 || letters.length > RACK_SIZE) throw new Error('Choose 1 to 7 tiles to exchange.')
  if (secretState.bag.length < RACK_SIZE) throw new Error('Not enough tiles left in the bag to exchange.')

  const rack = [...(secretState.racks[String(playerId)] ?? [])]
  const toExchange = letters.map(l => (l === BLANK ? BLANK : l.toUpperCase()))
  for (const token of toExchange) {
    const idx = rack.indexOf(token)
    if (idx === -1) throw new Error("You don't have that tile.")
    rack.splice(idx, 1)
  }

  const { drawn, remaining } = drawTiles(secretState.bag, toExchange.length)
  const newRack = [...rack, ...drawn]
  const newBag = shuffle([...remaining, ...toExchange])

  const nextTurnIndex = (publicState.turnIndex + 1) % publicState.turnOrder.length
  const nextPublic: ScrabblePublic = {
    ...publicState,
    turnKey: randomUUID(),
    turnIndex: nextTurnIndex,
    bagCount: newBag.length,
    rackCounts: { ...publicState.rackCounts, [String(playerId)]: newRack.length },
    consecutivePasses: 0,
    lastMove: { playerId, type: 'exchange', words: [], score: 0 },
  }
  const nextSecret: ScrabbleSecret = { kind: 'scrabble', bag: newBag, racks: { ...secretState.racks, [String(playerId)]: newRack } }

  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextPublic), secretState: asInputJson(nextSecret) } })
  revalidatePath(`/room/${sessionId}/play`)

  return { state: nextPublic, rack: newRack }
}

export async function passScrabbleTurn(sessionId: string, playerId: number) {
  const actor = await assertActingAsPlayer(sessionId, playerId)
  if (actor.room.status !== 'active') throw new Error('The game is not active.')

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { boardState: true, secretState: true, players: { include: { scores: true } } },
  })
  const publicState = session?.boardState as ScrabblePublic | null
  const secretState = session?.secretState as ScrabbleSecret | null
  if (!session || publicState?.kind !== 'scrabble' || secretState?.kind !== 'scrabble') throw new Error('No Scrabble game is active.')
  if (publicState.phase !== 'playing') throw new Error('The game is not in progress.')
  if (publicState.turnOrder[publicState.turnIndex] !== playerId) throw new Error("It's not your turn.")

  const consecutivePasses = publicState.consecutivePasses + 1
  const fullLap = consecutivePasses >= publicState.turnOrder.length

  let winnerIds: number[] | null = null
  if (fullLap) {
    winnerIds = await tallyEndGame(session.players, secretState.racks, null)
  }

  const nextPublic: ScrabblePublic = {
    ...publicState,
    turnKey: randomUUID(),
    turnIndex: (publicState.turnIndex + 1) % publicState.turnOrder.length,
    consecutivePasses,
    lastMove: { playerId, type: 'pass', words: [], score: 0 },
    phase: fullLap ? 'finished' : 'playing',
    winnerIds,
  }

  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextPublic) } })
  revalidatePath(`/room/${sessionId}/play`)

  return { state: nextPublic }
}
