<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw, Trash2 } from 'lucide-vue-next'

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

const saveTitle = computed(() =>
  props.savedAt ? `本页输入已自动保存 · ${new Date(props.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '本页输入会自动保存',
)
</script>

<template>
  <div class="tool-state">
    <span v-if="error" class="tool-state__error" role="alert">{{ error }}</span>
    <div class="tool-state__actions">
      <button type="button" class="btn tool-state__btn" :title="saveTitle" @click="emit('reset')">
        <RotateCcw />
        恢复默认
      </button>
      <button
        v-if="canClear"
        type="button"
        class="btn tool-state__btn tool-state__clear"
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
  height: 26px;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--surface-2);
  color: var(--text-3);
  white-space: nowrap;
}

.tool-state__hint--restored {
  background: var(--accent-soft);
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
  gap: 8px;
  flex-wrap: wrap;
}

.tool-state__btn {
  height: 36px;
  padding: 0 13px;
  font-size: 12px;
  color: var(--text-2);
}

.tool-state__btn svg {
  width: 14px;
  height: 14px;
  color: var(--text-3);
}

.tool-state__btn:hover:not(:disabled) svg {
  color: var(--accent);
}

.tool-state__clear {
  color: var(--text-2);
}

.tool-state__clear:hover {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
  color: var(--danger);
}

.tool-state__clear:hover svg {
  color: var(--danger);
}

@media (max-width: 720px) {
  .tool-state {
    justify-content: flex-start;
    width: 100%;
  }

  .tool-state__actions {
    width: 100%;
  }

  .tool-state__btn {
    flex: 1 1 auto;
    justify-content: center;
    min-height: 36px;
  }
}
</style>
