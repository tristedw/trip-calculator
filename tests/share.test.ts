import { describe, expect, it } from 'vitest'
import { defaultsFor, getCalculator } from '../src/lib/calculators'
import { formatResult } from '../src/lib/format'
import { decodeState, decodeUnits, encodeState, encodeUnits } from '../src/lib/share'
import { IMPERIAL, fromDisplay, tidy, toDisplay } from '../src/lib/units'

const metric = { units: {}, currency: 'CAD' }

describe('share links', () => {
  it('round trips values, units and currency', () => {
    const calc = getCalculator('compare')!
    const values = defaultsFor(calc)
    values.distance = 812
    values.roundTrip = true
    values.vehicles = [
      { name: 'Old Chevy', type: 'gas', consumption: 22 },
      { name: 'Tesla', type: 'ev', consumption: 17 },
    ]
    const units = { distance: 'mi', consumption: 'mpguk' }
    const hash = encodeState('compare', values, { units, currency: 'USD' })
    const back = decodeState(hash)!
    expect(back.calcId).toBe('compare')
    expect(back.values.distance).toBe(812)
    expect(back.values.roundTrip).toBe(true)
    expect(back.values.vehicles).toEqual(values.vehicles)
    expect(back.settings).toEqual({ units, currency: 'USD' })
  })

  it('keeps default links short', () => {
    expect(encodeState('trip', defaultsFor(getCalculator('trip')!), metric)).toBe('#trip')
  })

  it('ignores junk', () => {
    expect(decodeState('#nope?x=1')).toBeNull()
    const d = decodeState('#trip?distance=abc&fuelType=rocket&u=furlongs.yes')!
    expect(d.values.distance).toBe(350)
    expect(d.values.fuelType).toBe('gas')
    expect(d.settings.units).toEqual({})
  })

  it('still opens links from before per unit picks', () => {
    expect(decodeUnits('imperial')).toEqual(IMPERIAL)
    expect(encodeUnits({ distance: 'km', speed: 'mph' })).toBe('speed.mph')
  })

  it('allows negative angles only where the field does', () => {
    expect(decodeState('#pinion?pinion=-2.5')!.values.pinion).toBe(-2.5)
    expect(decodeState('#trip?distance=-5')!.values.distance).toBe(350)
  })
})

describe('units', () => {
  it('converts US mpg both ways', () => {
    const u = { consumption: 'mpg' }
    expect(tidy(toDisplay('consumption', 9.4, u), 1)).toBe(25)
    expect(tidy(toDisplay('consumption', fromDisplay('consumption', 30, u), u))).toBe(30)
  })

  it('UK mpg is bigger than US mpg for the same car', () => {
    expect(toDisplay('consumption', 10, { consumption: 'mpguk' })).toBeGreaterThan(toDisplay('consumption', 10, { consumption: 'mpg' }))
  })

  it('converts fuel price per gallon', () => {
    expect(toDisplay('fuelPrice', 1, { fuelPrice: 'gal' })).toBeCloseTo(3.785, 3)
    expect(toDisplay('fuelPrice', 1, { fuelPrice: 'galuk' })).toBeCloseTo(4.546, 3)
  })

  it('formats results in the picked units', () => {
    const r = { label: 'x', value: 100, kind: 'distance' as const }
    expect(formatResult(r, metric)).toBe('100 km')
    expect(formatResult(r, { units: { distance: 'mi' }, currency: 'CAD' })).toBe('62 mi')
    expect(formatResult({ label: 'x', value: 0.5, kind: 'moneyPerDistance' }, { units: { distance: 'mi' }, currency: 'CAD' })).toBe('$0.805/mi')
  })
})
