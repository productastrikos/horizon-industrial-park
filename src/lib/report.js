import { mulberry32, istMidnight, fmtIstTime } from '../sim/util';
import { TENANTS, WATER, POWER, SITE } from '../config/malur';
import { PORTFOLIO_FACTS } from '../config/parks';
import { fmt, pct, inr } from './format';

/**
 * Reporting — historian + exporters.
 * Past days come from a deterministic daily historian (same model
 * assumptions as the live simulation, seeded per date, with weekday,
 * festive-season and monsoon effects); today is taken from live telemetry.
 */

export const REPORT_HISTORY_START = '2024-04-01'; // start of retained history (FY 2024-25)
const DAY = 86400000;
const DAILY_TRUCKS = TENANTS.reduce((a, t) => a + t.dailyTrucks, 0);

export const PERIODS = [
  { id: 'day', label: 'Today', days: 1 },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Monthly (last 30 days)', days: 30 },
  { id: '90d', label: 'Last 3 months', days: 91 },
  { id: '180d', label: 'Last 6 months', days: 182 },
  { id: '365d', label: 'Last 12 months', days: 365 },
  { id: 'all', label: 'Overall (since Apr 2024)', days: null },
  { id: 'custom', label: 'Custom date range', days: null },
];

export const keyOf = (ts) => new Date(istMidnight(ts) + 5.5 * 3600000).toISOString().slice(0, 10);
export const tsOf = (key) => Date.parse(`${key}T00:00:00+05:30`);
const hashKey = (k) => k.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Deterministic daily record for a past IST date. */
export function historianDay(key) {
  const r = mulberry32(hashKey(key));
  const n = (sd) => 1 + r.normal(0, sd);
  const d = new Date(`${key}T12:00:00+05:30`);
  const dow = d.getUTCDay();
  const m = d.getUTCMonth();
  const dowF = dow === 0 ? 0.72 : dow === 6 ? 0.9 : 1;
  const festive = m === 9 || m === 10 ? 1.12 : m === 0 ? 0.94 : 1;
  const monsoon = m >= 5 && m <= 8;
  const summer = m >= 2 && m <= 4;
  const growth = 1 + ((tsOf(key) - tsOf(REPORT_HISTORY_START)) / (365 * DAY)) * 0.08;
  const trucksIn = Math.round(DAILY_TRUCKS * dowF * festive * growth * 0.93 * n(0.06));
  const load = trucksIn / DAILY_TRUCKS;
  const ext = Math.min(0.9, Math.max(0.4, (monsoon ? 0.56 : summer ? 0.8 : 0.7) + r.normal(0, 0.04)));
  const waterKl = WATER.dailyDemandKl * (monsoon ? 0.88 : summer ? 1.08 : 1) * n(0.05);
  const tankerKl = Math.round((waterKl * ext) / 10) * 10;
  const ac = summer ? 1.12 : monsoon ? 0.95 : 1;
  const tr1 = 750 * 0.62 * 0.955 * 24 * ac * (0.92 + 0.12 * load) * n(0.03);
  const tr2 = 750 * 0.55 * 0.945 * 24 * ac * (0.92 + 0.12 * load) * n(0.03);
  const tr3 = (1350 + (monsoon ? -60 : summer ? 140 : 0)) * n(0.05);
  const woRaised = r.poisson(9);
  return {
    key,
    trucksIn,
    trucksOut: Math.max(0, trucksIn - Math.round(r.normal(2, 3))),
    preRate: Math.min(0.45, Math.max(0.1, 0.22 + r.normal(0, 0.04))),
    avgWaitMin: Math.min(22, Math.max(3, 7 + (load - 1) * 18 + r.normal(0, 1.5))),
    maxQueue: Math.max(2, Math.round(16 + (trucksIn - DAILY_TRUCKS) / 10 + r.normal(0, 4))),
    roadTruckHours: Math.max(0.5, 6 + (load - 1) * 40 + r.normal(0, 2)),
    violations: r.poisson(6),
    waterKl,
    tankerKl,
    tankers: tankerKl / 10,
    borewellKl: Math.max(0, waterKl * (1 - ext) * 0.85),
    externalShare: ext,
    waterCost: tankerKl * WATER.tankerCostPerKl,
    tr1Kwh: tr1, tr2Kwh: tr2, tr3Kwh: tr3,
    energyKwh: tr1 + tr2 + tr3,
    commonCost: tr3 * POWER.tariffPerKwh,
    outageMin: r() < 0.08 ? r.range(3, 14) : 0,
    lightFaults: r.poisson(2.4),
    lightHealth: Math.min(1, Math.max(0.9, 0.975 + r.normal(0, 0.012))),
    cctvUptime: Math.min(1, Math.max(0.92, 0.982 + r.normal(0, 0.01))),
    incidents: r.poisson(0.18),
    woRaised,
    woClosed: Math.max(0, Math.round(woRaised * (0.92 + r.normal(0, 0.08)))),
    woSla: Math.min(1, Math.max(0.7, 0.9 + r.normal(0, 0.04))),
    pfTrucks: Math.round(7400 * dowF * festive * growth * n(0.04)),
    pfEnergyMwh: 290 * ac * growth * n(0.03),
    pfWaterKl: 2450 * (monsoon ? 0.9 : 1) * n(0.04),
    pfOccupancy: Math.min(0.97, 0.86 + ((tsOf(key) - tsOf(REPORT_HISTORY_START)) / (600 * DAY)) * 0.06 + r.normal(0, 0.004)),
    pfHealth: Math.min(98, Math.max(75, 90 + r.normal(0, 2.5))),
    pfCritical: r.poisson(1.2),
  };
}

