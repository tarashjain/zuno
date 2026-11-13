const test = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')
const tokens = loadTs('lib/player-token.ts')
const now = 1_800_000_000_000

test('player cookies verify identity, room, expiry, and signature', () => {
  const token = tokens.createPlayerToken('room-a', 42, now)
  assert.equal(tokens.readPlayerToken('room-a', token, now), 42)
  assert.equal(tokens.readPlayerToken('room-b', token, now), null)
  assert.equal(tokens.readPlayerToken('room-a', token.replace(/^42/, '43'), now), null)
  const parts = token.split('.')
  parts[1] = String(Number(parts[1]) + 1000)
  assert.equal(tokens.readPlayerToken('room-a', parts.join('.'), now), null)
  assert.equal(tokens.readPlayerToken('room-a', token, now + tokens.PLAYER_TOKEN_MAX_AGE * 1000), null)
  for (const invalid of [undefined, '', '42', '42junk', token + 'x', '1.9999999999.ff']) {
    assert.equal(tokens.readPlayerToken('room-a', invalid, now), null)
  }
})

test('room authorization rejects forged IDs before querying for a player', async () => {
  let cookie = '42'
  let playerReads = 0
  const { getRoomActor } = loadTs('lib/room-auth.ts', {
    '@/lib/db': {
      gameSession: { findUnique: async () => ({ id: 'room-a', hostEmail: 'host@example.com' }) },
      sessionPlayer: { findFirst: async () => { playerReads++; return { id: 42 } } },
    },
    'next/headers': { cookies: () => ({ get: () => ({ value: cookie }) }) },
    'next-auth': { getServerSession: async () => null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/player-token': tokens,
  })
  assert.equal((await getRoomActor('room-a')).authorized, false)
  assert.equal(playerReads, 0)
  cookie = tokens.createPlayerToken('room-a', 42)
  assert.equal((await getRoomActor('room-a')).playerId, 42)
  assert.equal(playerReads, 1)
})

test('generic board writes cannot bypass dedicated game rules', async () => {
  let slug = 'imposter'
  let writes = 0
  const { setBoardState } = loadTs('app/actions/board.ts', {
    '@/lib/db': { gameSession: { update: async () => { writes++ } } },
    'next/cache': { revalidatePath() {} },
    '@/lib/room-auth': { requireRoomActor: async () => ({ room: { status: 'active', game: { slug } } }) },
  })
  for (const protectedGame of ['imposter', 'wavelength', 'scrabble', 'bollywood-code-names', 'judgement-card-game', '100-points']) {
    slug = protectedGame
    await assert.rejects(setBoardState('room', {}), /dedicated actions/)
  }
  assert.equal(writes, 0)
  slug = 'farkle'
  await setBoardState('room', { round: 1 })
  assert.equal(writes, 1)
})

function scoreActions(db, room, auth = { user: { email: 'host@example.com' } }) {
  return loadTs('app/actions/score.ts', {
    '@/lib/db': db,
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect() { throw new Error('redirect') } },
    'next/headers': { cookies: () => ({ get: () => undefined, set() {} }) },
    'next-auth': { getServerSession: async () => auth },
    '@/lib/auth': { authOptions: {} },
    '@/lib/player-token': tokens,
    '@/lib/room-auth': { requireRoomActor: async () => ({ room }), playerCookieName: id => `zuno_player_${id}` },
  })
}

test('generic scores enforce game type, integer range, and round bounds', async () => {
  const room = { status: 'active', game: { slug: 'wavelength' } }
  let writes = 0
  const actions = scoreActions({
    sessionPlayer: { findFirst: async () => ({ id: 1 }) },
    score: { create: async () => { writes++ } },
  }, room)
  await assert.rejects(actions.submitScore('room', 1, 10, 1), /scoring action/)
  room.game.slug = 'score-keeper'
  for (const points of [NaN, Infinity, 1.5, 2_147_483_648, -2_147_483_649]) {
    await assert.rejects(actions.submitScore('room', 1, points, 1), /whole number/)
  }
  for (const round of [0, -1, 1.5, Infinity]) {
    await assert.rejects(actions.submitScore('room', 1, 1, round), /Round/)
  }
  assert.equal(writes, 0)
  await actions.submitScore('room', 1, -10, 1)
  assert.equal(writes, 1)
})

