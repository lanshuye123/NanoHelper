<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import ResultDrawer from '@/components/tool/ResultDrawer.vue'
import ToolStateActions from '@/components/layout/ToolStateActions.vue'
import { TOOL_GROUPS, tools } from '@/tools/registry'
import type { DrawerState, ResultTab } from '@/components/tool/types'

const props = withDefaults(
  defineProps<{
    toolId: string
    title: string
    subtitle?: string
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

const hasOps = computed(() => Boolean(slots.steps || slots.source || slots.config || slots.params || slots.more))
const hasPanel = computed(() => Boolean(slots.dashboard || slots.aside))

const eyebrowText = computed(() => {
  if (props.eyebrow) return props.eyebrow
  const meta = tools.find((tool) => tool.id === props.toolId)
  if (!meta) return ''
  const group = TOOL_GROUPS.find((item) => item.key === meta.group)
  const index = tools.filter((tool) => tool.group === meta.group).findIndex((tool) => tool.id === meta.id)
  return `${group?.label ?? ''} · ${String(index + 1).padStart(2, '0')}`
})
</script>

<template>
  <div class="tool-page">
    <header class="tool-head">
      <div class="tool-head__left">
        <span class="tool-head__eyebrow">
          <span class="tool-head__bar" />
          {{ eyebrowText }}
        </span>
        <h1 class="tool-head__title">{{ title }}</h1>
        <p v-if="subtitle" class="tool-head__subtitle">{{ subtitle }}</p>
      </div>

      <div class="tool-head__actions">
        <slot name="actions" />
        <ToolStateActions
          v-if="showStateActions"
          :saved-at="savedAt"
          :restored="restored"
          :error="stateError"
          :can-clear="canClear"
          @reset="emit('reset')"
          @clear="emit('clear')"
        />
        <RouterLink v-if="doc" :to="doc" class="doc-link">
          <BookOpen />
          <span>文档</span>
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
          <slot name="chart" />
        </section>

        <slot />

        <section v-if="slots.table" class="view-block">
          <slot name="table" />
        </section>

        <div v-if="slots.run" class="run-bar">
          <slot name="run" />
        </div>

        <p v-if="slots.tips" class="tips-bar">
          <slot name="tips" />
        </p>
      </div>

      <!-- 右：结果仪表盘 -->
      <aside v-if="hasPanel" class="workspace__panel">
        <slot name="dashboard" />
        <slot name="aside" />
      </aside>
    </div>

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
  max-width: 1640px;
  margin: 0 auto;
  padding: 18px 20px 32px;
}

/* ---------------------------------------------------------------- head */

.tool-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.tool-head__left {
  min-width: 0;
}

.tool-head__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-3);
}

.tool-head__bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--accent);
}

.tool-head__title {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 720;
  letter-spacing: -0.025em;
  color: var(--text);
}

.tool-head__subtitle {
  margin-top: 4px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-2);
  max-width: 760px;
}

.tool-head__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.doc-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12px;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.doc-link:hover {
  background: var(--surface-2);
  color: var(--accent);
  text-decoration: none;
}

.doc-link svg {
  width: 14px;
  height: 14px;
  color: var(--accent);
}

/* ---------------------------------------------------------------- workspace */

.workspace {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}

.workspace.no-ops {
  grid-template-columns: minmax(0, 1fr) 300px;
}

.workspace.no-panel {
  grid-template-columns: 330px minmax(0, 1fr);
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
  top: 10px;
  max-height: calc(100vh - 150px);
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.view-block {
  display: flex;
  flex-direction: column;
}

.run-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Contextual hint spanning the main workspace. */
.tips-bar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--warn) 32%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--warn) 10%, var(--surface));
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.6;
}

/* ---------------------------------------------------------------- more */

.more {
  border-top: 1px dashed var(--border);
}

.more__summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 0 2px;
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
  gap: 12px;
  padding-top: 10px;
}

/* ---------------------------------------------------------------- responsive */

@media (max-width: 1500px) {
  .workspace,
  .workspace.no-ops {
    grid-template-columns: 330px minmax(0, 1fr);
  }

  .workspace__panel {
    grid-column: 1 / -1;
    position: static;
    max-height: none;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 14px;
  }
}

@media (max-width: 1100px) {
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

@media (max-width: 768px) {
  .tool-page {
    padding: 16px 14px 96px;
  }

  .tool-head__title {
    font-size: 20px;
  }

  .run-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 45;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .run-bar :deep(.btn),
  .run-bar :deep(.el-button) {
    flex: 1 1 auto;
    min-height: 44px;
  }
}
</style>
