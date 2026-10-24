<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { downloadBlob } from '@/utils/download'
import { useSettingsStore } from '@/stores/settings'

export interface ChartSeries {
  id?: string
  label: string
  x: ArrayLike<number>
  y: ArrayLike<number>
  color?: string
  width?: number
  dash?: number[]
  type?: 'line' | 'scatter' | 'step'
  opacity?: number
  visible?: boolean
  fill?: boolean
  pointRadius?: number
}

export interface ChartMarker {
  x: number
  y?: number
  label?: string
  color?: string
}

const settings = useSettingsStore()

const props = withDefaults(
  defineProps<{
    series: ChartSeries[]
    xLabel?: string
    yLabel?: string
    xUnit?: string
    yUnit?: string
    height?: number
    logY?: boolean
    showLegend?: boolean
    showGrid?: boolean
    markers?: ChartMarker[]
    xDomain?: [number, number] | null
    yDomain?: [number, number] | null
    includeZero?: boolean
    compact?: boolean
    interactive?: boolean
  }>(),
  {
    height: 360,
    logY: false,
    showLegend: true,
    showGrid: true,
    includeZero: true,
    compact: false,
    interactive: true,
    markers: () => [],
  },
)

const emit = defineEmits<{ 'point-click': [payload: { x: number; y: number; series: string }] }>()

const wrap = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const tooltip = ref<HTMLDivElement | null>(null)
const size = reactive({ w: 0, h: 0, dpr: 1 })
const viewport = ref<{ x0: number; x1: number; y0: number; y1: number } | null>(null)
const hover = ref<{
  px: number
  py: number
  x: number
  values: Array<{ label: string; y: number; color: string }>
} | null>(null)
const dragging = ref(false)

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let dragStart: { px: number; py: number; x0: number; x1: number; y0: number; y1: number } | null = null
let lastSignature = ''

const palette = () => [
  cssVar('--plot-1', '#2f7fc1'),
  cssVar('--plot-2', '#d08a2e'),
  cssVar('--plot-3', '#6f5bd4'),
  cssVar('--plot-4', '#d04f6e'),
  cssVar('--plot-5', '#2f9e7e'),
  cssVar('--plot-6', '#4aa8e0'),
]

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const margins = computed(() => (props.compact ? { l: 46, r: 12, t: 12, b: 30 } : { l: 64, r: 18, t: 18, b: 46 }))

const visible = computed(() => props.series.filter((s) => s.visible !== false && s.x.length > 0 && s.y.length > 0))

function dataDomain() {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const s of visible.value) {
    const n = Math.min(s.x.length, s.y.length)
    for (let i = 0; i < n; i++) {
      const x = s.x[i]
      const y = s.y[i]
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (!Number.isFinite(x0) || !Number.isFinite(x1)) return null
  if (props.includeZero) y0 = Math.min(0, y0)
  if (props.logY) {
    if (!(y0 > 0)) {
      let minPositive = Infinity
      for (const s of visible.value) {
        for (let i = 0; i < Math.min(s.x.length, s.y.length); i++) {
          const y = s.y[i]
          if (Number.isFinite(y) && y > 0 && y < minPositive) minPositive = y
        }
      }
      y0 = Number.isFinite(minPositive) ? minPositive / 2 : 1
    }
    y1 = Math.max(y1, y0 * 10)
  }
  if (y0 === y1) {
    y0 -= 0.5
    y1 += 0.5
  }
  const xPad = (x1 - x0) * 0.015 || 1
  const yPad = (y1 - y0) * 0.06 || 1
  return {
    x0: props.xDomain?.[0] ?? x0 - xPad,
    x1: props.xDomain?.[1] ?? x1 + xPad,
    y0: props.yDomain?.[0] ?? (props.logY ? y0 / 1.15 : y0 - yPad),
    y1: props.yDomain?.[1] ?? y1 + yPad,
  }
}

function resetViewport() {
  const d = dataDomain()
  if (d) viewport.value = d
  else viewport.value = { x0: 0, x1: 1, y0: 0, y1: 1 }
  schedule()
}

function signature(): string {
  return props.series
    .map((s) => `${s.label}:${s.x.length}:${s.x[0] ?? 0}:${s.x[s.x.length - 1] ?? 0}:${s.y.length}`)
    .join('|')
}

watch(
  () => [signature(), props.logY, props.xDomain?.[0], props.xDomain?.[1], props.yDomain?.[0], props.yDomain?.[1]],
  () => {
    const sig = signature()
    if (sig !== lastSignature) {
      lastSignature = sig
      nextTick(resetViewport)
    } else {
      nextTick(() => {
        if (!viewport.value || props.xDomain) resetViewport()
        else schedule()
      })
    }
  },
  { immediate: true },
)

function schedule() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    render()
  })
}

