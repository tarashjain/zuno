'use client'

import { useState, useEffect, useRef } from 'react'
import { saveKidsSession } from '@/app/actions/kids-session'

const COLORS = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'black'] as const
type ColorKey = typeof COLORS[number]

const COLOR_META: Record<ColorKey, { label: string; css: string }> = {
  red:    { label: 'Red',    css: '#dc2626' },
  green:  { label: 'Green',  css: '#16a34a' },
  blue:   { label: 'Blue',   css: '#2563eb' },
  yellow: { label: 'Yellow', css: '#d97706' },
  orange: { label: 'Orange', css: '#ea580c' },
  purple: { label: 'Purple', css: '#9333ea' },
  pink:   { label: 'Pink',   css: '#db2777' },
  black:  { label: 'Black',  css: '#111827' },
}

type WordCard = { word: ColorKey; color: ColorKey }
type Phase = 'setup' | 'playing' | 'results' | 'gameover'

const LEVEL_UPS = ['Amazing!', 'Color Champion!', 'Great Job!', 'Brilliant!', 'Superstar!']

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateSequence(count: number): WordCard[] {
  return Array.from({ length: count }, () => {
    const word = pick(COLORS)
    const pool = COLORS.filter(c => c !== word)
    return { word, color: pick(pool) }
  })
}

function wordCount(level: number) { return 4 + level }

