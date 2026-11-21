/**
 * Horizon Industrial Parks — portfolio master data.
 *
 * Source: hiparks.com park finder (CMS park records: land area, development
 * potential, land use, construction status, IGBC status, coordinates).
 * Coordinates that were duplicated / mis-entered in the source CMS have been
 * corrected to the park's locality (flagged with `coordNote`).
 *
 * This is static master data (what a portfolio register holds). All live
 * operating figures are produced by the simulation feed in src/sim.
 */

export const CLUSTERS = {
  NCR: { id: 'NCR', name: 'Delhi NCR', state: 'Haryana / Delhi' },
  AMD: { id: 'AMD', name: 'Ahmedabad', state: 'Gujarat' },
  PUN: { id: 'PUN', name: 'Pune', state: 'Maharashtra' },
  MUM: { id: 'MUM', name: 'Mumbai', state: 'Maharashtra' },
  NSK: { id: 'NSK', name: 'Nashik', state: 'Maharashtra' },
  NAG: { id: 'NAG', name: 'Nagpur', state: 'Maharashtra' },
  HYD: { id: 'HYD', name: 'Hyderabad', state: 'Telangana' },
  BLR: { id: 'BLR', name: 'Bengaluru', state: 'Karnataka' },
  CHN: { id: 'CHN', name: 'Chennai', state: 'Tamil Nadu' },
  GOA: { id: 'GOA', name: 'Goa', state: 'Goa' },
};

