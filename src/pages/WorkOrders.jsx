import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ClipboardList, ClipboardPlus, Timer, AlertOctagon, CheckCircle2, Hourglass, Gauge, Search, X, Download, Send, Box, Sparkles, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLive } from '../store/live';
import { useWorkOrders, WO_STATUSES, WO_CATEGORIES, WO_PRIORITIES, FM_TEAM, slaState } from '../store/workorders';
import { Card, Loading, Tabs, ChartTooltip, LegendRow } from '../components/ui';
import { fmtIstTime, fmtIstDate } from '../sim/util';
import { fmt, pct, mins, ago } from '../lib/format';
import { downloadCsv } from '../lib/report';

const STATUS_STYLE = {
  Open: 'bg-info/10 text-info', Assigned: 'bg-plum/10 text-plum', 'In progress': 'bg-warn/15 text-warn',
  'On hold': 'bg-surface-3 text-muted', Resolved: 'bg-ok/10 text-ok', Closed: 'bg-surface-3 text-faint',
};
const PRIO_STYLE = { P1: 'bg-crit text-white', P2: 'bg-warn text-white', P3: 'bg-info/15 text-info', P4: 'bg-surface-3 text-muted' };
const SLA_STYLE = { overdue: 'text-crit font-semibold', 'due-soon': 'text-warn font-semibold', 'on-track': 'text-ok', met: 'text-ok', breached: 'text-crit' };
const NEXT = { Open: ['Assigned'], Assigned: ['In progress', 'On hold'], 'In progress': ['Resolved', 'On hold'], 'On hold': ['In progress'], Resolved: ['Closed', 'In progress'], Closed: ['In progress'] };

function Stat({ icon: Icon, label, value, sub, tone = 'text-fg' }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <span className="h-9 w-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0"><Icon size={17} /></span>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-muted">{label}</div>
        <div className={`text-[24px] font-semibold num leading-tight ${tone}`}>{value}</div>
        {sub && <div className="text-[11.5px] text-faint">{sub}</div>}
      </div>
    </div>
  );
}

