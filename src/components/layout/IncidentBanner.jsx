import { useNavigate, useLocation } from 'react-router-dom';
import { Siren, Box, Sparkles } from 'lucide-react';
import { useLive } from '../../store/live';
import { useUi } from '../../store/ui';
import { ago } from '../../lib/format';

/** Red strip listing live critical incidents — visible on every screen. */
export default function IncidentBanner() {
  const incidents = useLive((s) => s.snapshot?.incidents);
  const ts = useLive((s) => s.snapshot?.ts);
  const openAdvisory = useUi((s) => s.openAdvisory);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = (incidents || []).filter((i) => i.status === 'active');
  if (!active.length) return null;
  return (
    <div className="shrink-0 bg-crit text-white px-5 py-1.5 flex items-center gap-3 overflow-hidden z-10">
      <span className="flex items-center gap-1.5 font-bold text-[12px] tracking-wider shrink-0"><Siren size={15} className="animate-pulse" />LIVE INCIDENTS · {active.length}</span>
      <div className="flex-1 min-w-0 flex items-center gap-5 overflow-x-auto scroll-thin">
        {active.map((i) => (
          <span key={i.id} className="flex items-center gap-2 text-[12.5px] whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
            <b className="font-semibold">{i.title}</b>
            <span className="text-white/80">· {ago(i.startedAt, ts)}</span>
          </span>
        ))}
      </div>
      <button type="button" onClick={() => openAdvisory(`incident-${active[0].type}`)} className="shrink-0 h-7 px-2.5 rounded-md bg-white/15 hover:bg-white/25 text-[12px] font-semibold flex items-center gap-1.5"><Sparkles size={13} />Sia SOP</button>
      {pathname !== '/park/malur/twin' && (
        <button type="button" onClick={() => navigate('/park/malur/twin')} className="shrink-0 h-7 px-2.5 rounded-md bg-white text-crit text-[12px] font-semibold flex items-center gap-1.5"><Box size={13} />View in twin</button>
      )}
    </div>
  );
}
