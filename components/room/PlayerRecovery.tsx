'use client'

import { useState } from 'react'
import { issuePlayerRecovery } from '@/app/actions/player-recovery'

export default function PlayerRecovery({ sessionId, players }: { sessionId: string; players: { id: number; guestName: string }[] }) {
  const [selected, setSelected] = useState('')
  const [link, setLink] = useState<{ playerId: string; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const visibleLink = link?.playerId === selected && players.some(player => String(player.id) === selected) ? link.url : ''

  async function generate() {
    setBusy(true)
    setMessage('')
    setLink(null)
    try {
      const { token } = await issuePlayerRecovery(sessionId, Number(selected))
      setLink({ playerId: selected, url: `${window.location.origin}/room/${sessionId}/recover#${token}` })
    } catch {
      setMessage('Could not create a recovery link. Refresh the page and try again.')
    } finally { setBusy(false) }
  }

  return <details className="my-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
    <summary className="cursor-pointer font-bold">Help a player reconnect</summary>
    <p className="my-3 text-sm text-[var(--muted)]">Choose the player you recognize and send the link privately to them. It restores their existing player and scores. Anyone with this link can use it for 10 minutes.</p>
    <div className="flex flex-col sm:flex-row gap-3">
      <select aria-label="Player to reconnect" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setLink(null); setMessage('') }} className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-3">
        <option value="">Choose a player</option>
        {players.map(player => <option key={player.id} value={player.id}>{player.guestName}</option>)}
      </select>
      <button type="button" onClick={generate} disabled={busy || !players.some(player => String(player.id) === selected)} className="rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-white disabled:opacity-40">{busy ? 'Creating…' : 'Create recovery link'}</button>
    </div>
    {visibleLink && <div className="mt-3 flex flex-col sm:flex-row gap-3">
      <input aria-label="Private recovery link" readOnly value={visibleLink} onFocus={event => event.target.select()} className="min-w-0 flex-1 rounded-xl border border-[var(--border)] p-3 text-sm" />
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(visibleLink); setMessage('Link copied. Send it privately to this player.') }
        catch { setMessage('Select and copy the link above.') }
      }} className="rounded-xl border border-[var(--border)] px-4 py-3 font-bold">Copy link</button>
    </div>}
    <p role="status" className="mt-3 text-sm">{message}</p>
  </details>
}
