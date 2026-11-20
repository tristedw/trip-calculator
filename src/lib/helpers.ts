import type { Values } from './types'

export const num = (v: Values, k: string) => {
  const n = Number(v[k])
  return Number.isFinite(n) && n > 0 ? n : 0
}
export const str = (v: Values, k: string) => String(v[k] ?? '')
export const bool = (v: Values, k: string) => v[k] === true || v[k] === 'true' || v[k] === '1'
export const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0)
// for fields that can go negative, like angles
export const signed = (v: Values, k: string) => {
  const n = Number(v[k])
  return Number.isFinite(n) ? n : 0
}
