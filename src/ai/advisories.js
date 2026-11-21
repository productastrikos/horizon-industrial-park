import { TENANTS, TENANT_BY_ID, WATER, POWER, CAMERAS, SITE } from '../config/malur';
import { PARKS } from '../config/parks';
import { truckProfile, cumulative } from '../sim/profiles';
import { fmtIstTime } from '../sim/util';
import { fmt, pct, inr, mins, plural } from '../lib/format';

/**
 * Rule-based "AI" advisory engine.
 *
 * Each rule inspects the live snapshot (+ 24 h history) and, when its
 * condition holds, emits an advisory with severity, a plain-English
 * situation summary built from live numbers, a recommended action, the
 * expected impact and a confidence score. The same engine produces the
 * one-line insight shown on every KPI card.
 */

const SEV_RANK = { critical: 0, warning: 1, opportunity: 2, info: 3 };
const DAILY_TRUCKS = TENANTS.reduce((a, t) => a + t.dailyTrucks, 0);
const PEAKS = [{ h: 8.6, name: 'Morning' }, { h: 18.6, name: 'Evening' }];

function nextPeak(h) {
  for (const p of PEAKS) if (p.h - h > -0.4 && p.h - h < 3) return { ...p, inMin: Math.max(0, (p.h - h) * 60) };
  return null;
}

function adv(o) {
  return { confidence: 0.85, evidence: [], ...o };
}

