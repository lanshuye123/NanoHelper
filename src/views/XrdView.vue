<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowRight,
  Download,
  FlaskConical,
  LineChart,
  Plus,
  Ruler,
  Sparkles,
  Table2,
  Trash2,
  TrendingUp,
} from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import SciChart, { type ChartSeries, type ChartMarker } from '@/components/chart/SciChart.vue'
import StructurePicker from '@/components/structure/StructurePicker.vue'
import { simulateXrd, scherrerSize, williamsonHall } from '@/core/diffraction/xrd'
import { ANODES } from '@/core/diffraction/scattering'
import { loadSpaceGroup } from '@/core/data/spacegroups'
import { buildXy } from '@/core/io/xy'
import { formatHkl } from '@/core/math/vec'
import { useStructureStore } from '@/stores/structure'
import { useProjectStore } from '@/stores/project'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const structureStore = useStructureStore()
const project = useProjectStore()

const anodeId = ref('Cu')
const wavelength = ref(1.54056)
const ka2Wavelength = ref(1.54439)
const ka2 = ref(true)
const twoThetaMin = ref(20)
const twoThetaMax = ref(80)
const step = ref(0.02)
const profile = ref<'gaussian' | 'lorentzian' | 'pseudoVoigt'>('pseudoVoigt')
const fwhm = ref(0.12)
const eta = ref(0.55)
const background = ref(30)
const scaleTo = ref(10000)
const zeroShift = ref(0)
const rotations = ref<number[][][]>([])
const overlay = ref(false)
const selectedReflection = ref<string | null>(null)

const whPeaks = ref<Array<{ twoTheta: number; fwhm: number }>>([
  { twoTheta: 25.3, fwhm: 0.42 },
  { twoTheta: 37.8, fwhm: 0.36 },
  { twoTheta: 48.1, fwhm: 0.31 },
  { twoTheta: 54.0, fwhm: 0.29 },
  { twoTheta: 62.7, fwhm: 0.27 },
])

const scherrerTheta = ref(25.3)
const scherrerFwhm = ref(0.42)

watch(anodeId, (id) => {
  const anode = ANODES.find((a) => a.id === id)
  if (!anode) return
  wavelength.value = anode.ka1
  ka2Wavelength.value = anode.ka2
})

watch(
  () => structureStore.current.spaceGroupNumber,
  async (number) => {
    if (!number) {
      rotations.value = []
      return
    }
    const group = await loadSpaceGroup(number)
    rotations.value = group ? group.ops.map((o) => o.r) : []
  },
  { immediate: true },
)

const result = computed(() => {
  try {
    const pattern = simulateXrd(structureStore.current, rotations.value, {
      wavelength: wavelength.value,
      twoThetaMin: twoThetaMin.value,
      twoThetaMax: twoThetaMax.value,
      step: step.value,
      profile: profile.value,
      fwhm: fwhm.value,
      eta: eta.value,
      ka2: ka2.value,
      ka2Wavelength: ka2Wavelength.value,
      background: background.value,
      scaleTo: scaleTo.value,
      zeroShift: zeroShift.value,
    })
    return { pattern, error: '' }
  } catch (error) {
    return { pattern: null, error: error instanceof Error ? error.message : String(error) }
  }
})

const pattern = computed(() => result.value.pattern)

const reflections = computed(() => {
  const p = pattern.value
  if (!p) return []
  return p.reflections.filter(
    (r) => r.twoTheta >= twoThetaMin.value - fwhm.value && r.twoTheta <= twoThetaMax.value + fwhm.value,
  )
})

const markers = computed<ChartMarker[]>(() =>
  [...reflections.value]
    .sort((a, b) => b.relIntensity - a.relIntensity)
    .slice(0, 7)
    .map((r) => ({
      x: r.twoTheta,
      label: formatHkl(r.hkl, 'none'),
      color: '#fbbf24',
    })),
)

