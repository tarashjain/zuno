'use client'
import { useEffect, useState } from 'react'
import { getImposterSecret, revealImposterRound, startImposterRound } from '@/app/actions/secret-games'
import { useLiveBoard } from '@/components/room/useLiveBoard'

type Player = { id: number; guestName: string }
type Session = { id: string; mode: string }
type PublicState = { kind: 'imposter'; roundKey: string; revealed: boolean } | null
type PlayerSecret = { word: string; isImposter: boolean }
type Reveal = { imposterName: string; regularWord: string; imposterWord: string }

export default function ImposterBoard({
  session,
  players: initialPlayers,
  isHost,
  myPlayerId,
}: {
  session: Session
  players: Player[]
  isHost: boolean
  myPlayerId: number | null
}) {
  const { boardState, replaceBoardState, players } = useLiveBoard<PublicState, Player>(session.id, null, initialPlayers)
  const [holding, setHolding] = useState<Record<number, boolean>>({})
  const [secrets, setSecrets] = useState<Record<number, PlayerSecret>>({})
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visiblePlayers = session.mode === 'local'
    ? players
    : players.filter(player => player.id === myPlayerId)

  useEffect(() => {
    if (!boardState?.revealed || !myPlayerId || reveal) return
    getImposterSecret(session.id, myPlayerId)
      .then(result => setReveal(result.reveal))
      .catch(() => undefined)
  }, [boardState?.revealed, myPlayerId, reveal, session.id])

  const newRound = async () => {
    setLoading(true)
    setError(null)
    try {
      const state = await startImposterRound(session.id)
      replaceBoardState(state)
      setHolding({})
      setSecrets({})
      setReveal(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the round.')
    } finally {
      setLoading(false)
    }
  }

  const showWord = async (playerId: number) => {
    setHolding(current => ({ ...current, [playerId]: true }))
    if (secrets[playerId]) return
    try {
      const result = await getImposterSecret(session.id, playerId)
      setSecrets(current => ({ ...current, [playerId]: { word: result.word, isImposter: result.isImposter } }))
      if (result.reveal) setReveal(result.reveal)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reveal the word.')
    }
  }

  const hideWord = (playerId: number) => {
    setHolding(current => ({ ...current, [playerId]: false }))
  }

  const revealRound = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await revealImposterRound(session.id)
      replaceBoardState(result.state)
      setReveal(result.reveal)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reveal the imposter.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 text-sm font-semibold text-[var(--muted)]">
        {session.mode === 'local'
          ? 'Pass this device around. Each player holds only their own button to see their word.'
          : 'Hold your button privately to see your word. Hidden words are sent only to the correct player.'}
      </div>

      {isHost && (
        <button
          onClick={newRound}
          disabled={loading}
          className="w-full bg-[#7c3aed] text-white py-3 rounded-xl font-bold text-base mb-6 hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#5b21b6]"
        >
          {boardState ? '🔄 New Round' : '🕵️ Start First Round'}
        </button>
      )}

      {!boardState && !isHost && (
        <p className="text-center py-10 font-bold text-[var(--muted)]">Waiting for the host to start the round…</p>
      )}

      {boardState && (
        <>
          <div className="space-y-3 mb-6">
            {visiblePlayers.map(player => {
              const secret = secrets[player.id]
              return (
                <div key={player.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3">
                  <span className="font-extrabold text-lg max-w-full break-words">{player.guestName}</span>
                  <button
                    className={`w-full sm:w-auto font-bold text-sm rounded-lg px-4 py-2.5 select-none transition-all sm:min-w-[150px] text-center break-words ${holding[player.id] ? 'bg-[var(--accent)] text-white' : 'bg-[var(--ink)] text-[var(--paper)]'}`}
                    onPointerDown={() => showWord(player.id)}
                    onPointerUp={() => hideWord(player.id)}
                    onPointerLeave={() => hideWord(player.id)}
                  >
                    {holding[player.id] ? (secret?.word ?? 'Loading…') : 'Hold to Reveal'}
                  </button>
                </div>
              )
            })}
          </div>

          {visiblePlayers.length === 0 && (
            <p className="text-center py-6 font-semibold text-[var(--muted)]">Join the room as a player to receive a word.</p>
          )}

          <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 mb-4">
            <p className="font-bold mb-2">💬 Now discuss!</p>
            <p className="text-sm text-[var(--muted)] font-semibold">Everyone describes their word without saying it. Vote on who you think is the imposter.</p>
          </div>

          {isHost && !boardState.revealed && (
            <button onClick={revealRound} disabled={loading} className="w-full py-3 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--ink)] disabled:opacity-50 transition-colors">
              Reveal Imposter
            </button>
          )}

          {boardState.revealed && reveal && (
            <div className="bg-[var(--ink)] text-[var(--paper)] rounded-xl p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">The Imposter Was</p>
              <p className="text-3xl font-extrabold">{reveal.imposterName}</p>
              <p className="mt-2 text-sm opacity-70">Their word: <strong>{reveal.imposterWord}</strong> (Everyone else had: <strong>{reveal.regularWord}</strong>)</p>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-4 text-center text-sm font-bold text-[#dc2626]">{error}</p>}
    </div>
  )
}
