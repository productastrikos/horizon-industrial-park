/**
 * HIP Malur — facility master data and site layout.
 *
 * Building blocks, areas and support facilities follow the published
 * Horizon Industrial Park Malur masterplan (Blocks A1/A2/A3, B, D, E; FMO,
 * substation, STP, security cabins, truck & car parking, AGT).
 * Utility ratings come from the Astrikos site survey.
 *
 * Coordinates are local metres: +x = east, +z = south, origin ≈ site centre.
 * Rotations are radians about the vertical axis (three.js convention).
 * Tenant ↔ block mapping is configurable below.
 */

export const SITE = {
  id: 'malur',
  name: 'HIP Malur',
  fullName: 'Horizon Industrial Park, Malur',
  city: 'Bengaluru',
  address: 'Malur–Whitefield Road, Marasandra, Malur, Karnataka 563160',
  acres: 97,
  potentialMsf: 1.9,
  igbc: 'IGBC Platinum Certified',
  eavesHeightM: 12,
  apronM: 16.5,
  roadWidthM: 12,
  publicRoad: 'Malur–Whitefield Road',
  connectivity: [
    { name: 'Malur town', km: 8 },
    { name: 'Soukya', km: 9 },
    { name: 'NH 648', km: 14 },
    { name: 'Whitefield', km: 18 },
    { name: 'Bengaluru CBD', km: 36 },
    { name: 'Kempegowda Intl. Airport', km: 61 },
  ],
  centre: { lat: 12.98817, lng: 77.88233 },
};

/* ---------------------------------------------------------------- tenants */
// Fixed categorical order → colour slots s1..s4 (never re-ordered).
export const TENANTS = [
  { id: 'amazon', name: 'Amazon', short: 'AMZ', slot: 's1', blocks: ['D'], dailyTrucks: 160, docks: 64, truckBays: 36, power: 'TR-1', powerNote: 'HIP 750 kVA TR-1' },
  { id: 'flipkart', name: 'Flipkart', short: 'FK', slot: 's2', blocks: ['B'], dailyTrucks: 120, docks: 40, truckBays: 24, power: 'TR-2', powerNote: 'HIP 750 kVA TR-2' },
  { id: 'decathlon', name: 'Decathlon', short: 'DEC', slot: 's3', blocks: ['A1'], dailyTrucks: 70, docks: 36, truckBays: 18, power: 'OWN', powerNote: 'Own HT connection (tenant-managed)' },
  { id: 'others', name: 'Other tenants', short: 'OTH', slot: 's4', blocks: ['A2', 'A3', 'E'], dailyTrucks: 60, docks: 44, truckBays: 16, power: 'TENANT', powerNote: 'Tenant-metered' },
];
export const TENANT_BY_ID = Object.fromEntries(TENANTS.map((t) => [t.id, t]));

/* -------------------------------------------------------------- buildings */
// w = local-x extent, d = local-z extent (m). dockSide: which local face has dock doors.
export const BUILDINGS = [
  { id: 'D', name: 'Block D', tenant: 'amazon', msf: 0.53, cx: -278, cz: 160, w: 134, d: 367, rot: 0.21, dockSide: '+x', docks: 64 },
  { id: 'B', name: 'Block B', tenant: 'flipkart', msf: 0.34, cx: -125, cz: -185, w: 276, d: 114, rot: 0.464, dockSide: '+z', docks: 40 },
  {
    id: 'A1', name: 'Block A1', tenant: 'decathlon', msf: 0.38, cx: 210, cz: -280, w: 365, d: 96, rot: 0, dockSide: '-z', docks: 36,
    cells: [{ name: 'Cells 1 & 2', msf: 0.2, w: 184 }, { name: 'Cell 3', msf: 0.09, w: 90 }, { name: 'Cell 4', msf: 0.09, w: 91 }],
  },
  {
    id: 'A2', name: 'Block A2', tenant: 'others', msf: 0.28, cx: 170, cz: -168, w: 280, d: 94, rot: 0, dockSide: '+z', docks: 18,
    cells: [{ name: 'Cells 5 & 6', msf: 0.18, w: 184 }, { name: 'Cell 7', msf: 0.1, w: 96 }],
  },
  { id: 'A3', name: 'Block A3', tenant: 'others', msf: 0.19, cx: 470, cz: -245, w: 83, d: 220, rot: 0, dockSide: '-x', docks: 12, cells: [{ name: 'Cells 9 & 10', msf: 0.19, w: 83 }] },
  { id: 'E', name: 'Block E', tenant: 'others', msf: 0.18, cx: -480, cz: 125, w: 140, d: 119, rot: 0.1, dockSide: '+z', docks: 14 },
];
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/* --------------------------------------------------------------- boundary */
export const BOUNDARY = [
  [-640, 140], [-440, -40], [-345, -160], [-290, -218], [-40, -343], [20, -370], [250, -430], [440, -515],
  [452, -378], [555, -372], [540, -75], [300, -70], [280, -42], [90, -45], [-20, -60], [-60, -20],
  [-55, 432], [-260, 432], [-345, 390], [-372, 335], [-590, 335], [-640, 250],
];