function mapX(x: number, vp: NonNullable<typeof viewport.value>, plot: { x: number; w: number }): number {
  return plot.x + ((x - vp.x0) / (vp.x1 - vp.x0)) * plot.w
}

function mapY(y: number, vp: NonNullable<typeof viewport.value>, plot: { y: number; h: number }): number {
  if (props.logY) {
    const lo = Math.log10(Math.max(vp.y0, 1e-12))
    const hi = Math.log10(Math.max(vp.y1, 1e-11))
    const v = Math.log10(Math.max(y, 1e-12))
    return plot.y + plot.h - ((v - lo) / (hi - lo || 1)) * plot.h
  }
  return plot.y + plot.h - ((y - vp.y0) / (vp.y1 - vp.y0 || 1)) * plot.h
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  }
  return ticks
}

function logTicks(min: number, max: number): number[] {
  const lo = Math.floor(Math.log10(Math.max(min, 1e-12)))
  const hi = Math.ceil(Math.log10(Math.max(max, 1e-11)))
  const ticks: number[] = []
  for (let e = lo; e <= hi; e++) {
    ticks.push(10 ** e)
    if (e < hi) {
      ticks.push(2 * 10 ** e, 5 * 10 ** e)
    }
  }
  return ticks.filter((v) => v >= min * 0.999 && v <= max * 1.001)
}

function formatTick(value: number, step: number): string {
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e5 || abs < 1e-3) return value.toExponential(1).replace('e+', 'e')
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(step)) + 1))
  const text = value.toFixed(decimals)
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

function render() {
  const canvasEl = canvas.value
  const container = wrap.value
  if (!canvasEl || !container) return
  const dpr = window.devicePixelRatio || 1
  const width = container.clientWidth
  const height = container.clientHeight
  if (!width || !height) return
  if (size.w !== width || size.h !== height || size.dpr !== dpr) {
    size.w = width
    size.h = height
    size.dpr = dpr
    canvasEl.width = Math.round(width * dpr)
    canvasEl.height = Math.round(height * dpr)
    canvasEl.style.width = `${width}px`
    canvasEl.style.height = `${height}px`
  }
  ctx = canvasEl.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawScene(ctx, width, height, false)
}

