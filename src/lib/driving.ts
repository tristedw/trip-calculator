import { bool, num, safeDiv, str } from './helpers'
import type { Calculator, Result, Vehicle } from './types'

// kg CO2 per litre burned (NRCan / EPA figures, rounded)
export const CO2_KG_PER_L: Record<'gas' | 'diesel', number> = {
  gas: 2.31,
  diesel: 2.68,
}

export const litresUsed = (km: number, lPer100: number) => (km * lPer100) / 100
export const co2For = (litres: number, fuel: string) =>
  litres * (fuel === 'diesel' ? CO2_KG_PER_L.diesel : CO2_KG_PER_L.gas)
const perPerson = (total: number, people: number) => total / Math.max(1, Math.round(people))

export const fuelTypeField = {
  key: 'fuelType',
  label: 'Fuel',
  kind: 'select' as const,
  default: 'gas',
  options: [
    { value: 'gas', label: 'Gasoline' },
    { value: 'diesel', label: 'Diesel' },
  ],
}

export const fuelTrip: Calculator = {
  id: 'trip',
  group: 'Driving',
  tab: 'Fuel per trip',
  title: 'Fuel cost per trip',
  blurb: 'How much a drive costs in fuel, and what everyone owes.',
  fields: [
    { key: 'distance', label: 'Distance', kind: 'distance', default: 350, step: 1 },
    { key: 'roundTrip', label: 'Round trip', kind: 'toggle', default: false },
    { key: 'consumption', label: 'Fuel economy', kind: 'consumption', default: 9.5, step: 0.1 },
    { key: 'fuelPrice', label: 'Fuel price', kind: 'fuelPrice', default: 1.65, step: 0.01 },
    fuelTypeField,
    { key: 'people', label: 'Splitting between', kind: 'count', default: 1, min: 1, step: 1, suffix: 'people' },
  ],
  compute(v) {
    const km = num(v, 'distance') * (bool(v, 'roundTrip') ? 2 : 1)
    const litres = litresUsed(km, num(v, 'consumption'))
    const cost = litres * num(v, 'fuelPrice')
    const people = Math.max(1, num(v, 'people'))
    const out: Result[] = [
      { label: 'Fuel cost', value: cost, kind: 'money', primary: true },
      { label: 'Fuel used', value: litres, kind: 'volume' },
      { label: 'Cost per distance', value: safeDiv(cost, km), kind: 'moneyPerDistance' },
      { label: 'CO2 emitted', value: co2For(litres, str(v, 'fuelType')), kind: 'mass' },
    ]
    if (people > 1) out.splice(1, 0, { label: 'Each person pays', value: perPerson(cost, people), kind: 'money' })
    return out
  },
}

export const costPerKm: Calculator = {
  id: 'per-km',
  group: 'Driving',
  tab: 'Cost per km',
  title: 'True cost per kilometre',
  blurb: 'Fuel is only part of it. Add the stuff you pay whether you drive or not.',
  fields: [
    { key: 'annualDistance', label: 'Driven per year', kind: 'distance', default: 20000, step: 100 },
    { key: 'consumption', label: 'Fuel economy', kind: 'consumption', default: 10, step: 0.1 },
    { key: 'fuelPrice', label: 'Fuel price', kind: 'fuelPrice', default: 1.65, step: 0.01 },
    { key: 'insurance', label: 'Insurance / year', kind: 'money', default: 2000, step: 10 },
    { key: 'maintenance', label: 'Maintenance + tires / year', kind: 'money', default: 1200, step: 10 },
    { key: 'registration', label: 'Registration + licensing / year', kind: 'money', default: 150, step: 5 },
    { key: 'depreciation', label: 'Depreciation / year', kind: 'money', default: 3500, step: 50, help: 'Purchase price minus expected resale, divided by years owned.' },
    { key: 'financing', label: 'Loan interest / year', kind: 'money', default: 0, step: 10 },
    { key: 'parking', label: 'Parking + tolls / year', kind: 'money', default: 0, step: 10 },
  ],
  compute(v) {
    const km = num(v, 'annualDistance')
    const fuelYear = litresUsed(km, num(v, 'consumption')) * num(v, 'fuelPrice')
    const fixedYear = ['insurance', 'maintenance', 'registration', 'depreciation', 'financing', 'parking']
      .map((k) => num(v, k))
      .reduce((a, b) => a + b, 0)
    const total = fuelYear + fixedYear
    return [
      { label: 'Real cost per distance', value: safeDiv(total, km), kind: 'moneyPerDistance', primary: true },
      { label: 'Fuel only', value: safeDiv(fuelYear, km), kind: 'moneyPerDistance', bar: safeDiv(fuelYear, total) },
      { label: 'Ownership only', value: safeDiv(fixedYear, km), kind: 'moneyPerDistance', bar: safeDiv(fixedYear, total) },
      { label: 'Per year', value: total, kind: 'money' },
      { label: 'Per month', value: total / 12, kind: 'money' },
      { label: 'Fuel share of total', value: `${Math.round(safeDiv(fuelYear, total) * 100)}%`, kind: 'text' },
    ]
  },
}

