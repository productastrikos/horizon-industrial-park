import { create } from 'zustand';
import { mulberry32 } from '../sim/util';
import { useLive } from './live';
import { STREET_LIGHTS, CAMERAS } from '../config/malur';

/**
 * Work-order management for HIP Malur facility management.
 * - Seeded with two weeks of realistic history.
 * - Auto-raises work orders from live sensor faults (street lights, CCTV)
 *   and incidents, and closes them when the condition clears.
 * - The simulated FM team assigns and progresses auto work orders.
 * - User-created / edited work orders persist in this browser.
 */

export const WO_STATUSES = ['Open', 'Assigned', 'In progress', 'On hold', 'Resolved', 'Closed'];
export const WO_CATEGORIES = ['Gate & traffic', 'Parking', 'Water & plumbing', 'Electrical', 'Street lighting', 'CCTV & security', 'Fire safety', 'EV fleet', 'Housekeeping', 'Civil & landscaping'];
export const WO_PRIORITIES = [
  { id: 'P1', label: 'P1 · Critical', slaH: 4 },
  { id: 'P2', label: 'P2 · High', slaH: 8 },
  { id: 'P3', label: 'P3 · Medium', slaH: 24 },
  { id: 'P4', label: 'P4 · Low', slaH: 72 },
];
export const SLA_H = Object.fromEntries(WO_PRIORITIES.map((p) => [p.id, p.slaH]));
export const FM_TEAM = [
  { name: 'Ravi Kumar', role: 'FM Supervisor', cats: ['Gate & traffic', 'Parking', 'Housekeeping'] },
  { name: 'Suresh Gowda', role: 'Electrical technician', cats: ['Electrical', 'Street lighting', 'EV fleet'] },
  { name: 'Manjunath R', role: 'Plumbing technician', cats: ['Water & plumbing'] },
  { name: 'Imran Pasha', role: 'Security supervisor', cats: ['CCTV & security', 'Parking', 'Gate & traffic'] },
  { name: 'Lakshmi N', role: 'Fire & safety officer', cats: ['Fire safety'] },
  { name: 'Deepak S', role: 'CCTV vendor engineer', cats: ['CCTV & security'] },
  { name: 'Arjun Shetty', role: 'Landscaping & civil lead', cats: ['Civil & landscaping'] },
];
export const LOCATIONS = ['Main gate (G1)', 'Gate road', 'Public road (Malur–Whitefield)', 'Block A1 · Decathlon', 'Block A2', 'Block A3', 'Block B · Flipkart', 'Block D · Amazon', 'Block E', 'Truck parking — Amazon', 'Truck parking — Flipkart', 'Truck parking — Decathlon', 'Truck parking — Others', '11 kV substation', 'Water & fire zone', 'STP', 'FM office', 'EV charging hub', 'Perimeter', 'Internal roads'];

export const MODULE_CATEGORY = { gate: 'Gate & traffic', water: 'Water & plumbing', fire: 'Fire safety', power: 'Electrical', lighting: 'Street lighting', cctv: 'CCTV & security', ev: 'EV fleet', portfolio: 'Housekeeping' };
export const SEV_PRIORITY = { critical: 'P1', warning: 'P2', opportunity: 'P3', info: 'P4' };
const INCIDENT_LOC = { 'gate-surge': 'Main gate (G1)', 'light-outage': 'Internal roads', 'illegal-parking': 'Truck parking — Flipkart', 'water-shortage': 'Water & fire zone', 'grid-fire': '11 kV substation' };
const INCIDENT_CAT = { 'gate-surge': 'Gate & traffic', 'light-outage': 'Street lighting', 'illegal-parking': 'Parking', 'water-shortage': 'Water & plumbing', 'grid-fire': 'Fire safety' };

const KEY = 'hip-workorders-v1';
const H = 3600000;
const owner = (cat, r) => { const c = FM_TEAM.filter((m) => m.cats.includes(cat)); return (c.length ? c[Math.floor(r() * c.length)] : FM_TEAM[0]).name; };

