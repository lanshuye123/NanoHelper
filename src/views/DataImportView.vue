<script setup lang="ts">
import { computed, ref } from 'vue'
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

const project = useProjectStore()
const router = useRouter()

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
    { label: 'X 范围', value: `${range.xMin.toFixed(2)} – ${range.xMax.toFixed(2)}`, unit: project.derived?.meta.xUnit },
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
      color: '#94a3b8',
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
      color: '#22d3ee',
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
    downloadText(
      content,
      safeFilename(project.source?.name ?? 'project', 'xtalbox.json'),
      'application/json',
    )
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
    title="导入与预处理"
    subtitle="导入 XRD / 光谱 / 热分析数据，检查质量并构建可逆的变换链，最终输出 Jade 可读的 XY。"
    eyebrow="数据处理 · 01"
    doc="/docs/userguide/data-import"
  >
    <template #actions>
      <el-button v-if="hasData" size="small" :disabled="!project.history.length" @click="project.undo()">
        <Undo2 class="btn-icon" /> 撤销
      </el-button>
      <el-button v-if="hasData" size="small" :disabled="!project.future.length" @click="project.redo()">
        <Redo2 class="btn-icon" /> 重做
      </el-button>
      <el-button v-if="hasData" size="small" @click="resetSteps">
        <RotateCcw class="btn-icon" /> 重置
      </el-button>
      <el-button v-if="hasData" type="primary" size="small" @click="goJade">
        Jade 导出 <ArrowRight class="btn-icon" />
      </el-button>
    </template>

    <template #config>
      <PanelCard title="数据源" :icon="Database">
        <div v-if="project.source" class="source-info">
          <div class="source-info__name">{{ project.source.name }}</div>
          <div class="source-info__meta">
            <span class="chip chip--mono">{{ project.source.format ?? '数据' }}</span>
            <span v-if="project.range" class="chip chip--mono">{{ project.range.points.toLocaleString() }} pts</span>
          </div>
          <div v-if="project.source.fileName" class="source-info__file mono">{{ project.source.fileName }}</div>
        </div>
        <div class="btn-row" style="margin-top: 10px">
          <el-button size="small" @click="pasteOpen = true">
            <ClipboardPaste class="btn-icon" /> 粘贴文本
          </el-button>
          <el-button size="small" :disabled="!project.hasData" @click="saveProject">
            <Save class="btn-icon" /> 保存工程
          </el-button>
          <el-button size="small" @click="projectInput?.click()">
            <FolderOpen class="btn-icon" /> 打开工程
          </el-button>
          <el-button size="small" :disabled="!project.hasData" @click="project.clear()">清空</el-button>
        </div>
        <input ref="projectInput" type="file" accept=".json,.xtalbox" hidden @change="($event) => { const f = ($event.target as HTMLInputElement).files?.[0]; if (f) openProject([f]); ($event.target as HTMLInputElement).value = '' }" />
        <div v-if="!project.hasData" class="hint-block">
          <p class="small muted">支持 CSV / TSV / TXT / XY / DAT / DIF / XRDML / UXD。</p>
          <p class="tiny dim">文件只在浏览器本地解析，不会上传。</p>
        </div>
      </PanelCard>

      <PanelCard v-if="project.hasData" title="变换步骤" :icon="Sparkles" :hint="`${steps.length} 步`">
        <el-dropdown trigger="click" style="width: 100%" @command="onAddStepCommand">
          <el-button size="small" style="width: 100%">
            <Plus class="btn-icon" /> 添加处理步骤
          </el-button>
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

        <div v-if="!steps.length" class="hint-block">
          <p class="small muted">尚未添加步骤。原始数据会原样用于图表与 Jade 检查。</p>
        </div>
        <div v-else class="step-list">
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
      </PanelCard>

      <PanelCard v-if="pending?.columns" title="列映射" :icon="Database">
        <p class="small muted" style="margin-bottom: 10px">
          文件包含 {{ pending.columns.length }} 列，选择用于 X/Y 的列。切换后会基于该文件重新建立数据集（已添加的步骤会清空）。
        </p>
        <div class="grid-2">
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
        </div>
        <el-button size="small" type="primary" plain style="margin-top: 10px" @click="applyColumns">
          应用列映射
        </el-button>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard v-if="hasData" title="下一步" :icon="Sparkles">
        <div class="next-links">
          <RouterLink to="/data/jade" class="next-link">
            <FileOutput />
            <span><b>Jade 导出</b><small>生成 .xy 与 recipe.json</small></span>
          </RouterLink>
          <RouterLink to="/data/dif" class="next-link">
            <FileOutput />
            <span><b>DIF → XY</b><small>把拟合结果还原给 Origin</small></span>
          </RouterLink>
          <RouterLink to="/crystal/reciprocal" class="next-link">
            <Grid3x3 />
            <span><b>倒易空间</b><small>d 值、夹角、带轴</small></span>
          </RouterLink>
        </div>
      </PanelCard>

      <PanelCard v-if="!hasData" title="课程要点" :icon="FlaskConical">
        <p class="small muted" style="line-height: 1.65">
          Jade 的横坐标必须在 0–140 之间，纵坐标必须始终大于 0。非衍射数据（Raman、IR、TGA）需要先做
          <strong>可逆</strong> 的坐标映射；映射系数会写入配方，供 DIF → XY 反算。
        </p>
        <RouterLink to="/docs/cookbook/raman-to-jade" class="doc-inline">
          阅读：Raman → Jade → Origin 全流程
        </RouterLink>
      </PanelCard>
    </template>

    <!-- No data: onboarding -->
    <template v-if="!hasData">
      <PanelCard title="导入数据" :icon="Database">
        <FileDrop
          accept=".csv,.tsv,.txt,.xy,.dat,.dif,.xrdml,.uxd,.asc"
          title="拖入数据文件，或点击选择"
          hint="CSV / TSV / TXT / XY / DAT / DIF / XRDML / UXD · 推荐两列：X + 强度"
          @files="handleFiles"
        />
        <div class="import-actions">
          <el-button size="small" @click="pasteOpen = true">
            <ClipboardPaste class="btn-icon" /> 粘贴文本
          </el-button>
          <span class="tiny dim">也可以直接从剪贴板粘贴两列数据</span>
        </div>
      </PanelCard>

      <PanelCard title="示例数据" :icon="Sparkles">
        <div class="sample-grid">
          <button
            v-for="sample in SAMPLES"
            :key="sample.id"
            class="sample-card"
            type="button"
            :disabled="importing"
            @click="loadSampleData(sample.id)"
          >
            <span class="sample-card__tag">{{ sample.tag }}</span>
            <span class="sample-card__title">{{ sample.title }}</span>
            <span class="sample-card__desc">{{ sample.description }}</span>
          </button>
        </div>
      </PanelCard>

      <PanelCard title="数据格式" :icon="FileOutput">
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
                <td class="text">到「DIF → XY」页导出</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>

      <PanelCard title="三步工作流" :icon="Sparkles">
        <ol class="workflow">
          <li><b>导入与检查</b><span>确认 X/Y 列、步长、负值与 NaN；必要时裁剪或重采样。</span></li>
          <li><b>预处理</b><span>平滑、扣背底、Kα2 剥离、归一化；每步都可停用并从原始数据重算。</span></li>
          <li><b>映射与导出</b><span>添加「Jade 坐标映射」满足 0–140 / Y&gt;0，导出 .xy 与可逆配方。</span></li>
        </ol>
      </PanelCard>
    </template>

    <!-- With data -->
    <template v-else>
      <div v-if="stats" class="stats-row">
        <div v-for="item in stats" :key="item.label" class="stat">
          <div class="stat__label">{{ item.label }}</div>
          <div class="stat__value">
            {{ item.value }}<span v-if="item.unit" class="stat__unit">{{ item.unit }}</span>
          </div>
        </div>
      </div>

      <PanelCard title="曲线预览" :icon="Sparkles" hint="灰色为原始，青色为处理后">
        <SciChart
          :series="chartSeries"
          :x-label="project.derived?.meta.xLabel"
          :x-unit="project.derived?.meta.xUnit"
          :y-label="project.derived?.meta.yLabel"
          :y-unit="project.derived?.meta.yUnit"
          :height="380"
        />
      </PanelCard>

      <PanelCard title="数据质量" :icon="FileOutput">
        <IssueList :issues="project.issues" />
        <div v-if="project.applyResult?.issues.length" style="margin-top: 10px">
          <div class="section-label" style="margin-bottom: 6px">步骤错误</div>
          <div v-for="issue in project.applyResult.issues" :key="issue.stepId" class="issue issue--error">
            <span class="issue__icon" />
            <div>{{ issue.message }}</div>
          </div>
        </div>
      </PanelCard>
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
.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 3px;
}

