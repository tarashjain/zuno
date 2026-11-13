'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startCashier } from '@/app/actions/cashier'
import { createCashierState, formatAmount, parseAmount } from '@/lib/cashier'

export default function CashierSetup() {
  const router = useRouter()
  const lock = useRef(false)
  const [title, setTitle] = useState('Poker night')
  const [unit, setUnit] = useState('chips')
  const [amount, setAmount] = useState('100')
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  let total = '—'
  try { total = formatAmount(parseAmount(amount) * names.length) } catch {}
  const input = 'w-full rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'

  async function start(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current) return
    setError('')
    let data
    try {
      data = { title, unit, names, defaultBuyIn: parseAmount(amount) }
      createCashierState(data)
    } catch (err) { setError(err instanceof Error ? err.message : 'Check the table details.'); return }
    lock.current = true
    setBusy(true)
    try {
      const room = await startCashier(data)
      router.push(`/room/${room.id}/play`)
    } catch { setError('Could not create the table. Check your connection and sign-in, then try again.'); lock.current = false; setBusy(false) }
  }

  return <form onSubmit={start} className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-8">
    <fieldset disabled={busy} className="min-w-0">
      <h2 className="text-2xl font-bold mb-6">Open a table</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm font-semibold">Table name<input className={`${input} mt-2`} value={title} maxLength={60} onChange={e => setTitle(e.target.value)} required /></label>
        <label className="text-sm font-semibold">Unit or currency label<input className={`${input} mt-2`} value={unit} maxLength={8} onChange={e => setUnit(e.target.value)} placeholder="chips, $, ₹…" required /></label>
        <label className="text-sm font-semibold">Starting buy-in per player<input className={`${input} mt-2`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
        <label className="text-sm font-semibold">Number of players<select className={`${input} mt-2`} value={names.length} onChange={e => setNames(current => Array.from({ length: Number(e.target.value) }, (_, i) => current[i] ?? `Player ${i + 1}`))}>
          {Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select></label>
      </div>
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        {names.map((name, index) => <label key={index} className="text-xs font-semibold text-[var(--muted)]">Player {index + 1}<input className={`${input} mt-1 text-[var(--text)]`} value={name} maxLength={40} onChange={e => setNames(current => current.map((value, i) => i === index ? e.target.value : value))} required /></label>)}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface2)] p-4">
        <span className="text-sm font-semibold">Total starting buy-in</span><strong className="text-xl tabular-nums">{total} <span className="text-xs font-normal">{unit}</span></strong>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">Everyone starts with one buy-in. Add rebuys, custom amounts, and more players any time.</p>
      {error && <p role="alert" className="mt-4 text-sm text-[var(--red)]">{error}</p>}
      <button className="mt-6 w-full rounded-xl bg-[var(--accent)] py-4 font-bold text-white disabled:opacity-50">{busy ? 'Opening table…' : 'Start game →'}</button>
    </fieldset>
  </form>
}
