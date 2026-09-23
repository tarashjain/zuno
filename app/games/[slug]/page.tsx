import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'

const GAME_INFO: Record<string, { name: string; emoji: string; description: string; rules: string[] }> = {
  farkle: {
    name: 'Farkle',
    emoji: '🎲',
    description: 'Roll the dice and bank points before you farkle and lose them all!',
    rules: [
      'Players take turns rolling dice',
      'Score points with combinations (1s, 5s, three-of-a-kind, etc.)',
      'Bank points before rolling again or risk losing all points',
      'First to 10,000 points wins',
    ],
  },
  'judgement-card-game': {
    name: 'Judgement',
    emoji: '🃏',
    description: 'Predict how many tricks you will win, then try to hit that number exactly.',
    rules: [
      'Each round, every player predicts how many tricks they will win.',
      'Success: if a player wins exactly their predicted number of tricks, they score 10 points plus the number of tricks won.',
      'Failure: if a player wins more or fewer tricks than predicted, they score 0 points for that round.',
      'Zero bid rule: if a player correctly predicts zero tricks and wins zero tricks, they score 10 points.',
      'Play until the agreed number of rounds is complete.',
    ],
  },
  '100-points': {
    name: '100 Points',
    emoji: '💯',
    description: 'A running-total card game where players try to stay at or below 100.',
    rules: [
      'Use a standard 52-card deck with jokers removed. Deal three cards to each player and place the rest face-down as the draw pile.',
      'Card values: Aces = 1, number cards 2–8 = face value, 9s = 0, 10s = -10, and J/Q/K = +10.',
      'The player to the left of the dealer plays any card face-up beside the draw pile, announces its value, and draws back to three cards.',
      'Each next player plays one card onto the pile, announces the new running total, and draws a replacement card.',
      'A player may never play a card that makes the running total exceed 100.',
      'If a player has no card that keeps the total at or below 100, they bust, lose a chip/token, and pass their turn.',
      'The game continues until all cards are drawn and played, or until only one player can continue. The last player remaining wins.',
    ],
  },
  imposter: {
    name: 'Imposter',
    emoji: '🕵️',
    description: 'Find the imposter who is given a different word than everyone else!',
    rules: [
      'Everyone gets a word except one person (the imposter)',
      'Imposter gets a different related word',
      'Players take turns describing their word without revealing it',
      'Vote on who is the imposter',
    ],
  },
  'bollywood-code-names': {
    name: 'Bollywood Codenames',
    emoji: '🎬',
    description: 'Give one-word clues to help your team guess Bollywood-themed words!',
    rules: [
      'Team game where you give clues to guess words',
      'Clues must be one word and cannot be part of the target word',
      'Team guesses based on your clue and number',
      'First team to guess all their words wins',
    ],
  },
  '5-second-rule': {
    name: '5 Second Rule',
    emoji: '⏱️',
    description: 'Name 3 things in a category before the 5-second timer runs out!',
    rules: [
      'One player sits in the "Hot Seat" for each round',
      'Tap Start to reveal a category card, e.g. "Name 3 breakfast foods"',
      'The Hot Seat player has 5 seconds to name 3 things that fit',
      'Say all 3 before time runs out to score a point; the group judges each answer',
      'The Hot Seat passes to the next player each round — most points after the agreed rounds wins',
    ],
  },
  wavelength: {
    name: 'Wavelength',
    emoji: '📡',
    description: 'A social guessing game where teams try to read each other’s minds on a shifting spectrum.',
    rules: [
      'Split players into two teams. One player is the Psychic each round (the clue giver).',
      'The Psychic chooses a spectrum from the card and secretly spins the dial to set a hidden target along that spectrum.',
      'Give a single creative clue (one word or short concept) corresponding to where the target lies.',
      'Teammates discuss and set the pointer where they think the target is; then the Psychic reveals the hidden target zone.',
      'Scoring: Bullseye (center) = 4 points, Middle ring = 3 points, Outer ring = 2 points. The opposing team may guess Left/Right for +1 bonus point.',
      'Alternate turns; first team to reach 10 points wins.',
    ],
  },
  scrabble: {
    name: 'Scrabble',
    emoji: '🔤',
    description: 'The classic word-tile board game — build words, rack up points, outscore everyone.',
    rules: [
      '2–4 players. Everyone draws 7 tiles from the bag to start.',
      'The first word must be placed across the center star square.',
      'Every word after that must connect to a tile already on the board, in one straight line with no gaps.',
      'Scoring is automatic — letter values, double/triple letter squares, and double/triple word squares are all calculated for you, including any word formed crosswise. Placing all 7 tiles in one turn earns a 50-point bonus.',
      'On your turn you may play a word, exchange any of your tiles for new ones (only when at least 7 tiles remain in the bag), or pass.',
      'Word legality is on the honor system — like a physical set, there\'s no dictionary check, so the group polices what counts as a real word.',
      'The game ends when the bag is empty and someone plays their last tile, or when every player passes in a row. Remaining tiles are subtracted from each player\'s score; if someone went out, they collect everyone else\'s leftover tile value as a bonus.',
      'Highest final score wins.',
    ],
  },
  'score-keeper': {
    name: 'Score Keeper',
    emoji: '📝',
    description: 'A general-purpose scorecard — add players, play any game you like, and track the running total.',
    rules: [
      'Add players from the lobby before starting, same as any other game here',
      'Each round, enter every player’s score for that round (negative numbers are fine)',
      'Tap Complete Round to save it — everyone’s running total updates automatically',
      'Keep playing rounds for whatever game you’re scoring — the leaderboard always shows the current totals',
    ],
  },
}

