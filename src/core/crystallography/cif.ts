import type { CellParams } from '@/core/lattice/cell'
import type { AtomSite } from '@/core/crystallography/structure'
import type { SymOp } from '@/core/crystallography/symmetry'
import { parseSymmetryOperation } from '@/core/crystallography/symmetry'

export interface CifLoop {
  tags: string[]
  rows: string[][]
}

export interface CifData {
  items: Record<string, string>
  loops: CifLoop[]
}

export interface ParsedCif {
  cell: CellParams | null
  atoms: AtomSite[]
  ops: SymOp[]
  spaceGroupNumber?: number
  spaceGroupSymbol?: string
  title?: string
  warnings: string[]
  items: Record<string, string>
}

const STRUCTURAL = /^(_|loop_|data_|save_|stop_|global_)/i

function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/\./g, '_')
}

/** Tokenize CIF text, honouring quoted values, semicolon text fields and comments. */
export function tokenizeCif(text: string): string[] {
  const tokens: string[] = []
  let i = 0
  const n = text.length
  let atLineStart = true
  while (i < n) {
    const ch = text[i]
    if (ch === '\n') {
      atLineStart = true
      i++
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++
      continue
    }
    if (ch === '#') {
      while (i < n && text[i] !== '\n') i++
      continue
    }
    if (ch === ';' && atLineStart) {
      // Semicolon-delimited multi-line text field.
      i++
      const start = i
      while (i < n) {
        if (text[i] === '\n' && text[i + 1] === ';') {
          tokens.push(text.slice(start, i))
          i += 2
          while (i < n && text[i] !== '\n') i++
          if (i < n) i++
          atLineStart = true
          break
        }
        i++
      }
      if (i >= n) tokens.push(text.slice(start))
      continue
    }
    atLineStart = false
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      const start = i
      while (i < n && text[i] !== quote) i++
      tokens.push(text.slice(start, i))
      if (i < n) i++
      continue
    }
    const start = i
    while (i < n && !/[\s]/.test(text[i])) {
      if (text[i] === '#' && i === start) break
      i++
    }
    tokens.push(text.slice(start, i))
  }
  return tokens
}

/** Parse a CIF into a flat item dictionary plus table loops. */
export function parseCif(text: string): CifData {
  const tokens = tokenizeCif(text)
  const items: Record<string, string> = {}
  const loops: CifLoop[] = []
  let i = 0
  const isStructural = (tok: string) => STRUCTURAL.test(tok)
  while (i < tokens.length) {
    const tok = tokens[i]
    const lower = tok.toLowerCase()
    if (lower === 'loop_') {
      i++
      const tags: string[] = []
      while (i < tokens.length && tokens[i].startsWith('_')) {
        tags.push(normalizeTag(tokens[i]))
        i++
      }
      const values: string[] = []
      while (i < tokens.length && !isStructural(tokens[i])) {
        values.push(tokens[i])
        i++
      }
      if (tags.length > 0) {
        const rows: string[][] = []
        for (let k = 0; k + tags.length <= values.length; k += tags.length) {
          rows.push(values.slice(k, k + tags.length))
        }
        loops.push({ tags, rows })
      }
      continue
    }
    if (lower.startsWith('data_') || lower.startsWith('save_') || lower === 'stop_' || lower === 'global_') {
      i++
      continue
    }
    if (tok.startsWith('_')) {
      const lowerTag = normalizeTag(tok)
      const next = tokens[i + 1]
      if (
        next === undefined ||
        next.startsWith('_') ||
        next.toLowerCase() === 'loop_' ||
        next.toLowerCase().startsWith('data_') ||
        next.toLowerCase().startsWith('save_')
      ) {
        items[lowerTag] = '?'
        i++
      } else {
        items[lowerTag] = next
        i += 2
      }
      continue
    }
    i++
  }
  return { items, loops }
}

export function cifNumber(raw: string | undefined | null): number {
  if (raw === undefined || raw === null) return NaN
  let s = String(raw).trim()
  if (!s || s === '.' || s === '?') return NaN
  // Remove the standard uncertainty suffix, e.g. 5.431(2).
  s = s.replace(/\(\d+\)$/, '')
  if (s.includes('/')) {
    const [num, den] = s.split('/')
    const n = Number(num)
    const d = Number(den)
    return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : NaN
  }
  const v = Number(s)
  return Number.isFinite(v) ? v : NaN
}

function getItem(data: CifData, ...tags: string[]): string | undefined {
  for (const tag of tags) {
    const value = data.items[normalizeTag(tag)]
    if (value !== undefined && value !== '?' && value !== '.') return value
  }
  return undefined
}

function findLoopWith(data: CifData, tag: string): { loop: CifLoop; index: number } | null {
  const target = normalizeTag(tag)
  for (const loop of data.loops) {
    const index = loop.tags.indexOf(target)
    if (index >= 0) return { loop, index }
  }
  return null
}

function extractSymbol(row: string[], tagIndex: Record<string, number>): string {
  const typeIndex = tagIndex['_atom_site_type_symbol']
  const labelIndex = tagIndex['_atom_site_label']
  const raw = (typeIndex !== undefined ? row[typeIndex] : '') || (labelIndex !== undefined ? row[labelIndex] : '')
  const m = raw.match(/^([A-Za-z]{1,2})/)
  if (!m) return ''
  const s = m[1]
  return s[0].toUpperCase() + s.slice(1).toLowerCase()
}

