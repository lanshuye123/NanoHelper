import { buildLattice, dSpacing, type CellParams } from '@/core/lattice/cell'

export interface RefinePeak {
  twoTheta: number
  h: number
  k: number
  l: number
  /** Optional weight (default 1). */
  weight?: number
}

export interface RefineFlags {
  a: boolean
  b: boolean
  c: boolean
  alpha: boolean
  beta: boolean
  gamma: boolean
  zero: boolean
}

export const DEFAULT_REFINE_FLAGS: RefineFlags = {
  a: true,
  b: true,
  c: true,
  alpha: false,
  beta: false,
  gamma: false,
  zero: true,
}

export interface RefinedPeak {
  hkl: [number, number, number]
  observed: number
  calculated: number
  residual: number
  dObs: number
  dCalc: number
  weight: number
}

export interface RefineResult {
  cell: CellParams
  zero: number
  peaks: RefinedPeak[]
  iterations: number
  rmsDeg: number
  rwpPercent: number
  chi2Reduced: number
  sigma: Partial<Record<keyof CellParams | 'zero', number>>
  warnings: string[]
}

export interface RefineOptions {
  wavelength: number
  flags?: Partial<RefineFlags>
  maxIterations?: number
  /** Initial instrument zero shift in degrees (default 0). */
  initialZero?: number
}

const FLAG_KEYS = ['a', 'b', 'c', 'alpha', 'beta', 'gamma', 'zero'] as const
type ParamKey = (typeof FLAG_KEYS)[number]

export function braggTwoTheta(d: number, wavelength: number): number {
  const sinTheta = wavelength / (2 * d)
  if (!(sinTheta > 0) || sinTheta > 1) return NaN
  return (2 * Math.asin(sinTheta) * 180) / Math.PI
}

export function dFromTwoTheta(twoTheta: number, wavelength: number): number {
  const theta = (twoTheta * Math.PI) / 360
  const sin = Math.sin(theta)
  if (!(sin > 0)) return NaN
  return wavelength / (2 * sin)
}

/**
 * Refine unit-cell parameters and an instrument zero shift from indexed peak
 * positions by non-linear least squares (Levenberg–Marquardt).
 *
 * The model is  2θ_calc = 2·asin(λ / 2d_hkl(cell)) + zero.
 */
