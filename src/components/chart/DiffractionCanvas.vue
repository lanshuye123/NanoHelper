<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { downloadBlob } from '@/utils/download'

export interface DiffractionPoint {
  x: number
  y: number
  label: string
  /** 0–100; used for marker size/alpha */
  intensity?: number
  isCenter?: boolean
  muted?: boolean
  color?: string
  meta?: string
}

const props = withDefaults(
  defineProps<{
    points: DiffractionPoint[]
    maxR: number
    height?: number
    unit?: string
    showLabels?: boolean
    showRings?: boolean
    scaleBar?: boolean
    caption?: string
  }>(),
  {
    height: 420,
    unit: 'Å⁻¹',
    showLabels: true,
    showRings: true,
    scaleBar: true,
  },
)

const emit = defineEmits<{ select: [point: DiffractionPoint] }>()

const wrap = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const size = reactive({ w: 0, h: 0, dpr: 1 })
const hover = ref<{ px: number; py: number; point: DiffractionPoint } | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let observer: ResizeObserver | null = null

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.trim()
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!match) return color
  const raw = match[1]
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const maxRadius = computed(() => Math.max(props.maxR, 1e-6))

function schedule() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    render()
  })
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
  }
  ctx = el.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  draw(ctx, w, h, false)
}

function draw(context: CanvasRenderingContext2D, width: number, height: number, exportMode: boolean) {
  context.clearRect(0, 0, width, height)
  if (exportMode) {
    context.fillStyle = cssVar('--surface', '#0e1626')
    context.fillRect(0, 0, width, height)
  }

  const cx = width / 2
  const cy = height / 2
  const radius = Math.max(20, Math.min(width, height) / 2 - 22)
  const scale = radius / maxRadius.value

  const bg1 = cssVar('--surface', '#0e1626')
  const accent = cssVar('--accent', '#22d3ee')
  const textColor = cssVar('--text-2', '#a3b4cd')
  const dim = cssVar('--text-3', '#6c819f')
  const grid = cssVar('--grid-line-strong', 'rgba(148,181,224,0.16)')

  if (!exportMode) {
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15)
    gradient.addColorStop(0, withAlpha(accent, 0.08))
    gradient.addColorStop(0.6, withAlpha(accent, 0.02))
    gradient.addColorStop(1, withAlpha(accent, 0))
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
  }

  // Rings at nice g values.
  if (props.showRings) {
    const step = niceStep(maxRadius.value / 4)
    for (let r = step; r <= maxRadius.value * 1.001; r += step) {
      context.strokeStyle = grid
      context.lineWidth = 1
      context.setLineDash([2, 4])
      context.beginPath()
      context.arc(cx, cy, r * scale, 0, Math.PI * 2)
      context.stroke()
      context.setLineDash([])
      context.fillStyle = dim
      context.font = `9px ${cssVar('--font-mono', 'monospace')}`
      context.textAlign = 'left'
      context.textBaseline = 'bottom'
      context.fillText(`${r.toFixed(r < 1 ? 2 : 1)}`, cx + 3, cy - r * scale - 1)
    }
  }

  // Axes.
  context.strokeStyle = grid
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(cx - radius, cy)
  context.lineTo(cx + radius, cy)
  context.moveTo(cx, cy - radius)
  context.lineTo(cx, cy + radius)
  context.stroke()

  // Spots.
  const labelBoxes: Array<{ x: number; y: number; w: number; h: number }> = []
  const sorted = [...props.points].sort((a, b) => (a.isCenter ? -1 : 0) - (b.isCenter ? -1 : 0))
  for (const point of sorted) {
    const px = cx + point.x * scale
    const py = cy - point.y * scale
    if (Math.hypot(px - cx, py - cy) > radius + 12) continue
    const intensity = point.isCenter ? 100 : (point.intensity ?? 60)
    const r = point.isCenter ? 4.2 : 1.8 + 3.8 * Math.sqrt(Math.max(0, intensity) / 100)
    const color = point.color ?? (point.isCenter ? accent : cssVar('--text', '#e8eef9'))
    context.globalAlpha = point.muted ? 0.25 : point.isCenter ? 1 : 0.55 + 0.45 * (intensity / 100)
    context.fillStyle = color
    context.beginPath()
    context.arc(px, py, r, 0, Math.PI * 2)
    context.fill()
    context.globalAlpha = 1

    if (props.showLabels && point.label) {
      context.font = `9px ${cssVar('--font-mono', 'monospace')}`
      const tw = context.measureText(point.label).width
      const lx = px + r + 3
      const ly = py - 3
      const box = { x: lx - 1, y: ly - 9, w: tw + 2, h: 11 }
      const collides = labelBoxes.some(
        (b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y,
      )
      if (!collides) {
        labelBoxes.push(box)
        context.fillStyle = point.muted ? dim : textColor
        context.textAlign = 'left'
        context.textBaseline = 'alphabetic'
        context.fillText(point.label, lx, ly)
      }
    }
  }

  // Center cross.
  context.strokeStyle = accent
  context.globalAlpha = 0.6
  context.beginPath()
  context.moveTo(cx - 7, cy)
  context.lineTo(cx + 7, cy)
  context.moveTo(cx, cy - 7)
  context.lineTo(cx, cy + 7)
  context.stroke()
  context.globalAlpha = 1

  // Scale bar.
  if (props.scaleBar) {
    const targetPx = Math.min(140, width * 0.22)
    const value = niceStep(targetPx / scale)
    const barPx = value * scale
    const x0 = 18
    const y0 = height - 18
    context.strokeStyle = textColor
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(x0, y0)
    context.lineTo(x0 + barPx, y0)
    context.moveTo(x0, y0 - 4)
    context.lineTo(x0, y0 + 4)
    context.moveTo(x0 + barPx, y0 - 4)
    context.lineTo(x0 + barPx, y0 + 4)
    context.stroke()
    context.fillStyle = dim
    context.font = `9px ${cssVar('--font-mono', 'monospace')}`
    context.textAlign = 'left'
    context.textBaseline = 'top'
    context.fillText(`${value} ${props.unit}`, x0, y0 + 5)
  }

  // Hover crosshair.
  if (!exportMode && hover.value) {
    const { px, py } = hover.value
    context.strokeStyle = accent
    context.globalAlpha = 0.3
    context.setLineDash([2, 3])
    context.beginPath()
    context.moveTo(px, 0)
    context.lineTo(px, height)
    context.moveTo(0, py)
    context.lineTo(width, py)
    context.stroke()
    context.setLineDash([])
    context.globalAlpha = 1
  }
}

