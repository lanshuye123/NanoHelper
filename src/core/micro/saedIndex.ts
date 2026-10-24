import { dSpacing, planeAngle, reciprocalVector, type Lattice } from '@/core/lattice/cell'
import { buildPlaneBasis, generateNet } from '@/core/lattice/planeNet'
import { isSystematicallyAbsent } from '@/core/crystallography/indices'
import type { SymOp } from '@/core/crystallography/symmetry'
import { canonicalizeIndices, norm, reduceIndices, type Vec3 } from '@/core/math/vec'

export interface SaedIndexOptions {
  maxIndex?: number
  /** Relative tolerance on d, e.g. 0.03 for 3 %. */
  dTolerance?: number
  /** Absolute tolerance on the angle in degrees. */
  angleTolerance?: number
  ops?: readonly SymOp[]
  /** Reject reflections that are systematically absent. */
  checkExtinction?: boolean
}

export interface IndexCandidate {
  hkl1: [number, number, number]
  hkl2: [number, number, number]
  d1: number
  d2: number
  /** Angle between the two reciprocal vectors, degrees. */
  angleDeg: number
  zone: [number, number, number]
  deltaD1Rel: number
  deltaD2Rel: number
  deltaAngle: number
  score: number
  allowed: boolean
}

export interface SingleSpotCandidate {
  hkl: [number, number, number]
  d: number
  deltaRel: number
  allowed: boolean
}

/** Index one measured d-spacing against a lattice. */
export function indexSingleSpot(
  lattice: Lattice,
  dObserved: number,
  options: SaedIndexOptions = {},
): SingleSpotCandidate[] {
  const maxIndex = options.maxIndex ?? 5
  const dTolerance = options.dTolerance ?? 0.03
  const check = options.checkExtinction ?? true
  const ops = options.ops ?? []
  if (!(dObserved > 0)) return []
  const out: SingleSpotCandidate[] = []
  for (let h = -maxIndex; h <= maxIndex; h++) {
    for (let k = -maxIndex; k <= maxIndex; k++) {
      for (let l = -maxIndex; l <= maxIndex; l++) {
        if (h === 0 && k === 0 && l === 0) continue
        const d = dSpacing(lattice, [h, k, l])
        const delta = Math.abs(d - dObserved) / dObserved
        if (!(delta <= dTolerance)) continue
        const allowed = !check || !ops.length || !isSystematicallyAbsent(ops, [h, k, l])
        out.push({ hkl: [h, k, l], d, deltaRel: delta, allowed })
      }
    }
  }
  return out.sort((a, b) => Number(b.allowed) - Number(a.allowed) || a.deltaRel - b.deltaRel || b.d - a.d)
}

/**
 * Index a zone-axis SAED pattern from two measured d-spacings and the angle
 * between the corresponding reciprocal vectors.
 *
 * A candidate is accepted when both d values and the angle fall inside the
 * tolerances. The zone axis follows from [uvw] = g₁ × g₂.
 */
export function indexSaedPattern(
  lattice: Lattice,
  d1: number,
  d2: number,
  angleDeg: number,
  options: SaedIndexOptions = {},
): IndexCandidate[] {
  const maxIndex = options.maxIndex ?? 5
  const dTolerance = options.dTolerance ?? 0.03
  const angleTolerance = options.angleTolerance ?? 3
  const check = options.checkExtinction ?? true
  const ops = options.ops ?? []
  if (!(d1 > 0) || !(d2 > 0)) return []

  const spots1 = indexSingleSpot(lattice, d1, { ...options, maxIndex, dTolerance, checkExtinction: false })
  const spots2 = indexSingleSpot(lattice, d2, { ...options, maxIndex, dTolerance, checkExtinction: false })
  const candidates: IndexCandidate[] = []

  for (const s1 of spots1) {
    for (const s2 of spots2) {
      const angle = planeAngle(lattice, s1.hkl, s2.hkl)
      const deltaAngle = Math.min(Math.abs(angle - angleDeg), Math.abs(180 - angle - angleDeg))
      if (deltaAngle > angleTolerance) continue
      const zoneRaw = crossIndices(s1.hkl, s2.hkl)
      if (!zoneRaw) continue
      const zone = canonicalIndices(reduceIndices(zoneRaw))
      const allowed1 = !check || !ops.length || !isSystematicallyAbsent(ops, s1.hkl)
      const allowed2 = !check || !ops.length || !isSystematicallyAbsent(ops, s2.hkl)
      const allowed = allowed1 && allowed2
      const score =
        (s1.deltaRel + s2.deltaRel) * 1000 + (deltaAngle / Math.max(angleTolerance, 1e-6)) * 10 + (allowed ? 0 : 1000)
      candidates.push({
        hkl1: s1.hkl,
        hkl2: s2.hkl,
        d1: s1.d,
        d2: s2.d,
        angleDeg: angle,
        zone,
        deltaD1Rel: s1.deltaRel,
        deltaD2Rel: s2.deltaRel,
        deltaAngle,
        score,
        allowed,
      })
    }
  }

  return dedupeCandidates(candidates)
    .sort((a, b) => a.score - b.score)
    .slice(0, 60)
}

