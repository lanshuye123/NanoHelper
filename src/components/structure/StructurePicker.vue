<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Atom, FileUp, Pencil } from 'lucide-vue-next'
import { STRUCTURE_PRESETS } from '@/data/presets'
import { useStructureStore } from '@/stores/structure'
import { buildStructureFromCif } from '@/core/crystallography/structureBuilder'
import { readFileText } from '@/utils/download'

const store = useStructureStore()
const fileInput = ref<HTMLInputElement | null>(null)
const pasteOpen = ref(false)
const pasteText = ref('')
const loading = ref(false)

function onPreset(id: string) {
  store.loadPreset(id)
}

async function parseCifText(text: string, name: string) {
  loading.value = true
  try {
    const result = await buildStructureFromCif(text, { name })
    store.setStructure(result.structure, name, result.warnings)
    if (result.warnings.length) {
      ElMessage.warning(`已导入，但有 ${result.warnings.length} 条提示`)
    } else {
      ElMessage.success(`已导入 CIF：${result.structure.atoms.length} 个原子`)
    }
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
  await parseCifText(text, file.name.replace(/\.cif$/i, ''))
  input.value = ''
}

function importPaste() {
  if (!pasteText.value.trim()) return
  void parseCifText(pasteText.value, '粘贴的 CIF')
}
</script>

<template>
  <div class="structure-picker">
    <label class="field">
      <span class="field__label">结构来源</span>
      <el-select :model-value="store.presetId ?? ''" size="small" filterable placeholder="选择预设" @update:model-value="onPreset">
        <el-option
          v-for="preset in STRUCTURE_PRESETS"
          :key="preset.id"
          :label="`${preset.name} (${preset.formula})`"
          :value="preset.id"
        />
        <el-option v-if="!store.presetId" :label="store.label" value="" disabled />
      </el-select>
    </label>

    <div class="structure-meta">
      <span class="chip chip--accent tiny"><Atom /> {{ store.atomCount }} atoms</span>
      <span class="chip chip--mono">{{ store.current.cell.a.toFixed(3) }}, {{ store.current.cell.b.toFixed(3) }}, {{ store.current.cell.c.toFixed(3) }} Å</span>
      <span v-if="store.current.spaceGroupSymbol" class="chip chip--mono">{{ store.current.spaceGroupSymbol }}</span>
    </div>

    <div class="structure-actions">
      <el-button size="small" :loading="loading" @click="fileInput?.click()">
        <FileUp class="btn-icon" /> CIF
      </el-button>
      <el-button size="small" @click="pasteOpen = true">
        <Pencil class="btn-icon" /> 粘贴
      </el-button>
      <RouterLink to="/crystal/structure" class="edit-link">查看/编辑</RouterLink>
    </div>

    <input ref="fileInput" type="file" accept=".cif,.mcif,text/plain" hidden @change="onFile" />

    <div v-if="store.warnings.length" class="picker-warn">
      {{ store.warnings[0] }}
      <span v-if="store.warnings.length > 1">（共 {{ store.warnings.length }} 条）</span>
    </div>
  </div>

  <el-dialog v-model="pasteOpen" title="粘贴 CIF" width="640px">
    <p class="small muted" style="margin-bottom: 8px">
      粘贴完整的 CIF 文本；支持晶胞参数、对称操作与 _atom_site 坐标表。
    </p>
    <el-input v-model="pasteText" type="textarea" :rows="12" placeholder="data_..." />
    <template #footer>
      <el-button size="small" @click="pasteOpen = false">取消</el-button>
      <el-button size="small" type="primary" :loading="loading" @click="importPaste">解析并应用</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.structure-picker {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.structure-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.structure-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 3px;
}

.edit-link {
  font-size: 10.5px;
  margin-left: auto;
}

.picker-warn {
  padding: 6px 8px;
  border-radius: 5px;
  background: var(--warn-soft);
  border: 1px solid color-mix(in srgb, var(--warn) 25%, transparent);
  color: var(--warn);
  font-size: 10px;
  line-height: 1.5;
}
</style>
