export type LengthUnit = 'nm' | 'um' | 'mm'

export const LENGTH_UNITS: Array<{ id: LengthUnit; label: string; toNm: number }> = [
  { id: 'nm', label: 'nm', toNm: 1 },
  { id: 'um', label: 'µm', toNm: 1e3 },
  { id: 'mm', label: 'mm', toNm: 1e6 },
]

export const UNIT_TO_NM: Record<LengthUnit, number> = { nm: 1, um: 1e3, mm: 1e6 }

export function unitToNm(unit: LengthUnit): number {
  return UNIT_TO_NM[unit]
}

export function convertNmTo(valueNm: number, unit: LengthUnit): number {
  return valueNm / UNIT_TO_NM[unit]
}

export function convertToNm(value: number, unit: LengthUnit): number {
  return value * UNIT_TO_NM[unit]
}

export interface Calibration {
  /** Length of the calibration line in image pixels. */
  pixelLength: number
  /** Real length of the scale bar. */
  realLength: number
  unit: LengthUnit
  /** Nanometres per image pixel. */
  nmPerPx: number
}

export function makeCalibration(pixelLength: number, realLength: number, unit: LengthUnit): Calibration {
  if (!(pixelLength > 0)) throw new Error('标尺线长度必须大于 0 像素')
  if (!(realLength > 0)) throw new Error('标尺真实长度必须大于 0')
  return {
    pixelLength,
    realLength,
    unit,
    nmPerPx: convertToNm(realLength, unit) / pixelLength,
  }
}

export type MeasurementSource = 'manual' | 'auto'

export interface ParticleMeasurement {
  id: string
  /** 1-based display index; re-numbered by the view after deletion. */
  index: number
  kind: 'line' | 'area'
  /** For a line: endpoints. For an area: centroid and a horizontal radius endpoint. */
  x1: number
  y1: number
  x2: number
  y2: number
  lengthPx: number
  sizeNm: number
  areaPx?: number
  perimeterPx?: number
  circularity?: number
  source: MeasurementSource
  note?: string
}

export function createLineMeasurement(
  id: string,
  index: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  nmPerPx: number,
  source: MeasurementSource = 'manual',
): ParticleMeasurement {
  const lengthPx = Math.hypot(x2 - x1, y2 - y1)
  return {
    id,
    index,
    kind: 'line',
    x1,
    y1,
    x2,
    y2,
    lengthPx,
    sizeNm: lengthPx * nmPerPx,
    source,
  }
}

export function createAreaMeasurement(
  id: string,
  index: number,
  cx: number,
  cy: number,
  areaPx: number,
  perimeterPx: number,
  circularity: number,
  nmPerPx: number,
): ParticleMeasurement {
  const diameterPx = 2 * Math.sqrt(Math.max(areaPx, 0) / Math.PI)
  return {
    id,
    index,
    kind: 'area',
    x1: cx,
    y1: cy,
    x2: cx + diameterPx / 2,
    y2: cy,
    lengthPx: diameterPx,
    sizeNm: diameterPx * nmPerPx,
    areaPx,
    perimeterPx,
    circularity,
    source: 'auto',
  }
}

export function renameMeasurementIndexes(measurements: ParticleMeasurement[]): ParticleMeasurement[] {
  return measurements.map((m, i) => ({ ...m, index: i + 1 }))
}

export interface ParticleStats {
  n: number
  mean: number
  median: number
  std: number
  min: number
  max: number
  q1: number
  q3: number
  d10: number
  d50: number
  d90: number
  span: number
  cv: number
  skewness: number
  kurtosis: number
  sum: number
}