export const camper: Calculator = {
  id: 'camper',
  group: 'Driving',
  tab: 'Camper',
  title: 'Camper operating cost',
  blurb: 'Driving, generator, propane and site fees for a camping trip.',
  fields: [
    { key: 'distance', label: 'Total driving', kind: 'distance', default: 600, step: 1 },
    { key: 'consumption', label: 'Fuel economy (loaded)', kind: 'consumption', default: 18, step: 0.1 },
    { key: 'fuelPrice', label: 'Fuel price', kind: 'fuelPrice', default: 1.65, step: 0.01 },
    fuelTypeField,
    { key: 'nights', label: 'Nights', kind: 'count', default: 5, min: 0, step: 1, suffix: 'nights' },
    { key: 'siteFee', label: 'Campsite / night', kind: 'money', default: 45, step: 1 },
    { key: 'genRate', label: 'Generator burn rate', kind: 'volumeRate', default: 0.5, step: 0.05, help: 'A 2000 W inverter generator at half load is around 0.5 L/h.' },
    { key: 'genHours', label: 'Generator hours / night', kind: 'hours', default: 3, step: 0.5 },
    { key: 'genPrice', label: 'Generator fuel price', kind: 'fuelPrice', default: 1.65, step: 0.01 },
    { key: 'propane', label: 'Propane / night', kind: 'money', default: 6, step: 0.5 },
    { key: 'extras', label: 'Dump, water, firewood, other', kind: 'money', default: 40, step: 1 },
    { key: 'people', label: 'Splitting between', kind: 'count', default: 2, min: 1, step: 1, suffix: 'people' },
  ],
  compute(v) {
    const nights = Math.round(num(v, 'nights'))
    const drivingL = litresUsed(num(v, 'distance'), num(v, 'consumption'))
    const driving = drivingL * num(v, 'fuelPrice')
    const genL = num(v, 'genRate') * num(v, 'genHours') * nights
    const generator = genL * num(v, 'genPrice')
    const sites = num(v, 'siteFee') * nights
    const propane = num(v, 'propane') * nights
    const extras = num(v, 'extras')
    const total = driving + generator + sites + propane + extras
    const parts: [string, number][] = [
      ['Driving fuel', driving],
      ['Campsites', sites],
      ['Generator', generator],
      ['Propane', propane],
      ['Other', extras],
    ]
    const out: Result[] = [{ label: 'Trip total', value: total, kind: 'money', primary: true }]
    for (const [label, value] of parts) out.push({ label, value, kind: 'money', bar: safeDiv(value, total) })
    out.push({ label: 'Per night', value: safeDiv(total, nights), kind: 'money' })
    if (num(v, 'people') > 1) out.push({ label: 'Each person pays', value: perPerson(total, num(v, 'people')), kind: 'money' })
    out.push({ label: 'CO2 emitted', value: co2For(drivingL, str(v, 'fuelType')) + co2For(genL, 'gas'), kind: 'mass' })
    return out
  },
}

