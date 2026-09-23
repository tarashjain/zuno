import Link from 'next/link'
import { joinRoomByCode } from '@/app/actions'

export default function JoinPage({
  searchParams,
}: {
  searchParams: { error?: string; code?: string }
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🎮</div>
        <h1 className="text-3xl font-black tracking-tight mb-2">Join a Room</h1>
        <p className="text-[var(--muted)] font-medium">
          Enter the room code from whoever started the game.
        </p>
      </div>

      <form action={joinRoomByCode} className="flex flex-col gap-3">
        <input
          type="text"
          name="code"
          placeholder="e.g. HKMPQR or 837294"
          required
          maxLength={6}
          autoFocus
          autoComplete="off"
          defaultValue={searchParams.code ?? ''}
          className="p-4 text-center text-2xl tracking-[0.3em] uppercase border-2 border-[var(--border)] rounded-xl bg-[var(--paper)] font-extrabold outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          type="submit"
          className="bg-[var(--accent)] text-white py-3.5 rounded-xl font-bold hover:brightness-110 transition-all shadow-[0_2px_0_#b83208]"
        >
          Join Room →
        </button>
      </form>

      {searchParams.error === 'notfound' && (
        <p className="text-center text-sm font-bold text-[#dc2626] mt-4">
          No room found with that code. Double check with whoever started the game.
        </p>
      )}
      {searchParams.error === 'empty' && (
        <p className="text-center text-sm font-bold text-[#dc2626] mt-4">
          Enter a room code first.
        </p>
      )}

      <p className="text-center text-xs text-[var(--muted)] mt-8">
        <Link href="/" className="text-[var(--accent)] font-bold hover:underline">
          ← Back home
        </Link>
      </p>
    </div>
  )
}
