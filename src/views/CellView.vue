<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Atom, Box, Copy, Download, FlaskConical, Layers, Percent, Scale } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState, ResultTab } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import MathText from '@/components/common/MathText.vue'
import StructurePicker from '@/components/structure/StructurePicker.vue'
import { STRUCTURE_PRESETS } from '@/data/presets'
import { useStructureStore } from '@/stores/structure'
import { atomicMass } from '@/core/diffraction/scattering'
import { buildLattice, dSpacing, type CellParams } from '@/core/lattice/cell'
import {
  cellVolume,
  densityFromAtoms,
  densityFromZ,
  formulaFromAtoms,
  formulaUnitsFromDensity,
  massFractions,
  packingFactor,
  parseFormula,
  unitCellMass,
  type PackingType,
} from '@/core/crystallography/cellMetrics'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const store = useStructureStore()
const drawer = ref<DrawerState>('closed')
const resultTabs: ResultTab[] = ['text', 'download', 'copy']

const sourceMode = ref<'structure' | 'manual'>('structure')
const manualCell = reactive<CellParams>({ a: 5.431, b: 5.431, c: 5.431, alpha: 90, beta: 90, gamma: 90 })
const manualFormula = ref('Si')
const manualZ = ref(8)
const measuredDensity = ref(2.329)
const packingType = ref<PackingType>('diamond')
const cOverA = ref(Math.sqrt(8 / 3))

const activeCell = computed<CellParams>(() => (sourceMode.value === 'structure' ? store.current.cell : manualCell))
const structureAtoms = computed(() => (sourceMode.value === 'structure' ? store.current.atoms : []))
const formulaInfo = computed(() => {
  if (sourceMode.value === 'structure') {
    const preset = STRUCTURE_PRESETS.find((p) => p.id === store.presetId)
    if (preset) {
      const parsed = parseFormula(preset.formula)
      return { formula: parsed.formula, components: parsed.components, warnings: parsed.warnings }
    }
    return { ...formulaFromAtoms(store.current.atoms), warnings: [] as string[] }
  }
  const parsed = parseFormula(manualFormula.value)
  return {
    formula: parsed.formula,
    components: parsed.components,
    warnings: parsed.warnings,
  }
})
const formulaMass = computed(() => {
  if (!formulaInfo.value.formula) return NaN
  return parseFormula(formulaInfo.value.formula).mass
})
const lattice = computed(() => {
  try {
    return buildLattice(activeCell.value)
  } catch {
    return null
  }
})
const volume = computed(() => lattice.value?.volume ?? NaN)
const cellMass = computed(() =>
  sourceMode.value === 'structure' ? unitCellMass(structureAtoms.value) : formulaMass.value * manualZ.value,
)
const density = computed(() => {
  if (sourceMode.value === 'structure') return densityFromAtoms(structureAtoms.value, volume.value)
  return densityFromZ(manualZ.value, formulaMass.value, volume.value)
})
const zValue = computed(() => {
  if (sourceMode.value === 'structure') {
    if (!(formulaMass.value > 0)) return NaN
    return cellMass.value / formulaMass.value
  }
  return manualZ.value
})
const zFromMeasured = computed(() => formulaUnitsFromDensity(measuredDensity.value, volume.value, formulaMass.value))
const atomsPerCell = computed(() => {
  if (sourceMode.value === 'structure') {
    return structureAtoms.value.reduce((s, a) => s + (a.occupancy ?? 1), 0)
  }
  return formulaInfo.value.components.reduce((s, c) => s + c.count, 0) * manualZ.value
})
const packing = computed(() => packingFactor(packingType.value, cOverA.value))
const radiusAngstrom = computed(() => {
  const a = activeCell.value.a
  switch (packingType.value) {
    case 'sc':
      return a / 2
    case 'bcc':
      return (Math.sqrt(3) * a) / 4
    case 'fcc':
      return (Math.sqrt(2) * a) / 4
    case 'diamond':
      return (Math.sqrt(3) * a) / 8
    case 'hcp':
      return a / 2
  }
})

watch(
  () => activeCell.value.c,
  (c) => {
    if (packingType.value === 'hcp' && activeCell.value.a > 0) cOverA.value = c / activeCell.value.a
  },
)

watch(packingType, (type) => {
  if (type === 'hcp' && activeCell.value.a > 0) cOverA.value = activeCell.value.c / activeCell.value.a
})

const PACKING_BY_PRESET: Record<string, PackingType | undefined> = {
  si: 'diamond',
  diamond: 'diamond',
  al: 'fcc',
  cu: 'fcc',
  au: 'fcc',
  fe: 'bcc',
  mg: 'hcp',
}

