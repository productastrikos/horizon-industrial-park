import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BUILDINGS, TENANTS, PARKING_ZONES, PUBLIC_ROAD, GATE, TRUCK_ROUTES, EV, FACILITIES, buildingToWorld } from '../config/malur';
import { useLive } from '../store/live';
import { useTwin } from './store';
import { DOCK_SLOTS } from './Buildings';

/* ------------------------------------------------------------ helpers */
export function makePath(pts) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    seg.push({ a: pts[i], b: pts[i + 1], L, start: total });
    total += L;
  }
  return { seg, total };
}
export function pointAt(path, d) {
  const dd = Math.max(0, Math.min(path.total - 0.001, d));
  const s = path.seg.find((x) => dd >= x.start && dd <= x.start + x.L) || path.seg[path.seg.length - 1];
  const t = s.L ? (dd - s.start) / s.L : 0;
  const x = s.a[0] + (s.b[0] - s.a[0]) * t;
  const z = s.a[1] + (s.b[1] - s.a[1]) * t;
  return { x, z, rot: Math.atan2(-(s.b[1] - s.a[1]), s.b[0] - s.a[0]) };
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/** Instanced trucks: trailer coloured by tenant + white cab. items: {x,z,rot,color,len} */
function TruckInstances({ items, capacity = 200, onPick }) {
  const trailer = useRef();
  const cab = useRef();
  useLayoutEffect(() => {
    // allocate per-instance colours before the first render so the material compiles with them
    if (!trailer.current.instanceColor) {
      trailer.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(0.6), 3);
    }
  }, [capacity]);
  useLayoutEffect(() => {
    const n = Math.min(items.length, capacity);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const len = it.len || 11;
      tmpQ.setFromAxisAngle(UP, it.rot);
      tmpM.compose(new THREE.Vector3(it.x, 2.1, it.z), tmpQ, new THREE.Vector3(len, 1, 1));
      trailer.current.setMatrixAt(i, tmpM);
      trailer.current.setColorAt(i, tmpC.set(it.color));
      const fx = Math.cos(it.rot) * (len / 2 + 1.3);
      const fz = -Math.sin(it.rot) * (len / 2 + 1.3);
      tmpM.compose(new THREE.Vector3(it.x + fx, 1.6, it.z + fz), tmpQ, new THREE.Vector3(1, 1, 1));
      cab.current.setMatrixAt(i, tmpM);
    }
    trailer.current.count = n;
    cab.current.count = n;
    trailer.current.instanceMatrix.needsUpdate = true;
    cab.current.instanceMatrix.needsUpdate = true;
    if (trailer.current.instanceColor) trailer.current.instanceColor.needsUpdate = true;
  }, [items, capacity]);
  return (
    <group onClick={onPick}>
      <instancedMesh ref={trailer} args={[null, null, capacity]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 3.4, 2.6]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={cab} args={[null, null, capacity]} frustumCulled={false}>
        <boxGeometry args={[2.4, 2.6, 2.5]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.5} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------- static sets */
function bayLayout(zone) {
  const truck = zone.kind === 'truck';
  const bw = truck ? 4.6 : 2.7;
  const bl = truck ? 14 : 5.4;
  const alongX = zone.w >= zone.d;
  const longSide = alongX ? zone.w : zone.d;
  const shortSide = alongX ? zone.d : zone.w;
  const perRow = Math.max(1, Math.floor((longSide - 4) / bw));
  const rows = Math.max(1, Math.floor((shortSide - 2) / (bl + 1.5)));
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < perRow; c++) {
      if (slots.length >= zone.bays) break;
      const a = -longSide / 2 + 2 + (c + 0.5) * bw;
      const b = -shortSide / 2 + 1 + (r + 0.5) * (bl + 1.5);
      const [lx, lz] = alongX ? [a, b] : [b, a];
      const [x, z] = buildingToWorld(zone, lx, lz);
      slots.push({ x, z, rot: zone.rot + (alongX ? Math.PI / 2 : 0) });
    }
  }
  return slots;
}
export const BAY_SLOTS = Object.fromEntries(PARKING_ZONES.map((z) => [z.id, bayLayout(z)]));

