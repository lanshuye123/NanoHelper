<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileJson,
  FileOutput,
  FlaskConical,
  Layers,
  Table2,
  Upload,
} from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import PanelCard from '@/components/common/PanelCard.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import NumberField from '@/components/common/NumberField.vue'
import SciChart, { type ChartSeries } from '@/components/chart/SciChart.vue'
import {
  parseDif,
  exportDif,
  blockX,
  type DifFile,
  type DifExportOptions,
} from '@/core/io/dif'
import { parseRecipe, type Recipe } from '@/core/pipeline/recipe'
import { mappingSummary } from '@/core/pipeline/jade'
import { downloadText, readFileText, safeFilename, timestamp } from '@/utils/download'

const dif = ref<DifFile | null>(null)
const fileName = ref('')
const loading = ref(false)
const selectedBlocks = ref<number[]>([])
const recipe = ref<Recipe | null>(null)
const exportAsCsv = ref(true)
const headerComments = ref(true)

const options = ref({
  format: 'wide' as DifExportOptions['format'],
  xAxis: 'twoTheta' as DifExportOptions['xAxis'],
  fillOutside: 'zero' as 'zero' | 'nan',
  decimalsX: 5,
  decimalsY: 4,
})

const roleLabels: Record<string, string> = {
  raw: 'Raw 观测',
  background: 'Background 背底',
  fitted: 'Fitted 拟合峰',
  overall: 'Overall 计算',
  difference: 'Difference 差值',
  unknown: '未分类',
}

const roleColor: Record<string, string> = {
  raw: '#22d3ee',
  background: '#94a3b8',
  fitted: '#a78bfa',
  overall: '#fbbf24',
  difference: '#fb7185',
  unknown: '#60a5fa',
}

const hasDif = computed(() => !!dif.value)
const wavelength = computed(() => dif.value?.blocks[0]?.wavelength ?? 0)

const recipeWarnings = computed(() => {
  const r = recipe.value
  const d = dif.value
  if (!r || !d) return []
  const raw = d.blocks.find((b) => b.role === 'raw') ?? d.blocks[0]
  const warnings: string[] = []
  if (r.source.points && Math.abs(r.source.points - raw.points) > 1) {
    warnings.push(`配方点数 (${r.source.points}) 与 DIF 当前曲线 (${raw.points}) 不一致`)
  }
  if (r.source.xRange && raw) {
    const [x0, x1] = r.source.xRange
    if (Math.abs(x0 - raw.start) > Math.abs(raw.step) * 2 || Math.abs(x1 - raw.end) > Math.abs(raw.step) * 2) {
      warnings.push(`配方 X 范围 (${x0}–${x1}) 与 DIF (${raw.start}–${raw.end}) 不一致`)
    }
  }
  return warnings
})

const series = computed<ChartSeries[]>(() => {
  if (!dif.value) return []
  return dif.value.blocks
    .filter((b) => selectedBlocks.value.includes(b.index))
    .map((b) => ({
      label: `${b.name}`,
      x: blockX(b),
      y: b.y,
      color: roleColor[b.role] ?? '#60a5fa',
      width: b.role === 'raw' ? 1.5 : b.role === 'background' ? 1 : 1.1,
      dash: b.role === 'fitted' ? [4, 3] : undefined,
      opacity: b.role === 'fitted' ? 0.9 : 1,
    }))
})

const exportResult = computed(() => {
  if (!dif.value) return null
  try {
    return exportDif(dif.value, {
      format: options.value.format,
      xAxis: options.value.xAxis,
      fillOutside: options.value.fillOutside,
      delimiter: exportAsCsv.value ? ',' : ' ',
      includeHeader: headerComments.value,
      decimalsX: options.value.decimalsX,
      decimalsY: options.value.decimalsY,
      blockIndices: selectedBlocks.value.length === dif.value.blocks.length ? undefined : selectedBlocks.value,
      inverseMapping: recipe.value?.mapping ?? undefined,
    })
  } catch (error) {
    return {
      content: error instanceof Error ? error.message : String(error),
      columns: [],
      gridSize: 0,
      rFactor: null,
      warnings: [],
      error: true,
    }
  }
})

const previewLines = computed(() => {
  const content = exportResult.value?.content ?? ''
  return content.split('\n').slice(0, 16).join('\n')
})

const stats = computed(() => {
  if (!dif.value) return []
  return [
    { label: '曲线块', value: dif.value.blocks.length.toString(), unit: 'blocks' },
    { label: '公共网格', value: exportResult.value?.gridSize?.toLocaleString() ?? '—', unit: 'pts' },
    { label: 'Rp', value: exportResult.value?.rFactor != null ? exportResult.value.rFactor.toFixed(2) : '—', unit: '%' },
    { label: '波长', value: wavelength.value ? wavelength.value.toFixed(5) : '—', unit: 'Å' },
  ]
})

