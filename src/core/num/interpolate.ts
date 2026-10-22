/** Linear interpolation helpers. Arrays must be sorted by x. */

export function interpolateAt(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  x: number,
  outside: 'nan' | 'clamp' | 'zero' = 'nan',
): number {
  const n = xs.length
  if (n === 0) return NaN
  if (n === 1) return x === xs[0] ? ys[0] : outside === 'zero' ? 0 : outside === 'clamp' ? ys[0] : NaN
  if (x < xs[0]) return outside === 'zero' ? 0 : outside === 'clamp' ? ys[0] : NaN
  if (x > xs[n - 1]) return outside === 'zero' ? 0 : outside === 'clamp' ? ys[n - 1] : NaN

  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= x) lo = mid
    else hi = mid
  }
  const x0 = xs[lo]
  const x1 = xs[hi]
  if (x1 === x0) return ys[lo]
  const t = (x - x0) / (x1 - x0)
  return ys[lo] + t * (ys[hi] - ys[lo])
}

export interface ResampleResult {
  x: Float64Array
  y: Float64Array
}

export function resampleLinear(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  step: number,
  xMin?: number,
  xMax?: number,
): ResampleResult {
  if (!(step > 0)) throw new Error('步长必须为正数')
  const start = xMin ?? xs[0]
  const end = xMax ?? xs[xs.length - 1]
  if (!(end > start)) throw new Error('重采样区间无效')
  const n = Math.floor((end - start) / step) + 1
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const xi = start + i * step
    x[i] = xi
    y[i] = interpolateAt(xs, ys, xi, 'clamp')
  }
  return { x, y }
}

/** Area under the curve using the trapezoidal rule. */
export function trapezoidArea(xs: ArrayLike<number>, ys: ArrayLike<number>): number {
  let area = 0
  for (let i = 1; i < xs.length; i++) {
    area += ((ys[i] + ys[i - 1]) / 2) * (xs[i] - xs[i - 1])
  }
  return area
}

export function minMax(values: ArrayLike<number>): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}
