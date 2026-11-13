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
  if (!kidsGame || !Array.isArray(players) || players.length === 0 || players.some(p =>
    !p || typeof p.name !== 'string' || !p.name.trim() || p.name.trim().length > 40 ||
    !Number.isInteger(p.score) || p.score < -2_147_483_648 || p.score > 2_147_483_647 || typeof p.won !== 'boolean'
  )) return { ok: false }
  const game = await prisma.game.upsert({
    where: { slug: gameSlug },
    create: { slug: gameSlug, name: kidsGame.name },
    update: {},
  })

  await prisma.gameSession.create({
    data: {
      code: crypto.randomUUID(),
      gameId: game.id,
      status: 'completed',
      mode: 'local',
      hostEmail: session.user.email,
      players: {
        create: players.map(p => ({
          guestName: p.name.trim(),
          scores: { create: { points: p.score, round: 1, notes: p.won ? 'winner' : null } },
        })),
      },
    },
  })

  return { ok: true }
}

export async function getKidsHistory(gameSlug: string): Promise<KidsSessionHistory> {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.email) return []
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } })
  if (!game) return []

  const sessions = await prisma.gameSession.findMany({
    where: { gameId: game.id, hostEmail: authSession.user.email, status: 'completed' },
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
