'use client'
import { useState, useMemo } from 'react'

type Word = { id: number; word: string }

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)

type Team = 'red' | 'blue' | 'neutral' | 'assassin'

export default function BollywoodCodenames({ words }: { words: Word[] }) {
  const [isSpymaster, setIsSpymaster] = useState(false)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [gameKey, setGameKey] = useState(0)

  const grid = useMemo(() => {
    const shuffledWords = shuffle(words).slice(0, 25)
    const teams: Team[] = shuffle([
      ...Array(9).fill('red' as Team),
      ...Array(8).fill('blue' as Team),
      ...Array(7).fill('neutral' as Team),
      'assassin' as Team,
    ])
    return shuffledWords.map((w, i) => ({ ...w, team: teams[i] }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey])

  const toggle = (id: number) => {
    setRevealed(r => { const n = new Set(r); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const newGame = () => { setGameKey(k => k + 1); setRevealed(new Set()); setIsSpymaster(false) }

  const remaining = {
    red: grid.filter(c => c.team === 'red' && !revealed.has(c.id)).length,
    blue: grid.filter(c => c.team === 'blue' && !revealed.has(c.id)).length,
  }

  const cardStyle = (team: Team, isRevealed: boolean): string => {
    if (isSpymaster || isRevealed) {
      if (team === 'red') return 'bg-red-500 text-white border-red-600'
      if (team === 'blue') return 'bg-blue-500 text-white border-blue-600'
      if (team === 'assassin') return 'bg-gray-900 text-gray-100 border-black'
      return 'bg-amber-100 text-amber-900 border-amber-300'
    }
    return 'bg-white text-[var(--ink)] border-[var(--border)] hover:border-[var(--accent)]'
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 bg-white border-2 border-[var(--border)] rounded-xl p-4">
        <div className="flex flex-wrap gap-3 sm:gap-5">
          <span className="font-extrabold text-red-500">🔴 {remaining.red} left</span>
          <span className="font-extrabold text-blue-500">🔵 {remaining.blue} left</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
          <input
            type="checkbox"
            checked={isSpymaster}
            onChange={() => setIsSpymaster(s => !s)}
            className="w-4 h-4 accent-[var(--accent)]"
          />
          Spymaster View
        </label>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-6">
        {grid.map((card) => {
          const isRevealed = revealed.has(card.id)
          return (
            <button
              key={card.id}
              onClick={() => toggle(card.id)}
              className={`
                min-h-12 sm:min-h-16 flex items-center justify-center p-1 rounded-lg sm:rounded-xl
                font-extrabold text-[9px] sm:text-xs uppercase tracking-wide break-words
                border-2 transition-all leading-tight text-center
                ${cardStyle(card.team, isRevealed)}
                ${isRevealed && !isSpymaster ? 'opacity-30' : 'opacity-100'}
              `}
            >
              {card.word}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 text-xs font-bold">
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Red Team (9 words)
        </div>
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Blue Team (8 words)
        </div>
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2">
          <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" /> Neutral (7)
        </div>
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2">
          <span className="w-3 h-3 rounded-sm bg-gray-900 inline-block" /> Assassin (1)
        </div>
      </div>

      <button
        onClick={newGame}
        className="w-full py-3 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--ink)] transition-colors"
      >
        🎬 New Game
      </button>
    </div>
  )
}
