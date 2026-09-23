import { PrismaClient } from '@prisma/client'
import { FIVE_SECOND_RULE_GENERAL_CARDS } from './five-second-rule-cards'
import { BOLLYWOOD_WORDS } from './bollywood-words'
import { IMPOSTER_PAIRS } from './imposter-pairs'
import { WAVELENGTH_SPECTRA } from './wavelength-spectra'

const prisma = new PrismaClient()

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
  await prisma.game.upsert({
    where: { slug: 'imposter' },
    update: {},
    create: { name: 'Imposter', slug: 'imposter' },
  })

  // Bollywood Codenames
  await prisma.game.upsert({
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

  // Score Keeper (general round-by-round scorecard, no word bank needed)
  await prisma.game.upsert({
    where: { slug: 'score-keeper' },
    update: {},
    create: { name: 'Score Keeper', slug: 'score-keeper' },
  })

  // Wavelength
  await prisma.game.upsert({
    where: { slug: 'wavelength' },
    update: {},
    create: { name: 'Wavelength', slug: 'wavelength' },
  })

  // Clear and re-seed 5 Second Rule cards (still on the shared GameWord table)
  await prisma.gameWord.deleteMany({ where: { gameId: fiveSecondRuleGame.id } })
  await prisma.gameWord.createMany({
    data: FIVE_SECOND_RULE_GENERAL_CARDS.map(word => ({ gameId: fiveSecondRuleGame.id, word })),
  })

  // Clear and re-seed each game's own dedicated word bank
  await prisma.bollywoodWord.deleteMany()
  await prisma.bollywoodWord.createMany({
    data: BOLLYWOOD_WORDS.map(word => ({ word })),
  })

  await prisma.imposterPair.deleteMany()
  await prisma.imposterPair.createMany({
    data: IMPOSTER_PAIRS.map(([word, pairWord]) => ({ word, pairWord })),
  })

  await prisma.wavelengthSpectrum.deleteMany()
  await prisma.wavelengthSpectrum.createMany({
    data: WAVELENGTH_SPECTRA.map(([leftLabel, rightLabel]) => ({ leftLabel, rightLabel })),
  })

  console.log('✅ Seed complete!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
