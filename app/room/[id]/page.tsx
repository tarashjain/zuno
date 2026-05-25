import prisma from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { joinSession, startSession } from '@/app/actions/score'

export default async function GameRoom({ params }: { params: { id: string } }) {
  const session = await prisma.gameSession.findUnique({
    where: { id: params.id },
    include: { game: true, players: true },
  })

  if (!session) return notFound()

  // Auto-redirect if already started
  if (session.status === 'active') redirect(`/room/${params.id}/play`)

  const roomCode = params.id.split('-')[0].toUpperCase()

  return (
    <main className="max-w-2xl mx-auto p-6 md:p-10">
      {/* Header */}
      <div className="flex items-baseline gap-3 mb-6 pb-4 border-b-2 border-[var(--ink)]">
        <a href="/" className="text-3xl font-extrabold tracking-tight leading-none">
          ZU<span className="text-[var(--accent)]">N</span>O
        </a>
        <span className="text-[var(--muted)] font-semibold text-sm">| {session.game.name}</span>
      </div>

      {/* Room code */}
      <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Room Code</p>
          <p className="text-3xl font-extrabold tracking-widest mt-1">{roomCode}</p>
        </div>
        <span className="text-4xl">🎮</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Join form */}
        <div className="bg-white border-2 border-[var(--border)] rounded-xl p-5">
          <h2 className="text-lg font-extrabold mb-4">Join Game</h2>
          <form
            action={async (fd: FormData) => {
              'use server'
              const name = fd.get('guestName') as string
              await joinSession(params.id, name)
            }}
            className="flex flex-col gap-3"
          >
            <input
              type="text"
              name="guestName"
              placeholder="Your name…"
              required
              className="p-3 border-2 border-[var(--border)] rounded-xl bg-[var(--paper)] font-semibold outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              type="submit"
              className="bg-[#16a34a] text-white py-3 rounded-xl font-bold hover:brightness-110 transition-all shadow-[0_2px_0_#166534]"
            >
              Join Lobby
            </button>
          </form>
        </div>

        {/* Player list */}
        <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-5">
          <h2 className="text-lg font-extrabold mb-4">
            Players{' '}
            <span className="text-[var(--muted)] font-semibold text-base">
              ({session.players.length})
            </span>
          </h2>

          {session.players.length === 0 ? (
            <p className="text-sm text-[var(--muted)] font-semibold">No players yet…</p>
          ) : (
            <ul className="space-y-2 mb-5">
              {session.players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 font-bold bg-white border-2 border-[var(--border)] rounded-lg px-3 py-2"
                >
                  <span>👤</span> {p.guestName}
                </li>
              ))}
            </ul>
          )}

          {session.players.length >= 1 && (
            <form
              action={async () => {
                'use server'
                await startSession(params.id)
                redirect(`/room/${params.id}/play`)
              }}
            >
              <button
                type="submit"
                className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-bold hover:brightness-110 transition-all shadow-[0_2px_0_#b83208]"
              >
                Start Game →
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Refresh hint */}
      <p className="text-center text-xs text-[var(--muted)] font-semibold mt-6">
        Refresh this page after others join to see them appear.
      </p>
    </main>
  )
}
