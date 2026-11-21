import { WATER } from '../../config/malur';
import { washroomProfile, domesticProfile, gardenProfile } from '../profiles';
import { clamp } from '../util';

/**
 * Water balance model: demand by use (washrooms, domestic, gardening) is drawn
 * from the above-ground tank, refilled from the UG sump by a transfer pump.
 * The sump is fed by two borewells and by external tankers (ordered when the
 * sump runs low). The fire reserve is a separate tank that must stay full.
 * STP treats washroom/domestic grey water; treated water is reused for gardening.
 */

const USE_PROFILE = { washroom: washroomProfile, domestic: domesticProfile, garden: gardenProfile };
const TRANSFER_KLH = 22;
const STP_KLH = WATER.stp.capacityKld / 24;

function newDay() {
  return {
    use: { washroom: 0, domestic: 0, garden: 0 },
    tankerKl: 0, tankers: 0, borewellKl: 0, bw: { 'BW-1': 0, 'BW-2': 0 }, bwRunH: { 'BW-1': 0, 'BW-2': 0 },
    stpTreatedKl: 0, stpReusedKl: 0, fireTopUpKl: 0, cost: 0,
    hourlyUse: Array.from({ length: 24 }, () => 0),
    tankerLog: [],
  };
}

export function createWater(rng) {
  const tank = (id) => WATER.tanks.find((t) => t.id === id);
  return {
    level: {
      SUMP: tank('SUMP').capKl * rng.range(0.55, 0.75),
      AGT: tank('AGT').capKl * rng.range(0.6, 0.85),
      FIRE: tank('FIRE').capKl * 0.995,
      'STP-T': tank('STP-T').capKl * 0.4,
    },
    transferOn: false,
    bw: {
      'BW-1': { running: false, tripped: false, tripUntil: 0, gwDepthM: rng.range(118, 124), currentA: 0 },
      'BW-2': { running: false, tripped: false, tripUntil: 0, gwDepthM: rng.range(131, 138), currentA: 0 },
    },
    tanker: { enRouteEta: null, orderedAt: null, vehicle: null },
    flow: { washroom: 0, domestic: 0, garden: 0, inBorewell: 0, inTanker: 0 },
    stpInflowBuf: 0,
    today: newDay(),
    dateKey: null,
    events: [],
  };
}

function pushEvent(s, ev) { s.events.unshift(ev); if (s.events.length > 60) s.events.length = 60; }

