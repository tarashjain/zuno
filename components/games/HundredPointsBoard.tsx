'use client'
import { useMemo, useState } from 'react'
import { submitScore } from '@/app/actions/score'

type ScoreEntry = { points: number; round: number; notes?: string | null }
type Player = { id: number; guestName: string; scores: ScoreEntry[] }
type Session = { id: string }

type CardOption = { label: string; value: number }

const CARD_OPTIONS: CardOption[] = [
  { label: 'A', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9', value: 0 },
  { label: '10', value: -10 },
  { label: 'J', value: 10 },
  { label: 'Q', value: 10 },
  { label: 'K', value: 10 },
]

const STARTING_TOKENS = 3

function scoreTotal(p: Player) {
  return p.scores.reduce((s, x) => s + x.points, 0)
}

function tokensLeft(p: Player) {
  return Math.max(0, STARTING_TOKENS + scoreTotal(p))
}

export default function HundredPointsBoard({ session, players: initialPlayers }: { session: Session; players: Player[] }) {
  const [players, setPlayers] = useState(initialPlayers)
  const [runningTotal, setRunningTotal] = useState(0)
  const [turn, setTurn] = useState(1)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [selectedCard, setSelectedCard] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const activePlayers = useMemo(() => players.filter(p => tokensLeft(p) > 0), [players])
  const winner = activePlayers.length === 1 ? activePlayers[0] : null
  const currentPlayer = players[currentPlayerIndex]
  const card = CARD_OPTIONS.find(c => c.label === selectedCard)
  const previewTotal = card ? runningTotal + card.value : null
  const wouldBust = previewTotal !== null && previewTotal > 100

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const moveToNextActivePlayer = (fromIndex = currentPlayerIndex, updatedPlayers = players) => {
    if (updatedPlayers.filter(p => tokensLeft(p) > 0).length <= 1) return fromIndex

    for (let offset = 1; offset <= updatedPlayers.length; offset += 1) {
      const nextIndex = (fromIndex + offset) % updatedPlayers.length
      if (tokensLeft(updatedPlayers[nextIndex]) > 0) return nextIndex
    }

    return fromIndex
  }

  const playCard = async () => {
    if (!currentPlayer || !card) return
    if (tokensLeft(currentPlayer) <= 0) {
      showToast(`${currentPlayer.guestName} is out of tokens.`)
      return
    }
    if (wouldBust || previewTotal === null) {
      showToast('That card would take the pile over 100. Bust instead or choose another card.')
      return
    }

    setSaving(true)
    const notes = `Played ${card.label} (${card.value >= 0 ? '+' : ''}${card.value}); total ${runningTotal} → ${previewTotal}`
    await submitScore(session.id, currentPlayer.id, 0, turn, notes)

    setPlayers(pl => pl.map(p => p.id === currentPlayer.id
      ? { ...p, scores: [...p.scores, { points: 0, round: turn, notes }] }
      : p
    ))
    setRunningTotal(previewTotal)
    setSelectedCard('')
    setTurn(t => t + 1)
    setCurrentPlayerIndex(i => moveToNextActivePlayer(i))
    setSaving(false)
    showToast(`${currentPlayer.guestName} played ${card.label}. Total is ${previewTotal}.`)
  }

  const bustPlayer = async () => {
    if (!currentPlayer) return
    if (tokensLeft(currentPlayer) <= 0) {
      showToast(`${currentPlayer.guestName} is already out.`)
      return
    }

    setSaving(true)
    const notes = `Bust at total ${runningTotal}; lost 1 token`
    await submitScore(session.id, currentPlayer.id, -1, turn, notes)

    const updatedPlayers = players.map(p => p.id === currentPlayer.id
      ? { ...p, scores: [...p.scores, { points: -1, round: turn, notes }] }
      : p
    )

    setPlayers(updatedPlayers)
    setSelectedCard('')
    setTurn(t => t + 1)
    setCurrentPlayerIndex(i => moveToNextActivePlayer(i, updatedPlayers))
    setSaving(false)
    showToast(`${currentPlayer.guestName} busted and lost a token.`)
  }

  const resetPile = () => {
    setRunningTotal(0)
    setSelectedCard('')
    showToast('Pile reset to 0.')
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-16 bg-white border-2 border-[var(--border)] rounded-xl">
        <div className="text-4xl mb-3">💯</div>
        <p className="font-bold text-[var(--muted)]">No players joined yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3 text-center">
          <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">Pile Total</div>
          <div className="text-4xl font-mono text-[var(--accent)]">{runningTotal}</div>
        </div>
        <div className="bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3 text-center">
          <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">Turn</div>
          <div className="text-4xl font-mono text-[var(--accent)]">{turn}</div>
        </div>
        <div className="bg-white border-2 border-[var(--border)] rounded-xl px-4 py-3 text-center">
          <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">Current Player</div>
          <div className="text-lg font-black truncate">{winner ? `${winner.guestName} wins!` : currentPlayer?.guestName}</div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap mb-6">
        {players.map((p, i) => {
          const remaining = tokensLeft(p)
          const isCurrent = i === currentPlayerIndex && !winner
          return (
            <div key={p.id} className={`bg-white border-2 rounded-xl px-4 py-3 min-w-[110px] text-center ${isCurrent ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
              {isCurrent && <div className="text-xs font-bold text-[var(--accent)] mb-1">▶ TURN</div>}
              {winner?.id === p.id && <div className="text-xs font-bold text-[var(--accent)] mb-1">👑 WINNER</div>}
              <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-1">{p.guestName}</div>
              <div className="text-2xl font-mono text-[var(--accent)]">{remaining}</div>
              <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">tokens</div>
            </div>
          )
        })}
      </div>

      <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 mb-5">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <label className="flex-1">
            <span className="block text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Card played</span>
            <select
              value={selectedCard}
              onChange={e => setSelectedCard(e.target.value)}
              disabled={!!winner || saving}
              className="w-full border-2 border-[var(--border)] rounded-lg p-3 font-semibold bg-[var(--paper)] outline-none focus:border-[var(--accent)] transition-colors"
            >
              <option value="">Select card…</option>
              {CARD_OPTIONS.map(option => (
                <option key={option.label} value={option.label}>
                  {option.label} ({option.value >= 0 ? '+' : ''}{option.value})
                </option>
              ))}
            </select>
          </label>

          <div className="min-w-[150px] bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">New total</div>
            <div className={`text-2xl font-mono font-bold ${wouldBust ? 'text-[#dc2626]' : 'text-[var(--accent)]'}`}>
              {previewTotal ?? '—'}
            </div>
          </div>

          <button
            onClick={playCard}
            disabled={!selectedCard || !!winner || saving || wouldBust}
            className="px-5 py-3 bg-[var(--accent)] text-white rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#b83208]"
          >
            {saving ? 'Saving…' : 'Play Card'}
          </button>

          <button
            onClick={bustPlayer}
            disabled={!!winner || saving}
            className="px-5 py-3 bg-[#dc2626] text-white rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#991b1b]"
          >
            Bust
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <button
          onClick={resetPile}
          disabled={saving}
          className="flex-1 py-3 bg-[var(--surface2)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--accent)] disabled:opacity-50 transition-all"
        >
          Reset Pile to 0
        </button>
      </div>

      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-3 mb-5 text-xs font-semibold text-[var(--muted)] space-y-1">
        <p>Card values: A = 1, 2–8 = face value, 9 = 0, 10 = -10, J/Q/K = +10.</p>
        <p>Players must keep the pile at 100 or below. If they cannot, tap Bust and they lose 1 token.</p>
        <p>The last player with tokens remaining wins.</p>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--ink)] text-[var(--paper)] text-sm font-bold px-5 py-3 rounded-full z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
