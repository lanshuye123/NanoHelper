import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { applyPipeline, invertPipeline } from '@/core/pipeline/apply'
import { cloneSteps, createStep } from '@/core/pipeline/steps'
import { computeJadeMapping, type AffineMapping, type JadeMapParams } from '@/core/pipeline/jade'
import { validateForJade, type JadeIssue } from '@/core/pipeline/validate'
import { patternRange, type Pattern, type Step, type StepParams, type StepType } from '@/core/pipeline/types'
import { buildProjectFile, parseProjectFile, serializeProjectFile } from '@/core/project/file'
import { idbDelete, idbGet, idbSet } from '@/utils/idb'

export interface DatasetSource {
  name: string
  fileName?: string
  format?: string
  notes?: string
}

const PROJECT_RECORD_KEY = 'project:current'
const PROJECT_RECORD_VERSION = 1

interface PersistedProject {
  raw: { x: Float64Array; y: Float64Array; meta: Pattern['meta'] } | null
  source: DatasetSource | null
  steps: Step[]
}

interface ProjectEnvelope extends PersistedProject {
  version: number
  savedAt: number
}

function plainClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isPersistedProject(value: unknown): value is ProjectEnvelope {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<ProjectEnvelope>
  if (record.version !== PROJECT_RECORD_VERSION) return false
  if (record.raw !== null && (!record.raw || !record.raw.x || !record.raw.y)) return false
  if (!Array.isArray(record.steps)) return false
  return true
}

