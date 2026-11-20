import type { Result, Settings } from './types'
import { KM_PER_MI, L_PER_GAL, LB_PER_KG, MM_PER_IN, distanceUnit, massUnit, toDisplay, volumeUnit } from './units'

const moneyFormatters = new Map<string, Intl.NumberFormat>()

export function money(n: number, currency: string, precise = false): string {
  const key = `${currency}${precise}`
  let f = moneyFormatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: precise ? 3 : 2,
    })
    moneyFormatters.set(key, f)
  }
  return f.format(Number.isFinite(n) ? n : 0)
}

export function currencySymbol(currency: string): string {
  const part = new Intl.NumberFormat('en-CA', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0)
    .find((p) => p.type === 'currency')
  return part?.value ?? '$'
}

const plain = (n: number, digits = 1) =>
  new Intl.NumberFormat('en-CA', { maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0)

export function formatResult(r: Result, s: Settings): string {
  if (typeof r.value === 'string') return r.value
  const v = r.value
  const imp = s.units === 'imperial'
  switch (r.kind) {
    case 'money':
      return money(v, s.currency)
    case 'moneyPerDistance': {
      const per = imp ? v * KM_PER_MI : v
      return `${money(per, s.currency, per < 1)}/${distanceUnit(s.units)}`
    }
    case 'volume':
      return `${plain(imp ? v / L_PER_GAL : v)} ${volumeUnit(s.units)}`
    case 'mass':
      return `${plain(imp ? v * LB_PER_KG : v, 0)} ${massUnit(s.units)}`
    case 'consumption':
      return imp ? `${plain(toDisplay('consumption', v, 'imperial'))} mpg` : `${plain(v)} L/100km`
    case 'hours':
      return `${plain(v)} h`
    case 'distance':
      return `${plain(imp ? v / KM_PER_MI : v, 0)} ${distanceUnit(s.units)}`
    case 'length':
      return imp ? `${plain(v / MM_PER_IN, 2)} in` : `${plain(v, 0)} mm`
    case 'speed':
      return imp ? `${plain(v / KM_PER_MI)} mph` : `${plain(v)} km/h`
    case 'number':
      return `${plain(v, r.digits ?? 1)}${r.unit ? (r.unit === '°' ? r.unit : ` ${r.unit}`) : ''}`
    default:
      return plain(v)
  }
}
