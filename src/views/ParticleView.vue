<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  BarChart3,
  Camera,
  CircleDot,
  Copy,
  Crosshair,
  Download,
  FileText,
  Hand,
  ImagePlus,
  Maximize2,
  Minimize2,
  Ruler,
  ScanSearch,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
} from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState, ResultTab } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import FileDrop from '@/components/common/FileDrop.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ParticleCanvas, { type ImageLine } from '@/components/micro/ParticleCanvas.vue'
import ParticleHistogram from '@/components/micro/ParticleHistogram.vue'
import {
  buildParticleReport,
  convertNmTo,
  createAreaMeasurement,
  createLineMeasurement,
  detectParticles,
  histogramCsv,
  makeCalibration,
  measurementCsv,
  nanoMeasureReport,
  renameMeasurementIndexes,
  type Calibration,
  type DetectedParticle,
  type GaussianFit,
  type LognormalFit,
  type LengthUnit,
  type ParticleMeasurement,
} from '@/core/micro/particles'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const drawer = ref<DrawerState>('closed')
const resultTabs: ResultTab[] = ['text', 'download', 'copy']
const fileInput = ref<HTMLInputElement | null>(null)
const canvasRef = ref<InstanceType<typeof ParticleCanvas> | null>(null)
const histogramRef = ref<InstanceType<typeof ParticleHistogram> | null>(null)

const image = ref<HTMLImageElement | null>(null)
const imageUrl = ref('')
const imageName = ref('')
const imageBytes = ref(0)
const mode = ref<'calibrate' | 'measure' | 'pan'>('calibrate')

const calibration = ref<Calibration | null>(null)
const calibrationLine = ref<ImageLine | null>(null)
const pendingLine = ref<(ImageLine & { lengthPx: number }) | null>(null)
const scaleLength = ref(500)
const scaleUnit = ref<LengthUnit>('nm')

const measurements = ref<ParticleMeasurement[]>([])
const selectedId = ref<string | null>(null)
const detections = ref<DetectedParticle[] | null>(null)
const detectBusy = ref(false)
const detectInfo = ref('')
const detectWarnings = ref<string[]>([])

const invert = ref(false)
const thresholdMode = ref<'auto' | 'manual'>('auto')
const manualThreshold = ref(128)
const minArea = ref(20)
const maxCircularity = ref(2.5)

const unit = ref<LengthUnit>('nm')
const binCount = ref(10)
const showLabels = ref(true)
const showDetections = ref(true)
const labelColor = ref('#dc2626')

const focusMode = ref(false)
const focusCanvasHeight = ref(560)
const workspaceRef = ref<HTMLElement | null>(null)

let idCounter = 0
let objectUrl = ''

const hasImage = computed(() => Boolean(image.value))
const imageWidth = computed(() => image.value?.naturalWidth ?? 0)
const imageHeight = computed(() => image.value?.naturalHeight ?? 0)
const nmPerPx = computed(() => calibration.value?.nmPerPx ?? NaN)
const canMeasure = computed(() => Boolean(calibration.value))

const report = computed(() =>
  buildParticleReport(measurements.value, {
    unit: unit.value,
    calibration: calibration.value,
    imageName: imageName.value,
    binCount: binCount.value,
  }),
)
const stats = computed(() => report.value.stats)
const histogram = computed(() => report.value.histogram)
const gaussian = computed<GaussianFit | null>(() => report.value.gaussian)
const lognormal = computed<LognormalFit | null>(() => report.value.lognormal)

const statsCards = computed(() => [
  { label: '颗粒数', value: stats.value.n ? String(stats.value.n) : '—', unit: '个' },
  { label: '平均粒径', value: fmt(stats.value.mean), unit: unit.value },
  { label: '中位径 D50', value: fmt(stats.value.median), unit: unit.value },
  { label: '标准差 σ', value: fmt(stats.value.std), unit: unit.value },
  { label: 'D10 / D90', value: `${fmt(stats.value.d10)} / ${fmt(stats.value.d90)}`, unit: unit.value },
  { label: '跨度 Span', value: fmt(stats.value.span, 3), unit: '' },
])

const reportText = computed(() => {
  if (!measurements.value.length) {
    return [
      'CrystalToolBox · 颗粒尺寸测量报告',
      '',
      '尚未测量颗粒。',
      '步骤：① 拖拽画线选取图像中的标尺并输入真实长度；② 应用标尺；③ 拖拽测量颗粒或自动识别。',
    ].join('\r\n')
  }
  return nanoMeasureReport(
    measurements.value,
    {
      stats: stats.value,
      histogram: histogram.value,
      gaussian: gaussian.value,
      lognormal: lognormal.value,
    },
    {
      unit: unit.value,
      calibration: calibration.value,
      imageName: imageName.value,
      binCount: binCount.value,
    },
  )
})

