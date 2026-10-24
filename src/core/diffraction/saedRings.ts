import type { Structure } from '@/core/crystallography/structure'
import { reflectionOrbit, structureFactor } from '@/core/crystallography/structure'
import { buildLattice, dSpacing, type Lattice } from '@/core/lattice/cell'
import { electronWavelength } from '@/core/diffraction/scattering'
import { laueRotations } from '@/core/diffraction/xrd'

export interface SaedRingsOptions {
  voltageKv?: number
  cameraLengthMm?: number
  /** Maximum |g| included, Å⁻¹. */
  maxG?: number
  maxIndex?: number
  /** Point-group rotations (without inversion); Friedel's law is added. */
  rotations?: number[][][]
  minIntensityRel?: number
  /** Crystallite size in nm; broadens rings through the Scherrer relation. */
  crystalliteSizeNm?: number
  /** Explicit ring half-width in mm, overriding the size estimate. */
  ringWidthMm?: number
}

export interface SaedRing {
  hkl: [number, number, number]
  d: number
  g: number
  multiplicity: number
  f2: number
  intensity: number
  relIntensity: number
  /** Ring radius on the detector, mm. */
  radiusMm: number
  /** Estimated ring full width on the detector, mm. */
  widthMm: number
  /** Number of symmetry-equivalent reflections merged into this ring. */
  merged: number
}

export interface SaedRingsPattern {
  lattice: Lattice
  rings: SaedRing[]
  wavelength: number
  cameraLengthMm: number
  /** Lλ in mm·Å. */
  cameraConstant: number
  maxG: number
  maxRadiusMm: number
  warnings: string[]
}

/**
 * Kinematic polycrystalline electron-diffraction ring pattern.
 *
 * Ring radius: R = Lλ/d = Lλ|g|. Ring intensity is summed over the
 * symmetry-equivalent reflections in each d-group:
 *
 *   I ∝ Σ m·|F(hkl)|²
 *
 * No dynamical effects, texture, absorption or detector response are included.
 */
