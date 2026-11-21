import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Truck, Zap, Droplets, AlertTriangle, Gauge, X, ArrowRight, Box, MapPin, Leaf, HardHat, Search, Percent, Timer, HeartPulse, Map as MapIcon } from 'lucide-react';
import { useLive } from '../store/live';
import { useUi } from '../store/ui';
import { PARKS, CLUSTERS, PORTFOLIO_FACTS, STATES } from '../config/parks';
import PortfolioMap from '../map/PortfolioMap';
import { KpiCard, Tabs, Meter, StatusDot, Loading, Sparkline } from '../components/ui';
import { kpiInsight } from '../ai/advisories';
import { fmt, pct, compact, mins } from '../lib/format';

const tone = (lp, meta) => (meta.status === 'construction' ? 'info' : lp.alerts.critical ? 'critical' : lp.health < 80 || lp.alerts.warning >= 3 ? 'warning' : 'ok');

function ParkCard({ id, live, onClose }) {
  const navigate = useNavigate();
  const meta = PARKS.find((p) => p.id === id);
  const lp = live.parks.find((p) => p.id === id);
  const history = useLive((s) => s.history);
  const isMalur = id === 'malur';
  const ops = meta.status === 'operational';
  const stats = [
    { label: 'Trucks today', value: fmt(lp.trucksToday), icon: Truck },
    { label: 'Energy today', value: `${compact(lp.kwhToday)} kWh`, icon: Zap },
    { label: 'Water today', value: `${fmt(lp.klToday)} KL`, icon: Droplets },
    { label: 'Open alerts', value: `${lp.alerts.critical} / ${lp.alerts.warning}`, icon: AlertTriangle, hint: 'critical / warning' },
  ];
  return (
    <div className="absolute left-4 bottom-4 w-[380px] max-w-[calc(100%-2rem)] card shadow-pop p-4 animate-fade-up z-10">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11.5px] text-faint">
            <MapPin size={12} />{CLUSTERS[meta.cluster].name} · {meta.type === 'ILP' ? 'Industrial & Logistics Park' : 'InCity Center'}
          </div>
          <h3 className="text-[18px] font-semibold leading-tight mt-0.5">{isMalur ? 'HIP Malur' : meta.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`chip ${ops ? 'bg-ok/10 text-ok' : 'bg-info/10 text-info'}`}>{ops ? 'Operational' : 'Under construction'}</span>
            {meta.acres && <span className="chip bg-surface-3 text-muted">{meta.acres} acres</span>}
            {meta.type === 'ILP' && <span className="chip bg-surface-3 text-muted">{meta.msf} MN sq ft</span>}
            {meta.igbc && meta.igbc !== '—' && <span className="chip bg-leaf/10 text-leaf"><Leaf size={11} />{meta.igbc}</span>}
          </div>
        </div>
        <button type="button" className="icon-btn -mr-1 -mt-1" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-[11.5px] text-muted mb-1">
            <span>{ops ? 'Occupancy' : 'Construction progress'}</span>
            <span className="num font-semibold text-fg">{pct(ops ? lp.occupancy : lp.progress)}</span>
          </div>
          <Meter value={ops ? lp.occupancy : lp.progress} tone={ops ? 'brand' : 'info'} />
        </div>
        <div className="text-right">
          <div className="text-[11px] text-faint">Health</div>
          <div className={`text-[22px] font-semibold num leading-none ${lp.health >= 85 ? 'text-ok' : lp.health >= 70 ? 'text-warn' : 'text-crit'}`}>{Math.round(lp.health)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-surface-2 border border-line px-2.5 py-2">
            <div className="text-[11px] text-faint flex items-center gap-1"><s.icon size={11} />{s.label}</div>
            <div className="text-[15px] font-semibold num mt-0.5">{s.value}</div>
          </div>
        ))}
      </div>

      {isMalur && (
        <>
          <div className="mt-3">
            <div className="text-[11px] text-faint mb-1">Gate arrivals · last 6 h</div>
            <Sparkline data={history.slice(-72).map((b) => b.arrivals)} height={34} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button type="button" className="btn-primary" onClick={() => navigate('/park/malur')}>Command Center <ArrowRight size={15} /></button>
            <button type="button" className="btn-outline" onClick={() => navigate('/park/malur/twin')}><Box size={15} />3D Digital Twin</button>
          </div>
        </>
      )}
      {!isMalur && meta.address && <p className="text-[11.5px] text-faint mt-2">{meta.address}</p>}
    </div>
  );
}

