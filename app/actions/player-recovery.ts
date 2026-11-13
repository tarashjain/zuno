'use server'

import { cookies } from 'next/headers'
import prisma from '@/lib/db'
import { getRoomActor, playerCookieName, requireRoomHost } from '@/lib/room-auth'
import { createPlayerToken, createRecoveryToken, readRecoveryToken, PLAYER_TOKEN_MAX_AGE } from '@/lib/player-token'

export async function issuePlayerRecovery(sessionId: string, playerId: number) {
  const { room } = await requireRoomHost(sessionId)
  if (room.mode !== 'individual' || !['lobby', 'active'].includes(room.status)) {
    throw new Error('Recovery is only available for open share-code games.')
  }
  const player = await prisma.sessionPlayer.findFirst({ where: { id: playerId, sessionId }, select: { id: true } })
  if (!player) throw new Error('Player not found in this room.')
  return { token: createRecoveryToken(sessionId, player.id) }
}

export async function redeemPlayerRecovery(sessionId: string, token: string): Promise<{ ok: boolean; destination?: string; reason?: string }> {
  const playerId = typeof token === 'string' ? readRecoveryToken(sessionId, token) : null
  if (playerId === null) return { ok: false, reason: 'This recovery link is invalid or expired. Ask the host for a new one.' }

  const actor = await getRoomActor(sessionId)
  if (!actor.room || actor.room.mode !== 'individual' || !['lobby', 'active'].includes(actor.room.status)) {
    return { ok: false, reason: 'This room is no longer available for recovery.' }
  }
  if (actor.playerId !== null && actor.playerId !== playerId) {
    return { ok: false, reason: 'This browser is already joined as a different player. Open the link on the intended player’s device.' }
  }
  const player = await prisma.sessionPlayer.findFirst({ where: { id: playerId, sessionId }, select: { id: true } })
  if (!player) return { ok: false, reason: 'This player has been removed. Ask the host to help you rejoin.' }

  cookies().set(playerCookieName(sessionId), createPlayerToken(sessionId, player.id), {
    path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: PLAYER_TOKEN_MAX_AGE,
  })
  return { ok: true, destination: `/room/${sessionId}${actor.room.status === 'active' ? '/play' : ''}` }
}
