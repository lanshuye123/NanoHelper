<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeftRight, Atom, Compass, Copy, Download, Grid3x3, Layers, Ruler } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState, ResultTab } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import MathText from '@/components/common/MathText.vue'
import { STRUCTURE_PRESETS } from '@/data/presets'
import {
  buildLattice,
  dSpacing,
  planeAngle,
  planeDirectionAngle,
  directionAngle,
  type CellParams,
} from '@/core/lattice/cell'
import {
  axialReflectionCondition,
  generalPositionAmplitude,
  isSystematicallyAbsent,
  isValidFourIndex,
  planeIntercepts,
  reflectionCheckTable,
  threeToFourDirection,
  threeToFourIndex,
  weissLaw,
  zoneFromReciprocalIndices,
} from '@/core/crystallography/indices'
import { formatHkl } from '@/core/math/vec'
import { getSpaceGroupMeta, loadSpaceGroup, toSymOps } from '@/core/data/spacegroups'
import type { SymOp } from '@/core/crystallography/symmetry'
import { normalizeZone, planesInZone } from '@/core/lattice/zone'
import { useStructureStore } from '@/stores/structure'
import { useToolDraft } from '@/composables/useToolDraft'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const store = useStructureStore()
const drawer = ref<DrawerState>('closed')
const resultTabs: ResultTab[] = ['text', 'download', 'copy']

const cell = reactive<CellParams>({ ...STRUCTURE_PRESETS[0].cell })
const presetId = ref<string>(STRUCTURE_PRESETS[0].id)
const planeA = reactive({ h: 1, k: 1, l: 0 })
const planeB = reactive({ h: 1, k: 0, l: 0 })
const dirA = reactive({ u: 1, v: 0, w: 0 })
const dirB = reactive({ u: 1, v: 1, w: 0 })
const zoneInput = reactive({ u: 1, v: 1, w: 0 })
const sgNumber = ref<number>(store.current.spaceGroupNumber ?? 225)
const ops = ref<SymOp[]>([])
const sgError = ref('')

const draft = useToolDraft({
  toolId: 'indices',
  defaults: () => ({
    cell: { ...STRUCTURE_PRESETS[0].cell },
    presetId: STRUCTURE_PRESETS[0].id,
    planeA: { h: 1, k: 1, l: 0 },
    planeB: { h: 1, k: 0, l: 0 },
    dirA: { u: 1, v: 0, w: 0 },
    dirB: { u: 1, v: 1, w: 0 },
    zoneInput: { u: 1, v: 1, w: 0 },
    sgNumber: store.current.spaceGroupNumber ?? 225,
  }),
  snapshot: () => ({
    cell: { ...cell },
    presetId: presetId.value,
    planeA: { ...planeA },
    planeB: { ...planeB },
    dirA: { ...dirA },
    dirB: { ...dirB },
    zoneInput: { ...zoneInput },
    sgNumber: sgNumber.value,
  }),
  restore: (data) => {
    Object.assign(cell, data.cell)
    presetId.value = data.presetId
    Object.assign(planeA, data.planeA)
    Object.assign(planeB, data.planeB)
    Object.assign(dirA, data.dirA)
    Object.assign(dirB, data.dirB)
    Object.assign(zoneInput, data.zoneInput)
    sgNumber.value = data.sgNumber
  },
})

function resetAll() {
  draft.reset()
}

