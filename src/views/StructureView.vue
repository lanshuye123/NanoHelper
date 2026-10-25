<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Atom, FileUp, FlaskConical, Grid3x3, Info, Layers, Pencil, ScanLine, Sparkles } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import { useStructureStore } from '@/stores/structure'
import { buildStructureFromCif } from '@/core/crystallography/structureBuilder'
import { buildLattice, dSpacing, gLength, type CellParams } from '@/core/lattice/cell'
import { structureFactor } from '@/core/crystallography/structure'
import { atomicMass } from '@/core/diffraction/scattering'
import { STRUCTURE_PRESETS } from '@/data/presets'
import { readFileText } from '@/utils/download'
import { formatHkl } from '@/core/math/vec'
import { useToolDraft } from '@/composables/useToolDraft'

const router = useRouter()
const store = useStructureStore()

const fileInput = ref<HTMLInputElement | null>(null)
const pasteOpen = ref(false)
const pasteText = ref('')
const loading = ref(false)
const lastParse = ref<{ asymmetric: number; expanded: number; ops: number; source: string } | null>(null)

const draft = useToolDraft({
  toolId: 'structure',
  defaults: () => ({ pasteText: '' }),
  snapshot: () => ({ pasteText: pasteText.value }),
  restore: (data) => {
    pasteText.value = data.pasteText
  },
})

const lastSaved = computed(() => {
  const values = [draft.savedAt ?? 0, store.savedAt ?? 0]
  const latest = Math.max(...values)
  return latest > 0 ? latest : null
})

const wasRestored = computed(() => draft.restored || store.restored)

function resetAll() {
  draft.reset()
  lastParse.value = null
}

