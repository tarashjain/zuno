'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function NewRoomContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameSlug = searchParams.get('game')

  useEffect(() => {
    if (!gameSlug) {
      router.push('/')
      return
    }

    // Simulate creating a room and redirecting
    const createRoom = async () => {
      try {
        // In a real app, this would call an API endpoint to create a game session
        const roomId = Math.random().toString(36).substring(7)
        router.push(`/room/${roomId}/play`)
      } catch (error) {
        console.error('Failed to create room:', error)
      }
    }

    const timer = setTimeout(createRoom, 500)
    return () => clearTimeout(timer)
  }, [gameSlug, router])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="text-center">
        <div className="text-5xl mb-6 animate-spin">🎮</div>
        <h1 className="text-2xl font-bold mb-2">Creating your game room...</h1>
        <p className="text-[var(--muted)] mb-8">Get ready to play {gameSlug}</p>
        <Link
          href="/"
          className="inline-block px-6 py-2 text-[var(--accent)] font-bold hover:underline"
        >
          ← Cancel
        </Link>
      </div>
    </div>
  )
}

export default function NewRoom() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="text-center">
          <div className="text-5xl mb-6 animate-spin">🎮</div>
          <h1 className="text-2xl font-bold mb-2">Creating your game room...</h1>
        </div>
      </div>
    }>
      <NewRoomContent />
    </Suspense>
  )
}