export const RAILWAY = [[-760, 150], [-470, -110], [-330, -250], [-60, -390], [250, -470], [460, -560], [620, -620]];

/* ------------------------------------------------------------------ roads */
export const PUBLIC_ROAD = { name: 'Malur–Whitefield Road', z: 500, x0: -950, x1: 750, w: 14 };

export const GATE = {
  id: 'G1', name: 'Main Gate', x: -118, z: 432,
  entryLanes: 1, exitLanes: 1, maxEntryLanes: 2,
};

export const ROADS = [
  { id: 'R-GATE', name: 'Gate Road', w: 15, pts: [[-118, PUBLIC_ROAD.z - 7], [-118, 410], [-153.4, 327.7]] },
  { id: 'R-DE', name: 'Block D East Road', w: 15, pts: [[-153.4, 327.7], [-223.3, -46.4]] },
  { id: 'R-DS', name: 'Block D South Road', w: 8, pts: [[-324.7, 372.8], [-153.4, 327.7]] },
  { id: 'R-DW', name: 'Block D West Road', w: 10, pts: [[-402.6, -7.7], [-323.6, 363.9]] },
  { id: 'R-DN', name: 'Block D North Road', w: 10, pts: [[-407, -20], [-223.3, -46.4]] },
  { id: 'R-BSE', name: 'Block B Service Road', w: 12, pts: [[-223.3, -46.4], [9.1, -162.7]] },
  { id: 'R-BNW', name: 'Block B Rear Road', w: 12, pts: [[-277, -198.4], [-26.7, -323.6], [10, -350]] },
  { id: 'R-N', name: 'North Road', w: 12, pts: [[10, -350], [410, -350]] },
  { id: 'R-AW', name: 'A-Cluster West Road', w: 8, pts: [[10, -350], [10, -100]] },
  { id: 'R-AS', name: 'A-Cluster South Road', w: 12, pts: [[10, -100], [410, -100]] },
  { id: 'R-AE', name: 'A-Cluster East Road', w: 8, pts: [[410, -350], [410, -100]] },
  { id: 'R-AC', name: 'A-Cluster Court Road', w: 7, pts: [[10, -223.5], [310, -223.5]] },
  { id: 'R-ES', name: 'Block E South Road', w: 8, pts: [[-575, 205], [-357.4, 205]] },
  { id: 'R-EW', name: 'Block E West Road', w: 8, pts: [[-575, 95], [-575, 205]] },
  { id: 'R-UT', name: 'Utility Yard Access', w: 6, pts: [[-330, -31], [-322, -64]] },
  { id: 'R-WZ', name: 'Water Zone Access', w: 6, pts: [[-455, 205], [-455, 240]] },
];

