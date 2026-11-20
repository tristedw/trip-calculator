import type { FieldKind, UnitSystem } from './types'

export const KM_PER_MI = 1.609344
export const L_PER_GAL = 3.785411784
export const LB_PER_KG = 2.20462262
export const MM_PER_IN = 25.4
// L/100km <-> US mpg
const MPG_FACTOR = 235.214583

// Everything is stored metric internally. These convert to/from what the user sees.
export function toDisplay(kind: FieldKind, metric: number, units: UnitSystem): number {
  if (units === 'metric') return metric
  switch (kind) {
    case 'distance':
      return metric / KM_PER_MI
    case 'consumption':
      return metric > 0 ? MPG_FACTOR / metric : 0
    case 'evConsumption':
      return metric * KM_PER_MI
    case 'fuelPrice':
      return metric * L_PER_GAL
    case 'volumeRate':
    case 'volume':
      return metric / L_PER_GAL
    case 'length':
      return metric / MM_PER_IN
    case 'speed':
      return metric / KM_PER_MI
    default:
      return metric
  }
}

export function fromDisplay(kind: FieldKind, shown: number, units: UnitSystem): number {
  if (units === 'metric') return shown
  switch (kind) {
    case 'distance':
      return shown * KM_PER_MI
    case 'consumption':
      return shown > 0 ? MPG_FACTOR / shown : 0
    case 'evConsumption':
      return shown / KM_PER_MI
    case 'fuelPrice':
      return shown / L_PER_GAL
    case 'volumeRate':
    case 'volume':
      return shown * L_PER_GAL
    case 'length':
      return shown * MM_PER_IN
    case 'speed':
      return shown * KM_PER_MI
    default:
      return shown
  }
}

export function unitSuffix(kind: FieldKind, units: UnitSystem, symbol: string): string {
  const imp = units === 'imperial'
  switch (kind) {
    case 'distance':
      return imp ? 'mi' : 'km'
    case 'consumption':
      return imp ? 'mpg' : 'L/100km'
    case 'evConsumption':
      return imp ? 'kWh/100mi' : 'kWh/100km'
    case 'fuelPrice':
      return imp ? `${symbol}/gal` : `${symbol}/L`
    case 'energyPrice':
      return `${symbol}/kWh`
    case 'volumeRate':
      return imp ? 'gal/h' : 'L/h'
    case 'volume':
      return imp ? 'gal' : 'L'
    case 'length':
      return imp ? 'in' : 'mm'
    case 'speed':
      return imp ? 'mph' : 'km/h'
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

export const distanceUnit = (units: UnitSystem) => (units === 'imperial' ? 'mi' : 'km')
export const volumeUnit = (units: UnitSystem) => (units === 'imperial' ? 'gal' : 'L')
export const massUnit = (units: UnitSystem) => (units === 'imperial' ? 'lb' : 'kg')

// trims float noise so 30 mpg doesn't come back as 29.999999
export function tidy(n: number, places = 3): number {
  if (!Number.isFinite(n)) return 0
  return Number(n.toFixed(places))
}
