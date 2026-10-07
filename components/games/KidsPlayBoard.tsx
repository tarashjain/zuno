'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { KidsGame } from '@/lib/kids-games'

function shuffled(prompts: string[]) {
  const deck = [...prompts]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export default function KidsPlayBoard({ game }: { game: KidsGame }) {
  const [names, setNames] = useState(['', ''])
  const [players, setPlayers] = useState<string[]>([])
  const [remaining, setRemaining] = useState<number[]>([])
  const [turn, setTurn] = useState(0)
  const [deck, setDeck] = useState<string[]>([])
  const [question, setQuestion] = useState(0)
  const [error, setError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const active = players.length > 0
  const finished = active && remaining.length === 1

  function start(nextPlayers: string[]) {
    setPlayers(nextPlayers)
    setRemaining(nextPlayers.map((_, index) => index))
    setTurn(0)
    setDeck(shuffled(game.prompts))
    setQuestion(0)
    setConfirmReset(false)
  }

  function nextQuestion() {
    if (question + 1 === deck.length) {
      const nextDeck = shuffled(game.prompts)
      if (nextDeck[0] === deck[question]) {
        ;[nextDeck[0], nextDeck[1]] = [nextDeck[1], nextDeck[0]]
      }
      setDeck(nextDeck)
      setQuestion(0)
    } else {
      setQuestion(question + 1)
    }
  }

  function answer(out: boolean) {
    if (finished) return
    if (out) {
      const nextRemaining = remaining.filter((_, index) => index !== turn)
      setRemaining(nextRemaining)
      setTurn(turn % nextRemaining.length)
    } else {
      setTurn((turn + 1) % remaining.length)
    }
    nextQuestion()
  }

  const button = 'px-5 py-3 rounded-xl font-bold transition-colors'

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-12">
      <Link href={`/games/${game.slug}`} className="text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)]">← Rules & examples</Link>
      <p className="text-sm font-bold text-[var(--accent)] mt-6 mb-2">🪁 Kids n Play · Local only</p>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">{game.emoji} {game.name}</h1>
      <p className="text-[var(--muted)] mb-8">{game.reminder}</p>

      {!active ? (
        <form className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6" onSubmit={event => {
          event.preventDefault()
          const nextPlayers = names.map((name, index) => name.trim() || `Player ${index + 1}`)
          if (new Set(nextPlayers.map(name => name.toLowerCase())).size !== nextPlayers.length) {
            setError('Give each player a different name so you can tell whose turn it is.')
            return
          }
          setError('')
          start(nextPlayers)
        }}>
          <h2 className="text-2xl font-black mb-2">Who’s playing?</h2>
          <p className="text-sm text-[var(--muted)] mb-6">Gather 2–8 players around one device. Take turns reading questions aloud for the player answering.</p>
          <div className="space-y-3">
            {names.map((name, index) => (
              <div key={index} className="flex items-end gap-2">
                <label className="flex-1 min-w-0 text-sm font-bold">
                  Player {index + 1}
                  <input value={name} maxLength={24} placeholder={`Player ${index + 1}`} onChange={event => {
                    setNames(names.map((value, i) => i === index ? event.target.value : value))
                    setError('')
                  }} className="block w-full mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                </label>
                {names.length > 2 && <button type="button" aria-label={`Remove player ${index + 1}`} onClick={() => { setNames(names.filter((_, i) => i !== index)); setError('') }} className={`${button} bg-[var(--surface2)]`}>×</button>}
              </div>
            ))}
          </div>
          {error && <p role="alert" className="text-[var(--red)] text-sm mt-4">{error}</p>}
          <div className="flex flex-wrap gap-3 mt-6">
            <button type="button" disabled={names.length >= 8} onClick={() => setNames([...names, ''])} className={`${button} border border-[var(--border)] disabled:opacity-40`}>+ Add player</button>
            <button type="submit" className={`${button} bg-[var(--accent)] text-white`}>Start game →</button>
          </div>
        </form>
      ) : (
        <>
          <section aria-live="polite" aria-atomic="true" className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 text-center">
            {finished ? (
              <>
                <div className="text-5xl mb-4">🏆</div>
                <h2 className="text-3xl font-black break-words">{players[remaining[0]]} wins!</h2>
                <p className="text-[var(--muted)] mt-3">The last player still in. Ready for another round?</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-[var(--accent)] mb-4 break-words">{players[remaining[turn]]} is answering</p>
                <h2 className="text-2xl sm:text-3xl font-black leading-snug">{deck[question]}</h2>
                <p className="text-sm text-[var(--muted)] mt-5">Answer aloud. The group decides if you’re still in!</p>
              </>
            )}
          </section>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {finished ? (
              <>
                <button onClick={() => start(players)} className={`${button} flex-1 bg-[var(--accent)] text-white`}>Play again</button>
                <button onClick={() => { setPlayers([]); setConfirmReset(false) }} className={`${button} border border-[var(--border)]`}>Change players</button>
              </>
            ) : (
              <>
                <button onClick={() => answer(false)} className={`${button} flex-1 bg-[var(--accent)] text-white`}>Still in! Next player →</button>
                <button onClick={() => answer(true)} className={`${button} flex-1 border border-[var(--red)] text-[var(--red)]`}>{game.mistakeLabel}</button>
              </>
            )}
          </div>
          {!finished && <button onClick={nextQuestion} className="block mx-auto mt-4 py-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)]">Skip question</button>}

          {/* Live scoreboard */}
          <div className="mt-8 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden" aria-label="Players">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Players</h3>
            </div>
            <ul>
              {players.map((player, index) => {
                const isIn = remaining.includes(index)
                const isAnswering = isIn && remaining[turn] === index && !finished
                const isWinner = finished && remaining[0] === index
                return (
                  <li key={index} className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] last:border-0 ${isAnswering ? 'bg-[var(--surface2)]' : ''}`}>
                    <span className={`font-bold break-words mr-3 ${!isIn && !isWinner ? 'text-[var(--muted)] line-through' : ''}`}>{player}</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 ${
                      isWinner ? 'bg-yellow-100 text-yellow-700' :
                      isAnswering ? 'bg-[var(--accent)] text-white' :
                      isIn ? 'bg-green-100 text-green-700' :
                      'bg-[var(--surface2)] text-[var(--muted)]'
                    }`}>
                      {isWinner ? '🏆 Winner' : isAnswering ? 'Answering' : isIn ? 'Still in' : 'Out'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
          {!finished && (
            <div className="mt-6">
              {confirmReset ? (
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <p className="font-bold mb-3">End this game and change players?</p>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => { setPlayers([]); setConfirmReset(false) }} className={`${button} bg-[var(--surface2)]`}>End game</button>
                    <button onClick={() => setConfirmReset(false)} className={`${button} border border-[var(--border)]`}>Keep playing</button>
                  </div>
                </div>
              ) : <button onClick={() => setConfirmReset(true)} className="text-sm font-bold text-[var(--muted)] py-2">New game</button>}
            </div>
          )}
        </>
      )}
      <p className="text-xs text-[var(--muted)] mt-6">Play together on this device. Progress lasts until you leave or refresh this page.</p>
    </main>
  )
}