/* ---------------------------------------------------- parking (dedicated) */
export const PARKING_ZONES = [
  { id: 'TP-D', name: 'Truck Parking — Amazon', kind: 'truck', tenant: 'amazon', cx: -145, cz: 110, w: 56, d: 150, rot: 0.18, bays: 36 },
  { id: 'TP-B', name: 'Truck Parking — Flipkart', kind: 'truck', tenant: 'flipkart', cx: -60, cz: -95, w: 70, d: 28, rot: 0.464, bays: 24 },
  { id: 'TP-A1', name: 'Truck Parking — Decathlon', kind: 'truck', tenant: 'decathlon', cx: 360, cz: -165, w: 68, d: 92, rot: 0, bays: 18 },
  { id: 'TP-O', name: 'Truck Parking — Other tenants', kind: 'truck', tenant: 'others', cx: 190, cz: -72, w: 160, d: 26, rot: 0, bays: 16 },
  { id: 'CP-1', name: 'Staff Car Parking (Gate)', kind: 'car', tenant: null, cx: -100, cz: 250, w: 48, d: 80, rot: 0, bays: 120 },
  { id: 'CP-2', name: 'Staff Car Parking (A-Cluster)', kind: 'car', tenant: null, cx: 50, cz: -75, w: 60, d: 26, rot: 0, bays: 60 },
];
export const NO_PARKING_HOTSPOTS = [
  { id: 'NP-1', name: 'Gate Road shoulder', x: -128, z: 372 },
  { id: 'NP-2', name: 'Block D East Road (mid)', x: -186, z: 160 },
  { id: 'NP-3', name: 'B–D junction', x: -214, z: -30 },
  { id: 'NP-4', name: 'A-Cluster South Road', x: 300, z: -100 },
  { id: 'NP-5', name: 'Public road (outside gate)', x: -60, z: 494 },
];

/* ------------------------------------------------------------- facilities */
export const FACILITIES = [
  { id: 'FMO', name: 'Facility Management Office', kind: 'office', x: -165, z: 400, w: 28, d: 14, h: 7 },
  { id: 'SC-1', name: 'Security Cabin — Entry', kind: 'security', x: -104, z: 424, w: 6, d: 5, h: 3.5 },
  { id: 'SC-2', name: 'Security Cabin — Exit', kind: 'security', x: -132, z: 424, w: 6, d: 5, h: 3.5 },
  { id: 'EVH', name: 'EV Buggy Charging Hub', kind: 'ev', x: -84, z: 398, w: 22, d: 12, h: 3.5 },
  { id: 'UY', name: 'Utility Yard (11 kV Substation)', kind: 'yard', x: -320, z: -90, w: 60, d: 50, h: 0.4 },
  { id: 'WZ', name: 'Water & Fire Utility Zone', kind: 'yard', x: -480, z: 280, w: 190, d: 90, h: 0.3 },
  { id: 'RG', name: 'Recreation Ground', kind: 'green', x: -606, z: 190, w: 40, d: 70, h: 0.2 },
  { id: 'DEC-HT', name: 'Decathlon HT Room (tenant-managed)', kind: 'tenant-ht', x: 440, z: -385, w: 16, d: 10, h: 4 },
];

/* ---------------------------------------------------------------- power */
export const POWER = {
  incomer: { id: 'HT-11', name: '11 kV HT Incomer (BESCOM)', nominalKv: 11, x: -342, z: -106 },
  transformers: [
    { id: 'TR-1', name: 'TR-1 · 750 kVA', kva: 750, feeds: 'amazon', feedsLabel: 'Amazon — Block D', x: -341, z: -80 },
    { id: 'TR-2', name: 'TR-2 · 750 kVA', kva: 750, feeds: 'flipkart', feedsLabel: 'Flipkart — Block B', x: -321, z: -80 },
    { id: 'TR-3', name: 'TR-3 · 350 kVA', kva: 350, feeds: 'common', feedsLabel: 'Common area', x: -301, z: -80 },
  ],
  fireDg: { id: 'DG-F', name: 'Fire Safety DG · 320 kVA', kva: 320, x: -402, z: 296, tankLitres: 990, burnLph: 62 },
  tenantOwn: [{ tenant: 'decathlon', note: 'Decathlon operates its own HT supply & transformer' }],
  tariffPerKwh: 8.35,
  commonLoads: [
    { id: 'street', name: 'Street lighting' },
    { id: 'pumps', name: 'Pumps (borewell, transfer, STP)' },
    { id: 'fmo', name: 'FM office & gate' },
    { id: 'cctv', name: 'CCTV / VMS / IT' },
    { id: 'ev', name: 'EV buggy charging' },
  ],
};

