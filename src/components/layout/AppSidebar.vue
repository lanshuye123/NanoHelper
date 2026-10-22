<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  BookOpen,
  Info,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-vue-next'
import BrandLogo from './BrandLogo.vue'
import { tools, type ToolMeta } from '@/tools/registry'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settings = useSettingsStore()
const collapsed = computed(() => settings.sidebarCollapsed)

const dataTools = tools.filter((t) => t.group === 'data')
const crystalTools = tools.filter((t) => t.group === 'crystal')

const resourceLinks = [
  { label: '用户指南', path: '/docs/userguide/getting-started', icon: BookOpen },
  { label: '实战手册', path: '/docs/cookbook/raman-to-jade', icon: BookOpen },
  { label: '功能说明', path: '/docs/reference/tools', icon: BookOpen },
  { label: '关于本项目', path: '/about', icon: Info },
]

function isActive(path: string): boolean {
  return route.path === path || (path !== '/' && route.path.startsWith(path))
}

function isDocActive(path: string): boolean {
  const section = path.split('/')[2]
  return route.path.startsWith(`/docs/${section}`)
}

function itemTitle(item: ToolMeta): string {
  return `${item.title} · ${item.subtitle}`
}
</script>

<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': collapsed, 'is-open': settings.mobileNavOpen }">
    <RouterLink to="/" class="brand" :title="collapsed ? 'CrystalToolBox' : undefined">
      <span class="brand__logo"><BrandLogo /></span>
      <span v-if="!collapsed" class="brand__text">
        <span class="brand__name">CrystalToolBox</span>
        <span class="brand__sub">晶体学工具箱</span>
      </span>
    </RouterLink>

    <nav class="nav" aria-label="主导航">
      <div class="nav__group">
        <div v-if="!collapsed" class="nav__label">工作台</div>
        <RouterLink to="/" class="nav__item" :class="{ 'is-active': route.path === '/' }" title="工作台">
          <LayoutDashboard class="nav__icon" />
          <span v-if="!collapsed" class="nav__text">总览</span>
        </RouterLink>
      </div>

      <div class="nav__group">
        <div v-if="!collapsed" class="nav__label">数据处理</div>
        <RouterLink
          v-for="item in dataTools"
          :key="item.id"
          :to="item.path"
          class="nav__item"
          :class="{ 'is-active': isActive(item.path) }"
          :title="collapsed ? itemTitle(item) : item.subtitle"
        >
          <component :is="item.icon" class="nav__icon" />
          <span v-if="!collapsed" class="nav__text">{{ item.title }}</span>
          <span v-if="!collapsed && item.status === 'beta'" class="nav__beta">beta</span>
        </RouterLink>
      </div>

      <div class="nav__group">
        <div v-if="!collapsed" class="nav__label">晶体学计算</div>
        <RouterLink
          v-for="item in crystalTools"
          :key="item.id"
          :to="item.path"
          class="nav__item"
          :class="{ 'is-active': isActive(item.path) }"
          :title="collapsed ? itemTitle(item) : item.subtitle"
        >
          <component :is="item.icon" class="nav__icon" />
          <span v-if="!collapsed" class="nav__text">{{ item.title }}</span>
        </RouterLink>
      </div>

      <div class="nav__group">
        <div v-if="!collapsed" class="nav__label">资源</div>
        <RouterLink
          v-for="link in resourceLinks"
          :key="link.path"
          :to="link.path"
          class="nav__item"
          :class="{ 'is-active': link.path === '/about' ? route.path === '/about' : isDocActive(link.path) }"
          :title="link.label"
        >
          <component :is="link.icon" class="nav__icon" />
          <span v-if="!collapsed" class="nav__text">{{ link.label }}</span>
        </RouterLink>
      </div>
    </nav>

    <div class="sidebar-foot">
      <button class="collapse" type="button" :title="collapsed ? '展开侧栏' : '收起侧栏'" @click="settings.toggleSidebar">
        <PanelLeftOpen v-if="collapsed" />
        <PanelLeftClose v-else />
      </button>
      <span v-if="!collapsed" class="version mono">v0.1.0</span>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  border-right: 1px solid var(--border);
  backdrop-filter: blur(14px);
  overflow: hidden;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--header-h);
  padding: 0 16px;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text);
  text-decoration: none;
  flex: 0 0 auto;
}

.brand:hover {
  text-decoration: none;
}

.brand__logo {
  display: block;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  filter: drop-shadow(0 2px 8px rgba(34, 211, 238, 0.18));
}

.brand__logo :deep(svg) {
  width: 100%;
  height: 100%;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}

.brand__name {
  font-size: 13.5px;
  font-weight: 750;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.brand__sub {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 10px 16px;
}

.nav__group + .nav__group {
  margin-top: 14px;
}

.nav__label {
  padding: 0 8px 6px;
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}

.nav__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 9px;
  margin-bottom: 2px;
  border-radius: 7px;
  color: var(--text-2);
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.nav__item:hover {
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
}

.nav__item.is-active {
  background: var(--accent-soft);
  color: var(--text);
}

.nav__item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  bottom: 7px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
}

.nav__icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  opacity: 0.85;
}

.nav__item.is-active .nav__icon {
  color: var(--accent);
  opacity: 1;
}

.nav__text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav__beta {
  margin-left: auto;
  font-size: 9px;
  color: var(--accent);
  border: 1px solid var(--accent-line);
  border-radius: 4px;
  padding: 0 4px;
  line-height: 14px;
}

.sidebar-foot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-top: 1px solid var(--border-soft);
}

.collapse {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}

.collapse:hover {
  background: var(--surface-2);
  color: var(--text);
  border-color: var(--border);
}

.collapse svg {
  width: 15px;
  height: 15px;
}

.version {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.02em;
}

.is-collapsed .brand {
  justify-content: center;
  padding: 0;
}

.is-collapsed .nav {
  padding: 12px 8px;
}

.is-collapsed .nav__item {
  justify-content: center;
  padding: 0;
}

.is-collapsed .sidebar-foot {
  justify-content: center;
  padding: 9px 0;
}

@media (max-width: 900px) {
  .app-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 20;
    width: var(--sidebar-w);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow);
  }

  .app-sidebar.is-open {
    transform: translateX(0);
  }
}
</style>
