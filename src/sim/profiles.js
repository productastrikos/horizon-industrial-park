import { gauss, plateau } from './util';

/* Time-of-day demand curves (h = IST hour, fractional). Each curve is
   normalised numerically so that its 24 h integral equals 24. */

function normalise(fn) {
  let s = 0;
  const N = 24 * 12;
  for (let i = 0; i < N; i++) s += fn((i + 0.5) / 12) / 12;
  const k = 24 / s;
  return (h) => fn(((h % 24) + 24) % 24) * k;
}

// Truck arrivals — line-haul inbound peak in the morning, dispatch peak in the evening.
export const truckProfile = normalise(
  (h) => 0.22 + 0.5 * plateau(h, 6, 22) + 1.75 * gauss(h, 8.6, 1.05) + 1.45 * gauss(h, 18.6, 1.25),
);

// People on site (3 shifts, day heavy).
export const peopleProfile = normalise(
  (h) => 0.35 + 0.65 * plateau(h, 6.2, 22.2) + 0.25 * plateau(h, 9, 18) + 0.15 * gauss(h, 14, 0.5),
);

export const washroomProfile = normalise(
  (h) => 0.25 + plateau(h, 6.2, 22.2) * 0.9 + 0.4 * gauss(h, 10.5, 1.2) + 0.4 * gauss(h, 15, 1.2) + 0.3 * gauss(h, 6.4, 0.3) + 0.3 * gauss(h, 14.2, 0.3),
);
export const domesticProfile = normalise(
  (h) => 0.2 + 0.7 * plateau(h, 6, 22) + 0.9 * gauss(h, 13, 0.9) + 0.6 * gauss(h, 20, 0.8) + 0.4 * gauss(h, 8, 0.6),
);
export const gardenProfile = normalise((h) => 0.02 + plateau(h, 6, 8.6, 6) + 0.8 * plateau(h, 16.8, 18.4, 6));

// Tenant warehouse electrical load factor (fraction of transformer rating).
export function tenantLoadFactor(h, tenant) {
  const base = tenant === 'amazon' ? 0.46 : 0.4;
  const day = tenant === 'amazon' ? 0.24 : 0.22;
  return base + day * plateau(h, 6.5, 22.5) + 0.09 * gauss(h, 10.5, 2) + 0.07 * gauss(h, 19, 1.8);
}

// Ambient temperature (Bengaluru, Nov) and humidity.
export const ambientC = (h) => 18.5 + 8.5 * gauss(h, 14.5, 4.2);
export const humidityPct = (h) => 82 - 26 * gauss(h, 14.5, 4.5);

export const LIGHTS_ON_H = 18.0;
export const LIGHTS_OFF_H = 6.25;
export const lightsScheduledOn = (h) => h >= LIGHTS_ON_H || h < LIGHTS_OFF_H;

/** Integral of a profile from 0 → h (hours), used by light-weight portfolio models. */
export function cumulative(profile, h) {
  let s = 0;
  const steps = Math.max(1, Math.round(h * 4));
  for (let i = 0; i < steps; i++) s += profile(((i + 0.5) / steps) * h) * (h / steps);
  return s;
}
