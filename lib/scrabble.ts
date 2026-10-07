// Scrabble: board layout, tile bag, and the placement/scoring engine. Pure data + functions —
// no 'use server' here, since this is imported by both app/actions/scrabble.ts and the client
// board component.

export const BOARD_SIZE = 15
export const RACK_SIZE = 7
export const CENTER = { row: 7, col: 7 }
export const BLANK = '?'

export type PlacedTile = { letter: string; isBlank: boolean }
export type Board = (PlacedTile | null)[][]
export type Placement = { row: number; col: number; letter: string; isBlank: boolean }
export type WordResult = { text: string; score: number }
export type ScoreResult = { totalScore: number; words: WordResult[]; bingo: boolean }
export type ValidationResult = { ok: true; result: ScoreResult } | { ok: false; error: string }

export const TILE_DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1,
  K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6,
  U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
  [BLANK]: 2,
}

export const LETTER_VALUES: Record<string, number> = {
  A: 1, E: 1, I: 1, L: 1, N: 1, O: 1, R: 1, S: 1, T: 1, U: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
  [BLANK]: 0,
}

// Standard published Scrabble board layout (0-indexed).
const TRIPLE_WORD: [number, number][] = [
  [0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14],
]
const DOUBLE_WORD: [number, number][] = [
  [1, 1], [2, 2], [3, 3], [4, 4], [10, 10], [11, 11], [12, 12], [13, 13],
  [1, 13], [2, 12], [3, 11], [4, 10], [10, 4], [11, 3], [12, 2], [13, 1],
  [7, 7], // center star — also a Double Word square
]
const TRIPLE_LETTER: [number, number][] = [
  [1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9],
]
const DOUBLE_LETTER: [number, number][] = [
  [0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14],
  [6, 2], [6, 6], [6, 8], [6, 12], [7, 3], [7, 11],
  [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14],
  [12, 6], [12, 8], [14, 3], [14, 11],
]

export type CellBonus = 'TW' | 'DW' | 'TL' | 'DL' | null

const BONUS_GRID: CellBonus[][] = Array.from({ length: BOARD_SIZE }, () => Array<CellBonus>(BOARD_SIZE).fill(null))
for (const [r, c] of TRIPLE_WORD) BONUS_GRID[r][c] = 'TW'
for (const [r, c] of DOUBLE_WORD) BONUS_GRID[r][c] = 'DW'
for (const [r, c] of TRIPLE_LETTER) BONUS_GRID[r][c] = 'TL'
for (const [r, c] of DOUBLE_LETTER) BONUS_GRID[r][c] = 'DL'

export function getCellBonus(row: number, col: number): CellBonus {
  return BONUS_GRID[row]?.[col] ?? null
}

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array<PlacedTile | null>(BOARD_SIZE).fill(null))
}

export function shuffle<T>(values: T[]): T[] {
  const arr = [...values]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function createShuffledBag(): string[] {
  const bag: string[] = []
  for (const [letter, count] of Object.entries(TILE_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) bag.push(letter)
  }
  return shuffle(bag)
}

export function drawTiles(bag: string[], count: number): { drawn: string[]; remaining: string[] } {
  const drawn = bag.slice(0, count)
  const remaining = bag.slice(count)
  return { drawn, remaining }
}

export function tileValue(letter: string, isBlank: boolean): number {
  return isBlank ? 0 : (LETTER_VALUES[letter.toUpperCase()] ?? 0)
}

export function sumRackValue(rack: string[]): number {
  return rack.reduce((sum, tile) => sum + (tile === BLANK ? 0 : (LETTER_VALUES[tile] ?? 0)), 0)
}

function isOccupied(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] !== null
}

function tileAt(board: Board, placements: Placement[], row: number, col: number): PlacedTile | null {
  const placed = placements.find(p => p.row === row && p.col === col)
  if (placed) return { letter: placed.letter, isBlank: placed.isBlank }
  return board[row]?.[col] ?? null
}

function isNewlyPlaced(placements: Placement[], row: number, col: number): boolean {
  return placements.some(p => p.row === row && p.col === col)
}

type WordSpan = { cells: { row: number; col: number }[] }

function extendWord(board: Board, placements: Placement[], axis: 'row' | 'col', fixed: number, from: number, to: number): WordSpan {
  let start = from
  let end = to
  const occupiedAt = (i: number) => (axis === 'row' ? isOccupied(board, fixed, i) || isNewlyPlaced(placements, fixed, i) : isOccupied(board, i, fixed) || isNewlyPlaced(placements, i, fixed))

  while (start - 1 >= 0 && occupiedAt(start - 1)) start--
  while (end + 1 < BOARD_SIZE && occupiedAt(end + 1)) end++

  const cells: { row: number; col: number }[] = []
  for (let i = start; i <= end; i++) {
    cells.push(axis === 'row' ? { row: fixed, col: i } : { row: i, col: fixed })
  }
  return { cells }
}

function wordText(board: Board, placements: Placement[], cells: { row: number; col: number }[]): string {
  return cells.map(({ row, col }) => tileAt(board, placements, row, col)?.letter ?? '').join('')
}

