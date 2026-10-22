import type { Pattern } from '@/core/pipeline/types'
import { patternRange } from '@/core/pipeline/types'

export type IssueLevel = 'error' | 'warning' | 'info'

export interface JadeIssue {
  level: IssueLevel
  code: string
  message: string
  hint?: string
}

/** Validate the final pattern against MDI Jade's import expectations. */
export function validateForJade(pattern: Pattern): JadeIssue[] {
  const issues: JadeIssue[] = []
  const n = Math.min(pattern.x.length, pattern.y.length)
  if (n < 2) {
    issues.push({
      level: 'error',
      code: 'too-few-points',
      message: '数据点不足 2 个',
      hint: '请检查裁剪区间或原始文件',
    })
    return issues
  }

  let nonFinite = 0
  let nonPositiveY = 0
  let outOfRange = 0
  let nonMonotonic = 0
  let duplicates = 0
  const steps: number[] = []
  let prev = -Infinity
  for (let i = 0; i < n; i++) {
    const x = pattern.x[i]
    const y = pattern.y[i]
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      nonFinite++
      continue
    }
    if (x < 0 || x > 140) outOfRange++
    if (y <= 0) nonPositiveY++
    if (x <= prev) {
      if (x === pattern.x[i - 1]) duplicates++
      else nonMonotonic++
    } else if (i > 0) {
      steps.push(x - pattern.x[i - 1])
    }
    prev = x
  }

  if (nonFinite) {
    issues.push({
      level: 'error',
      code: 'non-finite',
      message: `存在 ${nonFinite} 个 NaN/Infinity 数据点`,
      hint: '在预处理中删除或插值替换这些点',
    })
  }
  if (nonPositiveY) {
    issues.push({
      level: 'error',
      code: 'non-positive-y',
      message: `存在 ${nonPositiveY} 个 Y ≤ 0 的数据点（Jade 要求 Y 始终大于 0）`,
      hint: '使用「Jade 坐标映射」整体平移 Y，或先扣除背底/归一化',
    })
  }
  if (outOfRange) {
    issues.push({
      level: 'error',
      code: 'x-range',
      message: `存在 ${outOfRange} 个 X 超出 [0, 140] 的数据点`,
      hint: '裁剪 2θ 区间，或使用「非衍射数据」映射把 X 压缩到 [0,100]',
    })
  }
  if (nonMonotonic) {
    issues.push({
      level: 'error',
      code: 'not-monotonic',
      message: `X 存在 ${nonMonotonic} 处下降`,
      hint: '对数据按 X 排序，或重新导入',
    })
  }
  if (duplicates) {
    issues.push({
      level: 'warning',
      code: 'duplicate-x',
      message: `存在 ${duplicates} 个重复 X 值`,
      hint: 'Jade 通常可容忍，但建议去重后导出',
    })
  }
  if (steps.length) {
    const min = Math.min(...steps)
    const max = Math.max(...steps)
    const spread = (max - min) / (Math.abs(max) || 1)
    if (spread > 1e-3) {
      issues.push({
        level: 'warning',
        code: 'non-uniform-step',
        message: `步长不完全均匀（${min.toPrecision(5)} – ${max.toPrecision(5)}）`,
        hint: 'Jade 一般可处理；若寻峰异常，可先重采样为均匀步长',
      })
    }
    if (min < 1e-5) {
      issues.push({
        level: 'warning',
        code: 'tiny-step',
        message: `步长 ${min.toExponential(2)} 过小`,
        hint: '过密的点会拖慢 Jade，建议合并/抽稀',
      })
    }
  }
  if (n > 200000) {
    issues.push({
      level: 'warning',
      code: 'many-points',
      message: `数据点较多（${n}）`,
      hint: 'Jade 可读取，但拟合会变慢；可先抽稀到 2–5 万点',
    })
  }
  if (!issues.length) {
    issues.push({
      level: 'info',
      code: 'ok',
      message: '格式检查通过，可直接导入 Jade',
    })
  }
  return issues
}

export function hasErrors(issues: readonly JadeIssue[]): boolean {
  return issues.some((i) => i.level === 'error')
}

/** Human-readable summary of a pattern for status bars and tooltips. */
export function describePattern(pattern: Pattern): string {
  const r = patternRange(pattern)
  return `${r.points} 点 · X ${r.xMin.toFixed(3)}–${r.xMax.toFixed(3)} · Y ${r.yMin.toFixed(1)}–${r.yMax.toFixed(1)} · Δ ${r.stepMedian.toPrecision(4)}`
}
