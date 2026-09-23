'use server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireRoomActor, requireRoomHost } from '@/lib/room-auth'

type ImposterSecret = { kind: 'imposter'; pairId: number; imposterId: number }
type ImposterPublic = { kind: 'imposter'; roundKey: string; revealed: boolean }

type PlayerTeam = 'red' | 'blue'
type CardTeam = PlayerTeam | 'neutral' | 'assassin'
type CodenamesPhase = 'setup' | 'clue' | 'guess' | 'over'
type CodenamesSecret = { kind: 'codenames'; cardTeams: Record<string, CardTeam> }
type CodenamesPublic = {
  kind: 'codenames'
  phase: CodenamesPhase
  playerTeams: Record<string, PlayerTeam> // playerId -> team
  spymasters: { red: number | null; blue: number | null } // playerId per team
  grid: { id: number; word: string }[] | null
  revealed: Record<string, CardTeam> // cardId -> revealed card team
  totals: { red: number; blue: number } | null // agents per team, set when dealt
  turn: PlayerTeam | null
  clue: { word: string; number: number } | null
  guessesRemaining: number | null // null = unlimited ("0" or "infinite" clue number)
  winner: PlayerTeam | null
}

const asInputJson = (value: unknown) => value as Prisma.InputJsonValue
const shuffle = <T,>(values: T[]) => [...values].sort(() => Math.random() - 0.5)

async function getCodenamesSession(sessionId: string) {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { game: true, players: { select: { id: true } } },
  })
  if (!session || session.game.slug !== 'bollywood-code-names') throw new Error('Invalid game room.')
  return session
}

async function getExistingCodenamesPublic(sessionId: string): Promise<CodenamesPublic | null> {
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true } })
  const state = session?.boardState as CodenamesPublic | null
  return state?.kind === 'codenames' ? state : null
}

// In local (pass-and-play) mode there's only one shared device, so the host is trusted to
// act on behalf of whichever player is holding it; in a share-code room, a player may only
// act as themselves (their own cookie-verified playerId).
async function assertActingAsPlayer(sessionId: string, playerId: number) {
  const actor = await requireRoomActor(sessionId)
  const allowed = actor.playerId === playerId || (actor.isHost && actor.room.mode === 'local')
  if (!allowed) throw new Error('You can only act as your own player.')
  return actor
}

export async function startImposterRound(sessionId: string): Promise<ImposterPublic> {
  const { room } = await requireRoomHost(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { game: true, players: { select: { id: true } } },
  })
  if (!session || session.game.slug !== 'imposter') throw new Error('Invalid game room.')
  if (session.players.length === 0) throw new Error('Add at least one player.')

  const pairs = await prisma.imposterPair.findMany({ select: { id: true } })
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

  const pair = await prisma.imposterPair.findUnique({
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
  const pair = await prisma.imposterPair.findUnique({
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

// --- Team setup (host or random), before the grid is dealt ---

export async function setCodenamesTeams(sessionId: string, playerTeams: Record<string, PlayerTeam>): Promise<CodenamesPublic> {
  await requireRoomHost(sessionId)
  const session = await getCodenamesSession(sessionId)
  const existing = await getExistingCodenamesPublic(sessionId)
  if (existing && existing.phase !== 'setup') throw new Error('Teams can only be changed before the round starts.')

  const validIds = new Set(session.players.map(p => p.id))
  for (const idStr of Object.keys(playerTeams)) {
    if (!validIds.has(Number(idStr))) throw new Error('Unknown player in team assignment.')
  }

  // Drop a spymaster designation if that player is no longer on their assigned team.
  const prevSpymasters = existing?.spymasters ?? { red: null, blue: null }
  const spymasters = {
    red: prevSpymasters.red !== null && playerTeams[String(prevSpymasters.red)] === 'red' ? prevSpymasters.red : null,
    blue: prevSpymasters.blue !== null && playerTeams[String(prevSpymasters.blue)] === 'blue' ? prevSpymasters.blue : null,
  }

  const publicState: CodenamesPublic = {
    kind: 'codenames', phase: 'setup', playerTeams, spymasters,
    grid: null, revealed: {}, totals: null, turn: null, clue: null, guessesRemaining: null, winner: null,
  }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(publicState) } })
  return publicState
}

export async function randomizeCodenamesTeams(sessionId: string): Promise<CodenamesPublic> {
  await requireRoomHost(sessionId)
  const session = await getCodenamesSession(sessionId)
  const existing = await getExistingCodenamesPublic(sessionId)
  if (existing && existing.phase !== 'setup') throw new Error('Teams can only be changed before the round starts.')
  if (session.players.length < 4) throw new Error('Add at least 4 players — 2 per team, since the Spymaster cannot also guess.')

  const shuffled = shuffle(session.players.map(p => p.id))
  const mid = Math.ceil(shuffled.length / 2)
  const redIds = shuffled.slice(0, mid)
  const blueIds = shuffled.slice(mid)

  const playerTeams: Record<string, PlayerTeam> = {}
  redIds.forEach(id => { playerTeams[String(id)] = 'red' })
  blueIds.forEach(id => { playerTeams[String(id)] = 'blue' })

  const spymasters = {
    red: redIds[Math.floor(Math.random() * redIds.length)] ?? null,
    blue: blueIds[Math.floor(Math.random() * blueIds.length)] ?? null,
  }

  const publicState: CodenamesPublic = {
    kind: 'codenames', phase: 'setup', playerTeams, spymasters,
    grid: null, revealed: {}, totals: null, turn: null, clue: null, guessesRemaining: null, winner: null,
  }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(publicState) } })
  return publicState
}

