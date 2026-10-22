import type { CellParams } from '@/core/lattice/cell'
import type { AtomSite, Structure } from '@/core/crystallography/structure'

export interface StructurePreset {
  id: string
  name: string
  formula: string
  description: string
  spaceGroupNumber: number
  spaceGroupSymbol: string
  cell: CellParams
  /** Full unit-cell contents (already symmetry-expanded). */
  atoms: AtomSite[]
}

export const STRUCTURE_PRESETS: StructurePreset[] = [
  {
    id: 'si',
    name: '硅',
    formula: 'Si',
    description: '金刚石结构，Fd-3m，最常用的 XRD/SAED 标样',
    spaceGroupNumber: 227,
    spaceGroupSymbol: 'Fd-3m',
    cell: { a: 5.431, b: 5.431, c: 5.431, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'Si', x: 0.125, y: 0.125, z: 0.125 },
      { element: 'Si', x: 0.125, y: 0.625, z: 0.625 },
      { element: 'Si', x: 0.375, y: 0.375, z: 0.875 },
      { element: 'Si', x: 0.375, y: 0.875, z: 0.375 },
      { element: 'Si', x: 0.625, y: 0.125, z: 0.625 },
      { element: 'Si', x: 0.625, y: 0.625, z: 0.125 },
      { element: 'Si', x: 0.875, y: 0.375, z: 0.375 },
      { element: 'Si', x: 0.875, y: 0.875, z: 0.875 },
    ],
  },
  {
    id: 'diamond',
    name: '金刚石',
    formula: 'C',
    description: '立方金刚石，Fd-3m；与 Si 同构',
    spaceGroupNumber: 227,
    spaceGroupSymbol: 'Fd-3m',
    cell: { a: 3.5668, b: 3.5668, c: 3.5668, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'C', x: 0.125, y: 0.125, z: 0.125 },
      { element: 'C', x: 0.125, y: 0.625, z: 0.625 },
      { element: 'C', x: 0.375, y: 0.375, z: 0.875 },
      { element: 'C', x: 0.375, y: 0.875, z: 0.375 },
      { element: 'C', x: 0.625, y: 0.125, z: 0.625 },
      { element: 'C', x: 0.625, y: 0.625, z: 0.125 },
      { element: 'C', x: 0.875, y: 0.375, z: 0.375 },
      { element: 'C', x: 0.875, y: 0.875, z: 0.875 },
    ],
  },
  {
    id: 'nacl',
    name: '氯化钠',
    formula: 'NaCl',
    description: '岩盐结构，Fm-3m；Na⁺ 与 Cl⁻ 各自构成 FCC',
    spaceGroupNumber: 225,
    spaceGroupSymbol: 'Fm-3m',
    cell: { a: 5.6402, b: 5.6402, c: 5.6402, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'Cl', x: 0, y: 0, z: 0.5 },
      { element: 'Cl', x: 0, y: 0.5, z: 0 },
      { element: 'Cl', x: 0.5, y: 0, z: 0 },
      { element: 'Cl', x: 0.5, y: 0.5, z: 0.5 },
      { element: 'Na', x: 0, y: 0, z: 0 },
      { element: 'Na', x: 0, y: 0.5, z: 0.5 },
      { element: 'Na', x: 0.5, y: 0, z: 0.5 },
      { element: 'Na', x: 0.5, y: 0.5, z: 0 },
    ],
  },
  {
    id: 'rutile',
    name: '金红石 TiO₂',
    formula: 'TiO2',
    description: '四方金红石，P4₂/mnm；TiO₆ 八面体共边成链',
    spaceGroupNumber: 136,
    spaceGroupSymbol: 'P4_2/mnm',
    cell: { a: 4.5937, b: 4.5937, c: 2.9587, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'O', x: 0.1947, y: 0.8053, z: 0.5 },
      { element: 'O', x: 0.3053, y: 0.3053, z: 0 },
      { element: 'O', x: 0.6947, y: 0.6947, z: 0 },
      { element: 'O', x: 0.8053, y: 0.1947, z: 0.5 },
      { element: 'Ti', x: 0, y: 0, z: 0 },
      { element: 'Ti', x: 0.5, y: 0.5, z: 0.5 },
    ],
  },
  {
    id: 'anatase',
    name: '锐钛矿 TiO₂',
    formula: 'TiO2',
    description: '四方锐钛矿，I4₁/amd（原点选择 2）；纳米 TiO₂ 常见相',
    spaceGroupNumber: 141,
    spaceGroupSymbol: 'I4_1/amd',
    cell: { a: 3.7845, b: 3.7845, c: 9.5143, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'O', x: 0, y: 0.25, z: 0.0831 },
      { element: 'O', x: 0, y: 0.25, z: 0.6669 },
      { element: 'O', x: 0, y: 0.75, z: 0.3331 },
      { element: 'O', x: 0, y: 0.75, z: 0.9169 },
      { element: 'O', x: 0.5, y: 0.25, z: 0.4169 },
      { element: 'O', x: 0.5, y: 0.25, z: 0.8331 },
      { element: 'O', x: 0.5, y: 0.75, z: 0.1669 },
      { element: 'O', x: 0.5, y: 0.75, z: 0.5831 },
      { element: 'Ti', x: 0, y: 0.25, z: 0.875 },
      { element: 'Ti', x: 0, y: 0.75, z: 0.125 },
      { element: 'Ti', x: 0.5, y: 0.25, z: 0.625 },
      { element: 'Ti', x: 0.5, y: 0.75, z: 0.375 },
    ],
  },
  {
    id: 'zno',
    name: '氧化锌',
    formula: 'ZnO',
    description: '六方纤锌矿，P6₃mc；压电与光催化常用',
    spaceGroupNumber: 186,
    spaceGroupSymbol: 'P6_3mc',
    cell: { a: 3.2495, b: 3.2495, c: 5.2069, alpha: 90, beta: 90, gamma: 120 },
    atoms: [
      { element: 'O', x: 0.3333, y: 0.6667, z: 0.382 },
      { element: 'O', x: 0.6667, y: 0.3333, z: 0.882 },
      { element: 'Zn', x: 0.3333, y: 0.6667, z: 0 },
      { element: 'Zn', x: 0.6667, y: 0.3333, z: 0.5 },
    ],
  },
  {
    id: 'mg',
    name: '镁',
    formula: 'Mg',
    description: '六方密排，P6₃/mmc；密排面 (0001)',
    spaceGroupNumber: 194,
    spaceGroupSymbol: 'P6_3/mmc',
    cell: { a: 3.2094, b: 3.2094, c: 5.2409, alpha: 90, beta: 90, gamma: 120 },
    atoms: [
      { element: 'Mg', x: 0.3333, y: 0.6667, z: 0.25 },
      { element: 'Mg', x: 0.6667, y: 0.3333, z: 0.75 },
    ],
  },
  {
    id: 'srtio3',
    name: '钛酸锶',
    formula: 'SrTiO3',
    description: '立方钙钛矿，Pm-3m；氧化物外延与光催化模型体系',
    spaceGroupNumber: 221,
    spaceGroupSymbol: 'Pm-3m',
    cell: { a: 3.905, b: 3.905, c: 3.905, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'O', x: 0, y: 0.5, z: 0.5 },
      { element: 'O', x: 0.5, y: 0, z: 0.5 },
      { element: 'O', x: 0.5, y: 0.5, z: 0 },
      { element: 'Sr', x: 0, y: 0, z: 0 },
      { element: 'Ti', x: 0.5, y: 0.5, z: 0.5 },
    ],
  },
  {
    id: 'al',
    name: '铝',
    formula: 'Al',
    description: '面心立方，Fm-3m；XRD 常用内标之一',
    spaceGroupNumber: 225,
    spaceGroupSymbol: 'Fm-3m',
    cell: { a: 4.0495, b: 4.0495, c: 4.0495, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'Al', x: 0, y: 0, z: 0 },
      { element: 'Al', x: 0, y: 0.5, z: 0.5 },
      { element: 'Al', x: 0.5, y: 0, z: 0.5 },
      { element: 'Al', x: 0.5, y: 0.5, z: 0 },
    ],
  },
  {
    id: 'cu',
    name: '铜',
    formula: 'Cu',
    description: '面心立方，Fm-3m；Cu Kα 靶材金属',
    spaceGroupNumber: 225,
    spaceGroupSymbol: 'Fm-3m',
    cell: { a: 3.615, b: 3.615, c: 3.615, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'Cu', x: 0, y: 0, z: 0 },
      { element: 'Cu', x: 0, y: 0.5, z: 0.5 },
      { element: 'Cu', x: 0.5, y: 0, z: 0.5 },
      { element: 'Cu', x: 0.5, y: 0.5, z: 0 },
    ],
  },
  {
    id: 'au',
    name: '金',
    formula: 'Au',
    description: '面心立方，Fm-3m；纳米金颗粒常用',
    spaceGroupNumber: 225,
    spaceGroupSymbol: 'Fm-3m',
    cell: { a: 4.0786, b: 4.0786, c: 4.0786, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'Au', x: 0, y: 0, z: 0 },
      { element: 'Au', x: 0, y: 0.5, z: 0.5 },
      { element: 'Au', x: 0.5, y: 0, z: 0.5 },
      { element: 'Au', x: 0.5, y: 0.5, z: 0 },
    ],
  },
  {
    id: 'fe',
    name: 'α-铁',
    formula: 'Fe',
    description: '体心立方，Im-3m；BCC 密排方向 <111>',
    spaceGroupNumber: 229,
    spaceGroupSymbol: 'Im-3m',
    cell: { a: 2.8665, b: 2.8665, c: 2.8665, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'Fe', x: 0, y: 0, z: 0 },
      { element: 'Fe', x: 0.5, y: 0.5, z: 0.5 },
    ],
  },
  {
    id: 'cscl',
    name: '氯化铯',
    formula: 'CsCl',
    description: '简单立方点阵 + 双原子基元，Pm-3m',
    spaceGroupNumber: 221,
    spaceGroupSymbol: 'Pm-3m',
    cell: { a: 4.123, b: 4.123, c: 4.123, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'Cl', x: 0.5, y: 0.5, z: 0.5 },
      { element: 'Cs', x: 0, y: 0, z: 0 },
    ],
  },
  {
    id: 'mos2',
    name: '二硫化钼',
    formula: 'MoS2',
    description: '2H 相，P6₃/mmc；层状纳米材料',
    spaceGroupNumber: 194,
    spaceGroupSymbol: 'P6_3/mmc',
    cell: { a: 3.1604, b: 3.1604, c: 12.295, alpha: 90, beta: 90, gamma: 120 },
    atoms: [
      { element: 'Mo', x: 0.3333, y: 0.6667, z: 0.25 },
      { element: 'Mo', x: 0.6667, y: 0.3333, z: 0.75 },
      { element: 'S', x: 0.3333, y: 0.6667, z: 0.621 },
      { element: 'S', x: 0.3333, y: 0.6667, z: 0.879 },
      { element: 'S', x: 0.6667, y: 0.3333, z: 0.121 },
      { element: 'S', x: 0.6667, y: 0.3333, z: 0.379 },
    ],
  },
  {
    id: 'gaas',
    name: '砷化镓',
    formula: 'GaAs',
    description: '闪锌矿结构，F-43m；半导体',
    spaceGroupNumber: 216,
    spaceGroupSymbol: 'F-43m',
    cell: { a: 5.653, b: 5.653, c: 5.653, alpha: 90, beta: 90, gamma: 90 },
    atoms: [
      { element: 'As', x: 0.25, y: 0.25, z: 0.25 },
      { element: 'As', x: 0.25, y: 0.75, z: 0.75 },
      { element: 'As', x: 0.75, y: 0.25, z: 0.75 },
      { element: 'As', x: 0.75, y: 0.75, z: 0.25 },
      { element: 'Ga', x: 0, y: 0, z: 0 },
      { element: 'Ga', x: 0, y: 0.5, z: 0.5 },
      { element: 'Ga', x: 0.5, y: 0, z: 0.5 },
      { element: 'Ga', x: 0.5, y: 0.5, z: 0 },
    ],
  },
]

export function getPreset(id: string): StructurePreset | undefined {
  return STRUCTURE_PRESETS.find((p) => p.id === id)
}

export function presetToStructure(preset: StructurePreset): Structure {
  return {
    name: `${preset.name} (${preset.formula})`,
    cell: { ...preset.cell },
    atoms: preset.atoms.map((a) => ({ ...a })),
    spaceGroupNumber: preset.spaceGroupNumber,
    spaceGroupSymbol: preset.spaceGroupSymbol,
    source: 'preset',
  }
}
