import { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Droplets, CloudRain, Truck, Waves, Recycle, Flame, Gauge, Activity, IndianRupee } from 'lucide-react';
import { useLive } from '../store/live';
import { WATER } from '../config/malur';
import { fmtIstTime } from '../sim/util';
import { KpiCard, Card, Loading, ChartTooltip, LegendRow, Meter, StatusDot } from '../components/ui';
import EventFeed, { useMergedEvents } from '../components/EventFeed';
import { useKpi } from './Command';
import { hourly } from '../lib/series';
import { fmt, pct, inr } from '../lib/format';

const sevTone = (i) => (i?.severity === 'critical' ? 'critical' : i?.severity === 'warning' ? 'warning' : undefined);
const USE_COLORS = { washroom: 'rgb(var(--s1))', domestic: 'rgb(var(--s2))', garden: 'rgb(var(--s4))' };

function Tank({ t, l }) {
  const color = t.kind === 'fire' ? 'rgb(var(--crit))' : t.kind === 'treated' ? 'rgb(var(--s4))' : 'rgb(var(--info))';
  const low = t.kind === 'fire' ? l.pct < 0.95 : l.pct < 0.3;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[150px] w-[74px] rounded-xl border-2 border-line-strong bg-surface-2 overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 transition-[height] duration-1000" style={{ height: `${l.pct * 100}%`, background: `linear-gradient(180deg, ${color} 0%, ${color} 100%)`, opacity: 0.8 }} />
        <div className="absolute bottom-0 left-0 right-0 h-2 opacity-40" style={{ background: color }} />
        {[0.25, 0.5, 0.75].map((m) => <div key={m} className="absolute left-0 w-2 h-px bg-fg/30" style={{ bottom: `${m * 100}%` }} />)}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[16px] font-semibold num text-fg drop-shadow-sm">{pct(l.pct)}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[12.5px] font-semibold leading-tight flex items-center gap-1.5 justify-center">{low && <StatusDot status="critical" pulse />}{t.name}</div>
        <div className="text-[11.5px] text-faint num">{fmt(l.kl)} / {t.capKl} KL</div>
      </div>
    </div>
  );
}