/** Today so far, from live telemetry. */
function todayFromLive(snap, workOrders) {
  const { gate, water, power, safety, portfolio } = snap;
  const dayStart = istMidnight(snap.ts);
  const wo = workOrders.filter((w) => w.createdAt >= dayStart);
  return {
    key: keyOf(snap.ts), partial: true,
    trucksIn: gate.today.entries, trucksOut: gate.today.exits, preRate: gate.today.preRate, avgWaitMin: gate.today.avgWaitMin,
    maxQueue: gate.today.queueMax, roadTruckHours: gate.today.roadTruckHours, violations: gate.today.violations,
    waterKl: water.today.useKl, tankerKl: water.today.tankerKl, tankers: water.today.tankers, borewellKl: water.today.borewellKl,
    externalShare: water.today.externalShare, waterCost: water.today.cost,
    tr1Kwh: power.today.kwh['TR-1'], tr2Kwh: power.today.kwh['TR-2'], tr3Kwh: power.today.kwh['TR-3'], energyKwh: power.today.totalKwh,
    commonCost: power.today.costCommon, outageMin: power.today.outageMin, lightFaults: power.lightStats.faulty + power.lightStats.dayburn,
    lightHealth: power.lightStats.health, cctvUptime: safety.camStats.uptime, incidents: (snap.incidents || []).length,
    woRaised: wo.length, woClosed: workOrders.filter((w) => w.resolvedAt && w.resolvedAt >= dayStart).length,
    woSla: (() => { const d = workOrders.filter((w) => w.resolvedAt && w.resolvedAt >= dayStart); return d.length ? d.filter((w) => w.resolvedAt <= w.dueAt).length / d.length : 1; })(),
    pfTrucks: portfolio.totals.trucksToday, pfEnergyMwh: portfolio.totals.kwhToday / 1000, pfWaterKl: portfolio.totals.klToday,
    pfOccupancy: portfolio.totals.occupancy, pfHealth: portfolio.totals.avgHealth, pfCritical: portfolio.totals.critical,
  };
}

export function resolveRange(periodId, customFrom, customTo, nowTs) {
  const today = keyOf(nowTs);
  if (periodId === 'custom') {
    const from = customFrom && customFrom >= REPORT_HISTORY_START ? customFrom : REPORT_HISTORY_START;
    const to = customTo && customTo <= today ? customTo : today;
    return from <= to ? { from, to } : { from: to, to: from };
  }
  if (periodId === 'all') return { from: REPORT_HISTORY_START, to: today };
  const p = PERIODS.find((x) => x.id === periodId);
  const from = keyOf(tsOf(today) - (p.days - 1) * DAY + 6 * 3600000);
  return { from: from < REPORT_HISTORY_START ? REPORT_HISTORY_START : from, to: today };
}

