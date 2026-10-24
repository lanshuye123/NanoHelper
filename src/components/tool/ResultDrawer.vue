<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import { BarChart3, ChevronDown, Clipboard, Download, Maximize2, Minimize2, ScrollText } from 'lucide-vue-next'
import type { DrawerState, ResultTab } from './types'

const props = withDefaults(
  defineProps<{
    title?: string
    tabs?: ResultTab[]
    /** Text shown in the copy tab header, e.g. the number of lines being copied. */
    copyHint?: string
  }>(),
  {
    title: '结果',
    tabs: () => ['chart', 'text', 'download', 'copy'],
    copyHint: '',
  },
)

const state = defineModel<DrawerState>('state', { default: 'closed' })

const slots = useSlots()

const TAB_META: Record<ResultTab, { label: string; icon: typeof BarChart3 }> = {
  chart: { label: '图表', icon: BarChart3 },
  text: { label: '文本', icon: ScrollText },
  download: { label: '下载', icon: Download },
  copy: { label: '复制', icon: Clipboard },
}

const availableTabs = computed(() => props.tabs.filter((tab) => Boolean(slots[tab])))
const active = ref<ResultTab>('chart')

watch(
  () => state.value,
  (value) => {
    if (value === 'closed') return
    if (!availableTabs.value.includes(active.value)) {
      active.value = availableTabs.value[0] ?? 'text'
    }
  },
)

watch(availableTabs, (tabs) => {
  if (tabs.length && !tabs.includes(active.value)) active.value = tabs[0]
})

function toggleSize() {
  state.value = state.value === 'full' ? 'half' : 'full'
}

function close() {
  state.value = 'closed'
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && state.value !== 'closed') {
    event.stopPropagation()
    close()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <section
      class="drawer"
      :data-state="state"
      role="dialog"
      :aria-label="title"
      :aria-hidden="state === 'closed'"
      :inert="state === 'closed'"
    >
      <div class="drawer__grip" aria-hidden="true" />

      <header class="drawer__head">
        <h2 class="drawer__title">{{ title }}</h2>

        <div class="segmented" role="tablist" aria-label="结果视图">
          <button
            v-for="tab in availableTabs"
            :key="tab"
            type="button"
            role="tab"
            class="segmented__btn"
            :aria-selected="active === tab"
            :tabindex="active === tab ? 0 : -1"
            @click="active = tab"
          >
            <component :is="TAB_META[tab].icon" />
            <span>{{ TAB_META[tab].label }}</span>
          </button>
        </div>

        <div class="drawer__tools">
          <button
            type="button"
            class="icon-btn"
            :title="state === 'full' ? '还原半屏' : '全屏查看'"
            :aria-label="state === 'full' ? '还原半屏' : '全屏查看'"
            :aria-pressed="state === 'full'"
            @click="toggleSize"
          >
            <Minimize2 v-if="state === 'full'" />
            <Maximize2 v-else />
          </button>
          <button type="button" class="icon-btn" title="收起结果" aria-label="收起结果" @click="close">
            <ChevronDown />
          </button>
        </div>
      </header>

      <div class="drawer__body">
        <div v-show="active === 'chart'" class="drawer__panel" role="tabpanel" aria-label="图表">
          <slot name="chart" />
        </div>
        <div v-show="active === 'text'" class="drawer__panel" role="tabpanel" aria-label="文本">
          <slot name="text" />
        </div>
        <div v-show="active === 'download'" class="drawer__panel" role="tabpanel" aria-label="下载">
          <slot name="download" />
        </div>
        <div v-show="active === 'copy'" class="drawer__panel" role="tabpanel" aria-label="复制">
          <p v-if="copyHint" class="section-note">{{ copyHint }}</p>
          <slot name="copy" />
        </div>
      </div>
    </section>
  </Teleport>
</template>
