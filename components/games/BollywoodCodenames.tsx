'use client'
import { useState } from 'react'
import {
  getCodenamesSpymasterGrid,
  revealCodenamesCard,
  startCodenamesGame,
  setCodenamesTeams,
  randomizeCodenamesTeams,
  setCodenamesSpymaster,
  giveCodenamesClue,
  passCodenamesTurn,
  resetCodenamesRound,
} from '@/app/actions/secret-games'
import { useLiveBoard } from '@/components/room/useLiveBoard'

type Session = { id: string; mode: string }
type Player = { id: number; guestName: string }
type PlayerTeam = 'red' | 'blue'
type CardTeam = PlayerTeam | 'neutral' | 'assassin'
type Phase = 'setup' | 'clue' | 'guess' | 'over'
type Card = { id: number; word: string }

type BoardState = {
  kind: 'codenames'
  phase: Phase
  playerTeams: Record<string, PlayerTeam>
  spymasters: { red: number | null; blue: number | null }
  grid: Card[] | null
  revealed: Record<string, CardTeam>
  totals: { red: number; blue: number } | null
  turn: PlayerTeam | null
  clue: { word: string; number: number } | null
  guessesRemaining: number | null
  winner: PlayerTeam | null
} | null

const TEAM_LABEL: Record<PlayerTeam, string> = { red: '🔴 Red', blue: '🔵 Blue' }

