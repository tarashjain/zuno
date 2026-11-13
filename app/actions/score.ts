'use server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { playerCookieName, requireRoomActor } from '@/lib/room-auth'
import { createPlayerToken, readPlayerToken, PLAYER_TOKEN_MAX_AGE } from '@/lib/player-token'

export async function submitScore(
  sessionId: string,
  playerId: number,
  points: number,
  round: number,
  notes?: string
) {
  const { room } = await requireRoomActor(sessionId)
  if (room.status !== 'active') throw new Error('The game is not active.')
  if (!['farkle', '5-second-rule', 'score-keeper'].includes(room.game.slug)) {
    throw new Error('Use this game’s scoring action.')
  }
  if (!Number.isInteger(points) || points < -2_147_483_648 || points > 2_147_483_647) throw new Error('Score must be a valid whole number.')
  if (!Number.isInteger(round) || round < 1 || round > 2_147_483_647) throw new Error('Round must be a positive whole number.')

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
  } else {
    // In a share-code room, one device/browser may only join as a single player —
    // everyone else must join from their own device using the room code.
    const existingPlayerId = readPlayerToken(sessionId, cookies().get(playerCookieName(sessionId))?.value)
    const existingPlayer = existingPlayerId !== null
      ? await prisma.sessionPlayer.findFirst({ where: { id: existingPlayerId, sessionId }, select: { guestName: true } })
      : null
    if (existingPlayer) {
      return { ok: false, reason: `You already joined this room as "${existingPlayer.guestName}".` }
    }
  }

  const existing = await prisma.sessionPlayer.findFirst({
    where: { sessionId, guestName: { equals: name, mode: 'insensitive' } },
  })
  if (existing) return { ok: false, reason: `"${name}" is already in this game — pick a different name.` }

  const player = await prisma.sessionPlayer.create({ data: { sessionId, guestName: name } })

  cookies().set(playerCookieName(sessionId), createPlayerToken(sessionId, player.id), {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PLAYER_TOKEN_MAX_AGE,
  })

  revalidatePath(`/room/${sessionId}`)
  return { ok: true, id: player.id }
}

export async function toggleReady(sessionId: string, playerId: number) {
  const mine = readPlayerToken(sessionId, cookies().get(playerCookieName(sessionId))?.value)
  if (mine !== playerId) return { ok: false, reason: 'Not your player.' }

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

export async function removePlayer(
  sessionId: string,
  playerId: number
): Promise<{ ok: boolean; reason?: string }> {
  const authSession = await getServerSession(authOptions)
  const room = await prisma.gameSession.findUnique({ where: { id: sessionId } })
  if (!room) return { ok: false, reason: 'Room not found.' }
  if (room.mode !== 'local') return { ok: false, reason: 'Only local games support host removal.' }
  if (!authSession?.user?.email || authSession.user.email !== room.hostEmail) {
    return { ok: false, reason: 'Only the host can remove players.' }
  }
  if (room.status !== 'lobby') return { ok: false, reason: 'The game has already started.' }
  await prisma.sessionPlayer.deleteMany({ where: { id: playerId, sessionId } })
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

  if (gameSession.status !== 'lobby') return { ok: false, reason: 'This game has already started or ended.' }

  if (gameSession.players.length === 0) {
    return { ok: false, reason: 'Add at least one player first.' }
  }

  if (gameSession.mode === 'individual' && !gameSession.players.every(p => p.ready)) {
    return { ok: false, reason: 'Waiting for all players to be ready.' }
  }

  const started = await prisma.gameSession.updateMany({ where: { id: sessionId, status: 'lobby' }, data: { status: 'active' } })
  if (!started.count) return { ok: false, reason: 'This game has already started or ended.' }
  revalidatePath(`/room/${sessionId}`)
  redirect(`/room/${sessionId}/play`)
}