function drawScene(context: CanvasRenderingContext2D, width: number, height: number, exportMode: boolean) {
  const vp = viewport.value
  if (!vp) return
  const m = margins.value
  const plot = { x: m.l, y: m.t, w: width - m.l - m.r, h: height - m.t - m.b }
  if (plot.w <= 20 || plot.h <= 20) return

  context.clearRect(0, 0, width, height)
  if (exportMode) {
    context.fillStyle = cssVar('--surface', '#ffffff')
    context.fillRect(0, 0, width, height)
  }

  const textColor = cssVar('--text-3', '#7b91a8')
  const text2 = cssVar('--text-2', '#4a6580')
  const gridColor = cssVar('--grid-line', 'rgba(25,75,120,0.07)')
  const accent = cssVar('--accent', '#2f7fc1')

  const xTicks = niceTicks(vp.x0, vp.x1, props.compact ? 4 : 6)
  const yTicks = props.logY ? logTicks(vp.y0, vp.y1) : niceTicks(vp.y0, vp.y1, props.compact ? 4 : 6)
  const xStep = xTicks.length > 1 ? xTicks[1] - xTicks[0] : 1
  const yStep = yTicks.length > 1 ? Math.abs(yTicks[1] - yTicks[0]) : 1

  // grid
  if (props.showGrid) {
    context.strokeStyle = gridColor
    context.lineWidth = 1
    context.beginPath()
    for (const t of xTicks) {
      const px = Math.round(mapX(t, vp, plot)) + 0.5
      context.moveTo(px, plot.y)
      context.lineTo(px, plot.y + plot.h)
    }
    for (const t of yTicks) {
      const py = Math.round(mapY(t, vp, plot)) + 0.5
      context.moveTo(plot.x, py)
      context.lineTo(plot.x + plot.w, py)
    }
    context.stroke()
  }

  // axis border
  context.strokeStyle = cssVar('--border', '#d8e5f2')
  context.lineWidth = 1
  context.strokeRect(plot.x + 0.5, plot.y + 0.5, plot.w - 1, plot.h - 1)

  // tick labels
  context.fillStyle = textColor
  context.font = `10px ${cssVar('--font-mono', 'monospace')}`
  context.textAlign = 'center'
  context.textBaseline = 'top'
  for (const t of xTicks) {
    const px = mapX(t, vp, plot)
    if (px < plot.x - 2 || px > plot.x + plot.w + 2) continue
    context.fillText(formatTick(t, xStep), px, plot.y + plot.h + 6)
  }
  context.textAlign = 'right'
  context.textBaseline = 'middle'
  for (const t of yTicks) {
    const py = mapY(t, vp, plot)
    if (py < plot.y - 2 || py > plot.y + plot.h + 2) continue
    context.fillText(formatTick(t, yStep), plot.x - 8, py)
  }

  // axis titles
  context.fillStyle = text2
  context.font = `10.5px ${cssVar('--font-sans', 'sans-serif')}`
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  const xTitle = props.xLabel ? `${props.xLabel}${props.xUnit ? ` (${props.xUnit})` : ''}` : ''
  if (xTitle) context.fillText(xTitle, plot.x + plot.w / 2, height - 8)
  if (props.yLabel) {
    context.save()
    context.translate(12, plot.y + plot.h / 2)
    context.rotate(-Math.PI / 2)
    context.textAlign = 'center'
    const yTitle = `${props.yLabel}${props.yUnit ? ` (${props.yUnit})` : ''}`
    context.fillText(yTitle, 0, 0)
    context.restore()
  }

  // series
  const colors = palette()
  context.save()
  context.beginPath()
  context.rect(plot.x, plot.y, plot.w, plot.h)
  context.clip()

  const visibleSeries = visible.value
  visibleSeries.forEach((s, index) => {
    const color = s.color ?? colors[index % colors.length]
    const n = Math.min(s.x.length, s.y.length)
    if (!n) return
    context.globalAlpha = s.opacity ?? 1
    context.strokeStyle = color
    context.fillStyle = color
    context.lineWidth = s.width ?? 1.5
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.setLineDash(s.dash ?? [])

    if (s.type === 'scatter') {
      const radius = s.pointRadius ?? 2
      for (let i = 0; i < n; i++) {
        const px = mapX(s.x[i], vp, plot)
        const py = mapY(s.y[i], vp, plot)
        if (px < plot.x - 4 || px > plot.x + plot.w + 4) continue
        context.beginPath()
        context.arc(px, py, radius, 0, Math.PI * 2)
        context.fill()
      }
      context.setLineDash([])
      return
    }

    const points = downsample(s, plot.w, vp, plot)
    context.beginPath()
    let started = false
    for (const p of points) {
      const px = mapX(p.x, vp, plot)
      const py = mapY(p.y, vp, plot)
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue
      if (!started) {
        context.moveTo(px, py)
        started = true
      } else if (s.type === 'step') {
        context.lineTo(px, py)
      } else {
        context.lineTo(px, py)
      }
    }
    if (s.fill && points.length > 1) {
      const first = points[0]
      const last = points[points.length - 1]
      context.globalAlpha = 0.12
      context.lineTo(mapX(last.x, vp, plot), plot.y + plot.h)
      context.lineTo(mapX(first.x, vp, plot), plot.y + plot.h)
      context.closePath()
      context.fill()
      context.globalAlpha = s.opacity ?? 1
      context.beginPath()
      started = false
      for (const p of points) {
        const px = mapX(p.x, vp, plot)
        const py = mapY(p.y, vp, plot)
        if (!started) {
          context.moveTo(px, py)
          started = true
        } else context.lineTo(px, py)
      }
    }
    context.stroke()
    context.setLineDash([])
  })

  context.restore()

  context.globalAlpha = 1

  // markers
  for (const marker of props.markers) {
    const px = mapX(marker.x, vp, plot)
    if (px < plot.x || px > plot.x + plot.w) continue
    context.strokeStyle = marker.color ?? cssVar('--warn', '#b7791f')
    context.globalAlpha = 0.7
    context.setLineDash([3, 3])
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(px, plot.y)
    context.lineTo(px, plot.y + plot.h)
    context.stroke()
    context.setLineDash([])
    context.globalAlpha = 1
    if (marker.label) {
      context.fillStyle = marker.color ?? cssVar('--warn', '#b7791f')
      context.font = `9.5px ${cssVar('--font-mono', 'monospace')}`
      context.textAlign = 'center'
      context.textBaseline = 'bottom'
      context.fillText(marker.label, px, plot.y - 3)
    }
  }

  // crosshair
  if (!exportMode && hover.value) {
    const hx = hover.value.px
    context.strokeStyle = accent
    context.globalAlpha = 0.35
    context.setLineDash([2, 3])
    context.beginPath()
    context.moveTo(hx, plot.y)
    context.lineTo(hx, plot.y + plot.h)
    context.stroke()
    context.setLineDash([])
    context.globalAlpha = 1
    hover.value.values.forEach((v, i) => {
      const s = visibleSeries[i]
      if (!s) return
      const py = mapY(v.y, vp, plot)
      context.fillStyle = v.color
      context.beginPath()
      context.arc(hx, py, 3.2, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = cssVar('--surface', '#ffffff')
      context.lineWidth = 1.5
      context.stroke()
    })
  }

  // legend
  if (props.showLegend && visibleSeries.length > 1) {
    const pad = 8
    context.font = `10px ${cssVar('--font-sans', 'sans-serif')}`
    const entries = visibleSeries.map((s, i) => ({
      label: s.label,
      color: s.color ?? colors[i % colors.length],
    }))
    let x = plot.x + 8
    const y = plot.y + 4
    for (const entry of entries) {
      const w = context.measureText(entry.label).width
      context.fillStyle =
        document.documentElement.dataset.theme === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(10,16,28,0.55)'
      context.fillRect(x - 4, y - 2, w + 22, 17)
      context.fillStyle = entry.color
      context.fillRect(x, y + 6, 8, 2)
      context.fillStyle = text2
      context.textAlign = 'left'
      context.textBaseline = 'middle'
      context.fillText(entry.label, x + 12, y + 6)
      x += w + 34
    }
  }
}

function downsample(
  s: ChartSeries,
  plotWidth: number,
  vp: NonNullable<typeof viewport.value>,
  plot: { x: number; w: number },
): Array<{ x: number; y: number }> {
  const n = Math.min(s.x.length, s.y.length)
  if (n <= plotWidth * 2) {
    const out: Array<{ x: number; y: number }> = []
    for (let i = 0; i < n; i++) out.push({ x: s.x[i], y: s.y[i] })
    return out
  }
  const out: Array<{ x: number; y: number }> = []
  let bucket = -1
  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0
  let has = false
  const flush = () => {
    if (!has) return
    if (minX <= maxX) {
      out.push({ x: minX, y: minY }, { x: maxX, y: maxY })
    } else {
      out.push({ x: maxX, y: maxY }, { x: minX, y: minY })
    }
    has = false
  }
  for (let i = 0; i < n; i++) {
    const x = s.x[i]
    const y = s.y[i]
    const px = mapX(x, vp, plot)
    const b = Math.floor(px)
    if (b !== bucket) {
      flush()
      bucket = b
      minX = maxX = x
      minY = maxY = y
      has = true
      continue
    }
    if (y < minY) {
      minY = y
      minX = x
    }
    if (y > maxY) {
      maxY = y
      maxX = x
    }
  }
  flush()
  return out
}

function pointerPos(event: PointerEvent | WheelEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  return { px: event.clientX - rect.left, py: event.clientY - rect.top, rect }
}

function dataXAt(px: number, vp: NonNullable<typeof viewport.value>): number {
  const m = margins.value
  const plotW = size.w - m.l - m.r
  return vp.x0 + ((px - m.l) / plotW) * (vp.x1 - vp.x0)
}

function dataYAt(py: number, vp: NonNullable<typeof viewport.value>): number {
  const m = margins.value
  const plotH = size.h - m.t - m.b
  if (props.logY) {
    const lo = Math.log10(Math.max(vp.y0, 1e-12))
    const hi = Math.log10(Math.max(vp.y1, 1e-11))
    return 10 ** (lo + (1 - (py - m.t) / plotH) * (hi - lo))
  }
  return vp.y0 + (1 - (py - m.t) / plotH) * (vp.y1 - vp.y0)
}

function onPointerMove(event: PointerEvent) {
  const vp = viewport.value
  if (!vp) return
  const { px, py } = pointerPos(event)
  if (dragging.value && dragStart) {
    const m = margins.value
    const plotW = size.w - m.l - m.r
    const plotH = size.h - m.t - m.b
    const dx = ((px - dragStart.px) / plotW) * (dragStart.x1 - dragStart.x0)
    const dy = ((py - dragStart.py) / plotH) * (dragStart.y1 - dragStart.y0)
    viewport.value = {
      x0: dragStart.x0 - dx,
      x1: dragStart.x1 - dx,
      y0: dragStart.y0 + dy,
      y1: dragStart.y1 + dy,
    }
    schedule()
    return
  }
  updateHover(px, py, vp)
}

function updateHover(px: number, py: number, vp: NonNullable<typeof viewport.value>) {
  const m = margins.value
  if (px < m.l || px > size.w - m.r || py < m.t || py > size.h - m.b) {
    hover.value = null
    schedule()
    return
  }
  const x = dataXAt(px, vp)
  const visibleSeries = visible.value
  const first = visibleSeries[0]
  if (!first) return
  const n = Math.min(first.x.length, first.y.length)
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (first.x[mid] <= x) lo = mid
    else hi = mid
  }
  const idx = Math.abs(first.x[lo] - x) < Math.abs(first.x[hi] - x) ? lo : hi
  const snappedX = first.x[idx]
  const colors = palette()
  const values = visibleSeries.map((s, i) => {
    const sn = Math.min(s.x.length, s.y.length)
    let sIdx = idx
    if (s !== first) {
      let a = 0
      let b = sn - 1
      while (b - a > 1) {
        const mid = (a + b) >> 1
        if (s.x[mid] <= snappedX) a = mid
        else b = mid
      }
      sIdx = Math.abs(s.x[a] - snappedX) < Math.abs(s.x[b] - snappedX) ? a : b
    }
    return { label: s.label, y: s.y[Math.min(sIdx, sn - 1)], color: s.color ?? colors[i % colors.length] }
  })
  hover.value = { px, py, x: snappedX, values }
  schedule()
}