// type: 'ILP' = Industrial & Logistics Park, 'INCITY' = InCity Center
// status: 'operational' | 'construction'
const ILP = [
  // Delhi NCR
  { id: 'farukhnagar-1', name: 'Farukhnagar I', cluster: 'NCR', lat: 28.46615, lng: 76.80171, acres: 107, msf: 3.2, use: 'Warehousing', status: 'construction', igbc: 'IGBC Platinum' },
  { id: 'farukhnagar-2', name: 'Farukhnagar II', cluster: 'NCR', lat: 28.47828, lng: 76.80434, acres: 98, msf: 2.2, use: 'Warehousing', status: 'operational', igbc: 'IGBC Platinum' },
  { id: 'bilaspur', name: 'Bilaspur', cluster: 'NCR', lat: 28.27245, lng: 76.87049, acres: 94, msf: 2.6, use: 'Industrial & Warehousing', status: 'operational', igbc: 'IGBC Platinum' },
  { id: 'koka', name: 'Koka', cluster: 'NCR', lat: 28.43326, lng: 76.64279, acres: 33, msf: 0.9, use: 'Warehousing', status: 'operational', igbc: 'In progress' },
  { id: 'luhari', name: 'Luhari', cluster: 'NCR', lat: 28.39048, lng: 76.70069, acres: 123, msf: 3.3, use: 'Warehousing', status: 'construction', igbc: 'IGBC Platinum' },
  // Ahmedabad
  { id: 'bhayala', name: 'Bhayala', cluster: 'AMD', lat: 22.7476, lng: 72.29527, acres: 39, msf: 0.9, use: 'Industrial & Warehousing', status: 'construction', igbc: 'IGBC Platinum (pre-cert.)' },
  // Pune
  { id: 'chakan-2', name: 'Chakan II', cluster: 'PUN', lat: 18.76181, lng: 73.77008, acres: 52, msf: 1.4, use: 'Industrial & Warehousing', status: 'operational', igbc: 'IGBC Platinum' },
  { id: 'chakan-5', name: 'Chakan V', cluster: 'PUN', lat: 18.79751, lng: 73.81723, acres: 99, msf: 2.5, use: 'Industrial & Warehousing', status: 'construction', igbc: 'IGBC Platinum (pre-cert.)' },
  { id: 'talegaon', name: 'Talegaon', cluster: 'PUN', lat: 18.81432, lng: 73.69804, acres: 234, msf: 5.0, use: 'Warehousing & Industrial', status: 'operational', igbc: 'IGBC Platinum (pre-cert.)' },
  // Mumbai
  { id: 'bhiwandi', name: 'Bhiwandi', cluster: 'MUM', lat: 19.38058, lng: 73.19655, acres: 53, msf: 1.0, use: 'Warehousing & Industrial', status: 'operational', igbc: 'In progress' },
  // Nashik
  { id: 'nashik', name: 'Nashik', cluster: 'NSK', lat: 19.89602, lng: 73.92401, acres: 73, msf: 1.8, use: 'Warehousing & Industrial', status: 'operational', igbc: 'In progress' },
  // Nagpur
  { id: 'xsio-1', name: 'XSIO Park One', cluster: 'NAG', lat: 20.99545, lng: 78.98317, acres: 84, msf: 1.7, use: 'Industrial & Warehousing', status: 'operational', igbc: 'IGBC Platinum · EDGE Advance' },
  { id: 'xsio-2', name: 'XSIO Park Two', cluster: 'NAG', lat: 21.13782, lng: 78.8527, acres: 44, msf: 1.1, use: 'Industrial & Warehousing', status: 'operational', igbc: 'IGBC Platinum (pre-cert.)' },
  { id: 'xsio-3', name: 'XSIO Park Three', cluster: 'NAG', lat: 20.85334, lng: 78.95034, acres: 30, msf: 0.73, use: 'Industrial & Warehousing', status: 'operational', igbc: 'In progress' },
  { id: 'xsio-1n', name: 'XSIO Park One North', cluster: 'NAG', lat: 21.0215, lng: 78.9912, acres: 105, msf: 2.5, use: 'Industrial & Warehousing', status: 'operational', igbc: 'In progress', coordNote: 'offset from XSIO Park One' },
  // Hyderabad
  { id: 'patancheru', name: 'Patancheru', cluster: 'HYD', lat: 17.46476, lng: 78.22239, acres: 26, msf: 0.6, use: 'Industrial & Warehousing', status: 'operational', igbc: 'IGBC Platinum' },
  { id: 'kothur', name: 'Kothur', cluster: 'HYD', lat: 17.14622, lng: 78.27439, acres: 46, msf: 1.3, use: 'Industrial & Warehousing', status: 'operational', igbc: 'IGBC Platinum (pre-cert.)' },
  // Bengaluru
  { id: 'malur', name: 'Malur', cluster: 'BLR', lat: 12.98817, lng: 77.88233, acres: 97, msf: 1.9, use: 'Warehousing', status: 'operational', igbc: 'IGBC Platinum', address: 'Malur–Whitefield Road, Marasandra, Malur, Karnataka 563160', featured: true },
  { id: 'naraspura', name: 'Naraspura', cluster: 'BLR', lat: 13.1285, lng: 77.9862, acres: 100, msf: 2.6, use: 'Warehousing', status: 'operational', igbc: '—', coordNote: 'placed at Narsapura industrial area' },
  { id: 'dobbaspet-1', name: 'Dobbaspet I', cluster: 'BLR', lat: 13.2003, lng: 77.24131, acres: 124, msf: 3.2, use: 'Industrial & Warehousing', status: 'construction', igbc: 'IGBC Platinum (pre-cert.)' },
  { id: 'dobbaspet-2', name: 'Dobbaspet II', cluster: 'BLR', lat: 13.18798, lng: 77.2615, acres: 100, msf: 2.9, use: 'Industrial & Warehousing', status: 'construction', igbc: 'In progress' },
  { id: 'hoskote', name: 'Hoskote', cluster: 'BLR', lat: 13.0812, lng: 77.7765, acres: 37, msf: 0.5, use: 'Warehousing & Industrial', status: 'operational', igbc: 'In progress', coordNote: 'source coordinate pointed to Maharashtra; placed at Hoskote' },
  { id: 'hosur', name: 'Hosur', cluster: 'BLR', lat: 12.62434, lng: 78.08135, acres: 58, msf: 1.5, use: 'Industrial & Warehousing', status: 'operational', igbc: 'IGBC Platinum (pre-cert.)' },
  // Chennai
  { id: 'chengalpattu', name: 'Chengalpattu', cluster: 'CHN', lat: 12.62715, lng: 79.90988, acres: 51, msf: 1.3, use: 'Industrial & Warehousing', status: 'construction', igbc: 'IGBC Platinum (pre-cert.)' },
  { id: 'redhills-1', name: 'Redhills I', cluster: 'CHN', lat: 13.20981, lng: 80.0653, acres: 23, msf: 0.5, use: 'Industrial & Warehousing', status: 'construction', igbc: 'IGBC Platinum (pre-cert.)' },
  { id: 'mappedu', name: 'Mappedu', cluster: 'CHN', lat: 13.04043, lng: 79.84785, acres: 54, msf: 1.3, use: 'Industrial & Warehousing', status: 'operational', igbc: 'IGBC Platinum' },
  { id: 'mwc', name: 'Mahindra World City', cluster: 'CHN', lat: 12.7178, lng: 80.02054, acres: 15, msf: 0.44, use: 'Industrial', status: 'operational', igbc: 'In progress' },
  { id: 'oragadam', name: 'Oragadam', cluster: 'CHN', lat: 12.8161, lng: 79.95023, acres: 135, msf: 4.8, use: 'Warehousing & Industrial', status: 'operational', igbc: 'IGBC Platinum (pre-cert.)' },
  { id: 'oragadam-2', name: 'Oragadam II', cluster: 'CHN', lat: 12.79781, lng: 79.80139, acres: 40, msf: 2.35, use: 'Warehousing & Industrial', status: 'operational', igbc: '—' },
].map((p) => ({ ...p, type: 'ILP' }));