async function clearPage() {
  try {
    await ElMessageBox.confirm('将清空本页晶胞、晶面/晶向、带轴与空间群选择，并移除自动保存记录；不会重置其他页面共用的晶体结构。确定继续？', '清空本页', {
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

watch(
  () => store.current.spaceGroupNumber,
  (n) => {
    if (n) sgNumber.value = n
  },
)

watch(
  sgNumber,
  async (n) => {
    sgError.value = ''
    const group = await loadSpaceGroup(n)
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

const hklA = computed<[number, number, number]>(() => [planeA.h, planeA.k, planeA.l])
const hklB = computed<[number, number, number]>(() => [planeB.h, planeB.k, planeB.l])
const uvwA = computed<[number, number, number]>(() => [dirA.u, dirA.v, dirA.w])
const uvwB = computed<[number, number, number]>(() => [dirB.u, dirB.v, dirB.w])

const planeInfo = computed(() => {
  const l = lattice.value
  if (!l) return null
  const d = dSpacing(l, hklA.value)
  const g = 1 / d
  const sinTheta = 1.54056 / (2 * d)
  const twoTheta = sinTheta <= 1 ? (2 * Math.asin(sinTheta) * 180) / Math.PI : NaN
  return {
    d,
    g,
    twoTheta,
    angle: planeAngle(l, hklA.value, hklB.value),
    dirAngle: directionAngle(l, uvwA.value, uvwB.value),
    planeDirAngle: planeDirectionAngle(l, hklA.value, uvwA.value),
    weiss: weissLaw(hklA.value, uvwA.value),
    intercepts: planeIntercepts(cell, hklA.value),
    four: threeToFourIndex(hklA.value),
    fourDir: threeToFourDirection(uvwA.value),
    zone: zoneFromReciprocalIndices(hklA.value, hklB.value),
  }
})

const zoneVec = computed<[number, number, number] | null>(() => {
  try {
    return normalizeZone([zoneInput.u, zoneInput.v, zoneInput.w])
  } catch {
    return null
  }
})

const zonePlanes = computed(() => {
  const l = lattice.value
  const z = zoneVec.value
  const meta = sgMeta.value
  if (!l || !z) return []
  return planesInZone(l, z, {
    maxIndex: 6,
    applyCentering: true,
    latticeType: meta?.latticeType ?? 'P',
  })
    .filter((row) => !ops.value.length || !isSystematicallyAbsent(ops.value, row.hkl))
    .slice(0, 60)
    .map((row) => ({
      ...row,
      four: threeToFourIndex(row.hkl),
      angle: planeAngle(l, hklA.value, row.hkl),
    }))
})

const selectedAbsent = computed(() => {
  if (!ops.value.length) return null
  const amp = generalPositionAmplitude(ops.value, hklA.value)
  return { absent: amp.amplitude < 1e-8, amplitude: amp.amplitude }
})

const axial = computed(() => {
  if (!ops.value.length) return null
  return {
    h: axialReflectionCondition(ops.value, 0),
    k: axialReflectionCondition(ops.value, 1),
    l: axialReflectionCondition(ops.value, 2),
  }
})

const checkRows = computed(() => {
  const l = lattice.value
  if (!l || !ops.value.length) return []
  return reflectionCheckTable(l, ops.value, 4, sgMeta.value?.latticeType ?? 'P')
    .filter((row) => !row.allowed)
    .slice(0, 40)
})

const summary = computed(() => {
  const p = planeInfo.value
  if (!p) return []
  return [
    { label: `d(${hklA.value.join(' ')})`, value: p.d.toFixed(5), unit: 'Å' },
    { label: '|g|', value: p.g.toFixed(5), unit: 'Å⁻¹' },
    { label: '2θ (Cu Kα1)', value: Number.isFinite(p.twoTheta) ? p.twoTheta.toFixed(4) : '—', unit: '°' },
    { label: '晶面夹角', value: p.angle.toFixed(4), unit: '°' },
    { label: '晶向夹角', value: p.dirAngle.toFixed(4), unit: '°' },
    { label: '晶面-晶向夹角', value: p.planeDirAngle.toFixed(4), unit: '°' },
  ]
})

const fourValid = computed(() => isValidFourIndex(planeInfo.value?.four ?? [0, 0, 0, 0]))
const fourDirText = computed(() => {
  const values = planeInfo.value?.fourDir
  if (!values) return '—'
  return values.map((v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2))).join(' ')
})

const reportText = computed(() => {
  const p = planeInfo.value
  if (!p) return '晶胞参数无效。'
  const lines = [
    'CrystalToolBox · 晶面与晶向',
    `晶胞: a=${cell.a}, b=${cell.b}, c=${cell.c}, α=${cell.alpha}, β=${cell.beta}, γ=${cell.gamma}`,
    '',
    `晶面 (${hklA.value.join(' ')})，四指数 (${p.four.join(' ')})`,
    `d = ${p.d.toFixed(6)} Å`,
    `|g| = ${p.g.toFixed(6)} Å⁻¹`,
    `2θ(Cu Kα1) = ${Number.isFinite(p.twoTheta) ? p.twoTheta.toFixed(6) : '—'}°`,
    `截距: ${p.intercepts.text}`,
    '',
    `晶向 [${uvwA.value.join(' ')}]，四指数 [${fourDirText.value}]`,
    `Weiss 定律 (hkl)·[uvw] = ${p.weiss}`,
    `晶面间夹角 = ${p.angle.toFixed(6)}°`,
    `晶向间夹角 = ${p.dirAngle.toFixed(6)}°`,
    `晶面-晶向夹角 = ${p.planeDirAngle.toFixed(6)}°`,
    `两晶面决定的带轴 = ${p.zone ? `[${p.zone.join(' ')}]` : '—'}`,
    '',
    `空间群 #${sgNumber.value} ${sgMeta.value?.symbol ?? ''}`,
    selectedAbsent.value
      ? `(${hklA.value.join(' ')}): ${selectedAbsent.value.absent ? '系统消光' : '允许'}; |F_gen|/N = ${selectedAbsent.value.amplitude.toFixed(6)}`
      : '未加载对称操作',
    axial.value ? `轴向条件: h00 ${axial.value.h}; 0k0 ${axial.value.k}; 00l ${axial.value.l}` : '',
    '',
    `带轴 [${zoneVec.value?.join(' ') ?? ''}] 内的允许晶面:`,
    ...zonePlanes.value
      .slice(0, 30)
      .map((row) => `(${row.hkl.join(' ')})  d=${row.d.toFixed(5)} Å  ∠=${row.angle.toFixed(3)}°`),
  ]
  return lines.filter(Boolean).join('\r\n')
})

function applyPreset(id: string) {
  const preset = STRUCTURE_PRESETS.find((p) => p.id === id)
  if (!preset) return
  Object.assign(cell, preset.cell)
  presetId.value = preset.id
  if (preset.spaceGroupNumber) sgNumber.value = preset.spaceGroupNumber
}

function useStoreCell() {
  Object.assign(cell, store.current.cell)
  if (store.current.spaceGroupNumber) sgNumber.value = store.current.spaceGroupNumber
  presetId.value = ''
}

function swapPlanes() {
  const tmp = { h: planeA.h, k: planeA.k, l: planeA.l }
  planeA.h = planeB.h
  planeA.k = planeB.k
  planeA.l = planeB.l
  planeB.h = tmp.h
  planeB.k = tmp.k
  planeB.l = tmp.l
}

function setZoneFromPlanes() {
  const p = planeInfo.value
  if (!p?.zone) return
  zoneInput.u = p.zone[0]
  zoneInput.v = p.zone[1]
  zoneInput.w = p.zone[2]
}

function exportCsv() {
  const p = planeInfo.value
  if (!p) return
  const lines = [
    'item,value,unit',
    `h,${hklA.value[0]},`,
    `k,${hklA.value[1]},`,
    `l,${hklA.value[2]},`,
    `d,${p.d.toFixed(6)},A`,
    `g,${p.g.toFixed(6)},1/A`,
    `twoTheta_CuKa1,${Number.isFinite(p.twoTheta) ? p.twoTheta.toFixed(6) : ''},deg`,
    `plane_angle,${p.angle.toFixed(6)},deg`,
    `direction_angle,${p.dirAngle.toFixed(6)},deg`,
    `weiss,${p.weiss},`,
    '',
    'hkl,d_A,angle_to_first_deg',
    ...zonePlanes.value.map((row) => `${row.hkl.join(' ')},${row.d.toFixed(6)},${row.angle.toFixed(4)}`),
  ]
  downloadText(
    '\uFEFF' + lines.join('\r\n'),
    safeFilename(`indices_${hklA.value.join('')}_${timestamp()}`, 'csv'),
    'text/csv;charset=utf-8',
  )
  ElMessage.success('已导出晶面/晶向 CSV')
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(reportText.value)
    ElMessage.success('已复制计算报告')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}
</script>

<template>
  <ToolPage
    tool-id="indices"
    title="晶面与晶向"
    subtitle="Miller 指数、四指数换算、d 值、晶面/晶向夹角、晶带轴与 Weiss 定律，并直接检查空间群系统消光。"
    doc="/docs/userguide/indices"
    v-model:result-state="drawer"
    result-title="晶面与晶向计算"
    :result-tabs="resultTabs"
    :saved-at="draft.savedAt"
    :restored="draft.restored"
    :state-error="draft.error"
    @reset="resetAll"
    @clear="clearPage"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" @click="drawer = 'half'">查看计算报告</button>
      <button type="button" class="btn" @click="exportCsv"><Download /> CSV</button>
      <button type="button" class="btn" @click="copyReport"><Copy /> 复制</button>
    </template>

    <template #source>
      <PanelCard title="晶胞" :icon="Atom">
        <div class="grid-2">
          <label class="field">
            <span class="field__label">预设</span>
            <el-select :model-value="presetId" size="small" filterable @update:model-value="applyPreset">
              <el-option
                v-for="preset in STRUCTURE_PRESETS"
                :key="preset.id"
                :label="`${preset.name} (${preset.formula})`"
                :value="preset.id"
              />
            </el-select>
          </label>
          <button type="button" class="btn btn--quiet" style="align-self: end" @click="useStoreCell">当前结构</button>
        </div>
        <div class="grid-3">
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
      <PanelCard title="晶面指数" :icon="Grid3x3">
        <div class="grid-3">
          <NumberField v-model="planeA.h" label="h" :precision="0" />
          <NumberField v-model="planeA.k" label="k" :precision="0" />
          <NumberField v-model="planeA.l" label="l" :precision="0" />
        </div>
        <div class="index-line">
          <span class="chip chip--accent mono">{{ formatHkl(hklA) }}</span>
          <span class="chip chip--mono">→ ({{ planeInfo?.four.join(' ') ?? '—' }})</span>
          <span v-if="!fourValid" class="chip chip--warn">四指数约束 h+k+i=0</span>
        </div>
        <div class="grid-3">
          <NumberField v-model="planeB.h" label="h₂" :precision="0" />
          <NumberField v-model="planeB.k" label="k₂" :precision="0" />
          <NumberField v-model="planeB.l" label="l₂" :precision="0" />
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn--quiet" @click="swapPlanes"><ArrowLeftRight /> 交换两组</button>
          <button type="button" class="btn btn--quiet" @click="setZoneFromPlanes">用两晶面定带轴</button>
        </div>
      </PanelCard>

      <PanelCard title="晶向指数" :icon="Compass">
        <div class="grid-3">
          <NumberField v-model="dirA.u" label="u" :precision="0" />
          <NumberField v-model="dirA.v" label="v" :precision="0" />
          <NumberField v-model="dirA.w" label="w" :precision="0" />
        </div>
        <div class="index-line">
          <span class="chip chip--accent mono">[{{ uvwA.join(' ') }}]</span>
          <span class="chip chip--mono">→ [{{ fourDirText }}]</span>
        </div>
        <div class="grid-3">
          <NumberField v-model="dirB.u" label="u₂" :precision="0" />
          <NumberField v-model="dirB.v" label="v₂" :precision="0" />
          <NumberField v-model="dirB.w" label="w₂" :precision="0" />
        </div>
      </PanelCard>

      <PanelCard title="晶带" :icon="Layers">
        <div class="grid-3">
          <NumberField v-model="zoneInput.u" label="u" :precision="0" />
          <NumberField v-model="zoneInput.v" label="v" :precision="0" />
          <NumberField v-model="zoneInput.w" label="w" :precision="0" />
        </div>
        <div class="index-line">
          <span class="chip chip--mono">带轴 [{{ zoneVec?.join(' ') ?? '—' }}]</span>
          <span class="chip chip--mono">{{ zonePlanes.length }} 个允许晶面</span>
        </div>
        <p class="tiny dim">满足 hu + kv + lw = 0 的晶面属于同一晶带；带轴电子衍射即该倒易面的投影。</p>
      </PanelCard>
    </template>

    <template #params>
      <PanelCard title="系统消光" :icon="Ruler">
        <NumberField v-model="sgNumber" label="空间群编号" :min="1" :max="230" :precision="0" />
        <div class="index-line">
          <span class="chip chip--mono">#{{ sgNumber }}</span>
          <span class="chip">{{ sgMeta?.symbol ?? '—' }}</span>
          <span class="chip">{{ sgMeta?.crystalSystem ?? '' }}</span>
        </div>
        <div v-if="selectedAbsent" class="extinction-box" :class="selectedAbsent.absent ? 'is-absent' : 'is-allowed'">
          <b>{{ selectedAbsent.absent ? '系统消光' : '允许反射' }}</b>
          <span class="mono">|F_gen|/N = {{ selectedAbsent.amplitude.toExponential(3) }}</span>
        </div>
        <div v-if="axial" class="kv-list">
          <div class="kv">
            <span>h00</span><span>{{ axial.h }}</span>
          </div>
          <div class="kv">
            <span>0k0</span><span>{{ axial.k }}</span>
          </div>
          <div class="kv">
            <span>00l</span><span>{{ axial.l }}</span>
          </div>
        </div>
        <p v-if="sgError" class="tiny" style="color: var(--danger)">{{ sgError }}</p>
        <p class="tiny dim">由空间群全部对称操作在一般位置求和判定；|F_gen|≈0 即系统消光，与原子种类无关。</p>
      </PanelCard>
    </template>

    <div class="summary-grid">
      <div v-for="item in summary" :key="item.label" class="metric">
        <span class="metric__label">{{ item.label }}</span>
        <span class="metric__value mono">{{ item.value }}</span>
        <span class="metric__unit">{{ item.unit }}</span>
      </div>
    </div>

    <div class="two-col">
      <PanelCard title="几何关系" :icon="Compass">
        <div class="kv-list">
          <div class="kv">
            <span>晶面 ({{ hklA.join(' ') }}) 的 d 值</span><span>{{ planeInfo?.d.toFixed(5) }} Å</span>
          </div>
          <div class="kv">
            <span>晶面截距</span><span>{{ planeInfo?.intercepts.text }}</span>
          </div>
          <div class="kv">
            <span>Weiss 定律 (hkl)·[uvw]</span><span>{{ planeInfo?.weiss }}</span>
          </div>
          <div class="kv">
            <span>两晶面夹角</span><span>{{ planeInfo?.angle.toFixed(5) }}°</span>
          </div>
          <div class="kv">
            <span>两晶向夹角</span><span>{{ planeInfo?.dirAngle.toFixed(5) }}°</span>
          </div>
          <div class="kv">
            <span>晶面与晶向夹角</span><span>{{ planeInfo?.planeDirAngle.toFixed(5) }}°</span>
          </div>
          <div class="kv">
            <span>两晶面决定的带轴</span><span>{{ planeInfo?.zone ? `[${planeInfo.zone.join(' ')}]` : '—' }}</span>
          </div>
        </div>
        <div class="formula-line">
          <MathText tex="hu + kv + lw = 0" block />
          <MathText tex="\cos\theta = \frac{g_1\cdot g_2}{|g_1||g_2|}" block />
        </div>
      </PanelCard>

      <PanelCard title="带内允许晶面" :icon="Layers" :hint="`[${zoneVec?.join(' ') ?? '—'}]`">
        <div class="table-wrap zone-table">
          <table class="data">
            <thead>
              <tr>
                <th>hkl</th>
                <th>四指数</th>
                <th class="num">d (Å)</th>
                <th class="num">与首晶面夹角</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in zonePlanes" :key="row.hkl.join(',')">
                <td>({{ row.hkl.join(' ') }})</td>
                <td>({{ row.four.join(' ') }})</td>
                <td class="num">{{ row.d.toFixed(5) }}</td>
                <td class="num">{{ row.angle.toFixed(3) }}°</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>

    <PanelCard title="消光反射示例" :icon="Ruler" hint="前 40 个禁戒 hkl；完整判断见左侧">
      <div v-if="!checkRows.length" class="small dim">未加载对称操作，或该范围内没有禁戒反射。</div>
      <div v-else class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>hkl</th>
              <th class="num">d (Å)</th>
              <th class="num">|F_gen|/N</th>
              <th>原因</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in checkRows" :key="row.hkl.join(',')">
              <td>({{ row.hkl.join(' ') }})</td>
              <td class="num">{{ row.d.toFixed(5) }}</td>
              <td class="num">{{ row.amplitude.toExponential(2) }}</td>
              <td class="text">{{ row.centeringAllowed ? '螺旋轴/滑移面' : '点阵消光' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PanelCard>

    <template #text>
      <pre class="code-surface"><code>{{ reportText }}</code></pre>
    </template>

    <template #download>
      <div class="btn-row">
        <button type="button" class="btn" @click="exportCsv"><Download /> 晶面/晶向 CSV</button>
      </div>
    </template>

    <template #copy>
      <div class="btn-row">
        <button type="button" class="btn" @click="copyReport"><Copy /> 复制报告</button>
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
  min-width: 0;
}

.metric__label {
  font-size: 9.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric__value {
  font-size: 15px;
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

.extinction-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 9px 0;
  padding: 8px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  font-size: 11px;
}

.extinction-box.is-absent {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
}

.extinction-box.is-allowed {
  color: var(--ok);
  background: var(--ok-soft);
  border-color: color-mix(in srgb, var(--ok) 30%, transparent);
}

.zone-table {
  max-height: 380px;
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
