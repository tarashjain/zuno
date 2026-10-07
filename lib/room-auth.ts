import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const playerCookieName = (sessionId: string) => `zuno_player_${sessionId}`

export async function getRoomActor(sessionId: string) {
  const room = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { id: true, hostEmail: true, mode: true, status: true },
  })

  if (!room) return { room: null, isHost: false, playerId: null, authorized: false }

  const authSession = await getServerSession(authOptions)
  const isHost = !!authSession?.user?.email && authSession.user.email === room.hostEmail
  const rawPlayerId = cookies().get(playerCookieName(sessionId))?.value
  const parsedPlayerId = rawPlayerId ? Number.parseInt(rawPlayerId, 10) : NaN
  const player = Number.isInteger(parsedPlayerId)
    ? await prisma.sessionPlayer.findFirst({ where: { id: parsedPlayerId, sessionId }, select: { id: true } })
    : null

  return {
    room,
    isHost,
    playerId: player?.id ?? null,
    authorized: isHost || !!player,
  }
}

export async function requireRoomActor(sessionId: string) {
  const actor = await getRoomActor(sessionId)
  if (!actor.room) throw new Error('Room not found.')
  if (!actor.authorized) throw new Error('You are not authorized to update this room.')
  return actor
}

export async function requireRoomHost(sessionId: string) {
  const actor = await getRoomActor(sessionId)
  if (!actor.room) throw new Error('Room not found.')
  if (!actor.isHost) throw new Error('Only the room host can perform this action.')
  return actor
}