export function refineLattice(
  peaks: readonly RefinePeak[],
  initialCell: CellParams,
  options: RefineOptions,
): RefineResult {
  const wavelength = options.wavelength
  if (!(wavelength > 0)) throw new Error('X 射线波长必须为正数')
  const warnings: string[] = []
  const validPeaks = peaks.filter(
    (p) =>
      Number.isFinite(p.twoTheta) &&
      Number.isFinite(p.h) &&
      Number.isFinite(p.k) &&
      Number.isFinite(p.l) &&
      !(p.h === 0 && p.k === 0 && p.l === 0),
  )
  if (!validPeaks.length) throw new Error('至少需要一个带 hkl 指标的峰')
  if (validPeaks.length < peaks.length) warnings.push(`已忽略 ${peaks.length - validPeaks.length} 个无效峰`)
  if (validPeaks.length < 3) warnings.push('峰数少于 3，精修结果可能不稳定')

  const flags: RefineFlags = { ...DEFAULT_REFINE_FLAGS, ...(options.flags ?? {}) }
  const freeKeys = FLAG_KEYS.filter((key) => flags[key])
  if (!freeKeys.length) throw new Error('至少需要勾选一个精修参数')

  let cell: CellParams = { ...initialCell }
  let zero = options.initialZero ?? 0
  let params = freeKeys.map((key) => (key === 'zero' ? zero : cell[key]))

  const weights = validPeaks.map((p) => (Number.isFinite(p.weight) && (p.weight ?? 0) > 0 ? p.weight! : 1))

  function calcFor(p: readonly number[]): number[] {
    const c: CellParams = { ...cell }
    let z = zero
    freeKeys.forEach((key, i) => {
      if (key === 'zero') z = p[i]
      else c[key] = p[i]
    })
    const lattice = buildLattice(c)
    return validPeaks.map((peak) => {
      const d = dSpacing(lattice, [peak.h, peak.k, peak.l])
      return braggTwoTheta(d, wavelength) + z
    })
  }

  function residuals(p: readonly number[]): number[] {
    const calc = calcFor(p)
    return validPeaks.map((peak, i) => peak.twoTheta - calc[i])
  }

  function weightedCost(r: readonly number[]): number {
    let sum = 0
    for (let i = 0; i < r.length; i++) sum += weights[i] * r[i] * r[i]
    return sum
  }

  let r = residuals(params)
  let cost = weightedCost(r)
  if (!Number.isFinite(cost)) throw new Error('初始晶胞无法对峰位进行拟合，请检查参数')

  let lambda = 1e-3
  let iterations = 0
  const maxIterations = options.maxIterations ?? 80
  const m = validPeaks.length
  const nFree = freeKeys.length
  let lastJtJ: number[][] | null = null

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1
    const J: number[][] = validPeaks.map(() => new Array(nFree).fill(0))
    for (let j = 0; j < nFree; j++) {
      const p = params[j]
      const step = j === 0 ? 1e-6 : 1e-6
      const h = Math.max(step, Math.abs(p) * 1e-6)
      const probe = [...params]
      probe[j] = p + h
      let rp: number[]
      try {
        rp = residuals(probe)
      } catch {
        continue
      }
      for (let i = 0; i < m; i++) J[i][j] = (rp[i] - r[i]) / h
    }

    const A: number[][] = Array.from({ length: nFree }, () => new Array(nFree).fill(0))
    const b: number[] = new Array(nFree).fill(0)
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < nFree; j++) {
        b[j] -= weights[i] * J[i][j] * r[i]
        for (let k = 0; k < nFree; k++) A[j][k] += weights[i] * J[i][j] * J[i][k]
      }
    }
    lastJtJ = A.map((row) => [...row])

    const damped = A.map((row, i) => row.map((v, j) => (i === j ? v + lambda * Math.max(v, 1e-12) : v)))
    let delta: number[] | null = null
    try {
      delta = solveLinear(damped, b)
    } catch {
      lambda *= 10
      if (lambda > 1e12) break
      continue
    }

    const candidate = params.map((p, i) => p + delta![i])
    let candidateCost: number
    try {
      candidateCost = weightedCost(residuals(candidate))
    } catch {
      lambda *= 10
      if (lambda > 1e12) break
      continue
    }

    if (Number.isFinite(candidateCost) && candidateCost < cost) {
      const relative = (cost - candidateCost) / Math.max(cost, 1e-30)
      params = candidate
      r = residuals(params)
      cost = candidateCost
      lambda = Math.max(1e-12, lambda * 0.7)
      if (relative < 1e-12) break
    } else {
      lambda *= 3
      if (lambda > 1e12) break
    }
  }

  freeKeys.forEach((key, i) => {
    if (key === 'zero') zero = params[i]
    else cell[key] = params[i]
  })
  // Guard against tiny negative/zero values introduced by the optimizer.
  cell = {
    a: Math.max(1e-6, cell.a),
    b: Math.max(1e-6, cell.b),
    c: Math.max(1e-6, cell.c),
    alpha: Math.min(179.999, Math.max(1e-4, cell.alpha)),
    beta: Math.min(179.999, Math.max(1e-4, cell.beta)),
    gamma: Math.min(179.999, Math.max(1e-4, cell.gamma)),
  }
  const lattice = buildLattice(cell)

  const refinedPeaks: RefinedPeak[] = validPeaks.map((peak, i) => {
    const dCalc = dSpacing(lattice, [peak.h, peak.k, peak.l])
    const calculated = braggTwoTheta(dCalc, wavelength) + zero
    return {
      hkl: [peak.h, peak.k, peak.l],
      observed: peak.twoTheta,
      calculated,
      residual: peak.twoTheta - calculated,
      dObs: dFromTwoTheta(peak.twoTheta, wavelength),
      dCalc,
      weight: weights[i],
    }
  })

  const sumW = weights.reduce((s, w) => s + w, 0)
  const rms = Math.sqrt(
    refinedPeaks.reduce((s, p, i) => s + weights[i] * p.residual * p.residual, 0) / Math.max(sumW, 1e-30),
  )
  const sumWR2 = refinedPeaks.reduce((s, p, i) => s + weights[i] * p.residual * p.residual, 0)
  const sumWObs2 = refinedPeaks.reduce((s, p, i) => s + weights[i] * p.observed * p.observed, 0)
  const rwp = sumWObs2 > 0 ? Math.sqrt(sumWR2 / sumWObs2) * 100 : NaN
  const dof = Math.max(1, m - nFree)
  const chi2Reduced = sumWR2 / dof

  const sigma: Partial<Record<ParamKey, number>> = {}
  if (lastJtJ && m > nFree) {
    try {
      const inv = invertMatrix(lastJtJ)
      const variance = chi2Reduced
      freeKeys.forEach((key, i) => {
        sigma[key] = Math.sqrt(Math.max(0, inv[i][i] * variance))
      })
    } catch {
      warnings.push('无法估计参数标准误差（法方程奇异）')
    }
  } else {
    warnings.push('峰数不足以估计参数标准误差')
  }

  if (!Number.isFinite(zero)) warnings.push('零点偏移不是有限值')
  if (Math.abs(zero) > 1) warnings.push('拟合得到的零点偏移大于 1°，请检查峰指标是否正确')

  return {
    cell,
    zero,
    peaks: refinedPeaks,
    iterations,
    rmsDeg: rms,
    rwpPercent: rwp,
    chi2Reduced,
    sigma,
    warnings,
  }
}