watch(
  () => store.presetId,
  (id) => {
    if (id && PACKING_BY_PRESET[id]) packingType.value = PACKING_BY_PRESET[id]!
  },
  { immediate: true },
)

const fractions = computed(() => {
  if (sourceMode.value === 'structure') {
    return massFractions(structureAtoms.value).map((f) => ({ ...f, count: 0 }))
  }
  const total = formulaMass.value
  return formulaInfo.value.components.map((c) => {
    const mass = atomicMass(c.element) * c.count
    return { element: c.element, mass, fraction: total > 0 ? mass / total : 0, count: c.count }
  })
})

const summary = computed(() => [
  { label: '晶胞体积 V', value: fmt(volume.value, 3), unit: 'Å³' },
  { label: '理论密度 ρ', value: fmt(density.value, 4), unit: 'g/cm³' },
  { label: '化学式单元数 Z', value: fmt(zValue.value, 3), unit: '' },
  { label: '化学式量 M', value: fmt(formulaMass.value, 3), unit: 'g/mol' },
  { label: '晶胞内原子数', value: fmt(atomsPerCell.value, 2), unit: '个' },
  { label: '空间利用率 APF', value: `${(packing.value.apf * 100).toFixed(2)}`, unit: '%' },
])

const cellRows = computed(() => {
  const c = activeCell.value
  return [
    ['a', fmt(c.a, 5), 'Å'],
    ['b', fmt(c.b, 5), 'Å'],
    ['c', fmt(c.c, 5), 'Å'],
    ['α', fmt(c.alpha, 4), '°'],
    ['β', fmt(c.beta, 4), '°'],
    ['γ', fmt(c.gamma, 4), '°'],
    ['V', fmt(volume.value, 5), 'Å³'],
    ['a*', fmt(lattice.value?.reciprocalParams.aStar, 5), 'Å⁻¹'],
    ['b*', fmt(lattice.value?.reciprocalParams.bStar, 5), 'Å⁻¹'],
    ['c*', fmt(lattice.value?.reciprocalParams.cStar, 5), 'Å⁻¹'],
  ]
})

const lowReflections = computed(() => {
  const l = lattice.value
  if (!l) return []
  const rows: Array<{ hkl: [number, number, number]; d: number; twoTheta: number }> = []
  for (let h = 0; h <= 4; h++) {
    for (let k = -4; k <= 4; k++) {
      for (let li = -4; li <= 4; li++) {
        if (h === 0 && k < 0) continue
        if (h === 0 && k === 0 && li <= 0) continue
        if (h === 0 && k === 0 && li === 0) continue
        const d = dSpacing(l, [h, k, li])
        const sinTheta = 1.54056 / (2 * d)
        if (sinTheta > 1) continue
        rows.push({ hkl: [h, k, li], d, twoTheta: (2 * Math.asin(sinTheta) * 180) / Math.PI })
      }
    }
  }
  return rows.sort((a, b) => b.d - a.d).slice(0, 18)
})

function fmt(value: number | undefined, digits: number): string {
  return Number.isFinite(value) ? (value as number).toFixed(digits) : '—'
}

const reportText = computed(() => {
  const lines = [
    'CrystalToolBox · 晶胞与密度计算',
    `来源: ${sourceMode.value === 'structure' ? store.label : '手动输入'}`,
    `化学式: ${formulaInfo.value.formula || '—'}`,
    '',
    '【晶胞参数】',
    ...cellRows.value.map((row) => `${row[0]}\t${row[1]} ${row[2]}`),
    '',
    '【晶胞内容】',
    `Z = ${fmt(zValue.value, 6)}`,
    `M = ${fmt(formulaMass.value, 6)} g/mol`,
    `晶胞内原子数 = ${fmt(atomsPerCell.value, 3)}`,
    `理论密度 = ${fmt(density.value, 6)} g/cm³`,
    `由密度 ${fmt(measuredDensity.value, 4)} g/cm³ 反算 Z = ${fmt(zFromMeasured.value, 4)}`,
    '',
    '【堆积】',
    `${packing.value.label}: APF = ${(packing.value.apf * 100).toFixed(4)} %, 配位数 ${packing.value.coordination}, ${packing.value.radiusFormula}`,
    '',
    '【质量分数】',
    ...fractions.value.map((f) => `${f.element}\t${(f.fraction * 100).toFixed(4)} %`),
  ]
  return lines.join('\r\n')
})

