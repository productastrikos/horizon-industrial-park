import { create } from 'zustand';

export const LAYERS = [
  { id: 'trucks', label: 'Trucks & queue' },
  { id: 'parking', label: 'Parking zones' },
  { id: 'lights', label: 'Street lights' },
  { id: 'cctv', label: 'CCTV' },
  { id: 'utilities', label: 'Power & water' },
  { id: 'ev', label: 'EV buggies' },
  { id: 'labels', label: 'Labels' },
];

export const PRESETS = {
  overview: { label: 'Overview', pos: [430, 900, 1180], target: [-40, 0, 40] },
  gate: { label: 'Main gate', pos: [10, 95, 585], target: [-110, 0, 430] },
  warehouses: { label: 'A-cluster', pos: [520, 300, 40], target: [220, 0, -230] },
  utilities: { label: 'Utilities', pos: [-180, 230, 120], target: [-380, 0, 60] },
  top: { label: 'Plan view', pos: [-40, 1450, 60], target: [-40, 0, 0] },
};

export const useTwin = create((set) => ({
  selected: null, // { type, id }
  hovered: null,
  layers: Object.fromEntries(LAYERS.map((l) => [l.id, true])),
  preset: 'overview',
  presetNonce: 0,
  select: (sel) => set({ selected: sel }),
  hover: (h) => set({ hovered: h }),
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  goPreset: (preset) => set((s) => ({ preset, presetNonce: s.presetNonce + 1 })),
  custom: null,
  focus: (x, z, dist = 260) => set((s) => ({ preset: 'custom', custom: { pos: [x + dist * 0.55, dist * 0.75, z + dist], target: [x, 0, z] }, presetNonce: s.presetNonce + 1 })),
}));
