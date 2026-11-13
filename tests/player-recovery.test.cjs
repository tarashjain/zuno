const test = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')
const tokens = loadTs('lib/player-token.ts')

test('recovery tokens are room-bound, expire, and cannot be used as player cookies', () => {
  const now = 1_800_000_000_000
  const recovery = tokens.createRecoveryToken('room', 42, now)
  assert.equal(tokens.readRecoveryToken('room', recovery, now), 42)
  assert.equal(tokens.readRecoveryToken('another-room', recovery, now), null)
  assert.equal(tokens.readRecoveryToken('room', recovery.replace(/^42/, '43'), now), null)
  assert.equal(tokens.readRecoveryToken('room', recovery, now + tokens.RECOVERY_TOKEN_MAX_AGE * 1000), null)
  assert.equal(tokens.readPlayerToken('room', recovery, now), null)
  assert.equal(tokens.readRecoveryToken('room', tokens.createPlayerToken('room', 42, now), now), null)
  assert.equal(tokens.readRecoveryToken('room', '42', now), null)
})

function recoveryRoom(status = 'active') {
  const state = {
    room: { id: 'room', hostEmail: 'host@example.com', mode: 'individual', status },
    auth: { user: { email: 'host@example.com' } },
    cookie: '42', playerPresent: true, cookieWrites: 0,
  }
  const db = {
    gameSession: { findUnique: async ({ where }) => where.id === 'room' ? state.room : null },
    sessionPlayer: { findFirst: async ({ where }) => state.playerPresent && where.sessionId === 'room' && where.id === 42 ? { id: 42 } : null },
  }
  const headers = { cookies: () => ({
    get: () => ({ value: state.cookie }),
    set: (name, value, options) => {
      assert.equal(name, 'zuno_player_room')
      assert.equal(options.httpOnly, true)
      assert.equal(options.sameSite, 'lax')
      state.cookieWrites++
      state.cookie = value
    },
  }) }
  const actors = loadTs('lib/room-auth.ts', {
    '@/lib/db': db, 'next/headers': headers,
    'next-auth': { getServerSession: async () => state.auth },
    '@/lib/auth': { authOptions: {} }, '@/lib/player-token': tokens,
  })
  const actions = loadTs('app/actions/player-recovery.ts', {
    '@/lib/db': db, 'next/headers': headers, '@/lib/room-auth': actors, '@/lib/player-token': tokens,
  })
  return { state, actors, actions }
}

test('host-approved recovery restores legacy guests in active and lobby rooms without creating players', async () => {
  for (const status of ['lobby', 'active']) {
    const { state, actors, actions } = recoveryRoom(status)
    const { token } = await actions.issuePlayerRecovery('room', 42)
    state.auth = null
    assert.equal((await actors.getRoomActor('room')).authorized, false)
    const result = await actions.redeemPlayerRecovery('room', token)
    assert.equal(result.ok, true)
    assert.equal(result.destination, status === 'active' ? '/room/room/play' : '/room/room')
    assert.equal(state.cookieWrites, 1)
    const actor = await actors.getRoomActor('room')
    assert.equal(actor.playerId, 42)
    assert.equal(actor.authorized, true)
  }
})

test('guests cannot issue recovery links, and hosts cannot target another room’s player', async () => {
  const { state, actions } = recoveryRoom()
  state.auth = null
  await assert.rejects(actions.issuePlayerRecovery('room', 42), /Only the room host/)
  state.cookie = tokens.createPlayerToken('room', 42)
  await assert.rejects(actions.issuePlayerRecovery('room', 42), /Only the room host/)
  state.auth = { user: { email: 'host@example.com' } }
  await assert.rejects(actions.issuePlayerRecovery('room', 99), /Player not found/)
  for (const status of ['completed', 'closed']) {
    state.room.status = status
    await assert.rejects(actions.issuePlayerRecovery('room', 42), /open share-code/)
  }
  state.room.status = 'active'
  state.room.mode = 'local'
  await assert.rejects(actions.issuePlayerRecovery('room', 42), /open share-code/)
})

test('recovery refuses forged links, deleted players, and closed or local rooms', async () => {
  const { state, actions } = recoveryRoom()
  const { token } = await actions.issuePlayerRecovery('room', 42)
  state.auth = null
  for (const invalid of ['42', token + 'x', tokens.createRecoveryToken('other-room', 42), tokens.createRecoveryToken('room', 42, Date.now() - 601000)]) {
    assert.equal((await actions.redeemPlayerRecovery('room', invalid)).ok, false)
  }
  state.playerPresent = false
  assert.equal((await actions.redeemPlayerRecovery('room', token)).ok, false)
  state.playerPresent = true
  state.room.status = 'completed'
  assert.equal((await actions.redeemPlayerRecovery('room', token)).ok, false)
  state.room.status = 'active'
  state.room.mode = 'local'
  assert.equal((await actions.redeemPlayerRecovery('room', token)).ok, false)
  assert.equal(state.cookieWrites, 0)
})

