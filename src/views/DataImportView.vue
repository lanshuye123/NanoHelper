<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardPaste,
  Database,
  Download,
  FileOutput,
  FlaskConical,
  GitBranch,
  Grid3x3,
  FolderOpen,
  Lightbulb,
  LineChart,
  Map,
  Minus,
  Scaling,
  Scissors,
  Waves,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Undo2,
  Upload,
} from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import PanelCard from '@/components/common/PanelCard.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import IssueList from '@/components/common/IssueList.vue'
import SciChart, { type ChartSeries } from '@/components/chart/SciChart.vue'
import StepCard from '@/components/pipeline/StepCard.vue'
import { useProjectStore } from '@/stores/project'
import { STEP_DEFINITIONS, STEP_TYPES } from '@/core/pipeline/steps'
import type { StepParams, StepType } from '@/core/pipeline/types'
import { importDataFile, importDataText, inferMeta, patternFromColumns, type ImportResult } from '@/services/importData'
import { loadSample, SAMPLES, type SampleId } from '@/data/samples'
import { ANODES } from '@/core/diffraction/scattering'
import { applyMapping, jadeModeDefaults } from '@/core/pipeline/jade'
import { downloadText, readFileText, safeFilename } from '@/utils/download'
import { useCommands } from '@/composables/useCommands'
import { useToolDraft } from '@/composables/useToolDraft'
import SparkLine from '@/components/ui/SparkLine.vue'
import type { DrawerState } from '@/components/tool/types'

const project = useProjectStore()
const router = useRouter()
const { register, unregister } = useCommands()

const drawer = ref<DrawerState>('closed')
const inlineError = ref('')

const pending = ref<ImportResult | null>(null)
const samplesOpen = ref(false)
const xCol = ref(0)
const yCol = ref(1)
const pasteOpen = ref(false)
const pasteText = ref('')
const importing = ref(false)
const projectInput = ref<HTMLInputElement | null>(null)

const draft = useToolDraft({
  toolId: 'data-import',
  defaults: () => ({ xCol: 0, yCol: 1 }),
  snapshot: () => ({ xCol: xCol.value, yCol: yCol.value }),
  restore: (data) => {
    xCol.value = Math.max(0, Math.round(data.xCol))
    yCol.value = Math.max(0, Math.round(data.yCol))
  },
})

function resetAll() {
  draft.reset()
  pending.value = null
  inlineError.value = ''
}

