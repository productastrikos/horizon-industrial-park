import { SITE, TENANTS, TENANT_BY_ID, BUILDINGS, POWER, WATER, CAMERAS, STREET_LIGHTS, EV, PARKING_ZONES } from '../config/malur';
import { PARKS, CLUSTERS, PORTFOLIO_FACTS, STATES } from '../config/parks';
import { fmtIstTime } from '../sim/util';
import { fmt, pct, inr, mins, plural } from '../lib/format';
import { useWorkOrders, slaState } from '../store/workorders';

/**
 * HIP Assist — rule-based retrieval-augmented assistant.
 *
 * 1. Builds a knowledge base: static facility documents + live documents
 *    regenerated from the current telemetry snapshot + active advisories.
 * 2. Retrieves the most relevant documents with BM25.
 * 3. Answers with an intent template that reads live values, and cites the
 *    retrieved documents as sources.
 */

const STOP = new Set('a an the is are was were be been of to in on at for and or by with what which who how many much do does did i me my we our you your it its this that these those there here any all can could should would please show tell give list about from as now today currently current right'.split(' '));

export function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => w.replace(/(ings|ing|ies|es|s)$/, (m) => (m === 'ies' ? 'y' : '')));
}

/* ----------------------------------------------------------- knowledge */
const STATIC_DOCS = [
  { id: 'site', title: 'HIP Malur — site profile', text: `${SITE.fullName} is on ${SITE.address}. ${SITE.acres} acres, development potential ${SITE.potentialMsf} MN sq ft, ${SITE.igbc}. Pre-engineered buildings with ${SITE.eavesHeightM} m eaves height, ${SITE.apronM} m concrete truck apron and ${SITE.roadWidthM} m wide internal roads. Distances: ${SITE.connectivity.map((c) => `${c.name} ${c.km} km`).join(', ')}.`, route: '/park/malur' },
  { id: 'blocks', title: 'Buildings, blocks and warehouses', text: `The park has ${BUILDINGS.length} warehouse blocks: ${BUILDINGS.map((b) => `${b.name} ${b.msf} MSFT (${TENANT_BY_ID[b.tenant].name})`).join('; ')}. Block A1 has cells 1 & 2, 3 and 4; Block A2 has cells 5 & 6 and 7; Block A3 has cells 9 & 10. Total ≈ 1.9 MN sq ft.`, route: '/park/malur/twin' },
  { id: 'tenants', title: 'Tenants', text: `Major tenants: Amazon (Block D), Flipkart (Block B), Decathlon (Block A1), plus other tenants in Blocks A2, A3 and E. HIP does facility management for the park — gate, trucks, water, power, lighting, CCTV and fire safety — not the tenants' warehouse operations.`, route: '/park/malur' },
  { id: 'power', title: 'Electrical network', text: `11 kV HT incomer from BESCOM feeds the HIP substation. ${POWER.transformers.map((t) => `${t.name} feeds ${t.feedsLabel}`).join('; ')}. The two 750 kVA transformers support only Flipkart and Amazon; Decathlon has its own HT connection and transformer. A ${POWER.fireDg.kva} kVA diesel generator is dedicated to fire safety (fire pumps). Tariff ₹${POWER.tariffPerKwh}/kWh.`, route: '/park/malur/energy' },
  { id: 'water', title: 'Water sources and uses', text: `Daily consumption ≈ ${WATER.dailyDemandKl} KL for domestic use, gardening and washrooms. About 100 KL/day is bought in from outside by tanker — roughly 70% of consumption is from external sources. Two borewells (BW-1 ${WATER.borewells[0].yieldKlh} KL/h, BW-2 ${WATER.borewells[1].yieldKlh} KL/h) supplement supply. Tanks: ${WATER.tanks.map((t) => `${t.name} ${t.capKl} KL`).join(', ')}. A ${WATER.stp.capacityKld} KLD STP treats grey water for reuse in gardening. Tanker cost ≈ ₹${WATER.tankerCostPerKl}/KL.`, route: '/park/malur/water' },
  { id: 'fire', title: 'Fire safety', text: `Fire water reserve ${WATER.tanks.find((t) => t.id === 'FIRE').capKl} KL kept full; hydrant ring with jockey pump (cut-in 6.4 bar), main electric pump and diesel pump; ${POWER.fireDg.kva} kVA fire-safety DG. Buildings have fire detection, alarms, K160/K80 sprinklers and external hydrants. Fire alarm panel monitors 18 zones.`, route: '/park/malur/safety' },
  { id: 'gate', title: 'Gate & truck entry SOP', text: 'Main gate on the Malur–Whitefield Road has one entry and one exit lane (a second entry lane can be opened). Trucks belong to Amazon, Flipkart and Decathlon; HIP security is often not informed in advance, so drivers are verified manually (≈2.5 min per truck vs ≈1 min when pre-intimated). At the morning (≈07:30–10:00) and evening (≈17:30–20:00) peaks, trucks line up along the public road. Each tenant has its own dedicated truck parking; vehicles must not park anywhere else.', route: '/park/malur/gate' },
  { id: 'parking', title: 'Dedicated parking zones', text: `${PARKING_ZONES.map((z) => `${z.name} (${z.bays} bays)`).join('; ')}. No-parking zones include the gate road shoulder, Block D East Road and junctions — violations are flagged by the Vision-AI layer.`, route: '/park/malur/gate' },
  { id: 'cctv', title: 'CCTV / VMS', text: `${CAMERAS.length} cameras (gate, perimeter, buildings, parking, utilities) record to a VMS with 30-day retention target. The current VMS has no video analytics; gate cameras CAM-G01/G02 are ANPR-ready. The Astrikos Vision-AI pilot layer detects queue spill-over, wrong-bay parking, perimeter motion and PPE.`, route: '/park/malur/safety' },
  { id: 'lights', title: 'Street lighting', text: `${STREET_LIGHTS.length} LED street lights (90–150 W) along internal roads, scheduled ON 18:00–06:15. Faults are detected from current draw: 0 A while scheduled ON = lamp failure; unstable current = flicker; ON in daylight = timer/photocell fault (day-burning).`, route: '/park/malur/energy' },
  { id: 'ev', title: 'Electric buggies & charging', text: `${EV.buggies.length} electric buggies serve internal movement. The charging hub with ${EV.chargers.length} chargers is at the entrance, opposite the Facility Management Office.`, route: '/park/malur/energy' },
  { id: 'portfolio', title: 'Horizon portfolio', text: `Horizon Industrial Parks (Blackstone-sponsored, ${PORTFOLIO_FACTS.listing}) operates ${PORTFOLIO_FACTS.ilpCount} industrial & logistics parks (${PORTFOLIO_FACTS.ilpPotentialMsf} MSFT potential) and ${PORTFOLIO_FACTS.incityCount} InCity centers (${PORTFOLIO_FACTS.incityPotentialMsf} MSFT) across ${Object.keys(CLUSTERS).length} markets: ${Object.values(CLUSTERS).map((c) => c.name).join(', ')}.`, route: '/portfolio' },
];

