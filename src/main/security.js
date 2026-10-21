// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// App lock (PIN with auto-lock) and the audit log.
// The audit log is append-only and hash-chained per device: every entry carries the hash of
// the previous entry from the same device, so removing or editing an entry is detectable.
const { powerMonitor } = require('electron');
const S = require('./secure');
const { uid } = require('./store');

const MAX_AUDIT = 6000;

class Security {
  constructor({ store, onLockChange, audit }) {
    this.store = store;
    this.onLockChange = onLockChange;
    this.audit = audit;
    this.locked = false;
    this.failures = 0;
    this.waitUntil = 0;
    this._timer = null;
  }

  get s() { return this.store.data.settings.security; }
  enabled() { return !!(this.s.lock && this.s.pin); }

  start() {
    if (this.enabled() && this.s.lockOnStart !== false) this.locked = true;
    clearInterval(this._timer);
    this._timer = setInterval(() => this._checkIdle(), 20000);
    const lockNow = () => { if (this.enabled()) this.lock('system'); };
    try { powerMonitor.on('lock-screen', lockNow); powerMonitor.on('suspend', lockNow); } catch (_) {}
  }

  _checkIdle() {
    if (!this.enabled() || this.locked) return;
    const min = Number(this.s.autoLockMin) || 0;
    if (!min) return;
    let idle = 0;
    try { idle = powerMonitor.getSystemIdleTime(); } catch (_) { return; }
    if (idle >= min * 60) this.lock('idle');
  }

  lock(reason = 'manual') {
    if (!this.enabled() || this.locked) return false;
    this.locked = true;
    this.onLockChange(true, reason);
    return true;
  }

  unlock(pin) {
    if (!this.locked) return { ok: true };
    const now = Date.now();
    if (now < this.waitUntil) return { ok: false, error: 'Terlalu banyak percobaan. Tunggu sebentar.', waitMs: this.waitUntil - now };
    if (S.checkSecret(String(pin || ''), this.s.pin)) {
      this.locked = false; this.failures = 0; this.waitUntil = 0;
      this.onLockChange(false, 'unlock');
      return { ok: true };
    }
    this.failures++;
    this.audit({ action: 'lock.fail', detail: `Percobaan ke-${this.failures}` });
    let waitMs = 0;
    if (this.failures >= 5) { waitMs = Math.min(15 * 60000, 30000 * Math.pow(2, this.failures - 5)); this.waitUntil = now + waitMs; }
    return { ok: false, error: 'PIN salah.', waitMs, failures: this.failures };
  }

  setPin(pin, currentPin) {
    pin = String(pin || '');
    if (!/^\d{4,8}$/.test(pin) && pin.length < 6) return { ok: false, error: 'Gunakan PIN 4–8 angka atau kata sandi minimal 6 karakter.' };
    if (this.enabled() && !S.checkSecret(String(currentPin || ''), this.s.pin)) return { ok: false, error: 'PIN lama tidak cocok.' };
    const first = !this.enabled();
    this.s.pin = S.hashSecret(pin);
    this.s.lock = true;
    this.store.save();
    this.audit({ action: first ? 'lock.enable' : 'lock.change' });
    return { ok: true };
  }

  disable(currentPin) {
    if (!this.enabled()) return { ok: true };
    if (!S.checkSecret(String(currentPin || ''), this.s.pin)) return { ok: false, error: 'PIN tidak cocok.' };
    this.s.lock = false; this.s.pin = null;
    this.locked = false;
    this.store.save();
    this.audit({ action: 'lock.disable' });
    return { ok: true };
  }

  /** Forgotten PIN: clear it. The caller signs out every account and removes customer data first. */
  forceReset() {
    this.s.lock = false; this.s.pin = null; this.locked = false; this.failures = 0; this.waitUntil = 0;
    this.store.save(true);
  }
}

// ---------- audit log ----------
function entryHash(e) {
  // updatedAt/updatedBy are added by team sync and are not part of the record itself.
  const { hash, updatedAt, updatedBy, ...rest } = e;
  return S.sha256((e.prev || '') + S.stableStringify(rest));
}

function appendAudit(store, actor, { action, target = '', detail = '', at }) {
  const list = store.data.audit;
  const device = (store.data.device && store.data.device.id) || 'local';
  let prev = '';
  for (let i = list.length - 1; i >= 0; i--) { if (list[i].device === device) { prev = list[i].hash; break; } }
  const e = {
    id: uid(), at: Number(at) || Date.now(), actor: actor.id || 'local', actorName: actor.name || '', device,
    action: String(action), target: String(target || '').slice(0, 200), detail: String(detail || '').slice(0, 500), prev
  };
  e.hash = entryHash(e);
  list.push(e);
  if (list.length > MAX_AUDIT) list.splice(0, list.length - MAX_AUDIT);
  store.save();
  return e;
}

/** Checks every device's chain. Entries trimmed by the retention policy start a new chain. */
function verifyAudit(list) {
  const byDevice = new Map();
  let broken = 0;
  for (const e of [...list].sort((a, b) => a.at - b.at)) {
    if (!e || !e.hash) { broken++; continue; }
    if (entryHash(e) !== e.hash) { broken++; continue; }
    const last = byDevice.get(e.device);
    if (last && e.prev !== last) broken++;
    byDevice.set(e.device, e.hash);
  }
  return { ok: broken === 0, total: list.length, broken, devices: byDevice.size };
}

module.exports = { Security, appendAudit, verifyAudit };
