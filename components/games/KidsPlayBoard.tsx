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
  const [inputName, setInputName] = useState('')
  const [pendingPlayers, setPendingPlayers] = useState<string[]>([])
  const [addError, setAddError] = useState('')

  const [players, setPlayers] = useState<string[]>([])
  const [remaining, setRemaining] = useState<number[]>([])
  const [turn, setTurn] = useState(0)
  const [deck, setDeck] = useState<string[]>([])
  const [question, setQuestion] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)

  const active = players.length > 0
  const finished = active && remaining.length === 1

  function handleAdd() {
    const name = inputName.trim()
    if (!name) return
    if (pendingPlayers.length >= 8) return
    if (pendingPlayers.some(p => p.toLowerCase() === name.toLowerCase())) {
      setAddError(`"${name}" is already added — use a different name.`)
      return
    }
    setAddError('')
    setPendingPlayers([...pendingPlayers, name])
    setInputName('')
  }

  function start(nextPlayers: string[]) {
    setPlayers(nextPlayers)
    setRemaining(nextPlayers.map((_, i) => i))
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
      const nextRemaining = remaining.filter((_, i) => i !== turn)
      setRemaining(nextRemaining)
      setTurn(turn % nextRemaining.length)
    } else {
      setTurn((turn + 1) % remaining.length)
    }
    nextQuestion()
  }

  const btn = 'px-5 py-3 rounded-xl font-bold transition-colors'

  if (!active) return (
    <main className="max-w-2xl mx-auto p-6 md:p-10">
      {/* Header — matches lobby style */}
      <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-6 pb-4 border-b-2 border-[var(--ink)]">
        <a href="/" className="text-3xl font-extrabold tracking-tight leading-none">
          ZU<span className="text-[var(--accent)]">N</span>O
        </a>
        <span className="text-[var(--muted)] font-semibold text-sm break-words">| {game.name}</span>
      </div>

      {/* Kids n Play banner */}
      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Kids n Play</p>
          <p className="text-sm font-semibold mt-1">Add every player below on this device — no code needed.</p>
        </div>
        <span className="text-4xl">🪁</span>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Add Player */}
        <div className="bg-white border-2 border-[var(--border)] rounded-xl p-5">
          <h2 className="text-lg font-extrabold mb-4">Add Player</h2>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Player name…"
              value={inputName}
              maxLength={24}
              onChange={e => { setInputName(e.target.value); setAddError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="p-3 border-2 border-[var(--border)] rounded-xl bg-[var(--paper)] font-semibold outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!inputName.trim() || pendingPlayers.length >= 8}
              className="bg-[#16a34a] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#166534]"
            >
              Add Player
            </button>
            {addError && <p className="text-xs font-bold text-[#dc2626] text-center">{addError}</p>}
          </div>
        </div>

        {/* Players list */}
        <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-5">
          <h2 className="text-lg font-extrabold mb-4">
            Players{' '}
            <span className="text-[var(--muted)] font-semibold text-base">({pendingPlayers.length})</span>
          </h2>
          {pendingPlayers.length === 0 ? (
            <p className="text-sm text-[var(--muted)] font-semibold mb-5">No players yet…</p>
          ) : (
            <ul className="space-y-2 mb-5">
              {pendingPlayers.map((name, i) => (
                <li key={i} className="flex items-center justify-between gap-2 font-bold bg-white border-2 border-[var(--border)] rounded-lg px-3 py-2">
                  <span className="flex items-center gap-2 truncate">
                    <span>👤</span> {name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => setPendingPlayers(pendingPlayers.filter((_, j) => j !== i))}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-red-100 hover:text-red-600 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => start(pendingPlayers)}
            disabled={pendingPlayers.length === 0}
            className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#b83208]"
          >
            Start Game →
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--muted)] font-semibold mt-6">
        Add everyone playing on this device, then hit Start Game.
      </p>
    </main>
  )

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-12">
      <Link href={`/games/${game.slug}`} className="text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)]">← Rules & examples</Link>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-6 mb-3">{game.emoji} {game.name}</h1>
      <p className="text-[var(--muted)] mb-8">{game.reminder}</p>

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
            <p className="text-sm text-[var(--muted)] mt-5">Answer aloud. The group decides if you&apos;re still in!</p>
          </>
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        {finished ? (
          <>
            <button onClick={() => start(players)} className={`${btn} flex-1 bg-[var(--accent)] text-white`}>Play again</button>
            <button onClick={() => { setPlayers([]); setConfirmReset(false) }} className={`${btn} border border-[var(--border)]`}>Change players</button>
          </>
        ) : (
          <>
            <button onClick={() => answer(false)} className={`${btn} flex-1 bg-[var(--accent)] text-white`}>Still in! Next player →</button>
            <button onClick={() => answer(true)} className={`${btn} flex-1 border border-[var(--red)] text-[var(--red)]`}>{game.mistakeLabel}</button>
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
                <button onClick={() => { setPlayers([]); setPendingPlayers([]); setConfirmReset(false) }} className={`${btn} bg-[var(--surface2)]`}>End game</button>
                <button onClick={() => setConfirmReset(false)} className={`${btn} border border-[var(--border)]`}>Keep playing</button>
              </div>
            </div>
          ) : <button onClick={() => setConfirmReset(true)} className="text-sm font-bold text-[var(--muted)] py-2">New game</button>}
        </div>
      )}

      <p className="text-xs text-[var(--muted)] mt-6">Play together on this device. Progress lasts until you leave or refresh this page.</p>
    </main>
  )
}
