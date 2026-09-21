'use client'
import { useEffect, useState } from 'react'
import { useLiveBoard } from '@/components/room/useLiveBoard'
import { startWavelengthRound, getWavelengthSecret, revealWavelengthRound, assignWavelengthTeams, setWavelengthPointer } from '@/app/actions/wavelength'

type Player = { id: number; guestName: string; scores: { points: number; round: number }[] }
type Session = { id: string; mode: string }
type PublicState = ({ kind: 'wavelength'; spectrum: string; psychicId: number; revealed: boolean; pointer?: number | null; teams?: Record<string, 'A' | 'B'> }) | null

export default function WavelengthBoard({ session, players: initialPlayers, isHost, myPlayerId }: { session: Session; players: Player[]; isHost: boolean; myPlayerId: number | null }) {
  const { boardState, replaceBoardState, players } = useLiveBoard<PublicState, Player>(session.id, null, initialPlayers)
  const [secret, setSecret] = useState<{ target: number; band: number } | null>(null)
  const [pointer, setPointer] = useState<number>(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!boardState?.revealed) setSecret(null)
  }, [boardState?.revealed])

  const newRound = async () => {
    setLoading(true)
    setError(null)
    try {
      const state = await startWavelengthRound(session.id)
      replaceBoardState(state)
      setPointer(50)
      setSecret(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start round')
    } finally { setLoading(false) }
  }

  const showSecret = async () => {
    if (!myPlayerId) return
    try {
      const s = await getWavelengthSecret(session.id, myPlayerId)
      setSecret(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not fetch secret')
    }
  }

  const autoAssign = async () => {
    if (!isHost) return
    try {
      const playersList = players.length ? players : initialPlayers
      const teams: Record<string, 'A' | 'B'> = {}
      playersList.forEach((p, i) => { teams[String(p.id)] = i % 2 === 0 ? 'A' : 'B' })
      const next = await assignWavelengthTeams(session.id, teams)
      replaceBoardState(next as any)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign teams')
    }
  }

  const changePointer = async (v: number) => {
    setPointer(v)
    try {
      const next = await setWavelengthPointer(session.id, v)
      replaceBoardState(next as any)
    } catch (e) {
      // ignore transient errors — UI already updated locally
    }
  }

  const reveal = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await revealWavelengthRound(session.id, pointer)
      replaceBoardState(res.state)
      setSecret(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reveal')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 text-sm font-semibold text-[var(--muted)]">
        Wavelength: one player is the Psychic. They secretly set a target on the spectrum; their team gives one-word clues and sets the pointer. Host reveals to score.
      </div>

      {isHost && (
        <button onClick={newRound} disabled={loading} className="w-full bg-[#7c3aed] text-white py-3 rounded-xl font-bold text-base mb-6 hover:brightness-110 disabled:opacity-50 transition-all">
          {boardState ? '🔄 New Round' : '🕵️ Start First Round'}
        </button>
      )}

      {!boardState && !isHost && (
        <p className="text-center py-10 font-bold text-[var(--muted)]">Waiting for the host to start the round…</p>
      )}

      {boardState && (
        <>
          <div className="mb-4">
            <div className="font-bold text-lg">Spectrum</div>
            <div className="text-sm text-[var(--muted)]">{boardState.spectrum}</div>
          </div>

          <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 mb-4">
            <input type="range" min={0} max={100} value={boardState.pointer ?? pointer} onChange={(e) => changePointer(Number(e.target.value))} className="w-full" />
            <div className="flex justify-between text-xs text-[var(--muted)] mt-2">
              <span>Left</span>
              <span>Center</span>
              <span>Right</span>
            </div>
            <div className="text-sm font-bold mt-3">Pointer: {pointer}</div>
          </div>

          <div className="space-y-3 mb-6">
            {boardState.teams && (
              <div className="mb-3 bg-white border-2 border-[var(--border)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold">Teams</div>
                  {isHost && (
                    <button onClick={autoAssign} className="text-xs font-bold text-[var(--accent)]">Auto-assign</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 border rounded-lg">
                      <div>{p.guestName}</div>
                      <div className="text-sm font-bold">{boardState.teams[String(p.id)] ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myPlayerId === boardState.psychicId ? (
              <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 text-center">
                <div className="font-bold mb-2">You are the Psychic</div>
                <button onClick={showSecret} className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl font-bold">Reveal Secret</button>
                {secret && <div className="mt-3 text-sm">Secret target: <strong>{secret.target}</strong></div>}
              </div>
            ) : (
              <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 text-center">
                <div className="font-bold">Give one-word clue to your Psychic</div>
                <div className="text-xs text-[var(--muted)] mt-2">Discuss and adjust the pointer above.</div>
              </div>
            )}
          </div>

          {isHost && !boardState.revealed && (
            <button onClick={reveal} disabled={loading} className="w-full py-3 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--ink)] disabled:opacity-50 transition-colors">
              Reveal Round
            </button>
          )}

          {boardState.revealed && (
            <div className="bg-[var(--ink)] text-[var(--paper)] rounded-xl p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Round Result</p>
              <p className="text-3xl font-extrabold">Pointer: {boardState.pointer}</p>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-4 text-center text-sm font-bold text-[#dc2626]">{error}</p>}
    </div>
  )
}
