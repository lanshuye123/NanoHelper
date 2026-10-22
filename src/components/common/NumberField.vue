<script setup lang="ts">
import { ref, watch } from 'vue'
import { evaluateExpression, formatInputNumber } from '@/utils/expression'

const props = withDefaults(
  defineProps<{
    modelValue: number
    label?: string
    unit?: string
    hint?: string
    min?: number
    max?: number
    precision?: number
    disabled?: boolean
    placeholder?: string
  }>(),
  { precision: 6, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const text = ref(formatInputNumber(props.modelValue, props.precision))
const invalid = ref(false)

watch(
  () => props.modelValue,
  (value) => {
    if (evaluateExpression(text.value) !== value) {
      text.value = formatInputNumber(value, props.precision)
    }
    invalid.value = false
  },
)

function commit() {
  const value = evaluateExpression(text.value)
  if (value === null) {
    invalid.value = true
    text.value = formatInputNumber(props.modelValue, props.precision)
    return
  }
  let next = props.precision === 0 ? Math.round(value) : value
  if (props.min !== undefined) next = Math.max(props.min, next)
  if (props.max !== undefined) next = Math.min(props.max, next)
  invalid.value = false
  text.value = formatInputNumber(next, props.precision)
  emit('update:modelValue', next)
}
</script>

<template>
  <label class="field num-field">
    <span v-if="label" class="field__label">
      {{ label }}
      <span v-if="unit" class="field__unit">{{ unit }}</span>
    </span>
    <span class="num-field__box" :class="{ 'is-invalid': invalid }">
      <input
        v-model="text"
        class="num-field__input mono"
        type="text"
        inputmode="decimal"
        :placeholder="placeholder"
        :disabled="disabled"
        spellcheck="false"
        @blur="commit"
        @keydown.enter.prevent="commit"
      />
    </span>
    <span v-if="hint" class="field__hint">{{ hint }}</span>
  </label>
</template>

<style scoped>
.num-field {
  min-width: 0;
}

.num-field__box {
  display: flex;
  align-items: center;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.num-field__box:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.num-field__box.is-invalid {
  border-color: var(--danger);
  box-shadow: 0 0 0 2px var(--danger-soft);
}

.num-field__input {
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 0 9px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: 12.5px;
}

.num-field__input::placeholder {
  color: var(--text-3);
}

.num-field__input:disabled {
  color: var(--text-3);
  cursor: not-allowed;
}
</style>