export const useProjectStore = defineStore('project', () => {
  const raw = shallowRef<Pattern | null>(null)
  const source = ref<DatasetSource | null>(null)
  const steps = ref<Step[]>([])
  const history = ref<Step[][]>([])
  const future = ref<Step[][]>([])
  const busy = ref(false)
  const persistedAt = ref<number | null>(null)
  const restoredFromStorage = ref(false)

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let hydrating = false
  let hydrateStarted = false

  const applyResult = computed(() => (raw.value ? applyPipeline(raw.value, steps.value) : null))
  const derived = computed(() => applyResult.value?.pattern ?? null)
  const issues = computed<JadeIssue[]>(() => (derived.value ? validateForJade(derived.value) : []))
  const hasData = computed(() => raw.value !== null)
  const range = computed(() => (raw.value ? patternRange(raw.value) : null))
  const derivedRange = computed(() => (derived.value ? patternRange(derived.value) : null))

  const jadeStep = computed(() => steps.value.find((s) => s.type === 'jade-map' && s.enabled) ?? null)

  /** Pattern immediately before the first enabled Jade mapping step. */
  const patternBeforeJade = computed<Pattern | null>(() => {
    if (!raw.value) return null
    const step = jadeStep.value
    if (!step) return derived.value
    const index = steps.value.findIndex((s) => s.id === step.id)
    const prefix = steps.value.slice(0, index)
    return applyPipeline(raw.value, prefix).pattern
  })

  const jadeMapping = computed<AffineMapping | null>(() => {
    if (!patternBeforeJade.value) return null
    const step = jadeStep.value
    const params = (step?.params ?? { mode: 'nonDiffraction' }) as Partial<JadeMapParams>
    try {
      return computeJadeMapping(patternBeforeJade.value, params)
    } catch {
      return null
    }
  })

  function plainPattern(pattern: Pattern): PersistedProject['raw'] {
    return {
      x: new Float64Array(pattern.x),
      y: new Float64Array(pattern.y),
      meta: plainClone(pattern.meta),
    }
  }

  function writeProjectNow() {
    if (!raw.value || !source.value) return
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const savedAt = Date.now()
    const payload: ProjectEnvelope = {
      version: PROJECT_RECORD_VERSION,
      savedAt,
      raw: plainPattern(raw.value),
      source: plainClone(source.value),
      steps: plainClone(steps.value),
    }
    void idbSet(PROJECT_RECORD_KEY, payload).then((ok) => {
      if (ok) persistedAt.value = savedAt
    })
  }

  function schedulePersist() {
    if (hydrating) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(writeProjectNow, 700)
  }

  async function restorePersisted() {
    if (hydrateStarted) return
    hydrateStarted = true
    const record = await idbGet<unknown>(PROJECT_RECORD_KEY)
    if (!isPersistedProject(record) || !record.raw) return
    if (raw.value || source.value) return
    hydrating = true
    try {
      raw.value = {
        x: record.raw.x instanceof Float64Array ? record.raw.x : new Float64Array(record.raw.x),
        y: record.raw.y instanceof Float64Array ? record.raw.y : new Float64Array(record.raw.y),
        meta: record.raw.meta,
      }
      source.value = record.source
      steps.value = record.steps
      history.value = []
      future.value = []
      persistedAt.value = record.savedAt
      restoredFromStorage.value = true
    } finally {
      hydrating = false
    }
  }

  watch(raw, schedulePersist)
  watch(source, schedulePersist, { deep: true })
  watch(steps, schedulePersist, { deep: true })

  function snapshot() {
    history.value.push(cloneSteps(steps.value))
    if (history.value.length > 60) history.value.shift()
    future.value = []
  }

  function loadPattern(pattern: Pattern, datasetSource: DatasetSource) {
    raw.value = {
      x: new Float64Array(pattern.x),
      y: new Float64Array(pattern.y),
      meta: { ...pattern.meta },
    }
    source.value = datasetSource
    steps.value = []
    history.value = []
    future.value = []
  }

  function clear() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    raw.value = null
    source.value = null
    steps.value = []
    history.value = []
    future.value = []
    persistedAt.value = null
    restoredFromStorage.value = false
    void idbDelete(PROJECT_RECORD_KEY)
  }

  function addStep(type: StepType, params: StepParams = {}) {
    snapshot()
    steps.value.push(createStep(type, params))
  }

  function updateStep(id: string, params: StepParams, record = false) {
    const step = steps.value.find((s) => s.id === id)
    if (!step) return
    if (record) snapshot()
    step.params = { ...step.params, ...params }
  }

  function replaceStepParams(id: string, params: StepParams) {
    const step = steps.value.find((s) => s.id === id)
    if (!step) return
    step.params = { ...params }
  }

  function toggleStep(id: string) {
    const step = steps.value.find((s) => s.id === id)
    if (!step) return
    snapshot()
    step.enabled = !step.enabled
  }

  function removeStep(id: string) {
    snapshot()
    steps.value = steps.value.filter((s) => s.id !== id)
  }

  function moveStep(id: string, direction: -1 | 1) {
    const index = steps.value.findIndex((s) => s.id === id)
    if (index < 0) return
    const target = index + direction
    if (target < 0 || target >= steps.value.length) return
    snapshot()
    const copy = [...steps.value]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    steps.value = copy
  }

  function duplicateStep(id: string) {
    const step = steps.value.find((s) => s.id === id)
    if (!step) return
    snapshot()
    steps.value.push(createStep(step.type, { ...step.params }))
  }

  function undo() {
    const previous = history.value.pop()
    if (!previous) return
    future.value.push(cloneSteps(steps.value))
    steps.value = previous
  }

  function redo() {
    const next = future.value.pop()
    if (!next) return
    history.value.push(cloneSteps(steps.value))
    steps.value = next
  }

  function exportProject(version: string): string {
    if (!raw.value || !source.value) throw new Error('没有可保存的数据')
    return serializeProjectFile(buildProjectFile(raw.value, source.value, steps.value, version))
  }

  function importProject(text: string) {
    const parsed = parseProjectFile(text)
    raw.value = {
      x: new Float64Array(parsed.pattern.x),
      y: new Float64Array(parsed.pattern.y),
      meta: { ...parsed.pattern.meta },
    }
    source.value = { ...parsed.source, name: parsed.name }
    steps.value = parsed.steps
    history.value = []
    future.value = []
  }

  function resetSteps() {
    if (!steps.value.length) return
    snapshot()
    steps.value = []
  }

  /** Export the current derived curve back through the reversible steps. */
  function invertCurrent(): { pattern: Pattern | null; skipped: string[] } {
    if (!derived.value) return { pattern: null, skipped: [] }
    return invertPipeline(derived.value, steps.value, applyResult.value?.resolved ?? {})
  }

  return {
    raw,
    source,
    steps,
    history,
    future,
    busy,
    applyResult,
    derived,
    issues,
    hasData,
    range,
    derivedRange,
    jadeStep,
    jadeMapping,
    patternBeforeJade,
    persistedAt,
    restoredFromStorage,
    restorePersisted,
    loadPattern,
    clear,
    addStep,
    updateStep,
    replaceStepParams,
    toggleStep,
    removeStep,
    moveStep,
    duplicateStep,
    undo,
    redo,
    resetSteps,
    invertCurrent,
    exportProject,
    importProject,
  }
})
