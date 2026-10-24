<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { SaedRing } from '@/core/diffraction/saedRings'
import { downloadBlob } from '@/utils/download'

const props = withDefaults(
  defineProps<{
    rings: SaedRing[]
    maxRadiusMm: number
    cameraConstant: number
    height?: number
    showLabels?: boolean
    showMeasured?: boolean
    measuredRadii?: number[]
    caption?: string
  }>(),
  {
    height: 440,
    showLabels: true,
    showMeasured: false,
    measuredRadii: () => [],
    caption: '',
  },
)

const wrap = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const size = reactive({ w: 0, h: 0, dpr: 1 })
let raf = 0
let observer: ResizeObserver | null = null

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function withAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!match) return color
  const raw = match[1]
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  return `rgba(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}, ${alpha})`
}

function niceStep(value: number): number {
  if (!(value > 0)) return 1
  const exponent = Math.floor(Math.log10(value))
  const fraction = value / 10 ** exponent
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * 10 ** exponent
}

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
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  draw(ctx, w, h, false)
}

function draw(ctx: CanvasRenderingContext2D, width: number, height: number, exportMode: boolean) {
  ctx.clearRect(0, 0, width, height)
  if (exportMode) {
    ctx.fillStyle = cssVar('--surface', '#0e1626')
    ctx.fillRect(0, 0, width, height)
  }
  const cx = width / 2
  const cy = height / 2
  const maxR = Math.max(props.maxRadiusMm, 0.001)
  const radius = Math.max(24, Math.min(width, height) / 2 - 26)
  const scale = radius / maxR
  const accent = cssVar('--accent', '#22d3ee')
  const text = cssVar('--text-2', '#a3b4cd')
  const dim = cssVar('--text-3', '#6c819f')
  const grid = cssVar('--grid-line-strong', 'rgba(148,181,224,0.16)')

  if (!exportMode) {
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15)
    gradient.addColorStop(0, withAlpha(accent, 0.08))
    gradient.addColorStop(1, withAlpha(accent, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  // Radius grid.
  const step = niceStep(maxR / 4)
  for (let r = step; r <= maxR * 1.001; r += step) {
    ctx.strokeStyle = grid
    ctx.lineWidth = 1
    ctx.setLineDash([2, 5])
    ctx.beginPath()
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = dim
    ctx.font = `9px ${cssVar('--font-mono', 'monospace')}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${r.toFixed(r < 1 ? 2 : 1)}`, cx + 3, cy - r * scale - 1)
  }

  // Cross.
  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - radius, cy)
  ctx.lineTo(cx + radius, cy)
  ctx.moveTo(cx, cy - radius)
  ctx.lineTo(cx, cy + radius)
  ctx.stroke()

  // Calculated rings.
  const labelBoxes: Array<{ x: number; y: number; w: number; h: number }> = []
  for (const ring of props.rings) {
    const r = ring.radiusMm * scale
    if (r > radius + 2) continue
    const strength = Math.max(0, Math.min(1, ring.relIntensity / 100))
    ctx.strokeStyle = withAlpha(accent, 0.25 + 0.7 * strength)
    ctx.lineWidth = Math.max(0.8, Math.min(4.5, (ring.widthMm * scale) / 2 + 0.8))
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()

    if (props.showLabels && strength > 0.08) {
      const angle = -Math.PI / 4
      const lx = cx + Math.cos(angle) * r
      const ly = cy + Math.sin(angle) * r
      const label = `${ring.hkl[0]} ${ring.hkl[1]} ${ring.hkl[2]}`
      ctx.font = `9px ${cssVar('--font-mono', 'monospace')}`
      const tw = ctx.measureText(label).width
      const box = { x: lx + 4, y: ly - 10, w: tw + 2, h: 11 }
      const collides = labelBoxes.some(
        (b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y,
      )
      if (!collides) {
        labelBoxes.push(box)
        ctx.fillStyle = text
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(label, lx + 4, ly - 3)
      }
    }
  }

  // Measured radii.
  if (props.showMeasured) {
    for (const measured of props.measuredRadii) {
      if (!(measured > 0)) continue
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 1.2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.arc(cx, cy, measured * scale, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Center.
  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.moveTo(cx - 7, cy)
  ctx.lineTo(cx + 7, cy)
  ctx.moveTo(cx, cy - 7)
  ctx.lineTo(cx, cy + 7)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Scale bar.
  const targetPx = Math.min(140, width * 0.24)
  const value = niceStep(targetPx / scale)
  const barPx = value * scale
  const x0 = 18
  const y0 = height - 18
  ctx.strokeStyle = text
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x0 + barPx, y0)
  ctx.moveTo(x0, y0 - 4)
  ctx.lineTo(x0, y0 + 4)
  ctx.moveTo(x0 + barPx, y0 - 4)
  ctx.lineTo(x0 + barPx, y0 + 4)
  ctx.stroke()
  ctx.fillStyle = dim
  ctx.font = `9px ${cssVar('--font-mono', 'monospace')}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`${value.toPrecision(3)} mm`, x0, y0 - 6)

  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = dim
  ctx.fillText(`Lλ = ${props.cameraConstant.toFixed(3)} mm·Å`, width - 14, height - 16)
}

function exportPNG(filename = 'saed-rings.png') {
  const el = canvas.value
  if (!el) return
  const off = document.createElement('canvas')
  const width = 1600
  const height = 900
  off.width = width
  off.height = height
  const ctx = off.getContext('2d')
  if (!ctx) return
  draw(ctx, width, height, true)
  off.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename)
  }, 'image/png')
}

onMounted(() => {
  observer = new ResizeObserver(schedule)
  if (wrap.value) observer.observe(wrap.value)
  schedule()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})

watch(
  () => [props.rings, props.maxRadiusMm, props.cameraConstant, props.showLabels, props.showMeasured, props.measuredRadii],
  schedule,
  { deep: true },
)

defineExpose({ exportPNG })
</script>

<template>
  <div ref="wrap" class="ring-canvas">
    <canvas ref="canvas" />
    <p v-if="caption" class="ring-canvas__caption">{{ caption }}</p>
  </div>
</template>

<style scoped>
.ring-canvas {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  overflow: hidden;
}

.ring-canvas canvas {
  display: block;
  width: 100%;
}

.ring-canvas__caption {
  margin: 0;
  padding: 7px 10px;
  border-top: 1px solid var(--border);
  color: var(--text-3);
  font-size: 10.5px;
}
</style>
