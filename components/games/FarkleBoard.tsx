'use client'
import { useState } from 'react'
import { submitScore } from '@/app/actions/score'

type Player = { id: number; guestName: string; scores: { points: number; round: number; notes?: string | null }[] }
type Session = { id: string }

export default function FarkleBoard({ session, players: initialPlayers }: { session: Session; players: Player[] }) {
  const [players, setPlayers] = useState(initialPlayers)
  const [round, setRound] = useState(1)
  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const total = (p: Player) => p.scores.reduce((s, x) => s + x.points, 0)

  const bank = async (playerId: number) => {
    const pts = parseInt(inputs[playerId]) || 0
    if (pts === 0) { showToast('Enter points first!'); return }
    setLoading(l => ({ ...l, [playerId]: true }))
    await submitScore(session.id, playerId, pts, round)
    setPlayers(pl => pl.map(p => p.id === playerId
      ? { ...p, scores: [...p.scores, { points: pts, round }] } : p))
    setInputs(i => ({ ...i, [playerId]: '' }))
    setLoading(l => ({ ...l, [playerId]: false }))
    showToast(`+${pts} banked! 🎲`)
  }

  const farkle = async (playerId: number) => {
    setLoading(l => ({ ...l, [playerId]: true }))
    await submitScore(session.id, playerId, 0, round, 'Farkled')
    setPlayers(pl => pl.map(p => p.id === playerId
      ? { ...p, scores: [...p.scores, { points: 0, round, notes: 'Farkled' }] } : p))
    setLoading(l => ({ ...l, [playerId]: false }))
    showToast('Farkle! 💀')
  }

  const sorted = [...players].sort((a, b) => total(b) - total(a))

  return (
    <div>
      {/* Scoreboard strip */}
      <div className="flex gap-3 flex-wrap mb-6">
        {sorted.map((p, i) => (
          <div key={p.id} className="bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3 min-w-[90px] text-center">
            {i === 0 && <div className="text-xs font-bold text-[var(--accent)] mb-1">👑 LEAD</div>}
            <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">{p.guestName}</div>
            <div className="text-2xl font-mono font-medium text-[var(--accent)]">{total(p)}</div>
          </div>
        ))}
      </div>

      {/* Round badge */}
      <div className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-5">
        🎲 Round {round}
      </div>

      {/* Player cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {players.map((p) => (
          <div key={p.id} className="bg-white border-2 border-[var(--border)] rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-extrabold text-lg">{p.guestName}</span>
              <span className="font-mono text-2xl text-[var(--accent)]">{total(p)}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Points…"
                className="flex-1 border-2 border-[var(--border)] rounded-lg px-3 py-2 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                value={inputs[p.id] || ''}
                onChange={e => setInputs(i => ({ ...i, [p.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && bank(p.id)}
                disabled={loading[p.id]}
              />
              <button
                onClick={() => bank(p.id)}
                disabled={loading[p.id]}
                className="bg-[#16a34a] text-white px-3 py-2 rounded-lg font-bold text-sm shadow-[0_2px_0_#166534] hover:brightness-110 disabled:opacity-50 transition-all"
              >
                Bank
              </button>
              <button
                onClick={() => farkle(p.id)}
                disabled={loading[p.id]}
                className="bg-[#dc2626] text-white px-3 py-2 rounded-lg font-bold text-sm shadow-[0_2px_0_#991b1b] hover:brightness-110 disabled:opacity-50 transition-all"
              >
                💀
              </button>
            </div>
            {/* Round history */}
            {p.scores.filter(s => s.round === round - 1).length > 0 && (
              <div className="mt-2 text-xs text-[var(--muted)] font-semibold">
                Last round: {p.scores.filter(s => s.round === round - 1).reduce((s, x) => s + x.points, 0)} pts
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => setRound(r => r + 1)}
        className="w-full py-3 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--ink)] transition-colors"
      >
        Next Round →
      </button>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--ink)] text-[var(--paper)] text-sm font-bold px-5 py-3 rounded-full z-50 shadow-lg animate-bounce">
          {toast}
        </div>
      )}
    </div>
  )
}
