import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function History() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter">My Game History</h1>
        </div>
        <p className="text-[var(--muted)] text-lg">View your past game sessions and scores</p>
      </div>

      {/* Empty state */}
      <div className="space-y-6">
        <div className="text-center py-16 px-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-bold mb-2">No game history yet</h3>
          <p className="text-[var(--muted)] mb-6">Start playing to see your scores and history here</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[var(--accent)] text-white font-bold rounded-lg hover:brightness-110 transition-all"
          >
            Play a Game
          </Link>
        </div>
      </div>
    </div>
  )
}
