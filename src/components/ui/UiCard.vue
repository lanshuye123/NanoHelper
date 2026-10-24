<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    title?: string
    icon?: Component
    /** Short note on the right side of the header. */
    hint?: string
    /** Removes the border and flattens the card. */
    flat?: boolean
    /** Removes the header row entirely. */
    bare?: boolean
    bodyClass?: string
  }>(),
  {
    flat: false,
    bare: false,
  },
)
</script>

<template>
  <section class="ui-card" :class="{ 'ui-card--flat': flat }">
    <header v-if="!bare && (title || hint || $slots.actions)" class="ui-card__head">
      <h2 class="ui-card__title">
        <component :is="icon" v-if="icon" class="ui-card__icon" />
        <span>{{ title }}</span>
        <span v-if="hint" class="ui-card__hint">{{ hint }}</span>
      </h2>
      <div v-if="$slots.actions" class="ui-card__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="ui-card__body" :class="bodyClass">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.ui-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.ui-card--flat {
  box-shadow: none;
  background: var(--surface-2);
}

.ui-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-soft);
}

.ui-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13.5px;
  font-weight: 650;
  letter-spacing: 0.005em;
  color: var(--text);
}

.ui-card__icon {
  width: 17px;
  height: 17px;
  color: var(--accent);
}

.ui-card__hint {
  font-size: 11.5px;
  font-weight: 400;
  color: var(--text-3);
}

.ui-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ui-card__body {
  padding: 18px;
}

.ui-card__body:empty {
  display: none;
}
</style>
