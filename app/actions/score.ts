'use server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const playerCookieName = (sessionId: string) => `zuno_player_${sessionId}`

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

export async function joinSession(
  sessionId: string,
  guestName: string
): Promise<{ ok: boolean; id?: number; reason?: string }> {
  const name = guestName.trim()
  if (!name) return { ok: false, reason: 'Enter a name.' }

  const existing = await prisma.sessionPlayer.findFirst({
    where: { sessionId, guestName: { equals: name, mode: 'insensitive' } },
  })
  if (existing) return { ok: false, reason: `"${name}" is already in this game — pick a different name.` }

  let player
  try {
    player = await prisma.sessionPlayer.create({ data: { sessionId, guestName: name } })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return { ok: false, reason: `"${name}" is already in this game — pick a different name.` }
    }
    throw err
  }

  cookies().set(playerCookieName(sessionId), String(player.id), {
    path: `/room/${sessionId}`,
    sameSite: 'lax',
    maxAge: 60 * 60 * 12, // 12 hours — long enough for one game session
  })

  revalidatePath(`/room/${sessionId}`)
  return { ok: true, id: player.id }
}

export async function toggleReady(sessionId: string, playerId: number) {
  const mine = cookies().get(playerCookieName(sessionId))?.value
  if (mine !== String(playerId)) return { ok: false, reason: 'Not your player.' }

  const player = await prisma.sessionPlayer.findUnique({ where: { id: playerId } })
  if (!player || player.sessionId !== sessionId) return { ok: false, reason: 'Player not found.' }

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
