import { describe, expect, it } from 'vitest'
import { STRUCTURE_PRESETS, presetToStructure } from '@/data/presets'
import { loadSpaceGroup } from '@/core/data/spacegroups'
import {
  calibrateCameraConstantFromRings,
  indexRingValues,
  simulateSaedRings,
} from '@/core/diffraction/saedRings'

const si = presetToStructure(STRUCTURE_PRESETS[0])

describe('polycrystalline SAED rings', () => {
  it('produces the allowed Si rings in the correct order', async () => {
    const group = await loadSpaceGroup(227)
    const pattern = simulateSaedRings(si, {
      voltageKv: 200,
      cameraLengthMm: 800,
      maxG: 0.8,
      rotations: group?.ops.map((op) => op.r) ?? [],
      crystalliteSizeNm: 20,
    })
    expect(pattern.rings.length).toBeGreaterThan(3)
    expect(pattern.rings[0].hkl.join(',')).toBe('1,1,1')
    expect(pattern.rings[0].d).toBeCloseTo(5.431 / Math.sqrt(3), 3)
    expect(pattern.rings[1].hkl.join(',')).toBe('2,2,0')
    expect(pattern.rings[0].radiusMm).toBeCloseTo(pattern.cameraConstant / pattern.rings[0].d, 8)
  })

  it('indexes measured radii and recovers Lλ', async () => {
    const group = await loadSpaceGroup(227)
    const pattern = simulateSaedRings(si, {
      voltageKv: 200,
      cameraLengthMm: 800,
      maxG: 0.8,
      rotations: group?.ops.map((op) => op.r) ?? [],
    })
    const radii = pattern.rings.slice(0, 4).map((ring) => ring.radiusMm * 1.02)
    const matches = indexRingValues(pattern, radii, 'R', 5)
    expect(matches.every((match) => match.matched)).toBe(true)
    const calibrated = calibrateCameraConstantFromRings(pattern, radii, 5)
    expect(calibrated).toBeCloseTo(pattern.cameraConstant * 1.02, 1)
  })

  it('broadens rings when the crystallite size is small', () => {
    const coarse = simulateSaedRings(si, { crystalliteSizeNm: 100 })
    const fine = simulateSaedRings(si, { crystalliteSizeNm: 5 })
    expect(fine.rings[0].widthMm).toBeGreaterThan(coarse.rings[0].widthMm)
  })
})
