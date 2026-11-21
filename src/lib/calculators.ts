import { camper, compare, costPerKm, fillUp, fuelTrip, idling, towing } from './driving'
import { gears, pinion, power, rpm, solar, tires } from './garage'
import { breakEven, inflation, loan } from './money'
import type { Calculator, FuelType, Group, Values } from './types'

export const calculators: Calculator[] = [
  fuelTrip,
  fillUp,
  costPerKm,
  compare,
  towing,
  camper,
  idling,
  loan,
  inflation,
  breakEven,
  power,
  solar,
  tires,
  gears,
  rpm,
  pinion,
]

export const groups: Group[] = ['Driving', 'Money', 'Garage']

export const getCalculator = (id: string) => calculators.find((c) => c.id === id)

export function defaultsFor(calc: Calculator): Values {
  const out: Values = {}
  for (const f of calc.fields) {
    out[f.key] = Array.isArray(f.default) ? f.default.map((x) => ({ ...x })) : f.default
  }
  return out
}

export const isFuelType = (s: string): s is FuelType => s === 'gas' || s === 'diesel' || s === 'ev'
