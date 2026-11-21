import { TENANTS, TENANT_BY_ID, PARKING_ZONES, NO_PARKING_HOTSPOTS, GATE } from '../../config/malur';
import { truckProfile } from '../profiles';
import { makePlate, TRUCK_TYPES } from '../util';

/**
 * Gate & truck logistics model (agent based).
 * Trucks arrive per tenant following the time-of-day profile, queue on the
 * public road, are processed at the entry lane(s) (manual verification is slow
 * when the tenant has not pre-intimated the vehicle), dock or park in the
 * tenant's dedicated bays, and exit after their dwell time.
 */

const PRE_INTIMATION = { amazon: 0.3, flipkart: 0.24, decathlon: 0.16, others: 0.1 };
const ENTRY_SEC = { pre: 62, manual: 148 };
const EXIT_SEC = 68;
const MAX_EVENTS = 160;

const tenantZone = Object.fromEntries(PARKING_ZONES.filter((z) => z.tenant).map((z) => [z.tenant, z]));

function byTenant(v = 0) { return Object.fromEntries(TENANTS.map((t) => [t.id, v])); }

function newDay() {
  return {
    arrivals: byTenant(), entries: byTenant(), exits: byTenant(), pre: 0,
    waitSum: 0, waitMax: 0, queueMax: 0, violations: 0, violationsResolved: 0,
    roadTruckMinutes: 0, laneOpenings: 0,
    hourly: Array.from({ length: 24 }, () => byTenant()),
  };
}

export function createGate(rng, now) {
  return {
    seq: 1,
    vseq: 1,
    queue: [],
    inside: [],
    exitQueue: [],
    lanes: [{ id: 1, open: true, current: null }, { id: 2, open: false, current: null }],
    exitLane: { current: null },
    laneWatch: { highSince: null, lowSince: null },
    violations: [],
    events: [],
    today: newDay(),
    dateKey: null,
    lastViolationScan: now,
  };
}

function pushEvent(s, ev) {
  s.events.unshift(ev);
  if (s.events.length > MAX_EVENTS) s.events.length = MAX_EVENTS;
}

function dwellMs(rng, type) {
  const [lo, hi] = type === '32ft' ? [2.4, 5.2] : type === '20ft' ? [1.5, 3.6] : [0.7, 2.0];
  return rng.range(lo, hi) * 3600 * 1000;
}

function counts(s) {
  const c = Object.fromEntries(TENANTS.map((t) => [t.id, { dock: 0, bay: 0, violation: 0, exiting: 0 }]));
  s.inside.forEach((tr) => { c[tr.tenant][tr.state] = (c[tr.tenant][tr.state] || 0) + 1; });
  return c;
}

function nearestHotspot(rng) { return rng.pick(NO_PARKING_HOTSPOTS.slice(0, 4)); }

function openViolation(s, ctx, { kind, plate, tenant, truckId, where, x, z, durationMs }) {
  const { now, rng } = ctx;
  const v = {
    id: `PV-${String(s.vseq++).padStart(4, '0')}`,
    ts: now, kind, plate, tenant, truckId, where, x, z,
    autoClearAt: durationMs ? now + durationMs : null,
    camera: kind === 'wrong-bay' ? 'CAM-P0' + (PARKING_ZONES.findIndex((p) => p.name === where) + 1) : rng.pick(['CAM-G03', 'CAM-D1', 'CAM-B2', 'CAM-A21']),
  };
  s.violations.push(v);
  s.today.violations += 1;
  pushEvent(s, { kind: 'violation', ts: now, plate, tenant, text: `${labelFor(kind)} — ${where}`, id: v.id });
  return v;
}

function resolveViolation(s, ctx, v, reason) {
  s.violations = s.violations.filter((x) => x !== v);
  s.today.violationsResolved += 1;
  pushEvent(s, { kind: 'resolved', ts: ctx.now, plate: v.plate, tenant: v.tenant, text: `Cleared: ${labelFor(v.kind)} (${reason})`, id: v.id });
}

export function labelFor(kind) {
  return { overflow: 'Overflow — bays full', 'wrong-bay': "Parked in another tenant's bay", 'no-parking': 'Parked in no-parking zone' }[kind] || kind;
}

