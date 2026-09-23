'use client'
import { useEffect, useState } from 'react'
import { useLiveBoard } from '@/components/room/useLiveBoard'
import { startWavelengthRound, getWavelengthSecret, revealWavelengthRound, startTeamGuessing, setWavelengthPointer } from '@/app/actions/wavelength'

type Player = { id: number; guestName: string; scores: { points: number; round: number }[] }
type Session = { id: string; mode: string }
type PublicState = {
  kind: 'wavelength'
  roundKey: string
  spectrum: [string, string]
  psychicId: number
  phase: 'psychic-set' | 'team-guess' | 'revealed'
  pointer?: number | null
  target?: number | null
  teams?: Record<string, 'A' | 'B'>
} | null

// Scoring bands, as radii around the target (matches the physical game's rings).
const BANDS = [
  { radius: 4, points: 4, color: 'bg-emerald-400' },
  { radius: 12, points: 3, color: 'bg-yellow-300' },
  { radius: 25, points: 2, color: 'bg-orange-300' },
]

function clampedRange(center: number, radius: number) {
  const lo = Math.max(0, center - radius)
  const hi = Math.min(100, center + radius)
  return { left: `${lo}%`, width: `${Math.max(0, hi - lo)}%` }
}

export default function WavelengthBoard({ session, players: initialPlayers, isHost, myPlayerId }: { session: Session; players: Player[]; isHost: boolean; myPlayerId: number | null }) {
  const { boardState, replaceBoardState, players } = useLiveBoard<PublicState, Player>(session.id, null, initialPlayers)
  const [secret, setSecret] = useState<{ target: number } | null>(null)
  const [clue, setClue] = useState('')
  const [localPointer, setLocalPointer] = useState(50)
  const [peek, setPeek] = useState(false) // local mode: show/hide the secret target on the bar
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLocal = session.mode === 'local'
  const isPsychic = boardState?.psychicId === myPlayerId
  const myTeam = boardState?.teams && myPlayerId ? boardState.teams[String(myPlayerId)] : null
  const psychicTeam = boardState?.teams ? boardState.teams[String(boardState.psychicId)] : null
  const canMovePointer = isLocal || (!!myPlayerId && !isPsychic && myTeam !== null && myTeam === psychicTeam)

  // Reset all per-round local UI state whenever a new round starts.
  useEffect(() => {
    setSecret(null)
    setClue('')
    setPeek(false)
  }, [boardState?.roundKey])

  useEffect(() => {
    if (boardState?.pointer != null) setLocalPointer(boardState.pointer)
  }, [boardState?.pointer])

  const newRound = async () => {
    setLoading(true)
    setError(null)
    try {
      const state = await startWavelengthRound(session.id)
      replaceBoardState(state)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start round')
    } finally { setLoading(false) }
  }

  const revealSecret = async (playerId: number) => {
    try {
      const s = await getWavelengthSecret(session.id, playerId)
      setSecret(s)
      setPeek(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not fetch secret')
    }
  }

  const startGuessing = async () => {
    setLoading(true)
    setError(null)
    try {
      const state = await startTeamGuessing(session.id)
      replaceBoardState(state)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start guessing phase')
    } finally { setLoading(false) }
  }

  const updatePointer = async (v: number) => {
    setLocalPointer(v)
    try {
      const next = await setWavelengthPointer(session.id, v)
      replaceBoardState(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move the pointer')
    }
  }

  const revealResult = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await revealWavelengthRound(session.id)
      replaceBoardState(res.state)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reveal')
    } finally { setLoading(false) }
  }

  if (!boardState) {
    const notEnoughPlayers = !isLocal && initialPlayers.length < 4
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] rounded-2xl p-8 text-center text-white mb-6">
          <div className="text-4xl font-black mb-2">↔</div>
          <div className="text-sm font-bold uppercase tracking-widest opacity-80">Wavelength</div>
        </div>

        <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 mb-6 text-sm text-center text-[var(--muted)]">
          One player is the <strong>Psychic</strong>. They secretly set a target on the spectrum, give a one-word clue, and their team tries to match it.
        </div>

        {notEnoughPlayers && (
          <p className="text-center text-sm font-bold text-amber-600 mb-4">
            Share-code Wavelength needs at least 4 players, split into two teams.
          </p>
        )}

        {isHost ? (
          <button
            onClick={newRound}
            disabled={loading || notEnoughPlayers}
            className="w-full bg-[#8b5cf6] text-white py-3 rounded-xl font-bold text-base mb-4 hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? 'Starting...' : '🕵️ Start First Round'}
          </button>
        ) : (
          <p className="text-center py-10 font-bold text-[var(--muted)]">Waiting for the host to start the round…</p>
        )}
      </div>
    )
  }

  // What target value (if any) should be drawn on the bar right now.
  const showTarget = boardState.phase === 'revealed'
    ? true
    : isLocal
      ? peek && secret !== null
      : isPsychic && secret !== null
  const targetValue = showTarget ? (boardState.phase === 'revealed' ? boardState.target ?? 0 : secret?.target ?? 0) : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] rounded-2xl p-6 text-white">
        <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">
          {boardState.phase === 'psychic-set' ? '🎲 Psychic Setting Target' : boardState.phase === 'team-guess' ? '🎯 Team Guessing' : '✓ Revealed'}
        </div>
        <div className="text-lg font-black">
          Psychic: {players.find(p => p.id === boardState.psychicId)?.guestName ?? '—'}
        </div>
      </div>

      {/* Teams (share-code only) */}
      {!isLocal && boardState.teams && (
        <div className="bg-white border-2 border-[var(--border)] rounded-xl p-3">
          <div className="font-bold text-sm mb-2">Teams</div>
          <div className="grid grid-cols-2 gap-2">
            {players.map(p => {
              const team = boardState.teams?.[String(p.id)]
              const active = team === psychicTeam
              return (
                <div
                  key={p.id}
                  className={`text-xs font-bold px-2 py-1.5 rounded-lg border ${active ? 'border-purple-400 bg-purple-50 text-purple-900' : 'border-[var(--border)] text-[var(--muted)]'}`}
                >
                  {p.guestName} <span className="opacity-60">· Team {team ?? '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Spectrum Bar */}
      <div className="bg-white border-2 border-[var(--border)] rounded-2xl p-6">
        <div className="flex justify-between mb-4 text-sm md:text-base font-black">
          <span>{boardState.spectrum[0]}</span>
          <span>{boardState.spectrum[1]}</span>
        </div>

        <div className="relative h-8 mb-4">
          {/* base track */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 rounded-full bg-gray-200" />

          {/* scoring zones around the target */}
          {targetValue !== null && BANDS.slice().reverse().map(band => (
            <div
              key={band.points}
              className={`absolute top-1/2 -translate-y-1/2 h-4 rounded-full ${band.color}`}
              style={clampedRange(targetValue ?? 0, band.radius)}
            />
          ))}

          {/* exact target marker */}
          {targetValue !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-7 bg-[var(--ink)] rounded-full"
              style={{ left: `${targetValue}%` }}
            />
          )}

          {/* pointer marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-150"
            style={{ left: `${localPointer}%` }}
          >
            <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow-md" />
          </div>
        </div>

        {boardState.phase === 'team-guess' && (
          <>
            <input
              type="range"
              min={0}
              max={100}
              value={localPointer}
              disabled={!canMovePointer}
              onChange={(e) => updatePointer(Number(e.target.value))}
              className="w-full h-2 accent-red-500 disabled:opacity-40"
            />
            <div className="text-center mt-2 font-bold">Pointer: {localPointer}</div>
            {!canMovePointer && (
              <p className="text-center text-xs font-bold text-[var(--muted)] mt-1">
                Only Team {psychicTeam ?? '—'} can move the pointer.
              </p>
            )}
          </>
        )}
      </div>

      {/* Phase-specific content */}
      <div className="space-y-4">
        {/* LOCAL: single-screen peek + clue */}
        {isLocal && boardState.phase === 'team-guess' && (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 space-y-3">
            <div className="font-bold text-purple-900">🕵️ Psychic's turn to set up</div>
            <button
              onClick={() => (peek ? setPeek(false) : revealSecret(boardState.psychicId))}
              className="w-full bg-purple-500 text-white py-2 rounded-lg font-bold hover:brightness-110 transition-all"
            >
              {peek ? '🙈 Hide Target' : '👁️ Peek Target'}
            </button>
            <div>
              <label className="block text-sm font-bold mb-1">Clue (one word):</label>
              <input
                type="text"
                value={clue}
                onChange={(e) => setClue(e.target.value)}
                placeholder="e.g., Lukewarm"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg font-bold text-lg text-center"
              />
            </div>
          </div>
        )}

        {/* SHARE-CODE: Psychic sets target and clue before revealing to the team */}
        {!isLocal && boardState.phase === 'psychic-set' && isPsychic && (
          <div className="space-y-4">
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <div className="font-bold text-purple-900 mb-2">🎲 You are the Psychic</div>
              <div className="text-sm text-purple-800 mb-4">
                Secretly view the target, then give a one-word clue that points to that spot on the spectrum.
              </div>
              <button
                onClick={() => myPlayerId && revealSecret(myPlayerId)}
                disabled={!!secret}
                className="w-full bg-purple-500 text-white py-2 rounded-lg font-bold disabled:opacity-50 hover:brightness-110 transition-all"
              >
                {secret ? `Target seen: ${secret.target}` : 'View Secret Target'}
              </button>
            </div>

            <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4">
              <label className="block text-sm font-bold mb-2">Your clue (one word):</label>
              <input
                type="text"
                value={clue}
                onChange={(e) => setClue(e.target.value)}
                placeholder="e.g., Lukewarm"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg font-bold text-lg text-center"
              />
            </div>

            <button
              onClick={startGuessing}
              disabled={!secret || !clue.trim() || loading}
              className="w-full bg-[#8b5cf6] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loading ? 'Starting...' : '▶ Give Clue & Start Guessing'}
            </button>
          </div>
        )}

        {!isLocal && boardState.phase === 'psychic-set' && !isPsychic && (
          <p className="text-center py-6 font-bold text-[var(--muted)]">Waiting for the Psychic to set up the round…</p>
        )}

        {!isLocal && boardState.phase === 'team-guess' && !isPsychic && canMovePointer && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="font-bold text-blue-900 mb-2">🎯 Team {myTeam}, it's your turn!</div>
            <div className="text-sm text-blue-800">Discuss the clue and drag the pointer to where you think the target is.</div>
          </div>
        )}

        {!isLocal && boardState.phase === 'team-guess' && isPsychic && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <div className="font-bold text-yellow-900">👀 Waiting for your team's guess</div>
            <div className="text-sm text-yellow-800 mt-1">Your clue was: <strong>{clue || '(no clue set)'}</strong></div>
          </div>
        )}

        {/* Reveal Phase */}
        {boardState.phase === 'revealed' && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 text-center space-y-3">
            <div className="text-3xl font-black text-green-600">🎉</div>
            <div className="font-bold text-green-900">Round Complete</div>
            {boardState.target !== null && boardState.target !== undefined && (
              <div className="space-y-1 text-sm text-green-800">
                <div><strong>Target:</strong> {boardState.target}</div>
                <div><strong>Guess:</strong> {boardState.pointer}</div>
                <div><strong>Distance:</strong> {Math.abs((boardState.pointer ?? 50) - boardState.target)} points away</div>
              </div>
            )}
            {isHost && (
              <button
                onClick={newRound}
                disabled={loading}
                className="w-full bg-[#8b5cf6] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {loading ? 'Starting...' : '▶ Next Round'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Host reveal control */}
      {isHost && boardState.phase === 'team-guess' && (
        <button
          onClick={revealResult}
          disabled={loading}
          className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {loading ? 'Revealing...' : '✓ Reveal Results'}
        </button>
      )}

      {error && <p className="text-center text-sm font-bold text-red-600">{error}</p>}
    </div>
  )
}
