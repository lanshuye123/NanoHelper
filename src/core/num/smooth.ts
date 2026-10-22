/** Moving-average and Savitzky–Golay smoothing. */

export function movingAverage(y: ArrayLike<number>, window: number): Float64Array {
  const n = y.length
  const w = Math.max(1, Math.floor(window))
  const half = Math.floor(w / 2)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half)
    const end = Math.min(n - 1, i + half)
    let sum = 0
    for (let j = start; j <= end; j++) sum += y[j]
    out[i] = sum / (end - start + 1)
  }
  return out
}

export interface SavitzkyGolayOptions {
  window: number
  order: number
  derivative?: 0 | 1
}

/**
 * Savitzky–Golay smoothing coefficients for the centre point.
 * Solves the normal equations of a local polynomial fit:
 *   c = e₀ᵀ (AᵀA)⁻¹ Aᵀ
 */
export function savitzkyGolayCoefficients(window: number, order: number, derivative: 0 | 1 = 0): number[] {
  const w = Math.floor(window)
  if (w % 2 === 0) throw new Error('Savitzky–Golay 窗口必须为奇数')
  if (w < 3) throw new Error('窗口至少为 3')
  if (order < 0 || order >= w) throw new Error('多项式阶数必须小于窗口')
  const m = (w - 1) / 2
  const cols = order + 1
  const ATA: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0))
  for (let t = -m; t <= m; t++) {
    const powers: number[] = []
    let p = 1
    for (let j = 0; j < cols; j++) {
      powers.push(p)
      p *= t
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < cols; j++) ATA[i][j] += powers[i] * powers[j]
    }
  }
  const inv = invertMatrix(ATA)
  // The smoothed value at t=0 is β₀, so coefficients for y(t) are the first row of inv·Aᵀ.
  const coeffs: number[] = []
  for (let t = -m; t <= m; t++) {
    let sum = 0
    let p = 1
    for (let j = 0; j < cols; j++) {
      sum += inv[0][j] * p
      p *= t
    }
    coeffs.push(sum)
  }
  if (derivative === 1) {
    // First derivative at t=0: β₁, i.e. second row of inv·Aᵀ (per sample spacing).
    const dcoeffs: number[] = []
    for (let t = -m; t <= m; t++) {
      let sum = 0
      let p = 1
      for (let j = 0; j < cols; j++) {
        sum += (j >= 1 ? inv[1][j] : 0) * p
        p *= t
      }
      dcoeffs.push(sum)
    }
    return dcoeffs
  }
  return coeffs
}

export function savitzkyGolay(y: ArrayLike<number>, window: number, order: number): Float64Array {
  const n = y.length
  const coeffs = savitzkyGolayCoefficients(window, order)
  const half = (coeffs.length - 1) / 2
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    if (i < half || i >= n - half) {
      // Shrink the window near the edges while keeping the same coefficients
      // symmetrically (equivalent to local edge padding by reflection).
      const start = Math.max(0, i - half)
      const end = Math.min(n - 1, i + half)
      let sum = 0
      let count = 0
      for (let j = start; j <= end; j++) {
        sum += y[j]
        count++
      }
      out[i] = count ? sum / count : y[i]
      continue
    }
    let sum = 0
    for (let k = -half; k <= half; k++) sum += coeffs[k + half] * y[i + k]
    out[i] = sum
  }
  return out
}

/** Gaussian elimination with partial pivoting (small matrices only). */
export function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length
  const a = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-14) throw new Error('矩阵奇异')
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    const div = a[col][col]
    for (let j = 0; j < 2 * n; j++) a[col][j] /= div
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = a[row][col]
      if (factor === 0) continue
      for (let j = 0; j < 2 * n; j++) a[row][j] -= factor * a[col][j]
    }
  }
  return a.map((row) => row.slice(n))
}
