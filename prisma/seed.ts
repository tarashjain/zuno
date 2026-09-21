import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BOLLYWOOD_WORDS = [
  "Sholay", "Amitabh", "DDLJ", "SRK", "Mumbai", "Lagaan", "Kajol", "Samosa",
  "Rickshaw", "Dangal", "Kapoor", "Dance", "Romance", "Villain", "Hero", "Don",
  "Chai", "Curry", "Bhai", "Devdas", "Baahubali", "Sari", "Bindi", "Gully",
  "Khans", "Dupatta", "Baraat", "Mehendi", "Sangeet", "Train", "Switzerland",
  "Police", "Inspector", "Thappad", "Mela", "Judwaa", "Reincarnation", "Haveli",
  "Dhaba", "Jalebi", "Bhangra", "Garba", "Qawwali", "Pooja", "Aamir", "Salman",
  "Kareena", "Alia", "Ranveer", "Deepika", "Priyanka",
]

const IMPOSTER_PAIRS = [
  ["Ocean", "Lake"], ["Guitar", "Violin"], ["School", "University"],
  ["Hospital", "Clinic"], ["Lion", "Tiger"], ["Pizza", "Burger"],
  ["Snow", "Rain"], ["Library", "Bookstore"], ["Theater", "Cinema"],
  ["Sofa", "Armchair"], ["Clock", "Watch"], ["Bridge", "Tunnel"], ["Mountain", "Hill"],
]

async function main() {
  // Upsert scoring games
  for (const g of [
    { name: 'Farkle', slug: 'farkle' },
    { name: '100 Points', slug: '100-points' },
    { name: 'Judgement Card Game', slug: 'judgement-card-game' },
  ]) {
    await prisma.game.upsert({ where: { slug: g.slug }, update: {}, create: g })
  }

  // Imposter
  const imposterGame = await prisma.game.upsert({
    where: { slug: 'imposter' },
    update: {},
    create: { name: 'Imposter', slug: 'imposter' },
  })

  // Bollywood Codenames
  const bollywoodGame = await prisma.game.upsert({
    where: { slug: 'bollywood-code-names' },
    update: {},
    create: { name: 'Bollywood Codenames', slug: 'bollywood-code-names' },
  })

  // Clear and re-seed words
  await prisma.gameWord.deleteMany({ where: { gameId: { in: [imposterGame.id, bollywoodGame.id] } } })

  await prisma.gameWord.createMany({
    data: BOLLYWOOD_WORDS.map(word => ({ gameId: bollywoodGame.id, word })),
  })

  await prisma.gameWord.createMany({
    data: IMPOSTER_PAIRS.map(([word, pairWord]) => ({ gameId: imposterGame.id, word, pairWord })),
  })

  console.log('✅ Seed complete!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
