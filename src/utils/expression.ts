/**
 * Evaluate a small arithmetic expression safely (for numeric input fields).
 * Supports + - * / ^, parentheses, decimals, exponents, pi and a few functions.
 */
const ALLOWED = /^[0-9eE+\-*/().^%\s,a-zA-Zπ]*$/

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
}

export function evaluateExpression(input: string): number | null {
  const text = input.trim()
  if (!text) return null
  if (!ALLOWED.test(text)) return null
  const normalized = text
    .replace(/π/g, 'PI')
    .replace(/\bpi\b/gi, 'PI')
    .replace(/\^/g, '**')
  // Strip scientific notation (1e3) before checking identifiers.
  const withoutNumbers = normalized.replace(/(\d)[eE]([+-]?\d+)/g, '$1')
  const names = withoutNumbers.match(/[a-zA-Z]+/g) ?? []
  if (names.some((n) => n !== 'PI' && !(n in FUNCTIONS))) return null
  try {
    // Build a function with only whitelisted identifiers in scope.
    const names = Object.keys(FUNCTIONS)
    const args = names.map((name) => FUNCTIONS[name])
    const body = normalized.replace(/\bPI\b/g, 'PI_VALUE')
    const fn = new Function('PI_VALUE', ...names, `"use strict"; return (${body});`)
    const result = fn(Math.PI, ...args)
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

export function formatInputNumber(value: number, precision = 6): string {
  if (!Number.isFinite(value)) return ''
  if (Math.abs(value) >= 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 1e-4)) {
    return value.toExponential(4)
  }
  const fixed = value.toFixed(precision)
  if (!fixed.includes('.')) return fixed
  return fixed.replace(/0+$/, '').replace(/\.$/, '') || '0'
}
