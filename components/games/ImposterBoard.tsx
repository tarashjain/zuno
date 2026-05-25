'use client'
import { useState } from 'react'

type Word = { id: number; word: string; pairWord: string | null }
type Player = { id: number; guestName: string }

export default function ImposterBoard({ players, words }: { players: Player[]; words: Word[] }) {
  const [pair, setPair] = useState<Word | null>(null)
  const [imposterId, setImposterId] = useState<number | null>(null)
  const [holding, setHolding] = useState<Record<number, boolean>>({})
  const [revealed, setRevealed] = useState(false)

  const newRound = () => {
    const validWords = words.filter(w => w.pairWord)
    const p = validWords[Math.floor(Math.random() * validWords.length)]
    const imp = players[Math.floor(Math.random() * players.length)]
    setPair(p)
    setImposterId(imp.id)
    setHolding({})
    setRevealed(false)
  }

  const revealImposter = () => setRevealed(true)

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 text-sm font-semibold text-[var(--muted)]">
        Each player holds their button privately to see their word. The imposter gets a similar but different word!
      </div>

      <button
        onClick={newRound}
        className="w-full bg-[#7c3aed] text-white py-3 rounded-xl font-bold text-base mb-6 hover:brightness-110 transition-all shadow-[0_2px_0_#5b21b6]"
      >
        {pair ? '🔄 New Round' : '🕵️ Start First Round'}
      </button>

      {pair && imposterId !== null && (
        <>
          <div className="space-y-3 mb-6">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3"
              >
                <span className="font-extrabold text-lg">{p.guestName}</span>
                <button
                  className={`font-bold text-sm rounded-lg px-4 py-2.5 select-none transition-all min-w-[150px] text-center
                    ${holding[p.id]
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--ink)] text-[var(--paper)]'
                    }`}
                  onPointerDown={() => setHolding(h => ({ ...h, [p.id]: true }))}
                  onPointerUp={() => setHolding(h => ({ ...h, [p.id]: false }))}
                  onPointerLeave={() => setHolding(h => ({ ...h, [p.id]: false }))}
                >
                  {holding[p.id]
                    ? p.id === imposterId
                      ? `🎭 ${pair.pairWord}`
                      : `✅ ${pair.word}`
                    : 'Hold to Reveal'}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 mb-4">
            <p className="font-bold mb-2">💬 Now discuss!</p>
            <p className="text-sm text-[var(--muted)] font-semibold">
              Everyone describes their word without saying it. Vote on who you think is the imposter.
            </p>
          </div>

          {!revealed ? (
            <button
              onClick={revealImposter}
              className="w-full py-3 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--ink)] transition-colors"
            >
              Reveal Imposter
            </button>
          ) : (
            <div className="bg-[var(--ink)] text-[var(--paper)] rounded-xl p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">The Imposter Was</p>
              <p className="text-3xl font-extrabold">
                {players.find(p => p.id === imposterId)?.guestName}
              </p>
              <p className="mt-2 text-sm opacity-70">
                Their word: <strong>{pair.pairWord}</strong> (Everyone else had: <strong>{pair.word}</strong>)
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
