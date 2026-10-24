<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Copy,
  Download,
  FlaskConical,
  LineChart,
  Plus,
  RotateCcw,
  Ruler,
  Sparkles,
  Table2,
  Trash2,
} from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState, ResultTab } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import MathText from '@/components/common/MathText.vue'
import SciChart, { type ChartSeries } from '@/components/chart/SciChart.vue'
import { STRUCTURE_PRESETS } from '@/data/presets'
import { useStructureStore } from '@/stores/structure'
import { ANODES } from '@/core/diffraction/scattering'
import { buildLattice, dSpacing, type CellParams } from '@/core/lattice/cell'
import {
  braggTwoTheta,
  DEFAULT_REFINE_FLAGS,
  nelsonRiley,
  refineLattice,
  type RefineFlags,
  type RefinePeak,
  type RefineResult,
} from '@/core/crystallography/refine'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const store = useStructureStore()
const drawer = ref<DrawerState>('closed')
const resultTabs: ResultTab[] = ['text', 'download', 'copy']

const anodeId = ref('Cu')
const wavelength = ref(1.54056)
const initialCell = reactive<CellParams>({ ...STRUCTURE_PRESETS[0].cell, a: 5.4, b: 5.4, c: 5.4 })
const flags = reactive<RefineFlags>({ ...DEFAULT_REFINE_FLAGS })
const peaks = ref<RefinePeak[]>([])
const result = ref<RefineResult | null>(null)
const error = ref('')
const pasteText = ref('')
const presetId = ref('')

const wavelengthLabel = computed(() => {
  const anode = ANODES.find((a) => a.id === anodeId.value)
  return anode ? anode.label : '自定义'
})

const refinedParams = computed(() => {
  if (!result.value) return []
  const c = result.value.cell
  const sigma = result.value.sigma
  return [
    { key: 'a', label: 'a', value: c.a, unit: 'Å', sigma: sigma.a },
    { key: 'b', label: 'b', value: c.b, unit: 'Å', sigma: sigma.b },
    { key: 'c', label: 'c', value: c.c, unit: 'Å', sigma: sigma.c },
    { key: 'alpha', label: 'α', value: c.alpha, unit: '°', sigma: sigma.alpha },
    { key: 'beta', label: 'β', value: c.beta, unit: '°', sigma: sigma.beta },
    { key: 'gamma', label: 'γ', value: c.gamma, unit: '°', sigma: sigma.gamma },
    { key: 'zero', label: '零点 Δ', value: result.value.zero, unit: '°', sigma: sigma.zero },
  ]
})

const residualSeries = computed<ChartSeries[]>(() => {
  if (!result.value) return []
  return [
    {
      label: 'Δ2θ',
      x: result.value.peaks.map((p) => p.observed),
      y: result.value.peaks.map((p) => p.residual),
      type: 'scatter',
      color: '#dc2626',
      pointRadius: 3,
    },
    {
      label: '零线',
      x: [
        Math.min(...result.value.peaks.map((p) => p.observed)) - 0.2,
        Math.max(...result.value.peaks.map((p) => p.observed)) + 0.2,
      ],
      y: [0, 0],
      color: '#94a3b8',
      width: 1,
      dash: [5, 4],
    },
  ]
})

const nr = computed(() =>
  result.value
    ? nelsonRiley(result.value.peaks, result.value.cell, { zero: result.value.zero, wavelength: wavelength.value })
    : null,
)

const nrSeries = computed<ChartSeries[]>(() => {
  const fit = nr.value
  if (!fit) return []
  const xs = fit.points.map((p) => p.nr)
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  return [
    {
      label: 'a_obs',
      x: xs,
      y: fit.points.map((p) => p.aObs),
      type: 'scatter',
      color: '#2563eb',
      pointRadius: 3,
    },
    {
      label: 'Nelson–Riley 外推',
      x: [min, max],
      y: [fit.intercept + fit.slope * min, fit.intercept + fit.slope * max],
      color: '#d97706',
      width: 1.2,
      dash: [5, 4],
    },
  ]
})

