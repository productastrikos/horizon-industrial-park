import { CAMERAS, FIRE } from '../../config/malur';
import { clamp } from '../util';

/**
 * CCTV / VMS health (the site runs a VMS with no analytics today), an
 * Astrikos Vision-AI pilot event stream derived from live conditions, and the
 * fire-protection system (hydrant ring pressure, pumps, panel zones).
 */

function newDay() { return { camOutages: 0, visionEvents: 0, jockeyStarts: 0, panelEvents: 0 }; }

export function createSafety(rng, now) {
  const cams = CAMERAS.map((c) => ({ id: c.id, status: 'online', since: now - rng.range(2, 60) * 86400000, bitrate: rng.range(2.2, 4.2), offlineUntil: null }));
  const nOff = rng.int(1, 3);
  for (let i = 0; i < nOff; i++) {
    const c = rng.pick(cams.filter((x) => x.id.startsWith('CAM-PR') || x.id.startsWith('CAM-P0')));
    c.status = 'offline';
    c.since = now - rng.range(0.3, 5) * 3600000;
    c.offlineUntil = now + rng.range(0.5, 6) * 3600000;
  }
  return {
    cams,
    nvr: { storageUsedPct: rng.range(0.71, 0.86), retentionDays: rng.int(24, 29), retentionTarget: 30, disks: 16, diskFault: rng.chance(0.3) ? 1 : 0 },
    vision: [],
    fire: {
      pressureBar: FIRE.hydrantSetpointBar, jockeyRunning: false, jockeyUntil: 0,
      mainPump: 'AUTO · standby', dieselPump: 'AUTO · standby',
      panel: { zones: FIRE.panelZones, normal: FIRE.panelZones, faults: [], alarms: [] },
      extinguishersDue: rng.int(3, 14), lastDrillDays: rng.int(38, 96), hydrantInspectionDays: rng.int(4, 26),
      sprinklerBar: rng.range(6.6, 7.1),
    },
    lastQueueVision: 0,
    seenViolations: new Set(),
    today: newDay(),
    dateKey: null,
    events: [],
    vseq: 1,
  };
}

function pushEvent(s, ev) { s.events.unshift(ev); if (s.events.length > 60) s.events.length = 60; }
function pushVision(s, ev) { s.vision.unshift({ id: `VA-${String(s.vseq++).padStart(5, '0')}`, ...ev }); if (s.vision.length > 50) s.vision.length = 50; s.today.visionEvents += 1; }

