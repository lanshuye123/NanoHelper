<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import { describePattern } from '@/core/pipeline/validate'

const project = useProjectStore()

const summary = computed(() => {
  if (!project.hasData || !project.derived) return '就绪 · 请从「导入与预处理」开始'
  const pattern = project.derived
  const name = project.source?.name ?? '未命名数据'
  return `${name} · ${describePattern(pattern)} · ${project.steps.length} 个处理步骤`
})

const status = computed(() => {
  if (!project.derived) return 'idle'
  const issues = project.issues
  if (issues.some((i) => i.level === 'error')) return 'error'
  if (issues.some((i) => i.level === 'warning')) return 'warn'
  return 'ok'
})
</script>

<template>
  <footer class="status-bar">
    <div class="status-left">
      <span class="status-dot" :class="`is-${status}`" />
      <span class="status-local">本地运行 · 数据不上传</span>
    </div>
    <div class="status-center mono">{{ summary }}</div>
    <div class="status-right mono">
      <span v-if="project.jadeStep" class="status-item">Jade 映射已启用</span>
      <span>v0.1.0</span>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  height: var(--status-h);
  padding: 0 14px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  backdrop-filter: blur(10px);
  font-size: 10px;
  color: var(--text-3);
  overflow: hidden;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-3);
}

.status-dot.is-ok {
  background: var(--ok);
  box-shadow: 0 0 0 3px var(--ok-soft);
}

.status-dot.is-warn {
  background: var(--warn);
  box-shadow: 0 0 0 3px var(--warn-soft);
}

.status-dot.is-error {
  background: var(--danger);
  box-shadow: 0 0 0 3px var(--danger-soft);
}

.status-center {
  flex: 1;
  min-width: 0;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
}

.status-item {
  color: var(--accent);
}

@media (max-width: 860px) {
  .status-center {
    display: none;
  }
}
</style>
