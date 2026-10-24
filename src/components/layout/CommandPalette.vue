<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, CornerDownLeft, Search } from 'lucide-vue-next'
import { searchEntries } from '@/config/navigation'
import { useQuickSearch } from '@/composables/useQuickSearch'
import { useCommands, type PaletteAction } from '@/composables/useCommands'
import { useRecentTools } from '@/composables/useRecentTools'
import { useSettingsStore } from '@/stores/settings'
import { tools } from '@/tools/registry'

interface Entry {
  id: string
  label: string
  description?: string
  kind: 'action' | 'tool' | 'doc' | 'page'
  disabled?: boolean
  run: () => void | Promise<void>
}

const router = useRouter()
const settings = useSettingsStore()
const { open, closeSearch } = useQuickSearch()
const { toolActions } = useCommands()
const { recentIds } = useRecentTools()

const query = ref('')
const active = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const KIND_LABEL: Record<Entry['kind'], string> = {
  action: '操作',
  tool: '工具',
  doc: '文档',
  page: '页面',
}

function toEntry(action: PaletteAction): Entry {
  return {
    id: action.id,
    label: action.label,
    description: action.hint,
    kind: 'action',
    disabled: action.disabled,
    run: action.run,
  }
}

const globalActions = computed<Entry[]>(() => [
  {
    id: 'action-home',
    label: '返回首页',
    description: '工具总览与最近使用',
    kind: 'action',
    run: () => {
      void router.push('/')
    },
  },
  {
    id: 'action-theme',
    label: settings.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题',
    kind: 'action',
    run: () => settings.toggleTheme(),
  },
  {
    id: 'action-docs',
    label: '打开文档中心',
    description: '用户指南、实战手册与参考',
    kind: 'action',
    run: () => {
      void router.push('/docs/userguide/getting-started')
    },
  },
])

const navEntries = computed<Entry[]>(() =>
  searchEntries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description,
    kind: entry.kind,
    run: () => {
      void router.push(entry.path)
    },
  })),
)

const recentEntries = computed<Entry[]>(() =>
  recentIds.value
    .map((id) => tools.find((tool) => tool.id === id))
    .filter((tool): tool is (typeof tools)[number] => Boolean(tool))
    .map((tool) => ({
      id: `recent-${tool.id}`,
      label: tool.title,
      description: '最近使用',
      kind: 'tool' as const,
      run: () => {
      void router.push(tool.path)
    },
    })),
)

const results = computed<Entry[]>(() => {
  const actions = [...toolActions.value.map(toEntry), ...globalActions.value]
  const q = query.value.trim().toLowerCase()

  if (!q) {
    const recent = recentEntries.value
    const recentlyUsed = new Set(recent.map((entry) => entry.label))
    const toolsList = navEntries.value.filter((entry) => entry.kind === 'tool')
    const fresh = toolsList.filter((entry) => !recentlyUsed.has(entry.label))
    return [...actions, ...recent, ...fresh].slice(0, 14)
  }

  const pool = [...actions, ...navEntries.value]
  return pool
    .filter((entry) => [entry.label, entry.description ?? '', KIND_LABEL[entry.kind]].join(' ').toLowerCase().includes(q))
    .slice(0, 18)
})

const selectable = computed(() => results.value.map((entry, index) => (entry.disabled ? -1 : index)).filter((i) => i >= 0))

watch(open, async (value) => {
  if (!value) return
  query.value = ''
  active.value = 0
  await nextTick()
  inputRef.value?.focus()
})

watch(query, () => {
  active.value = 0
})

watch(results, () => {
  if (!selectable.value.includes(active.value)) active.value = selectable.value[0] ?? 0
})

function move(delta: number) {
  const list = selectable.value
  if (!list.length) return
  const current = list.indexOf(active.value)
  const next = list[(current + delta + list.length) % list.length]
  active.value = next
  listRef.value?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
}

async function choose(index = active.value) {
  const entry = results.value[index]
  if (!entry || entry.disabled) return
  closeSearch()
  await entry.run()
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    void choose()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    closeSearch()
  }
}

function onWindowKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (open.value) closeSearch()
    else open.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onWindowKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="open" class="palette-backdrop" @mousedown.self="closeSearch">
        <section class="palette" role="dialog" aria-modal="true" aria-label="命令面板">
          <div class="palette__input">
            <Search />
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              placeholder="搜索工具、文档，或执行操作…"
              autocomplete="off"
              spellcheck="false"
              aria-label="搜索工具、文档或操作"
              aria-controls="palette-results"
              :aria-activedescendant="`palette-item-${active}`"
              @keydown="onInputKeydown"
            />
            <kbd class="kbd">ESC</kbd>
          </div>

          <div id="palette-results" ref="listRef" class="palette__list" role="listbox" aria-label="结果">
            <p v-if="!results.length" class="palette__empty">没有匹配项</p>
            <button
              v-for="(entry, index) in results"
              :id="`palette-item-${index}`"
              :key="entry.id"
              type="button"
              class="palette__item"
              :class="{ 'is-active': active === index }"
              :data-index="index"
              role="option"
              :aria-selected="active === index"
              :aria-disabled="entry.disabled || undefined"
              :disabled="entry.disabled"
              @mousemove="!entry.disabled && (active = index)"
              @click="choose(index)"
            >
              <span class="palette__kind">{{ KIND_LABEL[entry.kind] }}</span>
              <span class="palette__copy">
                <b>{{ entry.label }}</b>
                <small v-if="entry.description">{{ entry.description }}</small>
              </span>
              <ArrowRight v-if="entry.kind !== 'action'" class="palette__arrow" />
            </button>
          </div>

          <footer class="palette__foot">
            <span><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> 选择</span>
            <span><CornerDownLeft class="palette__enter" /> 执行</span>
            <span class="spacer" />
            <span>{{ results.length }} 项</span>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 12vh var(--space-2) var(--space-2);
  background: color-mix(in srgb, #0b1220 42%, transparent);
}

.palette {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: min(560px, 76vh);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 24px 60px rgba(21, 62, 99, 0.26);
}

.palette__input {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  height: 52px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--border);
}

.palette__input svg {
  width: 16px;
  height: 16px;
  color: var(--text-3);
  flex: 0 0 auto;
}

.palette__input input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  outline: none;
}

.palette__input input::placeholder {
  color: var(--text-3);
}

.palette__input input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.palette__list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}

.palette__empty {
  margin: 0;
  padding: var(--space-3) var(--space-2);
  text-align: center;
  font-size: 12.5px;
  color: var(--text-3);
}

.palette__item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.palette__item.is-active {
  background: var(--surface-2);
}

.palette__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.palette__kind {
  flex: 0 0 auto;
  width: 34px;
  font-size: 10.5px;
  color: var(--text-3);
}

.palette__copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.palette__copy b {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette__copy small {
  font-size: 11.5px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette__arrow {
  width: 13px;
  height: 13px;
  color: var(--text-3);
  opacity: 0;
}

.palette__item.is-active .palette__arrow {
  opacity: 1;
}

.palette__foot {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 0 0 auto;
  padding: 8px var(--space-2);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-3);
}

.palette__foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.palette__enter {
  width: 12px;
  height: 12px;
}

.palette-enter-active,
.palette-leave-active {
  transition: opacity var(--duration) var(--ease);
}

.palette-enter-active .palette,
.palette-leave-active .palette {
  transition:
    transform var(--duration) var(--ease),
    opacity var(--duration) var(--ease);
}

.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}

.palette-enter-from .palette,
.palette-leave-to .palette {
  transform: translateY(-6px) scale(0.99);
}
</style>
