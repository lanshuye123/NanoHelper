<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CornerDownLeft, Search } from 'lucide-vue-next'
import { searchEntries } from '@/config/navigation'
import { useQuickSearch } from '@/composables/useQuickSearch'

const router = useRouter()
const { open, closeSearch } = useQuickSearch()
const query = ref('')
const active = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const KIND_LABEL: Record<string, string> = {
  tool: '工具',
  doc: '文档',
  page: '页面',
}

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    return searchEntries.filter((entry) => entry.kind === 'tool' || entry.kind === 'page').slice(0, 9)
  }
  return searchEntries
    .filter((entry) => [entry.label, entry.description, entry.module].join(' ').toLowerCase().includes(q))
    .slice(0, 18)
})

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
  if (active.value > results.value.length - 1) active.value = 0
})

function move(delta: number) {
  const length = results.value.length
  if (!length) return
  active.value = (active.value + delta + length) % length
  const item = listRef.value?.querySelector<HTMLElement>(`[data-index="${active.value}"]`)
  item?.scrollIntoView({ block: 'nearest' })
}

function choose(index = active.value) {
  const entry = results.value[index]
  if (!entry) return
  void router.push(entry.path)
  closeSearch()
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
    choose()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    closeSearch()
  }
}

function onWindowKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (open.value) closeSearch()
    else {
      query.value = ''
      open.value = true
    }
  } else if (event.key === 'Escape' && open.value) {
    closeSearch()
  }
}

onMounted(() => window.addEventListener('keydown', onWindowKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="qs">
      <div v-if="open" class="qs-backdrop" @mousedown.self="closeSearch">
        <section class="qs-dialog" role="dialog" aria-modal="true" aria-label="搜索工具与文档">
          <div class="qs-input-row">
            <Search class="qs-input-row__icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              placeholder="搜索工具、文档、页面…"
              autocomplete="off"
              spellcheck="false"
              aria-label="搜索工具、文档、页面"
              @keydown="onInputKeydown"
            />
            <kbd class="qs-esc">ESC</kbd>
          </div>

          <div ref="listRef" class="qs-list">
            <div class="qs-caption">
              <span>{{ query ? '搜索结果' : '快速跳转' }}</span>
              <span>{{ results.length }} 项</span>
            </div>
            <button
              v-for="(entry, index) in results"
              :key="entry.id"
              class="qs-item"
              :class="{ 'is-active': index === active }"
              type="button"
              :data-index="index"
              @mouseenter="active = index"
              @click="choose(index)"
            >
              <span class="qs-item__icon"><component :is="entry.icon" /></span>
              <span class="qs-item__copy">
                <strong>{{ entry.label }}</strong>
                <small>{{ entry.description }}</small>
              </span>
              <span class="qs-item__kind">{{ KIND_LABEL[entry.kind] ?? entry.kind }}</span>
              <span class="qs-item__module">{{ entry.module }}</span>
            </button>
            <p v-if="!results.length" class="qs-empty">没有匹配的工具或文档，换个关键词试试。</p>
          </div>

          <footer class="qs-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span
              ><kbd><CornerDownLeft /></kbd> 打开</span
            >
            <span><kbd>Ctrl</kbd><kbd>K</kbd> 随时唤起</span>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.qs-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  align-items: start;
  justify-items: center;
  padding: min(12vh, 110px) 16px 16px;
  background: var(--overlay);
  backdrop-filter: blur(3px);
}

.qs-dialog {
  width: min(680px, calc(100vw - 24px));
  max-height: min(72vh, 640px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.qs-input-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  padding: 0 14px;
  height: 52px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.qs-input-row__icon {
  width: 16px;
  height: 16px;
  color: var(--accent);
  flex: 0 0 auto;
}

.qs-input-row input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  outline: none;
}

.qs-input-row input::placeholder {
  color: var(--text-3);
}

.qs-input-row input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.qs-esc {
  flex: 0 0 auto;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  background: var(--surface);
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 9px;
}

.qs-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}

.qs-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 7px;
  color: var(--text-3);
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.qs-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.qs-item.is-active {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--text);
}

.qs-item__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--accent);
}

.qs-item.is-active .qs-item__icon {
  background: var(--surface);
}

.qs-item__icon svg {
  width: 15px;
  height: 15px;
}

.qs-item__copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.qs-item__copy strong {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qs-item__copy small {
  font-size: 10.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qs-item__kind {
  flex: 0 0 auto;
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--text-3);
  font-size: 9px;
}

.qs-item__module {
  flex: 0 0 64px;
  text-align: right;
  color: var(--text-3);
  font-size: 9.5px;
  white-space: nowrap;
}

.qs-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
}

.qs-foot {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 0 0 auto;
  padding: 8px 14px;
  border-top: 1px solid var(--border-soft);
  background: var(--surface-2);
  color: var(--text-3);
  font-size: 9.5px;
}

.qs-foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.qs-foot kbd {
  display: inline-grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 3px;
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 8.5px;
  color: var(--text-2);
}

.qs-foot kbd svg {
  width: 10px;
  height: 10px;
}

.qs-enter-active,
.qs-leave-active {
  transition: opacity 0.15s var(--ease);
}

.qs-enter-active .qs-dialog,
.qs-leave-active .qs-dialog {
  transition: transform 0.15s var(--ease);
}

.qs-enter-from,
.qs-leave-to {
  opacity: 0;
}

.qs-enter-from .qs-dialog,
.qs-leave-to .qs-dialog {
  transform: translateY(-8px) scale(0.99);
}

@media (max-width: 560px) {
  .qs-backdrop {
    padding: 8px;
    align-items: start;
  }

  .qs-dialog {
    width: 100%;
    max-height: calc(100vh - 16px);
  }

  .qs-item__module {
    display: none;
  }

  .qs-item__kind {
    display: none;
  }
}
</style>
