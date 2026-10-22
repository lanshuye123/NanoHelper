import { makePattern, patternRange, type Pattern, type StepParams } from '@/core/pipeline/types'

export type JadeMapMode = 'diffraction' | 'nonDiffraction' | 'safe' | 'affine'

export interface AffineMapping {
  mode: JadeMapMode
  xScale: number
  xOffset: number
  yScale: number
  yOffset: number
  inputX: [number, number]
  inputY: [number, number]
  outputX: [number, number]
  outputY: [number, number]
  warnings: string[]
}

export interface JadeMapParams extends StepParams {
  mode: JadeMapMode
  xMinOut: number
  xMaxOut: number
  yMinOut: number
  yMaxOut: number
  rescaleY: boolean
  xScale: number
  xOffset: number
  yScale: number
  yOffset: number
}

export function jadeModeDefaults(mode: JadeMapMode): Partial<JadeMapParams> {
  switch (mode) {
    case 'safe':
      return { xMinOut: 1, xMaxOut: 139, yMinOut: 0.5, yMaxOut: 10000, rescaleY: true }
    case 'diffraction':
      return { xMinOut: 0, xMaxOut: 140, yMinOut: 0.5, yMaxOut: 10000, rescaleY: false }
    case 'affine':
      return { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 }
    case 'nonDiffraction':
    default:
      return { xMinOut: 0, xMaxOut: 100, yMinOut: 0.5, yMaxOut: 10000, rescaleY: true }
  }
}

export const DEFAULT_JADE_MAP: JadeMapParams = {
  mode: 'nonDiffraction',
  xMinOut: 0,
  xMaxOut: 100,
  yMinOut: 0.5,
  yMaxOut: 10000,
  rescaleY: true,
  xScale: 1,
  xOffset: 0,
  yScale: 1,
  yOffset: 0,
}

function scaleFor(input: [number, number], output: [number, number]): { scale: number; offset: number } {
  const spanIn = input[1] - input[0]
  const spanOut = output[1] - output[0]
  const scale = Math.abs(spanIn) > 1e-12 ? spanOut / spanIn : 1
  return { scale, offset: output[0] - scale * input[0] }
}

/**
 * Resolve a Jade mapping preset into explicit affine coefficients.
 *
 * Jade constraints: 0 ≤ x ≤ 140 and y > 0. Non-diffraction data (Raman, IR,
 * TGA) are mapped to the course-specified [0,100] × [0,10000] box; y starts at
 * 0.5 instead of 0 so that Jade never sees a zero or negative count.
 */
