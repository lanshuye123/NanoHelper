<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import { describePattern } from '@/core/pipeline/validate'

const project = useProjectStore()

const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'

const summary = computed(() => {
  if (!project.hasData || !project.derived) return '就绪 · 从左侧选择工具开始'
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
      <span>工作台</span>
    </div>
    <div class="status-center mono">{{ summary }}</div>
    <div class="status-right mono">CrystalToolBox v{{ version }}</div>
  </footer>
</template>

<style scoped>
.status-bar {
  flex: 0 0 var(--status-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  height: var(--status-h);
  padding: 0 14px;
  background: var(--status-bg);
  color: var(--status-text);
  font-size: 10px;
  letter-spacing: 0.01em;
  overflow: hidden;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(200, 220, 238, 0.45);
}

.status-dot.is-ok {
  background: #69e0a8;
}

.status-dot.is-warn {
  background: #f2c15c;
}

.status-dot.is-error {
  background: #ff8b9a;
}

.status-center {
  flex: 1;
  min-width: 0;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--status-strong);
  opacity: 0.85;
}

@media (max-width: 860px) {
  .status-center {
    display: none;
  }
}
</style>