function Scoreboard({ players, scores }: { players: string[]; scores: number[] }) {
  const maxScore = Math.max(...scores, 0)
  const ranked = players.map((name, i) => ({ name, score: scores[i] })).sort((a, b) => b.score - a.score)
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Scoreboard</h3>
      </div>
      <ul>
        {ranked.map((p, rank) => (
          <li key={p.name} className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] last:border-0 ${p.score === maxScore && maxScore > 0 ? 'bg-yellow-50' : ''}`}>
            <span className="font-bold flex items-center gap-2">
              {rank === 0 && maxScore > 0 && '👑'} {p.name}
            </span>
            <span className="text-xl font-black">{p.score}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function StroopBoard() {
  const [inputName, setInputName] = useState('')
  const [pendingPlayers, setPendingPlayers] = useState<string[]>([])
  const [addError, setAddError] = useState('')

  const [phase, setPhase] = useState<Phase>('setup')
  const [players, setPlayers] = useState<string[]>([])
  const [scores, setScores] = useState<number[]>([])
  const [level, setLevel] = useState(1)
  const [round, setRound] = useState(1)
  const [sequence, setSequence] = useState<WordCard[]>([])
  const [playerResults, setPlayerResults] = useState<(boolean | null)[]>([])
  const [showAnswers, setShowAnswers] = useState(false)
  const [levelUpMsg, setLevelUpMsg] = useState('')

  const savedRef = useRef(false)

  useEffect(() => {
    if (phase !== 'gameover' || savedRef.current || players.length === 0) return
    savedRef.current = true
    const maxScore = Math.max(...scores)
    saveKidsSession(
      'say-the-color',
      players.map((name, i) => ({ name, score: scores[i], won: scores[i] === maxScore }))
    ).catch(() => {})
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAdd() {
    const name = inputName.trim()
    if (!name || pendingPlayers.length >= 8) return
    if (pendingPlayers.some(p => p.toLowerCase() === name.toLowerCase())) {
      setAddError(`"${name}" is already added.`); return
    }
    setAddError('')
    setPendingPlayers([...pendingPlayers, name])
    setInputName('')
  }

  function startGame(playerNames: string[]) {
    savedRef.current = false
    setPlayers(playerNames)
    setScores(new Array(playerNames.length).fill(0))
    setLevel(1)
    setRound(1)
    setSequence(generateSequence(wordCount(1)))
    setPlayerResults(new Array(playerNames.length).fill(null))
    setShowAnswers(false)
    setLevelUpMsg('')
    setPhase('playing')
  }

  function finishRound() {
    setPlayerResults(new Array(players.length).fill(null))
    setShowAnswers(false)
    setPhase('results')
  }

  function setResult(idx: number, got: boolean) {
    setPlayerResults(prev => prev.map((r, i) => i === idx ? got : r))
  }

  function nextRound() {
    const anyGot = playerResults.some(r => r === true)
    const newLevel = anyGot ? level + 1 : level
    const newScores = scores.map((s, i) => playerResults[i] === true ? s + 1 : s)
    setScores(newScores)
    setLevel(newLevel)
    setRound(r => r + 1)
    setSequence(generateSequence(wordCount(newLevel)))
    setPlayerResults(new Array(players.length).fill(null))
    setShowAnswers(false)
    setLevelUpMsg(anyGot ? pick(LEVEL_UPS) : '')
    setPhase('playing')
  }

  function endGame() {
    const finalScores = scores.map((s, i) => phase === 'results' && playerResults[i] === true ? s + 1 : s)
    setScores(finalScores)
    setPhase('gameover')
  }

  const allResultsIn = playerResults.every(r => r !== null)
  const btn = 'px-5 py-3 rounded-xl font-bold transition-colors'

  /* ── SETUP ─────────────────────────────────────────────────── */
  if (phase === 'setup') return (
    <main className="max-w-2xl mx-auto p-6 md:p-10">
      <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-6 pb-4 border-b-2 border-[var(--ink)]">
        <a href="/" className="text-3xl font-extrabold tracking-tight leading-none">
          ZU<span className="text-[var(--accent)]">N</span>O
        </a>
        <span className="text-[var(--muted)] font-semibold text-sm">| Say the Color</span>
      </div>

      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Kids n Play</p>
          <p className="text-sm font-semibold mt-1">Say the FONT COLOR, not the word — don&apos;t let your brain trick you!</p>
        </div>
        <span className="text-4xl">🌈</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border-2 border-[var(--border)] rounded-xl p-5">
          <h2 className="text-lg font-extrabold mb-4">Add Player</h2>
          <div className="flex flex-col gap-3">
            <input type="text" placeholder="Player name…" value={inputName} maxLength={24}
              onChange={e => { setInputName(e.target.value); setAddError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="p-3 border-2 border-[var(--border)] rounded-xl bg-[var(--paper)] font-semibold outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button type="button" onClick={handleAdd}
              disabled={!inputName.trim() || pendingPlayers.length >= 8}
              className="bg-[#16a34a] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#166534]">
              Add Player
            </button>
            {addError && <p className="text-xs font-bold text-[#dc2626] text-center">{addError}</p>}
          </div>
        </div>

        <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-5">
          <h2 className="text-lg font-extrabold mb-4">
            Players <span className="text-[var(--muted)] font-semibold text-base">({pendingPlayers.length})</span>
          </h2>
          {pendingPlayers.length === 0
            ? <p className="text-sm text-[var(--muted)] font-semibold mb-4">No players yet…</p>
            : (
              <ul className="space-y-2 mb-4">
                {pendingPlayers.map((name, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 font-bold bg-white border-2 border-[var(--border)] rounded-lg px-3 py-2">
                    <span className="flex items-center gap-2 truncate"><span>👤</span> {name}</span>
                    <button type="button" aria-label={`Remove ${name}`}
                      onClick={() => setPendingPlayers(pendingPlayers.filter((_, j) => j !== i))}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-red-100 hover:text-red-600 transition-colors text-lg">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          <button onClick={() => pendingPlayers.length > 0 && startGame(pendingPlayers)}
            disabled={pendingPlayers.length === 0}
            className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#b83208]">
            Start Game →
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-[var(--muted)] font-semibold mt-6">
        Add everyone playing on this device, then hit Start Game.
      </p>
    </main>
  )

  /* ── PLAYING ────────────────────────────────────────────────── */
  if (phase === 'playing') return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-10">
      {levelUpMsg && (
        <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-center font-black text-yellow-700 text-lg">
          🎉 Level {level}! {levelUpMsg}
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Say the Color, Not the Word</p>
          <h1 className="text-2xl font-black">Level {level} · Round {round}</h1>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2 text-center flex-shrink-0">
          <p className="text-xs font-bold text-[var(--muted)]">Words</p>
          <p className="text-2xl font-black text-[var(--accent)]">{sequence.length}</p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-5 text-center">
          Say the FONT COLOR in order →
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-4 justify-center">
          {sequence.map((card, i) => (
            <span key={i} className="text-4xl md:text-5xl font-black select-none"
              style={{ color: COLOR_META[card.color].css }}>
              {COLOR_META[card.word].label.toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <button onClick={finishRound}
        className={`${btn} w-full bg-[var(--accent)] text-white text-lg mb-6 shadow-[0_2px_0_#b83208]`}>
        Finish Round →
      </button>

      <Scoreboard players={players} scores={scores} />

      <button onClick={endGame} className="block mx-auto mt-6 text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)]">
        End Game
      </button>
    </main>
  )

  /* ── RESULTS ────────────────────────────────────────────────── */
  if (phase === 'results') return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Results</p>
      <h1 className="text-2xl font-black mb-5">Round {round} · Level {level}</h1>

      {/* Sequence display */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-4 text-center">The sequence</p>
        <div className="flex flex-wrap gap-x-4 gap-y-3 justify-center mb-4">
          {sequence.map((card, i) => (
            <span key={i} className="text-2xl md:text-3xl font-black" style={{ color: COLOR_META[card.color].css }}>
              {COLOR_META[card.word].label.toUpperCase()}
            </span>
          ))}
        </div>

        {showAnswers && (
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2 text-center">Correct answers</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {sequence.map((card, i) => (
                <span key={i} className="px-3 py-1 rounded-lg text-sm font-bold border-2"
                  style={{ borderColor: COLOR_META[card.color].css, color: COLOR_META[card.color].css }}>
                  {COLOR_META[card.color].label}
                </span>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => setShowAnswers(v => !v)}
          className="mt-4 text-xs font-bold text-[var(--muted)] hover:text-[var(--accent)] block mx-auto transition-colors">
          {showAnswers ? 'Hide' : 'Show'} Correct Answers
        </button>
      </div>

      {/* Per-player Got It / Missed */}
      <div className="space-y-3 mb-5">
        {players.map((name, i) => (
          <div key={i} className={`flex items-center justify-between bg-white border-2 rounded-xl px-4 py-3 transition-colors ${
            playerResults[i] === true ? 'border-green-400 bg-green-50' :
            playerResults[i] === false ? 'border-red-300 bg-red-50' : 'border-[var(--border)]'
          }`}>
            <span className="font-bold truncate mr-3">{name}</span>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setResult(i, true)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  playerResults[i] === true ? 'bg-[#16a34a] text-white' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                }`}>
                ✅ Got It
              </button>
              <button onClick={() => setResult(i, false)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  playerResults[i] === false ? 'bg-[#dc2626] text-white' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                }`}>
                ❌ Missed
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={nextRound} disabled={!allResultsIn}
        className={`${btn} w-full bg-[var(--accent)] text-white mb-2 shadow-[0_2px_0_#b83208] disabled:opacity-40`}>
        Next Round →
      </button>
      {!allResultsIn && (
        <p className="text-xs text-center text-[var(--muted)] font-semibold mb-4">
          Mark every player before continuing.
        </p>
      )}

      <button onClick={endGame} className="block mx-auto mt-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)]">
        End Game
      </button>

      <div className="mt-6">
        <Scoreboard players={players} scores={scores} />
      </div>
    </main>
  )

  /* ── GAME OVER ──────────────────────────────────────────────── */
  if (phase === 'gameover') {
    const sorted = players.map((name, i) => ({ name, score: scores[i] })).sort((a, b) => b.score - a.score)
    const maxScore = sorted[0]?.score ?? 0
    const winners = sorted.filter(p => p.score === maxScore)
    return (
      <main className="max-w-2xl mx-auto px-4 py-8 md:py-12 text-center">
        <p className="text-sm font-bold text-[var(--accent)] mb-4">🌈 Kids n Play · Say the Color</p>
        <div className="text-5xl mb-4">🏆</div>
        {winners.length === 1
          ? <h2 className="text-3xl font-black mb-2">{winners[0].name} wins!</h2>
          : <h2 className="text-3xl font-black mb-2">It&apos;s a tie — {winners.map(w => w.name).join(' & ')}!</h2>}
        <p className="text-[var(--muted)] mb-8">{round - 1} rounds · Level {level} reached</p>

        <ul className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] mb-8 text-left">
          {sorted.map((p, i) => (
            <li key={p.name} className="flex items-center justify-between px-5 py-4">
              <span className="font-bold">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}</span>
              <span className="text-xl font-black">{p.score} pt{p.score !== 1 ? 's' : ''}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => startGame(players)} className={`${btn} bg-[var(--accent)] text-white`}>Play Again</button>
          <button onClick={() => { savedRef.current = false; setPhase('setup'); setPendingPlayers([]) }}
            className={`${btn} border border-[var(--border)]`}>Change Players</button>
        </div>
      </main>
    )
  }

  return null
}
