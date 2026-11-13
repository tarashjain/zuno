'use server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { requireRoomActor } from '@/lib/room-auth'

export async function setBoardState(sessionId: string, state: unknown) {
  const { room } = await requireRoomActor(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')
  if (!['farkle', '5-second-rule'].includes(room.game.slug)) {
    throw new Error('Use this game’s dedicated actions to update its board.')
  }
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { boardState: state === null ? Prisma.JsonNull : (state as Prisma.InputJsonValue) },
  })
  revalidatePath(`/room/${sessionId}/play`)
}
