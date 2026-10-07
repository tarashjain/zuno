import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { getKidsGame } from '@/lib/kids-games'

const GAME_NAMES: Record<string, string> = {
  farkle: 'Farkle',
  'judgement-card-game': 'Judgement Card Game',
  '100-points': '100 Points',
  imposter: 'Imposter',
  'bollywood-code-names': 'Bollywood Codenames',
}

export default async function NewRoom({
  searchParams,
}: {
  searchParams: { game?: string }
}) {
  const gameSlug = searchParams.game

  if (gameSlug && getKidsGame(gameSlug)) {
    redirect(`/games/${gameSlug}/play`)
  }

  if (!gameSlug || !GAME_NAMES[gameSlug]) {
    redirect('/')
  }

  const game = await prisma.game.upsert({
    where: { slug: gameSlug },
    update: {},
    create: {
      name: GAME_NAMES[gameSlug],
      slug: gameSlug,
    },
  })

  const session = await prisma.gameSession.create({
    data: {
      gameId: game.id,
      status: 'lobby',
    },
  })

  redirect(`/room/${session.id}`)
}
