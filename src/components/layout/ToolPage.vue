<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { BookOpen, ChevronRight, LineChart } from 'lucide-vue-next'
import ResultDrawer from '@/components/tool/ResultDrawer.vue'
import ToolStateActions from '@/components/layout/ToolStateActions.vue'
import { TOOL_GROUPS, tools } from '@/tools/registry'
import type { DrawerState, ResultTab } from '@/components/tool/types'

const props = withDefaults(
  defineProps<{
    toolId: string
    title: string
    subtitle?: string
    /** Optional short status shown next to the page title. */
    badge?: string
    /** Wrap the chart slot in a titled panel. Disable when the page supplies its own. */
    chartFrame?: boolean
    /** Optional override; otherwise derived from the tool registry. */
    eyebrow?: string
    doc?: string
    resultTitle?: string
    resultTabs?: ResultTab[]
    busy?: boolean
    savedAt?: number | null
    restored?: boolean
    stateError?: string
    showStateActions?: boolean
    canClear?: boolean
  }>(),
  {
    subtitle: '',
    badge: '',
    chartFrame: true,
    eyebrow: '',
    doc: '',
    resultTitle: '结果',
    resultTabs: () => ['chart', 'text', 'download', 'copy'] as ResultTab[],
    busy: false,
    savedAt: null,
    restored: false,
    stateError: '',
    showStateActions: true,
    canClear: true,
  },
)

const emit = defineEmits<{ reset: []; clear: [] }>()

const drawerState = defineModel<DrawerState>('resultState', { default: 'closed' })

const slots = useSlots()

const meta = computed(() => tools.find((tool) => tool.id === props.toolId))
const hasOps = computed(() => Boolean(slots.steps || slots.source || slots.config || slots.params || slots.more))
const hasPanel = computed(() => Boolean(slots.dashboard || slots.aside))
const groupLabel = computed(() => {
  if (!meta.value) return ''
  return TOOL_GROUPS.find((group) => group.key === meta.value?.group)?.label ?? ''
})

const eyebrowText = computed(() => props.eyebrow || groupLabel.value)
</script>

<template>
  <div class="tool-page">
    <header class="tool-head">
      <div class="tool-head__left">
        <nav class="tool-crumb" aria-label="面包屑">
          <RouterLink to="/">工作台</RouterLink>
          <ChevronRight aria-hidden="true" />
          <span>{{ eyebrowText }}</span>
          <ChevronRight aria-hidden="true" />
          <span class="tool-crumb__current">{{ title }}</span>
        </nav>

        <div class="tool-head__title-row">
          <h1 class="tool-head__title">{{ title }}</h1>
          <span v-if="badge" class="tool-head__badge">{{ badge }}</span>
        </div>
        <p v-if="subtitle" class="tool-head__subtitle">{{ subtitle }}</p>
      </div>

      <div class="tool-head__actions">
        <ToolStateActions
          v-if="showStateActions"
          :saved-at="savedAt"
          :restored="restored"
          :error="stateError"
          :can-clear="canClear"
          @reset="emit('reset')"
          @clear="emit('clear')"
        />
        <slot name="actions" />
        <slot v-if="slots.run" name="run" />
        <RouterLink
          v-if="doc"
          :to="doc"
          class="doc-link"
          :title="`查看 ${title} 的使用文档`"
          :aria-label="`查看 ${title} 的使用文档`"
        >
          <BookOpen />
          <span class="doc-link__text">使用文档</span>
        </RouterLink>
      </div>
    </header>

    <div class="workspace" :class="{ 'no-ops': !hasOps, 'no-panel': !hasPanel }">
      <!-- 左：操作与配置 -->
      <div v-if="hasOps" class="workspace__ops">
        <slot name="steps" />
        <slot name="source" />
        <slot name="config" />
        <slot name="params" />

        <details v-if="slots.more" class="more">
          <summary class="more__summary">更多设置</summary>
          <div class="more__body">
            <slot name="more" />
          </div>
        </details>
      </div>

      <!-- 中：可视化与数据 -->
      <div class="workspace__view">
        <slot name="input" />

        <section v-if="slots.chart && drawerState === 'closed'" class="view-block">
          <div v-if="chartFrame" class="panel chart-shell">
            <div class="panel__head">
              <h2 class="panel__title"><LineChart /> 分析图谱</h2>
            </div>
            <div class="panel__body chart-shell__body">
              <slot name="chart" />
            </div>
          </div>
          <slot v-else name="chart" />
        </section>

        <slot />

        <section v-if="slots.table" class="view-block">
          <slot name="table" />
        </section>
      </div>

      <!-- 右：结果仪表盘 -->
      <aside v-if="hasPanel" class="workspace__panel">
        <slot name="dashboard" />
        <slot name="aside" />
      </aside>
    </div>

    <p v-if="slots.tips" class="tips-bar">
      <slot name="tips" />
    </p>

    <ResultDrawer v-model:state="drawerState" :title="resultTitle" :tabs="resultTabs">
      <template #chart><slot name="chart" /></template>
      <template #text><slot name="text" /></template>
      <template #download><slot name="download" /></template>
      <template #copy><slot name="copy" /></template>
    </ResultDrawer>
  </div>
