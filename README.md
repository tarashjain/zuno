# 🎮 ZUNO — Party Game Hub

A real-time multiplayer party game platform. Play word games, card games, and dice games with friends in the same room or online via room codes.

## ✨ Features

### Games
- **Imposter** — Find the secret imposter by their description of a word
- **Wavelength** — Guess where a clue points on a spectrum (0–100)
- **Bollywood Codenames** — Team-based word-cluing game (Codenames variant)
- **5-Second Rule** — Rapid-fire questions on categories (coming soon: 1000+ questions)
- **Farkle** — Push-your-luck dice game
- **Judgement** — Predict tricks in a card game
- **100 Points** — Reach 100 points first (card game)
- **Score Keeper** — Track and display game scores
- **Cashier** — Manage a local poker table’s buy-ins, rebuys, transfers, and cash-outs
- 🤐 **Don’t Say Yes or No** — Kids n Play: answer aloud without saying either word
- 🙃 **Wrong Answers Only** — Kids n Play: give silly, incorrect answers to stay in

Kids n Play games are local only: 2–8 players share one device, with question prompts,
turns, elimination, and a winner. No sign-in or database seed is needed for these games.
Game progress stays in browser memory and resets when you leave or refresh the page.

### Tiny Decision

Choose between 2–12 options at `/tiny-decision`. Equal chances are the default, or
set custom percentages that total 100%. Invalid probabilities show an inline error.
Each pick has an animated reveal and one of 10 randomly chosen funny verdicts;
reduced-motion preferences are respected. No sign-in is needed.

### Play Modes
- **Local** (Pass & Play) — One device, players pass it around
- **Share Code** — Remote play via room code, shareable by message or WhatsApp (all-letters e.g. `HKMPQR`, or all-digits e.g. `837294`)

Cashier is local only: one signed-in manager controls the table. Its records are
saved in the database, require a connection to save, and have no automatic expiry.

### Authentication
- Create an account to save scores and host rooms
- Guests can join share-code rooms with a name; a signed cookie identifies their player
- Hosts can issue private recovery links for guests who lose access

### Updates — November 13, 2026

- Added **Cashier** under Card Games, using the same game-page layout, orange buttons, and cream-and-white panels as the other card games.
- Added **Tiny Decision** with equal or custom probabilities, validation errors, animated results, and 10 random funny verdicts.
- Placed Tiny Decision after Score Keeper in desktop and mobile navigation, added its icon, and fixed Score Keeper’s orange active-page highlight.
- Hardened room authorization and game actions, added host-controlled guest recovery and lobby removal, and prevented failed joins from leaving orphaned players.
- Added regression coverage for room access, recovery, join failures, Cashier accounting, concurrent updates, and expiry rules. All 28 tests, TypeScript checks, and the production build passed for these changes.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (e.g., Neon)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/tarashjain/zuno.git
   cd zuno
   ```

2. **Create `.env.local`**
   ```bash
   DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
   NEXTAUTH_SECRET="generate-a-long-random-string-here"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

   **Note**: If behind a corporate proxy (e.g., Zscaler), you may need to set:
   ```bash
   export NODE_EXTRA_CA_CERTS=/path/to/ca-cert.pem
   ```

4. **Sync database**
   ```bash
   npx prisma db push
   ```

5. **Seed game data**
   ```bash
   npm run db:seed
   ```

6. **Start dev server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 How to Play

### Local Mode (Pass & Play)
1. Navigate to a game (e.g., `/games/imposter`)
2. Host adds players
3. Pass the device around; each player takes their turn

### Share Code Mode (Remote)
1. Create an account and sign in
2. Create or join a room via code
3. Players join on their own devices
4. Real-time game state syncs across all devices

### Example Game: Imposter
1. Host assigns or randomizes teams
2. Each player secretly learns a word (except the imposter, who gets a similar word)
3. Players describe their word without saying it
4. Vote on who is the imposter
5. Reveal and score!

### Cashier (Local Table Manager)

