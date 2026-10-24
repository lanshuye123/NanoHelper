<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleDot, Download, ImageDown, Ruler, ScanLine, Sparkles, Table2 } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import RingCanvas from '@/components/chart/RingCanvas.vue'
import StructurePicker from '@/components/structure/StructurePicker.vue'
import { loadSpaceGroup } from '@/core/data/spacegroups'
import {
  calibrateCameraConstantFromRings,
  indexRingValues,
  simulateSaedRings,
  type RingMatch,
} from '@/core/diffraction/saedRings'
import { formatHkl } from '@/core/math/vec'
import { useStructureStore } from '@/stores/structure'
import { useToolDraft } from '@/composables/useToolDraft'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const structureStore = useStructureStore()
const drawer = ref<DrawerState>('closed')

const voltageKv = ref(200)
const cameraLengthMm = ref(800)
const maxG = ref(0.8)
const crystalliteSizeNm = ref(20)
const minIntensityRel = ref(0)
const showLabels = ref(true)
const showMeasured = ref(true)
const measureMode = ref<'R' | 'd'>('R')
const measuredText = ref('')
const tolerancePercent = ref(3)
const rotations = ref<number[][][]>([])

watch(
  () => structureStore.current.spaceGroupNumber,
  async (number) => {
    if (!number) {
      rotations.value = []
      return
    }
    const group = await loadSpaceGroup(number)
    rotations.value = group ? group.ops.map((op) => op.r) : []
  },
  { immediate: true },
)

const result = computed(() => {
  try {
    const pattern = simulateSaedRings(structureStore.current, {
      voltageKv: voltageKv.value,
      cameraLengthMm: cameraLengthMm.value,
      maxG: maxG.value,
      rotations: rotations.value,
      crystalliteSizeNm: crystalliteSizeNm.value,
      minIntensityRel: minIntensityRel.value,
    })
    return { pattern, error: '' }
  } catch (error) {
    return { pattern: null, error: error instanceof Error ? error.message : String(error) }
  }
})

const pattern = computed(() => result.value.pattern)

const measuredValues = computed(() => {
  return measuredText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)
      return match ? Number(match[0]) : NaN
    })
    .filter((value) => Number.isFinite(value) && value > 0)
})

const matches = computed<RingMatch[]>(() => {
  const p = pattern.value
  if (!p || !measuredValues.value.length) return []
  return indexRingValues(p, measuredValues.value, measureMode.value, tolerancePercent.value)
})

const calibratedConstant = computed(() => {
  const p = pattern.value
  if (!p || measureMode.value !== 'R' || !measuredValues.value.length) return NaN
  return calibrateCameraConstantFromRings(p, measuredValues.value, tolerancePercent.value)
})

const stats = computed(() => {
  const p = pattern.value
  if (!p) return []
  const first = p.rings[0]
  return [
    { label: '衍射环数', value: String(p.rings.length), unit: 'rings' },
    { label: '第一环 d', value: first ? first.d.toFixed(3) : '—', unit: 'Å' },
    { label: '相机常数', value: p.cameraConstant.toFixed(3), unit: 'mm·Å' },
    { label: '最大 R', value: p.maxRadiusMm.toFixed(1), unit: 'mm' },
  ]
})

const ringTable = computed(() => pattern.value?.rings ?? [])

const ringText = computed(() => {
  const p = pattern.value
  if (!p) return ''
  const head = `${'hkl'.padEnd(12)}${'d(Å)'.padStart(10)}${'|g|'.padStart(10)}${'m'.padStart(5)}${'I(%)'.padStart(8)}${'R(mm)'.padStart(9)}`
  const rows = p.rings.map((ring) =>
    [
      formatHkl(ring.hkl, 'round').padEnd(12),
      ring.d.toFixed(5).padStart(10),
      ring.g.toFixed(4).padStart(10),
      String(ring.multiplicity).padStart(5),
      ring.relIntensity.toFixed(1).padStart(8),
      ring.radiusMm.toFixed(3).padStart(9),
    ].join(''),
  )
  return [head, ...rows].join('\n')
})

