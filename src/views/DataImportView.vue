<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowRight,
  ClipboardPaste,
  Database,
  FileOutput,
  FlaskConical,
  Grid3x3,
  FolderOpen,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
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
import SparkLine from '@/components/ui/SparkLine.vue'
import type { DrawerState } from '@/components/tool/types'

const project = useProjectStore()
const router = useRouter()
const { register, unregister } = useCommands()

const drawer = ref<DrawerState>('closed')
const inlineError = ref('')

const pending = ref<ImportResult | null>(null)
const xCol = ref(0)
const yCol = ref(1)
const pasteOpen = ref(false)
const pasteText = ref('')
const importing = ref(false)
const projectInput = ref<HTMLInputElement | null>(null)

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

const chartSeries = computed<ChartSeries[]>(() => {
  const series: ChartSeries[] = []
  const mapping = project.jadeMapping
  const input = project.jadeStep ? project.patternBeforeJade : project.raw
  const compared = input && mapping ? applyMapping(input, mapping) : input
  const showInput = project.steps.some((s) => s.enabled && s.type !== 'jade-map')
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
    ElMessage.success('工程已载入')
  } catch (error) {
    if (error === 'cancel') return
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <ToolPage
    tool-id="data-import"
    title="XRD 数据预处理"
    subtitle="导入谱图，裁剪、平滑、扣背底，再导出 Jade 可读的两列 XY。"
    doc="/docs/userguide/data-import"
    eyebrow="数据处理 · 01"
    v-model:result-state="drawer"
    result-title="预处理结果"
  >
    <!-- 1 · 数据输入 -->
    <template #source>
      <div class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><Database /> 数据源</h2>
        </div>
        <div class="panel__body">
          <div v-if="project.source" class="source-line">
            <span class="source-line__name">{{ project.source.name }}</span>
            <span class="tag mono">{{ project.source.format ?? '数据' }}</span>
            <span v-if="project.range" class="tag mono">{{ project.range.points.toLocaleString() }} pts</span>
          </div>

          <div class="source-actions">
            <button type="button" class="btn btn--quiet" @click="pasteOpen = true"><ClipboardPaste /> 粘贴文本</button>
            <button type="button" class="btn btn--quiet" :disabled="!project.hasData" @click="saveProject">
              <Save /> 保存工程
            </button>
            <button type="button" class="btn btn--quiet" @click="projectInput?.click()"><FolderOpen /> 打开工程</button>
            <button type="button" class="btn btn--quiet" :disabled="!project.hasData" @click="project.clear()">
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

          <p class="field-hint">支持 CSV / TSV / TXT / XY / DAT / DIF / XRDML / UXD。可拖拽、选择文件或粘贴文本。</p>
        </div>
      </div>
    </template>

    <template #input>
      <div class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><Upload /> 导入数据</h2>
        </div>
        <div class="panel__body">
          <FileDrop
            v-if="!hasData"
            accept=".csv,.tsv,.txt,.xy,.dat,.dif,.xrdml,.uxd,.asc"
            title="拖入数据文件，或点击选择"
            hint="CSV / TSV / TXT / XY / DAT / DIF / XRDML / UXD · 推荐两列：X + 强度"
            @files="handleFiles"
          />
          <p v-else class="field-hint">已载入数据。要更换文件，可在「数据源」中清空后重新导入。</p>

          <div class="row paste-row">
            <button type="button" class="btn btn--quiet" @click="pasteOpen = true"><ClipboardPaste /> 粘贴文本</button>
            <span class="field-hint">也可以直接粘贴两列数据</span>
          </div>

          <p v-if="inlineError" class="field-error" aria-live="polite">{{ inlineError }}</p>
          <p v-else-if="importing" class="field-hint" aria-live="polite">正在解析文件…</p>
        </div>
      </div>
    </template>

    <!-- 2 · 常用参数 -->
    <template #params>
      <div v-if="pending?.columns" class="field-grid">
        <label class="field">
          <span class="field-label">X 列</span>
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
          <span class="field-label">Y 列</span>
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

      <div v-if="hasData" class="row">
        <el-dropdown trigger="click" @command="onAddStepCommand">
          <button type="button" class="btn btn--quiet"><Plus /> 添加处理步骤</button>
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
        <span class="section-note">{{ steps.length }} 个步骤，可在「更多设置」中调整</span>
      </div>
    </template>

    <div class="panel">
      <div class="panel__head">
        <h2 class="panel__title"><Sparkles /> 示例数据</h2>
        <span class="panel__hint">无需准备文件</span>
      </div>
      <div class="panel__body">
        <div class="sample-grid">
          <button
            v-for="sample in SAMPLES"
            :key="sample.id"
            type="button"
            class="sample-card"
            :disabled="importing"
            @click="loadSampleData(sample.id)"
          >
            <SparkLine
              :variant="SPARK_VARIANTS[sample.id] ?? 'diffraction'"
              :color="SPARK_COLORS[sample.id] ?? 'var(--plot-1)'"
            />
            <span class="sample-card__body">
              <span class="sample-card__tag">{{ sample.tag }}</span>
              <span class="sample-card__title">{{ sample.title }}</span>
              <span class="sample-card__desc">{{ sample.description }}</span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- 3 · 更多设置 -->
    <template #more>
      <div v-if="steps.length" class="step-list">
        <StepCard
          v-for="(step, index) in steps"
          :key="step.id"
          :step="step"
          :index="index"
          :total="steps.length"
          @update:params="setStepParams(step.id, $event)"
          @toggle="project.toggleStep(step.id)"
          @remove="project.removeStep(step.id)"
          @move="project.moveStep(step.id, $event)"
          @duplicate="project.duplicateStep(step.id)"
        />
      </div>
      <p v-else class="section-note">尚未添加步骤。原始数据会原样用于图表与 Jade 检查。</p>

      <div class="row">
        <button type="button" class="btn btn--quiet" :disabled="!steps.length" @click="resetSteps">
          <RotateCcw /> 重置步骤
        </button>
        <button type="button" class="btn btn--quiet" :disabled="!project.hasData" @click="project.clear()">
          清空数据
        </button>
      </div>

      <details class="sub-more">
        <summary>支持的数据格式</summary>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th class="text">类型</th>
                <th class="text">说明</th>
                <th class="text">Jade 映射</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text">XRD（2θ）</td>
                <td class="text">两列：2θ、强度；X 已在 0–140 内</td>
                <td class="text">保持 2θ，仅处理负值</td>
              </tr>
              <tr>
                <td class="text">Raman / FTIR</td>
                <td class="text">X 为位移或波数（可达数千）</td>
                <td class="text">X→[0,100]，Y→[0.5,10000]</td>
              </tr>
              <tr>
                <td class="text">TGA / DSC</td>
                <td class="text">温度为 X，质量为 Y</td>
                <td class="text">X→[0,100]，Y→[0.5,10000]</td>
              </tr>
              <tr>
                <td class="text">Jade DIF</td>
                <td class="text">多块拟合结果，自动识别 Raw/Overall</td>
                <td class="text">到「DIF 转 XY」页导出</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>

    <!-- 4 · 运行 -->
    <template #run>
      <button
        type="button"
        class="btn btn--primary btn--lg"
        :disabled="!hasData || importing"
        :aria-busy="importing"
        @click="run"
      >
        查看预处理结果
      </button>
      <button type="button" class="btn" :disabled="!hasData" @click="goJade">导出到 Jade</button>
    </template>

    <!-- 结果 · 图表 -->
    <template #chart>
      <SciChart
        v-if="hasData"
        :series="chartSeries"
        :x-label="project.derived?.meta.xLabel"
        :x-unit="project.derived?.meta.xUnit"
        :y-label="project.derived?.meta.yLabel"
        :y-unit="project.derived?.meta.yUnit"
        :height="320"
      />
    </template>

    <!-- 结果 · 文本 -->
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

    <!-- 结果 · 下载 -->
    <template #download>
      <div class="row">
        <button type="button" class="btn" @click="saveProject"><Save /> 保存工程</button>
        <button type="button" class="btn" @click="goJade"><FileOutput /> 前往 Jade 导出</button>
      </div>
      <p class="section-note">
        Jade 可读的两列 .xy 与 recipe.json 在「导出到 Jade」页生成；工程文件包含原始数据与全部步骤。
      </p>
    </template>

    <!-- 结果 · 复制 -->
    <template #copy>
      <div class="row">
        <button type="button" class="btn" @click="copySummary"><ClipboardPaste /> 复制摘要</button>
      </div>
      <pre class="code-surface"><code>{{ summaryText }}</code></pre>
    </template>

    <!-- 补充信息 -->
    <template #aside>
      <div class="next-links">
        <RouterLink to="/data/jade" class="next-link">
          <FileOutput />
          <span><b>导出到 Jade</b><small>生成 .xy 与 recipe.json</small></span>
        </RouterLink>
        <RouterLink to="/data/dif" class="next-link">
          <FileOutput />
          <span><b>DIF 转 XY</b><small>把拟合结果还原给 Origin</small></span>
        </RouterLink>
        <RouterLink to="/crystal/reciprocal" class="next-link">
          <Grid3x3 />
          <span><b>倒易空间计算</b><small>d 值、夹角、带轴</small></span>
        </RouterLink>
      </div>
      <p class="section-note">
        Jade 的横坐标需在 0–140、纵坐标需大于 0。非衍射数据（Raman、IR、TGA）先做可逆坐标映射，系数写入配方供反算。
        <RouterLink to="/docs/cookbook/raman-to-jade">查看全流程</RouterLink>
      </p>
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
</style>