export function simulateSaedRings(
  structure: Structure,
  options: SaedRingsOptions = {},
): SaedRingsPattern {
  const lattice = buildLattice(structure.cell)
  const voltageKv = options.voltageKv ?? 200
  const cameraLengthMm = options.cameraLengthMm ?? 800
  const maxG = options.maxG ?? 1.2
  const minIntensityRel = options.minIntensityRel ?? 0
  if (!(maxG > 0)) throw new Error('最大 |g| 必须为正数')
  if (!(cameraLengthMm > 0)) throw new Error('相机长度必须为正数')

  const wavelength = electronWavelength(voltageKv)
  const cameraConstant = wavelength * cameraLengthMm
  const warnings: string[] = []
  if (!structure.atoms.length) warnings.push('当前结构没有原子位点，所有环将按多重度显示相对强度')

  const rotations = laueRotations(
    options.rotations?.length
      ? options.rotations
      : [
          [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
        ],
  )

  const maxCell = Math.max(structure.cell.a, structure.cell.b, structure.cell.c)
  const maxIndex =
    options.maxIndex ?? Math.min(40, Math.max(3, Math.ceil(maxCell * maxG) + 3))

  interface RawRing {
    hkl: [number, number, number]
    d: number
    g: number
    multiplicity: number
    f2: number
    intensity: number
    merged: number
  }

  const groups = new Map<string, RawRing>()
  for (let h = 0; h <= maxIndex; h++) {
    for (let k = -maxIndex; k <= maxIndex; k++) {
      for (let l = -maxIndex; l <= maxIndex; l++) {
        if (h === 0 && k < 0) continue
        if (h === 0 && k === 0 && l <= 0) continue
        const hkl: [number, number, number] = [h, k, l]
        const d = dSpacing(lattice, hkl)
        if (!Number.isFinite(d) || d <= 0) continue
        const g = 1 / d
        if (g > maxG) continue

        const orbit = reflectionOrbit(hkl, rotations)
        const canonical = orbit
          .map((item) => item.join(','))
          .sort()
          .at(-1)
        if (canonical !== hkl.join(',')) continue

        let f2 = 1
        if (structure.atoms.length) {
          const sf = structureFactor(lattice, structure.atoms, hkl)
          if (sf.absent) continue
          f2 = sf.f2
        }
        const key = d.toFixed(5)
        const existing = groups.get(key)
        if (existing) {
          existing.merged += 1
          existing.f2 += f2
          existing.intensity += orbit.length * f2
          continue
        }
        groups.set(key, {
          hkl,
          d,
          g,
          multiplicity: orbit.length,
          f2,
          intensity: orbit.length * f2,
          merged: 1,
        })
      }
    }
  }

  const raw = [...groups.values()]
  const maxRaw = raw.reduce((max, ring) => Math.max(max, ring.intensity), 0)
  const sizeNm = options.crystalliteSizeNm ?? 0
  const rings: SaedRing[] = raw
    .map((ring) => {
      const intensity = ring.intensity
      const widthFromSize = sizeNm > 0 ? cameraConstant / (sizeNm * 10) : 0
      const widthMm = options.ringWidthMm ?? Math.max(0.04, widthFromSize)
      return {
        hkl: ring.hkl,
        d: ring.d,
        g: ring.g,
        multiplicity: ring.multiplicity,
        f2: ring.f2,
        intensity,
        relIntensity: maxRaw > 0 ? (intensity / maxRaw) * 100 : 0,
        radiusMm: cameraConstant / ring.d,
        widthMm,
        merged: ring.merged,
      }
    })
    .filter((ring) => ring.relIntensity >= minIntensityRel)
    .sort((a, b) => a.radiusMm - b.radiusMm || b.relIntensity - a.relIntensity)

  if (!rings.length) warnings.push('在给定范围内没有找到允许的衍射环')
  if (sizeNm <= 0) warnings.push('未输入晶粒尺寸；环宽按显示下限处理，不代表真实峰宽')

  return {
    lattice,
    rings,
    wavelength,
    cameraLengthMm,
    cameraConstant,
    maxG,
    maxRadiusMm: cameraConstant * maxG,
    warnings,
  }
}

export interface RingMatch {
  /** The measured R (mm) or d (Å), as entered. */
  measured: number
  /** d-spacing derived from R when mode is "R". */
  d: number
  ring: SaedRing | null
  /** Relative d deviation, in percent. */
  deltaPercent: number
  matched: boolean
}

/** Match measured ring radii (mm) or d-spacings (Å) to the calculated rings. */
export function indexRingValues(
  pattern: SaedRingsPattern,
  values: readonly number[],
  mode: 'R' | 'd',
  tolerancePercent = 3,
): RingMatch[] {
  const tolerance = Math.max(0, tolerancePercent) / 100
  return values
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => {
      const d = mode === 'R' ? pattern.cameraConstant / value : value
      let best: SaedRing | null = null
      let bestDelta = Infinity
      for (const ring of pattern.rings) {
        const delta = Math.abs(d - ring.d) / ring.d
        if (delta < bestDelta) {
          bestDelta = delta
          best = ring
        }
      }
      return {
        measured: value,
        d,
        ring: best,
        deltaPercent: Number.isFinite(bestDelta) ? bestDelta * 100 : NaN,
        matched: Boolean(best) && bestDelta <= tolerance,
      }
    })
}

/**
 * Estimate Lλ from measured radii and the calculated d-values.
 * Returns the median of R·d over matched rings; NaN when nothing matches.
 */
export function calibrateCameraConstantFromRings(
  pattern: SaedRingsPattern,
  radiiMm: readonly number[],
  tolerancePercent = 3,
): number {
  const matches = indexRingValues(pattern, radiiMm, 'R', tolerancePercent).filter(
    (match) => match.matched && match.ring,
  )
  if (!matches.length) return NaN
  const products = matches
    .map((match) => match.measured * match.ring!.d)
    .sort((a, b) => a - b)
  const mid = Math.floor(products.length / 2)
  return products.length % 2 ? products[mid] : (products[mid - 1] + products[mid]) / 2
}

/** d-spacing from a measured ring radius and a camera constant. */
export function ringD(radiusMm: number, cameraConstant: number): number {
  if (!(radiusMm > 0) || !(cameraConstant > 0)) return NaN
  return cameraConstant / radiusMm
}
