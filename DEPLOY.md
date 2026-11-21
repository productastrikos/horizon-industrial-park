# DEPLOY — HIP POC (Horizon Industrial Parks · Facility Management Command Center)

Follows `deployment_context.md` (astrikos.xyz server convention).

## Process table

| Tier | Port | Subdomain | pm2 name | Cloudflare | Status |
| --- | --- | --- | --- | --- | --- |
| Frontend (static SPA, Vite → `dist/`) | **3367** | `hip-poc.astrikos.xyz` | `hip-poc_3367` | **Orange** | deploy |
| Backend (API + socket) | 4367 *(reserved)* | `hip-poc-api.astrikos.xyz` | `hip-poc_be_4367` | Gray | **not needed** |

**This POC has no backend.** All telemetry, Sia advisories, the chatbot, incidents,
work orders and reports run in the browser (simulated feed in `src/sim/`). So only the
frontend process, the `astrikos.conf` block and the Orange DNS record are required.
Port 4367 / `hip-poc-api` are reserved for when a real backend is added — do **not**
create an `astriverse.conf` block or Gray DNS record until then.

Registry row (`deployment_context.md` §6):

| POC | Frontend | Backend | Status |
| --- | --- | --- | --- |
| hip-poc | 3367 | 4367 (reserved, unused) | live |

## Prerequisites (server, once)

```bash
node -v          # >= 20 (Vite 7)
npm i -g pm2 serve
```

## Environment

`.env.production` is committed and read at build time — no hosts/ports in source.

```
VITE_APP_URL=https://hip-poc.astrikos.xyz:8443
VITE_BASEMAP_STYLE=https://basemaps.cartocdn.com/gl/positron-gl-style/style.json
# VITE_API_URL / VITE_SOCKET_URL → https://hip-poc-api.astrikos.xyz:8443 (reserved, unused)
```

## Deploy

```bash
# ── Frontend (static SPA) ─────────────────────────────────────────
git clone https://github.com/productastrikos/horizon-industrial-park.git hip-poc
cd hip-poc
npm install && npm run build                       # → dist/
pm2 start serve --name "hip-poc_3367" -- ./dist -s -p 3367

# ── Backend ───────────────────────────────────────────────────────
# none for this POC (4367 reserved)

pm2 save
```

Redeploy after a `git pull`:

```bash
cd hip-poc && git pull && npm install && npm run build && pm2 restart hip-poc_3367
```

`-s` (single-page mode) makes `serve` return `index.html` for deep links such as
`/park/malur/twin`, so React Router routes work on refresh.

## nginx — `/etc/nginx/conf/astrikos.conf` (frontend)

```nginx
server {
    listen 8443 ssl;
    ssl_certificate     /etc/certs/astrikos.xyz/fullchain.pem;
    ssl_certificate_key /etc/certs/astrikos.xyz/privkey.pem;
    server_name hip-poc.astrikos.xyz;
    location / {
        add_header 'Access-Control-Allow-Origin' '*' always;
        proxy_pass http://127.0.0.1:3367;
    }
}
```

`astriverse.conf` — **no block for this POC** (no backend). When a backend is added on
4367, use the standard websocket-upgrade block from `deployment_context.md` §7 with
`server_name hip-poc-api.astrikos.xyz;` and `proxy_pass http://127.0.0.1:4367;`.

Apply:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Cloudflare DNS

- `hip-poc.astrikos.xyz` → **Orange** (proxied)
- `hip-poc-api.astrikos.xyz` → not created (no backend)

## Verify

```bash
curl -k https://hip-poc.astrikos.xyz:8443                         # SPA HTML (title: Facility Management Command Center)
curl -k -o /dev/null -w "%{http_code}\n" https://hip-poc.astrikos.xyz:8443/park/malur/twin   # 200 (SPA fallback)
curl -k -I https://hip-poc.astrikos.xyz:8443/videos/gate-marshal.mp4                          # 200, video/mp4
```

Open https://hip-poc.astrikos.xyz:8443/ → login `admin` / `Astrikos2026`.

## Notes

- Outbound internet is needed in the **viewer's browser** for the GIS basemap tiles
  (CARTO). Everything else (videos, HIP photos, logos, fonts) is served from `dist/`.
- `dist/` is ~60 MB (CCTV clips + park photos); first load streams only what each page uses.
