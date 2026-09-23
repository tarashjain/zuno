import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

const CATEGORY_META: Record<string, { emoji: string; color: string; games: string[] }> = {
  'Dice Games':   { emoji: '🎲', color: '#f97316', games: ['Farkle'] },
  'Card Games':   { emoji: '🃏', color: '#3b82f6', games: ['Judgement', '100 Points'] },
  'Word & Party': { emoji: '🎉', color: '#22c55e', games: ['Imposter', 'Bollywood Codenames', '5 Second Rule', 'Score Keeper', 'Wavelength', 'Scrabble'] },
}

const GAME_CATEGORY: Record<string, string> = {
  farkle: 'Dice Games',
  'judgement-card-game': 'Card Games',
  '100-points': 'Card Games',
  imposter: 'Word & Party',
  'bollywood-code-names': 'Word & Party',
  '5-second-rule': 'Word & Party',
  'score-keeper': 'Word & Party',
  wavelength: 'Word & Party',
  scrabble: 'Word & Party',
}

export default async function Home() {
  const session = await getServerSession(authOptions)
  const games = await prisma.game.findMany({ orderBy: { id: 'asc' } })

  const categories = Object.entries(CATEGORY_META).map(([cat, meta]) => ({
    cat, ...meta,
    gameList: games.filter(g => GAME_CATEGORY[g.slug] === cat),
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
      {/* Hero */}
      <div className="mb-14 text-center">
        <div className="inline-flex items-center gap-2 bg-[var(--surface2)] border border-[var(--border)] rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-6">
          🎮 Party Game Hub
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none mb-4">
          ZU<span className="text-[var(--accent)]">N</span>O
        </h1>
        <p className="text-[var(--muted)] text-lg md:text-xl font-medium max-w-md mx-auto mb-8">
          Score, track, and play your favourite party games — all in one place.
        </p>
        {!session && (
          <>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/auth/register"
                className="w-full sm:w-auto px-8 py-3.5 bg-[var(--accent)] text-white font-bold rounded-2xl hover:brightness-110 transition-all text-base text-center"
              >
                Create Account →
              </Link>
              <Link
                href="/auth/signin"
                className="w-full sm:w-auto px-8 py-3.5 bg-[var(--surface2)] border border-[var(--border)] font-bold rounded-2xl hover:border-[var(--accent)] transition-all text-base text-center"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm font-semibold text-[var(--muted)]">
              Have a room code?{' '}
              <Link href="/join" className="text-[var(--accent)] font-bold hover:underline">
                Join a Room →
              </Link>
            </p>
          </>
        )}
      </div>

      {/* Game categories */}
      {(
        <>
          <div className="space-y-8">
            {categories.map(({ cat, emoji, color, gameList }) => (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{emoji}</span>
                  <h2 className="text-xl font-black tracking-tight">{cat}</h2>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gameList.map((game) => (
                    <Link
                      key={game.id}
                      href={`/games/${game.slug}`}
                      className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--accent)] hover:bg-[var(--surface2)] transition-all"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 font-bold"
                        style={{ background: color + '22', color }}
                      >
                        {emoji}
                      </div>
                      <div className="font-bold text-base mb-1 group-hover:text-[var(--accent)] transition-colors">
                        {game.name}
                      </div>
                      <div className="text-xs text-[var(--muted)] font-medium">{GAME_CATEGORY[game.slug]}</div>
                      <div
                        className="mt-4 text-xs font-bold flex items-center gap-1 transition-colors"
                        style={{ color }}
                      >
                        Play now <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
