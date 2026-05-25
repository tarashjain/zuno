import { createGameSession } from './actions'
import prisma from '@/lib/db'

const GAME_META: Record<string, { emoji: string; desc: string }> = {
  'farkle':               { emoji: '🎲', desc: 'Classic dice banking game' },
  'judgement-card-game':  { emoji: '🃏', desc: 'Bid and win tricks' },
  '100-points':           { emoji: '💯', desc: 'Bid and win tricks variant' },
  'imposter':             { emoji: '🕵️', desc: 'Find the imposter!' },
  'bollywood-code-names': { emoji: '🎬', desc: 'Bollywood word spy game' },
}

export default async function Home() {
  const games = await prisma.game.findMany({ orderBy: { id: 'asc' } })

  return (
    <main className="max-w-2xl mx-auto p-6 md:p-10">
      {/* Brand */}
      <div className="flex items-baseline gap-3 mb-2 pb-4 border-b-2 border-[var(--ink)]">
        <h1 className="text-5xl font-extrabold tracking-tight leading-none">
          ZU<span className="text-[var(--accent)]">N</span>O
        </h1>
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Party Game Hub
        </span>
      </div>
      <p className="text-[var(--muted)] font-semibold text-sm mb-10">
        Your universal party game scorekeeper. Pick a game to get started.
      </p>

      {/* Game picker */}
      <div className="bg-white border-2 border-[var(--border)] rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-extrabold mb-5">Host a New Game</h2>
        <form action={createGameSession} className="flex flex-col gap-4">
          <select
            name="gameId"
            required
            defaultValue=""
            className="p-3 border-2 border-[var(--border)] rounded-xl bg-[var(--paper)] font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)] transition-colors"
          >
            <option value="" disabled>Select a game…</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {GAME_META[game.slug]?.emoji} {game.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-[var(--accent)] text-white py-3 px-5 rounded-xl font-bold text-base hover:brightness-110 active:scale-[0.99] transition-all shadow-[0_2px_0_#b83208]"
          >
            Create Room →
          </button>
        </form>
      </div>

      {/* Game cards */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {games.map((game) => {
          const meta = GAME_META[game.slug]
          return (
            <div key={game.id} className="bg-white border-2 border-[var(--border)] rounded-xl p-4">
              <div className="text-2xl mb-2">{meta?.emoji}</div>
              <div className="font-extrabold">{game.name}</div>
              <div className="text-xs text-[var(--muted)] font-semibold mt-1">{meta?.desc}</div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
