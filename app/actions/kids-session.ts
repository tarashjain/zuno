'use server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getKidsGame } from '@/lib/kids-games'

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

  const kidsGame = getKidsGame(gameSlug)
  const game = await prisma.game.upsert({
    where: { slug: gameSlug },
    create: { slug: gameSlug, name: kidsGame?.name ?? gameSlug },
    update: {},
  })

  const gameSession = await prisma.gameSession.create({
    data: {
      code: crypto.randomUUID(),
      gameId: game.id,
      status: 'completed',
      mode: 'local',
      hostEmail: session.user.email,
      players: {
        create: players.map(p => ({ guestName: p.name })),
      },
    },
    include: { players: true },
  })

  for (const sp of gameSession.players) {
    const result = players.find(p => p.name === sp.guestName)
    if (!result) continue
    await prisma.score.create({
      data: {
        playerId: sp.id,
        points: result.score,
        round: 1,
        notes: result.won ? 'winner' : null,
      },
    })
  }

  return { ok: true }
}

export async function getKidsHistory(
  gameSlug: string,
  userEmail: string
): Promise<KidsSessionHistory> {
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } })
  if (!game) return []

  const sessions = await prisma.gameSession.findMany({
    where: { gameId: game.id, hostEmail: userEmail, status: 'completed' },
    include: { players: { include: { scores: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  return sessions.map(s => ({
    id: s.id,
    playedAt: s.createdAt,
    players: s.players
      .map(p => ({
        playerName: p.guestName,
        finalScore: p.scores.reduce((sum, sc) => sum + sc.points, 0),
        won: p.scores.some(sc => sc.notes === 'winner'),
      }))
      .sort((a, b) => b.finalScore - a.finalScore || (a.won ? -1 : 1)),
  }))
}
