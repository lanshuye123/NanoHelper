import { describe, expect, it } from 'vitest'
import { loadSpaceGroup } from '@/core/data/spacegroups'
import {
  analyseSpaceGroup,
  formatSymOp,
  siteOrbit,
  spaceGroupChirality,
} from '@/core/crystallography/symmetryInfo'
import { parseSymmetryOperation } from '@/core/crystallography/symmetry'

describe('space-group symmetry summary', () => {
  it('identifies Fd-3m as non-chiral with F centering', async () => {
    const group = await loadSpaceGroup(227)
    expect(group).not.toBeNull()
    const analysis = analyseSpaceGroup(group!)
    expect(analysis.meta.symbol).toContain('F')
    expect(analysis.chiral).toBe(false)
    expect(analysis.generalMultiplicity).toBeGreaterThan(1)
    expect(analysis.conditions.centering).toContain('面心')
  })

  it('identifies P 1 21 1 as chiral', async () => {
    const group = await loadSpaceGroup(4)
    expect(group).not.toBeNull()
    const analysis = analyseSpaceGroup(group!)
    expect(analysis.chiral).toBe(true)
    expect(analysis.generalMultiplicity).toBe(2)
  })

  it('detects inversion symmetry in P -1', async () => {
    const group = await loadSpaceGroup(2)
    expect(group).not.toBeNull()
    const analysis = analyseSpaceGroup(group!)
    expect(analysis.chiral).toBe(false)
    expect(analysis.chiralityReason).toContain('非正当操作')
  })

  it('uses improper rotations to reject chirality', () => {
    const mirror = parseSymmetryOperation('x, -y, z')
    const result = spaceGroupChirality([mirror])
    expect(result.chiral).toBe(false)
    expect(formatSymOp(mirror)).toBe('x, -y, z')
  })

  it('counts a special position and its site symmetry', async () => {
    const group = await loadSpaceGroup(2)
    const orbit = siteOrbit(
      group!.ops.map((op) => ({ r: op.r, t: op.t, s: op.s })),
      { x: 0, y: 0, z: 0 },
    )
    expect(orbit.multiplicity).toBe(1)
    expect(orbit.special).toBe(true)
    expect(orbit.siteSymmetryOrder).toBeGreaterThan(1)
  })
})
