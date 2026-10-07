'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

function hsbToRgb(h: number, s: number, v: number): [number, number, number] {
  s /= 100; v /= 100
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5), f(3), f(1)]
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const rl = lin(r), gl = lin(g), bl = lin(b)
  const X = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  const Y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750
  const Z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041
  const f = (t: number) => t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116
  const fX = f(X / 0.95047), fY = f(Y), fZ = f(Z / 1.08883)
  return [116 * fY - 16, 500 * (fX - fY), 200 * (fY - fZ)]
}

function colorDistance(h1: number, s1: number, v1: number, h2: number, s2: number, v2: number): number {
  const [r1, g1, b1] = hsbToRgb(h1, s1, v1)
  const [r2, g2, b2] = hsbToRgb(h2, s2, v2)
  const [L1, a1, lb1] = rgbToLab(r1, g1, b1)
  const [L2, a2, lb2] = rgbToLab(r2, g2, b2)
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (lb1 - lb2) ** 2)
}

function toScore(de: number): number {
  return Math.max(0, Math.round(100 - de * 2))
}

function hsbToCss(h: number, s: number, v: number): string {
  const [r, g, b] = hsbToRgb(h, s, v)
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
}

function randomTarget() {
  return {
    h: Math.floor(Math.random() * 360),
    s: 35 + Math.floor(Math.random() * 55),
    v: 35 + Math.floor(Math.random() * 55),
  }
}

type Phase = 'setup' | 'between' | 'memorize' | 'recreate' | 'result' | 'gameover'
type Difficulty = 'easy' | 'medium' | 'hard'

const MEMORIZE_SECS: Record<Difficulty, number> = { easy: 5, medium: 3, hard: 2 }
const ROUNDS_OPTIONS = [3, 5, 10]
const DEFAULT_GUESS = { h: 180, s: 50, v: 50 }

