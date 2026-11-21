import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useLive } from '../store/live';
import { useTwin } from './store';
import { Pulse } from './Vehicles';

function Beacon({ x, z, color = '#e5484d', height = 70 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.material.opacity = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4));
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ref} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[2.2, 5, height, 20, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <Pulse x={0} z={0} color={color} r={26} />
      <Pulse x={0} z={0} color={color} r={14} />
    </group>
  );
}

function Fire({ x, z }) {
  const flames = useRef([]);
  const smoke = useRef([]);
  const light = useRef();
  const puffs = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ off: i / 16, dx: (Math.random() - 0.5) * 6, dz: (Math.random() - 0.5) * 6 })), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    flames.current.forEach((f, i) => {
      if (!f) return;
      const s = 1 + 0.35 * Math.sin(t * (9 + i * 2.3) + i) + 0.15 * Math.sin(t * 23 + i);
      f.scale.set(1, s, 1);
      f.position.y = 6 + (s * (5 + i)) / 2;
    });
    smoke.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 0.18 + puffs[i].off) % 1;
      m.position.set(puffs[i].dx * (1 + p * 3), 10 + p * 70, puffs[i].dz * (1 + p * 3) - p * 18);
      m.scale.setScalar(2 + p * 11);
      m.material.opacity = 0.55 * (1 - p);
    });
    if (light.current) light.current.intensity = 900 + 400 * Math.sin(t * 17) + 200 * Math.sin(t * 7);
  });
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} ref={(el) => { flames.current[i] = el; }} position={[(i - 2) * 1.6, 8, (i % 2) * 1.5 - 0.7]}>
          <coneGeometry args={[2.2 - i * 0.15, 6 + i * 1.2, 10]} />
          <meshBasicMaterial color={i % 2 ? '#ffb020' : '#ff5a1f'} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      ))}
      {puffs.map((_, i) => (
        <mesh key={`s${i}`} ref={(el) => { smoke.current[i] = el; }}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#3d3d40" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 14, 0]} color="#ff7a2a" intensity={1000} distance={160} decay={1.6} />
    </group>
  );
}

export default function Incidents() {
  const incidents = useLive((s) => s.snapshot?.incidents);
  const select = useTwin((s) => s.select);
  const active = (incidents || []).filter((i) => i.status === 'active' && i.x != null);
  return (
    <group>
      {active.map((inc) => (
        <group key={inc.id}>
          <Beacon x={inc.x} z={inc.z} color={inc.type === 'water-shortage' ? '#e5484d' : '#e5484d'} />
          {inc.type === 'grid-fire' && <Fire x={inc.x} z={inc.z} />}
          <Html position={[inc.x, 78, inc.z]} center zIndexRange={[25, 0]}>
            <button type="button" className="twin-incident" onClick={() => select({ type: 'incident', id: inc.id })}>
              <span className="twin-incident-dot" />
              <span>
                <span className="twin-incident-title">INCIDENT · {inc.id}</span>
                <span className="twin-incident-sub">{inc.title}</span>
              </span>
            </button>
          </Html>
        </group>
      ))}
    </group>
  );
}