function scoreWord(board: Board, placements: Placement[], cells: { row: number; col: number }[]): number {
  let wordMultiplier = 1
  let sum = 0
  for (const { row, col } of cells) {
    const tile = tileAt(board, placements, row, col)
    if (!tile) continue
    const base = tileValue(tile.letter, tile.isBlank)
    if (isNewlyPlaced(placements, row, col)) {
      const bonus = getCellBonus(row, col)
      let contribution = base
      if (bonus === 'TL') contribution = base * 3
      else if (bonus === 'DL') contribution = base * 2
      if (bonus === 'TW') wordMultiplier *= 3
      else if (bonus === 'DW') wordMultiplier *= 2
      sum += contribution
    } else {
      sum += base
    }
  }
  return sum * wordMultiplier
}

export function validatePlacement(board: Board, placements: Placement[], isFirstMove: boolean): ValidationResult {
  if (placements.length === 0 || placements.length > RACK_SIZE) {
    return { ok: false, error: 'Place between 1 and 7 tiles.' }
  }

  for (const p of placements) {
    if (p.row < 0 || p.row >= BOARD_SIZE || p.col < 0 || p.col >= BOARD_SIZE) {
      return { ok: false, error: 'Placement is out of bounds.' }
    }
    if (board[p.row][p.col] !== null) {
      return { ok: false, error: 'That square is already occupied.' }
    }
  }

  const seen = new Set(placements.map(p => `${p.row},${p.col}`))
  if (seen.size !== placements.length) {
    return { ok: false, error: 'You placed two tiles on the same square.' }
  }

  const rows = new Set(placements.map(p => p.row))
  const cols = new Set(placements.map(p => p.col))

  let axis: 'row' | 'col'
  let fixed: number

  if (placements.length > 1) {
    if (rows.size === 1) {
      axis = 'row'
      fixed = placements[0].row
    } else if (cols.size === 1) {
      axis = 'col'
      fixed = placements[0].col
    } else {
      return { ok: false, error: 'Tiles must all be in one row or one column.' }
    }

    // No-gap check: every cell strictly between the placed tiles must be occupied
    // (either by another new placement or an existing board tile).
    const varying = placements.map(p => (axis === 'row' ? p.col : p.row)).sort((a, b) => a - b)
    for (let i = varying[0]; i <= varying[varying.length - 1]; i++) {
      const occupiedHere = axis === 'row'
        ? (isOccupied(board, fixed, i) || isNewlyPlaced(placements, fixed, i))
        : (isOccupied(board, i, fixed) || isNewlyPlaced(placements, i, fixed))
      if (!occupiedHere) {
        return { ok: false, error: 'Placed tiles must form one continuous line with no gaps.' }
      }
    }
  } else {
    // Single tile — if it has a horizontal neighbor, treat the row as the main axis
    // (any vertical neighbor still gets picked up as a cross word below). Otherwise default
    // to the column axis; if it has no neighbors at all, the length check below rejects it.
    const { row, col } = placements[0]
    const hasHorizontalNeighbor = isOccupied(board, row, col - 1) || isOccupied(board, row, col + 1)
    axis = hasHorizontalNeighbor ? 'row' : 'col'
    fixed = axis === 'row' ? row : col
  }

  if (isFirstMove) {
    const coversCenter = placements.some(p => p.row === CENTER.row && p.col === CENTER.col)
    if (!coversCenter) return { ok: false, error: 'The first word must cover the center square.' }
  }

  const varyingCoords = placements.map(p => (axis === 'row' ? p.col : p.row))
  const mainSpan = extendWord(board, placements, axis, fixed, Math.min(...varyingCoords), Math.max(...varyingCoords))

  if (mainSpan.cells.length < 2) {
    return { ok: false, error: 'A word must be at least two letters, and connect to the board.' }
  }

  // Cross words for every newly placed tile, along the perpendicular axis.
  const crossAxis: 'row' | 'col' = axis === 'row' ? 'col' : 'row'
  const crossWords: WordSpan[] = []
  for (const p of placements) {
    const crossFixed = crossAxis === 'row' ? p.row : p.col
    const along = crossAxis === 'row' ? p.col : p.row
    const span = extendWord(board, placements, crossAxis, crossFixed, along, along)
    if (span.cells.length >= 2) crossWords.push(span)
  }

  const mainWordIsAllNew = mainSpan.cells.length === placements.length
  if (!isFirstMove && mainWordIsAllNew && crossWords.length === 0) {
    return { ok: false, error: 'Your word must connect to a tile already on the board.' }
  }

  const words: WordResult[] = []
  words.push({ text: wordText(board, placements, mainSpan.cells), score: scoreWord(board, placements, mainSpan.cells) })
  for (const cw of crossWords) {
    words.push({ text: wordText(board, placements, cw.cells), score: scoreWord(board, placements, cw.cells) })
  }

  const bingo = placements.length === RACK_SIZE
  const totalScore = words.reduce((sum, w) => sum + w.score, 0) + (bingo ? 50 : 0)

  return { ok: true, result: { totalScore, words, bingo } }
}
