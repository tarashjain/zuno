// Room codes are either all digits or all letters (never mixed) so they're easy to read aloud or text.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // excludes I/O to avoid confusion with 1/0
const DIGITS = '23456789' // excludes 0/1 to avoid confusion with O/I
const CODE_LENGTH = 6

export function generateRoomCode(): string {
  const alphabet = Math.random() < 0.5 ? LETTERS : DIGITS
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}