const SEED_TEMPLATES = [
  ['Boom barrier arm not lifting fully — entry lane 1', 'Gate & traffic', 'Main gate (G1)', 'P2'],
  ['Replace faded lane markings at gate road', 'Civil & landscaping', 'Gate road', 'P4'],
  ['Transfer pump making abnormal noise', 'Water & plumbing', 'Water & fire zone', 'P2'],
  ['Washroom tap leakage — FM office', 'Water & plumbing', 'FM office', 'P3'],
  ['TR-1 radiator fan inspection', 'Electrical', '11 kV substation', 'P3'],
  ['APFC panel capacitor step failure', 'Electrical', '11 kV substation', 'P2'],
  ['Hydrant valve gland leak near Block D', 'Fire safety', 'Block D · Amazon', 'P2'],
  ['Monthly fire extinguisher inspection — Block B', 'Fire safety', 'Block B · Flipkart', 'P3'],
  ['Camera lens cleaning — perimeter cameras', 'CCTV & security', 'Perimeter', 'P4'],
  ['NVR disk replacement (RAID degraded)', 'CCTV & security', 'FM office', 'P2'],
  ['EV buggy EB-04 brake adjustment', 'EV fleet', 'EV charging hub', 'P3'],
  ['Charger CH-3 RCCB tripping', 'EV fleet', 'EV charging hub', 'P2'],
  ['Truck parked in Decathlon bay — relocate', 'Parking', 'Truck parking — Decathlon', 'P3'],
  ['Repaint truck bay numbering — Amazon zone', 'Parking', 'Truck parking — Amazon', 'P4'],
  ['Landscape irrigation line burst', 'Civil & landscaping', 'Perimeter', 'P2'],
  ['Pothole repair — A-cluster south road', 'Civil & landscaping', 'Internal roads', 'P3'],
  ['Housekeeping — driver rest area', 'Housekeeping', 'Gate road', 'P4'],
  ['STP blower maintenance', 'Water & plumbing', 'STP', 'P3'],
  ['Street light pole SL-018 tilted after truck hit', 'Street lighting', 'Internal roads', 'P2'],
  ['Fire DG weekly test record', 'Fire safety', 'Water & fire zone', 'P3'],
  ['Perimeter wall crack near railway side', 'Civil & landscaping', 'Perimeter', 'P3'],
  ['Security cabin AC not cooling', 'Housekeeping', 'Main gate (G1)', 'P4'],
  ['Speed breaker reflective paint — gate road', 'Gate & traffic', 'Gate road', 'P4'],
  ['Borewell BW-2 dry-run relay check', 'Water & plumbing', 'Water & fire zone', 'P2'],
  ['ANPR camera alignment — CAM-G01', 'CCTV & security', 'Main gate (G1)', 'P3'],
  ['Tanker unloading bay hose replacement', 'Water & plumbing', 'Water & fire zone', 'P4'],
];

function seedOrders(now) {
  const r = mulberry32(Math.floor(now / 86400000) * 13 + 5);
  return SEED_TEMPLATES.map(([title, category, location, priority], i) => {
    const createdAt = now - r() * 14 * 24 * H - 2 * H;
    const age = (now - createdAt) / H;
    const sla = SLA_H[priority];
    let status = 'Closed';
    if (age < 2) status = r() < 0.5 ? 'Open' : 'Assigned';
    else if (age < 30) status = ['Assigned', 'In progress', 'In progress', 'On hold', 'Resolved'][Math.floor(r() * 5)];
    else status = r() < 0.12 ? 'Resolved' : 'Closed';
    const assignee = status === 'Open' ? null : owner(category, r);
    const resolvedAt = ['Resolved', 'Closed'].includes(status) ? createdAt + Math.min(age, sla * (0.3 + r() * 1.1)) * H : null;
    const log = [{ ts: createdAt, by: 'Ravi Kumar', text: 'Work order raised' }];
    if (assignee) log.push({ ts: createdAt + 0.3 * H, by: 'Ravi Kumar', text: `Assigned to ${assignee}` });
    if (status === 'In progress' || resolvedAt) log.push({ ts: createdAt + 0.8 * H, by: assignee, text: 'Work started on site' });
    if (status === 'On hold') log.push({ ts: createdAt + 2 * H, by: assignee, text: 'On hold — awaiting spare part from vendor' });
    if (resolvedAt) log.push({ ts: resolvedAt, by: assignee, text: 'Resolved — verified working' });
    if (status === 'Closed') log.push({ ts: resolvedAt + 2 * H, by: 'Ravi Kumar', text: 'Closed after supervisor verification' });
    return { id: `WO-${24100 + i}`, title, description: '', category, priority, location, assignee, status, source: 'Manual', createdAt, dueAt: createdAt + sla * H, resolvedAt, updatedAt: log[log.length - 1].ts, log, auto: true };
  });
}

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const v = JSON.parse(raw); if (Array.isArray(v.list)) return v; } } catch { /* storage unavailable */ }
  return null;
}
function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify({ list: state.list.slice(0, 400), seq: state.seq })); } catch { /* storage unavailable */ }
}
const simNow = () => useLive.getState().snapshot?.ts || Date.now();

