import type { CellParams } from '@/core/lattice/cell'
import type { AtomSite, Structure } from '@/core/crystallography/structure'
import { expandAtoms, type SymOp } from '@/core/crystallography/symmetry'
import { interpretCif, parseCif, type CifData, type ParsedCif } from '@/core/crystallography/cif'
import { findSpaceGroupMeta, getSpaceGroupMeta, loadSpaceGroup, toSymOps } from '@/core/data/spacegroups'

export interface StructureBuildResult {
  structure: Structure
  parsed: ParsedCif
  ops: SymOp[]
  warnings: string[]
  spaceGroupNumber?: number
  spaceGroupSymbol?: string
}

/**
 * Resolve symmetry operations for a CIF that does not carry them, then expand
 * the asymmetric unit into a full unit cell.
 */
export async function buildStructureFromCif(
  text: string,
  options: { name?: string; preferCifOps?: boolean; maxAtoms?: number } = {},
): Promise<StructureBuildResult> {
  const data: CifData = parseCif(text)
  const parsed = interpretCif(data)
  if (!parsed.cell) {
    throw new Error('CIF 中缺少完整的晶胞参数，无法建立结构')
  }
  const warnings = [...parsed.warnings]
  let ops = parsed.ops
  let spaceGroupNumber = parsed.spaceGroupNumber
  let spaceGroupSymbol = parsed.spaceGroupSymbol

  if (!ops.length) {
    const meta = spaceGroupNumber
      ? getSpaceGroupMeta(spaceGroupNumber)
      : spaceGroupSymbol
        ? findSpaceGroupMeta(spaceGroupSymbol)
        : undefined
    if (meta) {
      const group = await loadSpaceGroup(meta.number)
      if (group) {
        ops = toSymOps(group)
        spaceGroupNumber = group.number
        spaceGroupSymbol = group.symbolHM
        warnings.push(`CIF 未提供对称操作，已按空间群 #${group.number} ${group.symbolHM} 展开`)
      }
    }
  } else if (options.preferCifOps === false) {
    // explicit override: use the database setting
    const group = spaceGroupNumber ? await loadSpaceGroup(spaceGroupNumber) : null
    if (group) {
      ops = toSymOps(group)
      warnings.push(`已改用空间群数据库 #${group.number} ${group.symbolHM} 的对称操作`)
    }
  }

  const expanded = expandAtoms(parsed.atoms, ops)
  const maxAtoms = options.maxAtoms ?? 2000
  if (expanded.length > maxAtoms) {
    warnings.push(`对称展开后原子数 (${expanded.length}) 超过上限 ${maxAtoms}，已截断`)
  }
  const atoms = expanded.slice(0, maxAtoms)
  if (!atoms.length) {
    warnings.push('没有可用的原子位点：衍射强度将全部为零')
  }

  const structure: Structure = {
    name: options.name ?? parsed.title ?? 'CIF 结构',
    cell: parsed.cell,
    atoms,
    spaceGroupNumber,
    spaceGroupSymbol,
    source: 'cif',
  }
  return { structure, parsed, ops, warnings, spaceGroupNumber, spaceGroupSymbol }
}

/** Expand a structure that stores only the asymmetric unit. */
export function expandStructure(structure: Structure, ops: readonly SymOp[]): Structure {
  return {
    ...structure,
    atoms: expandAtoms(structure.atoms, ops),
  }
}

/** Quick validation of a hand-entered structure. */
export function validateStructure(
  cell: CellParams,
  atoms: readonly AtomSite[],
): { ok: boolean; issues: string[] } {
  const issues: string[] = []
  if (![cell.a, cell.b, cell.c].every((v) => Number.isFinite(v) && v > 0)) {
    issues.push('晶格常数必须为正数')
  }
  if (![cell.alpha, cell.beta, cell.gamma].every((v) => v > 0 && v < 180)) {
    issues.push('晶胞角必须在 (0°, 180°) 内')
  }
  if (!atoms.length) issues.push('至少需要一个原子位点')
  for (const atom of atoms) {
    if (![atom.x, atom.y, atom.z].every((v) => Number.isFinite(v))) {
      issues.push(`原子 ${atom.label ?? atom.element} 的坐标无效`)
      break
    }
  }
  return { ok: issues.length === 0, issues }
}
