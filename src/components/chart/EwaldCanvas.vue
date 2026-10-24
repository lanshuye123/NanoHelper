<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { EwaldPoint } from '@/core/diffraction/ewald'
import { downloadBlob } from '@/utils/download'

const props = withDefaults(
  defineProps<{
    points: EwaldPoint[]
    k: number
    maxR: number
    zoneSpacing: number
    thicknessNm?: number
    height?: number
    showRelrods?: boolean
    showLabels?: boolean
    caption?: string
  }>(),
  {
    thicknessNm: 0,
    height: 440,
    showRelrods: true,
    showLabels: true,
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

const radialMax = computed(() => {
  const max = props.points.reduce((m, p) => Math.max(m, Math.hypot(p.x, p.y)), 0)
  return Math.max(props.maxR * 0.55, max * 1.12, 0.2)
})

const zExtent = computed(() => {
  const max = props.points.reduce((m, p) => Math.max(m, Math.abs(p.z)), 0)
  return Math.max(max * 1.18, props.zoneSpacing * 1.2, 0.08)
})

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
  const surface = cssVar('--surface', '#0e1626')
  if (exportMode) {
    ctx.fillStyle = surface
    ctx.fillRect(0, 0, width, height)
  }

  const cx = width / 2
  const cy = height / 2
  const scale = Math.min((width - 54) / (2 * radialMax.value), (height - 54) / (2 * zExtent.value))
  const accent = cssVar('--accent', '#22d3ee')
  const text = cssVar('--text-2', '#a3b4cd')
  const dim = cssVar('--text-3', '#6c819f')
  const grid = cssVar('--grid-line-strong', 'rgba(148,181,224,0.16)')

  // Background glow.
  if (!exportMode) {
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.62)
    gradient.addColorStop(0, withAlpha(accent, 0.07))
    gradient.addColorStop(1, withAlpha(accent, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  // Laue-zone lines z = N·zoneSpacing.
  const maxN = Math.ceil(zExtent.value / props.zoneSpacing) + 1
  for (let n = -maxN; n <= maxN; n++) {
    const z = n * props.zoneSpacing
    const y = cy - z * scale
    if (y < 12 || y > height - 12) continue
    ctx.strokeStyle = n === 0 ? withAlpha(accent, 0.35) : grid
    ctx.lineWidth = n === 0 ? 1.2 : 1
    ctx.setLineDash(n === 0 ? [] : [3, 5])
    ctx.beginPath()
    ctx.moveTo(12, y)
    ctx.lineTo(width - 12, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = dim
    ctx.font = `9px ${cssVar('--font-mono', 'monospace')}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(n === 0 ? 'ZOLZ' : `HOLZ ${n > 0 ? '+' : ''}${n}`, 14, y - 2)
  }

  // Vertical axis (r = 0).
  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx, 10)
  ctx.lineTo(cx, height - 10)
  ctx.stroke()

  // Ewald circle: r² + (z + k)² = k².
  const sphereRadius = props.k * scale
  const centerY = cy + props.k * scale
  ctx.strokeStyle = withAlpha(accent, 0.85)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(cx, centerY, sphereRadius, 0, Math.PI * 2)
  ctx.stroke()

  // Tangent at the origin (z = 0) is the ZOLZ plane.
  ctx.fillStyle = dim
  ctx.font = `9px ${cssVar('--font-mono', 'monospace')}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('艾瓦德球', width - 14, 14)
  ctx.fillText(`k = 1/λ = ${props.k.toFixed(4)} Å⁻¹`, width - 14, 28)

  // Reciprocal points.
  const labelBoxes: Array<{ x: number; y: number; w: number; h: number }> = []
  for (const point of props.points) {
    const r = Math.hypot(point.x, point.y)
    const px = cx + r * scale
    const py = cy - point.z * scale
    if (px < 8 || px > width - 8 || py < 8 || py > height - 8) continue
    const excited = point.excited
    const color = excited
      ? '#f59e0b'
      : point.laueZone === 0
        ? withAlpha(text, 0.85)
        : withAlpha(accent, 0.55)
    const radius = excited ? 4 : Math.max(1.8, 3.4 - point.g * 1.2)
    if (props.showRelrods && props.thicknessNm > 0) {
      const half = point.relrodHalfWidth * scale
      ctx.strokeStyle = withAlpha(excited ? '#f59e0b' : dim, excited ? 0.55 : 0.22)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px, py - half)
      ctx.lineTo(px, py + half)
      ctx.stroke()
    }
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fill()
    if (excited) {
      ctx.strokeStyle = withAlpha('#f59e0b', 0.5)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(px, py, radius + 2.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (props.showLabels) {
      const order = Math.abs(point.hkl[0]) + Math.abs(point.hkl[1]) + Math.abs(point.hkl[2])
      if (order > 4 && !excited) continue
      const label = `${point.hkl[0]} ${point.hkl[1]} ${point.hkl[2]}`
      ctx.font = `9px ${cssVar('--font-mono', 'monospace')}`
      const tw = ctx.measureText(label).width
      const box = { x: px + radius + 3, y: py - 10, w: tw + 2, h: 11 }
      const collides = labelBoxes.some(
        (b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y,
      )
      if (!collides) {
        labelBoxes.push(box)
        ctx.fillStyle = excited ? '#f59e0b' : dim
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(label, px + radius + 3, py - 3)
      }
    }
  }

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
  ctx.fillText(`${value.toPrecision(3)} Å⁻¹`, x0, y0 - 6)

  // Legend.
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#f59e0b'
  ctx.fillText('● 与球相截', width - 14, height - 30)
  ctx.fillStyle = text
  ctx.fillText('● ZOLZ', width - 14, height - 16)
}

function exportPNG(filename = 'ewald.png') {
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
  () => [props.points, props.k, props.maxR, props.zoneSpacing, props.thicknessNm, props.showRelrods],
  schedule,
  { deep: true },
)

defineExpose({ exportPNG })
</script>

<template>
  <div ref="wrap" class="ewald-canvas">
    <canvas ref="canvas" />
    <p v-if="caption" class="ewald-canvas__caption">{{ caption }}</p>
  </div>
</template>

<style scoped>
.ewald-canvas {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  overflow: hidden;
}

.ewald-canvas canvas {
  display: block;
  width: 100%;
}

.ewald-canvas__caption {
  margin: 0;
  padding: 7px 10px;
  border-top: 1px solid var(--border);
  color: var(--text-3);
  font-size: 10.5px;
}
</style>
