import { interpolateAt } from '@/core/num/interpolate'
import { validateForJade, hasErrors } from '@/core/pipeline/validate'
import type { Pattern } from '@/core/pipeline/types'

export type DifRole = 'raw' | 'background' | 'fitted' | 'overall' | 'difference' | 'unknown'

export interface DifBlock {
  index: number
  name: string
  role: DifRole
  start: number
  step: number
  end: number
  points: number
  anode: string
  wavelength: number
  flag: string
  y: Float64Array
  /** number of Y values actually read from the file */
  valuesRead: number
  warnings: string[]
}

export interface DifFile {
  headerLine?: string
  date?: string
  time?: string
  mode?: string
  title?: string
  blocks: DifBlock[]
  warnings: string[]
  rawTextLength: number
}

const PARAM_RE =
  /^\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+([A-Za-z]{1,3})\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+)\s*(.*)$/

function stripParens(name: string): string {
  return name
    .trim()
    .replace(/^\((.*)\)$/, '$1')
    .trim()
}

function detectRole(name: string): DifRole {
  const n = name.toLowerCase()
  if (/\braw\b|observed|experimental|data/.test(n)) return 'raw'
  if (/back|bkg|bg\b/.test(n)) return 'background'
  if (/overall|calculated|calc\b|total/.test(n)) return 'overall'
  if (/diff/.test(n)) return 'difference'
  if (/fit|profile|peak/.test(n)) return 'fitted'
  return 'unknown'
}

/**
 * Parse a MDI Jade DIF export.
 *
 * Observed format (DEMO06.dif):
 *   line 1   : "10/20/26 10:16  FIT Red Paint Pigment Mixture"
 *   param    : start step flag anode wavelength end npoints (curve name)
 *   data     : whitespace-separated Y values, 8 per line
 *   repeats  : a new parameter line starts the next curve (different ranges allowed)
 */
export function parseDif(text: string): DifFile {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\uFEFF/g, '')
  const lines = normalized.split('\n')
  const warnings: string[] = []
  let headerLine: string | undefined
  let date: string | undefined
  let time: string | undefined
  let mode: string | undefined
  let title: string | undefined

  const firstNonEmpty = lines.find((l) => l.trim().length > 0)
  if (firstNonEmpty && !PARAM_RE.test(firstNonEmpty)) {
    headerLine = firstNonEmpty.trim()
    const m = headerLine.match(/^(\d{2}\/\d{2}\/\d{2})\s+(\d{1,2}:\d{2})\s+([A-Za-z]+)\s+(.*)$/)
    if (m) {
      date = m[1]
      time = m[2]
      mode = m[3]
      title = m[4]
    } else {
      title = headerLine
    }
  }

  const blocks: DifBlock[] = []
  const pending: number[][] = []
  let currentIndex = -1
  const appendValues = (line: string) => {
    if (currentIndex < 0) return
    for (const token of line.trim().split(/\s+/)) {
      if (!token) continue
      const value = Number(token)
      if (!Number.isFinite(value)) {
        blocks[currentIndex].warnings.push(`忽略非数值内容：${token.slice(0, 20)}`)
        continue
      }
      pending[currentIndex].push(value)
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    if (headerLine !== undefined && line.trim() === headerLine && !PARAM_RE.test(line)) continue

    const m = line.match(PARAM_RE)
    if (m) {
      const start = Number(m[1])
      const step = Number(m[2])
      const flag = m[3]
      const anode = m[4]
      const wavelength = Number(m[5])
      const end = Number(m[6])
      const points = Number(m[7])
      const name = stripParens(m[8] || `Curve ${blocks.length + 1}`)
      const block: DifBlock = {
        index: blocks.length,
        name,
        role: detectRole(name),
        start,
        step,
        end,
        points,
        anode,
        wavelength,
        flag,
        y: new Float64Array(0),
        valuesRead: 0,
        warnings: [],
      }
      blocks.push(block)
      pending.push([])
      currentIndex = blocks.length - 1
      continue
    }

    appendValues(line)
  }

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b]
    const arr = Float64Array.from(pending[b])
    block.y = arr
    block.valuesRead = arr.length
    if (!(block.step > 0)) {
      block.warnings.push('步长不是正数')
    }
    if (!(block.wavelength > 0)) {
      block.warnings.push('波长缺失或无效')
    }
    if (arr.length !== block.points) {
      block.warnings.push(`参数行声明 ${block.points} 点，实际读取 ${arr.length} 点`)
      if (arr.length < block.points) {
        const padded = new Float64Array(block.points)
        padded.set(arr)
        block.y = padded
      } else {
        block.y = arr.slice(0, block.points)
      }
    }
    const expected = Math.round((block.end - block.start) / block.step) + 1
    if (Math.abs(expected - block.points) > 1) {
      block.warnings.push(`起始/终止/步长与点数不一致：约为 ${expected} 点，声明 ${block.points} 点`)
    }
  }

  if (!blocks.length) {
    throw new Error('未在文件中找到 DIF 参数行；请确认这是 Jade 导出的 .dif 文件')
  }
  const totalValues = blocks.reduce((s, b) => s + b.valuesRead, 0)
  if (totalValues === 0) throw new Error('DIF 中没有任何强度数据')

  const roles = new Set(blocks.map((b) => b.role))
  if (!roles.has('raw') && !roles.has('overall')) {
    warnings.push('没有识别出 Raw/Overall 曲线；导出时将使用第一块作为观测数据')
  }

  return {
    headerLine,
    date,
    time,
    mode,
    title,
    blocks,
    warnings,
    rawTextLength: text.length,
  }
}

