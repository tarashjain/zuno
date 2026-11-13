const test = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')
const ledger = loadTs('lib/cashier.ts')
const expiry = loadTs('lib/room-expiry.ts')
const input = { title: 'Friday poker', unit: 'chips', defaultBuyIn: 10000, names: ['Alex', 'Sam'] }
let counter = 0
const addEvent = (state, action) => ledger.appendCashierEvent(state, { id: `event-${++counter}`, at: '2026-11-13T12:00:00.000Z', action, note: '' })

test('amount parsing preserves cents and rejects malformed or unsafe amounts', () => {
  assert.equal(ledger.parseAmount('0.10') + ledger.parseAmount('0.20'), 30)
  assert.equal(ledger.parseAmount('12.5'), 1250)
  assert.equal(ledger.parseAmount('0'), 0)
  for (const value of ['', '1.001', '-1', 'Infinity', '1e3', '1,000', '1000000001', '1abc']) assert.throws(() => ledger.parseAmount(value))
})

test('setup validates players and starts every player with exactly one buy-in', () => {
  const state = ledger.createCashierState(input)
  const table = ledger.cashierLedger(state)
  assert.equal(table.collected, 20000)
  assert.equal(table.available, 20000)
  assert.equal(table.players.length, 2)
  assert.throws(() => ledger.createCashierState({ ...input, names: ['Sam', ' sam '] }), /different name/)
  assert.throws(() => ledger.createCashierState({ ...input, defaultBuyIn: 0 }), /positive/)
  assert.throws(() => ledger.createCashierState({ ...input, names: [] }), /1–20/)
})

test('rebuys, late players, removals and bank transfers preserve total collected', () => {
  let state = ledger.createCashierState(input)
  state = addEvent(state, { type: 'buy-in', playerId: 'initial-1', amount: 2500 })
  state = addEvent(state, { type: 'add', name: 'Lee', amount: 5000 })
  const lee = state.events[1].id
  assert.equal(ledger.cashierLedger(state).collected, 27500)
  state = addEvent(state, { type: 'transfer', from: 'initial-1', to: 'initial-2', amount: 2500 })
  let table = ledger.cashierLedger(state)
  assert.equal(table.players[0].buyIn, 10000)
  assert.equal(table.players[1].buyIn, 12500)
  assert.equal(table.collected, 27500)
  state = addEvent(state, { type: 'remove', playerId: 'initial-1', to: 'bank' })
  table = ledger.cashierLedger(state)
  assert.equal(table.bankBuyIn, 10000)
  assert.equal(table.players[0].status, 'removed')
  assert.equal(table.collected, 27500)
  state = addEvent(state, { type: 'transfer', from: 'bank', to: lee, amount: 10000 })
  state = addEvent(state, { type: 'remove', playerId: 'initial-2', to: lee })
  table = ledger.cashierLedger(state)
  assert.equal(table.players.find(p => p.id === lee).buyIn, 27500)
  assert.equal(table.bankBuyIn, 0)
  assert.equal(table.collected, 27500)
  assert.equal(table.available, 27500)
})

test('cash-outs allow winnings, record losses, and never overdraw the bank', () => {
  let state = ledger.createCashierState(input)
  state = addEvent(state, { type: 'cash-out', playerId: 'initial-1', amount: 15000 })
  let table = ledger.cashierLedger(state)
  assert.equal(table.players[0].cashOut - table.players[0].buyIn, 5000)
  assert.equal(table.available, 5000)
  assert.throws(() => addEvent(state, { type: 'cash-out', playerId: 'initial-2', amount: 5001 }), /exceeds/)
  assert.throws(() => addEvent(state, { type: 'cash-out', playerId: 'initial-1', amount: 1 }), /still at the table/)
  state = addEvent(state, { type: 'cash-out', playerId: 'initial-2', amount: 5000 })
  table = ledger.cashierLedger(state)
  assert.equal(table.available, 0)
  assert.equal(table.paid, table.collected)
  assert.equal(table.players[1].cashOut - table.players[1].buyIn, -5000)
})

test('undo restores balances and removed players while retaining the audit entry', () => {
  const initial = ledger.createCashierState(input)
  let state = addEvent(initial, { type: 'remove', playerId: 'initial-1', to: 'bank' })
  state = ledger.undoCashierEvent(state, '2026-11-13T12:01:00.000Z')
  assert.equal(state.events.length, 1)
  assert.ok(state.events[0].undoneAt)
  assert.equal(JSON.stringify(ledger.cashierLedger(state)), JSON.stringify(ledger.cashierLedger(initial)))
  state = addEvent(state, { type: 'cash-out', playerId: 'initial-1', amount: 0 })
  state = ledger.undoCashierEvent(state, '2026-11-13T12:02:00.000Z')
  assert.equal(ledger.cashierLedger(state).players[0].status, 'playing')
  assert.throws(() => ledger.undoCashierEvent(state, 'now'), /nothing to undo/)
})