export interface NelsonRileyPoint {
  hkl: [number, number, number]
  twoTheta: number
  aObs: number
  nr: number
}

export interface NelsonRileyResult {
  points: NelsonRileyPoint[]
  intercept: number
  slope: number
  r2: number
}

/**
 * Nelson–Riley extrapolation for cubic materials.
 *
 *   a_obs = d_obs·√(h²+k²+l²)
 *   NR    = ½(cos²θ/sinθ + cos²θ/θ)    (θ in radians)
 */
export function nelsonRiley(
  peaks: readonly RefinedPeak[],
  cell: CellParams,
  options: { zero?: number; wavelength?: number } = {},
): NelsonRileyResult | null {
  const cubic =
    Math.abs(cell.a - cell.b) < 1e-4 &&
    Math.abs(cell.a - cell.c) < 1e-4 &&
    Math.abs(cell.alpha - 90) < 1e-3 &&
    Math.abs(cell.beta - 90) < 1e-3 &&
    Math.abs(cell.gamma - 90) < 1e-3
  if (!cubic) return null
  const points: NelsonRileyPoint[] = []
  const zero = options.zero ?? 0
  for (const peak of peaks) {
    const N = peak.hkl[0] ** 2 + peak.hkl[1] ** 2 + peak.hkl[2] ** 2
    if (N <= 0) continue
    const corrected = peak.observed - zero
    const dObs = options.wavelength ? dFromTwoTheta(corrected, options.wavelength) : peak.dObs
    if (!(dObs > 0)) continue
    const theta = (corrected * Math.PI) / 360
    const sin = Math.sin(theta)
    const cos = Math.cos(theta)
    if (!(sin > 0) || !(theta > 0)) continue
    const nr = 0.5 * ((cos * cos) / sin + (cos * cos) / theta)
    points.push({ hkl: peak.hkl, twoTheta: corrected, aObs: dObs * Math.sqrt(N), nr })
  }
  if (points.length < 2) return null
  const n = points.length
  const meanX = points.reduce((s, p) => s + p.nr, 0) / n
  const meanY = points.reduce((s, p) => s + p.aObs, 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const p of points) {
    const dx = p.nr - meanX
    const dy = p.aObs - meanY
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  const slope = sxx > 0 ? sxy / sxx : 0
  const intercept = meanY - slope * meanX
  const r2 = sxx > 0 && syy > 0 ? (sxy * sxy) / (sxx * syy) : 1
  return { points, intercept, slope, r2 }
}

/** Solve A·x = b with partial pivoting. A is modified in place. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    let max = Math.abs(M[col][col])
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(M[row][col])
      if (v > max) {
        max = v
        pivot = row
      }
    }
    if (max < 1e-14) throw new Error('法方程奇异')
    if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]]
    const diag = M[col][col]
    for (let j = col; j <= n; j++) M[col][j] /= diag
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = M[row][col]
      if (factor === 0) continue
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j]
    }
  }
  return M.map((row) => row[n])
}

function invertMatrix(A: number[][]): number[][] {
  const n = A.length
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let pivot = col
    let max = Math.abs(M[col][col])
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(M[row][col])
      if (v > max) {
        max = v
        pivot = row
      }
    }
    if (max < 1e-14) throw new Error('矩阵奇异')
    if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]]
    const diag = M[col][col]
    for (let j = 0; j < 2 * n; j++) M[col][j] /= diag
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = M[row][col]
      if (factor === 0) continue
      for (let j = 0; j < 2 * n; j++) M[row][j] -= factor * M[col][j]
    }
  }
  return M.map((row) => row.slice(n))
}
