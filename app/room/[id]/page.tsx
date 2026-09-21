import prisma from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import LobbyLive from '@/components/room/LobbyLive'
import { getRoomActor } from '@/lib/room-auth'

export default async function GameRoom({ params }: { params: { id: string } }) {
  const session = await prisma.gameSession.findUnique({
    where: { id: params.id },
    include: { game: true, players: { orderBy: { joinedAt: 'asc' } } },
  })

  if (!session) return notFound()

  const actor = await getRoomActor(params.id)

  // Only verified room members may enter an active game.
  if (session.status === 'active') {
    if (actor.authorized) redirect(`/room/${params.id}/play`)
    return notFound()
  }

  const isLocal = session.mode === 'local'
  const roomCode = params.id.split('-')[0].toUpperCase()

  const isHost = actor.isHost
  const myPlayerId = actor.playerId

  return (
    <main className="max-w-2xl mx-auto p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-6 pb-4 border-b-2 border-[var(--ink)]">
        <a href="/" className="text-3xl font-extrabold tracking-tight leading-none">
          ZU<span className="text-[var(--accent)]">N</span>O
        </a>
        <span className="text-[var(--muted)] font-semibold text-sm break-words">| {session.game.name}</span>
      </div>

      {/* Mode banner */}
      {isLocal ? (
        <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Local Game</p>
            <p className="text-sm font-semibold mt-1">Add every player below on this device — no code needed.</p>
          </div>
          <span className="text-4xl">🖥️</span>
        </div>
      ) : (
        <div className="bg-[var(--cream)] border-2 border-[var(--border)] rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Room Code</p>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-widest mt-1 break-all">{roomCode}</p>
            <p className="text-xs font-semibold text-[var(--muted)] mt-1">
              Share this code — each player joins from their own device via Join Room.
            </p>
          </div>
          <span className="text-4xl">📱</span>
        </div>
      )}

      {!isHost && (
        <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-3 mb-6 text-xs font-semibold text-[var(--muted)] text-center">
          Only the host who created this room can start the game.
        </div>
      )}

      <LobbyLive
        sessionId={params.id}
        mode={session.mode}
        isHost={isHost}
        initialStatus={session.status}
        initialPlayers={session.players.map(p => ({ id: p.id, guestName: p.guestName, ready: p.ready }))}
        initialMyPlayerId={myPlayerId}
      />
    </main>
  )
}