export function stepSafety(s, ctx, gate) {
  const { rng, now, dt, h, dateKey } = ctx;
  if (s.dateKey !== dateKey) { s.today = newDay(); s.dateKey = dateKey; }
  const hrs = dt / 3600;

  /* CCTV availability */
  s.cams.forEach((c, i) => {
    const meta = CAMERAS[i];
    if (c.status === 'offline' && c.offlineUntil && now >= c.offlineUntil) {
      c.status = 'online'; c.since = now; c.offlineUntil = null;
      pushEvent(s, { ts: now, kind: 'cctv', text: `${c.id} (${meta.name}) back online` });
    }
    if (c.status === 'online' && rng.chance((2.5 / 24 / CAMERAS.length) * hrs)) {
      c.status = rng.chance(0.8) ? 'offline' : 'degraded';
      c.since = now;
      c.offlineUntil = now + rng.range(0.4, 4) * 3600000;
      s.today.camOutages += 1;
      pushEvent(s, { ts: now, kind: 'cctv', severity: 'warning', text: `${c.id} (${meta.name}) ${c.status === 'offline' ? 'video loss — no stream to VMS' : 'degraded stream (low bitrate)'}` });
    }
    if (c.status === 'degraded' && now >= c.offlineUntil) { c.status = 'online'; c.offlineUntil = null; }
    c.bitrate = c.status === 'online' ? clamp(c.bitrate + rng.normal(0, 0.05), 1.8, 4.6) : c.status === 'degraded' ? 0.6 : 0;
  });
  s.nvr.storageUsedPct = clamp(s.nvr.storageUsedPct + rng.normal(0, 0.0004), 0.6, 0.97);

  /* Vision-AI pilot detections (derived from live state) */
  if (gate) {
    if (gate.queue.length >= 6 && now - s.lastQueueVision > 12 * 60000) {
      s.lastQueueVision = now;
      pushVision(s, { ts: now, type: 'Queue spill-over', camera: 'CAM-G04', severity: gate.queue.length > 15 ? 'critical' : 'warning', detail: `${gate.queue.length} trucks queued on Malur–Whitefield Road (~${gate.queue.length * 18} m)` });
    }
    gate.violations.forEach((v) => {
      if (!s.seenViolations.has(v.id)) {
        s.seenViolations.add(v.id);
        pushVision(s, { ts: v.ts, type: v.kind === 'wrong-bay' ? 'Wrong-bay parking' : 'No-parking violation', camera: v.camera, severity: 'warning', detail: `${v.plate} at ${v.where}` });
      }
    });
  }
  const night = h >= 20 || h < 5.5;
  if (night && rng.chance(hrs / 6)) {
    pushVision(s, { ts: now, type: 'Perimeter motion', camera: rng.pick(CAMERAS.filter((c) => c.zone === 'Perimeter')).id, severity: rng.chance(0.2) ? 'critical' : 'info', detail: rng.chance(0.7) ? 'Animal movement near boundary wall (auto-classified)' : 'Person detected near boundary after hours' });
  }
  if (rng.chance(hrs / 10)) {
    pushVision(s, { ts: now, type: 'PPE — no hi-vis vest', camera: rng.pick(['CAM-D1', 'CAM-B1', 'CAM-A11', 'CAM-A21']), severity: 'info', detail: 'Person on truck apron without hi-vis vest' });
  }

  /* Fire protection */
  const f = s.fire;
  f.pressureBar -= (0.05 + rng.range(0, 0.03)) * hrs * 6;
  if (!f.jockeyRunning && f.pressureBar < FIRE.jockeyCutInBar) {
    f.jockeyRunning = true;
    f.jockeyUntil = now + rng.range(60, 140) * 1000;
    s.today.jockeyStarts += 1;
  }
  if (f.jockeyRunning) {
    f.pressureBar += 2.2 * hrs * 60;
    if (now >= f.jockeyUntil || f.pressureBar >= FIRE.hydrantSetpointBar + 0.2) f.jockeyRunning = false;
  }
  f.pressureBar = clamp(f.pressureBar + rng.normal(0, 0.01), 5.4, 7.4);
  f.sprinklerBar = clamp(f.sprinklerBar + rng.normal(0, 0.008), 6.2, 7.3);

  // panel: rare zone fault / pre-alarm
  f.panel.faults = f.panel.faults.filter((x) => x.until > now);
  f.panel.alarms = f.panel.alarms.filter((x) => x.until > now);
  if (rng.chance(hrs / 30)) {
    const zone = rng.int(1, FIRE.panelZones);
    f.panel.faults.push({ zone, text: `Zone ${zone}: open-circuit fault`, ts: now, until: now + rng.range(1, 6) * 3600000 });
    s.today.panelEvents += 1;
    pushEvent(s, { ts: now, kind: 'fire', severity: 'warning', text: `Fire alarm panel — zone ${zone} open-circuit fault` });
  }
  if (rng.chance(hrs / 80)) {
    f.panel.alarms.push({ zone: 3, text: 'FM office pantry — smoke detector pre-alarm (verified false)', ts: now, until: now + 12 * 60000 });
    s.today.panelEvents += 1;
    pushEvent(s, { ts: now, kind: 'fire', severity: 'warning', text: 'Smoke pre-alarm in FM office pantry — verified false alarm' });
  }
  f.panel.normal = FIRE.panelZones - f.panel.faults.length - f.panel.alarms.length;
}

export function safetySnapshot(s) {
  const online = s.cams.filter((c) => c.status === 'online').length;
  return {
    cams: s.cams.map((c, i) => ({ ...c, ...CAMERAS[i], status: c.status })),
    camStats: { total: s.cams.length, online, offline: s.cams.filter((c) => c.status === 'offline').length, degraded: s.cams.filter((c) => c.status === 'degraded').length, uptime: online / s.cams.length, analyticsEnabled: 0 },
    nvr: { ...s.nvr },
    vision: s.vision.slice(0, 40),
    fire: { ...s.fire, panel: { ...s.fire.panel, faults: [...s.fire.panel.faults], alarms: [...s.fire.panel.alarms] } },
    today: { ...s.today },
    events: s.events.slice(0, 40),
  };
}
