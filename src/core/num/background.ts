import { interpolateAt, resampleLinear } from '@/core/num/interpolate'

export interface BackgroundOptions {
  method: 'snip' | 'linear' | 'poly'
  iterations?: number
  anchors?: Array<{ x: number; y: number }>
  order?: number
  clipNegative?: boolean
}

export interface BackgroundResult {
  corrected: Float64Array
  background: Float64Array
}

/**
 * SNIP background estimation (Statistics-sensitive Non-linear Iterative
 * Peak-clipping). Works on the LLS-transformed counts:
 *   z = ln(ln(√(y+1)+1)+1)
 * and iteratively averages neighbouring channels while taking the minimum.
 */
export function snipBackground(y: ArrayLike<number>, iterations = 40): Float64Array {
  const n = y.length
  let minY = Infinity
  for (let i = 0; i < y.length; i++) {
    if (Number.isFinite(y[i]) && y[i] < minY) minY = y[i]
  }
  const offset = Number.isFinite(minY) ? Math.max(0, 1 - minY) : 0
  const z = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, y[i] + offset)
    z[i] = Math.log(Math.log(Math.sqrt(v + 1) + 1) + 1)
  }
  const iter = Math.max(1, Math.min(Math.floor(iterations), Math.floor(n / 2) - 1))
  for (let p = 1; p <= iter; p++) {
    for (let i = p; i < n - p; i++) {
      const avg = (z[i - p] + z[i + p]) / 2
      if (z[i] > avg) z[i] = avg
    }
  }
  const bg = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = Math.exp(z[i]) - 1
    const v = Math.exp(a) - 1
    bg[i] = v * v - 1 - offset
  }
  return bg
}

function polynomialFit(xs: number[], ys: number[], order: number): (x: number) => number {
  const cols = order + 1
  const ATA = Array.from({ length: cols }, () => new Array(cols).fill(0))
  const ATy = new Array(cols).fill(0)
  for (let k = 0; k < xs.length; k++) {
    const powers: number[] = []
    let p = 1
    for (let j = 0; j < cols; j++) {
      powers.push(p)
      p *= xs[k]
    }
    for (let i = 0; i < cols; i++) {
      ATy[i] += powers[i] * ys[k]
      for (let j = 0; j < cols; j++) ATA[i][j] += powers[i] * powers[j]
    }
  }
  // Solve ATA·c = ATy by Gaussian elimination.
  const n = cols
  const a = ATA.map((row, i) => [...row, ATy[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-14) break
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    const div = a[col][col]
    for (let j = col; j <= n; j++) a[col][j] /= div
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = a[row][col]
      for (let j = col; j <= n; j++) a[row][j] -= f * a[col][j]
    }
  }
  const coeffs = a.map((row) => row[n])
  return (x: number) => {
    let sum = 0
    let p = 1
    for (let j = 0; j < cols; j++) {
      sum += coeffs[j] * p
      p *= x
    }
    return sum
  }
}

export function estimateBackground(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  options: BackgroundOptions,
): BackgroundResult {
  const n = Math.min(xs.length, ys.length)
  const background = new Float64Array(n)
  if (options.method === 'snip') {
    const bg = snipBackground(ys, options.iterations ?? 40)
    background.set(bg)
  } else if (options.method === 'linear') {
    const anchors = (options.anchors ?? []).slice().sort((a, b) => a.x - b.x)
    if (anchors.length < 2) throw new Error('线性背底至少需要 2 个锚点')
    for (let i = 0; i < n; i++) {
      background[i] = interpolateAt(
        anchors.map((a) => a.x),
        anchors.map((a) => a.y),
        xs[i],
        'clamp',
      )
    }
  } else {
    const anchors = (options.anchors ?? []).slice().sort((a, b) => a.x - b.x)
    const order = Math.max(1, Math.min(options.order ?? 3, 8))
    if (anchors.length >= order + 1) {
      const fn = polynomialFit(
        anchors.map((a) => a.x),
        anchors.map((a) => a.y),
        order,
      )
      for (let i = 0; i < n; i++) background[i] = fn(xs[i])
    } else {
      const bg = snipBackground(ys, options.iterations ?? 40)
      background.set(bg)
    }
  }
  const corrected = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const v = ys[i] - background[i]
    corrected[i] = options.clipNegative === false ? v : Math.max(0, v)
  }
  return { corrected, background }
}

/**
 * Rachinger Kα2 stripping.
 *
 * At angle x, the observed intensity is I₁(x) + r·I₁(x'), where x' is the
 * Kα1 angle that maps to the same d-spacing as Kα2 at x. Since x' < x, the
 * correction is applied from low to high angle.
 */
export function stripKalpha2(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  ka1: number,
  ka2: number,
  ratio = 0.5,
): Float64Array {
  const n = Math.min(xs.length, ys.length)
  const out = new Float64Array(n)
  const xsArr = Array.from(xs)
  for (let i = 0; i < n; i++) {
    const x = xs[i]
    const theta = (x * Math.PI) / 360
    const sinThetaPrime = (ka1 / ka2) * Math.sin(theta)
    let correction = 0
    if (sinThetaPrime > 0 && sinThetaPrime <= 1 && i > 0) {
      const xPrime = (2 * Math.asin(sinThetaPrime) * 180) / Math.PI
      correction = ratio * interpolateAt(xsArr, out, xPrime, 'zero')
    }
    out[i] = Math.max(0, ys[i] - correction)
  }
  return out
}

/** Resample to a uniform grid; used before algorithms that assume a constant step. */
export function ensureUniform(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
): { x: Float64Array; y: Float64Array } {
  if (xs.length < 3) return { x: new Float64Array(xs), y: new Float64Array(ys) }
  const step = (xs[xs.length - 1] - xs[0]) / (xs.length - 1)
  let uniform = true
  for (let i = 1; i < xs.length; i++) {
    if (Math.abs(xs[i] - xs[i - 1] - step) > Math.abs(step) * 1e-3 + 1e-9) {
      uniform = false
      break
    }
  }
  if (uniform) return { x: new Float64Array(xs), y: new Float64Array(ys) }
  return resampleLinear(xs, ys, step)
}
