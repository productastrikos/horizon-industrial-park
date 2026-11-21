import { useEffect, useRef } from 'react';
import { VideoOff } from 'lucide-react';
import { fmtIstTime } from '../sim/util';

/**
 * Demo CCTV feeds. Fixed cameras show real Horizon Industrial Parks site
 * photography (public/hip) rendered as a live fixed-camera view; cameras that
 * need motion (gate marshalling, truck bays, public road, incidents) use
 * free-licence Mixkit clips (public/videos). Incidents switch the relevant
 * camera to incident footage.
 */
const vid = (n) => ({ kind: 'video', src: `/videos/${n}.mp4` });
const img = (n) => ({ kind: 'img', src: `/hip/${n}` });

const FIXED = {
  'CAM-G01': vid('gate-marshal'),
  'CAM-G02': img('malur-gate-road.webp'),
  'CAM-G03': img('security-cabin.webp'),
  'CAM-G04': vid('road-truck-approach'),
  'CAM-F01': img('fm-office.webp'),
  'CAM-F02': img('ev-charging.webp'),
  'CAM-U01': vid('ht-panel-room'),
  'CAM-U02': img('utility-yard.png'),
  'CAM-W01': img('water-oht.webp'),
  'CAM-W02': img('fire-water-tanks.webp'),
  'CAM-P01': vid('truck-parking-aerial'),
  'CAM-P02': vid('trailers-parked'),
  'CAM-P03': img('truck-parking.webp'),
  'CAM-P04': img('truck-yard-aerial.webp'),
  'CAM-P05': img('road-curve-lights.webp'),
  'CAM-P06': img('park-signage.webp'),
};
const BUILDING = [vid('truck-arrival'), img('malur-docks.webp'), vid('truck-bay-marshal'), img('malur-solar-warehouse.webp'), img('malur-facade.webp')];
const PERIMETER = [img('perimeter-wall.png'), vid('ht-powerline'), img('road-streetlights.webp'), img('perimeter-powerline.webp'), img('malur-aerial.jpg')];

const INCIDENT_FEEDS = {
  'gate-surge': { 'CAM-G03': img('malur-trucks-road.webp'), 'CAM-G04': img('malur-trucks-road.webp') },
  'grid-fire': { 'CAM-U01': vid('smoke-dark'), 'CAM-U02': vid('smoke-rising'), 'CAM-W02': vid('fire-response') },
  'illegal-parking': { 'CAM-B2': img('truck-parking.webp') },
  'light-outage': { 'CAM-D1': img('night-lights.webp') },
  'water-shortage': { 'CAM-W01': img('water-tanks.webp') },
};

const hash = (s) => s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

export function feedFor(camId, incidents = []) {
  for (const inc of incidents) {
    const f = inc.status === 'active' && INCIDENT_FEEDS[inc.type]?.[camId];
    if (f) return { ...f, incident: inc };
  }
  if (FIXED[camId]) return FIXED[camId];
  const h = hash(camId);
  if (camId.startsWith('CAM-PR')) return PERIMETER[h % PERIMETER.length];
  return BUILDING[h % BUILDING.length];
}

export default function CctvVideo({ cam, incidents, ts, className = '', showLabel = true }) {
  const ref = useRef(null);
  const offline = cam.status && cam.status !== 'online';
  const feed = feedFor(cam.id, incidents);
  const h = hash(cam.id);
  useEffect(() => {
    const v = ref.current;
    if (!v || feed.kind !== 'video') return undefined;
    const onMeta = () => { try { v.currentTime = (h * 7.3) % Math.max(1, v.duration - 1); } catch { /* noop */ } };
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [feed.src, feed.kind, h]);
  return (
    <div className={`relative overflow-hidden rounded-lg bg-black aspect-video border ${feed.incident ? 'border-crit ring-2 ring-crit/50' : offline ? 'border-crit/50' : 'border-line'} ${className}`}>
      {offline ? (
        <div className="absolute inset-0 bg-[#141518] flex flex-col items-center justify-center gap-1">
          <VideoOff size={18} className="text-crit" />
          <span className="text-[10px] font-bold tracking-wider text-crit">{cam.status === 'degraded' ? 'DEGRADED' : 'NO SIGNAL'}</span>
        </div>
      ) : feed.kind === 'video' ? (
        <video key={feed.src} ref={ref} src={feed.src} autoPlay muted loop playsInline preload="auto"
          className="absolute inset-0 h-full w-full object-cover" style={{ filter: 'saturate(.72) contrast(1.08) brightness(.95)' }} />
      ) : (
        <img key={feed.src} src={feed.src} alt="" loading="lazy" draggable={false}
          className="cctv-still absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'saturate(.7) contrast(1.06) brightness(.93)', animationDelay: `-${h % 17}s` }} />
      )}
      {!offline && <div className="cctv-grain absolute inset-0 pointer-events-none" />}
      {!offline && <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.07) 0 1px, transparent 1px 3px)' }} />}
      {!offline && (
        <span className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[9px] font-bold text-white/95 bg-black/40 px-1.5 py-0.5 rounded"><span className="h-1.5 w-1.5 rounded-full bg-crit animate-pulse" />REC</span>
      )}
      {feed.incident && <span className="absolute top-1.5 left-1.5 text-[9px] font-bold text-white bg-crit px-1.5 py-0.5 rounded animate-pulse">INCIDENT · {feed.incident.id}</span>}
      {showLabel && (
        <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-black/60 text-white flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold truncate">{cam.id} · {cam.name}</span>
          <span className="text-[9.5px] num opacity-80">{ts ? fmtIstTime(ts, true) : ''}</span>
        </div>
      )}
    </div>
  );
}
