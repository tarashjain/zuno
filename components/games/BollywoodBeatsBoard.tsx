'use client'
import { useState, useEffect, useRef } from 'react'
import { getAllBollywoodSongs } from '@/app/actions/bollywood-beats'
import { getSpinRotation, SPIN_DURATION_MS } from '@/lib/bollywood-beats'

type Song = { id: number; title: string; movie: string; era: string }
type Player = { id: number; guestName: string }
type Phase = 'setup' | 'spin' | 'reveal' | 'revealed' | 'acting' | 'result' | 'gameover'
type Team = 'A' | 'B'

const ERA_ORDER = ['1950s-80s', '1990s', '2000s', '2010s'] as const
const ERA_META: Record<string, { label: string; color: string; light: string }> = {
  '1950s-80s': { label: '1950s–80s', color: '#a77935', light: '#e8c77e' },
  '1990s':     { label: '1990s',     color: '#87485a', light: '#d99aaa' },
  '2000s':     { label: '2000–2009', color: '#356776', light: '#8bb8c0' },
  '2010s':     { label: '2010–Now',  color: '#3d735b', light: '#91bca0' },
}
const WHEEL_SECTORS = [
  { color: '#a77935', deep: '#795326', era: '1950s-80s', label: '50s–80s' },
  { color: '#87485a', deep: '#653444', era: '1990s',     label: '1990s' },
  { color: '#356776', deep: '#294e5a', era: '2000s',     label: '2000s' },
  { color: '#3d735b', deep: '#2c5946', era: '2010s',     label: '2010+' },
  { color: '#98703a', deep: '#704d2b', era: '1950s-80s', label: '50s–80s' },
  { color: '#794253', deep: '#59313f', era: '1990s',     label: '1990s' },
  { color: '#315f6d', deep: '#254752', era: '2000s',     label: '2000s' },
  { color: '#38694f', deep: '#294d3d', era: '2010s',     label: '2010+' },
]
const W_CX = 150, W_CY = 150, W_R = 140
const wRad = (d: number) => (d - 90) * Math.PI / 180
const sectorPath = (i: number) => {
  const s = i * 45, e = s + 45
  const x1 = W_CX + W_R * Math.cos(wRad(s)), y1 = W_CY + W_R * Math.sin(wRad(s))
  const x2 = W_CX + W_R * Math.cos(wRad(e)), y2 = W_CY + W_R * Math.sin(wRad(e))
  return `M${W_CX},${W_CY} L${x1.toFixed(2)},${y1.toFixed(2)} A${W_R},${W_R},0,0,1,${x2.toFixed(2)},${y2.toFixed(2)}Z`
}
const labelAt = (i: number) => {
  const mid = i * 45 + 22.5
  const r = 95
  return { x: W_CX + r * Math.cos(wRad(mid)), y: W_CY + r * Math.sin(wRad(mid)), rot: mid }
}
const TIMER_SECS = 60

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function BollywoodBeatsBoard({ players: roomPlayers = [] }: { players?: Player[] }) {
  // Setup
  const [teamAName, setTeamAName] = useState('Team A')
  const [teamBName, setTeamBName] = useState('Team B')
  const [assignments, setAssignments] = useState<Record<number, Team | null>>(() =>
    Object.fromEntries(roomPlayers.map(p => [p.id, null]))
  )
  const [maxRounds, setMaxRounds] = useState('')

  // Game
  const [phase, setPhase] = useState<Phase>('setup')
  const [pool, setPool] = useState<Record<string, Song[]>>({})
  const [currentTeam, setCurrentTeam] = useState<Team>('A')
  const [actorIdxA, setActorIdxA] = useState(0)
  const [actorIdxB, setActorIdxB] = useState(0)
  const [teamACards, setTeamACards] = useState(0)
  const [teamBCards, setTeamBCards] = useState(0)
  const [roundsA, setRoundsA] = useState(0)
  const [roundsB, setRoundsB] = useState(0)
  const [selectedEra, setSelectedEra] = useState<string | null>(null)
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIMER_SECS)
  const [gotIt, setGotIt] = useState<boolean | null>(null)

  // Spinner
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const poolRef = useRef<Record<string, Song[]>>({})

  // Keep ref in sync so setTimeout callbacks see fresh pool
  useEffect(() => { poolRef.current = pool }, [pool])

  const teamAPlayers = roomPlayers.filter(p => assignments[p.id] === 'A').map(p => p.guestName)
  const teamBPlayers = roomPlayers.filter(p => assignments[p.id] === 'B').map(p => p.guestName)

  const actor = currentTeam === 'A'
    ? teamAPlayers[actorIdxA % Math.max(teamAPlayers.length, 1)]
    : teamBPlayers[actorIdxB % Math.max(teamBPlayers.length, 1)]
  const teamName = currentTeam === 'A' ? teamAName : teamBName

  async function startGame() {
    const all = await getAllBollywoodSongs()
    const grouped: Record<string, Song[]> = {}
    for (const era of ERA_ORDER) {
      grouped[era] = shuffle(all.filter(s => s.era === era))
    }
    setPool(grouped)
    poolRef.current = grouped
    setPhase('spin')
  }

  function spin() {
    if (spinning) return
    setSpinning(true)

    const eraIdx = Math.floor(Math.random() * 4)
    const era = ERA_ORDER[eraIdx]

    // Pick song now so we don't close over stale pool in setTimeout
    const currentPool = poolRef.current
    let song: Song | null = null
    if (currentPool[era]?.length > 0) {
      song = currentPool[era][0]
      const updatedPool = { ...currentPool, [era]: currentPool[era].slice(1) }
      setPool(updatedPool)
      poolRef.current = updatedPool
    }

    // Determine landing angle: pick one of 2 slots for this era
    const slot = Math.random() < 0.5 ? eraIdx : eraIdx + 4
    const jitter = (Math.random() - 0.5) * 20
    setRotation(getSpinRotation(rotation, slot, jitter))

    setTimeout(() => {
      setSpinning(false)
      setSelectedEra(era)

      if (!song) {
        // Era was empty — check if any left
        const anyLeft = ERA_ORDER.some(e => (poolRef.current[e]?.length ?? 0) > 0)
        if (!anyLeft) { setPhase('gameover'); return }
        // Re-spin for another era
        setPhase('spin')
        return
      }
      setCurrentSong(song)
      setPhase('reveal')
    }, SPIN_DURATION_MS)
  }

  useEffect(() => {
    if (phase !== 'acting') return
    setTimeLeft(TIMER_SECS)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); handleResult(false); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleResult(got: boolean) {
    clearInterval(timerRef.current!)
    setGotIt(got)
    if (got) currentTeam === 'A' ? setTeamACards(c => c + 1) : setTeamBCards(c => c + 1)
    if (currentTeam === 'A') { setActorIdxA(i => i + 1); setRoundsA(r => r + 1) }
    else { setActorIdxB(i => i + 1); setRoundsB(r => r + 1) }
    setPhase('result')
  }

  function continueGame() {
    const maxR = parseInt(maxRounds) || 0
    const newRoundsA = currentTeam === 'A' ? roundsA + 1 : roundsA
    const newRoundsB = currentTeam === 'B' ? roundsB + 1 : roundsB
    const anyLeft = ERA_ORDER.some(e => (poolRef.current[e]?.length ?? 0) > 0)
    const maxReached = maxR > 0 && newRoundsA >= maxR && newRoundsB >= maxR
    if (!anyLeft || maxReached) { setPhase('gameover'); return }
    setCurrentTeam(t => t === 'A' ? 'B' : 'A')
    setSelectedEra(null); setCurrentSong(null); setGotIt(null)
    setPhase('spin')
  }

  // ─── SETUP ────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    const canStart = teamAPlayers.length > 0 && teamBPlayers.length > 0

    const toggle = (id: number) =>
      setAssignments(prev => ({ ...prev, [id]: prev[id] === 'A' ? 'B' : prev[id] === 'B' ? null : 'A' }))

    const randomize = () => {
      const ids = roomPlayers.map(p => p.id).sort(() => Math.random() - 0.5)
      const next: Record<number, Team | null> = {}
      ids.forEach((id, i) => { next[id] = i < Math.ceil(ids.length / 2) ? 'A' : 'B' })
      setAssignments(next)
    }

    return (
      <div className="max-w-lg mx-auto">
        <h2 className="text-3xl font-black mb-1">🎬 Bollywood Beats</h2>
        <p className="text-[var(--muted)] text-sm mb-6">Assign players to teams, then start.</p>

        {/* Team name inputs */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {(['A', 'B'] as Team[]).map(t => (
            <div key={t} className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-[var(--border)]"
              style={{ borderColor: t === 'A' ? '#3b82f6' : '#ec4899' }}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t === 'A' ? '#3b82f6' : '#ec4899' }} />
              <input
                value={t === 'A' ? teamAName : teamBName}
                onChange={e => t === 'A' ? setTeamAName(e.target.value) : setTeamBName(e.target.value)}
                className="font-black bg-transparent outline-none w-full text-sm"
              />
            </div>
          ))}
        </div>

        {/* Player cards */}
        {roomPlayers.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] text-sm font-semibold border-2 border-dashed border-[var(--border)] rounded-2xl mb-5">
            No players in the room yet. Add players from the lobby.
          </div>
        ) : (
          <div className="space-y-2 mb-5">
            {roomPlayers.map(p => {
              const team = assignments[p.id]
              const color = team === 'A' ? '#3b82f6' : team === 'B' ? '#ec4899' : undefined
              const label = team === 'A' ? teamAName : team === 'B' ? teamBName : 'Unassigned'
              return (
                <button key={p.id} onClick={() => toggle(p.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm"
                  style={{ borderColor: color ?? 'var(--border)', background: color ? `${color}18` : 'var(--surface)' }}>
                  <span className="font-bold">{p.guestName}</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full text-white"
                    style={{ background: color ?? 'var(--muted)' }}>{label}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex gap-3 mb-5">
          <button onClick={randomize}
            className="flex-1 py-2 border-2 border-[var(--border)] rounded-xl text-sm font-bold hover:border-[var(--accent)] transition-all">
            🎲 Randomize Teams
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <label className="text-sm font-bold text-[var(--muted)] whitespace-nowrap">Rounds per team</label>
          <input
            type="text" inputMode="numeric" value={maxRounds}
            onChange={e => { if (/^\d*$/.test(e.target.value)) setMaxRounds(e.target.value) }}
            placeholder="∞ (play all cards)"
            className="flex-1 border-2 border-[var(--border)] rounded-xl px-3 py-2 text-sm font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <button onClick={startGame} disabled={!canStart}
          className="w-full py-4 bg-[var(--accent)] text-white font-black text-lg rounded-2xl hover:brightness-110 disabled:opacity-40 transition-all shadow-[0_3px_0_#b83208]">
          Start Game →
        </button>
        {!canStart && roomPlayers.length > 0 && (
          <p className="text-center text-xs text-[var(--muted)] mt-2">Assign at least one player to each team to start.</p>
        )}
      </div>
    )
  }

  // ─── SPIN ─────────────────────────────────────────────────────────────────
  if (phase === 'spin') {
    return (
      <div className="flex flex-col items-center gap-5">
        {/* Scoreboard */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-0.5">{teamName}'s turn</p>
          <h2 className="text-2xl font-black">{actor} is acting</h2>
          <div className="flex gap-6 mt-2 justify-center">
            <span className="text-sm font-bold">🃏 {teamAName}: <span className="text-[var(--accent)]">{teamACards}</span></span>
            <span className="text-sm font-bold">🃏 {teamBName}: <span className="text-[var(--accent)]">{teamBCards}</span></span>
          </div>
        </div>

        {/* Spinner */}
        <div className="relative" style={{ width: 300, height: 300 }}>
          {/* Pointer needle */}
          <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: -8 }}>
            <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
              <defs>
                <linearGradient id="wheel-pointer-gold" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#f4dfa5" />
                  <stop offset="0.5" stopColor="#bd914c" />
                  <stop offset="1" stopColor="#775224" />
                </linearGradient>
              </defs>
              <path d="M17 43 1 5a2 2 0 0 1 2-3h28a2 2 0 0 1 2 3L17 43Z" fill="#513b22" />
              <path d="M17 38 4 6h26L17 38Z" fill="url(#wheel-pointer-gold)" stroke="#f4dfa5" strokeWidth="1" />
              <path d="M17 34 8 8h9v26Z" fill="rgba(255,255,255,0.2)" />
              <circle cx="17" cy="5" r="3" fill="#fff3cd" stroke="#8a6935" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Decorative wheel rim */}
          <div className="absolute inset-0 rounded-full"
            style={{
              boxShadow: spinning
                ? '0 0 42px rgba(67,49,26,0.24), 0 0 14px rgba(225,193,127,0.28)'
                : '0 9px 24px rgba(49,37,23,0.2)',
              border: '5px solid #72552d',
              outline: '1px solid rgba(241,218,165,0.85)',
              outlineOffset: '-3px',
              transition: 'box-shadow 700ms ease, border-color 700ms ease',
            }} />

          {/* SVG wheel */}
          <svg
            width="300" height="300" viewBox="0 0 300 300"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.72, 0.12, 1), filter 700ms ease`
                : 'filter 700ms ease',
              filter: spinning
                ? 'drop-shadow(0 8px 22px rgba(0,0,0,0.28))'
                : 'drop-shadow(0 5px 14px rgba(0,0,0,0.2))',
            }}
          >
            <defs>
              {WHEEL_SECTORS.map((sector, i) => (
                <linearGradient key={i} id={`wheel-sector-${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={sector.color} />
                  <stop offset="1" stopColor={sector.deep} />
                </linearGradient>
              ))}
              <radialGradient id="wheel-hub" cx="35%" cy="28%">
                <stop offset="0" stopColor="#6d5535" />
                <stop offset="1" stopColor="#29241e" />
              </radialGradient>
            </defs>
            <circle cx={W_CX} cy={W_CY} r={W_R + 5} fill="#362b20" stroke="#d7b66f" strokeWidth="2" />
            <circle cx={W_CX} cy={W_CY} r={W_R + 1} fill="none" stroke="#f2dfa9" strokeWidth="1" opacity="0.8" />

            {/* Sectors */}
            {WHEEL_SECTORS.map((s, i) => {
              const lp = labelAt(i)
              const isLanded = !spinning && selectedEra === s.era
              return (
                <g key={i}>
                  <path d={sectorPath(i)} fill={`url(#wheel-sector-${i})`}
                    stroke={isLanded ? '#fff0bd' : 'rgba(246,224,177,0.42)'} strokeWidth={isLanded ? 2.5 : 1} />
                  <text
                    x={lp.x} y={lp.y}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#fff8e9" fontSize="11.5" fontWeight="700"
                    transform={`rotate(${lp.rot}, ${lp.x}, ${lp.y})`}
                    style={{ userSelect: 'none', fontFamily: 'Georgia, serif', textShadow: '0 1px 3px rgba(25,17,10,0.7)', letterSpacing: '0.45px' }}
                  >
                    {s.label}
                  </text>
                </g>
              )
            })}

            {/* Spoke lines */}
            {[0,1,2,3,4,5,6,7].map(i => {
              const a = wRad(i * 45)
              return (
                <line key={i}
                  x1={W_CX} y1={W_CY}
                  x2={+(W_CX + W_R * Math.cos(a)).toFixed(2)}
                  y2={+(W_CY + W_R * Math.sin(a)).toFixed(2)}
                  stroke="rgba(246,224,177,0.46)" strokeWidth="1"
                />
              )
            })}

            <circle cx={W_CX} cy={W_CY} r={W_R - 2} fill="none" stroke="rgba(255,244,218,0.3)" strokeWidth="1" />

            {/* Center medallion */}
            <circle cx={W_CX} cy={W_CY} r={31} fill="#382b1d" stroke="#d8b873" strokeWidth="2" />
            <circle cx={W_CX} cy={W_CY} r={26} fill="url(#wheel-hub)" stroke="#f0dda9" strokeWidth="1" />
            <circle cx={W_CX} cy={W_CY} r={21} fill="none" stroke="rgba(240,221,169,0.42)" strokeWidth="1" />
            <text x={W_CX} y={W_CY + 1} textAnchor="middle" dominantBaseline="middle"
              fill="#f3dfaa" fontSize="12" fontWeight="700" letterSpacing="2"
              style={{ userSelect: 'none', fontFamily: 'Georgia, serif' }}>
              BEATS
            </text>
          </svg>
        </div>

        {/* Selected era badge (shown after landing) */}
        {selectedEra && !spinning && (
          <div className="px-5 py-2 rounded-full text-white font-black text-sm animate-bounce"
            style={{ background: ERA_META[selectedEra].color }}>
            {ERA_META[selectedEra].label} 🎬
          </div>
        )}

        <button
          onClick={spin} disabled={spinning}
          className="px-12 py-4 bg-[var(--accent)] text-white font-black text-xl rounded-2xl hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_4px_0_#b83208] active:translate-y-1 active:shadow-[0_2px_0_#b83208]"
        >
          {spinning ? '🌀 Spinning…' : '🎯 Spin!'}
        </button>
      </div>
    )
  }

  // ─── REVEAL (pass phone / tap to see) ────────────────────────────────────
  if (phase === 'reveal') {
    const meta = selectedEra ? ERA_META[selectedEra] : null
    return (
      <div className="flex flex-col items-center gap-6 text-center max-w-sm mx-auto">
        {meta && (
          <div className="px-4 py-1.5 rounded-full text-sm font-black text-white" style={{ background: meta.color }}>
            {meta.label}
          </div>
        )}
        <h2 className="text-2xl font-black">Pass to {actor}</h2>
        <p className="text-[var(--muted)]">Everyone else look away while {actor} reads their song.</p>
        <button
          onClick={() => setPhase('revealed')}
          className="px-10 py-4 bg-[var(--ink)] text-[var(--paper)] font-black text-xl rounded-2xl hover:brightness-125 transition-all"
        >
          👁 Reveal Card
        </button>
      </div>
    )
  }

  // ─── REVEALED (actor sees card) ──────────────────────────────────────────
  if (phase === 'revealed') {
    const meta = selectedEra ? ERA_META[selectedEra] : null
    return (
      <div className="flex flex-col items-center gap-6 text-center max-w-sm mx-auto">
        {meta && (
          <div className="px-4 py-1.5 rounded-full text-sm font-black text-white" style={{ background: meta.color }}>
            {meta.label}
          </div>
        )}
        <div className="w-full bg-[var(--surface)] border-4 rounded-3xl p-8" style={{ borderColor: meta?.color ?? 'var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Your song</p>
          <h2 className="text-3xl font-black leading-tight mb-2">{currentSong?.title}</h2>
          <p className="text-[var(--muted)] font-semibold">({currentSong?.movie})</p>
        </div>
        <p className="text-sm text-[var(--muted)]">Memorise it, then start when ready. No speaking or humming!</p>
        <button
          onClick={() => setPhase('acting')}
          className="px-10 py-4 bg-[var(--accent)] text-white font-black text-xl rounded-2xl hover:brightness-110 transition-all shadow-[0_3px_0_#b83208]"
        >
          ▶ Start Timer
        </button>
      </div>
    )
  }

  // ─── ACTING (60s countdown) ───────────────────────────────────────────────
  if (phase === 'acting') {
    const pct = timeLeft / TIMER_SECS
    const color = pct > 0.5 ? '#10b981' : pct > 0.25 ? '#f59e0b' : '#ef4444'
    return (
      <div className="flex flex-col items-center gap-8 text-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">{teamName} — {actor} is acting</p>
          <p className="text-sm font-semibold text-[var(--muted)]">🎬 {currentSong?.title}</p>
        </div>
        {/* Countdown ring */}
        <div className="relative w-44 h-44">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - pct)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-black" style={{ color }}>{timeLeft}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => handleResult(true)}
            className="px-8 py-4 bg-green-500 text-white font-black text-lg rounded-2xl hover:brightness-110 transition-all shadow-[0_3px_0_#15803d]"
          >
            ✅ Got It!
          </button>
          <button
            onClick={() => handleResult(false)}
            className="px-8 py-4 bg-red-500 text-white font-black text-lg rounded-2xl hover:brightness-110 transition-all shadow-[0_3px_0_#b91c1c]"
          >
            💀 Missed
          </button>
        </div>
      </div>
    )
  }

  // ─── RESULT ───────────────────────────────────────────────────────────────
  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-6 text-center max-w-sm mx-auto">
        <div className={`text-6xl ${gotIt ? 'animate-bounce' : ''}`}>{gotIt ? '🎉' : '😬'}</div>
        <h2 className="text-3xl font-black">{gotIt ? `${teamName} got it!` : 'Missed!'}</h2>
        <p className="text-[var(--muted)] font-semibold">
          {currentSong?.title} — <em>{currentSong?.movie}</em>
        </p>
        <div className="flex gap-6 mt-2">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{teamAName}</p>
            <p className="text-4xl font-black text-[var(--accent)]">{teamACards}</p>
          </div>
          <div className="text-4xl font-black text-[var(--muted)] self-center">vs</div>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{teamBName}</p>
            <p className="text-4xl font-black text-[var(--accent)]">{teamBCards}</p>
          </div>
        </div>
        <button
          onClick={continueGame}
          className="w-full py-4 bg-[var(--accent)] text-white font-black text-lg rounded-2xl hover:brightness-110 transition-all shadow-[0_3px_0_#b83208]"
        >
          Next Turn →
        </button>
      </div>
    )
  }

  // ─── GAMEOVER ─────────────────────────────────────────────────────────────
  const winner = teamACards > teamBCards ? teamAName : teamBCards > teamACards ? teamBName : null
  return (
    <div className="flex flex-col items-center gap-6 text-center max-w-sm mx-auto">
      <div className="text-6xl">{winner ? '🏆' : '🤝'}</div>
      <h2 className="text-4xl font-black">{winner ? `${winner} wins!` : "It's a tie!"}</h2>
      <div className="w-full bg-[var(--surface)] border-2 border-[var(--border)] rounded-2xl divide-y divide-[var(--border)]">
        {[{ name: teamAName, cards: teamACards }, { name: teamBName, cards: teamBCards }]
          .sort((a, b) => b.cards - a.cards)
          .map((t, i) => (
            <div key={t.name} className={`flex items-center justify-between px-5 py-4 ${i === 0 && winner ? 'bg-yellow-50' : ''}`}>
              <span className="font-black">{i === 0 && winner ? '🏆 ' : ''}{t.name}</span>
              <span className="text-2xl font-black text-[var(--accent)]">{t.cards} cards</span>
            </div>
          ))}
      </div>
      <button
        onClick={() => {
          setPhase('setup')
          setTeamACards(0); setTeamBCards(0)
          setActorIdxA(0); setActorIdxB(0)
          setRoundsA(0); setRoundsB(0)
          setPool({}); setSelectedEra(null); setCurrentSong(null); setGotIt(null)
          setAssignments(Object.fromEntries(roomPlayers.map(p => [p.id, null])))
        }}
        className="w-full py-3 border-2 border-[var(--border)] font-bold rounded-2xl hover:border-[var(--accent)] transition-all"
      >
        Play Again
      </button>
    </div>
  )
}
