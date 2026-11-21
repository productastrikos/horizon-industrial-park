import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ClipboardPlus, Sparkles } from 'lucide-react';
import { useWorkOrders, WO_CATEGORIES, WO_PRIORITIES, FM_TEAM, LOCATIONS, SLA_H } from '../../store/workorders';
import { useLive } from '../../store/live';
import { fmtIstTime, fmtIstDate } from '../../sim/util';

const EMPTY = { title: '', description: '', category: 'Housekeeping', priority: 'P3', location: LOCATIONS[0], assignee: '', source: 'Manual', sourceRef: null };

export default function WorkOrderDialog() {
  const draft = useWorkOrders((s) => s.draft);
  const close = useWorkOrders((s) => s.closeCreate);
  const create = useWorkOrders((s) => s.create);
  const select = useWorkOrders((s) => s.select);
  const ts = useLive((s) => s.snapshot?.ts) || Date.now();
  const navigate = useNavigate();
  const [f, setF] = useState(EMPTY);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!draft) return;
    setF({ ...EMPTY, ...draft });
    setDone(null);
    setErr('');
  }, [draft]);

  if (!draft) return null;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const suggested = FM_TEAM.filter((m) => m.cats.includes(f.category));
  const due = ts + SLA_H[f.priority] * 3600000;

  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return setErr('Give the work order a title');
    const wo = create({ ...f, title: f.title.trim(), assignee: f.assignee || null });
    setDone(wo);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={close} />
      <div className="relative w-full max-w-[600px] card shadow-pop overflow-hidden animate-fade-up">
        <div className="px-5 pt-4 pb-3 border-b border-line flex items-center gap-3">
          <span className="h-9 w-9 rounded-lg bg-brand text-white flex items-center justify-center"><ClipboardPlus size={17} /></span>
          <div className="flex-1">
            <div className="text-[16px] font-semibold">New work order</div>
            <div className="text-[12px] text-faint">HIP Malur · Facility management</div>
          </div>
          <button type="button" className="icon-btn h-8 w-8" onClick={close} aria-label="Close"><X size={16} /></button>
        </div>

        {done ? (
          <div className="px-5 py-6 text-center">
            <div className="text-[13px] text-muted">Work order created</div>
            <div className="text-[26px] font-semibold num mt-1">{done.id}</div>
            <div className="text-[13px] mt-1">{done.title}</div>
            <div className="text-[12px] text-faint mt-1">{done.assignee ? `Assigned to ${done.assignee}` : 'Awaiting assignment'} · SLA due {fmtIstTime(done.dueAt)} {fmtIstDate(done.dueAt)}</div>
            <div className="flex justify-center gap-2 mt-5">
              <button type="button" className="btn-outline" onClick={close}>Done</button>
              <button type="button" className="btn-primary" onClick={() => { select(done.id); close(); navigate('/park/malur/work-orders'); }}>Track work order</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-4 space-y-3.5">
            {f.source !== 'Manual' && (
              <div className="rounded-lg bg-plum/10 border border-plum/20 px-3 py-2 text-[12px] text-fg flex items-center gap-2">
                <Sparkles size={13} className="text-plum" />Pre-filled from <b>{f.source}</b>{f.sourceRef ? ` · ${f.sourceRef}` : ''}
              </div>
            )}
            <div>
              <label className="label-xs block mb-1" htmlFor="wo-t">Title</label>
              <input id="wo-t" className="input h-10" value={f.title} onChange={set('title')} placeholder="e.g. Street light SL-014 not working" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-xs block mb-1" htmlFor="wo-c">Category</label>
                <select id="wo-c" className="input h-10" value={f.category} onChange={set('category')}>{WO_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <div>
                <label className="label-xs block mb-1" htmlFor="wo-p">Priority</label>
                <select id="wo-p" className="input h-10" value={f.priority} onChange={set('priority')}>{WO_PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.slaH} h SLA</option>)}</select>
              </div>
              <div>
                <label className="label-xs block mb-1" htmlFor="wo-l">Location / asset</label>
                <input id="wo-l" className="input h-10" list="wo-locs" value={f.location} onChange={set('location')} />
                <datalist id="wo-locs">{LOCATIONS.map((l) => <option key={l} value={l} />)}</datalist>
              </div>
              <div>
                <label className="label-xs block mb-1" htmlFor="wo-a">Assign to</label>
                <select id="wo-a" className="input h-10" value={f.assignee || ''} onChange={set('assignee')}>
                  <option value="">Unassigned</option>
                  {suggested.length > 0 && <optgroup label="Suggested">{suggested.map((m) => <option key={m.name} value={m.name}>{m.name} — {m.role}</option>)}</optgroup>}
                  <optgroup label="FM team">{FM_TEAM.filter((m) => !suggested.includes(m)).map((m) => <option key={m.name} value={m.name}>{m.name} — {m.role}</option>)}</optgroup>
                </select>
              </div>
            </div>
            <div>
              <label className="label-xs block mb-1" htmlFor="wo-d">Description</label>
              <textarea id="wo-d" className="input h-24 py-2 resize-none" value={f.description} onChange={set('description')} placeholder="What needs to be done, safety notes, access details…" />
            </div>
            {err && <div className="text-[12.5px] font-semibold text-crit">{err}</div>}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[12px] text-faint mr-auto">SLA due <b className="text-fg num">{fmtIstTime(due)} · {fmtIstDate(due)}</b></span>
              <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
              <button type="submit" className="btn-primary"><ClipboardPlus size={15} />Create work order</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
