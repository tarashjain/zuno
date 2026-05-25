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
    description: 'Bid the number of tricks you think you can win and try to hit it exactly!',
    rules: [
      'Each round, players bid how many tricks they will win',
      'Points awarded only if you hit your bid exactly',
      'Over or under your bid = 0 points for the round',
      'Play until agreed number of rounds is complete',
    ],
  },
  '100-points': {
    name: '100 Points',
    emoji: '💯',
    description: 'A simplified bidding card game where you aim to score exactly your bid.',
    rules: [
      'Players bid points at the start of each round',
      'Win tricks and score based on bid and achievement',
      'First player to 1000 points wins',
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
            <Link
              href={`/room/new?game=${params.slug}`}
              className="px-6 py-3 bg-[var(--accent)] text-white font-bold rounded-lg hover:brightness-110 transition-all"
            >
              Start New Game
            </Link>
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
