import { useNavigate } from 'react-router-dom';
import { X, ArrowUpRight, Sparkles } from 'lucide-react';
import { BUILDINGS, TENANT_BY_ID, PARKING_ZONES, STREET_LIGHTS, POWER, WATER, GATE } from '../config/malur';
import { useLive } from '../store/live';
import { useUi } from '../store/ui';
import { useTwin } from './store';
import { Meter, SevBadge, StatusDot } from '../components/ui';
import { fmt, pct, mins, ago } from '../lib/format';
import { fmtIstTime } from '../sim/util';
import CctvVideo from '../components/CctvVideo';
import { useWorkOrders } from '../store/workorders';
import { ClipboardPlus } from 'lucide-react';
import { CAMERAS } from '../config/malur';

const WO_CAT_BY_TYPE = { building: 'Housekeeping', parking: 'Parking', violation: 'Parking', gate: 'Gate & traffic', light: 'Street lighting', camera: 'CCTV & security', transformer: 'Electrical', incomer: 'Electrical', yard: 'Electrical', dg: 'Fire safety', tank: 'Water & plumbing', borewell: 'Water & plumbing', stp: 'Water & plumbing', fire: 'Fire safety', ev: 'EV fleet', fmo: 'Housekeeping', tenantHt: 'Electrical' };

function Row({ k, v, tone }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-line last:border-0 text-[12.5px]">
      <span className="text-muted">{k}</span>
      <span className={`font-semibold num text-right ${tone ? `text-${tone}` : 'text-fg'}`}>{v}</span>
    </div>
  );
}