function Detail({ wo, now, onClose }) {
  const update = useWorkOrders((s) => s.update);
  const comment = useWorkOrders((s) => s.comment);
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const sla = slaState(wo, now);
  return (
    <aside className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-bg border-l border-line shadow-pop z-50 flex flex-col animate-slide-in">
      <header className="px-5 pt-4 pb-3 bg-surface border-b border-line">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-faint num">{wo.id}</span>
          <span className={`chip ${PRIO_STYLE[wo.priority]}`}>{wo.priority}</span>
          <span className={`chip ${STATUS_STYLE[wo.status]}`}>{wo.status}</span>
          <button type="button" className="icon-btn h-8 w-8 ml-auto" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <h3 className="text-[16px] font-semibold leading-snug mt-1.5">{wo.title}</h3>
        <div className="text-[12px] text-faint mt-0.5">{wo.category} · {wo.location || '—'}</div>
      </header>
      <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-2 text-[12.5px]">
          {[['Raised', `${fmtIstTime(wo.createdAt)} · ${fmtIstDate(wo.createdAt)}`], ['SLA due', <span key="s" className={SLA_STYLE[sla]}>{fmtIstTime(wo.dueAt)} · {fmtIstDate(wo.dueAt)}</span>], ['Source', wo.source + (wo.sourceRef ? ` · ${wo.sourceRef}` : '')], ['Resolved', wo.resolvedAt ? `${fmtIstTime(wo.resolvedAt)} (${mins((wo.resolvedAt - wo.createdAt) / 60000)})` : '—']].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface-2 border border-line px-3 py-2"><div className="text-[11px] text-faint">{k}</div><div className="font-semibold">{v}</div></div>
          ))}
        </div>
        {wo.description && <p className="text-[12.5px] text-muted leading-relaxed rounded-lg border border-line px-3 py-2.5">{wo.description}</p>}
        <div>
          <label className="label-xs block mb-1" htmlFor="wo-assign"><User size={11} className="inline mr-1" />Assignee</label>
          <select id="wo-assign" className="input h-10" value={wo.assignee || ''} onChange={(e) => update(wo.id, { assignee: e.target.value || null, ...(wo.status === 'Open' && e.target.value ? { status: 'Assigned' } : {}) }, e.target.value ? `Assigned to ${e.target.value}` : 'Unassigned')}>
            <option value="">Unassigned</option>
            {FM_TEAM.map((m) => <option key={m.name} value={m.name}>{m.name} — {m.role}</option>)}
          </select>
        </div>
        <div>
          <div className="label-xs mb-1.5">Move to</div>
          <div className="flex flex-wrap gap-2">
            {NEXT[wo.status].map((st) => (
              <button key={st} type="button" onClick={() => update(wo.id, { status: st })}
                className={`btn h-8 text-[12px] ${st === 'Resolved' || st === 'Closed' ? 'bg-ok text-white hover:brightness-110' : st === 'On hold' ? 'btn-outline' : 'bg-brand text-white hover:bg-brand-strong'}`}>{st}</button>
            ))}
            {wo.sourceRef?.startsWith?.('INC-') && <button type="button" className="btn-outline h-8 text-[12px]" onClick={() => navigate('/park/malur/twin')}><Box size={13} />View in twin</button>}
          </div>
        </div>
        <div>
          <div className="label-xs mb-2">Activity</div>
          <ol className="relative border-l border-line ml-1.5 space-y-3">
            {[...wo.log].reverse().map((l, i) => (
              <li key={i} className="ml-4">
                <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-brand' : 'bg-line-strong'}`} />
                <div className="text-[12.5px] text-fg">{l.text}</div>
                <div className="text-[11px] text-faint">{l.by === 'Sia' ? <span className="text-plum font-semibold"><Sparkles size={10} className="inline" /> Sia</span> : l.by} · {fmtIstTime(l.ts)} {fmtIstDate(l.ts)}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <form className="p-3 border-t border-line bg-surface flex gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { comment(wo.id, note.trim()); setNote(''); } }}>
        <input className="input h-10" placeholder="Add a comment / site update…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" className="btn-primary h-10 w-10 px-0" aria-label="Add comment"><Send size={15} /></button>
      </form>
    </aside>
  );
}

export default function WorkOrders() {
  const snapshot = useLive((s) => s.snapshot);
  const list = useWorkOrders((s) => s.list);
  const openCreate = useWorkOrders((s) => s.openCreate);
  const selectedId = useWorkOrders((s) => s.selectedId);
  const select = useWorkOrders((s) => s.select);
  const [tab, setTab] = useState('active');
  const [cat, setCat] = useState('all');
  const [prio, setPrio] = useState('all');
  const [q, setQ] = useState('');
  const now = snapshot?.ts || Date.now();

  const stats = useMemo(() => {
    const open = list.filter((w) => !['Resolved', 'Closed'].includes(w.status));
    const done = list.filter((w) => w.resolvedAt);
    const dayStart = now - 24 * 3600000;
    return {
      open: open.length,
      inProgress: list.filter((w) => w.status === 'In progress').length,
      overdue: open.filter((w) => slaState(w, now) === 'overdue').length,
      resolved24: done.filter((w) => w.resolvedAt >= dayStart).length,
      sla: done.length ? done.filter((w) => w.resolvedAt <= w.dueAt).length / done.length : 1,
      mttr: done.length ? done.reduce((a, w) => a + (w.resolvedAt - w.createdAt), 0) / done.length / 60000 : 0,
    };
  }, [list, now]);

  const byCat = useMemo(() => WO_CATEGORIES.map((c) => ({
    cat: c.replace(' & ', ' & '), open: list.filter((w) => w.category === c && !['Resolved', 'Closed'].includes(w.status)).length, done: list.filter((w) => w.category === c && ['Resolved', 'Closed'].includes(w.status)).length,
  })).filter((r) => r.open + r.done > 0), [list]);

  const rows = useMemo(() => list.filter((w) => {
    if (tab === 'active' && ['Resolved', 'Closed'].includes(w.status)) return false;
    if (tab === 'overdue' && slaState(w, now) !== 'overdue') return false;
    if (tab === 'done' && !['Resolved', 'Closed'].includes(w.status)) return false;
    if (cat !== 'all' && w.category !== cat) return false;
    if (prio !== 'all' && w.priority !== prio) return false;
    if (q && !`${w.id} ${w.title} ${w.location} ${w.assignee}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (a.priority.localeCompare(b.priority)) || b.createdAt - a.createdAt), [list, tab, cat, prio, q, now]);

  if (!snapshot) return <Loading />;
  const sel = list.find((w) => w.id === selectedId);

  const exportCsv = () => downloadCsv(`HIP-Malur-work-orders-${new Date(now).toISOString().slice(0, 10)}.csv`,
    ['ID', 'Title', 'Category', 'Priority', 'Status', 'Location', 'Assignee', 'Source', 'Raised (IST)', 'SLA due (IST)', 'Resolved (IST)', 'SLA'],
    rows.map((w) => [w.id, w.title, w.category, w.priority, w.status, w.location, w.assignee || '', `${w.source}${w.sourceRef ? ` ${w.sourceRef}` : ''}`, `${fmtIstDate(w.createdAt)} ${fmtIstTime(w.createdAt)}`, `${fmtIstDate(w.dueAt)} ${fmtIstTime(w.dueAt)}`, w.resolvedAt ? `${fmtIstDate(w.resolvedAt)} ${fmtIstTime(w.resolvedAt)}` : '', slaState(w, now)]));

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-[17px] font-semibold">Work order tracker</h2>
          <p className="text-[12.5px] text-faint">Raised manually, from Sia advisories, incidents and sensor faults · HIP Malur FM team</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-outline" onClick={exportCsv}><Download size={15} />Export CSV</button>
          <button type="button" className="btn-primary" onClick={() => openCreate({})}><ClipboardPlus size={15} />New work order</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-4">
        <Stat icon={ClipboardList} label="Open work orders" value={stats.open} sub={`${list.length} total in register`} />
        <Stat icon={Hourglass} label="In progress" value={stats.inProgress} sub="Technician on site" />
        <Stat icon={AlertOctagon} label="Overdue (SLA breached)" value={stats.overdue} tone={stats.overdue ? 'text-crit' : 'text-ok'} sub="Open past due time" />
        <Stat icon={CheckCircle2} label="Resolved · last 24 h" value={stats.resolved24} />
        <Stat icon={Gauge} label="SLA compliance" value={pct(stats.sla)} tone={stats.sla >= 0.9 ? 'text-ok' : stats.sla >= 0.75 ? 'text-warn' : 'text-crit'} sub="Resolved within SLA" />
        <Stat icon={Timer} label="Mean time to resolve" value={mins(stats.mttr)} />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4">
        <Card className="2xl:col-span-2" title="Register" icon={ClipboardList} bodyClass="px-0 pb-0"
          action={<Tabs value={tab} onChange={setTab} tabs={[{ id: 'active', label: 'Active', count: stats.open }, { id: 'overdue', label: 'Overdue', count: stats.overdue }, { id: 'done', label: 'Resolved / closed' }, { id: 'all', label: 'All' }]} />}>
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input className="input h-9 pl-9 text-[13px]" placeholder="Search ID, title, location, assignee" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input h-9 w-auto text-[13px]" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All categories</option>{WO_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="input h-9 w-auto text-[13px]" value={prio} onChange={(e) => setPrio(e.target.value)}><option value="all">All priorities</option>{WO_PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          </div>
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto scroll-thin border-t border-line">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint border-b border-line">
                  <th className="py-2 pl-4 font-semibold">ID</th><th className="font-semibold">Work order</th><th className="font-semibold">Priority</th><th className="font-semibold">Status</th><th className="font-semibold">Assignee</th><th className="font-semibold">SLA</th><th className="font-semibold pr-4">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => {
                  const sla = slaState(w, now);
                  const left = (w.dueAt - now) / 60000;
                  return (
                    <tr key={w.id} onClick={() => select(w.id)} className={`border-b border-line cursor-pointer hover:bg-surface-3 ${selectedId === w.id ? 'bg-brand-soft' : ''}`}>
                      <td className="py-2.5 pl-4 num font-semibold text-muted">{w.id}</td>
                      <td className="max-w-[340px]"><div className="font-semibold truncate">{w.title}</div><div className="text-[11.5px] text-faint truncate">{w.category} · {w.location}</div></td>
                      <td><span className={`chip ${PRIO_STYLE[w.priority]}`}>{w.priority}</span></td>
                      <td><span className={`chip ${STATUS_STYLE[w.status]}`}>{w.status}</span></td>
                      <td className="text-muted">{w.assignee || <span className="text-faint">—</span>}</td>
                      <td className={`num ${SLA_STYLE[sla]}`}>{['met', 'breached'].includes(sla) ? (sla === 'met' ? 'Met' : 'Breached') : left < 0 ? `${mins(-left)} over` : `${mins(left)} left`}</td>
                      <td className="pr-4 text-[11.5px] text-faint whitespace-nowrap">{w.source === 'Sia advisory' ? <span className="text-plum font-semibold">Sia advisory</span> : w.source}<div>{ago(w.createdAt, now)}</div></td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={7} className="py-10 text-center text-faint">No work orders match these filters</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="By category" subtitle="Open vs resolved/closed" icon={Gauge}
          action={<LegendRow items={[{ label: 'Open', color: 'rgb(var(--s2))' }, { label: 'Done', color: 'rgb(var(--s1))' }]} />}>
          <div className="h-[420px]">
            <ResponsiveContainer>
              <BarChart data={byCat} layout="vertical" margin={{ top: 4, right: 12, left: 10, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} />
                <YAxis type="category" dataKey="cat" width={120} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgb(var(--surface-3))' }} content={<ChartTooltip unit=" WOs" />} />
                <Bar dataKey="open" name="Open" stackId="a" fill="rgb(var(--s2))" stroke="rgb(var(--surface))" />
                <Bar dataKey="done" name="Done" stackId="a" fill="rgb(var(--s1))" stroke="rgb(var(--surface))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {sel && <><div className="fixed inset-0 bg-black/25 z-40" onClick={() => select(null)} /><Detail wo={sel} now={now} onClose={() => select(null)} /></>}
    </div>
  );
}
