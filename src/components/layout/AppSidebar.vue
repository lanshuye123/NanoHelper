<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-vue-next'
import { NAV_MODULES, docNavGroups, moduleByKey, moduleForPath } from '@/config/navigation'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settings = useSettingsStore()
const query = ref('')
const isMobile = ref(false)
let mediaQuery: MediaQueryList | undefined

function syncMobile(event?: MediaQueryListEvent) {
  isMobile.value = event ? event.matches : Boolean(mediaQuery?.matches)
}

const collapsed = computed(() => settings.sidebarCollapsed && !isMobile.value)

const activeModule = computed(() => {
  const key = route.meta.module as string | undefined
  return key ? moduleByKey(key) : moduleForPath(route.path)
})

const isDocs = computed(() => activeModule.value.key === 'docs')

const filteredDocGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return docNavGroups
  return docNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((doc) =>
        [doc.title, doc.description, ...(doc.keywords ?? [])].join(' ').toLowerCase().includes(q),
      ),
    }))
    .filter((group) => group.items.length > 0)
})

const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'

function isItemActive(path: string): boolean {
  const [pathname, hash] = path.split('#')
  if (pathname !== route.path) return false
  if (hash) return route.hash === `#${hash}`
  return !route.hash
}

function isDocActive(section: string, slug: string): boolean {
  return route.params.section === section && route.params.slug === slug
}

function closeMobileNav() {
  settings.mobileNavOpen = false
}

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 900px)')
  syncMobile()
  mediaQuery.addEventListener('change', syncMobile)
})

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', syncMobile)
})

watch(
  () => route.fullPath,
  () => {
    settings.mobileNavOpen = false
    query.value = ''
  },
)
</script>

<template>
  <aside
    class="app-sidebar"
    :class="{ 'is-collapsed': collapsed, 'is-open': settings.mobileNavOpen }"
    :style="{ '--module-accent': activeModule.accent }"
  >
    <header class="sidebar-head">
      <span class="sidebar-head__icon">
        <component :is="activeModule.icon" />
      </span>
      <span v-if="!collapsed" class="sidebar-head__copy">
        <span class="sidebar-head__label">{{ activeModule.label }}</span>
        <span class="sidebar-head__desc">{{ activeModule.description }}</span>
      </span>
      <button class="sidebar-close" type="button" title="关闭导航" aria-label="关闭导航" @click="closeMobileNav">
        <X />
      </button>
      <svg v-if="!collapsed" class="sidebar-head__lattice" viewBox="0 0 120 80" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="0.8">
          <path d="M18 48 46 32l30 16-28 18Z" opacity="0.5" />
          <path d="M46 32V12l30 16v20" opacity="0.38" />
          <path d="M76 48 104 32v22L76 72Z" opacity="0.3" />
          <path d="M18 48v22l28 16 30-18" opacity="0.22" />
        </g>
        <g fill="currentColor">
          <circle cx="46" cy="32" r="1.6" opacity="0.55" />
          <circle cx="76" cy="48" r="1.6" opacity="0.55" />
          <circle cx="46" cy="12" r="1.4" opacity="0.4" />
          <circle cx="76" cy="16" r="1.4" opacity="0.4" />
        </g>
      </svg>
    </header>

    <div v-if="isDocs && !collapsed" class="sidebar-search">
      <Search class="sidebar-search__icon" />
      <input v-model="query" type="search" placeholder="搜索文档…" aria-label="搜索文档" />
    </div>

    <nav class="sidebar-nav" :aria-label="`${activeModule.label}导航`">
      <!-- Docs module: grouped document list -->
      <template v-if="isDocs">
        <template v-if="!collapsed">
          <div v-for="group in filteredDocGroups" :key="group.key" class="docs-group">
            <div class="docs-group__label">
              <component :is="group.icon" />
              <span>{{ group.label }}</span>
            </div>
            <RouterLink
              v-for="doc in group.items"
              :key="doc.path"
              :to="doc.path"
              class="nav-item nav-item--doc"
              :class="{ 'is-active': isDocActive(doc.section, doc.slug) }"
              :title="doc.description"
              @click="closeMobileNav"
            >
              <span class="nav-item__label">{{ doc.title }}</span>
            </RouterLink>
          </div>
          <p v-if="!filteredDocGroups.length" class="sidebar-empty">没有匹配的文档</p>
        </template>
        <template v-else>
          <RouterLink
            v-for="item in activeModule.items"
            :key="item.id"
            :to="item.path"
            class="nav-item"
            :class="{ 'is-active': route.params.section === item.id }"
            :title="item.label"
            @click="closeMobileNav"
          >
            <component :is="item.icon" class="nav-item__icon" />
          </RouterLink>
        </template>
      </template>

      <!-- Tool modules: one entry per page -->
      <template v-else>
        <RouterLink
          v-for="item in activeModule.items"
          :key="item.id"
          :to="item.path"
          class="nav-item"
          :class="{ 'is-active': isItemActive(item.path) }"
          :title="collapsed ? item.label : item.description"
          @click="closeMobileNav"
        >
          <component :is="item.icon" class="nav-item__icon" />
          <span v-if="!collapsed" class="nav-item__label">{{ item.label }}</span>
          <span v-if="!collapsed && item.index" class="nav-item__index mono">{{ item.index }}</span>
          <span v-if="!collapsed && item.badge" class="nav-item__badge">{{ item.badge }}</span>
        </RouterLink>

        <div v-if="!collapsed && activeModule.items.length" class="sidebar-hint">
          共 {{ activeModule.items.length }} 个页面 · 顶部切换模块
        </div>
      </template>
    </nav>

    <footer class="sidebar-foot">
      <button
        class="collapse-btn"
        type="button"
        :title="collapsed ? '展开侧栏' : '收起侧栏'"
        :aria-label="collapsed ? '展开侧栏' : '收起侧栏'"
        @click="settings.toggleSidebar()"
      >
        <PanelLeftOpen v-if="collapsed" />
        <PanelLeftClose v-else />
        <span v-if="!collapsed">收起</span>
      </button>
      <span v-if="!collapsed" class="sidebar-version mono">v{{ version }}</span>
    </footer>
  </aside>