function exportCsv() {
  const lines = [
    'property,value,unit',
    ...cellRows.value.map((row) => `${row[0]},${row[1]},${row[2]}`),
    `Z,${fmt(zValue.value, 6)},`,
    `M,${fmt(formulaMass.value, 6)},g/mol`,
    `density,${fmt(density.value, 6)},g/cm3`,
    `APF,${(packing.value.apf * 100).toFixed(6)},%`,
    '',
    'element,count,mass_fraction',
    ...fractions.value.map(
      (f) => `${f.element},${sourceMode.value === 'structure' ? '' : f.count},${(f.fraction * 100).toFixed(6)}`,
    ),
  ]
  downloadText(
    '\uFEFF' + lines.join('\r\n'),
    safeFilename(`cell_${formulaInfo.value.formula || 'metrics'}_${timestamp()}`, 'csv'),
    'text/csv;charset=utf-8',
  )
  ElMessage.success('已导出晶胞计算 CSV')
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
    tool-id="cell"
    title="晶胞与密度"
    subtitle="由晶格参数与晶胞内容计算体积、理论密度、Z 值、化学式量与原子堆积因子，并给出低角反射预览。"
    eyebrow="晶体几何 · 03"
    doc="/docs/userguide/cell"
    v-model:result-state="drawer"
    result-title="晶胞计算报告"
    :result-tabs="resultTabs"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" @click="drawer = 'half'">查看计算报告</button>
      <button type="button" class="btn" @click="exportCsv"><Download /> CSV</button>
      <button type="button" class="btn" @click="copyReport"><Copy /> 复制</button>
    </template>

    <template #source>
      <PanelCard title="输入方式" :icon="FlaskConical">
        <div class="segmented" role="tablist">
          <button
            type="button"
            class="segmented__btn"
            :aria-selected="sourceMode === 'structure'"
            @click="sourceMode = 'structure'"
          >
            当前结构
          </button>
          <button
            type="button"
            class="segmented__btn"
            :aria-selected="sourceMode === 'manual'"
            @click="sourceMode = 'manual'"
          >
            手动输入
          </button>
        </div>
        <div v-if="sourceMode === 'structure'" class="structure-block">
          <StructurePicker />
        </div>
        <div v-else class="form-stack">
          <label class="field">
            <span class="field__label">化学式</span>
            <el-input v-model="manualFormula" size="small" placeholder="例如 TiO2、Ca(OH)2" />
          </label>
          <div class="grid-2">
            <NumberField v-model="manualZ" label="Z（化学式单元数）" :min="0.001" :precision="3" />
            <NumberField v-model="measuredDensity" label="实测密度" unit="g/cm³" :min="0.0001" :precision="4" />
          </div>
          <div class="grid-3">
            <NumberField v-model="manualCell.a" label="a" unit="Å" :min="0.001" :precision="5" />
            <NumberField v-model="manualCell.b" label="b" unit="Å" :min="0.001" :precision="5" />
            <NumberField v-model="manualCell.c" label="c" unit="Å" :min="0.001" :precision="5" />
          </div>
          <div class="grid-3">
            <NumberField v-model="manualCell.alpha" label="α" unit="°" :min="1" :max="179" :precision="4" />
            <NumberField v-model="manualCell.beta" label="β" unit="°" :min="1" :max="179" :precision="4" />
            <NumberField v-model="manualCell.gamma" label="γ" unit="°" :min="1" :max="179" :precision="4" />
          </div>
        </div>
      </PanelCard>
    </template>

    <template #config>
      <PanelCard title="堆积模型" :icon="Layers">
        <label class="field">
          <span class="field__label">结构类型</span>
          <el-select v-model="packingType" size="small">
            <el-option label="简单立方 SC" value="sc" />
            <el-option label="体心立方 BCC" value="bcc" />
            <el-option label="面心立方 FCC" value="fcc" />
            <el-option label="六方密排 HCP" value="hcp" />
            <el-option label="金刚石结构" value="diamond" />
          </el-select>
        </label>
        <NumberField
          v-if="packingType === 'hcp'"
          v-model="cOverA"
          label="c/a"
          :min="0.5"
          :max="3"
          :precision="4"
          hint="理想值 √(8/3) ≈ 1.633"
        />
        <div class="apf-box">
          <div class="apf-box__value mono">{{ (packing.apf * 100).toFixed(2) }}%</div>
          <div class="apf-box__label">原子堆积因子 APF</div>
          <div class="apf-bar"><span :style="{ width: `${Math.min(100, packing.apf * 100)}%` }" /></div>
        </div>
        <div class="kv-list">
          <div class="kv">
            <span>原子数/晶胞</span><span>{{ packing.atomsPerCell }}</span>
          </div>
          <div class="kv">
            <span>配位数</span><span>{{ packing.coordination }}</span>
          </div>
          <div class="kv">
            <span>原子半径</span><span>{{ packing.radiusFormula }} = {{ radiusAngstrom.toFixed(4) }} Å</span>
          </div>
        </div>
        <p class="tiny dim">{{ packing.note }}</p>
        <p class="tiny dim" style="margin-top: 4px">
          堆积模型是独立的教学对比，不自动等同于当前晶胞；复杂化合物请按实际原子半径判断。
        </p>
      </PanelCard>

      <PanelCard title="由密度反算 Z" :icon="Scale">
        <NumberField v-model="measuredDensity" label="实测密度" unit="g/cm³" :min="0.0001" :precision="4" />
        <div class="z-result">
          <span class="z-result__value mono">{{ fmt(zFromMeasured, 4) }}</span>
          <span class="z-result__label">个化学式 / 晶胞</span>
        </div>
        <MathText tex="Z = \frac{\rho V N_A}{M}" block />
        <p class="tiny dim">V 以 Å³ 计，ρ 以 g/cm³ 计；结果可用于指标化时筛选候选晶胞。</p>
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
      <PanelCard title="晶胞参数与倒易参数" :icon="Box" hint="Cu Kα 用于低角反射">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>参数</th>
                <th class="num">数值</th>
                <th>单位</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in cellRows" :key="row[0]">
                <td class="text">{{ row[0] }}</td>
                <td class="num">{{ row[1] }}</td>
                <td>{{ row[2] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="formula-line">
          <MathText tex="V = abc\sqrt{1-\cos^2\alpha-\cos^2\beta-\cos^2\gamma+2\cos\alpha\cos\beta\cos\gamma}" block />
          <MathText tex="\rho = \frac{ZM}{N_A V}" block />
        </div>
      </PanelCard>

      <PanelCard title="晶胞内容与质量分数" :icon="Atom" :hint="formulaInfo.formula || '—'">
        <div class="content-head">
          <span class="chip chip--accent">{{ formulaInfo.formula || '未识别' }}</span>
          <span class="chip chip--mono">M = {{ fmt(formulaMass, 3) }} g/mol</span>
          <span class="chip chip--mono">Z = {{ fmt(zValue, 3) }}</span>
        </div>
        <div class="frac-list">
          <div v-for="f in fractions" :key="f.element" class="frac-row">
            <span class="frac-row__el mono">{{ f.element }}</span>
            <div class="frac-row__bar"><span :style="{ width: `${(f.fraction * 100).toFixed(1)}%` }" /></div>
            <span class="frac-row__val mono">{{ (f.fraction * 100).toFixed(2) }}%</span>
          </div>
        </div>
        <div v-if="formulaInfo.warnings?.length" class="issue issue--warning">
          <div v-for="w in formulaInfo.warnings" :key="w">{{ w }}</div>
        </div>
        <p class="tiny dim">质量分数由晶胞内原子占有率求和；结构模式下自动按最简整数比约化化学式。</p>
      </PanelCard>
    </div>

    <PanelCard title="低角反射预览" :icon="Percent" hint="按 d 值降序，未做结构因子消光">
      <div class="table-wrap reflection-table">
        <table class="data">
          <thead>
            <tr>
              <th>hkl</th>
              <th class="num">d (Å)</th>
              <th class="num">2θ Cu Kα1 (°)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in lowReflections" :key="row.hkl.join(',')">
              <td>({{ row.hkl.join(' ') }})</td>
              <td class="num">{{ row.d.toFixed(5) }}</td>
              <td class="num">{{ row.twoTheta.toFixed(4) }}</td>
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
        <button type="button" class="btn" @click="exportCsv"><Download /> 晶胞计算 CSV</button>
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
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
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

.structure-block {
  margin-top: 10px;
}

.formula-line {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.apf-box {
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
}

.apf-box__value {
  font-size: 28px;
  font-weight: 750;
  color: var(--accent);
  letter-spacing: -0.03em;
}

.apf-box__label {
  font-size: 10px;
  color: var(--text-3);
}

.apf-bar {
  height: 6px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}

.apf-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), #38bdf8);
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 10px;
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

.z-result {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 10px 0;
}

.z-result__value {
  font-size: 26px;
  font-weight: 700;
  color: var(--accent);
}

.z-result__label {
  font-size: 10px;
  color: var(--text-3);
}

.content-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.frac-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.frac-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 52px;
  gap: 8px;
  align-items: center;
}

.frac-row__el {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
}

.frac-row__bar {
  height: 7px;
  border-radius: 999px;
  background: var(--surface-3);
  overflow: hidden;
}

.frac-row__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), #60a5fa);
}

.frac-row__val {
  text-align: right;
  font-size: 10px;
  color: var(--text-3);
}

.reflection-table {
  max-height: 320px;
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