const reportText = computed(() => {
  if (!result.value) return '尚未精修。请先填入带 hkl 的峰位，然后点击「运行精修」。'
  const r = result.value
  const lines = [
    'CrystalToolBox · 晶格参数精修',
    `波长: ${wavelength.value} Å (${wavelengthLabel.value})`,
    `峰数: ${r.peaks.length}; 迭代: ${r.iterations}`,
    `RMS(Δ2θ) = ${r.rmsDeg.toFixed(6)}°; Rwp = ${r.rwpPercent.toFixed(4)}%`,
    '',
    '【精修晶胞】',
    ...refinedParams.value
      .filter((p) => p.key !== 'zero')
      .map((p) => `${p.label} = ${p.value.toFixed(6)} ${p.unit}${p.sigma ? `  ± ${p.sigma.toFixed(6)}` : ''}`),
    `zero = ${r.zero.toFixed(6)} °${r.sigma.zero ? `  ± ${r.sigma.zero.toFixed(6)}` : ''}`,
    '',
    '【峰表】',
    'h k l\t2θ_obs\t2θ_calc\tΔ2θ\td_obs\td_calc',
    ...r.peaks.map((p) =>
      [
        p.hkl.join(' '),
        p.observed.toFixed(5),
        p.calculated.toFixed(5),
        p.residual.toFixed(5),
        p.dObs.toFixed(6),
        p.dCalc.toFixed(6),
      ].join('\t'),
    ),
    '',
    '【Nelson–Riley】',
    nr.value
      ? `a0 = ${nr.value.intercept.toFixed(6)} Å; slope = ${nr.value.slope.toFixed(6)}; R² = ${nr.value.r2.toFixed(6)}`
      : '非立方晶系或数据不足，不做 Nelson–Riley 外推。',
    ...(r.warnings.length ? ['', '【提示】', ...r.warnings] : []),
  ]
  return lines.join('\r\n')
})

function applyAnode(id: string) {
  anodeId.value = id
  const anode = ANODES.find((a) => a.id === id)
  if (anode) wavelength.value = anode.ka1
}

function applyPreset() {
  const preset = STRUCTURE_PRESETS.find((p) => p.id === presetId.value)
  if (!preset) return
  Object.assign(initialCell, preset.cell)
  if (preset.spaceGroupNumber) {
    // Only the cell is needed for refinement; keep the current peak list.
  }
}

function useCurrentStructure() {
  Object.assign(initialCell, store.current.cell)
  presetId.value = ''
}

function loadExample(silent = false) {
  const cell: CellParams = { a: 5.431, b: 5.431, c: 5.431, alpha: 90, beta: 90, gamma: 90 }
  const lattice = buildLattice(cell)
  const zero = 0.06
  const hkls: Array<[number, number, number]> = [
    [1, 1, 1],
    [2, 2, 0],
    [3, 1, 1],
    [4, 0, 0],
    [3, 3, 1],
    [4, 2, 2],
  ]
  peaks.value = hkls.map((hkl) => ({
    twoTheta: braggTwoTheta(dSpacing(lattice, hkl), wavelength.value) + zero,
    h: hkl[0],
    k: hkl[1],
    l: hkl[2],
  }))
  Object.assign(initialCell, { a: 5.4, b: 5.4, c: 5.4, alpha: 90, beta: 90, gamma: 90 })
  presetId.value = ''
  Object.assign(flags, { a: true, b: true, c: true, alpha: false, beta: false, gamma: false, zero: true })
  result.value = null
  if (!silent) ElMessage.success('已载入 Si 示例（a=5.431 Å，零点 0.06°）')
}

function addPeak() {
  peaks.value.push({ twoTheta: 30, h: 1, k: 0, l: 0 })
}

function removePeak(index: number) {
  peaks.value.splice(index, 1)
}

