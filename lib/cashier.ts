export const BANK = 'bank'
const MAX_AMOUNT = 100_000_000_000

export type CashierAction =
  | { type: 'add'; name: string; amount: number }
  | { type: 'buy-in'; playerId: string; amount: number }
  | { type: 'transfer'; from: string; to: string; amount: number }
  | { type: 'remove'; playerId: string; to: string }
  | { type: 'cash-out'; playerId: string; amount: number }

export type CashierEvent = { id: string; at: string; action: CashierAction; note: string; undoneAt?: string }
export type CashierState = {
  kind: 'cashier'; revision: number; title: string; unit: string; defaultBuyIn: number
  initialPlayers: { id: string; name: string }[]; events: CashierEvent[]
}
export type CashierPlayer = { id: string; name: string; buyIn: number; cashOut: number; status: 'playing' | 'settled' | 'removed' }
export type CashierLedger = { players: CashierPlayer[]; bankBuyIn: number; collected: number; paid: number; available: number }

export function parseAmount(value: string): number {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter an amount with up to two decimal places.')
  const [whole, fraction = ''] = value.trim().split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  checkAmount(amount, true)
  return amount
}

export function formatAmount(amount: number) {
  return (amount / 100).toLocaleString('en-US', { minimumFractionDigits: amount % 100 ? 2 : 0, maximumFractionDigits: 2 })
}

function checkAmount(value: number, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_AMOUNT) {
    throw new Error(`Enter ${allowZero ? 'a non-negative' : 'a positive'} amount up to 1,000,000,000.`)
  }
}

function cleanName(value: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40) throw new Error('Player names must contain 1–40 characters.')
  return value.trim()
}

export function createCashierState(input: { title: string; unit: string; defaultBuyIn: number; names: string[] }): CashierState {
  checkAmount(input.defaultBuyIn)
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 60) throw new Error('Give the table a name of up to 60 characters.')
  if (typeof input.unit !== 'string' || !input.unit.trim() || input.unit.trim().length > 8) throw new Error('Choose a unit label of up to 8 characters.')
  if (!Array.isArray(input.names) || input.names.length < 1 || input.names.length > 20) throw new Error('Start with 1–20 players.')
  const names = input.names.map(cleanName)
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) throw new Error('Use a different name for each player.')
  return {
    kind: 'cashier', revision: 0, title: input.title.trim(), unit: input.unit.trim(), defaultBuyIn: input.defaultBuyIn,
    initialPlayers: names.map((name, index) => ({ id: `initial-${index + 1}`, name })), events: [],
  }
}

function activePlayer(ledger: CashierLedger, id: string) {
  const player = ledger.players.find(item => item.id === id && item.status === 'playing')
  if (!player) throw new Error('Choose a player who is still at the table.')
  return player
}

function transfer(ledger: CashierLedger, from: string, to: string, amount: number) {
  if (from === to) throw new Error('Choose a different recipient.')
  const source = from === BANK ? null : activePlayer(ledger, from)
  const target = to === BANK ? null : activePlayer(ledger, to)
  if (amount > (source ? source.buyIn : ledger.bankBuyIn)) throw new Error('The transfer exceeds the recorded buy-in balance.')
  if (source) source.buyIn -= amount
  else ledger.bankBuyIn -= amount
  if (target) target.buyIn += amount
  else ledger.bankBuyIn += amount
}

function apply(ledger: CashierLedger, event: CashierEvent) {
  const action = event.action
  if (!action || typeof action !== 'object') throw new Error('Invalid table action.')
  switch (action.type) {
    case 'add': {
      const name = cleanName(action.name)
      checkAmount(action.amount, true)
      if (ledger.players.some(player => player.name.toLowerCase() === name.toLowerCase())) throw new Error('That name is already recorded. Use a different name.')
      ledger.players.push({ id: event.id, name, buyIn: action.amount, cashOut: 0, status: 'playing' })
      break
    }
    case 'buy-in':
      checkAmount(action.amount)
      activePlayer(ledger, action.playerId).buyIn += action.amount
      break
    case 'transfer':
      checkAmount(action.amount)
      transfer(ledger, action.from, action.to, action.amount)
      break
    case 'remove': {
      const player = activePlayer(ledger, action.playerId)
      transfer(ledger, player.id, action.to, player.buyIn)
      player.status = 'removed'
      break
    }
    case 'cash-out': {
      checkAmount(action.amount, true)
      const player = activePlayer(ledger, action.playerId)
      if (action.amount > ledger.available) throw new Error('The cash-out exceeds the bank available. Check the amount or missing buy-ins.')
      player.cashOut = action.amount
      player.status = 'settled'
      break
    }
    default: throw new Error('Unknown table action.')
  }
  ledger.collected = ledger.bankBuyIn + ledger.players.reduce((sum, player) => sum + player.buyIn, 0)
  ledger.paid = ledger.players.reduce((sum, player) => sum + player.cashOut, 0)
  ledger.available = ledger.collected - ledger.paid
  if (!Number.isSafeInteger(ledger.collected) || ledger.collected > MAX_AMOUNT * 100) throw new Error('This table has reached its amount limit.')
}

export function cashierLedger(state: CashierState): CashierLedger {
  const collected = state.initialPlayers.length * state.defaultBuyIn
  const ledger: CashierLedger = {
    players: state.initialPlayers.map(player => ({ ...player, buyIn: state.defaultBuyIn, cashOut: 0, status: 'playing' })),
    bankBuyIn: 0, collected, paid: 0, available: collected,
  }
  for (const event of state.events) if (!event.undoneAt) apply(ledger, event)
  return ledger
}

export function appendCashierEvent(state: CashierState, event: CashierEvent): CashierState {
  if (typeof event.id !== 'string' || !event.id || event.id === BANK || state.initialPlayers.some(player => player.id === event.id) || state.events.some(item => item.id === event.id)) throw new Error('Invalid or repeated transaction.')
  if (typeof event.note !== 'string' || event.note.length > 200) throw new Error('Keep notes under 200 characters.')
  apply(cashierLedger(state), event)
  return { ...state, revision: state.revision + 1, events: [...state.events, event] }
}

export function undoCashierEvent(state: CashierState, at: string): CashierState {
  const last = [...state.events].reverse().find(event => !event.undoneAt)
  if (!last) throw new Error('There is nothing to undo yet.')
  return { ...state, revision: state.revision + 1, events: state.events.map(event => event.id === last.id ? { ...event, undoneAt: at } : event) }
}

export function describeCashierEvent(event: CashierEvent, state: CashierState) {
  const unit = state.unit
  const name = (id: string) => {
    if (id === BANK) return 'bank'
    const initial = state.initialPlayers.find(player => player.id === id)
    const joined = state.events.find(item => item.id === id)?.action
    return initial?.name ?? (joined?.type === 'add' ? joined.name : 'player')
  }
  const action = event.action
  switch (action.type) {
    case 'add': return `${action.name} joined · ${formatAmount(action.amount)} ${unit}`
    case 'buy-in': return `${name(action.playerId)} bought in · ${formatAmount(action.amount)} ${unit}`
    case 'transfer': return `${name(action.from)} → ${name(action.to)} · ${formatAmount(action.amount)} ${unit}`
    case 'remove': return `${name(action.playerId)} removed · buy-ins transferred to ${name(action.to)}`
    case 'cash-out': return `${name(action.playerId)} cashed out · ${formatAmount(action.amount)} ${unit}`
  }
}
