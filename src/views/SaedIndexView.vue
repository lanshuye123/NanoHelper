<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Atom, Camera, Copy, Download, Grid3x3, Info, Ruler, ScanLine, Sparkles } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState, ResultTab } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import MathText from '@/components/common/MathText.vue'
import DiffractionCanvas, { type DiffractionPoint } from '@/components/chart/DiffractionCanvas.vue'
import { STRUCTURE_PRESETS } from '@/data/presets'
import { useStructureStore } from '@/stores/structure'
import { buildLattice, type CellParams } from '@/core/lattice/cell'
import { getSpaceGroupMeta, loadSpaceGroup, toSymOps } from '@/core/data/spacegroups'
import type { SymOp } from '@/core/crystallography/symmetry'
import { formatHkl } from '@/core/math/vec'
import { electronState } from '@/core/micro/tem'
import {
  calibrateCameraConstant,
  dFromRadius,
  formatZoneAxis,
  indexSaedPattern,
  indexSingleSpot,
  patternForCandidate,
  type IndexCandidate,
  type SingleSpotCandidate,
} from '@/core/micro/saedIndex'
import { downloadText, safeFilename, timestamp } from '@/utils/download'
import { useToolDraft } from '@/composables/useToolDraft'

const store = useStructureStore()
const drawer = ref<DrawerState>('closed')
const resultTabs: ResultTab[] = ['text', 'download', 'copy']

const sourceMode = ref<'preset' | 'manual'>('preset')
const presetId = ref(STRUCTURE_PRESETS[0].id)
const cell = reactive<CellParams>({ ...STRUCTURE_PRESETS[0].cell })
const sgNumber = ref(STRUCTURE_PRESETS[0].spaceGroupNumber ?? 225)
const ops = ref<SymOp[]>([])
const sgError = ref('')

const measureMode = ref<'R' | 'd'>('R')
const voltageKv = ref(200)
const cameraLengthMm = ref(800)
const cameraConstant = ref(0)
const r1 = ref(6.398)
const r2 = ref(10.449)
const d1Input = ref(2.5)
const d2Input = ref(2.5)
const angleDeg = ref(35.264)
const dTolerancePercent = ref(3)
const angleTolerance = ref(3)
const maxIndex = ref(5)

const knownR = ref(10)
const knownD = ref(2.355)
const candidates = ref<IndexCandidate[]>([])
const selectedIndex = ref(0)
const runError = ref('')
const hasRun = ref(false)

const draft = useToolDraft({
  toolId: 'saed-index',
  defaults: () => ({
    sourceMode: 'preset' as 'preset' | 'manual',
    presetId: STRUCTURE_PRESETS[0].id,
    cell: { ...STRUCTURE_PRESETS[0].cell },
    sgNumber: STRUCTURE_PRESETS[0].spaceGroupNumber ?? 225,
    measureMode: 'R' as 'R' | 'd',
    voltageKv: 200,
    cameraLengthMm: 800,
    cameraConstant: 0,
    r1: 6.398,
    r2: 10.449,
    d1Input: 2.5,
    d2Input: 2.5,
    angleDeg: 35.264,
    dTolerancePercent: 3,
    angleTolerance: 3,
    maxIndex: 5,
    knownR: 10,
    knownD: 2.355,
    candidates: [] as IndexCandidate[],
    selectedIndex: 0,
    hasRun: false,
  }),
  snapshot: () => ({
    sourceMode: sourceMode.value,
    presetId: presetId.value,
    cell: { ...cell },
    sgNumber: sgNumber.value,
    measureMode: measureMode.value,
    voltageKv: voltageKv.value,
    cameraLengthMm: cameraLengthMm.value,
    cameraConstant: cameraConstant.value,
    r1: r1.value,
    r2: r2.value,
    d1Input: d1Input.value,
    d2Input: d2Input.value,
    angleDeg: angleDeg.value,
    dTolerancePercent: dTolerancePercent.value,
    angleTolerance: angleTolerance.value,
    maxIndex: maxIndex.value,
    knownR: knownR.value,
    knownD: knownD.value,
    candidates: candidates.value.map((candidate) => ({ ...candidate })),
    selectedIndex: selectedIndex.value,
    hasRun: hasRun.value,
  }),
  restore: (data) => {
    sourceMode.value = data.sourceMode === 'manual' ? 'manual' : 'preset'
    presetId.value = data.presetId
    Object.assign(cell, data.cell)
    sgNumber.value = data.sgNumber
    measureMode.value = data.measureMode === 'd' ? 'd' : 'R'
    voltageKv.value = data.voltageKv
    cameraLengthMm.value = data.cameraLengthMm
    cameraConstant.value = data.cameraConstant
    r1.value = data.r1
    r2.value = data.r2
    d1Input.value = data.d1Input
    d2Input.value = data.d2Input
    angleDeg.value = data.angleDeg
    dTolerancePercent.value = data.dTolerancePercent
    angleTolerance.value = data.angleTolerance
    maxIndex.value = data.maxIndex
    knownR.value = data.knownR
    knownD.value = data.knownD
    candidates.value = Array.isArray(data.candidates) ? data.candidates.map((candidate) => ({ ...candidate })) : []
    selectedIndex.value = Math.max(0, Math.round(data.selectedIndex))
    hasRun.value = Boolean(data.hasRun)
  },
})