test('invalid actions cannot corrupt balances or mutate the original state', () => {
  const state = ledger.createCashierState(input)
  const before = JSON.stringify(state)
  for (const action of [
    { type: 'transfer', from: 'initial-1', to: 'initial-1', amount: 100 },
    { type: 'transfer', from: 'initial-1', to: 'initial-2', amount: 10001 },
    { type: 'transfer', from: 'bank', to: 'initial-1', amount: 1 },
    { type: 'buy-in', playerId: 'missing', amount: 100 },
    { type: 'buy-in', playerId: 'initial-1', amount: -10 },
    { type: 'buy-in', playerId: 'initial-1', amount: 1.5 },
    { type: 'remove', playerId: 'initial-1', to: 'missing' },
    { type: 'add', name: ' alex ', amount: 100 },
    { type: 'bogus' },
  ]) assert.throws(() => addEvent(state, action))
  assert.equal(JSON.stringify(state), before)
})

test('audit history keeps player names after undoing a late player and their transactions', () => {
  let state = addEvent(ledger.createCashierState(input), { type: 'add', name: 'Lee', amount: 1000 })
  const playerId = state.events[0].id
  state = addEvent(state, { type: 'buy-in', playerId, amount: 500 })
  state = ledger.undoCashierEvent(state, '2026-11-13T12:01:00.000Z')
  state = ledger.undoCashierEvent(state, '2026-11-13T12:02:00.000Z')
  assert.equal(ledger.cashierLedger(state).players.length, 2)
  assert.match(ledger.describeCashierEvent(state.events[1], state), /^Lee bought in/)
})

test('Cashier and Score Keeper never expire, while other active games still do', () => {
  const opened = new Date('2020-01-01')
  const now = new Date('2030-01-01').getTime()
  assert.equal(expiry.roomHasExpired('cashier', 'active', opened, now), false)
  assert.equal(expiry.roomHasExpired('score-keeper', 'active', opened, now), false)
  assert.equal(expiry.roomHasExpired('judgement-card-game', 'active', opened, now), true)
  assert.equal(expiry.roomHasExpired('farkle', 'lobby', opened, now), false)
})

function server() {
  const current = { state: ledger.createCashierState(input), allowed: true, mode: 'local', slug: 'cashier', writes: 0, race: false, auth: { user: { email: 'host@example.com' } }, created: null }
  const actions = loadTs('app/actions/cashier.ts', {
    '@/lib/cashier': ledger,
    '@/lib/auth': { authOptions: {} },
    'next-auth': { getServerSession: async () => current.auth },
    'next/cache': { revalidatePath() {} },
    '@/lib/room-auth': { requireRoomHost: async () => {
      if (!current.allowed) throw new Error('Only the room host can perform this action.')
      return { room: { status: 'active', mode: current.mode, game: { slug: current.slug } } }
    } },
    '@/lib/db': {
      game: { upsert: async () => ({ id: 1 }) },
      gameSession: {
        findUnique: async () => ({ boardState: current.state }),
        create: async ({ data }) => { current.created = data; return { id: 'room' } },
        updateMany: async ({ where, data }) => {
          if (current.race) {
            current.state = addEvent(current.state, { type: 'buy-in', playerId: 'initial-2', amount: 500 })
            return { count: 0 }
          }
          assert.equal(JSON.stringify(where.boardState.equals), JSON.stringify(current.state))
          current.state = data.boardState; current.writes++; return { count: 1 }
        },
      },
    },
  })
  return { current, actions }
}

test('new tables are saved as local-only and owned by the signed-in manager', async () => {
  const { current, actions } = server()
  await actions.startCashier(input)
  assert.equal(current.created.mode, 'local')
  assert.equal(current.created.hostEmail, 'host@example.com')
  assert.equal(current.created.status, 'active')
  assert.equal(current.created.boardState.kind, 'cashier')
  current.auth = null
  await assert.rejects(actions.startCashier(input), /Sign in/)
})

test('only the host may edit a local Cashier table', async () => {
  const { current, actions } = server()
  const action = { type: 'buy-in', playerId: 'initial-1', amount: 1000 }
  current.allowed = false
  await assert.rejects(actions.updateCashier('room', 0, action), /Only the room host/)
  current.allowed = true; current.mode = 'individual'
  await assert.rejects(actions.updateCashier('room', 0, action), /local Cashier/)
  current.mode = 'local'; current.slug = 'farkle'
  await assert.rejects(actions.updateCashier('room', 0, action), /local Cashier/)
  assert.equal(current.writes, 0)
})

test('stale revisions and concurrent writes cannot double-charge or overwrite a table', async () => {
  const { current, actions } = server()
  const action = { type: 'buy-in', playerId: 'initial-1', amount: 1000 }
  assert.equal((await actions.updateCashier('room', 0, action)).ok, true)
  assert.equal((await actions.updateCashier('room', 0, action)).ok, false)
  assert.equal(current.writes, 1)
  assert.equal(ledger.cashierLedger(current.state).collected, 21000)
  current.race = true
  const result = await actions.updateCashier('room', 1, action)
  assert.equal(result.ok, false)
  assert.equal(ledger.cashierLedger(result.state).collected, 21500)
  assert.equal(current.writes, 1)
})