/** X axis of a block (2θ in degrees). */
export function blockX(block: DifBlock): Float64Array {
  const n = block.y.length
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) x[i] = block.start + i * block.step
  return x
}

export function blockToPattern(block: DifBlock): Pattern {
  return {
    x: blockX(block),
    y: new Float64Array(block.y),
    meta: {
      xLabel: '2θ',
      xUnit: '°',
      yLabel: 'Intensity',
      yUnit: 'counts',
      wavelength: block.wavelength,
      anode: block.anode,
    },
  }
}

export interface DifExportOptions {
  /** X grid: reference block index, or 'union' to cover all blocks. */
  grid: 'reference' | 'union'
  format: 'wide' | 'stacked' | 'diff' | 'single'
  delimiter: ' ' | ',' | '\t'
  includeHeader: boolean
  fillOutside: 'zero' | 'nan'
  /** Convert the x axis from 2θ to 1/d (Å⁻¹). */
  xAxis: 'twoTheta' | 'invD'
  /** Optional inverse mapping coefficients (from a recipe). */
  inverseMapping?: { xScale: number; xOffset: number; yScale: number; yOffset: number }
  decimalsX?: number
  decimalsY?: number
  /** Which blocks to include (defaults to all). */
  blockIndices?: number[]
}

export interface DifExportColumn {
  name: string
  values: Float64Array
}

export interface DifExportResult {
  content: string
  columns: Array<{ name: string; role: DifRole; blockIndex: number }>
  gridSize: number
  rFactor: number | null
  warnings: string[]
}

function pickReference(blocks: DifBlock[]): DifBlock {
  return (
    blocks.find((b) => b.role === 'raw') ??
    blocks.find((b) => b.role === 'overall') ??
    blocks[0]
  )
}

function sampleOntoGrid(block: DifBlock, gridX: Float64Array, fill: 'zero' | 'nan'): Float64Array {
  const n = gridX.length
  const out = new Float64Array(n)
  const x = blockX(block)
  // Fast path: identical start/step/length.
  const sameGrid =
    block.y.length === n &&
    Math.abs(x[0] - gridX[0]) < 1e-9 &&
    (n < 2 || Math.abs(x[1] - gridX[1]) < 1e-12)
  if (sameGrid) {
    out.set(block.y)
    return out
  }
  for (let i = 0; i < n; i++) {
    const xi = gridX[i]
    if (xi < x[0] || xi > x[x.length - 1]) {
      out[i] = fill === 'nan' ? NaN : 0
    } else {
      out[i] = interpolateAt(x, block.y, xi, 'clamp')
    }
  }
  return out
}

/**
 * Convert DIF curves to an Origin-friendly table.
 *
 * The difference curve is Raw − Overall (or Raw − Background when no Overall
 * is present). Fitted sub-profiles are interpolated onto the common grid and
 * set to zero outside their measured range.
 */
