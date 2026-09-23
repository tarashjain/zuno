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

### Play Modes
- **Local** (Pass & Play) — One device, players pass it around
- **Share Code** — Remote play via room code (e.g., `AB123456`)

### Authentication
- Create an account to save scores and host rooms
- Sign in to join existing rooms

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
```

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
- Room access is controlled by room code + user auth
- Game state is validated on the server

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

## 📧 Support

For bugs or questions, open an issue on [GitHub](https://github.com/tarashjain/zuno/issues).

---

**Made with ❤️ for fun party nights**
