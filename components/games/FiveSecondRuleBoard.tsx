'use client'
import { useEffect, useRef, useState } from 'react'
import { submitScore } from '@/app/actions/score'

type Word = { id: number; word: string }
type ScoreEntry = { points: number; round: number; notes?: string | null }
type Player = { id: number; guestName: string; scores: ScoreEntry[] }
type Session = { id: string }

type Phase = 'idle' | 'countdown' | 'result'

const ROUND_SECONDS = 5

function scoreTotal(p: Player) {
  return p.scores.reduce((s, x) => s + x.points, 0)
}

export default function FiveSecondRuleBoard({
  session,
  players: initialPlayers,
  words,
}: {
  session: Session
  players: Player[]
  words: Word[]
}) {
  const [players, setPlayers] = useState(initialPlayers)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [round, setRound] = useState(1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [phrase, setPhrase] = useState<Word | null>(null)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [saving, setSaving] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentPlayer = players[currentPlayerIndex]

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const startRound = () => {
    if (words.length === 0 || !currentPlayer) return
    const next = words[Math.floor(Math.random() * words.length)]
    setPhrase(next)
    setTimeLeft(ROUND_SECONDS)
    setPhase('countdown')

    const startedAt = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000
      const remaining = Math.max(0, ROUND_SECONDS - elapsed)
      setTimeLeft(remaining)
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setPhase('result')
      }
    }, 50)
  }

  const scoreRound = async (madeIt: boolean) => {
    if (!currentPlayer || !phrase || saving) return
    setSaving(true)
    const points = madeIt ? 1 : 0
    const notes = `"${phrase.word}" — ${madeIt ? 'named 3 in time' : 'ran out of time'}`

    await submitScore(session.id, currentPlayer.id, points, round, notes)

    setPlayers(pl =>
      pl.map(p => (p.id === currentPlayer.id ? { ...p, scores: [...p.scores, { points, round, notes }] } : p))
    )
    setSaving(false)
    setPhase('idle')
    setPhrase(null)
    setRound(r => r + 1)
    setCurrentPlayerIndex(i => (i + 1) % players.length)
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-16 bg-white border-2 border-[var(--border)] rounded-xl">
        <div className="text-4xl mb-3">⏱️</div>
        <p className="font-bold text-[var(--muted)]">No players joined yet.</p>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-16 bg-white border-2 border-[var(--border)] rounded-xl">
        <div className="text-4xl mb-3">⏱️</div>
        <p className="font-bold text-[var(--muted)]">No category cards seeded for this game yet.</p>
      </div>
    )
  }

  const pct = (timeLeft / ROUND_SECONDS) * 100

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 text-sm font-semibold text-[var(--muted)]">
        Pass the device to the player in the Hot Seat, hit Start, and name 3 things in the category before the timer runs out.
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3 text-center">
          <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">Round</div>
          <div className="text-3xl font-mono text-[var(--accent)]">{round}</div>
        </div>
        <div className="bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3 text-center">
          <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">Hot Seat</div>
          <div className="text-lg font-black truncate">{currentPlayer?.guestName}</div>
        </div>
      </div>

      {phase === 'idle' && (
        <button
          onClick={startRound}
          disabled={saving}
          className="w-full bg-[#7c3aed] text-white py-4 rounded-xl font-bold text-lg mb-6 hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#5b21b6]"
        >
          ⏱️ Start — {currentPlayer?.guestName} is up
        </button>
      )}

      {phase === 'countdown' && phrase && (
        <div className="bg-[var(--ink)] text-[var(--paper)] rounded-2xl p-6 mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3">Name 3…</p>
          <p className="text-2xl font-extrabold mb-6">{phrase.word}</p>
          <div className="text-5xl font-mono font-black mb-4">{timeLeft.toFixed(1)}s</div>
          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-75 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'result' && phrase && (
        <div className="mb-6">
          <div className="bg-white border-2 border-[var(--border)] rounded-xl p-5 mb-4 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Time&rsquo;s up!</p>
            <p className="text-xl font-extrabold mb-1">{phrase.word}</p>
            <p className="text-sm text-[var(--muted)] font-semibold">
              Did {currentPlayer?.guestName} name 3 before time ran out?
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => scoreRound(true)}
              disabled={saving}
              className="flex-1 py-3 bg-[#16a34a] text-white rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#166534]"
            >
              ✅ Got it (+1)
            </button>
            <button
              onClick={() => scoreRound(false)}
              disabled={saving}
              className="flex-1 py-3 bg-[#dc2626] text-white rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#991b1b]"
            >
              ❌ Missed
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Scoreboard</p>
        {players.map(p => (
          <div
            key={p.id}
            className="flex items-center justify-between bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3"
          >
            <span className="font-extrabold">{p.guestName}</span>
            <span className="font-mono text-[var(--accent)] font-bold">
              {scoreTotal(p)} pt{scoreTotal(p) !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
