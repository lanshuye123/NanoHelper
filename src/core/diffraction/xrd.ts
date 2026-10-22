import type { Structure } from '@/core/crystallography/structure'
import { reflectionOrbit, structureFactor } from '@/core/crystallography/structure'
import { buildLattice, dSpacing, type Lattice } from '@/core/lattice/cell'

export type PeakProfile = 'gaussian' | 'lorentzian' | 'pseudoVoigt'

export interface XrdOptions {
  wavelength: number
  twoThetaMin: number
  twoThetaMax: number
  step: number
  profile?: PeakProfile
  fwhm?: number
  eta?: number
  ka2?: boolean
  ka2Wavelength?: number
  ka2Ratio?: number
  maxIndex?: number
  includeLP?: boolean
  zeroShift?: number
  background?: number
  /** Scale the simulated pattern so its maximum equals this value. */
  scaleTo?: number
  /** Include kinematical structure factor (default true). */
  useStructureFactor?: boolean
}

export interface XrdReflection {
  hkl: [number, number, number]
  d: number
  twoTheta: number
  multiplicity: number
  f2: number
  intensity: number
  relIntensity: number
  absent: boolean
}

export interface XrdPattern {
  lattice: Lattice
  reflections: XrdReflection[]
  x: Float64Array
  y: Float64Array
  maxIntensity: number
  warnings: string[]
  options: Required<Omit<XrdOptions, 'maxIndex' | 'ka2Wavelength'>> & {
    maxIndex?: number
    ka2Wavelength?: number
  }
}

/** Add Friedel's law to the point-group rotations (Laue class). */
export function laueRotations(rotations: number[][][]): number[][][] {
  const hasInversion = rotations.some(
    (r) => r[0][0] === -1 && r[1][1] === -1 && r[2][2] === -1 && r[0][1] === 0 && r[0][2] === 0 && r[1][0] === 0 && r[1][2] === 0 && r[2][0] === 0 && r[2][1] === 0,
  )
  if (hasInversion) return rotations
  const inversion = [
    [-1, 0, 0],
    [0, -1, 0],
    [0, 0, -1],
  ]
  return [...rotations, inversion]
}

/** Height-normalised pseudo-Voigt profile (maximum = 1 at x = x0). */
export function peakProfile(x: number, x0: number, fwhm: number, profile: PeakProfile, eta = 0.5): number {
  if (fwhm <= 0) return x === x0 ? 1 : 0
  const t = (x - x0) / fwhm
  const gaussian = Math.exp(-4 * Math.LN2 * t * t)
  const lorentzian = 1 / (1 + 4 * t * t)
  if (profile === 'gaussian') return gaussian
  if (profile === 'lorentzian') return lorentzian
  const e = Math.min(1, Math.max(0, eta))
  return e * lorentzian + (1 - e) * gaussian
}

function lorentzPolarization(twoThetaDeg: number): number {
  const theta = (twoThetaDeg * Math.PI) / 360
  const sin = Math.sin(theta)
  const cos = Math.cos(theta)
  if (sin < 1e-6 || cos < 1e-6) return 0
  const cos2 = Math.cos(2 * theta)
  return (1 + cos2 * cos2) / (sin * sin * cos)
}

/**
 * Simulate a Bragg–Brentano powder pattern.
 *
 * Intensities: I ∝ m·|F|²·LP; profiles are height-normalised and optionally
 * include a Kα2 satellite. The result can be exported directly as a Jade XY.
 */
