import { defaultsFor, getCalculator, isFuelType } from './calculators'
import type { Settings, UnitPrefs, Values, Vehicle } from './types'
import { IMPERIAL, UNITS, isDim } from './units'

// Link format: #trip?distance=420&consumption=8.4&u=imperial&c=USD
// Values are always metric in the URL so a link reads the same for everyone.

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'AUD', 'NZD']
export const currencies = CURRENCIES

function encodeVehicles(list: Vehicle[]): string {
  return list
    .map((v) => [v.name.replace(/[~|]/g, ' ').trim(), v.type, round(v.consumption)].join('~'))
    .join('|')
}

function decodeVehicles(raw: string): Vehicle[] {
  return raw
    .split('|')
    .map((chunk) => chunk.split('~'))
    .filter((p) => p.length === 3 && isFuelType(p[1]) && Number(p[2]) > 0)
    .slice(0, 6)
    .map(([name, type, cons]) => ({ name: name.slice(0, 40), type: type as Vehicle['type'], consumption: Number(cons) }))
}

const round = (n: number) => Number(n.toFixed(4))

export function encodeState(calcId: string, values: Values, settings: Settings): string {
  const calc = getCalculator(calcId)
  if (!calc) return ''
  const defaults = defaultsFor(calc)
  const params = new URLSearchParams()
  for (const f of calc.fields) {
    const val = values[f.key]
    if (val === undefined) continue
    if (f.kind === 'vehicles') {
      const enc = encodeVehicles(val as Vehicle[])
      if (enc !== encodeVehicles(defaults[f.key] as Vehicle[])) params.set(f.key, enc)
    } else if (f.kind === 'toggle') {
      if (val !== defaults[f.key]) params.set(f.key, val ? '1' : '0')
    } else if (typeof val === 'number') {
      if (round(val) !== round(defaults[f.key] as number)) params.set(f.key, String(round(val)))
    } else if (val !== defaults[f.key]) {
      params.set(f.key, String(val))
    }
  }
  const u = encodeUnits(settings.units)
  if (u) params.set('u', u)
  if (settings.currency !== 'CAD') params.set('c', settings.currency)
  const q = params.toString()
  return `#${calc.id}${q ? `?${q}` : ''}`
}

export interface Decoded {
  calcId: string
  values: Values
  settings: Partial<Settings>
}

export function decodeState(hash: string): Decoded | null {
  const clean = hash.replace(/^#\/?/, '')
  if (!clean) return null
  const [id, query = ''] = clean.split('?')
  const calc = getCalculator(id)
  if (!calc) return null
  const params = new URLSearchParams(query)
  const values = defaultsFor(calc)
  for (const f of calc.fields) {
    const raw = params.get(f.key)
    if (raw === null) continue
    if (f.kind === 'vehicles') {
      const list = decodeVehicles(raw)
      if (list.length) values[f.key] = list
    } else if (f.kind === 'toggle') {
      values[f.key] = raw === '1' || raw === 'true'
    } else if (f.kind === 'select') {
      if (f.options?.some((o) => o.value === raw)) values[f.key] = raw
    } else {
      const n = Number(raw)
      if (Number.isFinite(n) && n >= (f.min ?? 0)) values[f.key] = n
    }
  }
  const settings: Partial<Settings> = {}
  const u = params.get('u')
  if (u) settings.units = decodeUnits(u)
  const c = params.get('c')
  if (c && CURRENCIES.includes(c)) settings.currency = c
  return { calcId: calc.id, values, settings }
}

// u=distance.mi,consumption.mpg  (only the ones that aren't metric)
export function encodeUnits(prefs: UnitPrefs): string {
  return Object.entries(prefs)
    .filter(([dim, id]) => isDim(dim) && id && id !== UNITS[dim][0].id && UNITS[dim].some((x) => x.id === id))
    .map(([dim, id]) => `${dim}.${id}`)
    .join(',')
}

export function decodeUnits(raw: string): UnitPrefs {
  // links made before units were picked one at a time
  if (raw === 'imperial') return { ...IMPERIAL }
  if (raw === 'metric') return {}
  const out: UnitPrefs = {}
  for (const pair of raw.split(',')) {
    const [dim, id] = pair.split('.')
    if (dim && isDim(dim) && UNITS[dim].some((x) => x.id === id)) out[dim] = id
  }
  return out
}