/** Descriptive statistics of particle sizes. */
export function summarize(values: readonly number[]): ParticleStats {
  const v = values
    .filter((x) => Number.isFinite(x) && x >= 0)
    .slice()
    .sort((a, b) => a - b)
  const n = v.length
  if (!n) {
    return {
      n: 0,
      mean: NaN,
      median: NaN,
      std: NaN,
      min: NaN,
      max: NaN,
      q1: NaN,
      q3: NaN,
      d10: NaN,
      d50: NaN,
      d90: NaN,
      span: NaN,
      cv: NaN,
      skewness: NaN,
      kurtosis: NaN,
      sum: 0,
    }
  }
  const sum = v.reduce((s, x) => s + x, 0)
  const mean = sum / n
  const variance = n > 1 ? v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0
  const std = Math.sqrt(variance)
  const m2 = v.reduce((s, x) => s + (x - mean) ** 2, 0) / n
  const m3 = v.reduce((s, x) => s + (x - mean) ** 3, 0) / n
  const m4 = v.reduce((s, x) => s + (x - mean) ** 4, 0) / n
  const d10 = percentileSorted(v, 10)
  const d50 = percentileSorted(v, 50)
  const d90 = percentileSorted(v, 90)
  return {
    n,
    mean,
    median: d50,
    std,
    min: v[0],
    max: v[n - 1],
    q1: percentileSorted(v, 25),
    q3: percentileSorted(v, 75),
    d10,
    d50,
    d90,
    span: d50 > 0 ? (d90 - d10) / d50 : NaN,
    cv: mean > 0 ? std / mean : NaN,
    skewness: m2 > 0 ? m3 / m2 ** 1.5 : NaN,
    kurtosis: m2 > 0 ? m4 / (m2 * m2) - 3 : NaN,
    sum,
  }
}

/** Linear-interpolated percentile; `values` must be sorted ascending. */
export function percentileSorted(sorted: readonly number[], p: number): number {
  if (!sorted.length) return NaN
  if (sorted.length === 1) return sorted[0]
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1)
  const lower = Math.floor(rank)
  const upper = Math.ceil(rank)
  if (lower === upper) return sorted[lower]
  const t = rank - lower
  return sorted[lower] * (1 - t) + sorted[upper] * t
}

export interface HistogramOptions {
  binCount?: number
  width?: number
  start?: number
  end?: number
}

export interface HistogramBin {
  low: number
  high: number
  count: number
  freq: number
  label: string
}

export interface HistogramResult {
  bins: HistogramBin[]
  width: number
  start: number
  end: number
  binCount: number
  /** Human-readable bin rule, e.g. `10 组，组距 0.5 nm（左闭右开，末组含上限）`. */
  rule: string
}

export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return step * mag
}

/**
 * Build a size histogram with the NanoMeasure convention: bins are
 * left-inclusive / right-open, so a value exactly on a boundary falls into
 * the upper bin (2.5 → 2.5–3.0, not 2.0–2.5).
 */
export function buildHistogram(values: readonly number[], options: HistogramOptions = {}): HistogramResult {
  const clean = values.filter((x) => Number.isFinite(x) && x >= 0)
  if (!clean.length) {
    return { bins: [], width: 1, start: 0, end: 1, binCount: 0, rule: '没有数据' }
  }
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const binCount = Math.max(1, Math.round(options.binCount ?? 10))
  let width =
    options.width && options.width > 0 ? options.width : niceStep((max - min) / binCount || max / binCount || 1)
  if (!(width > 0)) width = 1
  let start = options.start ?? Math.floor(min / width) * width
  if (!Number.isFinite(start)) start = 0
  let end = options.end ?? start + width * binCount
  if (end <= start) end = start + width
  const count = Math.max(binCount, 1, Math.ceil((max - start) / width - 1e-9))
  end = start + count * width
  const bins: HistogramBin[] = Array.from({ length: count }, (_, i) => ({
    low: start + i * width,
    high: start + (i + 1) * width,
    count: 0,
    freq: 0,
    label: `${formatBinNumber(start + i * width)}–${formatBinNumber(start + (i + 1) * width)}`,
  }))
  for (const value of clean) {
    let index = Math.floor((value - start) / width)
    if (index < 0) index = 0
    if (index >= count) index = count - 1
    bins[index].count++
  }
  for (const bin of bins) bin.freq = bin.count / clean.length
  return {
    bins,
    width,
    start,
    end,
    binCount: count,
    rule: `${count} 组，组距 ${formatBinNumber(width)}（左闭右开，末组含上限）`,
  }
}

function formatBinNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 10) return value.toFixed(1).replace(/\.0$/, '')
  if (abs >= 1) return value.toFixed(2).replace(/0$/, '').replace(/\.$/, '')
  return value.toPrecision(3)
}

export interface GaussianFit {
  mean: number
  sigma: number
  pdf: (x: number) => number
  cdf: (x: number) => number
  expectedCount: (low: number, high: number, n: number) => number
}

