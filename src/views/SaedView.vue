<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Camera, Download, Gauge, Grid3x3, ImageDown, ScanLine, Sparkles, Table2 } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import DiffractionCanvas, { type DiffractionPoint } from '@/components/chart/DiffractionCanvas.vue'
import StructurePicker from '@/components/structure/StructurePicker.vue'
import {
  cameraConstantFromRd,
  cameraLengthFromConstant,
  dFromRadius,
  simulateSaed,
  type SaedSpot,
  type SpotSizeMode,
} from '@/core/diffraction/saed'
import { electronWavelength } from '@/core/diffraction/scattering'
import { formatHkl } from '@/core/math/vec'
import { formatZone } from '@/core/lattice/planeNet'
import { useStructureStore } from '@/stores/structure'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const route = useRoute()
const router = useRouter()
const structureStore = useStructureStore()

const zone = reactive({ u: 1, v: 1, w: 0 })
const voltageKv = ref(200)
const cameraLengthMm = ref(800)
const maxG = ref(0.8)
const sizeMode = ref<SpotSizeMode>('sqrt')
const hideAbsent = ref(true)
const showLabels = ref(true)
const displayUnit = ref<'invA' | 'mm'>('invA')
const selectedSpot = ref<SaedSpot | null>(null)

const canvasRef = ref<{ exportPNG: (filename?: string) => void } | null>(null)

const measuredR = ref(10)
const knownD = ref(2.5)

const result = computed(() => {
  try {
    const pattern = simulateSaed(structureStore.current, {
      zoneAxis: [zone.u, zone.v, zone.w],
      voltageKv: voltageKv.value,
      cameraLengthMm: cameraLengthMm.value,
      maxG: maxG.value,
      sizeMode: sizeMode.value,
      hideAbsent: hideAbsent.value,
    })
    return { pattern, error: '' }
  } catch (error) {
    return { pattern: null, error: error instanceof Error ? error.message : String(error) }
  }
})

const pattern = computed(() => result.value.pattern)
const wavelength = computed(() => electronWavelength(voltageKv.value))
const cameraConstant = computed(() => pattern.value?.cameraConstant ?? wavelength.value * cameraLengthMm.value)

const maxR = computed(() => (displayUnit.value === 'mm' ? cameraConstant.value * maxG.value : maxG.value))

const points = computed<DiffractionPoint[]>(() => {
  const p = pattern.value
  if (!p) return []
  return p.spots.map((spot) => ({
    x: displayUnit.value === 'mm' ? spot.rx : spot.x,
    y: displayUnit.value === 'mm' ? spot.ry : spot.y,
    label: spot.isCenter ? '000' : formatHkl(spot.hkl, 'none'),
    isCenter: spot.isCenter,
    intensity: spot.intensityRel,
    meta: spot.isCenter ? '透射斑' : `d = ${spot.d.toFixed(4)} Å · I = ${spot.intensityRel.toFixed(1)}%`,
  }))
})

const spotTable = computed(() => {
  const p = pattern.value
  if (!p) return []
  return p.spots
    .filter((s) => !s.isCenter)
    .sort((a, b) => b.intensityRel - a.intensityRel || a.g - b.g)
    .slice(0, 200)
})

const stats = computed(() => {
  const p = pattern.value
  if (!p) return []
  const nonCenter = p.spots.filter((s) => !s.isCenter)
  return [
    { label: '斑点数', value: nonCenter.length.toString(), unit: 'spots' },
    { label: '相机常数', value: p.cameraConstant.toFixed(3), unit: 'mm·Å' },
    { label: '电子波长', value: wavelength.value.toFixed(6), unit: 'Å' },
    { label: '最大 R', value: (p.cameraConstant * maxG.value).toFixed(2), unit: 'mm' },
  ]
})

const basisInfo = computed(() => pattern.value?.basis ?? null)

const calibratedConstant = computed(() => cameraConstantFromRd(measuredR.value, knownD.value))
const calibratedLength = computed(() => cameraLengthFromConstant(calibratedConstant.value, wavelength.value))
const dAtMeasuredR = computed(() => dFromRadius(measuredR.value, cameraConstant.value))

