import { POWER, STREET_LIGHTS, EV } from '../../config/malur';
import { tenantLoadFactor, ambientC, lightsScheduledOn, peopleProfile } from '../profiles';
import { clamp } from '../util';

/**
 * Electrical network (11 kV incomer → TR-1/TR-2 for Amazon/Flipkart, TR-3 for
 * common area; Decathlon on its own HT), the fire-safety DG, street lighting
 * fault detection and the EV buggy fleet.
 */

function newDay() {
  return { kwh: { 'TR-1': 0, 'TR-2': 0, 'TR-3': 0 }, commonKwh: { street: 0, pumps: 0, fmo: 0, cctv: 0, ev: 0 }, outageMin: 0, peakKva: { 'TR-1': 0, 'TR-2': 0, 'TR-3': 0 }, lightKwh: 0, wastedKwh: 0, buggyKm: 0, buggyTrips: 0, evKwh: 0 };
}

export function createPower(rng, now) {
  const lights = STREET_LIGHTS.map((l) => ({ id: l.id, status: 'ok', since: now - rng.range(1, 400) * 86400000, detectedAt: null, repairAt: null }));
  // seed a few existing faults
  const nFaults = rng.int(3, 6);
  for (let i = 0; i < nFaults; i++) {
    const l = rng.pick(lights);
    l.status = rng.chance(0.75) ? 'fault' : 'flicker';
    l.detectedAt = now - rng.range(1, 30) * 3600000;
    l.repairAt = now + rng.range(2, 20) * 3600000;
    l.wo = `WO-SL-${rng.int(4100, 4899)}`;
  }
  const dgFuel = rng.range(0.46, 0.82);
  const batteryTarget = rng.chance(0.3) ? 23.7 : rng.range(24.7, 25.3);
  return {
    grid: { kv: 11.02, hz: 50.0, outage: false, outageUntil: 0, lastOutageTs: now - rng.range(4, 12) * 86400000 },
    tr: {
      'TR-1': { kva: 0, pf: 0.95, oilC: 52, windC: 60 },
      'TR-2': { kva: 0, pf: 0.95, oilC: 50, windC: 58 },
      'TR-3': { kva: 0, pf: 0.93, oilC: 40, windC: 44 },
    },
    common: { street: 0, pumps: 0, fmo: 0, cctv: 0, ev: 0 },
    dg: {
      mode: 'AUTO', running: false, runUntil: 0, fuelPct: dgFuel, batteryV: batteryTarget, batteryTarget,
      coolantC: 31, runHours: rng.int(310, 420), lastTestTs: now - rng.range(2, 9) * 86400000, nextTestTs: null,
    },
    lights,
    buggies: EV.buggies.map((b, i) => ({ id: b.id, seats: b.seats, soc: rng.range(0.35, 0.98), state: 'idle', charger: null, pos: rng(), speed: rng.range(0.9, 1.15) * (i % 2 ? 1 : -1), kmToday: 0, tripsToday: 0 })),
    chargers: EV.chargers.map((c) => ({ ...c, status: 'available', buggy: null })),
    today: newDay(),
    dateKey: null,
    events: [],
  };
}

function pushEvent(s, ev) { s.events.unshift(ev); if (s.events.length > 60) s.events.length = 60; }

