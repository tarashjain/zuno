import { createHmac, timingSafeEqual } from 'node:crypto'

export const PLAYER_TOKEN_MAX_AGE = 60 * 60 * 12
export const RECOVERY_TOKEN_MAX_AGE = 60 * 10

function signingSecret() {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET must be configured to authenticate room players.')
  return secret
}

function signature(secret: string, purpose: string, sessionId: string, payload: string) {
  return createHmac('sha256', secret).update(JSON.stringify([purpose, sessionId, payload])).digest('hex')
}

function tokenSigner(sessionId: string, purpose: string, maxAge: number) {
  const secret = signingSecret()
  return (playerId: number, now = Date.now()) => {
    if (!Number.isSafeInteger(playerId) || playerId <= 0) throw new Error('Invalid player ID.')
    const payload = `${playerId}.${Math.floor(now / 1000) + maxAge}`
    return `${payload}.${signature(secret, purpose, sessionId, payload)}`
  }
}

// Capture validated signing configuration before a join performs any database writes.
export function createPlayerTokenSigner(sessionId: string) {
  return tokenSigner(sessionId, 'room-player', PLAYER_TOKEN_MAX_AGE)
}

export function createPlayerToken(sessionId: string, playerId: number, now = Date.now()) {
  return createPlayerTokenSigner(sessionId)(playerId, now)
}

function readToken(sessionId: string, token: string | undefined, purpose: string, now: number): number | null {
  if (!token) return null
  const match = /^(\d+)\.(\d+)\.([a-f0-9]{64})$/.exec(token)
  if (!match) return null
  const [, id, expiry, mac] = match
  const playerId = Number(id)
  const expiresAt = Number(expiry)
  if (!Number.isSafeInteger(playerId) || playerId <= 0 || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return null
  const expected = Buffer.from(signature(signingSecret(), purpose, sessionId, `${id}.${expiry}`), 'hex')
  return timingSafeEqual(expected, Buffer.from(mac, 'hex')) ? playerId : null
}

export function readPlayerToken(sessionId: string, token: string | undefined, now = Date.now()) {
  return readToken(sessionId, token, 'room-player', now)
}

export function createRecoveryToken(sessionId: string, playerId: number, now = Date.now()) {
  return tokenSigner(sessionId, 'room-player-recovery', RECOVERY_TOKEN_MAX_AGE)(playerId, now)
}

export function readRecoveryToken(sessionId: string, token: string | undefined, now = Date.now()) {
  return readToken(sessionId, token, 'room-player-recovery', now)
}