function admit(s, tr, ctx) {
  const { rng } = ctx;
  const T = TENANT_BY_ID[tr.tenant];
  tr.waitMin = Math.max(0, (tr.serviceStart - tr.arrivedAt) / 60000);
  s.today.entries[tr.tenant] += 1;
  if (tr.pre) s.today.pre += 1;
  s.today.waitSum += tr.waitMin;
  s.today.waitMax = Math.max(s.today.waitMax, tr.waitMin);
  const c = counts(s)[tr.tenant];
  tr.enteredAt = tr.doneAt;
  const stageFirst = rng.chance(0.55); // waits in tenant bay for dock slot / paperwork
  if (stageFirst && c.bay < T.truckBays) {
    tr.state = 'bay';
    tr.bayUntil = tr.doneAt + rng.range(15, 75) * 60000;
  } else if (c.dock < T.docks) {
    tr.state = 'dock';
    tr.dwellUntil = tr.doneAt + dwellMs(rng, tr.type);
  } else if (c.bay < T.truckBays) {
    tr.state = 'bay';
  } else {
    tr.state = 'violation';
    const hs = nearestHotspot(rng);
    tr.violationId = openViolation(s, ctx, { kind: 'overflow', plate: tr.plate, tenant: tr.tenant, truckId: tr.id, where: hs.name, x: hs.x, z: hs.z }).id;
  }
  s.inside.push(tr);
  pushEvent(s, {
    kind: 'entry', ts: tr.doneAt, plate: tr.plate, tenant: tr.tenant, type: tr.type, pre: tr.pre,
    waitMin: tr.waitMin, lane: tr.lane, text: `Entered via lane ${tr.lane} → ${tr.state === 'dock' ? 'dock' : tr.state === 'bay' ? 'tenant parking' : 'overflow'}`,
  });
}

function runLane(lane, queue, t0, now, procFn, onDone) {
  let t = t0;
  for (let guard = 0; guard < 400; guard++) {
    if (lane.current) {
      if (lane.current.doneAt <= now) {
        t = lane.current.doneAt;
        const done = lane.current;
        lane.current = null;
        onDone(done);
      } else break;
    }
    if (!queue.length) break;
    const tr = queue[0];
    const ready = tr.readyAt ?? tr.arrivedAt;
    const start = Math.max(t, ready);
    if (start >= now) break;
    queue.shift();
    tr.serviceStart = start;
    tr.doneAt = start + procFn(tr);
    lane.current = tr;
  }
}

