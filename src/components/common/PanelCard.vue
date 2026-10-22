<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    title?: string
    icon?: Component
    hint?: string
    flat?: boolean
    bodyClass?: string
  }>(),
  { flat: false },
)
</script>

<template>
  <section class="panel" :class="{ 'panel--flat': flat }">
    <header v-if="title || $slots.actions" class="panel__head">
      <h2 class="panel__title">
        <component :is="icon" v-if="icon" />
        <span>{{ title }}</span>
        <span v-if="hint" class="panel__hint">{{ hint }}</span>
      </h2>
      <div v-if="$slots.actions" class="panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="panel__body" :class="bodyClass">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.panel__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel__hint {
  font-weight: 400;
  font-size: 11px;
  color: var(--text-3);
  margin-left: 2px;
}
</style>
