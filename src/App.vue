<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <div class="app-shell" :class="{ 'is-collapsed': settings.sidebarCollapsed }">
    <AppSidebar />
    <div class="app-main">
      <AppTopbar />
      <main class="app-content">
        <RouterView v-slot="{ Component, route }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>
    <StatusBar />
    <div v-if="settings.mobileNavOpen" class="nav-overlay" @click="settings.mobileNavOpen = false" />
  </div>
</template>

<style scoped>
.app-shell > :deep(.app-sidebar) {
  grid-column: 1;
  grid-row: 1 / span 2;
}

.app-main {
  grid-column: 2;
  grid-row: 1;
}

.app-shell > :deep(.status-bar) {
  grid-column: 2;
  grid-row: 2;
}

.nav-overlay {
  position: fixed;
  inset: 0;
  z-index: 15;
  background: rgba(2, 6, 15, 0.55);
  backdrop-filter: blur(2px);
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (max-width: 900px) {
  .app-shell,
  .app-shell.is-collapsed {
    grid-template-columns: minmax(0, 1fr);
  }

  .app-main {
    grid-column: 1;
  }

  .app-shell > :deep(.status-bar) {
    grid-column: 1;
  }
}
</style>
