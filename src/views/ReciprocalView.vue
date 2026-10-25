<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Calculator, Grid3x3, Info, Ruler, ScanLine, Sparkles } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import MathText from '@/components/common/MathText.vue'
import DiffractionCanvas, { type DiffractionPoint } from '@/components/chart/DiffractionCanvas.vue'
import {
  buildLattice,
  dSpacing,
  directionAngle,
  gLength,
  planeAngle,
  planeDirectionAngle,
  type CellParams,
} from '@/core/lattice/cell'
import { buildPlaneBasis, generateNet, formatZone } from '@/core/lattice/planeNet'
import { centeringAllows, normalizeZone, planesInZone, zoneAxisFromPlanes } from '@/core/lattice/zone'
import { formatHkl } from '@/core/math/vec'
import { STRUCTURE_PRESETS } from '@/data/presets'
import { getSpaceGroupMeta } from '@/core/data/spacegroups'
import { useStructureStore } from '@/stores/structure'
import { useToolDraft } from '@/composables/useToolDraft'

const router = useRouter()
const structureStore = useStructureStore()

const cell = reactive<CellParams>({ ...STRUCTURE_PRESETS[0].cell })
const presetId = ref<string | null>(STRUCTURE_PRESETS[0].id)
const latticeType = ref('P')
const maxIndex = ref(6)
const applyCentering = ref(true)
const filterText = ref('')
const maxG = ref(1.0)

const planeA = reactive({ h: 1, k: 0, l: 0 })
const planeB = reactive({ h: 1, k: 1, l: 1 })
const dirA = reactive({ u: 1, v: 0, w: 0 })
const dirB = reactive({ u: 1, v: 1, w: 1 })
const zoneInput = reactive({ u: 1, v: 1, w: 0 })
const selected = ref<[number, number, number] | null>(null)
let nextTarget: 'A' | 'B' = 'A'

const draft = useToolDraft({
  toolId: 'reciprocal',
  defaults: () => ({
    cell: { ...STRUCTURE_PRESETS[0].cell },
    presetId: STRUCTURE_PRESETS[0].id as string | null,
    latticeType: 'P',
    maxIndex: 6,
    applyCentering: true,
    filterText: '',
    maxG: 1.0,
    planeA: { h: 1, k: 0, l: 0 },
    planeB: { h: 1, k: 1, l: 1 },
    dirA: { u: 1, v: 0, w: 0 },
    dirB: { u: 1, v: 1, w: 1 },
    zoneInput: { u: 1, v: 1, w: 0 },
  }),
  snapshot: () => ({
    cell: { ...cell },
    presetId: presetId.value,
    latticeType: latticeType.value,
    maxIndex: maxIndex.value,
    applyCentering: applyCentering.value,
    filterText: filterText.value,
    maxG: maxG.value,
    planeA: { ...planeA },
    planeB: { ...planeB },
    dirA: { ...dirA },
    dirB: { ...dirB },
    zoneInput: { ...zoneInput },
  }),
  restore: (data) => {
    Object.assign(cell, data.cell)
    presetId.value = data.presetId
    latticeType.value = data.latticeType
    maxIndex.value = data.maxIndex
    applyCentering.value = data.applyCentering
    filterText.value = data.filterText
    maxG.value = data.maxG
    Object.assign(planeA, data.planeA)
    Object.assign(planeB, data.planeB)
    Object.assign(dirA, data.dirA)
    Object.assign(dirB, data.dirB)
    Object.assign(zoneInput, data.zoneInput)
  },
})

function resetAll() {
  draft.reset()
  selected.value = null
}

