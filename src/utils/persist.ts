/**
 * Small, defensive wrapper around browser storage.
 *
 * Only the UI layer uses this module. A tool's real work still lives in
 * `src/core/`; restoring a draft never blocks rendering and never throws.
 */

export interface StorageEnvelope<T> {
  version: number
  savedAt: number
  data: T
}

const TOOL_PREFIX = 'ctb.tool.'

export function toolStorageKey(toolId: string): string {
  return `${TOOL_PREFIX}${toolId}`
}

export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const probe = '__ctb_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

/**
 * Merge persisted data over fresh defaults.
 *
 * This is deliberately conservative: a missing or mistyped field falls back
 * to the default, so an old/corrupted draft cannot break a tool page. Arrays
 * are accepted as a whole (they are validated by the tool's own restore()).
 */
export function mergeDefaults<T>(defaults: T, raw: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(raw) ? raw : defaults) as T
  }
  if (isPlainObject(defaults)) {
    if (!isPlainObject(raw)) return defaults
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(defaults)) {
      out[key] = mergeDefaults((defaults as Record<string, unknown>)[key], raw[key])
    }
    return out as T
  }
  if (typeof defaults === 'number') {
    return (typeof raw === 'number' && Number.isFinite(raw) ? raw : defaults) as T
  }
  if (typeof defaults === 'string') {
    return (typeof raw === 'string' ? raw : defaults) as T
  }
  if (typeof defaults === 'boolean') {
    return (typeof raw === 'boolean' ? raw : defaults) as T
  }
  return defaults
}

export function readStored<T>(
  key: string,
  version: number,
): { data: T; savedAt: number } | null {
  if (!isStorageAvailable()) return null
  try {
    const text = window.localStorage.getItem(key)
    if (!text) return null
    const parsed = JSON.parse(text) as Partial<StorageEnvelope<T>>
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== version) return null
    if (typeof parsed.savedAt !== 'number' || !Number.isFinite(parsed.savedAt)) return null
    if (parsed.data === undefined || parsed.data === null) return null
    return { data: parsed.data as T, savedAt: parsed.savedAt }
  } catch {
    return null
  }
}

export function writeStored<T>(key: string, version: number, data: T): boolean {
  if (!isStorageAvailable()) return false
  const envelope: StorageEnvelope<T> = { version, savedAt: Date.now(), data }
  try {
    window.localStorage.setItem(key, JSON.stringify(envelope))
    return true
  } catch {
    return false
  }
}

export function removeStored(key: string): void {
  if (!isStorageAvailable()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore: a blocked store is treated like a missing draft
  }
}

/** Human-friendly save time for the tool header. */
export function formatSavedAt(timestamp: number | null): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