export const idling: Calculator = {
  id: 'idle',
  group: 'Driving',
  tab: 'Idling',
  title: 'Cost of idling',
  blurb: 'Warm-ups, drive-thrus and waiting in the lot add up over a year.',
  fields: [
    {
      key: 'engine',
      label: 'Engine',
      kind: 'select',
      default: 'v8',
      help: 'Rough idle burn rates. Pick custom if you know yours.',
      options: [
        { value: 'i4', label: '4 cylinder car (~0.9 L/h)', sets: { idleRate: 0.9, fuelType: 'gas' } },
        { value: 'v6', label: 'V6 car or SUV (~1.4 L/h)', sets: { idleRate: 1.4, fuelType: 'gas' } },
        { value: 'v8', label: 'V8 gas truck (~2.0 L/h)', sets: { idleRate: 2.0, fuelType: 'gas' } },
        { value: 'diesel', label: 'Diesel pickup (~2.6 L/h)', sets: { idleRate: 2.6, fuelType: 'diesel' } },
        { value: 'semi', label: 'Heavy truck (~3.8 L/h)', sets: { idleRate: 3.8, fuelType: 'diesel' } },
        { value: 'custom', label: 'Custom' },
      ],
    },
    { key: 'idleRate', label: 'Idle burn rate', kind: 'volumeRate', default: 2.0, step: 0.1 },
    fuelTypeField,
    { key: 'fuelPrice', label: 'Fuel price', kind: 'fuelPrice', default: 1.65, step: 0.01 },
    { key: 'minutes', label: 'Idling per day', kind: 'minutes', default: 15, step: 1 },
    { key: 'days', label: 'Days per year', kind: 'count', default: 200, min: 0, step: 1, suffix: 'days' },
  ],
  compute(v) {
    const hoursDay = num(v, 'minutes') / 60
    const litresDay = num(v, 'idleRate') * hoursDay
    const costDay = litresDay * num(v, 'fuelPrice')
    const days = num(v, 'days')
    const litresYear = litresDay * days
    return [
      { label: 'Per year', value: costDay * days, kind: 'money', primary: true },
      { label: 'Per day', value: costDay, kind: 'money' },
      { label: 'Per month', value: (costDay * days) / 12, kind: 'money' },
      { label: 'Fuel burned / year', value: litresYear, kind: 'volume' },
      { label: 'Engine hours / year', value: hoursDay * days, kind: 'hours', note: 'Hours with zero distance on the odometer.' },
      { label: 'CO2 / year', value: co2For(litresYear, str(v, 'fuelType')), kind: 'mass' },
    ]
  },
}

export const towing: Calculator = {
  id: 'tow',
  group: 'Driving',
  tab: 'Towing',
  title: 'Cost of towing',
  blurb: 'What hooking up the trailer actually adds to the fuel bill.',
  fields: [
    { key: 'distance', label: 'Distance', kind: 'distance', default: 400, step: 1 },
    { key: 'roundTrip', label: 'Round trip', kind: 'toggle', default: false },
    { key: 'consumption', label: 'Fuel economy unloaded', kind: 'consumption', default: 13, step: 0.1 },
    {
      key: 'load',
      label: 'Trailer',
      kind: 'select',
      default: 'travel',
      help: 'Typical economy hit. Wind, hills and speed swing this a lot.',
      options: [
        { value: 'utility', label: 'Small utility / boat (+15%)', sets: { penalty: 15 } },
        { value: 'travel', label: 'Travel trailer (+35%)', sets: { penalty: 35 } },
        { value: 'toy', label: 'Car hauler / toy hauler (+45%)', sets: { penalty: 45 } },
        { value: 'fifth', label: 'Fifth wheel / heavy (+55%)', sets: { penalty: 55 } },
        { value: 'custom', label: 'Custom' },
      ],
    },
    { key: 'penalty', label: 'Extra fuel used', kind: 'percent', default: 35, step: 1 },
    { key: 'fuelPrice', label: 'Fuel price', kind: 'fuelPrice', default: 1.65, step: 0.01 },
    fuelTypeField,
  ],
  compute(v) {
    const km = num(v, 'distance') * (bool(v, 'roundTrip') ? 2 : 1)
    const base = num(v, 'consumption')
    const towingL100 = base * (1 + num(v, 'penalty') / 100)
    const price = num(v, 'fuelPrice')
    const without = litresUsed(km, base) * price
    const withTrailer = litresUsed(km, towingL100) * price
    const extraL = litresUsed(km, towingL100 - base)
    return [
      { label: 'Extra cost of towing', value: withTrailer - without, kind: 'money', primary: true },
      { label: 'Trip with trailer', value: withTrailer, kind: 'money', bar: 1 },
      { label: 'Trip without trailer', value: without, kind: 'money', bar: safeDiv(without, withTrailer) },
      { label: 'Economy while towing', value: towingL100, kind: 'consumption' },
      { label: 'Extra per distance', value: safeDiv(withTrailer - without, km), kind: 'moneyPerDistance' },
      { label: 'Extra CO2', value: co2For(extraL, str(v, 'fuelType')), kind: 'mass' },
    ]
  },
}

export const defaultVehicles: Vehicle[] = [
  { name: 'Daily driver', type: 'gas', consumption: 8 },
  { name: 'Pickup', type: 'diesel', consumption: 12.5 },
  { name: 'EV', type: 'ev', consumption: 18 },
]

export function vehicleTripCost(
  vh: Vehicle,
  km: number,
  prices: { gas: number; diesel: number; kwh: number },
): number {
  const per = vh.type === 'ev' ? prices.kwh : vh.type === 'diesel' ? prices.diesel : prices.gas
  return ((km * vh.consumption) / 100) * per
}

