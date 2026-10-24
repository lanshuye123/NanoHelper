import { electronWavelength } from '@/core/diffraction/scattering'

/** CODATA 2018 constants (SI). */
export const CONSTANTS = {
  h: 6.62607015e-34,
  m0: 9.1093837015e-31,
  e: 1.602176634e-19,
  c: 2.99792458e8,
  mev: 5.1099895e5,
}

export interface ElectronState {
  kV: number
  /** Relativistic electron wavelength in Å. */
  wavelength: number
  /** Relativistic factor γ = 1 + eV/(m₀c²). */
  gamma: number
  /** Speed in m/s. */
  velocity: number
  /** Kinetic energy in keV. */
  kineticKeV: number
  /** Momentum in keV/c. */
  momentumKeVC: number
  /** Electron rest energy in keV. */
  restKeV: number
}

/** Relativistic electron state for an accelerating voltage in kV. */
export function electronState(kV: number): ElectronState {
  if (!(kV > 0)) throw new Error('加速电压必须为正数')
  const V = kV * 1000
  const kineticJ = CONSTANTS.e * V
  const restJ = CONSTANTS.m0 * CONSTANTS.c * CONSTANTS.c
  const gamma = 1 + kineticJ / restJ
  const velocity = CONSTANTS.c * Math.sqrt(Math.max(0, 1 - 1 / (gamma * gamma)))
  const momentum = gamma * CONSTANTS.m0 * velocity
  return {
    kV,
    wavelength: electronWavelength(kV),
    gamma,
    velocity,
    kineticKeV: kineticJ / 1000 / CONSTANTS.e,
    momentumKeVC: (momentum * CONSTANTS.c) / 1000 / CONSTANTS.e,
    restKeV: CONSTANTS.mev / 1000,
  }
}

/**
 * Rayleigh resolution limit δ = 0.61λ / (μ sin β).
 * λ and the result are in Å; β is the collection half-angle in radians.
 */
export function rayleighResolution(wavelengthAngstrom: number, betaRad: number, refractiveIndex = 1): number {
  const denom = refractiveIndex * Math.sin(betaRad)
  if (!(denom > 0)) return NaN
  return (0.61 * wavelengthAngstrom) / denom
}

/**
 * Magnetic-lens focal length  f = K·U / (I·N)².
 * U in volts, I in amperes, N in turns; K is the lens constant.
 */
export function lensFocalLength(K: number, U: number, I: number, N: number): number {
  const excitation = I * N
  if (!(excitation > 0)) return NaN
  return (K * U) / (excitation * excitation)
}

/** Required excitation I·N for a target focal length (K, U as above). */
export function lensExcitation(K: number, U: number, focalLength: number): number {
  if (!(focalLength > 0) || !(K > 0) || !(U > 0)) return NaN
  return Math.sqrt((K * U) / focalLength)
}

export interface AberrationDiscs {
  /** Spherical-aberration disc radius, same unit as Cs. */
  spherical: number
  /** Chromatic-aberration disc radius, same unit as Cc. */
  chromatic: number
  /** Astigmatism disc radius, same unit as defocus. */
  astigmatic: number
}

/**
 * Third-order aberration disc radii:
 *   r_sph = C_s β³
 *   r_chr = C_c (ΔE/E₀) β
 *   r_ast = Δf β
 */
export function aberrationDiscs(params: {
  Cs: number
  Cc: number
  betaRad: number
  energySpread?: number
  energy?: number
  defocus?: number
}): AberrationDiscs {
  const { Cs, Cc, betaRad } = params
  const dEOverE = params.energy && params.energy > 0 ? (params.energySpread ?? 0) / params.energy : 0
  return {
    spherical: Cs * betaRad ** 3,
    chromatic: Cc * dEOverE * betaRad,
    astigmatic: (params.defocus ?? 0) * betaRad,
  }
}

/**
 * Gun brightness  β = i_e / (π(d₀/2)² · π α₀²).
 * Returns A·m⁻²·sr⁻¹. Inputs: beam current in µA, spot diameter in nm,
 * convergence half-angle in mrad.
 */
export function gunBrightness(currentMicroA: number, spotDiameterNm: number, alphaMrad: number): number {
  const i = currentMicroA * 1e-6
  const d = spotDiameterNm * 1e-9
  const alpha = alphaMrad * 1e-3
  if (!(d > 0) || !(alpha > 0)) return NaN
  return i / (Math.PI * (d / 2) ** 2 * Math.PI * alpha ** 2)
}

