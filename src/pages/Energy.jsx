import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Zap, Gauge, Fuel, Lightbulb, BatteryCharging, Activity, PlugZap, Cable } from 'lucide-react';
import { useLive } from '../store/live';
import { POWER, STREET_LIGHTS } from '../config/malur';
import { fmtIstTime } from '../sim/util';
import { KpiCard, Card, Loading, ChartTooltip, LegendRow, Meter, StatusDot } from '../components/ui';
import { useKpi } from './Command';
import { fmt, pct, inr, ago } from '../lib/format';

const sevTone = (i) => (i?.severity === 'critical' ? 'critical' : i?.severity === 'warning' ? 'warning' : undefined);
const loadColor = (lp) => (lp > 0.95 ? 'rgb(var(--crit))' : lp > 0.85 ? 'rgb(var(--warn))' : 'rgb(var(--ok))');

function SLD({ power }) {
  const out = power.grid.outage;
  const live = out ? 'rgb(var(--crit))' : 'rgb(var(--brand))';
  const dash = out ? '6 5' : undefined;
  const trs = [
    { id: 'TR-1', y: 40, load: 'Amazon · Block D' },
    { id: 'TR-2', y: 130, load: 'Flipkart · Block B' },
    { id: 'TR-3', y: 220, load: 'Common area' },
  ];
  const txt = 'rgb(var(--fg))';
  const sub = 'rgb(var(--fg-faint))';
  return (
    <svg viewBox="0 0 780 330" className="w-full h-auto" role="img" aria-label="Single line diagram of the HIP Malur electrical network">
      <rect x="10" y="112" width="120" height="56" rx="8" fill="rgb(var(--surface-2))" stroke="rgb(var(--border-strong))" />
      <text x="70" y="135" textAnchor="middle" fontSize="13" fontWeight="600" fill={txt}>BESCOM 11 kV</text>
      <text x="70" y="153" textAnchor="middle" fontSize="12" fill={out ? 'rgb(var(--crit))' : sub}>{out ? 'OUTAGE' : `${power.grid.kv.toFixed(2)} kV · ${power.grid.hz.toFixed(2)} Hz`}</text>
      <line x1="130" y1="140" x2="190" y2="140" stroke={live} strokeWidth="3" strokeDasharray={dash} />
      <rect x="190" y="118" width="64" height="44" rx="6" fill="rgb(var(--surface-2))" stroke="rgb(var(--border-strong))" />
      <text x="222" y="145" textAnchor="middle" fontSize="12" fontWeight="600" fill={txt}>RMU</text>
      <line x1="254" y1="140" x2="290" y2="140" stroke={live} strokeWidth="3" strokeDasharray={dash} />
      <line x1="290" y1="62" x2="290" y2="242" stroke={live} strokeWidth="3" strokeDasharray={dash} />
      {trs.map((t) => {
        const d = power.tr[t.id];
        const meta = POWER.transformers.find((x) => x.id === t.id);
        const c = out ? 'rgb(var(--fg-faint))' : loadColor(d.loadPct);
        return (
          <g key={t.id}>
            <line x1="290" y1={t.y + 22} x2="340" y2={t.y + 22} stroke={live} strokeWidth="3" strokeDasharray={dash} />
            <circle cx="358" cy={t.y + 22} r="16" fill="none" stroke={c} strokeWidth="2.5" />
            <circle cx="378" cy={t.y + 22} r="16" fill="none" stroke={c} strokeWidth="2.5" />
            <text x="368" y={t.y - 2} textAnchor="middle" fontSize="12" fontWeight="600" fill={txt}>{t.id} · {meta.kva} kVA</text>
            <line x1="394" y1={t.y + 22} x2="470" y2={t.y + 22} stroke={c} strokeWidth="3" />
            <rect x="470" y={t.y} width="210" height="44" rx="8" fill="rgb(var(--surface-2))" stroke={c} strokeWidth="1.5" />
            <text x="482" y={t.y + 18} fontSize="12.5" fontWeight="600" fill={txt}>{t.load}</text>
            <text x="482" y={t.y + 35} fontSize="11.5" fill={sub}>{fmt(d.kva)} kVA · {pct(d.loadPct)} · oil {fmt(d.oilC)}°C</text>
            <rect x="690" y={t.y + 14} width="76" height="16" rx="8" fill="rgb(var(--surface-3))" />
            <rect x="690" y={t.y + 14} width={76 * Math.min(1, d.loadPct)} height="16" rx="8" fill={c} opacity="0.85" />
          </g>
        );
      })}
      {/* Decathlon & fire DG */}
      <rect x="10" y="272" width="200" height="44" rx="8" fill="none" stroke="rgb(var(--border-strong))" strokeDasharray="5 4" />
      <text x="22" y="290" fontSize="12.5" fontWeight="600" fill={txt}>Decathlon — own HT</text>
      <text x="22" y="307" fontSize="11.5" fill={sub}>Tenant-managed, not HIP-metered</text>
      <rect x="470" y="272" width="210" height="44" rx="8" fill="rgb(var(--surface-2))" stroke="rgb(var(--purple))" strokeWidth="1.5" />
      <text x="482" y="290" fontSize="12.5" fontWeight="600" fill={txt}>Fire DG 320 kVA → fire pumps</text>
      <text x="482" y="307" fontSize="11.5" fill={sub}>{power.dg.running ? 'RUNNING (test)' : 'AUTO standby'} · fuel {pct(power.dg.fuelPct)}</text>
    </svg>
  );
}