export function stepGate(s, ctx) {
  const { rng, now, dt, h, dateKey } = ctx;
  if (s.dateKey !== dateKey) { s.today = newDay(); s.dateKey = dateKey; }
  const t0 = now - dt * 1000;

  /* 1 — arrivals */
  TENANTS.forEach((t) => {
    const lam = ((t.dailyTrucks * truckProfile(h)) / 24) * (dt / 3600) * (s.surgeUntil > now ? 2.6 : 1);
    const n = rng.poisson(lam);
    for (let i = 0; i < n; i++) {
      const type = rng.weighted(TRUCK_TYPES);
      s.queue.push({
        id: `T${s.seq++}`, plate: makePlate(rng), tenant: t.id, type: type.id,
        pre: rng.chance(PRE_INTIMATION[t.id]), arrivedAt: t0 + rng() * dt * 1000, state: 'queue',
      });
      s.today.arrivals[t.id] += 1;
      s.today.hourly[Math.floor(h) % 24][t.id] += 1;
    }
  });
  s.queue.sort((a, b) => a.arrivedAt - b.arrivedAt);

  /* 2 — FM response: open / close the second entry lane */
  const q = s.queue.length;
  const w = s.laneWatch;
  if (q >= 14) { if (!w.highSince) w.highSince = now; w.lowSince = null; }
  else if (q <= 3) { if (!w.lowSince) w.lowSince = now; w.highSince = null; }
  else { w.highSince = null; w.lowSince = null; }
  const lane2 = s.lanes[1];
  if (!lane2.open && w.highSince && now - w.highSince > 22 * 60000 && !(s.holdLane2Until > now)) {
    lane2.open = true;
    s.today.laneOpenings += 1;
    pushEvent(s, { kind: 'lane', ts: now, text: `Entry lane 2 opened by FM team (queue ${q})` });
  }
  if (lane2.open && !lane2.current && w.lowSince && now - w.lowSince > 15 * 60000) {
    lane2.open = false;
    pushEvent(s, { kind: 'lane', ts: now, text: 'Entry lane 2 closed — queue cleared' });
  }

  /* 3 — entry processing */
  s.lanes.forEach((lane) => {
    if (!lane.open && !lane.current) return;
    runLane(lane, lane.open ? s.queue : [], t0, now,
      (tr) => (tr.pre ? ENTRY_SEC.pre : ENTRY_SEC.manual) * rng.range(0.75, 1.35) * 1000,
      (tr) => { tr.lane = lane.id; admit(s, tr, ctx); });
  });

  /* 4 — inside: dwell complete → exit queue; bays/overflow → free docks */
  const c = counts(s);
  s.inside.forEach((tr) => {
    if (tr.state === 'dock' && tr.dwellUntil <= now) {
      tr.state = 'exiting';
      tr.readyAt = tr.dwellUntil;
      s.exitQueue.push(tr);
      c[tr.tenant].dock -= 1;
      c[tr.tenant].exiting += 1;
    }
  });
  TENANTS.forEach((T) => {
    const waiting = s.inside
      .filter((tr) => tr.tenant === T.id && ((tr.state === 'bay' && (!tr.bayUntil || tr.bayUntil <= now)) || (tr.state === 'violation' && tr.violationKind !== 'random')))
      .sort((a, b) => (a.state === 'bay' ? 0 : 1) - (b.state === 'bay' ? 0 : 1) || a.enteredAt - b.enteredAt);
    for (const tr of waiting) {
      if (c[T.id].dock >= T.docks) break;
      if (tr.state === 'violation') {
        const v = s.violations.find((x) => x.truckId === tr.id);
        if (v) resolveViolation(s, ctx, v, 'moved to dock');
        c[T.id].violation -= 1;
      } else c[T.id].bay -= 1;
      tr.state = 'dock';
      tr.dwellUntil = now + dwellMs(rng, tr.type);
      c[T.id].dock += 1;
    }
    // overflow trucks move into bays when space frees up
    s.inside.filter((tr) => tr.tenant === T.id && tr.state === 'violation' && tr.violationKind !== 'random').forEach((tr) => {
      if (c[T.id].bay < T.truckBays) {
        const v = s.violations.find((x) => x.truckId === tr.id);
        if (v) resolveViolation(s, ctx, v, 'moved to tenant bay');
        tr.state = 'bay';
        c[T.id].bay += 1;
        c[T.id].violation -= 1;
      }
    });
  });

  /* 5 — random behavioural violations (drivers parking in wrong bay / no-parking) */
  const night = h >= 17 || h < 6.5;
  const lamV = (6.5 / 24) * (night ? 1.7 : 0.55) * (dt / 3600);
  const nV = rng.poisson(lamV);
  for (let i = 0; i < nV; i++) {
    const candidates = s.inside.filter((tr) => tr.state === 'bay');
    const tr = candidates.length ? rng.pick(candidates) : null;
    const wrongBay = rng.chance(0.55);
    let where; let x; let z;
    if (wrongBay) {
      const others = PARKING_ZONES.filter((p) => p.kind === 'truck' && (!tr || p.tenant !== tr.tenant));
      const zone = rng.pick(others);
      where = zone.name; x = zone.cx; z = zone.cz;
    } else {
      const hs = nearestHotspot(rng);
      where = hs.name; x = hs.x; z = hs.z;
    }
    const tenant = tr ? tr.tenant : rng.pick(TENANTS).id;
    const v = openViolation(s, ctx, {
      kind: wrongBay ? 'wrong-bay' : 'no-parking', plate: tr ? tr.plate : makePlate(rng), tenant,
      truckId: tr ? tr.id : null, where, x, z, durationMs: rng.range(25, 140) * 60000,
    });
    if (tr) { tr.state = 'violation'; tr.violationKind = 'random'; tr.violationId = v.id; }
  }
  // auto-clear (driver moved after security intervention)
  s.violations.filter((v) => v.autoClearAt && v.autoClearAt <= now).forEach((v) => {
    const tr = s.inside.find((x) => x.id === v.truckId);
    if (tr) { tr.state = 'bay'; tr.violationKind = null; }
    resolveViolation(s, ctx, v, 'vehicle moved');
  });

  /* 6 — exit processing */
  s.exitQueue.sort((a, b) => a.readyAt - b.readyAt);
  runLane(s.exitLane, s.exitQueue, t0, now, () => EXIT_SEC * rng.range(0.8, 1.3) * 1000, (tr) => {
    s.inside = s.inside.filter((x) => x !== tr);
    s.today.exits[tr.tenant] += 1;
    pushEvent(s, { kind: 'exit', ts: tr.doneAt, plate: tr.plate, tenant: tr.tenant, type: tr.type, text: 'Exited — gate pass closed' });
  });

  /* 7 — daily stats */
  s.today.queueMax = Math.max(s.today.queueMax, s.queue.length);
  s.today.roadTruckMinutes += (s.queue.length * dt) / 60;
}

