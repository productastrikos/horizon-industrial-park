import { Suspense, lazy, useEffect } from 'react';
import { Layers, Video, Truck, ListOrdered, Lightbulb, Cctv, Sun, Moon, Siren, Flame, Droplets, ParkingCircle, LampFloor, Check } from 'lucide-react';
import { INCIDENT_TYPES } from '../sim/incidents';
import { useLive } from '../store/live';
import { useTwin, LAYERS, PRESETS } from '../twin/store';
import Inspector from '../twin/Inspector';
import { TENANTS } from '../config/malur';
import { Loading, seriesColor } from '../components/ui';
import { fmtIstTime } from '../sim/util';

const TwinScene = lazy(() => import('../twin/Scene'));

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Icon size={15} className={tone ? `text-${tone}` : 'text-brand'} />
      <div className="leading-tight">
        <div className="text-[10.5px] text-faint">{label}</div>
        <div className={`text-[14px] font-semibold num ${tone ? `text-${tone}` : ''}`}>{value}</div>
      </div>
    </div>
  );
}

const DRILL = [
  { type: 'gate-surge', label: 'Gate overcrowding', Icon: ListOrdered },
  { type: 'light-outage', label: 'Street lights down', Icon: LampFloor },
  { type: 'illegal-parking', label: 'Truck in fire lane', Icon: ParkingCircle },
  { type: 'water-shortage', label: 'Water shortage', Icon: Droplets },
  { type: 'grid-fire', label: 'Fire at substation', Icon: Flame },
];

