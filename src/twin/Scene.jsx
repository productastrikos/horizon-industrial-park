import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useUi } from '../store/ui';
import { useLive } from '../store/live';
import { useTwin, PRESETS } from './store';
import { scenePalette, TENANT_HEX } from './palette';
import Site from './Site';
import Buildings from './Buildings';
import { StaticTrucks, MovingTrucks, Buggies, ParkingZones } from './Vehicles';
import { StreetLights, Cameras, Utilities, GateAndOffices } from './Assets';
import Incidents from './Incidents';

function CameraRig({ controls }) {
  const { camera } = useThree();
  const preset = useTwin((s) => s.preset);
  const nonce = useTwin((s) => s.presetNonce);
  const anim = useRef(null);
  const custom = useTwin((s) => s.custom);
  useEffect(() => {
    const p = preset === 'custom' ? custom : PRESETS[preset];
    if (!p) return;
    anim.current = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target), t: 0 };
  }, [preset, nonce]);
  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls.current) return;
    a.t = Math.min(1, a.t + dt * 0.9);
    const k = 1 - (1 - a.t) ** 3;
    camera.position.lerp(a.pos, k * 0.18 + 0.02);
    controls.current.target.lerp(a.target, k * 0.18 + 0.02);
    controls.current.update();
    if (a.t >= 1 && camera.position.distanceTo(a.pos) < 2) anim.current = null;
  });
  return null;
}

function SceneContent({ pal, theme, night }) {
  const layers = useTwin((s) => s.layers);
  const tenantHex = TENANT_HEX[theme];
  const controls = useRef();
  const select = useTwin((s) => s.select);
  return (
    <>
      <color attach="background" args={[pal.bg]} />
      <fog attach="fog" args={[pal.fog, 1400, 3800]} />
      <ambientLight intensity={pal.ambient} />
      <hemisphereLight args={['#ffffff', theme === 'dark' ? '#1a1d22' : '#d9d4c8', night ? 0.25 : 0.55]} />
      <directionalLight position={[-500, 900, 400]} intensity={pal.sun} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-900} shadow-camera-right={900} shadow-camera-top={900} shadow-camera-bottom={-900} shadow-camera-far={3000} shadow-bias={-0.0005} />
      <group onPointerMissed={() => select(null)}>
        <Site pal={pal} />
        {layers.parking && <ParkingZones pal={pal} />}
        <Buildings pal={pal} showLabels={layers.labels} />
        <GateAndOffices pal={pal} showLabels={layers.labels} />
        {layers.utilities && <Utilities pal={pal} showLabels={layers.labels} />}
        {layers.trucks && <StaticTrucks pal={pal} tenantHex={tenantHex} showParking={layers.parking} />}
        {layers.trucks && <MovingTrucks tenantHex={tenantHex} />}
        {layers.lights && <StreetLights pal={pal} night={night} />}
        {layers.cctv && <Cameras pal={pal} />}
        {layers.ev && <Buggies />}
        <Incidents />
      </group>
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.15} minDistance={60} maxDistance={2600} target={PRESETS.overview.target} />
      <CameraRig controls={controls} />
    </>
  );
}

export default function TwinScene() {
  const theme = useUi((s) => s.theme);
  const h = useLive((s) => s.snapshot?.clock.h ?? 12);
  const night = h >= 18.2 || h < 6.1;
  const pal = useMemo(() => scenePalette(theme, night), [theme, night]);
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: PRESETS.overview.pos, fov: 38, near: 5, far: 9000 }} gl={{ antialias: true }}>
      <SceneContent pal={pal} theme={theme} night={night} />
    </Canvas>
  );
}
