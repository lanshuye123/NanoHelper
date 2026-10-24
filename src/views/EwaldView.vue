<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, ImageDown, Orbit, ScanLine, Sparkles, Table2 } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import MathText from '@/components/common/MathText.vue'
import EwaldCanvas from '@/components/chart/EwaldCanvas.vue'
import StructurePicker from '@/components/structure/StructurePicker.vue'
import {
  buildEwaldGeometryForCell,
  compareEwaldWavelengths,
  type EwaldPoint,
} from '@/core/diffraction/ewald'
import { electronWavelength, ANODES } from '@/core/diffraction/scattering'
import { formatZone } from '@/core/lattice/planeNet'
import { formatHkl } from '@/core/math/vec'
import { useStructureStore } from '@/stores/structure'
import { useToolDraft } from '@/composables/useToolDraft'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const structureStore = useStructureStore()
const drawer = ref<DrawerState>('closed')

const radiation = ref<'electron' | 'xray'>('electron')
const voltageKv = ref(200)
const anodeId = ref('Cu')
const wavelength = ref(1.54056)
const zone = reactive({ u: 1, v: 1, w: 0 })
const maxG = ref(1.2)
const thicknessNm = ref(50)
const showRelrods = ref(true)
const showLabels = ref(true)
const selected = ref<EwaldPoint | null>(null)

watch(anodeId, (id) => {
  const anode = ANODES.find((item) => item.id === id)
  if (anode) wavelength.value = anode.ka1
})

const effectiveWavelength = computed(() =>
  radiation.value === 'electron' ? electronWavelength(voltageKv.value) : wavelength.value,
)

const result = computed(() => {
  try {
    const geometry = buildEwaldGeometryForCell(structureStore.current.cell, {
      wavelength: effectiveWavelength.value,
      zoneAxis: [zone.u, zone.v, zone.w],
      maxG: maxG.value,
      thicknessNm: thicknessNm.value,
    })
    return { geometry, error: '' }
  } catch (error) {
    return { geometry: null, error: error instanceof Error ? error.message : String(error) }
  }
})

const geometry = computed(() => result.value.geometry)

const stats = computed(() => {
  const g = geometry.value
  if (!g) return []
  return [
    { label: '相截斑点', value: String(g.excited.length), unit: 'spots' },
    { label: 'ZOLZ / HOLZ', value: `${g.zolz.length} / ${g.holz.length}`, unit: '' },
    { label: '艾瓦德球半径 k', value: g.k.toFixed(3), unit: 'Å⁻¹' },
    { label: '极限球 2/λ', value: g.limitingRadius.toFixed(3), unit: 'Å⁻¹' },
  ]
})

const comparison = computed(() => {
  const electron = electronWavelength(voltageKv.value)
  const cu = ANODES.find((item) => item.id === 'Cu')?.ka1 ?? 1.54056
  const values = compareEwaldWavelengths(Math.max(0.05, maxG.value * 0.6), electron, cu)
  return {
    electron,
    xray: cu,
    ratio: values.sagittaB / values.sagittaA,
  }
})

const tableRows = computed(() => {
  const g = geometry.value
  if (!g) return []
  return [...g.points]
    .filter((point) => point.insideLimitingSphere)
    .sort((a, b) => Math.abs(a.excitationError) - Math.abs(b.excitationError) || a.g - b.g)
    .slice(0, 150)
})

const tableText = computed(() => {
  const g = geometry.value
  if (!g) return ''
  const head = `${'hkl'.padEnd(12)}${'d(Å)'.padStart(10)}${'|g|(Å⁻¹)'.padStart(12)}${'N'.padStart(5)}${'s(Å⁻¹)'.padStart(12)}`
  const rows = tableRows.value.map((point) =>
    [
      formatHkl(point.hkl, 'round').padEnd(12),
      point.d.toFixed(5).padStart(10),
      point.g.toFixed(5).padStart(12),
      String(point.laueZone).padStart(5),
      point.excitationError.toExponential(3).padStart(12),
    ].join(''),
  )
  return [head, ...rows].join('\n')
})

