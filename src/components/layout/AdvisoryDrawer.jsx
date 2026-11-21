import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, ArrowUpRight, ClipboardCheck, Check, Clock3, TrendingUp, Gauge } from 'lucide-react';
import { useUi } from '../../store/ui';
import { useLive } from '../../store/live';
import { SEV, SevBadge, Tabs } from '../ui';
import { useWorkOrders, MODULE_CATEGORY, SEV_PRIORITY } from '../../store/workorders';
import { ago } from '../../lib/format';

const MODULE_LABEL = { gate: 'Gate & trucks', water: 'Water', fire: 'Fire safety', power: 'Power', lighting: 'Street lighting', cctv: 'CCTV / VMS', ev: 'EV buggies', portfolio: 'Portfolio' };

function AdvisoryCard({ a, now, focused }) {
  const navigate = useNavigate();
  const ack = useLive((s) => s.ack);
  const acked = useLive((s) => s.acked[a.id]);
  const wo = useWorkOrders((s) => s.list.find((w) => w.sourceRef === (a.incident || a.id) && !['Resolved', 'Closed'].includes(w.status)));
  const openCreate = useWorkOrders((s) => s.openCreate);
  const selectWo = useWorkOrders((s) => s.select);
  const close = useUi((s) => s.setAdvisoryOpen);
  const ref = useRef(null);
  const s = SEV[a.severity];
  useEffect(() => { if (focused && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [focused]);
  return (
    <article ref={ref} className={`rounded-xl border bg-surface p-4 transition ${focused ? 'border-brand ring-2 ring-brand/20' : 'border-line'} ${acked ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <SevBadge severity={a.severity} />
        <span className="text-[11px] text-faint">{MODULE_LABEL[a.module]}</span>
        <span className="ml-auto text-[11px] text-faint inline-flex items-center gap-1"><Clock3 size={11} />{a.since ? ago(a.since, now) : 'now'}</span>
      </div>
      <h4 className="text-[14.5px] font-semibold text-fg leading-snug">{a.title}</h4>
      <p className="text-[12.5px] text-muted mt-1.5 leading-relaxed">{a.summary}</p>
      <div className="mt-3 rounded-lg bg-plum/10 border border-plum/15 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-plum"><Sparkles size={12} />Sia recommends</div>
        <p className="text-[12.5px] text-fg mt-1 leading-relaxed">{a.recommendation}</p>
      </div>
      {a.impact && (
        <div className="mt-2.5 flex items-start gap-2 text-[12px] text-muted"><TrendingUp size={13} className="text-ok mt-[2px] shrink-0" /><span><span className="font-semibold text-fg">Impact: </span>{a.impact}</span></div>
      )}
      {a.evidence?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {a.evidence.map((e) => <li key={e} className="text-[11.5px] text-faint pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:bg-faint">{e}</li>)}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-faint mr-auto" title="Model confidence">
          <Gauge size={12} />
          <span className="w-14 h-1.5 rounded-full bg-surface-3 overflow-hidden"><span className="block h-full bg-plum" style={{ width: `${a.confidence * 100}%` }} /></span>
          <span className="num">{Math.round(a.confidence * 100)}%</span>
        </span>
        {wo ? (
          <button type="button" className="chip bg-ok/10 text-ok hover:bg-ok/20" onClick={() => { selectWo(wo.id); navigate('/park/malur/work-orders'); close(false); }}><ClipboardCheck size={12} />{wo.id} · {wo.status}</button>
        ) : (
          <button type="button" className="btn-outline h-8 text-[12px]" onClick={() => openCreate({ title: a.title.replace(/^INCIDENT · /, ''), description: `${a.summary}

Sia recommends: ${a.recommendation}`, category: MODULE_CATEGORY[a.module] || 'Housekeeping', priority: SEV_PRIORITY[a.severity] || 'P3', location: a.evidence?.[2] || '', source: 'Sia advisory', sourceRef: a.incident || a.id })}><ClipboardCheck size={14} />Work order</button>
        )}
        {!acked && !wo && <button type="button" className="btn-ghost h-8 text-[12px]" onClick={() => ack(a.id)}><Check size={14} />Ack</button>}
        {a.route && (
          <button type="button" className="btn-ghost h-8 text-[12px] text-brand" onClick={() => { navigate(a.route); close(false); }}>Open<ArrowUpRight size={14} /></button>
        )}
      </div>
    </article>
  );
}

export default function AdvisoryDrawer() {
  const open = useUi((s) => s.advisoryOpen);
  const focus = useUi((s) => s.advisoryFocus);
  const setOpen = useUi((s) => s.setAdvisoryOpen);
  const advisories = useLive((s) => s.advisories);
  const snapshot = useLive((s) => s.snapshot);
  const [tab, setTab] = useState('all');

  useEffect(() => { if (focus) setTab('all'); }, [focus]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const counts = useMemo(() => ({
    critical: advisories.filter((a) => a.severity === 'critical').length,
    warning: advisories.filter((a) => a.severity === 'warning').length,
    opportunity: advisories.filter((a) => a.severity === 'opportunity').length,
  }), [advisories]);
  const list = tab === 'all' ? advisories : advisories.filter((a) => a.severity === tab);
  const now = snapshot?.ts || Date.now();

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 backdrop-blur-[1px] z-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setOpen(false)} />
      <aside className={`fixed top-0 right-0 h-full w-full max-w-[520px] bg-bg border-l border-line shadow-pop z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`} aria-hidden={!open}>
        <header className="px-5 pt-4 pb-3 border-b border-line bg-surface">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-lg bg-plum text-white flex items-center justify-center"><Sparkles size={18} /></span>
            <div className="flex-1">
              <h2 className="text-[17px] font-semibold leading-tight">Sia AI Advisory</h2>
              <p className="text-[12px] text-faint">Sia’s live recommendations from HIP Malur & portfolio telemetry</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {['critical', 'warning', 'opportunity'].map((k) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg border px-3 py-2 text-left transition ${tab === k ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2 hover:bg-surface-3'}`}>
                <div className={`text-[20px] font-semibold num ${SEV[k].fg}`}>{counts[k]}</div>
                <div className="text-[11px] text-muted">{SEV[k].label}</div>
              </button>
            ))}
          </div>
          <Tabs className="mt-3" value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All', count: advisories.length }, { id: 'critical', label: 'Critical' }, { id: 'warning', label: 'Warning' }, { id: 'opportunity', label: 'Opportunity' }, { id: 'info', label: 'Info' }]} />
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
          {list.length === 0 && <div className="text-center text-faint text-[13px] py-16">No advisories in this category — all systems nominal.</div>}
          {list.map((a) => <AdvisoryCard key={a.id} a={a} now={now} focused={focus === a.id} />)}
        </div>
        <footer className="px-5 py-2.5 border-t border-line text-[11px] text-faint bg-surface">
          Sia (Astrikos AI) regenerates these advisories with every telemetry packet.
        </footer>
      </aside>
    </>
  );
}
