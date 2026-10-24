<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'text' | 'search' | 'password' | 'number'
    placeholder?: string
    invalid?: boolean
    size?: 'sm' | 'md'
    ariaLabel?: string
  }>(),
  {
    type: 'text',
    size: 'md',
    invalid: false,
  },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <span class="ui-input-wrap" :class="`ui-input-wrap--${size}`">
    <span v-if="$slots.prefix" class="ui-input__prefix"><slot name="prefix" /></span>
    <input
      v-model="model"
      class="ui-input"
      :class="`ui-input--${size}`"
      :type="type"
      :placeholder="placeholder"
      :aria-label="ariaLabel ?? placeholder"
      :aria-invalid="invalid ? 'true' : undefined"
    />
  </span>
</template>

<style scoped>
.ui-input-wrap {
  position: relative;
  display: block;
  width: 100%;
}

.ui-input__prefix {
  position: absolute;
  top: 50%;
  left: 11px;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  color: var(--text-3);
  pointer-events: none;
}

.ui-input__prefix svg {
  width: 14px;
  height: 14px;
}

.ui-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition:
    border-color var(--duration) var(--ease),
    box-shadow var(--duration) var(--ease);
}

.ui-input-wrap:has(.ui-input__prefix) .ui-input {
  padding-left: 32px;
}

.ui-input--sm {
  height: 32px;
  border-radius: 8px;
  font-size: 12px;
}

.ui-input__prefix + .ui-input {
  height: 100%;
}

.ui-input::placeholder {
  color: var(--text-3);
}

.ui-input:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.ui-input[aria-invalid='true'] {
  border-color: var(--danger);
}
</style>
