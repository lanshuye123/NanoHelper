import indexData from '@/data/spacegroups-index.json'
import type { SymOp } from '@/core/crystallography/symmetry'

export interface SpaceGroupMeta {
  number: number
  symbol: string
  crystalSystem: string
  pointGroup: string
  latticeType: string
}

export interface RawSymOp {
  r: number[][]
  t: number[]
  s?: string
}

export interface SpaceGroup {
  number: number
  symbolHM: string
  symbolHall: string
  crystalSystem: string
  latticeType: string
  pointGroup: string
  ops: RawSymOp[]
}

const metas = indexData as SpaceGroupMeta[]

const loaders: Record<string, () => Promise<{ default: SpaceGroup[] }>> = {
  cubic: () => import('@/data/spacegroups/cubic.json'),
  hexagonal: () => import('@/data/spacegroups/hexagonal.json'),
  monoclinic: () => import('@/data/spacegroups/monoclinic.json'),
  orthorhombic: () => import('@/data/spacegroups/orthorhombic.json'),
  tetragonal: () => import('@/data/spacegroups/tetragonal.json'),
  triclinic: () => import('@/data/spacegroups/triclinic.json'),
  trigonal: () => import('@/data/spacegroups/trigonal.json'),
}

const systemCache = new Map<string, SpaceGroup[]>()
const groupCache = new Map<number, SpaceGroup>()

export const SPACE_GROUP_INDEX = metas

export function getSpaceGroupMeta(number: number): SpaceGroupMeta | undefined {
  return metas.find((m) => m.number === number)
}

export function normalizeSpaceGroupSymbol(symbol: string): string {
  return symbol
    .toLowerCase()
    .replace(/\u2212/g, '-')
    .replace(/[\s_]/g, '')
    .replace(/^['"]|['"]$/g, '')
}

const symbolMap = new Map<string, SpaceGroupMeta>()
for (const meta of metas) {
  symbolMap.set(normalizeSpaceGroupSymbol(meta.symbol), meta)
}

/** Fuzzy H-M symbol lookup (spaces and underscores are ignored). */
export function findSpaceGroupMeta(symbol: string): SpaceGroupMeta | undefined {
  const normalized = normalizeSpaceGroupSymbol(symbol)
  const direct = symbolMap.get(normalized)
  if (direct) return direct
  // Try removing the monoclinic unique-axis "1"s, e.g. "P 1 21/c 1".
  const compact = normalized.replace(/^([pcaibfrh])1/, '$1').replace(/1$/, '')
  for (const [key, meta] of symbolMap) {
    if (key === compact) return meta
  }
  return undefined
}

async function loadSystem(crystalSystem: string): Promise<SpaceGroup[]> {
  const cached = systemCache.get(crystalSystem)
  if (cached) return cached
  const loader = loaders[crystalSystem]
  if (!loader) return []
  const module = await loader()
  systemCache.set(crystalSystem, module.default)
  return module.default
}

export async function loadSpaceGroup(numberOrSymbol: number | string): Promise<SpaceGroup | null> {
  const meta =
    typeof numberOrSymbol === 'number'
      ? getSpaceGroupMeta(numberOrSymbol)
      : findSpaceGroupMeta(numberOrSymbol)
  if (!meta) return null
  const cached = groupCache.get(meta.number)
  if (cached) return cached
  const groups = await loadSystem(meta.crystalSystem)
  const group = groups.find((g) => g.number === meta.number) ?? null
  if (group) groupCache.set(meta.number, group)
  return group
}

export function toSymOps(group: SpaceGroup): SymOp[] {
  return group.ops.map((op) => ({ r: op.r, t: op.t, s: op.s }))
}

export async function loadSymOps(numberOrSymbol: number | string): Promise<SymOp[]> {
  const group = await loadSpaceGroup(numberOrSymbol)
  return group ? toSymOps(group) : []
}

export function rotationParts(ops: readonly RawSymOp[]): number[][][] {
  return ops.map((op) => op.r)
}
