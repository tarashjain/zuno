'use client'
import { useState } from 'react'
import { submitScore } from '@/app/actions/score'

type Player = { id: number; guestName: string; scores: { points: number; round: number; notes?: string | null }[] }
type Session = { id: string }
type Die = { id: number; value: number }
type TurnState = {
  dice: Die[]
  selected: number[]
  turnPoints: number
  hasRolled: boolean
}

const DICE_COUNT = 6
const makeDice = (count = DICE_COUNT): Die[] =>
  Array.from({ length: count }, (_, id) => ({ id, value: Math.floor(Math.random() * 6) + 1 }))

const emptyTurn = (): TurnState => ({
  dice: [],
  selected: [],
  turnPoints: 0,
  hasRolled: false,
})

function scoreDice(values: number[]): { score: number; valid: boolean; label: string } {
  if (values.length === 0) return { score: 0, valid: false, label: 'No dice selected' }

  const counts = Array(7).fill(0) as number[]
  values.forEach(v => counts[v]++)

  const labels: string[] = []

  if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
    return { score: 1500, valid: true, label: 'Straight' }
  }

  const pairCount = counts.filter(c => c === 2).length
  if (values.length === 6 && pairCount === 3) {
    return { score: 1500, valid: true, label: 'Three pairs' }
  }

  const tripleCount = counts.filter(c => c === 3).length
  if (values.length === 6 && tripleCount === 2) {
    return { score: 2500, valid: true, label: 'Two triples' }
  }

  let score = 0

  for (let face = 1; face <= 6; face++) {
    if (counts[face] >= 3) {
      const base = face === 1 ? 1000 : face * 100
      const multiplier = counts[face] === 3 ? 1 : counts[face] - 2
      score += base * multiplier
      labels.push(`${counts[face]} of ${face}`)
      counts[face] = 0
    }
  }

  if (counts[1] > 0) {
    score += counts[1] * 100
    labels.push(`${counts[1]} single 1${counts[1] > 1 ? 's' : ''}`)
    counts[1] = 0
  }

  if (counts[5] > 0) {
    score += counts[5] * 50
    labels.push(`${counts[5]} single 5${counts[5] > 1 ? 's' : ''}`)
    counts[5] = 0
  }

  const valid = score > 0 && counts.every(c => c === 0)
  return {
    score: valid ? score : 0,
    valid,
    label: valid ? labels.join(', ') : 'Selection includes non-scoring dice',
  }
}

function hasAnyScore(values: number[]) {
  if (values.includes(1) || values.includes(5)) return true
  for (let face = 1; face <= 6; face++) {
    if (values.filter(v => v === face).length >= 3) return true
  }
  return scoreDice(values).valid
}

