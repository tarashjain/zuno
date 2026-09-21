'use server'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function createGameSession(formData: FormData) {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.email) redirect('/auth/signin')

  const gameId = parseInt(formData.get('gameId') as string)
  if (!Number.isInteger(gameId)) redirect('/')

  const session = await prisma.gameSession.create({
    data: { gameId, status: 'lobby', hostEmail: authSession.user.email },
  })
  redirect(`/room/${session.id}`)
}

export async function joinRoomByCode(formData: FormData) {
  const raw = (formData.get('code') as string) || ''
  const code = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!code) redirect('/join?error=empty')

  const session = await prisma.gameSession.findFirst({
    where: { id: { startsWith: code, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
  })

  if (!session) redirect(`/join?error=notfound&code=${encodeURIComponent(code)}`)

  redirect(`/room/${session.id}`)
}
