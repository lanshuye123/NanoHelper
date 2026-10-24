import type { RawSymOp, SpaceGroup, SpaceGroupMeta } from '@/core/data/spacegroups'
import { generalPositionAmplitude, axialReflectionCondition } from '@/core/crystallography/indices'
import {
  applySymOp,
  orbitSize,
  wrap01,
  type FractionalXYZ,
  type SymOp,
} from '@/core/crystallography/symmetry'

export interface SiteOrbit {
  multiplicity: number
  generalMultiplicity: number
  siteSymmetryOrder: number
  special: boolean
  positions: FractionalXYZ[]
  /** Operations that leave the site invariant (modulo lattice translations). */
  stabilizer: string[]
}

export interface ReflectionConditionSummary {
  h00: string
  k00: string
  '00l': string
  centering: string
}

export interface ReflectionRow {
  hkl: [number, number, number]
  allowed: boolean
  amplitude: number
}

export interface SymmetryAnalysis {
  meta: SpaceGroupMeta
  ops: SymOp[]
  generalPositions: string[]
  generalMultiplicity: number
  chiral: boolean
  chiralityReason: string
  conditions: ReflectionConditionSummary
  absences: ReflectionRow[]
  warnings: string[]
}

function determinant3(matrix: number[][]): number {
  return (
    matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
    matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
    matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])
  )
}

const FRACTIONS: Array<[number, string]> = [
  [0, '0'],
  [1 / 8, '1/8'],
  [1 / 6, '1/6'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [5 / 6, '5/6'],
  [7 / 8, '7/8'],
  [1, '1'],
  [-1 / 4, '-1/4'],
  [-1 / 3, '-1/3'],
  [-1 / 2, '-1/2'],
  [-2 / 3, '-2/3'],
  [-3 / 4, '-3/4'],
]

function formatNumber(value: number): string {
  for (const [candidate, label] of FRACTIONS) {
    if (Math.abs(value - candidate) < 1e-6) return label
  }
  return Number(value.toFixed(3)).toString()
}

export function formatSymOp(op: SymOp): string {
  if (op.s) return op.s
  const variables = ['x', 'y', 'z']
  const parts: string[] = []
  for (let row = 0; row < 3; row++) {
    let term = ''
    for (let col = 0; col < 3; col++) {
      const coeff = op.r[row][col]
      if (coeff === 0) continue
      const sign = coeff > 0 ? '+' : '-'
      const magnitude = Math.abs(coeff)
      const body = `${magnitude === 1 ? '' : formatNumber(magnitude)}${variables[col]}`
      term += term ? `${sign}${body}` : `${coeff < 0 ? '-' : ''}${body}`
    }
    const translation = op.t[row]
    if (Math.abs(translation) > 1e-9) {
      term += `${translation > 0 ? '+' : '-'}${formatNumber(Math.abs(translation))}`
    }
    parts.push(term || '0')
  }
  return parts.join(', ')
}

function normaliseOps(group: SpaceGroup): SymOp[] {
  return group.ops.map((op: RawSymOp) => ({ r: op.r, t: op.t, s: op.s }))
}

/** A space group is chiral when it contains no improper operation. */
export function spaceGroupChirality(ops: readonly SymOp[]): {
  chiral: boolean
  improperCount: number
  reason: string
} {
  if (!ops.length) return { chiral: false, improperCount: 0, reason: '缺少对称操作数据' }
  const improper = ops.filter((op) => determinant3(op.r) < 0)
  if (improper.length) {
    const examples = improper
      .slice(0, 4)
      .map((op) => formatSymOp(op))
      .join('；')
    return {
      chiral: false,
      improperCount: improper.length,
      reason: `含 ${improper.length} 个非正当操作（反演、镜面、旋转反演或滑移面），因此不是手性空间群。例：${examples}`,
    }
  }
  return {
    chiral: true,
    improperCount: 0,
    reason: '只含旋转轴与螺旋轴等正当操作，没有反演、镜面、旋转反演或滑移面；属于手性空间群。',
  }
}

function positionKey(point: FractionalXYZ, decimals = 4): string {
  const scale = 10 ** decimals
  const q = (v: number) => {
    const wrapped = wrap01(v)
    const rounded = Math.round(wrapped * scale) % scale
    return rounded === scale ? 0 : rounded
  }
  return `${q(point.x)},${q(point.y)},${q(point.z)}`
}

function samePosition(a: FractionalXYZ, b: FractionalXYZ, tolerance = 1e-4): boolean {
  const near = (x: number, y: number) => {
    const delta = wrap01(x - y)
    return delta < tolerance || 1 - delta < tolerance
  }
  return near(a.x, b.x) && near(a.y, b.y) && near(a.z, b.z)
}

/** Equivalent positions and site-symmetry order for one fractional coordinate. */
export function siteOrbit(ops: readonly SymOp[], xyz: FractionalXYZ): SiteOrbit {
  const points = new Map<string, FractionalXYZ>()
  for (const op of ops.length ? ops : [{ r: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0], s: 'x, y, z' }]) {
    const point = applySymOp(op, xyz)
    points.set(positionKey(point), point)
  }
  const stabilizer = ops
    .filter((op) => samePosition(applySymOp(op, xyz), xyz))
    .map((op) => formatSymOp(op))
  const generalMultiplicity = orbitSize(ops)
  const multiplicity = points.size
  return {
    multiplicity,
    generalMultiplicity,
    siteSymmetryOrder: stabilizer.length || 1,
    special: multiplicity < generalMultiplicity,
    positions: [...points.values()],
    stabilizer,
  }
}

