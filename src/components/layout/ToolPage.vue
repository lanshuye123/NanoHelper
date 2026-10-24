<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import ResultDrawer from '@/components/tool/ResultDrawer.vue'
import type { DrawerState, ResultTab } from '@/components/tool/types'

const props = withDefaults(
  defineProps<{
    toolId: string
    title: string
    subtitle?: string
    eyebrow?: string
    doc?: string
    resultTitle?: string
    resultTabs?: ResultTab[]
    busy?: boolean
  }>(),
  {
    subtitle: '',
    eyebrow: '',
    doc: '',
    resultTitle: '结果',
    resultTabs: () => ['chart', 'text', 'download', 'copy'] as ResultTab[],
    busy: false,
  },
)

const drawerState = defineModel<DrawerState>('resultState', { default: 'closed' })

const slots = useSlots()

const hasConfig = computed(() => Boolean(slots.source || slots.config || slots.params || slots.more))
const hasAside = computed(() => Boolean(slots.aside))
</script>

<template>
  <div class="tool-page" :class="{ 'has-aside': hasAside }">
    <header class="tool-head">
      <div class="tool-head__row">
        <span class="tool-head__eyebrow">
          <span class="tool-head__bar" />
          {{ eyebrow }}
        </span>
        <RouterLink v-if="doc" :to="doc" class="doc-link">
          <BookOpen />
          <span>文档</span>
        </RouterLink>
      </div>
      <h1 class="tool-head__title">{{ title }}</h1>
      <p v-if="subtitle" class="tool-head__subtitle">{{ subtitle }}</p>
    </header>

    <div class="tool-body" :class="{ 'has-aside': hasAside }">
      <aside v-if="hasConfig" class="tool-config">
        <slot name="source" />
        <slot name="config" />
        <slot name="params" />

        <details v-if="slots.more" class="more">
          <summary class="more__summary">更多设置</summary>
          <div class="more__body">
            <slot name="more" />
          </div>
        </details>
      </aside>

      <section class="tool-main">
        <slot name="input" />
        <slot />

        <div v-if="slots.chart && drawerState === 'closed'" class="result-inline">
          <slot name="chart" />
        </div>

        <div v-if="slots.run" class="run-bar">
          <slot name="run" />
        </div>
        <slot name="aside" />
      </section>
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 18px 20px 32px;
}

/* ---------------------------------------------------------------- head */

.tool-head {
  margin-bottom: 16px;
}

.tool-head__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
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
  margin-top: 8px;
  font-size: 27px;
  font-weight: 740;
  letter-spacing: -0.025em;
  color: var(--text);
}

.tool-head__subtitle {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-2);
  max-width: 820px;
}

.doc-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
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

/* ---------------------------------------------------------------- body */

.tool-body {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.tool-config {
  position: sticky;
  top: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - var(--header-h) - var(--status-h) - 34px);
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.tool-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.result-inline {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.run-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 1180px) {
  .tool-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .tool-config {
    position: static;
    max-height: none;
  }
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

@media (max-width: 768px) {
  .tool-page {
    padding: 16px 14px 96px;
  }

  .tool-head__title {
    font-size: 22px;
  }

  /* Core actions stay reachable above the safe area. */
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
