import scatteringData from '@/data/scattering.json'
import elementsData from '@/data/elements.json'

export interface ScatteringEntry {
  z: number
  a: number[]
  b: number[]
  c: number
}

const scattering = scatteringData as Record<string, ScatteringEntry>
const elements = elementsData as Array<{
  z: number
  symbol: string
  name: string
  mass: number
  density: number | null
  covalentRadius: number | null
}>

export const ELEMENTS = elements
const elementBySymbol = new Map(elements.map((e) => [e.symbol.toUpperCase(), e]))

export function getElement(symbol: string) {
  return elementBySymbol.get(normalizeElementSymbol(symbol).toUpperCase())
}

/** Strip a trailing charge (O2- → O) and normalize casing (SI → Si). */
export function normalizeElementSymbol(input: string): string {
  const raw = (input ?? '').trim()
  const m = raw.match(/^([A-Za-z]{1,2})/)
  if (!m) return raw
  const s = m[1]
  return s[0].toUpperCase() + s.slice(1).toLowerCase()
}

const SCATTERING_KEYS = new Map(Object.keys(scattering).map((k) => [k.toLowerCase(), k]))

export interface ScatteringLookup {
  f: number
  entry: ScatteringEntry | null
  fallback: boolean
}

/**
 * Elastic X-ray atomic scattering factor f0(s), s = sinθ/λ in Å⁻¹.
 *
 * Uses the Waasmaier–Kirfel five-Gaussian parameterisation:
 *   f0(s) = c + Σ aᵢ exp(−bᵢ s²)
 * Data: DABAX f0_WaasKirf.dat, derived from International Tables for
 * Crystallography Vol. C (1992); see scripts/vendor/ for provenance.
 */
export function scatteringFactorDetailed(element: string, s: number): ScatteringLookup {
  const normalized = normalizeElementSymbol(element)
  const candidates = [element, normalized].filter(Boolean)
  let entry: ScatteringEntry | null = null
  for (const candidate of candidates) {
    const key = SCATTERING_KEYS.get(candidate.toLowerCase().replace(/\s+/g, ''))
    if (key) {
      entry = scattering[key]
      break
    }
  }
  const s2 = s * s
  if (entry) {
    let f = entry.c
    for (let i = 0; i < 5; i++) f += entry.a[i] * Math.exp(-entry.b[i] * s2)
    return { f, entry, fallback: false }
  }
  const el = getElement(normalized)
  return { f: el ? el.z * Math.exp(-0.02 * s2) : 0, entry: null, fallback: true }
}

export function scatteringFactor(element: string, s: number): number {
  return scatteringFactorDetailed(element, s).f
}

/** Atomic weight in g/mol (fallback: 0). */
export function atomicMass(element: string): number {
  return getElement(element)?.mass ?? 0
}

/** Electron wavelength in Å for an accelerating voltage in kV (relativistic). */
export function electronWavelength(kV: number): number {
  const h = 6.62607015e-34
  const m = 9.1093837015e-31
  const e = 1.602176634e-19
  const c = 2.99792458e8
  const V = kV * 1000
  const denominator = Math.sqrt(2 * m * e * V * (1 + (e * V) / (2 * m * c * c)))
  return (h / denominator) * 1e10
}

export interface Anode {
  id: string
  label: string
  ka1: number
  ka2: number
  ka: number
  kb?: number
}

/** Characteristic X-ray wavelengths in Å (Kα1, Kα2, weighted Kα). */
export const ANODES: Anode[] = [
  { id: 'Cu', label: 'Cu Kα (1.5406 Å)', ka1: 1.54056, ka2: 1.54439, ka: 1.54184, kb: 1.39222 },
  { id: 'Co', label: 'Co Kα (1.7890 Å)', ka1: 1.78897, ka2: 1.79285, ka: 1.79026, kb: 1.62079 },
  { id: 'Mo', label: 'Mo Kα (0.7093 Å)', ka1: 0.7093, ka2: 0.71359, ka: 0.71073, kb: 0.63229 },
  { id: 'Cr', label: 'Cr Kα (2.2897 Å)', ka1: 2.2897, ka2: 2.29361, ka: 2.291, kb: 2.08487 },
  { id: 'Fe', label: 'Fe Kα (1.9360 Å)', ka1: 1.93604, ka2: 1.93998, ka: 1.93736, kb: 1.75661 },
  { id: 'Ag', label: 'Ag Kα (0.5594 Å)', ka1: 0.55941, ka2: 0.5638, ka: 0.56087, kb: 0.49701 },
]

export function getAnode(id: string): Anode {
  return ANODES.find((a) => a.id === id) ?? ANODES[0]
}
