# HIP Command Center — Horizon Industrial Parks × Astrikos

Executive (CXO) dashboard and digital twins for the Horizon Industrial Parks portfolio, with a deep
facility-management view of **HIP Malur (Bengaluru)**. All data is simulated and streamed live.

## Run

```bash
npm install
npm run dev        # http://localhost:5180
```

Login: `admin` / `Astrikos2026`

Production build: `npm run build` → `dist/` (static SPA).

**Deployment (astrikos.xyz):** see [DEPLOY.md](DEPLOY.md) — frontend port 3367 → https://hip-poc.astrikos.xyz:8443 (`pm2 start serve --name "hip-poc_3367" -- ./dist -s -p 3367`).

## What's inside

| Route | Screen |
|---|---|
| `/login` | 60/40 sign-in — slideshow of real HIP Malur photography with HiParks \| Astrikos lock-up; "Facility Management Command Center" |
| `/portfolio` | **Executive View** — 10 CXO KPIs (5 × 2) + **GIS digital twin** with a state layer (filter / highlight by state) — all 29 Industrial & Logistics parks + 17 InCity centers (pins coloured by live health). Click a pin → drill-down card; Malur flies into a 3D footprint with links to its command center & twin |
| `/park/malur` | Command Center — 12 live KPI cards, each with an AI insight; arrivals-vs-gate-capacity, event stream, tenant table |
| `/park/malur/twin` | **3D park digital twin** (masterplan blocks A1/A2/A3, B, D, E) — live truck queue on Malur–Whitefield Rd, docked/parked trucks, parking violations, street-light faults, CCTV status, substation/transformers, water & fire zone, EV buggies, day/night lighting. Click anything for the inspector |
| `/park/malur/gate` | Gate & logistics — queue history, lane status, live queue, dedicated-parking compliance, pre-intimation what-if, gate log |
| `/park/malur/water` | Tanks, use split (domestic / gardening / washrooms), tanker vs borewell mix, borewells, tanker log |
| `/park/malur/energy` | Live single-line (11 kV → 2×750 kVA + 350 kVA, Decathlon own HT, fire DG 320 kVA), transformer loading, street-light fault map, EV buggies |
| `/park/malur/safety` | Camera wall (VMS), Vision-AI pilot detections, hydrant pressure, fire panel, compliance |
| `/park/malur/work-orders` | Work-order tracker — register with SLA countdowns, assignee/status workflow, activity log & comments, category chart, CSV export. WOs are raised manually, from Sia advisories, from the twin inspector, and automatically from incidents, street-light and CCTV faults |

Global: **Sia AI Advisory** drawer (top bar), **Ask Sia** chatbot (bottom-right, 12 suggested questions) and a red
live-incident banner. Every KPI card is clickable — Sia "analyses" for ~2.2 s, then explains the metric and gives its
advisory. Colour standard: purple = AI/Sia, red = critical, amber = moderate, green = safe.

### Incident simulator (Park Digital Twin → left panel)

Trigger / resolve: gate overcrowding at peak, street-light failure, truck parked in the fire lane, water shortage and a
fire at the substation (TR-2). Each incident drives the models, KPIs, Sia advisories (with SOP), CCTV feeds and the 3D twin.
Street-light failure and the fire-lane truck are open when the dashboard loads.

### Report export (top bar → Export)

Executive or HIP Malur scope · Today, 7 days, 30 days, 3 / 6 / 12 months, Overall (since Apr 2024) or a custom
date range · PDF (print-ready, with Sia summary and work orders) or CSV for Excel. Past days come from a deterministic
daily historian (`src/lib/report.js`); today comes from live telemetry.

### CCTV footage

Fixed cameras show real HIP park photography (`public/hip/`, from hiparks.com park pages) as live fixed-camera views;
cameras needing motion use free-licence Mixkit clips (`public/videos/` — truck marshalling, truck bays, road approach,
HT room, smoke/fire). Mapping is in `src/components/CctvVideo.jsx`; incidents switch the relevant camera.

## How the data works (nothing is hard-coded)

```
src/config/      master data — portfolio (from hiparks.com park register) and Malur layout/assets
src/sim/         simulation engine: time-of-day models for gate/trucks, parking, water, power,
                 lighting, EV, CCTV, fire and the portfolio; 24 h back-fill + 5-min history
src/sim/feed.js  mock telemetry feed — publishes a full snapshot every 3 s (websocket-style)
src/ai/          rule-based advisory engine (~30 rules) + RAG chatbot (BM25 over static & live docs)
src/twin/        react-three-fiber 3D twin
src/map/         MapLibre GIS twin
```

To connect real systems later, replace `TelemetryFeed` with a websocket/REST client that emits the
same snapshot shape — every screen, advisory and chatbot answer follows automatically.

### Demo controls (hidden from the UI)

- `?scenario=morning` / `evening` / `night` — jump the IST clock to a peak (e.g. truck queue on the road)
- `?speed=10` — run the simulated clock 10× faster
- `Alt + Shift + P` — cycle scenarios

## Assumptions to confirm

- Tenant ↔ block mapping: Amazon = Block D, Flipkart = Block B, Decathlon = Block A1, other tenants = A2/A3/E
  (`src/config/malur.js → BUILDINGS / TENANTS`).
- "750 × 2" interpreted as two 750 kVA transformers (TR-1 Amazon, TR-2 Flipkart) and "350" as a 350 kVA
  common-area transformer.
- Daily water demand ≈ 143 KL so that ~100 KL/day of tankers ≈ 70 % external.
- Coordinates for Naraspura, Hoskote and XSIO Park One North were corrected (duplicated/wrong in the source register).
