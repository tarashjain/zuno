import prisma from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import LobbyLive from '@/components/room/LobbyLive'
import ShareCodeButtons from '@/components/room/ShareCodeButtons'
import { getRoomActor } from '@/lib/room-auth'

export default async function GameRoom({ params }: { params: { id: string } }) {
  let session = await prisma.gameSession.findUnique({
    where: { id: params.id },
    include: { game: true, players: { orderBy: { joinedAt: 'asc' }, include: { scores: true } } },
  })

  if (!session) return notFound()

  // Auto-close games older than 2 hours on page load as well.
  // Score Keeper is exempt — it's designed to run for an entire multi-day game.
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000
  if (
    session.status === 'active' &&
    session.game.slug !== 'score-keeper' &&
    Date.now() - session.createdAt.getTime() > TWO_HOURS_MS
  ) {
    await prisma.gameSession.update({ where: { id: params.id }, data: { status: 'completed' } })
    session.status = 'completed'
  }

  const actor = await getRoomActor(params.id)

  // Only verified room members may enter an active game.
  if (session.status === 'active') {
    if (actor.authorized) redirect(`/room/${params.id}/play`)
    return notFound()
  }

  // Completed games show a summary — never allow rejoining.
  if (session.status === 'completed') {
    const topScores = session.players.map(p => ({
      name: p.guestName,
      total: p.scores?.reduce((sum: number, s: { points: number }) => sum + s.points, 0) ?? 0,
    })).sort((a, b) => b.total - a.total)
    const maxScore = topScores[0]?.total ?? 0
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-6 pb-4 border-b-2 border-[var(--ink)]">
          <a href="/" className="text-3xl font-extrabold tracking-tight leading-none">
            ZU<span className="text-[var(--accent)]">N</span>O
          </a>
          <span className="text-[var(--muted)] font-semibold text-sm">| {session.game.name}</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Game Ended</p>
        <h1 className="text-3xl font-black mb-1">{session.game.name}</h1>
        <p className="text-sm text-[var(--muted)] mb-8">
          {new Date(session.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        {topScores.length > 0 ? (
          <ul className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] mb-8">
            {topScores.map((p, i) => (
              <li key={p.name} className={`flex items-center justify-between px-5 py-4 ${p.total === maxScore && maxScore > 0 ? 'bg-yellow-50' : ''}`}>
                <span className="font-bold">{i === 0 && maxScore > 0 ? '🏆 ' : ''}{p.name}</span>
                <span className="text-xl font-black">{p.total} pt{p.total !== 1 ? 's' : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--muted)] mb-8">No scores recorded for this session.</p>
        )}
        <a href="/history" className="inline-block px-6 py-3 bg-[var(--accent)] text-white font-bold rounded-xl hover:brightness-110 transition-all">
          ← Back to My Games
        </a>
      </main>
    )
  }

  const isLocal = session.mode === 'local'
  const roomCode = session.code

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
            <ShareCodeButtons code={roomCode} gameName={session.game.name} />
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
