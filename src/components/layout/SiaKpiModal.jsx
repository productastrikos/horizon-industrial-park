import { useEffect, useMemo, useState } from 'react';
import { X, Sparkles, ArrowUpRight, TrendingUp, TrendingDown, Minus, Target, BookOpen } from 'lucide-react';
import { useUi } from '../../store/ui';
import { useLive } from '../../store/live';
import { kpiInsight } from '../../ai/advisories';
import { KPI_INFO, KPI_TREND } from '../../ai/kpiInfo';
import { SEV, SevBadge } from '../ui';

export const SIA_DELAY_MS = 2200;

const STEPS = ['Reading live telemetry', 'Comparing with 24 h baseline', 'Checking linked assets & rules', 'Drafting advisory'];

/** Sia "thinking" indicator with staged steps. */
export function SiaThinking({ compact = false }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), SIA_DELAY_MS / STEPS.length);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={compact ? '' : 'py-2'}>
      <div className="flex items-center gap-2.5">
        <span className="relative h-7 w-7 rounded-full bg-plum/15 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-plum/30 border-t-plum animate-spin" />
          <Sparkles size={13} className="text-plum" />
        </span>
        <span className="text-[13px] font-semibold text-plum">Sia is analysing…</span>
      </div>
      {!compact && (
        <ul className="mt-3 space-y-1.5 pl-1">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 text-[12px] transition ${i <= step ? 'text-fg' : 'text-faint'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${i < step ? 'bg-plum' : i === step ? 'bg-plum animate-pulse' : 'bg-line-strong'}`} />
              {s}
            </li>
          ))}
        </ul>
      )}
      {!compact && (
        <div className="mt-4 space-y-2">
          {[92, 78, 85].map((w) => <div key={w} className="h-2.5 rounded-full bg-plum/10 animate-pulse" style={{ width: `${w}%` }} />)}
        </div>
      )}
    </div>
  );
}

/** Reveals text progressively, like a streamed LLM answer. */
export function Typewriter({ text, speed = 9, className = '' }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = setInterval(() => setN((x) => { if (x >= text.length) { clearInterval(t); return x; } return x + 3; }), speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return <span className={className}>{text.slice(0, n)}{n < text.length && <span className="inline-block w-1.5 h-3.5 bg-plum/70 align-middle ml-0.5 animate-pulse" />}</span>;
}

function trendOf(history, key) {
  const k = KPI_TREND[key];
  if (!k || history.length < 30) return null;
  const vals = history.map((b) => b[k]).filter((v) => v != null);
  const recent = vals.slice(-6);
  const base = vals.slice(0, -6);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const r = avg(recent);
  const b = avg(base);
  if (!b) return null;
  const d = r / b - 1;
  return { d, label: `${d >= 0 ? '+' : ''}${(d * 100).toFixed(0)}% vs 24 h average` };
}

export default function SiaKpiModal() {
  const kpi = useUi((s) => s.kpiModal);
  const close = useUi((s) => s.closeKpi);
  const openAdvisory = useUi((s) => s.openAdvisory);
  const snapshot = useLive((s) => s.snapshot);
  const advisories = useLive((s) => s.advisories);
  const history = useLive((s) => s.history);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!kpi) return undefined;
    setReady(false);
    const t = setTimeout(() => setReady(true), SIA_DELAY_MS);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [kpi?.nonce, close]); // eslint-disable-line react-hooks/exhaustive-deps

  // freeze the analysis at the moment it is "generated"
  const result = useMemo(() => {
    if (!kpi || !ready) return null;
    return { insight: kpiInsight(kpi.key, snapshot, advisories), trend: trendOf(history, kpi.key) };
  }, [ready, kpi?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!kpi) return null;
  const info = KPI_INFO[kpi.key] || ['Live operational metric for this facility.', 'Sia monitors it continuously against thresholds and history.'];
  const ins = result?.insight;
  const adv = ins?.advisory;
  const sev = ins?.severity || 'ok';
  const TrendIcon = !result?.trend ? Minus : result.trend.d > 0.03 ? TrendingUp : result.trend.d < -0.03 ? TrendingDown : Minus;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={close} />
      <div className="relative w-full max-w-[520px] card shadow-pop overflow-hidden animate-fade-up">
        <div className="px-5 pt-4 pb-3 border-b border-line flex items-start gap-3">
          <span className="h-9 w-9 rounded-lg bg-plum text-white flex items-center justify-center shrink-0"><Sparkles size={17} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-plum">Sia · KPI analysis</div>
            <div className="text-[16px] font-semibold leading-tight truncate">{kpi.label}</div>
          </div>
          <button type="button" className="icon-btn h-8 w-8" onClick={close} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[30px] font-semibold num leading-none">{kpi.value}</span>
            {kpi.unit && <span className="text-[13px] text-faint">{kpi.unit}</span>}
            {ready && result?.trend && (
              <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted"><TrendIcon size={14} />{result.trend.label}</span>
            )}
          </div>
          {kpi.sub && <div className="-mt-2 text-[12px] text-faint">{kpi.sub}</div>}

          <div className="rounded-lg bg-surface-2 border border-line px-3.5 py-3">
            <div className="label-xs flex items-center gap-1.5 mb-1"><BookOpen size={11} />What this metric means</div>
            <p className="text-[12.5px] text-fg leading-relaxed">{info[0]}</p>
            <p className="text-[12.5px] text-muted leading-relaxed">{info[1]}</p>
          </div>

          <div className="rounded-lg border border-plum/25 bg-plum/[0.06] px-3.5 py-3 min-h-[150px]">
            {!ready ? <SiaThinking /> : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-plum flex items-center gap-1"><Sparkles size={11} />Sia advisory</span>
                  <SevBadge severity={sev} className="ml-auto" />
                </div>
                <p className="text-[13.5px] font-semibold text-fg leading-snug"><Typewriter text={ins?.text || 'All signals nominal for this metric.'} /></p>
                {(adv?.summary) && <p className="text-[12.5px] text-muted leading-relaxed"><Typewriter text={adv.summary} speed={7} /></p>}
                {(adv?.recommendation || ins?.detail) && (
                  <div className="flex items-start gap-2 text-[12.5px]">
                    <Target size={14} className="text-plum mt-[2px] shrink-0" />
                    <span><span className="font-semibold">Recommended: </span><Typewriter text={adv?.recommendation || ins.detail} speed={7} /></span>
                  </div>
                )}
                {adv?.impact && <div className="text-[12px] text-muted"><span className={`font-semibold ${SEV.ok.fg}`}>Impact: </span>{adv.impact}</div>}
                {adv && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-faint">Confidence {Math.round(adv.confidence * 100)}%</span>
                    <button type="button" className="btn-ghost h-8 text-[12px] text-plum ml-auto" onClick={() => { close(); openAdvisory(adv.id); }}>Open in Sia AI Advisory <ArrowUpRight size={14} /></button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
