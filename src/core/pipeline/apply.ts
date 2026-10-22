import { STEP_DEFINITIONS } from '@/core/pipeline/steps'
import {
  clonePattern,
  type ApplyIssue,
  type ApplyResult,
  type Pattern,
  type Step,
  type StepParams,
} from '@/core/pipeline/types'

/** Apply the enabled steps in order, collecting non-fatal issues. */
export function applyPipeline(raw: Pattern, steps: readonly Step[]): ApplyResult {
  let current = clonePattern(raw)
  const issues: ApplyIssue[] = []
  const resolved: Record<string, StepParams> = {}
  for (const step of steps) {
    if (!step.enabled) continue
    const definition = STEP_DEFINITIONS[step.type]
    if (!definition) {
      issues.push({ stepId: step.id, stepType: step.type, message: `未知步骤类型 ${step.type}` })
      continue
    }
    try {
      const effective = definition.resolve ? definition.resolve(current, step.params) : step.params
      resolved[step.id] = effective
      current = definition.apply(current, effective)
    } catch (error) {
      issues.push({
        stepId: step.id,
        stepType: step.type,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { pattern: current, issues, resolved }
}

/** Apply inverse operations in reverse order (only for steps that support it). */
export function invertPipeline(
  processed: Pattern,
  steps: readonly Step[],
  resolved: Record<string, StepParams> = {},
): { pattern: Pattern; skipped: string[] } {
  let current = clonePattern(processed)
  const skipped: string[] = []
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    if (!step.enabled) continue
    const definition = STEP_DEFINITIONS[step.type]
    if (!definition?.invert || !definition.invertible) {
      skipped.push(definition?.label ?? step.type)
      continue
    }
    const params = resolved[step.id] ?? step.params
    current = definition.invert(current, params)
  }
  return { pattern: current, skipped }
}

/** Compute the intermediate pattern after each enabled step (for diagnostics). */
export function tracePipeline(
  raw: Pattern,
  steps: readonly Step[],
): Array<{ step: Step; input: Pattern; output: Pattern; error?: string }> {
  let current = clonePattern(raw)
  const trace: Array<{ step: Step; input: Pattern; output: Pattern; error?: string }> = []
  for (const step of steps) {
    if (!step.enabled) continue
    const definition = STEP_DEFINITIONS[step.type]
    if (!definition) continue
    try {
      const effective = definition.resolve ? definition.resolve(current, step.params) : step.params
      const output = definition.apply(current, effective)
      trace.push({ step, input: current, output })
      current = output
    } catch (error) {
      trace.push({
        step,
        input: current,
        output: current,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return trace
}