function LiveScores({ players, scores, currentPlayer }: { players: string[]; scores: number[]; currentPlayer: number }) {
  if (players.length < 2) return null
  return (
    <div className="mt-8 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Scores</h3>
      </div>
      <ul>
        {players.map((name, i) => (
          <li key={i} className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] last:border-0 ${i === currentPlayer ? 'bg-[var(--surface2)]' : ''}`}>
            <span className="font-bold flex items-center gap-2">
              {i === currentPlayer && <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block flex-shrink-0" />}
              {name}
            </span>
            <span className="text-xl font-black">{scores[i]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ScoreBar({ value }: { value: number }) {
  const color = value >= 80 ? 'var(--accent)' : value >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="w-full bg-[var(--border)] rounded-full h-2 mt-2">
      <div className="h-2 rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

function ColorSwatch({ h, s, v, label, size = 120 }: { h: number; s: number; v: number; label: string; size?: number }) {
  return (
    <div className="text-center">
      <div className="rounded-2xl border border-[var(--border)] mx-auto mb-2"
        style={{ background: hsbToCss(h, s, v), height: size, width: '100%' }} />
      <p className="text-sm font-bold">{label}</p>
    </div>
  )
}

export default function HuePerfectBoard() {
  const [inputName, setInputName] = useState('')
  const [pendingPlayers, setPendingPlayers] = useState<string[]>([])
  const [addError, setAddError] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [totalRounds, setTotalRounds] = useState(5)

  const [phase, setPhase] = useState<Phase>('setup')
  const [players, setPlayers] = useState<string[]>([])
  const [scores, setScores] = useState<number[]>([])
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [currentRound, setCurrentRound] = useState(1)
  const [target, setTarget] = useState({ h: 0, s: 50, v: 50 })
  const [guess, setGuess] = useState(DEFAULT_GUESS)
  const [countdown, setCountdown] = useState(5)
  const [lastRoundScore, setLastRoundScore] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  function clearTimer() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  function startCountdown(secs: number, onDone: () => void) {
    clearTimer()
    setCountdown(secs)
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearTimer(); onDone(); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function goToMemorize(t: typeof target, diff: Difficulty) {
    setTarget(t)
    setGuess(DEFAULT_GUESS)
    setPhase('memorize')
    startCountdown(MEMORIZE_SECS[diff], () => setPhase('recreate'))
  }

  function startGame(playerNames: string[]) {
    const t = randomTarget()
    setPlayers(playerNames)
    setScores(new Array(playerNames.length).fill(0))
    setCurrentPlayer(0)
    setCurrentRound(1)
    if (playerNames.length === 1) {
      goToMemorize(t, difficulty)
    } else {
      setTarget(t)
      setGuess(DEFAULT_GUESS)
      setPhase('between')
    }
  }

  function submitGuess() {
    const de = colorDistance(target.h, target.s, target.v, guess.h, guess.s, guess.v)
    const roundScore = toScore(de)
    setLastRoundScore(roundScore)
    setScores(prev => prev.map((s, i) => i === currentPlayer ? s + roundScore : s))
    setPhase('result')
  }

  function advance() {
    const isLastPlayer = currentPlayer === players.length - 1
    const isLastRound = currentRound === totalRounds
    if (isLastPlayer && isLastRound) { setPhase('gameover'); return }
    const nextPlayer = isLastPlayer ? 0 : currentPlayer + 1
    const nextRound = isLastPlayer ? currentRound + 1 : currentRound
    const t = randomTarget()
    setCurrentPlayer(nextPlayer)
    setCurrentRound(nextRound)
    if (players.length === 1) {
      goToMemorize(t, difficulty)
    } else {
      setTarget(t)
      setGuess(DEFAULT_GUESS)
      setPhase('between')
    }
  }

  function playAgain() {
    const t = randomTarget()
    setScores(new Array(players.length).fill(0))
    setCurrentPlayer(0)
    setCurrentRound(1)
    if (players.length === 1) {
      goToMemorize(t, difficulty)
    } else {
      setTarget(t)
      setGuess(DEFAULT_GUESS)
      setPhase('between')
    }
  }

  const btn = 'px-5 py-3 rounded-xl font-bold transition-colors'
  const hueGradient = 'linear-gradient(to right,hsl(0,100%,50%),hsl(30,100%,50%),hsl(60,100%,50%),hsl(90,100%,50%),hsl(120,100%,50%),hsl(150,100%,50%),hsl(180,100%,50%),hsl(210,100%,50%),hsl(240,100%,50%),hsl(270,100%,50%),hsl(300,100%,50%),hsl(330,100%,50%),hsl(360,100%,50%))'

  function handleAdd() {
    const name = inputName.trim()
    if (!name || pendingPlayers.length >= 8) return
    if (pendingPlayers.some(p => p.toLowerCase() === name.toLowerCase())) {
      setAddError(`"${name}" is already added — use a different name.`); return
    }
    setAddError('')
    setPendingPlayers([...pendingPlayers, name])
    setInputName('')
  }

  if (phase === 'setup') return (
    <main className="max-w-2xl mx-auto p-6 md:p-10">
      {/* Header — matches lobby style */}
      <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-6 pb-4 border-b-2 border-[var(--ink)]">
        <a href="/" className="text-3xl font-extrabold tracking-tight leading-none">
          ZU<span className="text-[var(--accent)]">N</span>O
        </a>
        <span className="text-[var(--muted)] font-semibold text-sm break-words">| Hue Perfect</span>
      </div>

      {/* Kids n Play banner */}
      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Kids n Play</p>
          <p className="text-sm font-semibold mt-1">Add every player below on this device — no code needed.</p>
        </div>
        <span className="text-4xl">🎨</span>
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

        {/* Players + config + start */}
        <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-5">
          <h2 className="text-lg font-extrabold mb-4">
            Players{' '}
            <span className="text-[var(--muted)] font-semibold text-base">({pendingPlayers.length})</span>
          </h2>
          {pendingPlayers.length === 0 ? (
            <p className="text-sm text-[var(--muted)] font-semibold mb-4">No players yet…</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {pendingPlayers.map((name, i) => (
                <li key={i} className="flex items-center justify-between gap-2 font-bold bg-white border-2 border-[var(--border)] rounded-lg px-3 py-2">
                  <span className="flex items-center gap-2 truncate"><span>👤</span> {name}</span>
                  <button type="button" aria-label={`Remove ${name}`}
                    onClick={() => setPendingPlayers(pendingPlayers.filter((_, j) => j !== i))}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-red-100 hover:text-red-600 transition-colors text-lg leading-none">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Rounds */}
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Rounds</p>
          <div className="flex gap-2 mb-4">
            {ROUNDS_OPTIONS.map(r => (
              <button key={r} type="button" onClick={() => setTotalRounds(r)}
                className={`px-4 py-2 rounded-lg font-bold border text-sm ${totalRounds === r ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white border-[var(--border)]'}`}>
                {r}
              </button>
            ))}
          </div>

          {/* Memorise time */}
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Memorise time</p>
          <div className="flex gap-2 flex-wrap mb-5">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button key={d} type="button" onClick={() => setDifficulty(d)}
                className={`px-3 py-2 rounded-lg font-bold border text-sm ${difficulty === d ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white border-[var(--border)]'}`}>
                {d.charAt(0).toUpperCase() + d.slice(1)} ({MEMORIZE_SECS[d]}s)
              </button>
            ))}
          </div>

          <button
            onClick={() => pendingPlayers.length > 0 && startGame(pendingPlayers)}
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

  if (phase === 'between') return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-12 text-center">
      <p className="text-sm font-bold text-[var(--accent)] mb-6">Round {currentRound} of {totalRounds}</p>
      <div className="text-6xl mb-4">🎨</div>
      <h2 className="text-3xl font-black mb-3">Pass to {players[currentPlayer]}</h2>
      <p className="text-[var(--muted)] mb-10 text-lg">
        Hand the device to <span className="font-bold text-[var(--fg)]">{players[currentPlayer]}</span>.
        When ready, tap below — you&apos;ll have {MEMORIZE_SECS[difficulty]} seconds to memorise the colour.
      </p>
      <button onClick={() => goToMemorize(target, difficulty)} className={`${btn} bg-[var(--accent)] text-white text-lg`}>
        I&apos;m ready →
      </button>
      <LiveScores players={players} scores={scores} currentPlayer={currentPlayer} />
    </main>
  )

  if (phase === 'memorize') return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-12 text-center">
      <p className="text-sm font-bold text-[var(--accent)] mb-2">Round {currentRound} of {totalRounds} · {players[currentPlayer]}</p>
      <p className="text-[var(--muted)] mb-6 font-medium text-lg">Memorise this colour!</p>
      <div className="rounded-3xl mx-auto mb-8 border border-[var(--border)]"
        style={{ background: hsbToCss(target.h, target.s, target.v), width: 240, height: 240 }} />
      <div className="text-7xl font-black tabular-nums text-[var(--accent)]">{countdown}</div>
      <p className="text-sm text-[var(--muted)] mt-2">seconds left</p>
    </main>
  )

  if (phase === 'recreate') return (
    <main className="max-w-2xl mx-auto px-4 py-8 md:py-12">
      <p className="text-sm font-bold text-[var(--accent)] mb-2">Round {currentRound} of {totalRounds} · {players[currentPlayer]}</p>
      <h2 className="text-2xl font-black mb-1">Recreate the colour</h2>
      <p className="text-[var(--muted)] mb-5">Use the sliders to match what you saw.</p>

      <div className="rounded-3xl mb-6 border border-[var(--border)]"
        style={{ background: hsbToCss(guess.h, guess.s, guess.v), height: 160 }} />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-6 mb-6">
        {/* Hue */}
        <div>
          <div className="flex justify-between text-sm font-bold mb-3">
            <span>Hue</span><span>{guess.h}°</span>
          </div>
          <div className="relative h-4 rounded-full" style={{ background: hueGradient }}>
            <input type="range" min={0} max={360} value={guess.h}
              onChange={e => setGuess(g => ({ ...g, h: Number(e.target.value) }))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
            <div className="absolute top-1/2 w-6 h-6 rounded-full border-4 border-white shadow-lg pointer-events-none"
              style={{ left: `${(guess.h / 360) * 100}%`, transform: 'translate(-50%,-50%)', background: hsbToCss(guess.h, 100, 100) }} />
          </div>
        </div>

        {/* Saturation */}
        <div>
          <div className="flex justify-between text-sm font-bold mb-3">
            <span>Saturation</span><span>{guess.s}%</span>
          </div>
          <div className="relative h-4 rounded-full"
            style={{ background: `linear-gradient(to right,${hsbToCss(guess.h, 0, guess.v)},${hsbToCss(guess.h, 100, guess.v)})` }}>
            <input type="range" min={0} max={100} value={guess.s}
              onChange={e => setGuess(g => ({ ...g, s: Number(e.target.value) }))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
            <div className="absolute top-1/2 w-6 h-6 rounded-full border-4 border-white shadow-lg pointer-events-none"
              style={{ left: `${guess.s}%`, transform: 'translate(-50%,-50%)', background: hsbToCss(guess.h, guess.s, guess.v) }} />
          </div>
        </div>

        {/* Brightness */}
        <div>
          <div className="flex justify-between text-sm font-bold mb-3">
            <span>Brightness</span><span>{guess.v}%</span>
          </div>
          <div className="relative h-4 rounded-full"
            style={{ background: `linear-gradient(to right,${hsbToCss(guess.h, guess.s, 0)},${hsbToCss(guess.h, guess.s, 100)})` }}>
            <input type="range" min={0} max={100} value={guess.v}
              onChange={e => setGuess(g => ({ ...g, v: Number(e.target.value) }))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
            <div className="absolute top-1/2 w-6 h-6 rounded-full border-4 border-white shadow-lg pointer-events-none"
              style={{ left: `${guess.v}%`, transform: 'translate(-50%,-50%)', background: hsbToCss(guess.h, guess.s, guess.v) }} />
          </div>
        </div>
      </div>

      <button onClick={submitGuess} className={`${btn} bg-[var(--accent)] text-white w-full sm:w-auto`}>
        Submit guess →
      </button>
      <LiveScores players={players} scores={scores} currentPlayer={currentPlayer} />
    </main>
  )

  if (phase === 'result') {
    const grade = lastRoundScore >= 90 ? '🎯 Perfect!' : lastRoundScore >= 70 ? '✨ Great!' : lastRoundScore >= 50 ? '👍 Good' : lastRoundScore >= 30 ? '😅 Getting there' : '🙈 Keep practising'
    const isLastTurn = currentPlayer === players.length - 1 && currentRound === totalRounds
    return (
      <main className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <p className="text-sm font-bold text-[var(--accent)] mb-4">Round {currentRound} · {players[currentPlayer]}</p>
        <h2 className="text-2xl font-black mb-6">{grade}</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <ColorSwatch h={target.h} s={target.s} v={target.v} label="Target" />
          <ColorSwatch h={guess.h} s={guess.s} v={guess.v} label="Your guess" />
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-bold">Score this round</span>
            <span className="text-3xl font-black text-[var(--accent)]">{lastRoundScore}</span>
          </div>
          <ScoreBar value={lastRoundScore} />
        </div>

        <button onClick={advance} className={`${btn} bg-[var(--accent)] text-white`}>
          {isLastTurn ? 'See final scores' : 'Next →'}
        </button>
        <LiveScores players={players} scores={scores} currentPlayer={currentPlayer} />
      </main>
    )
  }

  if (phase === 'gameover') {
    const sorted = [...players.map((name, i) => ({ name, score: scores[i] }))]
      .sort((a, b) => b.score - a.score)
    return (
      <main className="max-w-2xl mx-auto px-4 py-8 md:py-12 text-center">
        <p className="text-sm font-bold text-[var(--accent)] mb-4">🪁 Kids n Play · Hue Perfect</p>
        <div className="text-5xl mb-4">🏆</div>
        {players.length > 1 ? (
          <>
            <h2 className="text-3xl font-black mb-1">{sorted[0].name} wins!</h2>
            <p className="text-[var(--muted)] mb-8">With {sorted[0].score} points over {totalRounds} rounds</p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-black mb-2">Game over!</h2>
            <p className="text-[var(--muted)] mb-2">{totalRounds} rounds · Your score</p>
            <p className="text-6xl font-black text-[var(--accent)] mb-8">{scores[0]}</p>
            <p className="text-sm text-[var(--muted)] mb-8">Max possible: {totalRounds * 100}</p>
          </>
        )}

        {players.length > 1 && (
          <ul className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] mb-8 text-left">
            {sorted.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between px-5 py-4">
                <span className="font-bold">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}</span>
                <span className="text-xl font-black">{p.score}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={playAgain} className={`${btn} bg-[var(--accent)] text-white`}>Play again</button>
          <button onClick={() => { clearTimer(); setPhase('setup'); setPendingPlayers([]); setInputName('') }}
            className={`${btn} border border-[var(--border)]`}>Change settings</button>
        </div>
      </main>
    )
  }

  return null
}