1. Sign in, open **Card Games → Cashier** (`/games/cashier`), and select **New Game**.
2. Enter a table name, unit or currency label, starting buy-in **per player**, and 1–20 player names. The total starting buy-in is calculated automatically.
3. Record a standard rebuy or a custom amount, and add players during the game.
4. Transfer recorded buy-ins between players or the bank. **Remove & transfer** archives a player and transfers their recorded buy-ins to another player or the bank, retaining the history.
5. Enter final cash-outs to record profit or loss. Payouts cannot exceed the bank’s available balance.
6. Use **Undo last transaction** to correct mistakes, inspect the transaction history, or export a CSV summary.
7. Reopen a saved table from Cashier or **My Games**. Cashier tables and Score Keeper games are exempt from the automatic two-hour active-room expiry.

Buy-ins record amounts taken, not chip stacks after each hand. Transfers reassign
recorded buy-ins without adding money. Bank available equals total buy-ins minus
cash-outs. Only the table’s signed-in manager can view or update its ledger.
Cashier uses the existing database schema and registers its game entry when the
first table is created; no Cashier-specific migration or seed is needed.

## 🛠️ Development

### Architecture
- **Frontend**: Next.js 14 with React Server Components
- **Backend**: Next.js API routes + Server Actions
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js

### Key Directories
```
├── app/
│   ├── games/[slug]/            # Game pages
│   ├── actions/                 # Server actions (game logic)
│   ├── auth/                    # Sign in/register pages
│   └── api/                     # API routes
├── components/
│   ├── games/                   # Game board components
│   ├── room/                    # Room-related components
│   └── ...
├── lib/
│   ├── db.ts                    # Prisma client
│   ├── auth.ts                  # NextAuth config
│   └── ...
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── seed.ts                  # Database seeding
└── public/                      # Static assets
```

### Running Tests

```bash
npm run test
npx tsc --noEmit
npm run build
```

The regression suite covers signed player tokens, guest recovery, room permissions,
failed-join rollback, and Cashier ledger operations, including stale-write protection.

### Database Migrations
```bash
# Apply schema changes
npx prisma db push

# Generate migration file
npx prisma migrate dev --name description

# Reset database (dev only)
npx prisma db push --skip-generate --force-reset
```

## 🔐 Security

- Passwords are hashed with bcrypt
- Sessions are secure and HTTP-only
- Room access uses host authentication or a signed, room-specific guest cookie; a room code alone does not authorize game updates
- Game state is validated on the server
- Guest joins validate signing configuration before inserting a player and roll back creation if signing or setting the cookie fails
- Legacy unsigned player IDs are rejected; hosts can restore guest access with a private recovery link or remove stranded players from the lobby

## 📦 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard
4. Vercel auto-deploys on push

### Other Platforms
1. Set environment variables
2. Run `npm run build`
3. Run `npm run start`

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/game-name`)
3. Make your changes
4. Commit (`git commit -m "Add game-name"`)
5. Push (`git push origin feature/game-name`)
6. Open a Pull Request

## 📝 License

MIT — Feel free to use, modify, and share!

## 💡 Roadmap

- [ ] Add 1000+ questions to 5-Second Rule
- [ ] Implement Taboo
- [ ] Add sound effects & animations
- [ ] Mobile app (React Native)
- [ ] Persistent leaderboards
- [ ] Custom room themes

## 🆘 Troubleshooting

### Database Connection Error
- Verify `DATABASE_URL` in `.env.local`
- Check that your database server is running
- For Neon, ensure IP is whitelisted

### npm install Fails
- Try: `npm install --legacy-peer-deps`
- If behind proxy: Set `NODE_EXTRA_CA_CERTS` (see Setup)
- Clear cache: `npm cache clean --force`

### Games Not Loading
- Run `npx prisma db push` to sync schema
- Run `npm run db:seed` to populate game data
- Check browser console for errors

### Guest Access or Join Problems

- Configure `NEXTAUTH_SECRET` before starting the app; it is required for both authentication and signed guest cookies.
- If an existing guest loses access, the host can create a private recovery link from the lobby or active share-code game. Links expire after 10 minutes; share them only with the intended player.
- If a stranded player is blocking a lobby, the host can remove them so they can rejoin. Legacy unsigned cookies are not automatically trusted.

## 📧 Support

For bugs or questions, open an issue on [GitHub](https://github.com/tarashjain/zuno/issues).

---

**Made with ❤️ for fun party nights**
