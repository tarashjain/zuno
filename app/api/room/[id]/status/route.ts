import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { roomHasExpired } from '@/lib/room-expiry'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let session = await prisma.gameSession.findUnique({
    where: { id: params.id },
    include: { game: true, players: { orderBy: { joinedAt: 'asc' } } },
  })

  if (!session) {
    return NextResponse.json(null, { status: 404 })
  }

  if (roomHasExpired(session.game.slug, session.status, session.createdAt)) {
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
