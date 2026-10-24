import { ref } from 'vue'
import type { Component } from 'vue'

export interface PaletteAction {
  id: string
  label: string
  hint?: string
  icon?: Component
  /** Disabled actions stay visible but cannot run (e.g. no data yet). */
  disabled?: boolean
  run: () => void | Promise<void>
}

/**
 * Tool pages register their context actions here (clear, copy, export…).
 * The command palette merges them with the global navigation entries.
 */
const toolActions = ref<PaletteAction[]>([])
const activeToolId = ref<string | null>(null)

export function useCommands() {
  function register(toolId: string, list: PaletteAction[]) {
    activeToolId.value = toolId
    toolActions.value = list
  }

  function patchDisabled(predicate: (action: PaletteAction) => boolean, disabled: boolean) {
    toolActions.value = toolActions.value.map((action) =>
      predicate(action) ? { ...action, disabled } : action,
    )
  }

  function unregister(toolId?: string) {
    if (toolId && activeToolId.value !== toolId) return
    activeToolId.value = null
    toolActions.value = []
  }

  return { toolActions, activeToolId, register, patchDisabled, unregister }
}
