<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { downloadBlob } from '@/utils/download'
import type { Calibration, DetectedParticle, LengthUnit, ParticleMeasurement } from '@/core/micro/particles'
import { convertNmTo } from '@/core/micro/particles'

export interface ImageLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

const props = withDefaults(
  defineProps<{
    image: HTMLImageElement | null
    mode?: 'calibrate' | 'measure' | 'pan'
    calibration?: Calibration | null
    calibrationLine?: ImageLine | null
    measurements?: ParticleMeasurement[]
    selectedId?: string | null
    detections?: DetectedParticle[] | null
    unit?: LengthUnit
    showLabels?: boolean
    showDetections?: boolean
    labelColor?: string
    height?: number
  }>(),
  {
    mode: 'measure',
    calibration: null,
    calibrationLine: null,
    measurements: () => [],
    selectedId: null,
    detections: null,
    unit: 'nm',
    showLabels: true,
    showDetections: true,
    labelColor: '#2563eb',
    height: 560,
  },
)

const emit = defineEmits<{
  calibrate: [line: ImageLine & { lengthPx: number }]
  measure: [line: ImageLine & { lengthPx: number }]
  select: [id: string | null]
}>()

const wrap = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const size = reactive({ w: 0, h: 0, dpr: 1 })
const view = reactive({ scale: 1, x: 0, y: 0 })
const hover = ref<{ px: number; py: number; imageX: number; imageY: number } | null>(null)
const dragging = ref<null | {
  type: 'draw' | 'pan'
  startX: number
  startY: number
  lastX: number
  lastY: number
  imageX: number
  imageY: number
  moved: boolean
}>(null)
const preview = ref<ImageLine | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let observer: ResizeObserver | null = null
let fitDone = false

const imageWidth = computed(() => props.image?.naturalWidth ?? 0)
const imageHeight = computed(() => props.image?.naturalHeight ?? 0)
const zoomPercent = computed(() => Math.round(view.scale * 100))
const cursor = computed(() => (props.mode === 'pan' ? 'grab' : 'crosshair'))

function schedule() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    render()
  })
}

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function fit() {
  const height = props.height
  if (!props.image || !imageWidth.value || !size.w || !height) return
  const margin = 18
  const scale = Math.min((size.w - margin * 2) / imageWidth.value, (height - margin * 2) / imageHeight.value)
  view.scale = Math.max(0.005, Math.min(scale, 20))
  view.x = (size.w - imageWidth.value * view.scale) / 2
  view.y = (height - imageHeight.value * view.scale) / 2
  fitDone = true
  schedule()
}

function zoomAt(px: number, py: number, factor: number) {
  const before = screenToImage(px, py)
  const next = Math.min(20, Math.max(0.005, view.scale * factor))
  view.scale = next
  view.x = px - before.x * next
  view.y = py - before.y * next
  schedule()
}

function zoomBy(factor: number) {
  zoomAt(size.w / 2, size.h / 2, factor)
}

function screenToImage(px: number, py: number): { x: number; y: number } {
  return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale }
}

function imageToScreen(x: number, y: number): { x: number; y: number } {
  return { x: view.x + x * view.scale, y: view.y + y * view.scale }
}

function render() {
  const el = canvas.value
  const container = wrap.value
  if (!el || !container) return
  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = props.height
  if (!w) return
  if (size.w !== w || size.h !== h || size.dpr !== dpr) {
    size.w = w
    size.h = h
    size.dpr = dpr
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    if (!fitDone && props.image) fit()
  }
  ctx = el.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  draw(ctx, w, h, false)
}

