import type { Result, Settings } from './types'
import { LB_PER_KG, distanceUnit, toDisplay, unitFor, usesMiles } from './units'

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
  const u = s.units
  switch (r.kind) {
    case 'money':
      return money(v, s.currency)
    case 'moneyPerDistance': {
      // cost per km -> cost per chosen distance unit
      const per = v / toDisplay('distance', 1, u)
      return `${money(per, s.currency, per < 1)}/${distanceUnit(u)}`
    }
    case 'volume':
      return `${plain(toDisplay('volume', v, u))} ${unitFor('volume', u).label}`
    case 'mass':
      return usesMiles(u) ? `${plain(v * LB_PER_KG, 0)} lb` : `${plain(v, 0)} kg`
    case 'consumption':
      return `${plain(toDisplay('consumption', v, u))} ${unitFor('consumption', u).label}`
    case 'distance':
      return `${plain(toDisplay('distance', v, u), 0)} ${distanceUnit(u)}`
    case 'length': {
      const unit = unitFor('length', u)
      return `${plain(unit.to(v), unit.id === 'in' ? 2 : 0)} ${unit.label}`
    }
    case 'speed':
      return `${plain(toDisplay('speed', v, u))} ${unitFor('speed', u).label}`
    case 'hours':
      return `${plain(v)} h`
    case 'number':
      return `${plain(v, r.digits ?? 1)}${r.unit ? (r.unit === '°' ? r.unit : ` ${r.unit}`) : ''}`
    default:
      return plain(v)
  }
}
