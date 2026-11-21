import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { PARKS } from '../config/parks';
import { BUILDINGS, BOUNDARY, ROADS, PARKING_ZONES, buildingToWorld, localToLngLat, TENANT_BY_ID } from '../config/malur';
import { useUi } from '../store/ui';

// One basemap for both themes; dark theme renders it through a canvas filter
// (pins/labels are DOM and stay unfiltered).
const BASEMAP = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const INDIA = [[68.0, 7.5], [92.0, 30.5]];

const healthTone = (p) => (!p ? 'ok' : p.alerts.critical > 0 ? 'crit' : p.health < 80 || p.alerts.warning >= 3 ? 'warn' : 'ok');

/* ---------------- Malur footprint (GeoJSON from the site layout) */
function malurGeo() {
  const ring = (pts) => [...pts.map(([x, z]) => localToLngLat(x, z)), localToLngLat(pts[0][0], pts[0][1])];
  const rect = (cx, cz, w, d, rot) => {
    const b = { cx, cz, rot };
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, lz]) => buildingToWorld(b, lx, lz));
  };
  const buildings = BUILDINGS.map((b) => ({
    type: 'Feature',
    properties: { id: b.id, name: `${b.name} · ${TENANT_BY_ID[b.tenant].name}`, h: 12, tenant: b.tenant },
    geometry: { type: 'Polygon', coordinates: [ring(rect(b.cx, b.cz, b.w, b.d, b.rot))] },
  }));
  const parking = PARKING_ZONES.map((p) => ({ type: 'Feature', properties: { id: p.id }, geometry: { type: 'Polygon', coordinates: [ring(rect(p.cx, p.cz, p.w, p.d, p.rot))] } }));
  const boundary = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring(BOUNDARY)] } };
  const roads = ROADS.map((r) => ({ type: 'Feature', properties: { w: r.w }, geometry: { type: 'LineString', coordinates: r.pts.map(([x, z]) => localToLngLat(x, z)) } }));
  return {
    buildings: { type: 'FeatureCollection', features: buildings },
    parking: { type: 'FeatureCollection', features: parking },
    boundary: { type: 'FeatureCollection', features: [boundary] },
    roads: { type: 'FeatureCollection', features: roads },
  };
}
const MALUR_GEO = malurGeo();

function addStateLayers(map) {
  if (map.getSource('hip-states')) return;
  map.addSource('hip-states', { type: 'geojson', data: '/geo/hip-states.geojson' });
  map.addLayer({ id: 'states-fill', type: 'fill', source: 'hip-states', paint: { 'fill-color': '#F47922', 'fill-opacity': 0.05 } });
  map.addLayer({ id: 'states-line', type: 'line', source: 'hip-states', paint: { 'line-color': '#F47922', 'line-width': 1, 'line-opacity': 0.45 } });
}

function paintStates(map, state) {
  if (!map.getLayer('states-fill')) return;
  const sel = ['==', ['get', 'state'], state || '__none__'];
  map.setPaintProperty('states-fill', 'fill-opacity', state ? ['case', sel, 0.16, 0.025] : 0.05);
  map.setPaintProperty('states-line', 'line-width', state ? ['case', sel, 2.4, 0.8] : 1);
  map.setPaintProperty('states-line', 'line-opacity', state ? ['case', sel, 0.95, 0.3] : 0.45);
}

