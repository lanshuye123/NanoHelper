import { loadSpaceGroup } from '@/core/data/spacegroups'
import { simulateXrd } from '@/core/diffraction/xrd'
import { parseDif, blockToPattern } from '@/core/io/dif'
import type { Pattern } from '@/core/pipeline/types'
import { presetToStructure, STRUCTURE_PRESETS } from '@/data/presets'

export type SampleId = 'xrd-anatase' | 'raman-anatase' | 'tga' | 'ir' | 'dif-demo06'

export interface SampleInfo {
  id: SampleId
  title: string
  description: string
  tag: string
}

export const SAMPLES: SampleInfo[] = [
  {
    id: 'xrd-anatase',
    title: 'XRD · 锐钛矿 TiO₂',
    description: 'Cu Kα 理论谱 + Kα2 + 噪声，适合练习峰位与 Jade 导出',
    tag: '衍射',
  },
  {
    id: 'raman-anatase',
    title: 'Raman · 锐钛矿',
    description: '100–2000 cm⁻¹ 的五个特征峰，适合练习非衍射数据的坐标映射',
    tag: '光谱',
  },
  {
    id: 'tga',
    title: 'TGA · 两段失重',
    description: '温度–质量曲线，Y 有基线漂移，适合验证逆处理',
    tag: '热分析',
  },
  {
    id: 'ir',
    title: 'FTIR · 氧化物',
    description: '400–4000 cm⁻¹ 透过率，含 OH 与 M–O 吸收',
    tag: '光谱',
  },
  {
    id: 'dif-demo06',
    title: 'Jade DIF · DEMO06',
    description: '真实 Jade 拟合导出：Raw / Background / 3 个拟合峰 / Overall',
    tag: 'Jade',
  },
]

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function xrdSample(): Promise<{ pattern: Pattern; warnings: string[] }> {
  const group = await loadSpaceGroup(141)
  const structure = presetToStructure(STRUCTURE_PRESETS.find((p) => p.id === 'anatase')!)
  const rotations = group ? group.ops.map((o) => o.r) : []
  const simulated = simulateXrd(structure, rotations, {
    wavelength: 1.54056,
    twoThetaMin: 20,
    twoThetaMax: 80,
    step: 0.02,
    profile: 'pseudoVoigt',
    fwhm: 0.12,
    eta: 0.55,
    ka2: true,
    background: 30,
    scaleTo: 12000,
    zeroShift: 0.01,
  })
  const rng = mulberry32(20261023)
  const y = new Float64Array(simulated.x.length)
  for (let i = 0; i < y.length; i++) {
    const noise = (rng() - 0.5) * 2 * Math.sqrt(Math.max(simulated.y[i], 1)) * 1.2
    y[i] = Math.max(1, simulated.y[i] + noise)
  }
  return {
    pattern: {
      x: simulated.x,
      y,
      meta: {
        xLabel: '2θ',
        xUnit: '°',
        yLabel: 'Counts',
        yUnit: 'counts',
        wavelength: 1.54056,
        anode: 'Cu',
        sourceFile: 'anatase-simulated.xy',
        notes: '由 CrystalToolBox 的理论 XRD 模拟生成，并叠加了泊松噪声',
      },
    },
    warnings: simulated.warnings,
  }
}

function ramanSample(): { pattern: Pattern; warnings: string[] } {
  const rng = mulberry32(4210)
  const n = 3801
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const peaks: Array<[number, number, number]> = [
    [144, 8, 950],
    [197, 10, 140],
    [399, 12, 280],
    [513, 14, 360],
    [639, 12, 420],
  ]
  for (let i = 0; i < n; i++) {
    const xi = 100 + i * 0.5
    x[i] = xi
    let value = 120 + 0.035 * (xi - 100)
    for (const [center, width, amplitude] of peaks) {
      value += amplitude / (1 + ((xi - center) / width) ** 2)
    }
    value += (rng() - 0.5) * 6
    y[i] = Math.max(1, value)
  }
  return {
    pattern: {
      x,
      y,
      meta: {
        xLabel: 'Raman shift',
        xUnit: 'cm⁻¹',
        yLabel: 'Intensity',
        yUnit: 'a.u.',
        sourceFile: 'anatase-raman.csv',
        notes: '合成的锐钛矿 Raman 光谱，含 144/197/399/513/639 cm⁻¹ 特征峰',
      },
    },
    warnings: [],
  }
}

function tgaSample(): { pattern: Pattern; warnings: string[] } {
  const rng = mulberry32(7788)
  const n = 771
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const xi = 30 + i
    x[i] = xi
    const step1 = 11.5 / (1 + Math.exp(-(xi - 420) / 18))
    const step2 = 3.2 / (1 + Math.exp(-(xi - 650) / 30))
    y[i] = 100 - step1 - step2 + (rng() - 0.5) * 0.08
  }
  return {
    pattern: {
      x,
      y,
      meta: {
        xLabel: 'Temperature',
        xUnit: '°C',
        yLabel: 'Mass',
        yUnit: '%',
        sourceFile: 'tga-sample.csv',
        notes: '合成 TGA 曲线：约 420 °C 与 650 °C 两段失重',
      },
    },
    warnings: [],
  }
}

function irSample(): { pattern: Pattern; warnings: string[] } {
  const rng = mulberry32(9182)
  const n = 1801
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const peaks: Array<[number, number, number]> = [
    [3420, 120, 45],
    [1630, 60, 22],
    [620, 90, 55],
    [480, 40, 25],
  ]
  for (let i = 0; i < n; i++) {
    const xi = 400 + i * 2
    x[i] = xi
    let value = 92
    for (const [center, width, depth] of peaks) {
      value -= depth / (1 + ((xi - center) / width) ** 2)
    }
    value += (rng() - 0.5) * 0.6
    y[i] = Math.min(98, Math.max(1, value))
  }
  return {
    pattern: {
      x,
      y,
      meta: {
        xLabel: 'Wavenumber',
        xUnit: 'cm⁻¹',
        yLabel: 'Transmittance',
        yUnit: '%',
        sourceFile: 'ftir-sample.csv',
        notes: '合成 FTIR 透过率谱：OH (~3420)、水 (~1630) 与 M–O (~620) 吸收',
      },
    },
    warnings: [],
  }
}

async function difSample(): Promise<{ pattern: Pattern; warnings: string[] }> {
  const response = await fetch(`${import.meta.env.BASE_URL}samples/DEMO06.dif`)
  if (!response.ok) throw new Error('示例 DIF 文件未找到（public/samples/DEMO06.dif）')
  const text = await response.text()
  const dif = parseDif(text)
  const block = dif.blocks.find((b) => b.role === 'raw') ?? dif.blocks[0]
  return {
    pattern: blockToPattern(block),
    warnings: [...dif.warnings, ...block.warnings],
  }
}

export async function loadSample(id: SampleId): Promise<{ pattern: Pattern; title: string; warnings: string[] }> {
  const info = SAMPLES.find((s) => s.id === id)
  if (!info) throw new Error('未知示例')
  const result =
    id === 'xrd-anatase'
      ? await xrdSample()
      : id === 'raman-anatase'
        ? ramanSample()
        : id === 'tga'
          ? tgaSample()
          : id === 'ir'
            ? irSample()
            : await difSample()
  return { ...result, title: info.title }
}
