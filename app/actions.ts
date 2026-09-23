'use server'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateRoomCode } from '@/lib/room-code'

export async function createUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode()
    const existing = await prisma.gameSession.findUnique({ where: { code } })
    if (!existing) return code
  }
  throw new Error('Could not generate a unique room code')
}

export async function createGameSession(formData: FormData) {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.email) redirect('/auth/signin')

  const gameId = parseInt(formData.get('gameId') as string)
  if (!Number.isInteger(gameId)) redirect('/')

  const code = await createUniqueRoomCode()
  const session = await prisma.gameSession.create({
    data: { gameId, code, status: 'lobby', hostEmail: authSession.user.email },
  })
  redirect(`/room/${session.id}`)
}

export async function joinRoomByCode(formData: FormData) {
  const raw = (formData.get('code') as string) || ''
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (!code) redirect('/join?error=empty')

  const session = await prisma.gameSession.findUnique({ where: { code } })

  if (!session) redirect(`/join?error=notfound&code=${encodeURIComponent(code)}`)

  redirect(`/room/${session.id}`)
}
