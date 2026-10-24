<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import CommandPalette from '@/components/layout/CommandPalette.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'

const route = useRoute()
const settings = useSettingsStore()
const project = useProjectStore()
/** The home page uses the full canvas; tools and docs get the module sidebar. */
const isHome = computed(() => route.path === '/' || route.meta.module === 'home')

onMounted(() => {
  void project.restorePersisted()
})

watch(
  () => route.fullPath,
  () => {
    settings.mobileNavOpen = false
  },
)
</script>

<template>
  <div class="app-shell">
    <AppTopbar />

    <div class="app-body">
      <AppSidebar v-if="!isHome" />
      <main class="app-content" :class="{ 'is-home': isHome }">
        <div class="app-deco" aria-hidden="true">
          <svg viewBox="0 0 240 240" class="app-deco__shape">
            <path d="M120 14 L214 68 L214 172 L120 226 L26 172 L26 68 Z" />
            <path d="M120 68 L167 95 L167 145 L120 172 L73 145 L73 95 Z" />
            <path d="M26 68 L73 95 M214 68 L167 95 M120 14 L120 68" />
          </svg>
        </div>
        <RouterView v-slot="{ Component, route: currentRoute }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="currentRoute.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <StatusBar />
    <CommandPalette />
    <div v-if="settings.mobileNavOpen" class="nav-overlay" @click="settings.mobileNavOpen = false" />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background: var(--bg);
}

.app-body {
  flex: 1;
  display: flex;
  gap: 10px;
  min-height: 0;
  padding: 10px;
  overflow: hidden;
}

.app-content {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  scrollbar-gutter: stable;
}

.app-deco {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.app-deco__shape {
  position: absolute;
  right: -60px;
  bottom: -70px;
  width: 420px;
  height: 420px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 0.6;
  opacity: 0.06;
}

.app-main {
  position: relative;
  z-index: 1;
}

.app-content.is-home {
  background: transparent;
  border-color: transparent;
  border-radius: 0;
  box-shadow: none;
  scrollbar-gutter: auto;
}

.nav-overlay {
  position: fixed;
  inset: 0;
  z-index: 55;
  background: var(--overlay);
}

.page-enter-active,
.page-leave-active {
  transition: opacity var(--duration) var(--ease);
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .app-body {
    padding: 0;
    gap: 0;
  }

  .app-content {
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
}
</style>