export function fitGaussian(values: readonly number[]): GaussianFit | null {
  const clean = values.filter((x) => Number.isFinite(x))
  if (clean.length < 2) return null
  const mean = clean.reduce((s, x) => s + x, 0) / clean.length
  const sigma = Math.sqrt(clean.reduce((s, x) => s + (x - mean) ** 2, 0) / (clean.length - 1))
  if (!(sigma > 0)) return null
  const pdf = (x: number) => (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-((x - mean) ** 2) / (2 * sigma * sigma))
  const cdf = (x: number) => normalCdf((x - mean) / sigma)
  return {
    mean,
    sigma,
    pdf,
    cdf,
    expectedCount: (low, high, n) => n * (cdf(high) - cdf(low)),
  }
}

export interface LognormalFit {
  mu: number
  sigma: number
  median: number
  mean: number
  mode: number
  pdf: (x: number) => number
  cdf: (x: number) => number
  expectedCount: (low: number, high: number, n: number) => number
}

/** Maximum-likelihood log-normal fit (requires strictly positive sizes). */
export function fitLognormal(values: readonly number[]): LognormalFit | null {
  const clean = values.filter((x) => Number.isFinite(x) && x > 0)
  if (clean.length < 2) return null
  const logs = clean.map((x) => Math.log(x))
  const mu = logs.reduce((s, x) => s + x, 0) / logs.length
  const sigma = Math.sqrt(logs.reduce((s, x) => s + (x - mu) ** 2, 0) / logs.length)
  if (!(sigma > 0)) return null
  const pdf = (x: number) => {
    if (!(x > 0)) return 0
    return (1 / (x * sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-((Math.log(x) - mu) ** 2) / (2 * sigma * sigma))
  }
  const cdf = (x: number) => (x > 0 ? normalCdf((Math.log(x) - mu) / sigma) : 0)
  return {
    mu,
    sigma,
    median: Math.exp(mu),
    mean: Math.exp(mu + (sigma * sigma) / 2),
    mode: Math.exp(mu - sigma * sigma),
    pdf,
    cdf,
    expectedCount: (low, high, n) => n * (cdf(high) - cdf(low)),
  }
}

/** Standard normal CDF via the Abramowitz–Stegun error-function approximation. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
  return sign * y
}

export interface DetectOptions {
  width: number
  height: number
  /** RGBA pixel data. */
  data: Uint8ClampedArray
  /** Detect bright particles on a dark background (default false). */
  invert?: boolean
  /** Manual threshold (0–255); Otsu is used when omitted. */
  threshold?: number
  minAreaPx?: number
  maxAreaPx?: number
  minCircularity?: number
  maxCircularity?: number
  /** 4 or 8 (default 8). */
  connectivity?: 4 | 8
}

export interface DetectedParticle {
  areaPx: number
  cx: number
  cy: number
  widthPx: number
  heightPx: number
  perimeterPx: number
  circularity: number
  equivalentDiameterPx: number
}

export interface DetectResult {
  particles: DetectedParticle[]
  threshold: number
  foregroundPixels: number
  warnings: string[]
}

/** Otsu threshold of a 256-bin greyscale histogram. */
export function otsuThreshold(histogram: readonly number[]): number {
  const total = histogram.reduce((s, v) => s + v, 0)
  if (!total) return 128
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]
  let sumB = 0
  let wB = 0
  let maxVariance = -1
  let threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += histogram[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * histogram[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > maxVariance) {
      maxVariance = between
      threshold = t
    }
  }
  return threshold
}

/**
 * Simple two-phase segmentation + connected-component particle detection.
 *
 * This is intentionally conservative: it works best for high-contrast,
 * reasonably separated particles. Touching particles are merged; use manual
 * line measurements or a lower threshold / area filter when needed.
 */
