import {
  buildLattice,
  directVector,
  reciprocalVector,
  type Lattice,
} from '@/core/lattice/cell'
import { buildPlaneBasis, type PlaneBasis } from '@/core/lattice/planeNet'
import { normalizeZone } from '@/core/lattice/zone'
import { dot, norm, type Vec3 } from '@/core/math/vec'

export interface EwaldOptions {
  /** Electron wavelength or X-ray wavelength in Å. */
  wavelength: number
  zoneAxis: readonly number[]
  /** Maximum |g| to enumerate, Å⁻¹. */
  maxG?: number
  maxIndex?: number
  /** Crystal thickness in nm; controls the relrod length. */
  thicknessNm?: number
}

export interface EwaldPoint {
  hkl: [number, number, number]
  g: number
  d: number
  /** Coordinates in the reciprocal plane (Å⁻¹). */
  x: number
  y: number
  /** Component along the zone-axis normal (Å⁻¹). */
  z: number
  /** h·u + k·v + l·w; 0 = ZOLZ, ±1 = first HOLZ, … */
  laueZone: number
  /** Signed excitation error (Å⁻¹); 0 means exactly on the Ewald sphere. */
  excitationError: number
  /** Half-length of the relrod along the zone normal (Å⁻¹). */
  relrodHalfWidth: number
  /** Inside the limiting sphere |g| <= 2/λ. */
  insideLimitingSphere: boolean
  /** The relrod intersects the Ewald sphere within the thickness model. */
  excited: boolean
}

export interface EwaldGeometry {
  lattice: Lattice
  basis: PlaneBasis
  zone: [number, number, number]
  wavelength: number
  /** Ewald-sphere radius 1/λ, Å⁻¹ (crystallographic convention). */
  k: number
  /** Maximum |g| that can be diffracted, 2/λ. */
  limitingRadius: number
  /** Distance between adjacent Laue zones along the zone normal, Å⁻¹. */
  zoneSpacing: number
  thicknessNm: number
  relrodHalfWidth: number
  points: EwaldPoint[]
  zolz: EwaldPoint[]
  holz: EwaldPoint[]
  excited: EwaldPoint[]
  warnings: string[]
}

/**
 * Construct the Ewald-sphere / Laue-zone geometry for a zone-axis diffraction
 * experiment.
 *
 * The reciprocal plane is the one perpendicular to [uvw]. For a beam along
 * +z (zone normal), the Ewald circle in the (r, z) radial section is
 *
 *   r² + (z + k)² = k²,   k = 1/λ,   r² = x² + y²
 *
 * so the signed distance from a reciprocal point to the sphere is
 *
 *   s = (x² + y² + z² + 2kz) / (2k).
 *
 * A finite crystal thickness t broadens each reciprocal point into a relrod
 * of half-length 1/(2t); points with |s| below that value are treated as
 * excited. This is a kinematic, geometric model and does not include
 * dynamical scattering, HOLZ line details or specimen tilt.
 */
