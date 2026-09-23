'use client'
import { useEffect, useState } from 'react'
import { submitJudgementBid, submitJudgementWon, completeJudgementRound, type JudgementPublic } from '@/app/actions/judgement'
import { useLiveBoard } from '@/components/room/useLiveBoard'

type Player = { id: number; guestName: string; scores: { points: number; round: number; notes?: string | null }[] }
type Session = { id: string; mode: string }

const DEFAULT_STATE: JudgementPublic = { kind: 'judgement', round: 1, roundKey: 'initial', bids: {}, won: {} }

export default function JudgementBoard({ session, players: initialPlayers, isHost, myPlayerId }: { session: Session; players: Player[]; isHost: boolean; myPlayerId: number | null }) {
  const { boardState, replaceBoardState, players } = useLiveBoard<JudgementPublic, Player>(session.id, DEFAULT_STATE, initialPlayers)
  const [myBidInput, setMyBidInput] = useState('')
  const [localBids, setLocalBids] = useState<Record<number, string>>({})
  const [wonInputs, setWonInputs] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLocal = session.mode === 'local'
  const total = (p: Player) => p.scores.reduce((s, x) => s + x.points, 0)

  useEffect(() => {
    setMyBidInput('')
    setLocalBids({})
    setWonInputs({})
    setError(null)
  }, [boardState.roundKey])

  const allBidsIn = players.length > 0 && players.every(p => boardState.bids[String(p.id)] !== null && boardState.bids[String(p.id)] !== undefined)
  const allWonIn = players.length > 0 && players.every(p => boardState.won[String(p.id)] !== null && boardState.won[String(p.id)] !== undefined)

  const submitMyBid = async () => {
    if (!myPlayerId || myBidInput === '') return
    setSaving(true)
    setError(null)
    try {
      const next = await submitJudgementBid(session.id, myPlayerId, parseInt(myBidInput) || 0)
      replaceBoardState(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your bid')
    } finally { setSaving(false) }
  }

  const submitWon = async (playerId: number, value: string) => {
    setSaving(true)
    setError(null)
    try {
      const next = await submitJudgementWon(session.id, playerId, parseInt(value) || 0)
      replaceBoardState(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save tricks won')
    } finally { setSaving(false) }
  }

  const completeRound = async () => {
    setSaving(true)
    setError(null)
    try {
      // Local mode: push every table entry through the same actions the host is trusted to
      // call on behalf of anyone, then close out the round.
      if (isLocal) {
        for (const p of players) {
          const bid = parseInt(localBids[p.id]) || 0
          const won = parseInt(wonInputs[p.id]) || 0
          await submitJudgementBid(session.id, p.id, bid)
          await submitJudgementWon(session.id, p.id, won)
        }
      }
      const next = await completeJudgementRound(session.id)
      replaceBoardState(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the round')
    } finally { setSaving(false) }
  }

  const myBid = myPlayerId !== null ? boardState.bids[String(myPlayerId)] : null

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
        🃏 Round {boardState.round}
      </div>

      {isLocal ? (
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
                const bid = parseInt(localBids[p.id]) || 0
                const w = parseInt(wonInputs[p.id]) || 0
                const preview = localBids[p.id] !== undefined && wonInputs[p.id] !== undefined
                  ? (bid === w ? 10 + w : 0)
                  : null
                return (
                  <tr key={p.id} className={idx < players.length - 1 ? 'border-b border-[var(--border)]' : ''}>
                    <td className="p-2 sm:p-3 font-bold max-w-[150px] truncate">{p.guestName}</td>
                    <td className="p-2 sm:p-3">
                      <input
                        type="number" min="0"
                        className="w-16 border-2 border-[var(--border)] rounded-lg p-1.5 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                        value={localBids[p.id] ?? ''}
                        onChange={e => setLocalBids(b => ({ ...b, [p.id]: e.target.value }))}
                      />
                    </td>
                    <td className="p-2 sm:p-3">
                      <input
                        type="number" min="0"
                        className="w-16 border-2 border-[var(--border)] rounded-lg p-1.5 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                        value={wonInputs[p.id] ?? ''}
                        onChange={e => setWonInputs(w => ({ ...w, [p.id]: e.target.value }))}
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
      ) : (
        <div className="bg-white border-2 border-[var(--border)] rounded-xl overflow-hidden mb-5">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Step 1 — Everyone bids</div>
            {myPlayerId !== null && myBid === null ? (
              <div className="flex gap-2">
                <input
                  type="number" min="0"
                  value={myBidInput}
                  onChange={e => setMyBidInput(e.target.value)}
                  placeholder="Your bid"
                  className="flex-1 border-2 border-[var(--border)] rounded-lg p-2.5 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button onClick={submitMyBid} disabled={saving || myBidInput === ''} className="px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg font-bold disabled:opacity-50 hover:brightness-110 transition-all">
                  Submit Bid
                </button>
              </div>
            ) : myPlayerId !== null ? (
              <p className="text-sm font-bold text-[var(--accent)]">Your bid: {myBid} — waiting on others…</p>
            ) : null}
            <div className="flex gap-2 flex-wrap mt-3">
              {players.map(p => {
                const submitted = boardState.bids[String(p.id)] !== null && boardState.bids[String(p.id)] !== undefined
                return (
                  <span key={p.id} className={`text-xs font-bold px-2 py-1 rounded-full ${submitted ? 'bg-green-100 text-green-800' : 'bg-[var(--surface2)] text-[var(--muted)]'}`}>
                    {p.guestName} {submitted && allBidsIn ? `(${boardState.bids[String(p.id)]})` : submitted ? '✓' : '…'}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Step 2 — Host records tricks won</div>
            {!allBidsIn ? (
              <p className="text-sm font-semibold text-[var(--muted)]">Waiting for every bid before tricks can be recorded.</p>
            ) : isHost ? (
              <div className="space-y-2">
                {players.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="flex-1 font-bold truncate">{p.guestName} <span className="text-[var(--muted)] font-normal">(bid {boardState.bids[String(p.id)]})</span></span>
                    <input
                      type="number" min="0"
                      className="w-20 border-2 border-[var(--border)] rounded-lg p-1.5 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                      value={wonInputs[p.id] ?? (boardState.won[String(p.id)] ?? '')}
                      onChange={e => setWonInputs(w => ({ ...w, [p.id]: e.target.value }))}
                      onBlur={e => e.target.value !== '' && submitWon(p.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[var(--muted)]">Waiting for the host to record tricks won.</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-3 mb-5 text-xs font-semibold text-[var(--muted)]">
        Scoring: Bid = Won → 10 + tricks won. Bid ≠ Won → 0 points.
      </div>

      {(isLocal || isHost) && (
        <button
          onClick={completeRound}
          disabled={saving || (!isLocal && !allWonIn)}
          className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-bold text-base hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#b83208]"
        >
          {saving ? 'Saving…' : `Complete Round ${boardState.round} →`}
        </button>
      )}

      {error && <p className="mt-4 text-center text-sm font-bold text-red-600">{error}</p>}
    </div>
  )
}
