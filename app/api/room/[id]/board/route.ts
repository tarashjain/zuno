import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getRoomActor } from '@/lib/room-auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await getRoomActor(params.id)
  if (!actor.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await prisma.gameSession.findUnique({
    where: { id: params.id },
    include: { players: { include: { scores: true }, orderBy: { joinedAt: 'asc' } } },
  })

  if (!session) {
    return NextResponse.json(null, { status: 404 })
  }

  return NextResponse.json(
    {
      boardState: session.boardState,
      players: session.players.map(p => ({
        id: p.id,
        guestName: p.guestName,
        scores: p.scores.map(s => ({ points: s.points, round: s.round, notes: s.notes })),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
