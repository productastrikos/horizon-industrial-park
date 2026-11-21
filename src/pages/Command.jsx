import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Truck, Timer, ParkingCircle, Droplets, CloudRain, Flame, Zap, Fuel, Lightbulb, Cctv, BatteryCharging, ListOrdered, Box, ArrowRight, Leaf, MapPin, Activity } from 'lucide-react';
import { useLive } from '../store/live';
import { useUi } from '../store/ui';
import { SITE, TENANTS, BUILDINGS } from '../config/malur';
import { KpiCard, Card, Loading, ChartTooltip, LegendRow, Meter, seriesColor, StatusDot } from '../components/ui';
import EventFeed, { useMergedEvents } from '../components/EventFeed';
import { kpiInsight } from '../ai/advisories';
import { hourly, last } from '../lib/series';
import { fmt, pct, mins, inr } from '../lib/format';

export function useKpi() {
  const snapshot = useLive((s) => s.snapshot);
  const advisories = useLive((s) => s.advisories);
  const openAdvisory = useUi((s) => s.openAdvisory);
  return (kpi) => {
    const insight = kpiInsight(kpi, snapshot, advisories);
    return { insight, onInsight: () => openAdvisory(insight?.advisory?.id || null) };
  };
}

const sevTone = (ins) => (ins?.severity === 'critical' ? 'critical' : ins?.severity === 'warning' ? 'warning' : undefined);

