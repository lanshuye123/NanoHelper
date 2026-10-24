import { onBeforeUnmount, onMounted, reactive, watch, type WatchStopHandle } from 'vue'
import {
  isStorageAvailable,
  mergeDefaults,
  readStored,
  removeStored,
  toolStorageKey,
  writeStored,
} from '@/utils/persist'

export interface ToolDraftOptions<T extends Record<string, unknown>> {
  /** Stable tool id used in the storage key. */
  toolId: string
  /** Bump when the saved shape changes; older drafts are ignored. */
  version?: number
  /** Fresh default values (must not share mutable arrays). */
  defaults: () => T
  /** Plain snapshot of the current UI state. */
  snapshot: () => T
  /** Apply a restored snapshot. May be called with merged defaults. */
  restore: (data: T) => void
  debounceMs?: number
}

export interface ToolDraftController {
  savedAt: number | null
  restored: boolean
  available: boolean
  error: string
  save: () => void
  reset: () => void
  clear: () => void
  flush: () => void
}

/**
 * Persist a tool page's form state to localStorage and restore it on mount.
 *
 * The watcher is intentionally attached only after restoration, so opening a
 * page never overwrites a saved draft with defaults. `reset()` restores
 * defaults and keeps saving; `clear()` removes the stored draft entirely.
 */
export function useToolDraft<T extends Record<string, unknown>>(
  options: ToolDraftOptions<T>,
): ToolDraftController {
  const version = options.version ?? 1
  const debounceMs = options.debounceMs ?? 400
  const key = toolStorageKey(options.toolId)

  const state = reactive<ToolDraftController>({
    savedAt: null,
    restored: false,
    available: isStorageAvailable(),
    error: '',
    save,
    reset,
    clear,
    flush,
  })

  let stopWatch: WatchStopHandle | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let applying = false
  let mounted = false

  function save() {
    if (!state.available) return
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const ok = writeStored(key, version, options.snapshot())
    if (ok) {
      state.savedAt = Date.now()
      state.error = ''
    } else {
      state.error = '自动保存失败；请导出需要的数据，或清理旧记录后重试。'
    }
  }

  function schedule() {
    if (!mounted || applying || !state.available) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, debounceMs)
  }

  function startWatch() {
    stopWatch?.()
    stopWatch = watch(options.snapshot, schedule, { deep: true })
  }

  function stop() {
    stopWatch?.()
    stopWatch = null
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function apply(data: T) {
    applying = true
    try {
      options.restore(data)
    } finally {
      applying = false
    }
  }

  function reset() {
    stop()
    apply(options.defaults())
    state.restored = false
    state.savedAt = null
    save()
    startWatch()
  }

  function clear() {
    stop()
    apply(options.defaults())
    removeStored(key)
    state.restored = false
    state.savedAt = null
    state.error = ''
    startWatch()
  }

  function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
      save()
    }
  }

  onMounted(() => {
    mounted = true
    const stored = readStored<T>(key, version)
    if (stored) {
      try {
        apply(mergeDefaults(options.defaults(), stored.data))
        state.restored = true
        state.savedAt = stored.savedAt
      } catch {
        removeStored(key)
        apply(options.defaults())
      }
    }
    startWatch()
  })

  onBeforeUnmount(() => {
    mounted = false
    flush()
    stop()
  })

  return state
}
