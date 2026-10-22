import { estimateBackground, stripKalpha2, ensureUniform } from '@/core/num/background'
import { resampleLinear, trapezoidArea, minMax } from '@/core/num/interpolate'
import { movingAverage, savitzkyGolay } from '@/core/num/smooth'
import {
  applyMapping,
  computeJadeMapping,
  invertMapping,
  type AffineMapping,
  type JadeMapParams,
  DEFAULT_JADE_MAP,
} from '@/core/pipeline/jade'
import {
  clonePattern,
  makePattern,
  type Pattern,
  type Step,
  type StepDefinition,
  type StepParams,
  type StepType,
} from '@/core/pipeline/types'

function num(params: StepParams, key: string, fallback: number): number {
  const value = params[key]
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function str(params: StepParams, key: string, fallback: string): string {
  const value = params[key]
  return typeof value === 'string' && value ? value : fallback
}

function bool(params: StepParams, key: string, fallback: boolean): boolean {
  const value = params[key]
  return typeof value === 'boolean' ? value : fallback
}

function anchors(params: StepParams): Array<{ x: number; y: number }> {
  const raw = params.anchors
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (Array.isArray(item)) return { x: Number(item[0]), y: Number(item[1]) }
      if (item && typeof item === 'object') {
        const obj = item as { x?: unknown; y?: unknown }
        return { x: Number(obj.x), y: Number(obj.y) }
      }
      return { x: NaN, y: NaN }
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x)
}

function withY(pattern: Pattern, y: ArrayLike<number>): Pattern {
  return makePattern(pattern.x, y, pattern.meta)
}

const crop: StepDefinition = {
  type: 'crop',
  label: '裁剪区间',
  description: '保留指定 X 范围内的数据点，用于去除仪器边缘或无关区间。',
  invertible: false,
  defaults: { xMin: 10, xMax: 90 },
  apply(pattern, params) {
    const xMin = num(params, 'xMin', pattern.x[0])
    const xMax = num(params, 'xMax', pattern.x[pattern.x.length - 1])
    if (!(xMax > xMin)) throw new Error('裁剪上限必须大于下限')
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < pattern.x.length; i++) {
      if (pattern.x[i] >= xMin && pattern.x[i] <= xMax) {
        xs.push(pattern.x[i])
        ys.push(pattern.y[i])
      }
    }
    if (xs.length < 2) throw new Error('裁剪后数据点不足 2 个')
    return makePattern(xs, ys, pattern.meta)
  },
  summary: (p) => `${num(p, 'xMin', 0)} – ${num(p, 'xMax', 0)}`,
}

const resample: StepDefinition = {
  type: 'resample',
  label: '重采样',
  description: '重采样到均匀步长；用于后续假设等间距的算法（如 Kα2 剥离）。',
  invertible: false,
  defaults: { step: 0.02 },
  apply(pattern, params) {
    const step = num(params, 'step', 0.02)
    const result = resampleLinear(pattern.x, pattern.y, step)
    return makePattern(result.x, result.y, pattern.meta)
  },
  summary: (p) => `步长 ${num(p, 'step', 0)}`,
}

const smooth: StepDefinition = {
  type: 'smooth',
  label: '平滑',
  description: 'Savitzky–Golay 或滑动平均平滑；会损失高频信息，不可精确逆变换。',
  invertible: false,
  defaults: { method: 'sg', window: 11, order: 3 },
  apply(pattern, params) {
    const method = str(params, 'method', 'sg')
    const window = Math.max(3, Math.floor(num(params, 'window', 11)))
    const order = Math.max(1, Math.floor(num(params, 'order', 3)))
    if (method === 'moving') {
      return withY(pattern, movingAverage(pattern.y, window))
    }
    const odd = window % 2 === 0 ? window + 1 : window
    if (order >= odd) throw new Error('多项式阶数必须小于窗口长度')
    return withY(pattern, savitzkyGolay(pattern.y, odd, order))
  },
  summary: (p) =>
    str(p, 'method', 'sg') === 'moving'
      ? `滑动平均，窗口 ${num(p, 'window', 0)}`
      : `S–G，窗口 ${num(p, 'window', 0)}，阶数 ${num(p, 'order', 0)}`,
}

const background: StepDefinition = {
  type: 'background',
  label: '扣除背底',
  description: 'SNIP 自动背底，或通过锚点做线性/多项式背底。会损失信息，不可逆。',
  invertible: false,
  defaults: { method: 'snip', iterations: 40, order: 3, clipNegative: true, anchors: [] },
  apply(pattern, params) {
    const result = estimateBackground(pattern.x, pattern.y, {
      method: str(params, 'method', 'snip') as 'snip' | 'linear' | 'poly',
      iterations: num(params, 'iterations', 40),
      order: num(params, 'order', 3),
      clipNegative: bool(params, 'clipNegative', true),
      anchors: anchors(params),
    })
    return withY(pattern, result.corrected)
  },
  summary: (p) =>
    str(p, 'method', 'snip') === 'snip'
      ? `SNIP，${num(p, 'iterations', 0)} 次迭代`
      : `${str(p, 'method', 'snip') === 'linear' ? '线性' : '多项式'}背底，${anchors(p).length} 个锚点`,
}

