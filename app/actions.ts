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

export async function joinRoomByCode(formData: FormData) {
  const code = ((formData.get('code') as string) || '').trim().toLowerCase()

  if (!code) redirect('/join?error=empty')

  const session = await prisma.gameSession.findFirst({
    where: { id: { startsWith: code } },
    orderBy: { createdAt: 'desc' },
  })

  if (!session) redirect(`/join?error=notfound&code=${encodeURIComponent(code)}`)

  redirect(`/room/${session.id}`)
}