export function vehicleCo2(vh: Vehicle, km: number, gridGramsPerKwh: number): number {
  const amount = (km * vh.consumption) / 100
  if (vh.type === 'ev') return (amount * gridGramsPerKwh) / 1000
  return co2For(amount, vh.type)
}

export const compare: Calculator = {
  id: 'compare',
  group: 'Driving',
  tab: 'Compare',
  title: 'Compare vehicles',
  blurb: 'Same trip, different rigs. Gas, diesel or electric.',
  fields: [
    { key: 'distance', label: 'Distance', kind: 'distance', default: 500, step: 1 },
    { key: 'roundTrip', label: 'Round trip', kind: 'toggle', default: false },
    { key: 'vehicles', label: 'Vehicles', kind: 'vehicles', default: defaultVehicles },
    { key: 'gasPrice', label: 'Gas price', kind: 'fuelPrice', default: 1.65, step: 0.01 },
    { key: 'dieselPrice', label: 'Diesel price', kind: 'fuelPrice', default: 1.85, step: 0.01 },
    { key: 'kwhPrice', label: 'Electricity', kind: 'energyPrice', default: 0.14, step: 0.01 },
    { key: 'grid', label: 'Grid carbon intensity', kind: 'plain', default: 100, step: 5, suffix: 'g/kWh', help: 'BC is around 15, Alberta around 500, US average around 370.' },
    { key: 'annualDistance', label: 'Driven per year', kind: 'distance', default: 20000, step: 100, help: 'Used for the yearly savings figure.' },
  ],
  compute(v) {
    const km = num(v, 'distance') * (bool(v, 'roundTrip') ? 2 : 1)
    const list = (Array.isArray(v.vehicles) ? v.vehicles : []).filter((x) => x.consumption > 0)
    if (!list.length) return [{ label: 'Add a vehicle', value: 'Nothing to compare yet', kind: 'text', primary: true }]
    const prices = { gas: num(v, 'gasPrice'), diesel: num(v, 'dieselPrice'), kwh: num(v, 'kwhPrice') }
    const costs = list.map((vh) => ({ vh, cost: vehicleTripCost(vh, km, prices) }))
    const sorted = [...costs].sort((a, b) => a.cost - b.cost)
    const cheapest = sorted[0]
    const priciest = sorted[sorted.length - 1]
    const max = priciest.cost
    const out: Result[] = [
      { label: `Cheapest: ${cheapest.vh.name || 'Vehicle'}`, value: cheapest.cost, kind: 'money', primary: true },
    ]
    for (const { vh, cost } of costs) {
      out.push({
        label: vh.name || 'Vehicle',
        value: cost,
        kind: 'money',
        bar: safeDiv(cost, max),
        highlight: vh === cheapest.vh,
        note: `${Math.round(vehicleCo2(vh, km, num(v, 'grid')))} kg CO2`,
      })
    }
    if (list.length > 1) {
      const save = priciest.cost - cheapest.cost
      out.push({ label: 'Saved this trip vs priciest', value: save, kind: 'money' })
      const yearly = safeDiv(save, km) * num(v, 'annualDistance')
      out.push({ label: 'Saved per year', value: yearly, kind: 'money' })
    }
    return out
  },
}

export const fillUp: Calculator = {
  id: 'fill-up',
  group: 'Driving',
  tab: 'Fill-up',
  title: 'Fuel cost to fill up',
  blurb: 'What the pump is about to charge you, and how far a tank gets you.',
  fields: [
    { key: 'tank', label: 'Tank size', kind: 'volume', default: 80, step: 1 },
    { key: 'level', label: 'Fuel left in tank', kind: 'percent', default: 25, step: 5 },
    { key: 'fuelPrice', label: 'Fuel price', kind: 'fuelPrice', default: 1.65, step: 0.01 },
    { key: 'consumption', label: 'Fuel economy', kind: 'consumption', default: 12, step: 0.1 },
  ],
  compute(v) {
    const tank = num(v, 'tank')
    const left = Math.min(100, num(v, 'level')) / 100
    const needed = tank * (1 - left)
    const price = num(v, 'fuelPrice')
    const range = safeDiv(tank * 100, num(v, 'consumption'))
    return [
      { label: 'Cost to fill', value: needed * price, kind: 'money', primary: true },
      { label: 'Fuel needed', value: needed, kind: 'volume' },
      { label: 'Full tank from empty', value: tank * price, kind: 'money' },
      { label: 'Range on a full tank', value: range, kind: 'distance' },
      { label: 'Range left right now', value: range * left, kind: 'distance' },
    ]
  },
}
