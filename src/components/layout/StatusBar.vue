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

const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'
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
      <span class="status-version">CrystalToolBox v{{ version }}</span>
    </div>
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
  border-top: 1px solid color-mix(in srgb, var(--nav-divider) 28%, transparent);
  font-size: 9.5px;
  letter-spacing: 0.01em;
  overflow: hidden;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 12px;
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
  box-shadow: 0 0 0 3px rgba(105, 224, 168, 0.14);
}

.status-dot.is-warn {
  background: #f2c15c;
  box-shadow: 0 0 0 3px rgba(242, 193, 92, 0.14);
}

.status-dot.is-error {
  background: #ff8b9a;
  box-shadow: 0 0 0 3px rgba(255, 139, 154, 0.16);
}

.status-center {
  flex: 1;
  min-width: 0;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 9.5px;
  color: color-mix(in srgb, var(--status-text) 84%, transparent);
}

.status-item {
  color: var(--status-strong);
}

.status-version {
  color: color-mix(in srgb, var(--status-text) 78%, transparent);
}

@media (max-width: 860px) {
  .status-center {
    display: none;
  }

  .status-version {
    display: none;
  }
}
</style>
