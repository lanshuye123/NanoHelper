<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-vue-next'
import type { JadeIssue } from '@/core/pipeline/validate'

defineProps<{ issues: JadeIssue[] }>()

const icons = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  ok: CheckCircle2,
}
</script>

<template>
  <div class="issue-list">
    <div v-for="(issue, index) in issues" :key="`${issue.code}-${index}`" class="issue" :class="`issue--${issue.level}`">
      <span class="issue__icon">
        <component :is="issue.level === 'info' ? icons.ok : icons[issue.level]" />
      </span>
      <div class="issue__body">
        <div class="issue__message">{{ issue.message }}</div>
        <div v-if="issue.hint" class="issue__hint">{{ issue.hint }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.issue__body {
  min-width: 0;
}
</style>
