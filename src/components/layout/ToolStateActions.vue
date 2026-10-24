<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw, Save, Trash2 } from 'lucide-vue-next'
import { formatSavedAt } from '@/utils/persist'

const props = withDefaults(
  defineProps<{
    savedAt?: number | null
    restored?: boolean
    error?: string
    /** Hide the clear action for read-only views. */
    canClear?: boolean
  }>(),
  { savedAt: null, restored: false, error: '', canClear: true },
)

const emit = defineEmits<{ reset: []; clear: [] }>()

const savedText = computed(() => (props.savedAt ? `已自动保存 ${formatSavedAt(props.savedAt)}` : ''))
</script>

<template>
  <div class="tool-state">
    <span v-if="restored" class="tool-state__hint tool-state__hint--restored" role="status">已恢复上次输入</span>
    <span v-if="savedText" class="tool-state__hint" role="status">
      <Save />
      {{ savedText }}
    </span>
    <span v-if="error" class="tool-state__error" role="alert">{{ error }}</span>
    <div class="tool-state__actions">
      <button type="button" class="btn btn--quiet" title="把本页输入恢复为初始值" @click="emit('reset')">
        <RotateCcw />
        恢复默认
      </button>
      <button
        v-if="canClear"
        type="button"
        class="btn btn--quiet tool-state__clear"
        title="清空本页数据、结果与自动保存记录"
        @click="emit('clear')"
      >
        <Trash2 />
        清空本页
      </button>
    </div>
  </div>
</template>

<style scoped>
.tool-state {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--text-3);
}

.tool-state__hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.tool-state__hint--restored {
  color: var(--accent);
}

.tool-state__hint svg {
  width: 12px;
  height: 12px;
  color: var(--accent);
}

.tool-state__error {
  max-width: 260px;
  color: var(--danger);
  line-height: 1.5;
}

.tool-state__actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tool-state__actions :deep(.btn) {
  height: 28px;
  padding: 0 9px;
  font-size: 11.5px;
}

.tool-state__actions :deep(.btn svg) {
  width: 13px;
  height: 13px;
}

.tool-state__clear {
  color: var(--danger);
}

.tool-state__clear:hover {
  border-color: var(--danger);
  color: var(--danger);
}

@media (max-width: 720px) {
  .tool-state {
    justify-content: flex-start;
  }

  .tool-state__actions {
    width: 100%;
  }

  .tool-state__actions :deep(.btn) {
    flex: 1 1 auto;
    justify-content: center;
    min-height: 34px;
  }
}
</style>