function body(sel, s, advisories) {
  const { gate, water, power, safety } = s;
  switch (sel.type) {
    case 'building': {
      const b = BUILDINGS.find((x) => x.id === sel.id);
      const t = TENANT_BY_ID[b.tenant];
      const g = gate.tenants[b.tenant];
      const tr = t.power === 'TR-1' || t.power === 'TR-2' ? power.tr[t.power] : null;
      return {
        title: b.name, sub: `${t.name} · ${b.msf} MSFT`, route: '/park/malur/gate', adv: ['gate-queue', 'parking'],
        rows: [
          ['Tenant', t.name], ['Area', `${b.msf} MN sq ft`], ...(b.cells ? [['Cells', b.cells.map((c) => c.name).join(', ')]] : []),
          ['Dock doors (block)', b.docks], [`${t.name} trucks at docks`, `${g.dock} / ${g.docks}`], ['In dedicated bays', `${g.bayOcc} / ${g.bays}`],
          ['Queued at gate', g.queue], ['Entered / exited today', `${g.entries} / ${g.exits}`],
          ['Power supply', t.powerNote], ...(tr ? [[`${t.power} load`, `${fmt(tr.kva)} kVA · ${pct(tr.loadPct)}`]] : []),
        ],
        meter: { label: 'Dock utilisation', v: g.dock / g.docks },
      };
    }
    case 'parking': {
      const z = PARKING_ZONES.find((x) => x.id === sel.id);
      const g = z.tenant ? gate.tenants[z.tenant] : null;
      const v = gate.violations.filter((x) => x.where === z.name);
      return {
        title: z.name, sub: z.kind === 'truck' ? 'Dedicated truck parking' : 'Staff car parking', route: '/park/malur/gate', adv: ['parking'],
        rows: [['Bays', z.bays], ...(g ? [['Occupied', `${g.bayOcc} / ${g.bays}`], ['Wrong-bay vehicles here', v.length]] : [['Occupancy', 'Not instrumented']])],
        meter: g ? { label: 'Occupancy', v: g.bayOcc / g.bays } : null,
      };
    }
    case 'violation': {
      const v = gate.violations.find((x) => x.id === sel.id);
      if (!v) return { title: 'Violation cleared', rows: [] };
      return {
        title: `${v.id} · Parking violation`, sub: v.where, route: '/park/malur/gate', adv: ['parking'],
        rows: [['Vehicle', v.plate], ['Tenant', TENANT_BY_ID[v.tenant]?.name], ['Type', v.kind === 'wrong-bay' ? "Another tenant's bay" : v.kind === 'overflow' ? 'Overflow (bays full)' : 'No-parking zone'], ['Detected', `${fmtIstTime(v.ts)} by ${v.camera}`], ['Duration', ago(v.ts, s.ts).replace(' ago', '')]],
      };
    }
    case 'gate': return {
      title: 'Main Gate (G1)', sub: 'Malur–Whitefield Road', route: '/park/malur/gate', adv: ['gate-queue', 'gate-preintimation'],
      rows: [['Queue on public road', `${gate.queue} trucks · ${gate.queueMeters} m`], ['Entry lanes open', `${gate.lanesOpen} / ${GATE.maxEntryLanes}`], ['Est. wait (new arrival)', mins(gate.estWaitMin)], ['Being processed', gate.processing.map((p) => p.plate).join(', ') || '—'], ['Trucks inside', gate.insideTotal], ['Pre-intimated today', pct(gate.today.preRate)], ['Avg wait today', mins(gate.today.avgWaitMin)]],
    };
    case 'light': {
      const i = STREET_LIGHTS.findIndex((x) => x.id === sel.id);
      const l = power.lights[i];
      const meta = STREET_LIGHTS[i];
      const st = { ok: 'Healthy', fault: 'Lamp failure', flicker: 'Flickering', dayburn: 'Day-burning' }[l.status];
      return {
        title: `Street light ${l.id}`, sub: meta.road, route: '/park/malur/energy', adv: ['lights-fault', 'lights-dayburn'],
        rows: [['Status', st, l.status === 'ok' ? 'ok' : 'crit'], ['Output now', l.on ? 'ON' : 'OFF'], ['Rating', `${meta.watts} W LED`], ['Schedule', '18:00 – 06:15'], ...(l.detectedAt ? [['Detected', `${fmtIstTime(l.detectedAt)} (${ago(l.detectedAt, s.ts)})`], ['Work order', l.wo || '—'], ['Target repair', fmtIstTime(l.repairAt)]] : [])],
      };
    }
    case 'camera': {
      const c = safety.cams.find((x) => x.id === sel.id);
      return {
        title: c.id, sub: c.name, route: '/park/malur/safety', adv: ['cctv-offline'], video: c,
        rows: [['Status', c.status === 'online' ? 'Online' : c.status === 'degraded' ? 'Degraded' : 'Offline', c.status === 'online' ? 'ok' : 'crit'], ['Zone', c.zone], ['Type', c.type], ['Bitrate', `${fmt(c.bitrate, 1)} Mbps`], ['Since', ago(c.since, s.ts)], ['Analytics', c.type === 'ANPR-ready' ? 'ANPR-ready (not enabled)' : 'None (VMS only)']],
      };
    }
    case 'transformer': {
      const t = power.tr[sel.id];
      const meta = POWER.transformers.find((x) => x.id === sel.id);
      return {
        title: meta.name, sub: `Feeds ${meta.feedsLabel}`, route: '/park/malur/energy', adv: [`power-${sel.id}`],
        rows: [['Load', `${fmt(t.kva)} kVA`], ['Power factor', fmt(t.pf, 3)], ['Oil temperature', `${fmt(t.oilC)} °C`], ['Winding temperature', `${fmt(t.windC)} °C`], ['Energy today', `${fmt(power.today.kwh[sel.id])} kWh`], ['Peak today', `${fmt(power.today.peakKva[sel.id])} kVA`]],
        meter: { label: 'Loading', v: t.loadPct, warn: 0.85 },
      };
    }
    case 'incomer': case 'yard': return {
      title: '11 kV HT Incomer', sub: 'BESCOM supply · HIP substation', route: '/park/malur/energy', adv: ['power-outage', 'power-voltage'],
      rows: [['Voltage', power.grid.outage ? 'OUTAGE' : `${fmt(power.grid.kv, 2)} kV`, power.grid.outage ? 'crit' : null], ['Frequency', `${fmt(power.grid.hz, 2)} Hz`], ['Total HIP load', `${fmt(power.tr['TR-1'].kva + power.tr['TR-2'].kva + power.tr['TR-3'].kva)} kVA`], ['Last outage', ago(power.grid.lastOutageTs, s.ts)], ['Decathlon', 'Own HT connection']],
    };
    case 'dg': return {
      title: 'Fire Safety DG · 320 kVA', sub: 'Dedicated to fire pumps', route: '/park/malur/energy', adv: ['dg-fuel', 'dg-battery', 'dg-test'],
      rows: [['Mode', power.dg.running ? 'RUNNING (test)' : `${power.dg.mode} · standby`], ['Fuel', `${pct(power.dg.fuelPct)} · ${fmt(power.dg.fuelLitres)} L`], ['Autonomy', `${fmt(power.dg.autonomyH, 1)} h`], ['Battery', `${fmt(power.dg.batteryV, 1)} V`, power.dg.batteryV < 24.2 ? 'warn' : null], ['Last test', ago(power.dg.lastTestTs, s.ts)], ['Run hours', fmt(power.dg.runHours)]],
      meter: { label: 'Fuel', v: power.dg.fuelPct, low: true },
    };
    case 'tank': {
      const t = WATER.tanks.find((x) => x.id === sel.id);
      const l = water.levels[sel.id];
      return {
        title: t.name, sub: `${t.capKl} KL capacity`, route: '/park/malur/water', adv: t.kind === 'fire' ? ['fire-reserve'] : ['water-sump', 'water-external'],
        rows: [['Level', `${fmt(l.kl)} KL`], ['Use', t.kind === 'fire' ? 'Fire reserve (must stay full)' : t.kind === 'treated' ? 'STP treated water' : 'Domestic & flushing'], ...(t.id === 'SUMP' ? [['Tanker en route', water.tanker.enRouteEta ? `${water.tanker.vehicle} · ETA ${fmtIstTime(water.tanker.enRouteEta)}` : 'No'], ['Tankers today', water.today.tankers]] : [])],
        meter: { label: 'Fill level', v: l.pct, low: true },
      };
    }
    case 'borewell': {
      const b = water.borewells[sel.id];
      return {
        title: WATER.borewells.find((x) => x.id === sel.id).name, sub: `${sel.id}`, route: '/park/malur/water', adv: [`water-bw-${sel.id}`],
        rows: [['Pump', b.tripped ? 'TRIPPED (dry-run)' : b.running ? 'Running' : 'Idle', b.tripped ? 'crit' : b.running ? 'ok' : null], ['Yield today', `${fmt(b.klToday, 1)} KL`], ['Run hours today', fmt(b.runH, 1)], ['Water level', `${fmt(b.gwDepthM, 1)} m bgl`], ['Motor current', `${fmt(b.currentA, 1)} A`]],
      };
    }
    case 'stp': return { title: 'Sewage Treatment Plant', sub: `${WATER.stp.capacityKld} KLD`, route: '/park/malur/water', adv: ['water-external'], rows: [['Treated today', `${fmt(water.today.stpTreatedKl)} KL`], ['Reused (gardening)', `${fmt(water.today.stpReusedKl)} KL`], ['Reuse rate', pct(water.today.stpReuseRate)], ['Treated tank', pct(water.levels['STP-T'].pct)]] };
    case 'fire': return { title: 'Fire Pump House', sub: 'Jockey · Electric · Diesel', route: '/park/malur/safety', adv: ['fire-pressure', 'fire-jockey'], rows: [['Ring main pressure', `${fmt(safety.fire.pressureBar, 2)} bar`], ['Jockey pump', safety.fire.jockeyRunning ? 'Running' : 'Idle'], ['Jockey starts today', safety.today.jockeyStarts], ['Main pump', safety.fire.mainPump], ['Diesel pump', safety.fire.dieselPump], ['Fire reserve', pct(water.levels.FIRE.pct)]] };
    case 'ev': return { title: 'EV Buggy Charging Hub', sub: 'Opposite the FM office', route: '/park/malur/energy', adv: ['ev-low', 'ev-charger'], rows: [...power.chargers.map((c) => [c.id, c.status === 'charging' ? `Charging ${c.buggy}` : c.status]), ...power.buggies.map((b) => [b.id, `${b.state} · ${pct(b.soc)}`])] };
    case 'fmo': return { title: 'Facility Management Office', sub: 'HIP FM team', route: '/park/malur', adv: [], rows: [['Open advisories', advisories.length], ['Critical', advisories.filter((a) => a.severity === 'critical').length], ['EV hub', 'Opposite this office'], ['Buggies in service', power.buggies.filter((b) => b.state === 'service').length]] };
    case 'tenantHt': return { title: 'Decathlon HT Room', sub: 'Tenant-managed', route: '/park/malur/energy', adv: [], rows: [['Supply', 'Own HT connection & transformer'], ['HIP metering', 'Not in HIP scope']] };
    case 'incident': {
      const inc = (s.incidents || []).find((i) => i.id === sel.id);
      if (!inc) return { title: 'Incident closed', rows: [] };
      const cam = s.safety.cams.find((c) => c.id === inc.camera) || CAMERAS.find((c) => c.id === inc.camera);
      return {
        title: `${inc.id} · ${inc.status === 'active' ? 'ACTIVE' : 'RESOLVED'}`, sub: inc.title, route: '/park/malur/safety', adv: [`incident-${inc.type}`],
        incident: inc, video: cam,
        rows: [['Location', inc.location], ['Opened', `${fmtIstTime(inc.startedAt)} (${ago(inc.startedAt, s.ts)})`], ['Camera', inc.camera], ['Severity', 'Critical', 'crit']],
      };
    }
    default: return { title: sel.id, rows: [] };
  }
}