const pendingLengthText = computed(() => {
  if (!pendingLine.value) return ''
  return `${pendingLine.value.lengthPx.toFixed(2)} px`
})

const suggestedScaleText = computed(() => {
  if (!pendingLine.value) return ''
  const factor = scaleUnit.value === 'nm' ? 1 : scaleUnit.value === 'um' ? 1e3 : 1e6
  const perPx = (scaleLength.value * factor) / pendingLine.value.lengthPx
  return `${perPx.toFixed(4)} nm/px`
})

function fmt(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function fileSizeText(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function openPicker() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void loadFile(file)
  input.value = ''
}

function onFiles(files: File[]) {
  if (files[0]) void loadFile(files[0])
}

async function loadFile(file: File) {
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|bmp|webp|gif|tiff?)$/i.test(file.name)
  if (!isImage) {
    ElMessage.error('请选择 PNG / JPEG / BMP / WebP 等图像文件')
    return
  }
  try {
    const url = URL.createObjectURL(file)
    const img = await loadImage(url)
    adoptImage(img, url, file.name, file.size)
    ElMessage.success('图像已载入，请先标定标尺')
  } catch {
    ElMessage.error('图片无法打开；TIFF 等格式请先转换为 PNG 或 JPEG')
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = url
  })
}

function adoptImage(img: HTMLImageElement, url: string, name: string, bytes: number) {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = url
  image.value = img
  imageUrl.value = url
  imageName.value = name
  imageBytes.value = bytes
  resetMeasurements()
  calibration.value = null
  calibrationLine.value = null
  pendingLine.value = null
  detections.value = null
  detectInfo.value = ''
  detectWarnings.value = []
  scaleLength.value = 500
  scaleUnit.value = 'nm'
  mode.value = 'calibrate'
}

function resetMeasurements() {
  measurements.value = []
  selectedId.value = null
}

function setMode(next: 'calibrate' | 'measure' | 'pan') {
  if (next === 'measure' && !canMeasure.value) {
    ElMessage.warning('请先完成标尺标定（画线并输入真实长度）')
    mode.value = 'calibrate'
    return
  }
  mode.value = next
}

function onCalibrate(line: ImageLine & { lengthPx: number }) {
  pendingLine.value = line
  calibrationLine.value = { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 }
}

