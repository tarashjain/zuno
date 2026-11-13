import Link from 'next/link'
import prisma from '@/lib/db'
import { cashierLedger, formatAmount, type CashierState } from '@/lib/cashier'

export default async function CashierHistory({ email }: { email: string }) {
  const tables = await prisma.gameSession.findMany({
    where: { hostEmail: email, game: { slug: 'cashier' }, mode: 'local', status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, boardState: true, createdAt: true },
  })
  return <section className="mt-10">
    <h2 className="text-2xl font-black mb-4">Your saved tables</h2>
    {!tables.length && <p className="text-sm text-[var(--muted)]">Your Cashier tables will appear here. Leave and resume whenever you like.</p>}
    <div className="grid sm:grid-cols-2 gap-4">{tables.map(table => {
      const state = table.boardState as CashierState | null
      if (state?.kind !== 'cashier') return null
      const ledger = cashierLedger(state)
      return <Link key={table.id} href={`/room/${table.id}/play`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)] transition-colors">
        <h3 className="font-bold break-words">{state.title}</h3>
        <p className="mt-2 text-xs text-[var(--muted)]">{ledger.players.filter(p => p.status === 'playing').length} at the table · {formatAmount(ledger.collected)} {state.unit} bought in</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Opened {table.createdAt.toLocaleDateString('en-GB')} · No expiry</p>
        <p className="mt-4 text-sm font-bold text-[var(--accent)]">Continue →</p>
      </Link>
    })}</div>
  </section>
}
