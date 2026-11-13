'use server'

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { requireRoomHost } from '@/lib/room-auth'
import { appendCashierEvent, createCashierState, undoCashierEvent, type CashierAction, type CashierState } from '@/lib/cashier'

export async function startCashier(input: { title: string; unit: string; defaultBuyIn: number; names: string[] }) {
  const auth = await getServerSession(authOptions)
  if (!auth?.user?.email) throw new Error('Sign in to save a Cashier table.')
  const state = createCashierState(input)
  const game = await prisma.game.upsert({ where: { slug: 'cashier' }, update: {}, create: { slug: 'cashier', name: 'Cashier' } })
  const room = await prisma.gameSession.create({ data: {
    gameId: game.id, code: randomUUID(), mode: 'local', status: 'active', hostEmail: auth.user.email,
    boardState: state as unknown as Prisma.InputJsonValue,
  } })
  revalidatePath('/games/cashier')
  revalidatePath('/history')
  return { id: room.id }
}

export async function updateCashier(sessionId: string, revision: number, action: CashierAction | { type: 'undo' }, note = '') {
  const { room } = await requireRoomHost(sessionId)
  if (room.game.slug !== 'cashier' || room.mode !== 'local' || room.status !== 'active') throw new Error('This is not an open local Cashier table.')
  const saved = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true } })
  const state = saved?.boardState as CashierState | null
  if (!state || state.kind !== 'cashier') throw new Error('Cashier table not found.')
  if (state.revision !== revision) return { ok: false, state, message: 'This table changed in another tab. The latest totals are shown; review them before trying again.' }
  const at = new Date().toISOString()
  const next = action.type === 'undo' ? undoCashierEvent(state, at) : appendCashierEvent(state, { id: randomUUID(), at, action, note })
  const updated = await prisma.gameSession.updateMany({
    where: { id: sessionId, status: 'active', boardState: { equals: saved!.boardState as Prisma.InputJsonValue } },
    data: { boardState: next as unknown as Prisma.InputJsonValue },
  })
  if (!updated.count) {
    const latest = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { boardState: true } })
    return { ok: false, state: (latest?.boardState as CashierState) ?? state, message: 'Another update was saved first. Review the refreshed totals and try again.' }
  }
  revalidatePath(`/room/${sessionId}/play`)
  revalidatePath('/games/cashier')
  return { ok: true, state: next, message: action.type === 'undo' ? 'Last transaction undone.' : 'Saved.' }
}
