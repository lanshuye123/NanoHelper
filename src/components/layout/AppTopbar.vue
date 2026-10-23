<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Menu, Moon, Search, Sun } from 'lucide-vue-next'
import BrandLogo from './BrandLogo.vue'
import { NAV_MODULES, moduleByKey, moduleForPath } from '@/config/navigation'
import { useQuickSearch } from '@/composables/useQuickSearch'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settings = useSettingsStore()
const { openSearch } = useQuickSearch()

const activeModule = computed(() => {
  const key = route.meta.module as string | undefined
  return key ? moduleByKey(key) : moduleForPath(route.path)
})

const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'
</script>

<template>
  <header class="app-topbar">
    <div class="topbar-inner">
      <button
        class="mobile-menu"
        type="button"
        :aria-expanded="settings.mobileNavOpen"
        title="打开导航"
        aria-label="打开导航"
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
          :class="{ 'is-active': activeModule.key === module.key }"
          :aria-current="activeModule.key === module.key ? 'page' : undefined"
          :title="module.description"
        >
          <component :is="module.icon" class="module-tab__icon" />
          <span class="module-tab__label">{{ module.label }}</span>
        </RouterLink>
      </nav>

      <div class="topbar-actions">
        <button class="nav-pill nav-search" type="button" title="搜索工具与文档（Ctrl / ⌘ + K）" @click="openSearch()">
          <Search class="nav-pill__icon" />
          <span class="nav-search__text">搜索</span>
          <kbd class="nav-search__kbd">Ctrl K</kbd>
        </button>

        <span class="local-chip" title="所有解析与计算均在浏览器本地完成">
          <span class="local-chip__dot" />
          本地运行
        </span>

        <span class="version-badge mono">v{{ version }}</span>

        <button
          class="nav-pill nav-icon-btn"
          type="button"
          :title="settings.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
          :aria-label="settings.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
          @click="settings.toggleTheme()"
        >
          <Sun v-if="settings.theme === 'dark'" class="nav-pill__icon" />
          <Moon v-else class="nav-pill__icon" />
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
  background: linear-gradient(135deg, var(--nav-bg-start) 0%, var(--nav-bg-end) 100%);
  border-bottom: 2px solid var(--nav-divider);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset;
}

.app-topbar::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
  opacity: 0.5;
}

.topbar-inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  height: var(--topbar-h);
  padding: 0 16px;
}

.mobile-menu {
  display: none;
  place-items: center;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--nav-control-border);
  border-radius: var(--radius-pill);
  background: var(--nav-control-bg);
  color: var(--nav-text);
  cursor: pointer;
}

.mobile-menu:hover {
  background: var(--nav-control-hover);
}

.mobile-menu svg {
  width: 16px;
  height: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 0 0 auto;
  min-width: 0;
  color: var(--nav-text);
  text-decoration: none;
}

.brand:hover {
  text-decoration: none;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  flex: 0 0 auto;
  filter: drop-shadow(0 2px 8px rgba(2, 20, 36, 0.22));
}

.brand__mark :deep(svg) {
  width: 100%;
  height: 100%;
}

.brand__copy {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  min-width: 0;
}

.brand__copy strong {
  font-size: 15px;
  font-weight: 750;
  letter-spacing: 0.015em;
  white-space: nowrap;
}

.brand__copy small {
  margin-top: 3px;
  font-size: 9.5px;
  letter-spacing: 0.03em;
  color: var(--nav-brand-sub);
  white-space: nowrap;
}

.module-tabs {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: safe center;
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
  padding: 0 11px;
  border-radius: var(--radius-pill);
  color: var(--nav-text);
  font-size: 12px;
  font-weight: 550;
  white-space: nowrap;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease),
    box-shadow var(--duration) var(--ease);
}

.module-tab:hover {
  background: var(--nav-control-hover);
  color: var(--nav-text);
  text-decoration: none;
}

.module-tab.is-active {
  background: var(--nav-active-bg);
  color: var(--nav-active-text);
  font-weight: 700;
  box-shadow: 0 2px 10px rgba(3, 24, 42, 0.22);
}

.module-tab__icon {
  width: 14px;
  height: 14px;
  opacity: 0.9;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--nav-control-border);
  border-radius: var(--radius-pill);
  background: var(--nav-control-bg);
  color: var(--nav-text);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background var(--duration) var(--ease);
}

.nav-pill:hover {
  background: var(--nav-control-hover);
}

.nav-pill__icon {
  width: 14px;
  height: 14px;
}

.nav-icon-btn {
  width: 30px;
  padding: 0;
  justify-content: center;
}

.nav-search__text {
  font-weight: 550;
}

.nav-search__kbd {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.16);
  color: rgba(240, 249, 255, 0.82);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.02em;
}

.local-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.09);
  color: var(--nav-muted);
  font-size: 10.5px;
  white-space: nowrap;
}

.local-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7ce3b1;
  box-shadow: 0 0 0 3px rgba(124, 227, 177, 0.18);
}

.version-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--nav-control-border);
  border-radius: var(--radius-pill);
  color: var(--nav-muted);
  font-size: 9.5px;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .local-chip {
    display: none;
  }

  .module-tab {
    padding: 0 9px;
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
    height: auto;
    padding: 8px 10px 0;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mobile-menu {
    display: grid;
  }

  .brand {
    flex: 1 1 auto;
  }

  .brand__mark {
    width: 27px;
    height: 27px;
  }

  .brand__copy strong {
    font-size: 13.5px;
  }

  .topbar-actions {
    margin-left: auto;
  }

  .nav-search__text {
    display: none;
  }

  .nav-search {
    width: 30px;
    padding: 0;
    justify-content: center;
  }

  .module-tabs {
    order: 3;
    flex: 0 0 100%;
    justify-content: flex-start;
    gap: 1px;
    padding: 4px 0 7px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin-top: 2px;
  }

  .module-tab {
    height: 28px;
    padding: 0 9px;
    font-size: 11px;
  }

  .module-tab__icon {
    width: 12px;
    height: 12px;
  }
}

@media (max-width: 420px) {
  .module-tab__icon {
    display: none;
  }

  .module-tab {
    padding: 0 8px;
  }
}
</style>