function applyCalibration() {
  if (!pendingLine.value) {
    ElMessage.warning('请先在图像上拖拽画一条标尺线')
    return
  }
  try {
    const next = makeCalibration(pendingLine.value.lengthPx, scaleLength.value, scaleUnit.value)
    calibration.value = next
    mode.value = 'measure'
    rescaleMeasurements()
    ElMessage.success(`标尺已应用：${next.nmPerPx.toFixed(4)} nm/px`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

function rescaleMeasurements() {
  if (!calibration.value) return
  measurements.value = measurements.value.map((m) => ({
    ...m,
    sizeNm: m.lengthPx * calibration.value!.nmPerPx,
  }))
}

function onMeasure(line: ImageLine & { lengthPx: number }) {
  if (!calibration.value) {
    ElMessage.warning('请先完成标尺标定')
    return
  }
  const m = createLineMeasurement(
    `m-${++idCounter}`,
    measurements.value.length + 1,
    line.x1,
    line.y1,
    line.x2,
    line.y2,
    calibration.value.nmPerPx,
  )
  measurements.value = [...measurements.value, m]
  selectedId.value = m.id
}

function removeMeasurement(id: string) {
  measurements.value = renameMeasurementIndexes(measurements.value.filter((m) => m.id !== id))
  if (selectedId.value === id) selectedId.value = null
}

function undoMeasurement() {
  if (!measurements.value.length) return
  measurements.value = renameMeasurementIndexes(measurements.value.slice(0, -1))
  selectedId.value = null
}

async function clearMeasurements() {
  if (!measurements.value.length) return
  try {
    await ElMessageBox.confirm('确定清空全部测量记录？', '清空测量', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
    resetMeasurements()
  } catch {
    /* cancelled */
  }
}

async function runDetection() {
  if (!image.value) return
  detectBusy.value = true
  detections.value = null
  detectWarnings.value = []
  await new Promise((resolve) => setTimeout(resolve, 30))
  try {
    const img = image.value
    const maxDim = Math.max(img.naturalWidth, img.naturalHeight)
    const scale = Math.min(1, 1500 / maxDim)
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const c = off.getContext('2d', { willReadFrequently: true })
    if (!c) throw new Error('识别失败，请重试')
    c.drawImage(img, 0, 0, w, h)
    const data = c.getImageData(0, 0, w, h).data
    const result = detectParticles({
      width: w,
      height: h,
      data,
      invert: invert.value,
      threshold: thresholdMode.value === 'manual' ? manualThreshold.value : undefined,
      minAreaPx: minArea.value,
      maxCircularity: maxCircularity.value,
      connectivity: 8,
    })
    detections.value = result.particles.map((p) => ({
      ...p,
      cx: p.cx / scale,
      cy: p.cy / scale,
      areaPx: p.areaPx / (scale * scale),
      perimeterPx: p.perimeterPx / scale,
      widthPx: p.widthPx / scale,
      heightPx: p.heightPx / scale,
      equivalentDiameterPx: p.equivalentDiameterPx / scale,
    }))
    manualThreshold.value = result.threshold
    detectInfo.value = `阈值 ${result.threshold} · 前景 ${((result.foregroundPixels / (w * h)) * 100).toFixed(1)}% · ${result.particles.length} 个`
    detectWarnings.value = result.warnings
    if (result.particles.length) ElMessage.success(`识别到 ${result.particles.length} 个候选颗粒`)
    else ElMessage.warning('没有识别到满足条件的颗粒，请调整阈值或面积范围')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    detectBusy.value = false
  }
}

function adoptDetections() {
  if (!detections.value?.length) return
  if (!calibration.value) {
    ElMessage.warning('请先完成标尺标定，再把识别结果换算为真实尺寸')
    return
  }
  const added = detections.value.map((p) =>
    createAreaMeasurement(
      `a-${++idCounter}`,
      measurements.value.length + 1,
      p.cx,
      p.cy,
      p.areaPx,
      p.perimeterPx,
      p.circularity,
      calibration.value!.nmPerPx,
    ),
  )
  measurements.value = renameMeasurementIndexes([...measurements.value, ...added])
  selectedId.value = added[0]?.id ?? null
  detections.value = null
  detectInfo.value = ''
  ElMessage.success(`已加入 ${added.length} 个自动测量结果`)
}

function expectedCount(fit: GaussianFit | LognormalFit | null, low: number, high: number): string {
  return fit ? fit.expectedCount(low, high, stats.value.n).toFixed(2) : '—'
}

function selectMeasurement(id: string) {
  selectedId.value = id
}

function checkReportReady(): boolean {
  if (!measurements.value.length) {
    ElMessage.warning('还没有测量数据')
    return false
  }
  return true
}

function baseName(): string {
  return safeFilename(imageName.value || 'particles', 'x').replace(/\.x$/, '')
}

function exportMeasurementCsv() {
  if (!checkReportReady()) return
  const text = '\uFEFF' + measurementCsv(measurements.value, unit.value)
  downloadText(text, `${baseName()}_measurements_${timestamp()}.csv`, 'text/csv;charset=utf-8')
  ElMessage.success('已导出测量表 CSV')
}

function exportHistogramCsv() {
  if (!checkReportReady()) return
  const text = '\uFEFF' + histogramCsv(report.value, unit.value)
  downloadText(text, `${baseName()}_histogram_${timestamp()}.csv`, 'text/csv;charset=utf-8')
  ElMessage.success('已导出分组统计 CSV')
}

function exportReport() {
  if (!checkReportReady()) return
  downloadText('\uFEFF' + reportText.value, `${baseName()}_report_${timestamp()}.txt`, 'text/plain;charset=utf-8')
  ElMessage.success('已导出 NanoMeasure 风格报告')
}

function exportJson() {
  if (!checkReportReady()) return
  const payload = {
    schema: 'crystal-toolbox/particles@1',
    image: { name: imageName.value, width: imageWidth.value, height: imageHeight.value },
    calibration: calibration.value,
    unit: unit.value,
    stats: stats.value,
    histogram: histogram.value,
    gaussian: gaussian.value ? { mean: gaussian.value.mean, sigma: gaussian.value.sigma } : null,
    lognormal: lognormal.value
      ? {
          mu: lognormal.value.mu,
          sigma: lognormal.value.sigma,
          median: lognormal.value.median,
          mean: lognormal.value.mean,
          mode: lognormal.value.mode,
        }
      : null,
    measurements: measurements.value,
  }
  downloadText(
    JSON.stringify(payload, null, 2),
    `${baseName()}_project_${timestamp()}.json`,
    'application/json;charset=utf-8',
  )
  ElMessage.success('已导出工程文件')
}

function exportAnnotatedPng() {
  if (!image.value) return
  void canvasRef.value?.exportPng(`${baseName()}_annotated_${timestamp()}.png`, 2)
  ElMessage.success('正在导出标注图')
}

function exportHistogramPng() {
  if (!checkReportReady()) return
  void histogramRef.value?.exportPng(`${baseName()}_histogram_${timestamp()}.png`)
  ElMessage.success('正在导出分布图')
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(reportText.value)
    ElMessage.success('已复制报告文本')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}

function loadDemo() {
  const width = 1000
  const height = 760
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const c = canvas.getContext('2d')
  if (!c) return
  const gradient = c.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#d6dade')
  gradient.addColorStop(1, '#aeb5bb')
  c.fillStyle = gradient
  c.fillRect(0, 0, width, height)

  // Film-grain noise for a SEM-like background.
  const noise = c.getImageData(0, 0, width, height)
  let seed = 1234567
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  for (let i = 0; i < noise.data.length; i += 4) {
    const n = (random() - 0.5) * 18
    noise.data[i] = Math.max(0, Math.min(255, noise.data[i] + n))
    noise.data[i + 1] = Math.max(0, Math.min(255, noise.data[i + 1] + n))
    noise.data[i + 2] = Math.max(0, Math.min(255, noise.data[i + 2] + n))
  }
  c.putImageData(noise, 0, 0)

  // Agglomerated pseudo-particles.
  for (let i = 0; i < 95; i++) {
    const x = 70 + random() * (width - 140)
    const y = 70 + random() * (height - 210)
    const r = 5 + random() * 18
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
    g.addColorStop(0, `rgba(${98 + random() * 30}, ${104 + random() * 30}, ${110 + random() * 30}, 0.98)`)
    g.addColorStop(0.75, `rgba(${52 + random() * 24}, ${57 + random() * 24}, ${62 + random() * 24}, 0.98)`)
    g.addColorStop(1, 'rgba(38, 42, 47, 0.35)')
    c.fillStyle = g
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
  }

  // Scale bar: 200 px = 500 nm.
  c.strokeStyle = '#ffffff'
  c.lineWidth = 5
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(60, 700)
  c.lineTo(260, 700)
  c.stroke()
  c.fillStyle = '#ffffff'
  c.font = '600 22px system-ui, sans-serif'
  c.textAlign = 'left'
  c.textBaseline = 'bottom'
  c.fillText('500 nm', 60, 688)
  c.font = '14px system-ui, sans-serif'
  c.fillStyle = 'rgba(255,255,255,0.8)'
  c.fillText('示例 SEM 图像 · 仅用于演示', 60, 736)

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    void loadImage(url).then((img) => {
      adoptImage(img, url, '示例图像.png', blob.size)
      const line = { x1: 60, y1: 700, x2: 260, y2: 700, lengthPx: 200 }
      pendingLine.value = line
      calibrationLine.value = { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 }
      scaleLength.value = 500
      scaleUnit.value = 'nm'
      calibration.value = makeCalibration(200, 500, 'nm')
      pendingLine.value = null
      mode.value = 'measure'
      ElMessage.success('示例图已载入，标尺已设为 200 px = 500 nm')
    })
  }, 'image/png')
}

function clearWorkspace() {
  resetMeasurements()
  calibration.value = null
  calibrationLine.value = null
  pendingLine.value = null
  detections.value = null
  detectInfo.value = ''
  detectWarnings.value = []
  mode.value = 'calibrate'
}

function syncFocusHeight() {
  if (!focusMode.value) {
    focusCanvasHeight.value = 560
    return
  }
  const chrome = window.innerWidth < 900 ? 190 : 118
  focusCanvasHeight.value = Math.max(360, window.innerHeight - chrome)
}

async function enterFocus() {
  if (!hasImage.value || !canMeasure.value) {
    ElMessage.warning('请先完成标尺标定')
    return
  }
  focusMode.value = true
  syncFocusHeight()
  await nextTick()
  try {
    await workspaceRef.value?.requestFullscreen?.()
  } catch {
    /* 放大工作区即可；不强制系统全屏 */
  }
}

async function exitFocus() {
  focusMode.value = false
  syncFocusHeight()
  await nextTick()
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen()
    } catch {
      /* ignore */
    }
  }
}