export function simulateXrd(
  structure: Structure,
  rotations: number[][][] = [],
  options: XrdOptions,
): XrdPattern {
  const warnings: string[] = []
  const lattice = buildLattice(structure.cell)
  const wavelength = options.wavelength
  if (!(wavelength > 0)) throw new Error('X 射线波长必须为正数')

  const twoThetaMin = options.twoThetaMin
  const twoThetaMax = options.twoThetaMax
  const step = options.step
  if (!(twoThetaMax > twoThetaMin)) throw new Error('2θ 上限必须大于下限')
  if (!(step > 0)) throw new Error('步长必须为正数')

  const profile = options.profile ?? 'pseudoVoigt'
  const fwhm = options.fwhm ?? 0.12
  const eta = options.eta ?? 0.5
  const zeroShift = options.zeroShift ?? 0
  const includeLP = options.includeLP ?? true
  const useStructureFactor = options.useStructureFactor ?? true

  const thetaMax = (Math.min(twoThetaMax, 179.9) * Math.PI) / 360
  const dMin = wavelength / (2 * Math.sin(thetaMax))
  const maxCell = Math.max(structure.cell.a, structure.cell.b, structure.cell.c)
  const autoMaxIndex = Math.min(60, Math.ceil(maxCell / Math.max(dMin, 1e-6)) + 2)
  const maxIndex = options.maxIndex ?? autoMaxIndex
  if (options.maxIndex === undefined && autoMaxIndex >= 60) {
    warnings.push('倒易空间枚举已达到 60 的上限；极高角度或极低 d 值的反射可能不完整')
  }

  const laue = laueRotations(rotations.length ? rotations : [[[1, 0, 0], [0, 1, 0], [0, 0, 1]]])
  const raw: XrdReflection[] = []

  // Enumerate one representative from every Friedel pair.
  for (let h = 0; h <= maxIndex; h++) {
    for (let k = -maxIndex; k <= maxIndex; k++) {
      for (let l = -maxIndex; l <= maxIndex; l++) {
        if (h === 0 && k < 0) continue
        if (h === 0 && k === 0 && l <= 0) continue
        const hkl: [number, number, number] = [h, k, l]
        const d = dSpacing(lattice, hkl)
        if (!Number.isFinite(d) || d < dMin) continue
        const sinTheta = wavelength / (2 * d)
        if (sinTheta > 1) continue
        const twoTheta = (2 * Math.asin(sinTheta) * 180) / Math.PI + zeroShift
        if (twoTheta < twoThetaMin - 2 * fwhm || twoTheta > twoThetaMax + 2 * fwhm) continue

        const orbit = reflectionOrbit(hkl, laue)
        const canonical = orbit
          .map((o) => o.join(','))
          .sort()
          .at(-1)
        if (canonical !== hkl.join(',')) continue
        const sf = useStructureFactor
          ? structureFactor(lattice, structure.atoms, hkl)
          : { f2: 1, absent: false }
        if (sf.absent) continue
        const multiplicity = orbit.length
        const lp = includeLP ? lorentzPolarization(twoTheta) : 1
        const intensity = multiplicity * sf.f2 * lp
        if (!(intensity > 0)) continue
        raw.push({
          hkl,
          d,
          twoTheta,
          multiplicity,
          f2: sf.f2,
          intensity,
          relIntensity: 0,
          absent: false,
        })
      }
    }
  }

  raw.sort((a, b) => a.twoTheta - b.twoTheta)
  const maxRaw = raw.reduce((m, r) => Math.max(m, r.intensity), 0)
  for (const r of raw) r.relIntensity = maxRaw > 0 ? (r.intensity / maxRaw) * 100 : 0
  if (!raw.length) warnings.push('在给定 2θ 范围内没有找到允许的反射')

  const ka2 = options.ka2 ?? false
  const ka2Wavelength = options.ka2Wavelength ?? wavelength * 1.0025
  const ka2Ratio = options.ka2Ratio ?? 0.5

  // Build the sampled pattern.
  const n = Math.max(2, Math.floor((twoThetaMax - twoThetaMin) / step) + 1)
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const background = options.background ?? 1
  for (let i = 0; i < n; i++) {
    x[i] = twoThetaMin + i * step
    y[i] = background
  }

  const addPeak = (center: number, height: number) => {
    const window = 12 * fwhm
    const iStart = Math.max(0, Math.floor((center - window - twoThetaMin) / step))
    const iEnd = Math.min(n - 1, Math.ceil((center + window - twoThetaMin) / step))
    for (let i = iStart; i <= iEnd; i++) {
      y[i] += height * peakProfile(x[i], center, fwhm, profile, eta)
    }
  }

  for (const r of raw) {
    addPeak(r.twoTheta, r.intensity)
    if (ka2) {
      const sinTheta2 = ka2Wavelength / (2 * r.d)
      if (sinTheta2 <= 1) {
        const center2 = (2 * Math.asin(sinTheta2) * 180) / Math.PI + zeroShift
        addPeak(center2, r.intensity * ka2Ratio)
      }
    }
  }

  let maxY = y.reduce((m, v) => Math.max(m, v), 0)
  const scaleTo = options.scaleTo
  if (scaleTo !== undefined && scaleTo > 0 && maxY > 0) {
    const factor = scaleTo / maxY
    for (let i = 0; i < n; i++) y[i] *= factor
    maxY = scaleTo
  }

  return {
    lattice,
    reflections: raw,
    x,
    y,
    maxIntensity: maxY,
    warnings,
    options: {
      wavelength,
      twoThetaMin,
      twoThetaMax,
      step,
      profile,
      fwhm,
      eta,
      ka2,
      ka2Ratio,
      includeLP,
      zeroShift,
      background,
      scaleTo: scaleTo ?? 0,
      useStructureFactor,
      maxIndex,
      ka2Wavelength,
    },
  }
}

