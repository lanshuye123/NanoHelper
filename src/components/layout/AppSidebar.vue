<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { PanelLeftClose, PanelLeftOpen, Pencil, Search } from 'lucide-vue-next'
import { NAV_MODULES, docNavGroups, moduleByKey, moduleForPath } from '@/config/navigation'
import UiInput from '@/components/ui/UiInput.vue'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import { formatSavedAt } from '@/utils/persist'

const route = useRoute()
const settings = useSettingsStore()
const project = useProjectStore()
const query = ref('')
const isMobileNav = ref(false)
let mobileQuery: MediaQueryList | null = null

const activeModule = computed(() => {
  const key = route.meta.module as string | undefined
  return key ? moduleByKey(key) : moduleForPath(route.path)
})

const isDocs = computed(() => activeModule.value.key === 'docs')

const SECTION_LABELS: Record<string, string> = {
  data: 'XRD 数据处理',
  diffraction: '衍射与谱图模拟',
  crystal: '晶体几何与结构',
  micro: '显微分析工具',
  docs: '文档目录',
  about: '工具说明',
}

const activeSectionLabel = computed(() => SECTION_LABELS[activeModule.value.key] ?? activeModule.value.label)

const visibleModules = computed(() => NAV_MODULES.filter((module) => module.key !== 'home'))

const projectStatus = computed(() => {
  if (!project.derived) return 'idle'
  if (project.issues.some((issue) => issue.level === 'error')) return 'error'
  if (project.issues.some((issue) => issue.level === 'warning')) return 'warn'
  return 'ok'
})

const savedText = computed(() => (project.persistedAt ? formatSavedAt(project.persistedAt) : ''))

const collapseLabel = computed(() => {
  if (isMobileNav.value) return '关闭导航'
  return settings.sidebarCollapsed ? '展开侧栏' : '收起侧栏'
})

function toggleSidebar() {
  if (isMobileNav.value) settings.mobileNavOpen = false
  else settings.toggleSidebar()
}

function syncMobileNav(event: MediaQueryListEvent | MediaQueryList) {
  isMobileNav.value = event.matches
}

onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 1024px)')
  syncMobileNav(mobileQuery)
  mobileQuery.addEventListener('change', syncMobileNav)
})

onBeforeUnmount(() => {
  mobileQuery?.removeEventListener('change', syncMobileNav)
})

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
      <span class="sidebar-head__label">{{ activeModule.label }}</span>
      <button
        class="collapse-btn"
        type="button"
        :title="collapseLabel"
        :aria-label="collapseLabel"
        @click="toggleSidebar()"
      >
        <PanelLeftOpen v-if="settings.sidebarCollapsed" />
        <PanelLeftClose v-else />
      </button>
    </header>

    <div v-if="isDocs" class="sidebar-search">
      <UiInput v-model="query" type="search" placeholder="搜索文档…" size="sm">
        <template #prefix><Search /></template>
      </UiInput>
    </div>

    <div class="sidebar-scroll">
      <nav class="sidebar-nav" aria-label="模块导航">
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
              :class="{ 'is-active': route.params.section === doc.section && route.params.slug === doc.slug }"
            >
              <span class="nav-item__label">{{ doc.title }}</span>
            </RouterLink>
          </div>
          <p v-if="!filteredDocGroups.length" class="sidebar-empty">没有匹配的文档</p>
        </template>

        <details
          v-for="module in visibleModules"
          v-else
          :key="module.key"
          class="side-group"
          :class="{ 'is-active': module.key === activeModule.key }"
          :open="module.key === activeModule.key"
        >
          <summary class="side-group__label">
            <component :is="module.icon" />
            <span class="side-group__name">
              {{ module.key === activeModule.key ? activeSectionLabel : module.label }}
            </span>
            <span class="side-group__chevron" aria-hidden="true">⌄</span>
          </summary>

          <div class="side-group__items">
            <RouterLink
              v-for="item in module.items"
              :key="item.id"
              :to="item.path"
              class="nav-item"
              :class="{ 'is-active': isItemActive(item.path) }"
              :title="item.description"
            >
              <component :is="item.icon" class="nav-item__icon" />
              <span class="nav-item__label">{{ item.label }}</span>
            </RouterLink>
          </div>
        </details>
      </nav>
    </div>

    <div class="side-project">
      <div class="side-project__title">当前项目</div>
      <RouterLink v-if="project.hasData" to="/data/import" class="side-project__card">
        <div class="side-project__row">
          <span class="side-project__dot" :class="`is-${projectStatus}`" />
          <span class="side-project__name">{{ project.source?.name ?? '未命名数据' }}</span>
          <Pencil class="side-project__edit" />
        </div>
        <div class="side-project__meta">
          {{ savedText ? `最近保存 ${savedText}` : '数据已载入' }}
        </div>
      </RouterLink>
      <RouterLink v-else to="/data/import" class="side-project__empty">
        暂无数据，从 XRD 数据预处理开始
      </RouterLink>
    </div>
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
  border-right: 1px solid var(--border);
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
  height: 48px;
  padding: 0 16px;
  color: var(--text-2);
}

.sidebar-head__icon {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  color: var(--text-2);
}

.sidebar-head__icon svg {
  width: 19px;
  height: 19px;
}

.sidebar-head__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13.5px;
  font-weight: 550;
  color: var(--text-2);
}

.collapse-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.collapse-btn:hover {
  background: var(--surface-2);
  color: var(--text-2);
}

.collapse-btn svg {
  width: 16px;
  height: 16px;
}

/* ------------------------------------------------------------- search */

