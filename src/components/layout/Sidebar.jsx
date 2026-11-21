import { NavLink } from 'react-router-dom';
import { Globe2, LayoutDashboard, Box, Truck, Droplets, Zap, ShieldCheck, ChevronsLeft, ChevronsRight, MapPin, ClipboardList } from 'lucide-react';
import { useWorkOrders, slaState } from '../../store/workorders';
import { HipLogo, AstrikosLogo } from '../Brand';
import { useUi } from '../../store/ui';
import { useLive } from '../../store/live';

const NAV = [
  { section: 'Executive', items: [{ to: '/portfolio', label: 'Executive View', icon: Globe2 }] },
  {
    section: 'HIP Malur',
    sub: 'Bengaluru',
    items: [
      { to: '/park/malur', label: 'Command Center', icon: LayoutDashboard, end: true },
      { to: '/park/malur/twin', label: 'Park Digital Twin', icon: Box },
      { to: '/park/malur/gate', label: 'Gate & Logistics', icon: Truck, badge: 'gate' },
      { to: '/park/malur/water', label: 'Water', icon: Droplets, badge: 'water' },
      { to: '/park/malur/energy', label: 'Energy & Lighting', icon: Zap, badge: 'energy' },
      { to: '/park/malur/safety', label: 'Safety & Surveillance', icon: ShieldCheck, badge: 'safety' },
      { to: '/park/malur/work-orders', label: 'Work Orders', icon: ClipboardList, badge: 'wo' },
    ],
  },
];

const BADGE_MODULES = {
  gate: ['gate'],
  water: ['water'],
  energy: ['power', 'lighting', 'ev'],
  safety: ['fire', 'cctv'],
};

export default function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const advisories = useLive((s) => s.advisories);
  const woList = useWorkOrders((s) => s.list);
  const simTs = useLive((s) => s.snapshot?.ts);

  const badgeFor = (key) => {
    if (!key) return null;
    if (key === 'wo') {
      const open = woList.filter((w) => !['Resolved', 'Closed'].includes(w.status));
      if (!open.length) return null;
      return { n: open.length, crit: open.some((w) => slaState(w, simTs || Date.now()) === 'overdue') };
    }
    const list = advisories.filter((a) => BADGE_MODULES[key].includes(a.module) && (a.severity === 'critical' || a.severity === 'warning'));
    if (!list.length) return null;
    const crit = list.some((a) => a.severity === 'critical');
    return { n: list.length, crit };
  };

  return (
    <aside className={`shrink-0 h-full bg-surface border-r border-line flex flex-col transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-[248px]'}`}>
      <div className={`h-16 flex items-center border-b border-line ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        {collapsed ? <img src="/brand/favicon.svg" alt="Horizon Industrial Parks" className="h-8 w-8" /> : <HipLogo className="h-[30px]" />}
      </div>

      <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-5">
        {NAV.map((sec) => (
          <div key={sec.section}>
            {!collapsed ? (
              <div className="px-3 mb-2 flex items-center gap-1.5">
                <span className="label-xs">{sec.section}</span>
                {sec.sub && (
                  <span className="text-[11px] text-faint inline-flex items-center gap-0.5"><MapPin size={10} />{sec.sub}</span>
                )}
              </div>
            ) : <div className="h-px bg-line mx-2 mb-3" />}
            <div className="space-y-1">
              {sec.items.map((it) => {
                const b = badgeFor(it.badge);
                const Icon = it.icon;
                return (
                  <NavLink key={it.to} to={it.to} end={it.end} title={collapsed ? it.label : undefined}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}>
                    <span className="relative">
                      <Icon size={18} />
                      {collapsed && b && <span className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${b.crit ? 'bg-crit' : 'bg-warn'}`} />}
                    </span>
                    {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                    {!collapsed && b && (
                      <span className={`chip ${b.crit ? 'bg-crit/15 text-crit' : 'bg-warn/15 text-warn'} num`}>{b.n}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`border-t border-line ${collapsed ? 'px-2 py-3' : 'px-5 py-4'} space-y-3`}>
        {!collapsed && (
          <div>
            <div className="text-[10.5px] text-faint mb-1.5">Powered by</div>
            <AstrikosLogo className="h-7" />
          </div>
        )}
        <button type="button" onClick={toggle} className="w-full h-8 rounded-lg border border-line text-muted hover:text-fg hover:bg-surface-3 flex items-center justify-center" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
