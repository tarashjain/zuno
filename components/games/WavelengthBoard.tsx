'use client'
import { useEffect, useState } from 'react'
import { useLiveBoard } from '@/components/room/useLiveBoard'
import { startWavelengthRound, getWavelengthSecret, revealWavelengthRound, startTeamGuessing, setWavelengthPointer } from '@/app/actions/wavelength'

type Player = { id: number; guestName: string; scores: { points: number; round: number }[] }
type Session = { id: string; mode: string }
type PublicState = {
  kind: 'wavelength'
  spectrum: [string, string]
  psychicId: number
  phase: 'psychic-set' | 'team-guess' | 'revealed'
  pointer?: number | null
  target?: number | null
  teams?: Record<string, 'A' | 'B'>
} | null

export default function WavelengthBoard({ session, players: initialPlayers, isHost, myPlayerId }: { session: Session; players: Player[]; isHost: boolean; myPlayerId: number | null }) {
  const { boardState, replaceBoardState, players } = useLiveBoard<PublicState, Player>(session.id, null, initialPlayers)
  const [secret, setSecret] = useState<{ target: number } | null>(null)
  const [clue, setClue] = useState('')
  const [localPointer, setLocalPointer] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMyTeam = boardState && myPlayerId && boardState.teams ? boardState.teams[String(myPlayerId)] : null
  const psychicTeam = boardState && myPlayerId && boardState.teams ? boardState.teams[String(boardState.psychicId)] : null
  const isPsychic = boardState?.psychicId === myPlayerId

  useEffect(() => {
    if (boardState?.phase !== 'psychic-set') setSecret(null)
  }, [boardState?.phase])

  const newRound = async () => {
    setLoading(true)
    setError(null)
    try {
      const state = await startWavelengthRound(session.id)
      replaceBoardState(state)
      setClue('')
      setLocalPointer(50)
      setSecret(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start round')
    } finally { setLoading(false) }
  }

  const revealSecret = async () => {
    if (!myPlayerId) return
    try {
      const s = await getWavelengthSecret(session.id, myPlayerId)
      setSecret(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not fetch secret')
    }
  }

  const startGuessing = async () => {
    if (!isPsychic) return
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
      replaceBoardState(next as any)
    } catch (e) {
      // transient error
    }
  }

  const revealResult = async () => {
    if (!isHost) return
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
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] rounded-2xl p-8 text-center text-white mb-6">
          <div className="text-4xl font-black mb-2">〜</div>
          <div className="text-sm font-bold uppercase tracking-widest opacity-80">Wavelength</div>
        </div>

        <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 mb-6 text-sm text-center text-[var(--muted)]">
          One player is the <strong>Psychic</strong>. They secretly set a target on the spectrum, give a one-word clue, and their team tries to match it.
        </div>

        {isHost ? (
          <button onClick={newRound} disabled={loading} className="w-full bg-[#8b5cf6] text-white py-3 rounded-xl font-bold text-base mb-4 hover:brightness-110 disabled:opacity-50 transition-all">
            {loading ? 'Starting...' : '🕵️ Start First Round'}
          </button>
        ) : (
          <p className="text-center py-10 font-bold text-[var(--muted)]">Waiting for the host to start the round…</p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">
              {boardState.phase === 'psychic-set' ? '🎲 Psychic Setting Target' : boardState.phase === 'team-guess' ? '🎯 Team Guessing' : '✓ Revealed'}
            </div>
            <div className="text-lg font-black">
              {Array.isArray(boardState.spectrum) ? boardState.spectrum[0] : boardState.spectrum.split(' → ')[0]} <span className="opacity-70">→</span> {Array.isArray(boardState.spectrum) ? boardState.spectrum[1] : boardState.spectrum.split(' → ')[1]}
            </div>
          </div>
          {isHost && (
            <button
              onClick={newRound}
              disabled={loading}
              className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              New Round
            </button>
          )}
        </div>
      </div>

      {/* Spectrum Dial */}
      <div className="bg-white border-2 border-[var(--border)] rounded-2xl p-6">
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 260 140" className="w-full h-auto" style={{ maxHeight: '200px' }}>
            <defs>
              <linearGradient id="spectrum" x1="0%" x2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="75%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="spectrumDark" x1="0%" x2="100%">
                <stop offset="0%" stopColor="#991b1b" />
                <stop offset="25%" stopColor="#9a3412" />
                <stop offset="50%" stopColor="#a16207" />
                <stop offset="75%" stopColor="#166534" />
                <stop offset="100%" stopColor="#1e40af" />
              </linearGradient>
            </defs>

            {/* Spectrum arc background */}
            <path
              d="M 20 120 A 100 100 0 0 1 240 120"
              stroke="#e5e7eb"
              strokeWidth="18"
              fill="none"
              strokeLinecap="round"
            />

            {/* Spectrum arc gradient */}
            <path
              d="M 20 120 A 100 100 0 0 1 240 120"
              stroke="url(#spectrum)"
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
            />

            {/* Left label */}
            <text x="10" y="135" fontSize="12" fontWeight="bold" fill="var(--ink)" textAnchor="start">
              {Array.isArray(boardState.spectrum) ? boardState.spectrum[0] : boardState.spectrum.split(' → ')[0]}
            </text>

            {/* Right label */}
            <text x="250" y="135" fontSize="12" fontWeight="bold" fill="var(--ink)" textAnchor="end">
              {Array.isArray(boardState.spectrum) ? boardState.spectrum[1] : boardState.spectrum.split(' → ')[1]}
            </text>

            {/* Target marker (hidden in psychic-set, visible in team-guess and revealed) */}
            {boardState.phase !== 'psychic-set' && boardState.target !== null && boardState.target !== undefined && (
              <circle
                cx={20 + (boardState.target / 100) * 220}
                cy="120"
                r="6"
                fill="#111827"
                opacity={boardState.phase === 'revealed' ? 1 : 0.3}
                stroke="#fff"
                strokeWidth="2"
              />
            )}

            {/* Pointer needle */}
            {boardState.phase !== 'psychic-set' && (
              <g transform={`translate(${20 + (localPointer / 100) * 220}, 120)`}>
                <circle cx="0" cy="0" r="8" fill="#dc2626" stroke="white" strokeWidth="2" />
                <line x1="0" y1="8" x2="0" y2="28" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
          </svg>

          {/* Slider */}
          {boardState.phase === 'team-guess' && (
            <div className="w-full mt-6">
              <input
                type="range"
                min="0"
                max="100"
                value={localPointer}
                onChange={(e) => updatePointer(Number(e.target.value))}
                className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <div className="flex justify-between text-xs font-bold text-[var(--muted)] mt-2">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
              <div className="text-center mt-3 font-bold text-lg">Pointer: {boardState.pointer ?? localPointer}</div>
            </div>
          )}
        </div>
      </div>

      {/* Phase-specific content */}
      <div className="space-y-4">
        {/* Psychic Phase */}
        {boardState.phase === 'psychic-set' && isPsychic && (
          <div className="space-y-4">
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <div className="font-bold text-purple-900 mb-2">🎲 You are the Psychic</div>
              <div className="text-sm text-purple-800 mb-4">
                Secretly view the target, then give a one-word clue that points to that spot on the spectrum.
              </div>
              <button
                onClick={revealSecret}
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

        {/* Team Guessing Phase */}
        {boardState.phase === 'team-guess' && !isPsychic && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="font-bold text-blue-900 mb-2">🎯 Team {isMyTeam}, it's your turn!</div>
            <div className="text-sm text-blue-800">
              Discuss the clue and adjust the pointer to where you think the target is on the spectrum.
            </div>
          </div>
        )}

        {boardState.phase === 'team-guess' && isPsychic && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <div className="font-bold text-yellow-900">👀 Waiting for team guess</div>
            <div className="text-sm text-yellow-800 mt-1">Your clue was: <strong>{clue || '(no clue set)'}</strong></div>
          </div>
        )}

        {/* Reveal Phase */}
        {boardState.phase === 'revealed' && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 text-center">
            <div className="text-3xl font-black text-green-600 mb-2">🎉</div>
            <div className="font-bold text-green-900 mb-3">Round Complete</div>
            {boardState.target !== null && boardState.target !== undefined && (
              <div className="space-y-2 text-sm text-green-800">
                <div><strong>Target:</strong> {boardState.target}</div>
                <div><strong>Guess:</strong> {boardState.pointer}</div>
                <div><strong>Distance:</strong> {Math.abs((boardState.pointer ?? 50) - boardState.target)} points</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Host Controls */}
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