export function evaluateAdvisories(snap, history) {
  if (!snap) return [];
  const out = [];
  const { gate, water, power, safety, portfolio, clock, ts } = snap;
  const h = clock.h;

  /* ============================ ACTIVE INCIDENTS ========================== */
  (snap.incidents || []).filter((i) => i.status === 'active').forEach((inc) => {
    const L = water.levels;
    const summary = {
      'gate-surge': `${gate.queue} trucks (~${fmt(gate.queueMeters)} m) are backed up on ${SITE.publicRoad}; estimated wait ${mins(gate.estWaitMin)}. Entry lane 2 is ${gate.lane2Open ? 'open' : 'still closed'} and only ${pct(gate.today.preRate)} of trucks were pre-intimated.`,
      'light-outage': `${(inc.lights || []).length} consecutive poles (${(inc.lights || []).join(', ')}) are dark on Block D East Road — the main truck route to the Amazon docks. CCTV night visibility on this stretch is degraded.`,
      'illegal-parking': `Truck ${inc.plate} (Flipkart) has been standing in the fire access lane at the B–D junction for ${mins((ts - inc.startedAt) / 60000)}. It blocks fire-tender access to Block B and the substation.`,
      'water-shortage': `Domestic sump at ${pct(L.SUMP.pct)} and AGT at ${pct(L.AGT.pct)}; both borewells tripped and the tanker is delayed${water.tanker.enRouteEta ? ` until ${fmtIstTime(water.tanker.enRouteEta)}` : ''}. Washroom and canteen supply is at risk within ~${fmt(Math.max(0.3, (L.AGT.kl + L.SUMP.kl) / Math.max(1, water.flow.washroom + water.flow.domestic + water.flow.garden)), 1)} h.`,
      'grid-fire': `TR-2 tripped on Buchholz/oil temperature (${fmt(power.tr['TR-2'].oilC)} °C); Flipkart Block B has lost HIP supply. Fire pumps are running on the 320 kVA fire DG (fuel ${pct(power.dg.fuelPct)}); fire reserve at ${pct(L.FIRE.pct)}, ring main ${fmt(safety.fire.pressureBar, 1)} bar.`,
    }[inc.type];
    out.push(adv({
      id: `incident-${inc.type}`, kpi: inc.kpis[0], kpis: inc.kpis.slice(1), module: inc.module, route: '/park/malur/twin',
      severity: 'critical', incident: inc.id, since: inc.startedAt,
      title: `INCIDENT · ${inc.title}`,
      summary,
      recommendation: inc.sop,
      impact: inc.type === 'grid-fire' ? 'Contains the fire to the substation bay and protects adjacent blocks and the 11 kV supply.' : inc.type === 'water-shortage' ? 'Restores domestic supply before washrooms run dry.' : inc.type === 'gate-surge' ? 'Clears the public-road queue within ~30 min.' : 'Restores safe access and compliance.',
      confidence: 0.97,
      evidence: [`${inc.id} · opened ${fmtIstTime(inc.startedAt)} IST`, `Camera ${inc.camera}`, inc.location],
    }));
  });

  /* ============================ GATE & TRUCKS ============================ */
  const cap = gate.capacityPerHour;
  if (gate.queue >= 6) {
    const crit = gate.queue >= 15 || gate.queueMeters >= 250;
    const fasterWait = (gate.queue * 0.42 * 148 + gate.queue * 0.58 * 62) / Math.max(1, gate.lanesOpen + (gate.lane2Open ? 0 : 1)) / 60;
    const byT = TENANTS.map((t) => ({ t, n: gate.tenants[t.id].queue })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    out.push(adv({
      id: 'gate-queue', kpi: 'gate-queue', kpis: ['gate-road'], module: 'gate', route: '/park/malur/gate',
      severity: crit ? 'critical' : 'warning',
      title: `Truck queue spilling onto ${SITE.publicRoad}`,
      since: ts - gate.queueOldestMin * 60000,
      summary: `${gate.queue} trucks (~${fmt(gate.queueMeters)} m) are waiting outside Gate 1. Oldest has waited ${mins(gate.queueOldestMin)}; estimated wait for a new arrival is ${mins(gate.estWaitMin)}. Queue mix: ${byT.map((x) => `${x.t.name} ${x.n}`).join(', ')}.`,
      recommendation: gate.lane2Open
        ? 'Both entry lanes are open. Deploy a marshal on the public road to pull pre-intimated trucks into an express lane and ask tenant transport desks to hold dispatches for 20 min.'
        : 'Open entry lane 2 now and run an express check for pre-intimated trucks. Call Amazon & Flipkart transport desks to stagger arrivals for the next 30 min.',
      impact: `Estimated wait drops from ${mins(gate.estWaitMin)} to ~${mins(fasterWait)}; clears the public-road obstruction in ~${mins((gate.queue / (cap * 2)) * 60)}.`,
      confidence: 0.92,
      evidence: [`Gate capacity ${fmt(cap)} trucks/h with ${gate.lanesOpen} lane(s)`, `Pre-intimated today: ${pct(gate.today.preRate)}`, `Vision-AI: queue spill-over detected on CAM-G04`],
    }));
  }

  const peak = nextPeak(h);
  if (peak && !gate.lane2Open && gate.queue < 15) {
    const fArr = (DAILY_TRUCKS * truckProfile(peak.h)) / 24;
    const capOne = cap / Math.max(1, gate.lanesOpen);
    if (fArr > capOne * 0.95) {
      const growth = Math.max(0, fArr - capOne);
      out.push(adv({
        id: `gate-peak-${peak.name}`, kpi: 'gate-queue', module: 'gate', route: '/park/malur/gate',
        severity: peak.inMin > 5 ? 'warning' : 'critical',
        title: `${peak.name} truck peak ${peak.inMin > 5 ? `in ${mins(peak.inMin)}` : 'under way'} — single entry lane`,
        summary: `Forecast ${fmt(fArr)} arrivals/h at ${fmtIstTime(ts + peak.inMin * 60000)} against a single-lane capacity of ${fmt(capOne)}/h. Without action the queue grows by ~${fmt(growth)} trucks per hour onto the public road.`,
        recommendation: `Pre-open entry lane 2 by ${fmtIstTime(ts + Math.max(0, peak.inMin - 15) * 60000)} and request vehicle numbers / ETAs from tenant transport desks for the peak window.`,
        impact: `Doubles gate throughput to ~${fmt(capOne * 2)}/h and keeps the queue inside the site boundary.`,
        confidence: 0.81,
        evidence: ['Arrival forecast from 24 h profile and tenant schedules', `Today’s max queue so far: ${gate.today.queueMax}`],
      }));
    }
  }

  if (gate.today.entries > 20 && gate.today.preRate < 0.35) {
    const gain = (148 - 62) / 148;
    out.push(adv({
      id: 'gate-preintimation', kpi: 'pre-intimation', module: 'gate', route: '/park/malur/gate',
      severity: 'opportunity',
      title: `Only ${pct(gate.today.preRate)} of trucks were pre-intimated today`,
      summary: `${fmt(gate.today.entries - gate.today.pre)} of ${fmt(gate.today.entries)} trucks arrived without advance notice from Amazon/Flipkart/Decathlon, forcing manual verification (~2.5 min each) at the gate.`,
      recommendation: 'Introduce a mandatory pre-arrival slot booking (tenant portal / WhatsApp bot) feeding the gate; auto-verify using the ANPR-ready cameras CAM-G01/G02 already installed at Gate 1.',
      impact: `Cuts processing time per truck by ~${pct(gain)} (148 s → 62 s) and lifts gate capacity by ~${pct(148 / 62 - 1)} without new lanes.`,
      confidence: 0.88,
      evidence: [`Average gate wait today: ${mins(gate.today.avgWaitMin)}`, `Truck-hours lost on public road today: ${fmt(gate.today.roadTruckHours, 1)}`],
    }));
  }

  if (gate.today.entries > 10 && (gate.today.avgWaitMin > 10 || gate.today.maxWaitMin > 25)) {
    out.push(adv({
      id: 'gate-wait', kpi: 'gate-wait', kpis: ['gate-road'], module: 'gate', route: '/park/malur/gate',
      severity: gate.today.maxWaitMin > 40 ? 'warning' : 'info',
      title: `Gate dwell above SLA — worst wait ${mins(gate.today.maxWaitMin)} today`,
      summary: `Average entry wait today is ${mins(gate.today.avgWaitMin)} (target ≤ 10 min) with ${fmt(gate.today.roadTruckHours, 1)} truck-hours spent queuing on ${SITE.publicRoad}.`,
      recommendation: 'Share a daily gate-dwell report with tenant logistics leads and agree arrival windows for line-haul vehicles.',
      impact: 'Reduces community complaints and road-safety exposure outside the park.',
      confidence: 0.8,
    }));
  }

  /* ============================== PARKING =============================== */
  if (gate.violations.length) {
    const v = gate.violations;
    out.push(adv({
      id: 'parking-violations', kpi: 'parking', module: 'gate', route: '/park/malur/gate',
      severity: v.length >= 4 ? 'critical' : 'warning',
      title: `${plural(v.length, 'parking violation')} active`,
      since: Math.min(...v.map((x) => x.ts)),
      summary: v.slice(0, 3).map((x) => `${x.plate} (${TENANT_BY_ID[x.tenant]?.name}) — ${x.where}`).join('; ') + (v.length > 3 ? `; +${v.length - 3} more` : '') + '.',
      recommendation: 'Dispatch patrol to relocate vehicles to their tenant’s dedicated bay and notify the tenant transport lead with the photo evidence.',
      impact: 'Keeps fire lanes and tenant bays clear; prevents dock-access conflicts between tenants.',
      confidence: 0.9,
      evidence: v.slice(0, 3).map((x) => `${x.id} detected by ${x.camera}`),
    }));
  }
  TENANTS.forEach((t) => {
    const g = gate.tenants[t.id];
    if (g.bays && g.bayOcc / g.bays >= 0.85) {
      out.push(adv({
        id: `parking-full-${t.id}`, kpi: 'parking', module: 'gate', route: '/park/malur/gate',
        severity: 'warning',
        title: `${t.name} truck bays ${pct(g.bayOcc / g.bays)} full`,
        summary: `${g.bayOcc} of ${g.bays} dedicated bays occupied; ${g.queue} more ${t.name} trucks queued at the gate. Overflow will spill into other tenants’ bays.`,
        recommendation: `Ask ${t.name} to release docked trucks faster or hold inbound dispatches; temporarily allocate spare bays from the least-used zone.`,
        impact: 'Avoids cross-tenant parking conflicts.',
      }));
    }
  });

  /* =============================== WATER ================================ */
  const wt = water.today;
  const L = water.levels;
  if (wt.useKl > 15 && wt.externalShare > 0.6) {
    const bwIdle = Object.entries(water.borewells).filter(([, b]) => !b.running && !b.tripped).map(([k]) => k);
    const reuseGain = Math.max(0, (0.75 - wt.stpReuseRate) * (WATER.dailyDemandKl * 0.43 * 0.85 * 0.92));
    out.push(adv({
      id: 'water-external', kpi: 'water-external', kpis: ['water-tankers', 'water-stp'], module: 'water', route: '/park/malur/water',
      severity: wt.externalShare > 0.75 ? 'warning' : 'opportunity',
      title: `${pct(wt.externalShare)} of today’s water bought in by tanker`,
      summary: `${fmt(wt.tankerKl)} KL from ${plural(wt.tankers, 'tanker')} (${inr(wt.cost)}) vs ${fmt(wt.borewellKl, 1)} KL from the two borewells. STP reuse is only ${pct(wt.stpReuseRate)} of treated water.`,
      recommendation: `${bwIdle.length && L.SUMP.pct < 0.85 ? `Run ${bwIdle.join(' & ')} in the off-peak window; ` : ''}route STP-treated water to washroom flushing (dual plumbing) and drip-irrigate landscape at night.`,
      impact: `Can avoid ~${fmt(reuseGain)} KL/day ≈ ${inr(reuseGain * WATER.tankerCostPerKl * 30)}/month in tanker spend and cut external dependency toward the 50% target.`,
      confidence: 0.84,
      evidence: [`Daily demand ≈ ${WATER.dailyDemandKl} KL`, 'Survey: ~100 KL/day sourced externally (≈70%)'],
    }));
  }
  Object.entries(water.borewells).forEach(([id, b]) => {
    if (b.tripped) {
      out.push(adv({
        id: `water-bw-${id}`, kpi: 'water-borewell', kpis: ['water-external'], module: 'water', route: '/park/malur/water',
        severity: 'warning',
        title: `${id} pump tripped on dry-run protection`,
        summary: `Static water level at ${fmt(b.gwDepthM, 1)} m bgl. ${id} has produced ${fmt(b.klToday, 1)} KL today; each lost hour adds ~${fmt(id === 'BW-1' ? 2.4 : 1.8, 1)} KL of tanker demand.`,
        recommendation: `Allow aquifer recovery for 60–90 min, then reset ${id}; rotate pumping between borewells in shorter cycles.`,
        impact: 'Protects the pump motor and maximises sustainable yield.',
      }));
    }
  });
  if (L.SUMP.pct < 0.35) {
    out.push(adv({
      id: 'water-sump', kpi: 'water-today', module: 'water', route: '/park/malur/water',
      severity: L.SUMP.pct < 0.2 ? 'critical' : 'warning',
      title: `Domestic sump low — ${pct(L.SUMP.pct)} (${fmt(L.SUMP.kl)} KL)`,
      summary: water.tanker.enRouteEta ? `Tanker ${water.tanker.vehicle} expected at ${fmtIstTime(water.tanker.enRouteEta)}.` : 'No tanker currently en route.',
      recommendation: 'Confirm tanker dispatch and defer landscape irrigation until the sump recovers above 50%.',
      impact: 'Prevents washroom/canteen supply interruption.',
    }));
  }

  /* =============================== FIRE ================================= */
  const fire = L.FIRE;
  if (fire.pct < 0.95) {
    out.push(adv({
      id: 'fire-reserve', kpi: 'fire-reserve', module: 'fire', route: '/park/malur/safety',
      severity: fire.pct < 0.85 ? 'critical' : 'warning',
      title: `Fire water reserve at ${pct(fire.pct)} (${fmt(fire.kl)} KL)`,
      summary: 'The fire reserve must remain full at all times. Top-up from the domestic sump is in progress.',
      recommendation: 'Lock out any domestic draw-off from the fire tank, verify float valve, and inspect hydrant ring for leaks.',
      impact: 'Maintains fire-fighting autonomy as per NBC requirement.',
      confidence: 0.95,
    }));
  }
  if (safety.fire.pressureBar < 6.0) {
    out.push(adv({
      id: 'fire-pressure', kpi: 'fire-reserve', module: 'fire', route: '/park/malur/safety',
      severity: 'warning',
      title: `Hydrant ring pressure low — ${fmt(safety.fire.pressureBar, 2)} bar`,
      summary: 'Pressure is below the 6.4 bar jockey cut-in; the jockey pump should be running.',
      recommendation: 'Check jockey pump status and the pressure switch; walk the hydrant line for leaks.',
      impact: 'Ensures hydrant readiness.',
    }));
  }
  if (safety.today.jockeyStarts > 22) {
    out.push(adv({
      id: 'fire-jockey', kpi: 'fire-reserve', module: 'fire', route: '/park/malur/safety',
      severity: 'info',
      title: `Jockey pump started ${safety.today.jockeyStarts} times today`,
      summary: 'Frequent jockey cycling points to a slow leak in the hydrant ring main or a passing valve.',
      recommendation: 'Schedule a pressure-decay test section-by-section during the night shift.',
      impact: 'Avoids pump wear and water loss.',
      confidence: 0.7,
    }));
  }
  const pf = safety.fire.panel;
  if (pf.faults.length || pf.alarms.length) {
    out.push(adv({
      id: 'fire-panel', kpi: 'fire-panel', kpis: ['fire-reserve'], module: 'fire', route: '/park/malur/safety',
      severity: pf.alarms.length ? 'critical' : 'warning',
      title: pf.alarms.length ? 'Fire alarm panel — pre-alarm active' : `Fire alarm panel — ${plural(pf.faults.length, 'zone fault')}`,
      summary: [...pf.alarms, ...pf.faults].map((x) => x.text).join('; '),
      recommendation: pf.alarms.length ? 'Verify on CCTV and with the floor warden; reset the panel only after physical verification.' : 'Dispatch the fire technician to trace the open-circuit; the zone is not monitored until fixed.',
      impact: 'Restores full detection coverage.',
      confidence: 0.93,
    }));
  }

  /* =============================== POWER ================================ */
  if (power.grid.outage) {
    out.push(adv({
      id: 'power-outage', kpi: 'grid', kpis: ['tr-load', 'tr2', 'common-power'], module: 'power', route: '/park/malur/energy',
      severity: 'critical',
      title: '11 kV grid supply interrupted',
      summary: `All HIP transformers are de-energised. Common-area lighting, pumps and EV charging are down. Fire DG is in ${power.dg.mode} standby (${pct(power.dg.fuelPct)} fuel).`,
      recommendation: 'Inform tenants, confirm fire pump DG availability, and log the BESCOM complaint; check RMU protection relay flags.',
      impact: 'Faster restoration and tenant communication.',
      confidence: 0.98,
    }));
  } else if (power.grid.kv < 10.65) {
    out.push(adv({
      id: 'power-voltage', kpi: 'grid', kpis: ['tr-load'], module: 'power', route: '/park/malur/energy',
      severity: 'warning',
      title: `Incoming voltage low — ${fmt(power.grid.kv, 2)} kV`,
      summary: 'HT voltage is more than 3% below nominal 11 kV.',
      recommendation: 'Raise transformer tap position by one step if sustained for >30 min; inform BESCOM.',
      impact: 'Protects tenant motors and drives.',
    }));
  }
  ['TR-1', 'TR-2'].forEach((id) => {
    const t = power.tr[id];
    const meta = POWER.transformers.find((x) => x.id === id);
    if (t.isolated) return;
    if (t.loadPct > 0.85 || t.oilC > 80) {
      out.push(adv({
        id: `power-${id}`, kpi: id === 'TR-1' ? 'tr-load' : 'tr2', kpis: ['tr-load'], module: 'power', route: '/park/malur/energy',
        severity: t.loadPct > 0.95 || t.oilC > 88 ? 'critical' : 'warning',
        title: `${id} (${meta.feedsLabel}) at ${pct(t.loadPct)} load`,
        summary: `${fmt(t.kva)} kVA of ${meta.kva} kVA, oil ${fmt(t.oilC)} °C, winding ${fmt(t.windC)} °C.`,
        recommendation: `Ask ${meta.feedsLabel.split(' —')[0]} to stagger MHE charging and conveyor start-ups; verify radiator fans.`,
        impact: 'Avoids thermal overload trips during peak operations.',
      }));
    }
  });
  ['TR-1', 'TR-2', 'TR-3'].forEach((id) => {
    const t = power.tr[id];
    if (!power.grid.outage && t.pf < 0.92) {
      out.push(adv({
        id: `power-pf-${id}`, kpi: id === 'TR-1' ? 'tr-load' : id === 'TR-2' ? 'tr2' : 'common-power', module: 'power', route: '/park/malur/energy', severity: 'info',
        title: `${id} power factor ${fmt(t.pf, 2)}`, summary: 'Below the 0.95 utility incentive threshold.',
        recommendation: 'Check APFC panel steps / capacitor health.', impact: 'Avoids PF penalty on the HT bill.', confidence: 0.75,
      }));
    }
  });
  const dg = power.dg;
  if (dg.fuelPct < 0.6) {
    out.push(adv({
      id: 'dg-fuel', kpi: 'fire-dg', module: 'power', route: '/park/malur/energy',
      severity: dg.fuelPct < 0.4 ? 'critical' : 'warning',
      title: `Fire-safety DG fuel at ${pct(dg.fuelPct)}`,
      summary: `${fmt(dg.fuelLitres)} L in tank gives ~${fmt(dg.autonomyH, 1)} h of fire-pump operation at full load.`,
      recommendation: 'Schedule HSD refill to ≥ 90% this week; reconcile consumption with test-run logs.',
      impact: 'Guarantees fire-pump autonomy during a grid failure.',
      confidence: 0.9,
    }));
  }
  if (dg.batteryV < 24.2) {
    out.push(adv({
      id: 'dg-battery', kpi: 'fire-dg', module: 'power', route: '/park/malur/energy',
      severity: 'warning',
      title: `Fire DG starter battery weak — ${fmt(dg.batteryV, 1)} V`,
      summary: 'Cranking battery is below 24.2 V float; risk of failed auto-start.',
      recommendation: 'Check battery charger and electrolyte; replace if voltage does not recover after a boost charge.',
      impact: 'Prevents a failed DG start in an emergency.',
      confidence: 0.86,
    }));
  }
  const testAgeD = (ts - dg.lastTestTs) / 86400000;
  if (testAgeD > 7.5) {
    out.push(adv({
      id: 'dg-test', kpi: 'fire-dg', module: 'power', route: '/park/malur/energy', severity: 'info',
      title: `Fire DG test overdue (${fmt(testAgeD)} days)`, summary: 'Weekly no-load test not recorded.',
      recommendation: 'Run a 15-minute off-load test and log parameters.', impact: 'Compliance with fire-safety SOP.',
    }));
  }

  /* ============================= LIGHTING =============================== */
  const faulty = power.lights.filter((l) => l.status === 'fault' || l.status === 'flicker');
  if (faulty.length) {
    const byRoad = {};
    faulty.forEach((l) => { byRoad[l.road] = (byRoad[l.road] || 0) + 1; });
    const worst = Object.entries(byRoad).sort((a, b) => b[1] - a[1])[0];
    const night = h >= 18 || h < 6.25;
    out.push(adv({
      id: 'lights-fault', kpi: 'street-lights', module: 'lighting', route: '/park/malur/energy',
      severity: night && (faulty.length >= 4 || worst[1] >= 2) ? 'critical' : 'warning',
      title: `${plural(faulty.length, 'street light')} not working`,
      since: Math.min(...faulty.map((l) => l.detectedAt || ts)),
      summary: `${faulty.slice(0, 4).map((l) => `${l.id} (${l.road}, ${l.status === 'fault' ? 'lamp failure' : 'flicker'})`).join('; ')}${faulty.length > 4 ? '…' : ''}. ${worst[1] >= 2 ? `Dark stretch on ${worst[0]}.` : ''}`,
      recommendation: `Raise work orders and prioritise ${worst[0]}${night ? ' before the 22:00 security round' : ' before dusk (18:00)'}.`,
      impact: 'Restores lux levels on truck movement routes and CCTV night visibility.',
      confidence: 0.94,
      evidence: ['Detected from 0 A / unstable current while scheduled ON (smart-pole controller)'],
    }));
  }
  const dayburn = power.lights.filter((l) => l.status === 'dayburn');
  if (dayburn.length) {
    out.push(adv({
      id: 'lights-dayburn', kpi: 'street-lights', module: 'lighting', route: '/park/malur/energy',
      severity: 'opportunity',
      title: `${plural(dayburn.length, 'light')} burning in daylight`,
      summary: `${dayburn.map((l) => l.id).join(', ')} stay ON outside the 18:00–06:15 schedule (${fmt(power.today.wastedKwh, 1)} kWh wasted today).`,
      recommendation: 'Replace the photocell/timer on the affected feeder pillar.',
      impact: `≈ ${inr(dayburn.length * 0.15 * 12 * 30 * POWER.tariffPerKwh)}/month saving.`,
    }));
  }

  /* =============================== CCTV ================================= */
  const offline = safety.cams.filter((c) => c.status !== 'online');
  if (offline.length) {
    const gateCam = offline.some((c) => c.zone === 'Main gate');
    out.push(adv({
      id: 'cctv-offline', kpi: 'cctv-offline', kpis: ['cctv'], module: 'cctv', route: '/park/malur/safety',
      severity: gateCam || offline.length >= 4 ? 'critical' : 'warning',
      title: `${plural(offline.length, 'camera')} offline / degraded`,
      since: Math.min(...offline.map((c) => c.since || ts)),
      summary: `${offline.slice(0, 4).map((c) => `${c.id} (${c.name})`).join('; ')}. Blind spot${offline.length > 1 ? 's' : ''}: ${[...new Set(offline.map((c) => c.zone))].join(', ')}.`,
      recommendation: 'Check PoE switch port and camera power; assign the CCTV vendor ticket with 4-hour SLA.',
      impact: 'Restores surveillance coverage of perimeter and parking.',
      confidence: 0.92,
    }));
  }
  if (safety.nvr.retentionDays < safety.nvr.retentionTarget) {
    out.push(adv({
      id: 'cctv-retention', kpi: 'vms', module: 'cctv', route: '/park/malur/safety', severity: 'info',
      title: `VMS retention ${safety.nvr.retentionDays} days (target ${safety.nvr.retentionTarget})`,
      summary: `NVR storage ${pct(safety.nvr.storageUsedPct)} used${safety.nvr.diskFault ? '; 1 disk in degraded RAID' : ''}.`,
      recommendation: 'Enable motion-based recording on perimeter cameras or add 2 × 8 TB drives.',
      impact: 'Meets the 30-day retention requirement.',
    }));
  }
  out.push(adv({
    id: 'cctv-analytics', kpi: 'vision', kpis: ['cctv'], module: 'cctv', route: '/park/malur/safety', severity: 'opportunity',
    title: `VMS has no analytics — 0 of ${CAMERAS.length} cameras`,
    summary: `The Astrikos Vision-AI pilot layer flagged ${safety.today.visionEvents} events today (queue spill-over, wrong-bay parking, perimeter motion) that the current VMS cannot detect.`,
    recommendation: 'Enable ANPR on CAM-G01/G02 for automatic gate passes and parking-violation analytics on bay cameras.',
    impact: 'Automates gate verification and frees ~2 guards per shift for patrol.',
    confidence: 0.83,
  }));

  /* ================================ EV ================================== */
  const bugs = power.buggies;
  const lowInService = bugs.filter((b) => b.state === 'service' && b.soc < 0.3);
  const available = bugs.filter((b) => (b.state === 'idle' && b.soc > 0.45) || b.state === 'service').length;
  if (lowInService.length) {
    out.push(adv({
      id: 'ev-low', kpi: 'ev', module: 'ev', route: '/park/malur/energy', severity: 'warning',
      title: `${lowInService.map((b) => b.id).join(', ')} below 30% charge while in service`,
      summary: `${available} of ${bugs.length} buggies available. Charging hub opposite the FM office has ${power.chargers.filter((c) => c.status === 'available').length} free charger(s).`,
      recommendation: 'Recall the buggy to the hub and swap with a charged unit.',
      impact: 'Avoids a stranded buggy on the internal road.',
    }));
  }
  const chFault = power.chargers.filter((c) => c.status === 'fault');
  if (chFault.length) {
    out.push(adv({
      id: 'ev-charger', kpi: 'ev', module: 'ev', route: '/park/malur/energy', severity: 'info',
      title: `${chFault.map((c) => c.id).join(', ')} out of service`, summary: 'Ground-fault trip reported by the charger.',
      recommendation: 'Inspect the socket and RCCB; reset after insulation check.', impact: 'Restores charging capacity.',
    }));
  }

  /* ============================= PORTFOLIO ============================== */
  const critParks = portfolio.parks.filter((p) => p.alerts.critical > 0 && p.id !== 'malur');
  if (critParks.length) {
    out.push(adv({
      id: 'portfolio-critical', kpi: 'portfolio-alerts', module: 'portfolio', route: '/portfolio',
      severity: 'warning', scope: 'portfolio',
      title: `${plural(critParks.length, 'park')} reporting a critical alert`,
      summary: critParks.slice(0, 5).map((p) => PARKS.find((x) => x.id === p.id).name).join(', ') + '.',
      recommendation: 'Review with the regional FM leads in the daily stand-up.',
      impact: 'Portfolio-wide risk visibility.',
      confidence: 0.8,
    }));
  }

  return out.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
}

/* ------------------------------------------------------------------ */
/* KPI insight line — top advisory for the KPI, otherwise a nominal /   */
/* forecast insight.                                                    */
/* ------------------------------------------------------------------ */
export function kpiInsight(kpi, snap, advisories) {
  const top = advisories.find((a) => a.kpi === kpi) || advisories.find((a) => a.kpis?.includes(kpi));
  if (top) return { severity: top.severity, text: top.title, detail: top.recommendation, advisory: top };
  if (!snap) return null;
  const { gate, water, power, safety, clock, ts, portfolio } = snap;
  const h = clock.h;
  const expected = (DAILY_TRUCKS * cumulative(truckProfile, h)) / 24;
  const p = nextPeak(h) || { name: h < 8 ? 'Morning' : 'Evening', inMin: ((h < 8.6 ? 8.6 : h < 18.6 ? 18.6 : 32.6) - h) * 60 };
  const ok = (text, detail) => ({ severity: 'ok', text, detail });
  switch (kpi) {
    case 'trucks-today': {
      const dev = expected > 5 ? gate.today.entries / expected - 1 : 0;
      const eod = gate.today.entries + (DAILY_TRUCKS * (24 - cumulative(truckProfile, h))) / 24;
      return ok(`Tracking ${dev >= 0 ? '+' : ''}${pct(dev)} vs typical for ${fmtIstTime(ts)}; forecast ~${fmt(eod)} by midnight.`, 'Forecast from tenant arrival profiles.');
    }
    case 'gate-queue':
      return ok(`Gate clear. ${p.name} peak in ${mins(p.inMin)} — forecast ${fmt((DAILY_TRUCKS * truckProfile(p.name === 'Morning' ? 8.6 : 18.6)) / 24)} trucks/h.`, 'Pre-open lane 2 ahead of the peak.');
    case 'gate-wait':
      return ok(`Average entry wait ${mins(gate.today.avgWaitMin)} — within the 10 min SLA.`, null);
    case 'pre-intimation':
      return ok(`${pct(gate.today.preRate)} of trucks pre-intimated today.`, null);
    case 'parking':
      return ok('All trucks parked in their tenant’s dedicated bays.', null);
    case 'water-today': {
      const plan = (WATER.dailyDemandKl * h) / 24;
      return ok(`${fmt(water.today.useKl)} KL used — ${water.today.useKl > plan ? 'above' : 'within'} the pro-rata plan of ${fmt(plan)} KL.`, null);
    }
    case 'water-external':
      return ok(`External share ${pct(water.today.externalShare)} — borewells supplied ${fmt(water.today.borewellKl, 1)} KL.`, null);
    case 'fire-reserve':
      return ok(`Reserve full (${pct(water.levels.FIRE.pct)}), ring main ${fmt(safety.fire.pressureBar, 1)} bar — fire system ready.`, null);
    case 'tr-load': {
      const hi = Math.max(power.tr['TR-1'].loadPct, power.tr['TR-2'].loadPct);
      return ok(`Peak transformer loading ${pct(hi)} — ${pct(1 - hi)} headroom for tenant growth.`, null);
    }
    case 'common-power':
      return ok(`Common area drawing ${fmt(power.common.totalKw)} kW; street lighting ${fmt(power.common.street, 1)} kW.`, null);
    case 'fire-dg':
      return ok(`DG in AUTO standby; ${fmt(power.dg.autonomyH, 1)} h fire-pump autonomy.`, null);
    case 'street-lights':
      return ok(`All ${power.lightStats.total} lights healthy.`, null);
    case 'cctv':
      return ok(`All cameras streaming to VMS.`, null);
    case 'ev':
      return ok(`${power.buggies.filter((b) => b.state === 'service').length} buggies in service; fleet SoC healthy.`, null);
    case 'gate-road':
      return ok(`No trucks on the public road right now; ${fmt(gate.today.roadTruckHours, 1)} truck-hours queued outside today.`, null);
    case 'water-tankers': {
      const left = Math.max(0, (WATER.dailyDemandKl * 0.7 * Math.max(0, 21.5 - h)) / 24 / WATER.tankerKl);
      return ok(`${plural(water.today.tankers, 'tanker')} so far; ~${fmt(left)} more expected before 21:30 at the current draw.`, null);
    }
    case 'water-borewell': {
      const st = (b) => (b.tripped ? 'tripped' : b.running ? 'running' : 'idle');
      return ok(`Borewells healthy — BW-1 ${st(water.borewells['BW-1'])}, BW-2 ${st(water.borewells['BW-2'])}.`, null);
    }
    case 'water-stp':
      return ok(`STP treated ${fmt(water.today.stpTreatedKl)} KL today; ${pct(water.today.stpReuseRate)} reused for landscape.`, null);
    case 'grid':
      return ok(`Supply stable at ${fmt(power.grid.kv, 2)} kV; last interruption ${Math.round((ts - power.grid.lastOutageTs) / 86400000)} days ago.`, null);
    case 'tr2':
      return ok(`TR-2 at ${pct(power.tr['TR-2'].loadPct)} — ${pct(1 - power.tr['TR-2'].loadPct)} headroom.`, null);
    case 'cctv-offline':
      return ok('All cameras streaming — no blind spots.', null);
    case 'vms':
      return ok(`Retention meets the ${safety.nvr.retentionTarget}-day target.`, null);
    case 'vision':
      return ok(`${safety.today.visionEvents} detections today across queue, parking and perimeter.`, null);
    case 'fire-panel':
      return ok(`All ${safety.fire.panel.zones} detection zones normal.`, null);
    case 'exec-parks':
      return ok(`${portfolio.totals.operational} sites operational and ${portfolio.totals.construction} under construction; Malur is streaming full live telemetry.`, null);
    case 'exec-potential': {
      const built = PARKS.filter((x) => x.type === 'ILP' && x.status === 'operational').reduce((a, x) => a + x.msf, 0);
      return ok(`${fmt(built, 1)} MSFT sits in operational parks; ${fmt(53.8 - built, 1)} MSFT is pipeline capacity for built-to-suit demand.`, null);
    }
    case 'exec-occupancy': {
      const low = portfolio.parks.filter((p) => PARKS.find((x) => x.id === p.id).status === 'operational' && p.occupancy < 0.88).map((p) => PARKS.find((x) => x.id === p.id).name);
      return { severity: low.length > 3 ? 'warning' : 'ok', text: `Occupancy ${pct(portfolio.totals.occupancy)}; ${low.length ? `${low.slice(0, 3).join(', ')} below 88% — prioritise leasing there.` : 'all operational parks above 88%.'}`, detail: 'Focus leasing teams on the lowest-occupancy operational parks.' };
    }
    case 'exec-wait': {
      const worst = [...portfolio.parks].filter((p) => p.waitMin > 0).sort((a, b) => b.waitMin - a.waitMin)[0];
      const name = worst ? (worst.id === 'malur' ? 'HIP Malur' : PARKS.find((x) => x.id === worst.id).name) : '—';
      return { severity: worst && worst.waitMin > 12 ? 'warning' : 'ok', text: `Network gate wait ${mins(portfolio.totals.avgWaitMin)}; longest at ${name} (${mins(worst?.waitMin)}).`, detail: 'Roll out tenant pre-intimation and ANPR at the slowest gates first.' };
    }
    case 'exec-energy':
      return ok(`${fmt(portfolio.totals.kwhToday / 1000, 1)} MWh today across HIP-metered feeders — in line with the daily profile.`, null);
    case 'exec-water':
      return { severity: water.today.externalShare > 0.6 ? 'warning' : 'ok', text: `${fmt(portfolio.totals.klToday)} KL used across parks; Malur is ${pct(water.today.externalShare)} tanker-dependent.`, detail: 'Replicate STP-reuse for flushing across water-stressed parks.' };
    case 'exec-health': {
      const weakest = [...portfolio.parks].sort((a, b) => a.health - b.health).slice(0, 2).map((p) => (p.id === 'malur' ? 'HIP Malur' : PARKS.find((x) => x.id === p.id).name));
      return { severity: portfolio.totals.avgHealth < 80 ? 'warning' : 'ok', text: `Network health ${Math.round(portfolio.totals.avgHealth)}/100; weakest: ${weakest.join(', ')}.`, detail: 'Review the weakest parks in the daily FM stand-up.' };
    }
    case 'exec-green':
      return ok(`${portfolio.totals.green} parks IGBC Platinum certified; Horizon is the 2026 GRESB Global Sector Leader (5-star).`, null);
    case 'portfolio-alerts':
      return ok(`${portfolio.totals.critical} critical and ${portfolio.totals.warning} warning alerts across the network.`, null);
    case 'portfolio-trucks':
      return ok(`${fmt(portfolio.totals.trucksToday)} trucks handled across the network today.`, null);
    default:
      return null;
  }
}