function loadDifText(text: string, name: string) {
  try {
    const parsed = parseDif(text)
    dif.value = parsed
    fileName.value = name
    selectedBlocks.value = parsed.blocks.map((b) => b.index)
    ElMessage.success(`已解析 ${parsed.blocks.length} 个数据块`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function onFile(files: File[]) {
  const file = files[0]
  if (!file) return
  loading.value = true
  try {
    const { text, warnings } = await readFileText(file)
    loadDifText(text, file.name)
    if (warnings.length) ElMessage.warning(warnings[0])
  } finally {
    loading.value = false
  }
}

async function loadSampleDif() {
  loading.value = true
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}samples/DEMO06.dif`)
    if (!response.ok) throw new Error('示例文件未找到')
    const text = await response.text()
    loadDifText(text, 'DEMO06.dif')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    loading.value = false
  }
}

function toggleBlock(index: number) {
  if (selectedBlocks.value.includes(index)) {
    selectedBlocks.value = selectedBlocks.value.filter((i) => i !== index)
  } else {
    selectedBlocks.value = [...selectedBlocks.value, index].sort((a, b) => a - b)
  }
}

async function loadRecipe(file: File) {
  try {
    const { text } = await readFileText(file)
    recipe.value = parseRecipe(text)
    ElMessage.success('已加载配方，导出时将反算回原始坐标')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

function clearRecipe() {
  recipe.value = null
}

function exportTable() {
  if (!dif.value || !exportResult.value) return
  if ('error' in exportResult.value && exportResult.value.error) {
    ElMessage.error(exportResult.value.content)
    return
  }
  const base = dif.value.title ? dif.value.title.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 50) : 'dif-export'
  const ext = exportAsCsv.value ? 'csv' : 'xy'
  const suffix = options.value.xAxis === 'invD' ? '_invD' : ''
  downloadText(
    exportResult.value.content,
    safeFilename(`${base}_${timestamp()}${suffix}`, ext),
    exportAsCsv.value ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8',
  )
  ElMessage.success('已导出，可直接在 Origin 中导入')
}
</script>

<template>
  <ToolPage
    title="DIF → XY"
    subtitle="解析 Jade 拟合导出的 DIF 多曲线，合成公共网格，导出 Origin 可用的多列数据，并按配方反算坐标。"
    eyebrow="数据处理 · 03"
    doc="/docs/userguide/dif-to-xy"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="loadSampleDif">
        <FlaskConical class="btn-icon" /> 载入 DEMO06
      </el-button>
      <el-button v-if="hasDif" size="small" type="primary" @click="exportTable">
        <Download class="btn-icon" /> 导出表格
      </el-button>
    </template>

    <template #config>
      <PanelCard title="DIF 文件" :icon="FileOutput">
        <FileDrop
          accept=".dif"
          title="拖入 Jade DIF 文件"
          hint="支持 Raw / Background / Fitted Profile / Overall 多块结构"
          @files="onFile"
        />
        <div v-if="dif" class="file-info">
          <div class="file-info__title">{{ dif.title ?? fileName }}</div>
          <div class="file-info__meta mono">
            {{ fileName }} · {{ dif.date }} {{ dif.time }} · {{ dif.mode }}
          </div>
        </div>
        <div v-if="dif" class="block-list">
          <button
            v-for="block in dif.blocks"
            :key="block.index"
            type="button"
            class="block-row"
            :class="{ 'is-selected': selectedBlocks.includes(block.index) }"
            @click="toggleBlock(block.index)"
          >
            <span class="block-dot" :style="{ background: roleColor[block.role] }" />
            <span class="block-name">{{ block.name }}</span>
            <span class="block-meta mono">{{ block.start }}–{{ block.end }}° · {{ block.points }}</span>
          </button>
          <div class="block-hint">点击可切换是否导出/绘制</div>
        </div>
      </PanelCard>

      <PanelCard title="导出设置" :icon="Table2">
        <div class="form-stack">
          <label class="field">
            <span class="field__label">输出形态</span>
            <el-select v-model="options.format" size="small">
              <el-option label="Origin 宽表（Raw/Bkg/Overall/Diff/Fit）" value="wide" />
              <el-option label="堆叠长表（X Y 段）" value="stacked" />
              <el-option label="仅差值曲线" value="diff" />
              <el-option label="单条曲线" value="single" />
            </el-select>
          </label>
          <label class="field">
            <span class="field__label">横坐标</span>
            <el-select v-model="options.xAxis" size="small">
              <el-option label="2θ（°）" value="twoTheta" />
              <el-option label="1/d（Å⁻¹）" value="invD" />
            </el-select>
          </label>
          <label class="field">
            <span class="field__label">区间外数据</span>
            <el-select v-model="options.fillOutside" size="small">
              <el-option label="补 0（推荐）" value="zero" />
              <el-option label="NaN" value="nan" />
            </el-select>
          </label>
          <div class="grid-2">
            <NumberField v-model="options.decimalsX" label="X 小数位" :min="0" :max="8" />
            <NumberField v-model="options.decimalsY" label="Y 小数位" :min="0" :max="8" />
          </div>
          <label class="inline small muted">
            <el-switch v-model="exportAsCsv" size="small" />
            CSV（逗号分隔，含列名）
          </label>
          <label class="inline small muted">
            <el-switch v-model="headerComments" size="small" />
            写入注释表头
          </label>
          <el-button type="primary" size="small" @click="exportTable">
            <Download class="btn-icon" /> 导出 {{ exportAsCsv ? '.csv' : '.xy' }}
          </el-button>
        </div>
      </PanelCard>

      <PanelCard title="配方反算" :icon="FileJson">
        <p class="small muted" style="line-height: 1.6">
          加载导入时导出的 <code>recipe.json</code>，把 Jade 归一化坐标还原为原始物理量。
        </p>
        <div v-if="recipe" class="recipe-box">
          <div class="recipe-box__name">{{ recipe.name }}</div>
          <div v-if="recipe.mapping" class="mono recipe-box__map">{{ mappingSummary(recipe.mapping) }}</div>
          <div v-if="recipe.source.xLabel" class="tiny dim">
            {{ recipe.source.xLabel }} ({{ recipe.source.xUnit }})
          </div>
          <div v-for="warning in recipeWarnings" :key="warning" class="issue issue--warning">
            <span class="issue__icon" />
            <div>{{ warning }}</div>
          </div>
          <el-button size="small" text type="danger" @click="clearRecipe">移除配方</el-button>
        </div>
        <label v-else class="recipe-upload">
          <Upload />
          <span>选择 .recipe.json</span>
          <input type="file" accept=".json,application/json" hidden @change="($event) => { const f = ($event.target as HTMLInputElement).files?.[0]; if (f) loadRecipe(f); ($event.target as HTMLInputElement).value = '' }" />
        </label>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard title="拟合质量" :icon="CheckCircle2">
        <div v-if="exportResult?.rFactor != null" class="rwp">
          <div class="rwp__value mono">{{ exportResult.rFactor.toFixed(3) }}<span>%</span></div>
          <div class="rwp__label">Rp = Σ|Yobs − Ycalc| / Σ|Yobs|</div>
          <div class="rwp__hint">
            仅使用 Raw 与 Overall 曲线，不含权重；用于快速判断拟合是否合理。
          </div>
        </div>
        <div v-else class="small dim">没有同时包含 Raw 与 Overall 曲线，无法计算 Rp。</div>
      </PanelCard>

      <PanelCard title="Origin 操作" :icon="Layers">
        <ol class="origin-steps">
          <li>Origin → File → Import → CSV，选择导出的文件。</li>
          <li>把 <code>X</code> 列设为 X（右键 → Set As → X）。</li>
          <li>选中 <code>Raw</code> 与 <code>Overall</code>，Plot → Line+Symbol。</li>
          <li><code>Diff</code> 列单独绘制，或用 B-D 作为真实差值。</li>
          <li>若加载了配方，所有列已回到原始坐标，可直接与实验条件对应。</li>
        </ol>
      </PanelCard>

      <PanelCard title="块说明" :icon="FileOutput">
        <p class="small muted" style="line-height: 1.65">
          Jade 的拟合峰块可能只覆盖局部角度范围。导出到公共网格时，区间外默认补 0；
          切换为 NaN 可在 Origin 中留下断点。
        </p>
      </PanelCard>
    </template>

    <template v-if="!hasDif">
      <EmptyState
        title="把 Jade 的拟合结果变成可绘图的数据"
        description="拖入 .dif 文件，或载入 Jade 自带的 DEMO06 示例。解析器会识别 Raw、Background、Fitted Profile 与 Overall 等数据块。"
      >
        <el-button type="primary" size="small" @click="loadSampleDif">载入 DEMO06</el-button>
        <el-button size="small" @click="$router.push('/docs/userguide/dif-to-xy')">阅读文档</el-button>
      </EmptyState>
      <PanelCard title="DIF 结构" :icon="FileOutput">
        <p class="small muted" style="line-height: 1.7">
          Jade 导出的 DIF 由「文件头 → 参数行 → Y 数据」循环组成。参数行包含起始角、步长、
          靶材、波长、终止角与点数；不同拟合块可以使用不同的角度范围。
        </p>
        <pre class="mono dif-sample">10/20/26 10:16  FIT Red Paint Pigment Mixture
 20  0.02  4 Cu 1.54056  78  2901 (Raw Pattern)
 372  403  384  390  429  418  460  401
 ...
 20  0.02  4 Cu 1.54056  78  2901 (Background)
 ...
 23.18  0.02  4 Cu 1.54056  29.12  298 (Fitted Profile 1)
 ...</pre>
      </PanelCard>
    </template>

    <template v-else>
      <div class="dif-stats">
        <div v-for="item in stats" :key="item.label" class="stat">
          <div class="stat__label">{{ item.label }}</div>
          <div class="stat__value">{{ item.value }}<span class="stat__unit">{{ item.unit }}</span></div>
        </div>
      </div>

      <PanelCard title="曲线预览" :icon="Layers" hint="点击左侧色块可切换曲线">
        <SciChart
          :series="series"
          x-label="2θ"
          x-unit="°"
          y-label="Intensity"
          y-unit="counts"
          :height="380"
        />
      </PanelCard>

      <PanelCard v-if="exportResult?.warnings.length" title="导出提示" :icon="CheckCircle2">
        <div v-for="warning in exportResult.warnings" :key="warning" class="issue issue--warning">
          <span class="issue__icon" />
          <div>{{ warning }}</div>
        </div>
      </PanelCard>

      <PanelCard title="导出预览" :icon="Table2" :hint="`${exportResult?.gridSize ?? 0} 行`">
        <pre class="mono preview">{{ previewLines }}</pre>
        <div class="btn-row" style="margin-top: 10px">
          <el-button type="primary" size="small" @click="exportTable">
            <Download class="btn-icon" /> 下载 {{ exportAsCsv ? 'CSV' : 'XY' }}
          </el-button>
          <el-button size="small" @click="$router.push('/docs/cookbook/rietveld-origin')">
            <ArrowRight class="btn-icon" /> Origin 绘图指南
          </el-button>
        </div>
      </PanelCard>
    </template>
  </ToolPage>
</template>

<style scoped>
.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 3px;
}

.file-info {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
}

.file-info__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.file-info__meta {
  margin-top: 3px;
  font-size: 9.5px;
  color: var(--text-3);
  word-break: break-all;
}

.block-list {
  margin-top: 9px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.block-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.14s, border-color 0.14s;
}

.block-row:hover {
  background: var(--surface-2);
}

.block-row.is-selected {
  border-color: var(--border);
  background: var(--surface-2);
  color: var(--text-2);
}

.block-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.block-name {
  font-size: 10.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-meta {
  margin-left: auto;
  font-size: 9px;
  color: var(--text-3);
  flex: 0 0 auto;
}

.block-hint {
  margin-top: 3px;
  font-size: 9px;
  color: var(--text-3);
}

.recipe-box {
  margin-top: 8px;
  padding: 8px 9px;
  border-radius: 6px;
  border: 1px solid var(--accent-line);
  background: var(--accent-soft);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recipe-box__name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
}

.recipe-box__map {
  font-size: 9.5px;
  color: var(--text-2);
  word-break: break-all;
}

.recipe-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 8px;
  height: 34px;
  border: 1px dashed var(--border-strong);
  border-radius: 6px;
  color: var(--text-3);
  font-size: 11px;
  cursor: pointer;
}

.recipe-upload:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.recipe-upload svg {
  width: 14px;
  height: 14px;
}

.dif-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.rwp__value {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
}

.rwp__value span {
  font-size: 12px;
  color: var(--text-3);
  margin-left: 3px;
}

.rwp__label {
  font-size: 10px;
  color: var(--text-3);
}

.rwp__hint {
  margin-top: 7px;
  font-size: 10px;
  line-height: 1.55;
  color: var(--text-3);
}

.origin-steps {
  margin: 0;
  padding-left: 17px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-2);
}

.origin-steps code {
  font-size: 10px;
}

.dif-sample {
  margin: 10px 0 0;
  padding: 11px 13px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  font-size: 10px;
  line-height: 1.65;
  color: var(--text-2);
  overflow-x: auto;
}

.preview {
  margin: 0;
  padding: 10px 12px;
  max-height: 300px;
  overflow: auto;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-2);
}

@media (max-width: 720px) {
  .dif-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