export const useWorkOrders = create((set, get) => ({
  list: [],
  seq: 24300,
  ready: false,
  draft: null, // prefill for the create dialog
  selectedId: null,

  init() {
    if (get().ready) return;
    const saved = load();
    const now = simNow();
    set(saved ? { list: saved.list, seq: saved.seq || 24300, ready: true } : { list: seedOrders(now), ready: true });
    useLive.subscribe((s) => { if (s.snapshot) get().sync(s.snapshot); });
  },

  openCreate(prefill = {}) { set({ draft: { ...prefill } }); },
  closeCreate() { set({ draft: null }); },
  select(id) { set({ selectedId: id }); },

  create(fields) {
    const now = simNow();
    const seq = get().seq + 1;
    const priority = fields.priority || 'P3';
    const wo = {
      id: `WO-${seq}`, title: fields.title, description: fields.description || '', category: fields.category || 'Housekeeping',
      priority, location: fields.location || '', assignee: fields.assignee || null, status: fields.assignee ? 'Assigned' : 'Open',
      source: fields.source || 'Manual', sourceRef: fields.sourceRef || null, createdAt: now, dueAt: fields.dueAt || now + SLA_H[priority] * H,
      resolvedAt: null, updatedAt: now, auto: !!fields.auto,
      log: [{ ts: now, by: fields.by || 'Admin', text: `Work order raised${fields.source && fields.source !== 'Manual' ? ` from ${fields.source}` : ''}` }, ...(fields.assignee ? [{ ts: now, by: fields.by || 'Admin', text: `Assigned to ${fields.assignee}` }] : [])],
    };
    set((s) => ({ list: [wo, ...s.list], seq }));
    save(get());
    return wo;
  },

  update(id, patch, note, by = 'Admin') {
    const now = simNow();
    set((s) => ({
      list: s.list.map((w) => {
        if (w.id !== id) return w;
        const next = { ...w, ...patch, updatedAt: now };
        if (patch.status && ['Resolved', 'Closed'].includes(patch.status) && !w.resolvedAt) next.resolvedAt = now;
        if (patch.status && !['Resolved', 'Closed'].includes(patch.status)) next.resolvedAt = null;
        const text = note || (patch.status ? `Status → ${patch.status}` : patch.assignee ? `Assigned to ${patch.assignee}` : 'Updated');
        next.log = [...w.log, { ts: now, by, text }];
        return next;
      }),
    }));
    save(get());
    const w = get().list.find((x) => x.id === id);
    // closing an incident work order closes the incident
    if (w?.sourceRef?.startsWith?.('INC-') && ['Resolved', 'Closed'].includes(patch.status)) useLive.getState().resolveIncident(w.sourceRef);
  },

  comment(id, text, by = 'Admin') {
    const now = simNow();
    set((s) => ({ list: s.list.map((w) => (w.id === id ? { ...w, updatedAt: now, log: [...w.log, { ts: now, by, text }] } : w)) }));
    save(get());
  },

  /** Reconcile with live telemetry: auto-raise / auto-close and progress the FM team's queue. */
  sync(snap) {
    const now = snap.ts;
    const state = get();
    let list = state.list;
    let seq = state.seq;
    let changed = false;
    const open = (w) => !['Resolved', 'Closed'].includes(w.status);
    const byRef = new Map(list.filter(open).map((w) => [w.sourceRef, w]));
    const add = (wo) => { seq += 1; list = [{ id: `WO-${seq}`, createdAt: now, updatedAt: now, resolvedAt: null, auto: true, description: '', ...wo, log: [{ ts: now, by: 'Sia', text: `Auto-raised from ${wo.source}` }] }, ...list]; changed = true; };
    const closeRef = (ref, text) => {
      list = list.map((w) => (w.sourceRef === ref && open(w) ? { ...w, status: 'Resolved', resolvedAt: now, updatedAt: now, log: [...w.log, { ts: now, by: w.assignee || 'FM team', text }] } : w));
      changed = true;
    };

    // incidents
    (snap.incidents || []).forEach((inc) => {
      if (inc.status === 'active' && !byRef.has(inc.id)) {
        add({ title: `Incident response — ${inc.title}`, description: inc.sop, category: INCIDENT_CAT[inc.type], priority: 'P1', location: INCIDENT_LOC[inc.type], assignee: owner(INCIDENT_CAT[inc.type], Math.random), status: 'Assigned', source: 'Incident', sourceRef: inc.id, dueAt: now + 4 * H });
      } else if (inc.status === 'resolved' && byRef.has(inc.id)) closeRef(inc.id, 'Incident resolved — closing response work order');
    });
    // street lights
    snap.power.lights.forEach((l, i) => {
      const ref = `LIGHT:${l.id}`;
      if (l.status !== 'ok' && !byRef.has(ref)) add({ title: `${l.id} ${l.status === 'fault' ? 'lamp failure' : l.status === 'flicker' ? 'flickering' : 'day-burning'} — ${STREET_LIGHTS[i].road}`, category: 'Street lighting', priority: l.status === 'dayburn' ? 'P4' : 'P3', location: 'Internal roads', assignee: 'Suresh Gowda', status: 'Assigned', source: 'Sensor fault', sourceRef: ref, dueAt: now + 24 * H });
      else if (l.status === 'ok' && byRef.has(ref)) closeRef(ref, 'Lamp replaced — current draw normal');
    });
    // cameras
    snap.safety.cams.forEach((c) => {
      const ref = `CAM:${c.id}`;
      const meta = CAMERAS.find((x) => x.id === c.id);
      if (c.status !== 'online' && !byRef.has(ref)) add({ title: `${c.id} ${c.status === 'offline' ? 'video loss' : 'degraded stream'} — ${meta?.name}`, category: 'CCTV & security', priority: c.zone === 'Main gate' ? 'P1' : 'P2', location: c.zone === 'Main gate' ? 'Main gate (G1)' : c.zone === 'Perimeter' ? 'Perimeter' : 'FM office', assignee: 'Deepak S', status: 'Assigned', source: 'Sensor fault', sourceRef: ref, dueAt: now + 4 * H });
      else if (c.status === 'online' && byRef.has(ref)) closeRef(ref, 'Stream restored to VMS');
    });
    // simulated FM progress for auto work orders
    list = list.map((w) => {
      if (!w.auto || !open(w)) return w;
      const age = (now - w.updatedAt) / 60000;
      if (w.status === 'Open' && age > 6) { changed = true; const a = owner(w.category, Math.random); return { ...w, status: 'Assigned', assignee: a, updatedAt: now, log: [...w.log, { ts: now, by: 'Ravi Kumar', text: `Assigned to ${a}` }] }; }
      if (w.status === 'Assigned' && age > 12 && w.source !== 'Sensor fault') { changed = true; return { ...w, status: 'In progress', updatedAt: now, log: [...w.log, { ts: now, by: w.assignee, text: 'Work started on site' }] }; }
      return w;
    });
    if (changed) { set({ list, seq }); save(get()); }
  },
}));

export function slaState(w, now) {
  if (['Resolved', 'Closed'].includes(w.status)) return (w.resolvedAt || now) <= w.dueAt ? 'met' : 'breached';
  const left = w.dueAt - now;
  if (left < 0) return 'overdue';
  if (left < 0.25 * SLA_H[w.priority] * H) return 'due-soon';
  return 'on-track';
}