export function stepPower(s, ctx, water) {
  const { rng, now, dt, h, dateKey } = ctx;
  if (s.dateKey !== dateKey) { s.today = newDay(); s.dateKey = dateKey; }
  const hrs = dt / 3600;
  const amb = ambientC(h);

  /* grid */
  const g = s.grid;
  if (!g.outage && rng.chance((dt / 3600) / 60)) {
    g.outage = true;
    g.outageUntil = now + rng.range(3, 14) * 60000;
    g.lastOutageTs = now;
    pushEvent(s, { ts: now, kind: 'grid', severity: 'critical', text: '11 kV supply interrupted (BESCOM feeder trip)' });
  }
  if (g.outage && now >= g.outageUntil) {
    g.outage = false;
    pushEvent(s, { ts: now, kind: 'grid', text: '11 kV supply restored' });
  }
  if (g.outage) s.today.outageMin += dt / 60;
  g.kv = g.outage ? 0 : clamp(11.0 + 0.12 * Math.sin(now / 7.2e6) + rng.normal(0, 0.025) - 0.08 * (h > 18 && h < 22 ? 1 : 0), 10.5, 11.4);
  g.hz = g.outage ? 0 : 50 + rng.normal(0, 0.02);

  /* street lights */
  const schedOn = lightsScheduledOn(h);
  let streetW = 0;
  let wasted = 0;
  s.lights.forEach((l, i) => {
    const meta = STREET_LIGHTS[i];
    if (l.status !== 'ok' && l.repairAt && now >= l.repairAt) {
      pushEvent(s, { ts: now, kind: 'light', text: `${l.id} (${meta.road}) repaired — ${l.wo}` });
      l.status = 'ok'; l.detectedAt = null; l.repairAt = null; l.wo = null;
    }
    if (l.status === 'ok' && rng.chance((2.4 / 24 / STREET_LIGHTS.length) * hrs * (schedOn ? 1.6 : 0.5))) {
      const r = rng();
      l.status = r < 0.62 ? 'fault' : r < 0.85 ? 'flicker' : 'dayburn';
      l.detectedAt = now;
      l.repairAt = now + rng.range(5, 30) * 3600000;
      l.wo = `WO-SL-${rng.int(4100, 4899)}`;
      pushEvent(s, { ts: now, kind: 'light', severity: 'warning', text: `${l.id} on ${meta.road}: ${l.status === 'fault' ? 'lamp failure detected (0 A while scheduled ON)' : l.status === 'flicker' ? 'flicker / unstable current' : 'burning in daylight (timer/photocell fault)'}` });
    }
    const on = !g.outage && (l.status === 'ok' ? schedOn : l.status === 'flicker' ? schedOn : l.status === 'dayburn');
    l.on = on;
    if (on) {
      streetW += meta.watts;
      if (!schedOn) wasted += meta.watts;
    }
  });
  s.today.lightKwh += (streetW / 1000) * hrs;
  s.today.wastedKwh += (wasted / 1000) * hrs;

  /* EV buggies */
  const opHours = h >= 6.5 && h < 21.5;
  const wantInService = opHours ? (h > 8 && h < 19 ? 4 : 3) : 0;
  const bs = s.buggies;
  bs.forEach((b) => {
    if (b.state === 'service') {
      b.soc -= rng.range(0.11, 0.16) * hrs;
      const km = 14 * hrs;
      b.kmToday += km;
      s.today.buggyKm += km;
      b.pos = (b.pos + (b.speed * km) / 4.2 + 1) % 1;
      if (rng.chance(hrs * 2.5)) { b.tripsToday += 1; s.today.buggyTrips += 1; }
      if (b.soc < 0.22 || !opHours) b.state = 'needs-charge';
    }
    if (b.state === 'charging') {
      const add = 0.27 * hrs;
      b.soc = Math.min(1, b.soc + add);
      s.today.evKwh += 3.3 * hrs;
      if (b.soc >= 0.97) {
        const ch = s.chargers.find((c) => c.buggy === b.id);
        if (ch) { ch.buggy = null; ch.status = 'available'; }
        b.charger = null;
        b.state = 'idle';
      }
    }
  });
  // send low buggies to chargers
  bs.filter((b) => b.state === 'needs-charge' || (b.state === 'idle' && b.soc < 0.9 && !opHours)).forEach((b) => {
    const ch = s.chargers.find((c) => c.status === 'available');
    if (ch) { ch.status = 'charging'; ch.buggy = b.id; b.charger = ch.id; b.state = 'charging'; }
    else if (b.state === 'idle') b.state = 'idle';
  });
  // dispatch ready buggies into service
  const inService = bs.filter((b) => b.state === 'service').length;
  if (inService < wantInService) {
    const ready = bs.filter((b) => b.state === 'idle' && b.soc > 0.45).sort((a, b2) => b2.soc - a.soc);
    ready.slice(0, wantInService - inService).forEach((b) => { b.state = 'service'; });
  }
  // occasional charger fault
  s.chargers.forEach((c) => {
    if (c.status === 'fault' && c.repairAt && now > c.repairAt) { c.status = 'available'; c.repairAt = null; pushEvent(s, { ts: now, kind: 'ev', text: `${c.id} back in service` }); }
    if (c.status === 'available' && rng.chance(hrs / 90)) { c.status = 'fault'; c.repairAt = now + rng.range(4, 20) * 3600000; pushEvent(s, { ts: now, kind: 'ev', severity: 'warning', text: `${c.id} reported a ground-fault trip` }); }
  });
  const evKw = s.chargers.filter((c) => c.status === 'charging').length * 3.3;

  /* common-area load (TR-3) */
  const wb = water?.bw || {};
  const pumpsKw = (wb['BW-1']?.running ? 7.5 : 0) + (wb['BW-2']?.running ? 5.5 : 0) + (water?.transferOn ? 5.5 : 0) + 11 + rng.range(-0.5, 0.5);
  const people = peopleProfile(h);
  s.common = {
    street: streetW / 1000,
    pumps: g.outage ? 0 : pumpsKw,
    fmo: g.outage ? 0 : 6 + 12 * people + (amb > 26 ? 4 : 0),
    cctv: g.outage ? 0 : 6.2,
    ev: g.outage ? 0 : evKw,
  };
  Object.keys(s.common).forEach((k) => { s.today.commonKwh[k] += s.common[k] * hrs; });
  const commonKw = Object.values(s.common).reduce((a, b) => a + b, 0);

  /* transformers */
  const setTr = (id, kva, pf) => {
    const t = s.tr[id];
    const isolated = id === 'TR-2' && (s.fire?.asset === 'TR-2' || s.tr2IsolatedUntil > now);
    t.isolated = isolated;
    t.kva = g.outage || isolated ? 0 : kva;
    t.pf = pf;
    const rating = POWER.transformers.find((x) => x.id === id).kva;
    const lp = t.kva / rating;
    const targetOil = amb + 18 + 42 * lp * lp;
    t.oilC += ((id === 'TR-2' && s.fire ? 128 : targetOil) - t.oilC) * Math.min(1, hrs * (s.fire && id === 'TR-2' ? 30 : 1.4));
    t.windC = t.oilC + 11 * lp;
    s.today.kwh[id] += t.kva * pf * hrs;
    s.today.peakKva[id] = Math.max(s.today.peakKva[id], t.kva);
  };
  setTr('TR-1', 750 * tenantLoadFactor(h, 'amazon') * rng.range(0.95, 1.05) + (rng.chance(0.03) ? rng.range(20, 60) : 0), clamp(0.955 + rng.normal(0, 0.006), 0.9, 0.99));
  setTr('TR-2', 750 * tenantLoadFactor(h, 'flipkart') * rng.range(0.95, 1.05), clamp(0.945 + rng.normal(0, 0.008), 0.88, 0.99));
  setTr('TR-3', commonKw / 0.93, 0.93);

  /* fire DG — weekly test (Mon 10:00) + standby */
  const dg = s.dg;
  const d = new Date(now + 5.5 * 3600000);
  if (!dg.running && d.getUTCDay() === 1 && h >= 10 && h < 10.25 && now - dg.lastTestTs > 3 * 86400000) {
    dg.running = true; dg.runUntil = now + 15 * 60000; dg.lastTestTs = now;
    pushEvent(s, { ts: now, kind: 'dg', text: 'Fire DG weekly no-load test started' });
  }
  if (dg.running) {
    dg.fuelPct = Math.max(0, dg.fuelPct - (POWER.fireDg.burnLph * 0.35 * hrs) / POWER.fireDg.tankLitres);
    dg.runHours += hrs;
    dg.coolantC += (78 - dg.coolantC) * Math.min(1, hrs * 6);
    if (now >= dg.runUntil) { dg.running = false; pushEvent(s, { ts: now, kind: 'dg', text: 'Fire DG test completed — returned to AUTO standby' }); }
  } else {
    dg.coolantC += (amb + 4 - dg.coolantC) * Math.min(1, hrs * 2);
  }
  dg.batteryV = clamp(dg.batteryV + (dg.batteryTarget - dg.batteryV) * Math.min(1, hrs * 0.5) + rng.normal(0, 0.008), 23.2, 25.6);
}

