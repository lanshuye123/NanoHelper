<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    eyebrow?: string
    doc?: string
    status?: 'stable' | 'beta' | 'new'
  }>(),
  { status: 'stable' },
)
</script>

<template>
  <div class="tool-page">
    <header class="tool-head">
      <div class="tool-head__left">
        <div v-if="eyebrow" class="tool-head__eyebrow">
          <span>{{ eyebrow }}</span>
          <span v-if="status === 'beta'" class="chip chip--accent tiny">BETA</span>
          <span v-else-if="status === 'new'" class="chip chip--ok tiny">NEW</span>
        </div>
        <h1 class="tool-head__title">{{ title }}</h1>
        <p v-if="subtitle" class="tool-head__subtitle">{{ subtitle }}</p>
      </div>
      <div class="tool-head__actions">
        <slot name="actions" />
        <RouterLink v-if="doc" :to="doc" class="doc-link">
          <BookOpen />
          <span>文档</span>
        </RouterLink>
      </div>
    </header>

    <div class="tool-body" :class="{ 'has-aside': $slots.aside }">
      <aside v-if="$slots.config" class="tool-config">
        <slot name="config" />
      </aside>
      <section class="tool-main">
        <slot />
      </section>
      <aside v-if="$slots.aside" class="tool-aside">
        <slot name="aside" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.doc-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 550;
  text-decoration: none;
  transition: all 0.15s;
}

.doc-link:hover {
  border-color: var(--accent-line);
  color: var(--accent);
  background: var(--accent-soft);
  text-decoration: none;
}

.doc-link svg {
  width: 14px;
  height: 14px;
}
</style>