function addMalurLayers(map, dark) {
  // light-theme hexes; the dark theme is produced by the canvas filter
  const brand = '#F47922';
  const [s1, s2, s3, s4] = ['#2a78d6', '#eb6834', '#8f53a1', '#1baf7a'];
  Object.entries(MALUR_GEO).forEach(([k, data]) => { if (!map.getSource(`malur-${k}`)) map.addSource(`malur-${k}`, { type: 'geojson', data }); });
  const minzoom = 12.5;
  if (!map.getLayer('malur-boundary-fill')) {
    map.addLayer({ id: 'malur-boundary-fill', type: 'fill', source: 'malur-boundary', minzoom, paint: { 'fill-color': dark ? '#16301f' : '#e3f1df', 'fill-opacity': 0.75 } });
    map.addLayer({ id: 'malur-boundary-line', type: 'line', source: 'malur-boundary', minzoom, paint: { 'line-color': brand, 'line-width': 2, 'line-dasharray': [2, 1.5] } });
    map.addLayer({ id: 'malur-roads', type: 'line', source: 'malur-roads', minzoom, paint: { 'line-color': dark ? '#55555f' : '#c9c8c2', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 17, 9] } });
    map.addLayer({ id: 'malur-parking', type: 'fill', source: 'malur-parking', minzoom, paint: { 'fill-color': dark ? '#3a3a44' : '#d9d6cf', 'fill-opacity': 0.9 } });
    map.addLayer({
      id: 'malur-buildings', type: 'fill-extrusion', source: 'malur-buildings', minzoom,
      paint: {
        'fill-extrusion-color': ['match', ['get', 'tenant'], 'amazon', s1, 'flipkart', s2, 'decathlon', s3, s4],
        'fill-extrusion-height': ['*', ['get', 'h'], 3],
        'fill-extrusion-opacity': 0.85,
      },
    });
  }
}

