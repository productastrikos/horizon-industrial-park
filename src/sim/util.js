/* Seeded RNG + small numeric helpers shared by the simulation models. */

export function mulberry32(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.int = (lo, hi) => Math.floor(lo + rng() * (hi - lo + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.normal = (mu = 0, sigma = 1) => {
    const u = Math.max(1e-9, rng());
    const v = rng();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  rng.poisson = (lambda) => {
    if (lambda <= 0) return 0;
    if (lambda > 30) return Math.max(0, Math.round(rng.normal(lambda, Math.sqrt(lambda))));
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do { k += 1; p *= rng(); } while (p > L);
    return k - 1;
  };
  rng.weighted = (items, weightKey = 'w') => {
    const total = items.reduce((s, it) => s + it[weightKey], 0);
    let r = rng() * total;
    for (const it of items) { r -= it[weightKey]; if (r <= 0) return it; }
    return items[items.length - 1];
  };
  return rng;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const gauss = (x, mu, sigma) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
/** Smooth on/off window between hours a and b (24h, a<b). */
export const plateau = (h, a, b, k = 3) => sigmoid((h - a) * k) * sigmoid((b - h) * k);

/* -------------------------------------------------------- IST clock helpers */
const IST_OFFSET_MS = 5.5 * 3600 * 1000;

export function istParts(ts) {
  const d = new Date(ts + IST_OFFSET_MS);
  const h = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { h, dateKey, dow: d.getUTCDay() };
}

/** Timestamp of IST midnight for the IST day containing ts. */
export function istMidnight(ts) {
  const d = new Date(ts + IST_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST_OFFSET_MS;
}

/** Next timestamp (>= ts) whose IST wall-clock equals hh:mm. */
export function istAt(ts, hh, mm = 0) {
  const mid = istMidnight(ts);
  let t = mid + (hh * 60 + mm) * 60000;
  if (t < ts - 60000) t += 86400000;
  return t;
}

export function fmtIstTime(ts, withSeconds = false) {
  const d = new Date(ts + IST_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

export function fmtIstDate(ts) {
  const d = new Date(ts + IST_OFFSET_MS);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

const STATE_CODES = ['KA', 'KA', 'KA', 'KA', 'TN', 'TN', 'AP', 'MH', 'HR', 'TS'];
export function makePlate(rng) {
  const st = rng.pick(STATE_CODES);
  const rto = String(rng.int(1, 70)).padStart(2, '0');
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const l = letters[rng.int(0, letters.length - 1)] + (rng.chance(0.7) ? letters[rng.int(0, letters.length - 1)] : '');
  return `${st} ${rto} ${l} ${rng.int(1000, 9999)}`;
}

export const TRUCK_TYPES = [
  { id: '32ft', name: '32 ft MXL container', w: 0.42, len: 11 },
  { id: '20ft', name: '20 ft container', w: 0.33, len: 8 },
  { id: '14ft', name: '14 ft LCV', w: 0.25, len: 6 },
];
