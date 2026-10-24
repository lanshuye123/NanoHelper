<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-vue-next'
import { NAV_MODULES, docNavGroups, moduleByKey, moduleForPath } from '@/config/navigation'
import UiInput from '@/components/ui/UiInput.vue'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settings = useSettingsStore()
const query = ref('')

const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'

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

function isItemActive(path: string): boolean {
  const [pathname, hash] = path.split('#')
  if (pathname !== route.path) return false
  if (hash) return route.hash === `#${hash}`
  return !route.hash
}

function isDocActive(section: string, slug: string): boolean {
  return route.params.section === section && route.params.slug === slug
}

watch(
  () => route.fullPath,
  () => {
    query.value = ''
  },
)
</script>

<template>
  <aside
    class="app-sidebar"
    :class="{ 'is-collapsed': settings.sidebarCollapsed, 'is-open': settings.mobileNavOpen }"
    :style="{ '--module-accent': activeModule.accent }"
  >
    <header class="sidebar-head">
      <span class="sidebar-head__icon">
        <component :is="activeModule.icon" />
      </span>
      <span class="sidebar-head__copy">
        <span class="sidebar-head__label">{{ activeModule.label }}</span>
        <span class="sidebar-head__desc">{{ activeModule.description }}</span>
      </span>
    </header>

    <div v-if="isDocs" class="sidebar-search">
      <UiInput v-model="query" type="search" placeholder="搜索文档…" size="sm">
        <template #prefix><Search /></template>
      </UiInput>
    </div>

    <nav class="sidebar-nav" :aria-label="`${activeModule.label}导航`">
      <template v-if="isDocs">
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
          :class="{ 'is-active': isItemActive(item.path) }"
          :title="item.description"
        >
          <component :is="item.icon" class="nav-item__icon" />
          <span class="nav-item__label">{{ item.label }}</span>
          <span v-if="item.index" class="nav-item__index mono">{{ item.index }}</span>
        </RouterLink>

        <p v-if="activeModule.items.length" class="sidebar-hint">
          共 {{ activeModule.items.length }} 个页面 · 顶部切换模块
        </p>
      </template>
    </nav>

    <footer class="sidebar-foot">
      <button
        class="collapse-btn"
        type="button"
        :title="settings.sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
        :aria-label="settings.sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
        @click="settings.toggleSidebar()"
      >
        <PanelLeftOpen v-if="settings.sidebarCollapsed" />
        <PanelLeftClose v-else />
        <span v-if="!settings.sidebarCollapsed">收起</span>
      </button>
      <span v-if="!settings.sidebarCollapsed" class="sidebar-version mono">v{{ version }}</span>
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
  background: var(--surface);
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
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 62px;
  padding: 12px 14px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border-soft);
  color: var(--text);
}

.sidebar-head__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--module-accent) 12%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--module-accent) 26%, transparent);
  color: var(--module-accent);
}

.sidebar-head__icon svg {
  width: 17px;
  height: 17px;
}

.sidebar-head__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sidebar-head__label {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-head__desc {
  font-size: 10.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ------------------------------------------------------------- search */

.sidebar-search {
  position: relative;
  flex: 0 0 auto;
  padding: 10px 10px 4px;
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
  height: 30px;
  padding: 0 9px 0 27px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 11.5px;
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
  padding: 10px 8px 12px;
  scrollbar-gutter: stable;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 36px;
  padding: 7px 9px;
  margin-bottom: 2px;
  border-left: 3px solid transparent;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 500;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease),
    border-color var(--duration) var(--ease);
}

.nav-item:hover {
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
}

.nav-item.is-active {
  background: var(--accent-soft);
  border-left-color: var(--module-accent);
  color: var(--text);
  font-weight: 650;
}

.nav-item__icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  color: var(--text-3);
}

.nav-item.is-active .nav-item__icon {
  color: var(--module-accent);
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
  font-size: 9.5px;
  color: var(--text-3);
}

.nav-item.is-active .nav-item__index {
  color: var(--module-accent);
}

.nav-item--doc {
  min-height: 31px;
  padding: 5px 9px 5px 12px;
  font-size: 12px;
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
  letter-spacing: 0.1em;
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
  font-size: 11.5px;
  color: var(--text-3);
}

.sidebar-hint {
  margin: 14px 10px 0;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 10px;
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
  background: var(--surface-2);
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
    color var(--duration) var(--ease);
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
}

/* ------------------------------------------------------------- mobile drawer */

@media (max-width: 1024px) {
  .app-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 60;
    width: min(280px, 84vw);
    flex-basis: auto;
    border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
    transform: translateX(-102%);
    transition: transform var(--duration-slow) var(--ease);
    box-shadow: var(--shadow);
  }

  .app-sidebar.is-collapsed {
    width: min(280px, 84vw);
  }

  .app-sidebar.is-open {
    transform: translateX(0);
  }

  .sidebar-foot {
    display: none;
  }
}

/* ------------------------------------------------------------- collapsed */

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

.is-collapsed .sidebar-foot {
  justify-content: center;
  padding: 7px 0;
}

.is-collapsed .collapse-btn {
  padding: 0;
  width: 27px;
  justify-content: center;
}
</style>
