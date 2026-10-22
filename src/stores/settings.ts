import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'dark' | 'light'

function readTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem('ctb.theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return 'dark'
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('ctb.sidebar') === 'collapsed'
  } catch {
    return false
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(readTheme())
  const sidebarCollapsed = ref(readCollapsed())
  const mobileNavOpen = ref(false)

  function applyTheme() {
    document.documentElement.dataset.theme = theme.value
    document.documentElement.classList.toggle('dark', theme.value === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme.value === 'dark' ? '#070b14' : '#f4f7fc')
    try {
      localStorage.setItem('ctb.theme', theme.value)
    } catch {
      /* ignore */
    }
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function toggleMobileNav() {
    mobileNavOpen.value = !mobileNavOpen.value
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    try {
      localStorage.setItem('ctb.sidebar', sidebarCollapsed.value ? 'collapsed' : 'expanded')
    } catch {
      /* ignore */
    }
  }

  watch(theme, applyTheme, { immediate: true })

  return { theme, sidebarCollapsed, mobileNavOpen, toggleTheme, toggleSidebar, toggleMobileNav, applyTheme }
})
