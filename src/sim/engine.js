import { mulberry32, istParts } from './util';
import { ambientC, humidityPct } from './profiles';
import { createGate, stepGate, gateSnapshot } from './models/gate';
import { createWater, stepWater, waterSnapshot } from './models/water';
import { createPower, stepPower, powerSnapshot } from './models/power';
import { createSafety, stepSafety, safetySnapshot } from './models/safety';
import { createPortfolio, stepPortfolio, portfolioSnapshot } from './models/portfolio';
import { TENANTS } from '../config/malur';
import { injectIncident, resolveIncident, stepIncidents } from './incidents';

/**
 * Simulation engine — owns every model, advances them on a shared clock and
 * keeps 5-minute history buckets (24 h) for trend charts.
 */

const BUCKET_MS = 5 * 60 * 1000;
const HISTORY_BUCKETS = 288;
const MAX_SUBSTEP_S = 60;

export function createEngine({ seed, startTs }) {
  const rng = mulberry32(seed);
  const st = {
    gate: createGate(rng, startTs),
    water: createWater(rng),
    power: createPower(rng, startTs),
    safety: createSafety(rng, startTs),
    portfolio: createPortfolio(seed),
    incidents: [],
  };
  let simNow = startTs;
  let seq = 0;
  let recording = true;
  const buckets = [];
  let cur = null;

  function acc(key, value, mode) {
    const a = cur.acc[key] || (cur.acc[key] = { sum: 0, n: 0, max: -Infinity, last: 0 });
    a.sum += value; a.n += 1; a.max = Math.max(a.max, value); a.last = value;
    a.mode = mode;
  }

  function finalize(b) {
    const out = { t: b.t };
    Object.entries(b.acc).forEach(([k, a]) => {
      out[k] = a.mode === 'sum' ? a.sum : a.mode === 'max' ? a.max : a.mode === 'last' ? a.last : a.sum / Math.max(1, a.n);
    });
    return out;
  }

  function record(ctx, deltas) {
    if (!recording) return;
    const bt = Math.floor(ctx.now / BUCKET_MS) * BUCKET_MS;
    if (!cur || cur.t !== bt) {
      if (cur) {
        buckets.push(finalize(cur));
        if (buckets.length > HISTORY_BUCKETS) buckets.shift();
      }
      cur = { t: bt, acc: {} };
    }
    const g = st.gate;
    const w = st.water;
    const p = st.power;
    TENANTS.forEach((t) => acc(`arr_${t.id}`, deltas.arrivals[t.id] || 0, 'sum'));
    acc('arrivals', Object.values(deltas.arrivals).reduce((a, b) => a + b, 0), 'sum');
    acc('entries', deltas.entries, 'sum');
    acc('exits', deltas.exits, 'sum');
    acc('queue', g.queue.length, 'max');
    acc('inside', g.inside.length, 'last');
    acc('violations', g.violations.length, 'last');
    const lanes = g.lanes.filter((l) => l.open).length;
    acc('lanes', lanes, 'max');
    acc('estWait', (g.queue.length * 128) / lanes / 60, 'avg');
    acc('w_washroom', w.flow.washroom, 'avg');
    acc('w_domestic', w.flow.domestic, 'avg');
    acc('w_garden', w.flow.garden, 'avg');
    acc('w_tanker', deltas.tankerKl, 'sum');
    acc('w_bore', deltas.boreKl, 'sum');
    acc('lvl_sump', w.level.SUMP / 250, 'last');
    acc('lvl_agt', w.level.AGT / 60, 'last');
    acc('lvl_fire', w.level.FIRE / 350, 'last');
    acc('tr1', p.tr['TR-1'].kva, 'avg');
    acc('tr2', p.tr['TR-2'].kva, 'avg');
    acc('tr3', p.tr['TR-3'].kva, 'avg');
    acc('kv', p.grid.kv, 'avg');
    acc('lights_on', p.lights.filter((l) => l.on).length, 'last');
    acc('lights_fault', p.lights.filter((l) => l.status !== 'ok').length, 'last');
    acc('ev_service', p.buggies.filter((b) => b.state === 'service').length, 'last');
    acc('cam_online', st.safety.cams.filter((c) => c.status === 'online').length, 'last');
    acc('pressure', st.safety.fire.pressureBar, 'avg');
  }

  function substep(dt) {
    simNow += dt * 1000;
    const { h, dateKey } = istParts(simNow);
    const ctx = { rng, now: simNow, dt, h, dateKey };
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    const sameDay = st.gate.dateKey === dateKey;
    const prevArr = sameDay ? { ...st.gate.today.arrivals } : {};
    const prevEntries = sameDay ? sum(st.gate.today.entries) : 0;
    const prevExits = sameDay ? sum(st.gate.today.exits) : 0;
    const wSame = st.water.dateKey === dateKey;
    const prevTanker = wSame ? st.water.today.tankerKl : 0;
    const prevBore = wSame ? st.water.today.borewellKl : 0;

    stepGate(st.gate, ctx);
    stepWater(st.water, ctx);
    stepPower(st.power, ctx, st.water);
    stepSafety(st.safety, ctx, st.gate);
    stepIncidents(st, ctx);
    stepPortfolio(st.portfolio, ctx, malurSummary());

    const arrivals = {};
    TENANTS.forEach((t) => { arrivals[t.id] = st.gate.today.arrivals[t.id] - (prevArr[t.id] || 0); });
    record(ctx, {
      arrivals,
      entries: sum(st.gate.today.entries) - prevEntries,
      exits: sum(st.gate.today.exits) - prevExits,
      tankerKl: st.water.today.tankerKl - prevTanker,
      boreKl: st.water.today.borewellKl - prevBore,
    });
  }

  function malurSummary() {
    const g = st.gate;
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    return {
      live: true,
      occupancy: 0.97,
      tenants: 6,
      trucksToday: sum(g.today.entries),
      trucksNow: g.inside.length,
      kwhToday: Object.values(st.power.today.kwh).reduce((a, b) => a + b, 0),
      klToday: Object.values(st.water.today.use).reduce((a, b) => a + b, 0),
      waitMin: Math.max(0.5, g.today.waitSum / Math.max(1, sum(g.today.entries))),
    };
  }

  return {
    get now() { return simNow; },
    setRecording(v) { recording = v; },
    inject(type) { return injectIncident(st, type, simNow, rng); },
    resolve(id) { resolveIncident(st, id, simNow); },
    step(dtSec) {
      let remaining = dtSec;
      while (remaining > 1e-6) {
        const d = Math.min(MAX_SUBSTEP_S, remaining);
        substep(d);
        remaining -= d;
      }
    },
    snapshot() {
      const clock = istParts(simNow);
      seq += 1;
      return {
        seq,
        ts: simNow,
        clock,
        env: { ambientC: ambientC(clock.h), humidity: humidityPct(clock.h) },
        gate: gateSnapshot(st.gate, simNow),
        water: waterSnapshot(st.water),
        power: powerSnapshot(st.power),
        safety: safetySnapshot(st.safety),
        portfolio: portfolioSnapshot(st.portfolio),
        incidents: st.incidents.map((i) => ({ ...i })),
      };
    },
    history() {
      const out = buckets.slice();
      if (cur) out.push(finalize(cur));
      return out;
    },
  };
}
