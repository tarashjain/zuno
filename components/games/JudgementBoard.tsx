'use client'
import { useState } from 'react'
import { submitScore } from '@/app/actions/score'
import { useLiveBoard } from '@/components/room/useLiveBoard'

type Player = { id: number; guestName: string; scores: { points: number; round: number; notes?: string | null }[] }
type Session = { id: string }

export default function JudgementBoard({ session, players: initialPlayers }: { session: Session; players: Player[] }) {
  const { players, setPlayers } = useLiveBoard<null, Player>(session.id, null, initialPlayers)
  const [bids, setBids] = useState<Record<number, string>>({})
  const [won, setWon] = useState<Record<number, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }
  const total = (p: Player) => p.scores.reduce((s, x) => s + x.points, 0)
  const round = players.length > 0 ? Math.max(0, ...players.flatMap(p => p.scores.map(s => s.round))) + 1 : 1

  const completeRound = async () => {
    setSaving(true)
    const updates: { id: number; pts: number; bid: number; w: number }[] = players.map(p => {
      const bid = parseInt(bids[p.id]) || 0
      const w = parseInt(won[p.id]) || 0
      const pts = bid === w ? 10 + w : 0
      return { id: p.id, pts, bid, w }
    })

    for (const u of updates) {
      await submitScore(session.id, u.id, u.pts, round, `Bid: ${u.bid}, Won: ${u.w}`)
    }

    setPlayers(players.map(p => {
      const u = updates.find(x => x.id === p.id)!
      return { ...p, scores: [...p.scores, { points: u.pts, round, notes: `Bid: ${u.bid}, Won: ${u.w}` }] }
    }))
    setBids({})
    setWon({})
    setSaving(false)
    showToast(`Round ${round} complete! ✅`)
  }

  return (
    <div>
      {/* Scoreboard */}
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
        🃏 Round {round}
      </div>

      <div className="bg-white border-2 border-[var(--border)] rounded-xl overflow-x-auto mb-5">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="bg-[var(--cream)] border-b-2 border-[var(--border)]">
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Player</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Bid</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Won</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Points</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, idx) => {
              const bid = parseInt(bids[p.id]) || 0
              const w = parseInt(won[p.id]) || 0
              const preview = bids[p.id] !== undefined && won[p.id] !== undefined
                ? (bid === w ? 10 + w : 0)
                : null
              return (
                <tr key={p.id} className={idx < players.length - 1 ? 'border-b border-[var(--border)]' : ''}>
                  <td className="p-2 sm:p-3 font-bold max-w-[150px] truncate">{p.guestName}</td>
                  <td className="p-2 sm:p-3">
                    <input
                      type="number"
                      min="0"
                      className="w-16 border-2 border-[var(--border)] rounded-lg p-1.5 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                      value={bids[p.id] ?? ''}
                      onChange={e => setBids(b => ({ ...b, [p.id]: e.target.value }))}
                    />
                  </td>
                  <td className="p-2 sm:p-3">
                    <input
                      type="number"
                      min="0"
                      className="w-16 border-2 border-[var(--border)] rounded-lg p-1.5 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                      value={won[p.id] ?? ''}
                      onChange={e => setWon(w => ({ ...w, [p.id]: e.target.value }))}
                    />
                  </td>
                  <td className="p-2 sm:p-3">
                    {preview !== null && (
                      <span className={`font-mono font-bold text-sm ${preview > 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                        {preview > 0 ? `+${preview}` : '0'}
                      </span>
                    )}
                  </td>
                  <td className="p-2 sm:p-3 font-mono text-lg sm:text-xl font-medium text-[var(--accent)]">{total(p)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-3 mb-5 text-xs font-semibold text-[var(--muted)]">
        Scoring: Bid = Won → 10 + tricks won. Bid ≠ Won → 0 points.
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