const SUM = ['trucksIn', 'trucksOut', 'roadTruckHours', 'violations', 'waterKl', 'tankerKl', 'tankers', 'borewellKl', 'waterCost', 'tr1Kwh', 'tr2Kwh', 'tr3Kwh', 'energyKwh', 'commonCost', 'outageMin', 'lightFaults', 'incidents', 'woRaised', 'woClosed', 'pfTrucks', 'pfEnergyMwh', 'pfWaterKl', 'pfCritical'];
const AVG = ['preRate', 'avgWaitMin', 'externalShare', 'lightHealth', 'cctvUptime', 'woSla', 'pfOccupancy', 'pfHealth'];
const MAX = ['maxQueue'];

function aggregate(days, label) {
  const o = { label, days: days.length };
  SUM.forEach((k) => { o[k] = days.reduce((a, d) => a + (d[k] || 0), 0); });
  AVG.forEach((k) => { o[k] = days.reduce((a, d) => a + (d[k] || 0), 0) / Math.max(1, days.length); });
  MAX.forEach((k) => { o[k] = Math.max(...days.map((d) => d[k] || 0)); });
  o.externalShare = o.tankerKl + o.borewellKl > 0 ? o.tankerKl / (o.tankerKl + o.borewellKl) : o.externalShare;
  return o;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pretty = (k) => { const [y, mo, d] = k.split('-'); return `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`; };

export function buildReport({ periodId, customFrom, customTo, snapshot, workOrders, advisories }) {
  const nowTs = snapshot.ts;
  const { from, to } = resolveRange(periodId, customFrom, customTo, nowTs);
  const today = keyOf(nowTs);
  const days = [];
  for (let t = tsOf(from); keyOf(t + 6 * 3600000) <= to; t += DAY) {
    const k = keyOf(t + 6 * 3600000);
    days.push(k === today ? todayFromLive(snapshot, workOrders) : historianDay(k));
  }
  const span = days.length;
  const grain = span <= 31 ? 'Daily' : span <= 186 ? 'Weekly' : 'Monthly';
  let rows;
  if (grain === 'Daily') rows = days.map((d) => aggregate([d], `${pretty(d.key)}${d.partial ? ' (to ' + fmtIstTime(nowTs) + ')' : ''}`));
  else {
    const groups = new Map();
    days.forEach((d) => {
      let g;
      if (grain === 'Weekly') { const t = tsOf(d.key); const dow = (new Date(`${d.key}T12:00:00+05:30`).getUTCDay() + 6) % 7; g = keyOf(t - dow * DAY + 6 * 3600000); } else g = d.key.slice(0, 7);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(d);
    });
    rows = [...groups.entries()].map(([g, ds]) => {
      const full = grain === 'Weekly' ? 7 : new Date(Number(g.slice(0, 4)), Number(g.slice(5, 7)), 0).getDate();
      const part = ds.length < full || ds.some((d) => d.partial) ? ` (${ds.length} of ${full} days)` : '';
      return aggregate(ds, (grain === 'Weekly' ? `Week of ${pretty(g)}` : `${MONTHS[Number(g.slice(5, 7)) - 1]} ${g.slice(0, 4)}`) + part);
    });
  }
  const total = aggregate(days, 'Total / average');
  const inRange = (ts) => ts >= tsOf(from) && ts < tsOf(to) + DAY;
  const wos = workOrders.filter((w) => inRange(w.createdAt));
  return { from, to, fromLabel: pretty(from), toLabel: pretty(to), span, grain, rows, total, wos, advisories: advisories.slice(0, 8), generatedAt: nowTs, period: PERIODS.find((p) => p.id === periodId) };
}

/* ------------------------------------------------------------- columns */
export const MALUR_COLS = [
  ['Trucks in', 'trucksIn', (v) => fmt(v)], ['Trucks out', 'trucksOut', (v) => fmt(v)], ['Avg gate wait (min)', 'avgWaitMin', (v) => fmt(v, 1)],
  ['Max queue', 'maxQueue', (v) => fmt(v)], ['Pre-intimated', 'preRate', (v) => pct(v)], ['Parking violations', 'violations', (v) => fmt(v)],
  ['Water used (KL)', 'waterKl', (v) => fmt(v)], ['Tanker (KL)', 'tankerKl', (v) => fmt(v)], ['Borewell (KL)', 'borewellKl', (v) => fmt(v)],
  ['External water', 'externalShare', (v) => pct(v)], ['Water cost', 'waterCost', (v) => inr(v)], ['Energy (kWh)', 'energyKwh', (v) => fmt(v)],
  ['Common-area kWh', 'tr3Kwh', (v) => fmt(v)], ['Light faults', 'lightFaults', (v) => fmt(v)], ['CCTV uptime', 'cctvUptime', (v) => pct(v, 1)],
  ['Incidents', 'incidents', (v) => fmt(v)], ['WOs raised', 'woRaised', (v) => fmt(v)], ['WOs closed', 'woClosed', (v) => fmt(v)], ['WO SLA', 'woSla', (v) => pct(v)],
];
export const PORTFOLIO_COLS = [
  ['Network trucks', 'pfTrucks', (v) => fmt(v)], ['Network energy (MWh)', 'pfEnergyMwh', (v) => fmt(v, 1)], ['Network water (KL)', 'pfWaterKl', (v) => fmt(v)],
  ['Occupancy', 'pfOccupancy', (v) => pct(v, 1)], ['Avg park health', 'pfHealth', (v) => fmt(v)], ['Critical alerts', 'pfCritical', (v) => fmt(v)],
  ['Malur trucks in', 'trucksIn', (v) => fmt(v)], ['Malur gate wait (min)', 'avgWaitMin', (v) => fmt(v, 1)], ['Malur external water', 'externalShare', (v) => pct(v)],
];

/* ------------------------------------------------------------ exporters */
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename, header, rows, preamble = []) {
  const lines = [...preamble.map((r) => r.map(csvCell).join(',')), ...(preamble.length ? [''] : []), header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportReportCsv(rep, scope) {
  const cols = scope === 'portfolio' ? PORTFOLIO_COLS : MALUR_COLS;
  const raw = (k, v) => (['preRate', 'externalShare', 'cctvUptime', 'woSla', 'pfOccupancy', 'lightHealth'].includes(k) ? (v * 100).toFixed(1) : typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : v);
  const title = scope === 'portfolio' ? 'Horizon Industrial Parks — Executive report' : `${SITE.fullName} — Facility management report`;
  downloadCsv(
    `${scope === 'portfolio' ? 'HIP-Executive' : 'HIP-Malur'}-report_${rep.from}_to_${rep.to}.csv`,
    ['Period', ...cols.map((c) => c[0] + (['preRate', 'externalShare', 'cctvUptime', 'woSla', 'pfOccupancy'].includes(c[1]) ? ' (%)' : ''))],
    [...rep.rows.map((r) => [r.label, ...cols.map((c) => raw(c[1], r[c[1]]))]), ['Total / average', ...cols.map((c) => raw(c[1], rep.total[c[1]]))]],
    [[title], ['Period', `${rep.fromLabel} – ${rep.toLabel} (${rep.span} days, ${rep.grain.toLowerCase()} rows)`], ['Generated', `${new Date(rep.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`], ['Source', 'HIP Command Center · Astrikos (simulated telemetry)']],
  );
}

function siaNarrative(rep, scope) {
  const t = rep.total;
  const half = Math.floor(rep.rows.length / 2);
  const a = rep.rows.slice(0, Math.max(1, half));
  const b = rep.rows.slice(Math.max(1, half));
  const avg = (rs, k) => rs.reduce((x, r) => x + r[k], 0) / Math.max(1, rs.length);
  const dir = (k) => { const x = avg(a, k); const y = avg(b, k); if (!x || !b.length) return null; const d = y / x - 1; return `${d >= 0 ? 'up' : 'down'} ${Math.abs(d * 100).toFixed(0)}%`; };
  if (scope === 'portfolio') {
    return [
      `Across the ${PORTFOLIO_FACTS.ilpCount}-park network, gates handled ${fmt(t.pfTrucks)} trucks over the period${dir('pfTrucks') ? ` (${dir('pfTrucks')} in the second half)` : ''}, with average occupancy at ${pct(t.pfOccupancy, 1)} and network health ${fmt(t.pfHealth)}/100.`,
      `Energy drawn was ${fmt(t.pfEnergyMwh)} MWh and water ${fmt(t.pfWaterKl)} KL. ${fmt(t.pfCritical)} critical alerts were raised — HIP Malur remains the most tanker-dependent park at ${pct(t.externalShare)} external water.`,
      'Sia recommends prioritising tenant pre-intimation and ANPR at the busiest gates, and replicating STP reuse for flushing in water-stressed parks.',
    ];
  }
  return [
    `HIP Malur processed ${fmt(t.trucksIn)} truck entries with an average gate wait of ${fmt(t.avgWaitMin, 1)} min and a worst queue of ${fmt(t.maxQueue)} trucks; only ${pct(t.preRate)} of trucks were pre-intimated by tenants${dir('avgWaitMin') ? ` (gate wait ${dir('avgWaitMin')} over the period)` : ''}.`,
    `Water use was ${fmt(t.waterKl)} KL, of which ${pct(t.externalShare)} came by tanker (${inr(t.waterCost)}). Energy across HIP transformers was ${fmt(t.energyKwh)} kWh; common-area cost ${inr(t.commonCost)}.`,
    `${fmt(t.woRaised)} work orders were raised and ${fmt(t.woClosed)} closed (SLA ${pct(t.woSla)}); ${fmt(t.lightFaults)} street-light faults and ${fmt(t.incidents)} incidents were recorded. CCTV availability averaged ${pct(t.cctvUptime, 1)}.`,
    'Sia recommends: mandatory pre-arrival slot booking for tenant trucks, STP-treated water for flushing to cut tanker spend, and ANPR + parking analytics on the existing gate cameras.',
  ];
}

export function exportReportPdf(rep, scope) {
  const cols = scope === 'portfolio' ? PORTFOLIO_COLS : MALUR_COLS;
  const t = rep.total;
  const origin = window.location.origin;
  const tiles = scope === 'portfolio'
    ? [['Network trucks', fmt(t.pfTrucks)], ['Avg occupancy', pct(t.pfOccupancy, 1)], ['Energy', `${fmt(t.pfEnergyMwh)} MWh`], ['Water', `${fmt(t.pfWaterKl)} KL`], ['Network health', `${fmt(t.pfHealth)}/100`], ['Critical alerts', fmt(t.pfCritical)]]
    : [['Truck entries', fmt(t.trucksIn)], ['Avg gate wait', `${fmt(t.avgWaitMin, 1)} min`], ['Water used', `${fmt(t.waterKl)} KL`], ['External water', pct(t.externalShare)], ['Energy', `${fmt(t.energyKwh)} kWh`], ['WO SLA', pct(t.woSla)]];
  const woByCat = {};
  rep.wos.forEach((w) => { woByCat[w.category] = woByCat[w.category] || { n: 0, open: 0 }; woByCat[w.category].n += 1; if (!['Resolved', 'Closed'].includes(w.status)) woByCat[w.category].open += 1; });
  const title = scope === 'portfolio' ? 'Executive Portfolio Report' : 'Facility Management Report — HIP Malur';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} · ${rep.fromLabel} – ${rep.toLabel}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
* { box-sizing: border-box; } body { font-family: Barlow, 'Segoe UI', Arial, sans-serif; color: #161616; margin: 0; font-size: 11px; }
header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #F47922; padding-bottom: 10px; }
header img { height: 30px; } header .sep { width: 1px; height: 28px; background: #ccc; }
header .meta { margin-left: auto; text-align: right; color: #555; }
h1 { font-size: 20px; margin: 14px 0 2px; } .sub { color: #666; margin-bottom: 12px; }
.tiles { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 10px 0 14px; }
.tile { border: 1px solid #e5e4e0; border-radius: 8px; padding: 8px 10px; } .tile b { display: block; font-size: 17px; margin-top: 2px; }
.sia { border: 1px solid #d9c7e3; background: #f6effa; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; }
.sia h3 { margin: 0 0 4px; color: #8F53A1; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; } .sia p { margin: 3px 0; line-height: 1.45; }
table { width: 100%; border-collapse: collapse; font-size: 9px; } th, td { padding: 3px 4px; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap; }
th { background: #f5f5f3; font-size: 8px; white-space: normal; vertical-align: bottom; text-transform: uppercase; letter-spacing: .03em; color: #555; } th:first-child, td:first-child { text-align: left; }
tr.total td { font-weight: 700; border-top: 2px solid #F47922; background: #fff7f0; }
h2 { font-size: 13px; margin: 16px 0 6px; } .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
footer { margin-top: 16px; color: #888; font-size: 9.5px; display: flex; justify-content: space-between; border-top: 1px solid #eee; padding-top: 6px; }
.pill { display: inline-block; padding: 1px 6px; border-radius: 9px; font-size: 9px; font-weight: 700; color: #fff; }
</style></head><body>
<header><img src="${origin}/brand/Horizon_black.svg" alt="Horizon Industrial Parks"><span class="sep"></span><img src="${origin}/brand/astrikos-light.svg" alt="Astrikos">
<div class="meta"><b>Facility Management Command Center</b><br>Generated ${new Date(rep.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div></header>
<h1>${title}</h1><div class="sub">${rep.period?.label || ''} · ${rep.fromLabel} – ${rep.toLabel} · ${rep.span} day(s) · ${rep.grain.toLowerCase()} breakdown${scope === 'malur' ? ` · ${SITE.address}` : ` · ${PORTFOLIO_FACTS.ilpCount} I&L parks + ${PORTFOLIO_FACTS.incityCount} InCity centers`}</div>
<div class="tiles">${tiles.map(([k, v]) => `<div class="tile">${k}<b>${v}</b></div>`).join('')}</div>
<div class="sia"><h3>Sia summary</h3>${siaNarrative(rep, scope).map((p) => `<p>${p}</p>`).join('')}</div>
<h2>${rep.grain} breakdown</h2>
<table><thead><tr><th>Period</th>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>
${rep.rows.map((r) => `<tr><td>${r.label}</td>${cols.map((c) => `<td>${c[2](r[c[1]])}</td>`).join('')}</tr>`).join('')}
<tr class="total"><td>Total / average</td>${cols.map((c) => `<td>${c[2](t[c[1]])}</td>`).join('')}</tr></tbody></table>
${scope === 'malur' ? `<div class="two"><div><h2>Work orders raised in period (tracker)</h2><table><thead><tr><th>Category</th><th>Raised</th><th>Still open</th></tr></thead><tbody>
${Object.entries(woByCat).sort((a, b) => b[1].n - a[1].n).map(([c, v]) => `<tr><td>${c}</td><td>${v.n}</td><td>${v.open}</td></tr>`).join('') || '<tr><td colspan="3">No work orders in the tracker for this period</td></tr>'}</tbody></table></div>
<div><h2>Open Sia advisories (at time of export)</h2><table><thead><tr><th>Severity</th><th style="text-align:left">Advisory</th></tr></thead><tbody>
${rep.advisories.map((a) => `<tr><td><span class="pill" style="background:${a.severity === 'critical' ? '#d72d2d' : a.severity === 'warning' ? '#d68000' : a.severity === 'opportunity' ? '#2a78d6' : '#888'}">${a.severity}</span></td><td style="text-align:left;white-space:normal">${a.title}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
<footer><span>Horizon Industrial Parks × Astrikos · HIP Command Center</span><span>Telemetry simulated for demonstration</span></footer>
<script>window.onload = () => setTimeout(() => window.print(), 400);</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
