import { PARKS, FEATURED_PARK_ID } from '../../config/parks';
import { truckProfile, peopleProfile, cumulative } from '../profiles';
import { mulberry32, clamp } from '../util';

/**
 * Light-weight operating model for every park in the portfolio. Each park gets
 * stable seeded characteristics; live counters follow the same diurnal curves
 * as the detailed Malur model. Malur's figures are injected from its full model.
 */

export function createPortfolio(seed) {
  const parks = PARKS.map((p, i) => {
    const r = mulberry32(seed * 31 + i * 7919);
    const ops = p.status === 'operational';
    const scale = p.type === 'INCITY' ? 0.35 : p.msf;
    return {
      id: p.id,
      occupancy: ops ? r.range(0.83, 0.99) : r.range(0.15, 0.6),
      progress: ops ? 1 : r.range(0.32, 0.86),
      tenants: ops ? Math.max(1, Math.round(scale * r.range(1.6, 3.2))) : r.int(0, 2),
      dailyTrucks: ops ? scale * r.range(120, 190) * (p.type === 'INCITY' ? 1.8 : 1) : scale * r.range(8, 20),
      kwhPerDay: ops ? scale * r.range(5200, 8800) : scale * r.range(600, 1400),
      klPerDay: ops ? (p.acres || 6) * r.range(1.1, 1.8) : (p.acres || 6) * r.range(0.2, 0.5),
      bias: r.range(0.88, 1.14),
      alertRate: r.range(0.4, 2.6),
      alerts: { critical: 0, warning: r.int(0, 2) },
      safetyDays: r.int(40, 900),
      baseWait: ops ? r.range(3.5, 11) : 0,
      r,
    };
  });
  return { parks, dateKey: null };
}

export function stepPortfolio(s, ctx, malur) {
  const { dt, h, dateKey } = ctx;
  const hrs = dt / 3600;
  s.dateKey = dateKey;
  const cumT = cumulative(truckProfile, h) / 24;
  const cumP = cumulative(peopleProfile, h) / 24;
  const nowT = truckProfile(h) / 24;
  s.parks.forEach((p) => {
    const r = p.r;
    // alerts: warnings drift around a park-specific mean; criticals are rare, short-lived spikes
    const meanWarn = p.alertRate * (p.progress < 1 ? 0.15 : 0.3);
    if (r.chance(hrs * 0.8)) p.alerts.warning = clamp(p.alerts.warning + (p.alerts.warning < meanWarn ? 1 : -1) * (r.chance(0.75) ? 1 : -1), 0, 6);
    if (p.alerts.critical > 0 && ctx.now > (p.critUntil || 0)) p.alerts.critical = 0;
    if (!p.alerts.critical && r.chance(hrs * 0.012 * p.alertRate)) { p.alerts.critical = 1; p.critUntil = ctx.now + r.range(0.5, 3) * 3600000; }
    p.trucksToday = p.dailyTrucks * cumT * p.bias;
    p.trucksNow = p.dailyTrucks * nowT * p.bias;
    p.kwhToday = p.kwhPerDay * cumP * p.bias;
    p.klToday = p.klPerDay * cumP * p.bias;
    if (!p.live) p.waitMin = p.baseWait * (0.55 + 0.45 * truckProfile(h) / 1.6) * r.range(0.95, 1.05);
    if (p.progress < 1) p.progress = Math.min(0.99, p.progress + hrs * 0.00004);
  });
  if (malur) {
    const m = s.parks.find((p) => p.id === FEATURED_PARK_ID);
    if (m) Object.assign(m, malur);
  }
}

export function portfolioSnapshot(s) {
  const parks = s.parks.map((p) => {
    const meta = PARKS.find((x) => x.id === p.id);
    const crit = p.alerts.critical;
    const warn = p.alerts.warning;
    const health = clamp(100 - crit * 14 - warn * 3.2 - (meta.status === 'operational' ? (1 - p.occupancy) * 20 : 0), 35, 100);
    return {
      id: p.id, occupancy: p.occupancy, progress: p.progress, tenants: p.tenants,
      trucksToday: Math.round(p.trucksToday || 0), trucksNow: p.trucksNow || 0,
      kwhToday: p.kwhToday || 0, klToday: p.klToday || 0, alerts: { ...p.alerts },
      safetyDays: p.safetyDays, health, live: !!p.live, waitMin: p.waitMin || 0,
    };
  });
  const ops = parks.filter((p) => PARKS.find((x) => x.id === p.id).status === 'operational');
  const ilp = PARKS.filter((x) => x.type === 'ILP');
  const msfOps = ilp.filter((x) => x.status === 'operational').reduce((a, x) => a + x.msf, 0);
  const occW = ilp.filter((x) => x.status === 'operational').reduce((a, x) => a + x.msf * parks.find((p) => p.id === x.id).occupancy, 0);
  return {
    parks,
    totals: {
      trucksToday: parks.reduce((a, p) => a + p.trucksToday, 0),
      kwhToday: parks.reduce((a, p) => a + p.kwhToday, 0),
      klToday: parks.reduce((a, p) => a + p.klToday, 0),
      critical: parks.reduce((a, p) => a + p.alerts.critical, 0),
      warning: parks.reduce((a, p) => a + p.alerts.warning, 0),
      occupancy: msfOps ? occW / msfOps : 0,
      operational: ops.length,
      construction: parks.length - ops.length,
      avgHealth: parks.reduce((a, p) => a + p.health, 0) / parks.length,
      avgWaitMin: (() => { const o = parks.filter((p) => p.waitMin > 0); const tw = o.reduce((a, p) => a + p.trucksToday, 0); return tw ? o.reduce((a, p) => a + p.waitMin * p.trucksToday, 0) / tw : 0; })(),
      green: PARKS.filter((x) => x.type === 'ILP' && /IGBC Platinum$|IGBC Platinum ·/.test(x.igbc || '')).length,
    },
  };
}