function resetAll() {
  draft.reset()
  candidates.value = []
  selectedIndex.value = 0
  hasRun.value = false
  runError.value = ''
}

async function clearPage() {
  try {
    await ElMessageBox.confirm('将清空本页的晶胞、衍射条件、实测斑点、候选结果和自动保存记录；不会重置其他页面共用的晶体结构。确定继续？', '清空本页', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  draft.clear()
  candidates.value = []
  selectedIndex.value = 0
  hasRun.value = false
  runError.value = ''
  ElMessage.success('已清空本页')
}

watch(
  voltageKv,
  () => {
    cameraConstant.value = electronState(voltageKv.value).wavelength * cameraLengthMm.value
  },
  { immediate: true },
)

watch(cameraLengthMm, () => {
  cameraConstant.value = electronState(voltageKv.value).wavelength * cameraLengthMm.value
})

watch(
  () => store.current.spaceGroupNumber,
  (n) => {
    if (n) sgNumber.value = n
  },
)

watch(
  sgNumber,
  async (n) => {
    const group = await loadSpaceGroup(n)
    sgError.value = ''
    if (!group) {
      ops.value = []
      sgError.value = `未找到空间群 #${n}`
      return
    }
    ops.value = toSymOps(group)
  },
  { immediate: true },
)

const sgMeta = computed(() => getSpaceGroupMeta(sgNumber.value))
const lattice = computed(() => {
  try {
    return buildLattice(cell)
  } catch {
    return null
  }
})

const d1 = computed(() => (measureMode.value === 'R' ? dFromRadius(r1.value, cameraConstant.value) : d1Input.value))
const d2 = computed(() => (measureMode.value === 'R' ? dFromRadius(r2.value, cameraConstant.value) : d2Input.value))

const selected = computed(() => candidates.value[selectedIndex.value] ?? null)
const single1 = computed<SingleSpotCandidate[]>(() => {
  if (!lattice.value) return []
  return indexSingleSpot(lattice.value, d1.value, {
    maxIndex: maxIndex.value,
    dTolerance: dTolerancePercent.value / 100,
    ops: ops.value,
  }).slice(0, 12)
})
const single2 = computed<SingleSpotCandidate[]>(() => {
  if (!lattice.value) return []
  return indexSingleSpot(lattice.value, d2.value, {
    maxIndex: maxIndex.value,
    dTolerance: dTolerancePercent.value / 100,
    ops: ops.value,
  }).slice(0, 12)
})

const patternPoints = computed<DiffractionPoint[]>(() => {
  const c = selected.value
  if (!lattice.value || !c) return []
  const g1 = 1 / c.d1
  const g2 = 1 / c.d2
  const rad = (c.angleDeg * Math.PI) / 180
  const points: DiffractionPoint[] = [
    {
      x: g1,
      y: 0,
      label: 'R1',
      color: '#f59e0b',
      intensity: 100,
      meta: `${formatHkl(c.hkl1)} · d=${c.d1.toFixed(4)} Å`,
    },
    {
      x: g2 * Math.cos(rad),
      y: g2 * Math.sin(rad),
      label: 'R2',
      color: '#f59e0b',
      intensity: 100,
      meta: `${formatHkl(c.hkl2)} · d=${c.d2.toFixed(4)} Å`,
    },
  ]
  const sim = patternForCandidate(lattice.value, c, Math.max(0.8, Math.max(g1, g2) * 1.3))
  for (const p of sim) {
    if (p.isCenter) continue
    const order = Math.abs(p.hkl[0]) + Math.abs(p.hkl[1]) + Math.abs(p.hkl[2])
    points.push({
      x: p.x,
      y: p.y,
      label: order <= 2 ? formatHkl(p.hkl, 'none') : '',
      intensity: Math.max(25, 90 - order * 8),
      muted: false,
      meta: `d=${p.d.toFixed(4)} Å`,
    })
  }
  return points
})

const maxR = computed(() => {
  const c = selected.value
  const base = c ? Math.max(1 / c.d1, 1 / c.d2) : 0.6
  const simMax = patternPoints.value.reduce((m, p) => Math.max(m, Math.hypot(p.x, p.y)), 0)
  return Math.max(0.5, base, simMax) * 1.12
})

const summary = computed(() => {
  const c = selected.value
  if (!c) return []
  return [
    { label: '候选 d₁', value: c.d1.toFixed(5), unit: 'Å' },
    { label: '候选 d₂', value: c.d2.toFixed(5), unit: 'Å' },
    { label: '两矢夹角', value: c.angleDeg.toFixed(3), unit: '°' },
    { label: '带轴', value: formatZoneAxis(c.zone), unit: '' },
    { label: 'Δd₁ / Δd₂', value: `${(c.deltaD1Rel * 100).toFixed(2)} / ${(c.deltaD2Rel * 100).toFixed(2)}`, unit: '%' },
    { label: 'Δ角', value: c.deltaAngle.toFixed(3), unit: '°' },
  ]
})

const reportText = computed(() => {
  if (!hasRun.value) return '尚未指标化。输入两个衍射斑的 R（或 d）与夹角，然后点击「开始指标化」。'
  if (!candidates.value.length) return '没有找到满足容差的候选，请放宽 d/角度容差或增大最大指数。'
  const lines = [
    'CrystalToolBox · SAED 指标化',
    `晶胞: a=${cell.a}, b=${cell.b}, c=${cell.c}, α=${cell.alpha}, β=${cell.beta}, γ=${cell.gamma}`,
    `空间群 #${sgNumber.value} ${sgMeta.value?.symbol ?? ''}`,
    `测量: R1=${r1.value} mm, R2=${r2.value} mm, 夹角=${angleDeg.value}°, Lλ=${cameraConstant.value.toFixed(4)} mm·Å`,
    `由此 d1=${d1.value.toFixed(6)} Å, d2=${d2.value.toFixed(6)} Å`,
    '',
    '【候选（前 20）】',
    'hkl1\thkl2\tzone\td1\td2\tangle\tΔd1%\tΔd2%\tΔangle\tscore\tallowed',
    ...candidates.value
      .slice(0, 20)
      .map((c) =>
        [
          formatHkl(c.hkl1, 'none'),
          formatHkl(c.hkl2, 'none'),
          formatZoneAxis(c.zone),
          c.d1.toFixed(5),
          c.d2.toFixed(5),
          c.angleDeg.toFixed(3),
          (c.deltaD1Rel * 100).toFixed(3),
          (c.deltaD2Rel * 100).toFixed(3),
          c.deltaAngle.toFixed(3),
          c.score.toFixed(3),
          c.allowed ? 'yes' : 'no',
        ].join('\t'),
      ),
  ]
  return lines.join('\r\n')
})

function applyPreset(id: string) {
  const preset = STRUCTURE_PRESETS.find((p) => p.id === id)
  if (!preset) return
  Object.assign(cell, preset.cell)
  presetId.value = preset.id
  if (preset.spaceGroupNumber) sgNumber.value = preset.spaceGroupNumber
}

function useCurrentStructure() {
  Object.assign(cell, store.current.cell)
  if (store.current.spaceGroupNumber) sgNumber.value = store.current.spaceGroupNumber
  sourceMode.value = 'preset'
}

function calibrateFromKnown() {
  const value = calibrateCameraConstant(knownR.value, knownD.value)
  if (!Number.isFinite(value) || value <= 0) {
    ElMessage.error('无法标定：请检查 R 与 d')
    return
  }
  cameraConstant.value = value
  measureMode.value = 'R'
  ElMessage.success(`Lλ = ${value.toFixed(4)} mm·Å`)
}

function runIndex() {
  runError.value = ''
  hasRun.value = true
  const l = lattice.value
  if (!l) {
    runError.value = '晶胞参数无效'
    candidates.value = []
    return
  }
  if (!(d1.value > 0) || !(d2.value > 0)) {
    runError.value = 'd₁ / d₂ 必须为正数；请检查 R、Lλ 或直接输入 d'
    candidates.value = []
    return
  }
  try {
    candidates.value = indexSaedPattern(l, d1.value, d2.value, angleDeg.value, {
      maxIndex: maxIndex.value,
      dTolerance: dTolerancePercent.value / 100,
      angleTolerance: angleTolerance.value,
      ops: ops.value,
      checkExtinction: true,
    })
    selectedIndex.value = 0
    if (!candidates.value.length) ElMessage.warning('没有匹配候选；可适当放宽容差')
    else ElMessage.success(`找到 ${candidates.value.length} 个候选`)
  } catch (e) {
    runError.value = e instanceof Error ? e.message : String(e)
    candidates.value = []
  }
}

function selectCandidate(index: number) {
  selectedIndex.value = index
}

function exportCsv() {
  if (!candidates.value.length) {
    ElMessage.warning('请先运行指标化')
    return
  }
  const lines = [
    'h1,k1,l1,h2,k2,l2,u,v,w,d1,d2,angle,delta_d1,delta_d2,delta_angle,score,allowed',
    ...candidates.value.map((c) =>
      [
        ...c.hkl1,
        ...c.hkl2,
        ...c.zone,
        c.d1.toFixed(6),
        c.d2.toFixed(6),
        c.angleDeg.toFixed(5),
        c.deltaD1Rel.toFixed(6),
        c.deltaD2Rel.toFixed(6),
        c.deltaAngle.toFixed(5),
        c.score.toFixed(6),
        c.allowed ? 1 : 0,
      ].join(','),
    ),
  ]
  downloadText(
    '\uFEFF' + lines.join('\r\n'),
    safeFilename(`saed_index_${timestamp()}`, 'csv'),
    'text/csv;charset=utf-8',
  )
  ElMessage.success('已导出候选表 CSV')
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(reportText.value)
    ElMessage.success('已复制指标化报告')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}
</script>

<template>
  <ToolPage
    tool-id="saed-index"
    title="SAED 指标化"
    subtitle="从实验电子衍射图上量取两个斑点的 R 与夹角，反算 d 值并枚举满足晶带关系的 (hkl)₁/(hkl)₂ 与带轴，自动检查系统消光。"
    doc="/docs/userguide/saed-index"
    v-model:result-state="drawer"
    result-title="SAED 指标化结果"
    :result-tabs="resultTabs"
    :saved-at="draft.savedAt"
    :restored="draft.restored"
    :state-error="draft.error"
    @reset="resetAll"
    @clear="clearPage"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" @click="runIndex"><ScanLine /> 开始指标化</button>
      <button type="button" class="btn" :disabled="!candidates.length" @click="drawer = 'half'">查看结果</button>
      <button type="button" class="btn" :disabled="!candidates.length" @click="exportCsv"><Download /> CSV</button>
    </template>

    <template #source>
      <PanelCard title="晶体与晶胞" :icon="Atom">
        <div class="segmented" role="tablist">
          <button
            type="button"
            class="segmented__btn"
            :aria-selected="sourceMode === 'preset'"
            @click="sourceMode = 'preset'"
          >
            预设/当前
          </button>
          <button
            type="button"
            class="segmented__btn"
            :aria-selected="sourceMode === 'manual'"
            @click="sourceMode = 'manual'"
          >
            手动晶胞
          </button>
        </div>
        <div v-if="sourceMode === 'preset'" class="grid-2" style="margin-top: 8px">
          <label class="field">
            <span class="field__label">结构预设</span>
            <el-select v-model="presetId" size="small" filterable @update:model-value="applyPreset">
              <el-option
                v-for="preset in STRUCTURE_PRESETS"
                :key="preset.id"
                :label="`${preset.name} (${preset.formula})`"
                :value="preset.id"
              />
            </el-select>
          </label>
          <button type="button" class="btn btn--quiet" style="align-self: end" @click="useCurrentStructure">
            当前结构
          </button>
        </div>
        <div class="grid-3" style="margin-top: 8px">
          <NumberField v-model="cell.a" label="a" unit="Å" :min="0.001" :precision="5" />
          <NumberField v-model="cell.b" label="b" unit="Å" :min="0.001" :precision="5" />
          <NumberField v-model="cell.c" label="c" unit="Å" :min="0.001" :precision="5" />
        </div>
        <div class="grid-3">
          <NumberField v-model="cell.alpha" label="α" unit="°" :min="1" :max="179" :precision="4" />
          <NumberField v-model="cell.beta" label="β" unit="°" :min="1" :max="179" :precision="4" />
          <NumberField v-model="cell.gamma" label="γ" unit="°" :min="1" :max="179" :precision="4" />
        </div>
      </PanelCard>
    </template>

    <template #config>
      <PanelCard title="测量输入" :icon="Ruler">
        <div class="segmented" role="tablist">
          <button type="button" class="segmented__btn" :aria-selected="measureMode === 'R'" @click="measureMode = 'R'">
            R / Lλ
          </button>
          <button type="button" class="segmented__btn" :aria-selected="measureMode === 'd'" @click="measureMode = 'd'">
            直接 d
          </button>
        </div>
        <template v-if="measureMode === 'R'">
          <div class="grid-2">
            <NumberField v-model="r1" label="R₁" unit="mm" :min="0.001" :precision="4" />
            <NumberField v-model="r2" label="R₂" unit="mm" :min="0.001" :precision="4" />
          </div>
          <NumberField v-model="cameraConstant" label="相机常数 Lλ" unit="mm·Å" :min="0.001" :precision="5" />
        </template>
        <div v-else class="grid-2">
          <NumberField v-model="d1Input" label="d₁" unit="Å" :min="0.001" :precision="6" />
          <NumberField v-model="d2Input" label="d₂" unit="Å" :min="0.001" :precision="6" />
        </div>
        <NumberField v-model="angleDeg" label="两矢量夹角" unit="°" :min="0" :max="180" :precision="3" />
        <div class="grid-3">
          <NumberField v-model="dTolerancePercent" label="d 容差" unit="%" :min="0.01" :max="20" :precision="2" />
          <NumberField v-model="angleTolerance" label="角度容差" unit="°" :min="0.01" :max="20" :precision="2" />
          <NumberField v-model="maxIndex" label="最大指数" :min="1" :max="10" :precision="0" />
        </div>
        <div class="derived-box">
          <div class="kv">
            <span>d₁</span><span class="mono">{{ d1.toFixed(5) }} Å</span>
          </div>
          <div class="kv">
            <span>d₂</span><span class="mono">{{ d2.toFixed(5) }} Å</span>
          </div>
        </div>
        <button type="button" class="btn btn--primary" @click="runIndex">开始指标化</button>
      </PanelCard>

      <PanelCard title="相机常数标定" :icon="Camera">
        <div class="grid-2">
          <NumberField v-model="voltageKv" label="加速电压" unit="kV" :min="1" :max="1000" :precision="1" />
          <NumberField v-model="cameraLengthMm" label="相机长度" unit="mm" :min="1" :precision="2" />
        </div>
        <div class="kv">
          <span>Lλ</span><span class="mono">{{ cameraConstant.toFixed(4) }} mm·Å</span>
        </div>
        <div class="grid-2" style="margin-top: 8px">
          <NumberField v-model="knownR" label="标样 R" unit="mm" :min="0.001" :precision="4" />
          <NumberField v-model="knownD" label="标样 d" unit="Å" :min="0.001" :precision="5" />
        </div>
        <button type="button" class="btn btn--quiet" @click="calibrateFromKnown">用 R·d 标定 Lλ</button>
        <p class="tiny dim">常用标样：Au (111) d=2.355 Å，Si (111) d=3.136 Å。</p>
      </PanelCard>
    </template>

    <template #params>
      <PanelCard title="消光检查" :icon="Info">
        <NumberField v-model="sgNumber" label="空间群编号" :min="1" :max="230" :precision="0" />
        <div class="index-line">
          <span class="chip chip--mono">#{{ sgNumber }}</span>
          <span class="chip">{{ sgMeta?.symbol ?? '—' }}</span>
        </div>
        <p v-if="sgError" class="tiny" style="color: var(--danger)">{{ sgError }}</p>
        <p class="tiny dim">指标化时会用空间群全部对称操作排除系统消光；如只关心几何，可忽略 allowed 列。</p>
      </PanelCard>
    </template>

    <div class="summary-grid">
      <div v-for="item in summary" :key="item.label" class="metric">
        <span class="metric__label">{{ item.label }}</span>
        <span class="metric__value mono">{{ item.value }}</span>
        <span class="metric__unit">{{ item.unit }}</span>
      </div>
    </div>

    <p v-if="runError" class="field-error">{{ runError }}</p>

    <div class="two-col">
      <PanelCard
        title="候选叠加图"
        :icon="Grid3x3"
        :hint="selected ? `${formatHkl(selected.hkl1)} / ${formatHkl(selected.hkl2)}` : '橙色为测量矢量'"
      >
        <DiffractionCanvas
          v-if="patternPoints.length"
          :points="patternPoints"
          :max-r="maxR"
          :height="420"
          unit="Å⁻¹"
          caption="橙色：R1/R2 测量方向；灰色：候选带轴的倒易点"
        />
        <div v-else class="small dim">运行指标化后显示候选叠加图。</div>
      </PanelCard>

      <PanelCard title="首选候选" :icon="Sparkles">
        <div v-if="!selected" class="small dim">尚无候选。</div>
        <template v-else>
          <div class="candidate-hero">
            <span class="candidate-hero__label">带轴</span>
            <span class="candidate-hero__zone mono">{{ formatZoneAxis(selected.zone) }}</span>
            <span class="chip" :class="selected.allowed ? 'chip--ok' : 'chip--warn'">{{
              selected.allowed ? '消光允许' : '含消光反射'
            }}</span>
          </div>
          <div class="kv-list">
            <div class="kv">
              <span>(hkl)₁</span><span>{{ formatHkl(selected.hkl1) }} · d={{ selected.d1.toFixed(5) }} Å</span>
            </div>
            <div class="kv">
              <span>(hkl)₂</span><span>{{ formatHkl(selected.hkl2) }} · d={{ selected.d2.toFixed(5) }} Å</span>
            </div>
            <div class="kv">
              <span>夹角</span><span>{{ selected.angleDeg.toFixed(4) }}°（测 {{ angleDeg }}°）</span>
            </div>
            <div class="kv">
              <span>偏差</span
              ><span
                >{{ (selected.deltaD1Rel * 100).toFixed(2) }}% / {{ (selected.deltaD2Rel * 100).toFixed(2) }}% /
                {{ selected.deltaAngle.toFixed(2) }}°</span
              >
            </div>
            <div class="kv">
              <span>评分</span><span>{{ selected.score.toFixed(3) }}</span>
            </div>
          </div>
          <div class="formula-line">
            <MathText tex="d = \frac{L\lambda}{R}" block />
            <MathText tex="[uvw] = g_1 \times g_2" block />
          </div>
          <p class="tiny dim">带轴符号存在 ± 与等价方向；可结合样品倾转和已知物相进一步确认。</p>
        </template>
      </PanelCard>
    </div>

    <PanelCard v-if="hasRun" title="候选列表" :icon="Grid3x3" :hint="`${candidates.length} 个候选`">
      <div v-if="!candidates.length" class="small dim">没有满足容差的候选。</div>
      <div v-else class="table-wrap candidate-table">
        <table class="data">
          <thead>
            <tr>
              <th>#</th>
              <th>(hkl)₁</th>
              <th>(hkl)₂</th>
              <th>带轴</th>
              <th class="num">d₁</th>
              <th class="num">d₂</th>
              <th class="num">夹角</th>
              <th class="num">Δd₁%</th>
              <th class="num">Δd₂%</th>
              <th class="num">Δ角</th>
              <th>消光</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(c, index) in candidates"
              :key="`${c.hkl1}-${c.hkl2}-${c.zone}`"
              :class="{ 'is-selected': index === selectedIndex }"
              @click="selectCandidate(index)"
            >
              <td>{{ index + 1 }}</td>
              <td>{{ formatHkl(c.hkl1) }}</td>
              <td>{{ formatHkl(c.hkl2) }}</td>
              <td>{{ formatZoneAxis(c.zone) }}</td>
              <td class="num">{{ c.d1.toFixed(4) }}</td>
              <td class="num">{{ c.d2.toFixed(4) }}</td>
              <td class="num">{{ c.angleDeg.toFixed(2) }}</td>
              <td class="num">{{ (c.deltaD1Rel * 100).toFixed(2) }}</td>
              <td class="num">{{ (c.deltaD2Rel * 100).toFixed(2) }}</td>
              <td class="num">{{ c.deltaAngle.toFixed(2) }}</td>
              <td class="text">{{ c.allowed ? '允许' : '禁戒' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PanelCard>

    <div v-if="hasRun" class="two-col">
      <PanelCard title="单斑 d 值候选" :icon="Ruler" :hint="`d₁ = ${d1.toFixed(4)} Å`">
        <div class="table-wrap mini-table">
          <table class="data">
            <thead>
              <tr>
                <th>hkl</th>
                <th class="num">d</th>
                <th class="num">Δd</th>
                <th>消光</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in single1" :key="s.hkl.join(',')">
                <td>{{ formatHkl(s.hkl) }}</td>
                <td class="num">{{ s.d.toFixed(5) }}</td>
                <td class="num">{{ (s.deltaRel * 100).toFixed(2) }}%</td>
                <td class="text">{{ s.allowed ? '允许' : '禁戒' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>
      <PanelCard title="单斑 d 值候选" :icon="Ruler" :hint="`d₂ = ${d2.toFixed(4)} Å`">
        <div class="table-wrap mini-table">
          <table class="data">
            <thead>
              <tr>
                <th>hkl</th>
                <th class="num">d</th>
                <th class="num">Δd</th>
                <th>消光</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in single2" :key="s.hkl.join(',')">
                <td>{{ formatHkl(s.hkl) }}</td>
                <td class="num">{{ s.d.toFixed(5) }}</td>
                <td class="num">{{ (s.deltaRel * 100).toFixed(2) }}%</td>
                <td class="text">{{ s.allowed ? '允许' : '禁戒' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>

    <template #text>
      <pre class="code-surface"><code>{{ reportText }}</code></pre>
    </template>

    <template #download>
      <div class="btn-row">
        <button type="button" class="btn" :disabled="!candidates.length" @click="exportCsv">
          <Download /> 候选表 CSV
        </button>
      </div>
    </template>

    <template #copy>
      <div class="btn-row">
        <button type="button" class="btn" :disabled="!candidates.length" @click="copyReport"><Copy /> 复制报告</button>
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.index-line {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 8px 0;
}

.derived-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
  padding: 8px 9px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  font-size: 10.5px;
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
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

.formula-line {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.candidate-hero {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.candidate-hero__label {
  font-size: 10px;
  color: var(--text-3);
}

.candidate-hero__zone {
  font-size: 26px;
  font-weight: 750;
  color: var(--accent);
  letter-spacing: -0.02em;
}

.candidate-table {
  max-height: 380px;
}

.candidate-table tr {
  cursor: pointer;
}

.mini-table {
  max-height: 250px;
}

@media (max-width: 1180px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
