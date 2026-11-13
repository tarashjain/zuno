const SECTOR_DEGREES = 45
const SPIN_TURNS = 6
export const SPIN_DURATION_MS = 5200

export function getSpinRotation(currentRotation: number, slot: number, jitter: number): number {
  const sectorCenter = slot * SECTOR_DEGREES + SECTOR_DEGREES / 2 + jitter
  const targetRotation = ((360 - sectorCenter) % 360 + 360) % 360
  const currentMod = ((currentRotation % 360) + 360) % 360
  const delta = (targetRotation - currentMod + 360) % 360
  return currentRotation + 360 * SPIN_TURNS + delta
}
