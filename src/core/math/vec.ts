/**
 * Small, dependency-free linear algebra helpers used by the crystallography core.
 * All angles are radians unless a name ends with `Deg`.
 */

export type Vec3 = [number, number, number]
export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
]

export const DEG = Math.PI / 180
export const RAD = 180 / Math.PI

export function deg2rad(deg: number): number {
  return deg * DEG
}

export function rad2deg(rad: number): number {
  return rad * RAD
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

export function norm(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2])
}

export function normalize(a: Vec3): Vec3 {
  const n = norm(a)
  if (n === 0) return [0, 0, 0]
  return [a[0] / n, a[1] / n, a[2] / n]
}

export function mulMat3Vec3(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ]
}

export function transpose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ]
}

export function det3(m: Mat3): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  )
}

export function inverse3(m: Mat3): Mat3 {
  const d = det3(m)
  if (Math.abs(d) < 1e-14) throw new Error('矩阵奇异，无法求逆')
  const inv = 1 / d
  return [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * inv,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * inv,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * inv,
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * inv,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * inv,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * inv,
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * inv,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * inv,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * inv,
    ],
  ]
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

export function gcd3(a: number, b: number, c: number): number {
  return gcd(gcd(a, b), c)
}

/** Reduce an integer index triplet by its greatest common divisor. */
export function reduceIndices<T extends [number, number, number]>(v: T): T {
  const d = gcd3(v[0], v[1], v[2])
  return [v[0] / d, v[1] / d, v[2] / d] as T
}

/** Make the first non-zero index positive (stable display convention). */
export function canonicalizeIndices<T extends [number, number, number]>(v: T): T {
  const first = v.find((x) => x !== 0) ?? 1
  return (first < 0 ? [-v[0], -v[1], -v[2]] : [...v]) as T
}

export function formatNumber(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '—'
  if (value !== 0 && (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e6)) {
    return value.toExponential(3)
  }
  return value.toFixed(digits)
}

/** Format Miller indices with a typographic minus sign, e.g. [1 -1 0]. */
export function formatHkl(hkl: readonly number[], bracket: 'round' | 'square' | 'curly' | 'none' = 'round'): string {
  const body = hkl.map((n) => (n < 0 ? `-${Math.abs(n)}` : `${n}`)).join(' ')
  if (bracket === 'none') return body
  const map = { round: ['(', ')'], square: ['[', ']'], curly: ['{', '}'] } as const
  return `${map[bracket][0]}${body}${map[bracket][1]}`
}
