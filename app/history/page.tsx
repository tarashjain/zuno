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
    where: { hostEmail: { equals: session.user.email, mode: 'insensitive' }, status: { in: ['active', 'completed'] } },
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
            const isCompleted = gameSession.status === 'completed'
            const topScores = gameSession.players.map(p => ({
              name: p.guestName,
              total: p.scores.reduce((sum, s) => sum + s.points, 0),
              isWinner: p.scores.some(s => s.notes === 'winner'),
            })).sort((a, b) => b.total - a.total)
            const maxTotal = topScores[0]?.total ?? 0
            const hasScores = topScores.some(p => p.total > 0 || p.isWinner)

            return (
              <Link
                key={gameSession.id}
                href={`/room/${gameSession.id}`}
                className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--accent)] hover:bg-[var(--surface2)] transition-all flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="text-2xl">🎮</div>
                  <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full ${
                    isCompleted
                      ? 'bg-green-100 text-green-700'
                      : gameSession.status === 'active'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-[var(--surface2)] text-[var(--muted)]'
                  }`}>
                    {isCompleted ? 'Ended' : gameSession.status}
                  </span>
                </div>

                <div className="font-bold text-base mb-1">{gameSession.game.name}</div>
                <div className="text-xs text-[var(--muted)] font-medium mb-3">
                  {new Date(gameSession.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}{gameSession.players.length} player{gameSession.players.length !== 1 ? 's' : ''}
                </div>

                {isCompleted && hasScores ? (
                  <ul className="space-y-1 mb-3 flex-1">
                    {topScores.slice(0, 4).map((p, i) => (
                      <li key={p.name} className="flex items-center justify-between text-xs">
                        <span className="font-semibold truncate max-w-[130px]">
                          {i === 0 && maxTotal > 0 ? '🏆 ' : p.isWinner && maxTotal === 0 ? '🏆 ' : ''}{p.name}
                        </span>
                        <span className="font-bold text-[var(--text)] ml-2 shrink-0">
                          {maxTotal > 0 ? `${p.total} pts` : p.isWinner ? 'Winner' : '—'}
                        </span>
                      </li>
                    ))}
                    {topScores.length > 4 && (
                      <li className="text-[10px] text-[var(--muted)]">+{topScores.length - 4} more</li>
                    )}
                  </ul>
                ) : (
                  <div className="flex-1" />
                )}

                <div className="mt-auto text-xs font-bold text-[var(--accent)] flex items-center gap-1">
                  {isCompleted ? 'View summary' : gameSession.status === 'active' ? 'Continue' : 'Rejoin'}
                  <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
