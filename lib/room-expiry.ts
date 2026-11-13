export function roomHasExpired(slug: string, status: string, createdAt: Date, now = Date.now()) {
  return status === 'active' && !['score-keeper', 'cashier'].includes(slug) && now - createdAt.getTime() > 2 * 60 * 60 * 1000
}
