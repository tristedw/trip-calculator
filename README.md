# Real Cost Calculator

A ridiculously simple calculator for real-world expenses.

https://tristedw.ca/trip-calculator/

![CI](https://github.com/tristedw/trip-calculator/actions/workflows/ci.yml/badge.svg)

Each calculator is a sentence with the numbers you can change in green. Drag a number left or right to change it, or click it and type. Every unit can be switched on its own, so you can have km and mpg at the same time if that's how you think. The URL updates as you go, so copying it shares the exact numbers.

**Driving:** fuel per trip, fill-up, cost per km, compare vehicles (gas, diesel, EV), towing, camper trips, idling

**Money:** loan interest, inflation, break-even

**Garage:** power cost, solar sizing, tire diameter, gear ratios, RPM and speed, pinion angle

## Running it

```
npm install
npm run dev
npm test
npm run build
```

`dist/` is a static site with relative paths, so it can go in any subfolder.

## How it's put together

Vanilla TypeScript and Vite, no runtime dependencies.

- `src/lib/driving.ts`, `money.ts`, `garage.ts`: one object per calculator, a list of fields and a pure `compute` function
- `src/lib/sentences.ts`: the sentence each calculator reads as
- `src/lib/units.ts`: every unit option, values are stored metric and converted for display
- `src/lib/share.ts`: puts inputs and unit choices in the URL hash
- `src/main.ts`: the UI

## Numbers it assumes

- CO2: 2.31 kg per litre of gas, 2.68 kg per litre of diesel
- Idle burn and towing penalties are ballpark figures, override them if you know yours
- Pinion angle: standard shafts want the pinion parallel to the output, double cardan shafts point it about 1 degree under the shaft, leaf springs get 1.5 degrees of preload for wrap

## License

MIT
