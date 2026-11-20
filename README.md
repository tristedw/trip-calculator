# Real Cost Calculator

A ridiculously simple calculator for real-world expenses.

Live: https://tristedw.ca/trip-calculator/

Write-up: https://tristedw.ca/projects/trip-calculator/

![CI](https://github.com/tristedw/trip-calculator/actions/workflows/ci.yml/badge.svg)

## What it does

**Driving**
- Fuel cost per trip, with round trip and splitting between passengers
- Fill-up cost and range on a tank
- True cost per km (fuel plus insurance, maintenance, depreciation, interest)
- Compare vehicles on the same trip, gas vs diesel vs electric, with CO2
- Cost of towing
- Camper trip cost (driving, sites, generator, propane)
- Cost of idling

**Money**
- Loan payment and total interest
- Inflation
- Break-even on an upgrade

**Garage**
- Solar sizing for a camper or van (panels, battery, controller)
- Tire diameter and speedometer error
- Gear ratios and re-gearing for bigger tires
- RPM and road speed
- Pinion angle and driveline working angles

Every calculation can be shared. The link carries the inputs, so whoever opens it sees the same results. Metric or imperial, a handful of currencies, light and dark mode, print friendly.

## Stack

Vanilla TypeScript and Vite. No framework, no runtime dependencies, about 22 kB gzipped including the LCD font.

```
src/
  lib/
    driving.ts    trip, fill-up, cost per km, compare, towing, camper, idling
    money.ts      loan, inflation, break-even
    garage.ts     solar, tires, gears, rpm, pinion angle
    calculators.ts  registry
    units.ts      metric/imperial conversion
    share.ts      link encoding
    format.ts     output formatting
  main.ts         UI
tests/            vitest
```

Each calculator is a plain object with a list of fields and a pure `compute` function, so adding a new one is one object and one line in the registry. The UI, share links and summaries are all generated from that. Values are stored metric internally and only converted for display, which keeps the math in one unit system and keeps share links identical no matter who made them.

## Running it

```
npm install
npm run dev
npm test
npm run build
```

`dist/` is a static site. The build uses relative paths and hash routing, so it works from any subfolder with no server config.

## Assumptions

- CO2: 2.31 kg per litre of gasoline, 2.68 kg per litre of diesel
- Idle burn rates are ballpark figures for each engine class
- Towing penalties are typical ranges; wind, grade and speed move them a lot
- Pinion angle: standard shafts target the pinion parallel to the output, double cardan shafts point the pinion about 1 degree under the shaft, leaf springs get 1.5 degrees of preload for axle wrap

Estimates, not gospel.

## License

MIT
