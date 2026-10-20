// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Simple JSON store kept in the user's app-data folder.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');

const DEFAULTS = {
  version: 1,
  accounts: [],      // { id, platform, name, muted, createdAt, homeUrl?, shopUrl?, bookmarks? }
  posts: [],         // { id, text, media:[{id,file,type,name}], targets:[{accountId,status,error,doneAt}], status, scheduledAt, createdAt, updatedAt, postedAt }
  templates: [],     // { id, name, text }
  bots: {},          // accountId -> { tokenEnc, tokenPlain, chatId, chatTitle, botName }
  settings: {
    theme: 'system',          // system | light | dark
    notifications: true,      // reminders for scheduled posts
    closeToTray: true,        // Windows: keep running in the tray when the window is closed
    launchAtLogin: false,
    preloadAccounts: true,    // load every account at start so chats and badges stay live
    sidebarCollapsed: false,
    autoUpdate: true,         // Windows: download and install new versions automatically
    trayHintShown: false,
    window: null
  }
};

const uid = () => crypto.randomBytes(8).toString('hex');

class Store {
  constructor() {
    this.dir = app.getPath('userData');
    this.file = path.join(this.dir, 'serambi-data.json');
    this.mediaDir = path.join(this.dir, 'media');
    fs.mkdirSync(this.mediaDir, { recursive: true });
    this.data = this._load();
    this._timer = null;
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return {
        ...structuredClone(DEFAULTS),
        ...raw,
        settings: { ...DEFAULTS.settings, ...(raw.settings || {}) },
        bots: raw.bots || {}
      };
    } catch (e) {
      if (fs.existsSync(this.file)) {
        // Keep a copy of an unreadable file instead of silently overwriting it.
        try { fs.copyFileSync(this.file, this.file + '.rusak-' + Date.now()); } catch (_) {}
      }
      return structuredClone(DEFAULTS);
    }
  }

  save(immediate = false) {
    clearTimeout(this._timer);
    const write = () => {
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
      fs.renameSync(tmp, this.file);
    };
    if (immediate) write();
    else this._timer = setTimeout(write, 250);
  }

  // What the renderer is allowed to see (no bot tokens).
  publicState() {
    const bots = {};
    for (const [id, b] of Object.entries(this.data.bots)) {
      bots[id] = { hasToken: !!(b.tokenEnc || b.tokenPlain), chatId: b.chatId || '', chatTitle: b.chatTitle || '', botName: b.botName || '' };
    }
    const { accounts, posts, templates, settings } = this.data;
    return { accounts, posts, templates, settings, bots };
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

module.exports = { Store, uid };
