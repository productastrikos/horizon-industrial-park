import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { BOUNDARY, ROADS, RAILWAY, PUBLIC_ROAD, FACILITIES, BUILDINGS } from '../config/malur';

export function segTransform(a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L = Math.hypot(dx, dz);
  return { L, cx: (a[0] + b[0]) / 2, cz: (a[1] + b[1]) / 2, rot: Math.atan2(-dz, dx) };
}

function polyShape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}

function Road({ road, color, y = 0.12 }) {
  return (
    <group>
      {road.pts.slice(0, -1).map((a, i) => {
        const t = segTransform(a, road.pts[i + 1]);
        return (
          <mesh key={i} position={[t.cx, y, t.cz]} rotation={[0, t.rot, 0]} receiveShadow>
            <boxGeometry args={[t.L, 0.2, road.w]} />
            <meshStandardMaterial color={color} roughness={0.95} />
          </mesh>
        );
      })}
      {road.pts.map((p, i) => (
        <mesh key={`j${i}`} position={[p[0], y, p[1]]} receiveShadow>
          <cylinderGeometry args={[road.w / 2, road.w / 2, 0.2, 20]} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Trees({ pal }) {
  const trunks = useRef();
  const crowns = useRef();
  const positions = useMemo(() => {
    const pts = [];
    const cx = BOUNDARY.reduce((a, p) => a + p[0], 0) / BOUNDARY.length;
    const cz = BOUNDARY.reduce((a, p) => a + p[1], 0) / BOUNDARY.length;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    BOUNDARY.forEach((a, i) => {
      const b = BOUNDARY[(i + 1) % BOUNDARY.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.floor(L / 17);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        let x = a[0] + (b[0] - a[0]) * t;
        let z = a[1] + (b[1] - a[1]) * t;
        const dx = cx - x;
        const dz = cz - z;
        const d = Math.hypot(dx, dz);
        x += (dx / d) * (7 + rnd() * 4);
        z += (dz / d) * (7 + rnd() * 4);
        pts.push([x, z, 0.75 + rnd() * 0.6]);
      }
    });
    // recreation ground & FMO landscaping
    const rg = FACILITIES.find((f) => f.id === 'RG');
    for (let i = 0; i < 18; i++) pts.push([rg.x - rg.w / 2 + rnd() * rg.w, rg.z - rg.d / 2 + rnd() * rg.d, 0.7 + rnd() * 0.5]);
    for (let i = 0; i < 10; i++) pts.push([-205 + rnd() * 30, 380 + rnd() * 40, 0.6 + rnd() * 0.4]);
    return pts;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    positions.forEach(([x, z, s], i) => {
      m.compose(new THREE.Vector3(x, 2.2 * s, z), q, new THREE.Vector3(s, s, s));
      trunks.current.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 7 * s, z), q, new THREE.Vector3(s, s, s));
      crowns.current.setMatrixAt(i, m);
    });
    trunks.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[null, null, positions.length]} castShadow>
        <cylinderGeometry args={[0.5, 0.7, 4.4, 6]} />
        <meshStandardMaterial color={pal.trunk} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[null, null, positions.length]} castShadow>
        <icosahedronGeometry args={[4.2, 0]} />
        <meshStandardMaterial color={pal.tree} flatShading roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

function PublicRoad({ pal }) {
  const { z, x0, x1, w } = PUBLIC_ROAD;
  const dashes = [];
  for (let x = x0 + 10; x < x1; x += 24) dashes.push(x);
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, 0.1, z]} receiveShadow>
        <boxGeometry args={[x1 - x0, 0.2, w]} />
        <meshStandardMaterial color={pal.publicRoad} roughness={0.95} />
      </mesh>
      {dashes.map((x) => (
        <mesh key={x} position={[x, 0.22, z]}>
          <boxGeometry args={[10, 0.05, 0.5]} />
          <meshBasicMaterial color={pal.marking} />
        </mesh>
      ))}
    </group>
  );
}

function Railway({ pal }) {
  const pts = RAILWAY.map(([x, z]) => new THREE.Vector3(x, 0.3, z));
  const left = RAILWAY.map(([x, z]) => new THREE.Vector3(x - 1.2, 0.35, z - 1.2));
  const right = RAILWAY.map(([x, z]) => new THREE.Vector3(x + 1.2, 0.35, z + 1.2));
  return (
    <group>
      <Line points={pts} color={pal.rail} lineWidth={7} transparent opacity={0.35} />
      <Line points={left} color={pal.rail} lineWidth={1.2} />
      <Line points={right} color={pal.rail} lineWidth={1.2} />
    </group>
  );
}

function Aprons({ pal }) {
  return BUILDINGS.map((b) => (
    <mesh key={b.id} position={[b.cx, 0.08, b.cz]} rotation={[0, b.rot, 0]} receiveShadow>
      <boxGeometry args={[b.w + 2 * (b.dockSide.includes('x') ? 18 : 8), 0.15, b.d + 2 * (b.dockSide.includes('z') ? 18 : 8)]} />
      <meshStandardMaterial color={pal.apron} roughness={1} />
    </mesh>
  ));
}

export default function Site({ pal }) {
  const shape = useMemo(() => polyShape(BOUNDARY), []);
  const wall = useMemo(() => [...BOUNDARY, BOUNDARY[0]].map(([x, z]) => new THREE.Vector3(x, 1.2, z)), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[5000, 5000]} />
        <meshStandardMaterial color={pal.outer} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={pal.site} roughness={1} />
      </mesh>
      <Line points={wall} color={pal.boundary} lineWidth={2.2} />
      <Aprons pal={pal} />
      {ROADS.map((r) => <Road key={r.id} road={r} color={pal.road} />)}
      <PublicRoad pal={pal} />
      <Railway pal={pal} />
      <Trees pal={pal} />
    </group>
  );
}