export default function FarkleBoard({ session, players: initialPlayers }: { session: Session; players: Player[] }) {
  const [players, setPlayers] = useState(initialPlayers)
  const [round, setRound] = useState(1)
  const [turns, setTurns] = useState<Record<number, TurnState>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const total = (p: Player) => p.scores.reduce((s, x) => s + x.points, 0)
  const getTurn = (playerId: number) => turns[playerId] ?? emptyTurn()

  const setTurn = (playerId: number, updater: (turn: TurnState) => TurnState) => {
    setTurns(current => ({ ...current, [playerId]: updater(current[playerId] ?? emptyTurn()) }))
  }

  const roll = (playerId: number) => {
    const turn = getTurn(playerId)
    const dice = makeDice(turn.dice.length || DICE_COUNT)

    setTurn(playerId, current => ({
      ...current,
      dice,
      selected: [],
      hasRolled: true,
    }))

    if (!hasAnyScore(dice.map(d => d.value))) {
      showToast('Farkle! No scoring dice.')
    }
  }

  const toggleDie = (playerId: number, dieId: number) => {
    setTurn(playerId, turn => ({
      ...turn,
      selected: turn.selected.includes(dieId)
        ? turn.selected.filter(id => id !== dieId)
        : [...turn.selected, dieId],
    }))
  }

  const keepSelected = (playerId: number) => {
    const turn = getTurn(playerId)
    const selectedDice = turn.dice.filter(d => turn.selected.includes(d.id))
    const result = scoreDice(selectedDice.map(d => d.value))

    if (!result.valid) {
      showToast(result.label)
      return
    }

    const remaining = turn.dice.filter(d => !turn.selected.includes(d.id))
    setTurn(playerId, current => ({
      ...current,
      dice: remaining.length > 0 ? remaining : [],
      selected: [],
      turnPoints: current.turnPoints + result.score,
      hasRolled: false,
    }))
    showToast(`Kept ${result.score} points`)
  }

  const bank = async (playerId: number) => {
    const turn = getTurn(playerId)
    if (turn.turnPoints === 0) {
      showToast('Score dice before banking.')
      return
    }

    setLoading(l => ({ ...l, [playerId]: true }))
    await submitScore(session.id, playerId, turn.turnPoints, round, 'Banked Farkle turn')
    setPlayers(pl => pl.map(p => p.id === playerId
      ? { ...p, scores: [...p.scores, { points: turn.turnPoints, round, notes: 'Banked Farkle turn' }] } : p))
    setTurns(current => ({ ...current, [playerId]: emptyTurn() }))
    setLoading(l => ({ ...l, [playerId]: false }))
    showToast(`+${turn.turnPoints} banked`)
  }

  const farkle = async (playerId: number) => {
    setLoading(l => ({ ...l, [playerId]: true }))
    await submitScore(session.id, playerId, 0, round, 'Farkled')
    setPlayers(pl => pl.map(p => p.id === playerId
      ? { ...p, scores: [...p.scores, { points: 0, round, notes: 'Farkled' }] } : p))
    setTurns(current => ({ ...current, [playerId]: emptyTurn() }))
    setLoading(l => ({ ...l, [playerId]: false }))
    showToast('Farkle recorded')
  }

  const sorted = [...players].sort((a, b) => total(b) - total(a))

  return (
    <div>
      <div className="flex gap-3 flex-wrap mb-6">
        {sorted.map((p, i) => (
          <div key={p.id} className="bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3 min-w-[90px] text-center">
            {i === 0 && <div className="text-xs font-bold text-[var(--accent)] mb-1">LEAD</div>}
            <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">{p.guestName}</div>
            <div className="text-2xl font-mono font-medium text-[var(--accent)]">{total(p)}</div>
          </div>
        ))}
      </div>

      <div className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-5">
        Farkle Round {round}
      </div>

      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-5 text-xs sm:text-sm font-semibold text-[var(--muted)]">
        Scoring: single 1 = 100, single 5 = 50, triples = face value x 100, triple 1s = 1000, straight = 1500, three pairs = 1500, two triples = 2500.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {players.map((p) => {
          const turn = getTurn(p.id)
          const selectedDice = turn.dice.filter(d => turn.selected.includes(d.id))
          const selectedScore = scoreDice(selectedDice.map(d => d.value))
          const canRoll = !loading[p.id] && !turn.hasRolled
          const canKeep = !loading[p.id] && turn.hasRolled && selectedScore.valid
          const canBank = !loading[p.id] && turn.turnPoints > 0

          return (
            <div key={p.id} className="bg-white border-2 border-[var(--border)] rounded-xl p-4">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                  <span className="font-extrabold text-lg block">{p.guestName}</span>
                  <span className="text-xs text-[var(--muted)] font-semibold">Turn: {turn.turnPoints} pts</span>
                </div>
                <span className="font-mono text-2xl text-[var(--accent)]">{total(p)}</span>
              </div>

              <div className="grid grid-cols-6 gap-2 mb-3">
                {(turn.dice.length ? turn.dice : Array.from({ length: DICE_COUNT }, (_, id) => ({ id, value: 0 }))).map((die) => {
                  const selected = turn.selected.includes(die.id)

                  return (
                    <button
                      key={die.id}
                      type="button"
                      onClick={() => die.value > 0 && toggleDie(p.id, die.id)}
                      disabled={!turn.hasRolled || die.value === 0 || loading[p.id]}
                      className={`aspect-square rounded-lg border-2 font-mono text-lg font-bold transition-all
                        ${selected
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--paper)] border-[var(--border)] text-[var(--ink)]'
                        }
                        ${!turn.hasRolled || die.value === 0 ? 'opacity-60 cursor-default' : 'hover:border-[var(--accent)]'}
                      `}
                      aria-label={die.value > 0 ? `Die ${die.value}` : 'No die'}
                    >
                      {die.value || '-'}
                    </button>
                  )
                })}
              </div>

              <div className="min-h-5 mb-3 text-xs font-semibold text-[var(--muted)]">
                {turn.hasRolled && selectedDice.length > 0
                  ? selectedScore.valid
                    ? `Selected: ${selectedScore.score} pts (${selectedScore.label})`
                    : selectedScore.label
                  : turn.dice.length === 0 && turn.turnPoints > 0
                    ? 'Hot dice: roll all six again or bank.'
                    : 'Roll, select scoring dice, then keep or bank.'}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => roll(p.id)}
                  disabled={!canRoll}
                  className="bg-[var(--ink)] text-[var(--paper)] px-3 py-2 rounded-lg font-bold text-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {turn.turnPoints > 0 && turn.dice.length === 0 ? 'Roll Hot Dice' : 'Roll'}
                </button>
                <button
                  onClick={() => keepSelected(p.id)}
                  disabled={!canKeep}
                  className="bg-[#2563eb] text-white px-3 py-2 rounded-lg font-bold text-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Keep Dice
                </button>
                <button
                  onClick={() => bank(p.id)}
                  disabled={!canBank}
                  className="bg-[#16a34a] text-white px-3 py-2 rounded-lg font-bold text-sm shadow-[0_2px_0_#166534] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Bank
                </button>
                <button
                  onClick={() => farkle(p.id)}
                  disabled={loading[p.id]}
                  className="bg-[#dc2626] text-white px-3 py-2 rounded-lg font-bold text-sm shadow-[0_2px_0_#991b1b] hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  Farkle
                </button>
              </div>

              {p.scores.filter(s => s.round === round - 1).length > 0 && (
                <div className="mt-3 text-xs text-[var(--muted)] font-semibold">
                  Last round: {p.scores.filter(s => s.round === round - 1).reduce((s, x) => s + x.points, 0)} pts
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={() => setRound(r => r + 1)}
        className="w-full py-3 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--ink)] transition-colors"
      >
        Next Round
      </button>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--ink)] text-[var(--paper)] text-sm font-bold px-5 py-3 rounded-full z-50 shadow-lg animate-bounce">
          {toast}
        </div>
      )}
    </div>
  )
}
