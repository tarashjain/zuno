import Link from 'next/link'
import type { KidsGame } from '@/lib/kids-games'
import type { KidsSessionHistory } from '@/app/actions/kids-session'

export default function KidsGameDetails({ game, history }: { game: KidsGame; history: KidsSessionHistory }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-16">
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-5xl">{game.emoji}</span>
          <div>
            <p className="text-sm font-bold text-[var(--accent)] mb-1">🪁 Kids n Play</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter">{game.name}</h1>
            <p className="text-[var(--muted)] text-lg mt-2">{game.description}</p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link
            href={`/games/${game.slug}/play`}
            className="px-6 py-3 bg-[var(--accent)] text-white font-bold rounded-lg hover:brightness-110 transition-all"
          >
            New Game
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-[var(--surface2)] text-[var(--text)] font-bold rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-all"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-black mb-4">How to Play</h2>
          <div className="space-y-3">
            {game.rules.map((rule, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <p className="text-[var(--text)] leading-relaxed pt-1">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        {game.examples.length > 0 && (
          <div>
            <h2 className="text-2xl font-black mb-4">Try it like this</h2>
            <div className="space-y-3">
              {game.examples.map((example, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-center font-bold text-sm">
                    Q
                  </div>
                  <div className="pt-1">
                    <p className="font-semibold">{example.question}</p>
                    <p className="text-[var(--accent)] font-bold mt-1">→ {example.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <h2 className="text-2xl font-black mb-4">Recent Sessions</h2>
            <div className="space-y-3">
              {history.map(session => {
                const winner = session.players.find(p => p.won)
                const hasScores = session.players.some(p => p.finalScore > 0)
                return (
                  <div key={session.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                    <p className="text-xs font-bold text-[var(--muted)] mb-3">
                      {new Date(session.playedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <ul className="space-y-1">
                      {session.players.map((p, i) => (
                        <li key={i} className="flex items-center justify-between text-sm font-semibold">
                          <span className={p.won ? 'font-black' : 'text-[var(--muted)]'}>
                            {p.won && '🏆 '}{p.playerName}
                          </span>
                          {hasScores && (
                            <span className={p.won ? 'font-black text-[var(--accent)]' : 'text-[var(--muted)]'}>
                              {p.finalScore} pts
                            </span>
                          )}
                          {!hasScores && p.won && (
                            <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Winner</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