async function clearPage() {
  try {
    await ElMessageBox.confirm('将清空本页晶胞、晶面/晶向指数、带轴与自动保存记录；不会重置其他页面共用的晶体结构。确定继续？', '清空本页', {
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

watch(
  cell,
  () => {
    if (!presetId.value) return
    const preset = STRUCTURE_PRESETS.find((p) => p.id === presetId.value)
    if (!preset) return
    const same = (['a', 'b', 'c', 'alpha', 'beta', 'gamma'] as const).every(
      (key) => Math.abs(cell[key] - preset.cell[key]) < 1e-9,
    )
    if (!same) presetId.value = null
  },
  { deep: true },
)

const cellError = computed(() => {
  try {
    buildLattice(cell)
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
})

const lattice = computed(() => {
  try {
    return buildLattice(cell)
  } catch {
    return null
  }
})

const metric = computed(() => {
  const l = lattice.value
  if (!l) return null
  return {
    volume: l.volume,
    ...l.reciprocalParams,
    G: l.G,
    Gstar: l.Gstar,
  }
})

function isCanonical(hkl: readonly number[]): boolean {
  const [h, k, l] = hkl
  return h > 0 || (h === 0 && k > 0) || (h === 0 && k === 0 && l > 0)
}

const dTable = computed(() => {
  const l = lattice.value
  if (!l) return []
  const out: Array<{ hkl: [number, number, number]; d: number; g: number; twoTheta: number }> = []
  const seen = new Set<string>()
  for (let h = -maxIndex.value; h <= maxIndex.value; h++) {
    for (let k = -maxIndex.value; k <= maxIndex.value; k++) {
      for (let li = -maxIndex.value; li <= maxIndex.value; li++) {
        if (h === 0 && k === 0 && li === 0) continue
        if (!isCanonical([h, k, li])) continue
        if (applyCentering.value && !centeringAllows([h, k, li], latticeType.value)) continue
        const key = `${h},${k},${li}`
        if (seen.has(key)) continue
        seen.add(key)
        const d = dSpacing(l, [h, k, li])
        const sinTheta = 1.54056 / (2 * d)
        out.push({
          hkl: [h, k, li],
          d,
          g: 1 / d,
          twoTheta: sinTheta <= 1 ? (2 * Math.asin(sinTheta) * 180) / Math.PI : NaN,
        })
      }
    }
  }
  const filter = filterText.value.trim()
  const filtered = filter
    ? out.filter((row) => row.hkl.some((v) => String(v) === filter) || formatHkl(row.hkl, 'round').includes(filter))
    : out
  return filtered.sort((a, b) => b.d - a.d || a.hkl[0] - b.hkl[0]).slice(0, 500)
})

const planeResult = computed(() => {
  const l = lattice.value
  if (!l) return null
  const h1 = [planeA.h, planeA.k, planeA.l]
  const h2 = [planeB.h, planeB.k, planeB.l]
  const g1 = gLength(l, h1)
  const g2 = gLength(l, h2)
  return {
    d1: 1 / g1,
    d2: 1 / g2,
    g1,
    g2,
    angle: planeAngle(l, h1, h2),
  }
})

const directionResult = computed(() => {
  const l = lattice.value
  if (!l) return null
  return {
    angle: directionAngle(l, [dirA.u, dirA.v, dirA.w], [dirB.u, dirB.v, dirB.w]),
  }
})

const planeDirResult = computed(() => {
  const l = lattice.value
  if (!l) return null
  return {
    angle: planeDirectionAngle(l, [planeA.h, planeA.k, planeA.l], [dirA.u, dirA.v, dirA.w]),
  }
})

const zoneFromPlanes = computed(() => {
  try {
    return zoneAxisFromPlanes([planeA.h, planeA.k, planeA.l], [planeB.h, planeB.k, planeB.l])
  } catch {
    return null
  }
})

const zoneVec = computed(() => {
  try {
    return normalizeZone([zoneInput.u, zoneInput.v, zoneInput.w])
  } catch {
    return null
  }
})

const zonePlanes = computed(() => {
  const l = lattice.value
  const z = zoneVec.value
  if (!l || !z) return []
  return planesInZone(l, z, {
    maxIndex: Math.min(maxIndex.value, 8),
    applyCentering: applyCentering.value,
    latticeType: latticeType.value,
  })
    .filter((plane) => isCanonical(plane.hkl))
    .slice(0, 80)
})

const basis = computed(() => {
  const l = lattice.value
  const z = zoneVec.value
  if (!l || !z) return null
  return buildPlaneBasis(l, z)
})

const netPoints = computed<DiffractionPoint[]>(() => {
  const l = lattice.value
  const b = basis.value
  if (!l || !b) return []
  return generateNet(l, b, { maxG: maxG.value }).map((p) => {
    const order = Math.abs(p.i) + Math.abs(p.j)
    return {
      x: p.x,
      y: p.y,
      label: p.isCenter ? '000' : order <= 2 ? formatHkl(p.hkl, 'none') : '',
      isCenter: p.isCenter,
      intensity: p.isCenter ? 100 : Math.max(30, 78 - order * 10),
      meta: p.isCenter ? '透射斑' : `d = ${p.d.toFixed(4)} Å`,
    }
  })
})

const selectedInfo = computed(() => {
  const l = lattice.value
  const hkl = selected.value
  if (!l || !hkl) return null
  return { hkl, d: dSpacing(l, hkl), g: gLength(l, hkl) }
})

function applyPreset(id: string) {
  const preset = STRUCTURE_PRESETS.find((p) => p.id === id)
  if (!preset) return
  Object.assign(cell, preset.cell)
  presetId.value = preset.id
  const meta = getSpaceGroupMeta(preset.spaceGroupNumber)
  latticeType.value = meta?.latticeType ?? 'P'
}

function useAsPlane(hkl: [number, number, number]) {
  selected.value = hkl
  if (nextTarget === 'A') {
    planeA.h = hkl[0]
    planeA.k = hkl[1]
    planeA.l = hkl[2]
    nextTarget = 'B'
  } else {
    planeB.h = hkl[0]
    planeB.k = hkl[1]
    planeB.l = hkl[2]
    nextTarget = 'A'
  }
}

function setSelectedAs(target: 'A' | 'B' | 'zone') {
  const hkl = selected.value
  if (!hkl) return
  if (target === 'A') {
    planeA.h = hkl[0]
    planeA.k = hkl[1]
    planeA.l = hkl[2]
  } else if (target === 'B') {
    planeB.h = hkl[0]
    planeB.k = hkl[1]
    planeB.l = hkl[2]
  } else {
    zoneInput.u = hkl[0]
    zoneInput.v = hkl[1]
    zoneInput.w = hkl[2]
  }
}

function openSaed() {
  const z = zoneVec.value
  if (!z) return
  if (presetId.value) structureStore.loadPreset(presetId.value)
  router.push({ path: '/crystal/saed', query: { zone: z.join(',') } })
}
const dText = computed(() => {
  const head = `${'hkl'.padEnd(12)}${'d(Å)'.padStart(10)}${'|g|(Å⁻¹)'.padStart(12)}${'2θ(Cu Kα)'.padStart(11)}`
  const rows = dTable.value.map((row) =>
    [
      formatHkl(row.hkl, 'round').padEnd(12),
      row.d.toFixed(6).padStart(10),
      row.g.toFixed(6).padStart(12),
      (Number.isFinite(row.twoTheta) ? row.twoTheta.toFixed(4) : '—').padStart(11),
    ].join(''),
  )
  return [head, ...rows].join('\n')
})

async function copyDTable() {
  try {
    await navigator.clipboard.writeText(dText.value)
    ElMessage.success('已复制 d 值表')
  } catch {
    /* 复制不可用时保持静默，用户仍可手动选择文本 */
  }
}

const drawer = ref<DrawerState>('closed')
</script>

<template>
  <ToolPage
    tool-id="reciprocal"
    title="倒易空间计算"
    subtitle="从六个晶格参数出发，计算 d 值、晶面/晶向夹角、晶带轴与二维倒易面，并直接送入 SAED 模拟。"
    doc="/docs/userguide/reciprocal"
    v-model:result-state="drawer"
    result-title="计算结果"
    :saved-at="draft.savedAt"
    :restored="draft.restored"
    :state-error="draft.error"
    @reset="resetAll"
    @clear="clearPage"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" @click="drawer = 'half'">查看计算结果</button>
      <button type="button" class="btn" :disabled="!zoneVec" @click="openSaed">用该带轴模拟 SAED</button>
    </template>

    <template #params>
      <PanelCard title="晶格参数" :icon="Ruler">
        <div class="form-stack">
          <label class="field">
            <span class="field__label">预设晶体</span>
            <el-select :model-value="presetId" size="small" filterable @update:model-value="applyPreset">
              <el-option
                v-for="preset in STRUCTURE_PRESETS"
                :key="preset.id"
                :label="`${preset.name} ${preset.formula} · ${preset.spaceGroupSymbol}`"
                :value="preset.id"
              />
            </el-select>
          </label>
          <div class="grid-3">
            <NumberField v-model="cell.a" label="a" unit="Å" :min="1e-6" :precision="6" />
            <NumberField v-model="cell.b" label="b" unit="Å" :min="1e-6" :precision="6" />
            <NumberField v-model="cell.c" label="c" unit="Å" :min="1e-6" :precision="6" />
            <NumberField v-model="cell.alpha" label="α" unit="°" :min="0.001" :max="179.999" :precision="4" />
            <NumberField v-model="cell.beta" label="β" unit="°" :min="0.001" :max="179.999" :precision="4" />
            <NumberField v-model="cell.gamma" label="γ" unit="°" :min="0.001" :max="179.999" :precision="4" />
          </div>
          <div v-if="cellError" class="issue issue--error">
            <span class="issue__icon" />
            <div>{{ cellError }}</div>
          </div>
        </div>
      </PanelCard>

    </template>

    <template #more>
      <PanelCard title="枚举与消光" :icon="Grid3x3">
        <div class="form-stack">
          <NumberField v-model="maxIndex" label="最大指数 |h|,|k|,|l|" :min="1" :max="12" />
          <label class="field">
            <span class="field__label">点阵类型（消光）</span>
            <el-select v-model="latticeType" size="small">
              <el-option label="P 简单" value="P" />
              <el-option label="I 体心" value="I" />
              <el-option label="F 面心" value="F" />
              <el-option label="C 底心" value="C" />
              <el-option label="A 底心" value="A" />
              <el-option label="B 底心" value="B" />
              <el-option label="R 菱方" value="R" />
            </el-select>
          </label>
          <label class="inline small muted">
            <el-switch v-model="applyCentering" size="small" />
            按点阵消光过滤
          </label>
          <label class="field">
            <span class="field__label">筛选 hkl</span>
            <el-input v-model="filterText" size="small" placeholder="例如 111 或 (1 1 1)" />
          </label>
        </div>
      </PanelCard>

      <PanelCard title="二维倒易面" :icon="Grid3x3">
        <div class="form-stack">
          <div class="grid-3">
            <NumberField v-model="zoneInput.u" label="u" :precision="0" />
            <NumberField v-model="zoneInput.v" label="v" :precision="0" />
            <NumberField v-model="zoneInput.w" label="w" :precision="0" />
          </div>
          <label class="field">
            <span class="field__label">显示半径 <span class="field__unit">Å⁻¹</span></span>
            <el-slider v-model="maxG" :min="0.2" :max="2.5" :step="0.05" size="small" />
          </label>
          <div v-if="basis" class="basis-mini mono">
            <span>g₁ = {{ basis.len1.toFixed(5) }}</span>
            <span>g₂ = {{ basis.len2.toFixed(5) }}</span>
            <span>∠ = {{ basis.angleDeg.toFixed(2) }}°</span>
          </div>
        </div>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard title="选中反射" :icon="Info">
        <div v-if="selectedInfo">
          <div class="selected-hkl mono">{{ formatHkl(selectedInfo.hkl, 'round') }}</div>
          <div class="selected-grid mono">
            <span>d = {{ selectedInfo.d.toFixed(6) }} Å</span>
            <span>|g| = {{ selectedInfo.g.toFixed(6) }} Å⁻¹</span>
          </div>
          <div class="btn-row" style="margin-top: 10px">
            <el-button size="small" @click="setSelectedAs('A')">设为晶面 A</el-button>
            <el-button size="small" @click="setSelectedAs('B')">设为晶面 B</el-button>
            <el-button size="small" @click="setSelectedAs('zone')">设为带轴</el-button>
          </div>
        </div>
        <div v-else class="small dim">点击左侧 d 值表中的一行，或直接编辑晶面指数。</div>
      </PanelCard>

      <PanelCard v-if="basis" title="二维基矢" :icon="Grid3x3">
        <div class="kv-list mono">
          <div class="kv">
            <span>b₁</span><span>{{ formatHkl(basis.b1, 'square') }}</span>
          </div>
          <div class="kv">
            <span>b₂</span><span>{{ formatHkl(basis.b2, 'square') }}</span>
          </div>
          <div class="kv">
            <span>|g₁|</span><span>{{ basis.len1.toFixed(6) }} Å⁻¹</span>
          </div>
          <div class="kv">
            <span>|g₂|</span><span>{{ basis.len2.toFixed(6) }} Å⁻¹</span>
          </div>
          <div class="kv">
            <span>夹角</span><span>{{ basis.angleDeg.toFixed(4) }}°</span>
          </div>
          <div class="kv">
            <span>det</span><span>{{ basis.det }}</span>
          </div>
          <div class="kv">
            <span>带轴</span><span>{{ formatZone(basis.zone) }}</span>
          </div>
        </div>
        <p class="tiny dim" style="margin-top: 8px">
          基矢经二维格点约化，等价于笔记中「取倒数 → 最小整数比 → 过原点」的步骤，但自动处理含 0 的带轴。
        </p>
      </PanelCard>

      <PanelCard title="课程公式" :icon="Calculator">
        <div class="formula-mini">
          <div>
            <span class="field__label">晶面间距</span>
            <MathText :tex="'1/d^2 = h^2a^{*2}+k^2b^{*2}+l^2c^{*2}+2hk\\,a^*b^*\\cos\\gamma^*+\\cdots'" :block="true" />
          </div>
          <div>
            <span class="field__label">晶带方程</span>
            <MathText :tex="'hu+kv+lw=0'" :block="true" />
          </div>
        </div>
      </PanelCard>
    </template>

    <div v-if="metric" class="metric-grid">
      <div class="stat">
        <div class="stat__label">晶胞体积</div>
        <div class="stat__value">{{ metric.volume.toFixed(4) }}<span class="stat__unit">Å³</span></div>
      </div>
      <div class="stat">
        <div class="stat__label">a*</div>
        <div class="stat__value">{{ metric.aStar.toFixed(5) }}<span class="stat__unit">Å⁻¹</span></div>
      </div>
      <div class="stat">
        <div class="stat__label">b*</div>
        <div class="stat__value">{{ metric.bStar.toFixed(5) }}<span class="stat__unit">Å⁻¹</span></div>
      </div>
      <div class="stat">
        <div class="stat__label">c*</div>
        <div class="stat__value">{{ metric.cStar.toFixed(5) }}<span class="stat__unit">Å⁻¹</span></div>
      </div>
      <div class="stat">
        <div class="stat__label">α*</div>
        <div class="stat__value">{{ metric.alphaStar.toFixed(3) }}<span class="stat__unit">°</span></div>
      </div>
      <div class="stat">
        <div class="stat__label">β*</div>
        <div class="stat__value">{{ metric.betaStar.toFixed(3) }}<span class="stat__unit">°</span></div>
      </div>
      <div class="stat">
        <div class="stat__label">γ*</div>
        <div class="stat__value">{{ metric.gammaStar.toFixed(3) }}<span class="stat__unit">°</span></div>
      </div>
    </div>

    <div class="two-panel">
      <PanelCard title="晶面夹角与 d 值" :icon="Ruler">
        <div class="grid-2">
          <div class="plane-box">
            <div class="plane-box__title">晶面 A</div>
            <div class="grid-3">
              <NumberField v-model="planeA.h" label="h" :precision="0" />
              <NumberField v-model="planeA.k" label="k" :precision="0" />
              <NumberField v-model="planeA.l" label="l" :precision="0" />
            </div>
            <div class="plane-box__result mono">d = {{ planeResult?.d1.toFixed(6) }} Å</div>
          </div>
          <div class="plane-box">
            <div class="plane-box__title">晶面 B</div>
            <div class="grid-3">
              <NumberField v-model="planeB.h" label="h" :precision="0" />
              <NumberField v-model="planeB.k" label="k" :precision="0" />
              <NumberField v-model="planeB.l" label="l" :precision="0" />
            </div>
            <div class="plane-box__result mono">d = {{ planeResult?.d2.toFixed(6) }} Å</div>
          </div>
        </div>
        <div class="angle-result">
          <span class="angle-result__label">两晶面夹角</span>
          <span class="angle-result__value mono">{{ planeResult?.angle.toFixed(4) }}°</span>
          <span class="tiny dim">等于两倒易矢量 / 两晶面法向的夹角</span>
        </div>

        <div class="divider" />

        <div class="grid-2">
          <div class="plane-box">
            <div class="plane-box__title">晶向 A</div>
            <div class="grid-3">
              <NumberField v-model="dirA.u" label="u" :precision="0" />
              <NumberField v-model="dirA.v" label="v" :precision="0" />
              <NumberField v-model="dirA.w" label="w" :precision="0" />
            </div>
          </div>
          <div class="plane-box">
            <div class="plane-box__title">晶向 B</div>
            <div class="grid-3">
              <NumberField v-model="dirB.u" label="u" :precision="0" />
              <NumberField v-model="dirB.v" label="v" :precision="0" />
              <NumberField v-model="dirB.w" label="w" :precision="0" />
            </div>
          </div>
        </div>
        <div class="angle-row">
          <span
            >晶向夹角 <b class="mono">{{ directionResult?.angle.toFixed(4) }}°</b></span
          >
          <span
            >晶面 A 与晶向 A 夹角 <b class="mono">{{ planeDirResult?.angle.toFixed(4) }}°</b></span
          >
        </div>
      </PanelCard>

      <PanelCard title="晶带轴与带内晶面" :icon="Grid3x3">
        <div class="zone-box">
          <span class="zone-box__label">由晶面 A × B 得到</span>
          <span class="zone-box__value mono">{{
            zoneFromPlanes ? formatHkl(zoneFromPlanes, 'square') : '两晶面平行'
          }}</span>
          <span v-if="zoneFromPlanes" class="chip chip--ok tiny">满足 hu+kv+lw=0</span>
        </div>
        <div class="zone-input">
          <span class="small muted">当前二维面带轴</span>
          <span class="mono">[{{ zoneInput.u }} {{ zoneInput.v }} {{ zoneInput.w }}]</span>
          <el-button size="small" text type="primary" @click="openSaed">模拟 SAED</el-button>
        </div>
        <div class="table-wrap zone-table">
          <table class="data">
            <thead>
              <tr>
                <th>(hkl)</th>
                <th class="num">d (Å)</th>
                <th class="num">|g| (Å⁻¹)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="plane in zonePlanes" :key="plane.hkl.join(',')">
                <td>{{ formatHkl(plane.hkl, 'round') }}</td>
                <td class="num">{{ plane.d.toFixed(5) }}</td>
                <td class="num">{{ plane.g.toFixed(5) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>

    <template #chart>
      <DiffractionCanvas
        v-if="zoneVec"
        :points="netPoints"
        :max-r="maxG"
        :height="420"
        :caption="`带轴 ${formatZone(zoneVec)} · 半径 ${maxG.toFixed(2)} Å⁻¹`"
      />
      <p v-else class="section-note">请先输入有效的带轴指数。</p>
    </template>

    <template #text>
      <pre class="code-surface"><code>{{ dText }}</code></pre>
    </template>

    <template #copy>
      <div class="row">
        <button type="button" class="btn" :disabled="!dTable.length" @click="copyDTable">复制 d 值表</button>
      </div>
      <pre class="code-surface"><code>{{ dText }}</code></pre>
    </template>
  </ToolPage>
</template>

<style scoped>
.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 3px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.metric-grid .stat {
  padding: 8px 10px;
}

.metric-grid .stat__value {
  font-size: 13px;
}

.metric-grid .stat__unit {
  display: block;
  margin-left: 0;
  margin-top: 1px;
}

.two-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 14px;
}

.plane-box {
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
}

.plane-box__title {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 6px;
}

.plane-box__result {
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--accent);
}

.angle-result {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
  padding: 9px 11px;
  border-radius: 6px;
  border: 1px solid var(--accent-line);
  background: var(--accent-soft);
}

.angle-result__label {
  font-size: 11px;
  color: var(--text-2);
}

.angle-result__value {
  font-size: 20px;
  font-weight: 650;
  color: var(--accent);
}

.angle-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 9px;
  font-size: 11px;
  color: var(--text-2);
}

.angle-row b {
  color: var(--text);
}

.zone-box {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  padding: 9px 11px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
}

.zone-box__label {
  font-size: 10px;
  color: var(--text-3);
}

.zone-box__value {
  font-size: 16px;
  font-weight: 650;
  color: var(--accent);
}

.zone-input {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 9px;
  flex-wrap: wrap;
}

.zone-table {
  max-height: 250px;
  margin-top: 9px;
}

.d-table {
  max-height: 380px;
}

.d-table tr {
  cursor: pointer;
}

.selected-hkl {
  font-size: 22px;
  font-weight: 650;
  color: var(--accent);
}

.selected-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 5px;
  font-size: 10.5px;
  color: var(--text-2);
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 10.5px;
}

.kv {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-2);
}

.kv span:first-child {
  color: var(--text-3);
}

.basis-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 10px;
  color: var(--text-3);
}

.formula-mini {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 1200px) {
  .metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .two-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
