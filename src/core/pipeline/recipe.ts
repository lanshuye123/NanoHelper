import type { Pattern, Step, StepParams } from '@/core/pipeline/types'
import type { AffineMapping } from '@/core/pipeline/jade'

export const RECIPE_SCHEMA = 'crystaltoolbox/recipe@1'

export interface RecipeStep {
  type: string
  enabled: boolean
  params: StepParams
}

export interface Recipe {
  schema: typeof RECIPE_SCHEMA
  name: string
  createdAt: string
  source: {
    file?: string
    xLabel: string
    xUnit: string
    yLabel: string
    yUnit: string
    wavelength?: number
    anode?: string
    points: number
    xRange: [number, number]
    yRange: [number, number]
  }
  steps: RecipeStep[]
  mapping?: AffineMapping
  checksum: string
  app: { name: string; version: string }
}

/** FNV-1a hash over the numeric data, used to detect recipe/data mismatch. */
export function hashPattern(pattern: Pattern): string {
  let hash = 0x811c9dc5
  const view = new DataView(new ArrayBuffer(8))
  const mix = (value: number) => {
    view.setFloat64(0, value, true)
    for (let i = 0; i < 8; i++) {
      hash ^= view.getUint8(i)
      hash = Math.imul(hash, 0x01000193)
    }
  }
  const n = Math.min(pattern.x.length, pattern.y.length)
  mix(n)
  for (let i = 0; i < n; i++) {
    mix(pattern.x[i])
    mix(pattern.y[i])
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export interface BuildRecipeOptions {
  name: string
  version: string
  mapping?: AffineMapping
  resolved?: Record<string, StepParams>
}

export function buildRecipe(pattern: Pattern, steps: readonly Step[], options: BuildRecipeOptions): Recipe {
  const enabled = steps.filter((s) => s.enabled)
  return {
    schema: RECIPE_SCHEMA,
    name: options.name,
    createdAt: new Date().toISOString(),
    source: {
      file: pattern.meta.sourceFile,
      xLabel: pattern.meta.xLabel,
      xUnit: pattern.meta.xUnit,
      yLabel: pattern.meta.yLabel,
      yUnit: pattern.meta.yUnit,
      wavelength: pattern.meta.wavelength,
      anode: pattern.meta.anode,
      points: pattern.x.length,
      xRange: [pattern.x[0], pattern.x[pattern.x.length - 1]],
      yRange: [
        pattern.y.reduce((m, v) => Math.min(m, v), Infinity),
        pattern.y.reduce((m, v) => Math.max(m, v), -Infinity),
      ],
    },
    steps: enabled.map((step) => ({
      type: step.type,
      enabled: true,
      params: pruneParams(step, options.resolved?.[step.id] ?? step.params),
    })),
    mapping: options.mapping,
    checksum: hashPattern(pattern),
    app: { name: 'CrystalToolBox', version: options.version },
  }
}

function pruneParams(step: Step, params: StepParams): StepParams {
  const out: StepParams = { ...params }
  // The resolved mapping is authoritative; keep the UI parameters for editing.
  if (step.type === 'jade-map' && out.mapping) {
    out.mapping = out.mapping
  }
  return out
}

export function serializeRecipe(recipe: Recipe): string {
  return JSON.stringify(recipe, null, 2)
}

export function parseRecipe(text: string): Recipe {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('配方不是有效的 JSON')
  }
  if (!data || typeof data !== 'object') throw new Error('配方格式无效')
  const recipe = data as Partial<Recipe>
  if (recipe.schema !== RECIPE_SCHEMA) {
    throw new Error(`不支持的配方版本：${String(recipe.schema)}`)
  }
  if (!Array.isArray(recipe.steps)) throw new Error('配方缺少 steps')
  return recipe as Recipe
}

/** Inverse of a resolved Jade mapping for a whole curve. */
export function invertWithRecipe(pattern: Pattern, recipe: Recipe): Pattern {
  const mapping = recipe.mapping
  if (!mapping) throw new Error('该配方没有 Jade 映射系数，无法反算')
  const n = Math.min(pattern.x.length, pattern.y.length)
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    x[i] = (pattern.x[i] - mapping.xOffset) / mapping.xScale
    y[i] = (pattern.y[i] - mapping.yOffset) / mapping.yScale
  }
  return {
    x,
    y,
    meta: {
      xLabel: recipe.source.xLabel,
      xUnit: recipe.source.xUnit,
      yLabel: recipe.source.yLabel,
      yUnit: recipe.source.yUnit,
      wavelength: recipe.source.wavelength,
      anode: recipe.source.anode,
    },
  }
}