export function detectParticles(options: DetectOptions): DetectResult {
  const { width, height, data } = options
  const warnings: string[] = []
  if (!(width > 0) || !(height > 0) || data.length < width * height * 4) {
    return { particles: [], threshold: 128, foregroundPixels: 0, warnings: ['图像数据无效'] }
  }
  const gray = new Uint8Array(width * height)
  const histogram = new Array<number>(256).fill(0)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const alpha = data[p + 3]
    const value = alpha < 128 ? 255 : Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2])
    gray[i] = value
    histogram[value]++
  }
  const threshold =
    options.threshold !== undefined ? Math.max(0, Math.min(255, options.threshold)) : otsuThreshold(histogram)
  const invert = options.invert ?? false
  const foreground = new Uint8Array(width * height)
  let foregroundPixels = 0
  for (let i = 0; i < gray.length; i++) {
    const isForeground = invert ? gray[i] > threshold : gray[i] < threshold
    if (isForeground) {
      foreground[i] = 1
      foregroundPixels++
    }
  }
  if (!foregroundPixels) {
    return { particles: [], threshold, foregroundPixels, warnings: ['当前阈值下没有前景像素，请调整阈值或反相'] }
  }

  const minArea = options.minAreaPx ?? 5
  const maxArea = options.maxAreaPx ?? Infinity
  const minCircularity = options.minCircularity ?? 0
  const maxCircularity = options.maxCircularity ?? 2.5
  const neighbors =
    (options.connectivity ?? 8) === 4
      ? [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]
      : [
          [-1, -1],
          [0, -1],
          [1, -1],
          [-1, 0],
          [1, 0],
          [-1, 1],
          [0, 1],
          [1, 1],
        ]

  const visited = new Uint8Array(width * height)
  const particles: DetectedParticle[] = []
  const stack: number[] = []
  const component: number[] = []
  for (let start = 0; start < foreground.length; start++) {
    if (!foreground[start] || visited[start]) continue
    stack.length = 0
    component.length = 0
    stack.push(start)
    visited[start] = 1
    let area = 0
    let sumX = 0
    let sumY = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    while (stack.length) {
      const idx = stack.pop()!
      component.push(idx)
      const x = idx % width
      const y = (idx / width) | 0
      area++
      sumX += x
      sumY += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const [dx, dy] of neighbors) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const nidx = ny * width + nx
        if (foreground[nidx] && !visited[nidx]) {
          visited[nidx] = 1
          stack.push(nidx)
        }
      }
    }
    if (area < minArea || area > maxArea) continue
    let perimeter = 0
    for (const idx of component) {
      const x = idx % width
      const y = (idx / width) | 0
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        perimeter++
        continue
      }
      if (!foreground[idx - 1] || !foreground[idx + 1] || !foreground[idx - width] || !foreground[idx + width]) {
        perimeter++
      }
    }
    const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0
    if (circularity < minCircularity || circularity > maxCircularity) continue
    particles.push({
      areaPx: area,
      cx: sumX / area,
      cy: sumY / area,
      widthPx: maxX - minX + 1,
      heightPx: maxY - minY + 1,
      perimeterPx: perimeter,
      circularity,
      equivalentDiameterPx: 2 * Math.sqrt(area / Math.PI),
    })
  }

  particles.sort((a, b) => b.areaPx - a.areaPx)
  if (!particles.length) {
    warnings.push('没有满足面积/圆度条件的颗粒；可降低最小面积或放宽圆度')
  }
  if (particles.length > 5000) {
    warnings.push(`检测到 ${particles.length} 个颗粒，数量较多；建议提高最小面积或降低图像分辨率`)
  }
  return { particles, threshold, foregroundPixels, warnings }
}

export interface ParticleReportContext {
  unit: LengthUnit
  calibration: Calibration | null
  imageName?: string
  binCount?: number
}

export interface ParticleReport {
  stats: ParticleStats
  histogram: HistogramResult
  gaussian: GaussianFit | null
  lognormal: LognormalFit | null
}

export function buildParticleReport(
  measurements: readonly ParticleMeasurement[],
  context: ParticleReportContext,
): ParticleReport {
  const sizes = measurements.map((m) => convertNmTo(m.sizeNm, context.unit))
  const stats = summarize(sizes)
  const histogram = buildHistogram(sizes, { binCount: context.binCount ?? 10 })
  return {
    stats,
    histogram,
    gaussian: fitGaussian(sizes),
    lognormal: fitLognormal(sizes),
  }
}

export function measurementCsv(measurements: readonly ParticleMeasurement[], unit: LengthUnit): string {
  const header = [
    'index',
    'method',
    'size_nm',
    `size_display_${unit}`,
    'length_px',
    'area_px',
    'perimeter_px',
    'circularity',
    'x1_px',
    'y1_px',
    'x2_px',
    'y2_px',
    'source',
  ].join(',')
  const rows = measurements.map((m) =>
    [
      m.index,
      m.kind === 'line' ? '线测法/Feret' : '面积等效圆',
      m.sizeNm.toFixed(6),
      convertNmTo(m.sizeNm, unit).toFixed(6),
      m.lengthPx.toFixed(4),
      m.areaPx !== undefined ? m.areaPx.toFixed(2) : '',
      m.perimeterPx !== undefined ? m.perimeterPx.toFixed(2) : '',
      m.circularity !== undefined ? m.circularity.toFixed(4) : '',
      m.x1.toFixed(2),
      m.y1.toFixed(2),
      m.x2.toFixed(2),
      m.y2.toFixed(2),
      m.source,
    ].join(','),
  )
  return [header, ...rows].join('\r\n')
}