test('recovery does not replace a different verified player on the device', async () => {
  const actions = loadTs('app/actions/player-recovery.ts', {
    '@/lib/db': {}, 'next/headers': {}, '@/lib/player-token': tokens,
    '@/lib/room-auth': { getRoomActor: async () => ({ room: { status: 'active', mode: 'individual' }, playerId: 7 }) },
  })
  const result = await actions.redeemPlayerRecovery('room', tokens.createRecoveryToken('room', 42))
  assert.equal(result.ok, false)
  assert.match(result.reason, /different player/)
})

function joinRoom({ signing = tokens, cookieFailure = false } = {}) {
  const state = {
    rows: [], transactions: 0, cookie: undefined,
    room: { status: 'lobby', mode: 'individual', hostEmail: 'host@example.com' },
    auth: { user: { email: 'host@example.com' } },
  }
  const db = {
    gameSession: { findUnique: async () => state.room },
    sessionPlayer: {
      findFirst: async () => null,
      deleteMany: async ({ where }) => {
        assert.equal(where.session.status, 'lobby')
        const previous = state.rows.length
        state.rows = state.rows.filter(row => row.id !== where.id || row.sessionId !== where.sessionId || state.room.status !== 'lobby')
        return { count: previous - state.rows.length }
      },
    },
    $transaction: async callback => {
      state.transactions++
      const staged = []
      const result = await callback({ sessionPlayer: { create: async ({ data }) => {
        const row = { id: 42, ...data }
        staged.push(row)
        return row
      } } })
      state.rows.push(...staged)
      return result
    },
  }
  const actions = loadTs('app/actions/score.ts', {
    '@/lib/db': db, 'next/cache': { revalidatePath() {} }, 'next/navigation': {},
    'next/headers': { cookies: () => ({ get: () => undefined, set(name, value) {
      if (cookieFailure) throw new Error('Cookie unavailable')
      state.cookie = value
    } }) },
    'next-auth': { getServerSession: async () => state.auth }, '@/lib/auth': { authOptions: {} },
    '@/lib/room-auth': { playerCookieName: id => `zuno_player_${id}` }, '@/lib/player-token': signing,
  })
  return { state, actions }
}

test('missing signing configuration prevents any join transaction or player insertion', async () => {
  const { state, actions } = joinRoom({ signing: loadTs('lib/player-token.ts', {}, {}) })
  assert.equal((await actions.joinSession('room', 'Alex')).ok, false)
  assert.equal(state.transactions, 0)
  assert.equal(state.rows.length, 0)
  assert.equal(state.cookie, undefined)
})

test('signing or cookie failures roll back player creation', async () => {
  for (const options of [
    { cookieFailure: true },
    { signing: { ...tokens, createPlayerTokenSigner: () => () => { throw new Error('Signing failed') } } },
  ]) {
    const { state, actions } = joinRoom(options)
    assert.equal((await actions.joinSession('room', 'Alex')).ok, false)
    assert.equal(state.transactions, 1)
    assert.equal(state.rows.length, 0)
  }
})

test('successful joins save a player and a valid signed cookie', async () => {
  const { state, actions } = joinRoom()
  const result = await actions.joinSession('room', 'Alex')
  assert.equal(result.ok, true)
  assert.equal(result.id, 42)
  assert.equal(state.rows.length, 1)
  assert.equal(tokens.readPlayerToken('room', state.cookie), 42)
})

test('only hosts can remove abandoned share-code lobby players; active games stay intact', async () => {
  const { state, actions } = joinRoom()
  state.rows.push({ id: 42, sessionId: 'room' })
  state.auth = { user: { email: 'guest@example.com' } }
  assert.equal((await actions.removePlayer('room', 42)).ok, false)
  assert.equal(state.rows.length, 1)
  state.auth = { user: { email: 'host@example.com' } }
  state.room.status = 'active'
  assert.equal((await actions.removePlayer('room', 42)).ok, false)
  assert.equal(state.rows.length, 1)
  state.room.status = 'lobby'
  assert.equal((await actions.removePlayer('other-room', 42)).ok, false)
  assert.equal((await actions.removePlayer('room', 42)).ok, true)
  assert.equal(state.rows.length, 0)
})
