<script setup lang="ts">
import type { Component } from 'vue'
import UiCard from '@/components/ui/UiCard.vue'

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
  <UiCard
    :title="title"
    :icon="icon"
    :hint="hint"
    :flat="flat"
    :body-class="bodyClass"
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <slot />
  </UiCard>
</template>