/**
 * Temporal coherence length  λ_c = v·h / ΔE.
 * Returns nm. ΔE is the energy spread in eV.
 */
export function coherenceLength(kV: number, energySpreadEv: number): number {
  const state = electronState(kV)
  if (!(energySpreadEv > 0)) return NaN
  const lengthM = (state.velocity * CONSTANTS.h) / (energySpreadEv * CONSTANTS.e)
  return lengthM * 1e9
}

/** Camera constant Lλ in mm·Å from wavelength (Å) and camera length (mm). */
export function cameraConstant(wavelengthAngstrom: number, cameraLengthMm: number): number {
  return wavelengthAngstrom * cameraLengthMm
}

/** d-spacing (Å) from a measured radius R (mm) and Lλ (mm·Å). */
export function dFromRadius(radiusMm: number, cameraConstantMmAngstrom: number): number {
  if (!(radiusMm > 0) || !(cameraConstantMmAngstrom > 0)) return NaN
  return cameraConstantMmAngstrom / radiusMm
}

/** Detector radius R (mm) for a d-spacing and Lλ. */
export function radiusFromD(dAngstrom: number, cameraConstantMmAngstrom: number): number {
  if (!(dAngstrom > 0)) return NaN
  return cameraConstantMmAngstrom / dAngstrom
}

/** Depth of field approximation  2λ/β² (same unit as λ). */
export function depthOfField(wavelengthAngstrom: number, betaRad: number): number {
  if (!(betaRad > 0)) return NaN
  return (2 * wavelengthAngstrom) / (betaRad * betaRad)
}

/** Electron wavelength from a voltage, re-exported for convenience. */
export { electronWavelength }

export interface CtfOptions {
  wavelengthAngstrom: number
  /** Spherical aberration in Å. */
  csAngstrom: number
  /** Defocus in Å (negative = underfocus in the common sign convention). */
  defocusAngstrom: number
  maxU?: number
  points?: number
  /** Optional Gaussian information envelope: exp(-(u/infoLimit)^2). */
  infoLimit?: number
}

export function scherzerDefocus(csAngstrom: number, wavelengthAngstrom: number): number {
  return -Math.sqrt((4 / 3) * csAngstrom * wavelengthAngstrom)
}

export interface CtfResult {
  u: number[]
  ctf: number[]
  /** First zero of the CTF in Å⁻¹. */
  firstZero: number
  /** Point resolution 1/u_first, in Å. */
  pointResolution: number
  /** Scherzer defocus for the given Cs and λ, in Å. */
  scherzerDefocus: number
  /** Scherzer point resolution, in Å. */
  scherzerResolution: number
}

/**
 * Contrast transfer function (kinematic, weak-phase-object):
 *
 *   CTF(u) = −sin[πλu²(Δf + ½C_sλ²u²)] · E(u)
 *
 * with u in Å⁻¹, λ, C_s and Δf in Å.
 */
export function ctfCurve(options: CtfOptions): CtfResult {
  const { wavelengthAngstrom: lambda, csAngstrom: cs, defocusAngstrom: defocus } = options
  const maxU = options.maxU ?? 2
  const points = Math.max(64, options.points ?? 1600)
  const u: number[] = []
  const ctf: number[] = []
  let firstZero = NaN
  let previousU = 0
  let previousC = 0
  for (let i = 0; i <= points; i++) {
    const x = (maxU * i) / points
    const chi = Math.PI * lambda * x * x * (defocus + 0.5 * cs * lambda * lambda * x * x)
    let value = -Math.sin(chi)
    if (options.infoLimit && options.infoLimit > 0) {
      value *= Math.exp(-((x / options.infoLimit) ** 2))
    }
    u.push(x)
    ctf.push(value)
    if (i > 0 && Number.isNaN(firstZero) && previousC !== 0 && Math.sign(value) !== Math.sign(previousC)) {
      const denom = Math.abs(previousC) + Math.abs(value)
      firstZero = denom > 0 ? previousU + (x - previousU) * (Math.abs(previousC) / denom) : x
    }
    previousU = x
    previousC = value
  }
  const scherzer = scherzerDefocus(cs, lambda)
  const scherzerResolution = 0.66 * cs ** 0.25 * lambda ** 0.75
  return {
    u,
    ctf,
    firstZero,
    pointResolution: Number.isFinite(firstZero) && firstZero > 0 ? 1 / firstZero : NaN,
    scherzerDefocus: scherzer,
    scherzerResolution,
  }
}