export default function Inspector() {
  const sel = useTwin((s) => s.selected);
  const select = useTwin((s) => s.select);
  const snapshot = useLive((s) => s.snapshot);
  const advisories = useLive((s) => s.advisories);
  const openAdvisory = useUi((s) => s.openAdvisory);
  const resolveIncident = useLive((s) => s.resolveIncident);
  const openCreate = useWorkOrders((s) => s.openCreate);
  const navigate = useNavigate();
  if (!sel || !snapshot) return null;
  const b = body(sel, snapshot, advisories);
  const related = advisories.filter((a) => (b.adv || []).includes(a.id));
  return (
    <div className="absolute top-3 right-3 bottom-20 w-[330px] card shadow-pop flex flex-col animate-slide-in z-30">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-line flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold leading-tight">{b.title}</div>
          {b.sub && <div className="text-[12px] text-faint mt-0.5">{b.sub}</div>}
        </div>
        <button type="button" className="icon-btn h-8 w-8 -mr-1" onClick={() => select(null)} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin px-4 py-2">
        {b.video && <CctvVideo cam={b.video} incidents={snapshot.incidents} ts={snapshot.ts} className="mt-1 mb-2" />}
        {b.incident && (
          <div className="rounded-lg border border-crit/30 bg-crit/5 px-3 py-2.5 my-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-crit mb-1">Response SOP</div>
            <p className="text-[12px] text-fg leading-relaxed">{b.incident.sop}</p>
            {b.incident.status === 'active' && (
              <button type="button" className="btn h-8 mt-2 w-full bg-crit text-white hover:brightness-110 text-[12px]" onClick={() => resolveIncident(b.incident.id)}>Mark incident resolved</button>
            )}
          </div>
        )}
        {b.meter && (
          <div className="py-2">
            <div className="flex justify-between text-[12px] mb-1"><span className="text-muted">{b.meter.label}</span><span className="font-semibold num">{pct(b.meter.v)}</span></div>
            <Meter value={b.meter.v} tone={b.meter.low ? (b.meter.v < 0.4 ? 'crit' : b.meter.v < 0.6 ? 'warn' : 'ok') : b.meter.v > (b.meter.warn || 0.85) ? 'warn' : 'brand'} />
          </div>
        )}
        {b.rows.map(([k, v, tone]) => <Row key={k} k={k} v={v} tone={tone} />)}
        {related.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="label-xs flex items-center gap-1"><Sparkles size={11} />AI advisory</div>
            {related.map((a) => (
              <button key={a.id} type="button" onClick={() => openAdvisory(a.id)} className="w-full text-left rounded-lg border border-line p-2.5 hover:bg-surface-3">
                <SevBadge severity={a.severity} />
                <div className="text-[12.5px] font-semibold mt-1.5 leading-snug">{a.title}</div>
                <div className="text-[11.5px] text-muted mt-1 line-clamp-3">{a.recommendation}</div>
              </button>
            ))}
          </div>
        )}
        {related.length === 0 && (b.adv || []).length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-ok"><StatusDot status="ok" />No active advisories for this asset</div>
        )}
      </div>
      <div className="p-3 border-t border-line grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary" onClick={() => openCreate({
          title: b.incident ? `Incident response — ${b.incident.title}` : `Inspect / repair — ${b.title}`,
          description: [b.sub, ...b.rows.slice(0, 4).map(([k, v]) => `${k}: ${typeof v === 'string' || typeof v === 'number' ? v : ''}`)].filter(Boolean).join(' · '),
          category: WO_CAT_BY_TYPE[sel.type] || 'Housekeeping', priority: b.incident ? 'P1' : 'P3', location: b.sub ? `${b.title} · ${b.sub}` : b.title,
          source: b.incident ? 'Incident' : 'Digital twin', sourceRef: b.incident?.id || null,
        })}><ClipboardPlus size={14} />Work order</button>
        {b.route ? <button type="button" className="btn-outline" onClick={() => navigate(b.route)}>Open module <ArrowUpRight size={14} /></button> : <span />}
      </div>
    </div>
  );
}