export function histogramCsv(report: ParticleReport, unit: LengthUnit): string {
  const lines = [
    `# 粒径分布（${unit}；左闭右开，末组含上限）`,
    `bin_low_${unit},bin_high_${unit},count,frequency`,
    ...report.histogram.bins.map((b) =>
      [b.low.toFixed(6), b.high.toFixed(6), b.count, (b.freq * 100).toFixed(6)].join(','),
    ),
  ]
  if (report.gaussian) {
    lines.push(
      '',
      `# Gaussian fit: mean=${report.gaussian.mean.toFixed(6)} ${unit}, sigma=${report.gaussian.sigma.toFixed(6)} ${unit}`,
    )
  }
  if (report.lognormal) {
    lines.push(
      `# Log-normal fit: mu=${report.lognormal.mu.toFixed(6)}, sigma=${report.lognormal.sigma.toFixed(6)}, median=${report.lognormal.median.toFixed(6)} ${unit}`,
    )
  }
  return lines.join('\r\n')
}

/** NanoMeasure-style plain-text report: individual sizes + binned statistics. */
export function nanoMeasureReport(
  measurements: readonly ParticleMeasurement[],
  report: ParticleReport,
  context: ParticleReportContext,
): string {
  const unit = context.unit
  const { stats, histogram } = report
  const lines: string[] = []
  lines.push('CrystalToolBox · 颗粒尺寸测量报告')
  if (context.imageName) lines.push(`图像: ${context.imageName}`)
  if (context.calibration) {
    lines.push(
      `标尺: ${context.calibration.realLength} ${context.calibration.unit} = ${context.calibration.pixelLength.toFixed(2)} px; ${context.calibration.nmPerPx.toFixed(6)} nm/px`,
    )
  }
  lines.push(`单位: ${unit}; 颗粒数: ${stats.n}`)
  lines.push('')
  lines.push('【基本报告】')
  lines.push(`序号\t粒径(${unit})\t方法\t像素长度\t面积(px²)\t圆度`)
  for (const m of measurements) {
    lines.push(
      [
        m.index,
        convertNmTo(m.sizeNm, unit).toFixed(4),
        m.kind === 'line' ? 'line' : 'area',
        m.lengthPx.toFixed(2),
        m.areaPx !== undefined ? m.areaPx.toFixed(1) : '',
        m.circularity !== undefined ? m.circularity.toFixed(3) : '',
      ].join('\t'),
    )
  }
  lines.push('')
  lines.push('【统计报告】')
  lines.push('组下限\t组上限\t计数\t频率(%)')
  for (const bin of histogram.bins) {
    lines.push([bin.low.toFixed(4), bin.high.toFixed(4), bin.count, (bin.freq * 100).toFixed(3)].join('\t'))
  }
  lines.push('')
  lines.push('【汇总】')
  const summary: Array<[string, number]> = [
    ['平均值', stats.mean],
    ['中位数', stats.median],
    ['标准差', stats.std],
    ['最小值', stats.min],
    ['最大值', stats.max],
    ['D10', stats.d10],
    ['D50', stats.d50],
    ['D90', stats.d90],
    ['跨度 (D90-D10)/D50', stats.span],
    ['变异系数 CV', stats.cv],
  ]
  for (const [label, value] of summary) {
    lines.push(`${label}\t${Number.isFinite(value) ? value.toFixed(6) : '—'}`)
  }
  if (report.gaussian) {
    lines.push(`Gaussian: mean=${report.gaussian.mean.toFixed(6)}, sigma=${report.gaussian.sigma.toFixed(6)}`)
  }
  if (report.lognormal) {
    lines.push(
      `Log-normal: mu=${report.lognormal.mu.toFixed(6)}, sigma=${report.lognormal.sigma.toFixed(6)}, median=${report.lognormal.median.toFixed(6)}, mean=${report.lognormal.mean.toFixed(6)}`,
    )
  }
  return lines.join('\r\n')
}
