# Zuno — Party Game Hub

A Next.js 14 party game scorekeeper with Neon (PostgreSQL) database, deployable to Vercel.

## Games Included

- 🎲 **Farkle** — Dice banking game with per-player score tracking
- 🃏 **Judgement** — Bid & win tricks card game
- 💯 **100 Points** — Bid & win tricks variant
- 🕵️ **Imposter** — Find the imposter word game
- 🎬 **Bollywood Codenames** — Bollywood-themed word spy game
- ⏱️ **5 Second Rule** — Name 3 things in a category before the 5-second timer runs out
- 📝 **Score Keeper** — General-purpose round-by-round scorecard for any game

---

## Setup

### 1. Clone & Install

```bash
git clone <your-repo>
cd zuno
npm install
```

### 2. Create a Neon Database

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project
3. Copy the **Connection string** (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and paste your Neon connection string:

```env
DATABASE_URL="postgresql://user:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

### 4. Push Schema & Seed

```bash
npm run db:push      # creates tables in Neon
npm run db:seed      # seeds games + word lists
```

(These also run automatically as part of `npm run build`, so this step is mainly useful for local development before `npm run dev`.)

### 5. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Vercel

### Option A: Vercel CLI

```bash
npm i -g vercel
vercel
```

### Option B: GitHub Import

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repo
4. Under **Environment Variables**, add:
   - `DATABASE_URL` → your Neon connection string
5. Click **Deploy**

The `build` script (`prisma generate && prisma db push --accept-data-loss && prisma db seed && next build`) pushes the schema and re-seeds games + word lists automatically on every deploy — no manual step needed. Seeding is safe to re-run: games are upserted and word banks are cleared and recreated, so player/session/score data is never touched. `--accept-data-loss` is needed because `db push` can't prompt for confirmation in a non-interactive CI build; it doesn't mean schema changes here are actually destructive — check any new migration for genuinely destructive changes (dropped/narrowed columns) before relying on this blindly.

---

## Project Structure

```
zuno/
├── app/
│   ├── page.tsx                  # Homepage — pick a game
│   ├── actions.ts                # Create session server action
│   ├── actions/score.ts          # Score + player server actions
│   └── room/[id]/
│       ├── page.tsx              # Lobby
│       └── play/page.tsx         # Game engine router
├── components/games/
│   ├── FarkleBoard.tsx
│   ├── JudgementBoard.tsx
│   ├── ImposterBoard.tsx
│   ├── BollywoodCodenames.tsx
│   ├── FiveSecondRuleBoard.tsx
│   └── ScorekeeperBoard.tsx
├── lib/db.ts                     # Prisma singleton
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── .env.example
```
# zuno