export async function setCodenamesSpymaster(sessionId: string, team: PlayerTeam, playerId: number | null): Promise<CodenamesPublic> {
  await requireRoomHost(sessionId)
  const existing = await getExistingCodenamesPublic(sessionId)
  if (!existing) throw new Error('Assign teams first.')
  if (existing.phase !== 'setup') throw new Error('The spymaster can only be changed before the round starts.')
  if (playerId !== null && existing.playerTeams[String(playerId)] !== team) {
    throw new Error('That player is not on this team.')
  }

  const nextState: CodenamesPublic = { ...existing, spymasters: { ...existing.spymasters, [team]: playerId } }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  return nextState
}

// --- Dealing the grid ---

export async function startCodenamesGame(sessionId: string): Promise<CodenamesPublic> {
  const { room } = await requireRoomHost(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')
  const session = await getCodenamesSession(sessionId)

  const existing = await getExistingCodenamesPublic(sessionId)
  const playerTeams = existing?.playerTeams ?? {}
  const redIds = session.players.map(p => p.id).filter(id => playerTeams[String(id)] === 'red')
  const blueIds = session.players.map(p => p.id).filter(id => playerTeams[String(id)] === 'blue')
  if (redIds.length < 2 || blueIds.length < 2) {
    throw new Error('Each team needs at least 2 players — a Spymaster and at least one guesser.')
  }

  // Fill in a spymaster at random for any team that doesn't have one yet.
  const spymasters = { ...(existing?.spymasters ?? { red: null, blue: null }) }
  if (spymasters.red === null || !redIds.includes(spymasters.red)) {
    spymasters.red = redIds[Math.floor(Math.random() * redIds.length)]
  }
  if (spymasters.blue === null || !blueIds.includes(spymasters.blue)) {
    spymasters.blue = blueIds[Math.floor(Math.random() * blueIds.length)]
  }

  const words = shuffle(await prisma.bollywoodWord.findMany({
    select: { id: true, word: true },
  })).slice(0, 25)
  if (words.length < 25) throw new Error('At least 25 Codenames words are required.')

  // The starting team gets one extra agent to contact (per the rulebook, whichever
  // color borders the shared key card goes first, with 9 agents vs. the other's 8).
  const startingTeam: PlayerTeam = Math.random() < 0.5 ? 'red' : 'blue'
  const totals: { red: number; blue: number } = startingTeam === 'red' ? { red: 9, blue: 8 } : { red: 8, blue: 9 }

  const cardTeamPool = shuffle<CardTeam>([
    ...Array(totals.red).fill('red' as CardTeam),
    ...Array(totals.blue).fill('blue' as CardTeam),
    ...Array(7).fill('neutral' as CardTeam),
    'assassin',
  ])
  const cardTeams: Record<string, CardTeam> = {}
  words.forEach((word, index) => { cardTeams[String(word.id)] = cardTeamPool[index] })

  const publicState: CodenamesPublic = {
    kind: 'codenames', phase: 'clue',
    playerTeams, spymasters,
    grid: words, revealed: {}, totals,
    turn: startingTeam, clue: null, guessesRemaining: null, winner: null,
  }
  const secretState: CodenamesSecret = { kind: 'codenames', cardTeams }

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { boardState: asInputJson(publicState), secretState: asInputJson(secretState) },
  })
  return publicState
}

export async function resetCodenamesRound(sessionId: string): Promise<CodenamesPublic> {
  await requireRoomHost(sessionId)
  const existing = await getExistingCodenamesPublic(sessionId)
  if (!existing) throw new Error('No Codenames game found.')

  // Keep the team/spymaster assignments so the host can just re-deal, or re-randomize first.
  const nextState: CodenamesPublic = {
    kind: 'codenames', phase: 'setup',
    playerTeams: existing.playerTeams, spymasters: existing.spymasters,
    grid: null, revealed: {}, totals: null, turn: null, clue: null, guessesRemaining: null, winner: null,
  }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  return nextState
}

// --- Turn play ---

