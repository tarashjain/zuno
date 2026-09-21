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

const FIVE_SECOND_RULE_CARDS = [
  "Name 3 breakfast foods", "Name 3 Disney movies", "Name 3 things you'd find in a kitchen",
  "Name 3 famous Michaels", "Name 3 types of pasta", "Name 3 superheroes",
  "Name 3 countries in Europe", "Name 3 ice cream flavors", "Name 3 things that are red",
  "Name 3 board games", "Name 3 Bollywood actors", "Name 3 fruits",
  "Name 3 things you do before bed", "Name 3 sports played with a ball", "Name 3 things in a first aid kit",
  "Name 3 U.S. states", "Name 3 Pixar movies", "Name 3 things at a birthday party",
  "Name 3 dog breeds", "Name 3 things you'd pack for a beach trip", "Name 3 cartoon characters",
  "Name 3 things that are sticky", "Name 3 vegetables", "Name 3 things in a school bag",
  "Name 3 things in a fridge", "Name 3 Marvel movies", "Name 3 things that fly",
  "Name 3 things at a wedding", "Name 3 shows on Netflix", "Name 3 musical instruments",
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

  // 5 Second Rule
  const fiveSecondRuleGame = await prisma.game.upsert({
    where: { slug: '5-second-rule' },
    update: {},
    create: { name: '5 Second Rule', slug: '5-second-rule' },
  })

  // Clear and re-seed words
  await prisma.gameWord.deleteMany({
    where: { gameId: { in: [imposterGame.id, bollywoodGame.id, fiveSecondRuleGame.id] } },
  })

  await prisma.gameWord.createMany({
    data: BOLLYWOOD_WORDS.map(word => ({ gameId: bollywoodGame.id, word })),
  })

  await prisma.gameWord.createMany({
    data: IMPOSTER_PAIRS.map(([word, pairWord]) => ({ gameId: imposterGame.id, word, pairWord })),
  })

  await prisma.gameWord.createMany({
    data: FIVE_SECOND_RULE_CARDS.map(word => ({ gameId: fiveSecondRuleGame.id, word })),
  })

  console.log('✅ Seed complete!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