function LightGrid({ lights }) {
  const byRoad = useMemo(() => {
    const m = new Map();
    lights.forEach((l) => { if (!m.has(l.road)) m.set(l.road, []); m.get(l.road).push(l); });
    return [...m.entries()];
  }, [lights]);
  const cls = (l) => (l.status === 'fault' ? 'bg-crit' : l.status === 'flicker' ? 'bg-warn animate-pulse' : l.status === 'dayburn' ? 'bg-brand' : l.on ? 'bg-[#f2b630]' : 'bg-surface-3 border border-line-strong');
  return (
    <div className="space-y-2">
      {byRoad.map(([road, ls]) => (
        <div key={road} className="flex items-center gap-3">
          <span className="w-[170px] shrink-0 text-[11.5px] text-muted truncate">{road}</span>
          <div className="flex flex-wrap gap-1">
            {ls.map((l) => <span key={l.id} title={`${l.id} · ${l.status}${l.on ? ' · ON' : ''}`} className={`h-3.5 w-3.5 rounded-[3px] ${cls(l)}`} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Energy() {
  const snapshot = useLive((s) => s.snapshot);
  const history = useLive((s) => s.history);
  const k = useKpi();
  const trData = useMemo(() => history.map((b) => ({ t: b.t, tr1: (b.tr1 || 0) / 750, tr2: (b.tr2 || 0) / 750, tr3: (b.tr3 || 0) / 350 })), [history]);
  if (!snapshot) return <Loading />;
  const p = snapshot.power;
  const ls = p.lightStats;
  const faulty = p.lights.filter((l) => l.status !== 'ok');
  const common = POWER.commonLoads.map((c) => ({ ...c, kw: p.common[c.id], kwh: p.today.commonKwh[c.id] }));
  const maxKw = Math.max(...common.map((c) => c.kw), 1);
  const kpis = [
    { key: 'grid', label: '11 kV incomer', icon: Cable, value: p.grid.outage ? 'OUTAGE' : fmt(p.grid.kv, 2), unit: p.grid.outage ? '' : 'kV', sub: `${fmt(p.grid.hz, 2)} Hz · last outage ${ago(p.grid.lastOutageTs, snapshot.ts)}` },
    { key: 'tr-load', label: 'TR-1 · Amazon', icon: Zap, value: pct(p.tr['TR-1'].loadPct), sub: `${fmt(p.tr['TR-1'].kva)} / 750 kVA · PF ${fmt(p.tr['TR-1'].pf, 2)}`, footer: <Meter value={p.tr['TR-1'].loadPct} tone={p.tr['TR-1'].loadPct > 0.85 ? 'warn' : 's1'} marks={[0.85]} /> },
    { key: 'tr2', label: 'TR-2 · Flipkart', icon: Zap, value: pct(p.tr['TR-2'].loadPct), sub: `${fmt(p.tr['TR-2'].kva)} / 750 kVA · PF ${fmt(p.tr['TR-2'].pf, 2)}`, footer: <Meter value={p.tr['TR-2'].loadPct} tone={p.tr['TR-2'].loadPct > 0.85 ? 'warn' : 's2'} marks={[0.85]} /> },
    { key: 'common-power', label: 'TR-3 · Common area', icon: PlugZap, value: fmt(p.common.totalKw), unit: 'kW', sub: `${pct(p.tr['TR-3'].loadPct)} of 350 kVA · ${inr(p.today.costCommon)} today` },
    { key: 'fire-dg', label: 'Fire DG 320 kVA', icon: Fuel, value: p.dg.running ? 'RUNNING' : 'STANDBY', sub: `Fuel ${pct(p.dg.fuelPct)} · battery ${fmt(p.dg.batteryV, 1)} V · test ${ago(p.dg.lastTestTs, snapshot.ts)}`, footer: <Meter value={p.dg.fuelPct} tone={p.dg.fuelPct < 0.4 ? 'crit' : p.dg.fuelPct < 0.6 ? 'warn' : 'ok'} /> },
    { key: 'street-lights', label: 'Street lights', icon: Lightbulb, value: `${ls.working}/${ls.total}`, unit: 'healthy', sub: `${ls.on} ON · ${fmt(p.today.lightKwh)} kWh today · ${fmt(p.today.wastedKwh, 1)} kWh wasted` },
  ];
  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {kpis.map(({ key, ...x }) => { const { insight, onInsight } = k(key); return <KpiCard key={key} kpiKey={key} {...x} insight={insight} onInsight={onInsight} tone={sevTone(insight)} />; })}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-5 gap-4">
        <Card className="2xl:col-span-3" title="Electrical single-line — live" subtitle="11 kV → RMU → 2 × 750 kVA (Amazon, Flipkart) + 350 kVA common area. Decathlon runs its own HT." icon={Cable}>
          <SLD power={p} />
        </Card>
        <Card className="2xl:col-span-2" title="Transformer loading — 24 h" subtitle="% of rating (85% = alert threshold)" icon={Activity}
          action={<LegendRow items={[{ label: 'TR-1', color: 'rgb(var(--s1))' }, { label: 'TR-2', color: 'rgb(var(--s2))' }, { label: 'TR-3', color: 'rgb(var(--s4))' }]} />}>
          <div className="h-[290px]">
            <ResponsiveContainer>
              <LineChart data={trData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtIstTime(t)} minTickGap={50} tickLine={false} />
                <YAxis tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <ReferenceLine y={0.85} stroke="rgb(var(--warn))" strokeDasharray="4 4" />
                <Tooltip content={<ChartTooltip labelFormatter={(t) => fmtIstTime(t)} valueFormatter={(v) => `${Math.round(v * 100)}%`} />} />
                <Line dataKey="tr1" name="TR-1 Amazon" stroke="rgb(var(--s1))" strokeWidth={2} dot={false} />
                <Line dataKey="tr2" name="TR-2 Flipkart" stroke="rgb(var(--s2))" strokeWidth={2} dot={false} />
                <Line dataKey="tr3" name="TR-3 Common" stroke="rgb(var(--s4))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="Street-light health" subtitle={`${STREET_LIGHTS.length} smart poles · schedule 18:00–06:15 · faults detected from current draw`} icon={Lightbulb}
          action={<LegendRow items={[{ label: 'ON', color: '#f2b630' }, { label: 'OFF (day)', color: 'rgb(var(--surface-3))' }, { label: 'Fault', color: 'rgb(var(--crit))' }, { label: 'Flicker', color: 'rgb(var(--warn))' }, { label: 'Day-burn', color: 'rgb(var(--brand))' }]} />}>
          <LightGrid lights={p.lights} />
          <div className="mt-4 pt-3 border-t border-line">
            <div className="label-xs mb-2">Faulty lights · work orders</div>
            {faulty.length === 0 && <div className="text-[12.5px] text-ok">All lights healthy.</div>}
            <div className="grid sm:grid-cols-2 gap-2">
              {faulty.map((l) => (
                <div key={l.id} className="rounded-lg border border-line px-3 py-2 flex items-start gap-2">
                  <StatusDot status={l.status === 'dayburn' ? 'opportunity' : 'critical'} pulse />
                  <div className="flex-1 text-[12px]">
                    <div className="font-semibold">{l.id} <span className="text-faint font-normal">· {l.road}</span></div>
                    <div className="text-muted">{l.status === 'fault' ? 'Lamp failure' : l.status === 'flicker' ? 'Flicker' : 'Day-burning'} · detected {ago(l.detectedAt, snapshot.ts)} · {l.wo}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Common-area load" subtitle="TR-3 feeders — kW now / kWh today" icon={Gauge}>
            <div className="space-y-2.5">
              {common.map((c) => (
                <div key={c.id}>
                  <div className="flex justify-between text-[12px] mb-1"><span className="text-muted">{c.name}</span><span className="num"><span className="font-semibold">{fmt(c.kw, 1)} kW</span> <span className="text-faint">· {fmt(c.kwh)} kWh</span></span></div>
                  <Meter value={c.kw} max={maxKw} tone="s4" />
                </div>
              ))}
            </div>
          </Card>
          <Card title="EV buggies & charging hub" subtitle="Hub opposite the FM office" icon={BatteryCharging}>
            <div className="space-y-2">
              {p.buggies.map((b) => (
                <div key={b.id} className="flex items-center gap-3 text-[12px]">
                  <span className="w-12 font-semibold">{b.id}</span>
                  <Meter value={b.soc} tone={b.soc < 0.25 ? 'crit' : b.soc < 0.45 ? 'warn' : 'ok'} className="flex-1" />
                  <span className="w-10 text-right num">{pct(b.soc)}</span>
                  <span className={`chip w-[78px] justify-center ${b.state === 'service' ? 'bg-info/10 text-info' : b.state === 'charging' ? 'bg-ok/10 text-ok' : 'bg-surface-3 text-muted'}`}>{b.state === 'service' ? 'in service' : b.state}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {p.chargers.map((c) => (
                <div key={c.id} className={`rounded-lg border px-2 py-1.5 text-center ${c.status === 'fault' ? 'border-crit/40 bg-crit/5' : 'border-line bg-surface-2'}`}>
                  <div className="text-[11px] font-semibold">{c.id}</div>
                  <div className={`text-[10.5px] ${c.status === 'fault' ? 'text-crit' : c.status === 'charging' ? 'text-ok' : 'text-faint'}`}>{c.status === 'charging' ? c.buggy : c.status}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
