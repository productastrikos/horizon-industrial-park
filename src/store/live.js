import { create } from 'zustand';
import { TelemetryFeed } from '../sim/feed';
import { evaluateAdvisories } from '../ai/advisories';

/**
 * Live data store. Subscribes to the telemetry feed; on every packet it
 * stores the snapshot + history, re-runs the advisory engine, and tracks
 * when each advisory was first raised.
 */

let feed = null;

export const useLive = create((set, get) => ({
  status: 'connecting',
  snapshot: null,
  history: [],
  receivedAt: 0,
  packets: 0,
  scenario: 'live',
  advisories: [],
  firstSeen: {},
  acked: {},
  workOrders: [],

  init() {
    if (feed) return;
    feed = TelemetryFeed.fromUrl();
    feed.subscribe((packet) => {
      const advisories = evaluateAdvisories(packet.snapshot, packet.history);
      const firstSeen = { ...get().firstSeen };
      const active = new Set();
      advisories.forEach((a) => {
        active.add(a.id);
        if (!firstSeen[a.id]) firstSeen[a.id] = packet.snapshot.ts;
        a.since = a.since || firstSeen[a.id];
      });
      Object.keys(firstSeen).forEach((k) => { if (!active.has(k)) delete firstSeen[k]; });
      // reflect Malur's live alert count on the portfolio map
      const m = packet.snapshot.portfolio.parks.find((p) => p.id === 'malur');
      if (m) {
        m.alerts = { critical: advisories.filter((a) => a.severity === 'critical' && a.scope !== 'portfolio').length, warning: advisories.filter((a) => a.severity === 'warning' && a.scope !== 'portfolio').length };
        m.health = Math.max(35, 100 - m.alerts.critical * 9 - m.alerts.warning * 3);
      }
      set((s) => ({
        status: 'live',
        snapshot: packet.snapshot,
        history: packet.history,
        receivedAt: packet.receivedAt,
        packets: s.packets + 1,
        scenario: packet.scenario,
        advisories,
        firstSeen,
      }));
    });
    feed.start();
  },

  setScenario(id) { feed?.setScenario(id); },
  injectIncident(type) { feed?.inject(type); },
  resolveIncident(id) { feed?.resolve(id); },

  ack(id) { set((s) => ({ acked: { ...s.acked, [id]: Date.now() } })); },

  createWorkOrder(advisory) {
    const wo = { id: `WO-${Math.floor(Date.now() / 1000) % 100000}`, advisoryId: advisory.id, title: advisory.title, ts: Date.now(), status: 'Raised' };
    set((s) => ({ workOrders: [wo, ...s.workOrders], acked: { ...s.acked, [advisory.id]: Date.now() } }));
    return wo;
  },
}));

export const selectSnapshot = (s) => s.snapshot;