/* ---------------------------------------------------------------- water */
export const WATER = {
  dailyDemandKl: 143, // ≈100 KL/day external = ~70 % of consumption (site survey)
  externalShareTarget: 0.5,
  tankerKl: 10,
  tankerCostPerKl: 85,
  uses: [
    { id: 'washroom', name: 'Washrooms & flushing', share: 0.43 },
    { id: 'domestic', name: 'Domestic (drinking, canteen, cleaning)', share: 0.32 },
    { id: 'garden', name: 'Gardening & landscape', share: 0.25 },
  ],
  tanks: [
    { id: 'SUMP', name: 'Domestic UG Sump', capKl: 250, kind: 'domestic', x: -480, z: 258, shape: 'box', w: 24, d: 16 },
    { id: 'AGT', name: 'Above-Ground Tank (AGT)', capKl: 60, kind: 'domestic', x: -526, z: 262, shape: 'cyl', r: 8, h: 12 },
    { id: 'FIRE', name: 'Fire Water Reserve', capKl: 350, kind: 'fire', x: -430, z: 258, shape: 'box', w: 30, d: 18 },
    { id: 'STP-T', name: 'STP Treated Water Tank', capKl: 40, kind: 'treated', x: -540, z: 305, shape: 'cyl', r: 5, h: 6 },
  ],
  borewells: [
    { id: 'BW-1', name: 'Borewell 1', yieldKlh: 2.4, x: -560, z: 290, pumpKw: 7.5 },
    { id: 'BW-2', name: 'Borewell 2', yieldKlh: 1.8, x: 482, z: -86, pumpKw: 5.5 },
  ],
  stp: { id: 'STP', name: 'Sewage Treatment Plant', capacityKld: 120, x: -495, z: 308, w: 30, d: 16 },
  firePumpHouse: { id: 'FPH', name: 'Fire Pump House', x: -430, z: 292, w: 18, d: 10 },
  tankerBay: { id: 'TB', name: 'Tanker Unloading Bay', x: -455, z: 232 },
};

/* ----------------------------------------------------------------- fire */
export const FIRE = {
  hydrantSetpointBar: 7.0,
  jockeyCutInBar: 6.4,
  mainPumpCutInBar: 5.6,
  pumps: [
    { id: 'JP', name: 'Jockey Pump', kw: 9.3 },
    { id: 'MP', name: 'Main Electric Fire Pump', kw: 110 },
    { id: 'DP', name: 'Diesel Fire Pump', kw: 0 },
  ],
  panelZones: 18,
  extinguishers: 164,
  hydrantPoints: 46,
};

/* ------------------------------------------------------------ EV buggies */
export const EV = {
  chargers: [
    { id: 'CH-1', kw: 3.3 }, { id: 'CH-2', kw: 3.3 }, { id: 'CH-3', kw: 3.3 }, { id: 'CH-4', kw: 3.3 },
  ],
  buggies: [
    { id: 'EB-01', seats: 6 }, { id: 'EB-02', seats: 6 }, { id: 'EB-03', seats: 6 },
    { id: 'EB-04', seats: 4 }, { id: 'EB-05', seats: 4 }, { id: 'EB-06', seats: 8 },
  ],
  route: [[-110, 380], [-118, 410], [-153.4, 327.7], [-223.3, -46.4], [9.1, -162.7], [10, -100], [410, -100], [410, -350], [10, -350], [10, -162.7]],
};

/* ---------------------------------------------- truck routes (3D twin) */
const GATE_IN = [[-112, PUBLIC_ROAD.z - 3], [-112, 410], [-150, 330]];
export const TRUCK_ROUTES = {
  amazon: [...GATE_IN, [-178, 200], [-196, 140], [-208, 138]],
  flipkart: [...GATE_IN, [-221, -40], [-150, -78], [-96, -106], [-101, -118]],
  decathlon: [...GATE_IN, [-221, -40], [9, -158], [12, -344], [190, -346], [190, -336]],
  others: [...GATE_IN, [-221, -40], [9, -158], [14, -104], [160, -104], [160, -114]],
};

