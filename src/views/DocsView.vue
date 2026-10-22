<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, BookOpen, Search } from 'lucide-vue-next'
import {
  DOCS,
  DOC_SECTIONS,
  docPath,
  docsBySection,
  getDoc,
  prevNext,
  sectionLabel,
  type DocEntry,
} from '@/docs/manifest'
import { loadDocSource, renderDoc, type Heading } from '@/docs/render'

const route = useRoute()
const router = useRouter()

const query = ref('')
const html = ref('')
const headings = ref<Heading[]>([])
const loading = ref(false)
const error = ref('')
const activeHeading = ref('')
let scrollContainer: HTMLElement | null = null

const current = computed(() => getDoc(route.params.section as string | undefined, route.params.slug as string | undefined))
const section = computed(() => (current.value ? sectionLabel(current.value.section) : ''))
const neighbours = computed(() => (current.value ? prevNext(current.value) : {}))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return DOCS
  return DOCS.filter((doc) =>
    [doc.title, doc.description, doc.section, ...(doc.keywords ?? [])].join(' ').toLowerCase().includes(q),
  )
})

const groups = computed(() =>
  DOC_SECTIONS.map((section) => ({
    ...section,
    docs: filtered.value.filter((d) => d.section === section.key).sort((a, b) => a.order - b.order),
  })).filter((group) => group.docs.length > 0),
)

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
    scrollContainer?.scrollTo({ top: 0 })
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

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function setActiveHeading() {
  const container = scrollContainer
  if (!container || !headings.value.length) return
  const top = container.getBoundingClientRect().top + 90
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
  scrollContainer = document.querySelector('.app-content') as HTMLElement | null
  scrollContainer?.addEventListener('scroll', onScroll, { passive: true })
  setActiveHeading()
})

onBeforeUnmount(() => {
  scrollContainer?.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="docs-page">
    <aside class="docs-nav">
      <div class="docs-search">
        <Search class="docs-search__icon" />
        <input v-model="query" type="search" placeholder="搜索文档、关键词…" aria-label="搜索文档" />
      </div>

      <nav aria-label="文档目录">
        <div v-for="group in groups" :key="group.key" class="docs-group">
          <div class="docs-group__label">{{ group.label }}</div>
          <RouterLink
            v-for="doc in group.docs"
            :key="doc.slug"
            :to="docPath(doc)"
            class="docs-link"
            :class="{ 'is-active': current?.slug === doc.slug && current?.section === doc.section }"
          >
            <span>{{ doc.title }}</span>
          </RouterLink>
        </div>
        <div v-if="!groups.length" class="docs-empty">没有匹配的文档</div>
      </nav>

      <div class="docs-nav-foot">
        <span class="mono">v0.1.0</span>
        <span>文档随代码同步</span>
      </div>
    </aside>

    <article v-if="current" class="docs-article">
      <header class="docs-head">
        <div class="docs-crumb">
          <BookOpen />
          <span>文档</span>
          <span class="crumb-sep">/</span>
          <span>{{ section }}</span>
        </div>
        <h1>{{ current.title }}</h1>
        <p>{{ current.description }}</p>
        <div class="docs-meta">
          <span class="chip chip--mono">{{ current.section }}/{{ current.slug }}</span>
          <span v-if="headings.length" class="chip chip--mono">{{ headings.length }} 个标题</span>
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
  grid-template-columns: 240px minmax(0, 1fr) 210px;
  gap: 0;
  max-width: 1480px;
  margin: 0 auto;
  padding: 0 24px 60px;
  align-items: start;
}

.docs-nav {
  position: sticky;
  top: 0;
  max-height: calc(100vh - var(--header-h) - var(--status-h));
  overflow-y: auto;
  padding: 20px 16px 20px 0;
  border-right: 1px solid var(--border-soft);
}

.docs-search {
  position: relative;
  margin-bottom: 14px;
}

.docs-search__icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  width: 13px;
  height: 13px;
  color: var(--text-3);
  pointer-events: none;
}

.docs-search input {
  width: 100%;
  height: 30px;
  padding: 0 9px 0 28px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-size: 11.5px;
  outline: none;
}

.docs-search input:focus {
  border-color: var(--accent);
}

.docs-search input::placeholder {
  color: var(--text-3);
}

.docs-group + .docs-group {
  margin-top: 16px;
}

.docs-group__label {
  padding: 0 4px 5px;
  font-size: 9px;
  font-weight: 650;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--text-3);
}

.docs-link {
  display: block;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 11.5px;
  color: var(--text-2);
  text-decoration: none;
  line-height: 1.45;
}

.docs-link:hover {
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
}

.docs-link.is-active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.docs-empty {
  font-size: 11px;
  color: var(--text-3);
  padding: 8px 4px;
}

.docs-nav-foot {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 22px;
  padding-top: 10px;
  border-top: 1px solid var(--border-soft);
  font-size: 9px;
  color: var(--text-3);
}

.docs-article {
  min-width: 0;
  padding: 26px 40px 40px;
}

.docs-head {
  padding-bottom: 20px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--border-soft);
}

.docs-crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--text-3);
  margin-bottom: 8px;
}

.docs-crumb svg {
  width: 12px;
  height: 12px;
}

.crumb-sep {
  opacity: 0.6;
}

.docs-head h1 {
  font-size: 28px;
  font-weight: 750;
  letter-spacing: -0.03em;
  color: var(--text);
}

.docs-head p {
  margin-top: 5px;
  font-size: 13px;
  color: var(--text-2);
}

.docs-meta {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.docs-loading {
  padding: 40px 0;
  color: var(--text-3);
  font-size: 12px;
}

.docs-prose {
  max-width: 860px;
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
  border-radius: 7px;
  border: 1px solid var(--border-soft);
  color: var(--text-2);
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
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
  top: 0;
  max-height: calc(100vh - var(--header-h) - var(--status-h));
  overflow-y: auto;
  padding: 26px 0 20px 18px;
  border-left: 1px solid var(--border-soft);
}

.docs-toc__label {
  font-size: 9px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 7px;
}

.docs-toc__item {
  display: block;
  width: 100%;
  padding: 3px 0;
  border: none;
  background: transparent;
  text-align: left;
  color: var(--text-3);
  font-size: 10.5px;
  line-height: 1.45;
  cursor: pointer;
  border-left: 2px solid transparent;
  padding-left: 8px;
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

@media (max-width: 1200px) {
  .docs-page {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .docs-toc {
    display: none;
  }
}

@media (max-width: 900px) {
  .docs-page {
    grid-template-columns: 1fr;
    padding: 0 16px 40px;
  }

  .docs-nav {
    position: static;
    max-height: 240px;
    overflow-y: auto;
    border-right: none;
    border-bottom: 1px solid var(--border-soft);
    padding: 14px 0;
  }

  .docs-article {
    padding: 20px 0 30px;
  }

  .docs-head h1 {
    font-size: 23px;
  }
}
</style>
