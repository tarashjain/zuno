# CLAUDE.md — Development Guide

## Project Overview
**Zuno** is a party game hub built with Next.js, Prisma, and NextAuth. It supports shared-device games, share-code rooms, local score and buy-in tracking, and a standalone random option picker. Not every feature uses multiplayer rooms or live synchronization.

## Tech Stack
- **Frontend**: Next.js 14 (React 18, Server Components)
- **Backend**: Node.js + Prisma ORM
- **Database**: PostgreSQL (Neon)
- **Auth**: NextAuth.js (credentials-based)
- **Real-time**: Custom `useLiveBoard` hook (polling-based state sync)
- **Styling**: Tailwind CSS

## Current State

### Games Implemented
1. **Imposter** (complete) - Find the imposter by description
2. **Wavelength** (fixed) - Guess target on spectrum with psychic clues
3. **Bollywood Codenames** (complete) - Team-based word cluing game
4. **5-Second Rule** - Timed category prompts; card data lives in `prisma/five-second-rule-cards.ts`
5. **Farkle** - Dice game (basic)
6. **Judgement** - Card game (basic)
7. **100 Points** - Track round scores and eliminate players at 100 points
8. **Score Keeper** - Track cumulative scores, including negative scores
9. **Scrabble** - Word-tile board game with scoring
10. **Bollywood Beats** - Team song-charades game with an era wheel and acting timer
11. **Kids n Play** - Local games defined in `lib/kids-games.ts`, including Hue Perfect, Say the Color, Don't Say Yes or No, and Wrong Answers Only; signed-in users can save completed results
12. **Cashier** - Persistent local poker buy-in ledger, controlled by one signed-in manager

**Tiny Decision** is a separate tool at `/tiny-decision`, not a room-based game.

### Recent Fixes
- Fixed Imposter word refresh in share-code rounds (cleared stale cache on new round)
- Fixed Wavelength game flow (now has proper phases: psychic-set → team-guess → revealed)
- Improved Wavelength graphics (gradient spectrum, better visual hierarchy)
- Sign-in redirect fixed (uses `window.location.href` for full page reload)
- Added Cashier under Card Games with the existing game-page layout and styling
- Added Tiny Decision with equal/custom probabilities, inline errors, animated picks, reduced-motion support, and 10 random funny verdicts
- Positioned Tiny Decision after Score Keeper in desktop/mobile navigation, added its icon, and fixed Score Keeper's orange active-page highlight
- Hardened server-side room/game authorization and replaced unsigned guest IDs with signed, room-specific cookies
- Added host-issued guest recovery links and host removal of stranded lobby players; failed joins roll back player creation
- Improved Bollywood Beats wheel animation: `lib/bollywood-beats.ts` calculates the correct landing from any current rotation, including sector jitter, with at least six full turns and a shared 5.2-second duration

### Database
Use `prisma/schema.prisma` as the schema reference and `prisma/seed.ts` for current seed data, including game entries and question/word pools. Do not assume historical seed counts are current.

Cashier stores its ledger in `GameSession.boardState`, not `SessionPlayer` or `Score` records. It upserts its game entry when creating the first table, so no Cashier-specific migration or seed is required.

### Environment Notes
- Corporate Zscaler certificate inspection may block npm registry access. Configure `NODE_EXTRA_CA_CERTS` with the trusted corporate CA when needed.
- `NEXTAUTH_SECRET` is required for authentication, guest joins, and recovery-token signing. Do not print or commit values from `.env` or `.env.local`.

## How to Develop Locally

### Setup
```bash
git clone https://github.com/tarashjain/zuno.git
cd zuno

# Create .env.local
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Install dependencies (may require NODE_EXTRA_CA_CERTS if behind proxy)
npm install

# Sync schema & seed
npx prisma db push
npm run db:seed

# Run dev server
npm run dev
```

### Key Files
- `app/` — Next.js app directory (pages, routes, actions)
- `components/games/` — Game components (ImposterBoard, WavelengthBoard, etc.)
- `app/actions/` — Server actions (game logic, real-time updates)
- `lib/db.ts` — Prisma client
- `lib/auth.ts` — NextAuth config
- `lib/room-auth.ts` — Room actor/host authorization helpers
- `lib/player-token.ts` — Signed guest and recovery tokens
- `app/actions/player-recovery.ts` — Host-issued recovery and guest redemption
- `lib/room-expiry.ts` — Shared active-room expiry policy
- `lib/cashier.ts` — Cashier ledger validation, event replay, and undo
- `app/actions/cashier.ts` — Host-only Cashier creation and updates
- `components/games/Cashier*.tsx` — Setup, ledger, entry forms, and saved tables
- `components/TinyDecision.tsx` / `components/TinyDecision.module.css` — Random picker and animation
- `lib/bollywood-beats.ts` — Wheel landing calculation and animation duration
- `tests/*.test.cjs` / `tests/load-ts.cjs` — Node test runner suites and TypeScript loader
- `prisma/schema.prisma` — Database schema
- `tailwind.config.ts` — Styling config

