import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function Home() {
  const session = await getServerSession(authOptions)

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
      {/* Hero */}
      <div className="mb-14 text-center">
        <div className="inline-flex items-center gap-2 bg-[var(--surface2)] border border-[var(--border)] rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-6">
          🎮 Party Game Hub
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none mb-4">
          ZU<span className="text-[var(--accent)]">N</span>O
        </h1>
        <p className="text-[var(--muted)] text-lg md:text-xl font-medium max-w-md mx-auto mb-8">
          Score, track, and play your favourite party games — all in one place.
        </p>
        {!session && (
          <>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/auth/register"
                className="w-full sm:w-auto px-8 py-3.5 bg-[var(--accent)] text-white font-bold rounded-2xl hover:brightness-110 transition-all text-base text-center"
              >
                Create Account →
              </Link>
              <Link
                href="/auth/signin"
                className="w-full sm:w-auto px-8 py-3.5 bg-[var(--surface2)] border border-[var(--border)] font-bold rounded-2xl hover:border-[var(--accent)] transition-all text-base text-center"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm font-semibold text-[var(--muted)]">
              Have a room code?{' '}
              <Link href="/join" className="text-[var(--accent)] font-bold hover:underline">
                Join a Room →
              </Link>
            </p>
          </>
        )}
      </div>

    </div>
  )
}
