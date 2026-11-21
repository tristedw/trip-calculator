// Each calculator reads as a sentence. {key} is an editable field, {key!} hides
// its unit, {=} is the answer and {@} is the answer's label.
// Fields left out of the sentence show up under "Details".

export const sentences: Record<string, string> = {
  trip: 'Driving {distance} {roundTrip} in something that does {consumption} on {fuelType} at {fuelPrice} costs {=}.',
  'fill-up': 'Filling a {tank} tank from {level} full at {fuelPrice} costs {=}.',
  'per-km': 'Driving {annualDistance} a year in something that does {consumption}, with fuel at {fuelPrice}, really costs {=}.',
  compare: 'Over {distance} {roundTrip}, the cheapest one to take is the {@} at {=}.',
  tow: 'Towing a {load} {distance} {roundTrip} with a truck that does {consumption} empty, on {fuelType} at {fuelPrice}, adds {=}.',
  camper: '{nights} and {distance} of driving at {consumption}, with fuel at {fuelPrice} and sites at {siteFee} a night, comes to {=}.',
  idle: 'A {engine} idling {minutes} a day, {days} a year, with fuel at {fuelPrice}, burns {=} a year.',
  loan: 'Buying at {price} with {down} down, borrowed at {apr} over {months}, is {=} a month.',
  inflation: '{amount} today, with prices rising {rate} a year, is {=} in {years}.',
  'break-even': 'Spending {upfront} to save {savings} a month pays for itself in {=}.',
  power: 'Running {device} at {watts} for {hours} a day, {days} a month, with power at {kwhPrice}, costs {=} a month.',
  solar: 'Using {dailyWh} a day with {sunHours} of good sun takes about {=} of panels.',
  tires: 'Going from a {widthA!}/{aspectA!}R{rimA!} to a {widthB!}/{aspectB!}R{rimB!} puts you on a {=} tire.',
  gears: 'A {ring!} tooth ring gear on a {pinion!} tooth pinion is a {=} ratio.',
  rpm: 'On {tire} tires with {axle!} gears and a {gear!} top gear, {speed} turns {=}.',
  pinion: 'With the output at {trans}, the driveshaft at {driveshaft} and the pinion at {pinion}, set the pinion to {=}.',
}

export const toggleWords: Record<string, [string, string]> = {
  roundTrip: ['one way', 'there and back'],
}

export function sentenceKeys(id: string): Set<string> {
  const keys = new Set<string>()
  for (const m of (sentences[id] ?? '').matchAll(/\{([a-zA-Z]+)!?\}/g)) keys.add(m[1])
  return keys
}
