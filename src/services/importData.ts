import { parseDif, blockToPattern } from '@/core/io/dif'
import { parseXrdml } from '@/core/io/xrdml'
import { parseTabular, patternFromTwoColumns } from '@/core/io/xy'
import type { Pattern, PatternMeta } from '@/core/pipeline/types'
import { readFileText } from '@/utils/download'

export interface ImportResult {
  kind: 'pattern' | 'table' | 'dif'
  pattern?: Pattern
  format: string
  fileName: string
  warnings: string[]
  headers: string[]
  encoding?: string
  columns?: number[][]
  difText?: string
}

export function inferMeta(headers: string[], x: ArrayLike<number>, y: ArrayLike<number>, fileName: string): PatternMeta {
  const header = headers.join(' ').toLowerCase()
  let xMin = Infinity
  let xMax = -Infinity
  for (let i = 0; i < x.length; i++) {
    if (x[i] < xMin) xMin = x[i]
    if (x[i] > xMax) xMax = x[i]
  }
  let xLabel = 'X'
  let xUnit = ''
  if (/2\s*theta|2θ|two.?theta/.test(header)) {
    xLabel = '2θ'
    xUnit = '°'
  } else if (/raman/.test(header)) {
    xLabel = 'Raman shift'
    xUnit = 'cm⁻¹'
  } else if (/wavenumber|wave.?number|\bir\b/.test(header)) {
    xLabel = 'Wavenumber'
    xUnit = 'cm⁻¹'
  } else if (/temperature|temp\b/.test(header)) {
    xLabel = 'Temperature'
    xUnit = '°C'
  } else if (xMin >= 0 && xMax <= 140) {
    xLabel = '2θ'
    xUnit = '°'
  }
  const yLabel = /count/.test(header) ? 'Counts' : /transmitt/.test(header) ? 'Transmittance' : /mass|weight|tga/.test(header) ? 'Mass' : 'Intensity'
  const yUnit = /count/.test(header) ? 'counts' : /transmitt/.test(header) ? '%' : /mass|weight|tga/.test(header) ? '%' : 'a.u.'
  return {
    xLabel,
    xUnit,
    yLabel,
    yUnit,
    sourceFile: fileName,
    wavelength: xLabel === '2θ' ? 1.54056 : undefined,
    anode: xLabel === '2θ' ? 'Cu' : undefined,
  }
}

function sortIfNeeded(pattern: Pattern, warnings: string[]): Pattern {
  let sorted = true
  for (let i = 1; i < pattern.x.length; i++) {
    if (pattern.x[i] < pattern.x[i - 1]) {
      sorted = false
      break
    }
  }
  if (sorted) return pattern
  const order = Array.from({ length: pattern.x.length }, (_, i) => i).sort((a, b) => pattern.x[a] - pattern.x[b])
  warnings.push('X 轴不是单调递增的，已按 X 排序后导入')
  return {
    x: Float64Array.from(order, (i) => pattern.x[i]),
    y: Float64Array.from(order, (i) => pattern.y[i]),
    meta: pattern.meta,
  }
}

export async function importDataFile(file: File): Promise<ImportResult> {
  const name = file.name
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const { text, encoding, warnings: encodingWarnings } = await readFileText(file)

  if (ext === 'dif') {
    const dif = parseDif(text)
    const block = dif.blocks.find((b) => b.role === 'raw') ?? dif.blocks[0]
    const pattern = blockToPattern(block)
    return {
      kind: 'dif',
      pattern,
      format: 'Jade DIF',
      fileName: name,
      warnings: [...encodingWarnings, ...dif.warnings, ...block.warnings],
      headers: [],
      encoding,
      difText: text,
    }
  }

  if (ext === 'xrdml') {
    const data = parseXrdml(text)
    const meta: PatternMeta = {
      xLabel: '2θ',
      xUnit: '°',
      yLabel: 'Counts',
      yUnit: 'counts',
      wavelength: data.wavelength ?? 1.54056,
      anode: 'Cu',
      sourceFile: name,
    }
    const pattern = sortIfNeeded({ x: data.x, y: data.y, meta }, data.warnings)
    return {
      kind: 'pattern',
      pattern,
      format: 'XRDML',
      fileName: name,
      warnings: [...encodingWarnings, ...data.warnings],
      headers: [],
      encoding,
    }
  }

  if (ext === 'cif' || ext === 'mcif') {
    throw new Error('CIF 是晶体结构文件，请到「晶体结构」页面导入')
  }

  const table = parseTabular(text)
  const warnings = [...encodingWarnings, ...table.warnings]
  const headers = table.headers
  const twoColumn = patternFromTwoColumns(text, {
    xLabel: 'X',
    xUnit: '',
    yLabel: 'Intensity',
    yUnit: 'a.u.',
    sourceFile: name,
  })
  const meta = inferMeta(headers, twoColumn.pattern.x, twoColumn.pattern.y, name)
  const pattern = sortIfNeeded({ ...twoColumn.pattern, meta }, warnings)
  const format =
    ext === 'csv' ? 'CSV' : ext === 'tsv' ? 'TSV' : ext === 'xy' ? 'XY' : ext === 'xrdml' ? 'XRDML' : '文本表格'
  return {
    kind: table.columns.length > 2 ? 'table' : 'pattern',
    pattern,
    format,
    fileName: name,
    warnings,
    headers: headers.length ? headers : table.headers,
    encoding,
    columns: table.columns,
  }
}

export function importDataText(text: string, fileName = 'pasted.txt'): ImportResult {
  const table = parseTabular(text)
  const headers = table.headers
  const twoColumn = patternFromTwoColumns(text, {
    xLabel: 'X',
    xUnit: '',
    yLabel: 'Intensity',
    yUnit: 'a.u.',
    sourceFile: fileName,
  })
  const meta = inferMeta(headers, twoColumn.pattern.x, twoColumn.pattern.y, fileName)
  const warnings = [...table.warnings]
  const pattern = sortIfNeeded({ ...twoColumn.pattern, meta }, warnings)
  return {
    kind: table.columns.length > 2 ? 'table' : 'pattern',
    pattern,
    format: '粘贴文本',
    fileName,
    warnings,
    headers,
    columns: table.columns,
  }
}

/** Build a pattern from an arbitrary pair of columns (column mapping UI). */
export function patternFromColumns(
  columns: number[][],
  xIndex: number,
  yIndex: number,
  meta: PatternMeta,
): Pattern {
  const x = columns[xIndex] ?? []
  const y = columns[yIndex] ?? []
  const n = Math.min(x.length, y.length)
  return {
    x: Float64Array.from(x.slice(0, n)),
    y: Float64Array.from(y.slice(0, n)),
    meta,
  }
}