export function stepWater(s, ctx) {
  const { rng, now, dt, h, dateKey } = ctx;
  if (s.dateKey !== dateKey) { s.today = newDay(); s.dateKey = dateKey; }
  const hrs = dt / 3600;
  const cap = Object.fromEntries(WATER.tanks.map((t) => [t.id, t.capKl]));

  /* demand */
  let demandTotal = 0;
  WATER.uses.forEach((u) => {
    const rate = (WATER.dailyDemandKl * u.share * USE_PROFILE[u.id](h)) / 24 * rng.range(0.9, 1.1); // KL/h
    s.flow[u.id] = rate;
    demandTotal += rate * hrs;
  });

  // gardening uses treated water first
  const gardenNeed = s.flow.garden * hrs;
  const reuse = Math.min(gardenNeed * 0.55, s.level['STP-T']);
  s.level['STP-T'] -= reuse;
  s.today.stpReusedKl += reuse;
  const potableDraw = demandTotal - reuse;
  s.level.AGT = Math.max(0, s.level.AGT - potableDraw);
  WATER.uses.forEach((u) => { s.today.use[u.id] += s.flow[u.id] * hrs; });
  s.today.hourlyUse[Math.floor(h) % 24] += demandTotal;

  /* transfer pump SUMP → AGT (hysteresis) */
  const agtPct = s.level.AGT / cap.AGT;
  if (agtPct < 0.38) s.transferOn = true;
  if (agtPct > 0.93 || s.level.SUMP < 8) s.transferOn = false;
  if (s.transferOn) {
    const mv = Math.min(TRANSFER_KLH * hrs, s.level.SUMP, cap.AGT - s.level.AGT);
    s.level.SUMP -= mv;
    s.level.AGT += mv;
  }

  /* fire reserve — slow loss, auto top-up from sump; periodic hydrant test */
  s.level.FIRE -= 0.06 * hrs;
  if (rng.chance(0.00012 * dt)) {
    const draw = rng.range(4, 9);
    s.level.FIRE -= draw;
    pushEvent(s, { ts: now, kind: 'fire-test', text: `Hydrant flow test drew ${draw.toFixed(1)} KL from fire reserve` });
  }
  if (s.level.FIRE < cap.FIRE * 0.985 && s.level.SUMP > 20) {
    const mv = Math.min(6 * hrs, cap.FIRE - s.level.FIRE, s.level.SUMP - 20);
    s.level.FIRE += mv;
    s.level.SUMP -= mv;
    s.today.fireTopUpKl += mv;
  }

  /* borewells */
  const sumpPct = s.level.SUMP / cap.SUMP;
  const schedule = {
    'BW-1': (h >= 5.5 && h < 13.5) || (h >= 19 && h < 22.5),
    'BW-2': (h >= 9 && h < 12.5) || (h >= 15 && h < 18),
  };
  s.flow.inBorewell = 0;
  WATER.borewells.forEach((b) => {
    const st = s.bw[b.id];
    if (st.tripped && now >= st.tripUntil) {
      st.tripped = false;
      pushEvent(s, { ts: now, kind: 'borewell', text: `${b.name} motor reset by FM technician` });
    }
    const want = schedule[b.id] && sumpPct < 0.93 && !st.tripped;
    if (want && !st.running && rng.chance(b.id === 'BW-2' ? 0.004 : 0.0015)) {
      st.tripped = true;
      st.tripUntil = now + rng.range(2, 6) * 3600000;
      pushEvent(s, { ts: now, kind: 'borewell', text: `${b.name} pump tripped on dry-run protection` });
    }
    st.running = want && !st.tripped;
    if (st.running) {
      const y = b.yieldKlh * rng.range(0.9, 1.05) * clamp(1.1 - (st.gwDepthM - 115) / 120, 0.6, 1);
      const add = Math.min(y * hrs, cap.SUMP - s.level.SUMP);
      s.level.SUMP += add;
      s.today.borewellKl += add;
      s.today.bw[b.id] += add;
      s.today.bwRunH[b.id] += hrs;
      s.flow.inBorewell += y;
      st.gwDepthM += 0.35 * hrs; // drawdown
      st.currentA = (b.pumpKw * 1000) / (1.732 * 415 * 0.85) * rng.range(0.95, 1.05);
    } else {
      st.gwDepthM = Math.max(b.id === 'BW-1' ? 116 : 129, st.gwDepthM - 0.25 * hrs); // recovery
      st.currentA = 0;
    }
  });

  /* tankers (external supply) */
  const tk = s.tanker;
  s.flow.inTanker = 0;
  if (!tk.enRouteEta && sumpPct < 0.58 && h >= 5.5 && h < 21.5) {
    tk.orderedAt = now;
    tk.enRouteEta = now + rng.range(35, 80) * 60000;
    tk.vehicle = `KA ${String(rng.int(1, 60)).padStart(2, '0')} ${['A', 'B', 'C', 'D'][rng.int(0, 3)]} ${rng.int(1000, 9999)}`;
    pushEvent(s, { ts: now, kind: 'tanker', text: `Tanker ordered (sump at ${(sumpPct * 100).toFixed(0)} %)` });
  }
  if (tk.enRouteEta && now >= tk.enRouteEta) {
    const add = Math.min(WATER.tankerKl, cap.SUMP - s.level.SUMP);
    s.level.SUMP += add;
    s.today.tankerKl += WATER.tankerKl;
    s.today.tankers += 1;
    s.today.cost += WATER.tankerKl * WATER.tankerCostPerKl;
    s.today.tankerLog.unshift({ ts: now, kl: WATER.tankerKl, vehicle: tk.vehicle });
    s.flow.inTanker = WATER.tankerKl / hrs > 200 ? 200 : WATER.tankerKl / Math.max(hrs, 0.05);
    pushEvent(s, { ts: now, kind: 'tanker', text: `Tanker ${tk.vehicle} unloaded ${WATER.tankerKl} KL` });
    tk.enRouteEta = null;
    tk.vehicle = null;
  }

  /* STP */
  s.stpInflowBuf += (s.flow.washroom * 0.85 + s.flow.domestic * 0.55) * hrs;
  const treat = Math.min(s.stpInflowBuf, STP_KLH * hrs);
  s.stpInflowBuf -= treat;
  const toTank = Math.min(treat * 0.92, cap['STP-T'] - s.level['STP-T']);
  s.level['STP-T'] += toTank;
  s.today.stpTreatedKl += treat * 0.92;

  Object.keys(s.level).forEach((k) => { s.level[k] = clamp(s.level[k], 0, cap[k]); });
}

export function waterSnapshot(s) {
  const cap = Object.fromEntries(WATER.tanks.map((t) => [t.id, t.capKl]));
  const usedToday = Object.values(s.today.use).reduce((a, b) => a + b, 0);
  const supplied = s.today.tankerKl + s.today.borewellKl;
  return {
    levels: Object.fromEntries(Object.entries(s.level).map(([k, v]) => [k, { kl: v, pct: v / cap[k], cap: cap[k] }])),
    flow: { ...s.flow },
    transferOn: s.transferOn,
    borewells: Object.fromEntries(Object.entries(s.bw).map(([k, v]) => [k, { ...v, klToday: s.today.bw[k], runH: s.today.bwRunH[k] }])),
    tanker: { ...s.tanker },
    today: {
      useKl: usedToday,
      use: { ...s.today.use },
      tankerKl: s.today.tankerKl,
      tankers: s.today.tankers,
      borewellKl: s.today.borewellKl,
      externalShare: supplied > 0 ? s.today.tankerKl / supplied : 0,
      stpTreatedKl: s.today.stpTreatedKl,
      stpReusedKl: s.today.stpReusedKl,
      stpReuseRate: s.today.stpTreatedKl > 0 ? s.today.stpReusedKl / s.today.stpTreatedKl : 0,
      cost: s.today.cost,
      fireTopUpKl: s.today.fireTopUpKl,
      hourlyUse: [...s.today.hourlyUse],
      tankerLog: s.today.tankerLog.slice(0, 20),
    },
    events: s.events.slice(0, 30),
  };
}
