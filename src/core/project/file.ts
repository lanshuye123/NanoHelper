import type { Pattern, PatternMeta, Step } from '@/core/pipeline/types'
import { STEP_DEFINITIONS } from '@/core/pipeline/steps'

export const PROJECT_SCHEMA = 'crystaltoolbox/project@1'

export interface ProjectSource {
  name: string
  fileName?: string
  format?: string
  notes?: string
}

export interface ProjectFile {
  schema: typeof PROJECT_SCHEMA
  name: string
  createdAt: string
  app: { name: string; version: string }
  source: ProjectSource
  pattern: {
    meta: PatternMeta
    x: number[]
    y: number[]
  }
  steps: Step[]
}

export function buildProjectFile(
  pattern: Pattern,
  source: ProjectSource,
  steps: readonly Step[],
  version: string,
  name?: string,
): ProjectFile {
  return {
    schema: PROJECT_SCHEMA,
    name: name ?? source.name ?? '未命名工程',
    createdAt: new Date().toISOString(),
    app: { name: 'CrystalToolBox', version },
    source,
    pattern: {
      meta: pattern.meta,
      x: Array.from(pattern.x),
      y: Array.from(pattern.y),
    },
    steps: steps.map((s) => ({ ...s, params: { ...s.params } })),
  }
}

export function serializeProjectFile(project: ProjectFile): string {
  return JSON.stringify(project)
}

export function parseProjectFile(text: string): {
  pattern: Pattern
  source: ProjectSource
  steps: Step[]
  name: string
} {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('工程文件不是有效的 JSON')
  }
  if (!data || typeof data !== 'object') throw new Error('工程文件格式无效')
  const project = data as Partial<ProjectFile>
  if (project.schema !== PROJECT_SCHEMA) {
    throw new Error(`不支持的工程版本：${String(project.schema)}`)
  }
  if (!project.pattern || !Array.isArray(project.pattern.x) || !Array.isArray(project.pattern.y)) {
    throw new Error('工程文件缺少数据点')
  }
  if (project.pattern.x.length !== project.pattern.y.length || project.pattern.x.length < 2) {
    throw new Error('工程文件中的 X/Y 点数不一致或过少')
  }
  const validSteps = Array.isArray(project.steps) ? project.steps : []
  const steps: Step[] = []
  for (const step of validSteps) {
    if (!step || typeof step !== 'object') continue
    if (!(step.type in STEP_DEFINITIONS)) continue
    steps.push({
      id: String(step.id ?? `${step.type}-${steps.length}`),
      type: step.type,
      enabled: step.enabled !== false,
      params: step.params ?? {},
      createdAt: step.createdAt ?? new Date().toISOString(),
    })
  }
  const meta: PatternMeta = {
    xLabel: project.pattern.meta?.xLabel ?? 'X',
    xUnit: project.pattern.meta?.xUnit ?? '',
    yLabel: project.pattern.meta?.yLabel ?? 'Intensity',
    yUnit: project.pattern.meta?.yUnit ?? 'a.u.',
    wavelength: project.pattern.meta?.wavelength,
    anode: project.pattern.meta?.anode,
    sourceFile: project.pattern.meta?.sourceFile,
    notes: project.pattern.meta?.notes,
  }
  return {
    pattern: {
      x: Float64Array.from(project.pattern.x),
      y: Float64Array.from(project.pattern.y),
      meta,
    },
    source: project.source ?? { name: project.name ?? '未命名工程' },
    steps,
    name: project.name ?? project.source?.name ?? '未命名工程',
  }
}
