'use server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

export async function setBoardState(sessionId: string, state: unknown) {
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { boardState: state === null ? Prisma.JsonNull : (state as Prisma.InputJsonValue) },
  })
  revalidatePath(`/room/${sessionId}/play`)
}
