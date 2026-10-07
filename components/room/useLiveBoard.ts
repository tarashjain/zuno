'use client'
import { useEffect, useState } from 'react'
import { setBoardState as persistBoardState } from '@/app/actions/board'

/**
 * Keeps a game board's shared state (whose turn, dice, grid, round, etc.) and player/score
 * list in sync across every device in the room by polling the session's board endpoint.
 * `setBoardState` both updates local state immediately and persists it for everyone else.
 */
export function useLiveBoard<TState, TPlayer extends { id: number }>(
  sessionId: string,
  initialBoardState: TState,
  initialPlayers: TPlayer[],
  pollMs = 2000
) {
  const [boardState, setBoardStateRaw] = useState<TState>(initialBoardState)
  const [players, setPlayers] = useState<TPlayer[]>(initialPlayers)

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/${sessionId}/board`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!data) return
        setBoardStateRaw((prev: TState) => (data.boardState ?? prev) as TState)
        setPlayers(data.players)
      } catch {
        // transient network error — next poll will retry
      }
    }, pollMs)
    return () => clearInterval(interval)
  }, [sessionId, pollMs])

  const setBoardState = (next: TState) => {
    setBoardStateRaw(next)
    persistBoardState(sessionId, next)
  }

  return { boardState, setBoardState, replaceBoardState: setBoardStateRaw, players, setPlayers }
}
