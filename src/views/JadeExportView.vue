<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileJson,
  FileOutput,
  Sparkles,
  Wand2,
} from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import PanelCard from '@/components/common/PanelCard.vue'
import IssueList from '@/components/common/IssueList.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import NumberField from '@/components/common/NumberField.vue'
import SciChart, { type ChartSeries } from '@/components/chart/SciChart.vue'
import { useProjectStore } from '@/stores/project'
import { buildXy, defaultXyFilename } from '@/core/io/xy'
import { buildRecipe, serializeRecipe } from '@/core/pipeline/recipe'
import { jadeModeDefaults, mappingSummary, type JadeMapMode } from '@/core/pipeline/jade'
import { downloadText } from '@/utils/download'

const project = useProjectStore()
const version = '0.1.0'

const decimalsX = ref(6)
const decimalsY = ref(4)
const lineEnding = ref<'crlf' | 'lf'>('crlf')
const headerComments = ref(false)

const hasData = computed(() => project.hasData && project.derived)
const jadeStep = computed(() => project.jadeStep)
const mapping = computed(() => project.jadeMapping)

const mappedSeries = computed<ChartSeries[]>(() => {
  if (!project.derived) return []
  return [
    {
      label: 'Jade 输入',
      x: project.derived.x,
      y: project.derived.y,
      color: '#3b9fdd',
      width: 1.5,
      fill: true,
    },
  ]
})

const mode = computed(() => String(jadeStep.value?.params.mode ?? 'nonDiffraction'))

const compatibility = computed(() => project.issues)

const canExport = computed(() => {
  return !!project.derived && compatibility.value.every((i) => i.level !== 'error')
})

const filename = computed(() => defaultXyFilename(project.source?.name ?? 'pattern'))

