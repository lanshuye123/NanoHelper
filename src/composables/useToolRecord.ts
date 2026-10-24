import { onBeforeUnmount, onMounted, reactive, watch, type WatchStopHandle } from 'vue'
import { idbDelete, idbGet, idbSet, isIndexedDbAvailable } from '@/utils/idb'
import type { StorageEnvelope } from '@/utils/persist'

export interface ToolRecordOptions<T> {
  /** Stable record key, e.g. "particles:page". */
  key: string
  version?: number
  /** Plain snapshot of the data to keep. */
  snapshot: () => T
  /** Apply a restored record; may rebuild an image or object URL. */
  restore: (data: T) => void | Promise<void>
  /** Reject malformed payloads before they reach restore(). */
  validate?: (raw: unknown) => T | null
  debounceMs?: number
}

export interface ToolRecordController {
  savedAt: number | null
  restored: boolean
  available: boolean
  loading: boolean
  error: string
  save: () => void
  clear: () => void
  flush: () => void
}

/**
 * Persist larger tool data (spectra, parsed DIF blocks, images, measurement
 * records) in IndexedDB. Restore is asynchronous; callers should start from a
 * safe empty state and let the restored values arrive.
 */
export function useToolRecord<T>(options: ToolRecordOptions<T>): ToolRecordController {
  const version = options.version ?? 1
  const debounceMs = options.debounceMs ?? 700

  const state = reactive<ToolRecordController>({
    savedAt: null,
    restored: false,
    available: isIndexedDbAvailable(),
    loading: false,
    error: '',
    save,
    clear,
    flush,
  })

  let stopWatch: WatchStopHandle | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let applying = false
  let mounted = false

  function writeNow() {
    if (!state.available) return
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const snapshotAt = Date.now()
    void idbSet<StorageEnvelope<T>>(options.key, {
      version,
      savedAt: snapshotAt,
      data: options.snapshot(),
    }).then((ok) => {
      if (ok) {
        state.savedAt = snapshotAt
        state.error = ''
      } else {
        state.error = '自动保存失败；请导出需要的数据，或清理旧记录后重试。'
      }
    })
  }

  function schedule() {
    if (!mounted || applying || !state.available) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(writeNow, debounceMs)
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

  function save() {
    writeNow()
  }

  async function load() {
    if (!state.available) return
    state.loading = true
    try {
      const record = await idbGet<StorageEnvelope<unknown>>(options.key)
      if (!record || record.version !== version || record.data === undefined || record.data === null) return
      const data = options.validate ? options.validate(record.data) : (record.data as T)
      if (data === null) {
        await idbDelete(options.key)
        return
      }
      applying = true
      try {
        await options.restore(data)
      } finally {
        applying = false
      }
      state.savedAt = record.savedAt
      state.restored = true
    } catch {
      state.error = '上次记录无法恢复；可以继续使用，或清空本页后重新开始。'
      await idbDelete(options.key)
    } finally {
      state.loading = false
    }
  }

  function clear() {
    stop()
    void idbDelete(options.key)
    state.savedAt = null
    state.restored = false
    state.error = ''
    startWatch()
  }

  function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
      writeNow()
    }
  }

  onMounted(() => {
    mounted = true
    void load().finally(() => {
      if (mounted) startWatch()
    })
  })

  onBeforeUnmount(() => {
    mounted = false
    flush()
    stop()
  })

  return state
}
