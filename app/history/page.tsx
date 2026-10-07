import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'

export default async function History() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/auth/signin')
  }

  const gameSessions = await prisma.gameSession.findMany({
    where: { hostEmail: { equals: session.user.email, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    include: {
      game: true,
      players: { include: { scores: true }, orderBy: { joinedAt: 'asc' } },
    },
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter">My Game History</h1>
        </div>
        <p className="text-[var(--muted)] text-lg">View your past game sessions and scores</p>
      </div>

      {gameSessions.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gameSessions.map(gameSession => {
            const scoreCount = gameSession.players.reduce((count, player) => count + player.scores.length, 0)
            return (
              <Link
                key={gameSession.id}
                href={`/room/${gameSession.id}`}
                className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--accent)] hover:bg-[var(--surface2)] transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="text-2xl">🎮</div>
                  <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full bg-[var(--surface2)] text-[var(--muted)]">
                    {gameSession.status}
                  </span>
                </div>
                <div className="font-bold text-base mb-1">{gameSession.game.name}</div>
                <div className="text-xs text-[var(--muted)] font-medium space-y-1">
                  <p>{gameSession.players.length} player{gameSession.players.length !== 1 ? 's' : ''}</p>
                  <p>{scoreCount} recorded score{scoreCount !== 1 ? 's' : ''}</p>
                  <p>{new Date(gameSession.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="mt-4 text-xs font-bold text-[var(--accent)] flex items-center gap-1">
                  Open game <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