function liveDocs(snap, advisories) {
  if (!snap) return [];
  const { gate, water, power, safety } = snap;
  const docs = [
    { id: 'live-gate', title: 'Live — gate & trucks', text: `Queue ${gate.queue} trucks (${gate.queueMeters} m), estimated wait ${mins(gate.estWaitMin)}, ${gate.lanesOpen} entry lane(s) open. Today: ${gate.today.entries} trucks entered, ${gate.today.exits} exited, ${gate.insideTotal} inside, pre-intimation ${pct(gate.today.preRate)}, average wait ${mins(gate.today.avgWaitMin)}.`, route: '/park/malur/gate', live: true },
    { id: 'live-parking', title: 'Live — parking compliance', text: `${gate.violations.length} active parking violations. ${TENANTS.map((t) => `${t.name} bays ${gate.tenants[t.id].bayOcc}/${gate.tenants[t.id].bays}`).join(', ')}.`, route: '/park/malur/gate', live: true },
    { id: 'live-water', title: 'Live — water', text: `Used ${fmt(water.today.useKl)} KL today; tanker ${fmt(water.today.tankerKl)} KL, borewell ${fmt(water.today.borewellKl, 1)} KL, external ${pct(water.today.externalShare)}. Sump ${pct(water.levels.SUMP.pct)}, AGT ${pct(water.levels.AGT.pct)}, fire reserve ${pct(water.levels.FIRE.pct)}.`, route: '/park/malur/water', live: true },
    { id: 'live-power', title: 'Live — power', text: `11 kV at ${fmt(power.grid.kv, 2)} kV. TR-1 ${pct(power.tr['TR-1'].loadPct)}, TR-2 ${pct(power.tr['TR-2'].loadPct)}, TR-3 ${pct(power.tr['TR-3'].loadPct)}. Fire DG fuel ${pct(power.dg.fuelPct)}.`, route: '/park/malur/energy', live: true },
    { id: 'live-safety', title: 'Live — CCTV & fire', text: `${safety.camStats.online}/${safety.camStats.total} cameras online. Hydrant pressure ${fmt(safety.fire.pressureBar, 1)} bar.`, route: '/park/malur/safety', live: true },
  ];
  advisories.slice(0, 12).forEach((a) => docs.push({ id: `adv-${a.id}`, title: `Advisory — ${a.title}`, text: `${a.summary} ${a.recommendation}`, route: a.route, live: true }));
  return docs;
}