const matchText = computed(() => {
  if (!matches.value.length) return '尚未输入实测环半径。'
  const head = `${'实测'.padStart(10)}${'d(Å)'.padStart(10)}${'hkl'.padStart(14)}${'Δd(%)'.padStart(9)}${'匹配'.padStart(6)}`
  const rows = matches.value.map((match) =>
    [
      match.measured.toFixed(3).padStart(10),
      match.d.toFixed(5).padStart(10),
      (match.ring ? formatHkl(match.ring.hkl, 'round') : '—').padStart(14),
      match.deltaPercent.toFixed(2).padStart(9),
      (match.matched ? '是' : '否').padStart(6),
    ].join(''),
  )
  return [head, ...rows].join('\n')
})

const defaults = () => ({
  voltageKv: 200,
  cameraLengthMm: 800,
  maxG: 0.8,
  crystalliteSizeNm: 20,
  minIntensityRel: 0,
  showLabels: true,
  showMeasured: true,
  measureMode: 'R' as const,
  measuredText: '',
  tolerancePercent: 3,
})

const draft = useToolDraft({
  toolId: 'saed-rings',
  defaults,
  snapshot: () => ({
    voltageKv: voltageKv.value,
    cameraLengthMm: cameraLengthMm.value,
    maxG: maxG.value,
    crystalliteSizeNm: crystalliteSizeNm.value,
    minIntensityRel: minIntensityRel.value,
    showLabels: showLabels.value,
    showMeasured: showMeasured.value,
    measureMode: measureMode.value,
    measuredText: measuredText.value,
    tolerancePercent: tolerancePercent.value,
  }),
  restore: (data) => {
    voltageKv.value = data.voltageKv
    cameraLengthMm.value = data.cameraLengthMm
    maxG.value = data.maxG
    crystalliteSizeNm.value = data.crystalliteSizeNm
    minIntensityRel.value = data.minIntensityRel
    showLabels.value = data.showLabels
    showMeasured.value = data.showMeasured
    measureMode.value = data.measureMode === 'd' ? 'd' : 'R'
    measuredText.value = data.measuredText
    tolerancePercent.value = data.tolerancePercent
  },
})

function resetAll() {
  draft.reset()
}

