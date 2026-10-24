<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { downloadBlob } from '@/utils/download'
import type { GaussianFit, HistogramBin, LengthUnit, LognormalFit } from '@/core/micro/particles'

const props = withDefaults(
  defineProps<{
    bins: HistogramBin[]
    unit?: LengthUnit
    gaussian?: GaussianFit | null
    lognormal?: LognormalFit | null
    height?: number
    showFit?: boolean
  }>(),
  { unit: 'nm', gaussian: null, lognormal: null, height: 300, showFit: true },
)

const wrap = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const size = reactive({ w: 0, h: 0, dpr: 1 })
const hover = ref<{ px: number; py: number; index: number } | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let observer: ResizeObserver | null = null

const total = computed(() => props.bins.reduce((s, b) => s + b.count, 0))

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function schedule() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    render()
  })
}

function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * mag
}

function fitPoint(fit: GaussianFit | LognormalFit | null | undefined, x: number): number {
  if (!fit) return 0
  return total.value * (props.bins[0]?.high - props.bins[0]?.low || 1) * fit.pdf(x)
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
  const margin = exportMode ? { l: 72, r: 24, t: 26, b: 54 } : { l: 52, r: 14, t: 16, b: 42 }
  const plotW = Math.max(10, width - margin.l - margin.r)
  const plotH = Math.max(10, height - margin.t - margin.b)
  context.clearRect(0, 0, width, height)
  context.fillStyle = exportMode ? '#ffffff' : cssVar('--surface', '#ffffff')
  context.fillRect(0, 0, width, height)
  if (!props.bins.length) {
    context.fillStyle = cssVar('--text-3', '#7b91a8')
    context.font = `12px ${cssVar('--font-sans', 'sans-serif')}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('尚无测量数据', width / 2, height / 2)
    return
  }

  const maxCount = Math.max(1, ...props.bins.map((b) => b.count))
  let maxY = maxCount
  if (props.showFit) {
    for (const bin of props.bins) {
      for (let i = 0; i <= 16; i++) {
        const x = bin.low + ((bin.high - bin.low) * i) / 16
        maxY = Math.max(maxY, fitPoint(props.gaussian, x), fitPoint(props.lognormal, x))
      }
    }
  }
  maxY = Math.max(maxY, 1)
  const yStep = niceStep(maxY / 4)
  const yMax = Math.ceil(maxY / yStep) * yStep
  const x0 = margin.l
  const y0 = margin.t
  const y1 = margin.t + plotH
  const barW = plotW / props.bins.length

  // Grid and y labels.
  context.font = `${exportMode ? 11 : 9}px ${cssVar('--font-mono', 'monospace')}`
  context.textAlign = 'right'
  context.textBaseline = 'middle'
  for (let v = 0; v <= yMax + 1e-9; v += yStep) {
    const y = y1 - (v / yMax) * plotH
    context.strokeStyle = cssVar('--grid-line', 'rgba(25,75,120,0.07)')
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(x0, y)
    context.lineTo(x0 + plotW, y)
    context.stroke()
    context.fillStyle = cssVar('--text-3', '#7b91a8')
    context.fillText(`${Math.round(v)}`, x0 - 6, y)
  }

  // Bars.
  for (let i = 0; i < props.bins.length; i++) {
    const bin = props.bins[i]
    const x = x0 + i * barW
    const h = (bin.count / yMax) * plotH
    context.fillStyle = i === hover.value?.index ? cssVar('--accent', '#2563eb') : 'rgba(37, 99, 235, 0.55)'
    context.fillRect(x + barW * 0.08, y1 - h, barW * 0.84, h)
    context.strokeStyle = 'rgba(37, 99, 235, 0.9)'
    context.lineWidth = 0.8
    context.strokeRect(x + barW * 0.08, y1 - h, barW * 0.84, h)
  }

  // Fit curves.
  if (props.showFit) {
    const drawFit = (fit: GaussianFit | LognormalFit | null | undefined, color: string, dash: number[]) => {
      if (!fit) return
      context.strokeStyle = color
      context.lineWidth = exportMode ? 2 : 1.6
      context.setLineDash(dash)
      context.beginPath()
      let started = false
      for (let i = 0; i <= 240; i++) {
        const x = props.bins[0].low + ((props.bins[props.bins.length - 1].high - props.bins[0].low) * i) / 240
        const count = fitPoint(fit, x)
        const y = y1 - (Math.min(yMax, Math.max(0, count)) / yMax) * plotH
        const px = x0 + ((x - props.bins[0].low) / (props.bins[props.bins.length - 1].high - props.bins[0].low)) * plotW
        if (!started) {
          context.moveTo(px, y)
          started = true
        } else context.lineTo(px, y)
      }
      context.stroke()
      context.setLineDash([])
    }
    drawFit(props.gaussian, '#d97706', [6, 4])
    drawFit(props.lognormal, '#059669', [2, 3])
  }

  // Axes.
  context.strokeStyle = cssVar('--border-strong', '#b6cee5')
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(x0, y0)
  context.lineTo(x0, y1)
  context.lineTo(x0 + plotW, y1)
  context.stroke()

  // X labels.
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.fillStyle = cssVar('--text-3', '#7b91a8')
  const stride = Math.max(1, Math.ceil(props.bins.length / 10))
  for (let i = 0; i < props.bins.length; i += stride) {
    const x = x0 + (i + 0.5) * barW
    context.fillText(props.bins[i].low.toFixed(props.bins[i].high < 10 ? 2 : 1), x, y1 + 7)
  }
  context.fillText(props.unit, x0 + plotW, y1 + 25)
  context.textAlign = 'left'
  context.fillText('粒径 / ' + props.unit, x0, y1 + 25)

  // Legend.
  if (props.showFit && (props.gaussian || props.lognormal)) {
    let lx = x0 + 6
    const ly = y0 + 4
    context.font = `${exportMode ? 11 : 9.5}px ${cssVar('--font-sans', 'sans-serif')}`
    const entries: Array<[string, string, number[]]> = []
    if (props.gaussian) entries.push(['Gaussian', '#d97706', [6, 4]])
    if (props.lognormal) entries.push(['Log-normal', '#059669', [2, 3]])
    for (const [label, color, dash] of entries) {
      context.strokeStyle = color
      context.setLineDash(dash)
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(lx, ly + 5)
      context.lineTo(lx + 18, ly + 5)
      context.stroke()
      context.setLineDash([])
      context.fillStyle = cssVar('--text-2', '#4a6580')
      context.textAlign = 'left'
      context.textBaseline = 'middle'
      context.fillText(label, lx + 22, ly + 5)
      lx += 86
    }
  }

  // Hover tooltip.
  if (!exportMode && hover.value) {
    const bin = props.bins[hover.value.index]
    if (bin) {
      const text = `${bin.label} ${props.unit}: ${bin.count} (${(bin.freq * 100).toFixed(1)}%)`
      context.font = `10px ${cssVar('--font-mono', 'monospace')}`
      const w = context.measureText(text).width + 12
      const h = 20
      let x = hover.value.px + 10
      let y = hover.value.py - 28
      if (x + w > width - 4) x = hover.value.px - w - 10
      if (y < 4) y = hover.value.py + 12
      context.fillStyle = cssVar('--surface', '#ffffff')
      context.strokeStyle = cssVar('--border-strong', '#b6cee5')
      context.beginPath()
      context.roundRect(x, y, w, h, 4)
      context.fill()
      context.stroke()
      context.fillStyle = cssVar('--text', '#102a43')
      context.textAlign = 'left'
      context.textBaseline = 'middle'
      context.fillText(text, x + 6, y + h / 2)
    }
  }
}

function onMove(event: PointerEvent) {
  const el = canvas.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const px = event.clientX - rect.left
  const py = event.clientY - rect.top
  const margin = { l: 52, r: 14, t: 16, b: 42 }
  const plotW = Math.max(10, size.w - margin.l - margin.r)
  const barW = plotW / Math.max(1, props.bins.length)
  const index = Math.floor((px - margin.l) / barW)
  hover.value = index >= 0 && index < props.bins.length ? { px, py, index } : null
  schedule()
}

function onLeave() {
  hover.value = null
  schedule()
}

function onResize() {
  schedule()
}

watch(
  () => [props.bins, props.gaussian, props.lognormal, props.showFit],
  () => schedule(),
  { deep: true },
)

onMounted(() => {
  observer = new ResizeObserver(onResize)
  if (wrap.value) observer.observe(wrap.value)
  nextTick(schedule)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})

function exportPng(filename = 'particle-histogram.png') {
  const width = 1200
  const height = 640
  const dpr = 2
  const off = document.createElement('canvas')
  off.width = width * dpr
  off.height = height * dpr
  const c = off.getContext('2d')
  if (!c) return
  c.scale(dpr, dpr)
  draw(c, width, height, true)
  off.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename)
  }, 'image/png')
}

defineExpose({ exportPng })
</script>

<template>
  <div class="particle-histogram">
    <div ref="wrap" class="particle-histogram__wrap" :style="{ height: `${height}px` }">
      <canvas
        ref="canvas"
        class="particle-histogram__canvas"
        role="img"
        aria-label="粒径分布直方图"
        @pointermove="onMove"
        @pointerleave="onLeave"
      />
    </div>
  </div>
</template>

<style scoped>
.particle-histogram {
  width: 100%;
}

.particle-histogram__wrap {
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: var(--surface);
  overflow: hidden;
}

.particle-histogram__canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
</style>
