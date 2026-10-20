// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Automatic updates from GitHub Releases.
//  - Windows: new versions download in the background and install when Serambi closes
//    (or right away with "Mulai ulang & perbarui").
//  - macOS: an app has to be signed with an Apple Developer ID before it may replace
//    itself, so Serambi checks for a new version and offers a download button instead.
const { app, net, shell } = require('electron');
const cfg = require('./config');

const RELEASES_URL = `https://github.com/${cfg.UPDATE_OWNER}/${cfg.UPDATE_REPO}/releases/latest`;
const API_URL = `https://api.github.com/repos/${cfg.UPDATE_OWNER}/${cfg.UPDATE_REPO}/releases/latest`;
const FIRST_CHECK_MS = 15 * 1000;
const EVERY_MS = 6 * 60 * 60 * 1000;

function parts(v) {
  return String(v || '').replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map(n => parseInt(n, 10) || 0);
}
function isNewer(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; }
  return false;
}

function friendly(err) {
  const msg = String((err && (err.message || err.code)) || err || '');
  if (/404|Not Found|Cannot find latest|no published versions/i.test(msg)) return 'Belum ada versi yang diterbitkan di server pembaruan.';
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|ERR_INTERNET|ERR_NAME|ERR_CONNECTION|net::|fetch failed|timeout/i.test(msg)) return 'Tidak bisa terhubung ke server pembaruan. Periksa koneksi internet.';
  if (/sha512|checksum/i.test(msg)) return 'Berkas pembaruan rusak saat diunduh. Serambi akan mencoba lagi nanti.';
  if (/rate limit|403/i.test(msg)) return 'Server pembaruan sedang sibuk. Serambi akan mencoba lagi nanti.';
  return 'Gagal memeriksa pembaruan. Serambi akan mencoba lagi nanti.';
}

class Updater {
  constructor({ getSettings, onChange, notify, prepareQuit }) {
    this.getSettings = getSettings;
    this.onChange = onChange;
    this.notify = notify;
    this.prepareQuit = prepareQuit;
    this.dev = !app.isPackaged;
    // Test hooks, honoured only when running from source.
    const forced = this.dev ? process.env.SERAMBI_UPDATE_MODE : null;
    this.mode = forced || (process.platform === 'win32' ? 'auto' : process.platform === 'darwin' ? 'manual' : 'none');
    this.active = this.mode !== 'none' && (!this.dev || !!forced);
    this.notified = new Set();
    this.au = null;
    this.state = {
      mode: this.mode,
      status: this.active ? 'idle' : 'unavailable',
      current: app.getVersion(),
      version: null,
      progress: 0,
      error: '',
      checkedAt: null,
      releaseUrl: RELEASES_URL
    };
  }

  set(patch) {
    Object.assign(this.state, patch);
    this.onChange({ ...this.state });
  }

  start() {
    if (!this.active) return;
    if (this.mode === 'auto') {
      try { this._setupAuto(); } catch (err) {
        this.active = false;
        this.set({ status: 'error', error: friendly(err) });
        return;
      }
    }
    setTimeout(() => this.check(false), FIRST_CHECK_MS);
    setInterval(() => this.check(false), EVERY_MS);
  }

  /** Called after waking from sleep. */
  maybeCheck() {
    if (!this.active) return;
    if (!this.state.checkedAt || Date.now() - this.state.checkedAt > EVERY_MS) this.check(false);
  }

  _setupAuto() {
    const { NsisUpdater } = require('electron-updater');
    const feed = this.dev && process.env.SERAMBI_UPDATE_FEED
      ? { provider: 'generic', url: process.env.SERAMBI_UPDATE_FEED }
      : { provider: 'github', owner: cfg.UPDATE_OWNER, repo: cfg.UPDATE_REPO };
    const au = new NsisUpdater(feed);
    au.logger = null;
    au.forceDevUpdateConfig = this.dev;
    au.autoDownload = this.getSettings().autoUpdate !== false;
    au.autoInstallOnAppQuit = true;
    au.allowPrerelease = false;
    au.allowDowngrade = false;

    au.on('checking-for-update', () => this.set({ status: 'checking', error: '' }));
    au.on('update-not-available', () => this.set({ status: 'latest', checkedAt: Date.now(), error: '' }));
    au.on('update-available', (info) => {
      this.set({ status: au.autoDownload ? 'downloading' : 'available', version: info.version, progress: 0, checkedAt: Date.now(), error: '' });
    });
    au.on('download-progress', (p) => {
      const progress = Math.max(0, Math.min(100, Math.round(p.percent || 0)));
      if (progress !== this.state.progress) this.set({ status: 'downloading', progress });
    });
    au.on('update-downloaded', (info) => {
      this.set({ status: 'downloaded', version: info.version, progress: 100 });
      if (!this.notified.has('dl' + info.version)) {
        this.notified.add('dl' + info.version);
        this.notify('Pembaruan Serambi siap dipasang',
          `Versi ${info.version} terpasang otomatis saat Serambi ditutup. Mulai ulang sekarang untuk langsung memakainya.`);
      }
    });
    au.on('error', (err) => {
      // Keep a finished download usable even if a later check fails.
      if (this.state.status === 'downloaded') return;
      this.set({ status: 'error', error: friendly(err), checkedAt: Date.now() });
    });
    this.au = au;
  }

  async check(manual) {
    if (!this.active) return this.state;
    if (['checking', 'downloading', 'downloaded'].includes(this.state.status)) return this.state;
    if (this.mode === 'auto') {
      try {
        const res = await this.au.checkForUpdates();
        if (res && res.downloadPromise) res.downloadPromise.catch(() => { /* reported through the 'error' event */ });
      } catch (_) { /* reported through the 'error' event */ }
      return this.state;
    }
    // manual mode (macOS): ask GitHub for the newest release.
    this.set({ status: 'checking', error: '' });
    try {
      const url = (this.dev && process.env.SERAMBI_UPDATE_API) || API_URL;
      const res = await net.fetch(url, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Serambi-Updater' },
        signal: AbortSignal.timeout(20000)
      });
      if (res.status === 404) throw new Error('404');
      if (!res.ok) throw new Error(String(res.status));
      const rel = await res.json();
      const latest = String(rel.tag_name || rel.name || '').replace(/^v/i, '');
      if (latest && isNewer(latest, app.getVersion())) {
        this.set({ status: 'available', version: latest, releaseUrl: rel.html_url || RELEASES_URL, checkedAt: Date.now() });
        if (!this.notified.has('av' + latest)) {
          this.notified.add('av' + latest);
          this.notify('Versi baru Serambi tersedia', `Serambi ${latest} siap diunduh. Buka Pengaturan untuk mengunduhnya.`);
        }
      } else {
        this.set({ status: 'latest', checkedAt: Date.now() });
      }
    } catch (err) {
      this.set({ status: 'error', error: friendly(err), checkedAt: Date.now() });
    }
    return this.state;
  }

  setAutoDownload(on) {
    if (this.au) this.au.autoDownload = !!on;
  }

  async download() {
    if (this.mode === 'manual') { shell.openExternal(this.state.releaseUrl); return; }
    if (this.au && this.state.status === 'available') {
      this.set({ status: 'downloading', progress: 0 });
      try { await this.au.downloadUpdate(); } catch (_) { /* reported through 'error' */ }
    }
  }

  install() {
    if (this.mode !== 'auto' || !this.au || this.state.status !== 'downloaded') return false;
    this.prepareQuit();
    // Silent per-user install, then start the new version.
    setImmediate(() => this.au.quitAndInstall(true, true));
    return true;
  }
}

module.exports = { Updater, isNewer };
