import { STREET_LIGHTS, WATER, NO_PARKING_HOTSPOTS, POWER, GATE, TENANTS } from '../config/malur';
import { makePlate, TRUCK_TYPES } from './util';

/**
 * Incident simulator — injects realistic facility incidents into the live
 * models so they propagate to KPIs, advisories, CCTV and the 3D twin.
 */

const TR2 = POWER.transformers.find((t) => t.id === 'TR-2');
const FIRE_LANE = NO_PARKING_HOTSPOTS.find((h) => h.id === 'NP-3');

export const INCIDENT_TYPES = {
  'gate-surge': {
    title: 'Peak-hour overcrowding at Gate 1',
    location: 'Main gate · Malur–Whitefield Road',
    x: GATE.x + 40, z: GATE.z + 60, camera: 'CAM-G04', kpis: ['gate-queue', 'gate-wait', 'gate-road'], module: 'gate',
    sop: 'Open entry lane 2 and the express lane for pre-intimated trucks; deploy two marshals on the public road; ask Amazon & Flipkart transport desks to hold dispatches for 30 min.',
  },
  'light-outage': {
    title: 'Street-light failure — Block D East Road',
    location: 'Block D East Road (4 consecutive poles)',
    camera: 'CAM-D1', kpis: ['street-lights'], module: 'lighting',
    sop: 'Isolate the feeder pillar, check the MCB/contactor and cable joint; deploy portable tower lights on the truck route until restored.',
  },
  'illegal-parking': {
    title: 'Truck parked in undesignated area (fire lane)',
    location: `${FIRE_LANE.name} · fire access lane`,
    x: FIRE_LANE.x, z: FIRE_LANE.z, camera: 'CAM-B2', kpis: ['parking'], module: 'gate',
    sop: 'Dispatch security patrol to move the vehicle to its tenant bay, record the violation with CCTV evidence and notify the tenant transport lead.',
  },
  'water-shortage': {
    title: 'Water shortage — domestic sump critically low',
    location: 'Water & fire utility zone (sump / AGT)',
    x: WATER.tanks[0].x, z: WATER.tanks[0].z, camera: 'CAM-W01', kpis: ['water-today', 'water-external', 'water-tankers', 'water-borewell'], module: 'water',
    sop: 'Order two emergency tankers, restrict landscape irrigation, switch washrooms to the STP-treated line where available, and reset/rotate the borewells.',
  },
  'grid-fire': {
    title: 'Fire at substation — TR-2 transformer',
    location: '11 kV substation · TR-2 (Flipkart feeder)',
    x: TR2.x, z: TR2.z, camera: 'CAM-U02', kpis: ['tr-load', 'tr2', 'grid', 'fire-reserve', 'fire-panel', 'fire-dg'], module: 'fire',
    sop: 'Trigger the fire SOP: isolate TR-2 at the RMU, use CO₂/DCP only (no water on live equipment), evacuate the substation area, call 101 and inform Flipkart; fire DG running for fire pumps.',
  },
};

let seq = 1;

export function injectIncident(st, type, now, rng) {
  if (st.incidents.some((i) => i.type === type && i.status === 'active')) return null;
  const def = INCIDENT_TYPES[type];
  const inc = { id: `INC-${String(seq++).padStart(3, '0')}`, type, ...def, severity: 'critical', status: 'active', startedAt: now };
  const g = st.gate;
  switch (type) {
    case 'gate-surge': {
      g.surgeUntil = now + 35 * 60000;
      g.holdLane2Until = now + 25 * 60000;
      for (let i = 0; i < 20; i++) {
        const t = rng.weighted(TENANTS.map((x) => ({ ...x, w: x.dailyTrucks })));
        g.queue.push({ id: `T${g.seq++}`, plate: makePlate(rng), tenant: t.id, type: rng.weighted(TRUCK_TYPES).id, pre: rng.chance(0.15), arrivedAt: now - rng.range(0, 22) * 60000, state: 'queue' });
        g.today.arrivals[t.id] += 1;
      }
      g.queue.sort((a, b) => a.arrivedAt - b.arrivedAt);
      break;
    }
    case 'light-outage': {
      const road = STREET_LIGHTS.map((l, i) => ({ l, i })).filter(({ l }) => l.roadId === 'R-DE');
      const pick = road.slice(2, 6);
      inc.lights = pick.map(({ l }) => l.id);
      pick.forEach(({ i }) => {
        const L = st.power.lights[i];
        L.status = 'fault'; L.detectedAt = now; L.repairAt = now + 8 * 3600000; L.wo = `WO-SL-${rng.int(4900, 4999)}`;
      });
      const m = STREET_LIGHTS.find((l) => l.id === inc.lights[1]);
      inc.x = m.x; inc.z = m.z;
      break;
    }
    case 'illegal-parking': {
      const plate = makePlate(rng);
      const v = { id: `PV-${String(g.vseq++).padStart(4, '0')}`, ts: now, kind: 'no-parking', plate, tenant: 'flipkart', truckId: null, where: `${FIRE_LANE.name} (fire lane)`, x: FIRE_LANE.x, z: FIRE_LANE.z, autoClearAt: null, camera: 'CAM-B2', incident: inc.id };
      g.violations.push(v);
      g.today.violations += 1;
      g.events.unshift({ kind: 'violation', ts: now, plate, tenant: 'flipkart', text: `Parked in fire lane — ${FIRE_LANE.name}`, id: v.id });
      inc.plate = plate;
      inc.violationId = v.id;
      break;
    }
    case 'water-shortage': {
      const w = st.water;
      w.level.SUMP = 250 * 0.08;
      w.level.AGT = 60 * 0.12;
      w.bw['BW-2'].tripped = true; w.bw['BW-2'].tripUntil = now + 5 * 3600000;
      w.bw['BW-1'].tripped = true; w.bw['BW-1'].tripUntil = now + 90 * 60000;
      w.tanker.orderedAt = now - 40 * 60000;
      w.tanker.enRouteEta = now + 95 * 60000;
      w.tanker.vehicle = 'KA 08 B 4471 (delayed)';
      w.events.unshift({ ts: now, kind: 'tanker', text: 'Tanker delayed by ~95 min (vendor breakdown) — sump at 8%' });
      break;
    }
    case 'grid-fire': {
      st.power.fire = { asset: 'TR-2', startedAt: now };
      st.power.dg.running = true;
      st.power.dg.runUntil = Infinity;
      st.power.events.unshift({ ts: now, kind: 'grid', severity: 'critical', text: 'TR-2 Buchholz & oil-temperature trip — fire detected at substation; TR-2 isolated' });
      st.safety.fire.panel.alarms.push({ zone: 11, text: 'Zone 11 — Substation: heat & smoke detectors in ALARM', ts: now, until: Infinity });
      st.safety.fire.mainPump = 'RUNNING (fire demand)';
      st.safety.events.unshift({ ts: now, kind: 'fire', severity: 'critical', text: 'FIRE ALARM — Substation (zone 11), TR-2 transformer' });
      break;
    }
    default: break;
  }
  st.incidents.unshift(inc);
  return inc;
}

