import { useMemo } from 'react';
import { Truck, LogOut, AlertTriangle, CheckCircle2, Droplets, Zap, Lightbulb, Cctv, Flame, BatteryCharging, ArrowLeftRight } from 'lucide-react';
import { TENANT_BY_ID } from '../config/malur';
import { fmtIstTime } from '../sim/util';
import { mins } from '../lib/format';

const ICON = {
  entry: { Icon: Truck, cls: 'text-ok bg-ok/10' },
  exit: { Icon: LogOut, cls: 'text-muted bg-surface-3' },
  violation: { Icon: AlertTriangle, cls: 'text-warn bg-warn/10' },
  resolved: { Icon: CheckCircle2, cls: 'text-ok bg-ok/10' },
  lane: { Icon: ArrowLeftRight, cls: 'text-info bg-info/10' },
  tanker: { Icon: Droplets, cls: 'text-info bg-info/10' },
  borewell: { Icon: Droplets, cls: 'text-warn bg-warn/10' },
  'fire-test': { Icon: Flame, cls: 'text-info bg-info/10' },
  grid: { Icon: Zap, cls: 'text-crit bg-crit/10' },
  light: { Icon: Lightbulb, cls: 'text-warn bg-warn/10' },
  dg: { Icon: Zap, cls: 'text-info bg-info/10' },
  ev: { Icon: BatteryCharging, cls: 'text-info bg-info/10' },
  cctv: { Icon: Cctv, cls: 'text-warn bg-warn/10' },
  fire: { Icon: Flame, cls: 'text-crit bg-crit/10' },
};

export function useMergedEvents(snapshot, { kinds, limit = 40 } = {}) {
  return useMemo(() => {
    if (!snapshot) return [];
    const all = [
      ...snapshot.gate.events.map((e) => ({ ...e, src: 'gate' })),
      ...snapshot.water.events.map((e) => ({ ...e, src: 'water' })),
      ...snapshot.power.events.map((e) => ({ ...e, src: 'power' })),
      ...snapshot.safety.events.map((e) => ({ ...e, src: 'safety' })),
    ].filter((e) => !kinds || kinds.includes(e.kind));
    return all.sort((a, b) => b.ts - a.ts).slice(0, limit);
  }, [snapshot, kinds, limit]);
}

export default function EventFeed({ events, className = '' }) {
  return (
    <ul className={`divide-y divide-line ${className}`}>
      {events.map((e, i) => {
        const ic = ICON[e.kind] || ICON.lane;
        const t = e.tenant ? TENANT_BY_ID[e.tenant] : null;
        return (
          <li key={`${e.ts}-${i}`} className="flex items-start gap-3 py-2.5">
            <span className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${ic.cls}`}><ic.Icon size={14} /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-fg leading-snug">
                {e.plate && <span className="font-semibold num mr-1.5">{e.plate}</span>}
                {t && <span className="chip mr-1.5 align-middle" style={{ background: `rgb(var(--${t.slot}) / .12)`, color: `rgb(var(--${t.slot}))` }}>{t.name}</span>}
                <span className="text-muted">{e.text}</span>
              </div>
              {e.kind === 'entry' && (
                <div className="text-[11px] text-faint mt-0.5">Waited {mins(e.waitMin)} · {e.pre ? 'pre-intimated' : 'manual verification'}</div>
              )}
            </div>
            <span className="text-[11px] text-faint num shrink-0">{fmtIstTime(e.ts)}</span>
          </li>
        );
      })}
    </ul>
  );
}
