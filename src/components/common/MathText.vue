<script setup lang="ts">
import { computed } from 'vue'
import katex from 'katex'

const props = withDefaults(
  defineProps<{
    tex: string
    display?: boolean
    block?: boolean
  }>(),
  { display: false, block: false },
)

const html = computed(() => {
  try {
    return katex.renderToString(props.tex, {
      displayMode: props.display,
      throwOnError: false,
      strict: false,
      trust: false,
    })
  } catch {
    return props.tex
  }
})
</script>

<template>
  <span v-if="!block" class="formula-inline" v-html="html" />
  <div v-else class="formula-block" v-html="html" />
</template>
