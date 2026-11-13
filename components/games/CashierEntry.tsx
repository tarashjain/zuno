'use client'

import { useState } from 'react'
import { BANK, parseAmount, type CashierAction, type CashierPlayer } from '@/lib/cashier'

export type EntryMode = 'add' | 'buy-in' | 'transfer' | 'remove' | 'cash-out'

export default function CashierEntry({ mode, playerId, players, unit, defaultAmount, busy, onSave, onCancel }: {
  mode: EntryMode; playerId?: string; players: CashierPlayer[]; unit: string; defaultAmount: number; busy: boolean
  onSave: (action: CashierAction, note: string) => Promise<boolean>; onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(mode === 'cash-out' ? '' : String(defaultAmount / 100))
  const [from, setFrom] = useState(playerId ?? BANK)
  const [to, setTo] = useState(BANK)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const titles = { add: 'Add a player', 'buy-in': 'Custom buy-in', transfer: 'Transfer buy-ins', remove: 'Remove player & transfer', 'cash-out': 'Cash out player' }
  const active = players.filter(player => player.status === 'playing')
  const selected = players.find(player => player.id === playerId)
  const input = 'w-full mt-1 rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      let action: CashierAction
      if (mode === 'add') action = { type: mode, name: name.trim(), amount: parseAmount(amount) }
      else if (mode === 'transfer') action = { type: mode, from, to, amount: parseAmount(amount) }
      else if (mode === 'remove') action = { type: mode, playerId: playerId!, to }
      else action = { type: mode, playerId: playerId!, amount: parseAmount(amount) }
      if (await onSave(action, note)) onCancel()
    } catch (err) { setError(err instanceof Error ? err.message : 'Check the values and try again.') }
  }

  return <form onSubmit={submit} className="my-6 rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface2)] p-5">
    <fieldset disabled={busy} className="min-w-0">
      <h2 className="font-bold text-xl">{titles[mode]}{selected ? ` · ${selected.name}` : ''}</h2>
      {(mode === 'remove' || mode === 'transfer') && <p className="text-sm text-[var(--muted)] mt-2">Transfers reassign recorded buy-ins; no new money is collected. Removed players stay in the history.</p>}
      {mode === 'cash-out' && <p className="text-sm text-[var(--muted)] mt-2">Enter the final payout, including winnings. Use 0 if they lost everything. This settles the player and records their profit or loss.</p>}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        {mode === 'add' && <label className="text-sm font-semibold">Player name<input autoFocus className={input} value={name} onChange={e => setName(e.target.value)} maxLength={40} required /></label>}
        {mode === 'transfer' && <label className="text-sm font-semibold">From<select className={input} value={from} onChange={e => setFrom(e.target.value)}><option value={BANK}>Bank · unassigned buy-ins</option>{active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        {(mode === 'remove' || mode === 'transfer') && <label className="text-sm font-semibold">Transfer to<select className={input} value={to} onChange={e => setTo(e.target.value)}><option value={BANK}>Bank · unassigned buy-ins</option>{active.filter(p => p.id !== playerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        {mode !== 'remove' && <label className="text-sm font-semibold">Amount ({unit})<input className={input} value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value)} required /></label>}
        <label className="text-sm font-semibold">Note (optional)<input className={input} value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="e.g. Second buy-in" /></label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-[var(--red)]">{error}</p>}
      <div className="flex gap-3 mt-5"><button className="rounded-xl bg-[var(--accent)] px-5 py-3 text-white font-bold disabled:opacity-40">{busy ? 'Saving…' : mode === 'remove' ? 'Transfer & remove' : 'Save transaction'}</button><button type="button" onClick={onCancel} className="rounded-xl border border-[var(--border)] px-5 py-3 font-semibold">Cancel</button></div>
    </fieldset>
  </form>
}
