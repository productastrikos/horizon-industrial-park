import { fmtIstTime } from '../sim/util';

/** Aggregate 5-min history buckets into hourly rows. mode per key: 'sum' | 'avg' | 'max' | 'last'. */
export function hourly(history, spec) {
  const rows = new Map();
  history.forEach((b) => {
    const t = Math.floor(b.t / 3600000) * 3600000;
    if (!rows.has(t)) rows.set(t, { t, n: 0, _: {} });
    const r = rows.get(t);
    r.n += 1;
    Object.entries(spec).forEach(([k, mode]) => {
      const v = b[k] ?? 0;
      if (mode === 'sum' || mode === 'avg') r._[k] = (r._[k] || 0) + v;
      else if (mode === 'max') r._[k] = Math.max(r._[k] ?? -Infinity, v);
      else r._[k] = v;
    });
  });
  return [...rows.values()].map((r) => {
    const out = { t: r.t, label: fmtIstTime(r.t) };
    Object.entries(spec).forEach(([k, mode]) => { out[k] = mode === 'avg' ? r._[k] / r.n : r._[k]; });
    return out;
  });
}

export const tickTime = (t) => fmtIstTime(t);
export const last = (history, key, n = 36) => history.slice(-n).map((b) => b[key]);
