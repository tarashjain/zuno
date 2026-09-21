'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { joinSession, startSession, toggleReady } from '@/app/actions/score'

type PlayerDTO = { id: number; guestName: string; ready: boolean }

const POLL_MS = 2500

export default function LobbyLive({
  sessionId,
  mode,
  isHost,
  initialStatus,
  initialPlayers,
  initialMyPlayerId,
}: {
  sessionId: string
  mode: string
  isHost: boolean
  initialStatus: string
  initialPlayers: PlayerDTO[]
  initialMyPlayerId: number | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [players, setPlayers] = useState(initialPlayers)
  const [myPlayerId, setMyPlayerId] = useState(initialMyPlayerId)
  const [guestName, setGuestName] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const redirected = useRef(false)

  const isLocal = mode === 'local'

  // Poll for live updates: new players, ready toggles, and the host starting the game.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/${sessionId}/status`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!data) return
        setStatus(data.status)
        setPlayers(data.players)
      } catch {
        // transient network error — next poll will retry
      }
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [sessionId])

  // Once the host starts the game, everyone watching this lobby jumps to the board.
  useEffect(() => {
    if (status === 'active' && !redirected.current) {
      redirected.current = true
      router.push(`/room/${sessionId}/play`)
    }
  }, [status, sessionId, router])

  const handleJoin = () => {
    const name = guestName.trim()
    if (!name) return
    setJoinError(null)
    startTransition(async () => {
      const result = await joinSession(sessionId, name)
      if (result.ok && result.id !== undefined) {
        setMyPlayerId(result.id)
        setGuestName('')
      } else {
        setJoinError(result.reason ?? 'Could not add that player.')
      }
    })
  }

  const handleToggleReady = () => {
    if (myPlayerId === null) return
    startTransition(async () => {
      await toggleReady(sessionId, myPlayerId)
    })
  }

  const handleStart = () => {
    setStartError(null)
    startTransition(async () => {
      const result = await startSession(sessionId)
      if (result && !result.ok) setStartError(result.reason ?? 'Could not start the game.')
    })
  }

  const me = players.find(p => p.id === myPlayerId)
  const allReady = players.length > 0 && players.every(p => p.ready)
  const canStart = players.length > 0 && (isLocal || allReady)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Join / add player form */}
        <div className="bg-white border-2 border-[var(--border)] rounded-xl p-5">
          <h2 className="text-lg font-extrabold mb-4">{isLocal ? 'Add Player' : 'Join Game'}</h2>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Your name…"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              className="p-3 border-2 border-[var(--border)] rounded-xl bg-[var(--paper)] font-semibold outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              onClick={handleJoin}
              disabled={pending || !guestName.trim()}
              className="bg-[#16a34a] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#166534]"
            >
              {isLocal ? 'Add Player' : 'Join Lobby'}
            </button>
            {joinError && (
              <p className="text-xs font-bold text-[#dc2626] text-center">{joinError}</p>
            )}
          </div>

          {!isLocal && myPlayerId !== null && me && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-sm font-semibold text-[var(--muted)] mb-2">
                You joined as <strong className="text-[var(--text)]">{me.guestName}</strong>
              </p>
              <button
                onClick={handleToggleReady}
                disabled={pending}
                className={`w-full py-3 rounded-xl font-bold transition-all disabled:opacity-50 ${
                  me.ready
                    ? 'bg-[var(--accent)] text-white shadow-[0_2px_0_#b83208]'
                    : 'bg-[var(--cream)] border-2 border-[var(--border)] hover:border-[var(--accent)]'
                }`}
              >
                {me.ready ? '✅ Ready!' : "I'm Ready"}
              </button>
            </div>
          )}
        </div>

        {/* Player list */}
        <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-5">
          <h2 className="text-lg font-extrabold mb-4">
            Players{' '}
            <span className="text-[var(--muted)] font-semibold text-base">({players.length})</span>
          </h2>

          {players.length === 0 ? (
            <p className="text-sm text-[var(--muted)] font-semibold">No players yet…</p>
          ) : (
            <ul className="space-y-2 mb-5">
              {players.map(p => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 font-bold bg-white border-2 border-[var(--border)] rounded-lg px-3 py-2"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span>👤</span> {p.guestName}
                  </span>
                  {!isLocal && (
                    <span
                      className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0 ${
                        p.ready ? 'bg-[#16a34a] text-white' : 'bg-[var(--surface2)] text-[var(--muted)]'
                      }`}
                    >
                      {p.ready ? 'Ready' : 'Waiting'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isHost ? (
            <>
              <button
                onClick={handleStart}
                disabled={pending || !canStart}
                className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#b83208]"
              >
                Start Game →
              </button>
              {!isLocal && players.length > 0 && !allReady && (
                <p className="text-xs font-semibold text-[var(--muted)] mt-2 text-center">
                  Waiting for everyone to be ready…
                </p>
              )}
              {startError && (
                <p className="text-xs font-bold text-[#dc2626] mt-2 text-center">{startError}</p>
              )}
            </>
          ) : (
            players.length > 0 && (
              <p className="text-xs font-semibold text-[var(--muted)] text-center">
                Waiting for the host to start the game…
              </p>
            )
          )}
        </div>
      </div>

      {/* Footer hint */}
      <p className="text-center text-xs text-[var(--muted)] font-semibold mt-6">
        {isLocal
          ? 'Add everyone playing on this device, then hit Start Game.'
          : 'This screen updates automatically as players join and get ready.'}
      </p>
    </>
  )
}