function onCanvasSelect(point: DiffractionPoint) {
  const p = pattern.value
  if (!p) return
  const spot = p.spots.find((s) => (s.isCenter ? '000' : formatHkl(s.hkl, 'none')) === point.label)
  if (spot) selectedSpot.value = spot
}

function exportCsv() {
  const p = pattern.value
  if (!p) return
  const lines = [
    `# CrystalToolBox SAED pattern`,
    `# zone axis: ${formatZone(p.zone)}`,
    `# voltage: ${voltageKv.value} kV, wavelength: ${p.wavelength.toFixed(6)} A`,
    `# camera length: ${p.cameraLengthMm} mm, camera constant: ${p.cameraConstant.toFixed(4)} mm*A`,
    `# max |g|: ${p.maxG} 1/A`,
    'h,k,l,d_A,g_invA,I_rel,R_mm,x_mm,y_mm',
  ]
  for (const s of p.spots) {
    lines.push(
      [
        s.hkl[0],
        s.hkl[1],
        s.hkl[2],
        s.isCenter ? 0 : s.d.toFixed(6),
        s.g.toFixed(6),
        s.intensityRel.toFixed(2),
        Math.hypot(s.rx, s.ry).toFixed(4),
        s.rx.toFixed(4),
        s.ry.toFixed(4),
      ].join(','),
    )
  }
  downloadText(
    lines.join('\n'),
    safeFilename(`SAED_${formatZone(p.zone).replace(/[\[\]\s]/g, '')}_${timestamp()}`, 'csv'),
    'text/csv;charset=utf-8',
  )
  ElMessage.success('已导出斑点表 CSV')
}

function exportPng() {
  if (!pattern.value) return
  canvasRef.value?.exportPNG(
    safeFilename(`SAED_${formatZone(pattern.value.zone).replace(/[\[\]\s]/g, '')}_${timestamp()}`, 'png'),
  )
}

onMounted(() => {
  const queryZone = route.query.zone
  if (typeof queryZone === 'string') {
    const parts = queryZone.split(',').map(Number)
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      zone.u = Math.round(parts[0])
      zone.v = Math.round(parts[1])
      zone.w = Math.round(parts[2])
    }
  }
})
const spotText = computed(() => {
  const pattern = result.value.pattern
  if (!pattern) return ''
  const head = `${'hkl'.padEnd(12)}${'d(Å)'.padStart(10)}${'|g|(Å⁻¹)'.padStart(12)}${'I(%)'.padStart(8)}${'R(mm)'.padStart(9)}`
  const rows = spotTable.value.map((spot) =>
    [
      formatHkl(spot.hkl, 'round').padEnd(12),
      spot.d.toFixed(5).padStart(10),
      spot.g.toFixed(5).padStart(12),
      spot.intensityRel.toFixed(1).padStart(8),
      Math.hypot(spot.rx, spot.ry).toFixed(3).padStart(9),
    ].join(''),
  )
  return [head, ...rows].join('\n')
})