.source-info__name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-info__meta {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.source-info__file {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-3);
  word-break: break-all;
}

.hint-block {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
}

.hint-block p + p {
  margin-top: 3px;
}

.step-list {
  margin-top: 10px;
}

.step-menu-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.35;
  padding: 2px 0;
}

.import-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.sample-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(215px, 1fr));
  gap: 10px;
}

.sample-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 11px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}

.sample-card:hover:not(:disabled) {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  transform: translateY(-1px);
}

.sample-card:disabled {
  opacity: 0.55;
  cursor: wait;
}

.sample-card__tag {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.sample-card__title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}

.sample-card__desc {
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--text-3);
}

.workflow {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.workflow li {
  color: var(--text-2);
}

.workflow b {
  display: block;
  font-size: 12px;
  color: var(--text);
  font-weight: 600;
}

.workflow span {
  font-size: 11px;
  color: var(--text-3);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 720px) {
  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.next-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.next-link {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 9px;
  border-radius: 6px;
  border: 1px solid var(--border-soft);
  color: var(--text-2);
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}

.next-link:hover {
  background: var(--surface-2);
  border-color: var(--border-strong);
  text-decoration: none;
}

.next-link svg {
  width: 15px;
  height: 15px;
  color: var(--accent);
  flex: 0 0 auto;
}

.next-link span {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.next-link b {
  font-size: 11.5px;
  color: var(--text);
  font-weight: 600;
}

.next-link small {
  font-size: 10px;
  color: var(--text-3);
}

.doc-inline {
  display: inline-block;
  margin-top: 8px;
  font-size: 11px;
}

@media (max-width: 640px) {
  .source-info__meta {
    gap: 4px;
  }
}
</style>