/* ------------------------------------------- derived: street lights */
function segLen(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

function buildStreetLights() {
  const lights = [];
  let n = 1;
  ROADS.filter((r) => !['R-UT', 'R-WZ'].includes(r.id)).forEach((road) => {
    let side = 1;
    for (let i = 0; i < road.pts.length - 1; i++) {
      const a = road.pts[i];
      const b = road.pts[i + 1];
      const L = segLen(a, b);
      const ux = (b[0] - a[0]) / L;
      const uz = (b[1] - a[1]) / L;
      const nx = -uz;
      const nz = ux;
      const spacing = 40;
      const count = Math.max(1, Math.floor(L / spacing));
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) * (L / count);
        const off = road.w / 2 + 2.5;
        lights.push({
          id: `SL-${String(n).padStart(3, '0')}`,
          road: road.name,
          roadId: road.id,
          x: a[0] + ux * t + nx * off * side,
          z: a[1] + uz * t + nz * off * side,
          watts: road.w >= 12 ? 150 : 90,
        });
        n += 1;
        side *= -1;
      }
    }
  });
  return lights;
}
export const STREET_LIGHTS = buildStreetLights();

/* ---------------------------------------------------- derived: CCTV */
function buildCameras() {
  const cams = [];
  const add = (id, name, zone, x, z, extra = {}) => cams.push({ id, name, zone, x, z, ...extra });
  add('CAM-G01', 'Gate — entry ANPR', 'Main gate', -108, 436, { type: 'ANPR-ready' });
  add('CAM-G02', 'Gate — exit ANPR', 'Main gate', -128, 436, { type: 'ANPR-ready' });
  add('CAM-G03', 'Gate — overview PTZ', 'Main gate', -98, 414, { type: 'PTZ' });
  add('CAM-G04', 'Public road approach', 'Main gate', -40, 488, { type: 'Bullet' });
  add('CAM-F01', 'FM office', 'FMO & EV', -165, 390, { type: 'Dome' });
  add('CAM-F02', 'EV charging hub', 'FMO & EV', -84, 388, { type: 'Dome' });
  add('CAM-U01', 'Substation — HT yard', 'Utilities', -352, -112, { type: 'Bullet' });
  add('CAM-U02', 'Substation — transformers', 'Utilities', -292, -66, { type: 'Bullet' });
  add('CAM-W01', 'Water zone — sump & AGT', 'Utilities', -505, 240, { type: 'Bullet' });
  add('CAM-W02', 'Fire pump house & DG', 'Utilities', -412, 310, { type: 'Bullet' });
  BUILDINGS.forEach((b) => {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const toWorld = (lx, lz) => [b.cx + lx * c + lz * s, b.cz - lx * s + lz * c];
    const corners = [[b.w / 2 + 6, b.d / 2 + 6], [-b.w / 2 - 6, -b.d / 2 - 6]];
    corners.forEach(([lx, lz], i) => {
      const [x, z] = toWorld(lx, lz);
      add(`CAM-${b.id}${i + 1}`, `${b.name} — corner ${i + 1}`, b.name, x, z, { type: 'Bullet' });
    });
  });
  PARKING_ZONES.forEach((p, i) => add(`CAM-P0${i + 1}`, `${p.name}`, 'Parking', p.cx, p.cz, { type: 'Dome' }));
  BOUNDARY.forEach(([x, z], i) => {
    if (i % 1 === 0) add(`CAM-PR${String(i + 1).padStart(2, '0')}`, `Perimeter P${i + 1}`, 'Perimeter', x, z, { type: 'Bullet' });
  });
  return cams;
}
export const CAMERAS = buildCameras();

/* --------------------------------------------- derived: building geometry */
export function buildingToWorld(b, lx, lz) {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  return [b.cx + lx * c + lz * s, b.cz - lx * s + lz * c];
}

/** Local metres → approximate lat/lng around the site centre (for GIS overlays). */
export function localToLngLat(x, z, rotDeg = -8) {
  const r = (rotDeg * Math.PI) / 180;
  const xr = x * Math.cos(r) - z * Math.sin(r);
  const zr = x * Math.sin(r) + z * Math.cos(r);
  const lat = SITE.centre.lat - zr / 111320;
  const lng = SITE.centre.lng + xr / (111320 * Math.cos((SITE.centre.lat * Math.PI) / 180));
  return [lng, lat];
}