function draw(context: CanvasRenderingContext2D, width: number, height: number, exportMode: boolean) {
  context.clearRect(0, 0, width, height)
  context.fillStyle = exportMode ? '#000000' : cssVar('--surface-2', '#f4f8fd')
  context.fillRect(0, 0, width, height)

  if (!props.image || !imageWidth.value) {
    context.fillStyle = cssVar('--text-3', '#7b91a8')
    context.font = `12px ${cssVar('--font-sans', 'sans-serif')}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('尚未载入图像', width / 2, height / 2)
    return
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(props.image, view.x, view.y, imageWidth.value * view.scale, imageHeight.value * view.scale)

  // Image border.
  if (!exportMode) {
    context.strokeStyle = cssVar('--border-strong', '#b6cee5')
    context.lineWidth = 1
    context.strokeRect(view.x, view.y, imageWidth.value * view.scale, imageHeight.value * view.scale)
  }

  // Auto-detection previews.
  if (props.showDetections && props.detections?.length) {
    context.strokeStyle = '#16a34a'
    context.fillStyle = 'rgba(22, 163, 74, 0.12)'
    context.lineWidth = Math.max(1, 1.2)
    for (const d of props.detections) {
      const p = imageToScreen(d.cx, d.cy)
      const r = Math.max(1.5, (d.equivalentDiameterPx / 2) * view.scale)
      context.beginPath()
      context.arc(p.x, p.y, r, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    }
  }

  // Calibration line.
  const line = preview.value
  if (props.calibrationLine) drawLine(context, props.calibrationLine, '#f59e0b', 2.2, '', exportMode)
  if (line) drawLine(context, line, props.mode === 'calibrate' ? '#f59e0b' : '#ef4444', 1.8, '', exportMode)

  // Measurements.
  const sorted = [...props.measurements].sort((a, b) => a.index - b.index)
  for (const m of sorted) {
    const selected = m.id === props.selectedId
    const color = selected ? '#dc2626' : props.labelColor
    if (m.kind === 'line') {
      drawLine(context, { x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2 }, color, selected ? 3 : 1.6, '', exportMode)
      if (props.showLabels) drawLabel(context, m.x1, m.y1, m.x2, m.y2, String(m.index), color, exportMode)
    } else {
      const p = imageToScreen(m.x1, m.y1)
      const r = Math.max(2, (m.lengthPx / 2) * view.scale)
      context.strokeStyle = color
      context.lineWidth = selected ? 3 : 1.5
      context.beginPath()
      context.arc(p.x, p.y, r, 0, Math.PI * 2)
      context.stroke()
      if (props.showLabels) {
        drawLabelAt(context, p.x + r * 0.7, p.y - r * 0.7, String(m.index), color, exportMode)
      }
    }
  }

  // Hover coordinates.
  if (!exportMode && hover.value) {
    context.strokeStyle = 'rgba(37,99,235,0.35)'
    context.setLineDash([2, 4])
    context.beginPath()
    context.moveTo(0, hover.value.py)
    context.lineTo(width, hover.value.py)
    context.moveTo(hover.value.px, 0)
    context.lineTo(hover.value.px, height)
    context.stroke()
    context.setLineDash([])
  }
}

function drawLine(
  context: CanvasRenderingContext2D,
  line: ImageLine,
  color: string,
  width: number,
  caption: string,
  exportMode: boolean,
) {
  const a = imageToScreen(line.x1, line.y1)
  const b = imageToScreen(line.x2, line.y2)
  context.save()
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = width
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(a.x, a.y)
  context.lineTo(b.x, b.y)
  context.stroke()
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const tick = 5
  for (const p of [a, b]) {
    context.beginPath()
    context.moveTo(p.x - nx * tick, p.y - ny * tick)
    context.lineTo(p.x + nx * tick, p.y + ny * tick)
    context.stroke()
  }
  if (caption) {
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    context.font = `10px ${cssVar('--font-mono', 'monospace')}`
    context.textAlign = 'center'
    context.textBaseline = 'bottom'
    context.fillStyle = exportMode ? color : cssVar('--surface', '#ffffff')
    const textWidth = context.measureText(caption).width
    context.fillRect(mx - textWidth / 2 - 3, my - 14, textWidth + 6, 12)
    context.fillStyle = color
    context.fillText(caption, mx, my - 4)
  }
  context.restore()
}

function drawLabel(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  text: string,
  color: string,
  exportMode: boolean,
) {
  const a = imageToScreen(x1, y1)
  const b = imageToScreen(x2, y2)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const mx = (a.x + b.x) / 2 - (dy / len) * 10
  const my = (a.y + b.y) / 2 + (dx / len) * 10
  drawLabelAt(context, mx, my, text, color, exportMode)
}

function drawLabelAt(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  exportMode: boolean,
) {
  context.save()
  context.font = `600 9.5px ${cssVar('--font-mono', 'monospace')}`
  const width = Math.max(13, context.measureText(text).width + 8)
  context.fillStyle = color
  context.beginPath()
  context.roundRect(x - width / 2, y - 8, width, 14, 4)
  context.fill()
  context.fillStyle = exportMode ? '#ffffff' : '#ffffff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, x, y - 0.5)
  context.restore()
}

function pointerPosition(event: PointerEvent): { px: number; py: number } {
  const el = canvas.value
  if (!el) return { px: 0, py: 0 }
  const rect = el.getBoundingClientRect()
  return { px: event.clientX - rect.left, py: event.clientY - rect.top }
}

function onPointerDown(event: PointerEvent) {
  if (!props.image) return
  const { px, py } = pointerPosition(event)
  const image = screenToImage(px, py)
  const pan = props.mode === 'pan' || event.button === 1 || event.shiftKey
  if (pan) {
    dragging.value = {
      type: 'pan',
      startX: px,
      startY: py,
      lastX: px,
      lastY: py,
      imageX: image.x,
      imageY: image.y,
      moved: false,
    }
  } else if (props.mode === 'calibrate' || props.mode === 'measure') {
    dragging.value = {
      type: 'draw',
      startX: px,
      startY: py,
      lastX: px,
      lastY: py,
      imageX: image.x,
      imageY: image.y,
      moved: false,
    }
    preview.value = { x1: image.x, y1: image.y, x2: image.x, y2: image.y }
  }
  if (dragging.value) {
    try {
      canvas.value?.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }
}

function onPointerMove(event: PointerEvent) {
  const { px, py } = pointerPosition(event)
  const image = screenToImage(px, py)
  hover.value = { px, py, imageX: image.x, imageY: image.y }
  const drag = dragging.value
  if (drag) {
    if (Math.hypot(px - drag.startX, py - drag.startY) > 2) drag.moved = true
    if (drag.type === 'pan') {
      view.x += px - drag.lastX
      view.y += py - drag.lastY
      drag.lastX = px
      drag.lastY = py
    } else {
      preview.value = { x1: drag.imageX, y1: drag.imageY, x2: image.x, y2: image.y }
    }
  }
  schedule()
}

function onPointerUp(event: PointerEvent) {
  const drag = dragging.value
  dragging.value = null
  if (drag) {
    try {
      canvas.value?.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
    const { px, py } = pointerPosition(event)
    if (drag.type === 'draw') {
      const end = screenToImage(px, py)
      const lengthPx = Math.hypot(end.x - drag.imageX, end.y - drag.imageY)
      if (lengthPx >= 3) {
        const line = { x1: drag.imageX, y1: drag.imageY, x2: end.x, y2: end.y, lengthPx }
        if (props.mode === 'calibrate') emit('calibrate', line)
        else emit('measure', line)
      }
    } else if (!drag.moved) {
      const hit = hitMeasurement(px, py)
      emit('select', hit)
    }
    preview.value = null
  }
  schedule()
}

function hitMeasurement(px: number, py: number): string | null {
  let best: string | null = null
  let bestDist = 12
  for (const m of props.measurements) {
    const a = imageToScreen(m.x1, m.y1)
    const b = imageToScreen(m.x2, m.y2)
    const d = pointSegmentDistance(px, py, a.x, a.y, b.x, b.y)
    if (d < bestDist) {
      bestDist = d
      best = m.id
    }
  }
  return best
}

function pointSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function onWheel(event: WheelEvent) {
  if (!props.image) return
  event.preventDefault()
  const el = canvas.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.12 : 1 / 1.12)
}

function onLeave() {
  hover.value = null
  schedule()
}

function onResize() {
  schedule()
}

watch(
  () => props.height,
  () => {
    fitDone = false
    schedule()
  },
)

watch(
  () => props.image,
  () => {
    fitDone = false
    nextTick(() => fit())
  },
)

watch(
  () => [
    props.mode,
    props.measurements,
    props.selectedId,
    props.detections,
    props.calibrationLine,
    props.showLabels,
    props.showDetections,
  ],
  () => schedule(),
  { deep: true },
)

onMounted(() => {
  observer = new ResizeObserver(onResize)
  if (wrap.value) observer.observe(wrap.value)
  nextTick(() => {
    render()
    fit()
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})

async function exportPng(filename = 'particle-measurement.png', scale = 2) {
  if (!props.image) return
  const width = imageWidth.value
  const height = imageHeight.value
  if (!width || !height) return
  const off = document.createElement('canvas')
  off.width = Math.round(width * scale)
  off.height = Math.round(height * scale)
  const c = off.getContext('2d')
  if (!c) return
  c.scale(scale, scale)
  const old = { scale: view.scale, x: view.x, y: view.y }
  view.scale = 1
  view.x = 0
  view.y = 0
  draw(c, width, height, true)
  view.scale = old.scale
  view.x = old.x
  view.y = old.y
  off.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename)
  }, 'image/png')
  schedule()
}

defineExpose({ fit, zoomIn: () => zoomBy(1.25), zoomOut: () => zoomBy(1 / 1.25), exportPng, zoomPercent })
</script>

<template>
  <div class="particle-canvas">
    <div ref="wrap" class="particle-canvas__wrap" :style="{ height: `${height}px` }">
      <canvas
        ref="canvas"
        class="particle-canvas__canvas"
        :style="{ cursor }"
        role="img"
        aria-label="颗粒测量图像"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onLeave"
        @wheel="onWheel"
        @dblclick="fit"
        @contextmenu.prevent
      />
      <div class="particle-canvas__hud mono">
        <span>{{ zoomPercent }}%</span>
        <span v-if="hover">x {{ hover.imageX.toFixed(0) }}, y {{ hover.imageY.toFixed(0) }}</span>
        <span v-if="calibration">{{ calibration.nmPerPx.toFixed(4) }} nm/px</span>
      </div>
      <div v-if="image" class="particle-canvas__hint">
        {{
          mode === 'calibrate'
            ? '拖拽画一条标尺线'
            : mode === 'measure'
              ? '拖拽测量颗粒；滚轮缩放，Shift+拖拽平移'
              : '拖拽平移；滚轮缩放'
        }}
      </div>
      <div v-if="image && calibration && measurements.length" class="particle-canvas__unit mono">
        {{ measurements.length }} 个 · {{ convertNmTo(measurements[0].sizeNm, unit).toFixed(2) }} {{ unit }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.particle-canvas {
  width: 100%;
}

.particle-canvas__wrap {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.particle-canvas__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.particle-canvas__hud,
.particle-canvas__hint,
.particle-canvas__unit {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  font-size: 9.5px;
  color: var(--text-2);
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  padding: 3px 6px;
  backdrop-filter: blur(6px);
}

.particle-canvas__hud {
  top: 8px;
  right: 8px;
  display: flex;
  gap: 8px;
}

.particle-canvas__hint {
  left: 8px;
  bottom: 8px;
}

.particle-canvas__unit {
  left: 8px;
  top: 8px;
}
</style>