### Game Development Pattern
1. Create game component in `components/games/GameName.tsx`
2. Add server actions in `app/actions/game-name.ts`
3. Use `useLiveBoard` for games that need shared state sync; local tools have their own state flow
4. Store game state in `gameSession.boardState` (public) and `secretState` (hidden)
5. Implement phases: setup → play → end

### Cashier Invariants & UI

- Routes: `/games/cashier`, `/games/cashier/new`, and `/room/[id]/play`. Generic room creation redirects Cashier to its dedicated setup; no share-code mode.
- Only the signed-in owner may view or mutate the ledger. Local means one manager controls play; records are saved in PostgreSQL and saves require a connection.
- Setup supports 1–20 initial players, a starting buy-in **per player**, and an automatically calculated total. Table name, amount, and player names start empty with grey example placeholders. The editable unit defaults to `chips`; newly added name fields stay empty.
- Match existing card-game headers, orange actions, and cream/white panels. Do not restore the removed `Local game · One manager · No expiry` table subtitle.
- Store amounts as integer hundredths; parse at most two decimal places. Keep calculations in `lib/cashier.ts` and validate on the server.
- Support standard/custom rebuys, late additions, buy-in transfers, removal with transfer to a player or bank, final cash-outs, undo, transaction notes/history, and CSV summary export.
- Transfers reassign recorded buy-ins without adding funds. Removal archives a player and retains history. Buy-ins are not live chip stacks after each hand.
- Bank available = total buy-ins minus cash-outs. Payouts may exceed a player's own buy-in but cannot exceed available funds.
- Undo marks the latest active event undone and replays the ledger; retain the audit history.
- Preserve revision checks and the atomic database comparison of the previous board state to prevent stale tabs from overwriting updates.
- Saved tables appear on Cashier and My Games. `lib/room-expiry.ts` exempts Cashier and Score Keeper from the two-hour active-room expiry.

### Tiny Decision Behavior

- Accept 2–12 named options, with equal chances by default or custom percentages totaling 100%.
- Show inline errors for invalid probabilities; do not reintroduce the removed odds bar.
- Use browser crypto randomness for the weighted pick and random verdict. Each pick is independent.
- Prevent duplicate picks during the animation, clean up its timer on unmount, and respect reduced-motion preferences.
- Keep its navigation link after Score Keeper and retain active-page highlighting.

### Room Authorization & Guest Recovery

- Use `requireRoomActor` / `requireRoomHost` and validate room status, game type, and player membership before writes. A room code alone does not authorize mutations.
- Guest cookies are signed, room-specific, HTTP-only, and expire after 12 hours. Never accept legacy unsigned player IDs as identity.
- Hosts can issue private, 10-minute recovery links for existing players in lobby or active share-code rooms. Recovery restores the existing player; it does not create a duplicate.
- Hosts can remove stranded players from a lobby. Keep host checks on removal and local-player creation.
- `joinSession` validates the signing configuration before inserting and wraps creation plus cookie signing/setting in a transaction so failures do not leave orphaned players.

## Preferences & Conventions

### Code Style
- Prefer functional components + hooks
- Use TypeScript types for game state
- Keep components under 300 lines; extract helpers if needed
- No unnecessary comments; only explain *why*, not *what*
- Use Tailwind utility classes (no custom CSS unless unavoidable)

### Game Rules
- Implement rules as accurately as possible (check rule definitions before coding)
- Use proper game terminology (e.g., "Psychic", "Clue", "Spymaster")
- Design UI to match physical game flow where possible

### Git Commits
- One logical change per commit
- Message format: `verb: short description` (e.g., `Fix Imposter word refresh`)
- Include context in body if non-obvious

### Testing

```bash
npm test
npx tsc --noEmit
npm run build
```

- Regression suites cover authorization, signed tokens, guest recovery, failed-join rollback, Cashier accounting/concurrent updates/expiry, and Bollywood Beats wheel landing from different rotations and jitter values.
- Test both "local" (pass-and-play) and "share-code" (remote) modes for features that support both; Cashier is local only.
- Verify state syncs across multiple clients
- Check sign-in/sign-out flow

## Room Code Format
Shareable rooms use a 6-character code that is **all letters** (e.g. `HKMPQR`, excluding ambiguous I/O) or **all digits** (e.g. `837294`, excluding ambiguous 0/1), chosen randomly per room and stored on `GameSession.code`. Never mixed alphanumeric. Generated in `lib/room-code.ts`. Shareable from the room lobby via Message (SMS) or WhatsApp buttons. Non-shareable records such as Cashier tables and saved Kids n Play results use UUID values instead.

## Scoring System
- Games award points; stored in `Score` table
- Score Keeper tracks and displays cumulative player scores
- Each score record has: `playerId`, `points`, `round`, `notes`
- Cashier uses its own ledger in `boardState`; do not model buy-ins or payouts as game scores

## Scope to Establish Before Working

Use the request and existing code to establish these points; ask only when information is missing.
1. Which game or feature are you fixing/adding?
2. Is it a rules issue, UI issue, or sync issue?
3. Does it affect local (single-device) or share-code (remote) mode?
4. Need to modify database schema?

---
**Last updated**: 2026-11-13
