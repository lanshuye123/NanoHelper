<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Atom, BookOpen, Compass, Info, Menu, Microscope, Moon, ScanLine, Search, Sun, Upload } from 'lucide-vue-next'
import BrandLogo from './BrandLogo.vue'
import { NAV_MODULES } from '@/config/navigation'
import { useQuickSearch } from '@/composables/useQuickSearch'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settings = useSettingsStore()
const { openSearch } = useQuickSearch()

const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'

const ICONS: Record<string, typeof Upload> = {
  home: Compass,
  data: Upload,
  diffraction: ScanLine,
  crystal: Atom,
  micro: Microscope,
  docs: BookOpen,
  about: Info,
}

const activeKey = computed(() => {
  const key = route.meta.module as string | undefined
  if (key) return key
  if (route.path.startsWith('/docs')) return 'docs'
  if (route.path.startsWith('/about')) return 'about'
  if (route.path === '/') return 'home'
  return 'data'
})
</script>

<template>
  <header class="app-topbar">
    <div class="topbar-inner">
      <button
        class="mobile-menu"
        type="button"
        :aria-expanded="settings.mobileNavOpen"
        aria-label="打开导航"
        title="打开导航"
        @click="settings.toggleMobileNav()"
      >
        <Menu />
      </button>

      <RouterLink to="/" class="brand" aria-label="CrystalToolBox 首页">
        <span class="brand__mark"><BrandLogo /></span>
        <span class="brand__copy">
          <strong>CrystalToolBox</strong>
          <small>纳米材料与晶体学工具箱</small>
        </span>
      </RouterLink>

      <nav class="module-tabs" aria-label="功能模块">
        <RouterLink
          v-for="module in NAV_MODULES"
          :key="module.key"
          :to="module.path"
          class="module-tab"
          :class="{ 'is-active': activeKey === module.key }"
          :aria-current="activeKey === module.key ? 'page' : undefined"
        >
          <component :is="ICONS[module.key] ?? Compass" class="module-tab__icon" />
          <span class="module-tab__label">{{ module.label }}</span>
        </RouterLink>
      </nav>

      <div class="topbar-actions">
        <button type="button" class="nav-search" title="搜索工具与文档（Ctrl / ⌘ + K）" @click="openSearch()">
          <Search class="nav-search__icon" />
          <span class="nav-search__text">搜索</span>
          <kbd class="nav-search__kbd">Ctrl K</kbd>
        </button>

        <span class="version-badge mono">v{{ version }}</span>

        <button
          type="button"
          class="nav-icon-btn"
          :title="settings.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
          :aria-label="settings.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
          @click="settings.toggleTheme()"
        >
          <Sun v-if="settings.theme === 'dark'" />
          <Moon v-else />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-topbar {
  flex: 0 0 auto;
  position: relative;
  z-index: 30;
  background: var(--nav-bg-start);
  border-bottom: 2px solid var(--nav-divider);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
}

.topbar-inner {
  display: flex;
  align-items: center;
  gap: 18px;
  height: var(--topbar-h);
  padding: 0 16px;
}

/* ---------------------------------------------------------------- brand */

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 0 0 auto;
  color: var(--nav-text);
  text-decoration: none;
}

.brand:hover {
  text-decoration: none;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
}

.brand__mark :deep(svg) {
  width: 100%;
  height: 100%;
}

.brand__copy {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}

.brand__copy strong {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.brand__copy small {
  margin-top: 2px;
  font-size: 9.5px;
  letter-spacing: 0.03em;
  color: var(--nav-brand-sub);
  white-space: nowrap;
}

/* ---------------------------------------------------------------- modules */

.module-tabs {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.module-tabs::-webkit-scrollbar {
  display: none;
}

.module-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  color: var(--nav-text);
  font-size: 12.5px;
  font-weight: 550;
  white-space: nowrap;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.module-tab:hover {
  background: var(--nav-control-hover);
  color: var(--nav-text);
  text-decoration: none;
}

.module-tab.is-active {
  background: var(--nav-active-bg);
  color: var(--nav-active-text);
  font-weight: 650;
}

.module-tab__icon {
  width: 15px;
  height: 15px;
  opacity: 0.92;
}

/* ---------------------------------------------------------------- actions */

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.nav-search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px 0 11px;
  border: 1px solid var(--nav-control-border);
  border-radius: 999px;
  background: var(--nav-control-bg);
  color: var(--nav-text);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background var(--duration) var(--ease);
}

.nav-search:hover {
  background: var(--nav-control-hover);
}

.nav-search__icon {
  width: 14px;
  height: 14px;
}

.nav-search__text {
  font-weight: 550;
}

.nav-search__kbd {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.16);
  color: var(--nav-text);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.02em;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--nav-control-border);
  border-radius: 999px;
  color: var(--nav-muted);
  font-size: 10px;
  white-space: nowrap;
}

.nav-icon-btn {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--nav-control-border);
  border-radius: 999px;
  background: var(--nav-control-bg);
  color: var(--nav-text);
  cursor: pointer;
  transition: background var(--duration) var(--ease);
}

.nav-icon-btn:hover {
  background: var(--nav-control-hover);
}

.nav-icon-btn svg {
  width: 15px;
  height: 15px;
}

@media (max-width: 1280px) {
  .module-tab {
    padding: 0 9px;
  }
}

.mobile-menu {
  display: none;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--nav-control-border);
  border-radius: 10px;
  background: var(--nav-control-bg);
  color: var(--nav-text);
  cursor: pointer;
}

.mobile-menu svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 1024px) {
  .mobile-menu {
    display: grid;
  }
}

@media (max-width: 1080px) {
  .brand__copy small {
    display: none;
  }

  .nav-search__kbd {
    display: none;
  }

  .version-badge {
    display: none;
  }
}

@media (max-width: 900px) {
  .topbar-inner {
    height: 54px;
    gap: 10px;
  }

  .module-tabs {
    justify-content: flex-start;
  }

  .module-tab__label {
    display: none;
  }

  .module-tab {
    padding: 0 8px;
  }

  .nav-search__text {
    display: none;
  }
}
</style>