/** Interpret a parsed CIF into cell parameters, atom sites and symmetry operations. */
export function interpretCif(data: CifData): ParsedCif {
  const warnings: string[] = []
  const cell: CellParams | null = (() => {
    const a = cifNumber(getItem(data, '_cell_length_a'))
    const b = cifNumber(getItem(data, '_cell_length_b'))
    const c = cifNumber(getItem(data, '_cell_length_c'))
    const alpha = cifNumber(getItem(data, '_cell_angle_alpha'))
    const beta = cifNumber(getItem(data, '_cell_angle_beta'))
    const gamma = cifNumber(getItem(data, '_cell_angle_gamma'))
    if ([a, b, c, alpha, beta, gamma].some((v) => !Number.isFinite(v))) return null
    return { a, b, c, alpha, beta, gamma }
  })()
  if (!cell) warnings.push('未能从 CIF 中读取完整的晶胞参数（a, b, c, α, β, γ）')

  const spaceGroupNumber = cifNumber(
    getItem(data, '_symmetry_int_tables_number', '_space_group_it_number', '_space_group.it_number'),
  )
  const spaceGroupSymbol = getItem(
    data,
    '_symmetry_space_group_name_h-m',
    '_space_group_name_h-m_alt',
    '_space_group_name_h-m',
  )
  const title =
    getItem(data, '_chemical_name_systematic', '_chemical_name_common', '_publ_section_title') ?? undefined

  // Symmetry operations: loop form first, then single-item form.
  const ops: SymOp[] = []
  const opTags = [
    '_space_group_symop_operation_xyz',
    '_symmetry_equiv_pos_as_xyz',
    '_space_group_symop.operation_xyz',
  ]
  let opStrings: string[] = []
  for (const tag of opTags) {
    const found = findLoopWith(data, tag)
    if (found) {
      opStrings = found.loop.rows.map((row) => row[found.index]).filter(Boolean)
      break
    }
  }
  if (!opStrings.length) {
    for (const tag of opTags) {
      const raw = data.items[tag]
      if (raw && raw !== '?' && raw !== '.') {
        opStrings = [raw]
        break
      }
    }
  }
  for (const s of opStrings) {
    try {
      ops.push(parseSymmetryOperation(s))
    } catch {
      warnings.push(`跳过无法解析的对称操作：${s}`)
    }
  }

  // Atom sites: locate a loop containing fractional coordinates.
  const atoms: AtomSite[] = []
  const fractX = findLoopWith(data, '_atom_site_fract_x')
  if (fractX) {
    const { loop } = fractX
    const tagIndex: Record<string, number> = {}
    loop.tags.forEach((tag, idx) => {
      tagIndex[tag] = idx
    })
    const ix = tagIndex['_atom_site_fract_x']
    const iy = tagIndex['_atom_site_fract_y']
    const iz = tagIndex['_atom_site_fract_z']
    const iocc = tagIndex['_atom_site_occupancy']
    const ibiso = tagIndex['_atom_site_b_iso_or_equiv']
    const iuiso = tagIndex['_atom_site_u_iso_or_equiv']
    const ilabel = tagIndex['_atom_site_label']
    for (const row of loop.rows) {
      const x = cifNumber(row[ix])
      const y = cifNumber(row[iy])
      const z = cifNumber(row[iz])
      if (![x, y, z].every(Number.isFinite)) continue
      const element = extractSymbol(row, tagIndex)
      if (!element) {
        warnings.push('存在缺少元素类型的原子位点，已跳过')
        continue
      }
      let biso = 0
      if (ibiso !== undefined) biso = cifNumber(row[ibiso]) || 0
      else if (iuiso !== undefined) {
        const u = cifNumber(row[iuiso])
        if (Number.isFinite(u)) biso = 8 * Math.PI * Math.PI * u
      }
      const occupancy = iocc !== undefined ? cifNumber(row[iocc]) : 1
      atoms.push({
        element,
        x,
        y,
        z,
        occupancy: Number.isFinite(occupancy) ? occupancy : 1,
        biso: Number.isFinite(biso) ? biso : 0,
        label: ilabel !== undefined ? row[ilabel] : undefined,
      })
    }
    for (const atom of atoms) {
      if (atom.x < 0 || atom.x >= 1 || atom.y < 0 || atom.y >= 1 || atom.z < 0 || atom.z >= 1) {
        warnings.push('部分原子坐标位于 [0,1) 之外，已按周期取整显示')
        break
      }
    }
  } else {
    warnings.push('CIF 中未找到 _atom_site_fract_x 原子坐标表')
  }

  if (!ops.length) {
    warnings.push('CIF 中未提供对称操作；将按 P1 处理，仅使用列出的原子')
  }

  return { cell, atoms, ops, spaceGroupNumber, spaceGroupSymbol, title, warnings, items: data.items }
}

export function parseCifText(text: string): ParsedCif {
  return interpretCif(parseCif(text))
}