export function buildEwaldGeometry(lattice: Lattice, options: EwaldOptions): EwaldGeometry {
  const wavelength = options.wavelength
  if (!(wavelength > 0)) throw new Error('波长必须为正数')
  const zone = normalizeZone(options.zoneAxis)
  const k = 1 / wavelength
  const limitingRadius = 2 * k
  const maxG = options.maxG ?? Math.min(2.2, limitingRadius * 0.8)
  if (!(maxG > 0)) throw new Error('最大 |g| 必须为正数')

  const basis = buildPlaneBasis(lattice, zone)
  const zoneVector = directVector(lattice, zone)
  const zoneLength = norm(zoneVector)
  if (!(zoneLength > 0)) throw new Error('带轴长度为零')
  const zoneSpacing = 1 / zoneLength

  const thicknessNm = options.thicknessNm ?? 0
  const thicknessAngstrom = thicknessNm * 10
  const relrodHalfWidth = thicknessAngstrom > 0 ? 1 / (2 * thicknessAngstrom) : 0

  const maxIndex =
    options.maxIndex ??
    Math.min(
      40,
      Math.max(
        2,
        Math.ceil(maxG * Math.max(lattice.cell.a, lattice.cell.b, lattice.cell.c)) + 4,
      ),
    )

  const warnings: string[] = []
  if (!(thicknessNm > 0)) warnings.push('未设置样品厚度，按无限薄晶体处理；倒易点按理想点显示')
  if (maxG >= limitingRadius) warnings.push('最大 |g| 已达到或超过极限球 2/λ；更高角反射无法被激发')

  const points: EwaldPoint[] = []
  for (let h = -maxIndex; h <= maxIndex; h++) {
    for (let kk = -maxIndex; kk <= maxIndex; kk++) {
      for (let l = -maxIndex; l <= maxIndex; l++) {
        if (h === 0 && kk === 0 && l === 0) continue
        const hkl: [number, number, number] = [h, kk, l]
        const gVec = reciprocalVector(lattice, hkl)
        const g = norm(gVec)
        if (g === 0 || g > maxG) continue
        const x = dot(gVec, basis.e1)
        const y = dot(gVec, basis.e2)
        const laueZone = h * zone[0] + kk * zone[1] + l * zone[2]
        const z = dot(gVec, basis.normal)
        const excitationError = (x * x + y * y + z * z + 2 * k * z) / (2 * k)
        const insideLimitingSphere = g <= limitingRadius
        const excited =
          insideLimitingSphere &&
          Math.abs(excitationError) <= Math.max(relrodHalfWidth, 1e-9)
        points.push({
          hkl,
          g,
          d: 1 / g,
          x,
          y,
          z,
          laueZone,
          excitationError,
          relrodHalfWidth,
          insideLimitingSphere,
          excited,
        })
      }
    }
  }

  points.sort(
    (a, b) =>
      Math.abs(a.excitationError) - Math.abs(b.excitationError) ||
      a.g - b.g ||
      a.laueZone - b.laueZone ||
      a.hkl[0] - b.hkl[0] ||
      a.hkl[1] - b.hkl[1] ||
      a.hkl[2] - b.hkl[2],
  )

  const zolz = points.filter((point) => point.laueZone === 0)
  const holz = points.filter((point) => point.laueZone !== 0)
  const excited = points.filter((point) => point.excited)
  if (!excited.length) warnings.push('当前厚度与波长下没有倒易点与艾瓦德球相截；可增大样品厚度或调整带轴')

  return {
    lattice,
    basis,
    zone,
    wavelength,
    k,
    limitingRadius,
    zoneSpacing,
    thicknessNm,
    relrodHalfWidth,
    points,
    zolz,
    holz,
    excited,
    warnings,
  }
}

export function buildEwaldGeometryForCell(
  cell: Parameters<typeof buildLattice>[0],
  options: EwaldOptions,
): EwaldGeometry {
  return buildEwaldGeometry(buildLattice(cell), options)
}

/** Sagitta g²/(2k): how far a ZOLZ point lies from the sphere. */
export function ewaldSagitta(g: number, k: number): number {
  if (!(k > 0)) return NaN
  return (g * g) / (2 * k)
}

/** Compare the Ewald-sphere radius and ZOLZ curvature of two wavelengths. */
export function compareEwaldWavelengths(
  g: number,
  wavelengthA: number,
  wavelengthB: number,
): { kA: number; kB: number; sagittaA: number; sagittaB: number } {
  const kA = 1 / wavelengthA
  const kB = 1 / wavelengthB
  return { kA, kB, sagittaA: ewaldSagitta(g, kA), sagittaB: ewaldSagitta(g, kB) }
}

/** Cartesian position of a point for plotting in the radial (r, z) section. */
export function ewaldSectionPoint(point: EwaldPoint): { x: number; z: number } {
  return { x: Math.hypot(point.x, point.y), z: point.z }
}

/** Unit normal of the reciprocal plane. */
export function ewaldPlaneNormal(basis: PlaneBasis): Vec3 {
  return basis.normal
}