function bm25(query, docs) {
  const q = tokenize(query);
  if (!q.length) return [];
  const toks = docs.map((d) => tokenize(`${d.title} ${d.title} ${d.text}`));
  const avg = toks.reduce((a, t) => a + t.length, 0) / Math.max(1, toks.length);
  const df = {};
  toks.forEach((t) => new Set(t).forEach((w) => { df[w] = (df[w] || 0) + 1; }));
  const N = docs.length;
  return docs
    .map((d, i) => {
      const tf = {};
      toks[i].forEach((w) => { tf[w] = (tf[w] || 0) + 1; });
      let score = 0;
      q.forEach((w) => {
        if (!tf[w]) return;
        const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
        score += idf * ((tf[w] * 2.2) / (tf[w] + 1.2 * (0.25 + 0.75 * (toks[i].length / avg))));
      });
      return { doc: d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

/* -------------------------------------------------------------- intents */
const has = (q, ...words) => words.some((w) => q.includes(w));

function tenantIn(q) { return TENANTS.find((t) => q.includes(t.id) || q.includes(t.name.toLowerCase())); }
function parkIn(q) { return PARKS.find((p) => q.includes(p.name.toLowerCase())); }

const INTENTS = [
  {
    id: 'greet', test: (q) => /^\s*(hi|hello|hey|good (morning|evening|afternoon))\b/.test(q),
    answer: () => 'Hello! I’m HIP Assist. Ask me about trucks at the gate, parking, water, power, street lights, CCTV, fire safety, EV buggies — or any park in the Horizon portfolio.',
  },
  {
    id: 'help', test: (q) => has(q, 'help', 'what can you'),
    answer: () => 'I can answer live questions about HIP Malur (gate queue, trucks today, tenant parking, water sources & tanks, transformers, fire DG, street-light faults, CCTV uptime, buggies) and portfolio questions (parks per city, area, status). I also explain active advisories.',
  },
  {
    id: 'incident', test: (q) => has(q, 'incident', 'emergency', 'fire incident', 'shortage', 'any fire', 'safety incident', 'what happened'),
    answer: (s) => {
      const act = (s.incidents || []).filter((i) => i.status === 'active');
      if (!act.length) return 'No active incidents at HIP Malur right now. Fire system, water and gate are within normal limits.';
      const lines = act.map((i, n) => `${n + 1}. **${i.title}** — ${i.location} (since ${fmtIstTime(i.startedAt)}). SOP: ${i.sop}`);
      return `**${plural(act.length, 'active incident')}** at HIP Malur:\n${lines.join('\n')}`;
    },
  },
  {
    id: 'workorders', test: (q) => has(q, 'work order', 'workorder', 'ticket', ' wo ', ' wos', 'complaint', 'technician'),
    answer: (s) => {
      const list = useWorkOrders.getState().list;
      const open = list.filter((w) => !['Resolved', 'Closed'].includes(w.status));
      const overdue = open.filter((w) => slaState(w, s.ts) === 'overdue');
      const done = list.filter((w) => w.resolvedAt);
      const sla = done.length ? done.filter((w) => w.resolvedAt <= w.dueAt).length / done.length : 1;
      const top = [...open].sort((a, b) => a.priority.localeCompare(b.priority)).slice(0, 4);
      const lines = top.map((w, i) => `${i + 1}. **${w.id}** ${w.priority} · ${w.title} — ${w.status}${w.assignee ? `, ${w.assignee}` : ''}`);
      return `**${open.length} open work orders** (${overdue.length} overdue), SLA compliance ${pct(sla)}.\n${lines.join('\n')}`;
    },
  },
  {
    id: 'summary', test: (q) => has(q, 'summary', 'summarise', 'summarize', 'overview', 'brief me', 'how is malur', 'status of the park', 'how is the park'),
    answer: (s, q, adv) => {
      const g = s.gate; const w = s.water; const p = s.power; const sf = s.safety;
      const act = (s.incidents || []).filter((i) => i.status === 'active');
      const crit = adv.filter((a) => a.severity === 'critical').length;
      return `**HIP Malur — executive summary (${fmtIstTime(s.ts)} IST)**
• Gate: ${g.today.entries} trucks in, ${g.queue} queued, avg wait ${mins(g.today.avgWaitMin)}.
• Water: ${fmt(w.today.useKl)} KL used, ${pct(w.today.externalShare)} external, sump ${pct(w.levels.SUMP.pct)}.
• Power: TR-1 ${pct(p.tr['TR-1'].loadPct)}, TR-2 ${p.tr['TR-2'].isolated ? 'ISOLATED' : pct(p.tr['TR-2'].loadPct)}; ${p.lightStats.faulty} street lights faulty.
• Safety: ${sf.camStats.online}/${sf.camStats.total} cameras online, fire reserve ${pct(w.levels.FIRE.pct)}.
• ${act.length ? `**${plural(act.length, 'active incident')}**: ${act.map((i) => i.title).join('; ')}.` : 'No active incidents.'} ${crit} critical advisories open.`;
    },
  },
  {
    id: 'queue', test: (q) => has(q, 'queue', 'waiting', 'line up', 'lined', 'congestion', 'road block', 'wait time'),
    answer: (s) => {
      const g = s.gate;
      return g.queue
        ? `**${g.queue} trucks** (~${g.queueMeters} m) are queued outside Gate 1 on the Malur–Whitefield Road. Estimated wait for a new arrival is **${mins(g.estWaitMin)}** with ${g.lanesOpen} entry lane(s) open; the oldest truck has waited ${mins(g.queueOldestMin)}. Today’s average entry wait is ${mins(g.today.avgWaitMin)} (max ${mins(g.today.maxWaitMin)}).`
        : `The gate is clear — no trucks waiting. Today’s average entry wait is ${mins(g.today.avgWaitMin)} and the longest queue was ${g.today.queueMax} trucks.`;
    },
  },
  {
    id: 'parking', test: (q) => has(q, 'park ', 'parking', 'parked', 'bay', 'violation'),
    answer: (s) => {
      const g = s.gate;
      const v = g.violations;
      return `${v.length ? `**${plural(v.length, 'active violation')}**: ${v.map((x) => `${x.plate} (${TENANT_BY_ID[x.tenant]?.name}) at ${x.where}`).join('; ')}.` : 'No active parking violations — all trucks are in their tenant’s dedicated bays.'} Bay occupancy: ${TENANTS.map((t) => `${t.name} ${g.tenants[t.id].bayOcc}/${g.tenants[t.id].bays}`).join(', ')}. ${g.today.violations} violations flagged today.`;
    },
  },
  {
    id: 'trucks', test: (q) => has(q, 'truck', 'vehicle', 'entry', 'entries', 'entered', 'exit', 'gate'),
    answer: (s, q) => {
      const g = s.gate;
      const t = tenantIn(q);
      if (t) {
        const x = g.tenants[t.id];
        return `**${t.name}** today: ${x.arrivals} arrivals, ${x.entries} entered, ${x.exits} exited. Right now ${x.dock} at docks, ${x.bay} in their dedicated bays (${x.bayOcc}/${x.bays} occupied), ${x.queue} queued at the gate${x.violation ? `, ${x.violation} in violation` : ''}.`;
      }
      return `Today **${fmt(g.today.entries)} trucks entered** and ${fmt(g.today.exits)} exited; ${g.insideTotal} are inside the park now. By tenant: ${TENANTS.map((tt) => `${tt.name} ${g.tenants[tt.id].entries}`).join(', ')}. Only ${pct(g.today.preRate)} were pre-intimated by tenants.`;
    },
  },
  {
    id: 'fire', test: (q) => has(q, 'fire', 'hydrant', 'sprinkler', 'jockey', 'alarm panel', ' dg', 'diesel', 'generator'),
    answer: (s) => {
      const f = s.safety.fire;
      const dg = s.power.dg;
      return `Fire reserve **${pct(s.water.levels.FIRE.pct)}** (${fmt(s.water.levels.FIRE.kl)} KL). Hydrant ring ${fmt(f.pressureBar, 2)} bar; jockey pump ${f.jockeyRunning ? 'running' : 'idle'} (${s.safety.today.jockeyStarts} starts today). Panel: ${f.panel.normal}/${f.panel.zones} zones normal. **Fire DG 320 kVA**: ${dg.running ? 'RUNNING (test)' : 'AUTO standby'}, fuel ${pct(dg.fuelPct)} (~${fmt(dg.autonomyH, 1)} h autonomy), battery ${fmt(dg.batteryV, 1)} V.`;
    },
  },
  {
    id: 'water', test: (q) => has(q, 'water', 'tanker', 'borewell', 'bore well', 'sump', 'tank', 'stp', 'garden', 'washroom', 'consumption'),
    answer: (s) => {
      const w = s.water;
      return `Today **${fmt(w.today.useKl)} KL** consumed — washrooms ${fmt(w.today.use.washroom)} KL, domestic ${fmt(w.today.use.domestic)} KL, gardening ${fmt(w.today.use.garden)} KL. Supply: ${plural(w.today.tankers, 'tanker')} (${fmt(w.today.tankerKl)} KL, ${inr(w.today.cost)}) and borewells ${fmt(w.today.borewellKl, 1)} KL → **${pct(w.today.externalShare)} external**. BW-1 ${w.borewells['BW-1'].tripped ? 'tripped' : w.borewells['BW-1'].running ? 'running' : 'idle'}, BW-2 ${w.borewells['BW-2'].tripped ? 'tripped' : w.borewells['BW-2'].running ? 'running' : 'idle'}. Tanks: sump ${pct(w.levels.SUMP.pct)}, AGT ${pct(w.levels.AGT.pct)}, fire ${pct(w.levels.FIRE.pct)}.`;
    },
  },
  {
    id: 'lights', test: (q) => has(q, 'light', 'lamp', 'dark', 'pole'),
    answer: (s) => {
      const p = s.power;
      const bad = p.lights.filter((l) => l.status !== 'ok');
      return `${p.lightStats.working}/${p.lightStats.total} street lights healthy (${p.lightStats.on} ON now). ${bad.length ? `Not working: ${bad.map((l) => `**${l.id}** on ${l.road} (${l.status === 'fault' ? 'lamp failure' : l.status === 'flicker' ? 'flicker' : 'day-burning'}${l.wo ? `, ${l.wo}` : ''})`).join('; ')}.` : 'No faults detected.'}`;
    },
  },
  {
    id: 'power', test: (q) => has(q, 'power', 'electric', 'transformer', 'kva', ' kv', 'load', 'energy', 'grid', 'bescom', 'kwh'),
    answer: (s) => {
      const p = s.power;
      return `11 kV incomer at **${fmt(p.grid.kv, 2)} kV**${p.grid.outage ? ' — **OUTAGE in progress**' : ''}. TR-1 (Amazon) ${fmt(p.tr['TR-1'].kva)} kVA = ${pct(p.tr['TR-1'].loadPct)}; TR-2 (Flipkart) ${fmt(p.tr['TR-2'].kva)} kVA = ${pct(p.tr['TR-2'].loadPct)}; TR-3 (common area, 350 kVA) ${pct(p.tr['TR-3'].loadPct)}. Decathlon runs on its own HT connection. Energy today ${fmt(p.today.totalKwh)} kWh across HIP transformers.`;
    },
  },
  {
    id: 'cctv', test: (q) => has(q, 'cctv', 'camera', 'vms', 'surveillance', 'video', 'anpr'),
    answer: (s) => {
      const c = s.safety;
      const off = c.cams.filter((x) => x.status !== 'online');
      return `**${c.camStats.online}/${c.camStats.total} cameras online** (${pct(c.camStats.uptime)}). ${off.length ? `Offline/degraded: ${off.map((x) => `${x.id} (${x.name})`).join('; ')}.` : ''} VMS retention ${c.nvr.retentionDays}/${c.nvr.retentionTarget} days, storage ${pct(c.nvr.storageUsedPct)}. The VMS has no analytics today; Vision-AI pilot flagged ${c.today.visionEvents} events.`;
    },
  },
  {
    id: 'ev', test: (q) => has(q, 'buggy', 'buggies', ' ev ', ' ev?', 'charging', 'charger'),
    answer: (s) => {
      const p = s.power;
      return `Buggies: ${p.buggies.map((b) => `${b.id} ${b.state === 'service' ? 'in service' : b.state} ${pct(b.soc)}`).join(', ')}. Charging hub (opposite FM office): ${p.chargers.map((c) => `${c.id} ${c.status}`).join(', ')}.`;
    },
  },
  {
    id: 'advice', test: (q) => has(q, 'advis', 'recommend', 'risk', 'issue', 'problem', 'priority', 'attention', 'alert'),
    answer: (s, q, adv) => (adv.length
      ? `Top priorities right now:\n${adv.slice(0, 4).map((a, i) => `${i + 1}. **${a.title}** — ${a.recommendation}`).join('\n')}`
      : 'No active advisories — all systems nominal.'),
  },
  {
    id: 'portfolio', test: (q) => has(q, 'portfolio', 'how many park', 'parks', 'incity', 'in-city', 'location', 'cities', 'network', 'state') || !!parkIn(q) || STATES.some((x) => q.includes(x.toLowerCase())),
    answer: (s, q) => {
      const st = STATES.find((x) => q.includes(x.toLowerCase()));
      if (st && !parkIn(q)) {
        const list = PARKS.filter((x) => x.state === st);
        const ilp = list.filter((x) => x.type === 'ILP');
        const live = s.portfolio.parks.filter((x) => list.some((p) => p.id === x.id));
        return `**${st}**: ${plural(ilp.length, 'Industrial & Logistics park')} (${ilp.map((x) => (x.id === 'malur' ? 'Malur' : x.name)).join(', ') || '—'}) and ${plural(list.length - ilp.length, 'InCity center')}. Development potential ${fmt(ilp.reduce((a, x) => a + x.msf, 0), 1)} MN sq ft. Trucks today across the state: ${fmt(live.reduce((a, x) => a + x.trucksToday, 0))}; ${live.reduce((a, x) => a + x.alerts.critical, 0)} critical alerts.`;
      }
      const p = parkIn(q);
      if (p) {
        const live = s.portfolio.parks.find((x) => x.id === p.id);
        return `**${p.name}** (${CLUSTERS[p.cluster].name}, ${p.type === 'ILP' ? 'Industrial & Logistics Park' : 'InCity Center'})${p.acres ? ` — ${p.acres} acres, ${p.msf} MN sq ft potential` : ''}, ${p.status === 'operational' ? 'operational' : 'under construction'}${p.igbc ? `, ${p.igbc}` : ''}. Live: ${live.trucksToday} trucks today, health score ${fmt(live.health)}, ${live.alerts.critical} critical / ${live.alerts.warning} warning alerts.`;
      }
      const byCluster = Object.values(CLUSTERS).map((c) => ({ c, n: PARKS.filter((x) => x.cluster === c.id && x.type === 'ILP').length })).filter((x) => x.n);
      return `Horizon operates **${PORTFOLIO_FACTS.ilpCount} Industrial & Logistics Parks** (${PORTFOLIO_FACTS.ilpPotentialMsf} MSFT potential) and **${PORTFOLIO_FACTS.incityCount} InCity Centers** (${PORTFOLIO_FACTS.incityPotentialMsf} MSFT). By market: ${byCluster.map((x) => `${x.c.name} ${x.n}`).join(', ')}. Portfolio trucks today: ${fmt(s.portfolio.totals.trucksToday)}.`;
    },
  },
  {
    id: 'site', test: (q) => has(q, 'malur', 'acre', 'area', 'block', 'building', 'warehouse', 'tenant', 'amazon', 'flipkart', 'decathlon', 'where', 'address'),
    answer: (s, q) => {
      const t = tenantIn(q);
      if (t) {
        const bl = BUILDINGS.filter((b) => b.tenant === t.id);
        return `**${t.name}** occupies ${bl.map((b) => `${b.name} (${b.msf} MSFT)`).join(', ')} with ${t.docks} docks and ${t.truckBays} dedicated truck bays. Power: ${t.powerNote}.`;
      }
      return `${SITE.fullName} — ${SITE.address}. ${SITE.acres} acres, ${SITE.potentialMsf} MN sq ft across ${BUILDINGS.map((b) => `${b.name} (${b.msf})`).join(', ')}. ${SITE.igbc}.`;
    },
  },
];

export function answer(question, snap, advisories) {
  const q = ` ${question.toLowerCase().trim()} `;
  const docs = [...STATIC_DOCS, ...liveDocs(snap, advisories)];
  const hits = bm25(question, docs).slice(0, 3);
  const intent = snap ? INTENTS.find((it) => it.test(q)) : null;
  let text;
  if (intent) text = intent.answer(snap, q, advisories);
  else if (hits.length) text = `${hits[0].doc.text}`;
  else text = 'I couldn’t find that in the HIP knowledge base. Try asking about trucks, parking, water, power, street lights, CCTV, fire safety, buggies or a park name.';
  const sources = (hits.length ? hits : []).slice(0, intent ? 2 : 3).map((h) => ({ id: h.doc.id, title: h.doc.title, route: h.doc.route, live: !!h.doc.live }));
  return { text, sources, intent: intent?.id || 'retrieval', at: snap ? fmtIstTime(snap.ts) : '' };
}

export const SUGGESTIONS = [
  'Give me an executive summary of Malur',
  'Are there any active incidents?',
  'What are the top risks right now?',
  'How many trucks are waiting at the gate?',
  'Any trucks parked in undesignated areas?',
  'Which street lights are not working?',
  'How much water came from tankers today?',
  'Is the fire DG ready?',
  'What is the transformer load for Amazon and Flipkart?',
  'Which cameras are offline?',
  'How many parks does Horizon have in Karnataka?',
  'How are the EV buggies doing?',
  'How many work orders are open or overdue?',
];
