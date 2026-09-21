'use server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { playerCookieName, requireRoomActor } from '@/lib/room-auth'

export async function submitScore(
  sessionId: string,
  playerId: number,
  points: number,
  round: number,
  notes?: string
) {
  const { room } = await requireRoomActor(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')

  const player = await prisma.sessionPlayer.findFirst({ where: { id: playerId, sessionId }, select: { id: true } })
  if (!player) throw new Error('Player does not belong to this room.')

  await prisma.score.create({ data: { playerId, points, round, notes } })
  revalidatePath(`/room/${sessionId}/play`)
}

export async function joinSession(
  sessionId: string,
  guestName: string
): Promise<{ ok: boolean; id?: number; reason?: string }> {
  const name = guestName.trim()
  if (!name) return { ok: false, reason: 'Enter a name.' }
  if (name.length > 40) return { ok: false, reason: 'Name must be 40 characters or fewer.' }

  const room = await prisma.gameSession.findUnique({ where: { id: sessionId } })
  if (!room) return { ok: false, reason: 'Room not found.' }
  if (room.status !== 'lobby') return { ok: false, reason: 'This game has already started.' }

  if (room.mode === 'local') {
    const authSession = await getServerSession(authOptions)
    if (!authSession?.user?.email || authSession.user.email !== room.hostEmail) {
      return { ok: false, reason: 'Only the host can add players to a local game.' }
    }
  }

  const existing = await prisma.sessionPlayer.findFirst({
    where: { sessionId, guestName: { equals: name, mode: 'insensitive' } },
  })
  if (existing) return { ok: false, reason: `"${name}" is already in this game — pick a different name.` }

  const player = await prisma.sessionPlayer.create({ data: { sessionId, guestName: name } })

  cookies().set(playerCookieName(sessionId), String(player.id), {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12, // 12 hours — long enough for one game session
  })

  revalidatePath(`/room/${sessionId}`)
  return { ok: true, id: player.id }
}

export async function toggleReady(sessionId: string, playerId: number) {
  const mine = cookies().get(playerCookieName(sessionId))?.value
  if (mine !== String(playerId)) return { ok: false, reason: 'Not your player.' }

  const player = await prisma.sessionPlayer.findUnique({
    where: { id: playerId },
    include: { session: { select: { status: true } } },
  })
  if (!player || player.sessionId !== sessionId) return { ok: false, reason: 'Player not found.' }
  if (player.session.status !== 'lobby') return { ok: false, reason: 'This game has already started.' }

  await prisma.sessionPlayer.update({ where: { id: playerId }, data: { ready: !player.ready } })
  revalidatePath(`/room/${sessionId}`)
  return { ok: true }
}

export async function startSession(sessionId: string): Promise<{ ok: boolean; reason?: string }> {
  const authSession = await getServerSession(authOptions)

  const gameSession = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { players: true },
  })

  if (!gameSession) return { ok: false, reason: 'Room not found.' }

  if (!authSession?.user?.email || authSession.user.email !== gameSession.hostEmail) {
    return { ok: false, reason: 'Only the host can start the game.' }
  }

  if (gameSession.players.length === 0) {
    return { ok: false, reason: 'Add at least one player first.' }
  }

  if (gameSession.mode === 'individual' && !gameSession.players.every(p => p.ready)) {
    return { ok: false, reason: 'Waiting for all players to be ready.' }
  }

  await prisma.gameSession.update({ where: { id: sessionId }, data: { status: 'active' } })
  revalidatePath(`/room/${sessionId}`)
  redirect(`/room/${sessionId}/play`)
}
