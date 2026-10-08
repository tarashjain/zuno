'use server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export type KidsPlayerResult = { name: string; score: number; won: boolean }

export type KidsSessionHistory = {
  id: string
  playedAt: Date
  players: { playerName: string; finalScore: number; won: boolean }[]
}[]

export async function saveKidsSession(
  gameSlug: string,
  players: KidsPlayerResult[]
): Promise<{ ok: boolean }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return { ok: false }

  await prisma.kidsSession.create({
    data: {
      userEmail: session.user.email,
      gameSlug,
      players: {
        create: players.map(p => ({
          playerName: p.name,
          finalScore: p.score,
          won: p.won,
        })),
      },
    },
  })
  return { ok: true }
}

export async function getKidsHistory(
  gameSlug: string,
  userEmail: string
): Promise<KidsSessionHistory> {
  return prisma.kidsSession.findMany({
    where: { gameSlug, userEmail },
    include: { players: { orderBy: { finalScore: 'desc' } } },
    orderBy: { playedAt: 'desc' },
    take: 5,
  })
}
