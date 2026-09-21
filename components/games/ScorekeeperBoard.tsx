'use client'
import { useState } from 'react'
import { submitScore } from '@/app/actions/score'

type ScoreEntry = { points: number; round: number; notes?: string | null }
type Player = { id: number; guestName: string; scores: ScoreEntry[] }
type Session = { id: string }

function total(p: Player) {
  return p.scores.reduce((s, x) => s + x.points, 0)
}

export default function ScorekeeperBoard({
  session,
  players: initialPlayers,
}: {
  session: Session
  players: Player[]
}) {
  const [players, setPlayers] = useState(initialPlayers)
  const [round, setRound] = useState(1)
  const [entries, setEntries] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const completeRound = async () => {
    if (saving) return
    setSaving(true)

    const updates = players.map(p => ({ id: p.id, points: parseInt(entries[p.id]) || 0 }))

    for (const u of updates) {
      await submitScore(session.id, u.id, u.points, round)
    }

    setPlayers(pl =>
      pl.map(p => {
        const u = updates.find(x => x.id === p.id)!
        return { ...p, scores: [...p.scores, { points: u.points, round }] }
      })
    )
    setRound(r => r + 1)
    setEntries({})
    setSaving(false)
    showToast(`Round ${round} complete! ✅`)
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-16 bg-white border-2 border-[var(--border)] rounded-xl">
        <div className="text-4xl mb-3">📝</div>
        <p className="font-bold text-[var(--muted)]">No players joined yet.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Leaderboard */}
      <div className="flex gap-3 flex-wrap mb-6">
        {[...players].sort((a, b) => total(b) - total(a)).map((p, i) => (
          <div key={p.id} className="bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3 min-w-[90px] text-center">
            {i === 0 && <div className="text-xs font-bold text-[var(--accent)] mb-1">👑 LEAD</div>}
            <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">{p.guestName}</div>
            <div className="text-2xl font-mono text-[var(--accent)]">{total(p)}</div>
          </div>
        ))}
      </div>

      <div className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-5">
        📝 Round {round}
      </div>

      <div className="bg-white border-2 border-[var(--border)] rounded-xl overflow-x-auto mb-5">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="bg-[var(--cream)] border-b-2 border-[var(--border)]">
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Player</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Round {round} Score</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, idx) => (
              <tr key={p.id} className={idx < players.length - 1 ? 'border-b border-[var(--border)]' : ''}>
                <td className="p-2 sm:p-3 font-bold max-w-[150px] truncate">{p.guestName}</td>
                <td className="p-2 sm:p-3">
                  <input
                    type="number"
                    className="w-20 border-2 border-[var(--border)] rounded-lg p-1.5 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                    value={entries[p.id] ?? ''}
                    onChange={e => setEntries(en => ({ ...en, [p.id]: e.target.value }))}
                    placeholder="0"
                  />
                </td>
                <td className="p-2 sm:p-3 font-mono text-lg sm:text-xl font-medium text-[var(--accent)]">{total(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-3 mb-5 text-xs font-semibold text-[var(--muted)]">
        Enter each player&rsquo;s score for the round (negative numbers allowed) and complete the round to add it to their running total.
      </div>

      <button
        onClick={completeRound}
        disabled={saving}
        className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-bold text-base hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#b83208]"
      >
        {saving ? 'Saving…' : `Complete Round ${round} →`}
      </button>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--ink)] text-[var(--paper)] text-sm font-bold px-5 py-3 rounded-full z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
