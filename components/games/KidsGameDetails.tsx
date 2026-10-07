import Link from 'next/link'
import type { KidsGame } from '@/lib/kids-games'

export default function KidsGameDetails({ game }: { game: KidsGame }) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 md:py-16">
      <Link href="/" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)]">← Back to games</Link>
      <div className="mt-8 mb-8">
        <p className="text-sm font-bold text-[var(--accent)] mb-4">🪁 Kids n Play · Local only</p>
        <span className="text-5xl" aria-hidden="true">{game.emoji}</span>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-4 mb-3">{game.name}</h1>
        <p className="text-lg text-[var(--muted)]">{game.description}</p>
      </div>
      <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-2xl p-5 mb-8">
        <p className="font-bold mb-2">2–8 players · One device · Play together in person</p>
        <p className="text-sm text-[var(--muted)] mb-5">Read the questions aloud and let the group judge each answer. No sign-in needed. Your game stays on this device; refreshing starts over.</p>
        <Link href={`/games/${game.slug}/play`} className="inline-block px-6 py-3 bg-[var(--accent)] text-white font-bold rounded-xl hover:brightness-110">Play locally →</Link>
      </div>
      <h2 className="text-2xl font-black mb-4">How to Play</h2>
      <ol className="list-decimal pl-6 space-y-3 mb-8">
        {game.rules.map(rule => <li key={rule} className="pl-2 leading-relaxed">{rule}</li>)}
      </ol>
      {game.examples.length > 0 && (
        <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h2 className="text-xl font-black mb-4">Try it like this</h2>
          <ul className="space-y-4">
            {game.examples.map(example => (
              <li key={example.question}>
                <p className="font-semibold">{example.question}</p>
                <p className="text-[var(--accent)] font-bold mt-1">→ {example.answer}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