export function ParkingZones({ pal }) {
  const select = useTwin((s) => s.select);
  return PARKING_ZONES.map((z) => (
    <group key={z.id}>
      <mesh position={[z.cx, 0.14, z.cz]} rotation={[0, z.rot, 0]} receiveShadow onClick={(e) => { e.stopPropagation(); select({ type: 'parking', id: z.id }); }}>
        <boxGeometry args={[z.w, 0.12, z.d]} />
        <meshStandardMaterial color={z.kind === 'truck' ? pal.parkingTruck : pal.parkingCar} roughness={1} />
      </mesh>
      {BAY_SLOTS[z.id].map((s, i) => (
        <mesh key={i} position={[s.x, 0.22, s.z]} rotation={[0, s.rot, 0]}>
          <boxGeometry args={[z.kind === 'truck' ? 13 : 5, 0.02, 0.18]} />
          <meshBasicMaterial color={pal.stripe} transparent opacity={0.55} />
        </mesh>
      )).filter((_, i) => i % (z.kind === 'truck' ? 1 : 3) === 0)}
    </group>
  ));
}

function Pulse({ x, z, color, r = 9 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.8) % 1;
    if (!ref.current) return;
    ref.current.scale.setScalar(0.4 + t * 1.2);
    ref.current.material.opacity = 0.75 * (1 - t);
  });
  return (
    <mesh ref={ref} position={[x, 0.4, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r * 0.75, r, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
export { Pulse };

export function StaticTrucks({ pal, tenantHex, showParking }) {
  const gate = useLive((s) => s.snapshot?.gate);
  const select = useTwin((s) => s.select);

  const { queue, docked, parked, violators } = useMemo(() => {
    if (!gate) return { queue: [], docked: [], parked: [], violators: [] };
    // queue on public road (inbound lane, heading west towards the gate)
    const queue = gate.queueTrucks.map((t, i) => ({ x: GATE.x + 26 + i * 19, z: PUBLIC_ROAD.z - 3.5, rot: Math.PI, color: tenantHex[t.tenant] }));
    gate.processing.forEach((p, i) => queue.push({ x: GATE.x + (i ? -7 : 7), z: GATE.z + 9, rot: Math.PI / 2, color: tenantHex[p.tenant] }));

    // docked trucks per building (tenant dock count split by building dock share)
    const docked = [];
    TENANTS.forEach((t) => {
      const blocks = BUILDINGS.filter((b) => b.tenant === t.id);
      const totalDocks = blocks.reduce((a, b) => a + b.docks, 0);
      let remaining = gate.tenants[t.id].dock;
      blocks.forEach((b, bi) => {
        const n = bi === blocks.length - 1 ? remaining : Math.round((gate.tenants[t.id].dock * b.docks) / totalDocks);
        remaining -= n;
        const slots = DOCK_SLOTS[b.id];
        for (let i = 0; i < Math.min(n, slots.length); i++) {
          const s = slots[(i * 7) % slots.length];
          const off = 7.4 * s.sign;
          const [x, z] = s.axis === 'x' ? buildingToWorld(b, s.lx + off, s.lz) : buildingToWorld(b, s.lx, s.lz + off);
          docked.push({ x, z, rot: b.rot + (s.axis === 'x' ? 0 : Math.PI / 2), color: tenantHex[t.id] });
        }
      });
    });

    // parked in tenant bays
    const parked = [];
    PARKING_ZONES.filter((z) => z.kind === 'truck').forEach((z) => {
      const n = gate.tenants[z.tenant]?.bay || 0;
      BAY_SLOTS[z.id].slice(0, n).forEach((s) => parked.push({ ...s, color: tenantHex[z.tenant], len: 11 }));
    });
    // violators at their reported location (spread when stacked)
    const seen = {};
    const violators = gate.violations.map((v) => {
      const k = `${Math.round(v.x)}:${Math.round(v.z)}`;
      seen[k] = (seen[k] || 0) + 1;
      const o = (seen[k] - 1) * 6;
      return { id: v.id, x: v.x + o, z: v.z + o * 0.4, rot: 0.3, color: tenantHex[v.tenant] || '#888' };
    });
    return { queue, docked, parked, violators };
  }, [gate, tenantHex]);

  return (
    <group>
      <TruckInstances items={queue} capacity={60} onPick={(e) => { e.stopPropagation(); select({ type: 'gate', id: 'G1' }); }} />
      <TruckInstances items={docked} capacity={200} />
      {showParking && <TruckInstances items={parked} capacity={120} />}
      <TruckInstances items={violators} capacity={20} />
      {violators.map((v) => (
        <group key={v.id} onClick={(e) => { e.stopPropagation(); select({ type: 'violation', id: v.id }); }}>
          <Pulse x={v.x} z={v.z} color={pal.crit} r={11} />
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------- moving trucks (events) */
const SPEED = 16; // m/s visual
const EXIT_TAIL = [[-112, PUBLIC_ROAD.z + 3.5], [-700, PUBLIC_ROAD.z + 3.5]];

export function MovingTrucks({ tenantHex }) {
  const events = useLive((s) => s.snapshot?.gate.events);
  const snapTs = useLive((s) => s.snapshot?.ts);
  const agents = useRef([]);
  const seen = useRef(new Set());
  const mountTs = useRef(null);
  const meshes = useRef([]);
  const CAP = 24;

  useEffect(() => {
    if (!events || !snapTs) return;
    if (mountTs.current == null) {
      mountTs.current = snapTs;
      events.forEach((e) => seen.current.add(`${e.kind}${e.ts}${e.plate}`));
      return;
    }
    events.slice(0, 20).forEach((e) => {
      const key = `${e.kind}${e.ts}${e.plate}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      if (e.kind !== 'entry' && e.kind !== 'exit') return;
      const route = TRUCK_ROUTES[e.tenant];
      const pts = e.kind === 'entry' ? route : [...route.slice().reverse().slice(0, -1), ...EXIT_TAIL];
      if (agents.current.length >= CAP) agents.current.shift();
      agents.current.push({ path: makePath(pts), d: 0, color: tenantHex[e.tenant] });
    });
  }, [events, snapTs, tenantHex]);

  useFrame((_, dt) => {
    const list = agents.current;
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].d += SPEED * Math.min(dt, 0.1);
      if (list[i].d >= list[i].path.total) list.splice(i, 1);
    }
    for (let i = 0; i < CAP; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      const a = list[i];
      if (!a) { m.visible = false; continue; }
      const p = pointAt(a.path, a.d);
      m.visible = true;
      m.position.set(p.x, 0, p.z);
      m.rotation.set(0, p.rot, 0);
      m.children[0].material.color.set(a.color);
    }
  });

  return (
    <group>
      {Array.from({ length: CAP }).map((_, i) => (
        <group key={i} ref={(el) => { meshes.current[i] = el; }} visible={false}>
          <mesh position={[0, 2.1, 0]} castShadow>
            <boxGeometry args={[11, 3.4, 2.6]} />
            <meshStandardMaterial color="#888" roughness={0.6} />
          </mesh>
          <mesh position={[6.8, 1.6, 0]}>
            <boxGeometry args={[2.4, 2.6, 2.5]} />
            <meshStandardMaterial color="#f4f4f2" />
          </mesh>
          <mesh position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[9, 24]} />
            <meshBasicMaterial color="#F47922" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* --------------------------------------------------------------- buggies */
const BUGGY_PATH = makePath([...EV.route, EV.route[0]]);
const HUB = FACILITIES.find((f) => f.id === 'EVH');

export function Buggies() {
  const buggies = useLive((s) => s.snapshot?.power.buggies);
  const select = useTwin((s) => s.select);
  const refs = useRef([]);
  const local = useRef({});
  useFrame((_, dt) => {
    (buggies || []).forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      if (b.state === 'service') {
        const st = local.current[b.id] || (local.current[b.id] = { d: b.pos * BUGGY_PATH.total });
        st.d = (st.d + Math.sign(b.speed || 1) * 7 * Math.min(dt, 0.1) + BUGGY_PATH.total) % BUGGY_PATH.total;
        const p = pointAt(BUGGY_PATH, st.d);
        const side = (b.speed || 1) > 0 ? 3 : -3;
        g.position.set(p.x + Math.sin(p.rot) * side, 0, p.z + Math.cos(p.rot) * side);
        g.rotation.set(0, p.rot + (b.speed > 0 ? 0 : Math.PI), 0);
      } else {
        delete local.current[b.id];
        g.position.set(HUB.x - 9 + i * 3.6, 0, HUB.z + 9);
        g.rotation.set(0, Math.PI / 2, 0);
      }
    });
  });
  return (
    <group>
      {(buggies || []).map((b, i) => (
        <group key={b.id} ref={(el) => { refs.current[i] = el; }} onClick={(e) => { e.stopPropagation(); select({ type: 'ev', id: 'EVH' }); }}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[3.2, 1.2, 1.7]} />
            <meshStandardMaterial color={b.soc < 0.25 ? '#e5484d' : '#2bb04c'} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <boxGeometry args={[3.0, 0.15, 1.8]} />
            <meshStandardMaterial color="#f4f4f2" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
