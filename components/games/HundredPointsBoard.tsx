'use client'
import { useState } from 'react'
import { submitScore } from '@/app/actions/score'

type ScoreEntry = { points: number; round: number; notes?: string | null }
type Player = { id: number; guestName: string; scores: ScoreEntry[] }
type Session = { id: string }

function parseInput(value: string | undefined) {
  const parsed = parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function calculateHundredPointsScore(bid: number, won: number) {
  if (bid === 0) return won === 0 ? 100 : -100
  if (won < bid) return -(bid * 10)
  return bid * 10 + (won - bid)
}

export default function HundredPointsBoard({ session, players: initialPlayers }: { session: Session; players: Player[] }) {
  const [players, setPlayers] = useState(initialPlayers)
  const [round, setRound] = useState(1)
  const [bids, setBids] = useState<Record<number, string>>({})
  const [won, setWon] = useState<Record<number, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }
  const total = (p: Player) => p.scores.reduce((s, x) => s + x.points, 0)

  const completeRound = async () => {
    setSaving(true)
    const updates = players.map(p => {
      const bid = parseInput(bids[p.id])
      const tricksWon = parseInput(won[p.id])
      const pts = calculateHundredPointsScore(bid, tricksWon)
      const notes = `100 Points - Bid: ${bid}, Won: ${tricksWon}`
      return { id: p.id, pts, bid, tricksWon, notes }
    })

    for (const u of updates) {
      await submitScore(session.id, u.id, u.pts, round, u.notes)
    }

    setPlayers(pl => pl.map(p => {
      const u = updates.find(x => x.id === p.id)!
      return { ...p, scores: [...p.scores, { points: u.pts, round, notes: u.notes }] }
    }))
    setRound(r => r + 1)
    setBids({})
    setWon({})
    setSaving(false)
    showToast(`Round ${round} complete! ✅`)
  }

  return (
    <div>
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
        💯 Round {round}
      </div>

      <div className="bg-white border-2 border-[var(--border)] rounded-xl overflow-x-auto mb-5">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="bg-[var(--cream)] border-b-2 border-[var(--border)]">
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Player</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Bid</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Won</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Round</th>
              <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, idx) => {
              const bid = parseInput(bids[p.id])
              const tricksWon = parseInput(won[p.id])
              const hasPreview = bids[p.id] !== undefined && won[p.id] !== undefined
              const preview = hasPreview ? calculateHundredPointsScore(bid, tricksWon) : null
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
                      <span className={`font-mono font-bold text-sm ${preview >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                        {preview > 0 ? `+${preview}` : preview}
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

      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-3 mb-5 text-xs font-semibold text-[var(--muted)] space-y-1">
        <p>Scoring: Made bid → 10 × bid + 1 per overtrick.</p>
        <p>Missed bid → −10 × bid. Nil bid → +100 if won 0, otherwise −100.</p>
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
