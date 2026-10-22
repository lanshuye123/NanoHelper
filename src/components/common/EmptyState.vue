<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    icon?: Component
    title: string
    description?: string
  }>(),
  {},
)
</script>

<template>
  <div class="empty">
    <component :is="icon" v-if="icon" />
    <div class="empty__title">{{ title }}</div>
    <div v-if="description" class="empty__desc">{{ description }}</div>
    <div v-if="$slots.default" class="empty__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.empty__desc {
  font-size: 11.5px;
  max-width: 460px;
  line-height: 1.6;
}

.empty__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 4px;
}
</style>