export async function giveCodenamesClue(sessionId: string, playerId: number, word: string, number: number): Promise<CodenamesPublic> {
  await assertActingAsPlayer(sessionId, playerId)
  const existing = await getExistingCodenamesPublic(sessionId)
  if (!existing || existing.phase !== 'clue' || !existing.turn) throw new Error('No clue is expected right now.')
  if (existing.spymasters[existing.turn] !== playerId) throw new Error("Only the active team's spymaster can give a clue.")

  const clueWord = word.trim()
  if (!clueWord) throw new Error('Enter a clue word.')
  if (clueWord.length > 40) throw new Error('Clue must be 40 characters or fewer.')
  if (!Number.isInteger(number) || number < 0) throw new Error('Enter a valid number (0 for unlimited).')

  const unrevealedWords = (existing.grid ?? [])
    .filter(card => !existing.revealed[String(card.id)])
    .map(card => card.word.toLowerCase())
  if (unrevealedWords.includes(clueWord.toLowerCase())) {
    throw new Error("Your clue can't be a word still on the board.")
  }

  const nextState: CodenamesPublic = {
    ...existing,
    phase: 'guess',
    clue: { word: clueWord, number },
    guessesRemaining: number === 0 ? null : number + 1,
  }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  return nextState
}

export async function passCodenamesTurn(sessionId: string, playerId: number): Promise<CodenamesPublic> {
  await assertActingAsPlayer(sessionId, playerId)
  const existing = await getExistingCodenamesPublic(sessionId)
  if (!existing || existing.phase !== 'guess' || !existing.turn) throw new Error('There is nothing to pass right now.')
  if (existing.playerTeams[String(playerId)] !== existing.turn) throw new Error("It is not your team's turn.")

  const otherTeam: PlayerTeam = existing.turn === 'red' ? 'blue' : 'red'
  const nextState: CodenamesPublic = { ...existing, phase: 'clue', turn: otherTeam, clue: null, guessesRemaining: null }
  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  return nextState
}

export async function revealCodenamesCard(sessionId: string, playerId: number, cardId: number): Promise<CodenamesPublic> {
  await assertActingAsPlayer(sessionId, playerId)
  const existing = await getExistingCodenamesPublic(sessionId)
  if (!existing || existing.phase !== 'guess' || !existing.turn || !existing.grid || !existing.totals) {
    throw new Error('No guess is expected right now.')
  }
  if (existing.playerTeams[String(playerId)] !== existing.turn) throw new Error("It is not your team's turn.")
  if (existing.spymasters[existing.turn] === playerId) throw new Error('The spymaster cannot reveal cards.')
  if (existing.revealed[String(cardId)]) throw new Error('That card is already revealed.')
  if (!existing.grid.some(card => card.id === cardId)) throw new Error('Card is not on this board.')

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { secretState: true } })
  const secretState = session?.secretState as CodenamesSecret | null
  if (secretState?.kind !== 'codenames') throw new Error('Card assignments are unavailable.')
  const cardTeam = secretState.cardTeams[String(cardId)]
  if (!cardTeam) throw new Error('Card assignment is unavailable.')

  const revealed = { ...existing.revealed, [String(cardId)]: cardTeam }
  const turn = existing.turn
  const otherTeam: PlayerTeam = turn === 'red' ? 'blue' : 'red'
  const countRevealedFor = (team: PlayerTeam) => Object.values(revealed).filter(t => t === team).length

  let nextState: CodenamesPublic

  if (cardTeam === 'assassin') {
    // Touching the assassin is an instant loss for whoever's turn it was.
    nextState = { ...existing, revealed, phase: 'over', winner: otherTeam, clue: null, guessesRemaining: null }
  } else if (cardTeam === turn) {
    if (countRevealedFor(turn) >= existing.totals[turn]) {
      nextState = { ...existing, revealed, phase: 'over', winner: turn, clue: null, guessesRemaining: null }
    } else {
      const remaining = existing.guessesRemaining === null ? null : existing.guessesRemaining - 1
      nextState = remaining !== null && remaining <= 0
        ? { ...existing, revealed, phase: 'clue', turn: otherTeam, clue: null, guessesRemaining: null }
        : { ...existing, revealed, guessesRemaining: remaining }
    }
  } else if (cardTeam !== 'neutral' && countRevealedFor(cardTeam) >= existing.totals[cardTeam]) {
    // Revealed the opposing team's last agent for them — they win.
    nextState = { ...existing, revealed, phase: 'over', winner: cardTeam, clue: null, guessesRemaining: null }
  } else {
    // Wrong guess (opponent's agent or a bystander) ends the turn.
    nextState = { ...existing, revealed, phase: 'clue', turn: otherTeam, clue: null, guessesRemaining: null }
  }

  await prisma.gameSession.update({ where: { id: sessionId }, data: { boardState: asInputJson(nextState) } })
  return nextState
}

export async function getCodenamesSpymasterGrid(sessionId: string, requestedPlayerId: number) {
  const actor = await requireRoomActor(sessionId)
  const existing = await getExistingCodenamesPublic(sessionId)
  if (!existing) throw new Error('No Codenames game is active.')
  const isDesignatedSpymaster = existing.spymasters.red === requestedPlayerId || existing.spymasters.blue === requestedPlayerId
  const mayRead = (actor.playerId === requestedPlayerId && isDesignatedSpymaster) || (actor.isHost && actor.room.mode === 'local')
  if (!mayRead) throw new Error('Only a spymaster may view the key card.')

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { secretState: true } })
  const secretState = session?.secretState as CodenamesSecret | null
  if (secretState?.kind !== 'codenames') throw new Error('No Codenames game is active.')
  return secretState.cardTeams
}