const chartSeries = computed<ChartSeries[]>(() => {
  const series: ChartSeries[] = []
  if (pattern.value) {
    series.push({
      label: '模拟 XRD',
      x: pattern.value.x,
      y: pattern.value.y,
      color: '#22d3ee',
      width: 1.4,
      fill: true,
    })
  }
  if (overlay.value && project.derived && project.derived.meta.xLabel.includes('2θ')) {
    series.push({
      label: '实验数据',
      x: project.derived.x,
      y: project.derived.y,
      color: '#fb7185',
      width: 1,
      opacity: 0.7,
    })
  }
  return series
})

const canOverlay = computed(() => !!project.derived && project.derived.meta.xLabel.includes('2θ'))

const stats = computed(() => {
  const p = pattern.value
  if (!p) return []
  const strongest = reflections.value.reduce(
    (best, r) => (r.relIntensity > (best?.relIntensity ?? -1) ? r : best),
    undefined as (typeof reflections.value)[number] | undefined,
  )
  return [
    { label: '反射数', value: reflections.value.length.toString(), unit: 'hkl' },
    {
      label: '最强峰',
      value: strongest ? `${strongest.twoTheta.toFixed(2)}°` : '—',
      unit: strongest ? formatHkl(strongest.hkl, 'round') : '',
    },
    { label: '波长', value: wavelength.value.toFixed(5), unit: 'Å' },
    { label: '峰宽 FWHM', value: fwhm.value.toFixed(3), unit: '°' },
  ]
})

const scherrer = computed(() => scherrerSize(scherrerFwhm.value, scherrerTheta.value, wavelength.value))
const wh = computed(() => williamsonHall(whPeaks.value, wavelength.value))

const whSeries = computed<ChartSeries[]>(() => {
  const result = wh.value
  if (!result) return []
  const points = result.points
  const series: ChartSeries[] = [
    {
      label: '数据点',
      x: points.map((p) => p.sinTheta),
      y: points.map((p) => p.betaCosTheta),
      type: 'scatter',
      color: '#22d3ee',
      pointRadius: 3,
    },
  ]
  if (points.length >= 2) {
    const xs = points.map((p) => p.sinTheta)
    const min = Math.min(...xs)
    const max = Math.max(...xs)
    series.push({
      label: '线性拟合',
      x: [min, max],
      y: [result.intercept + result.slope * min, result.intercept + result.slope * max],
      color: '#fbbf24',
      width: 1.2,
      dash: [5, 4],
    })
  }
  return series
})

function addWhRow() {
  whPeaks.value.push({ twoTheta: 30, fwhm: 0.3 })
}

function removeWhRow(index: number) {
  whPeaks.value.splice(index, 1)
}

