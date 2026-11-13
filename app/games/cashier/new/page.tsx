import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import CashierSetup from '@/components/games/CashierSetup'

export default async function NewCashier() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=%2Fgames%2Fcashier%2Fnew')
  return <main className="max-w-4xl mx-auto px-4 py-10 md:py-16">
    <Link href="/games/cashier" className="text-sm font-bold text-[var(--accent)]">← Cashier</Link>
    <div className="flex items-center gap-4 my-6"><span className="text-5xl">🃏</span><div><h1 className="text-4xl md:text-5xl font-black tracking-tighter">Cashier</h1><p className="text-[var(--muted)] mt-2">Local game · One manager · No expiry</p></div></div>
    <CashierSetup />
  </main>
}
