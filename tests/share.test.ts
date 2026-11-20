import { describe, expect, it } from 'vitest'
import { defaultsFor, getCalculator } from '../src/lib/calculators'
import { decodeState, encodeState } from '../src/lib/share'
import { fromDisplay, toDisplay, tidy } from '../src/lib/units'

describe('share links', () => {
  it('round trips values and settings', () => {
    const calc = getCalculator('compare')!
    const values = defaultsFor(calc)
    values.distance = 812
    values.roundTrip = true
    values.vehicles = [
      { name: 'Old Chevy', type: 'gas', consumption: 22 },
      { name: 'Tesla', type: 'ev', consumption: 17 },
    ]
    const hash = encodeState('compare', values, { units: 'imperial', currency: 'USD' })
    const back = decodeState(hash)!
    expect(back.calcId).toBe('compare')
    expect(back.values.distance).toBe(812)
    expect(back.values.roundTrip).toBe(true)
    expect(back.values.vehicles).toEqual(values.vehicles)
    expect(back.settings).toEqual({ units: 'imperial', currency: 'USD' })
  })

  it('keeps default links short', () => {
    expect(encodeState('trip', defaultsFor(getCalculator('trip')!), { units: 'metric', currency: 'CAD' })).toBe('#trip')
  })

  it('ignores junk', () => {
    expect(decodeState('#nope?x=1')).toBeNull()
    const d = decodeState('#trip?distance=abc&fuelType=rocket&u=furlongs')!
    expect(d.values.distance).toBe(350)
    expect(d.values.fuelType).toBe('gas')
    expect(d.settings.units).toBeUndefined()
  })

  it('allows negative angles only where the field does', () => {
    expect(decodeState('#pinion?pinion=-2.5')!.values.pinion).toBe(-2.5)
    expect(decodeState('#trip?distance=-5')!.values.distance).toBe(350)
  })
})

describe('units', () => {
  it('converts mpg both ways', () => {
    expect(tidy(toDisplay('consumption', 9.4, 'imperial'), 1)).toBe(25)
    expect(tidy(toDisplay('consumption', fromDisplay('consumption', 30, 'imperial'), 'imperial'))).toBe(30)
  })

  it('converts fuel price per gallon', () => {
    expect(toDisplay('fuelPrice', 1, 'imperial')).toBeCloseTo(3.785, 3)
  })
})
