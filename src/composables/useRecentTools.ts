import { ref } from 'vue'

const STORAGE_KEY = 'ctb.recent.v1'
const MAX_RECENT = 6

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const recentIds = ref<string[]>(read())

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentIds.value))
  } catch {
    /* storage unavailable — recent list stays in memory */
  }
}

export function useRecentTools() {
  const ids = recentIds

  function touch(id: string) {
    if (!id) return
    recentIds.value = [id, ...recentIds.value.filter((item) => item !== id)].slice(0, MAX_RECENT)
    persist()
  }

  function remove(id: string) {
    recentIds.value = recentIds.value.filter((item) => item !== id)
    persist()
  }

  function clear() {
    recentIds.value = []
    persist()
  }

  return { ids, recentIds: ids, touch, remove, clear }
}
