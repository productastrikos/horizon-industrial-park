import { create } from 'zustand';

const read = (store, key, fallback) => {
  try { const v = store.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
};
const write = (store, key, v) => { try { if (v == null) store.removeItem(key); else store.setItem(key, v); } catch { /* storage unavailable */ } };

export const DEMO_USER = { username: 'admin', name: 'Admin', role: 'CXO · Executive view' };
const DEMO_PASSWORD = 'Astrikos2026';

export const useUi = create((set, get) => ({
  theme: read(localStorage, 'hip-theme', 'light') === 'dark' ? 'dark' : 'light',
  user: read(sessionStorage, 'hip-auth', null) ? DEMO_USER : null,
  advisoryOpen: false,
  chatOpen: false,
  sidebarCollapsed: read(localStorage, 'hip-sidebar', '0') === '1',

  setTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    write(localStorage, 'hip-theme', theme);
    set({ theme });
  },
  toggleTheme() { get().setTheme(get().theme === 'dark' ? 'light' : 'dark'); },

  login(username, password) {
    if (username.trim().toLowerCase() === DEMO_USER.username && password === DEMO_PASSWORD) {
      write(sessionStorage, 'hip-auth', '1');
      set({ user: DEMO_USER });
      return true;
    }
    return false;
  },
  logout() { write(sessionStorage, 'hip-auth', null); set({ user: null, advisoryOpen: false, chatOpen: false }); },

  exportOpen: false,
  setExportOpen(v) { set({ exportOpen: v }); },
  kpiModal: null,
  openKpi(kpi) { set({ kpiModal: { ...kpi, nonce: Date.now() } }); },
  closeKpi() { set({ kpiModal: null }); },
  advisoryFocus: null,
  setAdvisoryOpen(v) { set({ advisoryOpen: v, advisoryFocus: v ? get().advisoryFocus : null }); },
  openAdvisory(id) { set({ advisoryOpen: true, advisoryFocus: id || null }); },
  setChatOpen(v) { set({ chatOpen: v }); },
  toggleSidebar() { const v = !get().sidebarCollapsed; write(localStorage, 'hip-sidebar', v ? '1' : '0'); set({ sidebarCollapsed: v }); },
}));

// apply persisted theme on load
document.documentElement.classList.toggle('dark', useUi.getState().theme === 'dark');