const INCITY = [
  { id: 'ic-alipur-1', name: 'Alipur I', cluster: 'NCR', lat: 28.77292, lng: 77.12956 },
  { id: 'ic-alipur-2', name: 'Alipur II', cluster: 'NCR', lat: 28.78795, lng: 77.13774 },
  { id: 'ic-gurugram', name: 'Gurugram', cluster: 'NCR', lat: 28.4595, lng: 77.0266 },
  { id: 'ic-kirti-nagar', name: 'Kirti Nagar', cluster: 'NCR', lat: 28.655, lng: 77.143 },
  { id: 'ic-narela', name: 'Narela', cluster: 'NCR', lat: 28.852, lng: 77.092 },
  { id: 'ic-okhla-1', name: 'Okhla I', cluster: 'NCR', lat: 28.53, lng: 77.27 },
  { id: 'ic-okhla-2', name: 'Okhla II', cluster: 'NCR', lat: 28.5385, lng: 77.2835 },
  { id: 'ic-rp-bagh', name: 'RP Bagh', cluster: 'NCR', lat: 28.68, lng: 77.2 },
  { id: 'ic-sahibabad-2', name: 'Sahibabad II', cluster: 'NCR', lat: 28.675, lng: 77.35 },
  { id: 'ic-vashi', name: 'Vashi', cluster: 'MUM', lat: 19.077, lng: 73.008 },
  { id: 'ic-thane', name: 'Thane', cluster: 'MUM', lat: 19.2183, lng: 72.9781 },
  { id: 'ic-vardhaman-nagar', name: 'Vardhaman Nagar', cluster: 'NAG', lat: 21.154, lng: 79.13 },
  { id: 'ic-pimpri', name: 'Pimpri', cluster: 'PUN', lat: 18.627, lng: 73.8 },
  { id: 'ic-verna', name: 'Verna', cluster: 'GOA', lat: 15.36, lng: 73.93 },
  { id: 'ic-chromepet', name: 'Chromepet', cluster: 'CHN', lat: 12.951, lng: 80.14 },
  { id: 'ic-virugambakkam', name: 'Virugambakkam', cluster: 'CHN', lat: 13.053, lng: 80.195 },
  { id: 'ic-yeshwantpur', name: 'Yeshwantpur', cluster: 'BLR', lat: 13.028, lng: 77.54 },
].map((p) => ({ ...p, type: 'INCITY', status: 'operational', use: 'In-city fulfilment', msf: 6 / 17 }));

const CLUSTER_STATE = { NCR: 'Haryana', AMD: 'Gujarat', PUN: 'Maharashtra', MUM: 'Maharashtra', NSK: 'Maharashtra', NAG: 'Maharashtra', HYD: 'Telangana', BLR: 'Karnataka', CHN: 'Tamil Nadu', GOA: 'Goa' };
const STATE_OVERRIDE = {
  hosur: 'Tamil Nadu',
  'ic-alipur-1': 'Delhi', 'ic-alipur-2': 'Delhi', 'ic-kirti-nagar': 'Delhi', 'ic-narela': 'Delhi',
  'ic-okhla-1': 'Delhi', 'ic-okhla-2': 'Delhi', 'ic-rp-bagh': 'Delhi', 'ic-sahibabad-2': 'Uttar Pradesh',
};

export const PARKS = [...ILP, ...INCITY].map((p) => ({ ...p, state: STATE_OVERRIDE[p.id] || CLUSTER_STATE[p.cluster] }));
export const STATES = [...new Set(PARKS.map((p) => p.state))].sort();
export const PARK_BY_ID = Object.fromEntries(PARKS.map((p) => [p.id, p]));

export const PORTFOLIO_FACTS = {
  ilpCount: ILP.length, // 29
  incityCount: INCITY.length, // 17
  ilpPotentialMsf: 53.8,
  incityPotentialMsf: 6,
  customers: '100+',
  listing: 'NSE: HORIZONIND',
};

export const FEATURED_PARK_ID = 'malur';