function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * mag
}

function onMove(event: PointerEvent) {
  const el = canvas.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const px = event.clientX - rect.left
  const py = event.clientY - rect.top
  const cx = size.w / 2
  const cy = size.h / 2
  const radius = Math.max(20, Math.min(size.w, size.h) / 2 - 22)
  const scale = radius / maxRadius.value
  let best: DiffractionPoint | null = null
  let bestDist = 12
  for (const point of props.points) {
    const x = cx + point.x * scale
    const y = cy - point.y * scale
    const d = Math.hypot(px - x, py - y)
    if (d < bestDist) {
      bestDist = d
      best = point
    }
  }
  hover.value = best ? { px, py, point: best } : null
  schedule()
}

function onClick() {
  if (hover.value) emit('select', hover.value.point)
}

function onLeave() {
  hover.value = null
  schedule()
}

function onResize() {
  schedule()
}

onMounted(() => {
  observer = new ResizeObserver(onResize)
  if (wrap.value) observer.observe(wrap.value)
  nextTick(schedule)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})

watch(
  () => [props.points, props.maxR, props.showLabels, props.showRings],
  () => schedule(),
  { deep: true },
)

async function exportPNG(filename = 'pattern.png') {
  const sizePx = 1200
  const dpr = 2
  const off = document.createElement('canvas')
  off.width = sizePx * dpr
  off.height = sizePx * dpr
  const c = off.getContext('2d')
  if (!c) return
  c.scale(dpr, dpr)
  draw(c, sizePx, sizePx, true)
  off.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename)
  }, 'image/png')
}

defineExpose({ exportPNG })
</script>

<template>
  <div class="diffraction">
    <div ref="wrap" class="diffraction__wrap" :style="{ height: `${height}px` }">
      <canvas
        ref="canvas"
        class="diffraction__canvas"
        role="img"
        aria-label="衍射斑点图"
        @pointermove="onMove"
        @pointerleave="onLeave"
        @click="onClick"
      />
      <div
        v-if="hover"
        class="diffraction__tip"
        :style="{ left: `${Math.min(hover.px + 12, size.w - 170)}px`, top: `${Math.max(hover.py - 8, 4)}px` }"
      >
        <div class="diffraction__tip-title mono">{{ hover.point.label }}</div>
        <div v-if="hover.point.meta" class="diffraction__tip-meta mono">{{ hover.point.meta }}</div>
        <div class="diffraction__tip-meta mono">
          g = {{ Math.hypot(hover.point.x, hover.point.y).toPrecision(5) }} {{ unit }}
        </div>
      </div>
      <div v-if="caption" class="diffraction__caption mono">{{ caption }}</div>
    </div>
  </div>
</template>

<style scoped>
.diffraction {
  width: 100%;
}

.diffraction__wrap {
  position: relative;
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: var(--surface);
  overflow: hidden;
}

.diffraction__canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.diffraction__tip {
  position: absolute;
  z-index: 3;
  min-width: 120px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  background: color-mix(in srgb, var(--surface-2) 94%, transparent);
  box-shadow: var(--shadow);
  pointer-events: none;
  backdrop-filter: blur(8px);
}

.diffraction__tip-title {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text);
}

.diffraction__tip-meta {
  font-size: 9.5px;
  color: var(--text-3);
  margin-top: 1px;
}

.diffraction__caption {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 9px;
  color: var(--text-3);
  letter-spacing: 0.03em;
}
</style>