export default function Portfolio() {
  const snapshot = useLive((s) => s.snapshot);
  const history = useLive((s) => s.history);
  const advisories = useLive((s) => s.advisories);
  const openAdvisory = useUi((s) => s.openAdvisory);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [q, setQ] = useState('');
  const onSelect = useCallback((id) => setSelected(id), []);
  const onStateSelect = useCallback((st) => { setSelected(null); setStateFilter((cur) => (cur === st ? 'all' : st)); }, []);

  const live = snapshot?.portfolio;
  const grouped = useMemo(() => {
    const list = PARKS.filter((p) => (filter === 'all' || p.type === filter) && (stateFilter === 'all' || p.state === stateFilter) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
    return Object.values(CLUSTERS).map((c) => ({ c, parks: list.filter((p) => p.cluster === c.id) })).filter((g) => g.parks.length);
  }, [filter, q, stateFilter]);

  if (!snapshot) return <Loading />;
  const t = live.totals;
  const ins = (k) => kpiInsight(k, snapshot, advisories);

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
        {[
          { key: 'exec-parks', label: 'Parks in network', icon: Building2, value: PORTFOLIO_FACTS.ilpCount, unit: 'I&L parks', sub: `+ ${PORTFOLIO_FACTS.incityCount} InCity centers · ${t.construction} under construction` },
          { key: 'exec-potential', label: 'Development potential', icon: Gauge, value: PORTFOLIO_FACTS.ilpPotentialMsf, unit: 'MSFT', sub: `+ ${PORTFOLIO_FACTS.incityPotentialMsf} MSFT InCity · ${STATES.length} states` },
          { key: 'exec-occupancy', label: 'Portfolio occupancy', icon: Percent, value: pct(t.occupancy, 1), sub: 'Leased share of operational area (area-weighted)', footer: <Meter value={t.occupancy} tone={t.occupancy > 0.9 ? 'ok' : 'warn'} /> },
          { key: 'portfolio-trucks', label: 'Trucks handled today', icon: Truck, value: fmt(t.trucksToday), sub: 'All park gates · since 00:00 IST', spark: history.slice(-48).map((b) => b.arrivals) },
          { key: 'exec-wait', label: 'Avg gate wait (network)', icon: Timer, value: fmt(t.avgWaitMin, 1), unit: 'min', sub: 'Truck-weighted across operational parks' },
          { key: 'exec-energy', label: 'Energy today', icon: Zap, value: fmt(t.kwhToday / 1000, 1), unit: 'MWh', sub: 'HIP-metered common & tenant feeders' },
          { key: 'exec-water', label: 'Water today', icon: Droplets, value: fmt(t.klToday), unit: 'KL', sub: `Malur external dependency ${pct(snapshot.water.today.externalShare)}` },
          { key: 'portfolio-alerts', label: 'Open alerts', icon: AlertTriangle, value: t.critical, unit: `critical · ${t.warning} warning`, sub: `${(snapshot.incidents || []).filter((i) => i.status === 'active').length} live incident(s) at Malur`, tone: t.critical ? 'critical' : undefined },
          { key: 'exec-health', label: 'Network health', icon: HeartPulse, value: Math.round(t.avgHealth), unit: '/ 100', sub: 'Composite of alerts, occupancy & availability', footer: <Meter value={t.avgHealth / 100} tone={t.avgHealth >= 85 ? 'ok' : t.avgHealth >= 70 ? 'warn' : 'crit'} /> },
          { key: 'exec-green', label: 'IGBC Platinum parks', icon: Leaf, value: t.green, unit: `of ${PORTFOLIO_FACTS.ilpCount}`, sub: 'GRESB 2026 Global Sector Leader · 5-star' },
        ].map(({ key, ...x }) => {
          const insight = ins(key);
          return <KpiCard key={key} kpiKey={key} {...x} insight={insight} tone={x.tone || (insight?.severity === 'critical' ? 'critical' : insight?.severity === 'warning' ? 'warning' : undefined)} />;
        })}
      </div>

      <div className="card px-3 py-2.5 flex flex-wrap items-center gap-2">
        <span className="label-xs flex items-center gap-1.5 mr-1"><MapIcon size={12} />State layer</span>
        {['all', ...STATES].map((st) => {
          const n = PARKS.filter((p) => st === 'all' || p.state === st).length;
          return (
            <button key={st} type="button" onClick={() => { setSelected(null); setStateFilter(st); }}
              className={`chip h-7 px-3 text-[12px] border transition ${stateFilter === st ? 'bg-brand text-white border-brand' : 'bg-surface-2 text-muted border-line hover:text-fg'}`}>
              {st === 'all' ? 'All India' : st}<span className={`num ${stateFilter === st ? 'text-white/80' : 'text-faint'}`}>{n}</span>
            </button>
          );
        })}
        {stateFilter !== 'all' && (() => {
          const ids = PARKS.filter((p) => p.state === stateFilter).map((p) => p.id);
          const lp = live.parks.filter((p) => ids.includes(p.id));
          const msf = PARKS.filter((p) => p.state === stateFilter && p.type === 'ILP').reduce((a, p) => a + p.msf, 0);
          return (
            <span className="ml-auto text-[12px] text-muted flex flex-wrap gap-x-4">
              <span><b className="text-fg num">{fmt(msf, 1)}</b> MSFT</span>
              <span><b className="text-fg num">{fmt(lp.reduce((a, p) => a + p.trucksToday, 0))}</b> trucks today</span>
              <span><b className="text-fg num">{Math.round(lp.reduce((a, p) => a + p.health, 0) / Math.max(1, lp.length))}</b> avg health</span>
              <span><b className="text-crit num">{lp.reduce((a, p) => a + p.alerts.critical, 0)}</b> critical</span>
            </span>
          );
        })()}
      </div>

      <div className="card overflow-hidden flex flex-col xl:flex-row h-auto xl:h-[calc(100vh-200px)] min-h-[600px]">
        <div className="relative flex-1 min-h-[460px]">
          <PortfolioMap live={live} selected={selected} onSelect={onSelect} filter={filter} stateFilter={stateFilter} onStateSelect={onStateSelect} />
          <div className="absolute top-3 left-3 card px-3 py-2 shadow-card text-[11.5px] text-muted space-y-1 z-10">
            <div className="font-semibold text-fg text-[12px]">GIS digital twin</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand" />HIP Malur (live twin)</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-ok" />Healthy</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-warn" />Attention</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-crit" />Critical alert</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-faint" />Under construction</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rotate-45 bg-ok ml-0.5 mr-0.5" />InCity center</div>
          </div>
          {selected && <ParkCard id={selected} live={live} onClose={() => setSelected(null)} />}
        </div>

        <aside className="w-full xl:w-[360px] border-t xl:border-t-0 xl:border-l border-line flex flex-col min-h-0">
          <div className="p-3 border-b border-line space-y-2">
            <Tabs value={filter} onChange={setFilter} tabs={[{ id: 'all', label: 'All', count: PARKS.length }, { id: 'ILP', label: 'I&L Parks', count: PORTFOLIO_FACTS.ilpCount }, { id: 'INCITY', label: 'InCity', count: PORTFOLIO_FACTS.incityCount }]} />
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input className="input h-9 pl-9 text-[13px]" placeholder="Search parks" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-2">
            {grouped.map(({ c, parks }) => (
              <div key={c.id} className="mb-2">
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="label-xs">{c.name}</span>
                  <span className="text-[11px] text-faint">{c.state}</span>
                </div>
                {parks.map((p) => {
                  const lp = live.parks.find((x) => x.id === p.id);
                  const tn = tone(lp, p);
                  return (
                    <button key={p.id} type="button" onClick={() => setSelected(p.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition ${selected === p.id ? 'bg-brand-soft' : 'hover:bg-surface-3'}`}>
                      {p.status === 'construction' ? <HardHat size={13} className="text-info shrink-0" /> : <StatusDot status={tn} pulse={tn === 'critical'} />}
                      <span className="flex-1 min-w-0">
                        <span className={`block text-[13px] truncate ${p.featured ? 'font-semibold text-brand' : 'font-medium text-fg'}`}>{p.featured ? 'HIP Malur' : p.name}</span>
                        <span className="block text-[11px] text-faint truncate">{p.type === 'ILP' ? `${p.acres} ac · ${p.msf} MSF` : 'InCity center'}{p.status === 'construction' ? ` · ${pct(lp.progress)} built` : ''}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[12.5px] font-semibold num">{fmt(lp.trucksToday)}</span>
                        <span className="block text-[10.5px] text-faint">trucks</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
