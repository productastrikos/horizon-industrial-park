import { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { ListOrdered, Timer, Truck, BadgeCheck, ParkingCircle, Route, DoorOpen, Bell, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useLive } from '../store/live';
import { TENANTS, TENANT_BY_ID, PARKING_ZONES } from '../config/malur';
import { truckProfile } from '../sim/profiles';
import { fmtIstTime } from '../sim/util';
import { KpiCard, Card, Loading, ChartTooltip, Meter, seriesColor, Tabs } from '../components/ui';
import EventFeed from '../components/EventFeed';
import { useKpi } from './Command';
import { labelFor } from '../sim/models/gate';
import CctvVideo from '../components/CctvVideo';
import { fmt, pct, mins, ago } from '../lib/format';

const sevTone = (i) => (i?.severity === 'critical' ? 'critical' : i?.severity === 'warning' ? 'warning' : undefined);
const DAILY = TENANTS.reduce((a, t) => a + t.dailyTrucks, 0);

function TenantChip({ id }) {
  const t = TENANT_BY_ID[id];
  if (!t) return null;
  return <span className="chip" style={{ background: `rgb(var(--${t.slot}) / .12)`, color: `rgb(var(--${t.slot}))` }}>{t.name}</span>;
}

function GateDiagram({ gate }) {
  const lanes = [
    { id: 1, label: 'Entry lane 1', open: true, cur: gate.processing.find((p) => p.lane === 1) },
    { id: 2, label: 'Entry lane 2', open: gate.lane2Open, cur: gate.processing.find((p) => p.lane === 2) },
  ];
  return (
    <div className="space-y-2">
      {lanes.map((l) => (
        <div key={l.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${l.open ? 'border-line bg-surface-2' : 'border-dashed border-line bg-surface'}`}>
          <DoorOpen size={16} className={l.open ? 'text-ok' : 'text-faint'} />
          <div className="flex-1">
            <div className="text-[12.5px] font-semibold">{l.label}</div>
            <div className="text-[11.5px] text-faint">{l.open ? (l.cur ? <>Verifying <span className="num text-fg">{l.cur.plate}</span></> : 'Idle — ready') : 'Closed'}</div>
          </div>
          {l.cur && <TenantChip id={l.cur.tenant} />}
          <span className={`chip ${l.open ? 'bg-ok/10 text-ok' : 'bg-surface-3 text-faint'}`}>{l.open ? 'OPEN' : 'CLOSED'}</span>
        </div>
      ))}
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
        <DoorOpen size={16} className="text-info rotate-180" />
        <div className="flex-1"><div className="text-[12.5px] font-semibold">Exit lane</div><div className="text-[11.5px] text-faint">{gate.exitQueue} truck(s) waiting to exit</div></div>
        <span className="chip bg-ok/10 text-ok">OPEN</span>
      </div>
    </div>
  );
}

function WhatIf({ gate }) {
  const [pre, setPre] = useState(Math.round(gate.today.preRate * 100));
  const [lanes, setLanes] = useState(1);
  const r = useMemo(() => {
    const p = pre / 100;
    const proc = p * 62 + (1 - p) * 148;
    const cap = (lanes * 3600) / proc;
    const peak = (DAILY * truckProfile(8.6)) / 24;
    // integrate queue over the morning peak window
    let q = 0; let qMax = 0;
    for (let h = 6; h <= 11.5; h += 1 / 12) { q = Math.max(0, q + ((DAILY * truckProfile(h)) / 24 - cap) / 12); qMax = Math.max(qMax, q); }
    return { proc, cap, peak, qMax, wait: (qMax * proc) / lanes / 60 };
  }, [pre, lanes]);
  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between text-[12px] mb-1"><span className="text-muted">Trucks pre-intimated by tenants</span><span className="font-semibold num">{pre}%</span></div>
        <input type="range" min={0} max={100} value={pre} onChange={(e) => setPre(Number(e.target.value))} className="w-full accent-[rgb(var(--brand))]" />
      </div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted">Entry lanes at peak</span>
        <Tabs value={lanes} onChange={setLanes} tabs={[{ id: 1, label: '1 lane' }, { id: 2, label: '2 lanes' }]} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[['Gate capacity', `${fmt(r.cap)}/h`], ['Peak queue', `${fmt(r.qMax)} trucks`], ['Peak wait', mins(r.wait)]].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-surface-2 border border-line px-2.5 py-2">
            <div className="text-[10.5px] text-faint">{k}</div><div className="text-[15px] font-semibold num">{v}</div>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-faint leading-relaxed"><Sparkles size={11} className="inline text-plum mr-1" />Morning peak forecast ≈ {fmt(r.peak)} trucks/h. Pre-intimated trucks clear the gate in ~62 s vs ~148 s for manual verification.</p>
    </div>
  );
}

export default function Gate() {
  const snapshot = useLive((s) => s.snapshot);
  const history = useLive((s) => s.history);
  const k = useKpi();
  const [logFilter, setLogFilter] = useState('all');
  const qData = useMemo(() => history.map((b) => ({ t: b.t, queue: b.queue || 0, inside: b.inside || 0 })), [history]);
  if (!snapshot) return <Loading />;
  const g = snapshot.gate;
  const log = g.events.filter((e) => (logFilter === 'all' ? ['entry', 'exit', 'lane'].includes(e.kind) : e.kind === logFilter)).slice(0, 40);
  const kpis = [
    { key: 'gate-queue', label: 'Queue on public road', icon: ListOrdered, value: g.queue, unit: 'trucks', sub: g.queue ? `≈ ${g.queueMeters} m · oldest ${mins(g.queueOldestMin)}` : 'No trucks waiting outside' },
    { key: 'gate-wait', label: 'Est. wait for new arrival', icon: Timer, value: fmt(g.estWaitMin, 1), unit: 'min', sub: `Today avg ${mins(g.today.avgWaitMin)} · max ${mins(g.today.maxWaitMin)}` },
    { key: 'trucks-today', label: 'Entries / exits today', icon: Truck, value: `${g.today.entries} / ${g.today.exits}`, sub: `${g.insideTotal} inside · ${g.today.arrivals} arrivals` },
    { key: 'pre-intimation', label: 'Pre-intimated by tenant', icon: BadgeCheck, value: pct(g.today.preRate), sub: `${g.today.pre} of ${g.today.entries} trucks` },
    { key: 'parking', label: 'Parking violations', icon: ParkingCircle, value: g.violations.length, unit: 'active', sub: `${g.today.violations} today · ${g.today.violationsResolved} cleared` },
    { key: 'gate-road', label: 'Truck-hours on public road', icon: Route, value: fmt(g.today.roadTruckHours, 1), unit: 'h', sub: `Max queue ${g.today.queueMax} · lane 2 opened ${g.today.laneOpenings}×` },
  ];
  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {kpis.map(({ key, ...x }) => { const { insight, onInsight } = k(key); return <KpiCard key={key} kpiKey={key} {...x} insight={insight} onInsight={onInsight} tone={sevTone(insight)} />; })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="Gate queue — last 24 h" subtitle="Peak queue per 5 min (trucks waiting outside Gate 1)" icon={ListOrdered}>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <AreaChart data={qData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs><linearGradient id="gq" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.35} /><stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtIstTime(t)} minTickGap={50} tickLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ReferenceLine y={6} stroke="rgb(var(--warn))" strokeDasharray="4 4" label={{ value: 'spills onto road', position: 'insideTopRight', fill: 'rgb(var(--warn))', fontSize: 11 }} />
                <Tooltip content={<ChartTooltip labelFormatter={(t) => fmtIstTime(t)} unit=" trucks" />} />
                <Area dataKey="queue" name="Queue" type="monotone" stroke="rgb(var(--brand))" strokeWidth={2} fill="url(#gq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Gate status" subtitle={`Capacity ≈ ${fmt(g.capacityPerHour)} trucks/h`} icon={DoorOpen}>
          <GateDiagram gate={g} />
          <div className="grid grid-cols-2 gap-2 mt-3">
            {['CAM-G01', 'CAM-G04'].map((id) => { const c = snapshot.safety.cams.find((x) => x.id === id); return c ? <CctvVideo key={id} cam={c} incidents={snapshot.incidents} ts={snapshot.ts} /> : null; })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Trucks waiting outside" subtitle="Live queue, oldest first" icon={Truck} bodyClass="pb-2">
          <div className="h-[300px] overflow-y-auto scroll-thin -mr-2 pr-2">
            {g.queueTrucks.length === 0 && <div className="text-[13px] text-faint py-10 text-center">Gate is clear — no trucks waiting.</div>}
            {g.queueTrucks.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2.5 py-2 border-b border-line last:border-0">
                <span className="w-6 text-[11px] text-faint num">#{i + 1}</span>
                <span className="font-semibold text-[12.5px] num flex-1">{t.plate}</span>
                <TenantChip id={t.tenant} />
                {t.pre ? <span className="chip bg-ok/10 text-ok">pre-intimated</span> : <span className="chip bg-surface-3 text-faint">manual</span>}
                <span className="text-[12px] num w-14 text-right">{mins(t.waitMin)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Dedicated parking compliance" subtitle="Each tenant must park only in its own bays" icon={ParkingCircle}>
          <div className="space-y-3">
            {TENANTS.map((t) => {
              const x = g.tenants[t.id];
              const zone = PARKING_ZONES.find((z) => z.tenant === t.id);
              const occ = x.bayOcc / x.bays;
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: seriesColor(t.slot) }} /><span className="font-semibold">{t.name}</span><span className="text-faint text-[11px]">{zone?.id}</span></span>
                    <span className="num text-muted">{x.bayOcc}/{x.bays} bays · {x.dock}/{x.docks} docks</span>
                  </div>
                  <Meter value={occ} tone={occ > 0.85 ? 'warn' : t.slot} />
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-line">
            <div className="label-xs mb-2">Active violations</div>
            {g.violations.length === 0 && <div className="text-[12.5px] text-ok">No violations right now.</div>}
            <div className="space-y-2 max-h-[150px] overflow-y-auto scroll-thin">
              {g.violations.map((v) => (
                <div key={v.id} className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2">
                  <div className="flex items-center gap-2 text-[12.5px]"><span className="font-semibold num">{v.plate}</span><TenantChip id={v.tenant} /><span className="ml-auto text-[11px] text-faint">{ago(v.ts, snapshot.ts)}</span></div>
                  <div className="text-[11.5px] text-muted mt-0.5">{labelFor(v.kind)} · {v.where} · {v.camera}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Pre-intimation what-if" subtitle="Effect of tenant pre-registration on the morning peak" icon={SlidersHorizontal}>
          <WhatIf gate={g} />
        </Card>
      </div>

      <Card title="Gate log" subtitle="Every entry / exit with wait time and verification mode" icon={Bell}
        action={<Tabs value={logFilter} onChange={setLogFilter} tabs={[{ id: 'all', label: 'All' }, { id: 'entry', label: 'Entries' }, { id: 'exit', label: 'Exits' }, { id: 'violation', label: 'Violations' }]} />}>
        <div className="max-h-[360px] overflow-y-auto scroll-thin -mr-2 pr-2"><EventFeed events={log} /></div>
      </Card>
    </div>
  );
}