</template>

<style scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--sidebar-w);
  width: var(--sidebar-w);
  min-height: 0;
  background: var(--sidebar-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition:
    width var(--duration) var(--ease),
    flex-basis var(--duration) var(--ease);
}

.app-sidebar.is-collapsed {
  flex-basis: var(--sidebar-w-collapsed);
  width: var(--sidebar-w-collapsed);
}

/* ------------------------------------------------------------- header */

.sidebar-head {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 66px;
  padding: 14px 14px 13px;
  background:
    radial-gradient(180px 80px at 100% 0%, color-mix(in srgb, var(--module-accent) 14%, transparent), transparent 72%),
    linear-gradient(140deg, var(--sidebar-header-start), var(--sidebar-header-end));
  border-bottom: 1px solid var(--border-soft);
  color: var(--sidebar-header-text);
  overflow: hidden;
}

.sidebar-head__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--module-accent) 14%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--module-accent) 28%, transparent);
  color: var(--module-accent);
  box-shadow: 0 1px 3px rgba(21, 62, 99, 0.08);
}

.sidebar-head__icon svg {
  width: 18px;
  height: 18px;
}

.sidebar-head__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sidebar-head__label {
  font-size: 15px;
  font-weight: 720;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-head__desc {
  font-size: 10px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-close {
  display: none;
  position: absolute;
  top: 10px;
  right: 10px;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-3);
  cursor: pointer;
}

.sidebar-close svg {
  width: 13px;
  height: 13px;
}

.sidebar-head__lattice {
  position: absolute;
  right: -20px;
  bottom: -18px;
  width: 122px;
  height: 84px;
  color: var(--module-accent);
  opacity: 0.14;
  pointer-events: none;
}

/* ------------------------------------------------------------- search */

.sidebar-search {
  position: relative;
  flex: 0 0 auto;
  padding: 10px 10px 2px;
}

.sidebar-search__icon {
  position: absolute;
  top: 19px;
  left: 20px;
  width: 12px;
  height: 12px;
  color: var(--text-3);
  pointer-events: none;
}

.sidebar-search input {
  width: 100%;
  height: 29px;
  padding: 0 9px 0 27px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 11px;
  outline: none;
}

.sidebar-search input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.sidebar-search input::placeholder {
  color: var(--text-3);
}

.sidebar-search input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

/* ------------------------------------------------------------- nav */

.sidebar-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 9px 8px 12px;
  scrollbar-gutter: stable;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 35px;
  padding: 7px 9px;
  margin-bottom: 2px;
  border-left: 3px solid transparent;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--sidebar-item-text);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease),
    border-color var(--duration) var(--ease);
}

