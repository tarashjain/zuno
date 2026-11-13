'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { redeemPlayerRecovery } from '@/app/actions/player-recovery'

export default function RecoverPlayer({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setToken(window.location.hash.slice(1)) }, [])

  async function recover() {
    setBusy(true)
    setError('')
    try {
      const result = await redeemPlayerRecovery(params.id, token)
      if (result.ok && result.destination) {
        window.history.replaceState(null, '', window.location.pathname)
        router.replace(result.destination)
        router.refresh()
        return
      }
      setError(result.reason ?? 'Could not restore access. Ask the host for a new link.')
    } catch { setError('Could not restore access. Please try again.') }
    setBusy(false)
  }

  return <main className="mx-auto max-w-lg px-4 py-12">
    <h1 className="text-3xl font-bold">Get back to your game</h1>
    <p className="my-5 text-[var(--muted)]">Open the private recovery link your host sent you on the device you want to play on. Your existing player and scores will be restored.</p>
    <button type="button" onClick={recover} disabled={!token || busy} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-white disabled:opacity-40">{busy ? 'Reconnecting…' : 'Restore my access'}</button>
    {!token && <p className="mt-4 text-sm">Ask the host to open “Help a player reconnect” in the lobby or on the game board and send you a recovery link.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-[var(--red)]">{error}</p>}
  </main>
}
