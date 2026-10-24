import { describe, expect, it, beforeEach } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { useToolDraft } from '@/composables/useToolDraft'
import { readStored, toolStorageKey } from '@/utils/persist'

const KEY = toolStorageKey('test-draft')

describe('useToolDraft', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('restores a saved value on mount and saves on unmount', async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, savedAt: Date.now(), data: { value: 7 } }),
    )
    let controller: ReturnType<typeof useToolDraft> | null = null
    const value = ref(0)
    const App = defineComponent({
      setup() {
        controller = useToolDraft({
          toolId: 'test-draft',
          defaults: () => ({ value: 0 }),
          snapshot: () => ({ value: value.value }),
          restore: (data) => {
            value.value = data.value
          },
          debounceMs: 5,
        })
        return () => h('div', String(value.value))
      },
    })
    const host = document.createElement('div')
    const app = createApp(App)
    app.mount(host)
    await nextTick()
    expect(value.value).toBe(7)
    expect(controller!.restored).toBe(true)

    value.value = 11
    await new Promise((resolve) => setTimeout(resolve, 20))
    app.unmount()
    const stored = readStored<{ value: number }>(KEY, 1)
    expect(stored?.data.value).toBe(11)
  })

  it('reset restores defaults and clear removes the record', async () => {
    let controller: ReturnType<typeof useToolDraft> | null = null
    const value = ref(5)
    const App = defineComponent({
      setup() {
        controller = useToolDraft({
          toolId: 'test-draft',
          defaults: () => ({ value: 1 }),
          snapshot: () => ({ value: value.value }),
          restore: (data) => {
            value.value = data.value
          },
          debounceMs: 5,
        })
        return () => h('div')
      },
    })
    const app = createApp(App)
    app.mount(document.createElement('div'))
    await nextTick()

    controller!.clear()
    expect(value.value).toBe(1)
    expect(readStored(KEY, 1)).toBeNull()

    value.value = 3
    controller!.reset()
    expect(value.value).toBe(1)
    expect(readStored<{ value: number }>(KEY, 1)?.data.value).toBe(1)
    app.unmount()
  })

  it('ignores a corrupted draft', async () => {
    window.localStorage.setItem(KEY, '{bad json')
    const value = ref(0)
    const App = defineComponent({
      setup() {
        useToolDraft({
          toolId: 'test-draft',
          defaults: () => ({ value: 2 }),
          snapshot: () => ({ value: value.value }),
          restore: (data) => {
            value.value = data.value
          },
        })
        return () => h('div')
      },
    })
    const app = createApp(App)
    app.mount(document.createElement('div'))
    await nextTick()
    expect(value.value).toBe(0)
    app.unmount()
  })
})
