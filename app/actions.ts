'use server'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'

export async function createGameSession(formData: FormData) {
  const gameId = parseInt(formData.get('gameId') as string)
  const session = await prisma.gameSession.create({
    data: { gameId, status: 'lobby' },
  })
  redirect(`/room/${session.id}`)
}