export function resolveIncident(st, id, now) {
  const inc = st.incidents.find((i) => i.id === id && i.status === 'active');
  if (!inc) return;
  inc.status = 'resolved';
  inc.resolvedAt = now;
  const g = st.gate;
  switch (inc.type) {
    case 'gate-surge':
      g.surgeUntil = 0; g.holdLane2Until = 0;
      if (!g.lanes[1].open) { g.lanes[1].open = true; g.today.laneOpenings += 1; g.events.unshift({ kind: 'lane', ts: now, text: 'Entry lane 2 opened — surge response' }); }
      break;
    case 'light-outage':
      st.power.lights.forEach((L, i) => { if (inc.lights?.includes(STREET_LIGHTS[i].id)) { L.status = 'ok'; L.detectedAt = null; L.repairAt = null; L.wo = null; } });
      break;
    case 'illegal-parking':
      g.violations = g.violations.filter((v) => v.id !== inc.violationId);
      g.today.violationsResolved += 1;
      g.events.unshift({ kind: 'resolved', ts: now, plate: inc.plate, tenant: 'flipkart', text: 'Cleared: vehicle moved out of fire lane' });
      break;
    case 'water-shortage': {
      const w = st.water;
      w.level.SUMP = Math.min(250, w.level.SUMP + 20);
      w.today.tankerKl += 20; w.today.tankers += 2; w.today.cost += 20 * WATER.tankerCostPerKl;
      w.today.tankerLog.unshift({ ts: now, kl: 20, vehicle: 'Emergency tankers ×2' });
      w.tanker.enRouteEta = null; w.tanker.vehicle = null;
      w.events.unshift({ ts: now, kind: 'tanker', text: 'Two emergency tankers unloaded 20 KL' });
      break;
    }
    case 'grid-fire':
      st.power.fire = null;
      st.power.dg.running = false;
      st.power.dg.lastTestTs = now;
      st.safety.fire.panel.alarms = st.safety.fire.panel.alarms.filter((a) => a.zone !== 11);
      st.safety.fire.mainPump = 'AUTO · standby';
      st.power.events.unshift({ ts: now, kind: 'grid', text: 'Substation fire extinguished — TR-2 remains isolated for inspection' });
      st.power.tr2IsolatedUntil = now + 30 * 60000;
      break;
    default: break;
  }
}

/** Per-step effects of active incidents. */
export function stepIncidents(st, ctx) {
  const active = st.incidents.filter((i) => i.status === 'active');
  active.forEach((inc) => {
    if (inc.type === 'grid-fire') {
      // fire pumps draw from the fire reserve, ring pressure sags
      st.water.level.FIRE = Math.max(0, st.water.level.FIRE - 28 * (ctx.dt / 3600));
      st.safety.fire.pressureBar = 5.7 + ctx.rng() * 0.25;
    }
    if (inc.type === 'water-shortage' && st.water.level.SUMP / 250 > 0.4) resolveIncident(st, inc.id, ctx.now);
  });
  // keep the list bounded
  if (st.incidents.length > 20) st.incidents.length = 20;
}