const preview = computed(() => {
  if (!project.derived) return ''
  try {
    return buildXy(project.derived, {
      decimalsX: decimalsX.value,
      decimalsY: decimalsY.value,
      lineEnding: lineEnding.value === 'crlf' ? '\r\n' : '\n',
      headerLines: headerComments.value
        ? [
            `CrystalToolBox ${version}`,
            `source: ${project.source?.fileName ?? project.source?.name ?? 'data'}`,
            `mapping: ${mapping.value ? mappingSummary(mapping.value) : 'none'}`,
          ]
        : [],
    })
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
})

const previewLines = computed(() => preview.value.split(/\r?\n/).slice(0, 14).join('\n'))

function signed(value: number): string {
  return `${value >= 0 ? '+' : '−'} ${Math.abs(value).toPrecision(10)}`
}

function inferMode(): 'diffraction' | 'nonDiffraction' {
  const range = project.range
  if (range && range.xMin >= 0 && range.xMax <= 140) return 'diffraction'
  return 'nonDiffraction'
}

function addJadeStep() {
  project.addStep('jade-map', { mode: inferMode(), rescaleY: inferMode() === 'nonDiffraction' })
  ElMessage.success('已添加 Jade 坐标映射步骤')
}

function updateMapping(key: string, value: unknown) {
  if (!jadeStep.value) return
  if (key === 'mode') {
    project.updateStep(jadeStep.value.id, {
      mode: value,
      ...jadeModeDefaults(value as JadeMapMode),
    })
    return
  }
  project.updateStep(jadeStep.value.id, { [key]: value })
}

function exportXy() {
  if (!project.derived) return
  try {
    const text = buildXy(project.derived, {
      decimalsX: decimalsX.value,
      decimalsY: decimalsY.value,
      lineEnding: lineEnding.value === 'crlf' ? '\r\n' : '\n',
      headerLines: headerComments.value
        ? [
            `CrystalToolBox ${version}`,
            `source: ${project.source?.fileName ?? project.source?.name ?? 'data'}`,
            `mapping: ${mapping.value ? mappingSummary(mapping.value) : 'none'}`,
          ]
        : [],
    })
    downloadText(text, filename.value, 'text/plain;charset=us-ascii')
    ElMessage.success(`已导出 ${filename.value}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

function exportRecipe() {
  if (!project.raw) return
  try {
    const recipe = buildRecipe(project.raw, project.steps, {
      name: project.source?.name ?? 'dataset',
      version,
      mapping: mapping.value ?? undefined,
      resolved: project.applyResult?.resolved,
    })
    const name = (project.source?.name ?? 'dataset').replace(/\.[^.]+$/, '') + '.recipe.json'
    downloadText(serializeRecipe(recipe), name, 'application/json')
    ElMessage.success('配方已导出；DIF → XY 时加载它即可反算')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function copyPreview() {
  if (!preview.value) return
  try {
    await navigator.clipboard.writeText(preview.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('浏览器拒绝了剪贴板访问，请使用导出按钮')
  }
}
</script>

<template>
  <ToolPage
    title="Jade 导出"
    subtitle="检查 2θ 与强度范围，生成 MDI Jade 可直接读取的两列 XY，并保存可逆配方。"
    eyebrow="数据处理 · 02"
    doc="/docs/userguide/jade-export"
  >
    <template #actions>
      <el-button size="small" @click="$router.push('/data/import')">
        <ArrowLeft class="btn-icon" /> 返回预处理
      </el-button>
      <el-button v-if="hasData" size="small" :disabled="!canExport" type="primary" @click="exportXy">
        <Download class="btn-icon" /> 导出 .xy
      </el-button>
    </template>

    <template #config>
      <PanelCard title="Jade 坐标映射" :icon="Wand2">
        <div v-if="!jadeStep" class="mapping-empty">
          <p class="small muted">尚未添加映射步骤。Jade 要求 0 ≤ X ≤ 140 且 Y &gt; 0；非衍射数据必须先映射。</p>
          <el-button type="primary" size="small" style="width: 100%; margin-top: 8px" @click="addJadeStep">
            添加 Jade 映射步骤
          </el-button>
        </div>
        <div v-else class="form-stack">
          <label class="field">
            <span class="field__label">模式</span>
            <el-select :model-value="mode" size="small" @update:model-value="updateMapping('mode', $event)">
              <el-option label="衍射数据：保持 2θ" value="diffraction" />
              <el-option label="非衍射：X→[0,100]" value="nonDiffraction" />
              <el-option label="安全区间：X→[1,139]" value="safe" />
              <el-option label="自定义仿射" value="affine" />
            </el-select>
          </label>
          <template v-if="mode === 'affine'">
            <div class="grid-2">
              <NumberField
                :model-value="Number(jadeStep.params.xScale)"
                label="x 比例"
                :precision="12"
                @update:model-value="updateMapping('xScale', $event)"
              />
              <NumberField
                :model-value="Number(jadeStep.params.xOffset)"
                label="x 偏移"
                :precision="12"
                @update:model-value="updateMapping('xOffset', $event)"
              />
              <NumberField
                :model-value="Number(jadeStep.params.yScale)"
                label="y 比例"
                :precision="12"
                @update:model-value="updateMapping('yScale', $event)"
              />
              <NumberField
                :model-value="Number(jadeStep.params.yOffset)"
                label="y 偏移"
                :precision="12"
                @update:model-value="updateMapping('yOffset', $event)"
              />
            </div>
          </template>
          <template v-else-if="mode === 'nonDiffraction'">
            <div class="small dim" style="line-height: 1.55">固定映射：X → [0, 100]，Y → [0.5, 10000]。</div>
          </template>
          <template v-else-if="mode === 'safe'">
            <div class="small dim" style="line-height: 1.55">固定映射：X → [1, 139]，Y → [0.5, 10000]。</div>
          </template>
          <template v-else>
            <div class="small dim" style="line-height: 1.55">
              衍射模式保持 2θ；X 超出 0–140 时请先裁剪，或改用安全区间。
            </div>
            <label class="inline small muted">
              <el-switch
                :model-value="jadeStep.params.rescaleY !== false"
                size="small"
                @update:model-value="updateMapping('rescaleY', $event)"
              />
              重标定 Y 到 [0.5, 10000]（关闭时仅平移负值）
            </label>
          </template>

          <div v-if="mapping" class="mapping-box">
            <div class="section-label" style="margin-bottom: 6px">解析出的系数</div>
            <div class="mono mapping-box__line">
              x' = {{ mapping.xScale.toPrecision(10) }} · x {{ signed(mapping.xOffset) }}
            </div>
            <div class="mono mapping-box__line">
              y' = {{ mapping.yScale.toPrecision(10) }} · y {{ signed(mapping.yOffset) }}
            </div>
            <div class="mapping-box__range mono">
              X: {{ mapping.outputX[0].toPrecision(6) }} → {{ mapping.outputX[1].toPrecision(6) }} · Y:
              {{ mapping.outputY[0].toPrecision(6) }} → {{ mapping.outputY[1].toPrecision(6) }}
            </div>
          </div>
          <div v-for="warning in mapping?.warnings ?? []" :key="warning" class="issue issue--warning">
            <span class="issue__icon" />
            <div>{{ warning }}</div>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="导出选项" :icon="FileOutput">
        <div class="form-stack">
          <label class="field">
            <span class="field__label">文件名</span>
            <el-input :model-value="filename" size="small" readonly />
          </label>
          <div class="grid-2">
            <NumberField v-model="decimalsX" label="X 小数位" :min="0" :max="10" />
            <NumberField v-model="decimalsY" label="Y 小数位" :min="0" :max="10" />
          </div>
          <label class="field">
            <span class="field__label">换行符</span>
            <el-select v-model="lineEnding" size="small">
              <el-option label="CRLF（Windows / Jade 推荐）" value="crlf" />
              <el-option label="LF（Unix）" value="lf" />
            </el-select>
          </label>
          <label class="inline small muted">
            <el-switch v-model="headerComments" size="small" />
            写入 # 注释表头（Jade 可能忽略）
          </label>
          <div class="btn-row">
            <el-button type="primary" size="small" :disabled="!canExport" @click="exportXy">
              <Download class="btn-icon" /> 导出 .xy
            </el-button>
            <el-button size="small" :disabled="!jadeStep" @click="exportRecipe">
              <FileJson class="btn-icon" /> 配方 JSON
            </el-button>
          </div>
        </div>
      </PanelCard>
    </template>

    <template #aside>
      <PanelCard title="兼容性检查" :icon="CheckCircle2">
        <IssueList :issues="compatibility" />
      </PanelCard>

      <PanelCard title="配方与反算" :icon="Sparkles">
        <p class="small muted" style="line-height: 1.65">
          导出的 <code>recipe.json</code> 记录了映射系数。Jade 拟合完成后，在「DIF → XY」页面加载它，
          就能把峰位、峰宽与强度反算回原始物理量。
        </p>
        <div v-if="mapping" class="inverse-box">
          <div class="section-label">逆变换</div>
          <div class="mono">x = (x' − {{ mapping.xOffset.toPrecision(8) }}) / {{ mapping.xScale.toPrecision(8) }}</div>
          <div class="mono">y = (y' − {{ mapping.yOffset.toPrecision(8) }}) / {{ mapping.yScale.toPrecision(8) }}</div>
          <div class="mono">y' 偏移符号：{{ signed(mapping.yOffset) }}</div>
          <div class="mono">峰面积 ∝ 1 / (xScale · yScale)</div>
        </div>
      </PanelCard>

      <PanelCard title="导入 Jade" :icon="FileOutput">
        <ol class="jade-steps">
          <li>Jade → File → Read，选择导出的 <code>.xy</code>。</li>
          <li>确认横坐标为 2θ（或归一化 X），纵坐标为强度且全为正。</li>
          <li>背底、寻峰、拟合完成后，File → Save → DIF。</li>
          <li>回到本工具的「DIF → XY」，加载配方并导出多列数据。</li>
        </ol>
      </PanelCard>
    </template>

    <template v-if="!hasData">
      <EmptyState
        title="还没有可导出的数据"
        description="先在「导入与预处理」中导入文件或载入示例，添加 Jade 映射后即可导出。"
      >
        <el-button type="primary" size="small" @click="$router.push('/data/import')">去导入数据</el-button>
      </EmptyState>
    </template>

    <template v-else>
      <div class="jade-stats">
        <div class="stat">
          <div class="stat__label">映射后 X</div>
          <div class="stat__value">
            {{ mapping ? `${mapping.outputX[0].toFixed(3)} – ${mapping.outputX[1].toFixed(3)}` : '—' }}
          </div>
        </div>
        <div class="stat">
          <div class="stat__label">映射后 Y</div>
          <div class="stat__value">
            {{ mapping ? `${mapping.outputY[0].toPrecision(5)} – ${mapping.outputY[1].toPrecision(5)}` : '—' }}
          </div>
        </div>
        <div class="stat">
          <div class="stat__label">数据点</div>
          <div class="stat__value">{{ project.derived?.x.length.toLocaleString() }}</div>
        </div>
        <div class="stat">
          <div class="stat__label">状态</div>
          <div class="stat__value" :style="{ color: canExport ? 'var(--ok)' : 'var(--danger)' }">
            {{ canExport ? '可导出' : '需修复' }}
          </div>
        </div>
      </div>

      <PanelCard title="映射后预览" :icon="Sparkles" hint="这就是 Jade 将读到的曲线">
        <SciChart
          :series="mappedSeries"
          :x-label="project.derived?.meta.xLabel"
          :x-unit="project.derived?.meta.xUnit"
          :y-label="project.derived?.meta.yLabel"
          :y-unit="project.derived?.meta.yUnit"
          :height="360"
        />
      </PanelCard>

      <PanelCard title="文件预览" :icon="FileOutput" hint="前 14 行">
        <div class="preview-box">
          <button class="icon-btn preview-copy" type="button" title="复制全文" @click="copyPreview">
            <ClipboardCopy />
          </button>
          <pre class="mono">{{ previewLines }}</pre>
        </div>
      </PanelCard>
    </template>
  </ToolPage>
</template>

<style scoped>
.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 3px;
}

.mapping-empty {
  padding: 2px;
}

.mapping-box {
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid var(--accent-line);
  background: var(--accent-soft);
}

.mapping-box__line {
  font-size: 10.5px;
  color: var(--text-2);
  line-height: 1.6;
  word-break: break-all;
}

.mapping-box__range {
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-3);
  line-height: 1.5;
}

.inverse-box {
  margin-top: 10px;
  padding: 9px 10px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10.5px;
  color: var(--text-2);
  word-break: break-all;
}

.jade-steps {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-2);
  line-height: 1.55;
}

.jade-steps code {
  font-size: 10.5px;
}

.jade-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.preview-box {
  position: relative;
  max-height: 260px;
  overflow: auto;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--code-bg);
}

.preview-box pre {
  margin: 0;
  padding: 11px 13px;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--text-2);
}

.preview-copy {
  position: sticky;
  float: right;
  top: 6px;
  right: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

@media (max-width: 720px) {
  .jade-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