export function gateSnapshot(s, now) {
  const c = counts(s);
  const lanesOpen = s.lanes.filter((l) => l.open).length;
  const entriesTotal = Object.values(s.today.entries).reduce((a, b) => a + b, 0);
  const exitsTotal = Object.values(s.today.exits).reduce((a, b) => a + b, 0);
  const arrivalsTotal = Object.values(s.today.arrivals).reduce((a, b) => a + b, 0);
  const avgProcSec = 0.22 * ENTRY_SEC.pre + 0.78 * ENTRY_SEC.manual;
  const tenants = {};
  TENANTS.forEach((T) => {
    const zone = tenantZone[T.id];
    const wrongBayHere = s.violations.filter((v) => v.kind === 'wrong-bay' && zone && v.where === zone.name).length;
    tenants[T.id] = {
      ...c[T.id], docks: T.docks, bays: T.truckBays,
      zoneId: zone?.id, bayOcc: c[T.id].bay + wrongBayHere,
      queue: s.queue.filter((tr) => tr.tenant === T.id).length,
      arrivals: s.today.arrivals[T.id], entries: s.today.entries[T.id], exits: s.today.exits[T.id],
    };
  });
  const oldest = s.queue[0];
  return {
    queue: s.queue.length,
    queueMeters: s.queue.length * 18,
    queueOldestMin: oldest ? (now - oldest.arrivedAt) / 60000 : 0,
    queueTrucks: s.queue.slice(0, 48).map((t) => ({ id: t.id, tenant: t.tenant, plate: t.plate, pre: t.pre, type: t.type, waitMin: (now - t.arrivedAt) / 60000 })),
    processing: s.lanes.filter((l) => l.current).map((l) => ({ lane: l.id, plate: l.current.plate, tenant: l.current.tenant })),
    lanesOpen,
    lane2Open: s.lanes[1].open,
    surge: s.surgeUntil > now,
    exitQueue: s.exitQueue.length,
    insideTotal: s.inside.length,
    tenants,
    today: {
      arrivals: arrivalsTotal, entries: entriesTotal, exits: exitsTotal,
      byTenantEntries: { ...s.today.entries }, byTenantExits: { ...s.today.exits },
      pre: s.today.pre, preRate: entriesTotal ? s.today.pre / entriesTotal : 0,
      avgWaitMin: entriesTotal ? s.today.waitSum / entriesTotal : 0,
      maxWaitMin: s.today.waitMax, queueMax: s.today.queueMax,
      violations: s.today.violations, violationsResolved: s.today.violationsResolved,
      roadTruckHours: s.today.roadTruckMinutes / 60,
      laneOpenings: s.today.laneOpenings,
      hourly: s.today.hourly.map((row) => ({ ...row })),
    },
    estWaitMin: (s.queue.length * avgProcSec) / Math.max(1, lanesOpen) / 60,
    capacityPerHour: (3600 / avgProcSec) * lanesOpen,
    violations: s.violations.map((v) => ({ ...v })),
    events: s.events.slice(0, 80),
    trucksInside: s.inside.map((t) => ({ id: t.id, tenant: t.tenant, state: t.state, type: t.type, plate: t.plate, violationId: t.violationId })),
    gate: GATE,
  };
}
