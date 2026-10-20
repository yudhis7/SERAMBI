// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Data store kept in the user's app-data folder.
// Since 1.2 the whole file is encrypted with the operating system's keychain
// (Windows DPAPI, macOS Keychain) when it is available, so customer data stays
// protected even if someone copies the file.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');
const { osEncryption } = require('./secure');

const DEFAULTS = {
  version: 2,
  accounts: [],      // { id, platform, name, muted, createdAt, homeUrl?, shopUrl?, bookmarks?, updatedAt? }
  posts: [],         // { id, text, media, targets, status, scheduledAt, createdAt, updatedAt, postedAt, createdBy?, assigneeId?, approval? }
  templates: [],     // { id, name, text, tag? }
  bots: {},          // accountId -> { tokenEnc, tokenPlain, chatId, chatTitle, botName }   (this device only)

  // ---- v1.2: local business growth ----
  business: { id: 'main', name: '', category: '', description: '', phone: '', whatsapp: '', email: '', website: '', city: '', area: '', services: [], keywords: [] },
  locations: [],     // { id, name, address, city, phone, hours, mapsUrl, placeId, reviewUrl, gbp:{}, listings:{}, seo:null }
  campaigns: [],     // { id, name, channel, objective, locationId, startAt, endAt, budget, spend, clicks, leads, sales, revenue, url, utm, ads }
  customers: [],     // { id, name, phone, email, birthday, locationId, tags, lastVisitAt, notes, consents:[], restricted, source }
  reviews: [],       // { id, locationId, source, rating, author, text, date, reply, repliedAt }
  automations: [],   // { id, type, name, enabled, config, lastRunAt }
  tasks: [],         // { id, title, detail, dueAt, assigneeId, status, doneAt, source, link, action }
  comments: [],      // { id, postId, memberId, text, createdAt }
  // ---- v1.2: team ----
  members: [],       // { id, name, email, role, status, accountIds, canSeeCustomers, devices:[] }
  wsMeta: { id: 'main', approvalRequired: true, automationDevice: null, license: null, trial: null },
  // ---- v1.2: Trust Center ----
  audit: [],         // { id, at, actor, actorName, device, action, target, detail, prev, hash }
  incidents: [],     // { id, title, discoveredAt, ... }
  dsr: [],           // data subject requests
  privacy: { id: 'main', ropa: null, notice: null, retention: null, ppdp: null, dpia: null },

  // ---- this device only ----
  device: null,      // { id, name }
  workspace: null,   // link to a shared team folder
  settings: {
    theme: 'system',          // system | light | dark
    notifications: true,      // reminders for scheduled posts
    closeToTray: true,        // Windows: keep running in the tray when the window is closed
    launchAtLogin: false,
    preloadAccounts: true,    // load every account at start so chats and badges stay live
    sidebarCollapsed: false,
    autoUpdate: true,         // Windows: download and install new versions automatically
    trayHintShown: false,
    window: null,
    // v1.2
    license: null,            // licence key text (SMALPreneur / MediumPreneur)
    trial: null,              // { startedAt }
    encryptAtRest: true,
    security: { lock: false, pin: null, autoLockMin: 10, lockOnStart: true, maskPersonal: true },
    lastBackupAt: null,
    welcomeSeen: false
  }
};

const uid = () => crypto.randomBytes(8).toString('hex');
const ENC_FORMAT = 'serambi-local-enc';

class Store {
  constructor() {
    this.dir = app.getPath('userData');
    this.file = path.join(this.dir, 'serambi-data.json');
    this.mediaDir = path.join(this.dir, 'media');
    fs.mkdirSync(this.mediaDir, { recursive: true });
    this.encrypted = false;
    this.blocked = null;     // set when the encrypted file cannot be opened on this device
    this.onSaved = null;     // hook for team sync
    this.data = this._load();
    this._timer = null;
  }

