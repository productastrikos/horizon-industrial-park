import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { STREET_LIGHTS, CAMERAS, POWER, WATER, FACILITIES, GATE } from '../config/malur';
import { useLive } from '../store/live';
import { useTwin } from './store';
import { Pulse } from './Vehicles';

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpC = new THREE.Color();
const fac = (id) => FACILITIES.find((f) => f.id === id);

function Tag({ position, title, sub, tone, onClick }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]}>
      <button type="button" className="twin-tag" onClick={onClick}>
        <span className="twin-tag-title">{title}</span>
        {sub && <span className={`twin-tag-sub ${tone ? `tone-${tone}` : ''}`}>{sub}</span>}
      </button>
    </Html>
  );
}

/* ----------------------------------------------------------- street lights */
export function StreetLights({ pal, night }) {
  const lights = useLive((s) => s.snapshot?.power.lights);
  const select = useTwin((s) => s.select);
  const poles = useRef();
  const heads = useRef();
  const pools = useRef();
  const N = STREET_LIGHTS.length;

  useLayoutEffect(() => {
    if (!heads.current.instanceColor) heads.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    STREET_LIGHTS.forEach((l, i) => {
      tmpM.compose(new THREE.Vector3(l.x, 4.5, l.z), tmpQ, new THREE.Vector3(1, 1, 1));
      poles.current.setMatrixAt(i, tmpM);
      tmpM.compose(new THREE.Vector3(l.x, 9.2, l.z), tmpQ, new THREE.Vector3(1, 1, 1));
      heads.current.setMatrixAt(i, tmpM);
    });
    poles.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
  }, [N]);

  const faulty = useMemo(() => (lights || []).map((l, i) => ({ ...l, meta: STREET_LIGHTS[i] })).filter((l) => l.status !== 'ok'), [lights]);

  useFrame(({ clock }) => {
    if (!lights || !heads.current) return;
    const blink = Math.sin(clock.elapsedTime * 14) > 0;
    let k = 0;
    lights.forEach((l, i) => {
      let c = l.on ? pal.lampOn : pal.lampOff;
      if (l.status === 'fault') c = pal.crit;
      if (l.status === 'flicker') c = l.on && blink ? pal.lampOn : pal.warn;
      if (l.status === 'dayburn') c = pal.brand;
      heads.current.setColorAt(i, tmpC.set(c));
      if (pools.current) {
        const show = night && l.on && l.status === 'ok';
        const meta = STREET_LIGHTS[i];
        tmpM.compose(new THREE.Vector3(meta.x, 0.3, meta.z), tmpQ, new THREE.Vector3(show ? 1 : 0.0001, 1, show ? 1 : 0.0001));
        pools.current.setMatrixAt(i, tmpM);
        k += 1;
      }
    });
    heads.current.instanceColor.needsUpdate = true;
    if (pools.current && k) pools.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={poles} args={[null, null, N]} frustumCulled={false}>
        <cylinderGeometry args={[0.18, 0.28, 9, 6]} />
        <meshStandardMaterial color={pal.pole} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[null, null, N]} frustumCulled={false}
        onClick={(e) => { e.stopPropagation(); select({ type: 'light', id: STREET_LIGHTS[e.instanceId].id }); }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
        <sphereGeometry args={[1.5, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[null, null, N]} frustumCulled={false}>
        <cylinderGeometry args={[13, 13, 0.05, 24]} />
        <meshBasicMaterial color="#ffcf70" transparent opacity={0.16} depthWrite={false} />
      </instancedMesh>
      {faulty.map((l) => (
        <group key={l.id} onClick={(e) => { e.stopPropagation(); select({ type: 'light', id: l.id }); }}>
          <Pulse x={l.meta.x} z={l.meta.z} color={l.status === 'dayburn' ? pal.brand : pal.crit} r={10} />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ CCTV */
export function Cameras({ pal }) {
  const cams = useLive((s) => s.snapshot?.safety.cams);
  const select = useTwin((s) => s.select);
  const heads = useRef();
  const N = CAMERAS.length;
  useLayoutEffect(() => {
    if (!heads.current.instanceColor) heads.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    CAMERAS.forEach((c, i) => {
      tmpM.compose(new THREE.Vector3(c.x, 6.5, c.z), tmpQ, new THREE.Vector3(1, 1, 1));
      heads.current.setMatrixAt(i, tmpM);
    });
    heads.current.instanceMatrix.needsUpdate = true;
  }, [N]);
  useLayoutEffect(() => {
    if (!cams) return;
    cams.forEach((c, i) => heads.current.setColorAt(i, tmpC.set(c.status === 'online' ? pal.info : c.status === 'degraded' ? pal.warn : pal.crit)));
    heads.current.instanceColor.needsUpdate = true;
  }, [cams, pal]);
  const offline = (cams || []).filter((c) => c.status !== 'online');
  return (
    <group>
      <instancedMesh ref={heads} args={[null, null, N]} frustumCulled={false}
        onClick={(e) => { e.stopPropagation(); select({ type: 'camera', id: CAMERAS[e.instanceId].id }); }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
        <coneGeometry args={[2, 4.2, 4]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      {offline.map((c) => (
        <group key={c.id} onClick={(e) => { e.stopPropagation(); select({ type: 'camera', id: c.id }); }}>
          <Pulse x={c.x} z={c.z} color={c.status === 'degraded' ? pal.warn : pal.crit} r={9} />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- utilities */
function Box({ p, s, color, onClick, ...rest }) {
  return (
    <mesh position={p} castShadow receiveShadow onClick={onClick} {...rest}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

function WaterTank({ t, level, pal, onClick }) {
  const pct = level?.pct ?? 0.5;
  const color = t.kind === 'fire' ? pal.fire : t.kind === 'treated' ? '#3fb28f' : pal.water;
  if (t.shape === 'cyl') {
    return (
      <group position={[t.x, 0, t.z]} onClick={onClick}>
        <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[t.r * 0.25, t.r * 0.3, 3, 8]} /><meshStandardMaterial color={pal.pole} /></mesh>
        <mesh position={[0, 3 + t.h / 2, 0]}>
          <cylinderGeometry args={[t.r, t.r, t.h, 28, 1, true]} />
          <meshStandardMaterial color="#d7dde3" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 3 + (t.h * pct) / 2, 0]} scale={[1, Math.max(0.02, pct), 1]}>
          <cylinderGeometry args={[t.r * 0.94, t.r * 0.94, t.h, 28]} />
          <meshStandardMaterial color={color} transparent opacity={0.85} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[t.x, 0, t.z]} onClick={onClick}>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[t.w, 1.8, t.d]} />
        <meshStandardMaterial color={t.kind === 'fire' ? '#b8584f' : '#9aa3ab'} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.2 + 1.5 * pct, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[t.w - 1, t.d - 1]} />
        <meshStandardMaterial color={color} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function Borewell({ b, st, pal, onClick }) {
  const ripple = useRef();
  useFrame(({ clock }) => {
    if (!ripple.current) return;
    const t = (clock.elapsedTime * 0.7) % 1;
    ripple.current.scale.setScalar(0.5 + t * 1.5);
    ripple.current.material.opacity = st?.running ? 0.6 * (1 - t) : 0;
  });
  const color = st?.tripped ? pal.crit : st?.running ? pal.water : pal.lampOff;
  return (
    <group position={[b.x, 0, b.z]} onClick={onClick}>
      <mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[3.5, 3.2, 3.5]} /><meshStandardMaterial color="#9aa3ab" /></mesh>
      <mesh position={[0, 3.6, 0]}><cylinderGeometry args={[0.9, 0.9, 0.8, 12]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh ref={ripple} position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4, 5, 32]} />
        <meshBasicMaterial color={pal.water} transparent opacity={0} depthWrite={false} />
      </mesh>
      {st?.tripped && <Pulse x={0} z={0} color={pal.crit} r={8} />}
    </group>
  );
}

export function Utilities({ pal, showLabels }) {
  const power = useLive((s) => s.snapshot?.power);
  const water = useLive((s) => s.snapshot?.water);
  const select = useTwin((s) => s.select);
  const uy = fac('UY');
  const wz = fac('WZ');
  const dg = POWER.fireDg;
  const sel = (type, id) => (e) => { e.stopPropagation(); select({ type, id }); };
  const trColor = (lp) => (lp > 0.95 ? pal.crit : lp > 0.85 ? pal.warn : '#6f8f7a');
  return (
    <group>
      {/* power yard */}
      <mesh position={[uy.x, 0.2, uy.z]} receiveShadow onClick={sel('yard', 'UY')}>
        <boxGeometry args={[uy.w, 0.3, uy.d]} />
        <meshStandardMaterial color={pal.apron} />
      </mesh>
      <Box p={[POWER.incomer.x, 2, POWER.incomer.z]} s={[10, 4, 5]} color="#7d8590" onClick={sel('incomer', 'HT-11')} />
      {POWER.transformers.map((t) => (
        <group key={t.id} onClick={sel('transformer', t.id)}>
          <Box p={[t.x, 2.6, t.z]} s={[6, 5.2, 5]} color={trColor(power?.tr[t.id]?.loadPct || 0)} />
          {[-1, 1].map((k) => <Box key={k} p={[t.x + k * 3.4, 2.4, t.z]} s={[0.6, 4.4, 4.4]} color="#596069" />)}
          {showLabels && <Tag position={[t.x, 9, t.z]} title={t.id} sub={power ? `${Math.round(power.tr[t.id].loadPct * 100)}% load` : ''} tone={power?.tr[t.id].loadPct > 0.85 ? 'warn' : 'ok'} onClick={sel('transformer', t.id)} />}
        </group>
      ))}

      {/* water & fire zone */}
      <mesh position={[wz.x, 0.15, wz.z]} receiveShadow>
        <boxGeometry args={[wz.w, 0.2, wz.d]} />
        <meshStandardMaterial color={pal.apron} />
      </mesh>
      {WATER.tanks.map((t) => <WaterTank key={t.id} t={t} level={water?.levels[t.id]} pal={pal} onClick={sel('tank', t.id)} />)}
      {WATER.borewells.map((b) => <Borewell key={b.id} b={b} st={water?.borewells[b.id]} pal={pal} onClick={sel('borewell', b.id)} />)}
      <group onClick={sel('stp', 'STP')}>
        <Box p={[WATER.stp.x, 1.8, WATER.stp.z]} s={[WATER.stp.w, 3.6, WATER.stp.d]} color="#8fae9c" />
        {[-8, 0, 8].map((k) => (
          <mesh key={k} position={[WATER.stp.x + k, 4, WATER.stp.z]}><cylinderGeometry args={[3, 3, 1, 20]} /><meshStandardMaterial color="#4e9c87" /></mesh>
        ))}
      </group>
      <Box p={[WATER.firePumpHouse.x, 2.5, WATER.firePumpHouse.z]} s={[WATER.firePumpHouse.w, 5, WATER.firePumpHouse.d]} color="#c0574c" onClick={sel('fire', 'FPH')} />
      <group onClick={sel('dg', 'DG-F')}>
        <Box p={[dg.x, 1.8, dg.z]} s={[8, 3.6, 3.4]} color="#5d5a7a" />
        <mesh position={[dg.x + 3, 4.2, dg.z]}><sphereGeometry args={[0.7, 10, 8]} /><meshBasicMaterial color={power?.dg.running ? pal.brand : pal.ok} toneMapped={false} /></mesh>
      </group>
      <mesh position={[WATER.tankerBay.x, 0.25, WATER.tankerBay.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 8]} />
        <meshBasicMaterial color={pal.water} transparent opacity={0.25} />
      </mesh>
      {water?.tanker?.enRouteEta && (
        <group position={[WATER.tankerBay.x, 0, WATER.tankerBay.z]}>
          <mesh position={[0, 2, 0]}><cylinderGeometry args={[1.5, 1.5, 9, 16]} /><meshStandardMaterial color="#e8e8e8" /></mesh>
        </group>
      )}

      {showLabels && (
        <>
          <Tag position={[uy.x - 10, 16, uy.z - 25]} title="11 kV Substation" sub={power ? (power.grid.outage ? 'GRID OUTAGE' : `${power.grid.kv.toFixed(2)} kV`) : ''} tone={power?.grid.outage ? 'crit' : 'ok'} onClick={sel('incomer', 'HT-11')} />
          <Tag position={[-470, 22, 255]} title="Water & fire zone" sub={water ? `Sump ${Math.round(water.levels.SUMP.pct * 100)}% · Fire ${Math.round(water.levels.FIRE.pct * 100)}%` : ''} tone={water?.levels.FIRE.pct < 0.95 ? 'crit' : 'ok'} onClick={sel('tank', 'SUMP')} />
          <Tag position={[dg.x, 10, dg.z + 4]} title="Fire DG 320 kVA" sub={power ? `${power.dg.running ? 'RUNNING' : 'Standby'} · fuel ${Math.round(power.dg.fuelPct * 100)}%` : ''} tone={power?.dg.fuelPct < 0.6 ? 'warn' : 'ok'} onClick={sel('dg', 'DG-F')} />
        </>
      )}
    </group>
  );
}

/* ------------------------------------------------ gate, FMO, EV hub, etc. */
export function GateAndOffices({ pal, showLabels }) {
  const gate = useLive((s) => s.snapshot?.gate);
  const chargers = useLive((s) => s.snapshot?.power.chargers);
  const select = useTwin((s) => s.select);
  const boom1 = useRef();
  const boom2 = useRef();
  const fmo = fac('FMO');
  const ev = fac('EVH');
  const dec = fac('DEC-HT');
  const sel = (type, id) => (e) => { e.stopPropagation(); select({ type, id }); };
  const lane1Busy = gate?.processing.some((p) => p.lane === 1);
  const exitBusy = (gate?.exitQueue || 0) > 0;
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3);
    if (boom1.current) boom1.current.rotation.z += ((lane1Busy ? 1.2 : 0) - boom1.current.rotation.z) * k;
    if (boom2.current) boom2.current.rotation.z += ((exitBusy ? -1.2 : 0) - boom2.current.rotation.z) * k;
  });
  const queueTone = !gate ? 'ok' : gate.queue >= 15 ? 'crit' : gate.queue >= 6 ? 'warn' : 'ok';
  return (
    <group>
      {/* gate structure */}
      <group onClick={sel('gate', 'G1')}>
        {[-14, 0, 14].map((dx) => <Box key={dx} p={[GATE.x + dx, 3, GATE.z]} s={[1.6, 6, 1.6]} color={pal.wall} />)}
        <Box p={[GATE.x, 6.5, GATE.z]} s={[30, 1.2, 3]} color={pal.band} />
        <group ref={boom1} position={[GATE.x + 13, 1.2, GATE.z - 2]}>
          <mesh position={[-6, 0, 0]}><boxGeometry args={[12, 0.35, 0.35]} /><meshStandardMaterial color="#e5484d" /></mesh>
        </group>
        <group ref={boom2} position={[GATE.x - 13, 1.2, GATE.z + 2]}>
          <mesh position={[6, 0, 0]}><boxGeometry args={[12, 0.35, 0.35]} /><meshStandardMaterial color="#e5484d" /></mesh>
        </group>
      </group>
      {FACILITIES.filter((f) => f.kind === 'security').map((f) => <Box key={f.id} p={[f.x, f.h / 2, f.z]} s={[f.w, f.h, f.d]} color="#e9e4da" onClick={sel('gate', 'G1')} />)}
      {/* FMO */}
      <group onClick={sel('fmo', 'FMO')}>
        <Box p={[fmo.x, fmo.h / 2, fmo.z]} s={[fmo.w, fmo.h, fmo.d]} color={pal.wall} />
        <Box p={[fmo.x, fmo.h - 0.6, fmo.z]} s={[fmo.w + 0.3, 0.8, fmo.d + 0.3]} color={pal.band} />
      </group>
      {/* EV hub (opposite FMO) */}
      <group onClick={sel('ev', 'EVH')}>
        <Box p={[ev.x, 4, ev.z]} s={[ev.w, 0.4, ev.d]} color="#2bb04c" />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <Box key={`${a}${b}`} p={[ev.x + a * (ev.w / 2 - 0.6), 2, ev.z + b * (ev.d / 2 - 0.6)]} s={[0.4, 4, 0.4]} color={pal.pole} />)}
        {(chargers || []).map((c, i) => (
          <mesh key={c.id} position={[ev.x - 7.5 + i * 5, 1, ev.z - 3]}>
            <boxGeometry args={[0.9, 2, 0.6]} />
            <meshBasicMaterial color={c.status === 'fault' ? pal.crit : c.status === 'charging' ? pal.info : pal.ok} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* Decathlon own HT */}
      <Box p={[dec.x, dec.h / 2, dec.z]} s={[dec.w, dec.h, dec.d]} color="#8b8f96" onClick={sel('tenantHt', 'DEC-HT')} />

      {showLabels && (
        <>
          <Tag position={[GATE.x, 16, GATE.z]} title="Main Gate" sub={gate ? `${gate.queue} queued · ${gate.lanesOpen} lane${gate.lanesOpen > 1 ? 's' : ''}` : ''} tone={queueTone} onClick={sel('gate', 'G1')} />
          <Tag position={[fmo.x - 6, 15, fmo.z]} title="FM Office" sub="Facility management" onClick={sel('fmo', 'FMO')} />
          <Tag position={[ev.x + 8, 12, ev.z]} title="EV charging" sub={chargers ? `${chargers.filter((c) => c.status === 'available').length}/${chargers.length} free` : ''} onClick={sel('ev', 'EVH')} />
          <Tag position={[dec.x, 10, dec.z]} title="Decathlon HT" sub="Tenant-managed" onClick={sel('tenantHt', 'DEC-HT')} />
        </>
      )}
    </group>
  );
}
