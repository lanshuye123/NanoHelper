import { ref } from 'vue'

const open = ref(false)
const query = ref('')

export function useQuickSearch() {
  function openSearch() {
    query.value = ''
    open.value = true
  }

  function closeSearch() {
    open.value = false
    query.value = ''
  }

  function toggleSearch() {
    if (open.value) closeSearch()
    else openSearch()
  }

  return { open, query, openSearch, closeSearch, toggleSearch }
}