function onPointerDown(event: PointerEvent) {
  if (!props.interactive || !viewport.value) return
  const { px, py } = pointerPos(event)
  const m = margins.value
  if (px < m.l || px > size.w - m.r || py < m.t || py > size.h - m.b) return
  dragging.value = true
  dragStart = {
    px,
    py,
    x0: viewport.value.x0,
    x1: viewport.value.x1,
    y0: viewport.value.y0,
    y1: viewport.value.y1,
  }
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerUp(event: PointerEvent) {
  dragging.value = false
  dragStart = null
  try {
    ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
  } catch {
    /* ignore */
  }
}

function onWheel(event: WheelEvent) {
  if (!props.interactive || !viewport.value) return
  event.preventDefault()
  const vp = viewport.value
  const { px, py } = pointerPos(event)
  const factor = event.deltaY > 0 ? 1.18 : 1 / 1.18
  if (event.altKey || event.ctrlKey || event.metaKey) {
    const center = dataYAt(py, vp)
    viewport.value = {
      ...vp,
      y0: center + (vp.y0 - center) * factor,
      y1: center + (vp.y1 - center) * factor,
    }
  } else {
    const center = dataXAt(px, vp)
    viewport.value = {
      ...vp,
      x0: center + (vp.x0 - center) * factor,
      x1: center + (vp.x1 - center) * factor,
    }
  }
  schedule()
}

function onPointerLeave() {
  hover.value = null
  schedule()
}

function onDoubleClick() {
  resetViewport()
}

function onContextMenu(event: MouseEvent) {
  event.preventDefault()
}

function onResize() {
  schedule()
}

let observer: ResizeObserver | null = null

onMounted(() => {
  observer = new ResizeObserver(onResize)
  if (wrap.value) observer.observe(wrap.value)
  window.addEventListener('resize', onResize)
  nextTick(() => {
    resetViewport()
    render()
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', onResize)
  if (raf) cancelAnimationFrame(raf)
})

watch(
  () => props.series.map((s) => s.visible).join(','),
  () => schedule(),
)

watch(
  () => settings.theme,
  () => schedule(),
)

function reset() {
  resetViewport()
}

async function exportPNG(filename = 'chart.png') {
  const width = 1600
  const height = 900
  const dpr = 2
  const off = document.createElement('canvas')
  off.width = width * dpr
  off.height = height * dpr
  const c = off.getContext('2d')
  if (!c) return
  c.scale(dpr, dpr)
  drawScene(c, width, height, true)
  off.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename)
  }, 'image/png')
}