.sidebar-search {
  flex: 0 0 auto;
  padding: 2px 12px 10px;
}

/* ------------------------------------------------------------- nav */

.sidebar-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}

.sidebar-nav {
  padding: 4px 10px 14px;
}

.side-group {
  margin-bottom: 2px;
}

.side-group__label {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 10px;
  border-left: 3px solid transparent;
  border-radius: 0 9px 9px 0;
  color: var(--text-2);
  font-size: 13.5px;
  font-weight: 550;
  cursor: pointer;
  list-style: none;
  user-select: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.side-group__label::-webkit-details-marker {
  display: none;
}

.side-group__label:hover {
  background: var(--surface-2);
  color: var(--text);
}

.side-group__label svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  color: var(--text-2);
}

.side-group__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-group__chevron {
  flex: 0 0 auto;
  font-size: 15px;
  line-height: 1;
  color: var(--text-3);
  transform: rotate(-90deg);
  transition: transform var(--duration) var(--ease);
}

.side-group[open] .side-group__chevron {
  transform: rotate(0);
}

.side-group.is-active > .side-group__label {
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  color: var(--accent);
  font-weight: 650;
}

.side-group.is-active > .side-group__label svg {
  color: var(--accent);
}

.side-group__items {
  padding: 2px 0 6px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  margin: 2px 0 2px 20px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 450;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.nav-item:hover {
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
}

.nav-item.is-active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.nav-item__icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: var(--text-3);
}

.nav-item.is-active .nav-item__icon {
  color: var(--accent);
}

.nav-item__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item--doc {
  margin-left: 10px;
  min-height: 32px;
  padding-left: 12px;
  font-size: 12.5px;
}

.docs-group + .docs-group {
  margin-top: 10px;
}

.docs-group__label {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.11em;
  color: var(--text-3);
}

.docs-group__label svg {
  width: 12px;
  height: 12px;
  color: var(--accent);
}

.sidebar-empty {
  margin: 14px 10px;
  font-size: 11.5px;
  color: var(--text-3);
}

/* ------------------------------------------------------------- project */

.side-project {
  flex: 0 0 auto;
  padding: 12px;
  border-top: 1px solid var(--border-soft);
}

.side-project__title {
  margin: 0 10px 7px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}

.side-project__card {
  display: block;
  padding: 11px 12px;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  background: var(--surface-2);
  text-decoration: none;
  transition:
    border-color var(--duration) var(--ease),
    background var(--duration) var(--ease);
}

.side-project__card:hover {
  border-color: var(--accent-line);
  background: var(--surface);
  text-decoration: none;
}

.side-project__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.side-project__dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--border-strong);
}

.side-project__dot.is-ok {
  background: var(--accent);
}

.side-project__dot.is-warn {
  background: var(--warn);
}

.side-project__dot.is-error {
  background: var(--danger);
}

.side-project__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.side-project__edit {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  color: var(--text-3);
}

.side-project__meta {
  margin-top: 5px;
  padding-left: 16px;
  font-size: 10.5px;
  color: var(--text-3);
}

.side-project__empty {
  display: block;
  padding: 11px 12px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  color: var(--text-3);
  font-size: 11.5px;
  line-height: 1.55;
  text-decoration: none;
}

.side-project__empty:hover {
  border-color: var(--accent-line);
  color: var(--accent);
  text-decoration: none;
}

/* ------------------------------------------------------------- collapsed */

.is-collapsed .sidebar-head {
  justify-content: center;
  padding: 0;
}

.is-collapsed .sidebar-head__label,
.is-collapsed .sidebar-head__icon,
.is-collapsed .sidebar-search,
.is-collapsed .side-group__chevron,
.is-collapsed .side-project {
  display: none;
}

.is-collapsed .collapse-btn {
  display: grid;
}

.is-collapsed .sidebar-nav {
  padding: 8px 8px;
}

.is-collapsed .side-group__label {
  justify-content: center;
  min-height: 40px;
  padding: 0;
  border-left-width: 0;
  border-radius: 8px;
}

.is-collapsed .side-group__name {
  display: none;
}

.is-collapsed .nav-item {
  justify-content: center;
  margin-left: 0;
  padding: 0;
}

.is-collapsed .nav-item__label {
  display: none;
}

/* ------------------------------------------------------------- mobile */

@media (max-width: 1024px) {
  .app-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 60;
    width: min(288px, 84vw);
    flex-basis: auto;
    border-right: 1px solid var(--border);
    transform: translateX(-102%);
    transition: transform var(--duration-slow) var(--ease);
    box-shadow: var(--shadow);
  }

  .app-sidebar.is-collapsed {
    width: min(288px, 84vw);
  }

  .app-sidebar.is-open {
    transform: translateX(0);
  }

  .is-collapsed .sidebar-head {
    justify-content: flex-start;
    padding: 0 16px;
  }

  .is-collapsed .sidebar-head__label,
  .is-collapsed .sidebar-head__icon,
  .is-collapsed .collapse-btn,
  .is-collapsed .sidebar-search,
  .is-collapsed .side-group__chevron,
  .is-collapsed .side-project {
    display: flex;
  }

  .is-collapsed .sidebar-head__label {
    display: block;
  }

  .is-collapsed .collapse-btn {
    display: grid;
  }

  .is-collapsed .side-group__name,
  .is-collapsed .nav-item__label {
    display: inline;
  }

  .is-collapsed .side-group__label {
    justify-content: flex-start;
    padding: 0 10px;
  }

  .is-collapsed .nav-item {
    justify-content: flex-start;
    margin-left: 20px;
    padding: 0 10px;
  }
}
</style>
