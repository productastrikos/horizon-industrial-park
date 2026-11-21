import { createEngine } from './engine';
import { istMidnight } from './util';

/**
 * Mock real-time telemetry feed.
 *
 * Stands in for the IoT / VMS / BMS gateway: it publishes a full park
 * snapshot every `intervalMs` (default 3 s) to subscribers, exactly like a
 * websocket topic would. On start it warms up and back-fills 24 h of history
 * so trend charts are populated immediately.
 *
 * Demo controls (not shown in the UI):
 *   ?scenario=morning | evening | night   → jump the simulated clock (IST)
 *   ?speed=N                              → run the clock N× faster
 *   Alt+Shift+P (keyboard)                → cycle scenarios
 */

const SCENARIOS = {
  live: null,
  morning: { h: 8, m: 35 },
  evening: { h: 18, m: 40 },
  night: { h: 21, m: 30 },
};

const WARMUP_H = 6;
const HISTORY_H = 24;

export class TelemetryFeed {
  constructor({ intervalMs = 3000, speed = 1, scenario = 'live' } = {}) {
    this.intervalMs = intervalMs;
    this.speed = speed;
    this.listeners = new Set();
    this.timer = null;
    this.scenario = scenario;
    this.offsetMs = 0;
    this.engine = null;
  }

  static fromUrl() {
    const q = new URLSearchParams(window.location.search);
    const speed = Math.max(0.1, Math.min(120, Number(q.get('speed')) || 1));
    const scenario = SCENARIOS[q.get('scenario')] !== undefined ? q.get('scenario') : 'live';
    return new TelemetryFeed({ speed, scenario });
  }

  offsetFor(scenario) {
    const sc = SCENARIOS[scenario];
    if (!sc) return 0;
    const now = Date.now();
    const target = istMidnight(now) + (sc.h * 60 + sc.m) * 60000;
    return target - now;
  }

  boot() {
    this.offsetMs = this.offsetFor(this.scenario);
    const simNow = Date.now() + this.offsetMs;
    const seed = Math.floor(simNow / 86400000) * 97 + 11;
    const start = simNow - (WARMUP_H + HISTORY_H) * 3600000;
    const engine = createEngine({ seed, startTs: start });
    engine.setRecording(false);
    engine.step(WARMUP_H * 3600);
    engine.setRecording(true);
    engine.step((simNow - engine.now) / 1000);
    // demo: a couple of live incidents are already open when the dashboard loads
    engine.inject('light-outage');
    engine.inject('illegal-parking');
    this.engine = engine;
    this.lastReal = Date.now();
  }

  start() {
    if (this.timer) return;
    this.boot();
    this.emit();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    this.keyHandler = (e) => {
      if (e.altKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        const order = Object.keys(SCENARIOS);
        this.setScenario(order[(order.indexOf(this.scenario) + 1) % order.length]);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
  }

  setScenario(scenario) {
    this.scenario = scenario;
    this.boot();
    this.emit();
  }

  inject(type) { this.engine.inject(type); this.emit(); }

  resolve(id) { this.engine.resolve(id); this.emit(); }

  tick() {
    const real = Date.now();
    const dt = ((real - this.lastReal) / 1000) * this.speed;
    this.lastReal = real;
    this.engine.step(dt);
    this.emit();
  }

  emit() {
    const snapshot = this.engine.snapshot();
    const history = this.engine.history();
    const packet = { snapshot, history, receivedAt: Date.now(), scenario: this.scenario, speed: this.speed };
    this.listeners.forEach((fn) => fn(packet));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
