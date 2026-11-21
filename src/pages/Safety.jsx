import { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Cctv, VideoOff, HardDrive, ScanEye, Flame, Gauge, ShieldCheck, Siren, ClipboardList } from 'lucide-react';
import { useLive } from '../store/live';
import { FIRE } from '../config/malur';
import { fmtIstTime } from '../sim/util';
import { KpiCard, Card, Loading, ChartTooltip, SevBadge, StatusDot, Meter } from '../components/ui';
import { useKpi } from './Command';
import { fmt, pct, ago } from '../lib/format';
import CctvVideo, { feedFor } from '../components/CctvVideo';

const sevTone = (i) => (i?.severity === 'critical' ? 'critical' : i?.severity === 'warning' ? 'warning' : undefined);

function CamTile({ c, ts }) {
  const off = c.status !== 'online';
  const seed = c.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const hue = seed % 40;
  return (
    <div className={`relative rounded-lg overflow-hidden border ${off ? 'border-crit/50' : 'border-line'} aspect-video`}>
      {off ? (
        <div className="absolute inset-0 bg-[#141518] flex flex-col items-center justify-center gap-1">
          <VideoOff size={18} className="text-crit" />
          <span className="text-[10px] font-bold tracking-wider text-crit">{c.status === 'degraded' ? 'DEGRADED' : 'NO SIGNAL'}</span>
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(${120 + hue}deg, #2c3036 0%, #43484f 45%, #5b6067 70%, #3a3e44 100%)` }}>
          <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'linear-gradient(0deg, rgba(120,120,110,.45), transparent)' }} />
          <div className="absolute left-[12%] bottom-[22%] h-[30%] w-[38%] rounded-sm bg-[#cfd4da]/30" />
          <div className="absolute right-[10%] bottom-[18%] h-[14%] w-[22%] rounded-sm bg-[#F47922]/40" />
          <span className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[9px] font-bold text-white/90"><span className="h-1.5 w-1.5 rounded-full bg-crit animate-pulse" />REC</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-black/55 text-white flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold truncate">{c.id} · {c.name}</span>
        <span className="text-[9.5px] num opacity-80">{fmtIstTime(ts, true)}</span>
      </div>
    </div>
  );
}

export default function Safety() {
  const snapshot = useLive((s) => s.snapshot);
  const history = useLive((s) => s.history);
  const k = useKpi();
  const [zone, setZone] = useState('all');
  const pData = useMemo(() => history.map((b) => ({ t: b.t, pressure: b.pressure })), [history]);
  if (!snapshot) return <Loading />;
  const sf = snapshot.safety;
  const cs = sf.camStats;
  const f = sf.fire;
  const zones = ['all', ...new Set(sf.cams.map((c) => c.zone))];
  const incs = snapshot.incidents || [];
  const rank = (c) => (feedFor(c.id, incs).incident ? 0 : c.status !== 'online' ? 1 : c.zone === 'Main gate' ? 2 : 3);
  const shown = sf.cams.filter((c) => zone === 'all' || c.zone === zone).sort((a, b) => rank(a) - rank(b));
  const kpis = [
    { key: 'cctv', label: 'CCTV uptime', icon: Cctv, value: pct(cs.uptime, 1), sub: `${cs.online}/${cs.total} streaming to VMS` },
    { key: 'cctv-offline', label: 'Cameras offline', icon: VideoOff, value: cs.offline + cs.degraded, sub: `${sf.today.camOutages} outages today` },
    { key: 'vms', label: 'VMS retention', icon: HardDrive, value: sf.nvr.retentionDays, unit: `/ ${sf.nvr.retentionTarget} days`, sub: `Storage ${pct(sf.nvr.storageUsedPct)} used${sf.nvr.diskFault ? ' · 1 disk degraded' : ''}` },
    { key: 'vision', label: 'Vision-AI events today', icon: ScanEye, value: sf.today.visionEvents, sub: 'Pilot layer — VMS has no analytics' },
    { key: 'fire-reserve', label: 'Hydrant ring pressure', icon: Gauge, value: fmt(f.pressureBar, 2), unit: 'bar', sub: `Jockey ${f.jockeyRunning ? 'running' : 'idle'} · ${sf.today.jockeyStarts} starts today` },
    { key: 'fire-panel', label: 'Fire alarm panel', icon: Siren, value: `${f.panel.normal}/${f.panel.zones}`, unit: 'zones normal', sub: `${f.panel.faults.length} fault · ${f.panel.alarms.length} alarm` },
  ];
  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {kpis.map(({ key, ...x }) => { const { insight, onInsight } = k(key); return <KpiCard key={key} kpiKey={key} {...x} insight={insight} onInsight={onInsight} tone={sevTone(insight)} />; })}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4">
        <Card className="2xl:col-span-2" title="Camera wall" subtitle="VMS streams — incident and offline cameras pinned first (demo footage)" icon={Cctv}
          action={<select value={zone} onChange={(e) => setZone(e.target.value)} className="input h-8 w-auto text-[12px] py-0">{zones.map((z) => <option key={z} value={z}>{z === 'all' ? 'All zones' : z}</option>)}</select>}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2 max-h-[470px] overflow-y-auto scroll-thin pr-1">
            {shown.slice(0, 20).map((c) => <CctvVideo key={c.id} cam={c} incidents={incs} ts={snapshot.ts} />)}
          </div>
        </Card>
        <Card title="Vision-AI detections" subtitle="Astrikos analytics pilot on existing cameras" icon={ScanEye}>
          <div className="max-h-[470px] overflow-y-auto scroll-thin -mr-2 pr-2 space-y-2">
            {sf.vision.map((v) => (
              <div key={v.id} className="rounded-lg border border-line p-2.5">
                <div className="flex items-center gap-2"><SevBadge severity={v.severity} /><span className="text-[12.5px] font-semibold">{v.type}</span><span className="ml-auto text-[11px] text-faint num">{fmtIstTime(v.ts)}</span></div>
                <div className="text-[12px] text-muted mt-1">{v.detail}</div>
                <div className="text-[11px] text-faint mt-0.5">{v.camera} · {v.id}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Hydrant ring main pressure — 24 h" subtitle="Jockey cut-in 6.4 bar · main pump 5.6 bar" icon={Gauge}>
          <div className="h-[220px]">
            <ResponsiveContainer>
              <AreaChart data={pData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtIstTime(t)} minTickGap={50} tickLine={false} />
                <YAxis domain={[5.4, 7.6]} tickLine={false} axisLine={false} />
                <ReferenceLine y={FIRE.jockeyCutInBar} stroke="rgb(var(--warn))" strokeDasharray="4 4" />
                <Tooltip content={<ChartTooltip labelFormatter={(t) => fmtIstTime(t)} valueFormatter={(v) => fmt(v, 2)} unit=" bar" />} />
                <Area dataKey="pressure" name="Pressure" type="monotone" stroke="rgb(var(--crit))" fill="rgb(var(--crit))" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Fire protection system" subtitle="Pumps, panel & reserve" icon={Flame}>
          <div className="space-y-2 text-[12.5px]">
            {[['Jockey pump', f.jockeyRunning ? 'Running' : 'Auto · idle', 'ok'], ['Main electric pump', f.mainPump, 'ok'], ['Diesel fire pump', f.dieselPump, 'ok'], ['Fire DG 320 kVA', snapshot.power.dg.running ? 'Running (test)' : `Standby · fuel ${pct(snapshot.power.dg.fuelPct)}`, snapshot.power.dg.fuelPct < 0.6 ? 'warning' : 'ok'], ['Sprinkler header', `${fmt(f.sprinklerBar, 2)} bar`, 'ok']].map(([a, b, st]) => (
              <div key={a} className="flex items-center gap-2 py-1 border-b border-line last:border-0"><StatusDot status={st} /><span className="text-muted flex-1">{a}</span><span className="font-semibold">{b}</span></div>
            ))}
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[12px] mb-1"><span className="text-muted">Fire water reserve</span><span className="font-semibold num">{pct(snapshot.water.levels.FIRE.pct)}</span></div>
            <Meter value={snapshot.water.levels.FIRE.pct} tone={snapshot.water.levels.FIRE.pct < 0.95 ? 'crit' : 'ok'} marks={[0.95]} />
          </div>
          <div className="label-xs mt-4 mb-2">Panel zones</div>
          <div className="grid grid-cols-9 gap-1">
            {Array.from({ length: FIRE.panelZones }).map((_, i) => {
              const z = i + 1;
              const al = f.panel.alarms.some((x) => x.zone === z);
              const ft = f.panel.faults.some((x) => x.zone === z);
              return <span key={z} title={`Zone ${z}`} className={`h-6 rounded text-[10px] font-semibold flex items-center justify-center ${al ? 'bg-crit text-white animate-pulse' : ft ? 'bg-warn text-white' : 'bg-ok/15 text-ok'}`}>{z}</span>;
            })}
          </div>
        </Card>
        <Card title="Compliance & readiness" subtitle="Inspections and drills" icon={ClipboardList}>
          <div className="space-y-2 text-[12.5px]">
            {[['Extinguishers due for refill/inspection', `${f.extinguishersDue} of ${FIRE.extinguishers}`, f.extinguishersDue > 10 ? 'warning' : 'ok'], ['Hydrant points', FIRE.hydrantPoints, 'ok'], ['Last mock fire drill', `${f.lastDrillDays} days ago`, f.lastDrillDays > 90 ? 'warning' : 'ok'], ['Next hydrant inspection', `in ${f.hydrantInspectionDays} days`, 'ok'], ['Fire DG last test', ago(snapshot.power.dg.lastTestTs, snapshot.ts), (snapshot.ts - snapshot.power.dg.lastTestTs) / 86400000 > 7.5 ? 'warning' : 'ok']].map(([a, b, st]) => (
              <div key={a} className="flex items-center gap-2 py-1.5 border-b border-line last:border-0"><StatusDot status={st} /><span className="text-muted flex-1">{a}</span><span className="font-semibold num">{b}</span></div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-plum/10 px-3 py-2.5 text-[12px] text-fg">
            <div className="flex items-center gap-1.5 font-semibold text-plum mb-1"><ShieldCheck size={13} />Security events today</div>
            {sf.events.slice(0, 4).map((e, i) => <div key={i} className="text-muted flex gap-2"><span className="num text-faint">{fmtIstTime(e.ts)}</span><span className="truncate">{e.text}</span></div>)}
            {!sf.events.length && <div className="text-muted">No events</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