function exportXy() {
  const p = pattern.value
  if (!p) return
  try {
    const text = buildXy(
      {
        x: p.x,
        y: p.y,
        meta: {
          xLabel: '2θ',
          xUnit: '°',
          yLabel: 'Counts',
          yUnit: 'counts',
          wavelength: wavelength.value,
          anode: anodeId.value,
        },
      },
      { decimalsX: 5, decimalsY: 2, lineEnding: '\r\n' },
    )
    downloadText(
      text,
      safeFilename(`XRD_${structureStore.current.name ?? 'simulated'}_${timestamp()}`, 'xy'),
      'text/plain;charset=us-ascii',
    )
    ElMessage.success('已导出 Jade 可读 XY')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

function exportCsv() {
  const rows = reflections.value
  if (!rows.length) return
  const lines = [
    `# CrystalToolBox simulated XRD`,
    `# ${structureStore.label}, ${anodeId.value} Kα1 ${wavelength.value} Å`,
    `# 2theta range ${twoThetaMin.value}-${twoThetaMax.value}, FWHM ${fwhm.value}`,
    'h,k,l,d_A,twoTheta_deg,multiplicity,F2,rel_intensity',
  ]
  for (const r of rows) {
    lines.push(
      [r.hkl[0], r.hkl[1], r.hkl[2], r.d.toFixed(6), r.twoTheta.toFixed(5), r.multiplicity, r.f2.toExponential(4), r.relIntensity.toFixed(3)].join(','),
    )
  }
  downloadText(lines.join('\n'), safeFilename(`XRD_peaks_${timestamp()}`, 'csv'), 'text/csv;charset=utf-8')
  ElMessage.success('已导出峰表')
}
</script>

<template>
  <ToolPage
    title="XRD 模拟与分析"
    subtitle="由晶体结构计算理论粉末衍射谱：2θ、多重度、洛伦兹-偏振因子与峰型，并扩展到 Scherrer 与 Williamson–Hall 分析。"
    eyebrow="晶体学计算 · 03"
    doc="/docs/userguide/xrd"
  >
    <template #actions>
      <el-button size="small" :disabled="!pattern" @click="exportCsv">
        <Table2 class="btn-icon" /> 峰表 CSV
      </el-button>
      <el-button size="small" type="primary" :disabled="!pattern" @click="exportXy">
        <Download class="btn-icon" /> 导出 .xy
      </el-button>
    </template>

    <template #config>
      <PanelCard title="晶体结构" :icon="FlaskConical">
        <StructurePicker />
      </PanelCard>

      <PanelCard title="衍射条件" :icon="LineChart">
        <div class="form-stack">
          <label class="field">
            <span class="field__label">靶材 / 波长</span>
            <el-select v-model="anodeId" size="small" filterable>
              <el-option v-for="anode in ANODES" :key="anode.id" :label="anode.label" :value="anode.id" />
              <el-option label="自定义波长" value="custom" />
            </el-select>
          </label>
          <div v-if="anodeId === 'custom'" class="grid-2">
            <NumberField v-model="wavelength" label="Kα1" unit="Å" :precision="6" />
            <NumberField v-model="ka2Wavelength" label="Kα2" unit="Å" :precision="6" />
          </div>
          <div class="grid-3">
            <NumberField v-model="twoThetaMin" label="2θ 下限" unit="°" :min="1" :max="170" />
            <NumberField v-model="twoThetaMax" label="2θ 上限" unit="°" :min="2" :max="175" />
            <NumberField v-model="step" label="步长" unit="°" :min="0.002" :max="0.5" :precision="4" />
          </div>
          <label class="field">
            <span class="field__label">峰型</span>
            <el-select v-model="profile" size="small">
              <el-option label="伪 Voigt" value="pseudoVoigt" />
              <el-option label="高斯" value="gaussian" />
              <el-option label="洛伦兹" value="lorentzian" />
            </el-select>
          </label>
          <div class="grid-2">
            <NumberField v-model="fwhm" label="FWHM" unit="°" :min="0.001" :max="5" :precision="4" />
            <NumberField v-if="profile === 'pseudoVoigt'" v-model="eta" label="η（洛伦兹占比）" :min="0" :max="1" :precision="3" />
          </div>
          <label class="inline small muted">
            <el-switch v-model="ka2" size="small" />
            包含 Kα2 卫星峰
          </label>
          <div class="grid-2">
            <NumberField v-model="background" label="常数背底" :min="0" />
            <NumberField v-model="zeroShift" label="零点偏移" unit="°" :precision="4" />
          </div>
          <NumberField v-model="scaleTo" label="归一化最大强度" :min="1" hint="导出 Jade 时通常取 10000" />
          <label v-if="canOverlay" class="inline small muted">
            <el-switch v-model="overlay" size="small" />
            叠加当前实验数据
          </label>
        </div>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard title="峰信息" :icon="Sparkles">
        <div v-if="selectedReflection">
          <div class="mono" style="font-size: 18px; color: var(--accent)">{{ selectedReflection }}</div>
          <div class="small dim" style="margin-top: 3px">在峰表中点击其他行可切换</div>
        </div>
        <div v-else class="small dim">点击峰表中的一行查看指标。</div>
        <div class="divider" />
        <div class="kv-list mono">
          <div class="kv"><span>结构</span><span>{{ structureStore.label }}</span></div>
          <div class="kv"><span>原子数</span><span>{{ structureStore.atomCount }}</span></div>
          <div class="kv"><span>空间群</span><span>{{ structureStore.current.spaceGroupSymbol ?? '—' }}</span></div>
        </div>
      </PanelCard>

      <PanelCard title="Scherrer 晶粒尺寸" :icon="Ruler">
        <div class="grid-2">
          <NumberField v-model="scherrerTheta" label="2θ" unit="°" :min="0.5" :max="170" />
          <NumberField v-model="scherrerFwhm" label="FWHM" unit="°" :min="0.0001" :max="10" :precision="4" />
        </div>
        <div class="size-result">
          <span class="size-result__value mono">{{ Number.isFinite(scherrer) ? scherrer.toFixed(2) : '—' }}</span>
          <span class="size-result__unit">nm</span>
        </div>
        <p class="tiny dim">D = Kλ / (β cosθ)，K = 0.9，β 取弧度；未扣除仪器展宽。</p>
      </PanelCard>

      <PanelCard title="Williamson–Hall" :icon="TrendingUp">
        <div class="wh-table">
          <div class="wh-row wh-row--head">
            <span>2θ (°)</span>
            <span>FWHM (°)</span>
            <span />
          </div>
          <div v-for="(peak, index) in whPeaks" :key="index" class="wh-row">
            <input v-model.number="peak.twoTheta" class="wh-input mono" type="number" step="0.01" />
            <input v-model.number="peak.fwhm" class="wh-input mono" type="number" step="0.001" />
            <button class="wh-del" type="button" title="删除" @click="removeWhRow(index)">
              <Trash2 />
            </button>
          </div>
        </div>
        <el-button size="small" text type="primary" style="padding-left: 0" @click="addWhRow">
          <Plus class="btn-icon" /> 添加峰
        </el-button>
        <div class="wh-result">
          <div class="kv"><span>晶粒尺寸 D</span><span class="mono">{{ wh && Number.isFinite(wh.sizeNm) ? wh.sizeNm.toFixed(2) : '—' }} nm</span></div>
          <div class="kv"><span>微应变 ε</span><span class="mono">{{ wh ? (wh.strain * 100).toFixed(4) : '—' }} %</span></div>
          <div class="kv"><span>R²</span><span class="mono">{{ wh ? wh.r2.toFixed(4) : '—' }}</span></div>
        </div>
      </PanelCard>

      <PanelCard title="导出" :icon="Download">
        <div class="btn-row">
          <el-button size="small" type="primary" :disabled="!pattern" @click="exportXy">
            <Download class="btn-icon" /> .xy
          </el-button>
          <el-button size="small" :disabled="!pattern" @click="exportCsv">
            <Table2 class="btn-icon" /> 峰表
          </el-button>
        </div>
        <p class="tiny dim" style="margin-top: 7px">
          导出的 XY 可直接在 Jade 中打开；若叠加了实验数据，可在 Origin 中对比。
        </p>
      </PanelCard>
    </template>

    <div v-if="result.error" class="issue issue--error">
      <span class="issue__icon" />
      <div>{{ result.error }}</div>
    </div>

    <template v-if="pattern">
      <div class="xrd-stats">
        <div v-for="item in stats" :key="item.label" class="stat">
          <div class="stat__label">{{ item.label }}</div>
          <div class="stat__value">{{ item.value }}<span class="stat__unit">{{ item.unit }}</span></div>
        </div>
      </div>

      <PanelCard title="理论衍射谱" :icon="LineChart" :hint="`${anodeId} Kα1 · ${twoThetaMin}–${twoThetaMax}°`">
        <SciChart
          :series="chartSeries"
          x-label="2θ"
          x-unit="°"
          y-label="Counts"
          y-unit="counts"
          :height="400"
          :markers="markers"
        />
        <div v-if="pattern.warnings.length" class="warn-list">
          <div v-for="warning in pattern.warnings" :key="warning" class="issue issue--warning">
            <span class="issue__icon" />
            <div>{{ warning }}</div>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="峰表" :icon="Table2" :hint="`${reflections.length} 条反射`">
        <div class="table-wrap peak-table">
          <table class="data">
            <thead>
              <tr>
                <th>(hkl)</th>
                <th class="num">d (Å)</th>
                <th class="num">2θ (°)</th>
                <th class="num">多重度</th>
                <th class="num">|F|²</th>
                <th class="num">I (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in reflections.slice(0, 300)"
                :key="r.hkl.join(',') + r.twoTheta"
                :class="{ 'is-selected': selectedReflection === formatHkl(r.hkl, 'round') }"
                @click="selectedReflection = formatHkl(r.hkl, 'round')"
              >
                <td>{{ formatHkl(r.hkl, 'round') }}</td>
                <td class="num">{{ r.d.toFixed(5) }}</td>
                <td class="num">{{ r.twoTheta.toFixed(4) }}</td>
                <td class="num">{{ r.multiplicity }}</td>
                <td class="num">{{ r.f2.toExponential(3) }}</td>
                <td class="num">{{ r.relIntensity.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>

      <div class="two-col">
        <PanelCard title="Williamson–Hall 图" :icon="TrendingUp" hint="βcosθ vs sinθ">
          <SciChart
            :series="whSeries"
            x-label="sin θ"
            y-label="β cos θ"
            y-unit="rad"
            :height="300"
            :show-legend="true"
            :include-zero="false"
          />
        </PanelCard>
        <PanelCard title="分析提示" :icon="Sparkles">
          <ul class="tips">
            <li>峰宽需先扣除仪器展宽（用标准样测定的 FWHM–2θ 曲线）。</li>
            <li>Scherrer 只给出尺寸下限；微应变会使 W–H 出现正斜率。</li>
            <li>Kα2 未剥离时峰宽会被高估，建议先做 Kα2 剥离或固定 Kα1。</li>
            <li>若各峰宽差异很大，先检查择优取向、堆垛层错与仪器条件。</li>
          </ul>
          <el-button size="small" text type="primary" style="padding-left: 0" @click="$router.push('/docs/cookbook/scherrer')">
            <ArrowRight class="btn-icon" /> Scherrer / W–H 实战手册
          </el-button>
        </PanelCard>
      </div>
    </template>
  </ToolPage>
</template>

<style scoped>
.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 3px;
}

.xrd-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.peak-table {
  max-height: 420px;
}

.peak-table tr {
  cursor: pointer;
}

.warn-list {
  margin-top: 10px;
}

.size-result {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 10px 0 4px;
}

.size-result__value {
  font-size: 26px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
}

.size-result__unit {
  font-size: 11px;
  color: var(--text-3);
}

.wh-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wh-row {
  display: grid;
  grid-template-columns: 1fr 1fr 22px;
  gap: 5px;
  align-items: center;
}

.wh-row--head {
  font-size: 9.5px;
  color: var(--text-3);
  letter-spacing: 0.04em;
}

.wh-input {
  width: 100%;
  height: 26px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-size: 10.5px;
  outline: none;
}

.wh-input:focus {
  border-color: var(--accent);
}

.wh-del {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  border-radius: 4px;
}

.wh-del:hover {
  color: var(--danger);
  background: var(--danger-soft);
}

.wh-del svg {
  width: 12px;
  height: 12px;
}

.wh-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 9px;
  padding: 8px 9px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  font-size: 10.5px;
}

.wh-result .kv {
  display: flex;
  justify-content: space-between;
  color: var(--text-2);
}

.wh-result .kv span:first-child {
  color: var(--text-3);
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10.5px;
}

.kv {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-2);
}

.kv span:first-child {
  color: var(--text-3);
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.tips {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-2);
}

@media (max-width: 1100px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .xrd-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
