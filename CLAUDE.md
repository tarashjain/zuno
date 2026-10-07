# CLAUDE.md — Development Guide

## Project Overview
**Zuno** is a real-time multiplayer party game hub built with Next.js, Prisma, and NextAuth. Players join rooms by code, form teams, and play games like Imposter, Wavelength, Bollywood Codenames, 5-Second Rule, Farkle, and more.

## Tech Stack
- **Frontend**: Next.js 14+ (React, Server Components)
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
4. **5-Second Rule** (incomplete) - Rapid-fire category questions
5. **Farkle** - Dice game (basic)
6. **Judgement** - Card game (basic)
7. **100 Points** - Card game (basic)
8. **Score Keeper** - Track game scores (basic)

### Recent Fixes
- Fixed Imposter word refresh in share-code rounds (cleared stale cache on new round)
- Fixed Wavelength game flow (now has proper phases: psychic-set → team-guess → revealed)
- Improved Wavelength graphics (gradient spectrum, better visual hierarchy)
- Sign-in redirect fixed (uses `window.location.href` for full page reload)

### Database
Three new tables added for Imposter/Wavelength/Codenames:
- `BollywoodWord` (172 words)
- `ImposterPair` (119 pairs)
- `WavelengthSpectrum` (114 spectra)

Seed script: `prisma/manual-seed.sql` (run directly on Postgres if npm blocked)

### Known Blockers
- **npm install**: Corporate Zscaler proxy blocks npm registry (SSL cert inspection). Workaround: use `NODE_EXTRA_CA_CERTS` or seed database directly via SQL script.
- **5-Second Rule**: Only placeholder cards; needs 1000+ questions added to database.

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
- `prisma/schema.prisma` — Database schema
- `tailwind.config.ts` — Styling config

### Game Development Pattern
1. Create game component in `components/games/GameName.tsx`
2. Add server actions in `app/actions/game-name.ts`
3. Use `useLiveBoard` hook for real-time state sync
4. Store game state in `gameSession.boardState` (public) and `secretState` (hidden)
5. Implement phases: setup → play → end

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
- Test in both "local" (pass-and-play) and "share-code" (remote) modes
- Verify state syncs across multiple clients
- Check sign-in/sign-out flow

## Room Code Format
Rooms use a 6-character code that is **all letters** (e.g. `HKMPQR`, excluding ambiguous I/O) or **all digits** (e.g. `837294`, excluding ambiguous 0/1), chosen randomly per room and stored on `GameSession.code`. Never mixed alphanumeric. Generated in `lib/room-code.ts`. Shareable from the room lobby via Message (SMS) or WhatsApp buttons.

## Scoring System
- Games award points; stored in `Score` table
- Score Keeper tracks and displays cumulative player scores
- Each score record has: `playerId`, `points`, `round`, `notes`

## Questions to Ask Before Working
1. Which game or feature are you fixing/adding?
2. Is it a rules issue, UI issue, or sync issue?
3. Does it affect local (single-device) or share-code (remote) mode?
4. Need to modify database schema?

---
**Last updated**: 2026-09-22
