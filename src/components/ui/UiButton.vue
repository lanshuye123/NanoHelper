<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'default' | 'ghost' | 'quiet'
    size?: 'sm' | 'md' | 'lg'
    /** Renders a router link instead of a button. */
    to?: string
    disabled?: boolean
    /** Reflects a running operation: disables the control and shows a busy state. */
    busy?: boolean
    type?: 'button' | 'submit'
    icon?: Component
    iconRight?: Component
  }>(),
  {
    variant: 'default',
    size: 'md',
    disabled: false,
    busy: false,
    type: 'button',
  },
)
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'button'"
    :to="to"
    :type="to ? undefined : type"
    class="ui-btn"
    :class="[`ui-btn--${variant}`, `ui-btn--${size}`, { 'is-busy': busy }]"
    :disabled="to ? undefined : disabled || busy"
    :aria-disabled="to && (disabled || busy) ? 'true' : undefined"
    :aria-busy="busy ? 'true' : undefined"
  >
    <component :is="icon" v-if="icon" class="ui-btn__icon" />
    <span class="ui-btn__label"><slot /></span>
    <component :is="iconRight" v-if="iconRight" class="ui-btn__icon ui-btn__icon--end" />
  </component>
</template>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--duration) var(--ease),
    border-color var(--duration) var(--ease),
    color var(--duration) var(--ease),
    box-shadow var(--duration) var(--ease),
    transform var(--duration) var(--ease);
}

.ui-btn:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--surface-2);
  border-color: var(--border-strong);
  color: var(--text);
  text-decoration: none;
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.ui-btn:disabled,
.ui-btn[aria-disabled='true'] {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.ui-btn.is-busy {
  cursor: progress;
}

.ui-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
  font-weight: 600;
}

.ui-btn--primary:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
  box-shadow: 0 8px 20px color-mix(in srgb, var(--accent) 28%, transparent);
}

.ui-btn--ghost {
  border-color: transparent;
  background: transparent;
  color: var(--text-2);
}

.ui-btn--ghost:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--surface-2);
  border-color: transparent;
}

.ui-btn--quiet {
  height: 32px;
  padding: 0 11px;
  font-size: 12px;
  border-radius: 8px;
}

.ui-btn--sm {
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  border-radius: 8px;
}

.ui-btn--lg {
  height: 44px;
  padding: 0 20px;
  font-size: 14px;
  border-radius: 12px;
}

.ui-btn__icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.ui-btn__icon--end {
  width: 14px;
  height: 14px;
}

.ui-btn--lg .ui-btn__icon {
  width: 16px;
  height: 16px;
}
</style>
