import { useId, useState } from 'react';
import { useUi } from '../../store/ui';
import { AlertTriangle, AlertOctagon, Lightbulb, Info, CheckCircle2, Sparkles, ChevronRight } from 'lucide-react';

/* ------------------------------------------------------------- severity */
export const SEV = {
  critical: { label: 'Critical', fg: 'text-crit', bg: 'bg-crit/10', ring: 'ring-crit/30', dot: 'bg-crit', Icon: AlertOctagon },
  warning: { label: 'Moderate', fg: 'text-warn', bg: 'bg-warn/10', ring: 'ring-warn/30', dot: 'bg-warn', Icon: AlertTriangle },
  opportunity: { label: 'Opportunity', fg: 'text-info', bg: 'bg-info/10', ring: 'ring-info/30', dot: 'bg-info', Icon: Lightbulb },
  info: { label: 'Info', fg: 'text-muted', bg: 'bg-surface-3', ring: 'ring-line-strong', dot: 'bg-faint', Icon: Info },
  ok: { label: 'Safe', fg: 'text-ok', bg: 'bg-ok/10', ring: 'ring-ok/30', dot: 'bg-ok', Icon: CheckCircle2 },
};

export function SevBadge({ severity, className = '' }) {
  const s = SEV[severity] || SEV.info;
  const { Icon } = s;
  return (
    <span className={`chip ${s.bg} ${s.fg} ${className}`}>
      <Icon size={12} strokeWidth={2.4} />
      {s.label}
    </span>
  );
}

export function StatusDot({ status = 'ok', pulse = false, className = '' }) {
  const s = SEV[status] || SEV.ok;
  return (
    <span className={`relative inline-flex h-2.5 w-2.5 ${className}`}>
      {pulse && <span className={`absolute inset-0 rounded-full ${s.dot} animate-pulse-ring`} />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
    </span>
  );
}

/* ---------------------------------------------------------------- card */
export function Card({ title, subtitle, action, children, className = '', bodyClass = '', icon: Icon }) {
  return (
    <section className={`card flex flex-col min-w-0 ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="min-w-0">
            <h3 className="h-section flex items-center gap-2">
              {Icon && <Icon size={16} className="text-brand shrink-0" />}
              <span className="truncate">{title}</span>
            </h3>
            {subtitle && <p className="text-[12px] text-faint mt-0.5 leading-snug">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`px-4 pb-4 flex-1 min-h-0 ${bodyClass}`}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------- sparkline */
export function Sparkline({ data = [], color = 'rgb(var(--brand))', height = 36, fill = true, className = '' }) {
  const id = useId().replace(/:/g, '');
  const vals = data.filter((v) => v != null && !Number.isNaN(v));
  if (vals.length < 2) return <div style={{ height }} className={className} />;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const W = 120;
  const H = height;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`w-full block ${className}`} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={`sg${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#sg${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* --------------------------------------------------------------- meter */
export function Meter({ value = 0, max = 1, tone = 'brand', className = '', height = 6, marks = [] }) {
  const p = Math.max(0, Math.min(1, value / max));
  const toneCls = { brand: 'bg-brand', ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', info: 'bg-info', plum: 'bg-plum', s1: 'bg-s1', s2: 'bg-s2', s3: 'bg-s3', s4: 'bg-s4' }[tone] || 'bg-brand';
  return (
    <div className={`relative w-full rounded-full bg-surface-3 overflow-hidden ${className}`} style={{ height }}>
      <div className={`h-full rounded-full ${toneCls} transition-[width] duration-700`} style={{ width: `${p * 100}%` }} />
      {marks.map((m) => <span key={m} className="absolute top-0 bottom-0 w-px bg-fg/30" style={{ left: `${(m / max) * 100}%` }} />)}
    </div>
  );
}

export const toneFor = (v, warn, crit, higherIsBad = true) => {
  if (higherIsBad) return v >= crit ? 'crit' : v >= warn ? 'warn' : 'ok';
  return v <= crit ? 'crit' : v <= warn ? 'warn' : 'ok';
};

/* ------------------------------------------------------------ KPI card */
/** Every KPI card is clickable: it opens Sia's analysis of that metric. */
export function KpiCard({ kpiKey, label, value, unit, sub, icon: Icon, spark, sparkColor, insight, tone, footer, className = '' }) {
  const sev = insight?.severity || 'ok';
  const s = SEV[sev];
  const openKpi = useUi((st) => st.openKpi);
  const open = () => kpiKey && openKpi({ key: kpiKey, label, value, unit, sub });
  return (
    <div role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      title="Click for Sia analysis"
      className={`card p-4 flex flex-col gap-2 min-w-0 animate-fade-up cursor-pointer transition hover:border-plum/50 hover:shadow-pop focus:outline-none focus-visible:ring-2 focus-visible:ring-plum/40 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <span className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <Icon size={16} />
            </span>
          )}
          <span className="text-[12.5px] font-semibold text-muted leading-tight">{label}</span>
        </div>
        {tone && <StatusDot status={tone} pulse={tone === 'crit' || tone === 'critical'} className="mt-1" />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] leading-none font-semibold text-fg num tracking-tight">{value}</span>
            {unit && <span className="text-[13px] text-faint font-medium">{unit}</span>}
          </div>
          {sub && <div className="text-[12px] text-faint mt-1.5 leading-snug">{sub}</div>}
        </div>
        {spark && (
          <div className="w-[96px] shrink-0">
            <Sparkline data={spark} color={sparkColor} height={34} />
          </div>
        )}
      </div>
      {footer}
      {insight && (
        <div className="group mt-auto flex items-start gap-2 rounded-lg px-2.5 py-2 bg-plum/10 border border-plum/15 group-hover:border-plum/40 transition">
          <Sparkles size={13} className="text-plum mt-[2px] shrink-0" />
          <span className="text-[12px] leading-snug text-fg/90 flex-1 line-clamp-2">
            <span className="font-semibold text-plum">Sia · </span>
            {insight.text}
          </span>
          <span className={`mt-[4px] h-2 w-2 rounded-full shrink-0 ${s.dot}`} title={s.label} />
          <ChevronRight size={14} className="text-plum/70 mt-[1px] shrink-0" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------ chart tooltip */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = (v) => v, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface shadow-pop px-3 py-2 text-[12px] min-w-[150px]">
      <div className="font-semibold text-fg mb-1">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color || p.stroke || p.fill }} />
            {p.name}
          </span>
          <span className="font-semibold text-fg num">{valueFormatter(p.value, p)}{unit}</span>
        </div>
      ))}
    </div>
  );
}

export function LegendRow({ items, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted ${className}`}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${it.dashed ? 'border border-dashed' : ''}`} style={{ background: it.dashed ? 'transparent' : it.color, borderColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- tabs */
export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-lg bg-surface-3 p-1 ${className}`}>
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} className={`tab ${value === t.id ? 'active' : ''}`}>
          {t.label}
          {t.count != null && <span className="ml-1.5 text-faint num">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function useToggle(init = false) {
  const [v, setV] = useState(init);
  return [v, () => setV((x) => !x), setV];
}

export const seriesColor = (slot) => `rgb(var(--${slot}))`;

export function Loading({ label = 'Connecting to live feed…' }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-faint text-[13px] gap-2 py-20">
      <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
      {label}
    </div>
  );
}
