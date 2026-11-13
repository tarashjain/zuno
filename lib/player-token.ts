import { createHmac, timingSafeEqual } from 'node:crypto'

export const PLAYER_TOKEN_MAX_AGE = 60 * 60 * 12

function signature(sessionId: string, payload: string) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET must be configured to authenticate room players.')
  return createHmac('sha256', secret).update(JSON.stringify(['room-player', sessionId, payload])).digest('hex')
}

export function createPlayerToken(sessionId: string, playerId: number, now = Date.now()) {
  if (!Number.isSafeInteger(playerId) || playerId <= 0) throw new Error('Invalid player ID.')
  const payload = `${playerId}.${Math.floor(now / 1000) + PLAYER_TOKEN_MAX_AGE}`
  return `${payload}.${signature(sessionId, payload)}`
}

export function readPlayerToken(sessionId: string, token: string | undefined, now = Date.now()): number | null {
  if (!token) return null
  const match = /^(\d+)\.(\d+)\.([a-f0-9]{64})$/.exec(token)
  if (!match) return null
  const [, id, expiry, mac] = match
  const playerId = Number(id)
  const expiresAt = Number(expiry)
  if (!Number.isSafeInteger(playerId) || playerId <= 0 || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return null
  const expected = Buffer.from(signature(sessionId, `${id}.${expiry}`), 'hex')
  return timingSafeEqual(expected, Buffer.from(mac, 'hex')) ? playerId : null
}