async function clearPage() {
  try {
    await ElMessageBox.confirm('将清空本页参数、实测环列表和自动保存记录。确定继续？', '清空本页', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  draft.clear()
  ElMessage.success('已清空本页')
}

function exportCsv() {
  if (!pattern.value) return
  downloadText(
    ringText.value,
    safeFilename(`SAED_RINGS_${timestamp()}`, 'csv'),
    'text/csv;charset=utf-8',
  )
  ElMessage.success('已导出衍射环表 CSV')
}

const canvasRef = ref<{ exportPNG: (filename?: string) => void } | null>(null)

function exportPng() {
  if (!pattern.value) return
  canvasRef.value?.exportPNG(safeFilename(`SAED_RINGS_${timestamp()}`, 'png'))
}

async function copyTable() {
  try {
    await navigator.clipboard.writeText(ringText.value)
    ElMessage.success('已复制衍射环表')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}
</script>

<template>
  <ToolPage
    tool-id="saed-rings"
    title="多晶电子衍射环"
    subtitle="按结构与电压生成多晶 SAED 同心环，标注 hkl 与相对强度，并用实测环半径反算相机常数。"
    doc="/docs/userguide/saed-rings"
    v-model:result-state="drawer"
    result-title="多晶衍射环"
    :saved-at="draft.savedAt"
    :restored="draft.restored"
    :state-error="draft.error"
    @reset="resetAll"
    @clear="clearPage"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" :disabled="!pattern" @click="drawer = 'half'">
        查看衍射环
      </button>
      <button type="button" class="btn" :disabled="!pattern" @click="exportPng"><ImageDown /> PNG</button>
      <button type="button" class="btn" :disabled="!pattern" @click="exportCsv"><Download /> CSV</button>
    </template>

    <template #params>
      <PanelCard title="晶体结构" :icon="CircleDot">
        <StructurePicker />
      </PanelCard>

      <PanelCard title="衍射条件" :icon="ScanLine">
        <div class="form-stack">
          <div class="grid-2">
            <NumberField v-model="voltageKv" label="加速电压" unit="kV" :min="20" :max="1000" />
            <NumberField v-model="cameraLengthMm" label="相机长度" unit="mm" :min="20" :max="5000" />
          </div>
          <NumberField v-model="crystalliteSizeNm" label="晶粒尺寸" unit="nm" :min="1" :max="10000" />
          <label class="field">
            <span class="field__label">最大 |g| <span class="field__unit">Å⁻¹</span></span>
            <el-slider v-model="maxG" :min="0.2" :max="2" :step="0.05" size="small" />
          </label>
          <label class="field">
            <span class="field__label">最低相对强度 <span class="field__unit">%</span></span>
            <el-slider v-model="minIntensityRel" :min="0" :max="30" :step="1" size="small" />
          </label>
          <label class="inline small muted">
            <el-switch v-model="showLabels" size="small" />
            显示 hkl 标注
          </label>
        </div>
      </PanelCard>

      <PanelCard title="实测环指标化" :icon="Ruler">
        <div class="form-stack">
          <label class="field">
            <span class="field__label">实测值类型</span>
            <el-radio-group v-model="measureMode" size="small">
              <el-radio-button value="R">R (mm)</el-radio-button>
              <el-radio-button value="d">d (Å)</el-radio-button>
            </el-radio-group>
          </label>
          <label class="field">
            <span class="field__label">实测环（每行一个）</span>
            <textarea
              v-model="measuredText"
              class="text-area mono"
              rows="5"
              placeholder="例如：&#10;6.40&#10;10.45&#10;12.25"
              spellcheck="false"
            />
          </label>
          <div class="grid-2">
            <NumberField v-model="tolerancePercent" label="容差" unit="%" :min="0.1" :max="20" :precision="2" />
            <label class="inline small muted" style="align-self: end; padding-bottom: 5px">
              <el-switch v-model="showMeasured" size="small" />
              叠加实测环
            </label>
          </div>
          <div class="calib-box">
            <div class="section-label" style="margin-bottom: 6px">由实测 R 反算相机常数</div>
            <div class="calib-result mono">
              Lλ = {{ Number.isFinite(calibratedConstant) ? calibratedConstant.toFixed(3) : '—' }} mm·Å<br />
              当前计算值 {{ pattern ? pattern.cameraConstant.toFixed(3) : '—' }} mm·Å
            </div>
          </div>
        </div>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard title="衍射环信息" :icon="Sparkles">
        <div class="kalib-list mono">
          <div class="kv"><span>环数</span><span>{{ pattern?.rings.length ?? 0 }}</span></div>
          <div class="kv"><span>电子波长</span><span>{{ pattern?.wavelength.toFixed(6) ?? '—' }} Å</span></div>
          <div class="kv"><span>Lλ</span><span>{{ pattern?.cameraConstant.toFixed(3) ?? '—' }} mm·Å</span></div>
          <div class="kv"><span>实测匹配</span><span>{{ matches.filter((m) => m.matched).length }} / {{ matches.length }}</span></div>
        </div>
      </PanelCard>

      <PanelCard title="实测匹配" :icon="Table2">
        <div v-if="!matches.length" class="small dim">在上方输入实测环半径或 d 值。</div>
        <div v-else class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>实测</th><th>d (Å)</th><th>hkl</th><th class="num">Δd%</th></tr>
            </thead>
            <tbody>
              <tr v-for="(match, index) in matches" :key="index">
                <td>{{ match.measured.toFixed(3) }}</td>
                <td>{{ match.d.toFixed(4) }}</td>
                <td>{{ match.ring ? formatHkl(match.ring.hkl, 'round') : '—' }}</td>
                <td class="num" :class="{ 'is-bad': !match.matched }">{{ match.deltaPercent.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>

      <PanelCard title="读图提示" :icon="Sparkles">
        <ul class="tips">
          <li>环半径 R = Lλ/d；由内向外通常对应 d 值减小。</li>
          <li>环的粗细与晶粒尺寸有关：晶粒越小，环越宽。</li>
          <li>强度是运动学近似下的多重度加权 |F|²，未考虑织构与动力学效应。</li>
          <li>实测环与计算环的偏差可用于检查相机常数与样品物相。</li>
        </ul>
      </PanelCard>
    </template>

    <p v-if="result.error" class="field-error" aria-live="polite">{{ result.error }}</p>

    <template #chart>
      <RingCanvas
        v-if="pattern"
        ref="canvasRef"
        :rings="pattern.rings"
        :max-radius-mm="Math.max(pattern.maxRadiusMm, ...measuredValues)"
        :camera-constant="pattern.cameraConstant"
        :show-labels="showLabels"
        :show-measured="showMeasured"
        :measured-radii="measureMode === 'R' ? measuredValues : []"
        :caption="`${voltageKv} kV · L = ${cameraLengthMm} mm · 晶粒 ${crystalliteSizeNm} nm`"
      />
    </template>

    <template #text>
      <div v-if="pattern" class="ring-stats">
        <div v-for="item in stats" :key="item.label" class="ring-stat">
          <div class="ring-stat__label">{{ item.label }}</div>
          <div class="ring-stat__value mono">{{ item.value }} <span>{{ item.unit }}</span></div>
        </div>
      </div>
      <pre v-if="pattern" class="code-surface"><code>{{ ringText }}</code></pre>
      <div v-if="matches.length" style="margin-top: 10px">
        <pre class="code-surface"><code>{{ matchText }}</code></pre>
      </div>
    <div class="table-wrap ring-table">
      <table class="data">
        <thead>
          <tr>
            <th>hkl</th>
            <th class="num">d (Å)</th>
            <th class="num">|g| (Å⁻¹)</th>
            <th class="num">m</th>
            <th class="num">I (%)</th>
            <th class="num">R (mm)</th>
            <th class="num">环宽 (mm)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ring in ringTable" :key="`${ring.hkl}-${ring.d}`">
            <td>{{ formatHkl(ring.hkl, 'round') }}</td>
            <td class="num">{{ ring.d.toFixed(5) }}</td>
            <td class="num">{{ ring.g.toFixed(4) }}</td>
            <td class="num">{{ ring.multiplicity }}</td>
            <td class="num">{{ ring.relIntensity.toFixed(1) }}</td>
            <td class="num">{{ ring.radiusMm.toFixed(3) }}</td>
            <td class="num">{{ ring.widthMm.toFixed(3) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
      <div v-if="pattern?.warnings.length" class="warn-list">
        <div v-for="warning in pattern.warnings" :key="warning" class="issue issue--warning">
          <div>{{ warning }}</div>
        </div>
      </div>
    </template>

    <template #download>
      <div class="row">
        <button type="button" class="btn" :disabled="!pattern" @click="exportPng"><ImageDown /> 导出 PNG</button>
        <button type="button" class="btn" :disabled="!pattern" @click="exportCsv"><Download /> 导出 CSV</button>
      </div>
      <p class="section-note">CSV 含 hkl、d、|g|、多重度、相对强度与环半径，可直接进 Origin。</p>
    </template>

    <template #copy>
      <div class="row">
        <button type="button" class="btn" :disabled="!pattern" @click="copyTable"><Download /> 复制环表</button>
      </div>
      <pre class="code-surface"><code>{{ ringText }}</code></pre>
    </template>

  </ToolPage>
</template>

<style scoped>
.text-area {
  width: 100%;
  min-height: 92px;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 11px;
  line-height: 1.5;
  resize: vertical;
}

.ring-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 12px;
}

.ring-stat {
  padding: 10px;
  border: 1px solid var(--border-soft);
  border-radius: 7px;
  background: var(--surface-2);
}

.ring-stat__label {
  font-size: 10px;
  color: var(--text-3);
}

.ring-stat__value {
  margin-top: 5px;
  font-size: 16px;
  color: var(--text);
}

.ring-stat__value span {
  font-size: 10px;
  color: var(--text-3);
}

.kalib-list {
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

.calib-box {
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
}

.calib-result {
  font-size: 10px;
  line-height: 1.65;
  color: var(--text-2);
}

.ring-table {
  margin-top: 4px;
  max-height: 420px;
}

td.is-bad {
  color: var(--danger);
}

@media (max-width: 720px) {
  .ring-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
