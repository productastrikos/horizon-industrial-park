/**
 * Two-line explanation of every KPI shown on the dashboards — what the
 * metric measures and why it matters to HIP. Used by Sia's KPI analysis.
 */
export const KPI_INFO = {
  // Executive view
  'exec-parks': ['Number of Grade-A Industrial & Logistics parks and InCity centers in the Horizon network.', 'Network reach determines how quickly tenants can shift, scale or split operations across markets.'],
  'exec-potential': ['Total developable built-up area across the I&L parks (million sq ft).', 'Tracks how much growth capacity remains in the land bank for new built-to-suit demand.'],
  'exec-occupancy': ['Leased share of completed, operational area, weighted by park size.', 'Occupancy is the primary revenue driver; every 1% equals roughly 0.4 MN sq ft of leased space.'],
  'portfolio-trucks': ['Trucks processed through all park gates since midnight IST.', 'A proxy for tenant activity and gate load; sudden drops often flag tenant or access issues.'],
  'exec-wait': ['Average time a truck waits at the park gate before entry, across operational parks.', 'Long gate waits spill trucks onto public roads, irritate tenants and create community risk.'],
  'exec-energy': ['Electricity drawn today through HIP-metered transformers and common-area feeders.', 'Feeds the ESG / GRESB energy-intensity metric and highlights abnormal consumption early.'],
  'exec-water': ['Water consumed today across parks for domestic use, landscape and washrooms.', 'External (tanker) dependency is a cost and resilience risk — Malur is ~70% external today.'],
  'portfolio-alerts': ['Open critical and warning alerts raised by park systems right now.', 'Critical alerts need action within the hour; the count is the CXO’s operational risk barometer.'],
  'exec-health': ['Composite 0–100 score per park from alerts, occupancy and system availability.', 'Lets the leadership spot the weakest parks without opening each dashboard.'],
  'exec-green': ['Parks holding an IGBC Platinum certification (pre-certified parks excluded).', 'Green certification underpins tenant ESG commitments and Horizon’s GRESB sector leadership.'],

  // Malur — gate & logistics
  'trucks-today': ['Trucks that cleared the main gate into HIP Malur since midnight.', 'Compared with the typical profile it shows whether tenant volumes are tracking plan.'],
  'gate-queue': ['Trucks waiting outside Gate 1 on the Malur–Whitefield Road right now.', 'Six or more trucks spill onto the public road — a safety and community-relations risk.'],
  'gate-wait': ['Average and worst wait from arrival at the gate to entry, today.', 'The SLA is ≤ 10 minutes; beyond that tenants lose dock slots and drivers idle on the road.'],
  'pre-intimation': ['Share of trucks whose vehicle details were shared by the tenant before arrival.', 'Pre-intimated trucks clear the gate in ~1 minute vs ~2.5 minutes for manual verification.'],
  parking: ['Vehicles parked outside their tenant’s dedicated bays or in no-parking zones.', 'Wrong parking blocks fire lanes and dock aprons and causes cross-tenant disputes.'],
  'gate-road': ['Cumulative truck-hours spent queuing on the public road today.', 'A direct measure of the gate bottleneck’s impact outside the park boundary.'],

  // Water
  'water-today': ['Total water consumed today for washrooms, domestic use and gardening.', 'Compared with the pro-rata daily plan of ~143 KL to catch leaks or overuse early.'],
  'water-external': ['Share of today’s supplied water bought in by tanker versus own borewells.', 'High dependency means cost (₹85/KL) and supply risk if tankers are delayed.'],
  'water-tankers': ['Tanker deliveries received today and their cost.', 'Each tanker is 10 KL; fewer tankers means better use of borewells and STP water.'],
  'water-borewell': ['Water pumped today from the two borewells (BW-1, BW-2).', 'Borewell yield offsets tanker purchases; trips usually indicate falling groundwater.'],
  'water-stp': ['Share of STP-treated water that is reused (currently landscape irrigation).', 'Raising reuse to flushing is the single biggest lever to cut tanker dependency.'],
  'fire-reserve': ['Fire water reserve level and hydrant ring-main pressure.', 'The reserve must stay full and the ring pressurised for the fire system to be ready.'],

  // Power
  grid: ['Incoming 11 kV supply voltage and frequency from BESCOM.', 'Low voltage or outages affect tenant equipment and HIP common services.'],
  'tr-load': ['Loading of the 750 kVA transformers dedicated to Amazon (TR-1) and Flipkart (TR-2).', 'Above 85% sustained loading raises oil temperature and the risk of protective trips.'],
  tr2: ['Loading of TR-2 (750 kVA) supplying Flipkart, Block B.', 'Headroom indicates whether the tenant can add MHE charging or conveyors without upgrades.'],
  'common-power': ['Common-area load on TR-3 (350 kVA): street lights, pumps, FM office, CCTV, EV charging.', 'This is HIP’s own energy bill — the main target for efficiency savings.'],
  'fire-dg': ['Readiness of the 320 kVA diesel generator dedicated to the fire pumps.', 'Fuel, battery and weekly test status decide whether fire pumps run during a grid failure.'],
  'street-lights': ['Street lights working vs faulty, detected from each pole’s current draw.', 'Dark stretches on truck routes increase accident and security risk at night.'],
  ev: ['Electric buggies available for internal movement and their charge levels.', 'Buggy availability keeps FM patrols and staff movement running across the 97-acre site.'],

  // Safety
  cctv: ['Share of cameras streaming to the VMS right now.', 'Every offline camera is a blind spot for security and incident investigation.'],
  'cctv-offline': ['Cameras currently offline or with a degraded stream.', 'Gate and perimeter blind spots are prioritised for repair within 4 hours.'],
  vms: ['Days of video the VMS retains versus the 30-day requirement.', 'Short retention can lose evidence for disputes, thefts or accidents.'],
  vision: ['Events detected by the Astrikos Vision-AI pilot (queue, parking, perimeter, PPE).', 'The current VMS has no analytics — these show what automated detection adds.'],
  'fire-panel': ['Fire alarm panel detection zones in normal state.', 'A faulty zone is not monitored; an alarm requires physical verification immediately.'],
};

/** Which history series to use for a trend comparison (optional). */
export const KPI_TREND = {
  'trucks-today': 'arrivals', 'gate-queue': 'queue', 'gate-wait': 'estWait', parking: 'violations',
  'tr-load': 'tr1', tr2: 'tr2', 'common-power': 'tr3', 'street-lights': 'lights_fault', cctv: 'cam_online',
  'fire-reserve': 'pressure', 'portfolio-trucks': 'arrivals', ev: 'ev_service', grid: 'kv',
};
