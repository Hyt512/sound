// Device-local activity journal. No audio files, accounts or data are sent to a server.
const activity = (() => {
  const key = 'soundloom-activity-v1';
  const blank = () => ({ history: [], listenMs: 0, sessions: 0 });
  let data = blank(), available = true, pending = null, debounce, current = null, checkpoint = null, lastPersist = 0;
  const valid = p => p && typeof p.name === 'string' && Number.isFinite(p.master) && p.master >= 0 && p.master <= 100 && Array.isArray(p.sounds) && p.sounds.length <= 100 && p.sounds.every(s => s && typeof s.id === 'string' && Number.isFinite(s.volume) && s.volume >= 0 && s.volume <= 100 && Number.isInteger(s.variant) && s.variant >= 0);
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (raw) {
      data.history = Array.isArray(raw.history) ? raw.history.filter(p => valid(p) && Number.isFinite(p.at)).slice(0, 100) : [];
      data.listenMs = Number.isFinite(raw.listenMs) && raw.listenMs >= 0 ? raw.listenMs : 0;
      data.sessions = Number.isInteger(raw.sessions) && raw.sessions >= 0 ? raw.sessions : 0;
    }
  } catch { available = false; }
  function persist() { try { localStorage.setItem(key, JSON.stringify(data)); available = true; } catch { available = false; } lastPersist = Date.now(); }
  function notify() { if (api.onChange) api.onChange(); }
  const signature = p => JSON.stringify([p.master, p.sounds.filter(s => s.volume > 0).map(s => [s.id, s.volume, s.variant]).sort((a, b) => a[0].localeCompare(b[0]))]);
  function flush() {
    clearTimeout(debounce);
    if (!pending) return;
    const p = pending; pending = null;
    if (!p.sounds.some(s => s.volume > 0)) return;
    const previous = data.history[0];
    if (previous && signature(previous) === signature(p)) { previous.name = p.name; persist(); notify(); return; }
    data.history.unshift({ ...p, at: Date.now() });
    data.history = data.history.slice(0, 100); persist(); notify();
  }
  function tick() {
    const now = Date.now();
    if (checkpoint !== null) {
      // Count only while playback is running and the current mix is audible.
      if (current && current.master > 0 && current.sounds.some(s => s.volume > 0)) data.listenMs += Math.max(0, now - checkpoint);
      checkpoint = now;
      if (now - lastPersist >= 15000) persist();
    }
  }
  function schedule(p) {
    if (!valid(p)) return;
    tick(); current = JSON.parse(JSON.stringify(p)); pending = current;
    clearTimeout(debounce); debounce = setTimeout(flush, 1200);
  }
  const api = {
    onChange: null,
    get storageAvailable() { return available; },
    read() { tick(); return JSON.parse(JSON.stringify(data)); },
    schedule, tick, flush,
    start(p) { schedule(p); flush(); if (checkpoint === null) { checkpoint = Date.now(); data.sessions++; persist(); notify(); } },
    stop() { tick(); checkpoint = null; flush(); persist(); notify(); },
    clear() { clearTimeout(debounce); pending = null; data = blank(); if (checkpoint !== null) checkpoint = Date.now(); persist(); notify(); }
  };
  window.addEventListener('pagehide', () => { tick(); flush(); persist(); });
  document.addEventListener('visibilitychange', () => { tick(); flush(); persist(); });
  return api;
})();