.nav-item:hover {
  background: var(--sidebar-item-hover);
  color: var(--sidebar-item-active-text);
  text-decoration: none;
}

.nav-item.is-active {
  background: var(--sidebar-item-active);
  border-left-color: var(--module-accent);
  color: var(--sidebar-item-active-text);
  font-weight: 650;
}

.nav-item__icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  opacity: 0.8;
}

.nav-item.is-active .nav-item__icon {
  color: var(--module-accent);
  opacity: 1;
}

.nav-item__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item__index {
  flex: 0 0 auto;
  font-size: 9px;
  color: var(--text-3);
  letter-spacing: 0.02em;
}

.nav-item.is-active .nav-item__index {
  color: var(--module-accent);
}

.nav-item__badge {
  flex: 0 0 auto;
  padding: 0 4px;
  border: 1px solid var(--accent-line);
  border-radius: var(--radius-xs);
  color: var(--accent);
  font-size: 8px;
  line-height: 13px;
}

.nav-item--doc {
  min-height: 31px;
  padding: 5px 9px 5px 12px;
  font-size: 11.5px;
}

.docs-group + .docs-group {
  margin-top: 12px;
}

.docs-group__label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px 5px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.docs-group__label svg {
  width: 11px;
  height: 11px;
  color: var(--module-accent);
}

.sidebar-empty {
  margin: 14px 10px;
  font-size: 11px;
  color: var(--text-3);
}

.sidebar-hint {
  margin: 14px 10px 0;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 9.5px;
  line-height: 1.6;
  color: var(--text-3);
}

/* ------------------------------------------------------------- footer */

.sidebar-foot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
  padding: 7px 10px;
  border-top: 1px solid var(--border-soft);
  background: color-mix(in srgb, var(--surface-2) 55%, transparent);
}

.collapse-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 27px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-3);
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease),
    border-color var(--duration) var(--ease);
}

.collapse-btn:hover {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text);
}

.collapse-btn svg {
  width: 14px;
  height: 14px;
}

.sidebar-version {
  font-size: 9.5px;
  color: var(--text-3);
  letter-spacing: 0.02em;
}

/* ------------------------------------------------------------- collapsed rail */

.is-collapsed .sidebar-head {
  justify-content: center;
  padding: 12px 0;
}

.is-collapsed .sidebar-nav {
  padding: 9px 6px;
}

.is-collapsed .nav-item {
  justify-content: center;
  padding: 7px 0;
  border-left-width: 0;
  border-radius: var(--radius-sm);
}

.is-collapsed .nav-item.is-active {
  border-left-width: 0;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--module-accent) 30%, transparent);
}

.is-collapsed .sidebar-foot {
  justify-content: center;
  padding: 7px 0;
}

.is-collapsed .collapse-btn {
  padding: 0;
  width: 27px;
  justify-content: center;
}

/* ------------------------------------------------------------- mobile drawer */

@media (max-width: 900px) {
  .app-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 50;
    width: min(300px, 86vw);
    flex-basis: auto;
    border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
    transform: translateX(-102%);
    transition: transform 0.22s var(--ease);
    box-shadow: var(--shadow);
  }

  .app-sidebar.is-open {
    transform: translateX(0);
  }

  .sidebar-close {
    display: grid;
  }

  .sidebar-foot {
    display: none;
  }

  .sidebar-nav {
    padding-bottom: 24px;
  }
}
</style>