</template>

<style scoped>
.tool-page {
  width: 100%;
  max-width: 1720px;
  margin: 0 auto;
  padding: 14px 24px 26px;
}

/* ---------------------------------------------------------------- head */

.tool-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: nowrap;
  margin-bottom: 16px;
}

.tool-head__left {
  flex: 1 1 460px;
  min-width: 0;
}

.tool-crumb {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--text-3);
}

.tool-crumb a {
  color: var(--text-3);
  text-decoration: none;
}

.tool-crumb a:hover {
  color: var(--accent);
}

.tool-crumb svg {
  width: 12px;
  height: 12px;
  color: #a9b6c7;
}

.tool-crumb__current {
  color: var(--text-2);
}

.tool-head__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.tool-head__title {
  font-size: 27px;
  font-weight: 720;
  line-height: 1.22;
  letter-spacing: -0.03em;
  color: var(--text);
}

.tool-head__badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 7px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.tool-head__subtitle {
  margin-top: 4px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-2);
  max-width: 680px;
}

.tool-head__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  flex: 0 1 640px;
  min-width: 0;
  max-width: 640px;
  margin-left: auto;
  padding-top: 20px;
}

.tool-head__actions :deep(.btn--lg) {
  height: 36px;
  padding: 0 14px;
  font-size: 12px;
}

.tool-head__actions :deep(.el-button) {
  height: 36px;
  font-size: 12px;
}

.tool-head__actions :deep(.el-button--small) {
  height: 36px;
}

.doc-link {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12px;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    border-color var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.doc-link:hover {
  background: var(--surface-2);
  border-color: var(--accent-line);
  color: var(--accent);
  text-decoration: none;
}

.doc-link svg {
  width: 15px;
  height: 15px;
  color: var(--accent);
}

.doc-link__text {
  display: none;
}

/* ---------------------------------------------------------------- workspace */

.workspace {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 372px;
  gap: 16px;
  align-items: start;
}

.workspace.no-ops {
  grid-template-columns: minmax(0, 1fr) 372px;
}

.workspace.no-panel {
  grid-template-columns: 300px minmax(0, 1fr);
}

.workspace.no-ops.no-panel {
  grid-template-columns: minmax(0, 1fr);
}

.workspace__ops,
.workspace__view,
.workspace__panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.workspace__ops,
.workspace__panel {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - var(--topbar-h) - 40px);
  overflow-y: auto;
  padding-right: 1px;
  scrollbar-width: thin;
}

.view-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chart-shell {
  overflow: hidden;
}

.chart-shell__body {
  padding: 12px 14px 12px;
}

/* Contextual hint spanning the whole workspace. */
.tips-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 0;
  padding: 2px 2px 0;
  color: var(--text-3);
  font-size: 11.5px;
  line-height: 1.6;
}

/* ---------------------------------------------------------------- more */

.more {
  padding: 0 2px;
}

.more__summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0 2px;
  color: var(--text-3);
  font-size: 12px;
  cursor: pointer;
  list-style: none;
}

.more__summary::-webkit-details-marker {
  display: none;
}

.more__summary::before {
  content: '›';
  display: inline-block;
  font-size: 14px;
  line-height: 1;
  transition: transform var(--duration) var(--ease);
}

.more[open] .more__summary::before {
  transform: rotate(90deg);
}

.more__summary:hover {
  color: var(--text);
}

.more__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 10px;
}

/* ---------------------------------------------------------------- responsive */

@media (max-width: 1340px) {
  .workspace,
  .workspace.no-ops {
    grid-template-columns: 290px minmax(0, 1fr);
  }

  .workspace__panel {
    grid-column: 1 / -1;
    position: static;
    max-height: none;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
  }
}

@media (max-width: 1100px) {
  .tool-head {
    flex-wrap: wrap;
  }

  .tool-head__actions {
    max-width: none;
    padding-top: 0;
  }

  .workspace,
  .workspace.no-ops,
  .workspace.no-panel {
    grid-template-columns: minmax(0, 1fr);
  }

  .workspace__ops {
    position: static;
    max-height: none;
  }
}

@media (max-width: 900px) {
  .tool-page {
    padding: 14px 14px 28px;
  }

  .tool-head {
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .tool-head__title {
    font-size: 22px;
  }

  .tool-head__actions {
    padding-top: 0;
    justify-content: flex-start;
    width: 100%;
  }

  .tool-head__actions {
    max-width: none;
  }

  .doc-link__text {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-crumb a,
  .more__summary::before {
    transition: none;
  }
}
</style>
