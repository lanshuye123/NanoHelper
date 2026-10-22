<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { BookOpen, ChevronRight, Menu, Moon, Sun } from 'lucide-vue-next'
import { tools } from '@/tools/registry'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settings = useSettingsStore()

const groupLabels: Record<string, string> = {
  workspace: '工作台',
  data: '数据处理',
  crystal: '晶体学计算',
}

const currentTool = computed(() => tools.find((t) => t.id === (route.meta.toolId as string)))
const groupLabel = computed(() => {
  const group = route.meta.group as string | undefined
  return group ? groupLabels[group] : undefined
})
const isDocs = computed(() => route.path.startsWith('/docs'))
const title = computed(() => (route.meta.title as string) ?? 'CrystalToolBox')
</script>

<template>
  <header class="app-topbar">
    <div class="topbar-left">
      <button class="icon-btn menu-btn" type="button" title="菜单" @click="settings.toggleMobileNav()">
        <Menu />
      </button>
      <nav class="crumbs" aria-label="面包屑">
        <RouterLink to="/" class="crumb crumb--home">工作台</RouterLink>
        <template v-if="route.path !== '/'">
          <ChevronRight class="crumb-sep" />
          <template v-if="groupLabel">
            <span class="crumb crumb--group">{{ groupLabel }}</span>
            <ChevronRight class="crumb-sep" />
          </template>
          <span class="crumb crumb--current">{{ isDocs ? '文档中心' : title }}</span>
        </template>
      </nav>
      <span v-if="currentTool" class="crb-chip mono">{{ currentTool.id }}</span>
    </div>

    <div class="topbar-actions">
      <span class="run-state" title="所有解析与计算均在浏览器本地完成">
        <span class="run-state__dot" />
        <span class="run-state__text">本地运行</span>
      </span>
      <RouterLink to="/docs/userguide/getting-started" class="icon-btn" title="文档中心">
        <BookOpen />
      </RouterLink>
      <button
        class="icon-btn"
        type="button"
        :title="settings.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
        @click="settings.toggleTheme()"
      >
        <Sun v-if="settings.theme === 'dark'" />
        <Moon v-else />
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-topbar {
  flex: 0 0 var(--header-h);
  height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 22px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  backdrop-filter: blur(14px);
  z-index: 5;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  font-size: 12px;
  white-space: nowrap;
}

.crumb {
  color: var(--text-3);
  text-decoration: none;
}

.crumb--home:hover,
.crumb--group:hover {
  color: var(--text-2);
  text-decoration: none;
}

.crumb--group {
  color: var(--text-3);
}

.crumb--current {
  color: var(--text);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crumb-sep {
  width: 12px;
  height: 12px;
  color: var(--text-3);
  opacity: 0.7;
  flex: 0 0 auto;
}

.crb-chip {
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-3);
  font-size: 9.5px;
  letter-spacing: 0.02em;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.run-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-3);
  font-size: 10.5px;
  margin-right: 4px;
}

.run-state__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ok);
  box-shadow: 0 0 0 3px var(--ok-soft);
}

.menu-btn {
  display: none;
}

@media (max-width: 720px) {
  .app-topbar {
    padding: 0 12px;
  }

  .run-state__text,
  .crb-chip {
    display: none;
  }

  .run-state {
    padding: 0 7px;
  }

  .menu-btn {
    display: grid;
  }
}
</style>
