'use client'
import { useState, useEffect, useRef } from 'react'
import { getAllBollywoodSongs } from '@/app/actions/bollywood-beats'

type Song = { id: number; title: string; movie: string; era: string }
type Player = { id: number; guestName: string }
type Phase = 'setup' | 'spin' | 'reveal' | 'revealed' | 'acting' | 'result' | 'gameover'
type Team = 'A' | 'B'

const ERA_ORDER = ['1950s-80s', '1990s', '2000s', '2010s'] as const
const ERA_META: Record<string, { label: string; color: string; light: string }> = {
  '1950s-80s': { label: '1950s–80s', color: '#f59e0b', light: '#fcd34d' },
  '1990s':     { label: '1990s',     color: '#ec4899', light: '#f9a8d4' },
  '2000s':     { label: '2000–2009', color: '#3b82f6', light: '#93c5fd' },
  '2010s':     { label: '2010–Now',  color: '#10b981', light: '#6ee7b7' },
}
// 8 conic sections: Era1 Era2 Era3 Era4 Era1 Era2 Era3 Era4
const WHEEL_BG = `conic-gradient(
  #f59e0b 0deg 45deg,#ec4899 45deg 90deg,#3b82f6 90deg 135deg,#10b981 135deg 180deg,
  #fbbf24 180deg 225deg,#f9a8d4 225deg 270deg,#93c5fd 270deg 315deg,#6ee7b7 315deg 360deg
)`
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
    const slotCenter = slot * 45 + 22.5
    const jitter = (Math.random() - 0.5) * 20
    const prevMod = rotation % 360
    const delta = ((slotCenter + jitter) - prevMod + 360) % 360
    const newRotation = rotation + 360 * 5 + delta
    setRotation(newRotation)

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
    }, 3500)
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
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">{teamName}'s turn</p>
          <h2 className="text-2xl font-black">{actor} is acting</h2>
          <div className="flex gap-6 mt-3 justify-center">
            <span className="text-sm font-bold">🃏 {teamAName}: <span className="text-[var(--accent)]">{teamACards}</span></span>
            <span className="text-sm font-bold">🃏 {teamBName}: <span className="text-[var(--accent)]">{teamBCards}</span></span>
          </div>
        </div>

        {/* Spinner */}
        <div className="relative w-64 h-64">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 w-0 h-0"
            style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '22px solid var(--ink)' }} />
          {/* Wheel */}
          <div
            className="w-64 h-64 rounded-full border-4 border-[var(--ink)] shadow-xl"
            style={{
              background: WHEEL_BG,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3.5s cubic-bezier(0.17,0.67,0.12,1)' : 'none',
            }}
          />
          {/* Era labels (rotate opposite to keep readable) */}
          {ERA_ORDER.map((era, i) => {
            const angle = i * 90 + 45 // center of combined era pair (slots 0+4 cover 0°-45° and 180°-225°, average at 22.5°)
            // Place at 22.5° + i*90°
            const labelAngle = i * 90 + 22.5
            const rad = (labelAngle - 90) * Math.PI / 180
            const r = 88
            const x = 128 + r * Math.cos(rad)
            const y = 128 + r * Math.sin(rad)
            return null // labels inside spinning wheel are hard to read; skip
            void angle
          })}
          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-[var(--ink)]" />
          </div>
        </div>

        {/* Era legend */}
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
          {ERA_ORDER.map(era => (
            <div key={era} className="flex items-center gap-2 text-xs font-bold">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: ERA_META[era].color }} />
              {ERA_META[era].label}
            </div>
          ))}
        </div>

        <button
          onClick={spin} disabled={spinning}
          className="px-10 py-4 bg-[var(--accent)] text-white font-black text-xl rounded-2xl hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_3px_0_#b83208]"
        >
          {spinning ? 'Spinning…' : '🎯 Spin!'}
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
