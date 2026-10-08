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
type Phase = 'setup' | 'between' | 'playing' | 'result' | 'gameover'

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
    <div className="mt-8 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Scores</h3>
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
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [roundResults, setRoundResults] = useState<(boolean | null)[]>([])
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
    setCurrentPlayerIndex(0)
    setRoundResults(new Array(playerNames.length).fill(null))
    setShowAnswers(false)
    setLevelUpMsg('')
    setPhase(playerNames.length === 1 ? 'playing' : 'between')
  }

  function advance(got: boolean) {
    const newScores = scores.map((s, i) => i === currentPlayerIndex && got ? s + 1 : s)
    setScores(newScores)

    const newRoundResults = roundResults.map((r, i) => i === currentPlayerIndex ? got : r)
    const isLastPlayer = currentPlayerIndex === players.length - 1

    if (isLastPlayer) {
      const anyGot = newRoundResults.some(r => r === true)
      const newLevel = anyGot ? level + 1 : level
      setLevel(newLevel)
      setRound(r => r + 1)
      setSequence(generateSequence(wordCount(newLevel)))
      setRoundResults(new Array(players.length).fill(null))
      setCurrentPlayerIndex(0)
      setLevelUpMsg(anyGot ? pick(LEVEL_UPS) : '')
      setShowAnswers(false)
      setPhase(players.length === 1 ? 'playing' : 'between')
    } else {
      setRoundResults(newRoundResults)
      setCurrentPlayerIndex(currentPlayerIndex + 1)
      setShowAnswers(false)
      setPhase('between')
    }
  }

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

  /* ── BETWEEN ────────────────────────────────────────────────── */
  if (phase === 'between') return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-12 text-center">
      {levelUpMsg && (
        <div className="mb-6 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl font-black text-yellow-700 text-lg">
          🎉 Level {level}! {levelUpMsg}
        </div>
      )}
      <p className="text-sm font-bold text-[var(--accent)] mb-6">Round {round} · Level {level} · {sequence.length} words</p>
      <div className="text-6xl mb-4">🌈</div>
      <h2 className="text-3xl font-black mb-3">Pass to {players[currentPlayerIndex]}</h2>
      <p className="text-[var(--muted)] mb-10 text-lg">
        Hand the device to <span className="font-bold text-[var(--text)]">{players[currentPlayerIndex]}</span>.
        Say the FONT COLOR of each word — not the word itself!
      </p>
      <button onClick={() => { setShowAnswers(false); setPhase('playing') }}
        className={`${btn} bg-[var(--accent)] text-white text-lg`}>
        I&apos;m ready →
      </button>

      {roundResults.some(r => r !== null) && (
        <div className="mt-10 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden text-left">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">This round so far</p>
          </div>
          <ul>
            {players.map((name, i) => roundResults[i] !== null && (
              <li key={i} className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] last:border-0">
                <span className="font-bold">{name}</span>
                <span className={`text-sm font-bold ${roundResults[i] ? 'text-green-600' : 'text-red-500'}`}>
                  {roundResults[i] ? '✅ Got It' : '❌ Missed'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Scoreboard players={players} scores={scores} />
    </main>
  )

  /* ── PLAYING ────────────────────────────────────────────────── */
  if (phase === 'playing') return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-10">
      <p className="text-sm font-bold text-[var(--accent)] mb-2">Round {round} · Level {level} · {players[currentPlayerIndex]}</p>
      <p className="text-[var(--muted)] mb-6 font-medium text-lg">Say the FONT COLOR in order!</p>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-8">
        <div className="flex flex-wrap gap-x-6 gap-y-4 justify-center">
          {sequence.map((card, i) => (
            <span key={i} className="text-4xl md:text-5xl font-black select-none"
              style={{ color: COLOR_META[card.color].css }}>
              {COLOR_META[card.word].label.toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <button onClick={() => setPhase('result')}
        className={`${btn} w-full bg-[var(--accent)] text-white text-lg shadow-[0_2px_0_#b83208]`}>
        Finish →
      </button>

      {players.length > 1 && <Scoreboard players={players} scores={scores} />}

      <button onClick={() => setPhase('gameover')}
        className="block mx-auto mt-6 text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)]">
        End Game
      </button>
    </main>
  )

  /* ── RESULT ─────────────────────────────────────────────────── */
  if (phase === 'result') return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-10">
      <p className="text-sm font-bold text-[var(--accent)] mb-2">Round {round} · Level {level} · {players[currentPlayerIndex]}</p>
      <h2 className="text-2xl font-black mb-6">Did {players[currentPlayerIndex]} get it?</h2>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-6">
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

      <div className="flex gap-3">
        <button onClick={() => advance(true)}
          className="flex-1 py-4 bg-[#16a34a] text-white rounded-xl font-bold text-lg hover:brightness-110 transition-all shadow-[0_2px_0_#166534]">
          ✅ Got It (+1)
        </button>
        <button onClick={() => advance(false)}
          className="flex-1 py-4 bg-[#dc2626] text-white rounded-xl font-bold text-lg hover:brightness-110 transition-all shadow-[0_2px_0_#991b1b]">
          ❌ Missed
        </button>
      </div>

      {players.length > 1 && <Scoreboard players={players} scores={scores} />}
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
