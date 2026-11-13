const test = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')

const { getSpinRotation } = loadTs('lib/bollywood-beats.ts')

test('the selected wheel sector lands under the pointer from any current rotation', () => {
  for (const currentRotation of [0, 187.5, 1477.25]) {
    for (let slot = 0; slot < 8; slot++) {
      const nextRotation = getSpinRotation(currentRotation, slot, 0)
      const sectorCenter = slot * 45 + 22.5
      const landedAngle = ((sectorCenter + nextRotation) % 360 + 360) % 360

      assert.ok(landedAngle < 1e-9 || 360 - landedAngle < 1e-9)
      assert.ok(nextRotation - currentRotation >= 6 * 360)
    }
  }
})

test('wheel landing accounts for the selected sector jitter', () => {
  for (const jitter of [-9.5, 0, 9.5]) {
    const nextRotation = getSpinRotation(725, 3, jitter)
    const sectorCenter = 3 * 45 + 22.5 + jitter
    const landedAngle = ((sectorCenter + nextRotation) % 360 + 360) % 360

    assert.ok(landedAngle < 1e-9 || 360 - landedAngle < 1e-9)
  }
})
