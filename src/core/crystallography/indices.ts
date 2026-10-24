import {
  angleBetweenVectors,
  dSpacing,
  planeAngle,
  directVector,
  reciprocalVector,
  type CellParams,
  type Lattice,
} from '@/core/lattice/cell'
import type { Vec3 } from '@/core/math/vec'
import type { SymOp } from '@/core/crystallography/symmetry'

/** Convert a three-index plane (h k l) to Miller–Bravais (h k i l), i = −(h+k). */
export function threeToFourIndex(hkl: readonly number[]): [number, number, number, number] {
  const [h, k, l] = hkl
  return [h, k, -(h + k), l]
}

/** Convert a four-index plane (h k i l) to three indices; validates h+k+i=0. */
export function fourToThreeIndex(hkil: readonly number[]): [number, number, number] {
  const [h, k, i, l] = hkil
  return [h, k, l]
}

/** Check the Miller–Bravais constraint h + k + i = 0. */
export function isValidFourIndex(hkil: readonly number[]): boolean {
  return hkil.length === 4 && hkil[0] + hkil[1] + hkil[2] === 0
}

/**
 * Four-index direction conversion.
 *
 *   U = (2u − v)/3, V = (2v − u)/3, T = −(U+V), W = w
 */
export function threeToFourDirection(uvw: readonly number[]): [number, number, number, number] {
  const [u, v, w] = uvw
  // Multiply the conventional fractional (U,V,T,W) by 3 to keep integers.
  return [2 * u - v, 2 * v - u, -(u + v), 3 * w]
}

/** Inverse of threeToFourDirection (result is scaled to the smallest integers). */
export function fourToThreeDirection(UVTW: readonly number[]): [number, number, number] {
  const [U, V, , W] = UVTW
  const u = 2 * U + V
  const v = 2 * V + U
  const scale = Math.max(Math.abs(u), Math.abs(v), Math.abs(W)) || 1
  return [u / scale, v / scale, W / scale]
}

export interface PlaneIntercepts {
  /** Intercepts in units of a, b, c; Infinity means the plane is parallel to that axis. */
  fractional: [number, number, number]
  /** Intercepts in Å; Infinity means parallel. */
  cartesian: [number, number, number]
  text: string
}

/** Intercepts of the (hkl) plane with the a, b, c axes. */
export function planeIntercepts(cell: CellParams, hkl: readonly number[]): PlaneIntercepts {
  const [h, k, l] = hkl
  const frac = [h === 0 ? Infinity : 1 / h, k === 0 ? Infinity : 1 / k, l === 0 ? Infinity : 1 / l] as [
    number,
    number,
    number,
  ]
  const cart = [frac[0] * cell.a, frac[1] * cell.b, frac[2] * cell.c] as [number, number, number]
  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(4).replace(/\.?0+$/, '') : '∞')
  return {
    fractional: frac,
    cartesian: cart,
    text: `a/h = ${fmt(frac[0])}, b/k = ${fmt(frac[1])}, c/l = ${fmt(frac[2])}（以 a, b, c 为单位）`,
  }
}

/** Weiss zone law: hu + kv + lw = 0. */
export function weissLaw(hkl: readonly number[], uvw: readonly number[]): number {
  return hkl[0] * uvw[0] + hkl[1] * uvw[1] + hkl[2] * uvw[2]
}

/** Angle between a plane normal and a direction, in degrees (0–90). */
export function anglePlaneDirection(lattice: Lattice, hkl: readonly number[], uvw: readonly number[]): number {
  const g = reciprocalVector(lattice, hkl)
  const r = directVector(lattice, uvw)
  const cos = Math.abs(g[0] * r[0] + g[1] * r[1] + g[2] * r[2]) / (Math.hypot(...g) * Math.hypot(...r) || 1)
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
}

/** True when [uvw] lies in the (hkl) plane (Weiss law = 0). */
export function directionInPlane(hkl: readonly number[], uvw: readonly number[]): boolean {
  return weissLaw(hkl, uvw) === 0
}

/** Angle between two reciprocal vectors, in degrees. */
export function reciprocalAngle(lattice: Lattice, hkl1: readonly number[], hkl2: readonly number[]): number {
  return planeAngle(lattice, hkl1, hkl2)
}

/** Angle between two direct-space directions, in degrees. */
export function directAngle(lattice: Lattice, uvw1: readonly number[], uvw2: readonly number[]): number {
  return angleBetweenVectors(directVector(lattice, uvw1), directVector(lattice, uvw2))
}

/** Cross product of two reciprocal index vectors, reduced to a zone axis. */
export function zoneFromReciprocalIndices(
  hkl1: readonly number[],
  hkl2: readonly number[],
): [number, number, number] | null {
  const c: Vec3 = [
    hkl1[1] * hkl2[2] - hkl1[2] * hkl2[1],
    hkl1[2] * hkl2[0] - hkl1[0] * hkl2[2],
    hkl1[0] * hkl2[1] - hkl1[1] * hkl2[0],
  ]
  if (c.every((v) => v === 0)) return null
  const g = gcd3(c[0], c[1], c[2])
  const reduced: [number, number, number] = [c[0] / g, c[1] / g, c[2] / g]
  const first = reduced.find((v) => v !== 0) ?? 1
  return first < 0 ? [-reduced[0], -reduced[1], -reduced[2]] : reduced
}