const chartCaption = computed(() => {
  const g = geometry.value
  if (!g) return ''
  const label = radiation.value === 'electron' ? `${voltageKv.value} kV 电子` : `${anodeId.value} X 射线`
  return `${label} · λ = ${g.wavelength.toFixed(5)} Å · ${formatZone(g.zone)} · 厚度 ${thicknessNm.value} nm`
})

const defaults = () => ({
  radiation: 'electron' as const,
  voltageKv: 200,
  anodeId: 'Cu',
  wavelength: 1.54056,
  zone: { u: 1, v: 1, w: 0 },
  maxG: 1.2,
  thicknessNm: 50,
  showRelrods: true,
  showLabels: true,
})

const draft = useToolDraft({
  toolId: 'ewald',
  defaults,
  snapshot: () => ({
    radiation: radiation.value,
    voltageKv: voltageKv.value,
    anodeId: anodeId.value,
    wavelength: wavelength.value,
    zone: { u: zone.u, v: zone.v, w: zone.w },
    maxG: maxG.value,
    thicknessNm: thicknessNm.value,
    showRelrods: showRelrods.value,
    showLabels: showLabels.value,
  }),
  restore: (data) => {
    radiation.value = data.radiation === 'xray' ? 'xray' : 'electron'
    voltageKv.value = data.voltageKv
    anodeId.value = data.anodeId
    wavelength.value = data.wavelength
    zone.u = data.zone.u
    zone.v = data.zone.v
    zone.w = data.zone.w
    maxG.value = data.maxG
    thicknessNm.value = data.thicknessNm
    showRelrods.value = data.showRelrods
    showLabels.value = data.showLabels
  },
})

function resetAll() {
  draft.reset()
  selected.value = null
}