function ParkHeader({ snapshot, advisories }) {
  const navigate = useNavigate();
  const mods = [
    { k: 'Gate', m: ['gate'] }, { k: 'Water', m: ['water'] }, { k: 'Power', m: ['power'] },
    { k: 'Fire', m: ['fire'] }, { k: 'Lighting', m: ['lighting'] }, { k: 'CCTV', m: ['cctv'] }, { k: 'EV', m: ['ev'] },
  ].map((x) => {
    const list = advisories.filter((a) => x.m.includes(a.module));
    const st = list.some((a) => a.severity === 'critical') ? 'critical' : list.some((a) => a.severity === 'warning') ? 'warning' : 'ok';
    return { ...x, st };
  });
  const crit = advisories.filter((a) => a.severity === 'critical').length;
  const warn = advisories.filter((a) => a.severity === 'warning').length;
  const health = Math.max(35, 100 - crit * 9 - warn * 3);
  return (
    <div className="card p-4 flex flex-col lg:flex-row lg:items-center gap-4 relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1 grad-bg" />
      <div className="flex-1 min-w-0 pl-1">
        <div className="flex items-center gap-2 text-[12px] text-faint"><MapPin size={12} />{SITE.address}</div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h2 className="text-[20px] font-semibold">{SITE.fullName}</h2>
          <span className="chip bg-leaf/10 text-leaf"><Leaf size={11} />{SITE.igbc}</span>
          <span className="chip bg-surface-3 text-muted">{SITE.acres} acres</span>
          <span className="chip bg-surface-3 text-muted">{SITE.potentialMsf} MN sq ft · {BUILDINGS.length} blocks</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {TENANTS.map((t) => (
            <span key={t.id} className="chip" style={{ background: `rgb(var(--${t.slot}) / .12)`, color: `rgb(var(--${t.slot}))` }}>
              {t.name} · {t.blocks.join(', ')}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-5">
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-x-4 gap-y-2">
          {mods.map((m) => (
            <div key={m.k} className="flex flex-col items-center gap-1">
              <StatusDot status={m.st} pulse={m.st === 'critical'} />
              <span className="text-[11px] text-muted">{m.k}</span>
            </div>
          ))}
        </div>
        <div className="h-12 w-px bg-line hidden sm:block" />
        <div className="text-center">
          <div className="text-[11px] text-faint">Park health</div>
          <div className={`text-[28px] font-semibold num leading-none mt-0.5 ${health >= 85 ? 'text-ok' : health >= 70 ? 'text-warn' : 'text-crit'}`}>{health}</div>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate('/park/malur/twin')}><Box size={15} />Digital Twin<ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

export default function Command() {
  const snapshot = useLive((s) => s.snapshot);
  const history = useLive((s) => s.history);
  const advisories = useLive((s) => s.advisories);
  const k = useKpi();
  const events = useMergedEvents(snapshot, { limit: 30 });

  const hourlyArr = useMemo(() => {
    const spec = { arrivals: 'sum', lanes: 'max', queue: 'max' };
    TENANTS.forEach((t) => { spec[`arr_${t.id}`] = 'sum'; });
    return hourly(history, spec).slice(-24).map((r) => ({ ...r, capacity: Math.round(27.9 * (r.lanes || 1)) }));
  }, [history]);

  if (!snapshot) return <Loading />;
  const { gate, water, power, safety } = snapshot;
  const tr1 = power.tr['TR-1'];
  const tr2 = power.tr['TR-2'];
  const ls = power.lightStats;
  const cs = safety.camStats;
  const avail = power.buggies.filter((b) => b.state === 'service' || (b.state === 'idle' && b.soc > 0.45)).length;
  const kpis = [
    { key: 'trucks-today', label: 'Trucks entered today', icon: Truck, value: fmt(gate.today.entries), sub: `${gate.today.exits} exited · ${gate.insideTotal} inside now`, spark: last(history, 'arrivals') },
    { key: 'gate-queue', label: 'Gate queue (live)', icon: ListOrdered, value: gate.queue, unit: 'trucks', sub: gate.queue ? `~${gate.queueMeters} m on public road · ${gate.lanesOpen} lane(s) open` : `${gate.lanesOpen} entry lane open · ${gate.exitQueue} exiting`, spark: last(history, 'queue') },
    { key: 'gate-wait', label: 'Avg gate wait today', icon: Timer, value: fmt(gate.today.avgWaitMin, 1), unit: 'min', sub: `Max ${mins(gate.today.maxWaitMin)} · ${pct(gate.today.preRate)} pre-intimated`, spark: last(history, 'estWait') },
    { key: 'parking', label: 'Parking violations', icon: ParkingCircle, value: gate.violations.length, unit: 'active', sub: `${gate.today.violations} flagged today · ${gate.today.violationsResolved} cleared`, spark: last(history, 'violations') },
    { key: 'water-today', label: 'Water consumed today', icon: Droplets, value: fmt(water.today.useKl), unit: 'KL', sub: `Washroom ${fmt(water.today.use.washroom)} · Domestic ${fmt(water.today.use.domestic)} · Garden ${fmt(water.today.use.garden)}`, spark: history.slice(-36).map((b) => (b.w_washroom || 0) + (b.w_domestic || 0) + (b.w_garden || 0)) },
    { key: 'water-external', label: 'External water dependency', icon: CloudRain, value: pct(water.today.externalShare), sub: `${water.today.tankers} tankers · ${fmt(water.today.tankerKl)} KL · ${inr(water.today.cost)}`, footer: <Meter value={water.today.externalShare} tone={water.today.externalShare > 0.6 ? 'warn' : 'ok'} marks={[0.5]} /> },
    { key: 'fire-reserve', label: 'Fire water reserve', icon: Flame, value: pct(water.levels.FIRE.pct), sub: `${fmt(water.levels.FIRE.kl)} / ${water.levels.FIRE.cap} KL · ring ${fmt(safety.fire.pressureBar, 1)} bar`, spark: last(history, 'pressure') },
    { key: 'tr-load', label: 'Transformer load', icon: Zap, value: `${pct(tr1.loadPct)} · ${pct(tr2.loadPct)}`, sub: `TR-1 Amazon · TR-2 Flipkart (750 kVA each) · 11 kV ${fmt(power.grid.kv, 2)}`, spark: last(history, 'tr1'), sparkColor: seriesColor('s1') },
    { key: 'fire-dg', label: 'Fire DG 320 kVA', icon: Fuel, value: power.dg.running ? 'RUNNING' : 'STANDBY', sub: `Fuel ${pct(power.dg.fuelPct)} · ${fmt(power.dg.autonomyH, 1)} h autonomy · ${fmt(power.dg.batteryV, 1)} V`, footer: <Meter value={power.dg.fuelPct} tone={power.dg.fuelPct < 0.4 ? 'crit' : power.dg.fuelPct < 0.6 ? 'warn' : 'ok'} /> },
    { key: 'street-lights', label: 'Street lights', icon: Lightbulb, value: `${ls.working}/${ls.total}`, unit: 'healthy', sub: `${ls.faulty} faulty · ${ls.dayburn} day-burning · ${ls.on} ON now`, spark: last(history, 'lights_fault'), sparkColor: 'rgb(var(--warn))' },
    { key: 'cctv', label: 'CCTV uptime', icon: Cctv, value: pct(cs.uptime, 1), sub: `${cs.online}/${cs.total} online · VMS analytics: none`, spark: last(history, 'cam_online') },
    { key: 'ev', label: 'EV buggies', icon: BatteryCharging, value: `${avail}/${power.buggies.length}`, unit: 'available', sub: `${power.buggies.filter((b) => b.state === 'charging').length} charging · ${power.chargers.filter((c) => c.status === 'available').length} chargers free`, spark: last(history, 'ev_service') },
  ];

  return (
    <div className="p-5 space-y-4">
      <ParkHeader snapshot={snapshot} advisories={advisories} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ key, ...x }) => {
          const { insight, onInsight } = k(key);
          return <KpiCard key={key} kpiKey={key} {...x} insight={insight} onInsight={onInsight} tone={sevTone(insight)} />;
        })}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4">
        <Card className="2xl:col-span-2" title="Truck arrivals vs gate capacity" subtitle="Hourly arrivals by tenant (last 24 h) against entry-lane throughput" icon={Activity}
          action={<LegendRow items={[...TENANTS.map((t) => ({ label: t.name, color: seriesColor(t.slot) })), { label: 'Gate capacity', color: 'rgb(var(--fg-muted))', dashed: true }]} />}>
          <div className="h-[290px]">
            <ResponsiveContainer>
              <ComposedChart data={hourlyArr} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barCategoryGap="18%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} interval={2} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgb(var(--surface-3))' }} content={<ChartTooltip unit=" trucks" />} />
                {TENANTS.map((t, i) => (
                  <Bar key={t.id} dataKey={`arr_${t.id}`} name={t.name} stackId="a" fill={seriesColor(t.slot)} stroke="rgb(var(--surface))" strokeWidth={1} radius={i === TENANTS.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
                <Line dataKey="capacity" name="Gate capacity / h" type="stepAfter" stroke="rgb(var(--fg-muted))" strokeDasharray="5 4" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Live event stream" subtitle="Gate, utilities and safety events as they arrive" icon={Activity} bodyClass="pb-1">
          <div className="h-[290px] overflow-y-auto scroll-thin -mr-2 pr-2">
            <EventFeed events={events} />
          </div>
        </Card>
      </div>

      <Card title="Tenant operations snapshot" subtitle="HIP-managed gate, parking and power services per tenant" icon={Truck}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint border-b border-line">
                <th className="py-2 font-semibold">Tenant</th><th className="font-semibold">Blocks</th><th className="font-semibold text-right">In today</th><th className="font-semibold text-right">Out</th>
                <th className="font-semibold text-right">At docks</th><th className="font-semibold text-right">Queued</th><th className="font-semibold pl-6 w-[200px]">Dedicated bays</th><th className="font-semibold">Power supply</th>
              </tr>
            </thead>
            <tbody>
              {TENANTS.map((t) => {
                const g = gate.tenants[t.id];
                const occ = g.bays ? g.bayOcc / g.bays : 0;
                return (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <td className="py-2.5"><span className="inline-flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: seriesColor(t.slot) }} />{t.name}</span></td>
                    <td className="text-muted">{t.blocks.map((b) => `Block ${b}`).join(', ')}</td>
                    <td className="text-right num font-semibold">{g.entries}</td>
                    <td className="text-right num">{g.exits}</td>
                    <td className="text-right num">{g.dock}<span className="text-faint">/{g.docks}</span></td>
                    <td className="text-right num">{g.queue}</td>
                    <td className="pl-6"><div className="flex items-center gap-2"><Meter value={occ} tone={occ > 0.85 ? 'warn' : t.slot} className="flex-1" /><span className="num text-[12px] w-12 text-right">{g.bayOcc}/{g.bays}</span></div></td>
                    <td className="text-muted text-[12.5px]">{t.powerNote}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