function gcd3(a: number, b: number, c: number): number {
  const gcd = (x: number, y: number): number => {
    x = Math.abs(x)
    y = Math.abs(y)
    while (y) {
      const t = x % y
      x = y
      y = t
    }
    return x || 1
  }
  return gcd(gcd(a, b), c)
}

/**
 * Structure factor of a single atom at a general position, summed over all
 * symmetry operations. Its magnitude is zero exactly for systematically
 * absent reflections (independent of the atom species and position).
 */
export function generalPositionAmplitude(
  ops: readonly SymOp[],
  hkl: readonly number[],
): { amplitude: number; sumAbs: number } {
  if (!ops.length) return { amplitude: 1, sumAbs: 1 }
  const r = [0.1371, 0.2817, 0.4093]
  let re = 0
  let im = 0
  for (const op of ops) {
    const m = op.r
    const x = m[0][0] * r[0] + m[0][1] * r[1] + m[0][2] * r[2] + op.t[0]
    const y = m[1][0] * r[0] + m[1][1] * r[1] + m[1][2] * r[2] + op.t[1]
    const z = m[2][0] * r[0] + m[2][1] * r[1] + m[2][2] * r[2] + op.t[2]
    const phase = 2 * Math.PI * (hkl[0] * x + hkl[1] * y + hkl[2] * z)
    re += Math.cos(phase)
    im += Math.sin(phase)
  }
  const amplitude = Math.hypot(re, im) / ops.length
  return { amplitude, sumAbs: Math.hypot(re, im) }
}

/** True when the reflection is systematically absent for the given space group. */
export function isSystematicallyAbsent(ops: readonly SymOp[], hkl: readonly number[]): boolean {
  if (!ops.length) return false
  return generalPositionAmplitude(ops, hkl).amplitude < 1e-8
}

export interface ReflectionCheck {
  hkl: [number, number, number]
  d: number
  allowed: boolean
  amplitude: number
  /** Centering-only check, useful for separating Bravais absences. */
  centeringAllowed: boolean
}

/** Build a check table for all canonical hkl within a maximum index. */
export function reflectionCheckTable(
  lattice: Lattice,
  ops: readonly SymOp[],
  maxIndex = 5,
  latticeType = 'P',
): ReflectionCheck[] {
  const rows: ReflectionCheck[] = []
  for (let h = 0; h <= maxIndex; h++) {
    for (let k = -maxIndex; k <= maxIndex; k++) {
      for (let l = -maxIndex; l <= maxIndex; l++) {
        if (h === 0 && k < 0) continue
        if (h === 0 && k === 0 && l <= 0) continue
        const hkl: [number, number, number] = [h, k, l]
        const amp = generalPositionAmplitude(ops, hkl)
        rows.push({
          hkl,
          d: dSpacing(lattice, hkl),
          allowed: amp.amplitude > 1e-8,
          amplitude: amp.amplitude,
          centeringAllowed: centeringAllowsLocal(hkl, latticeType),
        })
      }
    }
  }
  return rows.sort((a, b) => b.d - a.d || a.hkl[0] - b.hkl[0] || a.hkl[1] - b.hkl[1])
}

function centeringAllowsLocal(hkl: readonly number[], latticeType: string): boolean {
  const [h, k, l] = hkl
  switch (latticeType.toUpperCase()) {
    case 'I':
      return (h + k + l) % 2 === 0
    case 'F':
      return (h % 2 === 0 && k % 2 === 0 && l % 2 === 0) || (h % 2 !== 0 && k % 2 !== 0 && l % 2 !== 0)
    case 'C':
      return (h + k) % 2 === 0
    case 'A':
      return (k + l) % 2 === 0
    case 'B':
      return (h + l) % 2 === 0
    case 'R':
      return (((-h + k + l) % 3) + 3) % 3 === 0
    default:
      return true
  }
}

/**
 * Find simple axis conditions such as `h = 2n` from the allowed h00 reflections.
 * Returns a human-readable summary; the full table remains authoritative.
 */
export function axialReflectionCondition(ops: readonly SymOp[], axis: 0 | 1 | 2, max = 12): string {
  const allowed: number[] = []
  for (let v = 1; v <= max; v++) {
    const hkl = axis === 0 ? [v, 0, 0] : axis === 1 ? [0, v, 0] : [0, 0, v]
    if (!isSystematicallyAbsent(ops, hkl)) allowed.push(v)
  }
  if (!allowed.length) return '全部消光'
  if (allowed.length === max) return '无附加条件'
  const step = allowed[0]
  const isPeriodic =
    allowed.every((v) => v % step === 0) &&
    Array.from({ length: Math.floor(max / step) }, (_, i) => (i + 1) * step).every((v) => allowed.includes(v))
  const name = ['h', 'k', 'l'][axis]
  return isPeriodic ? `${name} = ${step}n` : `允许 ${allowed.join(', ')}（上限 ${max}）`
}
