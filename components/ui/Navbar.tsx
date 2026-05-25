'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const CATEGORIES = [
  {
    label: 'Dice Games',
    emoji: '🎲',
    games: [
      { name: 'Farkle', slug: 'farkle', desc: 'Bank points before you farkle' },
    ],
  },
  {
    label: 'Card Games',
    emoji: '🃏',
    games: [
      { name: 'Judgement',  slug: 'judgement-card-game', desc: 'Bid and win tricks' },
      { name: '100 Points', slug: '100-points',           desc: 'Bid variant scoring' },
    ],
  },
  {
    label: 'Word & Party',
    emoji: '🎉',
    games: [
      { name: 'Imposter',            slug: 'imposter',             desc: 'Find the imposter' },
      { name: 'Bollywood Codenames', slug: 'bollywood-code-names', desc: 'Bollywood spy words' },
    ],
  },
]

function DropdownMenu({ category, onClose }: { category: typeof CATEGORIES[0]; onClose: () => void }) {
  return (
    <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          {category.emoji} {category.label}
        </span>
      </div>
      {category.games.map((game) => (
        <Link
          key={game.slug}
          href={`/games/${game.slug}`}
          onClick={onClose}
          className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--border)] transition-colors group"
        >
          <div>
            <div className="font-bold text-sm text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              {game.name}
            </div>
            <div className="text-xs text-[var(--muted)] mt-0.5">{game.desc}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenCat(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      <nav
        ref={navRef}
        className="sticky top-0 z-40 h-16 bg-[var(--surface)] shadow-sm md:bg-[var(--surface)]/95 md:backdrop-blur-md border-b border-[var(--border)] flex items-center px-4 md:px-6"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-6 flex-shrink-0" onClick={() => setOpenCat(null)}>
          <span className="text-xl font-black tracking-tighter leading-none">
            ZU<span className="text-[var(--accent)]">N</span>O
          </span>
        </Link>

        {/* Desktop category nav */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {CATEGORIES.map((cat) => (
            <div key={cat.label} className="relative">
              <button
                onClick={() => setOpenCat(openCat === cat.label ? null : cat.label)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors
                  ${openCat === cat.label
                    ? 'bg-[var(--border)] text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)]'
                  }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${openCat === cat.label ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openCat === cat.label && (
                <DropdownMenu category={cat} onClose={() => setOpenCat(null)} />
              )}
            </div>
          ))}
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          {session ? (
            <>
              <Link
                href="/history"
                className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-colors px-2 py-1"
              >
                My Games
              </Link>
              <div className="flex items-center gap-2 bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3 py-1.5">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold text-white">
                    {session?.user?.name?.[0]?.toUpperCase() ?? session?.user?.email?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold max-w-[120px] truncate">
                  {session?.user?.name ?? session?.user?.email}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--red)] transition-colors px-2 py-1"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-colors px-3 py-2"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="text-sm font-bold bg-[var(--accent)] text-white px-4 py-2 rounded-xl hover:brightness-110 transition-all"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile right: auth shortcut + hamburger */}
        <div className="flex md:hidden items-center gap-2 ml-auto">
          {!session && (
            <Link href="/auth/signin" className="text-sm font-bold text-[var(--accent)]">
              Sign in
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[var(--surface2)] transition-colors"
            aria-label="Menu"
          >
            <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-64px)] w-80 max-w-[90vw] bg-[var(--surface)] shadow-2xl border-l border-[var(--border)] z-40 md:hidden transition-transform duration-300 ease-out overflow-y-auto
          ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-4 space-y-1">
          {/* Game categories */}
          {CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <button
                onClick={() => setMobileExpanded(mobileExpanded === cat.label ? null : cat.label)}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[var(--surface2)] transition-colors"
              >
                <span className="font-bold text-base flex items-center gap-2">
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </span>
                <svg
                  className={`w-4 h-4 text-[var(--muted)] transition-transform ${mobileExpanded === cat.label ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {mobileExpanded === cat.label && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-[var(--border)] pl-3">
                  {cat.games.map((game) => (
                    <Link
                      key={game.slug}
                      href={`/games/${game.slug}`}
                      className="flex flex-col px-3 py-2.5 rounded-lg hover:bg-[var(--surface2)] transition-colors"
                    >
                      <span className="font-semibold text-sm text-[var(--text)]">{game.name}</span>
                      <span className="text-xs text-[var(--muted)] mt-0.5">{game.desc}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-[var(--border)] my-3" />

          {/* Auth section */}
          {session ? (
            <>
              <div className="flex items-center gap-3 px-3 py-3 bg-[var(--surface2)] rounded-xl mb-2">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" className="w-9 h-9 rounded-full" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-sm font-bold text-white">
                    {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                <div className="min-w-0 overflow-hidden">
                  <div className="font-bold text-sm truncate">{session?.user?.name}</div>
                  <div className="text-xs text-[var(--muted)] truncate">{session?.user?.email}</div>
                </div>
              </div>
              <Link
                href="/history"
                className="flex items-center gap-2 px-3 py-3 rounded-xl hover:bg-[var(--surface2)] font-semibold transition-colors"
              >
                📋 My Game History
              </Link>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-2 px-3 py-3 rounded-xl hover:bg-[var(--surface2)] font-semibold text-[var(--red)] transition-colors text-left"
              >
                ← Sign out
              </button>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <Link
                href="/auth/signin"
                className="block text-center w-full py-3 rounded-xl border border-[var(--border)] font-bold hover:border-[var(--accent)] transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="block text-center w-full py-3 rounded-xl bg-[var(--accent)] font-bold text-white hover:brightness-110 transition-all"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes animate-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: animate-in 0.15s ease; }
      `}</style>
    </>
  )
}
