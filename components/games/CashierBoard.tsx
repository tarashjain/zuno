'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { updateCashier } from '@/app/actions/cashier'
import { appendCashierEvent, cashierLedger, describeCashierEvent, formatAmount, type CashierAction, type CashierState } from '@/lib/cashier'
import CashierEntry, { type EntryMode } from './CashierEntry'

export default function CashierBoard({ sessionId, initialState }: { sessionId: string; initialState: CashierState }) {
  const [state, setState] = useState(initialState)
  const [entry, setEntry] = useState<{ mode: EntryMode; playerId?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const lock = useRef(false)
  const entryRef = useRef<HTMLDivElement>(null)
  const ledger = cashierLedger(state)
  const active = ledger.players.filter(player => player.status === 'playing')
  const archived = ledger.players.filter(player => player.status !== 'playing')
  const money = (amount: number) => `${formatAmount(amount)} ${state.unit}`
  const button = 'rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold hover:border-[var(--accent)] disabled:opacity-40'

  function open(mode: EntryMode, playerId?: string) {
    setEntry({ mode, playerId })
    setMessage('')
    requestAnimationFrame(() => entryRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }))
  }

  async function save(action: CashierAction | { type: 'undo' }, note = ''): Promise<boolean> {
    if (lock.current) return false
    if (action.type !== 'undo') appendCashierEvent(state, { id: crypto.randomUUID(), at: new Date().toISOString(), action, note })
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      const result = await updateCashier(sessionId, state.revision, action, note)
      setState(result.state)
      setFailed(!result.ok)
      setMessage(result.message)
      return result.ok
    } catch {
      setFailed(true)
      setMessage('Could not confirm the save. Check your connection and reload the table before retrying.')
      return false
    } finally { lock.current = false; setBusy(false) }
  }

  async function rebuy(playerId: string) {
    try { await save({ type: 'buy-in', playerId, amount: state.defaultBuyIn }) }
    catch (err) { setFailed(true); setMessage(err instanceof Error ? err.message : 'Could not add the buy-in.') }
  }

  function exportCsv() {
    const escape = (value: string | number) => typeof value === 'number' ? String(value) : `"${(/^[=+\-@]/.test(value.trimStart()) ? "'" : '') + value.replaceAll('"', '""')}"`
    const lines = [['Player', 'Status', `Buy-ins (${state.unit})`, `Cash-out (${state.unit})`, `Profit/loss (${state.unit})`], ...ledger.players.map(p => [p.name, p.status, p.buyIn / 100, p.cashOut / 100, p.status === 'settled' ? (p.cashOut - p.buyIn) / 100 : '']), ['Bank (unassigned)', '', ledger.bankBuyIn / 100, '', '']]
    const url = URL.createObjectURL(new Blob([lines.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'cashier-summary.csv'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <main className="max-w-4xl mx-auto p-4 md:p-8">
    <header className="flex flex-wrap justify-between items-center gap-3 mb-8 pb-4 border-b-2 border-[var(--ink)]">
      <div className="flex items-baseline gap-3"><Link href="/" className="text-2xl font-extrabold tracking-tight">ZU<span className="text-[var(--accent)]">N</span>O</Link><span className="text-[var(--muted)] font-semibold text-sm">| Cashier</span></div>
      <Link href="/games/cashier" className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] hover:text-[var(--accent)]">← My tables</Link>
    </header>
    <div className="mb-6">
      <h1 className="text-3xl font-black break-words">{state.title}</h1>
    </div>
    <div className="grid sm:grid-cols-3 gap-3 mb-8">
      {[['Total buy-ins', ledger.collected], ['Cashed out', ledger.paid], ['Bank available', ledger.available]].map(([label, amount]) => <div key={label} className={`rounded-xl border-2 border-[var(--border)] p-4 ${label === 'Bank available' ? 'bg-[var(--cream)]' : 'bg-white'}`}><p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{label}</p><p className="mt-3 text-2xl font-mono text-[var(--accent)] tabular-nums break-words">{money(Number(amount))}</p></div>)}
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      <button disabled={busy} className="rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-white disabled:opacity-40" onClick={() => open('add')}>+ Add player</button>
      <button disabled={busy} className={button} onClick={() => open('transfer')}>Transfer buy-ins</button>
      <button disabled={busy || !state.events.some(event => !event.undoneAt)} className={button} onClick={() => { setEntry(null); void save({ type: 'undo' }) }}>Undo last transaction</button>
      <button className={button} onClick={exportCsv}>Export summary</button>
    </div>
    <div role={failed ? 'alert' : 'status'} className={`min-h-8 mt-3 text-sm ${failed ? 'text-[var(--red)]' : 'text-green-700'}`}>{busy ? 'Saving…' : message}</div>
    <div ref={entryRef}>{entry && <CashierEntry key={`${entry.mode}-${entry.playerId ?? ''}`} {...entry} players={ledger.players} unit={state.unit} defaultAmount={state.defaultBuyIn} busy={busy} onSave={save} onCancel={() => setEntry(null)} />}</div>
    <div className="flex items-center justify-between mt-4 mb-4"><h2 className="text-xl font-bold">At the table <span className="text-sm text-[var(--muted)]">({active.length})</span></h2><span className="text-xs text-[var(--muted)]">Default rebuy: {money(state.defaultBuyIn)}</span></div>
    <div className="grid md:grid-cols-2 gap-4">
      {active.map((player, index) => <article key={player.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-lg break-words"><span className="mr-2 text-[var(--muted)] text-xs">{String(index + 1).padStart(2, '0')}</span>{player.name}</h3><span className="text-xs text-[var(--muted)] whitespace-nowrap">Buy-ins</span></div>
        <p className="mt-3 mb-5 text-3xl font-bold tabular-nums">{money(player.buyIn)}</p>
        <div className="flex flex-wrap gap-2"><button disabled={busy} className={`${button} text-[var(--accent)]`} onClick={() => void rebuy(player.id)}>+ Rebuy {formatAmount(state.defaultBuyIn)}</button><button disabled={busy} className={button} onClick={() => open('buy-in', player.id)}>Custom amount</button><button disabled={busy} className={button} onClick={() => open('cash-out', player.id)}>Cash out</button><button disabled={busy} className={`${button} text-[var(--muted)]`} onClick={() => open('remove', player.id)}>Remove & transfer</button></div>
      </article>)}
    </div>
    {!active.length && <p className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">Everyone has left the table. Add another player any time.</p>}
    <p className="mt-4 text-xs text-[var(--muted)]">Buy-ins record amounts taken, not current chip stacks after each hand. Bank available = total buy-ins − cash-outs.</p>
    {ledger.bankBuyIn > 0 && <p className="mt-3 rounded-xl bg-[var(--surface2)] p-4 text-sm"><strong>{money(ledger.bankBuyIn)}</strong> in unassigned bank buy-ins. Use Transfer buy-ins to assign these to a player.</p>}
    {archived.length > 0 && <section className="mt-8"><h2 className="text-xl font-bold mb-4">Settled & removed</h2><div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white"><table className="w-full text-sm min-w-[480px]"><thead className="bg-[var(--surface2)] text-left"><tr>{['Player', 'Status', 'Buy-ins', 'Cash-out', 'Profit / loss'].map(label => <th key={label} className="p-3 font-semibold">{label}</th>)}</tr></thead><tbody>{archived.map(player => <tr key={player.id} className="border-t border-[var(--border)]"><td className="p-3 font-bold">{player.name}</td><td className="p-3">{player.status}</td><td className="p-3 tabular-nums">{money(player.buyIn)}</td><td className="p-3 tabular-nums">{player.status === 'settled' ? money(player.cashOut) : '—'}</td><td className={`p-3 tabular-nums ${player.cashOut >= player.buyIn ? 'text-green-700' : 'text-[var(--red)]'}`}>{player.status === 'settled' ? money(player.cashOut - player.buyIn) : 'Transferred'}</td></tr>)}</tbody></table></div></section>}
    <section className="mt-10"><h2 className="text-xl font-bold mb-4">Transaction history</h2><ol className="rounded-2xl border border-[var(--border)] bg-white divide-y divide-[var(--border)]">
      {[...state.events].reverse().map(event => <li key={event.id} className={`px-5 py-4 ${event.undoneAt ? 'opacity-50' : ''}`}><div className="flex flex-wrap justify-between gap-2"><p className={`text-sm font-semibold ${event.undoneAt ? 'line-through' : ''}`}>{describeCashierEvent(event, state)}</p><span className="text-xs text-[var(--muted)]">{event.undoneAt ? 'Undone' : `${event.at.slice(0, 16).replace('T', ' ')} UTC`}</span></div>{event.note && <p className="text-xs text-[var(--muted)] mt-1">{event.note}</p>}</li>)}
      <li className="px-5 py-4 text-sm text-[var(--muted)]">Table opened · {state.initialPlayers.length} players × {money(state.defaultBuyIn)} = {money(state.initialPlayers.length * state.defaultBuyIn)}</li>
    </ol></section>
  </main>
}