function runRefine() {
  error.value = ''
  if (!peaks.value.length) {
    error.value = '请至少添加一个带 hkl 的峰'
    return
  }
  try {
    result.value = refineLattice(peaks.value, initialCell, {
      wavelength: wavelength.value,
      flags,
    })
  } catch (e) {
    result.value = null
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function applyRefined() {
  if (!result.value) return
  Object.assign(initialCell, result.value.cell)
}

function parsePaste() {
  const rows: RefinePeak[] = []
  for (const line of pasteText.value.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split(/[\s,;]+/).filter(Boolean)
    if (parts.length < 4) continue
    const numbers = parts.slice(0, 4).map(Number)
    if (numbers.some((v) => !Number.isFinite(v))) continue
    rows.push({ twoTheta: numbers[0], h: Math.round(numbers[1]), k: Math.round(numbers[2]), l: Math.round(numbers[3]) })
  }
  if (!rows.length) {
    ElMessage.error('未解析到有效行；格式：2θ h k l')
    return
  }
  peaks.value = rows
  ElMessage.success(`已导入 ${rows.length} 个峰`)
}

function exportCsv() {
  if (!result.value) {
    ElMessage.warning('请先运行精修')
    return
  }
  const r = result.value
  const lines = [
    'h,k,l,twoTheta_obs,twoTheta_calc,residual,d_obs,d_calc,weight',
    ...r.peaks.map((p) =>
      [
        p.hkl[0],
        p.hkl[1],
        p.hkl[2],
        p.observed.toFixed(6),
        p.calculated.toFixed(6),
        p.residual.toFixed(6),
        p.dObs.toFixed(6),
        p.dCalc.toFixed(6),
        p.weight,
      ].join(','),
    ),
    '',
    'parameter,value,sigma',
    ...refinedParams.value.map((p) => `${p.key},${p.value.toFixed(8)},${p.sigma?.toFixed(8) ?? ''}`),
    '',
    `rms_deg,${r.rmsDeg.toFixed(8)}`,
    `rwp_percent,${r.rwpPercent.toFixed(8)}`,
    `iterations,${r.iterations}`,
  ]
  downloadText(
    '\uFEFF' + lines.join('\r\n'),
    safeFilename(`lattice_refine_${timestamp()}`, 'csv'),
    'text/csv;charset=utf-8',
  )
  ElMessage.success('已导出精修结果 CSV')
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(reportText.value)
    ElMessage.success('已复制精修报告')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}

onMounted(() => {
  loadExample(true)
  runRefine()
})
</script>

<template>
  <ToolPage
    tool-id="lattice-refine"
    title="晶格参数精修"
    subtitle="从一组带 hkl 指标的峰位出发，用非线性最小二乘同时精修晶格参数与仪器零点，并给出 Nelson–Riley 外推。"
    eyebrow="晶体几何 · 05"
    doc="/docs/userguide/lattice-refine"
    v-model:result-state="drawer"
    result-title="精修结果"
    :result-tabs="resultTabs"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" :disabled="!peaks.length" @click="runRefine">
        运行精修
      </button>
      <button type="button" class="btn" :disabled="!result" @click="drawer = 'half'">查看结果</button>
      <button type="button" class="btn" :disabled="!result" @click="exportCsv"><Download /> CSV</button>
    </template>

    <template #source>
      <PanelCard title="峰位数据" :icon="Table2" :hint="`${peaks.length} 个峰`">
        <div class="peak-editor">
          <div class="peak-head"><span>2θ (°)</span><span>h</span><span>k</span><span>l</span><span /></div>
          <div v-for="(peak, index) in peaks" :key="index" class="peak-row">
            <input v-model.number="peak.twoTheta" class="mini-input mono" type="number" step="0.001" />
            <input v-model.number="peak.h" class="mini-input mono" type="number" step="1" />
            <input v-model.number="peak.k" class="mini-input mono" type="number" step="1" />
            <input v-model.number="peak.l" class="mini-input mono" type="number" step="1" />
            <button type="button" class="row-del" title="删除" @click="removePeak(index)"><Trash2 /></button>
          </div>
        </div>
        <div class="btn-row" style="margin-top: 8px">
          <button type="button" class="btn btn--quiet" @click="addPeak"><Plus /> 添加峰</button>

          <button type="button" class="btn btn--quiet" @click="loadExample()"><RotateCcw /> 示例</button>
        </div>
      </PanelCard>
    </template>

    <template #config>
      <PanelCard title="波长与初值" :icon="FlaskConical">
        <label class="field">
          <span class="field__label">靶材</span>
          <el-select v-model="anodeId" size="small" @update:model-value="applyAnode">
            <el-option v-for="anode in ANODES" :key="anode.id" :label="anode.label" :value="anode.id" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </label>
        <NumberField v-model="wavelength" label="波长 λ" unit="Å" :min="0.01" :precision="6" />
        <div class="grid-2">
          <label class="field">
            <span class="field__label">晶胞预设</span>
            <el-select v-model="presetId" size="small" filterable @update:model-value="applyPreset">
              <el-option label="手动/当前" value="" />
              <el-option v-for="preset in STRUCTURE_PRESETS" :key="preset.id" :label="preset.name" :value="preset.id" />
            </el-select>
          </label>
          <button type="button" class="btn btn--quiet" style="align-self: end" @click="useCurrentStructure">
            当前结构
          </button>
        </div>
        <div class="grid-3">
          <NumberField v-model="initialCell.a" label="a" unit="Å" :min="0.001" :precision="5" />
          <NumberField v-model="initialCell.b" label="b" unit="Å" :min="0.001" :precision="5" />
          <NumberField v-model="initialCell.c" label="c" unit="Å" :min="0.001" :precision="5" />
        </div>
        <div class="grid-3">
          <NumberField v-model="initialCell.alpha" label="α" unit="°" :min="1" :max="179" :precision="4" />
          <NumberField v-model="initialCell.beta" label="β" unit="°" :min="1" :max="179" :precision="4" />
          <NumberField v-model="initialCell.gamma" label="γ" unit="°" :min="1" :max="179" :precision="4" />
        </div>
      </PanelCard>

      <PanelCard title="精修参数" :icon="Ruler">
        <div class="flag-grid">
          <label v-for="key in ['a', 'b', 'c', 'alpha', 'beta', 'gamma', 'zero'] as const" :key="key" class="flag">
            <el-checkbox v-model="flags[key]" size="small">{{ key === 'zero' ? '零点' : key }}</el-checkbox>
          </label>
        </div>
        <p class="tiny dim">勾选参与拟合的参数；未勾选者保持初值。峰数应明显多于自由参数数。</p>
        <button type="button" class="btn btn--primary" @click="runRefine">运行精修</button>
        <button type="button" class="btn btn--quiet" :disabled="!result" @click="applyRefined">把结果写回初值</button>
      </PanelCard>
    </template>

    <template #params>
      <PanelCard title="批量粘贴" :icon="Table2" hint="2θ h k l">
        <p class="tiny dim">每行一个峰，分隔符支持空格、逗号或 Tab；空行与 # 注释会被忽略。</p>
        <el-input v-model="pasteText" type="textarea" :rows="6" placeholder="28.44 1 1 1&#10;47.30 2 2 0" />
        <button type="button" class="btn btn--quiet" style="margin-top: 8px" @click="parsePaste">解析并替换峰表</button>
      </PanelCard>
    </template>

    <div class="summary-grid">
      <div class="metric">
        <span class="metric__label">精修 a</span
        ><span class="metric__value mono">{{ result?.cell.a.toFixed(5) ?? '—' }}</span
        ><span class="metric__unit">Å</span>
      </div>
      <div class="metric">
        <span class="metric__label">精修 c</span
        ><span class="metric__value mono">{{ result?.cell.c.toFixed(5) ?? '—' }}</span
        ><span class="metric__unit">Å</span>
      </div>
      <div class="metric">
        <span class="metric__label">零点 Δ</span
        ><span class="metric__value mono">{{ result?.zero.toFixed(5) ?? '—' }}</span
        ><span class="metric__unit">°</span>
      </div>
      <div class="metric">
        <span class="metric__label">RMS(Δ2θ)</span
        ><span class="metric__value mono">{{ result?.rmsDeg.toFixed(5) ?? '—' }}</span
        ><span class="metric__unit">°</span>
      </div>
      <div class="metric">
        <span class="metric__label">Rwp</span
        ><span class="metric__value mono">{{ result?.rwpPercent.toFixed(3) ?? '—' }}</span
        ><span class="metric__unit">%</span>
      </div>
      <div class="metric">
        <span class="metric__label">迭代</span><span class="metric__value mono">{{ result?.iterations ?? '—' }}</span
        ><span class="metric__unit"></span>
      </div>
    </div>

    <p v-if="error" class="field-error">{{ error }}</p>

    <div class="two-col">
      <PanelCard title="Δ2θ 残差" :icon="LineChart" hint="点越贴近零线越好">
        <SciChart
          v-if="residualSeries.length"
          :series="residualSeries"
          x-label="2θ"
          x-unit="°"
          y-label="Δ2θ"
          y-unit="°"
          :height="280"
          :show-legend="false"
          :include-zero="false"
        />
        <div v-else class="small dim">运行精修后显示残差。</div>
      </PanelCard>

      <PanelCard
        title="Nelson–Riley 外推"
        :icon="Sparkles"
        :hint="nr ? `a₀ = ${nr.intercept.toFixed(5)} Å` : '仅立方晶系'"
      >
        <SciChart
          v-if="nrSeries.length"
          :series="nrSeries"
          x-label="Nelson–Riley 函数"
          y-label="a"
          y-unit="Å"
          :height="280"
          :include-zero="false"
        />
        <div v-else class="small dim">非立方晶系或数据不足，不做外推。</div>
        <p v-if="nr" class="tiny dim mono" style="margin-top: 6px">
          R² = {{ nr.r2.toFixed(5) }} · slope = {{ nr.slope.toExponential(3) }}
        </p>
      </PanelCard>
    </div>

    <PanelCard title="精修晶胞与标准误差" :icon="Ruler">
      <div class="param-grid">
        <div v-for="p in refinedParams" :key="p.key" class="param">
          <span class="param__label">{{ p.label }}</span>
          <span class="param__value mono">{{ p.value.toFixed(6) }}</span>
          <span class="param__unit">{{ p.unit }}</span>
          <span v-if="p.sigma" class="param__sigma mono">± {{ p.sigma.toExponential(2) }}</span>
        </div>
      </div>
      <p class="tiny dim">标准误差由法方程协方差矩阵估计，仅反映峰位随机误差，不含系统误差。</p>
    </PanelCard>

    <PanelCard title="峰表" :icon="Table2" :hint="result ? `${result.peaks.length} 个峰` : ''">
      <div v-if="!result" class="small dim">运行精修后显示逐峰残差。</div>
      <div v-else class="table-wrap peak-table">
        <table class="data">
          <thead>
            <tr>
              <th>hkl</th>
              <th class="num">2θ obs</th>
              <th class="num">2θ calc</th>
              <th class="num">Δ2θ</th>
              <th class="num">d obs</th>
              <th class="num">d calc</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in result.peaks" :key="p.hkl.join(',')">
              <td>({{ p.hkl.join(' ') }})</td>
              <td class="num">{{ p.observed.toFixed(5) }}</td>
              <td class="num">{{ p.calculated.toFixed(5) }}</td>
              <td class="num" :style="{ color: Math.abs(p.residual) > 0.02 ? 'var(--danger)' : 'inherit' }">
                {{ p.residual.toFixed(5) }}
              </td>
              <td class="num">{{ p.dObs.toFixed(6) }}</td>
              <td class="num">{{ p.dCalc.toFixed(6) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="result" class="tiny dim" style="margin-top: 6px">
        d_obs 由未扣零点的实测 2θ 换算；d_calc 由精修晶胞计算。比较峰位时看 Δ2θ，不要直接比较两列 d。
      </p>
    </PanelCard>

    <template #text>
      <pre class="code-surface"><code>{{ reportText }}</code></pre>
    </template>

    <template #download>
      <div class="btn-row">
        <button type="button" class="btn" :disabled="!result" @click="exportCsv"><Download /> 精修 CSV</button>
      </div>
    </template>

    <template #copy>
      <div class="btn-row">
        <button type="button" class="btn" :disabled="!result" @click="copyReport"><Copy /> 复制报告</button>
      </div>
      <pre class="code-surface" style="margin-top: 10px"><code>{{ reportText }}</code></pre>
    </template>
  </ToolPage>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.metric__label {
  font-size: 9.5px;
  color: var(--text-3);
}

.metric__value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.metric__unit {
  font-size: 9.5px;
  color: var(--text-3);
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.peak-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 2px;
}

.peak-head,
.peak-row {
  display: grid;
  grid-template-columns: 1.15fr 0.6fr 0.6fr 0.6fr 22px;
  gap: 4px;
  align-items: center;
}

.peak-head {
  font-size: 9px;
  color: var(--text-3);
  letter-spacing: 0.03em;
  padding: 0 2px;
}

.mini-input {
  width: 100%;
  height: 25px;
  padding: 0 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 10.5px;
  outline: none;
}

.mini-input:focus {
  border-color: var(--accent);
}

.row-del {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}

.row-del:hover {
  color: var(--danger);
  background: var(--danger-soft);
}

.row-del svg {
  width: 12px;
  height: 12px;
}

.flag-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 8px;
}

.param-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.param {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 9px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
}

.param__label {
  font-size: 9.5px;
  color: var(--text-3);
}

.param__value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.param__unit {
  font-size: 9px;
  color: var(--text-3);
}

.param__sigma {
  font-size: 9px;
  color: var(--text-3);
}

.peak-table {
  max-height: 340px;
}

@media (max-width: 1180px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .two-col {
    grid-template-columns: 1fr;
  }

  .param-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
