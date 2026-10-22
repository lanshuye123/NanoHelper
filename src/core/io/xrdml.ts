export interface XrdmlResult {
  x: Float64Array
  y: Float64Array
  wavelength?: number
  warnings: string[]
}

function tagContents(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`, 'gi')
  const out: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(xml))) out.push(match[1])
  return out
}

function numbersIn(text: string): number[] {
  return text
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((v) => Number.isFinite(v))
}

/**
 * Minimal PANalytical XRDML reader. Handles multiple <scan> blocks, explicit
 * <positions> lists, or start/end/step metadata, and ignores namespaces.
 */
export function parseXrdml(text: string): XrdmlResult {
  const warnings: string[] = []
  if (!/<xrdMeasurements?/i.test(text) && !/<scan/i.test(text)) {
    throw new Error('不是有效的 XRDML 文件')
  }

  const wavelengthText = tagContents(text, 'kAlpha1')[0] ?? tagContents(text, 'wavelength')[0]
  const wavelength = wavelengthText ? Number(wavelengthText.trim()) : undefined

  const positionsTags = tagContents(text, 'positions')
  const countsTags = tagContents(text, 'counts')
  if (!countsTags.length) throw new Error('XRDML 中没有找到 <counts> 数据')

  const xs: number[] = []
  const ys: number[] = []

  if (positionsTags.length) {
    const count = Math.min(positionsTags.length, countsTags.length)
    for (let i = 0; i < count; i++) {
      const pos = numbersIn(positionsTags[i])
      const counts = numbersIn(countsTags[i])
      const n = Math.min(pos.length, counts.length)
      if (pos.length !== counts.length) {
        warnings.push(`第 ${i + 1} 段 positions/counts 长度不一致，已截断到 ${n} 点`)
      }
      for (let k = 0; k < n; k++) {
        xs.push(pos[k])
        ys.push(counts[k])
      }
    }
  } else {
    const starts = tagContents(text, 'startPosition').map((v) => Number(v.trim()))
    const ends = tagContents(text, 'endPosition').map((v) => Number(v.trim()))
    const steps = tagContents(text, 'stepSize').map((v) => Number(v.trim()))
    const count = Math.min(starts.length, ends.length, steps.length, countsTags.length)
    if (!count) {
      throw new Error('XRDML 缺少 positions 或 startPosition/endPosition/stepSize 信息')
    }
    for (let i = 0; i < count; i++) {
      const counts = numbersIn(countsTags[i])
      let x = starts[i]
      for (let k = 0; k < counts.length; k++) {
        xs.push(x)
        ys.push(counts[k])
        x += steps[i]
      }
      if (ends[i] && Math.abs(x - steps[i] - ends[i]) > steps[i] * 1.5) {
        warnings.push(`第 ${i + 1} 段的 start/end/step 与点数不一致`)
      }
    }
  }

  if (!xs.length) throw new Error('XRDML 中没有可用的 2θ/强度数据')
  const x = Float64Array.from(xs)
  const y = Float64Array.from(ys)
  return { x, y, wavelength: Number.isFinite(wavelength) ? wavelength : undefined, warnings }
}
