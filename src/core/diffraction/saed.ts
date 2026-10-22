import type { Structure } from '@/core/crystallography/structure'
import { structureFactor } from '@/core/crystallography/structure'
import { buildLattice, type Lattice } from '@/core/lattice/cell'
import {
  buildPlaneBasis,
  generateNet,
  type NetPoint,
  type PlaneBasis,
} from '@/core/lattice/planeNet'
import { electronWavelength } from '@/core/diffraction/scattering'
import { normalizeZone } from '@/core/lattice/zone'

export type SpotSizeMode = 'sqrt' | 'linear' | 'equal'

export interface SaedOptions {
  zoneAxis: number[]
  voltageKv?: number
  cameraLengthMm?: number
  /** Maximum |g| included in the pattern, Å⁻¹. */
  maxG?: number
  maxIndex?: number
  sizeMode?: SpotSizeMode
  hideAbsent?: boolean
  minIntensityRel?: number
}

export interface SaedSpot {
  hkl: [number, number, number]
  g: number
  d: number
  /** |F|² (arbitrary units) */
  f2: number
  /** relative intensity, 0–100 */
  intensityRel: number
  /** marker radius factor, 0–1 */
  radiusFactor: number
  /** position on the detector in 1/Å (plane coordinates) */
  x: number
  y: number
  /** position on the detector in mm, R = λ·L·|g| */
  rx: number
  ry: number
  absent: boolean
  /** true for the transmitted beam */
  isCenter: boolean
}

export interface SaedPattern {
  lattice: Lattice
  basis: PlaneBasis
  spots: SaedSpot[]
  zone: [number, number, number]
  wavelength: number
  cameraLengthMm: number
  /** Lλ in mm·Å */
  cameraConstant: number
  maxG: number
  maxRmm: number
  warnings: string[]
}

/**
 * Simulate a zone-axis electron diffraction pattern (kinematic approximation).
 *
 * Spot positions: R = Lλ·|g| on the detector (L in mm, λ in Å, |g| in Å⁻¹).
 * Intensities: I ∝ |F(hkl)|²; dynamical effects and HOLZ are not modelled.
 */
export function simulateSaed(structure: Structure, options: SaedOptions): SaedPattern {
  const warnings: string[] = []
  const lattice = buildLattice(structure.cell)
  const zone = normalizeZone(options.zoneAxis)
  const voltageKv = options.voltageKv ?? 200
  const cameraLengthMm = options.cameraLengthMm ?? 800
  const maxG = options.maxG ?? 1.2
  const sizeMode = options.sizeMode ?? 'sqrt'
  const hideAbsent = options.hideAbsent ?? true
  const minIntensityRel = options.minIntensityRel ?? 0

  const wavelength = electronWavelength(voltageKv)
  const cameraConstant = wavelength * cameraLengthMm
  const basis = buildPlaneBasis(lattice, zone)
  const net = generateNet(lattice, basis, { maxG, maxIndex: options.maxIndex })

  const hasAtoms = structure.atoms.length > 0
  if (!hasAtoms) warnings.push('当前结构没有原子位点，所有斑点将按等强度显示')

  const raw = net.map((point: NetPoint) => {
    if (point.isCenter) {
      return {
        ...point,
        f2: 1,
        absent: false,
        intensity: 1,
      }
    }
    if (!hasAtoms) {
      return { ...point, f2: 1, absent: false, intensity: 1 }
    }
    const sf = structureFactor(lattice, structure.atoms, point.hkl)
    return { ...point, f2: sf.f2, absent: sf.absent, intensity: sf.f2 }
  })

  const positive = raw.filter((p) => !p.isCenter && !p.absent && p.intensity > 0)
  const maxIntensity = positive.reduce((m, p) => Math.max(m, p.intensity), 0)
  if (positive.length === 0 && hasAtoms) {
    warnings.push('该带轴下所有斑点均消光或强度为零，请检查结构/带轴')
  }

  const spots: SaedSpot[] = raw
    .filter((p) => (hideAbsent && p.absent && !p.isCenter ? false : true))
    .map((p) => {
      const intensityRel = p.isCenter ? 100 : maxIntensity > 0 ? (p.intensity / maxIntensity) * 100 : 0
      let radiusFactor = 1
      if (!p.isCenter) {
        if (sizeMode === 'equal') radiusFactor = 1
        else if (sizeMode === 'linear') radiusFactor = Math.max(0.08, intensityRel / 100)
        else radiusFactor = Math.max(0.08, Math.sqrt(intensityRel / 100))
      }
      return {
        hkl: p.hkl,
        g: p.g,
        d: p.d,
        f2: p.f2,
        intensityRel,
        radiusFactor,
        x: p.x,
        y: p.y,
        rx: cameraConstant * p.x,
        ry: cameraConstant * p.y,
        absent: p.absent,
        isCenter: p.isCenter,
      }
    })
    .filter((p) => p.isCenter || p.intensityRel >= minIntensityRel)

  if (!Number.isFinite(wavelength) || wavelength <= 0) {
    throw new Error('加速电压无效')
  }

  return {
    lattice,
    basis,
    spots,
    zone,
    wavelength,
    cameraLengthMm,
    cameraConstant,
    maxG,
    maxRmm: cameraConstant * maxG,
    warnings,
  }
}

/** Camera constant Lλ from a measured ring/spot radius and a known d-spacing. */
export function cameraConstantFromRd(radiusMm: number, dAngstrom: number): number {
  if (!(radiusMm > 0) || !(dAngstrom > 0)) return NaN
  return radiusMm * dAngstrom
}

/** d-spacing from a measured radius and a calibrated camera constant. */
export function dFromRadius(radiusMm: number, cameraConstant: number): number {
  if (!(radiusMm > 0) || !(cameraConstant > 0)) return NaN
  return cameraConstant / radiusMm
}

/** Camera length from Lλ and the electron wavelength. */
export function cameraLengthFromConstant(cameraConstant: number, wavelength: number): number {
  return wavelength > 0 ? cameraConstant / wavelength : NaN
}

/** Two-vector description used by the "manual indexing" panel. */
export interface VectorPairInfo {
  g1: number
  g2: number
  d1: number
  d2: number
  angleDeg: number
  /** R1, R2 in mm for the given camera constant */
  r1: number
  r2: number
}

export function describeVectorPair(
  lattice: Lattice,
  hkl1: readonly number[],
  hkl2: readonly number[],
  cameraConstant: number,
): VectorPairInfo {
  const g1 = Math.hypot(...reciprocalLengths(lattice, hkl1))
  const g2 = Math.hypot(...reciprocalLengths(lattice, hkl2))
  const a = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        dotVectors(reciprocalLengths(lattice, hkl1), reciprocalLengths(lattice, hkl2)) / (g1 * g2 || 1),
      ),
    ),
  )
  return {
    g1,
    g2,
    d1: g1 ? 1 / g1 : Infinity,
    d2: g2 ? 1 / g2 : Infinity,
    angleDeg: (a * 180) / Math.PI,
    r1: cameraConstant * g1,
    r2: cameraConstant * g2,
  }
}

function reciprocalLengths(lattice: Lattice, hkl: readonly number[]): [number, number, number] {
  const [a, b, c] = lattice.reciprocal
  return [
    hkl[0] * a[0] + hkl[1] * b[0] + hkl[2] * c[0],
    hkl[0] * a[1] + hkl[1] * b[1] + hkl[2] * c[1],
    hkl[0] * a[2] + hkl[1] * b[2] + hkl[2] * c[2],
  ]
}

function dotVectors(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
