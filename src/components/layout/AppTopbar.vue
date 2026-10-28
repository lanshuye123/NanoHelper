<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Atom,
  Bell,
  BookOpen,
  Compass,
  Info,
  Menu,
  Microscope,
  Moon,
  ScanLine,
  Search,
  Sun,
  Upload,
  UserRound,
} from 'lucide-vue-next'
import BrandLogo from './BrandLogo.vue'
import { NAV_MODULES } from '@/config/navigation'
import { useQuickSearch } from '@/composables/useQuickSearch'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const { openSearch } = useQuickSearch()

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

function onAccountCommand(command: string) {
  if (command === 'theme') settings.toggleTheme()
  if (command === 'docs') void router.push('/docs/userguide/getting-started')
  if (command === 'about') void router.push('/about')
}
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
        <span class="brand__copy">CrystalToolBox</span>
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
        <button type="button" class="nav-search" title="搜索功能、文件、帮助（Ctrl / ⌘ + K）" @click="openSearch()">
          <Search class="nav-search__icon" />
          <span class="nav-search__text">搜索功能、文件、帮助…</span>
        </button>

        <el-popover placement="bottom-end" :width="272" trigger="click" popper-class="topbar-popover">
          <template #reference>
            <button type="button" class="nav-icon-btn nav-bell" title="使用提示" aria-label="使用提示">
              <Bell />
              <span class="nav-bell__dot" aria-hidden="true" />
            </button>
          </template>
          <div class="notice-pop">
            <div class="notice-pop__head">提示</div>
            <p class="notice-pop__empty">导出到 Jade 前，请在「结果摘要」中确认 2θ 范围与强度均为正。</p>
          </div>
        </el-popover>

        <el-dropdown trigger="click" placement="bottom-end" @command="onAccountCommand">
          <button type="button" class="account-btn" title="账户与外观" aria-label="账户与外观">
            <UserRound />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="theme">
                <Sun v-if="settings.theme === 'dark'" class="account-menu-icon" />
                <Moon v-else class="account-menu-icon" />
                {{ settings.theme === 'dark' ? '切换到浅色外观' : '切换到深色外观' }}
              </el-dropdown-item>
              <el-dropdown-item command="docs" divided>
                <BookOpen class="account-menu-icon" />
                文档中心
              </el-dropdown-item>
              <el-dropdown-item command="about">
                <Info class="account-menu-icon" />
                关于本工具
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
}

.topbar-inner {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: var(--topbar-h);
  padding: 0;
}

/* ---------------------------------------------------------------- brand */

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 var(--sidebar-w);
  width: var(--sidebar-w);
  padding: 0 20px;
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
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.015em;
  white-space: nowrap;
}

/* ---------------------------------------------------------------- modules */

.module-tabs {
  display: flex;
  flex: 1 1 auto;
  align-items: stretch;
  gap: 0;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.module-tabs::-webkit-scrollbar {
  display: none;
}

.module-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  height: 100%;
  padding: 0 19px;
  color: rgba(243, 249, 255, 0.82);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.module-tab:hover {
  background: rgba(255, 255, 255, 0.055);
  color: var(--nav-text);
  text-decoration: none;
}

.module-tab.is-active {
  background: var(--nav-active-bg);
  color: var(--nav-active-text);
  font-weight: 650;
}

.module-tab.is-active::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 0;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: #dcecff;
}

.module-tab__icon {
  width: 16px;
  height: 16px;
  opacity: 0.94;
}

/* ---------------------------------------------------------------- actions */

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  padding: 0 20px 0 16px;
}

.nav-search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: clamp(200px, 18.5vw, 316px);
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--nav-control-border);
  border-radius: 8px;
  background: var(--nav-control-bg);
  color: var(--nav-text);
  font-family: inherit;
  font-size: 12.5px;
  cursor: text;
  transition:
    background var(--duration) var(--ease),
    border-color var(--duration) var(--ease);
}

.nav-search:hover {
  background: var(--nav-control-hover);
  border-color: rgba(255, 255, 255, 0.17);
}

.nav-search__icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  opacity: 0.86;
}

.nav-search__text {
  flex: 1 1 auto;
  text-align: left;
  opacity: 0.74;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-icon-btn {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--nav-text);
  cursor: pointer;
  transition: background var(--duration) var(--ease);
}

.nav-icon-btn:hover {
  background: var(--nav-control-hover);
}

.nav-icon-btn svg {
  width: 18px;
  height: 18px;
}

.nav-bell__dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 7px;
  height: 7px;
  border: 1.5px solid var(--nav-bg-start);
  border-radius: 50%;
  background: #ff5b68;
}

.account-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #f4f7fc;
  color: #58749a;
  cursor: pointer;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
  transition: box-shadow var(--duration) var(--ease);
}

.account-btn:hover {
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.18);
}

.account-btn svg {
  width: 20px;
  height: 20px;
}

.account-menu-icon {
  width: 14px;
  height: 14px;
  margin-right: 6px;
  color: var(--text-3);
}

.notice-pop__head {
  font-size: 13px;
  font-weight: 650;
  color: var(--text);
  margin-bottom: 6px;
}

.notice-pop__empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--text-2);
}

.mobile-menu {
  display: none;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-left: 10px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--nav-text);
  cursor: pointer;
}

.mobile-menu:hover {
  background: var(--nav-control-hover);
}

.mobile-menu svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 1280px) {
  .module-tab {
    padding: 0 14px;
  }

  .topbar-actions {
    padding-right: 14px;
    gap: 8px;
  }
}

@media (max-width: 1140px) {
  .nav-search {
    width: 190px;
  }
}

@media (max-width: 1100px) {
  .module-tab {
    padding: 0 12px;
  }

  .module-tab__label {
    display: none;
  }
}

@media (max-width: 1024px) {
  .mobile-menu {
    display: grid;
  }

  .brand {
    flex-basis: auto;
    width: auto;
    padding-left: 10px;
  }
}

@media (max-width: 900px) {
  .brand__copy {
    display: none;
  }

  .module-tab {
    padding: 0 12px;
  }

  .module-tab__label {
    display: none;
  }

  .nav-search {
    width: 166px;
  }
}

@media (max-width: 640px) {
  .topbar-inner {
    gap: 2px;
  }

  .nav-search {
    width: 36px;
    padding: 0;
    justify-content: center;
  }

  .nav-search__text {
    display: none;
  }

  .topbar-actions {
    gap: 2px;
    padding-right: 8px;
  }
}
</style>
