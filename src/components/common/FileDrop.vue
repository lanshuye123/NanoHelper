<script setup lang="ts">
import { ref } from 'vue'
import { Upload } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    accept?: string
    title?: string
    hint?: string
    multiple?: boolean
  }>(),
  { title: '拖入文件，或点击选择', hint: '支持 CSV / TXT / XY / DIF / XRDML' },
)

const emit = defineEmits<{ files: [files: File[]] }>()
const input = ref<HTMLInputElement | null>(null)
const over = ref(false)

function pick() {
  input.value?.click()
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files ? [...target.files] : []
  if (files.length) emit('files', files)
  target.value = ''
}

function onDrop(event: DragEvent) {
  over.value = false
  const files = event.dataTransfer?.files ? [...event.dataTransfer.files] : []
  if (files.length) emit('files', props.multiple ? files : files.slice(0, 1))
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'is-over': over }"
    role="button"
    tabindex="0"
    @click="pick"
    @keydown.enter.prevent="pick"
    @keydown.space.prevent="pick"
    @dragenter.prevent="over = true"
    @dragover.prevent="over = true"
    @dragleave.prevent="over = false"
    @drop.prevent="onDrop"
  >
    <span class="dropzone__icon"><Upload /></span>
    <span class="dropzone__title">{{ title }}</span>
    <span class="dropzone__hint">{{ hint }}</span>
    <input ref="input" type="file" :accept="accept" :multiple="multiple" hidden @change="onChange" />
  </div>
</template>
