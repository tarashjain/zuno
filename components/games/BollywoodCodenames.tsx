'use client'
import { useState } from 'react'
import { getCodenamesSpymasterGrid, revealCodenamesCard, startCodenamesGame } from '@/app/actions/secret-games'
import { useLiveBoard } from '@/components/room/useLiveBoard'

type Session = { id: string }
type Team = 'red' | 'blue' | 'neutral' | 'assassin'
type Card = { id: number; word: string }
type BollywoodState = { kind: 'codenames'; grid: Card[]; revealed: Record<string, Team> } | null

export default function BollywoodCodenames({ session, isHost }: { session: Session; isHost: boolean }) {
  const { boardState, replaceBoardState } = useLiveBoard<BollywoodState, { id: number }>(session.id, null, [])
  const [spymasterTeams, setSpymasterTeams] = useState<Record<string, Team> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grid = boardState?.grid ?? []
  const revealed = boardState?.revealed ?? {}
  const remaining = {
    red: 9 - Object.values(revealed).filter(team => team === 'red').length,
    blue: 8 - Object.values(revealed).filter(team => team === 'blue').length,
  }

  const newGame = async () => {
    setLoading(true)
    setError(null)
    try {
      replaceBoardState(await startCodenamesGame(session.id))
      setSpymasterTeams(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the game.')
    } finally {
      setLoading(false)
    }
  }

  const revealCard = async (id: number) => {
    if (!boardState || revealed[String(id)] || loading) return
    setLoading(true)
    setError(null)
    try {
      replaceBoardState(await revealCodenamesCard(session.id, id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reveal the card.')
    } finally {
      setLoading(false)
    }
  }

  const toggleSpymaster = async () => {
    if (spymasterTeams) {
      setSpymasterTeams(null)
      return
    }
    try {
      setSpymasterTeams(await getCodenamesSpymasterGrid(session.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open Spymaster View.')
    }
  }

  const cardStyle = (cardId: number): string => {
    const team = spymasterTeams?.[String(cardId)] ?? revealed[String(cardId)]
    if (team === 'red') return 'bg-red-500 text-white border-red-600'
    if (team === 'blue') return 'bg-blue-500 text-white border-blue-600'
    if (team === 'assassin') return 'bg-gray-900 text-gray-100 border-black'
    if (team === 'neutral') return 'bg-amber-100 text-amber-900 border-amber-300'
    return 'bg-white text-[var(--ink)] border-[var(--border)] hover:border-[var(--accent)]'
  }

  if (!boardState) {
    return (
      <div className="text-center py-16 bg-white border-2 border-[var(--border)] rounded-xl">
        <div className="text-4xl mb-3">🎬</div>
        <p className="font-bold text-[var(--muted)] mb-5">{isHost ? 'No game running yet — deal the board to start.' : 'Waiting for the host to deal the board…'}</p>
        {isHost && <button onClick={newGame} disabled={loading} className="px-6 py-3 bg-[#7c3aed] text-white rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#5b21b6]">🎬 Start Game</button>}
        {error && <p className="mt-4 text-sm font-bold text-[#dc2626]">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 bg-white border-2 border-[var(--border)] rounded-xl p-4">
        <div className="flex flex-wrap gap-3 sm:gap-5">
          <span className="font-extrabold text-red-500">🔴 {remaining.red} left</span>
          <span className="font-extrabold text-blue-500">🔵 {remaining.blue} left</span>
        </div>
        {isHost && (
          <button onClick={toggleSpymaster} className="font-bold text-sm px-3 py-2 rounded-lg border-2 border-[var(--border)] hover:border-[var(--accent)]">
            {spymasterTeams ? 'Hide Spymaster View' : 'Show Spymaster View'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-6">
        {grid.map(card => {
          const isRevealed = !!revealed[String(card.id)]
          return (
            <button
              key={card.id}
              onClick={() => revealCard(card.id)}
              disabled={isRevealed || loading}
              className={`min-h-12 sm:min-h-16 flex items-center justify-center p-1 rounded-lg sm:rounded-xl font-extrabold text-[9px] sm:text-xs uppercase tracking-wide break-words border-2 transition-all leading-tight text-center ${cardStyle(card.id)} ${isRevealed && !spymasterTeams ? 'opacity-40' : 'opacity-100'}`}
            >
              {card.word}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 text-xs font-bold">
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Red Team (9 words)</div>
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Blue Team (8 words)</div>
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" /> Neutral (7)</div>
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2"><span className="w-3 h-3 rounded-sm bg-gray-900 inline-block" /> Assassin (1)</div>
      </div>

      {isHost && <button onClick={newGame} disabled={loading} className="w-full py-3 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--ink)] disabled:opacity-50 transition-colors">🎬 New Game</button>}
      {error && <p className="mt-4 text-center text-sm font-bold text-[#dc2626]">{error}</p>}
    </div>
  )
}
