export type UnitSystem = 'metric' | 'imperial'

export type FieldKind =
  | 'distance'
  | 'consumption'
  | 'evConsumption'
  | 'fuelPrice'
  | 'energyPrice'
  | 'volumeRate'
  | 'volume'
  | 'length'
  | 'speed'
  | 'money'
  | 'count'
  | 'minutes'
  | 'hours'
  | 'percent'
  | 'plain'
  | 'select'
  | 'toggle'
  | 'vehicles'

export type FuelType = 'gas' | 'diesel' | 'ev'

export interface Vehicle {
  name: string
  type: FuelType
  // L/100km for gas/diesel, kWh/100km for ev
  consumption: number
}

export type Value = number | string | boolean | Vehicle[]
export type Values = Record<string, Value>

export interface Option {
  value: string
  label: string
  // picking this option also sets other fields (metric values)
  sets?: Record<string, number | string>
}

export interface Field {
  key: string
  label: string
  kind: FieldKind
  default: Value
  min?: number
  step?: number
  help?: string
  suffix?: string
  options?: Option[]
}

export type ResultKind =
  | 'money'
  | 'moneyPerDistance'
  | 'volume'
  | 'mass'
  | 'consumption'
  | 'hours'
  | 'distance'
  | 'length'
  | 'speed'
  | 'number'
  | 'text'

export interface Result {
  label: string
  value: number | string
  kind: ResultKind
  primary?: boolean
  note?: string
  // 0..1, draws a bar behind the row
  bar?: number
  highlight?: boolean
  // for kind 'number'
  unit?: string
  digits?: number
}

export type Group = 'Driving' | 'Money' | 'Garage'

export interface Calculator {
  id: string
  group: Group
  title: string
  tab: string
  blurb: string
  fields: Field[]
  compute(values: Values): Result[]
}

export interface Settings {
  units: UnitSystem
  currency: string
}
