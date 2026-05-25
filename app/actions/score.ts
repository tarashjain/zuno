'use server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function submitScore(
  sessionId: string,
  playerId: number,
  points: number,
  round: number,
  notes?: string
) {
  await prisma.score.create({ data: { playerId, points, round, notes } })
  revalidatePath(`/room/${sessionId}/play`)
}

export async function joinSession(sessionId: string, guestName: string) {
  await prisma.sessionPlayer.create({ data: { sessionId, guestName } })
  revalidatePath(`/room/${sessionId}`)
}

export async function startSession(sessionId: string) {
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { status: 'active' },
  })
  revalidatePath(`/room/${sessionId}`)
}
