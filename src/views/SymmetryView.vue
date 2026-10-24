<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Atom, Download, Info, Layers, Search, Shapes, Sparkles } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState, ResultTab } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import MathText from '@/components/common/MathText.vue'
import { SPACE_GROUP_INDEX, loadSpaceGroup, toSymOps, type SpaceGroup } from '@/core/data/spacegroups'
import { analyseSpaceGroup, siteOrbit } from '@/core/crystallography/symmetryInfo'
import { formatHkl } from '@/core/math/vec'
import { useToolDraft } from '@/composables/useToolDraft'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const drawer = ref<DrawerState>('closed')
const resultTabs: ResultTab[] = ['text', 'download', 'copy']

const sgNumber = ref(227)
const coordX = ref(0.125)
const coordY = ref(0.125)
const coordZ = ref(0.125)
const showAllPositions = ref(false)
const filterText = ref('')

const group = shallowRef<SpaceGroup | null>(null)
const loading = ref(false)
const loadError = ref('')

const analysis = computed(() => (group.value ? analyseSpaceGroup(group.value) : null))
const orbit = computed(() => {
  const current = group.value
  if (!current) return null
  return siteOrbit(toSymOps(current), { x: coordX.value, y: coordY.value, z: coordZ.value })
})

const generalPositions = computed(() => {
  const list = analysis.value?.generalPositions ?? []
  return showAllPositions.value ? list : list.slice(0, 36)
})

const rows = computed(() => {
  const list = analysis.value?.absences ?? []
  const filter = filterText.value.trim()
  const filtered = filter
    ? list.filter((row) => formatHkl(row.hkl, 'round').includes(filter) || row.hkl.join(' ').includes(filter))
    : list
  return filtered.slice(0, 160)
})

const absentCount = computed(() => analysis.value?.absences.filter((row) => !row.allowed).length ?? 0)
const allowedCount = computed(() => analysis.value?.absences.filter((row) => row.allowed).length ?? 0)

const summary = computed(() => {
  const a = analysis.value
  if (!a) return []
  return [
    { label: '空间群', value: a.meta.symbol, unit: `#${a.meta.number}` },
    { label: '晶系', value: a.meta.crystalSystem, unit: '' },
    { label: '点群', value: a.meta.pointGroup, unit: '' },
    { label: '点阵', value: `${a.meta.latticeType} 心`, unit: '' },
    { label: '一般位置数', value: String(a.generalMultiplicity), unit: 'positions' },
    {
      label: '手性',
      value: a.chiral ? '手性空间群' : '非手性',
      unit: a.chiral ? 'chiral' : 'achiral',
    },
  ]
})

const coordsText = computed(() => {
  const o = orbit.value
  if (!o) return ''
  return `${o.multiplicity} 个等效位置，位置对称性阶数 ${o.siteSymmetryOrder}，${o.special ? '特殊位置' : '一般位置'}`
})