export default function Water() {
  const snapshot = useLive((s) => s.snapshot);
  const history = useLive((s) => s.history);
  const k = useKpi();
  const events = useMergedEvents(snapshot, { kinds: ['tanker', 'borewell', 'fire-test'], limit: 25 });
  const useData = useMemo(() => history.map((b) => ({ t: b.t, washroom: b.w_washroom, domestic: b.w_domestic, garden: b.w_garden })), [history]);
  const supply = useMemo(() => hourly(history, { w_tanker: 'sum', w_bore: 'sum' }).slice(-24), [history]);
  if (!snapshot) return <Loading />;
  const w = snapshot.water;
  const kpis = [
    { key: 'water-today', label: 'Consumed today', icon: Droplets, value: fmt(w.today.useKl), unit: 'KL', sub: `Plan ≈ ${WATER.dailyDemandKl} KL/day · now ${fmt(w.flow.washroom + w.flow.domestic + w.flow.garden, 1)} KL/h` },
    { key: 'water-external', label: 'External dependency', icon: CloudRain, value: pct(w.today.externalShare), sub: 'Tanker share of supplied water · target ≤ 50%', footer: <Meter value={w.today.externalShare} tone={w.today.externalShare > 0.6 ? 'warn' : 'ok'} marks={[0.5]} /> },
    { key: 'water-tankers', label: 'Tankers today', icon: Truck, value: w.today.tankers, unit: `· ${fmt(w.today.tankerKl)} KL`, sub: `${inr(w.today.cost)} spend · ${w.tanker.enRouteEta ? `next ETA ${fmtIstTime(w.tanker.enRouteEta)}` : 'none en route'}` },
    { key: 'water-borewell', label: 'Borewell yield today', icon: Waves, value: fmt(w.today.borewellKl, 1), unit: 'KL', sub: `BW-1 ${fmt(w.borewells['BW-1'].klToday, 1)} · BW-2 ${fmt(w.borewells['BW-2'].klToday, 1)} KL` },
    { key: 'water-stp', label: 'STP reuse', icon: Recycle, value: pct(w.today.stpReuseRate), sub: `${fmt(w.today.stpReusedKl)} of ${fmt(w.today.stpTreatedKl)} KL treated reused` },
    { key: 'fire-reserve', label: 'Fire water reserve', icon: Flame, value: pct(w.levels.FIRE.pct), sub: `${fmt(w.levels.FIRE.kl)} / ${w.levels.FIRE.cap} KL · topped-up ${fmt(w.today.fireTopUpKl, 1)} KL today` },
  ];
  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {kpis.map(({ key, ...x }) => { const { insight, onInsight } = k(key); return <KpiCard key={key} kpiKey={key} {...x} insight={insight} onInsight={onInsight} tone={sevTone(insight)} />; })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Storage levels" subtitle="Live tank levels — fire reserve must remain full" icon={Gauge}>
          <div className="grid grid-cols-4 gap-2 pt-2">
            {WATER.tanks.map((t) => <Tank key={t.id} t={t} l={w.levels[t.id]} />)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-lg bg-surface-2 border border-line px-3 py-2"><div className="text-faint text-[11px]">Transfer pump (sump → AGT)</div><div className="font-semibold">{w.transferOn ? 'Running' : 'Off'}</div></div>
            <div className="rounded-lg bg-surface-2 border border-line px-3 py-2"><div className="text-faint text-[11px]">Tanker en route</div><div className="font-semibold num">{w.tanker.enRouteEta ? `${w.tanker.vehicle} · ${fmtIstTime(w.tanker.enRouteEta)}` : 'No'}</div></div>
          </div>
        </Card>
        <Card className="xl:col-span-2" title="Consumption by use — last 24 h" subtitle="KL per hour (domestic, gardening, washrooms)" icon={Activity}
          action={<LegendRow items={WATER.uses.map((u) => ({ label: u.name.split(' (')[0], color: USE_COLORS[u.id] }))} />}>
          <div className="h-[290px]">
            <ResponsiveContainer>
              <AreaChart data={useData} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtIstTime(t)} minTickGap={50} tickLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip labelFormatter={(t) => fmtIstTime(t)} valueFormatter={(v) => fmt(v, 1)} unit=" KL/h" />} />
                {WATER.uses.map((u) => <Area key={u.id} dataKey={u.id} name={u.name.split(' (')[0]} stackId="1" type="monotone" stroke={USE_COLORS[u.id]} fill={USE_COLORS[u.id]} fillOpacity={0.25} strokeWidth={2} />)}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="Supply mix — external tanker vs borewell" subtitle="KL received per hour, last 24 h" icon={Truck}
          action={<LegendRow items={[{ label: 'Tanker (external)', color: 'rgb(var(--s2))' }, { label: 'Borewells', color: 'rgb(var(--s1))' }]} />}>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={supply} margin={{ top: 10, right: 8, left: -14, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} interval={2} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgb(var(--surface-3))' }} content={<ChartTooltip valueFormatter={(v) => fmt(v, 1)} unit=" KL" />} />
                <Bar dataKey="w_bore" name="Borewells" stackId="s" fill="rgb(var(--s1))" stroke="rgb(var(--surface))" />
                <Bar dataKey="w_tanker" name="Tanker" stackId="s" fill="rgb(var(--s2))" stroke="rgb(var(--surface))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Borewells" subtitle="Two borewells feeding the domestic sump" icon={Waves}>
          <div className="space-y-3">
            {WATER.borewells.map((b) => {
              const st = w.borewells[b.id];
              return (
                <div key={b.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-center gap-2">
                    <StatusDot status={st.tripped ? 'critical' : st.running ? 'ok' : 'info'} pulse={st.tripped} />
                    <span className="font-semibold text-[13px]">{b.name}</span>
                    <span className={`chip ml-auto ${st.tripped ? 'bg-crit/10 text-crit' : st.running ? 'bg-ok/10 text-ok' : 'bg-surface-3 text-muted'}`}>{st.tripped ? 'TRIPPED' : st.running ? 'RUNNING' : 'IDLE'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[12px]">
                    <span className="text-muted">Yield today</span><span className="text-right num font-semibold">{fmt(st.klToday, 1)} KL</span>
                    <span className="text-muted">Run hours</span><span className="text-right num">{fmt(st.runH, 1)} h</span>
                    <span className="text-muted">Water level</span><span className="text-right num">{fmt(st.gwDepthM, 1)} m bgl</span>
                    <span className="text-muted">Rated yield</span><span className="text-right num">{b.yieldKlh} KL/h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Tanker deliveries today" subtitle={`${WATER.tankerKl} KL per tanker · ₹${WATER.tankerCostPerKl}/KL`} icon={IndianRupee}>
          <div className="max-h-[260px] overflow-y-auto scroll-thin">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-faint border-b border-line"><th className="py-2">Time</th><th>Vehicle</th><th className="text-right">KL</th><th className="text-right">Cost</th></tr></thead>
              <tbody>
                {w.today.tankerLog.map((r) => (
                  <tr key={r.ts} className="border-b border-line last:border-0"><td className="py-2 num">{fmtIstTime(r.ts)}</td><td className="num">{r.vehicle}</td><td className="text-right num">{r.kl}</td><td className="text-right num">{inr(r.kl * WATER.tankerCostPerKl)}</td></tr>
                ))}
                {!w.today.tankerLog.length && <tr><td colSpan={4} className="py-6 text-center text-faint">No tanker deliveries yet today</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Water events" subtitle="Tankers, borewell trips and hydrant tests" icon={Activity}>
          <div className="max-h-[260px] overflow-y-auto scroll-thin -mr-2 pr-2"><EventFeed events={events} /></div>
        </Card>
      </div>
    </div>
  );
}