test('completed rooms cannot be restarted, including a concurrent status change', async () => {
  const session = { status: 'completed', hostEmail: 'host@example.com', mode: 'local', players: [{ id: 1 }] }
  let writes = 0
  const actions = scoreActions({ gameSession: {
    findUnique: async () => session,
    updateMany: async ({ where }) => { assert.equal(where.status, 'lobby'); writes++; return { count: 0 } },
  } })
  assert.equal((await actions.startSession('room')).ok, false)
  assert.equal(writes, 0)
  session.status = 'lobby'
  assert.equal((await actions.startSession('room')).ok, false)
  assert.equal(writes, 1)
})

function kidsActions(db, auth) {
  return loadTs('app/actions/kids-session.ts', {
    '@/lib/db': db,
    'next-auth': { getServerSession: async () => auth },
    '@/lib/auth': { authOptions: {} },
    '@/lib/kids-games': { getKidsGame: slug => slug === 'hue-perfect' ? { name: 'Hue Perfect' } : undefined },
  })
}

test('kids history is scoped to the authenticated user, ignoring supplied email', async () => {
  let queriedEmail
  const db = {
    game: { findUnique: async () => ({ id: 1 }) },
    gameSession: { findMany: async ({ where }) => { queriedEmail = where.hostEmail; return [] } },
  }
  await kidsActions(db, { user: { email: 'me@example.com' } }).getKidsHistory('hue-perfect', 'other@example.com')
  assert.equal(queriedEmail, 'me@example.com')
  const result = await kidsActions({}, null).getKidsHistory('hue-perfect', 'other@example.com')
  assert.equal(result.length, 0)
})

test('kids results save duplicate names with their own scores in one nested write', async () => {
  let saved
  const actions = kidsActions({
    game: { upsert: async () => ({ id: 1 }) },
    gameSession: { create: async ({ data }) => { saved = data } },
  }, { user: { email: 'me@example.com' } })
  const players = [{ name: 'Sam', score: 10, won: false }, { name: 'Sam', score: 20, won: true }]
  assert.equal((await actions.saveKidsSession('hue-perfect', players)).ok, true)
  assert.equal(saved.players.create[0].scores.create.points, 10)
  assert.equal(saved.players.create[1].scores.create.points, 20)
  assert.equal(saved.players.create[1].scores.create.notes, 'winner')
  assert.equal((await actions.saveKidsSession('unknown-game', players)).ok, false)
  assert.equal((await actions.saveKidsSession('hue-perfect', [{ name: 'Sam', score: NaN, won: true }])).ok, false)
})

test('Wavelength hides the target from non-psychics and validates pointer values', async () => {
  const actor = { playerId: 2, isHost: false, room: { status: 'active', mode: 'individual' } }
  const actions = loadTs('app/actions/wavelength.ts', {
    '@/lib/db': { gameSession: { findUnique: async () => ({
      boardState: { kind: 'wavelength', psychicId: 1 },
      secretState: { kind: 'wavelength', target: 70 },
      players: [{ id: 1 }, { id: 2 }],
    }) } },
    '@/lib/room-auth': { requireRoomActor: async () => actor },
    'next/cache': { revalidatePath() {} },
  })
  await assert.rejects(actions.getWavelengthSecret('room', 2), /Only the Psychic/)
  await assert.rejects(actions.getWavelengthSecret('room', 1), /only reveal/)
  actor.playerId = 1
  assert.equal((await actions.getWavelengthSecret('room', 1)).target, 70)
  actor.playerId = null
  actor.isHost = true
  actor.room.mode = 'local'
  assert.equal((await actions.getWavelengthSecret('room', 1)).target, 70)
  for (const pointer of [NaN, Infinity, -1, 101]) {
    await assert.rejects(actions.setWavelengthPointer('room', pointer), /between 0 and 100/)
  }
})