async function clearPage() {
  try {
    await ElMessageBox.confirm(
      '将把当前晶体结构恢复为默认预设，并清除 CIF 粘贴内容与自动保存记录；其他使用当前结构的页面会同步变化。确定继续？',
      '清空本页',
      { confirmButtonText: '清空', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  store.resetToDefault()
  draft.clear()
  lastParse.value = null
  ElMessage.success('已恢复默认结构并清空本页')
}

const lattice = computed(() => {
  try {
    return buildLattice(store.current.cell)
  } catch {
    return null
  }
})

const volume = computed(() => lattice.value?.volume ?? 0)

const cellMass = computed(() =>
  store.current.atoms.reduce((sum, atom) => sum + (atom.occupancy ?? 1) * atomicMass(atom.element), 0),
)

const density = computed(() => {
  if (!volume.value || !cellMass.value) return NaN
  return cellMass.value / 6.02214076e23 / (volume.value * 1e-24)
})

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

const formula = computed(() => {
  const counts = new Map<string, number>()
  for (const atom of store.current.atoms) {
    counts.set(atom.element, (counts.get(atom.element) ?? 0) + (atom.occupancy ?? 1))
  }
  if (!counts.size) return '—'
  const values = [...counts.values()]
  let divisor = Math.round(values[0])
  for (const v of values.slice(1)) divisor = gcd(divisor, v)
  if (!Number.isFinite(divisor) || divisor < 1) divisor = 1
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([element, count]) => {
      const n = count / divisor
      const rounded = Math.abs(n - Math.round(n)) < 1e-3 ? Math.round(n).toString() : n.toFixed(2)
      return `${element}${rounded === '1' ? '' : rounded}`
    })
  return parts.join('')
})

const reflections = computed(() => {
  const l = lattice.value
  if (!l) return []
  const byD = new Map<string, { hkl: [number, number, number]; d: number; g: number; f2: number; absF: number }>()
  for (let h = -4; h <= 4; h++) {
    for (let k = -4; k <= 4; k++) {
      for (let li = -4; li <= 4; li++) {
        if (h === 0 && k === 0 && li === 0) continue
        if (!(h > 0 || (h === 0 && k > 0) || (h === 0 && k === 0 && li > 0))) continue
        const sf = structureFactor(l, store.current.atoms, [h, k, li])
        if (sf.absent) continue
        const d = dSpacing(l, [h, k, li])
        const key = d.toFixed(4)
        const candidate = {
          hkl: [h, k, li] as [number, number, number],
          d,
          g: gLength(l, [h, k, li]),
          f2: sf.f2,
          absF: sf.absF,
        }
        const existing = byD.get(key)
        if (
          !existing ||
          h > existing.hkl[0] ||
          (h === existing.hkl[0] && (k > existing.hkl[1] || (k === existing.hkl[1] && li > existing.hkl[2])))
        ) {
          byD.set(key, candidate)
        }
      }
    }
  }
  return [...byD.values()].sort((a, b) => b.d - a.d).slice(0, 24)
})

const cellFields: Array<{ key: keyof CellParams; label: string; unit: string }> = [
  { key: 'a', label: 'a', unit: 'Å' },
  { key: 'b', label: 'b', unit: 'Å' },
  { key: 'c', label: 'c', unit: 'Å' },
  { key: 'alpha', label: 'α', unit: '°' },
  { key: 'beta', label: 'β', unit: '°' },
  { key: 'gamma', label: 'γ', unit: '°' },
]

function setCell(key: keyof CellParams, value: number) {
  store.current.cell[key] = value
}

async function parseCif(text: string, name: string) {
  loading.value = true
  try {
    const result = await buildStructureFromCif(text, { name })
    store.setStructure(result.structure, name, result.warnings)
    lastParse.value = {
      asymmetric: result.parsed.atoms.length,
      expanded: result.structure.atoms.length,
      ops: result.ops.length,
      source: name,
    }
    if (result.warnings.length) ElMessage.warning(`已导入，但有 ${result.warnings.length} 条提示`)
    else ElMessage.success(`已导入 ${name}`)
    pasteOpen.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    loading.value = false
  }
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const { text } = await readFileText(file)
  await parseCif(text, file.name.replace(/\.cif$/i, ''))
  input.value = ''
}

function importPaste() {
  if (!pasteText.value.trim()) return
  void parseCif(pasteText.value, '粘贴的 CIF')
}

function loadPreset(id: string) {
  store.loadPreset(id)
  lastParse.value = null
}
const atomText = computed(() => {
  const atoms = store.current.atoms
  const head = `${'元素'.padEnd(6)}${'标签'.padEnd(10)}${'x'.padStart(10)}${'y'.padStart(10)}${'z'.padStart(10)}${'occ'.padStart(7)}${'B'.padStart(9)}`
  const rows = atoms.map((atom) =>
    [
      (atom.element ?? '').padEnd(6),
      (atom.label ?? '—').padEnd(10),
      atom.x.toFixed(5).padStart(10),
      atom.y.toFixed(5).padStart(10),
      atom.z.toFixed(5).padStart(10),
      (atom.occupancy ?? 1).toFixed(3).padStart(7),
      (atom.biso ?? 0).toFixed(3).padStart(9),
    ].join(''),
  )
  return [head, ...rows].join('\n')
})

async function copyAtoms() {
  try {
    await navigator.clipboard.writeText(atomText.value)
    ElMessage.success('已复制原子位点')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}

const drawer = ref<DrawerState>('closed')
</script>

<template>
  <div class="tool-root">
    <ToolPage
    tool-id="structure"
    title="晶体结构"
    subtitle="从 CIF 读取晶胞、空间群与原子位点，按对称操作展开为完整晶胞，并检查密度、公式与低角反射。"
    doc="/docs/userguide/structure"
    v-model:result-state="drawer"
    result-title="结构摘要"
    :saved-at="lastSaved"
    :restored="wasRestored"
    :state-error="draft.error"
    @reset="resetAll"
    @clear="clearPage"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" @click="drawer = 'half'">查看原子位点</button>
      <el-button size="small" @click="pasteOpen = true"> <Pencil class="btn-icon" /> 粘贴 CIF </el-button>
      <el-button size="small" :loading="loading" @click="fileInput?.click()">
        <FileUp class="btn-icon" /> 导入 CIF
      </el-button>
      <el-button size="small" type="primary" @click="router.push('/crystal/saed')">
        <ScanLine class="btn-icon" /> 模拟 SAED
      </el-button>
    </template>

    <template #input>
      <PanelCard title="CIF 导入" :icon="FileUp">
        <div class="drop-mini" @click="fileInput?.click()">
          <FileUp />
          <span>点击选择 .cif</span>
          <small>支持晶胞参数、对称操作、_atom_site 坐标</small>
        </div>
        <input ref="fileInput" type="file" accept=".cif,.mcif,text/plain" hidden @change="onFile" />
        <div v-if="lastParse" class="parse-report mono">
          <div>非对称单元 {{ lastParse.asymmetric }} → 展开 {{ lastParse.expanded }} 原子</div>
          <div>对称操作 {{ lastParse.ops }} 条 · {{ lastParse.source }}</div>
        </div>
      </PanelCard>
    </template>

    <template #params>

      <PanelCard title="预设结构" :icon="FlaskConical">
        <div class="preset-list">
          <button
            v-for="preset in STRUCTURE_PRESETS"
            :key="preset.id"
            type="button"
            class="preset-row"
            :class="{ 'is-active': store.presetId === preset.id }"
            @click="loadPreset(preset.id)"
          >
            <span class="preset-row__name">{{ preset.name }}</span>
            <span class="preset-row__formula mono">{{ preset.formula }}</span>
            <span class="preset-row__sg mono">{{ preset.spaceGroupSymbol }}</span>
          </button>
        </div>
      </PanelCard>

    </template>

    <template #more>
      <PanelCard title="晶胞参数" :icon="Grid3x3">
        <div class="grid-2">
          <NumberField
            v-for="field in cellFields"
            :key="field.key"
            :model-value="store.current.cell[field.key]"
            :label="field.label"
            :unit="field.unit"
            :min="field.key === 'a' || field.key === 'b' || field.key === 'c' ? 1e-6 : 0.001"
            :max="field.key === 'a' || field.key === 'b' || field.key === 'c' ? undefined : 179.999"
            :precision="6"
            @update:model-value="setCell(field.key, $event)"
          />
        </div>
        <div class="cell-note tiny dim">修改参数会立即影响密度、d 值与 SAED/XRD 模拟（共享当前结构）。</div>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard title="结构摘要" :icon="Info">
        <div class="summary">
          <div class="summary__name">{{ store.label }}</div>
          <div class="summary__formula">{{ formula }}</div>
          <div class="kv-list mono">
            <div class="kv">
              <span>空间群</span><span>{{ store.current.spaceGroupSymbol ?? '—' }}</span>
            </div>
            <div class="kv">
              <span>原子数</span><span>{{ store.atomCount }}</span>
            </div>
            <div class="kv">
              <span>体积</span><span>{{ volume.toFixed(4) }} Å³</span>
            </div>
            <div class="kv">
              <span>密度</span><span>{{ Number.isFinite(density) ? density.toFixed(4) : '—' }} g/cm³</span>
            </div>
            <div class="kv">
              <span>晶胞质量</span><span>{{ cellMass.toFixed(3) }} u</span>
            </div>
          </div>
        </div>
      </PanelCard>

      <PanelCard v-if="store.warnings.length" title="解析提示" :icon="Info">
        <div v-for="warning in store.warnings" :key="warning" class="issue issue--warning">
          <span class="issue__icon" />
          <div>{{ warning }}</div>
        </div>
      </PanelCard>

      <PanelCard title="下一步" :icon="Sparkles">
        <div class="next-links">
          <button class="next-link" type="button" @click="router.push('/crystal/saed')">
            <ScanLine />
            <span><b>带轴电子衍射</b><small>用当前结构计算 ZOLZ 斑点</small></span>
          </button>
          <button class="next-link" type="button" @click="router.push('/crystal/xrd')">
            <Layers />
            <span><b>XRD 理论谱</b><small>检查峰位与相对强度</small></span>
          </button>
          <button class="next-link" type="button" @click="router.push('/crystal/reciprocal')">
            <Grid3x3 />
            <span><b>倒易空间</b><small>d 值、夹角、晶带轴</small></span>
          </button>
        </div>
      </PanelCard>
    </template>

    <div class="struct-stats">
      <div class="stat">
        <div class="stat__label">晶胞体积</div>
        <div class="stat__value">{{ volume.toFixed(3) }}<span class="stat__unit">Å³</span></div>
      </div>
      <div class="stat">
        <div class="stat__label">晶胞内原子</div>
        <div class="stat__value">{{ store.atomCount }}</div>
      </div>
      <div class="stat">
        <div class="stat__label">理论密度</div>
        <div class="stat__value">
          {{ Number.isFinite(density) ? density.toFixed(3) : '—' }}<span class="stat__unit">g/cm³</span>
        </div>
      </div>
      <div class="stat">
        <div class="stat__label">化学式</div>
        <div class="stat__value" style="font-size: 14px">{{ formula }}</div>
      </div>
    </div>

    <div class="two-col">
      <PanelCard title="晶胞与倒易参数" :icon="Grid3x3">
        <div v-if="lattice" class="kv-list mono">
          <div class="kv">
            <span>a, b, c</span
            ><span
              >{{ lattice.cell.a.toFixed(4) }}, {{ lattice.cell.b.toFixed(4) }}, {{ lattice.cell.c.toFixed(4) }} Å</span
            >
          </div>
          <div class="kv">
            <span>α, β, γ</span
            ><span
              >{{ lattice.cell.alpha.toFixed(3) }}°, {{ lattice.cell.beta.toFixed(3) }}°,
              {{ lattice.cell.gamma.toFixed(3) }}°</span
            >
          </div>
          <div class="kv">
            <span>a*, b*, c*</span
            ><span
              >{{ lattice.reciprocalParams.aStar.toFixed(5) }}, {{ lattice.reciprocalParams.bStar.toFixed(5) }},
              {{ lattice.reciprocalParams.cStar.toFixed(5) }} Å⁻¹</span
            >
          </div>
          <div class="kv">
            <span>α*, β*, γ*</span
            ><span
              >{{ lattice.reciprocalParams.alphaStar.toFixed(3) }}°,
              {{ lattice.reciprocalParams.betaStar.toFixed(3) }}°,
              {{ lattice.reciprocalParams.gammaStar.toFixed(3) }}°</span
            >
          </div>
        </div>
        <p class="tiny dim" style="margin-top: 8px">
          所有参数由六个晶格参数实时计算；倒易空间采用晶体学约定（不含 2π）。
        </p>
      </PanelCard>

      <PanelCard title="低角反射预览" :icon="Layers" hint="|h|,|k|,|l| ≤ 4">
        <div class="table-wrap refl-table">
          <table class="data">
            <thead>
              <tr>
                <th>(hkl)</th>
                <th class="num">d (Å)</th>
                <th class="num">|F|²</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in reflections" :key="r.hkl.join(',')">
                <td>{{ formatHkl(r.hkl, 'round') }}</td>
                <td class="num">{{ r.d.toFixed(5) }}</td>
                <td class="num">{{ r.f2.toExponential(3) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>

    <PanelCard title="原子位点" :icon="Atom" :hint="`${store.current.atoms.length} 个原子`">
      <div class="table-wrap atom-table">
        <table class="data">
          <thead>
            <tr>
              <th>元素</th>
              <th>标签</th>
              <th class="num">x</th>
              <th class="num">y</th>
              <th class="num">z</th>
              <th class="num">占有率</th>
              <th class="num">B (Å²)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(atom, index) in store.current.atoms" :key="`${atom.element}-${index}`">
              <td class="text">{{ atom.element }}</td>
              <td class="text">{{ atom.label ?? '—' }}</td>
              <td class="num">{{ atom.x.toFixed(5) }}</td>
              <td class="num">{{ atom.y.toFixed(5) }}</td>
              <td class="num">{{ atom.z.toFixed(5) }}</td>
              <td class="num">{{ (atom.occupancy ?? 1).toFixed(3) }}</td>
              <td class="num">{{ (atom.biso ?? 0).toFixed(3) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PanelCard>
    <template #text>
      <pre class="code-surface"><code>{{ atomText }}</code></pre>
    </template>

    <template #copy>
      <div class="row">
        <button type="button" class="btn" :disabled="!store.current.atoms.length" @click="copyAtoms">
          复制原子位点
        </button>
      </div>
      <pre class="code-surface"><code>{{ atomText }}</code></pre>
    </template>
  </ToolPage>

  <el-dialog v-model="pasteOpen" title="粘贴 CIF" width="680px">
    <p class="small muted" style="margin-bottom: 8px">粘贴完整的 CIF 文本。</p>
    <el-input v-model="pasteText" type="textarea" :rows="14" placeholder="data_..." />
    <template #footer>
      <el-button size="small" @click="pasteOpen = false">取消</el-button>
      <el-button size="small" type="primary" :loading="loading" @click="importPaste">解析</el-button>
    </template>
  </el-dialog>
  </div>
</template>

<style scoped>
.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 3px;
}

.drop-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 18px 12px;
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.drop-mini:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.drop-mini svg {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.drop-mini span {
  font-size: 11.5px;
  color: var(--text-2);
}

.drop-mini small {
  font-size: 9.5px;
  color: var(--text-3);
}

.parse-report {
  margin-top: 8px;
  padding: 7px 8px;
  border-radius: 5px;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  font-size: 9.5px;
  line-height: 1.6;
  color: var(--text-3);
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 260px;
  overflow-y: auto;
}

.preset-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  text-align: left;
}

.preset-row:hover {
  background: var(--surface-2);
}

.preset-row.is-active {
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.preset-row__name {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-row__formula {
  font-size: 9.5px;
  color: var(--text-3);
}

.preset-row__sg {
  margin-left: auto;
  font-size: 9px;
  color: var(--text-3);
}

.cell-note {
  margin-top: 8px;
  line-height: 1.5;
}

.struct-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
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
  gap: 12px;
  color: var(--text-2);
}

.kv span:first-child {
  color: var(--text-3);
}

.summary__name {
  font-size: 13px;
  font-weight: 650;
  color: var(--text);
}

.summary__formula {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
  margin: 3px 0 9px;
  letter-spacing: -0.01em;
}

.refl-table {
  max-height: 280px;
}

.atom-table {
  max-height: 480px;
}

.next-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.next-link {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-soft);
  background: transparent;
  color: var(--text-2);
  text-align: left;
  cursor: pointer;
  text-decoration: none;
}

.next-link:hover {
  background: var(--surface-2);
  border-color: var(--border-strong);
}

.next-link svg {
  width: 15px;
  height: 15px;
  color: var(--accent);
  flex: 0 0 auto;
}

.next-link span {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.next-link b {
  font-size: 11.5px;
  color: var(--text);
  font-weight: 600;
}

.next-link small {
  font-size: 10px;
  color: var(--text-3);
}

@media (max-width: 1100px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .struct-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
