import { buildLattice, type CellParams } from '@/core/lattice/cell'
import { atomicMass } from '@/core/diffraction/scattering'
import type { AtomSite } from '@/core/crystallography/structure'

const AVOGADRO = 6.02214076e23

export interface FormulaComponent {
  element: string
  count: number
}

export interface FormulaParseResult {
  formula: string
  components: FormulaComponent[]
  /** Molar mass in g/mol. */
  mass: number
  warnings: string[]
}

/**
 * Parse a chemical formula such as `TiO2`, `Ca(OH)2`, `CuSO4·5H2O`.
 *
 * The parser is deliberately small: element symbols, integer counts, nested
 * parentheses and hydrate dots are supported. Charges and fractional
 * occupancies are ignored (with a warning).
 */
export function parseFormula(formula: string): FormulaParseResult {
  const warnings: string[] = []
  const normalized = (formula || '')
    .replace(/\u2212/g, '-')
    .replace(/\s+/g, '')
    .replace(/[·•∙*]/g, '·')
  if (!normalized) return { formula, components: [], mass: 0, warnings: ['化学式为空'] }

  const total = new Map<string, number>()
  const parts = normalized.split('·').filter(Boolean)
  for (const part of parts) {
    const leading = part.match(/^(\d+(?:\.\d+)?)(?=[A-Z(])/)
    const multiplier = leading ? Number(leading[1]) : 1
    const body = leading ? part.slice(leading[1].length) : part
    const counts = parseGroupBody(body, warnings)
    for (const [element, count] of counts) {
      total.set(element, (total.get(element) ?? 0) + count * multiplier)
    }
  }

  const components = [...total.entries()]
    .map(([element, count]) => ({ element, count }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.element.localeCompare(b.element))

  let mass = 0
  for (const component of components) {
    const m = atomicMass(component.element)
    if (!(m > 0)) {
      warnings.push(`未找到元素 ${component.element} 的原子量`)
      continue
    }
    mass += m * component.count
  }

  return { formula, components, mass, warnings }
}

function parseGroupBody(body: string, warnings: string[]): Map<string, number> {
  const stack: Array<Map<string, number>> = [new Map()]
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (ch === '(' || ch === '[') {
      stack.push(new Map())
      i++
      continue
    }
    if (ch === ')' || ch === ']') {
      if (stack.length === 1) {
        warnings.push(`化学式括号不匹配：${body}`)
        i++
        continue
      }
      const group = stack.pop()!
      i++
      const countMatch = body.slice(i).match(/^(\d+(?:\.\d+)?)/)
      const multiplier = countMatch ? Number(countMatch[1]) : 1
      if (countMatch) i += countMatch[1].length
      const parent = stack[stack.length - 1]
      for (const [element, count] of group) {
        parent.set(element, (parent.get(element) ?? 0) + count * multiplier)
      }
      continue
    }
    if (/[A-Z]/.test(ch)) {
      const match = body.slice(i).match(/^([A-Z][a-z]?)/)
      const element = match ? match[1] : ch
      i += element.length
      const countMatch = body.slice(i).match(/^(\d+(?:\.\d+)?)/)
      const count = countMatch ? Number(countMatch[1]) : 1
      if (countMatch) i += countMatch[1].length
      const current = stack[stack.length - 1]
      current.set(element, (current.get(element) ?? 0) + count)
      continue
    }
    if (/\d/.test(ch)) {
      // A coefficient in front of an atom/group inside parentheses, e.g. 3(H2O).
      const countMatch = body.slice(i).match(/^(\d+(?:\.\d+)?)/)
      const multiplier = countMatch ? Number(countMatch[1]) : 1
      if (countMatch) i += countMatch[1].length
      const group = new Map<string, number>()
      if (body[i] === '(' || body[i] === '[') {
        const start = i
        let depth = 0
        let j = i
        for (; j < body.length; j++) {
          if (body[j] === '(' || body[j] === '[') depth++
          else if (body[j] === ')' || body[j] === ']') {
            depth--
            if (depth === 0) {
              j++
              break
            }
          }
        }
        const inner = body.slice(start + 1, j - 1)
        const nested = parseGroupBody(inner, warnings)
        for (const [element, count] of nested) group.set(element, count)
        i = j
      } else if (/[A-Z]/.test(body[i] ?? '')) {
        const match = body.slice(i).match(/^([A-Z][a-z]?)/)
        const element = match ? match[1] : body[i]
        i += element.length
        group.set(element, 1)
      }
      const current = stack[stack.length - 1]
      for (const [element, count] of group) {
        current.set(element, (current.get(element) ?? 0) + count * multiplier)
      }
      continue
    }
    if (ch === '+' || ch === '-' || ch === '.') {
      // Charges or decimal points are not meaningful for molar mass.
      i++
      continue
    }
    warnings.push(`忽略无法识别的字符“${ch}”`)
    i++
  }
  while (stack.length > 1) {
    const group = stack.pop()!
    const parent = stack[stack.length - 1]
    for (const [element, count] of group) {
      parent.set(element, (parent.get(element) ?? 0) + count)
    }
    warnings.push('化学式括号不匹配，已按右括号缺失处理')
  }
  return stack[0]
}

/** Volume of a unit cell in Å³. */
export function cellVolume(cell: CellParams): number {
  return buildLattice(cell).volume
}

export type PackingType = 'sc' | 'bcc' | 'fcc' | 'hcp' | 'diamond'

export interface PackingResult {
  type: PackingType
  label: string
  atomsPerCell: number
  coordination: number
  apf: number
  /** Atomic radius expressed with the conventional lattice parameter. */
  radiusFormula: string
  note: string
}

/**
 * Atomic packing factor for the common structure types.
 *
 * HCP depends on c/a; the ideal value √(8/3) gives the familiar 0.7405.
 */
export function packingFactor(type: PackingType, cOverA = Math.sqrt(8 / 3)): PackingResult {
  const idealC = Math.sqrt(8 / 3)
  switch (type) {
    case 'sc':
      return {
        type,
        label: '简单立方 SC',
        atomsPerCell: 1,
        coordination: 6,
        apf: Math.PI / 6,
        radiusFormula: 'r = a/2',
        note: '配位数 6，次近邻 12；空间利用率 52.4%。',
      }
    case 'bcc':
      return {
        type,
        label: '体心立方 BCC',
        atomsPerCell: 2,
        coordination: 8,
        apf: (Math.sqrt(3) * Math.PI) / 8,
        radiusFormula: 'r = √3·a/4',
        note: '密排方向为体对角线 ⟨111⟩；空间利用率 68.0%。',
      }
    case 'fcc':
      return {
        type,
        label: '面心立方 FCC',
        atomsPerCell: 4,
        coordination: 12,
        apf: (Math.sqrt(2) * Math.PI) / 6,
        radiusFormula: 'r = √2·a/4',
        note: '密排面 {111}，ABCABC 堆垛；空间利用率 74.05%。',
      }
    case 'diamond':
      return {
        type,
        label: '金刚石结构',
        atomsPerCell: 8,
        coordination: 4,
        apf: (Math.sqrt(3) * Math.PI) / 16,
        radiusFormula: 'r = √3·a/8',
        note: 'FCC 套构 + 体对角线 1/4 位移；空间利用率 34.0%。',
      }
    case 'hcp': {
      const ratio = Number.isFinite(cOverA) && cOverA > 0 ? cOverA : idealC
      const apf = (2 * Math.PI) / (3 * Math.sqrt(3) * ratio)
      return {
        type,
        label: '六方密排 HCP',
        atomsPerCell: 2,
        coordination: 12,
        apf,
        radiusFormula: 'r = a/2',
        note:
          Math.abs(ratio - idealC) < 1e-4
            ? `理想 c/a = √(8/3) ≈ ${idealC.toFixed(4)}；空间利用率 74.05%。`
            : `按 c/a = ${ratio.toFixed(4)} 计算（理想值 ${idealC.toFixed(4)}）；密排面 (0001)。`,
      }
    }
  }
}

/** Total mass of the atoms in one unit cell, in g/mol of cell contents. */
export function unitCellMass(atoms: readonly AtomSite[]): number {
  let mass = 0
  for (const atom of atoms) {
    const m = atomicMass(atom.element)
    if (m > 0) mass += m * (atom.occupancy ?? 1)
  }
  return mass
}

/** Theoretical density in g/cm³ from the cell contents. */
export function densityFromAtoms(atoms: readonly AtomSite[], volumeAngstrom3: number): number {
  if (!(volumeAngstrom3 > 0)) return NaN
  return unitCellMass(atoms) / (AVOGADRO * volumeAngstrom3 * 1e-24)
}

/** Z = number of formula units per cell from a measured density. */
export function formulaUnitsFromDensity(density: number, volumeAngstrom3: number, molarMass: number): number {
  if (!(density > 0) || !(volumeAngstrom3 > 0) || !(molarMass > 0)) return NaN
  return (density * volumeAngstrom3 * 1e-24 * AVOGADRO) / molarMass
}

/** Density in g/cm³ from Z, molar mass and cell volume. */
export function densityFromZ(z: number, molarMass: number, volumeAngstrom3: number): number {
  if (!(volumeAngstrom3 > 0) || !(molarMass > 0)) return NaN
  return (z * molarMass) / (AVOGADRO * volumeAngstrom3 * 1e-24)
}

/** Number of formula units represented by the cell contents. */
export function zFromCellContents(atoms: readonly AtomSite[], formula: string): number {
  const parsed = parseFormula(formula)
  if (!(parsed.mass > 0)) return NaN
  return unitCellMass(atoms) / parsed.mass
}

/** Reduced empirical formula from the cell contents (occupancies included). */
export function formulaFromAtoms(atoms: readonly AtomSite[]): { formula: string; components: FormulaComponent[] } {
  const counts = new Map<string, number>()
  for (const atom of atoms) {
    const occ = atom.occupancy ?? 1
    if (occ > 0) counts.set(atom.element, (counts.get(atom.element) ?? 0) + occ)
  }
  const entries = [...counts.entries()].filter(([, v]) => v > 0)
  if (!entries.length) return { formula: '', components: [] }
  const rounded = entries.map(([element, count]) => [element, Math.round(count * 1000) / 1000] as const)
  const integers = rounded.every(([, count]) => Math.abs(count - Math.round(count)) < 1e-6)
  let divisor = 1
  if (integers) {
    divisor = rounded.reduce((g, [, count]) => gcdInt(g, Math.round(count)), 0) || 1
  }
  const components: FormulaComponent[] = rounded.map(([element, count]) => ({
    element,
    count: Math.round((count / divisor) * 1000) / 1000,
  }))
  const formula = components
    .sort((a, b) => a.element.localeCompare(b.element))
    .map((c) => `${c.element}${Math.abs(c.count - 1) < 1e-9 ? '' : c.count}`)
    .join('')
  return { formula, components }
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

/** Mass fraction of each element in the cell contents. */
export function massFractions(atoms: readonly AtomSite[]): Array<{ element: string; mass: number; fraction: number }> {
  const byElement = new Map<string, number>()
  for (const atom of atoms) {
    const m = atomicMass(atom.element) * (atom.occupancy ?? 1)
    if (m > 0) byElement.set(atom.element, (byElement.get(atom.element) ?? 0) + m)
  }
  const total = [...byElement.values()].reduce((sum, v) => sum + v, 0)
  return [...byElement.entries()]
    .map(([element, mass]) => ({ element, mass, fraction: total > 0 ? mass / total : 0 }))
    .sort((a, b) => b.mass - a.mass)
}