function toggleFocus() {
  if (focusMode.value) void exitFocus()
  else void enterFocus()
}

function onWindowResize() {
  if (focusMode.value) {
    syncFocusHeight()
    void nextTick(() => canvasRef.value?.fit())
  }
}

function onFullscreenChange() {
  if (!document.fullscreenElement && focusMode.value) {
    focusMode.value = false
    syncFocusHeight()
  }
}

function onFocusKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && focusMode.value) {
    event.preventDefault()
    void exitFocus()
  }
}

onMounted(() => {
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('keydown', onFocusKeydown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', onFocusKeydown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (document.fullscreenElement) void document.exitFullscreen()
})
</script>

<template>
  <ToolPage
    tool-id="particles"
    title="颗粒尺寸测量"
    subtitle="类 NanoMeasure 的 SEM/TEM 粒径工作流：先用图像标尺标定比例，再逐颗画线测量或自动识别，实时统计并导出 CSV / TXT / PNG。"
    eyebrow="显微分析 · 01"
    doc="/docs/userguide/particles"
    v-model:result-state="drawer"
    result-title="测量报告与导出"
    :result-tabs="resultTabs"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" :disabled="!measurements.length" @click="drawer = 'half'">
        查看统计报告
      </button>
      <button type="button" class="btn" :disabled="!measurements.length" @click="exportMeasurementCsv">
        <Download /> 测量 CSV
      </button>
      <button type="button" class="btn" :disabled="!measurements.length" @click="exportReport">
        <FileText /> TXT 报告
      </button>
    </template>

    <template #source>
      <PanelCard title="图像" :icon="ImagePlus">
        <FileDrop
          accept="image/*"
          title="拖入 SEM/TEM 图像"
          hint="PNG / JPEG / BMP / WebP；也可点击选择"
          @files="onFiles"
        />
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
        <div class="btn-row" style="margin-top: 8px">
          <button type="button" class="btn btn--quiet" @click="openPicker">选择图像</button>
          <button type="button" class="btn btn--quiet" @click="loadDemo">载入示例图</button>
          <button v-if="hasImage" type="button" class="btn btn--quiet" @click="clearWorkspace">重置标定</button>
        </div>
        <div v-if="hasImage" class="image-meta">
          <div class="image-meta__name">{{ imageName }}</div>
          <div class="image-meta__sub mono">
            {{ imageWidth }} × {{ imageHeight }} px
            <span v-if="imageBytes">· {{ fileSizeText(imageBytes) }}</span>
          </div>
        </div>
      </PanelCard>
    </template>

    <template #config>
      <PanelCard title="① 标尺标定" :icon="Ruler">
        <p class="tiny dim" style="margin-bottom: 8px">
          在图像上拖拽画一条线，使其覆盖 SEM 自带的标尺；再输入标尺的真实长度。
        </p>
        <div class="btn-row">
          <button
            type="button"
            class="btn btn--quiet"
            :class="{ 'is-active': mode === 'calibrate' }"
            :disabled="!hasImage"
            @click="setMode('calibrate')"
          >
            <Crosshair /> 画标尺
          </button>
          <span v-if="pendingLengthText" class="chip chip--mono">{{ pendingLengthText }}</span>
        </div>
        <div v-if="pendingLine" class="calibration-form">
          <div class="grid-2">
            <NumberField v-model="scaleLength" label="真实长度" :min="0.0001" :precision="4" />
            <label class="field">
              <span class="field__label">单位</span>
              <el-select v-model="scaleUnit" size="small">
                <el-option label="nm" value="nm" />
                <el-option label="µm" value="um" />
                <el-option label="mm" value="mm" />
              </el-select>
            </label>
          </div>
          <div class="tiny dim mono">预计比例：{{ suggestedScaleText }}</div>
          <button type="button" class="btn btn--primary" @click="applyCalibration">应用标尺</button>
        </div>
        <div v-else-if="calibration" class="calibration-ok">
          <span class="chip chip--ok"><Ruler /> 已标定</span>
          <span class="mono">{{ calibration.nmPerPx.toFixed(4) }} nm/px</span>
        </div>
        <p v-else class="tiny dim">尚未标定。可先载入示例图体验。</p>
      </PanelCard>

      <PanelCard title="② 测量颗粒" :icon="CircleDot">
        <div class="segmented" role="tablist" aria-label="测量模式">
          <button
            type="button"
            class="segmented__btn"
            :aria-selected="mode === 'measure'"
            :disabled="!canMeasure"
            @click="setMode('measure')"
          >
            <Crosshair /> 画线测量
          </button>
          <button type="button" class="segmented__btn" :aria-selected="mode === 'pan'" @click="setMode('pan')">
            <Hand /> 平移
          </button>
        </div>
        <div class="measure-actions">
          <span class="chip chip--accent">{{ measurements.length }} 个</span>
          <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="undoMeasurement">
            <Undo2 /> 撤销
          </button>
          <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="clearMeasurements">
            <Trash2 /> 清空
          </button>
          <button type="button" class="btn btn--quiet" :disabled="!canMeasure" @click="enterFocus">
            <Maximize2 /> 全屏
          </button>
        </div>
        <label class="inline small muted">
          <el-switch v-model="showLabels" size="small" />
          显示序号
        </label>
        <label class="inline small muted">
          序号颜色
          <input v-model="labelColor" type="color" class="color-input" />
        </label>
        <p class="tiny dim">每次拖拽记录一条 Feret 直径；点击序号或表中的行可选中，滚轮缩放、Shift+拖拽平移。</p>
      </PanelCard>
    </template>

    <template #params>
      <PanelCard title="③ 自动识别（可选）" :icon="ScanSearch">
        <label class="inline small muted">
          <el-switch v-model="invert" size="small" />
          亮颗粒 / 暗背底
        </label>
        <div class="segmented" role="tablist" aria-label="阈值模式">
          <button
            type="button"
            class="segmented__btn"
            :aria-selected="thresholdMode === 'auto'"
            @click="thresholdMode = 'auto'"
          >
            自动阈值
          </button>
          <button
            type="button"
            class="segmented__btn"
            :aria-selected="thresholdMode === 'manual'"
            @click="thresholdMode = 'manual'"
          >
            手动阈值
          </button>
        </div>
        <div v-if="thresholdMode === 'manual'" class="threshold-row">
          <input v-model.number="manualThreshold" type="range" min="0" max="255" step="1" />
          <span class="mono">{{ manualThreshold }}</span>
        </div>
        <div class="grid-2">
          <NumberField v-model="minArea" label="最小面积" unit="px²" :min="1" :precision="0" />
          <NumberField v-model="maxCircularity" label="最大圆度" :min="0.1" :max="10" :precision="2" />
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn--quiet" :disabled="!hasImage || detectBusy" @click="runDetection">
            <Wand2 /> {{ detectBusy ? '识别中…' : '识别候选' }}
          </button>
          <button
            type="button"
            class="btn btn--quiet"
            :disabled="!detections?.length || !canMeasure"
            @click="adoptDetections"
          >
            采纳 {{ detections?.length ?? 0 }} 个
          </button>
        </div>
        <div v-if="detectInfo" class="tiny dim mono">{{ detectInfo }}</div>
        <div v-for="warning in detectWarnings" :key="warning" class="tiny" style="color: var(--warn)">
          {{ warning }}
        </div>
        <label class="inline small muted" style="margin-top: 4px">
          <el-switch v-model="showDetections" size="small" />
          显示候选圈
        </label>
        <p class="tiny dim">自动识别适合高对比、分散的颗粒；粘连颗粒会被合并。</p>
      </PanelCard>

      <PanelCard title="④ 统计与导出" :icon="BarChart3">
        <div class="grid-2">
          <label class="field">
            <span class="field__label">显示单位</span>
            <el-select v-model="unit" size="small">
              <el-option label="nm" value="nm" />
              <el-option label="µm" value="um" />
              <el-option label="mm" value="mm" />
            </el-select>
          </label>
          <NumberField v-model="binCount" label="分组数" :min="3" :max="40" :precision="0" />
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="exportMeasurementCsv">
            <Download /> 测量表
          </button>
          <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="exportHistogramCsv">
            <Download /> 分组表
          </button>
          <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="exportReport">
            <FileText /> TXT
          </button>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="exportAnnotatedPng">
            <Camera /> 标注图
          </button>
          <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="exportHistogramPng">
            <BarChart3 /> 分布图
          </button>
          <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="exportJson">
            JSON
          </button>
        </div>
      </PanelCard>
    </template>

    <template #more>
      <PanelCard title="口径与限制" :icon="Sparkles">
        <ul class="tips">
          <li>手动画线得到的是沿测量方向的 Feret 直径；自动识别给出面积等效圆直径。</li>
          <li>标尺线越短，比例误差越大；建议覆盖整条标尺并尽量水平/垂直。</li>
          <li>更改标尺后会按像素长度重算已有测量；更换图像会清空当前测量。</li>
          <li>统计默认采用 NanoMeasure 的上偏分组：2.5 落在 2.5–3.0 组。</li>
          <li>测量结果不会自动保存；离开页面前请导出需要的数据。</li>
        </ul>
      </PanelCard>
    </template>

    <div v-if="!hasImage" class="intro">
      <EmptyState
        :icon="ImagePlus"
        title="载入一张 SEM/TEM 图像开始"
        description="支持 PNG、JPEG、BMP、WebP。先画标尺，再测颗粒；也可以先载入内置示例图熟悉流程。"
      >
        <button type="button" class="btn btn--primary" @click="openPicker">选择图像</button>
        <button type="button" class="btn" @click="loadDemo">载入示例图</button>
      </EmptyState>
      <div class="workflow">
        <div class="workflow__step"><b>01</b><span>拖拽画线覆盖标尺，输入真实长度</span></div>
        <div class="workflow__step"><b>02</b><span>逐颗拖拽测量，或阈值自动识别</span></div>
        <div class="workflow__step"><b>03</b><span>实时统计，导出 CSV / TXT / PNG</span></div>
      </div>
    </div>

    <template v-else>
      <div ref="workspaceRef" class="measure-workspace" :class="{ 'is-focus': focusMode }" aria-label="颗粒测量工作区">
        <div class="image-toolbar">
          <div class="image-toolbar__info">
            <span class="chip chip--mono">{{ imageWidth }} × {{ imageHeight }} px</span>
            <span v-if="calibration" class="chip chip--ok"><Ruler /> {{ calibration.nmPerPx.toFixed(4) }} nm/px</span>
            <span v-else class="chip chip--warn">未标定比例</span>
            <span class="chip">{{ measurements.length }} 个测量</span>
          </div>
          <div class="image-toolbar__actions">
            <button type="button" class="btn btn--quiet" @click="canvasRef?.fit()">适应窗口</button>
            <button type="button" class="icon-btn" title="放大" @click="canvasRef?.zoomIn()">＋</button>
            <button type="button" class="icon-btn" title="缩小" @click="canvasRef?.zoomOut()">－</button>
            <button
              v-if="!focusMode"
              type="button"
              class="btn btn--quiet"
              :class="{ 'is-active': mode === 'calibrate' }"
              @click="setMode('calibrate')"
            >
              <Crosshair /> 标尺
            </button>
            <button
              type="button"
              class="btn btn--quiet"
              :class="{ 'is-active': mode === 'measure' }"
              :disabled="!canMeasure"
              @click="setMode('measure')"
            >
              <CircleDot /> 测量
            </button>
            <button
              type="button"
              class="btn btn--quiet"
              :class="{ 'is-active': mode === 'pan' }"
              @click="setMode('pan')"
            >
              <Hand /> 平移
            </button>
            <button v-if="!focusMode" type="button" class="btn btn--quiet" :disabled="!canMeasure" @click="enterFocus">
              <Maximize2 /> 全屏测量
            </button>
            <template v-else>
              <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="undoMeasurement">
                <Undo2 /> 撤销
              </button>
              <button type="button" class="btn btn--quiet" :disabled="!measurements.length" @click="clearMeasurements">
                <Trash2 /> 清空
              </button>
              <button type="button" class="btn btn--primary" @click="exitFocus"><Minimize2 /> 退出全屏</button>
            </template>
          </div>
        </div>

        <ParticleCanvas
          ref="canvasRef"
          :image="image"
          :mode="mode"
          :calibration="calibration"
          :calibration-line="calibrationLine"
          :measurements="measurements"
          :selected-id="selectedId"
          :detections="detections"
          :unit="unit"
          :show-labels="showLabels"
          :show-detections="showDetections"
          :label-color="labelColor"
          :height="focusMode ? focusCanvasHeight : 560"
          @calibrate="onCalibrate"
          @measure="onMeasure"
          @select="selectedId = $event"
        />
      </div>

      <div class="stats-grid">
        <div v-for="card in statsCards" :key="card.label" class="micro-stat">
          <span class="micro-stat__label">{{ card.label }}</span>
          <span class="micro-stat__value mono">{{ card.value }}</span>
          <span v-if="card.unit" class="micro-stat__unit">{{ card.unit }}</span>
        </div>
      </div>

      <div class="result-grid">
        <PanelCard title="粒径分布" :icon="BarChart3" :hint="histogram.rule">
          <ParticleHistogram
            ref="histogramRef"
            :bins="histogram.bins"
            :unit="unit"
            :gaussian="gaussian"
            :lognormal="lognormal"
            :height="300"
          />
          <div class="fit-line mono">
            <span v-if="gaussian"
              >Gaussian: μ = {{ gaussian.mean.toFixed(3) }} {{ unit }}, σ = {{ gaussian.sigma.toFixed(3) }}</span
            >
            <span v-if="lognormal"
              >Log-normal: median = {{ lognormal.median.toFixed(3) }} {{ unit }}, σ<sub>ln</sub> =
              {{ lognormal.sigma.toFixed(3) }}</span
            >
            <span v-if="!gaussian && !lognormal" class="dim">至少 2 个数据点后显示拟合</span>
          </div>
        </PanelCard>

        <PanelCard title="测量记录" :icon="CircleDot" :hint="`${measurements.length} 条`">
          <div v-if="!measurements.length" class="small dim empty-measure">
            还没有测量。完成标定后，在图像上逐颗拖拽画线；或使用「自动识别」后采纳。
          </div>
          <div v-else class="table-wrap measurement-table">
            <table class="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th class="num">粒径</th>
                  <th>方法</th>
                  <th class="num">像素</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="m in measurements"
                  :key="m.id"
                  :class="{ 'is-selected': selectedId === m.id }"
                  @click="selectMeasurement(m.id)"
                >
                  <td class="mono">{{ m.index }}</td>
                  <td class="num">{{ convertNmTo(m.sizeNm, unit).toFixed(3) }} {{ unit }}</td>
                  <td class="text">{{ m.kind === 'line' ? 'Feret' : '面积等效圆' }}</td>
                  <td class="num">{{ m.lengthPx.toFixed(1) }}</td>
                  <td>
                    <button type="button" class="row-del" title="删除" @click.stop="removeMeasurement(m.id)">
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </PanelCard>
      </div>

      <PanelCard v-if="measurements.length" title="分组统计" :icon="BarChart3" :hint="`${histogram.binCount} 组`">
        <div class="table-wrap bin-table">
          <table class="data">
            <thead>
              <tr>
                <th>组区间 ({{ unit }})</th>
                <th class="num">计数</th>
                <th class="num">频率</th>
                <th class="num">Gaussian 期望</th>
                <th class="num">Log-normal 期望</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bin in histogram.bins" :key="bin.label">
                <td>{{ bin.label }}</td>
                <td class="num">{{ bin.count }}</td>
                <td class="num">{{ (bin.freq * 100).toFixed(1) }}%</td>
                <td class="num">{{ expectedCount(gaussian, bin.low, bin.high) }}</td>
                <td class="num">{{ expectedCount(lognormal, bin.low, bin.high) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="tiny dim" style="margin-top: 6px">
          分组采用左闭右开区间，末组含上限；期望计数 = n × 拟合分布在该区间的概率。
        </p>
      </PanelCard>
    </template>

    <template #text>
      <pre class="code-surface"><code>{{ reportText }}</code></pre>
    </template>

    <template #download>
      <div class="btn-row">
        <button type="button" class="btn" :disabled="!measurements.length" @click="exportMeasurementCsv">
          测量 CSV
        </button>
        <button type="button" class="btn" :disabled="!measurements.length" @click="exportHistogramCsv">分组 CSV</button>
        <button type="button" class="btn" :disabled="!measurements.length" @click="exportReport">TXT 报告</button>
        <button type="button" class="btn" :disabled="!measurements.length" @click="exportAnnotatedPng">标注 PNG</button>
        <button type="button" class="btn" :disabled="!measurements.length" @click="exportHistogramPng">分布 PNG</button>
        <button type="button" class="btn" :disabled="!measurements.length" @click="exportJson">工程 JSON</button>
      </div>
      <p class="section-note" style="margin-top: 8px">
        CSV 带 UTF-8 BOM，可直接用 Excel / Origin 打开；TXT 同时包含逐颗数据与分组统计。
      </p>
    </template>

    <template #copy>
      <div class="btn-row">
        <button type="button" class="btn" :disabled="!measurements.length" @click="copyReport">
          <Copy /> 复制报告
        </button>
      </div>
      <pre class="code-surface" style="margin-top: 10px"><code>{{ reportText }}</code></pre>
    </template>
  </ToolPage>
</template>

<style scoped>
.intro {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.workflow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.workflow__step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.5;
}

.workflow__step b {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
}

.image-meta {
  margin-top: 10px;
  padding: 8px 9px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
}

.image-meta__name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
}

.image-meta__sub {
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-3);
}

.calibration-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
}