export function computeJadeMapping(pattern: Pattern, params: Partial<JadeMapParams> = {}): AffineMapping {
  const p = { ...DEFAULT_JADE_MAP, ...params }
  const range = patternRange(pattern)
  const warnings: string[] = []
  if (!Number.isFinite(range.xMin) || !Number.isFinite(range.xMax)) {
    throw new Error('数据为空，无法计算坐标映射')
  }

  let inputX: [number, number] = [range.xMin, range.xMax]
  let outputX: [number, number]
  let rescaleY = p.rescaleY
  let yMinOut = p.yMinOut
  let yMaxOut = p.yMaxOut

  switch (p.mode) {
    case 'nonDiffraction':
      outputX = [0, 100]
      yMinOut = 0.5
      yMaxOut = 10000
      rescaleY = true
      warnings.push('按课程笔记：X 归一化到 [0,100]，Y 归一化到 [0.5,10000]（0.5 用于满足 Jade 的 Y>0）')
      break
    case 'safe':
      outputX = [1, 139]
      yMinOut = 0.5
      yMaxOut = 10000
      rescaleY = true
      warnings.push('已使用安全区间 [1,139] 以避开 Jade 的 0/140 边界')
      break
    case 'affine':
      return {
        mode: 'affine',
        xScale: p.xScale,
        xOffset: p.xOffset,
        yScale: p.yScale,
        yOffset: p.yOffset,
        inputX,
        inputY: [range.yMin, range.yMax],
        outputX: [p.xScale * range.xMin + p.xOffset, p.xScale * range.xMax + p.xOffset],
        outputY: [p.yScale * range.yMin + p.yOffset, p.yScale * range.yMax + p.yOffset],
        warnings,
      }
    case 'diffraction':
    default:
      outputX = [range.xMin, range.xMax]
      if (range.xMin < 0 || range.xMax > 140) {
        warnings.push(
          `2θ 范围 ${range.xMin.toFixed(2)}–${range.xMax.toFixed(2)}° 超出 Jade 的 0–140° 区间，请先裁剪或改用安全映射`,
        )
      }
      if (!p.rescaleY && range.yMin > 0) {
        // Preserve counts: only offset if necessary.
        const yScale = 1
        const yOffset = range.yMin > 0 ? 0 : yMinOut - range.yMin
        const mapping: AffineMapping = {
          mode: 'diffraction',
          xScale: 1,
          xOffset: 0,
          yScale,
          yOffset,
          inputX,
          inputY: [range.yMin, range.yMax],
          outputX,
          outputY: [range.yMin + yOffset, range.yMax + yOffset],
          warnings,
        }
        if (yMinOut > 0) {
          // keep the parameter visible in the UI without altering positive data
        }
        return mapping
      }
      break
  }

  const xs = scaleFor(inputX, outputX)
  if (Math.abs(outputX[1] - outputX[0]) < 1e-9) {
    throw new Error('Jade X 输出区间无效')
  }
  const inputY: [number, number] = [range.yMin, range.yMax]
  const ys = rescaleY
    ? scaleFor(inputY, [yMinOut, yMaxOut])
    : { scale: 1, offset: range.yMin > 0 ? 0 : yMinOut - range.yMin }

  if (range.yMin <= 0) {
    warnings.push(`原始数据最小值为 ${range.yMin.toFixed(3)}，已整体平移使 Jade 中 Y>0`)
  }

  const mapping: AffineMapping = {
    mode: p.mode,
    xScale: xs.scale,
    xOffset: xs.offset,
    yScale: ys.scale,
    yOffset: ys.offset,
    inputX,
    inputY,
    outputX: [xs.scale * range.xMin + xs.offset, xs.scale * range.xMax + xs.offset],
    outputY: [ys.scale * range.yMin + ys.offset, ys.scale * range.yMax + ys.offset],
    warnings,
  }

  if (Math.abs(mapping.xScale) < 1e-12) {
    warnings.push('X 映射系数接近 0，请检查输入数据范围')
  }
  return mapping
}

export function applyMapping(pattern: Pattern, mapping: AffineMapping): Pattern {
  const n = Math.min(pattern.x.length, pattern.y.length)
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    x[i] = mapping.xScale * pattern.x[i] + mapping.xOffset
    y[i] = mapping.yScale * pattern.y[i] + mapping.yOffset
  }
  const normalized = mapping.mode === 'nonDiffraction' || mapping.mode === 'safe'
  return makePattern(x, y, {
    ...pattern.meta,
    xLabel: normalized ? 'Jade X' : pattern.meta.xLabel,
    xUnit: normalized ? '' : pattern.meta.xUnit,
    yLabel: normalized ? 'Jade Y' : pattern.meta.yLabel,
    yUnit: normalized ? '' : pattern.meta.yUnit,
    notes: `${pattern.meta.notes ?? ''}${pattern.meta.notes ? '；' : ''}Jade 映射：x'=${mapping.xScale.toPrecision(10)}x${mapping.xOffset >= 0 ? '+' : ''}${mapping.xOffset.toPrecision(10)}, y'=${mapping.yScale.toPrecision(10)}y${mapping.yOffset >= 0 ? '+' : ''}${mapping.yOffset.toPrecision(10)}`,
  })
}

export function invertMapping(pattern: Pattern, mapping: AffineMapping): Pattern {
  const n = Math.min(pattern.x.length, pattern.y.length)
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    x[i] = (pattern.x[i] - mapping.xOffset) / mapping.xScale
    y[i] = (pattern.y[i] - mapping.yOffset) / mapping.yScale
  }
  return makePattern(x, y, pattern.meta)
}

/** Scalar inverse for a peak position / width / area. */
export function invertScalar(value: number, scale: number, offset: number): number {
  return (value - offset) / scale
}

export function mappingSummary(mapping: AffineMapping): string {
  return `x' = ${mapping.xScale.toPrecision(8)}·x ${mapping.xOffset >= 0 ? '+' : '−'} ${Math.abs(mapping.xOffset).toPrecision(8)}；y' = ${mapping.yScale.toPrecision(8)}·y ${mapping.yOffset >= 0 ? '+' : '−'} ${Math.abs(mapping.yOffset).toPrecision(8)}`
}
