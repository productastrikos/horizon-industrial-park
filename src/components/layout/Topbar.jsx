import { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Sparkles, Sun, Moon, LogOut, ChevronRight, Thermometer, Radio, Download } from 'lucide-react';
import { useUi } from '../../store/ui';
import { useLive } from '../../store/live';
import { fmtIstTime, fmtIstDate } from '../../sim/util';

const TITLES = {
  '/portfolio': { title: 'Executive View', crumbs: ['Executive'] },
  '/park/malur': { title: 'Command Center', crumbs: ['Executive', 'Bengaluru', 'HIP Malur'] },
  '/park/malur/twin': { title: 'Park Digital Twin', crumbs: ['Executive', 'Bengaluru', 'HIP Malur'] },
  '/park/malur/gate': { title: 'Gate & Logistics', crumbs: ['Executive', 'Bengaluru', 'HIP Malur'] },
  '/park/malur/water': { title: 'Water Management', crumbs: ['Executive', 'Bengaluru', 'HIP Malur'] },
  '/park/malur/energy': { title: 'Energy & Lighting', crumbs: ['Executive', 'Bengaluru', 'HIP Malur'] },
  '/park/malur/safety': { title: 'Safety & Surveillance', crumbs: ['Executive', 'Bengaluru', 'HIP Malur'] },
  '/park/malur/work-orders': { title: 'Work Orders', crumbs: ['Executive', 'Bengaluru', 'HIP Malur'] },
};

function LiveChip() {
  const snapshot = useLive((s) => s.snapshot);
  const receivedAt = useLive((s) => s.receivedAt);
  const status = useLive((s) => s.status);
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const age = receivedAt ? Math.max(0, Math.round((Date.now() - receivedAt) / 1000)) : null;
  const simNow = snapshot ? snapshot.ts + (Date.now() - receivedAt) : Date.now();
  return (
    <div className="hidden md:flex items-center gap-3 h-9 pl-3 pr-3.5 rounded-lg border border-line bg-surface-2">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full ${status === 'live' ? 'bg-ok' : 'bg-warn'} animate-ping opacity-60`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${status === 'live' ? 'bg-ok' : 'bg-warn'}`} />
        </span>
        <span className="text-[11px] font-bold tracking-wider text-ok">{status === 'live' ? 'LIVE' : 'SYNC'}</span>
      </span>
      <span className="text-[13px] font-semibold text-fg num">{fmtIstTime(simNow, true)} <span className="text-faint font-medium">IST</span></span>
      <span className="text-[12px] text-faint hidden xl:inline">{fmtIstDate(simNow)}</span>
      {age != null && (
        <span className="text-[11px] text-faint hidden lg:inline-flex items-center gap-1"><Radio size={11} />{age <= 1 ? 'just now' : `${age}s ago`}</span>
      )}
    </div>
  );
}

function AdvisoryButton() {
  const advisories = useLive((s) => s.advisories);
  const open = useUi((s) => s.openAdvisory);
  const crit = advisories.filter((a) => a.severity === 'critical').length;
  const warn = advisories.filter((a) => a.severity === 'warning').length;
  return (
    <button type="button" onClick={() => open(null)} className="relative inline-flex items-center gap-2 h-9 pl-3 pr-3.5 rounded-lg text-white font-semibold text-[13px] bg-plum shadow-card hover:brightness-110 transition">
      <Sparkles size={15} />
      <span className="hidden sm:inline">Sia AI Advisory</span>
      <span className="inline-flex items-center gap-1 ml-0.5">
        {crit > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white text-crit text-[11px] font-bold flex items-center justify-center num">{crit}</span>}
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white/25 text-white text-[11px] font-bold flex items-center justify-center num">{advisories.length}</span>
      </span>
      {crit > 0 && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-crit ring-2 ring-surface animate-pulse" />}
      <span className="sr-only">{crit} critical, {warn} warning</span>
    </button>
  );
}

function UserMenu() {
  const user = useUi((s) => s.user);
  const logout = useUi((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg hover:bg-surface-3">
        <span className="h-7 w-7 rounded-full bg-brand text-white text-[12px] font-bold flex items-center justify-center">A</span>
        <span className="hidden xl:block text-left leading-tight">
          <span className="block text-[12.5px] font-semibold text-fg">{user?.name}</span>
          <span className="block text-[10.5px] text-faint">{user?.role}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-52 card shadow-pop p-1.5 z-50 animate-fade-up">
          <div className="px-2.5 py-2 border-b border-line mb-1">
            <div className="text-[13px] font-semibold">{user?.name}</div>
            <div className="text-[11px] text-faint">{user?.role}</div>
          </div>
          <button type="button" onClick={logout} className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] text-muted hover:text-crit hover:bg-crit/10">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Topbar() {
  const { pathname } = useLocation();
  const meta = TITLES[pathname] || TITLES['/portfolio'];
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const env = useLive((s) => s.snapshot?.env);
  return (
    <header className="h-16 shrink-0 border-b border-line bg-surface/90 backdrop-blur flex items-center gap-4 px-5 z-20">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[11.5px] text-faint">
          {meta.crumbs.map((c, i) => (
            <span key={c} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={11} />}
              {c === 'Executive' && pathname !== '/portfolio' ? <Link to="/portfolio" className="hover:text-brand">{c}</Link> : <span>{c}</span>}
            </span>
          ))}
        </div>
        <h1 className="text-[19px] font-semibold text-fg leading-tight truncate">{meta.title}</h1>
      </div>
      {env && (
        <div className="hidden 2xl:flex items-center gap-1.5 text-[12.5px] text-muted">
          <Thermometer size={14} className="text-faint" />
          <span className="num">{env.ambientC.toFixed(0)}°C</span>
          <span className="text-faint">· RH {env.humidity.toFixed(0)}%</span>
        </div>
      )}
      <LiveChip />
      <button type="button" onClick={() => useUi.getState().setExportOpen(true)} className="btn-outline h-9" title="Export report"><Download size={15} /><span className="hidden lg:inline">Export</span></button>
      <AdvisoryButton />
      <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <UserMenu />
    </header>
  );
}