function IncidentDrill({ incidents, onTrigger, onResolve }) {
  return (
    <div className="card shadow-card p-3">
      <div className="label-xs flex items-center gap-1.5 mb-2 text-crit"><Siren size={12} />Incident simulator</div>
      <div className="space-y-1.5">
        {DRILL.map(({ type, label, Icon }) => {
          const act = incidents.find((i) => i.type === type && i.status === 'active');
          return (
            <div key={type} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${act ? 'border-crit/40 bg-crit/5' : 'border-line'}`}>
              <Icon size={14} className={act ? 'text-crit' : 'text-muted'} />
              <span className={`flex-1 text-[12px] ${act ? 'text-crit font-semibold' : 'text-fg'}`} title={INCIDENT_TYPES[type].title}>{label}</span>
              {act ? (
                <button type="button" onClick={() => onResolve(act.id)} className="h-6 px-2 rounded text-[11px] font-semibold bg-ok/15 text-ok hover:bg-ok/25 flex items-center gap-1"><Check size={11} />Resolve</button>
              ) : (
                <button type="button" onClick={() => onTrigger(type)} className="h-6 px-2 rounded text-[11px] font-semibold bg-crit text-white hover:brightness-110">Trigger</button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10.5px] text-faint mt-2 leading-snug">Simulated incidents flow into KPIs, Sia advisories, CCTV and this twin.</p>
    </div>
  );
}

export default function ParkTwin() {
  const snapshot = useLive((s) => s.snapshot);
  const layers = useTwin((s) => s.layers);
  const toggleLayer = useTwin((s) => s.toggleLayer);
  const preset = useTwin((s) => s.preset);
  const goPreset = useTwin((s) => s.goPreset);
  const select = useTwin((s) => s.select);
  const focus = useTwin((s) => s.focus);
  const injectIncident = useLive((s) => s.injectIncident);
  const resolveIncident = useLive((s) => s.resolveIncident);
  useEffect(() => () => select(null), [select]);

  if (!snapshot) return <Loading />;
  const g = snapshot.gate;
  const h = snapshot.clock.h;
  const night = h >= 18.2 || h < 6.1;
  const lf = snapshot.power.lightStats.faulty + snapshot.power.lightStats.dayburn;
  const camOff = snapshot.safety.camStats.total - snapshot.safety.camStats.online;

  return (
    <div className="relative h-full min-h-[600px] w-full overflow-hidden">
      <Suspense fallback={<Loading label="Building digital twin…" />}>
        <TwinScene />
      </Suspense>

      {/* layer + view controls */}
      <div className="absolute top-3 left-3 w-[220px] z-30 space-y-2 max-h-[calc(100%-90px)] overflow-y-auto scroll-thin">
      <div className="card shadow-card p-3">
        <div className="label-xs flex items-center gap-1.5 mb-2"><Layers size={12} />Layers</div>
        <div className="space-y-1">
          {LAYERS.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-[12.5px] text-muted cursor-pointer select-none">
              <input type="checkbox" checked={layers[l.id]} onChange={() => toggleLayer(l.id)} className="accent-[rgb(var(--brand))] h-3.5 w-3.5" />
              {l.label}
            </label>
          ))}
        </div>
        <div className="label-xs flex items-center gap-1.5 mt-3 mb-2"><Video size={12} />Views</div>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(PRESETS).map(([id, p]) => (
            <button key={id} type="button" onClick={() => goPreset(id)} className={`h-7 rounded-md text-[11.5px] font-semibold border transition ${preset === id ? 'border-brand text-brand bg-brand-soft' : 'border-line text-muted hover:text-fg hover:bg-surface-3'}`}>{p.label}</button>
          ))}
        </div>
      </div>
      <IncidentDrill incidents={snapshot.incidents || []} onTrigger={(type) => {
        injectIncident(type);
        setTimeout(() => {
          const inc = (useLive.getState().snapshot?.incidents || []).find((i) => i.type === type && i.status === 'active');
          if (inc?.x != null) { focus(inc.x, inc.z, type === 'gate-surge' ? 320 : 220); select({ type: 'incident', id: inc.id }); }
        }, 60);
      }} onResolve={resolveIncident} />
      </div>

      {/* live strip */}
      <div className="absolute bottom-3 left-3 right-3 xl:right-auto card shadow-card flex flex-wrap items-center divide-x divide-line z-30">
        <Stat icon={night ? Moon : Sun} label="Site time (IST)" value={fmtIstTime(snapshot.ts)} />
        <Stat icon={ListOrdered} label="Gate queue" value={`${g.queue} trucks`} tone={g.queue >= 15 ? 'crit' : g.queue >= 6 ? 'warn' : undefined} />
        <Stat icon={Truck} label="Trucks inside" value={g.insideTotal} />
        <Stat icon={Lightbulb} label="Light faults" value={lf} tone={lf ? 'warn' : undefined} />
        <Stat icon={Cctv} label="Cameras offline" value={camOff} tone={camOff ? 'crit' : undefined} />
        <div className="flex items-center gap-3 px-3 py-2 text-[11.5px] text-muted">
          {TENANTS.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: seriesColor(t.slot) }} />{t.name}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-crit" />Fault / violation</span>
        </div>
      </div>

      <Inspector />

      <style>{`
        .twin-tag { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 4px 8px; border-radius: 8px;
          background: rgb(var(--surface) / .92); border: 1px solid rgb(var(--border)); box-shadow: var(--shadow-card);
          font-family: Barlow, sans-serif; white-space: nowrap; cursor: pointer; backdrop-filter: blur(4px); transition: transform .15s; }
        .twin-tag:hover, .twin-tag.is-hot { border-color: rgb(var(--brand)); transform: translateY(-2px); }
        .twin-tag-title { font-size: 12px; font-weight: 600; color: rgb(var(--fg)); line-height: 1.2; }
        .twin-tag-sub { font-size: 10.5px; color: rgb(var(--fg-muted)); display: inline-flex; align-items: center; gap: 4px; line-height: 1.2; }
        .twin-tag-sub i { width: 7px; height: 7px; border-radius: 2px; display: inline-block; }
        .twin-incident { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; background: rgb(var(--crit)); color: #fff;
          font-family: Barlow, sans-serif; white-space: nowrap; cursor: pointer; box-shadow: 0 6px 22px rgba(229,72,77,.45); animation: incidentBob 1.6s ease-in-out infinite; }
        .twin-incident-dot { width: 9px; height: 9px; border-radius: 9999px; background: #fff; animation: pulseRing 1.2s ease-out infinite; }
        .twin-incident-title { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; opacity: .9; }
        .twin-incident-sub { display: block; font-size: 12.5px; font-weight: 600; }
        @keyframes incidentBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        .twin-tag-sub.tone-warn { color: rgb(var(--warn)); } .twin-tag-sub.tone-crit { color: rgb(var(--crit)); font-weight: 600; } .twin-tag-sub.tone-ok { color: rgb(var(--ok)); }
      `}</style>
    </div>
  );
}