export function exportDif(dif: DifFile, options: Partial<DifExportOptions> = {}): DifExportResult {
  const opts: DifExportOptions = {
    grid: 'reference',
    format: 'wide',
    delimiter: ' ',
    includeHeader: true,
    fillOutside: 'zero',
    xAxis: 'twoTheta',
    decimalsX: 5,
    decimalsY: 4,
    ...options,
  }
  const warnings: string[] = []
  const allBlocks = dif.blocks
  const selected = opts.blockIndices
    ? allBlocks.filter((b) => opts.blockIndices!.includes(b.index))
    : allBlocks
  if (!selected.length) throw new Error('没有选择任何曲线')

  let reference = pickReference(selected)
  if (opts.grid === 'union') {
    // Use the block with the widest range and finest step.
    reference = selected.reduce((best, b) => {
      const span = b.end - b.start
      const bestSpan = best.end - best.start
      if (span > bestSpan + 1e-9) return b
      if (Math.abs(span - bestSpan) < 1e-9 && b.step < best.step) return b
      return best
    }, selected[0])
  }

  const n = reference.points
  const gridX = new Float64Array(n)
  for (let i = 0; i < n; i++) gridX[i] = reference.start + i * reference.step

  const rawBlock = selected.find((b) => b.role === 'raw')
  const bgBlock = selected.find((b) => b.role === 'background')
  const overallBlock = selected.find((b) => b.role === 'overall')
  const fitted = selected.filter((b) => b.role === 'fitted')
  const observedBlock = rawBlock ?? overallBlock ?? reference
  const observed = sampleOntoGrid(observedBlock, gridX, 'nan')

  const columns: DifExportColumn[] = [{ name: 'X', values: gridX }]
  const meta: Array<{ name: string; role: DifRole; blockIndex: number }> = [
    { name: 'X', role: 'unknown', blockIndex: -1 },
  ]

  const addColumn = (name: string, values: Float64Array, role: DifRole, blockIndex: number) => {
    columns.push({ name, values })
    meta.push({ name, role, blockIndex })
  }

  if (opts.format === 'single') {
    addColumn(observedBlock.name || 'Y', observed, observedBlock.role, observedBlock.index)
  } else if (opts.format === 'diff') {
    if (!overallBlock) warnings.push('没有 Overall 曲线，差值改用 Raw − Background')
    const subtract = overallBlock ? sampleOntoGrid(overallBlock, gridX, 'nan') : bgBlock ? sampleOntoGrid(bgBlock, gridX, 'nan') : null
    if (!subtract) throw new Error('缺少可相减的 Overall/Background 曲线')
    const diff = new Float64Array(n)
    for (let i = 0; i < n; i++) diff[i] = observed[i] - subtract[i]
    addColumn('Diff', diff, 'difference', -1)
  } else {
    addColumn('Raw', observed, observedBlock.role, observedBlock.index)
    if (bgBlock) addColumn('Background', sampleOntoGrid(bgBlock, gridX, opts.fillOutside), 'background', bgBlock.index)
    if (overallBlock) addColumn('Overall', sampleOntoGrid(overallBlock, gridX, opts.fillOutside), 'overall', overallBlock.index)
    if (rawBlock && overallBlock) {
      const subtract = sampleOntoGrid(overallBlock, gridX, 'nan')
      const diff = new Float64Array(n)
      for (let i = 0; i < n; i++) diff[i] = observed[i] - subtract[i]
      addColumn('Diff', diff, 'difference', -1)
    }
    fitted.forEach((block, idx) => {
      addColumn(`Fit${idx + 1}`, sampleOntoGrid(block, gridX, opts.fillOutside), 'fitted', block.index)
    })
  }

  // Optional inverse mapping (recipe) applied to X and Y.
  let outX = gridX
  if (opts.inverseMapping) {
    const m = opts.inverseMapping
    outX = new Float64Array(n)
    for (let i = 0; i < n; i++) outX[i] = (gridX[i] - m.xOffset) / m.xScale
    for (const col of columns) {
      if (col.name === 'X') continue
      const mapped = new Float64Array(n)
      for (let i = 0; i < n; i++) mapped[i] = (col.values[i] - m.yOffset) / m.yScale
      col.values = mapped
    }
    columns[0] = { name: 'X', values: outX }
    warnings.push('已按配方把 X/Y 反算回原始物理量')
  }

  // Optional 2θ → 1/d conversion.
  if (opts.xAxis === 'invD') {
    const wavelength = reference.wavelength
    if (!(wavelength > 0)) throw new Error('DIF 缺少波长，无法转换到 1/d')
    if (opts.inverseMapping) warnings.push('1/d 轴基于反算后的 2θ；请确认配方映射是 2θ 仿射')
    const inv = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const theta = (outX[i] * Math.PI) / 360
      inv[i] = (2 * Math.sin(theta)) / wavelength
    }
    columns[0] = { name: '1/d', values: inv }
    meta[0] = { name: '1/d', role: 'unknown', blockIndex: -1 }
  }

  // Fit quality (Rp) on the raw grid.
  let rFactor: number | null = null
  if (rawBlock && overallBlock) {
    const calc = sampleOntoGrid(overallBlock, gridX, 'nan')
    let num = 0
    let den = 0
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(observed[i]) && Number.isFinite(calc[i])) {
        num += Math.abs(observed[i] - calc[i])
        den += Math.abs(observed[i])
      }
    }
    if (den > 0) rFactor = (num / den) * 100
  }

  const header: string[] = []
  if (opts.includeHeader) {
    header.push('# CrystalToolBox · DIF → XY')
    if (dif.title) header.push(`# title: ${dif.title}`)
    if (dif.headerLine) header.push(`# source: ${dif.headerLine}`)
    header.push(
      `# block grid: ${reference.name} (${reference.start}–${reference.end}°, step ${reference.step}°, ${reference.points} points)`,
    )
    header.push(`# radiation: ${reference.anode} Kα, λ = ${reference.wavelength} Å`)
    if (opts.inverseMapping) header.push('# coordinate: inverse of the Jade mapping (original units)')
    if (opts.xAxis === 'invD') header.push('# x axis: 1/d (Å⁻¹)')
    header.push(`# columns: ${columns.map((c) => c.name).join(', ')}`)
    if (rFactor !== null) header.push(`# Rp (raw vs overall) = ${rFactor.toFixed(3)} %`)
  }

  const lines: string[] = []
  if (opts.format === 'stacked') {
    columns.forEach((col, idx) => {
      if (col.name === 'X') return
      lines.push(`# ${col.name}`)
      for (let i = 0; i < n; i++) {
        lines.push(`${fmt(columns[0].values[i], opts.decimalsX ?? 5)}${opts.delimiter}${fmt(col.values[i], opts.decimalsY ?? 4)}`)
      }
      if (idx < columns.length - 1) lines.push('')
    })
  } else {
    if (opts.includeHeader) lines.push(...header)
    const head = opts.delimiter !== ' ' ? columns.map((c) => c.name).join(opts.delimiter) : null
    if (head) lines.push(head)
    for (let i = 0; i < n; i++) {
      lines.push(columns.map((c) => fmt(c.values[i], c.name === 'X' ? (opts.decimalsX ?? 5) : (opts.decimalsY ?? 4))).join(opts.delimiter))
    }
  }

  return {
    content: lines.join('\n') + '\n',
    columns: meta,
    gridSize: n,
    rFactor,
    warnings,
  }
}

function fmt(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return 'NaN'
  return value.toFixed(decimals)
}

/** Sanity check: the exported table must not contain invalid numbers. */
export function difExportIssues(result: DifExportResult): string[] {
  const issues: string[] = []
  const x = result.columns.find((c) => c.name === 'X' || c.name === '1/d')
  if (!x) issues.push('导出结果缺少 X 列')
  if (result.gridSize < 2) issues.push('公共网格点数不足')
  return issues
}

/** Use the raw (or first) block as a two-column pattern for the main workspace. */
export function difToPattern(dif: DifFile, blockIndex?: number): { pattern: Pattern; warnings: string[] } {
  const block =
    blockIndex !== undefined ? dif.blocks.find((b) => b.index === blockIndex) : dif.blocks.find((b) => b.role === 'raw') ?? dif.blocks[0]
  if (!block) throw new Error('DIF 中没有可用曲线')
  const pattern = blockToPattern(block)
  const issues = validateForJade(pattern)
  return { pattern, warnings: [...dif.warnings, ...block.warnings, ...issues.filter((i) => i.level !== 'info').map((i) => i.message)] }
}

export { hasErrors }
