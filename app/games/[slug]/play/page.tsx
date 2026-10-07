import { notFound } from 'next/navigation'
import KidsPlayBoard from '@/components/games/KidsPlayBoard'
import HuePerfectBoard from '@/components/games/HuePerfectBoard'
import { getKidsGame } from '@/lib/kids-games'

export default function LocalGamePage({ params }: { params: { slug: string } }) {
  const game = getKidsGame(params.slug)
  if (!game) notFound()
  if (params.slug === 'hue-perfect') return <HuePerfectBoard />
  return <KidsPlayBoard key={game.slug} game={game} />
}