export default function PortfolioMap({ live, selected, onSelect, filter, stateFilter = 'all', onStateSelect }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const theme = useUi((s) => s.theme);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onStateRef = useRef(onStateSelect);
  onStateRef.current = onStateSelect;

  // init
  useEffect(() => {
    const map = new maplibregl.Map({
      container: ref.current,
      style: BASEMAP,
      bounds: INDIA,
      fitBoundsOptions: { padding: 30 },
      attributionControl: { compact: true },
      dragRotate: true,
      maxPitch: 70,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.on('load', () => {
      addStateLayers(map);
      addMalurLayers(map, false);
      map.on('click', 'states-fill', (e) => { const st = e.features?.[0]?.properties?.state; if (st && onStateRef.current) onStateRef.current(st); });
      map.on('mouseenter', 'states-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'states-fill', () => { map.getCanvas().style.cursor = ''; });
      setReady(true);
    });
    map.on('error', (e) => { if (String(e?.error?.message || '').match(/Failed to fetch|NetworkError|style/i)) setFailed(true); });
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; markersRef.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    PARKS.forEach((p) => {
      const visible = (filter === 'all' || filter === p.type) && (stateFilter === 'all' || p.state === stateFilter);
      let m = markersRef.current[p.id];
      if (!m) {
        const el = document.createElement('button');
        el.type = 'button';
        el.setAttribute('aria-label', p.name);
        el.className = 'hip-pin';
        el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(p.id); });
        m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
        markersRef.current[p.id] = m;
      }
      const el = m.getElement();
      const lp = live?.parks.find((x) => x.id === p.id);
      const tone = p.status === 'construction' ? 'build' : healthTone(lp);
      el.style.display = visible ? '' : 'none';
      el.dataset.tone = tone;
      el.dataset.type = p.type;
      el.dataset.featured = p.featured ? '1' : '0';
      el.dataset.selected = selected === p.id ? '1' : '0';
      el.title = `${p.name}${lp ? ` · health ${Math.round(lp.health)}` : ''}`;
      el.innerHTML = `<span class="hip-pin-ring"></span><span class="hip-pin-dot"></span>${p.featured || selected === p.id ? `<span class="hip-pin-label">${p.name}</span>` : ''}`;
    });
  }, [live, selected, filter, onSelect, stateFilter]);

  // state layer + zoom to state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    paintStates(map, stateFilter === 'all' ? null : stateFilter);
    if (selected) return;
    if (stateFilter === 'all') { map.setPadding({ top: 0, left: 0, right: 0, bottom: 0 }); map.fitBounds(INDIA, { padding: 30, pitch: 0, bearing: 0, duration: 1200 }); return; }
    const ps = PARKS.filter((p) => p.state === stateFilter);
    const lngs = ps.map((p) => p.lng); const lats = ps.map((p) => p.lat);
    map.fitBounds([[Math.min(...lngs) - 0.6, Math.min(...lats) - 0.6], [Math.max(...lngs) + 0.6, Math.max(...lats) + 0.6]], { padding: 60, pitch: 0, bearing: 0, maxZoom: 9, duration: 1400 });
  }, [stateFilter, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // fly to selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!selected) {
      map.setPadding({ top: 0, left: 0, right: 0, bottom: 0 });
      if (stateFilter === 'all') map.fitBounds(INDIA, { padding: 30, pitch: 0, bearing: 0, duration: 1200 });
      return;
    }
    const p = PARKS.find((x) => x.id === selected);
    const padding = { left: Math.min(400, map.getContainer().clientWidth * 0.45), top: 20, right: 20, bottom: 20 };
    if (p.id === 'malur') map.flyTo({ center: [p.lng - 0.0005, p.lat + 0.0008], zoom: 15.1, pitch: 58, bearing: -18, padding, duration: 2600, essential: true });
    else map.flyTo({ center: [p.lng, p.lat], zoom: p.type === 'INCITY' ? 12 : 11, pitch: 30, bearing: 0, padding, duration: 2000, essential: true });
  }, [selected]);

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className={`absolute inset-0 ${theme === 'dark' ? 'hip-map-dark' : ''}`} data-ready={ready ? '1' : '0'} />
      {failed && (
        <div className="absolute inset-x-4 top-4 rounded-lg border border-warn/30 bg-surface px-3 py-2 text-[12px] text-warn shadow-card">
          Basemap tiles could not be loaded (offline?). Park pins remain interactive.
        </div>
      )}
      <style>{`
        .hip-map-dark .maplibregl-canvas { filter: invert(1) hue-rotate(180deg) brightness(.92) contrast(.88) saturate(.75); }
        .hip-pin { width: 16px; height: 16px; border: 0; padding: 0; background: transparent; cursor: pointer; }
        .hip-pin-dot { position: absolute; inset: 3px; border-radius: 9999px; background: rgb(var(--ok)); box-shadow: 0 0 0 2px rgb(var(--surface)); transition: transform .2s; }
        .hip-pin[data-type="INCITY"] .hip-pin-dot { inset: 4px; border-radius: 2px; transform: rotate(45deg); }
        .hip-pin[data-tone="warn"] .hip-pin-dot { background: rgb(var(--warn)); }
        .hip-pin[data-tone="crit"] .hip-pin-dot { background: rgb(var(--crit)); }
        .hip-pin[data-tone="build"] .hip-pin-dot { background: rgb(var(--surface)); box-shadow: 0 0 0 2px rgb(var(--fg-faint)) inset, 0 0 0 2px rgb(var(--surface)); }
        .hip-pin[data-featured="1"] { width: 22px; height: 22px; }
        .hip-pin[data-featured="1"] .hip-pin-dot { inset: 4px; background: rgb(var(--brand)); }
        .hip-pin[data-featured="1"][data-tone="crit"] .hip-pin-dot { background: rgb(var(--brand)); box-shadow: 0 0 0 2px rgb(var(--surface)), 0 0 0 4px rgb(var(--crit)); }
        .hip-pin-ring { position: absolute; inset: 0; border-radius: 9999px; display: none; }
        .hip-pin[data-featured="1"] .hip-pin-ring, .hip-pin[data-tone="crit"] .hip-pin-ring { display: block; background: rgb(var(--brand) / .45); animation: pulseRing 1.8s ease-out infinite; }
        .hip-pin[data-tone="crit"]:not([data-featured="1"]) .hip-pin-ring { background: rgb(var(--crit) / .45); }
        .hip-pin[data-selected="1"] .hip-pin-dot { transform: scale(1.35); box-shadow: 0 0 0 2px rgb(var(--surface)), 0 0 0 4px rgb(var(--fg)); }
        .hip-pin:hover .hip-pin-dot { transform: scale(1.3); }
        .hip-pin-label { position: absolute; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%); white-space: nowrap; font: 600 12px Barlow, sans-serif; color: rgb(var(--fg)); background: rgb(var(--surface)); border: 1px solid rgb(var(--border)); border-radius: 6px; padding: 2px 7px; box-shadow: var(--shadow-card); pointer-events: none; }
      `}</style>
    </div>
  );
}
