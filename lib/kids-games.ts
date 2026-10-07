export interface KidsGame {
  slug: string
  name: string
  emoji: string
  description: string
  rules: string[]
  examples: { question: string; answer: string }[]
  prompts: string[]
  reminder: string
  mistakeLabel: string
}

export const KIDS_GAMES: KidsGame[] = [
  {
    slug: 'dont-say-yes-or-no',
    name: 'Don’t Say Yes or No',
    emoji: '🤐',
    description: 'Think fast! Answer every question without saying “yes” or “no”.',
    rules: [
      'Ask each other questions, but never say “yes” or “no”. Answer with a sentence instead.',
      'Keep the questions coming rapid-fire and answer immediately — don’t pause to think!',
      'Say “yes” or “no” by mistake and you’re out.',
      'Take turns answering. The last player still in wins!',
    ],
    examples: [
      { question: 'Do you like pizza?', answer: 'I love it!' },
      { question: 'Did you go to school today?', answer: 'I went this morning.' },
    ],
    prompts: [
      'Do you like pizza?', 'Did you go to school today?', 'Can you swim?',
      'Is your favourite colour blue?', 'Do you have a pet?', 'Are you wearing shoes?',
      'Would you like some ice cream?', 'Can you ride a bike?', 'Do you like rainy days?',
      'Have you ever seen a rainbow?', 'Are you good at dancing?', 'Do you like broccoli?',
      'Can you count to ten?', 'Is your birthday in summer?', 'Do you like drawing?',
      'Have you ever been on a train?', 'Would you like to visit the moon?',
      'Can you touch your toes?', 'Do you like bedtime stories?', 'Are you having fun?',
      'Have you ever built a sandcastle?', 'Would you hug a dinosaur?',
      'Can you make a funny face?', 'Do you like to sing?', 'Are you ready for another question?',
    ],
    reminder: 'Answer with a sentence. Don’t say “yes” or “no”!',
    mistakeLabel: 'Said yes or no — out!',
  },
  {
    slug: 'wrong-answers-only',
    name: 'Wrong Answers Only',
    emoji: '🙃',
    description: 'Simple questions. Silly answers. Being wrong is how you win!',
    rules: [
      'Ask each other simple questions — every answer has to be wrong!',
      'Answer quickly before your brain gives away the right answer.',
      'Keep the questions coming quickly. The sillier the answers, the better!',
      'Give the correct answer by mistake and you’re out. The last player still in wins!',
    ],
    examples: [
      { question: 'What colour is the sky?', answer: 'Pink!' },
      { question: 'How many legs does a dog have?', answer: 'Seven!' },
      { question: 'Where do fish live?', answer: 'In a cupboard!' },
    ],
    prompts: [
      'What colour is the sky on a clear day?', 'How many legs does a dog have?',
      'Where do fish live?', 'What sound does a cow make?', 'What do you brush your teeth with?',
      'What do you wear on your feet?', 'What do bees make?', 'What do you sleep on?',
      'How many wheels does a bicycle have?', 'What do you use to see?',
      'What animal says “meow”?', 'What do you use to write on paper?',
      'What do you open when it rains to stay dry?', 'Where do you put a hat?',
      'What is two plus two?', 'What colour is grass?', 'What do chickens lay?',
      'What do you drink when you are thirsty?', 'What do you use to hear?',
      'What fruit do monkeys love to eat?', 'What do you kick in football?',
      'What shines in the sky during the day?', 'What do you wear to keep your hands warm?',
      'What do you use to cut paper?', 'What do you call a baby dog?',
    ],
    reminder: 'Answer quickly. Make it wrong — and make it silly!',
    mistakeLabel: 'Correct answer — out!',
  },
]

export function getKidsGame(slug: string) {
  return KIDS_GAMES.find(game => game.slug === slug)
}
