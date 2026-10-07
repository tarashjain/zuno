import { notFound } from 'next/navigation'
import KidsPlayBoard from '@/components/games/KidsPlayBoard'
import { getKidsGame } from '@/lib/kids-games'

export default function LocalGamePage({ params }: { params: { slug: string } }) {
  const game = getKidsGame(params.slug)
  if (!game) notFound()
  return <KidsPlayBoard key={game.slug} game={game} />
}
