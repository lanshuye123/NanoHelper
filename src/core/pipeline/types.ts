export interface PatternMeta {
  xLabel: string
  xUnit: string
  yLabel: string
  yUnit: string
  wavelength?: number
  anode?: string
  sourceFile?: string
  /** optional free-form notes */
  notes?: string
}

export interface Pattern {
  x: Float64Array
  y: Float64Array
  meta: PatternMeta
}

export type StepType =
  | 'crop'
  | 'resample'
  | 'smooth'
  | 'background'
  | 'kalpha2'
  | 'normalize'
  | 'jade-map'
  | 'affine'

export type StepParams = Record<string, unknown>

export interface Step {
  id: string
  type: StepType
  enabled: boolean
  params: StepParams
  createdAt: string
}

export interface StepDefinition {
  type: StepType
  label: string
  description: string
  invertible: boolean
  /** lossy steps cannot be inverted from the processed data; they can only be recomputed from raw data */
  defaults: StepParams
  /** Resolve derived parameters (e.g. affine coefficients) from the current data. */
  resolve?(pattern: Pattern, params: StepParams): StepParams
  apply(pattern: Pattern, params: StepParams): Pattern
  invert?(pattern: Pattern, params: StepParams): Pattern
  summary(params: StepParams): string
  doc?: string
}

export interface ApplyIssue {
  stepId: string
  stepType: StepType
  message: string
}

export interface ApplyResult {
  pattern: Pattern
  issues: ApplyIssue[]
  /** Effective parameters after `resolve` (e.g. resolved Jade mapping). */
  resolved: Record<string, StepParams>
}

export function clonePattern(pattern: Pattern): Pattern {
  return {
    x: new Float64Array(pattern.x),
    y: new Float64Array(pattern.y),
    meta: { ...pattern.meta },
  }
}

export function makePattern(x: ArrayLike<number>, y: ArrayLike<number>, meta: PatternMeta): Pattern {
  return {
    x: new Float64Array(x),
    y: new Float64Array(y),
    meta: { ...meta },
  }
}

export function patternLength(pattern: Pattern): number {
  return Math.min(pattern.x.length, pattern.y.length)
}

export interface PatternRange {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  points: number
  stepMedian: number
}

export function patternRange(pattern: Pattern): PatternRange {
  const n = patternLength(pattern)
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  const steps: number[] = []
  for (let i = 0; i < n; i++) {
    const x = pattern.x[i]
    const y = pattern.y[i]
    if (Number.isFinite(x)) {
      if (x < xMin) xMin = x
      if (x > xMax) xMax = x
      if (i > 0) {
        const d = x - pattern.x[i - 1]
        if (Number.isFinite(d) && d > 0) steps.push(d)
      }
    }
    if (Number.isFinite(y)) {
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
    }
  }
  steps.sort((a, b) => a - b)
  return {
    xMin: Number.isFinite(xMin) ? xMin : NaN,
    xMax: Number.isFinite(xMax) ? xMax : NaN,
    yMin: Number.isFinite(yMin) ? yMin : NaN,
    yMax: Number.isFinite(yMax) ? yMax : NaN,
    points: n,
    stepMedian: steps.length ? steps[Math.floor(steps.length / 2)] : NaN,
  }
}
