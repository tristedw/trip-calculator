import { describe, expect, it } from 'vitest'
import { calculators, defaultsFor } from '../src/lib/calculators'
import { fuelTrip, towing, compare, vehicleTripCost } from '../src/lib/driving'
import { loanPayment, duration, breakEven } from '../src/lib/money'
import { tireDiameterMm, closestRatio, rpm, pinion } from '../src/lib/garage'

const primary = (calc: (typeof calculators)[number], over = {}) =>
  calc.compute({ ...defaultsFor(calc), ...over }).find((r) => r.primary)!.value

describe('every calculator', () => {
  it.each(calculators.map((c) => [c.id, c] as const))('%s computes with defaults', (_, calc) => {
    const out = calc.compute(defaultsFor(calc))
    expect(out.length).toBeGreaterThan(0)
    expect(out.filter((r) => r.primary)).toHaveLength(1)
    for (const r of out) if (typeof r.value === 'number') expect(Number.isFinite(r.value)).toBe(true)
  })

  it.each(calculators.map((c) => [c.id, c] as const))('%s survives empty input', (_, calc) => {
    const empty = Object.fromEntries(calc.fields.map((f) => [f.key, f.kind === 'vehicles' ? [] : 0]))
    for (const r of calc.compute(empty)) if (typeof r.value === 'number') expect(Number.isFinite(r.value)).toBe(true)
  })

  it('has unique ids', () => {
    expect(new Set(calculators.map((c) => c.id)).size).toBe(calculators.length)
  })
})

describe('driving', () => {
  it('fuel per trip', () => {
    // 200 km at 10 L/100km at $2 = $40
    expect(primary(fuelTrip, { distance: 200, consumption: 10, fuelPrice: 2 })).toBeCloseTo(40)
    expect(primary(fuelTrip, { distance: 200, consumption: 10, fuelPrice: 2, roundTrip: true })).toBeCloseTo(80)
  })

  it('towing extra is the penalty share of base cost', () => {
    expect(primary(towing, { distance: 100, consumption: 10, fuelPrice: 2, penalty: 50 })).toBeCloseTo(10)
  })

  it('compares gas against ev', () => {
    const prices = { gas: 2, diesel: 2, kwh: 0.1 }
    expect(vehicleTripCost({ name: 'g', type: 'gas', consumption: 10 }, 100, prices)).toBeCloseTo(20)
    expect(vehicleTripCost({ name: 'e', type: 'ev', consumption: 20 }, 100, prices)).toBeCloseTo(2)
    const out = compare.compute({ ...defaultsFor(compare) })
    expect(String(out[0].label)).toContain('EV')
  })
})

describe('money', () => {
  it('matches a known amortization', () => {
    // 20k over 60 months at 6% APR is about 386.66
    expect(loanPayment(20000, 6, 60)).toBeCloseTo(386.66, 1)
    expect(loanPayment(12000, 0, 12)).toBe(1000)
  })

  it('formats durations', () => {
    expect(duration(14)).toBe('1 yr 2 mo')
    expect(duration(24)).toBe('2 yrs')
    expect(duration(Infinity)).toBe('Never')
  })

  it('break-even never happens with no savings', () => {
    expect(primary(breakEven, { savings: 0 })).toBe('Never')
  })
})

describe('garage', () => {
  it('tire diameter', () => {
    // 285/75R17 is about 33.8 in
    expect(tireDiameterMm(285, 75, 17) / 25.4).toBeCloseTo(33.83, 1)
  })

  it('picks the nearest common ratio', () => {
    expect(closestRatio(4.6)).toBe(4.56)
  })

  it('rpm at speed', () => {
    // 31 in tire, 3.73 axle, 1:1 gear, 100 km/h is about 2523 rpm
    const val = primary(rpm, { tire: 787.4, axle: 3.73, gear: 1, speed: 100 }) as number
    expect(val).toBeGreaterThan(2500)
    expect(val).toBeLessThan(2550)
  })

  it('pinion matches trans output on a standard shaft with links', () => {
    expect(primary(pinion, { shaft: 'single', suspension: 'link', trans: 3 })).toBeCloseTo(3)
    expect(primary(pinion, { shaft: 'single', suspension: 'leaf', trans: 3 })).toBeCloseTo(1.5)
  })
})