.calibration-ok {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 9px;
  font-size: 11px;
  color: var(--text-2);
}

.measure-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.color-input {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  cursor: pointer;
}

.threshold-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.threshold-row input[type='range'] {
  flex: 1;
  accent-color: var(--accent);
}

.measure-workspace {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.measure-workspace.is-focus {
  position: fixed;
  inset: 0;
  z-index: 120;
  padding: 10px;
  background: var(--bg);
  overflow: hidden;
}

.measure-workspace.is-focus .image-toolbar {
  flex: 0 0 auto;
}

.image-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.image-toolbar__info,
.image-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.image-toolbar .icon-btn {
  width: 30px;
  height: 30px;
}

.btn.is-active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.micro-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.micro-stat__label {
  font-size: 9.5px;
  color: var(--text-3);
  letter-spacing: 0.03em;
}

.micro-stat__value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.micro-stat__unit {
  font-size: 9.5px;
  color: var(--text-3);
}

.result-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.85fr);
  gap: 14px;
  align-items: start;
}

.fit-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
  font-size: 9.5px;
  color: var(--text-3);
}

.measurement-table {
  max-height: 376px;
}

.measurement-table tr {
  cursor: pointer;
}

.row-del {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}

.row-del:hover {
  color: var(--danger);
  background: var(--danger-soft);
}

.row-del svg {
  width: 12px;
  height: 12px;
}

.empty-measure {
  padding: 18px 4px;
  line-height: 1.7;
}

.bin-table {
  max-height: 320px;
}

.tips {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-2);
}

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .result-grid {
    grid-template-columns: 1fr;
  }

  .workflow {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