async function clearData() {
  try {
    await ElMessageBox.confirm('将清空当前数据与全部处理步骤；Jade 导出、DIF 等页面也会失去当前数据。确定继续？', '清空数据', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  project.clear()
  pending.value = null
  activeStepId.value = null
  samplesOpen.value = false
  inlineError.value = ''
  ElMessage.success('已清空当前数据')
}

async function clearPage() {
  try {
    await ElMessageBox.confirm(
      '将清空当前数据、处理步骤、列映射和本页自动保存记录；Jade 导出、DIF 等页面也会失去当前数据。确定继续？',
      '清空本页',
      { confirmButtonText: '清空', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  project.clear()
  draft.clear()
  pending.value = null
  activeStepId.value = null
  samplesOpen.value = false
  pasteText.value = ''
  pasteOpen.value = false
  inlineError.value = ''
  ElMessage.success('已清空本页')
}

const hasData = computed(() => project.hasData && project.derived)
const steps = computed(() => project.steps)

const stats = computed(() => {
  const range = project.derivedRange
  if (!range) return null
  return [
    { label: '数据点', value: range.points.toLocaleString(), unit: 'pts' },
    {
      label: 'X 范围',
      value: `${range.xMin.toFixed(2)} – ${range.xMax.toFixed(2)}`,
      unit: project.derived?.meta.xUnit,
    },
    { label: '中位步长', value: range.stepMedian.toPrecision(4), unit: project.derived?.meta.xUnit },
    { label: '最大强度', value: range.yMax.toPrecision(6), unit: project.derived?.meta.yUnit },
  ]
})

/** 图谱显示模式：原始 + 处理对比，或仅看处理后曲线。 */
const chartMode = ref<'both' | 'processed'>('both')
const chartRef = ref<{ reset: () => void; exportPNG: (filename?: string) => void } | null>(null)

const chartSeries = computed<ChartSeries[]>(() => {
  const series: ChartSeries[] = []
  const mapping = project.jadeMapping
  const input = project.jadeStep ? project.patternBeforeJade : project.raw
  const compared = input && mapping ? applyMapping(input, mapping) : input
  const showInput = chartMode.value === 'both' && project.steps.some((s) => s.enabled && s.type !== 'jade-map')
  if (compared && showInput) {
    series.push({
      label: mapping ? '映射输入' : '原始',
      x: compared.x,
      y: compared.y,
      color: '#8ba0b8',
      width: 1,
      opacity: 0.55,
      type: 'line',
    })
  }
  if (project.derived) {
    series.push({
      label: '处理后',
      x: project.derived.x,
      y: project.derived.y,
      color: '#3b9fdd',
      width: 1.6,
      type: 'line',
      fill: true,
    })
  }
  return series
})

const addStepItems = STEP_TYPES.map((type) => ({
  type,
  label: STEP_DEFINITIONS[type].label,
  description: STEP_DEFINITIONS[type].description,
}))

const summaryText = computed(() => {
  const range = project.derivedRange
  if (!range) return '尚未载入数据。'
  const meta = project.derived?.meta
  const xUnit = meta?.xUnit ?? ''
  const yUnit = meta?.yUnit ?? ''
  return [
    `文件      ${project.source?.name ?? '未命名'}`,
    `格式      ${project.source?.format ?? '—'}`,
    `数据点    ${range.points.toLocaleString()}`,
    `X 范围    ${range.xMin.toFixed(3)} – ${range.xMax.toFixed(3)} ${xUnit}`.trimEnd(),
    `中位步长  ${range.stepMedian.toPrecision(5)} ${xUnit}`.trimEnd(),
    `最大强度  ${range.yMax.toPrecision(6)} ${yUnit}`.trimEnd(),
    `处理步骤  ${project.steps.length}`,
  ].join('\n')
})

function run() {
  if (!hasData.value) return
  drawer.value = 'half'
}

async function copySummary() {
  try {
    await navigator.clipboard.writeText(summaryText.value)
    ElMessage.success('已复制数据摘要')
  } catch {
    inlineError.value = '复制失败，请手动选择文本'
  }
}

function registerCommands() {
  register('data-import', [
    {
      id: 'import:clear',
      label: '清空当前数据',
      hint: '移除已导入的数据与处理步骤',
      disabled: !project.hasData,
      run: () => project.clear(),
    },
    { id: 'import:copy', label: '复制数据摘要', disabled: !hasData.value, run: copySummary },
    { id: 'import:jade', label: '前往 Jade 导出', disabled: !hasData.value, run: goJade },
  ])
}

onMounted(registerCommands)
watch([() => project.hasData, () => project.steps.length], registerCommands)
onBeforeUnmount(() => unregister('data-import'))

const SPARK_VARIANTS: Record<string, 'diffraction' | 'spectrum' | 'thermal' | 'fit'> = {
  'xrd-anatase': 'diffraction',
  'raman-anatase': 'spectrum',
  tga: 'thermal',
  ir: 'spectrum',
  'dif-demo06': 'fit',
}

const SPARK_COLORS: Record<string, string> = {
  'xrd-anatase': 'var(--plot-1)',
  'raman-anatase': 'var(--plot-3)',
  tga: 'var(--plot-2)',
  ir: 'var(--plot-5)',
  'dif-demo06': 'var(--plot-4)',
}

const activeStepId = ref<string | null>(null)
const activeStep = computed(() => steps.value.find((step) => step.id === activeStepId.value) ?? null)

const tablePage = ref(0)
const pageSize = ref(10)

watch(
  () => [project.derived?.x.length ?? 0, pageSize.value] as const,
  () => {
    tablePage.value = 0
  },
)

const totalPages = computed(() => {
  const total = project.derived?.x.length ?? 0
  return Math.max(1, Math.ceil(total / pageSize.value))
})

const pageList = computed<(number | '…')[]>(() => {
  const total = totalPages.value
  const current = tablePage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const pages: (number | '…')[] = [0]
  if (current > 2) pages.push('…')
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) pages.push(i)
  if (current < total - 3) pages.push('…')
  pages.push(total - 1)
  return pages
})

const previewRows = computed(() => {
  const pattern = project.derived
  if (!pattern) return []
  const start = tablePage.value * pageSize.value
  const sameLength = project.raw?.y.length === pattern.y.length
  return Array.from(pattern.x.slice(start, start + pageSize.value)).map((x, i) => {
    const index = start + i
    return {
      index: index + 1,
      x,
      y: pattern.y[index] ?? 0,
      raw: sameLength ? (project.raw?.y[index] ?? null) : null,
    }
  })
})

/** Cheap local-maximum peak search used for the summary card. */
const peaks = computed(() => {
  const pattern = project.derived
  if (!pattern || pattern.y.length < 5) return []
  let max = -Infinity
  for (const value of pattern.y) if (value > max) max = value
  const floor = max * 0.08
  const found: { x: number; y: number }[] = []
  for (let i = 1; i < pattern.y.length - 1; i++) {
    const value = pattern.y[i]!
    if (value > pattern.y[i - 1]! && value >= pattern.y[i + 1]! && value > floor) {
      found.push({ x: pattern.x[i]!, y: value })
    }
  }
  return found.sort((a, b) => b.y - a.y).slice(0, 8)
})

const topPeaks = computed(() => peaks.value.slice(0, 5))

const sourceBadge = computed(() => (project.source?.format === '示例数据' ? '示例数据' : ''))

function openSummary() {
  if (hasData.value) drawer.value = 'half'
}

function stepLabel(step: { type: StepType }): string {
  return STEP_DEFINITIONS[step.type]?.label ?? step.type
}

function removeActiveStep() {
  const step = activeStep.value
  if (!step) return
  project.removeStep(step.id)
  activeStepId.value = null
}

const pointsText = computed(() => (project.derived?.x.length ?? 0).toLocaleString())

const rangeText = computed(() => {
  const range = project.derivedRange
  if (!range) return '—'
  return `${range.xMin.toFixed(2)} – ${range.xMax.toFixed(2)}`
})

const maxText = computed(() => {
  const range = project.derivedRange
  return range ? range.yMax.toPrecision(6) : '—'
})

const jadeStatusText = computed(() => {
  if (!hasData.value) return '—'
  return project.jadeStep ? '已映射' : '未映射'
})

function peakRel(index: number): string {
  const top = peaks.value[0]?.y ?? 1
  return `${((peaks.value[index]!.y / top) * 100).toFixed(1)}`
}

const stepSizeText = computed(() => {
  const range = project.derivedRange
  return range ? range.stepMedian.toPrecision(3) : '—'
})

function exportXyFile() {
  const pattern = project.derived
  if (!pattern) return
  const name = `${project.source?.name ?? 'data'}.xy`
  const lines = Array.from(pattern.x).map((x, i) => `${x.toFixed(5)} ${(pattern.y[i] ?? 0).toFixed(5)}`)
  downloadText(lines.join('\n'), name, 'text/plain;charset=us-ascii')
  ElMessage.success(`已导出 ${name}`)
}

function exportCsvFile() {
  const pattern = project.derived
  if (!pattern) return
  const name = `${project.source?.name ?? 'data'}.csv`
  const lines = ['x,y', ...Array.from(pattern.x).map((x, i) => `${x},${pattern.y[i] ?? 0}`)]
  downloadText(lines.join('\n'), name, 'text/csv')
  ElMessage.success(`已导出 ${name}`)
}

function stepIcon(type: StepType) {
  const icons: Record<string, unknown> = {
    crop: Scissors,
    smooth: Waves,
    background: Minus,
    normalize: Scaling,
    kalpha2: GitBranch,
    'jade-map': Map,
  }
  return (icons[type] as typeof Upload) ?? Activity
}

function defaultParams(type: StepType): StepParams {
  const range = project.range
  if (type === 'crop' && range) {
    return { xMin: Number(range.xMin.toFixed(4)), xMax: Number(range.xMax.toFixed(4)) }
  }
  if (type === 'jade-map') {
    const isDiffraction = !!range && range.xMin >= 0 && range.xMax <= 140
    const mode = isDiffraction ? 'diffraction' : 'nonDiffraction'
    return { mode, ...jadeModeDefaults(mode) }
  }
  if (type === 'kalpha2') {
    const anode = ANODES.find((a) => a.id === project.raw?.meta.anode) ?? ANODES[0]
    return { ka1: anode.ka1, ka2: anode.ka2, ratio: 0.5 }
  }
  return {}
}

function addStep(type: StepType) {
  project.addStep(type, defaultParams(type))
  const added = project.steps[project.steps.length - 1]
  if (added) {
    activeStepId.value = added.id
  }
}

function onAddStepCommand(command: string) {
  addStep(command as StepType)
}

async function handleFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  importing.value = true
  try {
    const result = await importDataFile(file)
    applyImport(result)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    importing.value = false
  }
}

function applyImport(result: ImportResult) {
  if (!result.pattern) {
    ElMessage.error('未能从文件中解析出数据')
    return
  }
  pending.value = result.kind === 'table' ? result : null
  xCol.value = 0
  yCol.value = 1
  project.loadPattern(result.pattern, {
    name: result.fileName.replace(/\.[^.]+$/, ''),
    fileName: result.fileName,
    format: result.format,
    notes: result.warnings.join('；'),
  })
  if (result.warnings.length) {
    ElMessage.warning(`已导入，但有 ${result.warnings.length} 条提示：${result.warnings[0]}`)
  } else {
    ElMessage.success(`已导入 ${result.format} 数据`)
  }
}

function applyColumns() {
  if (!pending.value?.columns || !pending.value.pattern) return
  if (xCol.value === yCol.value) {
    ElMessage.warning('X 列与 Y 列不能相同')
    return
  }
  const columns = pending.value.columns
  const x = columns[xCol.value] ?? []
  const y = columns[yCol.value] ?? []
  const meta = inferMeta(
    [pending.value.headers[xCol.value] ?? '', pending.value.headers[yCol.value] ?? ''],
    x,
    y,
    pending.value.fileName,
  )
  const pattern = patternFromColumns(columns, xCol.value, yCol.value, meta)
  project.loadPattern(pattern, {
    name: pending.value.fileName.replace(/\.[^.]+$/, ''),
    fileName: pending.value.fileName,
    format: pending.value.format,
  })
  ElMessage.success(`已使用第 ${xCol.value + 1}/${yCol.value + 1} 列重建数据`)
}

async function loadSampleData(id: SampleId) {
  importing.value = true
  try {
    const sample = await loadSample(id)
    project.loadPattern(sample.pattern, { name: sample.title, format: '示例数据' })
    activeStepId.value = null
    samplesOpen.value = false
    ElMessage.success(`已载入示例：${sample.title}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    importing.value = false
  }
}

function pasteImport() {
  if (!pasteText.value.trim()) return
  try {
    const result = importDataText(pasteText.value, 'pasted.txt')
    applyImport(result)
    pasteOpen.value = false
    pasteText.value = ''
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

function setStepParams(id: string, params: StepParams) {
  project.updateStep(id, params)
}

async function resetSteps() {
  if (!project.steps.length) return
  try {
    await ElMessageBox.confirm('清空所有处理步骤，回到原始数据？', '重置步骤', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
    project.resetSteps()
  } catch {
    /* cancelled */
  }
}

function goJade() {
  router.push('/data/jade')
}

function saveProject() {
  try {
    const content = project.exportProject('0.1.0')
    downloadText(content, safeFilename(project.source?.name ?? 'project', 'xtalbox.json'), 'application/json')
    ElMessage.success('工程已保存（含原始数据与步骤）')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function openProject(files: File[]) {
  const file = files[0]
  if (!file) return
  try {
    if (project.hasData) {
      await ElMessageBox.confirm('打开工程会替换当前数据与步骤，继续？', '打开工程', {
        confirmButtonText: '替换',
        cancelButtonText: '取消',
        type: 'warning',
      })
    }
    const { text } = await readFileText(file)
    project.importProject(text)
    pending.value = null
    activeStepId.value = null
    samplesOpen.value = false
    ElMessage.success('工程已载入')
  } catch (error) {
    if (error === 'cancel') return
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <div class="tool-root">
    <ToolPage
      tool-id="data-import"
      title="XRD 数据预处理"
      subtitle="导入数据、调整参数、进行背景扣除与平滑处理，生成处理后的衍射图谱。"
      :badge="sourceBadge"
      :chart-frame="false"
      doc="/docs/userguide/data-import"
      v-model:result-state="drawer"
      result-title="预处理结果"
      :saved-at="Math.max(draft.savedAt ?? 0, project.persistedAt ?? 0) || null"
      :restored="draft.restored || project.restoredFromStorage"
      :state-error="draft.error"
      @reset="resetAll"
      @clear="clearPage"
    >
      <!-- 顶部全局操作 -->
      <template #actions>
        <button type="button" class="btn" :disabled="!project.history.length" @click="project.undo()">
          <Undo2 /> 撤销
        </button>
        <button type="button" class="btn" :disabled="!hasData" @click="saveProject">
          <Save /> 保存工程
        </button>
        <button type="button" class="btn btn--primary" :disabled="!hasData" @click="goJade">
          <Download /> 导出结果
        </button>
      </template>

      <!-- 左侧：数据与操作 -->
      <template #steps>
        <section class="panel ops-panel">
          <div class="panel__head">
            <h2 class="panel__title"><SlidersHorizontal /> 数据与操作</h2>
            <span class="panel__hint">{{ steps.length }} 个步骤</span>
          </div>

          <div class="panel__body ops-body">
            <ol class="flow">
              <li class="flow__item" :class="{ 'is-active': activeStepId === null }">
                <button type="button" class="flow__btn" @click="activeStepId = null">
                  <span class="flow__icon" :class="hasData ? 'is-ok' : 'is-on'">
                    <Check v-if="hasData" />
                    <Upload v-else />
                  </span>
                  <span class="flow__main">
                    <span class="flow__label">数据导入</span>
                    <span class="flow__sub">{{ project.source?.fileName ?? '拖入文件或选择示例' }}</span>
                  </span>
                  <span class="flow__state">{{ hasData ? '已处理' : '待导入' }}</span>
                  <ChevronRight class="flow__arrow" />
                </button>
              </li>

              <li
                v-for="step in steps"
                :key="step.id"
                class="flow__item"
                :class="{ 'is-active': activeStepId === step.id }"
              >
                <button type="button" class="flow__btn" @click="activeStepId = step.id">
                  <span class="flow__icon" :class="step.enabled ? 'is-on' : 'is-idle'">
                    <component :is="stepIcon(step.type)" />
                  </span>
                  <span class="flow__main">
                    <span class="flow__label">{{ stepLabel(step) }}</span>
                    <span class="flow__sub">{{ step.enabled ? '已应用' : '未开启' }}</span>
                  </span>
                  <span class="flow__state" :class="{ 'is-done': step.enabled }">
                    {{ step.enabled ? '已处理' : '未处理' }}
                  </span>
                  <ChevronRight class="flow__arrow" />
                </button>
              </li>

              <li class="flow__item flow__item--add">
                <el-dropdown trigger="click" :disabled="!hasData" @command="onAddStepCommand">
                  <button type="button" class="flow__add" :disabled="!hasData">
                    <Plus /> 添加步骤
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-for="item in addStepItems" :key="item.type" :command="item.type">
                        <div class="step-menu-item">
                          <span>{{ item.label }}</span>
                          <span class="tiny dim">{{ item.description.slice(0, 28) }}</span>
                        </div>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </li>
            </ol>
          </div>
        </section>
      </template>

      <!-- 左侧：数据源与示例 -->
      <template #params>
        <section v-if="activeStep" class="panel params-panel">
          <div class="panel__head">
            <h2 class="panel__title"><Settings2 /> {{ stepLabel(activeStep) }}参数</h2>
            <button type="button" class="panel__link" @click="activeStepId = null">数据源</button>
          </div>
          <div class="panel__body params-panel__body">
            <StepCard
              :step="activeStep"
              :index="steps.findIndex((item) => item.id === (activeStep?.id ?? ''))"
              :total="steps.length"
              @update:params="setStepParams(activeStep?.id ?? '', $event)"
              @toggle="project.toggleStep(activeStep?.id ?? '')"
              @remove="removeActiveStep"
              @move="project.moveStep(activeStep?.id ?? '', $event)"
              @duplicate="project.duplicateStep(activeStep?.id ?? '')"
            />
            <details class="params-advanced">
              <summary>高级选项</summary>
              <div class="params-advanced__body">
                <button type="button" class="btn btn--quiet" :disabled="!steps.length" @click="resetSteps">
                  <RotateCcw /> 重置步骤
                </button>
                <button type="button" class="btn btn--quiet" :disabled="!project.hasData" @click="clearData">
                  清空数据
                </button>
              </div>
            </details>
          </div>
        </section>

        <section v-else class="panel source-panel">
          <div class="panel__head">
            <h2 class="panel__title"><Database /> 数据源</h2>
            <span class="panel__hint">{{ hasData ? '已载入' : '等待文件' }}</span>
          </div>
          <div class="panel__body">
            <div v-if="project.source" class="source-line">
              <span class="source-line__name">{{ project.source.name }}</span>
              <span class="tag mono">{{ project.source.format ?? '数据' }}</span>
              <span v-if="project.range" class="tag mono">{{ project.range.points.toLocaleString() }} pts</span>
            </div>

            <FileDrop
              v-if="!hasData"
              accept=".csv,.tsv,.txt,.xy,.dat,.dif,.xrdml,.uxd,.asc"
              title="拖入数据文件，或点击选择"
              hint="CSV / TSV / TXT / XY / DAT / DIF / XRDML / UXD"
              @files="handleFiles"
            />

            <div class="source-actions">
              <button type="button" class="btn btn--quiet" @click="pasteOpen = true">
                <ClipboardPaste /> 粘贴文本
              </button>
              <button type="button" class="btn btn--quiet" :disabled="!project.hasData" @click="saveProject">
                <Save /> 保存工程
              </button>
              <button type="button" class="btn btn--quiet" @click="projectInput?.click()">
                <FolderOpen /> 打开工程
              </button>
              <button type="button" class="btn btn--quiet" :disabled="!project.hasData" @click="clearData">
                清空
              </button>
            </div>

            <input
              ref="projectInput"
              type="file"
              accept=".json,.xtalbox"
              hidden
              @change="
                ($event) => {
                  const f = ($event.target as HTMLInputElement).files?.[0]
                  if (f) openProject([f])
                  ;($event.target as HTMLInputElement).value = ''
                }
              "
            />

            <details class="samples" :open="samplesOpen" @toggle="samplesOpen = ($event.target as HTMLDetailsElement).open">
              <summary class="samples__summary">示例数据 <span>{{ SAMPLES.length }} 组</span></summary>
              <div class="sample-list">
                <button
                  v-for="sample in SAMPLES"
                  :key="sample.id"
                  type="button"
                  class="sample-row"
                  :disabled="importing"
                  @click="loadSampleData(sample.id)"
                >
                  <SparkLine
                    :variant="SPARK_VARIANTS[sample.id] ?? 'diffraction'"
                    :color="SPARK_COLORS[sample.id] ?? 'var(--plot-1)'"
                  />
                  <span class="sample-row__body">
                    <span class="sample-row__title">{{ sample.title }}</span>
                    <span class="sample-row__desc">{{ sample.tag }}</span>
                  </span>
                </button>
              </div>
            </details>

            <p v-if="pending?.columns" class="field-hint">已识别多列数据，可在下方选择 X / Y 列。</p>
            <div v-if="pending?.columns" class="column-map">
              <label class="field">
                <span class="field__label">X 列</span>
                <el-select v-model="xCol" size="small">
                  <el-option
                    v-for="(_, index) in pending.columns"
                    :key="`x-${index}`"
                    :label="pending.headers[index] ?? `列 ${index + 1}`"
                    :value="index"
                  />
                </el-select>
              </label>
              <label class="field">
                <span class="field__label">Y 列</span>
                <el-select v-model="yCol" size="small">
                  <el-option
                    v-for="(_, index) in pending.columns"
                    :key="`y-${index}`"
                    :label="pending.headers[index] ?? `列 ${index + 1}`"
                    :value="index"
                  />
                </el-select>
              </label>
              <button type="button" class="btn btn--quiet" @click="applyColumns">应用列映射</button>
            </div>

            <p v-if="inlineError" class="field-error" aria-live="polite">{{ inlineError }}</p>
            <p v-else-if="importing" class="field-hint" aria-live="polite">正在解析文件…</p>
          </div>
        </section>
      </template>

      <!-- 中间：图谱 -->
      <template #chart>
        <section class="panel chart-panel">
          <div class="panel__head chart-head">
            <h2 class="panel__title"><LineChart /> 衍射图谱</h2>
            <div class="chart-legend" role="group" aria-label="曲线显示">
              <button
                type="button"
                class="chart-legend__chip"
                :class="{ 'is-on': chartMode === 'both' }"
                @click="chartMode = 'both'"
              >
                <span class="legend-dot legend-dot--raw" />
                原始数据
              </button>
              <button
                type="button"
                class="chart-legend__chip"
                :class="{ 'is-on': chartMode === 'processed' }"
                @click="chartMode = 'processed'"
              >
                <span class="legend-dot legend-dot--processed" />
                处理后数据
              </button>
            </div>
          </div>
          <div class="panel__body chart-body">
            <div class="chart-toolbar">
              <button type="button" class="tool-btn" title="重置视图" aria-label="重置视图" @click="chartRef?.reset()">
                <RotateCcw />
              </button>
              <button
                type="button"
                class="tool-btn"
                title="导出 PNG"
                aria-label="导出 PNG"
                @click="chartRef?.exportPNG()"
              >
                <Download />
              </button>
              <span class="chart-toolbar__hint">拖拽平移 · 滚轮缩放 · 双击复位</span>
            </div>
            <SciChart
              v-if="hasData"
              ref="chartRef"
              :series="chartSeries"
              :x-label="project.derived?.meta.xLabel"
              :x-unit="project.derived?.meta.xUnit"
              :y-label="project.derived?.meta.yLabel"
              :y-unit="project.derived?.meta.yUnit"
              :height="250"
              :show-legend="false"
            />
            <div v-else class="chart-empty">
              <span class="chart-empty__icon"><LineChart /></span>
              <p>导入数据后，这里会显示原始与处理后的衍射图谱。</p>
              <button type="button" class="btn btn--primary" @click="pasteOpen = true">粘贴数据</button>
            </div>
          </div>
        </section>
      </template>

      <!-- 中间：数据预览 -->
      <template #table>
        <section class="panel preview-panel">
          <div class="panel__head">
            <h2 class="panel__title"><Table2 /> 数据预览</h2>
            <div class="preview-head">
              <span class="panel__hint">共 {{ (project.derived?.x.length ?? 0).toLocaleString() }} 条数据</span>
              <button type="button" class="panel__link" :disabled="!hasData" @click="openSummary">查看摘要</button>
            </div>
          </div>
          <div class="panel__body">
            <div class="table-wrap preview-table">
              <table class="data">
                <thead>
                  <tr>
                    <th class="num">序号</th>
                    <th class="num">2θ (°)</th>
                    <th class="num">原始强度</th>
                    <th class="num">处理后强度</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in previewRows" :key="row.index">
                    <td class="num">{{ row.index }}</td>
                    <td class="num">{{ row.x.toFixed(3) }}</td>
                    <td class="num">{{ typeof row.raw === 'number' ? row.raw.toFixed(1) : '—' }}</td>
                    <td class="num">{{ row.y.toPrecision(6) }}</td>
                  </tr>
                  <tr v-if="!previewRows.length">
                    <td class="text preview-empty" colspan="4">导入数据后可预览逐点数值。</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="pager">
              <button type="button" class="pager__nav" :disabled="tablePage <= 0" aria-label="上一页" @click="tablePage--">
                ‹
              </button>
              <template v-for="(page, i) in pageList" :key="i">
                <span v-if="page === '…'" class="pager__gap">…</span>
                <button
                  v-else
                  type="button"
                  class="pager__page"
                  :class="{ 'is-current': page === tablePage }"
                  :aria-current="page === tablePage ? 'page' : undefined"
                  @click="tablePage = page"
                >
                  {{ page + 1 }}
                </button>
              </template>
              <button
                type="button"
                class="pager__nav"
                :disabled="tablePage >= totalPages - 1"
                aria-label="下一页"
                @click="tablePage++"
              >
                ›
              </button>
              <span class="spacer" />
              <el-select
                :model-value="pageSize"
                size="small"
                class="pager__size"
                @update:model-value="(value: number) => (pageSize = Number(value))"
              >
                <el-option :value="10" label="10 / 页" />
                <el-option :value="20" label="20 / 页" />
                <el-option :value="50" label="50 / 页" />
              </el-select>
            </div>
          </div>
        </section>
      </template>

      <!-- 右侧：结果摘要 -->
      <template #dashboard>
        <section class="panel summary-panel">
          <div class="panel__head">
            <h2 class="panel__title"><BarChart3 /> 结果摘要</h2>
          </div>
          <div class="panel__body">
            <div class="metric-grid">
              <div class="metric">
                <span class="metric__label">数据点数</span>
                <span class="metric__value mono">{{ pointsText }}</span>
              </div>
              <div class="metric">
                <span class="metric__label">识别峰数</span>
                <span class="metric__value mono">{{ peaks.length }}</span>
              </div>
            </div>
            <div class="metric-list">
              <div>
                <span>2θ 范围 (°)</span>
                <b class="mono">{{ rangeText }}</b>
              </div>
              <div>
                <span>步长 (°)</span>
                <b class="mono">{{ stepSizeText }}</b>
              </div>
            </div>
            <div v-if="hasData" class="status-note">
              <Check />
              <span>
                {{ project.jadeStep ? '数据处理完成，已满足 Jade 导入要求。' : '数据处理完成，可继续导出到 Jade。' }}
              </span>
            </div>
            <p v-else class="summary-empty">导入数据或载入示例后，这里会显示数据点、峰位与处理状态。</p>
          </div>
        </section>

        <section class="panel">
          <div class="panel__head">
            <h2 class="panel__title"><Sparkles /> 峰位信息 <span class="panel__hint">（前 5 个）</span></h2>
            <button type="button" class="panel__link" :disabled="!peaks.length" @click="openSummary">查看全部 →</button>
          </div>
          <div class="panel__body panel__body--tight">
            <table v-if="peaks.length" class="data peak-table">
              <thead>
                <tr>
                  <th class="num">序号</th>
                  <th class="num">2θ (°)</th>
                  <th class="num">相对强度 (%)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(peak, index) in topPeaks" :key="index">
                  <td class="num">{{ index + 1 }}</td>
                  <td class="num">{{ peak.x.toFixed(2) }}</td>
                  <td class="num">{{ peakRel(index) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="section-note">暂无数据，或未检测到明显衍射峰。</p>
          </div>
        </section>

        <section class="panel export-panel">
          <div class="panel__head">
            <h2 class="panel__title"><Download /> 导出数据</h2>
          </div>
          <div class="panel__body export-grid">
            <button type="button" class="btn" :disabled="!hasData" @click="exportXyFile">
              <FileOutput /> XY
            </button>
            <button type="button" class="btn" :disabled="!hasData" @click="exportCsvFile">
              <Table2 /> CSV
            </button>
            <button type="button" class="btn" :disabled="!hasData" @click="goJade">
              <FileOutput /> Jade
            </button>
            <button type="button" class="btn" :disabled="!hasData" @click="router.push('/data/dif')">
              <Download /> DIF
            </button>
          </div>
        </section>
      </template>

      <!-- 底部提示 -->
      <template #tips>
        <Lightbulb class="tips-icon" />
        小提示：您可以在图谱上框选区域进行局部放大，双击图谱重置视图；用右上角的「原始数据 / 处理后数据」切换显示的曲线。
      </template>

      <!-- 结果抽屉内容 -->
      <template #text>
        <pre class="code-surface"><code>{{ summaryText }}</code></pre>
        <IssueList :issues="project.issues" />
        <div v-if="project.applyResult?.issues.length">
          <p class="section-note">步骤错误</p>
          <div v-for="issue in project.applyResult.issues" :key="issue.stepId" class="issue issue--error">
            <div>{{ issue.message }}</div>
          </div>
        </div>
      </template>

      <template #download>
        <div class="row">
          <button type="button" class="btn" @click="saveProject"><Save /> 保存工程</button>
          <button type="button" class="btn" @click="goJade"><FileOutput /> 前往 Jade 导出</button>
        </div>
        <p class="section-note">
          Jade 可读的两列 .xy 与配方文件在「导出到 Jade」页生成；工程文件包含原始数据与全部步骤。
        </p>
      </template>

      <template #copy>
        <div class="row">
          <button type="button" class="btn" @click="copySummary"><ClipboardPaste /> 复制摘要</button>
        </div>
        <pre class="code-surface"><code>{{ summaryText }}</code></pre>
      </template>
    </ToolPage>

    <el-dialog v-model="pasteOpen" title="粘贴数据" width="560px">
      <p class="small muted" style="margin-bottom: 8px">
        粘贴两列或多列文本。支持空格、制表符、逗号分隔；首行可以是列名。
      </p>
      <el-input
        v-model="pasteText"
        type="textarea"
        :rows="10"
        placeholder="2theta,intensity&#10;20.0,372&#10;20.02,403"
      />
      <template #footer>
        <el-button size="small" @click="pasteOpen = false">取消</el-button>
        <el-button size="small" type="primary" @click="pasteImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.source-line {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.source-line__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-line__file {
  font-size: 11.5px;
  color: var(--text-3);
  word-break: break-all;
}

.source-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 10px 0;
}

.source-actions :deep(.btn) {
  justify-content: flex-start;
  width: 100%;
}

.paste-row {
  margin-top: 10px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-2);
  align-items: end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: var(--text-2);
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.step-menu-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.35;
  padding: 2px 0;
}

.sample-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
  gap: 12px;
}

.sample-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-2);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--duration) var(--ease),
    box-shadow var(--duration) var(--ease),
    transform var(--duration) var(--ease);
}

.sample-card:hover:not(:disabled) {
  border-color: var(--accent-line);
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
}

.sample-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sample-card__tag {
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
}

.sample-card:disabled {
  opacity: 0.55;
  cursor: wait;
}

.sample-card__title {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text);
}

.sample-card__desc {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-3);
}

.sub-more {
  border-top: 1px solid var(--border);
}

.sub-more summary {
  padding: 8px 0;
  font-size: 12px;
  color: var(--text-3);
  cursor: pointer;
}

.sub-more summary:hover {
  color: var(--text);
}

.next-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.next-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-2);
  text-decoration: none;
}

.next-link:hover {
  background: var(--surface-2);
  text-decoration: none;
}

.next-link svg {
  width: 15px;
  height: 15px;
  color: var(--text-3);
  flex: 0 0 auto;
}

.next-link span {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}

.next-link b {
  font-size: 12px;
  color: var(--text);
  font-weight: 600;
}

.next-link small {
  font-size: 11px;
  color: var(--text-3);
}

/* ---------------------------------------------------------------- flow */

.flow {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.flow__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-left: 2px solid transparent;
  border-radius: 0 8px 8px 0;
  font-size: 12.5px;
  color: var(--text-2);
}

.flow__item.is-active {
  background: var(--accent-soft);
  border-left-color: var(--accent);
  color: var(--text);
  font-weight: 600;
}

.flow__item.is-done .flow__dot {
  background: var(--ok-soft);
  color: var(--ok);
}

.flow__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}

.flow__dot {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-3);
  font-size: 10px;
}

.flow__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow__check {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  color: var(--ok);
}

.flow__btn--add {
  color: var(--text-3);
}

.flow__btn--add:hover {
  color: var(--accent);
}

.active-step {
  margin-top: 12px;
}

/* ---------------------------------------------------------------- metrics */

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-2);
}

.metric__value {
  display: block;
  font-size: 22px;
  font-weight: 720;
  line-height: 1.2;
  color: var(--accent);
}

.metric__label {
  font-size: 11px;
  color: var(--text-3);
}

.metric-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  font-size: 12px;
}

.metric-list > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.metric-list span {
  color: var(--text-3);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}

.export-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.export-grid :deep(.btn) {
  justify-content: center;
}

/* ---------------------------------------------------------------- flow v2 */

.flow__icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--surface-3);
  color: var(--text-3);
}

.flow__icon svg {
  width: 13px;
  height: 13px;
}

.flow__icon.is-ok {
  background: var(--ok-soft);
  color: var(--ok);
}

.flow__icon.is-on {
  background: var(--accent-soft);
  color: var(--accent);
}

.flow__main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.flow__sub {
  font-size: 10.5px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow__arrow {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  color: var(--text-3);
  opacity: 0;
  transition:
    opacity var(--duration) var(--ease),
    transform var(--duration) var(--ease);
}

.flow__btn:hover .flow__arrow {
  opacity: 1;
  transform: translateX(2px);
}

.flow-params {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-soft);
}

.flow-params__title {
  margin: 0 0 10px;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text);
}

/* ---------------------------------------------------------------- chart */

.chart-legend {
  display: flex;
  gap: 6px;
}

.chart-legend__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-3);
  font-size: 11px;
  cursor: pointer;
  transition:
    border-color var(--duration) var(--ease),
    color var(--duration) var(--ease),
    background var(--duration) var(--ease);
}

.chart-legend__chip::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-strong);
}

.chart-legend__chip.is-on {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--accent);
}

.chart-legend__chip.is-on::before {
  background: var(--accent);
}

.chart-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 6px;
}

.tool-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-3);
  cursor: pointer;
}

.tool-btn:hover {
  color: var(--accent);
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.tool-btn svg {
  width: 13px;
  height: 13px;
}

/* ---------------------------------------------------------------- pager */

.pager {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
}

.pager__page,
.pager__nav {
  display: grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-2);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.pager__page:hover:not(:disabled),
.pager__nav:hover:not(:disabled) {
  border-color: var(--accent-line);
  color: var(--accent);
}

.pager__page.is-current {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
  font-weight: 600;
}

.pager__gap {
  min-width: 20px;
  text-align: center;
  color: var(--text-3);
}

.pager__nav:disabled,
.pager__page:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ---------------------------------------------------------------- misc */

.status-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
  color: var(--accent);
  font-size: 11.5px;
  line-height: 1.5;
}

.status-note svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  margin-top: 1px;
}

.export-panel {
  border-color: var(--accent-line);
  background: color-mix(in srgb, var(--accent) 4%, var(--surface));
}
</style>

<style scoped>
/* ---------------------------------------------------------------- workspace refresh */

.ops-panel {
  overflow: hidden;
}

.ops-body {
  padding: 12px 12px 14px;
}

.flow {
  gap: 0;
}

.flow__item {
  padding: 0;
  border-left: 0;
  border-radius: 8px;
}

.flow__item.is-active {
  background: var(--accent-soft);
}

.flow__btn {
  gap: 10px;
  padding: 8px 8px;
  border-radius: 8px;
}

.flow__item.is-active .flow__btn {
  color: var(--text);
}

.flow__icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-3);
}

.flow__icon.is-ok {
  background: var(--ok-soft);
  color: var(--ok);
}

.flow__icon.is-on {
  background: var(--accent-soft);
  color: var(--accent);
}

.flow__icon.is-idle {
  background: var(--surface-2);
  color: #8fa0b4;
}

.flow__icon svg {
  width: 12px;
  height: 12px;
}

.flow__label {
  font-size: 12.5px;
  font-weight: 550;
}

.flow__sub {
  font-size: 10px;
  color: var(--text-3);
}

.flow__state {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-2);
  color: var(--text-3);
  font-size: 9.5px;
  white-space: nowrap;
}

.flow__state.is-done {
  background: var(--ok-soft);
  color: var(--ok);
}

.flow__arrow {
  width: 12px;
  height: 12px;
  opacity: 0.55;
}

.flow__item--add {
  margin-top: 6px;
  border-top: 1px dashed var(--border-soft);
  border-radius: 0;
}

.flow__add {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  height: 34px;
  padding: 0 8px;
  border: 0;
  border-radius: 0 0 8px 8px;
  background: transparent;
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.flow__add:disabled {
  color: var(--text-3);
  cursor: not-allowed;
}

.flow__add svg {
  width: 14px;
  height: 14px;
}

.source-panel .panel__body {
  padding: 14px;
}

.params-panel__body {
  padding: 0;
}

.params-panel :deep(.step-card) {
  padding: 14px 16px 16px;
  border: 0;
  border-radius: 0 0 var(--radius) var(--radius);
  background: transparent;
  box-shadow: none;
}

.params-panel :deep(.step-card__desc) {
  margin: 6px 0 12px;
}

.params-panel :deep(.step-card__params) {
  gap: 10px;
}

.params-advanced {
  border-top: 1px solid var(--border-soft);
  padding: 0 16px;
}

.params-advanced summary {
  padding: 10px 0;
  color: var(--text-3);
  font-size: 11.5px;
  cursor: pointer;
  list-style: none;
}

.params-advanced summary::-webkit-details-marker {
  display: none;
}

.params-advanced summary::before {
  content: '›';
  display: inline-block;
  margin-right: 6px;
  transition: transform var(--duration) var(--ease);
}

.params-advanced[open] summary::before {
  transform: rotate(90deg);
}

.params-advanced__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding-bottom: 12px;
}

.params-advanced__body .btn {
  height: 32px;
  font-size: 11px;
}

.source-panel :deep(.dropzone) {
  min-height: 126px;
  padding: 16px;
  gap: 6px;
}

.source-panel :deep(.dropzone__icon) {
  width: 34px;
  height: 34px;
  border-radius: 9px;
}

.source-panel :deep(.dropzone__icon svg) {
  width: 17px;
  height: 17px;
}

.source-panel :deep(.dropzone__title) {
  font-size: 12.5px;
}

.source-panel :deep(.dropzone__hint) {
  font-size: 10px;
  line-height: 1.5;
}

.source-panel .source-actions {
  margin: 10px 0 4px;
  gap: 6px;
}

.source-panel .source-actions :deep(.btn) {
  justify-content: flex-start;
  height: 32px;
  padding: 0 9px;
  font-size: 11.5px;
}

.source-panel .source-actions :deep(.btn svg) {
  width: 13px;
  height: 13px;
}

.samples {
  margin-top: 8px;
  border-top: 1px solid var(--border-soft);
}

.samples__summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 0 5px;
  color: var(--text-2);
  font-size: 11.5px;
  cursor: pointer;
  list-style: none;
}

.samples__summary::-webkit-details-marker {
  display: none;
}

.samples__summary::before {
  content: '›';
  font-size: 14px;
  line-height: 1;
  color: var(--text-3);
  transition: transform var(--duration) var(--ease);
}

.samples[open] .samples__summary::before {
  transform: rotate(90deg);
}

.samples__summary span {
  color: var(--text-3);
  font-size: 10px;
}

.sample-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px 0 6px;
}

.sample-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 6px 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-2);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.sample-row:hover:not(:disabled) {
  background: var(--surface-2);
}

.sample-row :deep(svg) {
  width: 38px;
  height: 22px;
  flex: 0 0 auto;
}

.sample-row__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sample-row__title {
  font-size: 11.5px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sample-row__desc {
  font-size: 9.5px;
  color: var(--text-3);
}

.column-map {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.column-map :deep(.btn) {
  grid-column: 1 / -1;
}

.chart-head {
  gap: 12px;
}

.chart-body {
  padding: 10px 14px 12px;
}

.chart-legend {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chart-legend__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-3);
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.chart-legend__chip.is-on {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--text);
}

.chart-legend__chip::before {
  display: none;
}

.legend-dot {
  width: 9px;
  height: 3px;
  border-radius: 2px;
  background: #a9b7c8;
}

.legend-dot--processed {
  background: var(--accent);
}

.chart-legend__chip.is-on .legend-dot--raw {
  background: #8b9cb2;
}

.chart-legend__chip.is-on .legend-dot--processed {
  background: #21a06e;
}

.chart-toolbar {
  justify-content: flex-start;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.chart-toolbar__hint {
  margin-left: 6px;
  color: var(--text-3);
  font-size: 9.5px;
}

.tool-btn {
  width: 27px;
  height: 27px;
  border-color: transparent;
  background: transparent;
}

.tool-btn:hover {
  border-color: transparent;
}

.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 352px;
  color: var(--text-3);
  font-size: 12px;
  text-align: center;
}

.chart-empty__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
}

.chart-empty__icon svg {
  width: 22px;
  height: 22px;
}

.preview-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-panel .panel__body {
  padding: 12px 14px 12px;
}

.preview-table {
  max-height: 200px;
  border: 0;
}

.preview-table table.data {
  font-size: 11.5px;
}

.preview-table table.data th {
  padding: 8px 12px;
  background: var(--surface-2);
  color: var(--text-3);
  font-weight: 500;
}

.preview-table table.data td {
  padding: 7px 12px;
}

.preview-empty {
  padding: 28px 12px !important;
  text-align: center !important;
  color: var(--text-3) !important;
  font-family: var(--font-sans) !important;
}

.preview-panel .pager {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 10px;
}

.preview-panel .pager__page,
.preview-panel .pager__nav {
  min-width: 26px;
  height: 26px;
  padding: 0 5px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
}

.preview-panel .pager__page:hover:not(:disabled),
.preview-panel .pager__nav:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--accent);
}

.preview-panel .pager__page.is-current {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 650;
}

.pager__gap {
  min-width: 18px;
}

.pager__size {
  width: 92px;
}

.pager__size :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px var(--border) inset !important;
  font-size: 10.5px;
}

.metric-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 20px;
}

.metric {
  padding: 0;
  border-radius: 0;
  background: transparent;
}

.metric__label {
  display: block;
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.5;
}

.metric__value {
  display: block;
  margin-top: 2px;
  font-family: var(--font-sans);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.03em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.metric-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 20px;
  margin-top: 16px;
  font-size: 11px;
}

.metric-list > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.metric-list span {
  color: var(--text-2);
  font-size: 11px;
}

.metric-list b {
  color: var(--text);
  font-size: 15px;
  font-weight: 650;
}

.summary-empty {
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 7px;
  background: var(--surface-2);
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.6;
}

.summary-panel .status-note {
  margin-top: 16px;
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--accent);
}

.summary-panel .status-note svg {
  width: 15px;
  height: 15px;
}

.peak-table {
  border-collapse: collapse;
}

.peak-table th,
.peak-table td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--border-soft);
  background: transparent;
}

.peak-table th {
  color: var(--text-3);
  font-weight: 500;
}

.peak-table tbody tr:hover td {
  background: var(--surface-hover);
}

.export-panel .panel__body {
  padding: 12px;
}

.export-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.export-grid .btn {
  height: 34px;
  font-size: 11.5px;
}

.panel__link:disabled {
  color: var(--text-3);
  cursor: not-allowed;
}

.tips-icon {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  color: #e4b34a;
}

@media (max-width: 1340px) {
  .workspace__ops {
    display: grid;
    grid-template-columns: minmax(280px, 0.9fr) minmax(260px, 1.1fr);
    align-items: start;
  }

  .workspace__ops > :deep(.more) {
    grid-column: 1 / -1;
  }
}

@media (max-width: 1100px) {
  .workspace__ops {
    display: flex;
    flex-direction: column;
  }
}

@media (max-width: 720px) {
  .preview-head {
    gap: 7px;
  }

  .metric__value {
    font-size: 24px;
  }
}
</style>