function dedupeCandidates(candidates: IndexCandidate[]): IndexCandidate[] {
  const best = new Map<string, IndexCandidate>()
  for (const c of candidates) {
    const key = `${c.hkl1.join(',')}|${c.hkl2.join(',')}|${c.zone.join(',')}`
    const existing = best.get(key)
    if (!existing || c.score < existing.score) best.set(key, c)
  }
  return [...best.values()]
}

function crossIndices(a: readonly number[], b: readonly number[]): [number, number, number] | null {
  const c: [number, number, number] = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  if (c.every((v) => v === 0)) return null
  return c
}

function canonicalIndices(hkl: [number, number, number]): [number, number, number] {
  const first = hkl.find((v) => v !== 0) ?? 1
  return (first < 0 ? [-hkl[0], -hkl[1], -hkl[2]] : hkl) as [number, number, number]
}

/** Calibrate Lλ (mm·Å) from a measured radius (mm) and a known d (Å). */
export function calibrateCameraConstant(radiusMm: number, dAngstrom: number): number {
  if (!(radiusMm > 0) || !(dAngstrom > 0)) return NaN
  return radiusMm * dAngstrom
}

/** d (Å) from a measured radius (mm) and Lλ (mm·Å). */
export function dFromRadius(radiusMm: number, cameraConstantMmAngstrom: number): number {
  if (!(radiusMm > 0) || !(cameraConstantMmAngstrom > 0)) return NaN
  return cameraConstantMmAngstrom / radiusMm
}

/** Radius (mm) from d and Lλ. */
export function radiusFromD(dAngstrom: number, cameraConstantMmAngstrom: number): number {
  if (!(dAngstrom > 0)) return NaN
  return cameraConstantMmAngstrom / dAngstrom
}

export interface IndexedPatternPoint {
  hkl: [number, number, number]
  x: number
  y: number
  g: number
  d: number
  isCenter: boolean
}

/**
 * Build a simulated net in the measured frame of a candidate:
 * g₁ is placed along +x and g₂ in the upper half-plane.
 * Coordinates are in Å⁻¹, ready for DiffractionCanvas.
 */
export function patternForCandidate(
  lattice: Lattice,
  candidate: Pick<IndexCandidate, 'zone'>,
  maxG = 1.2,
): IndexedPatternPoint[] {
  const basis = buildPlaneBasis(lattice, candidate.zone)
  const g1 = reciprocalVector(lattice, basis.b1)
  const g2 = reciprocalVector(lattice, basis.b2)
  const e1 = normalizeVec(g1)
  let e2 = perpendicularComponent(g2, e1)
  if (norm(e2) < 1e-9) return []
  e2 = normalizeVec(e2)
  // Keep the handedness consistent with the plane normal.
  const cross: Vec3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
  if (norm(cross) > 1e-9 && dotVec(cross, basis.normal) < 0) {
    e2 = [-e2[0], -e2[1], -e2[2]]
  }
  const points = generateNet(lattice, basis, { maxG })
  return points.map((point) => {
    const g = reciprocalVector(lattice, point.hkl)
    return {
      hkl: point.hkl,
      x: dotVec(g, e1),
      y: dotVec(g, e2),
      g: point.g,
      d: point.d,
      isCenter: point.isCenter,
    }
  })
}

function normalizeVec(v: readonly number[]): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2])
  return n > 0 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 0]
}

function perpendicularComponent(v: readonly number[], axis: readonly number[]): Vec3 {
  const projection = dotVec(v, axis)
  return [v[0] - projection * axis[0], v[1] - projection * axis[1], v[2] - projection * axis[2]]
}

function dotVec(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Format a zone axis for display. */
export function formatZoneAxis(zone: readonly number[]): string {
  return `[${zone.map((v) => (v < 0 ? `-${Math.abs(v)}` : `${v}`)).join(' ')}]`
}

/** Re-export for convenience in the view. */
export { canonicalizeIndices }
