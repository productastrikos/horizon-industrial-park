/** Scene colours per theme (light / dark) and time of day. */
export function scenePalette(theme, night) {
  const dark = theme === 'dark';
  return {
    bg: dark ? (night ? '#0b0d12' : '#0f1115') : night ? '#c9ccd4' : '#eef0ec',
    fog: dark ? (night ? '#0b0d12' : '#0f1115') : night ? '#c9ccd4' : '#eef0ec',
    outer: dark ? '#171a20' : night ? '#d3d4cf' : '#e4e3dc',
    site: dark ? '#1d2b23' : '#d9e6d2',
    green: dark ? '#1d3325' : '#c4dbb9',
    apron: dark ? '#33363e' : '#dcdad4',
    road: dark ? '#4a4d57' : '#a7a6a2',
    publicRoad: dark ? '#3c3f49' : '#8f8e8a',
    marking: dark ? '#6b6d75' : '#f4f3ef',
    wall: dark ? '#c4c9d0' : '#f2f3f5',
    roof: dark ? '#8d949c' : '#cfd4da',
    roofHover: dark ? '#b0a090' : '#f7d8c0',
    band: '#F47922',
    dock: dark ? '#3a3f47' : '#5d636b',
    boundary: dark ? '#4a5a4f' : '#9fb59a',
    rail: dark ? '#4d4f57' : '#7c7b77',
    tree: dark ? '#2b5a3a' : '#5f9b5a',
    trunk: dark ? '#4a3a2c' : '#7a5b40',
    parkingTruck: dark ? '#262a31' : '#c9c6bf',
    parkingCar: dark ? '#24272d' : '#d2d0ca',
    stripe: dark ? '#555863' : '#ffffff',
    lampOn: '#ffd27a',
    lampOff: dark ? '#5a5e66' : '#8a8e96',
    pole: dark ? '#6b707a' : '#7d828a',
    water: '#3b8fd9',
    fire: '#e04a3c',
    ok: '#22a35a',
    warn: '#e0a100',
    crit: '#e5484d',
    info: '#2a78d6',
    brand: '#F47922',
    purple: '#8F53A1',
    label: dark ? '#f0efec' : '#161616',
    ambient: night ? (dark ? 0.75 : 0.7) : dark ? 0.85 : 0.95,
    sun: night ? (dark ? 0.55 : 0.45) : dark ? 1.1 : 1.35,
  };
}

export const TENANT_HEX = {
  light: { amazon: '#2a78d6', flipkart: '#eb6834', decathlon: '#8f53a1', others: '#1baf7a' },
  dark: { amazon: '#3987e5', flipkart: '#e07035', decathlon: '#a679c9', others: '#199e70' },
};