function centeringText(latticeType: string): string {
  switch (latticeType.toUpperCase()) {
    case 'I':
      return '体心 I：h + k + l = 2n'
    case 'F':
      return '面心 F：h, k, l 必须全奇或全偶'
    case 'C':
      return 'C 心：h + k = 2n'
    case 'A':
      return 'A 心：k + l = 2n'
    case 'B':
      return 'B 心：h + l = 2n'
    case 'R':
      return '菱方 R（六方取向）：-h + k + l = 3n'
    default:
      return '简单点阵 P：无点阵消光'
  }
}

/** Build the complete symmetry summary used by the symmetry tool page. */
export function analyseSpaceGroup(group: SpaceGroup): SymmetryAnalysis {
  const ops = normaliseOps(group)
  const meta: SpaceGroupMeta = {
    number: group.number,
    symbol: group.symbolHM,
    crystalSystem: group.crystalSystem,
    pointGroup: group.pointGroup,
    latticeType: group.latticeType,
  }
  const chirality = spaceGroupChirality(ops)
  const generalMultiplicity = orbitSize(ops)

  const absences: ReflectionRow[] = []
  const maxIndex = 8
  for (let h = 0; h <= maxIndex; h++) {
    for (let k = -maxIndex; k <= maxIndex; k++) {
      for (let l = -maxIndex; l <= maxIndex; l++) {
        if (h === 0 && k < 0) continue
        if (h === 0 && k === 0 && l <= 0) continue
        const amplitude = generalPositionAmplitude(ops, [h, k, l]).amplitude
        absences.push({ hkl: [h, k, l], allowed: amplitude > 1e-8, amplitude })
      }
    }
  }
  absences.sort(
    (a, b) =>
      Number(a.allowed) - Number(b.allowed) ||
      Math.abs(a.hkl[0]) + Math.abs(a.hkl[1]) + Math.abs(a.hkl[2]) -
        (Math.abs(b.hkl[0]) + Math.abs(b.hkl[1]) + Math.abs(b.hkl[2])),
  )

  const warnings: string[] = []
  if (!ops.length) warnings.push('当前空间群没有对称操作数据，等效位置与消光结果不可用')
  warnings.push('本页给出等效位置数与位置对称性阶数；“Wyckoff 字母”需对照国际晶体学表确认')

  return {
    meta,
    ops,
    generalPositions: ops.map((op) => formatSymOp(op)),
    generalMultiplicity,
    chiral: chirality.chiral,
    chiralityReason: chirality.reason,
    conditions: {
      h00: axialReflectionCondition(ops, 0),
      k00: axialReflectionCondition(ops, 1),
      '00l': axialReflectionCondition(ops, 2),
      centering: centeringText(group.latticeType),
    },
    absences,
    warnings,
  }
}