defineExpose({ reset, exportPNG })
</script>

<template>
  <div class="chart">
    <div ref="wrap" class="chart__canvas-wrap" :style="{ height: `${height}px` }">
      <canvas
        ref="canvas"
        class="chart__canvas"
        role="img"
        :aria-label="`${xLabel ?? 'X'} 对 ${yLabel ?? 'Y'} 的曲线图`"
        :class="{ 'is-dragging': dragging }"
        @pointermove="onPointerMove"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onPointerLeave"
        @wheel="onWheel"
        @dblclick="onDoubleClick"
        @contextmenu="onContextMenu"
      />
      <div v-if="!visible.length" class="chart__empty">
        <slot name="empty">暂无可绘制的数据</slot>
      </div>
      <div
        v-if="hover"
        ref="tooltip"
        class="chart__tooltip"
        :style="{ left: `${Math.min(hover.px + 14, size.w - 190)}px`, top: `${Math.max(hover.py - 10, 6)}px` }"
      >
        <div class="chart__tooltip-x mono">{{ xLabel || 'X' }} = {{ hover.x.toPrecision(6) }} {{ xUnit }}</div>
        <div v-for="v in hover.values" :key="v.label" class="chart__tooltip-row">
          <span class="chart__tooltip-dot" :style="{ background: v.color }" />
          <span class="chart__tooltip-label">{{ v.label }}</span>
          <span class="chart__tooltip-value mono">{{ Number.isFinite(v.y) ? v.y.toPrecision(6) : '—' }}</span>
        </div>
      </div>
    </div>
    <div class="chart__foot">
      <span class="chart__hint"> 滚轮缩放 X · Alt/⌘+滚轮缩放 Y · 拖拽平移 · 双击复位 </span>
      <span v-if="logY" class="chip tiny">log Y</span>
    </div>
  </div>
</template>

<style scoped>
.chart {
  width: 100%;
  min-width: 0;
}

.chart__canvas-wrap {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border-soft);
}

.chart__canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  touch-action: none;
}

.chart__canvas.is-dragging {
  cursor: grabbing;
}

.chart__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--text-3);
  font-size: 12px;
  pointer-events: none;
}

.chart__tooltip {
  position: absolute;
  z-index: 4;
  min-width: 160px;
  padding: 8px 10px;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
  background: color-mix(in srgb, var(--surface-2) 94%, transparent);
  box-shadow: var(--shadow);
  pointer-events: none;
  backdrop-filter: blur(8px);
}

.chart__tooltip-x {
  font-size: 10.5px;
  color: var(--text-3);
  margin-bottom: 4px;
}

.chart__tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 1.55;
}

.chart__tooltip-dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.chart__tooltip-label {
  color: var(--text-2);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart__tooltip-value {
  margin-left: auto;
  color: var(--text);
  font-size: 10.5px;
}

.chart__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 5px;
}

.chart__hint {
  font-size: 10px;
  color: var(--text-3);
}
</style>
