import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { BUILDINGS, TENANT_BY_ID } from '../config/malur';
import { useTwin } from './store';
import { useLive } from '../store/live';

const H = 12;

function dockSlots(b) {
  const along = b.dockSide.includes('x') ? b.d : b.w;
  const n = Math.min(b.docks, Math.floor((along - 12) / 4.6));
  const sign = b.dockSide.startsWith('-') ? -1 : 1;
  const slots = [];
  for (let i = 0; i < n; i++) {
    const t = -along / 2 + 6 + (i + 0.5) * ((along - 12) / n);
    slots.push(b.dockSide.includes('x') ? { lx: sign * (b.w / 2), lz: t, axis: 'x', sign } : { lx: t, lz: sign * (b.d / 2), axis: 'z', sign });
  }
  return slots;
}
export const DOCK_SLOTS = Object.fromEntries(BUILDINGS.map((b) => [b.id, dockSlots(b)]));

function Docks({ b, pal }) {
  const ref = useRef();
  const slots = DOCK_SLOTS[b.id];
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    slots.forEach((s, i) => {
      const off = 0.25 * s.sign;
      const p = s.axis === 'x' ? new THREE.Vector3(s.lx + off, 2, s.lz) : new THREE.Vector3(s.lx, 2, s.lz + off);
      const sc = s.axis === 'x' ? new THREE.Vector3(0.4, 1, 3.2) : new THREE.Vector3(3.2, 1, 0.4);
      m.compose(p, q, sc);
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [slots]);
  return (
    <instancedMesh ref={ref} args={[null, null, slots.length]}>
      <boxGeometry args={[1, 3.6, 1]} />
      <meshStandardMaterial color={pal.dock} />
    </instancedMesh>
  );
}

function Block({ b, pal, showLabels, live }) {
  const select = useTwin((s) => s.select);
  const hover = useTwin((s) => s.hover);
  const hovered = useTwin((s) => s.hovered);
  const selected = useTwin((s) => s.selected);
  const isHot = hovered === `b:${b.id}` || (selected?.type === 'building' && selected.id === b.id);
  const t = TENANT_BY_ID[b.tenant];
  const cellLines = useMemo(() => {
    if (!b.cells || b.cells.length < 2) return [];
    let acc = -b.w / 2;
    return b.cells.slice(0, -1).map((c) => { acc += c.w; return acc; });
  }, [b]);
  const tl = live?.tenants?.[b.tenant];
  const share = b.docks / t.docks;
  const docked = tl ? Math.round(tl.dock * share) : 0;

  return (
    <group position={[b.cx, 0, b.cz]} rotation={[0, b.rot, 0]}>
      <group
        onPointerOver={(e) => { e.stopPropagation(); hover(`b:${b.id}`); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { hover(null); document.body.style.cursor = ''; }}
        onClick={(e) => { e.stopPropagation(); select({ type: 'building', id: b.id }); }}
      >
        <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[b.w, H, b.d]} />
          <meshStandardMaterial color={pal.wall} roughness={0.7} />
        </mesh>
        <mesh position={[0, H - 1.6, 0]}>
          <boxGeometry args={[b.w + 0.3, 1.4, b.d + 0.3]} />
          <meshStandardMaterial color={pal.band} roughness={0.6} />
        </mesh>
        <mesh position={[0, H + 0.25, 0]} castShadow>
          <boxGeometry args={[b.w + 1.2, 0.5, b.d + 1.2]} />
          <meshStandardMaterial color={isHot ? pal.roofHover : pal.roof} roughness={0.45} metalness={0.25} />
        </mesh>
        <mesh position={[0, H + 0.7, 0]}>
          <boxGeometry args={b.w >= b.d ? [b.w, 0.4, 1.2] : [1.2, 0.4, b.d]} />
          <meshStandardMaterial color={pal.roof} roughness={0.4} metalness={0.3} />
        </mesh>
        {cellLines.map((x) => (
          <mesh key={x} position={[x, H + 0.55, 0]}>
            <boxGeometry args={[0.8, 0.3, b.d + 1.2]} />
            <meshStandardMaterial color={pal.dock} />
          </mesh>
        ))}
        <Docks b={b} pal={pal} />
      </group>
      {showLabels && (
        <Html position={[0, H + 10, 0]} center zIndexRange={[20, 0]}>
          <button type="button" onClick={() => select({ type: 'building', id: b.id })}
            className={`twin-tag ${isHot ? 'is-hot' : ''}`}>
            <span className="twin-tag-title">{b.name}</span>
            <span className="twin-tag-sub"><i style={{ background: `rgb(var(--${t.slot}))` }} />{t.id === 'others' ? `${b.msf} MSFT` : t.name}{docked ? ` · ${docked} docked` : ''}</span>
          </button>
        </Html>
      )}
    </group>
  );
}

export default function Buildings({ pal, showLabels }) {
  const live = useLive((s) => s.snapshot?.gate);
  return BUILDINGS.map((b) => <Block key={b.id} b={b} pal={pal} showLabels={showLabels} live={live} />);
}
