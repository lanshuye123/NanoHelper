import type { Pattern } from '@/core/pipeline/types'
import { validateForJade, hasErrors } from '@/core/pipeline/validate'

export interface XyExportOptions {
  decimalsX?: number
  decimalsY?: number
  lineEnding?: '\r\n' | '\n'
  headerLines?: string[]
  /** Separator between columns (default: a single space). */
  separator?: string
}

/** Build a plain two-column ASCII XY file that MDI Jade can read directly. */
export function buildXy(pattern: Pattern, options: XyExportOptions = {}): string {
  const issues = validateForJade(pattern)
  if (hasErrors(issues)) {
    const first = issues.find((i) => i.level === 'error')
    throw new Error(`无法导出：${first?.message ?? '数据未通过 Jade 兼容性检查'}`)
  }
  const decimalsX = options.decimalsX ?? 6
  const decimalsY = options.decimalsY ?? 4
  const eol = options.lineEnding ?? '\r\n'
  const sep = options.separator ?? ' '
  const n = Math.min(pattern.x.length, pattern.y.length)
  const lines: string[] = []
  for (const line of options.headerLines ?? []) {
    lines.push(`# ${line}`)
  }
  for (let i = 0; i < n; i++) {
    const x = pattern.x[i]
    const y = Math.max(pattern.y[i], 1e-6)
    lines.push(`${formatFixed(x, decimalsX)}${sep}${formatFixed(y, decimalsY)}`)
  }
  return lines.join(eol) + eol
}

function formatFixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '0'
  let text = value.toFixed(decimals)
  if (text === `-${(0).toFixed(decimals)}`) text = (0).toFixed(decimals)
  return text
}

export function defaultXyFilename(name: string): string {
  const base = (name || 'pattern')
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .slice(0, 80)
  const stamp = new Date()
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${base}_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.xy`
}

export interface ParsedTable {
  columns: number[][]
  headers: string[]
  delimiter: string
  skippedLines: number
  warnings: string[]
}

/** Parse generic numeric table text (CSV/TSV/whitespace/XY). */
export function parseTabular(text: string): ParsedTable {
  const warnings: string[] = []
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n')
  const dataLines: string[] = []
  let skippedLines = 0
  const headers: string[] = []
  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^[#;/]/.test(trimmed) || /^\/\//.test(trimmed)) {
      skippedLines++
      if (!headers.length && trimmed.length > 1) headers.push(trimmed.replace(/^[#;/]+\s*/, ''))
      continue
    }
    dataLines.push(trimmed)
  }
  if (!dataLines.length) throw new Error('文件中没有可解析的数据行')

  const sample = dataLines.slice(0, 30).join('\n')
  let delimiter = 'whitespace'
  if (sample.includes('\t')) delimiter = '\t'
  else if (sample.includes(';')) delimiter = ';'
  else if (sample.includes(',')) delimiter = ','

  const split = (line: string): string[] => {
    if (delimiter === 'whitespace') return line.split(/\s+/)
    return line.split(delimiter)
  }

  // Detect a header row by checking whether the first row's cells are numeric.
  let start = 0
  const firstCells = split(dataLines[0])
  const numericCells = firstCells.filter((c) => isNumeric(c, delimiter)).length
  if (numericCells < Math.max(1, Math.ceil(firstCells.length / 2))) {
    headers.push(...firstCells.map((c) => c.trim()))
    start = 1
    skippedLines++
  }

  const rows: string[][] = []
  for (let i = start; i < dataLines.length; i++) {
    const cells = split(dataLines[i])
    if (cells.length < 2) {
      skippedLines++
      continue
    }
    rows.push(cells)
  }
  if (!rows.length) throw new Error('没有找到至少两列的数据')

  const columnCount = Math.max(...rows.map((r) => r.length))
  const columns: number[][] = Array.from({ length: columnCount }, () => [])
  for (const row of rows) {
    for (let c = 0; c < columnCount; c++) {
      columns[c].push(parseCell(row[c], delimiter))
    }
  }
  const validColumns = columns.filter((col) => col.some((v) => Number.isFinite(v)))
  if (validColumns.length < 2) throw new Error('有效数值列不足 2 列')
  if (validColumns.length < columnCount) warnings.push(`忽略了 ${columnCount - validColumns.length} 个非数值列`)
  return { columns: validColumns, headers, delimiter, skippedLines, warnings }
}

function isNumeric(cell: string | undefined, delimiter: string): boolean {
  return Number.isFinite(parseCell(cell, delimiter))
}

function parseCell(cell: string | undefined, delimiter: string): number {
  if (cell === undefined) return NaN
  let s = cell.trim().replace(/^["']|["']$/g, '')
  if (!s) return NaN
  // Decimal comma in semicolon-separated files: 1,234 → 1.234
  if (delimiter === ';' && /^-?\d+,\d+$/.test(s)) s = s.replace(',', '.')
  const value = Number(s)
  return Number.isFinite(value) ? value : NaN
}

/** Convenience: two-column text → Pattern (first two numeric columns). */
export function patternFromTwoColumns(
  text: string,
  meta: Pattern['meta'],
): { pattern: Pattern; warnings: string[]; headers: string[] } {
  const table = parseTabular(text)
  if (table.columns.length < 2) throw new Error('需要至少两列数据')
  const x = table.columns[0]
  const y = table.columns[1]
  const n = Math.min(x.length, y.length)
  return {
    pattern: {
      x: new Float64Array(x.slice(0, n)),
      y: new Float64Array(y.slice(0, n)),
      meta,
    },
    warnings: table.warnings,
    headers: table.headers,
  }
}