interface PageProps {
  params: { slug: string }
}

export default async function GamePage({ params }: PageProps) {
  const session = await getServerSession(authOptions)
  const gameInfo = GAME_INFO[params.slug]

  if (!gameInfo) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <h1 className="text-2xl font-bold mb-4">Game not found</h1>
        <Link href="/" className="text-[var(--accent)] font-bold">
          ← Back to games
        </Link>
      </div>
    )
  }

  const game = await prisma.game.findUnique({ where: { slug: params.slug } })

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-16">
      {/* Game header */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-5xl">{gameInfo.emoji}</span>
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter">{gameInfo.name}</h1>
            <p className="text-[var(--muted)] text-lg mt-2">{gameInfo.description}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          {session ? (
            <>
              <Link
                href={`/room/new?game=${params.slug}&mode=local`}
                className="px-6 py-3 bg-[var(--accent)] text-white font-bold rounded-lg hover:brightness-110 transition-all"
              >
                🖥️ New Local Game
              </Link>
              <Link
                href={`/room/new?game=${params.slug}&mode=individual`}
                className="px-6 py-3 bg-[var(--surface2)] text-[var(--text)] font-bold rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-all"
              >
                📱 New Room (Share Code)
              </Link>
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="px-6 py-3 bg-[var(--accent)] text-white font-bold rounded-lg hover:brightness-110 transition-all"
            >
              Sign in to Play
            </Link>
          )}
          <Link
            href="/"
            className="px-6 py-3 bg-[var(--surface2)] text-[var(--text)] font-bold rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-all"
          >
            ← Back
          </Link>
        </div>

        {session && (
          <p className="text-xs text-[var(--muted)] font-semibold mt-3">
            Both buttons above start a brand new game. <strong>Local</strong>: one device, add every player yourself, no room code needed. <strong>Individually</strong>: share a room code and each player joins from their own device.
          </p>
        )}

        <div className="mt-4 bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--muted)]">
            Already have a room code from someone else?
          </p>
          <Link
            href="/join"
            className="px-4 py-2 bg-white border-2 border-[var(--border)] rounded-lg font-bold text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            🔑 Join That Room →
          </Link>
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-black mb-4">How to Play</h2>
          <div className="space-y-3">
            {gameInfo.rules.map((rule, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <p className="text-[var(--text)] leading-relaxed pt-1">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Game stats if available */}
        {game && (
          <div className="grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-8">
            <div className="p-4 bg-[var(--surface)] rounded-lg">
              <div className="text-2xl font-black text-[var(--accent)]">{game.id}</div>
              <div className="text-xs text-[var(--muted)] uppercase font-bold mt-1">Game ID</div>
            </div>
            <div className="p-4 bg-[var(--surface)] rounded-lg">
              <div className="text-2xl font-black">0</div>
              <div className="text-xs text-[var(--muted)] uppercase font-bold mt-1">Sessions</div>
            </div>
            <div className="p-4 bg-[var(--surface)] rounded-lg">
              <div className="text-2xl font-black">0</div>
              <div className="text-xs text-[var(--muted)] uppercase font-bold mt-1">Players</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
