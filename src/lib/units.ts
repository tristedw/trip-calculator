import type { FieldKind, UnitPrefs } from './types'

export const KM_PER_MI = 1.609344
export const L_PER_GAL = 3.785411784
export const L_PER_UK_GAL = 4.54609
export const LB_PER_KG = 2.20462262
export const MM_PER_IN = 25.4

export type Dim = 'distance' | 'consumption' | 'evConsumption' | 'fuelPrice' | 'volume' | 'volumeRate' | 'length' | 'speed'

export interface Unit {
  id: string
  label: string
  // metric value -> shown value and back
  to: (m: number) => number
  from: (s: number) => number
  step?: number
}

const same = (id: string, label: string, step?: number): Unit => ({ id, label, to: (m) => m, from: (s) => s, step })
const scale = (id: string, label: string, k: number, step?: number): Unit => ({ id, label, to: (m) => m * k, from: (s) => s / k, step })
// for "distance per fuel" style units, which run backwards
const inverse = (id: string, label: string, k: number, step?: number): Unit => ({
  id,
  label,
  to: (m) => (m > 0 ? k / m : 0),
  from: (s) => (s > 0 ? k / s : 0),
  step,
})

export const UNITS: Record<Dim, Unit[]> = {
  distance: [same('km', 'km'), scale('mi', 'mi', 1 / KM_PER_MI)],
  consumption: [
    same('l100', 'L/100km', 0.1),
    inverse('mpg', 'mpg', 235.214583, 0.5),
    inverse('mpguk', 'mpg (UK)', 282.480936, 0.5),
    inverse('kml', 'km/L', 100, 0.1),
  ],
  evConsumption: [
    same('kwh100km', 'kWh/100km', 0.5),
    scale('kwh100mi', 'kWh/100mi', KM_PER_MI, 0.5),
    inverse('mikwh', 'mi/kWh', 100 / KM_PER_MI, 0.1),
    inverse('kmkwh', 'km/kWh', 100, 0.1),
  ],
  fuelPrice: [same('l', '/L', 0.01), scale('gal', '/gal', L_PER_GAL, 0.01), scale('galuk', '/UK gal', L_PER_UK_GAL, 0.01)],
  volume: [same('l', 'L', 1), scale('gal', 'gal', 1 / L_PER_GAL, 1), scale('galuk', 'UK gal', 1 / L_PER_UK_GAL, 1)],
  volumeRate: [same('lh', 'L/h', 0.05), scale('galh', 'gal/h', 1 / L_PER_GAL, 0.01)],
  length: [same('mm', 'mm', 1), scale('in', 'in', 1 / MM_PER_IN, 0.1)],
  speed: [same('kmh', 'km/h', 1), scale('mph', 'mph', 1 / KM_PER_MI, 1)],
}

export const isDim = (k: string): k is Dim => k in UNITS

export function unitFor(dim: Dim, prefs: UnitPrefs): Unit {
  const list = UNITS[dim]
  return list.find((u) => u.id === prefs[dim]) ?? list[0]
}

// one click way to set everything to US style units, also used for old links
export const IMPERIAL: UnitPrefs = {
  distance: 'mi',
  consumption: 'mpg',
  evConsumption: 'kwh100mi',
  fuelPrice: 'gal',
  volume: 'gal',
  volumeRate: 'galh',
  length: 'in',
  speed: 'mph',
}

export function toDisplay(kind: FieldKind, metric: number, prefs: UnitPrefs): number {
  return isDim(kind) ? unitFor(kind, prefs).to(metric) : metric
}

export function fromDisplay(kind: FieldKind, shown: number, prefs: UnitPrefs): number {
  return isDim(kind) ? unitFor(kind, prefs).from(shown) : shown
}

export function unitSuffix(kind: FieldKind, prefs: UnitPrefs, symbol: string): string {
  if (isDim(kind)) {
    const label = unitFor(kind, prefs).label
    return kind === 'fuelPrice' ? `${symbol}${label}` : label
  }
  switch (kind) {
    case 'energyPrice':
      return `${symbol}/kWh`
    case 'money':
      return symbol
    case 'minutes':
      return 'min'
    case 'hours':
      return 'h'
    case 'percent':
      return '%'
    default:
      return ''
  }
}

export const distanceUnit = (prefs: UnitPrefs) => unitFor('distance', prefs).label
export const usesMiles = (prefs: UnitPrefs) => unitFor('distance', prefs).id === 'mi'

// trims float noise so 30 mpg doesn't come back as 29.999999
export function tidy(n: number, places = 3): number {
  if (!Number.isFinite(n)) return 0
  return Number(n.toFixed(places))
}
