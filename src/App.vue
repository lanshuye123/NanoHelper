<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import GlobalSearch from '@/components/layout/GlobalSearch.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settings = useSettingsStore()
const isHome = computed(() => route.meta.module === 'home')
</script>

<template>
  <div class="app-shell" :class="{ 'is-home': isHome, 'is-collapsed': settings.sidebarCollapsed && !isHome }">
    <AppTopbar />

    <div class="app-body">
      <AppSidebar v-if="!isHome" />
      <main class="app-content" :class="{ 'is-home': isHome }">
        <RouterView v-slot="{ Component, route: currentRoute }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="currentRoute.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <StatusBar />
    <GlobalSearch />
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
}

.app-body {
  flex: 1;
  display: flex;
  gap: var(--shell-gap);
  min-height: 0;
  padding: var(--shell-gap);
  overflow: hidden;
}

.app-content {
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
  z-index: 35;
  background: var(--overlay);
  backdrop-filter: blur(2px);
}

.page-enter-active,
.page-leave-active {
  transition:
    opacity 0.16s var(--ease),
    transform 0.16s var(--ease);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-3px);
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
    background: var(--surface);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
}
</style>
