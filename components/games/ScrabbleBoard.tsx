'use client'
import { useEffect, useState } from 'react'
import { useLiveBoard } from '@/components/room/useLiveBoard'
import {
  startScrabbleGame, getScrabbleRack, playScrabbleWord, exchangeScrabbleTiles, passScrabbleTurn,
  type ScrabblePublic,
} from '@/app/actions/scrabble'
import { BOARD_SIZE, BLANK, CENTER, LETTER_VALUES, getCellBonus, type CellBonus } from '@/lib/scrabble'

type Player = { id: number; guestName: string; scores: { points: number; round: number }[] }
type Session = { id: string; mode: string }
type PendingTile = { row: number; col: number; letter: string; isBlank: boolean; rackIndex: number }

const BONUS_LABEL: Record<Exclude<CellBonus, null>, string> = { TW: 'TW', DW: 'DW', TL: 'TL', DL: 'DL' }
const BONUS_COLOR: Record<Exclude<CellBonus, null>, string> = {
  TW: 'bg-red-400 text-white',
  DW: 'bg-pink-300 text-red-900',
  TL: 'bg-blue-600 text-white',
  DL: 'bg-sky-300 text-blue-900',
}
const A_TO_Z = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))

export default function ScrabbleBoard({ session, players: initialPlayers, isHost, myPlayerId }: { session: Session; players: Player[]; isHost: boolean; myPlayerId: number | null }) {
  const { boardState, replaceBoardState, players } = useLiveBoard<ScrabblePublic | null, Player>(session.id, null, initialPlayers)
  const [myRack, setMyRack] = useState<string[] | null>(null)
  const [pending, setPending] = useState<PendingTile[]>([])
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null)
  const [blankPickerFor, setBlankPickerFor] = useState<{ row: number; col: number; rackIndex: number } | null>(null)
  const [exchangeMode, setExchangeMode] = useState(false)
  const [exchangeIndices, setExchangeIndices] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLocal = session.mode === 'local'
  const isPlaying = boardState?.phase === 'playing'
  const turnPlayerId = boardState && boardState.phase === 'playing' ? boardState.turnOrder[boardState.turnIndex] : null
  const turnPlayerName = players.find(p => p.id === turnPlayerId)?.guestName ?? '—'
  const canInteract = isPlaying && (isLocal || myPlayerId === turnPlayerId)
  const rackVisible = isPlaying && canInteract && (isLocal ? revealed : myRack !== null)

  useEffect(() => {
    setPending([])
    setSelectedRackIndex(null)
    setBlankPickerFor(null)
    setExchangeMode(false)
    setExchangeIndices([])
    setRevealed(false)
    setMyRack(null)
  }, [boardState?.turnKey])

  useEffect(() => {
    if (isLocal || !isPlaying || !myPlayerId || myPlayerId !== turnPlayerId || myRack !== null) return
    getScrabbleRack(session.id, myPlayerId).then(r => setMyRack(r.rack)).catch(e => setError(e instanceof Error ? e.message : 'Could not load your tiles'))
  }, [boardState?.turnKey, isLocal, isPlaying, myPlayerId, turnPlayerId, myRack, session.id])

  const usedRackIndices = new Set(pending.map(p => p.rackIndex))

  const startGame = async () => {
    setLoading(true)
    setError(null)
    try {
      const state = await startScrabbleGame(session.id)
      replaceBoardState(state)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the game')
    } finally { setLoading(false) }
  }

  const revealMyTiles = async () => {
    if (turnPlayerId === null) return
    try {
      const r = await getScrabbleRack(session.id, turnPlayerId)
      setMyRack(r.rack)
      setRevealed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tiles')
    }
  }

  const placeTile = (row: number, col: number) => {
    if (selectedRackIndex === null || !myRack) return
    const rackIndex = selectedRackIndex
    const letter = myRack[rackIndex]
    if (letter === BLANK) {
      setBlankPickerFor({ row, col, rackIndex })
    } else {
      setPending(current => [...current, { row, col, letter, isBlank: false, rackIndex }])
    }
    setSelectedRackIndex(null)
  }

  const pickBlankLetter = (letter: string) => {
    if (!blankPickerFor) return
    const { row, col, rackIndex } = blankPickerFor
    setPending(current => [...current, { row, col, rackIndex, letter, isBlank: true }])
    setBlankPickerFor(null)
  }

  const recallTile = (row: number, col: number) => {
    setPending(current => current.filter(p => !(p.row === row && p.col === col)))
  }

  const playWord = async () => {
    if (turnPlayerId === null || pending.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await playScrabbleWord(session.id, turnPlayerId, pending.map(({ row, col, letter, isBlank }) => ({ row, col, letter, isBlank })))
      replaceBoardState(res.state)
      setMyRack(res.rack)
      setPending([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not play that word')
    } finally { setLoading(false) }
  }

  const toggleExchangeIndex = (idx: number) => {
    setExchangeIndices(current => current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx])
  }

  const confirmExchange = async () => {
    if (turnPlayerId === null || !myRack || exchangeIndices.length === 0) return
    const rack = myRack
    setLoading(true)
    setError(null)
    try {
      const letters = exchangeIndices.map(i => rack[i])
      const res = await exchangeScrabbleTiles(session.id, turnPlayerId, letters)
      replaceBoardState(res.state)
      setMyRack(res.rack)
      setExchangeMode(false)
      setExchangeIndices([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not exchange tiles')
    } finally { setLoading(false) }
  }

  const pass = async () => {
    if (turnPlayerId === null) return
    setLoading(true)
    setError(null)
    try {
      const res = await passScrabbleTurn(session.id, turnPlayerId)
      replaceBoardState(res.state)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not pass')
    } finally { setLoading(false) }
  }

  if (!boardState || boardState.phase === 'lobby') {
    const validCount = initialPlayers.length >= 2 && initialPlayers.length <= 4
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-gradient-to-br from-[#0f766e] to-[#134e4a] rounded-2xl p-8 text-center text-white mb-6">
          <div className="text-4xl font-black mb-2">🔤</div>
          <div className="text-sm font-bold uppercase tracking-widest opacity-80">Scrabble</div>
        </div>
        <div className="bg-white border-2 border-[var(--border)] rounded-xl p-4 mb-6 text-sm text-center text-[var(--muted)]">
          Take turns placing tiles to build words on the board. Scoring (letter/word multipliers, the 7-tile bonus) is automatic — word legality is on the honor system, just like a physical set.
        </div>
        {!validCount && (
          <p className="text-center text-sm font-bold text-amber-600 mb-4">Scrabble needs 2 to 4 players.</p>
        )}
        {isHost ? (
          <button onClick={startGame} disabled={loading || !validCount} className="w-full bg-[#0f766e] text-white py-3 rounded-xl font-bold text-base mb-4 hover:brightness-110 disabled:opacity-50 transition-all">
            {loading ? 'Starting...' : '🀄 Start Game'}
          </button>
        ) : (
          <p className="text-center py-10 font-bold text-[var(--muted)]">Waiting for the host to start the game…</p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0f766e] to-[#134e4a] rounded-2xl p-4 text-white">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-80">
              {boardState.phase === 'finished' ? '✓ Game Over' : `${turnPlayerName}'s turn`}
            </div>
            {boardState.lastMove && (
              <div className="text-sm mt-1 opacity-90">
                {boardState.lastMove.type === 'play' && `${players.find(p => p.id === boardState.lastMove?.playerId)?.guestName ?? '—'} played ${boardState.lastMove.words.join(' + ')} (+${boardState.lastMove.score})`}
                {boardState.lastMove.type === 'exchange' && `${players.find(p => p.id === boardState.lastMove?.playerId)?.guestName ?? '—'} exchanged tiles`}
                {boardState.lastMove.type === 'pass' && `${players.find(p => p.id === boardState.lastMove?.playerId)?.guestName ?? '—'} passed`}
              </div>
            )}
          </div>
          <div className="text-sm font-bold">🎒 {boardState.bagCount} left</div>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {players.map(p => {
          const total = p.scores.reduce((sum, s) => sum + s.points, 0)
          const isTurn = p.id === turnPlayerId && boardState.phase === 'playing'
          const isWinner = boardState.winnerIds?.includes(p.id)
          return (
            <div key={p.id} className={`rounded-xl p-3 border-2 ${isTurn ? 'border-[#0f766e] bg-teal-50' : 'border-[var(--border)] bg-white'}`}>
              <div className="text-xs font-bold truncate">{p.guestName} {isWinner && '🏆'}</div>
              <div className="text-lg font-black">{total}</div>
              <div className="text-xs text-[var(--muted)]">{boardState.rackCounts[String(p.id)] ?? 0} tiles</div>
            </div>
          )
        })}
      </div>

      {/* Board */}
      <div className="bg-white border-2 border-[var(--border)] rounded-2xl p-2 sm:p-4 overflow-x-auto">
        <div className="grid gap-[2px] mx-auto" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`, maxWidth: '560px' }}>
          {boardState.board.map((row, r) => row.map((cell, c) => {
            const pendingHere = pending.find(p => p.row === r && p.col === c)
            const bonus = getCellBonus(r, c)
            const isCenter = r === CENTER.row && c === CENTER.col
            const canPlaceHere = canInteract && rackVisible && !cell && !pendingHere && boardState.phase === 'playing'

            let content: string | null = null
            let value = 0
            let cellClass = 'bg-[var(--surface2)]'
            if (cell) {
              content = cell.letter
              value = cell.isBlank ? 0 : (LETTER_VALUES[cell.letter] ?? 0)
              cellClass = 'bg-[#f5e6c8] text-[var(--ink)] border border-[#d4b98c]'
            } else if (pendingHere) {
              content = pendingHere.letter
              value = pendingHere.isBlank ? 0 : (LETTER_VALUES[pendingHere.letter] ?? 0)
              cellClass = 'bg-purple-200 text-purple-900 border-2 border-purple-500'
            } else if (bonus) {
              cellClass = BONUS_COLOR[bonus]
            }

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => (pendingHere ? recallTile(r, c) : canPlaceHere ? placeTile(r, c) : undefined)}
                disabled={!pendingHere && !canPlaceHere}
                className={`relative aspect-square flex items-center justify-center text-[10px] sm:text-xs font-bold rounded-sm ${cellClass} ${canPlaceHere ? 'cursor-pointer hover:brightness-95' : ''}`}
              >
                {content ? (
                  <span className="relative">
                    {content}
                    {value > 0 && <span className="absolute -bottom-1 -right-2 text-[6px] sm:text-[8px] font-normal">{value}</span>}
                  </span>
                ) : isCenter ? '★' : bonus ? BONUS_LABEL[bonus] : ''}
              </button>
            )
          }))}
        </div>
      </div>

      {/* Blank letter picker */}
      {blankPickerFor && (
        <div className="bg-white border-2 border-purple-400 rounded-xl p-3">
          <div className="text-sm font-bold mb-2">Choose a letter for the blank tile:</div>
          <div className="grid grid-cols-9 gap-1">
            {A_TO_Z.map(l => (
              <button key={l} onClick={() => pickBlankLetter(l)} className="py-1.5 bg-[var(--surface2)] rounded font-bold hover:bg-purple-200 transition-colors">
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => setBlankPickerFor(null)} className="text-xs font-bold text-[var(--muted)] mt-2">Cancel</button>
        </div>
      )}

      {/* Rack + controls */}
      {boardState.phase === 'playing' && canInteract && (
        <div className="bg-white border-2 border-[var(--border)] rounded-2xl p-4 space-y-3">
          {isLocal && !revealed ? (
            <button onClick={revealMyTiles} className="w-full bg-[#0f766e] text-white py-2.5 rounded-lg font-bold hover:brightness-110 transition-all">
              👁️ Reveal My Tiles
            </button>
          ) : myRack ? (
            <>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {myRack.map((letter, idx) => {
                  const used = usedRackIndices.has(idx)
                  const isSelected = selectedRackIndex === idx
                  const isMarkedForExchange = exchangeIndices.includes(idx)
                  return (
                    <button
                      key={idx}
                      disabled={used}
                      onClick={() => exchangeMode ? toggleExchangeIndex(idx) : setSelectedRackIndex(current => current === idx ? null : idx)}
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg font-black text-lg relative transition-all ${used ? 'opacity-20' : isSelected ? 'bg-purple-500 text-white scale-110' : isMarkedForExchange ? 'bg-red-200 border-2 border-red-500' : 'bg-[#f5e6c8] text-[var(--ink)] border border-[#d4b98c] hover:brightness-95'}`}
                    >
                      {letter === BLANK ? '_' : letter}
                      {!used && letter !== BLANK && (
                        <span className="absolute -bottom-1 -right-1 text-[8px] font-normal">{LETTER_VALUES[letter] ?? 0}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {exchangeMode ? (
                <div className="flex gap-2">
                  <button onClick={confirmExchange} disabled={loading || exchangeIndices.length === 0} className="flex-1 bg-red-500 text-white py-2.5 rounded-lg font-bold disabled:opacity-50 hover:brightness-110 transition-all">
                    Confirm Exchange ({exchangeIndices.length})
                  </button>
                  <button onClick={() => { setExchangeMode(false); setExchangeIndices([]) }} className="px-4 py-2.5 bg-[var(--surface2)] rounded-lg font-bold border border-[var(--border)]">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <button onClick={playWord} disabled={loading || pending.length === 0} className="flex-1 bg-[#0f766e] text-white py-2.5 rounded-lg font-bold disabled:opacity-50 hover:brightness-110 transition-all">
                    Play Word
                  </button>
                  <button onClick={() => setPending([])} disabled={pending.length === 0} className="px-4 py-2.5 bg-[var(--surface2)] rounded-lg font-bold border border-[var(--border)] disabled:opacity-50">
                    Recall
                  </button>
                  <button onClick={() => setExchangeMode(true)} disabled={pending.length > 0 || boardState.bagCount < 7} className="px-4 py-2.5 bg-[var(--surface2)] rounded-lg font-bold border border-[var(--border)] disabled:opacity-50">
                    Exchange
                  </button>
                  <button onClick={pass} disabled={loading || pending.length > 0} className="px-4 py-2.5 bg-[var(--surface2)] rounded-lg font-bold border border-[var(--border)] disabled:opacity-50">
                    Pass
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {boardState.phase === 'playing' && !canInteract && (
        <p className="text-center py-4 font-bold text-[var(--muted)]">Waiting for {turnPlayerName}…</p>
      )}

      {boardState.phase === 'finished' && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 text-center space-y-2">
          <div className="text-3xl font-black text-green-600">🎉</div>
          <div className="font-bold text-green-900">
            {boardState.winnerIds && boardState.winnerIds.length > 0
              ? `Winner: ${boardState.winnerIds.map(id => players.find(p => p.id === id)?.guestName).filter(Boolean).join(' & ')}`
              : 'Game Over'}
          </div>
          <p className="text-xs text-green-800">Leftover-tile penalties and bonuses are reflected in the scores above.</p>
          {isHost && (
            <button onClick={startGame} disabled={loading} className="w-full bg-[#0f766e] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all mt-2">
              {loading ? 'Starting...' : '▶ New Game'}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-center text-sm font-bold text-red-600">{error}</p>}
    </div>
  )
}
