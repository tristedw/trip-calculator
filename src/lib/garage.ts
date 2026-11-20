import { num, safeDiv, signed, str } from './helpers'
import type { Calculator } from './types'

export const COMMON_RATIOS = [3.08, 3.21, 3.42, 3.55, 3.73, 3.92, 4.1, 4.3, 4.56, 4.88, 5.13, 5.29, 5.38]

export const closestRatio = (target: number) =>
  COMMON_RATIOS.reduce((best, r) => (Math.abs(r - target) < Math.abs(best - target) ? r : best), COMMON_RATIOS[0])

// metric tire size to overall diameter in mm, e.g. 275/70R18
export const tireDiameterMm = (width: number, aspect: number, rimIn: number) =>
  rimIn * 25.4 + 2 * width * (aspect / 100)

export const solar: Calculator = {
  id: 'solar',
  group: 'Garage',
  tab: 'Solar sizing',
  title: 'Solar sizing',
  blurb: 'Panels and battery for a camper, van or cabin.',
  fields: [
    { key: 'dailyWh', label: 'Daily power use', kind: 'plain', default: 1200, step: 50, suffix: 'Wh', help: '12 V fridge 400 to 600, lights 100, fan 150, laptop 200, phones 30.' },
    { key: 'sunHours', label: 'Peak sun hours', kind: 'hours', default: 4, step: 0.5, help: 'Southern BC is around 5 in summer and under 2 in winter.' },
    { key: 'losses', label: 'System losses', kind: 'percent', default: 25, step: 1, help: 'Heat, wiring, angle and charge efficiency.' },
    { key: 'autonomy', label: 'Days without sun', kind: 'count', default: 2, step: 1, suffix: 'days' },
    {
      key: 'battery',
      label: 'Battery type',
      kind: 'select',
      default: 'lithium',
      options: [
        { value: 'lithium', label: 'Lithium (LiFePO4), 90% usable' },
        { value: 'agm', label: 'AGM / lead acid, 50% usable' },
      ],
    },
    {
      key: 'voltage',
      label: 'System voltage',
      kind: 'select',
      default: '12',
      options: [
        { value: '12', label: '12 V' },
        { value: '24', label: '24 V' },
        { value: '48', label: '48 V' },
      ],
    },
  ],
  compute(v) {
    const wh = num(v, 'dailyWh')
    const eff = 1 - Math.min(90, num(v, 'losses')) / 100
    const panelW = safeDiv(wh, num(v, 'sunHours') * eff)
    const dod = str(v, 'battery') === 'agm' ? 0.5 : 0.9
    const volts = Number(str(v, 'voltage')) || 12
    const batteryWh = (wh * Math.max(1, num(v, 'autonomy'))) / dod
    const panels = Math.ceil(panelW / 200)
    return [
      { label: 'Solar array', value: panelW, kind: 'number', unit: 'W', digits: 0, primary: true },
      { label: 'That is roughly', value: `${panels} x 200 W panel${panels === 1 ? '' : 's'}`, kind: 'text' },
      { label: `Battery bank at ${volts} V`, value: batteryWh / volts, kind: 'number', unit: 'Ah', digits: 0 },
      { label: 'Battery bank energy', value: batteryWh, kind: 'number', unit: 'Wh', digits: 0 },
      { label: 'Charge controller', value: (panelW / volts) * 1.25, kind: 'number', unit: 'A', digits: 0, note: 'Includes 25% headroom.' },
    ]
  },
}

