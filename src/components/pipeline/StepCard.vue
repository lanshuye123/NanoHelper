<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Trash2 } from 'lucide-vue-next'
import NumberField from '@/components/common/NumberField.vue'
import { STEP_DEFINITIONS } from '@/core/pipeline/steps'
import { jadeModeDefaults, type JadeMapMode } from '@/core/pipeline/jade'
import type { Step, StepParams } from '@/core/pipeline/types'

const props = defineProps<{ step: Step; index: number; total: number }>()
const emit = defineEmits<{
  'update:params': [params: StepParams]
  toggle: []
  remove: []
  move: [direction: -1 | 1]
  duplicate: []
}>()

const definition = computed(() => STEP_DEFINITIONS[props.step.type])
const params = computed(() => props.step.params)
const anchorText = ref(formatAnchors(params.value.anchors))

watch(
  () => params.value.anchors,
  (value) => {
    anchorText.value = formatAnchors(value)
  },
)

function formatAnchors(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map((item) => {
      if (Array.isArray(item)) return `${item[0]}, ${item[1]}`
      if (item && typeof item === 'object') {
        const obj = item as { x?: unknown; y?: unknown }
        return `${obj.x ?? ''}, ${obj.y ?? ''}`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function set(key: string, value: unknown) {
  if (key === 'mode') {
    emit('update:params', {
      ...params.value,
      mode: value,
      ...jadeModeDefaults(value as JadeMapMode),
    })
    return
  }
  emit('update:params', { ...params.value, [key]: value })
}

function commitAnchors() {
  const parsed = anchorText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[,;\s]+/).map(Number))
    .filter((pair) => pair.length >= 2 && pair.every(Number.isFinite))
    .map((pair) => ({ x: pair[0], y: pair[1] }))
  if (parsed.length < 2) {
    ElMessage.warning('至少需要两个有效锚点，格式：x, y（每行一个）')
    return
  }
  set('anchors', parsed)
}
</script>

<template>
  <article class="step-card" :class="{ 'is-disabled': !step.enabled }">
    <header class="step-card__head">
      <span class="step-card__index mono">{{ String(index + 1).padStart(2, '0') }}</span>
      <div class="step-card__title">
        <span>{{ definition?.label ?? step.type }}</span>
        <span v-if="!step.enabled" class="chip tiny">已停用</span>
        <span v-else-if="!definition?.invertible" class="chip chip--warn tiny">不可逆</span>
        <span v-else class="chip chip--ok tiny">可逆</span>
      </div>
      <div class="step-card__actions">
        <button class="icon-btn" type="button" :title="step.enabled ? '停用此步' : '启用此步'" @click="emit('toggle')">
          <EyeOff v-if="step.enabled" />
          <Eye v-else />
        </button>
        <button class="icon-btn" type="button" title="上移" :disabled="index === 0" @click="emit('move', -1)">
          <ChevronUp />
        </button>
        <button class="icon-btn" type="button" title="下移" :disabled="index === total - 1" @click="emit('move', 1)">
          <ChevronDown />
        </button>
        <button class="icon-btn" type="button" title="复制" @click="emit('duplicate')">
          <Copy />
        </button>
        <button class="icon-btn icon-btn--danger" type="button" title="删除" @click="emit('remove')">
          <Trash2 />
        </button>
      </div>
    </header>

    <p class="step-card__desc">{{ definition?.description }}</p>

    <div class="step-card__params">
      <template v-if="step.type === 'crop'">
        <NumberField
          :model-value="Number(params.xMin)"
          label="X 下限"
          @update:model-value="set('xMin', $event)"
        />
        <NumberField
          :model-value="Number(params.xMax)"
          label="X 上限"
          @update:model-value="set('xMax', $event)"
        />
      </template>

      <template v-else-if="step.type === 'resample'">
        <NumberField
          :model-value="Number(params.step)"
          label="目标步长"
          unit="X 单位"
          :min="1e-9"
          @update:model-value="set('step', $event)"
        />
      </template>

      <template v-else-if="step.type === 'smooth'">
        <label class="field">
          <span class="field__label">方法</span>
          <el-select
            :model-value="String(params.method)"
            size="small"
            @update:model-value="set('method', $event)"
          >
            <el-option label="Savitzky–Golay" value="sg" />
            <el-option label="滑动平均" value="moving" />
          </el-select>
        </label>
        <NumberField
          :model-value="Number(params.window)"
          label="窗口"
          hint="建议取奇数"
          :min="3"
          @update:model-value="set('window', $event)"
        />
        <NumberField
          v-if="params.method === 'sg'"
          :model-value="Number(params.order)"
          label="多项式阶数"
          :min="1"
          @update:model-value="set('order', $event)"
        />
      </template>

      <template v-else-if="step.type === 'background'">
        <label class="field">
          <span class="field__label">方法</span>
          <el-select
            :model-value="String(params.method)"
            size="small"
            @update:model-value="set('method', $event)"
          >
            <el-option label="SNIP 自动" value="snip" />
            <el-option label="线性锚点" value="linear" />
            <el-option label="多项式锚点" value="poly" />
          </el-select>
        </label>
        <NumberField
          v-if="params.method === 'snip'"
          :model-value="Number(params.iterations)"
          label="迭代次数"
          :min="1"
          :max="400"
          @update:model-value="set('iterations', $event)"
        />
        <NumberField
          v-if="params.method === 'poly'"
          :model-value="Number(params.order)"
          label="多项式阶数"
          :min="1"
          :max="8"
          @update:model-value="set('order', $event)"
        />
        <label v-if="params.method !== 'snip'" class="field step-card__wide">
          <span class="field__label">锚点 <span class="field__unit">x, y / 每行一个</span></span>
          <el-input v-model="anchorText" type="textarea" :rows="3" size="small" @blur="commitAnchors" />
        </label>
        <label class="field step-card__wide field--inline">
          <el-switch
            :model-value="params.clipNegative !== false"
            size="small"
            @update:model-value="set('clipNegative', $event)"
          />
          <span class="small muted">负值截断为 0</span>
        </label>
      </template>

      <template v-else-if="step.type === 'kalpha2'">
        <NumberField
          :model-value="Number(params.ka1)"
          label="Kα1 波长"
          unit="Å"
          :precision="5"
          @update:model-value="set('ka1', $event)"
        />
        <NumberField
          :model-value="Number(params.ka2)"
          label="Kα2 波长"
          unit="Å"
          :precision="5"
          @update:model-value="set('ka2', $event)"
        />
        <NumberField
          :model-value="Number(params.ratio)"
          label="强度比 I₂/I₁"
          :min="0"
          :max="1"
          :precision="3"
          @update:model-value="set('ratio', $event)"
        />
      </template>

      <template v-else-if="step.type === 'normalize'">
        <label class="field">
          <span class="field__label">模式</span>
          <el-select
            :model-value="String(params.mode)"
            size="small"
            @update:model-value="set('mode', $event)"
          >
            <el-option label="最大值归一" value="max" />
            <el-option label="最小–最大" value="minmax" />
            <el-option label="面积归一" value="area" />
          </el-select>
        </label>
        <NumberField
          :model-value="Number(params.target)"
          label="目标值"
          @update:model-value="set('target', $event)"
        />
      </template>

      <template v-else-if="step.type === 'jade-map'">
        <label class="field step-card__wide">
          <span class="field__label">映射模式</span>
          <el-select
            :model-value="String(params.mode)"
            size="small"
            @update:model-value="set('mode', $event)"
          >
            <el-option label="衍射数据：保持 2θ" value="diffraction" />
            <el-option label="非衍射数据：X→[0,100]" value="nonDiffraction" />
            <el-option label="安全区间：X→[1,139]" value="safe" />
            <el-option label="自定义仿射" value="affine" />
          </el-select>
        </label>
        <template v-if="params.mode === 'affine'">
          <NumberField :model-value="Number(params.xScale)" label="x 比例 a" :precision="10" @update:model-value="set('xScale', $event)" />
          <NumberField :model-value="Number(params.xOffset)" label="x 偏移 b" :precision="10" @update:model-value="set('xOffset', $event)" />
          <NumberField :model-value="Number(params.yScale)" label="y 比例 c" :precision="10" @update:model-value="set('yScale', $event)" />
          <NumberField :model-value="Number(params.yOffset)" label="y 偏移 d" :precision="10" @update:model-value="set('yOffset', $event)" />
        </template>
        <div v-if="params.mode === 'nonDiffraction'" class="step-card__wide tiny dim" style="line-height: 1.5">
          固定映射：X → [0, 100]，Y → [0.5, 10000]（与课程笔记一致）。
        </div>
        <div v-else-if="params.mode === 'safe'" class="step-card__wide tiny dim" style="line-height: 1.5">
          固定映射：X → [1, 139]，Y → [0.5, 10000]，避开 Jade 的边界。
        </div>
        <div v-else-if="params.mode === 'diffraction'" class="step-card__wide tiny dim" style="line-height: 1.5">
          衍射模式保持 2θ 不变；若 X 超出 0–140，请先裁剪或改用安全区间。
        </div>
        <label v-if="params.mode === 'diffraction'" class="field step-card__wide field--inline">
          <el-switch
            :model-value="params.rescaleY !== false"
            size="small"
            @update:model-value="set('rescaleY', $event)"
          />
          <span class="small muted">重标定 Y 到 [0.5, 10000]（关闭时仅平移负值）</span>
        </label>
      </template>

      <template v-else-if="step.type === 'affine'">
        <NumberField :model-value="Number(params.xScale)" label="x 比例 a" :precision="10" @update:model-value="set('xScale', $event)" />
        <NumberField :model-value="Number(params.xOffset)" label="x 偏移 b" :precision="10" @update:model-value="set('xOffset', $event)" />
        <NumberField :model-value="Number(params.yScale)" label="y 比例 c" :precision="10" @update:model-value="set('yScale', $event)" />
        <NumberField :model-value="Number(params.yOffset)" label="y 偏移 d" :precision="10" @update:model-value="set('yOffset', $event)" />
      </template>
    </div>
    <div v-if="step.type === 'jade-map'" class="step-card__note">
      Jade 要求 X ∈ [0,140]、Y &gt; 0；非衍射数据映射后可在 DIF → XY 页面按配方反算回原始坐标。
    </div>
  </article>
</template>

<style scoped>
.step-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  padding: 10px 11px 11px;
}

.step-card + .step-card {
  margin-top: 8px;
}

.step-card.is-disabled {
  opacity: 0.55;
}

.step-card__head {
  display: flex;
  align-items: center;
  gap: 7px;
}

.step-card__index {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-3);
  font-size: 9.5px;
}

.step-card__title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  min-width: 0;
  flex-wrap: wrap;
}

.step-card__actions {
  display: flex;
  align-items: center;
  gap: 0;
  margin-left: auto;
}

.step-card__actions .icon-btn {
  width: 24px;
  height: 24px;
}

.step-card__actions .icon-btn svg {
  width: 13px;
  height: 13px;
}

.step-card__actions .icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon-btn--danger:hover {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: transparent;
}

.step-card__desc {
  margin: 6px 0 9px;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--text-3);
}

.step-card__params {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.step-card__wide {
  grid-column: 1 / -1;
}

.field--inline {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.step-card__note {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--text-2);
  font-size: 10px;
  line-height: 1.5;
}
</style>
