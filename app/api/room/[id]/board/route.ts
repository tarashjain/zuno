import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
