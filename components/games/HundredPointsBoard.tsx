'use client'
import { useEffect, useState } from 'react'
import { submitHundredPointsEntry, completeHundredPointsRound, type HundredPointsPublic } from '@/app/actions/hundred-points'
import { useLiveBoard } from '@/components/room/useLiveBoard'

type Player = { id: number; guestName: string; scores: { points: number; round: number; notes?: string | null }[] }
type Session = { id: string; mode: string }

const DEFAULT_STATE: HundredPointsPublic = { kind: 'hundred-points', round: 1, roundKey: 'initial', entries: {}, eliminated: [], winnerIds: null }

export default function HundredPointsBoard({ session, players: initialPlayers, isHost, myPlayerId }: { session: Session; players: Player[]; isHost: boolean; myPlayerId: number | null }) {
  const { boardState, replaceBoardState, players } = useLiveBoard<HundredPointsPublic, Player>(session.id, DEFAULT_STATE, initialPlayers)
  const [myEntryInput, setMyEntryInput] = useState('')
  const [localEntries, setLocalEntries] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLocal = session.mode === 'local'
  const total = (p: Player) => p.scores.reduce((s, x) => s + x.points, 0)
  const isEliminated = (p: Player) => boardState.eliminated.includes(p.id)
  const activePlayers = players.filter(p => !isEliminated(p))
  const finished = boardState.winnerIds !== null

  useEffect(() => {
    setMyEntryInput('')
    setLocalEntries({})
    setError(null)
  }, [boardState.roundKey])

  const allEntriesIn = activePlayers.length > 0 && activePlayers.every(p => boardState.entries[String(p.id)] !== null && boardState.entries[String(p.id)] !== undefined)

  const submitMyEntry = async () => {
    if (!myPlayerId || myEntryInput === '') return
    setSaving(true)
    setError(null)
    try {
      const next = await submitHundredPointsEntry(session.id, myPlayerId, parseInt(myEntryInput) || 0)
      replaceBoardState(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your points')
    } finally { setSaving(false) }
  }

  const completeRound = async () => {
    setSaving(true)
    setError(null)
    try {
      if (isLocal) {
        for (const p of activePlayers) {
          const points = parseInt(localEntries[p.id]) || 0
          await submitHundredPointsEntry(session.id, p.id, points)
        }
      }
      const next = await completeHundredPointsRound(session.id)
      replaceBoardState(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the round')
    } finally { setSaving(false) }
  }

  const myEntry = myPlayerId !== null ? boardState.entries[String(myPlayerId)] : null
  const iAmEliminated = myPlayerId !== null && boardState.eliminated.includes(myPlayerId)

  if (players.length === 0) {
    return (
      <div className="text-center py-16 bg-white border-2 border-[var(--border)] rounded-xl">
        <div className="text-4xl mb-3">💯</div>
        <p className="font-bold text-[var(--muted)]">No players joined yet.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Standings */}
      <div className="flex gap-3 flex-wrap mb-6">
        {[...players].sort((a, b) => total(a) - total(b)).map(p => {
          const out = isEliminated(p)
          const won = boardState.winnerIds?.includes(p.id)
          return (
            <div key={p.id} className={`bg-white border-2 rounded-xl px-4 py-3 min-w-[110px] text-center ${out ? 'border-[var(--border)] opacity-50' : 'border-[var(--border)]'}`}>
              {won && <div className="text-xs font-bold text-[var(--accent)] mb-1">👑 WINNER</div>}
              {out && !won && <div className="text-xs font-bold text-red-500 mb-1">OUT</div>}
              <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">{p.guestName}</div>
              <div className="text-2xl font-mono text-[var(--accent)]">{total(p)}</div>
            </div>
          )
        })}
      </div>

      {finished ? (
        <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-5 text-center mb-5">
          <div className="text-3xl mb-2">🎉</div>
          <p className="font-bold text-lg">
            {boardState.winnerIds && boardState.winnerIds.length > 0
              ? `Winner: ${boardState.winnerIds.map(id => players.find(p => p.id === id)?.guestName).filter(Boolean).join(' & ')}`
              : 'Game Over'}
          </p>
        </div>
      ) : (
        <>
          <div className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-5">
            💯 Round {boardState.round}
          </div>

          {isLocal ? (
            <div className="bg-white border-2 border-[var(--border)] rounded-xl overflow-x-auto mb-5">
              <table className="w-full min-w-[380px]">
                <thead>
                  <tr className="bg-[var(--cream)] border-b-2 border-[var(--border)]">
                    <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Player</th>
                    <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Round Points</th>
                    <th className="p-2 sm:p-3 text-left text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {activePlayers.map((p, idx) => (
                    <tr key={p.id} className={idx < activePlayers.length - 1 ? 'border-b border-[var(--border)]' : ''}>
                      <td className="p-2 sm:p-3 font-bold max-w-[150px] truncate">{p.guestName}</td>
                      <td className="p-2 sm:p-3">
                        <input
                          type="number"
                          className="w-20 border-2 border-[var(--border)] rounded-lg p-1.5 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                          value={localEntries[p.id] ?? ''}
                          onChange={e => setLocalEntries(x => ({ ...x, [p.id]: e.target.value }))}
                        />
                      </td>
                      <td className="p-2 sm:p-3 font-mono text-lg font-medium text-[var(--accent)]">{total(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 mb-5">
              {iAmEliminated ? (
                <p className="text-sm font-bold text-red-500">You're out this game — watch the standings above.</p>
              ) : myPlayerId !== null && myEntry === null ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={myEntryInput}
                    onChange={e => setMyEntryInput(e.target.value)}
                    placeholder="Your points this round"
                    className="flex-1 border-2 border-[var(--border)] rounded-lg p-2.5 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <button onClick={submitMyEntry} disabled={saving || myEntryInput === ''} className="px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg font-bold disabled:opacity-50 hover:brightness-110 transition-all">
                    Submit
                  </button>
                </div>
              ) : myPlayerId !== null ? (
                <p className="text-sm font-bold text-[var(--accent)]">Your points this round: {myEntry} — waiting on others…</p>
              ) : null}

              <div className="flex gap-2 flex-wrap mt-3">
                {activePlayers.map(p => {
                  const submitted = boardState.entries[String(p.id)] !== null && boardState.entries[String(p.id)] !== undefined
                  return (
                    <span key={p.id} className={`text-xs font-bold px-2 py-1 rounded-full ${submitted ? 'bg-green-100 text-green-800' : 'bg-[var(--surface2)] text-[var(--muted)]'}`}>
                      {p.guestName} {submitted ? `(${boardState.entries[String(p.id)]})` : '…'}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-3 mb-5 text-xs font-semibold text-[var(--muted)] space-y-1">
            <p>Each round, every player enters their own points for that round.</p>
            <p>Once a player's running total reaches 100 or more, they're out.</p>
            <p>Play continues until one player is left standing — they win.</p>
          </div>

          {(isLocal || isHost) && (
            <button
              onClick={completeRound}
              disabled={saving || (!isLocal && !allEntriesIn)}
              className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#b83208]"
            >
              {saving ? 'Saving…' : `Complete Round ${boardState.round} →`}
            </button>
          )}
        </>
      )}

      {error && <p className="mt-4 text-center text-sm font-bold text-red-600">{error}</p>}
    </div>
  )
}