export default function BollywoodCodenames({
  session,
  players: initialPlayers,
  isHost,
  myPlayerId,
}: {
  session: Session
  players: Player[]
  isHost: boolean
  myPlayerId: number | null
}) {
  const isLocal = session.mode === 'local'
  const { boardState, replaceBoardState, players } = useLiveBoard<BoardState, Player>(session.id, null, initialPlayers)
  const [spymasterGrid, setSpymasterGrid] = useState<Record<string, CardTeam> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clueWord, setClueWord] = useState('')
  const [clueNumber, setClueNumber] = useState(1)

  const run = async (fn: () => Promise<BoardState>) => {
    setLoading(true)
    setError(null)
    try {
      replaceBoardState(await fn())
      setSpymasterGrid(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const phase: Phase = boardState?.phase ?? 'setup'
  const playerTeams = boardState?.playerTeams ?? {}
  const spymasters = boardState?.spymasters ?? { red: null, blue: null }
  const myTeam = myPlayerId !== null ? playerTeams[String(myPlayerId)] : undefined
  const iAmSpymasterOf = (team: PlayerTeam) => myPlayerId !== null && spymasters[team] === myPlayerId
  const canViewKeyCard =
    myPlayerId !== null && (iAmSpymasterOf('red') || iAmSpymasterOf('blue') || (isHost && isLocal))

  // --- Setup phase ---

  const toggleTeam = (playerId: number) => {
    const next: Record<string, PlayerTeam> = { ...playerTeams }
    next[String(playerId)] = next[String(playerId)] === 'red' ? 'blue' : 'red'
    run(() => setCodenamesTeams(session.id, next))
  }

  const toggleSpymaster = (team: PlayerTeam, playerId: number) => {
    const next = spymasters[team] === playerId ? null : playerId
    run(() => setCodenamesSpymaster(session.id, team, next))
  }

  if (phase === 'setup') {
    const redPlayers = players.filter(p => playerTeams[String(p.id)] === 'red')
    const bluePlayers = players.filter(p => playerTeams[String(p.id)] === 'blue')
    const canDeal = redPlayers.length >= 2 && bluePlayers.length >= 2

    return (
      <div className="max-w-md mx-auto">
        <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 text-sm font-semibold text-[var(--muted)]">
          Split into two teams and pick a Spymaster for each — or let the host randomize both. Each team needs at
          least 2 players, since the Spymaster cannot also guess.
        </div>

        {isHost && (
          <button
            onClick={() => run(() => randomizeCodenamesTeams(session.id))}
            disabled={loading || players.length < 4}
            className="w-full bg-[#7c3aed] text-white py-3 rounded-xl font-bold mb-5 hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#5b21b6]"
          >
            🎲 Randomize Teams &amp; Spymasters
          </button>
        )}

        <div className="space-y-2 mb-6">
          {players.map(p => {
            const team = playerTeams[String(p.id)]
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 bg-white border-2 border-[var(--border)] rounded-xl px-3 py-2"
              >
                <span className="font-extrabold truncate">{p.guestName}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(['red', 'blue'] as PlayerTeam[]).map(t =>
                    team === t ? (
                      <button
                        key={t}
                        onClick={() => isHost && toggleSpymaster(t, p.id)}
                        disabled={!isHost}
                        title="Toggle Spymaster"
                        className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full ${
                          spymasters[t] === p.id
                            ? t === 'red'
                              ? 'bg-red-500 text-white'
                              : 'bg-blue-500 text-white'
                            : 'bg-[var(--surface2)] text-[var(--muted)] border border-[var(--border)]'
                        }`}
                      >
                        {TEAM_LABEL[t]} {spymasters[t] === p.id ? '👑' : ''}
                      </button>
                    ) : null
                  )}
                  {!team && <span className="text-xs font-bold text-[var(--muted)]">Unassigned</span>}
                  {isHost && (
                    <button
                      onClick={() => toggleTeam(p.id)}
                      disabled={loading}
                      className="text-xs font-bold px-2 py-1 rounded-full border-2 border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50"
                    >
                      {team ? 'Switch' : 'Assign'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {players.length === 0 && <p className="text-sm text-[var(--muted)] font-semibold">No players yet…</p>}
        </div>

        {isHost && (
          <>
            <button
              onClick={() => run(() => startCodenamesGame(session.id))}
              disabled={loading || !canDeal}
              className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#b83208]"
            >
              🎬 Deal Cards &amp; Start
            </button>
            <p className="text-xs text-[var(--muted)] font-semibold text-center mt-2">
              Click a name to switch teams, tap {TEAM_LABEL.red}/{TEAM_LABEL.blue} to make them Spymaster.
              Skip picking one and we&rsquo;ll choose a random Spymaster per team when you deal.
            </p>
          </>
        )}
        {error && <p className="mt-4 text-center text-sm font-bold text-[#dc2626]">{error}</p>}
      </div>
    )
  }

  // --- Active game (clue / guess / over) ---

  const grid = boardState?.grid ?? []
  const revealed = boardState?.revealed ?? {}
  const totals = boardState?.totals ?? { red: 0, blue: 0 }
  const revealedCount = (team: PlayerTeam) => Object.values(revealed).filter(t => t === team).length
  const remaining = { red: totals.red - revealedCount('red'), blue: totals.blue - revealedCount('blue') }
  const turn = boardState?.turn ?? null
  const clue = boardState?.clue ?? null

  const toggleKeyCard = async () => {
    if (spymasterGrid) {
      setSpymasterGrid(null)
      return
    }
    if (myPlayerId === null) return
    try {
      setSpymasterGrid(await getCodenamesSpymasterGrid(session.id, myPlayerId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the key card.')
    }
  }

  const submitClue = () => {
    if (myPlayerId === null) return
    run(() => giveCodenamesClue(session.id, myPlayerId, clueWord, clueNumber))
    setClueWord('')
    setClueNumber(1)
  }

  const revealCard = (cardId: number) => {
    if (myPlayerId === null || revealed[String(cardId)] || loading) return
    run(() => revealCodenamesCard(session.id, myPlayerId, cardId))
  }

  const pass = () => {
    if (myPlayerId === null) return
    run(() => passCodenamesTurn(session.id, myPlayerId))
  }

  const cardStyle = (cardId: number): string => {
    const team = spymasterGrid?.[String(cardId)] ?? revealed[String(cardId)]
    if (team === 'red') return 'bg-red-500 text-white border-red-600'
    if (team === 'blue') return 'bg-blue-500 text-white border-blue-600'
    if (team === 'assassin') return 'bg-gray-900 text-gray-100 border-black'
    if (team === 'neutral') return 'bg-amber-100 text-amber-900 border-amber-300'
    return 'bg-white text-[var(--ink)] border-[var(--border)] hover:border-[var(--accent)]'
  }

  // Local (pass-and-play) has one shared device — whoever is holding it taps for whichever
  // team is up, verbally coordinated in person, so there's no per-player/spymaster gating.
  const canGuessNow = phase === 'guess' && (
    isLocal
      ? isHost
      : myTeam !== undefined && myTeam === turn && myPlayerId !== null && spymasters[turn as PlayerTeam] !== myPlayerId
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 bg-white border-2 border-[var(--border)] rounded-xl p-4">
        <div className="flex flex-wrap gap-3 sm:gap-5">
          <span className="font-extrabold text-red-500">🔴 {remaining.red} left</span>
          <span className="font-extrabold text-blue-500">🔵 {remaining.blue} left</span>
        </div>
        {canViewKeyCard && (
          <button onClick={toggleKeyCard} className="font-bold text-sm px-3 py-2 rounded-lg border-2 border-[var(--border)] hover:border-[var(--accent)]">
            {spymasterGrid ? 'Hide Key Card' : '🗝️ Show Key Card'}
          </button>
        )}
      </div>

      {phase !== 'over' && turn && (
        <div className="mb-4 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4">
          <p className="font-extrabold">{TEAM_LABEL[turn]}&rsquo;s turn</p>
          {isLocal ? (
            <p className="text-sm font-semibold text-[var(--muted)] mt-1">
              {TEAM_LABEL[turn]} Spymaster gives a verbal clue, then tap cards to guess.
            </p>
          ) : clue ? (
            <p className="text-sm font-semibold text-[var(--muted)] mt-1">
              Clue: <strong className="text-[var(--text)]">&ldquo;{clue.word}&rdquo;</strong> —{' '}
              {clue.number === 0 ? 'unlimited' : clue.number}
              {boardState?.guessesRemaining != null && ` · ${boardState.guessesRemaining} guess(es) left`}
            </p>
          ) : iAmSpymasterOf(turn) ? (
            <p className="text-sm font-semibold text-[var(--muted)] mt-1">Give your team a clue.</p>
          ) : (
            <p className="text-sm font-semibold text-[var(--muted)] mt-1">Waiting for the {TEAM_LABEL[turn]} Spymaster&rsquo;s clue…</p>
          )}
        </div>
      )}

      {!isLocal && phase === 'clue' && iAmSpymasterOf(turn as PlayerTeam) && (
        <div className="mb-5 bg-white border-2 border-[var(--border)] rounded-xl p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Clue word…"
              value={clueWord}
              onChange={e => setClueWord(e.target.value)}
              className="flex-1 p-3 border-2 border-[var(--border)] rounded-xl bg-[var(--paper)] font-semibold outline-none focus:border-[var(--accent)]"
            />
            <input
              type="number"
              min={0}
              value={clueNumber}
              onChange={e => setClueNumber(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
              className="w-20 p-3 border-2 border-[var(--border)] rounded-xl bg-[var(--paper)] font-semibold text-center outline-none focus:border-[var(--accent)]"
            />
          </div>
          <p className="text-xs text-[var(--muted)] font-semibold mt-2">Number = how many cards it applies to. 0 = unlimited guesses.</p>
          <button
            onClick={submitClue}
            disabled={loading || !clueWord.trim()}
            className="w-full mt-3 py-3 bg-[var(--accent)] text-white rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_2px_0_#b83208]"
          >
            Give Clue
          </button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-6">
        {grid.map(card => {
          const isRevealed = !!revealed[String(card.id)]
          return (
            <button
              key={card.id}
              onClick={() => revealCard(card.id)}
              disabled={isRevealed || loading || !canGuessNow}
              className={`min-h-12 sm:min-h-16 flex items-center justify-center p-1 rounded-lg sm:rounded-xl font-extrabold text-[9px] sm:text-xs uppercase tracking-wide break-words border-2 transition-all leading-tight text-center ${cardStyle(card.id)} ${isRevealed && !spymasterGrid ? 'opacity-40' : 'opacity-100'}`}
            >
              {card.word}
            </button>
          )
        })}
      </div>

      {phase === 'guess' && (isLocal ? isHost : myTeam === turn) && (
        <button
          onClick={pass}
          disabled={loading}
          className="w-full mb-4 py-2.5 bg-[var(--surface2)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--ink)] disabled:opacity-50 transition-colors"
        >
          Pass Turn
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 text-xs font-bold">
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Red Team ({totals.red})</div>
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Blue Team ({totals.blue})</div>
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" /> Neutral (7)</div>
        <div className="flex items-center gap-2 bg-[var(--cream)] border-2 border-[var(--border)] rounded-lg p-2"><span className="w-3 h-3 rounded-sm bg-gray-900 inline-block" /> Assassin (1)</div>
      </div>

      {phase === 'over' && boardState?.winner && (
        <div className="bg-[var(--ink)] text-[var(--paper)] rounded-xl p-5 text-center mb-4">
          <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Game Over</p>
          <p className="text-2xl font-extrabold">{TEAM_LABEL[boardState.winner]} Team Wins! 🎉</p>
        </div>
      )}

      {isHost && phase === 'over' && (
        <button
          onClick={() => run(() => resetCodenamesRound(session.id))}
          disabled={loading}
          className="w-full py-3 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl font-bold hover:border-[var(--ink)] disabled:opacity-50 transition-colors"
        >
          🎬 Play Again
        </button>
      )}
      {error && <p className="mt-4 text-center text-sm font-bold text-[#dc2626]">{error}</p>}
    </div>
  )
}
