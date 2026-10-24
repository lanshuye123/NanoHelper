<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'diffraction' | 'spectrum' | 'thermal' | 'fit'
    color?: string
    width?: number
    height?: number
  }>(),
  {
    variant: 'diffraction',
    color: 'var(--plot-1)',
    width: 72,
    height: 44,
  },
)

const PATHS: Record<string, string> = {
  diffraction:
    'M2 40 L14 40 L18 22 L22 40 L34 40 L38 12 L42 40 L52 40 L55 28 L58 40 L70 40',
  spectrum:
    'M2 38 L16 38 L19 8 L22 38 L34 38 L37 18 L40 38 L50 38 L53 6 L56 38 L70 38',
  thermal: 'M2 10 L22 12 L24 24 L44 26 L46 36 L70 38',
  fit: 'M2 34 C14 30 18 10 28 12 C40 14 40 34 52 32 L70 30',
}
</script>

<template>
  <svg
    class="spark"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <line x1="0" y1="41" :x2="width" y2="41" class="spark__axis" />
    <path :d="PATHS[variant]" class="spark__line" :style="{ stroke: color }" />
  </svg>
</template>

<style scoped>
.spark {
  flex: 0 0 auto;
  overflow: visible;
}

.spark__axis {
  stroke: var(--border);
  stroke-width: 1;
}

.spark__line {
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
