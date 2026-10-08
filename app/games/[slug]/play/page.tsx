import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import KidsPlayBoard from '@/components/games/KidsPlayBoard'
import HuePerfectBoard from '@/components/games/HuePerfectBoard'
import { getKidsGame } from '@/lib/kids-games'

export default async function LocalGamePage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect(`/api/auth/signin?callbackUrl=/games/${params.slug}/play`)

  const game = getKidsGame(params.slug)
  if (!game) notFound()
  if (params.slug === 'hue-perfect') return <HuePerfectBoard />
  return <KidsPlayBoard key={game.slug} game={game} />
}
