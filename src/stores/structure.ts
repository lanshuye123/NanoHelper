import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { presetToStructure } from '@/data/presets'
import { STRUCTURE_PRESETS } from '@/data/presets'
import type { Structure } from '@/core/crystallography/structure'

export const useStructureStore = defineStore('structure', () => {
  const current = ref<Structure>(presetToStructure(STRUCTURE_PRESETS[0]))
  const label = ref(`${STRUCTURE_PRESETS[0].name} (${STRUCTURE_PRESETS[0].formula})`)
  const presetId = ref<string | null>(STRUCTURE_PRESETS[0].id)
  const warnings = ref<string[]>([])

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

  return { current, label, presetId, warnings, atomCount, elements, setStructure, loadPreset }
})