/** Convert a 2θ axis to 1/d (Å⁻¹) using Bragg's law. */
export function twoThetaToInvD(twoThetaDeg: number, wavelength: number): number {
  const theta = (twoThetaDeg * Math.PI) / 360
  return (2 * Math.sin(theta)) / wavelength
}

export function dToTwoTheta(d: number, wavelength: number): number {
  const s = wavelength / (2 * d)
  if (s > 1) return NaN
  return (2 * Math.asin(s) * 180) / Math.PI
}

/** Scherrer crystallite size in nm. */
export function scherrerSize(
  fwhmDeg: number,
  twoThetaDeg: number,
  wavelength: number,
  k = 0.9,
): number {
  const beta = (fwhmDeg * Math.PI) / 180
  const theta = (twoThetaDeg * Math.PI) / 360
  if (!(beta > 0)) return NaN
  // D (Å) = Kλ / (β cosθ); convert to nm.
  return (k * wavelength) / (beta * Math.cos(theta)) / 10
}

export interface WilliamsonHallPoint {
  sinTheta: number
  betaCosTheta: number
}

export interface WilliamsonHallResult {
  points: WilliamsonHallPoint[]
  slope: number
  intercept: number
  strain: number
  sizeNm: number
  r2: number
}

/** Williamson–Hall analysis: βcosθ = Kλ/D + 4ε sinθ. */
export function williamsonHall(
  peaks: ReadonlyArray<{ twoTheta: number; fwhm: number }>,
  wavelength: number,
  k = 0.9,
): WilliamsonHallResult | null {
  const points = peaks
    .filter((p) => p.fwhm > 0)
    .map((p) => {
      const theta = (p.twoTheta * Math.PI) / 360
      const beta = (p.fwhm * Math.PI) / 180
      return { sinTheta: Math.sin(theta), betaCosTheta: beta * Math.cos(theta) }
    })
    .sort((a, b) => a.sinTheta - b.sinTheta)
  if (points.length < 2) return null
  const n = points.length
  const meanX = points.reduce((s, p) => s + p.sinTheta, 0) / n
  const meanY = points.reduce((s, p) => s + p.betaCosTheta, 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const p of points) {
    const dx = p.sinTheta - meanX
    const dy = p.betaCosTheta - meanY
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  const slope = sxx > 0 ? sxy / sxx : 0
  const intercept = meanY - slope * meanX
  const r2 = sxx > 0 && syy > 0 ? (sxy * sxy) / (sxx * syy) : 0
  return {
    points,
    slope,
    intercept,
    strain: slope / 4,
    // intercept = Kλ/D (Å) → D in nm
    sizeNm: intercept > 0 ? (k * wavelength) / intercept / 10 : NaN,
    r2,
  }
}