export const tires: Calculator = {
  id: 'tires',
  group: 'Garage',
  tab: 'Tire diameter',
  title: 'Tire diameter',
  blurb: 'Compare two tire sizes and see what it does to your speedometer.',
  fields: [
    { key: 'widthA', label: 'Stock width', kind: 'plain', default: 265, step: 5, suffix: 'mm' },
    { key: 'aspectA', label: 'Stock aspect ratio', kind: 'plain', default: 70, step: 5, suffix: '%' },
    { key: 'rimA', label: 'Stock rim', kind: 'plain', default: 17, step: 1, suffix: 'in' },
    { key: 'widthB', label: 'New width', kind: 'plain', default: 285, step: 5, suffix: 'mm' },
    { key: 'aspectB', label: 'New aspect ratio', kind: 'plain', default: 75, step: 5, suffix: '%' },
    { key: 'rimB', label: 'New rim', kind: 'plain', default: 17, step: 1, suffix: 'in' },
  ],
  compute(v) {
    const a = tireDiameterMm(num(v, 'widthA'), num(v, 'aspectA'), num(v, 'rimA'))
    const b = tireDiameterMm(num(v, 'widthB'), num(v, 'aspectB'), num(v, 'rimB'))
    const err = safeDiv(b, a) - 1
    const pct = `${err >= 0 ? '+' : ''}${(err * 100).toFixed(1)}%`
    return [
      { label: 'New tire diameter', value: b, kind: 'length', primary: true },
      { label: 'Stock tire diameter', value: a, kind: 'length', bar: safeDiv(a, Math.max(a, b)) },
      { label: 'New tire diameter', value: b, kind: 'length', bar: safeDiv(b, Math.max(a, b)) },
      { label: 'Difference', value: b - a, kind: 'length' },
      { label: 'Ground clearance change', value: (b - a) / 2, kind: 'length' },
      {
        label: 'Speedometer',
        value: Math.abs(err) < 0.0005 ? 'Spot on' : `${pct} (you are going ${err > 0 ? 'faster' : 'slower'} than it says)`,
        kind: 'text',
      },
      { label: 'New sidewall height', value: num(v, 'widthB') * (num(v, 'aspectB') / 100), kind: 'length' },
    ]
  },
}

export const gears: Calculator = {
  id: 'gears',
  group: 'Garage',
  tab: 'Gear ratios',
  title: 'Gear ratios',
  blurb: 'Axle ratio from tooth count, and what to re-gear to after bigger tires.',
  fields: [
    { key: 'ring', label: 'Ring gear teeth', kind: 'plain', default: 41, step: 1 },
    { key: 'pinion', label: 'Pinion teeth', kind: 'plain', default: 10, step: 1 },
    { key: 'stockTire', label: 'Stock tire diameter', kind: 'length', default: 787, step: 1 },
    { key: 'newTire', label: 'New tire diameter', kind: 'length', default: 889, step: 1 },
  ],
  compute(v) {
    const ratio = safeDiv(num(v, 'ring'), num(v, 'pinion'))
    const stock = num(v, 'stockTire')
    const next = num(v, 'newTire')
    const effective = ratio * safeDiv(stock, next)
    const restore = ratio * safeDiv(next, stock)
    return [
      { label: 'Axle ratio', value: ratio, kind: 'number', unit: ': 1', digits: 2, primary: true },
      { label: 'Feels like on new tires', value: effective, kind: 'number', unit: ': 1', digits: 2 },
      { label: 'Ratio to get stock feel back', value: restore, kind: 'number', unit: ': 1', digits: 2 },
      { label: 'Closest common ratio', value: `${closestRatio(restore).toFixed(2)} : 1`, kind: 'text', highlight: true },
      { label: 'RPM change at the same speed', value: `${((safeDiv(stock, next) - 1) * 100).toFixed(1)}%`, kind: 'text' },
    ]
  },
}

export const rpm: Calculator = {
  id: 'rpm',
  group: 'Garage',
  tab: 'RPM and speed',
  title: 'RPM and speed',
  blurb: 'Engine speed at cruise, or road speed at a given RPM.',
  fields: [
    { key: 'tire', label: 'Tire diameter', kind: 'length', default: 787, step: 1 },
    { key: 'axle', label: 'Axle ratio', kind: 'plain', default: 3.73, step: 0.01 },
    { key: 'gear', label: 'Transmission gear ratio', kind: 'plain', default: 0.69, step: 0.01, help: 'Top gear is usually an overdrive between 0.6 and 0.8. Direct drive is 1.00.' },
    { key: 'speed', label: 'Road speed', kind: 'speed', default: 100, step: 1 },
    { key: 'engineRpm', label: 'Engine RPM', kind: 'plain', default: 2000, step: 50, suffix: 'rpm' },
  ],
  compute(v) {
    const circM = (Math.PI * num(v, 'tire')) / 1000
    const reduction = num(v, 'axle') * num(v, 'gear')
    const rpmAt = safeDiv(((num(v, 'speed') * 1000) / 60) * reduction, circM)
    const speedAt = safeDiv(num(v, 'engineRpm') * circM * 60, reduction * 1000)
    return [
      { label: 'Engine RPM at that speed', value: rpmAt, kind: 'number', unit: 'rpm', digits: 0, primary: true },
      { label: 'Road speed at that RPM', value: speedAt, kind: 'speed' },
      { label: 'Overall reduction', value: reduction, kind: 'number', unit: ': 1', digits: 2 },
      { label: 'Tire revs per km', value: safeDiv(1000, circM), kind: 'number', digits: 0 },
    ]
  },
}

