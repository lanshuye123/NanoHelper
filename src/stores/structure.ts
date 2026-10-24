import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { presetToStructure } from '@/data/presets'
import { STRUCTURE_PRESETS } from '@/data/presets'
import type { Structure } from '@/core/crystallography/structure'
import { readStored, writeStored } from '@/utils/persist'

const STRUCTURE_KEY = 'ctb.structure.current'
const STRUCTURE_VERSION = 1

interface StructureSnapshot {
  current: Structure
  label: string
  presetId: string | null
  warnings: string[]
}

function isValidSnapshot(value: unknown): value is StructureSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<StructureSnapshot>
  if (!snapshot.current || typeof snapshot.current !== 'object') return false
  if (!snapshot.current.cell || !Array.isArray(snapshot.current.atoms)) return false
  if (typeof snapshot.label !== 'string') return false
  return true
}

export const useStructureStore = defineStore('structure', () => {
  const stored = readStored<unknown>(STRUCTURE_KEY, STRUCTURE_VERSION)
  const initial = stored && isValidSnapshot(stored.data) ? stored.data : null

  const current = ref<Structure>(initial?.current ?? presetToStructure(STRUCTURE_PRESETS[0]))
  const label = ref(initial?.label ?? `${STRUCTURE_PRESETS[0].name} (${STRUCTURE_PRESETS[0].formula})`)
  const presetId = ref<string | null>(initial ? initial.presetId : STRUCTURE_PRESETS[0].id)
  const warnings = ref<string[]>(initial?.warnings ?? [])
  const savedAt = ref<number | null>(stored?.savedAt ?? null)
  const restored = ref(Boolean(initial))

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function saveNow() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const ok = writeStored<StructureSnapshot>(STRUCTURE_KEY, STRUCTURE_VERSION, {
      current: current.value,
      label: label.value,
      presetId: presetId.value,
      warnings: warnings.value,
    })
    if (ok) savedAt.value = Date.now()
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 450)
  }

  const atomCount = computed(() => current.value.atoms.length)
  const elements = computed(() => {
    const counts = new Map<string, number>()
    for (const atom of current.value.atoms) {
      counts.set(atom.element, (counts.get(atom.element) ?? 0) + (atom.occupancy ?? 1))
    }
    return [...counts.entries()]
      .map(([element, count]) => ({ element, count }))
      .sort((a, b) => a.element.localeCompare(b.element))
  })

  function setStructure(structure: Structure, sourceLabel?: string, warningList: string[] = []) {
    current.value = structure
    label.value = sourceLabel ?? structure.name ?? '自定义结构'
    presetId.value = null
    warnings.value = warningList
  }

  function loadPreset(id: string) {
    const preset = STRUCTURE_PRESETS.find((p) => p.id === id)
    if (!preset) return
    current.value = presetToStructure(preset)
    label.value = `${preset.name} (${preset.formula})`
    presetId.value = preset.id
    warnings.value = []
  }

  function resetToDefault() {
    loadPreset(STRUCTURE_PRESETS[0].id)
    restored.value = false
  }

  watch(
    () => current.value.cell,
    () => {
      if (!presetId.value) return
      const preset = STRUCTURE_PRESETS.find((p) => p.id === presetId.value)
      if (!preset) return
      const same = (['a', 'b', 'c', 'alpha', 'beta', 'gamma'] as const).every(
        (key) => Math.abs(current.value.cell[key] - preset.cell[key]) < 1e-9,
      )
      if (!same) presetId.value = null
    },
    { deep: true },
  )

  watch([current, label, presetId, warnings], scheduleSave, { deep: true })

  return {
    current,
    label,
    presetId,
    warnings,
    savedAt,
    restored,
    atomCount,
    elements,
    setStructure,
    loadPreset,
    resetToDefault,
  }
})
