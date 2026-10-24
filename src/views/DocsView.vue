<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, BookOpen, Menu, Search } from 'lucide-vue-next'
import { docPath, docsBySection, getDoc, prevNext, sectionLabel, type DocEntry } from '@/docs/manifest'
import { docNavGroups } from '@/config/navigation'
import UiInput from '@/components/ui/UiInput.vue'
import { loadDocSource, renderDoc, type Heading } from '@/docs/render'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()

const html = ref('')
const headings = ref<Heading[]>([])
const loading = ref(false)
const error = ref('')
const activeHeading = ref('')
const docQuery = ref('')

const current = computed(() =>
  getDoc(route.params.section as string | undefined, route.params.slug as string | undefined),
)
const section = computed(() => (current.value ? sectionLabel(current.value.section) : ''))
const neighbours = computed(() => (current.value ? prevNext(current.value) : {}))

async function loadDoc(doc: DocEntry) {
  loading.value = true
  error.value = ''
  html.value = ''
  headings.value = []
  try {
    const source = await loadDocSource(doc.file)
    const rendered = renderDoc(source, doc.file)
    html.value = rendered.html
    headings.value = rendered.headings
    await nextTick()
    window.scrollTo({ top: 0 })
    setActiveHeading()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

watch(
  current,
  (doc) => {
    if (doc) void loadDoc(doc)
    else {
      const first = docsBySection('userguide')[0]
      if (first) router.replace(docPath(first))
    }
  },
  { immediate: true },
)

const filteredDocGroups = computed(() => {
  const q = docQuery.value.trim().toLowerCase()
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

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function setActiveHeading() {
  if (!headings.value.length) return
  const top = 90
  let active = ''
  for (const heading of headings.value) {
    const el = document.getElementById(heading.id)
    if (!el) continue
    if (el.getBoundingClientRect().top <= top) active = heading.id
    else break
  }
  activeHeading.value = active || headings.value[0]?.id || ''
}

function onScroll() {
  setActiveHeading()
}

function onProseClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const copy = target.closest('[data-copy]')
  if (copy) {
    const code = copy.parentElement?.querySelector('code')?.textContent ?? ''
    navigator.clipboard
      .writeText(code)
      .then(() => ElMessage.success('代码已复制'))
      .catch(() => ElMessage.error('复制失败'))
    return
  }
  const anchor = target.closest('a')
  if (!anchor) return
  const href = anchor.getAttribute('href') ?? ''
  if (href.startsWith('#/')) return // let the hash router handle it
  if (href.startsWith('#')) {
    event.preventDefault()
    scrollTo(href.slice(1))
  }
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  setActiveHeading()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="docs-page">
    <aside class="docs-nav" aria-label="文档目录">
      <div class="docs-nav__search">
        <UiInput v-model="docQuery" type="search" placeholder="搜索文档…" size="sm">
          <template #prefix><Search /></template>
        </UiInput>
      </div>
      <nav class="docs-nav__list">
        <details
          v-for="group in filteredDocGroups"
          :key="group.key"
          class="docs-nav__group"
          :open="
            group.items.some((doc) => doc.section === route.params.section && doc.slug === route.params.slug) ||
            group.key === 'userguide'
          "
        >
          <summary class="docs-nav__group-label">
            <component :is="group.icon" />
            <span>{{ group.label }}</span>
          </summary>
          <RouterLink
            v-for="doc in group.items"
            :key="doc.path"
            :to="doc.path"
            class="docs-nav__item"
            :class="{ 'is-active': route.params.section === doc.section && route.params.slug === doc.slug }"
          >
            {{ doc.title }}
          </RouterLink>
        </details>
        <p v-if="!filteredDocGroups.length" class="docs-nav__empty">没有匹配的文档</p>
      </nav>
    </aside>

    <article v-if="current" class="docs-article">
      <header class="docs-head">
        <button class="docs-nav-toggle" type="button" @click="settings.toggleMobileNav()">
          <Menu />
          <span>目录</span>
        </button>
        <nav class="docs-crumb" aria-label="面包屑">
          <RouterLink to="/">首页</RouterLink>
          <span class="crumb-sep">/</span>
          <span>{{ section }}</span>
        </nav>
        <h1>{{ current.title }}</h1>
        <p>{{ current.description }}</p>
        <div class="docs-meta">
          <span class="chip chip--mono">{{ current.section }}/{{ current.slug }}</span>
        </div>
      </header>

      <div v-if="loading" class="docs-loading">正在加载文档…</div>
      <div v-else-if="error" class="issue issue--error">
        <span class="issue__icon" />
        <div>{{ error }}</div>
      </div>
      <div v-else class="prose docs-prose" v-html="html" @click="onProseClick" />

      <footer class="docs-foot">
        <RouterLink v-if="neighbours.prev" :to="docPath(neighbours.prev)" class="docs-foot__link">
          <ArrowLeft />
          <span>
            <small>上一篇</small>
            <b>{{ neighbours.prev.title }}</b>
          </span>
        </RouterLink>
        <span v-else />
        <RouterLink v-if="neighbours.next" :to="docPath(neighbours.next)" class="docs-foot__link docs-foot__link--next">
          <span>
            <small>下一篇</small>
            <b>{{ neighbours.next.title }}</b>
          </span>
          <ArrowRight />
        </RouterLink>
      </footer>
    </article>

    <aside v-else class="docs-article">
      <div class="docs-head">
        <h1>文档中心</h1>
        <p>选择左侧任意一篇开始阅读。</p>
      </div>
    </aside>

    <aside v-if="headings.length" class="docs-toc">
      <div class="docs-toc__label">本页目录</div>
      <button
        v-for="heading in headings"
        :key="heading.id"
        type="button"
        class="docs-toc__item"
        :class="{
          'is-active': activeHeading === heading.id,
          'is-sub': heading.level === 3,
        }"
        @click="scrollTo(heading.id)"
      >
        {{ heading.text }}
      </button>
    </aside>
  </div>
</template>

<style scoped>
.docs-page {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 200px;
  gap: 24px;
  max-width: 1420px;
  margin: 0 auto;
  padding: 18px 20px 48px;
  align-items: start;
}

/* ------------------------------------------------------------- left nav */

.docs-nav {
  position: sticky;
  top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: calc(100vh - var(--header-h) - var(--status-h) - 34px);
  padding-right: 2px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.docs-nav__search {
  position: relative;
  flex: 0 0 auto;
}

.docs-nav__search-icon {
  position: absolute;
  top: 9px;
  left: 10px;
  width: 13px;
  height: 13px;
  color: var(--text-3);
  pointer-events: none;
}

.docs-nav__search input {
  width: 100%;
  height: 30px;
  padding: 0 9px 0 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 11.5px;
  outline: none;
}

.docs-nav__search input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.docs-nav__search input::placeholder {
  color: var(--text-3);
}

.docs-nav__search input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.docs-nav__group + .docs-nav__group {
  margin-top: 6px;
}

.docs-nav__group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 6px 8px;
  border-radius: var(--radius-xs);
  font-size: 11.5px;
  font-weight: 650;
  color: var(--text-2);
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.docs-nav__group-label::-webkit-details-marker {
  display: none;
}

.docs-nav__group-label::after {
  content: '›';
  margin-left: auto;
  font-size: 14px;
  color: var(--text-3);
  transition: transform var(--duration) var(--ease);
}

.docs-nav__group[open] .docs-nav__group-label::after {
  transform: rotate(90deg);
}

.docs-nav__group-label:hover {
  background: var(--surface-2);
  color: var(--text);
}

.docs-nav__group-label svg {
  width: 13px;
  height: 13px;
  color: var(--accent);
}

.docs-nav__item {
  display: block;
  padding: 6px 8px 6px 10px;
  border-left: 2px solid transparent;
  border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  color: var(--text-2);
  font-size: 12px;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.docs-nav__item:hover {
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
}

.docs-nav__item.is-active {
  background: var(--accent-soft);
  border-left-color: var(--accent);
  color: var(--text);
  font-weight: 650;
}

.docs-nav__empty {
  margin: 10px 8px;
  font-size: 11.5px;
  color: var(--text-3);
}

.docs-article {
  min-width: 0;
}

.docs-head {
  position: relative;
  padding: 0 0 18px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-soft);
}

.docs-crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 9px;
}

.docs-crumb svg {
  width: 12px;
  height: 12px;
  color: var(--module-docs);
}

.crumb-sep {
  opacity: 0.6;
}

.docs-head h1 {
  font-size: 24px;
  font-weight: 720;
  letter-spacing: -0.025em;
  color: var(--text);
}

.docs-head p {
  margin-top: 5px;
  font-size: 12.5px;
  color: var(--text-2);
}

.docs-meta {
  display: flex;
  gap: 6px;
  margin-top: 11px;
  flex-wrap: wrap;
}

.docs-nav-toggle {
  display: none;
  align-items: center;
  gap: 5px;
  position: absolute;
  top: 0;
  right: 0;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--accent-line);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--accent);
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.docs-nav-toggle svg {
  width: 13px;
  height: 13px;
}

.docs-loading {
  padding: 40px 0;
  color: var(--text-3);
  font-size: 12px;
}

.docs-prose {
  max-width: 880px;
}

.docs-foot {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 40px;
  padding-top: 16px;
  border-top: 1px solid var(--border-soft);
}

.docs-foot__link {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 46%;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  color: var(--text-2);
  text-decoration: none;
  transition:
    border-color var(--duration) var(--ease),
    background var(--duration) var(--ease);
}

.docs-foot__link:hover {
  border-color: var(--accent-line);
  background: var(--surface-2);
  text-decoration: none;
}

.docs-foot__link svg {
  width: 14px;
  height: 14px;
  color: var(--accent);
  flex: 0 0 auto;
}

.docs-foot__link span {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  min-width: 0;
}

.docs-foot__link small {
  font-size: 9px;
  color: var(--text-3);
}

.docs-foot__link b {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.docs-foot__link--next {
  text-align: right;
  margin-left: auto;
}

.docs-toc {
  position: sticky;
  top: 10px;
  max-height: calc(100vh - var(--header-h) - var(--status-h) - 24px);
  overflow-y: auto;
  padding: 2px 0 20px 16px;
  border-left: 1px solid var(--border-soft);
  scrollbar-width: thin;
}

.docs-toc__label {
  font-size: 9px;
  font-weight: 650;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 7px;
}

.docs-toc__item {
  display: block;
  width: 100%;
  padding: 3px 0 3px 8px;
  border: none;
  border-left: 2px solid transparent;
  background: transparent;
  text-align: left;
  color: var(--text-3);
  font-family: inherit;
  font-size: 10.5px;
  line-height: 1.45;
  cursor: pointer;
}

.docs-toc__item:hover {
  color: var(--text-2);
}

.docs-toc__item.is-active {
  color: var(--accent);
  border-left-color: var(--accent);
}

.docs-toc__item.is-sub {
  padding-left: 18px;
  font-size: 10px;
}

@media (max-width: 1340px) {
  .docs-page {
    grid-template-columns: 250px minmax(0, 1fr);
  }

  .docs-toc {
    display: none;
  }
}

@media (max-width: 980px) {
  .docs-page {
    grid-template-columns: minmax(0, 1fr);
  }

  .docs-nav {
    display: none;
  }
}

@media (max-width: 900px) {
  .docs-page {
    padding: 16px 14px 40px;
  }

  .docs-nav-toggle {
    display: none;
  }

  .docs-head h1 {
    font-size: 22px;
  }

  .docs-prose {
    max-width: none;
  }

  .docs-foot__link {
    max-width: 48%;
  }
}
</style>
