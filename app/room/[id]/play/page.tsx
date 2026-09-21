import prisma from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import FarkleBoard from '@/components/games/FarkleBoard'
import JudgementBoard from '@/components/games/JudgementBoard'
import HundredPointsBoard from '@/components/games/HundredPointsBoard'
import ImposterBoard from '@/components/games/ImposterBoard'
import BollywoodCodenames from '@/components/games/BollywoodCodenames'
import FiveSecondRuleBoard from '@/components/games/FiveSecondRuleBoard'
import ScorekeeperBoard from '@/components/games/ScorekeeperBoard'
import { getRoomActor } from '@/lib/room-auth'

export default async function PlayGame({ params }: { params: { id: string } }) {
  const actor = await getRoomActor(params.id)
  if (!actor.room) return notFound()
  if (!actor.authorized) redirect(`/room/${params.id}`)

  const session = await prisma.gameSession.findUnique({
    where: { id: params.id },
    include: {
      game: true,
      players: { include: { scores: true } },
    },
  })

  if (!session) return notFound()
  if (session.status !== 'active') redirect(`/room/${params.id}`)

  const words = session.game.slug === '5-second-rule'
    ? await prisma.gameWord.findMany({ where: { gameId: session.gameId } })
    : []

  const GameComponents: Record<string, React.ElementType> = {
    farkle: FarkleBoard,
    '100-points': HundredPointsBoard,
    'judgement-card-game': JudgementBoard,
    imposter: ImposterBoard,
    'bollywood-code-names': BollywoodCodenames,
    '5-second-rule': FiveSecondRuleBoard,
    'score-keeper': ScorekeeperBoard,
  }

  const ActiveGame = GameComponents[session.game.slug]

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 pb-4 border-b-2 border-[var(--ink)]">
        <div className="flex items-baseline gap-3">
          <a href="/" className="text-2xl font-extrabold tracking-tight">
            ZU<span className="text-[var(--accent)]">N</span>O
          </a>
          <span className="text-[var(--muted)] font-semibold text-sm">| {session.game.name}</span>
        </div>
        <a
          href="/"
          className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
        >
          ← New Game
        </a>
      </header>

      {ActiveGame ? (
        <ActiveGame
          session={session}
          players={session.players}
          words={words}
          isHost={actor.isHost}
          myPlayerId={actor.playerId}
        />
      ) : (
        <div className="text-center py-20 text-[var(--muted)] font-semibold">
          Game UI not found for: {session.game.slug}
        </div>
      )}
    </main>
  )
}
