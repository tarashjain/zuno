import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const GAME_NAMES: Record<string, string> = {
  farkle: 'Farkle',
  'judgement-card-game': 'Judgement Card Game',
  '100-points': '100 Points',
  imposter: 'Imposter',
  'bollywood-code-names': 'Bollywood Codenames',
  '5-second-rule': '5 Second Rule',
  'score-keeper': 'Score Keeper',
  'wavelength': 'Wavelength',
}

export default async function NewRoom({
  searchParams,
}: {
  searchParams: { game?: string; mode?: string }
}) {
  const gameSlug = searchParams.game
  const mode = searchParams.mode === 'local' ? 'local' : 'individual'

  if (!gameSlug || !GAME_NAMES[gameSlug]) {
    redirect('/')
  }

  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.email) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/room/new?game=${gameSlug}&mode=${mode}`)}`)
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
      mode,
      hostEmail: authSession.user.email,
    },
  })

  redirect(`/room/${session.id}`)
}
