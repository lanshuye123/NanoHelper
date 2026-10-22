import { scatteringFactor } from '@/core/diffraction/scattering'
import { gLength, type CellParams, type Lattice } from '@/core/lattice/cell'

export interface AtomSite {
  element: string
  /** fractional coordinates */
  x: number
  y: number
  z: number
  occupancy?: number
  /** isotropic temperature factor B (Å²) */
  biso?: number
  label?: string
}

export interface Structure {
  name?: string
  cell: CellParams
  atoms: AtomSite[]
  spaceGroupNumber?: number
  spaceGroupSymbol?: string
  source?: string
}

export interface Complex {
  re: number
  im: number
}

export interface StructureFactorResult {
  hkl: number[]
  re: number
  im: number
  /** |F|² */
  f2: number
  /** |F| */
  absF: number
  /** Σ|f|, useful as a scale for numerical absence detection */
  sumF: number
  s: number
  /** true when |F| is negligible relative to Σf (systematic absence or empty) */
  absent: boolean
}

/**
 * Structure factor F(hkl) = Σⱼ fⱼ(s)·occⱼ·exp(−Bⱼs²)·exp[2πi(hx+ky+lz)].
 *
 * s = sinθ/λ = |g|/2, so no wavelength is needed here.
 */
export function structureFactor(
  lattice: Lattice,
  atoms: readonly AtomSite[],
  hkl: readonly number[],
): StructureFactorResult {
  const s = gLength(lattice, hkl) / 2
  let re = 0
  let im = 0
  let sumF = 0
  for (const atom of atoms) {
    const occ = atom.occupancy ?? 1
    if (occ <= 0) continue
    const f = scatteringFactor(atom.element, s) * occ * Math.exp(-(atom.biso ?? 0) * s * s)
    sumF += f
    const phase = 2 * Math.PI * (hkl[0] * atom.x + hkl[1] * atom.y + hkl[2] * atom.z)
    re += f * Math.cos(phase)
    im += f * Math.sin(phase)
  }
  const f2 = re * re + im * im
  return {
    hkl: [...hkl],
    re,
    im,
    f2,
    absF: Math.sqrt(f2),
    sumF,
    s,
    absent: sumF <= 1e-12 || Math.sqrt(f2) < 1e-8 * sumF,
  }
}

/** Friedel pair check: |F(hkl)| = |F(-h-k-l)| for real scattering factors. */
export function friedelPair(
  lattice: Lattice,
  atoms: readonly AtomSite[],
  hkl: readonly number[],
): [StructureFactorResult, StructureFactorResult] {
  return [structureFactor(lattice, atoms, hkl), structureFactor(lattice, atoms, hkl.map((v) => -v))]
}

/**
 * Multiplicity of a reflection in a powder experiment, given the rotation
 * parts of the space-group operations. Returns the number of distinct signed
 * (hkl) vectors in the orbit.
 */
export function reflectionOrbit(hkl: readonly number[], rotations: number[][][]): number[][] {
  const seen = new Map<string, number[]>()
  for (const r of rotations) {
    const h = r[0][0] * hkl[0] + r[0][1] * hkl[1] + r[0][2] * hkl[2]
    const k = r[1][0] * hkl[0] + r[1][1] * hkl[1] + r[1][2] * hkl[2]
    const l = r[2][0] * hkl[0] + r[2][1] * hkl[1] + r[2][2] * hkl[2]
    seen.set(`${h},${k},${l}`, [h, k, l])
  }
  return [...seen.values()]
}

export function reflectionMultiplicity(hkl: readonly number[], rotations: number[][][]): number {
  return reflectionOrbit(hkl, rotations).length
}

/** Check whether an atom site is inside the cell (for validation/reporting). */
export function isInsideCell(atom: AtomSite, tolerance = 1e-6): boolean {
  return [atom.x, atom.y, atom.z].every((v) => v > -tolerance && v < 1 + tolerance)
}

/** Number of formula units per cell, given a formula mass and cell volume (Å³). */
export function formulaUnitsPerCell(density: number, volume: number, molarMass: number): number {
  // Z = ρ·V·N_A / M  (V in Å³, ρ in g/cm³, M in g/mol)
  return (density * volume * 1e-24 * 6.02214076e23) / molarMass
}

/** Theoretical density from the cell content and volume (g/cm³). */
export function theoreticalDensity(volume: number, molarMass: number, z: number): number {
  return (z * molarMass) / (volume * 1e-24 * 6.02214076e23)
}