const kalpha2: StepDefinition = {
  type: 'kalpha2',
  label: 'Kα2 剥离',
  description: 'Rachinger 方法去除 Kα2 卫星峰，使峰位更接近 Kα1。会改变峰形，不可逆。',
  invertible: false,
  defaults: { ka1: 1.54056, ka2: 1.54439, ratio: 0.5 },
  apply(pattern, params) {
    const ka1 = num(params, 'ka1', 1.54056)
    const ka2 = num(params, 'ka2', 1.54439)
    const ratio = num(params, 'ratio', 0.5)
    if (!(ka1 > 0 && ka2 > 0) || ka1 === ka2) throw new Error('Kα1/Kα2 波长无效')
    const uniform = ensureUniform(pattern.x, pattern.y)
    const stripped = stripKalpha2(uniform.x, uniform.y, ka1, ka2, ratio)
    return makePattern(uniform.x, stripped, pattern.meta)
  },
  summary: (p) => `λ₁=${num(p, 'ka1', 0).toFixed(5)}, λ₂=${num(p, 'ka2', 0).toFixed(5)}, 比例 ${num(p, 'ratio', 0)}`,
}

const normalize: StepDefinition = {
  type: 'normalize',
  label: '归一化',
  description: '按最大值、最小-最大或面积归一化；仅改变强度尺度。',
  invertible: false,
  defaults: { mode: 'max', target: 1 },
  apply(pattern, params) {
    const mode = str(params, 'mode', 'max')
    const target = num(params, 'target', 1)
    const n = pattern.x.length
    const y = new Float64Array(n)
    if (mode === 'area') {
      const area = trapezoidArea(pattern.x, pattern.y)
      if (!(area > 0)) throw new Error('曲线面积为零，无法归一化')
      for (let i = 0; i < n; i++) y[i] = (pattern.y[i] / area) * target
    } else if (mode === 'minmax') {
      const { min, max } = minMax(pattern.y)
      if (!(max > min)) throw new Error('强度没有动态范围，无法归一化')
      for (let i = 0; i < n; i++) y[i] = ((pattern.y[i] - min) / (max - min)) * target
    } else {
      const { max } = minMax(pattern.y)
      if (!(max > 0)) throw new Error('最大强度不为正，无法归一化')
      for (let i = 0; i < n; i++) y[i] = (pattern.y[i] / max) * target
    }
    return withY(pattern, y)
  },
  summary: (p) => `${str(p, 'mode', 'max')} → ${num(p, 'target', 1)}`,
}

const jadeMap: StepDefinition = {
  type: 'jade-map',
  label: 'Jade 坐标映射',
  description: '把数据映射到 Jade 可接受的范围（X 0–140，Y>0）；该步骤可逆。',
  invertible: true,
  defaults: { ...DEFAULT_JADE_MAP, anchors: undefined },
  resolve(pattern, params) {
    const mapping = computeJadeMapping(pattern, params as Partial<JadeMapParams>)
    return { ...params, mapping }
  },
  apply(pattern, params) {
    const mapping = params.mapping as AffineMapping | undefined
    if (!mapping) throw new Error('Jade 映射尚未解析')
    return applyMapping(pattern, mapping)
  },
  invert(pattern, params) {
    const mapping = params.mapping as AffineMapping | undefined
    if (!mapping) throw new Error('缺少映射系数，无法反算')
    return invertMapping(pattern, mapping)
  },
  summary: (p) => {
    const mapping = p.mapping as AffineMapping | undefined
    if (!mapping) return '待计算'
    return `x'=${mapping.xScale.toPrecision(5)}x${mapping.xOffset >= 0 ? '+' : ''}${mapping.xOffset.toPrecision(5)}`
  },
}

const affine: StepDefinition = {
  type: 'affine',
  label: '自定义仿射',
  description: '手动指定 x′ = ax + b、y′ = cy + d；可逆。',
  invertible: true,
  defaults: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
  apply(pattern, params) {
    const xScale = num(params, 'xScale', 1)
    const xOffset = num(params, 'xOffset', 0)
    const yScale = num(params, 'yScale', 1)
    const yOffset = num(params, 'yOffset', 0)
    const mapping: AffineMapping = {
      mode: 'affine',
      xScale,
      xOffset,
      yScale,
      yOffset,
      inputX: [pattern.x[0], pattern.x[pattern.x.length - 1]],
      inputY: [0, 0],
      outputX: [0, 0],
      outputY: [0, 0],
      warnings: [],
    }
    return applyMapping(pattern, mapping)
  },
  invert(pattern, params) {
    const mapping: AffineMapping = {
      mode: 'affine',
      xScale: num(params, 'xScale', 1),
      xOffset: num(params, 'xOffset', 0),
      yScale: num(params, 'yScale', 1),
      yOffset: num(params, 'yOffset', 0),
      inputX: [0, 0],
      inputY: [0, 0],
      outputX: [0, 0],
      outputY: [0, 0],
      warnings: [],
    }
    return invertMapping(pattern, mapping)
  },
  summary: (p) =>
    `x'=${num(p, 'xScale', 1)}x+${num(p, 'xOffset', 0)}; y'=${num(p, 'yScale', 1)}y+${num(p, 'yOffset', 0)}`,
}

export const STEP_DEFINITIONS: Record<StepType, StepDefinition> = {
  crop,
  resample,
  smooth,
  background,
  kalpha2,
  normalize,
  'jade-map': jadeMap,
  affine,
}

export const STEP_TYPES: StepType[] = [
  'crop',
  'resample',
  'smooth',
  'background',
  'kalpha2',
  'normalize',
  'jade-map',
  'affine',
]

let counter = 0
export function createStep(type: StepType, params: StepParams = {}): Step {
  const definition = STEP_DEFINITIONS[type]
  if (!definition) throw new Error(`未知步骤类型：${type}`)
  counter += 1
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `step-${Date.now()}-${counter}`
  return {
    id,
    type,
    enabled: true,
    params: { ...definition.defaults, ...params },
    createdAt: new Date().toISOString(),
  }
}

export function cloneSteps(steps: readonly Step[]): Step[] {
  return steps.map((s) => ({ ...s, params: { ...s.params } }))
}

export { clonePattern }