async function clearPage() {
  try {
    await ElMessageBox.confirm('将清空本页的输入、选中斑点和自动保存记录。确定继续？', '清空本页', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  draft.clear()
  selected.value = null
  ElMessage.success('已清空本页')
}

function exportCsv() {
  if (!geometry.value) return
  downloadText(
    tableText.value,
    safeFilename(`EWALD_${formatZone(geometry.value.zone).replace(/[\[\]\s]/g, '')}_${timestamp()}`, 'csv'),
    'text/csv;charset=utf-8',
  )
  ElMessage.success('已导出艾瓦德球表 CSV')
}

async function copyTable() {
  try {
    await navigator.clipboard.writeText(tableText.value)
    ElMessage.success('已复制表格')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}

const canvasRef = ref<{ exportPNG: (filename?: string) => void } | null>(null)

function exportPng() {
  if (!geometry.value) return
  canvasRef.value?.exportPNG(
    safeFilename(`EWALD_${formatZone(geometry.value.zone).replace(/[\[\]\s]/g, '')}_${timestamp()}`, 'png'),
  )
}
</script>

<template>
  <ToolPage
    tool-id="ewald"
    title="艾瓦德球与劳厄带"
    subtitle="把倒易点阵、艾瓦德球、ZOLZ/HOLZ 与激发误差放在同一张图上，比较 X 射线与电子衍射的几何差异。"
    doc="/docs/userguide/ewald"
    v-model:result-state="drawer"
    result-title="艾瓦德球"
    :saved-at="draft.savedAt"
    :restored="draft.restored"
    :state-error="draft.error"
    @reset="resetAll"
    @clear="clearPage"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" :disabled="!geometry" @click="drawer = 'half'">
        查看几何图
      </button>
      <button type="button" class="btn" :disabled="!geometry" @click="exportPng"><ImageDown /> PNG</button>
      <button type="button" class="btn" :disabled="!geometry" @click="exportCsv"><Download /> CSV</button>
    </template>

    <template #params>
      <PanelCard title="晶体结构" :icon="Orbit">
        <StructurePicker />
      </PanelCard>

      <PanelCard title="入射条件" :icon="ScanLine">
        <div class="form-stack">
          <label class="field">
            <span class="field__label">入射束</span>
            <el-radio-group v-model="radiation" size="small">
              <el-radio-button value="electron">电子</el-radio-button>
              <el-radio-button value="xray">X 射线</el-radio-button>
            </el-radio-group>
          </label>
          <template v-if="radiation === 'electron'">
            <NumberField v-model="voltageKv" label="加速电压" unit="kV" :min="20" :max="1000" />
          </template>
          <template v-else>
            <label class="field">
              <span class="field__label">靶材</span>
              <el-select v-model="anodeId" size="small">
                <el-option v-for="anode in ANODES" :key="anode.id" :label="`${anode.id} (${anode.ka1} Å)`" :value="anode.id" />
              </el-select>
            </label>
            <NumberField v-model="wavelength" label="波长" unit="Å" :min="0.1" :max="3" :precision="5" />
          </template>
          <div>
            <span class="field__label" style="margin-bottom: 5px; display: block">带轴 [u v w]</span>
            <div class="grid-3">
              <NumberField v-model="zone.u" label="u" :precision="0" />
              <NumberField v-model="zone.v" label="v" :precision="0" />
              <NumberField v-model="zone.w" label="w" :precision="0" />
            </div>
          </div>
          <NumberField v-model="thicknessNm" label="样品厚度" unit="nm" :min="0" :max="5000" />
          <label class="field">
            <span class="field__label">最大 |g| <span class="field__unit">Å⁻¹</span></span>
            <el-slider v-model="maxG" :min="0.2" :max="2" :step="0.05" size="small" />
          </label>
          <label class="inline small muted">
            <el-switch v-model="showRelrods" size="small" />
            显示倒易杆
          </label>
          <label class="inline small muted">
            <el-switch v-model="showLabels" size="small" />
            显示指数标注
          </label>
        </div>
      </PanelCard>

      <PanelCard title="两种入射束" :icon="Sparkles">
        <div class="kv-list mono">
          <div class="kv"><span>电子波长</span><span>{{ comparison.electron.toFixed(6) }} Å</span></div>
          <div class="kv"><span>Cu Kα1</span><span>{{ comparison.xray.toFixed(5) }} Å</span></div>
          <div class="kv"><span>曲率比</span><span>≈ {{ comparison.ratio.toFixed(1) }}×</span></div>
        </div>
        <p class="tiny dim" style="margin-top: 7px">
          同一 |g| 下，X 射线的艾瓦德球曲率远大于电子衍射，因此粉末衍射需要大量晶粒取向才能覆盖倒易球壳。
        </p>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard title="选中的倒易点" :icon="Table2">
        <div v-if="selected">
          <div class="spot-hkl mono">{{ formatHkl(selected.hkl, 'round') }}</div>
          <div class="kv-list mono">
            <div class="kv"><span>d</span><span>{{ selected.d.toFixed(5) }} Å</span></div>
            <div class="kv"><span>|g|</span><span>{{ selected.g.toFixed(5) }} Å⁻¹</span></div>
            <div class="kv"><span>劳厄带 N</span><span>{{ selected.laueZone }}</span></div>
            <div class="kv"><span>激发误差 s</span><span>{{ selected.excitationError.toExponential(3) }} Å⁻¹</span></div>
            <div class="kv"><span>是否相截</span><span>{{ selected.excited ? '是' : '否' }}</span></div>
          </div>
        </div>
        <p v-else class="small dim">在结果表格中点击一行，查看该倒易点的几何量。</p>
      </PanelCard>

      <PanelCard title="读图提示" :icon="Sparkles">
        <ul class="tips">
          <li>水平方向是倒易面内的径向距离 r，竖直方向是沿带轴法向的 z。</li>
          <li>ZOLZ 落在 z = 0；HOLZ N 对应 z = N / |R<sub>uvw</sub>|。</li>
          <li>橙色点表示在当前厚度模型下与艾瓦德球相截；竖线是倒易杆。</li>
          <li>运动学几何模型，不包含动力学散射、倾转与 HOLZ 线细节。</li>
        </ul>
      </PanelCard>

    <PanelCard title="几何关系" :icon="Sparkles">
      <MathText tex="s = \dfrac{x^2 + y^2 + z^2 + 2kz}{2k},\quad k = \dfrac{1}{\lambda}" block />
      <p class="small muted" style="margin-top: 8px">
        其中 z 沿带轴法向，x、y 在倒易面内；ZOLZ 满足 h·u + k·v + l·w = 0。样品厚度 t 把倒易点拉长成半长
        1/(2t) 的倒易杆，|s| 小于该值时视为相截。
      </p>
    </PanelCard>
    </template>

    <p v-if="result.error" class="field-error" aria-live="polite">{{ result.error }}</p>

    <template #chart>
      <EwaldCanvas
        v-if="geometry"
        ref="canvasRef"
        :points="geometry.points"
        :k="geometry.k"
        :max-r="maxG"
        :zone-spacing="geometry.zoneSpacing"
        :thickness-nm="thicknessNm"
        :show-relrods="showRelrods"
        :show-labels="showLabels"
        :caption="chartCaption"
      />
    </template>

    <template #text>
      <div v-if="geometry" class="ewald-stats">
        <div v-for="item in stats" :key="item.label" class="ewald-stat">
          <div class="ewald-stat__label">{{ item.label }}</div>
          <div class="ewald-stat__value mono">{{ item.value }} <span>{{ item.unit }}</span></div>
        </div>
      </div>
      <pre v-if="geometry" class="code-surface"><code>{{ tableText }}</code></pre>
    <div class="table-wrap result-table">
      <table class="data">
        <thead>
          <tr>
            <th>hkl</th>
            <th>d (Å)</th>
            <th>|g| (Å⁻¹)</th>
            <th>N</th>
            <th>s (Å⁻¹)</th>
            <th>相截</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="point in tableRows"
            :key="point.hkl.join(',')"
            :class="{ 'is-selected': selected?.hkl.join(',') === point.hkl.join(',') }"
            @click="selected = point"
          >
            <td class="mono">{{ formatHkl(point.hkl, 'round') }}</td>
            <td class="mono">{{ point.d.toFixed(4) }}</td>
            <td class="mono">{{ point.g.toFixed(4) }}</td>
            <td class="mono">{{ point.laueZone }}</td>
            <td class="mono">{{ point.excitationError.toExponential(2) }}</td>
            <td>
              <span class="chip" :class="point.excited ? 'chip--accent' : ''">{{ point.excited ? '相截' : '—' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
      <div v-if="geometry?.warnings.length" class="warn-list">
        <div v-for="warning in geometry.warnings" :key="warning" class="issue issue--warning">
          <div>{{ warning }}</div>
        </div>
      </div>
    </template>

    <template #download>
      <div class="row">
        <button type="button" class="btn" :disabled="!geometry" @click="exportPng"><ImageDown /> 导出 PNG</button>
        <button type="button" class="btn" :disabled="!geometry" @click="exportCsv"><Download /> 导出 CSV</button>
      </div>
      <p class="section-note">CSV 含 hkl、d、|g|、劳厄带 N 与激发误差 s，可直接进 Origin。</p>
    </template>

    <template #copy>
      <div class="row">
        <button type="button" class="btn" :disabled="!geometry" @click="copyTable"><Download /> 复制表格</button>
      </div>
      <pre class="code-surface"><code>{{ tableText }}</code></pre>
    </template>


  </ToolPage>
</template>

<style scoped>
.ewald-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 12px;
}

.ewald-stat {
  padding: 10px;
  border: 1px solid var(--border-soft);
  border-radius: 7px;
  background: var(--surface-2);
}

.ewald-stat__label {
  font-size: 10px;
  color: var(--text-3);
}

.ewald-stat__value {
  margin-top: 5px;
  font-size: 16px;
  color: var(--text);
}

.ewald-stat__value span {
  font-size: 10px;
  color: var(--text-3);
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

.result-table {
  margin-top: 4px;
  max-height: 420px;
  overflow: auto;
}

.data tr {
  cursor: pointer;
}

.data tr.is-selected {
  background: var(--accent-soft);
}

@media (max-width: 720px) {
  .ewald-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