async function copySpots() {
  try {
    await navigator.clipboard.writeText(spotText.value)
    ElMessage.success('已复制斑点表')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}

const drawer = ref<DrawerState>('closed')
</script>

<template>
  <ToolPage
    tool-id="saed"
    title="SAED 模拟"
    subtitle="选择晶体结构与带轴，计算 ZOLZ 斑点位置、结构因子强度与指数标注，并可直接导出图片或表格。"
    doc="/docs/userguide/saed"
    eyebrow="衍射模拟 · 01"
    v-model:result-state="drawer"
    result-title="衍射斑点"
  >
    <template #run>
      <button
        type="button"
        class="btn btn--primary btn--lg"
        :disabled="!pattern"
        :aria-busy="!structureStore.current"
        @click="drawer = 'half'"
      >
        查看衍射结果
      </button>
      <button type="button" class="btn" :disabled="!pattern" @click="exportPng">PNG</button>
      <button type="button" class="btn" :disabled="!pattern" @click="exportCsv">CSV</button>
    </template>

    <template #params>
      <PanelCard title="晶体结构" :icon="Grid3x3">
        <StructurePicker />
      </PanelCard>

      <PanelCard title="衍射条件" :icon="ScanLine">
        <div class="form-stack">
          <div>
            <span class="field__label" style="margin-bottom: 5px; display: block">带轴 [u v w]</span>
            <div class="grid-3">
              <NumberField v-model="zone.u" label="u" :precision="0" @update:model-value="selectedSpot = null" />
              <NumberField v-model="zone.v" label="v" :precision="0" @update:model-value="selectedSpot = null" />
              <NumberField v-model="zone.w" label="w" :precision="0" @update:model-value="selectedSpot = null" />
            </div>
          </div>
          <div class="grid-2">
            <NumberField v-model="voltageKv" label="加速电压" unit="kV" :min="20" :max="1000" />
            <NumberField v-model="cameraLengthMm" label="相机长度" unit="mm" :min="20" :max="5000" />
          </div>
          <label class="field">
            <span class="field__label">最大 |g| <span class="field__unit">Å⁻¹</span></span>
            <el-slider v-model="maxG" :min="0.2" :max="2" :step="0.05" size="small" />
          </label>
          <label class="field">
            <span class="field__label">斑点大小映射</span>
            <el-select v-model="sizeMode" size="small">
              <el-option label="√I（推荐）" value="sqrt" />
              <el-option label="线性 I" value="linear" />
              <el-option label="等大" value="equal" />
            </el-select>
          </label>
          <label class="inline small muted">
            <el-switch v-model="hideAbsent" size="small" />
            隐藏系统消光斑点
          </label>
          <label class="inline small muted">
            <el-switch v-model="showLabels" size="small" />
            显示指数标注
          </label>
        </div>
      </PanelCard>

      <PanelCard title="显示与标定" :icon="Gauge">
        <div class="form-stack">
          <label class="field">
            <span class="field__label">斑点坐标</span>
            <el-radio-group v-model="displayUnit" size="small">
              <el-radio-button label="invA">1/Å</el-radio-button>
              <el-radio-button label="mm">mm</el-radio-button>
            </el-radio-group>
          </label>
          <div class="calib-box">
            <div class="section-label" style="margin-bottom: 6px">相机常数标定</div>
            <div class="grid-2">
              <NumberField v-model="measuredR" label="实测 R" unit="mm" :min="0.01" />
              <NumberField v-model="knownD" label="已知 d" unit="Å" :min="0.01" />
            </div>
            <div class="calib-result mono">
              Lλ = {{ Number.isFinite(calibratedConstant) ? calibratedConstant.toFixed(3) : '—' }} mm·Å<br />
              L = {{ Number.isFinite(calibratedLength) ? calibratedLength.toFixed(1) : '—' }} mm（@ {{ voltageKv }} kV）
            </div>
          </div>
        </div>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard title="斑点信息" :icon="Sparkles">
        <div v-if="selectedSpot">
          <div class="spot-hkl mono">{{ formatHkl(selectedSpot.hkl, 'round') }}</div>
          <div class="kv-list mono">
            <div class="kv">
              <span>d</span><span>{{ selectedSpot.d.toFixed(6) }} Å</span>
            </div>
            <div class="kv">
              <span>|g|</span><span>{{ selectedSpot.g.toFixed(6) }} Å⁻¹</span>
            </div>
            <div class="kv">
              <span>I</span><span>{{ selectedSpot.intensityRel.toFixed(2) }} %</span>
            </div>
            <div class="kv">
              <span>R</span><span>{{ Math.hypot(selectedSpot.rx, selectedSpot.ry).toFixed(3) }} mm</span>
            </div>
          </div>
        </div>
        <div v-else class="small dim">在图上或下方表格中点击一个斑点。</div>
      </PanelCard>

      <PanelCard v-if="basisInfo" title="二维基矢" :icon="Grid3x3">
        <div class="kv-list mono">
          <div class="kv">
            <span>b₁</span><span>{{ formatHkl(basisInfo.b1, 'square') }}</span>
          </div>
          <div class="kv">
            <span>b₂</span><span>{{ formatHkl(basisInfo.b2, 'square') }}</span>
          </div>
          <div class="kv">
            <span>|g₁|</span><span>{{ basisInfo.len1.toFixed(5) }} Å⁻¹</span>
          </div>
          <div class="kv">
            <span>|g₂|</span><span>{{ basisInfo.len2.toFixed(5) }} Å⁻¹</span>
          </div>
          <div class="kv">
            <span>夹角</span><span>{{ basisInfo.angleDeg.toFixed(3) }}°</span>
          </div>
        </div>
        <p class="tiny dim" style="margin-top: 7px">
          斑点位置 R = Lλ·|g|；强度为运动学近似 I ∝ |F|²，未包含动力学效应与 HOLZ。
        </p>
      </PanelCard>

      <PanelCard title="标定" :icon="Camera">
        <div class="small muted" style="line-height: 1.65">
          已知 R 与 d 可由 Lλ = R·d 求相机常数；也可由当前 Lλ 反推未知 d：
          <b class="mono" style="color: var(--accent)"
            >{{ Number.isFinite(dAtMeasuredR) ? dAtMeasuredR.toFixed(5) : '—' }} Å</b
          >
          （R = {{ measuredR }} mm）。
        </div>
        <el-button
          size="small"
          text
          type="primary"
          style="padding-left: 0"
          @click="router.push('/docs/cookbook/saed-indexing')"
        >
          阅读 SAED 标定步骤
        </el-button>
      </PanelCard>
    </template>

    <p v-if="result.error" class="field-error" aria-live="polite">{{ result.error }}</p>

    <template #chart>
      <DiffractionCanvas
        v-if="pattern"
        ref="canvasRef"
        :points="points"
        :max-r="maxR"
        :unit="displayUnit === 'mm' ? 'mm' : 'Å⁻¹'"
        :show-labels="showLabels"
        :height="420"
        :caption="`${formatZone(pattern.zone)} · ${voltageKv} kV · L = ${cameraLengthMm} mm`"
        @select="onCanvasSelect"
      />
    </template>

    <template #text>
      <pre v-if="pattern" class="code-surface"><code>{{ spotText }}</code></pre>
      <p v-else class="section-note">调整参数后即可生成衍射斑点。</p>
      <div v-if="pattern?.warnings.length">
        <div v-for="warning in pattern.warnings" :key="warning" class="issue issue--warning">
          <div>{{ warning }}</div>
        </div>
      </div>
    </template>

    <template #download>
      <div class="row">
        <button type="button" class="btn" :disabled="!pattern" @click="exportPng">
          <ImageDown /> 导出 PNG
        </button>
        <button type="button" class="btn" :disabled="!pattern" @click="exportCsv">
          <Download /> 导出 CSV
        </button>
      </div>
      <p class="section-note">CSV 含 hkl、d、|g|、相对强度与屏幕半径，可直接进 Origin。</p>
    </template>

    <template #copy>
      <div class="row">
        <button type="button" class="btn" :disabled="!pattern" @click="copySpots">
          <Download /> 复制斑点表
        </button>
      </div>
      <pre class="code-surface"><code>{{ spotText }}</code></pre>
    </template>
  </ToolPage>
</template>

<style scoped>
.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 3px;
}

.saed-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.calib-box {
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
}

.calib-result {
  margin-top: 8px;
  font-size: 10px;
  line-height: 1.65;
  color: var(--text-2);
}

.spot-hkl {
  font-size: 22px;
  font-weight: 650;
  color: var(--accent);
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 5px;
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

.spot-table {
  max-height: 420px;
}

.spot-table tr {
  cursor: pointer;
}

.warn-list {
  margin-top: 10px;
}

@media (max-width: 720px) {
  .saed-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