export function powerSnapshot(s) {
  const lightsFault = s.lights.filter((l) => l.status === 'fault' || l.status === 'flicker');
  const dayburn = s.lights.filter((l) => l.status === 'dayburn');
  const commonKw = Object.values(s.common).reduce((a, b) => a + b, 0);
  return {
    grid: { ...s.grid },
    fire: s.fire ? { ...s.fire } : null,
    tr: Object.fromEntries(Object.entries(s.tr).map(([k, v]) => {
      const rating = POWER.transformers.find((x) => x.id === k).kva;
      return [k, { ...v, rating, loadPct: v.kva / rating, kw: v.kva * v.pf }];
    })),
    common: { ...s.common, totalKw: commonKw },
    dg: { ...s.dg, fuelLitres: s.dg.fuelPct * POWER.fireDg.tankLitres, autonomyH: (s.dg.fuelPct * POWER.fireDg.tankLitres) / POWER.fireDg.burnLph },
    lights: s.lights.map((l, i) => ({ ...l, road: STREET_LIGHTS[i].road, watts: STREET_LIGHTS[i].watts })),
    lightStats: {
      total: s.lights.length,
      working: s.lights.length - lightsFault.length - dayburn.length,
      faulty: lightsFault.length,
      dayburn: dayburn.length,
      on: s.lights.filter((l) => l.on).length,
      health: (s.lights.length - lightsFault.length - dayburn.length) / s.lights.length,
    },
    buggies: s.buggies.map((b) => ({ ...b })),
    chargers: s.chargers.map((c) => ({ ...c })),
    today: {
      ...s.today,
      kwh: { ...s.today.kwh },
      commonKwh: { ...s.today.commonKwh },
      peakKva: { ...s.today.peakKva },
      totalKwh: Object.values(s.today.kwh).reduce((a, b) => a + b, 0),
      costCommon: s.today.kwh['TR-3'] * POWER.tariffPerKwh,
    },
    events: s.events.slice(0, 40),
  };
}
