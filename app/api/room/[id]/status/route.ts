import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let session = await prisma.gameSession.findUnique({
    where: { id: params.id },
    include: { game: true, players: { orderBy: { joinedAt: 'asc' } } },
  })

  if (!session) {
    return NextResponse.json(null, { status: 404 })
  }

  // Auto-close games that have been active for more than 2 hours.
  // Score Keeper is exempt — it's designed to run for an entire multi-day game.
  if (
    session.status === 'active' &&
    session.game.slug !== 'score-keeper' &&
    Date.now() - session.createdAt.getTime() > TWO_HOURS_MS
  ) {
    await prisma.gameSession.update({ where: { id: params.id }, data: { status: 'completed' } })
    session = { ...session, status: 'completed' }
  }

  return NextResponse.json(
    {
      status: session.status,
      players: session.players.map(p => ({ id: p.id, guestName: p.guestName, ready: p.ready })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