function formatCoord(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

const reportText = computed(() => {
  const a = analysis.value
  const o = orbit.value
  if (!a || !group.value) return ''
  const lines = [
    'CrystalToolBox · 空间群对称性摘要',
    `空间群 #${a.meta.number} ${a.meta.symbol}（${a.meta.crystalSystem}，点群 ${a.meta.pointGroup}）`,
    `点阵：${a.conditions.centering}`,
    `一般位置数：${a.generalMultiplicity}`,
    `手性：${a.chiral ? '是' : '否'}。${a.chiralityReason}`,
    '',
    '【反射条件】',
    `h00：${a.conditions.h00}`,
    `0k0：${a.conditions.k00}`,
    `00l：${a.conditions['00l']}`,
    `点阵：${a.conditions.centering}`,
    '',
    `【坐标 (${coordX.value}, ${coordY.value}, ${coordZ.value}) 的等效位置】`,
    o ? `${o.multiplicity} 个位置，位置对称性阶数 ${o.siteSymmetryOrder}，${o.special ? '特殊位置' : '一般位置'}` : '—',
    ...(o?.positions.map((p) => `(${formatCoord(p.x)}, ${formatCoord(p.y)}, ${formatCoord(p.z)})`) ?? []),
    '',
    `【系统消光示例（前 ${Math.min(160, a.absences.length)} 条）】`,
    ...rows.value.map(
      (row) => `${formatHkl(row.hkl, 'round')}\t${row.allowed ? '允许' : '消光'}\t${row.amplitude.toExponential(2)}`,
    ),
  ]
  return lines.join('\r\n')
})

const defaults = () => ({
  sgNumber: 227,
  coordX: 0.125,
  coordY: 0.125,
  coordZ: 0.125,
  showAllPositions: false,
  filterText: '',
})

const draft = useToolDraft({
  toolId: 'symmetry',
  defaults,
  snapshot: () => ({
    sgNumber: sgNumber.value,
    coordX: coordX.value,
    coordY: coordY.value,
    coordZ: coordZ.value,
    showAllPositions: showAllPositions.value,
    filterText: filterText.value,
  }),
  restore: (data) => {
    sgNumber.value = Math.min(230, Math.max(1, Math.round(data.sgNumber)))
    coordX.value = data.coordX
    coordY.value = data.coordY
    coordZ.value = data.coordZ
    showAllPositions.value = data.showAllPositions
    filterText.value = data.filterText
  },
})

async function loadGroup(number: number) {
  loading.value = true
  loadError.value = ''
  try {
    const result = await loadSpaceGroup(number)
    group.value = result
    if (!result) loadError.value = `未找到空间群 #${number}`
  } catch {
    group.value = null
    loadError.value = '空间群数据无法打开，请换一个编号重试。'
  } finally {
    loading.value = false
  }
}

watch(sgNumber, (number) => void loadGroup(number), { immediate: true })

function resetAll() {
  draft.reset()
  void loadGroup(sgNumber.value)
}

async function clearPage() {
  try {
    await ElMessageBox.confirm('将清空本页空间群、坐标和自动保存记录。确定继续？', '清空本页', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  draft.clear()
  void loadGroup(sgNumber.value)
  ElMessage.success('已清空本页')
}

function exportReport() {
  downloadText(reportText.value, safeFilename(`SYMMETRY_${sgNumber.value}_${timestamp()}`, 'txt'))
  ElMessage.success('已导出对称性摘要')
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(reportText.value)
    ElMessage.success('已复制对称性摘要')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}
</script>

<template>
  <ToolPage
    tool-id="symmetry"
    title="对称性、消光与手性"
    subtitle="查询空间群的一般位置、等效位置数、位置对称性、系统消光与手性，直接对照晶体学笔记中的对称操作。"
    doc="/docs/userguide/symmetry"
    v-model:result-state="drawer"
    result-title="对称性摘要"
    :result-tabs="resultTabs"
    :saved-at="draft.savedAt"
    :restored="draft.restored"
    :state-error="draft.error"
    @reset="resetAll"
    @clear="clearPage"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" :disabled="!analysis" @click="drawer = 'half'">
        查看完整摘要
      </button>
      <button type="button" class="btn" :disabled="!analysis" @click="exportReport"><Download /> TXT</button>
    </template>

    <template #params>
      <PanelCard title="空间群" :icon="Shapes">
        <div class="form-stack">
          <label class="field">
            <span class="field__label">编号或符号</span>
            <el-select v-model="sgNumber" filterable size="small" placeholder="输入编号或符号">
              <el-option
                v-for="meta in SPACE_GROUP_INDEX"
                :key="meta.number"
                :label="`#${meta.number} · ${meta.symbol}`"
                :value="meta.number"
              />
            </el-select>
          </label>
          <p class="tiny dim">
            当前：{{ analysis?.meta.symbol ?? '—' }} · {{ analysis?.meta.crystalSystem ?? '—' }} ·
            {{ analysis?.meta.pointGroup ?? '—' }}
          </p>
          <p v-if="loading" class="tiny dim">正在载入空间群…</p>
          <p v-if="loadError" class="field-error">{{ loadError }}</p>
        </div>
      </PanelCard>

      <PanelCard title="某个坐标的等效位置" :icon="Atom">
        <div class="form-stack">
          <div class="grid-3">
            <NumberField v-model="coordX" label="x" :precision="4" />
            <NumberField v-model="coordY" label="y" :precision="4" />
            <NumberField v-model="coordZ" label="z" :precision="4" />
          </div>
          <p class="tiny dim">
            {{ coordsText || '输入分数坐标，查看该位置的等效位置数与位置对称性阶数。' }}
          </p>
          <p class="tiny dim">
            说明：Wyckoff 字母需对照国际晶体学表；本页给出等效位置数与位置对称性阶数，不猜测字母。
          </p>
        </div>
      </PanelCard>

      <PanelCard title="筛选" :icon="Search">
        <div class="form-stack">
          <label class="field">
            <span class="field__label">按 hkl 筛选消光表</span>
            <input v-model="filterText" class="text-input mono" placeholder="例如 111 或 2 0 0" />
          </label>
          <label class="inline small muted">
            <el-switch v-model="showAllPositions" size="small" />
            显示全部一般位置
          </label>
        </div>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard title="手性判断" :icon="Sparkles">
        <div v-if="analysis">
          <div class="chirality" :class="analysis.chiral ? 'is-chiral' : 'is-achiral'">
            {{ analysis.chiral ? '手性空间群' : '非手性空间群' }}
          </div>
          <p class="small muted" style="margin-top: 7px; line-height: 1.65">{{ analysis.chiralityReason }}</p>
        </div>
      </PanelCard>

      <PanelCard title="反射条件" :icon="Layers">
        <div v-if="analysis" class="kv-list mono">
          <div class="kv"><span>h00</span><span>{{ analysis.conditions.h00 }}</span></div>
          <div class="kv"><span>0k0</span><span>{{ analysis.conditions.k00 }}</span></div>
          <div class="kv"><span>00l</span><span>{{ analysis.conditions['00l'] }}</span></div>
          <div class="kv"><span>点阵</span><span>{{ analysis.conditions.centering }}</span></div>
        </div>
      </PanelCard>

      <PanelCard title="公式" :icon="Info">
        <MathText tex="F_{gen}(hkl)=\sum_{j} e^{2\pi i(hx_j+ky_j+lz_j)}" block />
        <p class="small muted" style="margin-top: 7px">
          在一般位置对全部对称操作求和；|F<sub>gen</sub>| ≈ 0 即为与原子种类无关的系统消光。
        </p>
      </PanelCard>
    </template>

    <div class="symmetry-stats">
      <div v-for="item in summary" :key="item.label" class="symmetry-stat">
        <div class="symmetry-stat__label">{{ item.label }}</div>
        <div class="symmetry-stat__value mono">
          {{ item.value }} <span>{{ item.unit }}</span>
        </div>
      </div>
    </div>

    <div class="symmetry-grid">
      <PanelCard title="等效位置" :icon="Atom" :hint="coordsText">
        <div v-if="orbit" class="table-wrap position-table">
          <table class="data">
            <thead>
              <tr><th>#</th><th>x</th><th>y</th><th>z</th></tr>
            </thead>
            <tbody>
              <tr v-for="(position, index) in orbit.positions" :key="index">
                <td>{{ index + 1 }}</td>
                <td>{{ formatCoord(position.x) }}</td>
                <td>{{ formatCoord(position.y) }}</td>
                <td>{{ formatCoord(position.z) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>

      <PanelCard title="一般位置（Seitz 记号）" :icon="Layers" :hint="`${analysis?.generalMultiplicity ?? 0} 个`">
        <div class="position-list mono">
          <span v-for="(position, index) in generalPositions" :key="index">{{ position }}</span>
        </div>
        <p v-if="!showAllPositions && (analysis?.generalPositions.length ?? 0) > 36" class="tiny dim">
          已显示前 36 条；在左侧打开“显示全部一般位置”查看全部。
        </p>
      </PanelCard>
    </div>

    <PanelCard
      title="系统消光表"
      :icon="Search"
      :hint="`${absentCount} 消光 / ${allowedCount} 允许（h,k,l ≤ 8）`"
    >
      <div class="table-wrap absence-table">
        <table class="data">
          <thead>
            <tr><th>hkl</th><th>判定</th><th class="num">|F_gen|</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.hkl.join(',')">
              <td>{{ formatHkl(row.hkl, 'round') }}</td>
              <td>
                <span class="chip" :class="row.allowed ? 'chip--ok' : 'chip--danger'">
                  {{ row.allowed ? '允许' : '消光' }}
                </span>
              </td>
              <td class="num">{{ row.amplitude.toExponential(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="analysis?.warnings.length" class="warn-list">
        <div v-for="warning in analysis.warnings" :key="warning" class="issue issue--warning">
          <div>{{ warning }}</div>
        </div>
      </div>
    </PanelCard>

    <template #text>
      <pre v-if="reportText" class="code-surface"><code>{{ reportText }}</code></pre>
    </template>

    <template #download>
      <div class="row">
        <button type="button" class="btn" :disabled="!analysis" @click="exportReport"><Download /> 导出 TXT</button>
      </div>
      <p class="section-note">摘要含空间群、反射条件、指定坐标的等效位置与消光示例。</p>
    </template>

    <template #copy>
      <div class="row">
        <button type="button" class="btn" :disabled="!analysis" @click="copyReport"><Download /> 复制摘要</button>
      </div>
      <pre class="code-surface"><code>{{ reportText }}</code></pre>
    </template>
  </ToolPage>
</template>

<style scoped>
.symmetry-stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 9px;
}

.symmetry-stat {
  padding: 10px;
  border: 1px solid var(--border-soft);
  border-radius: 7px;
  background: var(--surface-2);
}

.symmetry-stat__label {
  font-size: 10px;
  color: var(--text-3);
}

.symmetry-stat__value {
  margin-top: 5px;
  font-size: 14px;
  color: var(--text);
}

.symmetry-stat__value span {
  font-size: 10px;
  color: var(--text-3);
}

.symmetry-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.position-table,
.absence-table {
  max-height: 360px;
}

.position-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 320px;
  overflow: auto;
  font-size: 10.5px;
  color: var(--text-2);
}

.chirality {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.chirality.is-chiral {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.12);
}

.chirality.is-achiral {
  color: var(--ok);
  background: var(--ok-soft);
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

.text-input {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 12px;
}

.warn-list {
  margin-top: 10px;
}

@media (max-width: 1100px) {
  .symmetry-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .symmetry-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 680px) {
  .symmetry-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
