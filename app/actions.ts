'use server'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { getKidsGame } from '@/lib/kids-games'

export async function createGameSession(formData: FormData) {
  const gameId = parseInt(formData.get('gameId') as string)
  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) throw new Error('Game not found')
  if (getKidsGame(game.slug)) redirect(`/games/${game.slug}/play`)

  const session = await prisma.gameSession.create({
    data: { gameId, status: 'lobby' },
  })
  redirect(`/room/${session.id}`)
}