  _merge(raw) {
    const d = { ...structuredClone(DEFAULTS), ...raw };
    d.settings = { ...DEFAULTS.settings, ...(raw.settings || {}) };
    d.settings.security = { ...DEFAULTS.settings.security, ...((raw.settings || {}).security || {}) };
    d.business = { ...DEFAULTS.business, ...(raw.business || {}), id: 'main' };
    d.privacy = { ...DEFAULTS.privacy, ...(raw.privacy || {}), id: 'main' };
    d.wsMeta = { ...DEFAULTS.wsMeta, ...(raw.wsMeta || {}), id: 'main' };
    d.bots = raw.bots || {};
    for (const k of ['accounts', 'posts', 'templates', 'locations', 'campaigns', 'customers', 'reviews', 'automations', 'tasks', 'comments', 'members', 'audit', 'incidents', 'dsr']) {
      if (!Array.isArray(d[k])) d[k] = [];
    }
    d.version = 2;
    return d;
  }

  _load() {
    if (!fs.existsSync(this.file)) return structuredClone(DEFAULTS);
    let raw;
    try { raw = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
    catch (e) {
      // Keep a copy of an unreadable file instead of silently overwriting it.
      try { fs.copyFileSync(this.file, this.file + '.rusak-' + Date.now()); } catch (_) {}
      return structuredClone(DEFAULTS);
    }
    if (raw && raw.format === ENC_FORMAT) {
      try {
        raw = JSON.parse(safeStorage.decryptString(Buffer.from(raw.data, 'base64')));
        this.encrypted = true;
      } catch (e) {
        // The keychain refused (macOS asks permission after an update) or this is another computer.
        // Do not overwrite anything until the user decides.
        this.blocked = { reason: 'decrypt', message: String(e && e.message || e) };
        return structuredClone(DEFAULTS);
      }
    }
    return this._merge(raw);
  }

  /** Try again to open an encrypted file (after the user allowed keychain access). */
  retryUnlock() {
    this.blocked = null;
    this.data = this._load();
    return !this.blocked;
  }
  /** Give up on an encrypted file that cannot be opened: set it aside and start fresh. */
  setAsideBlocked() {
    const dest = this.file + '.terkunci-' + Date.now();
    try { fs.renameSync(this.file, dest); } catch (_) {}
    this.blocked = null;
    this.data = structuredClone(DEFAULTS);
    this.save(true);
    return dest;
  }

  shouldEncrypt() { return this.data.settings.encryptAtRest !== false && osEncryption().strong; }

  save(immediate = false) {
    if (this.blocked) return; // never overwrite a file we could not open
    clearTimeout(this._timer);
    const write = () => {
      const json = JSON.stringify(this.data);
      let out = json;
      this.encrypted = false;
      if (this.shouldEncrypt()) {
        try {
          out = JSON.stringify({ format: ENC_FORMAT, v: 1, data: safeStorage.encryptString(json).toString('base64') });
          this.encrypted = true;
        } catch (_) { out = json; }
      }
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, out);
      fs.renameSync(tmp, this.file);
      if (this.onSaved) { try { this.onSaved(); } catch (_) {} }
    };
    if (immediate) write();
    else this._timer = setTimeout(write, 250);
  }

  setBotToken(accountId, token) {
    const bot = this.data.bots[accountId] || (this.data.bots[accountId] = {});
    delete bot.tokenEnc; delete bot.tokenPlain;
    if (!token) return;
    if (safeStorage.isEncryptionAvailable()) {
      bot.tokenEnc = safeStorage.encryptString(token).toString('base64');
    } else {
      bot.tokenPlain = token;
    }
  }

  getBotToken(accountId) {
    const bot = this.data.bots[accountId];
    if (!bot) return null;
    if (bot.tokenEnc) {
      try { return safeStorage.decryptString(Buffer.from(bot.tokenEnc, 'base64')); } catch (_) { return null; }
    }
    return bot.tokenPlain || null;
  }
}

module.exports = { Store, uid, DEFAULTS };