const deg = (n: number) => `${n.toFixed(1)}°`
const WRAP = 1.5

export const pinion: Calculator = {
  id: 'pinion',
  group: 'Garage',
  tab: 'Pinion angle',
  title: 'Pinion angle',
  blurb: 'Driveline angles from an angle finder. Find the vibration before it finds your U-joints.',
  fields: [
    {
      key: 'shaft',
      label: 'Driveshaft type',
      kind: 'select',
      default: 'single',
      options: [
        { value: 'single', label: 'Standard (two U-joints)' },
        { value: 'double', label: 'Double cardan / CV at the transfer case' },
      ],
    },
    {
      key: 'suspension',
      label: 'Rear suspension',
      kind: 'select',
      default: 'leaf',
      options: [
        { value: 'leaf', label: 'Leaf springs' },
        { value: 'link', label: 'Links / coils / air' },
      ],
    },
    { key: 'trans', label: 'Trans or t-case output', kind: 'plain', default: 3, min: -30, step: 0.1, suffix: '°', help: 'Measure everything the same way: positive when the front end sits higher than the back.' },
    { key: 'driveshaft', label: 'Driveshaft', kind: 'plain', default: 5.5, min: -30, step: 0.1, suffix: '°' },
    { key: 'pinion', label: 'Pinion', kind: 'plain', default: 1.5, min: -30, step: 0.1, suffix: '°' },
  ],
  compute(v) {
    const t = signed(v, 'trans')
    const d = signed(v, 'driveshaft')
    const p = signed(v, 'pinion')
    const double = str(v, 'shaft') === 'double'
    const leaf = str(v, 'suspension') === 'leaf'
    const front = Math.abs(d - t)
    const rear = Math.abs(d - p)
    // judge leaf setups the way they run: with the pinion wrapped up under load
    const rearLoaded = Math.abs(d - (leaf ? p + WRAP : p))

    // standard shaft: pinion parallel to the output so the joints cancel
    // double cardan: pinion points right up the shaft, about 1 degree under it
    let target = double ? d - Math.sign(d || 1) * 1 : t
    // leaf springs wrap the pinion up under load, so preload it down a bit
    if (leaf) target -= WRAP

    const move = target - p
    const moveText = Math.abs(move) < 0.25 ? 'Leave it' : `Rotate pinion ${move > 0 ? 'up' : 'down'} ${Math.abs(move).toFixed(1)}°`

    const notes: string[] = []
    if (!double && Math.abs(front - rearLoaded) > 0.5) notes.push('Joint angles do not cancel, expect vibration')
    if ((double ? rearLoaded : Math.max(front, rearLoaded)) > 3) notes.push('Over 3° at a joint will buzz at highway speed')
    if (!double && Math.min(front, rearLoaded) < 0.5) notes.push('Under 0.5° and the needle bearings will not rotate')
    if (double && front > 6) notes.push('Over 6° is a lot even for a CV joint')

    return [
      { label: 'Target pinion angle', value: target, kind: 'number', unit: '°', digits: 1, primary: true },
      { label: 'Adjustment', value: moveText, kind: 'text', highlight: Math.abs(move) >= 0.25 },
      { label: 'Front joint working angle', value: deg(front), kind: 'text', note: double ? 'CV joint' : undefined },
      { label: 'Rear joint working angle', value: deg(rear), kind: 'text' },
      ...(leaf ? [{ label: 'Rear joint under load', value: deg(rearLoaded), kind: 'text' as const, note: `Assumes ${WRAP}° of spring wrap` }] : []),
      { label: 'Cancellation difference', value: double ? 'n/a with a CV' : deg(Math.abs(front - rearLoaded)), kind: 'text' },
      { label: 'Verdict', value: notes.length ? notes.join('. ') : 'Looks good', kind: 'text' },
    ]
  },
}
