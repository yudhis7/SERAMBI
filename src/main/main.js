// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Main process: windows, account sessions, scheduler, Telegram, notifications, tray, updates,
// plans and licences, team workspace, app lock, and the data behind the growth tools.
const {
  app, BrowserWindow, ipcMain, session, shell, Menu, Tray, Notification, nativeTheme,
  nativeImage, clipboard, dialog, powerMonitor, protocol, net
} = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { Store, uid } = require('./store');
const { PLATFORMS, AUTH_HOSTS, hostMatches } = require('./platforms');
const telegram = require('./telegram');
const cfg = require('./config');
const { Updater } = require('./updater');
const { PLANS, parseLicense, issueLicense, currentPlan } = require('./plans');
const { Workspace } = require('./workspace');
const { Security, appendAudit, verifyAudit } = require('./security');
const { ROLES, can: roleCan, permsFor } = require('./access');
const privacy = require('./privacy');
const automation = require('./automation');
const growth = require('./growth');
const { MOMENTS, MOMENT_KIND } = require('./moments');
const S = require('./secure');
const { registerDataIpc, CONSENT_PURPOSES } = require('./data-ipc');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');
const RENDERER = path.join(ROOT, 'src', 'renderer');
const startHidden = process.argv.includes('--hidden');

app.setName('Serambi');
// Indonesian formats for the built-in date and time pickers, and for web pages by default.
app.commandLine.appendSwitch('lang', 'id');
if (isWin) app.setAppUserModelId('id.serambi.app');
// Test hook: a separate data folder when running from source.
if (!app.isPackaged && process.env.SERAMBI_USER_DATA) app.setPath('userData', process.env.SERAMBI_USER_DATA);

// A regular desktop Chrome user agent. Several web apps (WhatsApp Web in particular)
// refuse to load when they detect an embedded browser.
const chromeVersion = process.versions.chrome;
const UA_OS = isMac ? 'Macintosh; Intel Mac OS X 10_15_7' : isWin ? 'Windows NT 10.0; Win64; x64' : 'X11; Linux x86_64';
const UA = `Mozilla/5.0 (${UA_OS}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
app.userAgentFallback = UA;

// The interface and the user's media are served from a private scheme (serambi://app, serambi://media).
protocol.registerSchemesAsPrivileged([
  { scheme: 'serambi', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let store;
let win = null;
let tray = null;
let quitting = false;
let updater = null;
let workspace = null;
let security = null;
let issuerKeyPath = null; // licence tool: path of the owner's private key, kept for this session only
const notifications = new Set();
const running = new Set();
const startedAt = Date.now();

const THEME = {
  light: { bg: '#F4F5F9', ink: '#1B2033' },
  dark: { bg: '#10131C', ink: '#E9EBF2' }
};

// ---------- helpers ----------
function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send('state', publicState());
  checkNewWork();
}
function sendCmd(cmd) {
  if (win && !win.isDestroyed()) win.webContents.send('cmd', cmd);
}
function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: isMac ? undefined : path.join(ASSETS, 'icon.png') });
  notifications.add(n);
  n.on('click', () => { showWindow(); if (onClick) onClick(); });
  n.on('close', () => notifications.delete(n));
  n.show();
  setTimeout(() => notifications.delete(n), 10 * 60 * 1000);
}
function partitionFor(accountId) { return 'persist:acc_' + accountId; }
function findAccount(id) { return store.data.accounts.find(a => a.id === id); }
function isSafeUrl(url) {
  try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:'; } catch (_) { return false; }
}

// ---------- plan, member, permissions ----------
function plan() {
  const d = store.data;
  const linked = workspace && workspace.linked;
  return currentPlan({
    license: (linked && d.wsMeta.license) || d.settings.license,
    trial: (linked && d.wsMeta.trial) || d.settings.trial
  });
}
function me() {
  const d = store.data;
  if (!workspace || !workspace.linked) {
    return { id: 'local', name: d.settings.userName || 'Pemilik', email: '', role: 'owner', accountIds: [], canSeeCustomers: true, solo: true };
  }
  const m = d.members.find(x => x.id === d.workspace.memberId);
  if (!m) return { id: d.workspace.memberId, name: 'Anggota', role: 'viewer', accountIds: [], canSeeCustomers: false, solo: false };
  return { ...m, solo: false };
}
function approvalRequired() {
  return !!(workspace && workspace.linked && plan().approval && store.data.wsMeta.approvalRequired !== false);
}
function can(perm) {
  if (perm === 'license.manage') return me().role === 'owner';
  return roleCan(me(), perm, { approvalRequired: approvalRequired() });
}
function teamReadOnly() { return !!(workspace && workspace.linked && !plan().team); }
/** Throws a friendly error when the current member may not do this. */
function guard(perm) {
  if (security && security.locked) throw new Error('Serambi sedang terkunci.');
  if (teamReadOnly() && perm !== 'local') throw new Error('Paket tim tidak aktif, jadi data tim hanya bisa dilihat. Aktifkan lisensi SMALPreneur atau MediumPreneur.');
  if (perm && perm !== 'local' && !can(perm)) throw new Error('Peranmu di tim tidak mengizinkan tindakan ini. Minta admin tim untuk mengubah peranmu.');
}
function allowedAccountIds() {
  const m = me();
  if (!plan().accountAccess || !m.accountIds || !m.accountIds.length || m.role === 'owner' || m.role === 'admin') return null;
  return new Set(m.accountIds);
}
function audit(entry) {
  const m = me();
  appendAudit(store, { id: m.id, name: m.name }, entry);
}
function isAutomationDevice() {
  if (!workspace || !workspace.linked) return true;
  const devId = store.data.device && store.data.device.id;
  const set = store.data.wsMeta.automationDevice;
  return set ? set === devId : me().role === 'owner';
}

// ---------- what the window may see ----------
let auditCache = { key: '', result: null };
function auditStatus() {
  const list = store.data.audit;
  const key = list.length + ':' + (list.length ? list[list.length - 1].hash : '');
  if (auditCache.key !== key) auditCache = { key, result: verifyAudit(list) };
  return auditCache.result;
}
function maskPhone(p) { const s = String(p || ''); return s ? '•••• ' + s.slice(-3) : ''; }
function maskName(n) {
  return String(n || '').split(/\s+/).filter(Boolean).map((w, i) => i === 0 ? w : w[0] + '.').join(' ');
}
function maskCustomer(c) {
  return {
    id: c.id, name: maskName(c.name), phone: maskPhone(c.phone), email: c.email ? '•••@' + String(c.email).split('@')[1] : '',
    locationId: c.locationId, tags: c.tags || [], lastVisitAt: c.lastVisitAt, visits: c.visits || 0, restricted: !!c.restricted,
    consents: (c.consents || []).map(r => ({ purpose: r.purpose, status: r.status, at: r.at })), masked: true
  };
}

function publicState() {
  const d = store.data;
  const m = me();
  const pl = plan();
  const locked = !!(security && security.locked);
  const bots = {};
  for (const [id, b] of Object.entries(d.bots)) {
    bots[id] = { hasToken: !!(b.tokenEnc || b.tokenPlain), chatId: b.chatId || '', chatTitle: b.chatTitle || '', botName: b.botName || '' };
  }
  const allowed = allowedAccountIds();
  const accounts = allowed ? d.accounts.filter(a => allowed.has(a.id)) : d.accounts;
  const seeCustomers = can('customers.view') && !locked;
  const trust = can('trust.manage') && !locked;
  const enc = S.osEncryption();
  const tasks = d.tasks.map(t => {
    if (seeCustomers || t.assigneeId === m.id || !t.action || t.action.type !== 'wa') return t;
    return { ...t, action: { ...t.action, phone: maskPhone(t.action.phone), text: '', masked: true } };
  });
  const members = d.members.map(x => ({
    id: x.id, name: x.name, email: locked ? '' : x.email, role: x.role, status: x.status, accountIds: x.accountIds || [],
    canSeeCustomers: !!x.canSeeCustomers, invitedAt: x.invitedAt, joinedAt: x.joinedAt, removedAt: x.removedAt,
    devices: (x.devices || []).map(dv => ({ id: dv.id, name: dv.name, addedAt: dv.addedAt }))
  }));
  const { license: _l, ...wsMeta } = d.wsMeta;
  const ropa = d.privacy.ropa || privacy.defaultRopa(d.business);
  const retention = privacy.retentionReport(d);
  return {
    accounts, posts: d.posts, templates: d.templates, settings: d.settings, bots,
    business: d.business, locations: d.locations, campaigns: d.campaigns,
    customers: locked ? [] : seeCustomers ? d.customers : d.customers.filter(c => !c.erased).map(maskCustomer),
    reviews: d.reviews, automations: d.automations, tasks, comments: d.comments,
    members, wsMeta,
    privacy: { ...d.privacy, ropa, ropaDraft: !d.privacy.ropa, retention: retention.policy },
    retention: { counts: retention.counts, total: retention.total },
    incidents: trust ? d.incidents : [],
    dsr: trust ? d.dsr : [],
    audit: trust ? d.audit.slice(-1500) : [],
    auditStatus: auditStatus(),
    plan: pl,
    me: { id: m.id, name: m.name, email: m.email || '', role: m.role, solo: !!m.solo, canSeeCustomers: !!m.canSeeCustomers, accountIds: m.accountIds || [] },
    perms: permsFor(m, { approvalRequired: approvalRequired() }),
    approvalRequired: approvalRequired(),
    readOnly: teamReadOnly(),
    automationDevice: isAutomationDevice(),
    workspace: workspace ? workspace.status() : { linked: false },
    device: d.device,
    security: {
      lock: !!(d.settings.security.lock && d.settings.security.pin), autoLockMin: d.settings.security.autoLockMin,
      lockOnStart: d.settings.security.lockOnStart !== false, maskPersonal: d.settings.security.maskPersonal !== false,
      encryptAtRest: d.settings.encryptAtRest !== false, osStrong: enc.strong, backend: enc.backend, encrypted: store.encrypted
    },
    compliance: privacy.compliance(d, { lockOn: !!(d.settings.security.lock && d.settings.security.pin), encOn: store.encrypted }),
    locked,
    storeBlocked: store.blocked ? { reason: store.blocked.reason } : null
  };
}

// Notify about work that arrived from teammates or automations.
const notified = new Set();
let firstCheck = true;
function checkNewWork() {
  if (!store || !store.data.settings.notifications) return;
  const m = me();
  const fresh = [];
  for (const t of store.data.tasks) {
    if (t.status !== 'open' || notified.has(t.id)) continue;
    notified.add(t.id);
    if (!firstCheck && t.assigneeId === m.id && (t.createdAt || 0) > startedAt && t.createdBy !== m.id) fresh.push(t);
  }
  for (const p of store.data.posts) {
    const k = 'review:' + p.id + ':' + (p.approval ? p.approval.requestedAt : '');
    if (p.status !== 'review' || notified.has(k)) continue;
    notified.add(k);
    if (!firstCheck && can('post.approve') && p.approval && p.approval.requestedBy !== m.id) {
      notify('Postingan menunggu persetujuan', (p.text || 'Postingan dengan media').replace(/\s+/g, ' ').slice(0, 90), () => sendCmd({ type: 'go', route: 'schedule' }));
    }
  }
  firstCheck = false;
  if (fresh.length === 1) notify('Tugas baru untukmu', fresh[0].title, () => sendCmd({ type: 'go', route: 'home' }));
  else if (fresh.length > 1) notify(`${fresh.length} tugas baru untukmu`, fresh.slice(0, 3).map(t => t.title).join(' · '), () => sendCmd({ type: 'go', route: 'home' }));
}

// ---------- account sessions ----------
const configuredSessions = new Set();
function setupAccountSession(account) {
  const part = partitionFor(account.id);
  if (configuredSessions.has(part)) return;
  configuredSessions.add(part);
  const ses = session.fromPartition(part);
  ses.setUserAgent(UA);
  const allowed = ['notifications', 'media', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'pointerLock', 'speaker-selection', 'display-capture'];
  const muted = () => { const a = findAccount(account.id); return !a || a.muted; };
  ses.setPermissionRequestHandler((_wc, permission, cb) => {
    if (permission === 'notifications' && muted()) return cb(false);
    cb(allowed.includes(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) => {
    if (permission === 'notifications') return !muted();
    return allowed.includes(permission);
  });
  if (!isMac) {
    try {
      const langs = ['id', 'en-US'].filter(l => ses.availableSpellCheckerLanguages.includes(l));
      if (langs.length) ses.setSpellCheckerLanguages(langs);
    } catch (_) {}
  }
}
async function clearAccountSession(id) {
  try {
    const ses = session.fromPartition(partitionFor(id));
    await ses.clearStorageData(); await ses.clearCache();
  } catch (_) {}
}

// ---------- shortcuts ----------
function commandForInput(input) {
  if (input.type !== 'keyDown') return null;
  const mod = isMac ? input.meta : input.control;
  const key = (input.key || '').toLowerCase();
  if (input.control && key === 'tab') return { type: input.shift ? 'prev-account' : 'next-account' };
  if (key === 'f5') return { type: 'reload' };
  if (!mod || input.alt) return null;
  if (/^[1-9]$/.test(key) && !input.shift) return { type: 'account', index: Number(key) - 1 };
  if (key === 'n' && !input.shift) return { type: 'go', route: 'compose' };
  if (key === 'h' && input.shift) return { type: 'go', route: 'home' };
  if (key === 'j' && input.shift) return { type: 'go', route: 'schedule' };
  if (key === 'l' && input.shift) return { type: 'lock' };
  if (key === ',') return { type: 'go', route: 'settings' };
  if (key === 'r' && !input.shift) return { type: 'reload' };
  if (key === '=' || key === '+') return { type: 'zoom', dir: 1 };
  if (key === '-') return { type: 'zoom', dir: -1 };
  if (key === '0') return { type: 'zoom', dir: 0 };
  if (key === 'i' && input.shift && !app.isPackaged) return { type: 'devtools' };
  return null;
}

function attachShortcuts(contents) {
  if (isMac) return; // the application menu handles accelerators on macOS
  contents.on('before-input-event', (event, input) => {
    const cmd = commandForInput(input);
    if (!cmd) return;
    event.preventDefault();
    if (cmd.type === 'devtools') { contents.openDevTools({ mode: 'detach' }); return; }
    if (cmd.type === 'lock') { lockNow(); return; }
    sendCmd(cmd);
  });
}

// ---------- context menu (Electron has none by default) ----------
function attachContextMenu(contents) {
  contents.on('context-menu', (_e, p) => {
    const t = [];
    const sep = { type: 'separator' };
    if (p.misspelledWord) {
      for (const s of (p.dictionarySuggestions || []).slice(0, 5)) t.push({ label: s, click: () => contents.replaceMisspelling(s) });
      t.push({ label: 'Tambahkan ke kamus', click: () => contents.session.addWordToSpellCheckerDictionary(p.misspelledWord) }, sep);
    }
    if (p.linkURL && isSafeUrl(p.linkURL)) {
      t.push({ label: 'Buka tautan di browser', click: () => shell.openExternal(p.linkURL) });
      t.push({ label: 'Salin tautan', click: () => clipboard.writeText(p.linkURL) }, sep);
    }
    if (p.mediaType === 'image' && p.srcURL && !p.srcURL.startsWith('file:')) {
      t.push({ label: 'Salin gambar', click: () => contents.copyImageAt(p.x, p.y) });
      t.push({ label: 'Simpan gambar…', click: () => contents.downloadURL(p.srcURL) }, sep);
    }
    if (p.isEditable) {
      t.push(
        { label: 'Urungkan', enabled: p.editFlags.canUndo, click: () => contents.undo() },
        { label: 'Ulangi', enabled: p.editFlags.canRedo, click: () => contents.redo() }, sep,
        { label: 'Potong', enabled: p.editFlags.canCut, click: () => contents.cut() },
        { label: 'Salin', enabled: p.editFlags.canCopy, click: () => contents.copy() },
        { label: 'Tempel', enabled: p.editFlags.canPaste, click: () => contents.paste() },
        { label: 'Pilih semua', click: () => contents.selectAll() }
      );
    } else if (p.selectionText && p.selectionText.trim()) {
      t.push({ label: 'Salin', click: () => contents.copy() });
    }
    if (contents.getType() === 'webview' && !p.isEditable && !p.selectionText && !p.linkURL) {
      t.push(
        { label: 'Kembali', enabled: contents.navigationHistory.canGoBack(), click: () => contents.navigationHistory.goBack() },
        { label: 'Maju', enabled: contents.navigationHistory.canGoForward(), click: () => contents.navigationHistory.goForward() },
        { label: 'Muat ulang', click: () => contents.reload() }
      );
    }
    while (t.length && t[t.length - 1].type === 'separator') t.pop();
    if (t.length) Menu.buildFromTemplate(t).popup();
  });
}

// ---------- webview guards ----------
function accountOfContents(contents) {
  // Every account has its own session partition, so the session tells us whose page this is.
  if (!store) return null;
  return store.data.accounts.find(a => session.fromPartition(partitionFor(a.id)) === contents.session) || null;
}
function platformOfContents(contents) {
  const acc = accountOfContents(contents);
  if (acc) return PLATFORMS[acc.platform] || null;
  try {
    const host = new URL(contents.getURL()).hostname;
    return Object.values(PLATFORMS).find(p => hostMatches(host, p.domains)) || null;
  } catch (_) { return null; }
}

function unwrapRedirect(url) {
  try {
    const u = new URL(url);
    if (/^l\.(facebook|instagram)\.com$/.test(u.hostname) || /^lm\.facebook\.com$/.test(u.hostname)) {
      const target = u.searchParams.get('u');
      if (target && isSafeUrl(target)) return target;
    }
  } catch (_) {}
  return url;
}

function guardWebview(contents) {
  contents.setWindowOpenHandler(({ url, disposition }) => {
    const real = unwrapRedirect(url);
    let host = '';
    try { host = new URL(real).hostname; } catch (_) { return { action: 'deny' }; }
    const platform = platformOfContents(contents);
    if (hostMatches(host, AUTH_HOSTS) && disposition === 'new-window') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 520, height: 720, parent: win || undefined, autoHideMenuBar: true, title: 'Masuk' }
      };
    }
    if (platform && hostMatches(host, platform.domains) && real === url) {
      if (disposition === 'new-window') {
        return { action: 'allow', overrideBrowserWindowOptions: { width: 900, height: 760, autoHideMenuBar: true } };
      }
      contents.loadURL(real);
      return { action: 'deny' };
    }
    if (isSafeUrl(real)) shell.openExternal(real);
    return { action: 'deny' };
  });

  const keepInside = (event, url) => {
    let host = '';
    try { host = new URL(url).hostname; } catch (_) { return; }
    if (url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return;
    const platform = platformOfContents(contents);
    if (!platform) return;
    if (hostMatches(host, platform.domains) || hostMatches(host, AUTH_HOSTS)) return;
    if (/^(accounts\.google|appleid\.apple|login\.live|login\.microsoftonline)\./.test(host)) return;
    event.preventDefault();
    if (isSafeUrl(url)) shell.openExternal(unwrapRedirect(url));
  };
  contents.on('will-navigate', keepInside);
  // e.g. l.facebook.com link shims that redirect to outside sites
  contents.on('will-redirect', (event, url, _inPlace, isMainFrame) => { if (isMainFrame) keepInside(event, url); });
}

app.on('web-contents-created', (_e, contents) => {
  attachContextMenu(contents);
  attachShortcuts(contents);
  if (contents.getType() === 'webview') guardWebview(contents);
  if (contents.getType() === 'window') {
    // Pop-up windows (sign-in) must not open further windows outside the app.
    contents.setWindowOpenHandler(({ url }) => {
      if (isSafeUrl(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
  }
});

// ---------- window ----------
function overlayColors() {
  const t = nativeTheme.shouldUseDarkColors ? THEME.dark : THEME.light;
  return { color: t.bg, symbolColor: t.ink, height: 48 };
}

function createWindow() {
  const saved = store.data.settings.window || {};
  win = new BrowserWindow({
    width: saved.width || 1320,
    height: saved.height || 840,
    x: saved.x, y: saved.y,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: 'Serambi',
    backgroundColor: nativeTheme.shouldUseDarkColors ? THEME.dark.bg : THEME.light.bg,
    icon: isMac ? undefined : path.join(ASSETS, 'icon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 18, y: 17 },
    titleBarOverlay: isMac ? false : overlayColors(),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      spellcheck: true
    }
  });
  if (saved.maximized) win.maximize();

  win.webContents.on('will-attach-webview', (event, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    if (!/^https:\/\//.test(params.src || '') || !String(params.partition || '').startsWith('persist:acc_')) {
      event.preventDefault();
    }
  });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL('serambi://app/index.html');
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });

  let boundsTimer;
  const rememberBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      const b = win.getNormalBounds();
      store.data.settings.window = { ...b, maximized: win.isMaximized() };
      store.save();
    }, 400);
  };
  win.on('resize', rememberBounds);
  win.on('move', rememberBounds);

  win.on('close', (e) => {
    if (quitting) return;
    if (isMac || store.data.settings.closeToTray) {
      e.preventDefault();
      win.hide();
      if (!isMac && !store.data.settings.trayHintShown) {
        store.data.settings.trayHintShown = true;
        store.save();
        notify('Serambi tetap berjalan', 'Jadwal postingan dan notifikasi tetap aktif. Buka lagi dari ikon Serambi di tray.');
      }
    }
  });
  win.on('closed', () => { win = null; });
}

function lockNow() {
  if (!security || !security.enabled()) { showWindow(); sendCmd({ type: 'go', route: 'trust', tab: 'security' }); return; }
  security.lock('manual');
}

// ---------- tray & menu ----------
function trayMenu() {
  const ready = updater && updater.state.status === 'downloaded';
  const lockable = security && security.enabled() && !security.locked;
  return Menu.buildFromTemplate([
    { label: 'Buka Serambi', click: showWindow },
    { label: 'Tulis postingan', click: () => { showWindow(); sendCmd({ type: 'go', route: 'compose' }); } },
    { label: 'Lihat jadwal', click: () => { showWindow(); sendCmd({ type: 'go', route: 'schedule' }); } },
    ...(lockable ? [{ label: 'Kunci Serambi', click: () => security.lock('manual') }] : []),
    ...(ready ? [{ type: 'separator' }, { label: `Mulai ulang & perbarui ke ${updater.state.version}`, click: () => updater.install() }] : []),
    { type: 'separator' },
    { label: 'Keluar dari Serambi', click: () => { quitting = true; app.quit(); } }
  ]);
}
function refreshTray() { if (tray) tray.setContextMenu(trayMenu()); }

function createTray() {
  const img = nativeImage.createFromPath(path.join(ASSETS, isMac ? 'trayTemplate.png' : 'tray.png'));
  if (isMac) img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip('Serambi');
  tray.setContextMenu(trayMenu());
  if (!isMac) tray.on('click', showWindow);
}

function buildMenu() {
  const cmd = (c) => () => { showWindow(); sendCmd(c); };
  const checkUpdates = () => { showWindow(); sendCmd({ type: 'go', route: 'settings', section: 'update' }); if (updater) updater.check(true); };
  const helpMenu = {
    label: 'Bantuan',
    submenu: [
      ...(!isMac ? [{ label: 'Tentang Serambi', click: cmd({ type: 'about' }) }, { label: 'Periksa pembaruan…', click: checkUpdates }, { type: 'separator' }] : []),
      { label: 'Contoh penggunaan Serambi', click: cmd({ type: 'go', route: 'usecases' }) },
      { label: 'Pusat Kepercayaan', click: cmd({ type: 'go', route: 'trust' }) },
      { label: 'Paket & lisensi', click: cmd({ type: 'go', route: 'settings', section: 'plan' }) },
      { type: 'separator' },
      { label: 'Terbitkan kunci lisensi (pemilik Serambi)…', click: cmd({ type: 'license-issuer' }) },
      { label: 'Kirim masukan lewat email', click: () => shell.openExternal(`mailto:${cfg.AUTHOR_EMAIL}?subject=${encodeURIComponent('Masukan Serambi ' + app.getVersion())}`) }
    ]
  };
  const accountItems = Array.from({ length: 9 }, (_, i) => ({
    label: `Akun ${i + 1}`, accelerator: `CmdOrCtrl+${i + 1}`, click: cmd({ type: 'account', index: i })
  }));
  const template = [
    ...(isMac ? [{
      label: 'Serambi',
      submenu: [
        { label: 'Tentang Serambi', click: cmd({ type: 'about' }) },
        { label: 'Periksa pembaruan…', click: checkUpdates },
        { type: 'separator' },
        { label: 'Pengaturan…', accelerator: 'Cmd+,', click: cmd({ type: 'go', route: 'settings' }) },
        { label: 'Kunci Serambi', accelerator: 'Cmd+Shift+L', click: lockNow },
        { type: 'separator' },
        { role: 'hide', label: 'Sembunyikan Serambi' },
        { role: 'hideOthers', label: 'Sembunyikan lainnya' },
        { role: 'unhide', label: 'Tampilkan semua' },
        { type: 'separator' },
        { label: 'Keluar dari Serambi', accelerator: 'Cmd+Q', click: () => { quitting = true; app.quit(); } }
      ]
    }] : []),
    {
      label: 'Berkas',
      submenu: [
        { label: 'Tulis postingan', accelerator: 'CmdOrCtrl+N', click: cmd({ type: 'go', route: 'compose' }) },
        { label: 'Tambah akun…', click: cmd({ type: 'add-account' }) },
        { type: 'separator' },
        ...(!isMac ? [{ label: 'Kunci Serambi', accelerator: 'Ctrl+Shift+L', click: lockNow }, { type: 'separator' }] : []),
        isMac ? { role: 'close', label: 'Tutup jendela' } : { label: 'Keluar', click: () => { quitting = true; app.quit(); } }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Urungkan' },
        { role: 'redo', label: 'Ulangi' },
        { type: 'separator' },
        { role: 'cut', label: 'Potong' },
        { role: 'copy', label: 'Salin' },
        { role: 'paste', label: 'Tempel' },
        { role: 'pasteAndMatchStyle', label: 'Tempel tanpa format' },
        { role: 'selectAll', label: 'Pilih semua' }
      ]
    },
    {
      label: 'Tampilan',
      submenu: [
        { label: 'Muat ulang akun', accelerator: 'CmdOrCtrl+R', click: cmd({ type: 'reload' }) },
        { type: 'separator' },
        { label: 'Perbesar', accelerator: 'CmdOrCtrl+=', click: cmd({ type: 'zoom', dir: 1 }) },
        { label: 'Perkecil', accelerator: 'CmdOrCtrl+-', click: cmd({ type: 'zoom', dir: -1 }) },
        { label: 'Ukuran normal', accelerator: 'CmdOrCtrl+0', click: cmd({ type: 'zoom', dir: 0 }) },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Layar penuh' },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools', label: 'Alat pengembang' }] : [])
      ]
    },
    {
      label: 'Buka',
      submenu: [
        { label: 'Beranda', accelerator: 'CmdOrCtrl+Shift+H', click: cmd({ type: 'go', route: 'home' }) },
        { label: 'Jadwal', accelerator: 'CmdOrCtrl+Shift+J', click: cmd({ type: 'go', route: 'schedule' }) },
        { label: 'Tumbuh lokal', click: cmd({ type: 'go', route: 'growth' }) },
        { label: 'Pelanggan', click: cmd({ type: 'go', route: 'customers' }) },
        { label: 'Tim', click: cmd({ type: 'go', route: 'team' }) },
        { type: 'separator' },
        { label: 'Akun berikutnya', accelerator: 'Ctrl+Tab', click: cmd({ type: 'next-account' }) },
        { label: 'Akun sebelumnya', accelerator: 'Ctrl+Shift+Tab', click: cmd({ type: 'prev-account' }) },
        { type: 'separator' },
        ...accountItems
      ]
    },
    { role: 'windowMenu', label: 'Jendela' },
    helpMenu
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- posts & scheduling ----------
function computeStatus(post) {
  const t = post.targets;
  if (post.status === 'review') return 'review';
  if (!t.length) return post.status === 'posted' ? 'posted' : 'draft';
  if (t.every(x => x.status === 'done' || x.status === 'skipped')) return 'posted';
  if (t.some(x => x.status === 'waiting' || x.status === 'failed')) return 'due';
  return post.status;
}

async function runPost(postId, { automatic = false } = {}) {
  if (running.has(postId)) return;
  const post = store.data.posts.find(p => p.id === postId);
  if (!post || post.status === 'review') return;
  running.add(postId);
  try {
    // Posting before the planned time files the post under "now" in the calendar.
    if (!post.scheduledAt || (!automatic && post.status !== 'due')) post.scheduledAt = Date.now();
    let waiting = 0, failed = 0, sent = 0;
    for (const t of post.targets) {
      if (t.status === 'done' || t.status === 'skipped') continue;
      const acc = findAccount(t.accountId);
      if (!acc) { t.status = 'failed'; t.error = 'Akun ini sudah dihapus dari Serambi.'; failed++; continue; }
      const token = acc.platform === 'telegram' ? store.getBotToken(acc.id) : null;
      const bot = store.data.bots[acc.id];
      if (token && bot && bot.chatId) {
        try {
          await telegram.sendPost(token, bot.chatId, post.text, post.media, store.mediaDir);
          t.status = 'done'; t.doneAt = Date.now(); t.error = ''; t.auto = true; sent++;
        } catch (err) {
          t.status = 'failed'; t.error = telegram.friendlyError(err); failed++;
        }
      } else {
        t.status = 'waiting'; t.error = ''; waiting++;
      }
    }
    post.status = computeStatus(post);
    if (post.status === 'posted') post.postedAt = Date.now();
    post.updatedAt = Date.now();
    store.save();
    broadcast();

    if (automatic && store.data.settings.notifications) {
      const snippet = (post.text || '').replace(/\s+/g, ' ').slice(0, 80) || 'Postingan dengan media';
      if (waiting || failed) {
        const names = post.targets.filter(t => t.status === 'waiting' || t.status === 'failed')
          .map(t => { const a = findAccount(t.accountId); return a ? a.name : null; }).filter(Boolean);
        notify(failed && !waiting ? 'Postingan gagal dikirim' : 'Waktunya posting',
          `${names.join(', ')}: ${snippet}`,
          () => sendCmd({ type: 'assist', postId }));
      } else if (sent) {
        notify('Postingan terkirim', snippet, () => sendCmd({ type: 'go', route: 'schedule' }));
      }
    }
  } finally {
    running.delete(postId);
  }
}

/** In a team, the person responsible runs a post; an owner/admin takes over if it is 15 minutes late. */
function shouldRun(p) {
  if (!workspace || !workspace.linked) return true;
  if (teamReadOnly()) return false;
  const m = me();
  if ((p.assigneeId || p.createdBy) === m.id) return true;
  if (!p.assigneeId && !p.createdBy) return m.role === 'owner';
  return ['owner', 'admin'].includes(m.role) && Date.now() - p.scheduledAt > 15 * 60000;
}

function tick() {
  if (!store || store.blocked) return;
  const now = Date.now();
  for (const p of store.data.posts) {
    if (p.status === 'scheduled' && p.scheduledAt && p.scheduledAt <= now && shouldRun(p)) runPost(p.id, { automatic: true });
  }
}

function automationTick() {
  if (!store || store.blocked || !isAutomationDevice() || teamReadOnly()) return;
  const n = automation.runAll({
    data: store.data, now: Date.now(), limit: plan().automations,
    notify: (t, b) => notify(t, b, () => sendCmd({ type: 'go', route: 'growth' })),
    needsApproval: (memberId) => {
      if (!approvalRequired()) return false;
      const m = store.data.members.find(x => x.id === memberId);
      return !m || !roleCan(m, 'post.schedule', { approvalRequired: true });
    },
    retentionDue: () => privacy.retentionReport(store.data).total
  });
  store.save();
  if (n) broadcast();
}

function sanitizePost(input, existing) {
  const now = Date.now();
  const accounts = new Set(store.data.accounts.map(a => a.id));
  const allowed = allowedAccountIds();
  const prevTargets = existing ? existing.targets : [];
  const wanted = [...new Set((input.targetIds || []).filter(id => accounts.has(id) && (!allowed || allowed.has(id))))];
  // Targets this member cannot see stay as they were.
  if (allowed) for (const t of prevTargets) if (!allowed.has(t.accountId) && !wanted.includes(t.accountId)) wanted.push(t.accountId);
  const targets = wanted.map(id => {
    const prev = prevTargets.find(t => t.accountId === id);
    return prev && prev.status === 'done' ? prev : { accountId: id, status: 'pending', error: '' };
  });
  let status = ['draft', 'scheduled', 'review'].includes(input.status) ? input.status : 'draft';
  const m = me();
  let approval = existing ? existing.approval || null : null;
  if (status === 'scheduled' && !can('post.schedule')) status = 'review';
  if (status === 'review') {
    approval = { requestedBy: m.id, requestedByName: m.name, requestedAt: now, note: String(input.approvalNote || '').slice(0, 300) };
  } else if (status === 'scheduled' && approval && approval.decision !== 'approved') {
    approval = null;
  }
  const keep = (k) => existing && existing[k] !== undefined ? existing[k] : undefined;
  const members = new Set(store.data.members.map(x => x.id));
  return {
    id: existing ? existing.id : uid(),
    text: String(input.text || '').slice(0, 70000),
    media: (input.media || []).filter(m2 => m2 && typeof m2.file === 'string' && !m2.file.includes('/') && !m2.file.includes('\\'))
      .map(m2 => ({ id: m2.id || uid(), file: m2.file, type: m2.type === 'video' ? 'video' : 'image', name: String(m2.name || '') })),
    targets,
    status,
    scheduledAt: (status === 'scheduled' || status === 'review') ? Number(input.scheduledAt) || now : (input.scheduledAt ? Number(input.scheduledAt) : null),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    postedAt: null,
    createdBy: keep('createdBy') || m.id,
    assigneeId: input.assigneeId && members.has(input.assigneeId) ? input.assigneeId : (keep('assigneeId') || null),
    approval,
    campaignId: input.campaignId ? String(input.campaignId).slice(0, 40) : (keep('campaignId') || null),
    source: keep('source'), automationId: keep('automationId'), momentId: keep('momentId'), note: keep('note')
  };
}

function cleanupMedia() {
  try {
    const used = new Set(store.data.posts.flatMap(p => p.media.map(m => m.file)));
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    for (const f of fs.readdirSync(store.mediaDir)) {
      if (used.has(f)) continue;
      const fp = path.join(store.mediaDir, f);
      if (fs.statSync(fp).mtimeMs < dayAgo) fs.unlinkSync(fp);
    }
  } catch (_) {}
}

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.webm'];
function importMedia(paths) {
  const out = [];
  for (const p of paths || []) {
    try {
      const ext = path.extname(p).toLowerCase();
      const type = IMAGE_EXT.includes(ext) ? 'image' : VIDEO_EXT.includes(ext) ? 'video' : null;
      if (!type || !fs.statSync(p).isFile()) continue;
      const file = uid() + ext;
      fs.copyFileSync(p, path.join(store.mediaDir, file));
      out.push({ id: uid(), file, type, name: path.basename(p) });
    } catch (_) {}
  }
  return out;
}

// ---------- backups ----------
const BACKUP_COLLS = ['accounts', 'posts', 'templates', 'locations', 'campaigns', 'customers', 'reviews', 'automations', 'tasks', 'incidents', 'dsr'];
function backupPayload() {
  const d = store.data;
  const { window: _w, license: _lic, security: _sec, ...settings } = d.settings;
  const out = { app: 'serambi', version: app.getVersion(), exportedAt: Date.now(), settings, business: d.business, privacy: d.privacy };
  for (const c of BACKUP_COLLS) out[c] = d[c];
  return out;
}
function mergeBackup(data) {
  const d = store.data;
  const known = new Set(d.accounts.map(a => a.id));
  for (const a of data.accounts || []) {
    if (!PLATFORMS[a.platform] || known.has(a.id)) continue;
    const acc = { id: a.id, platform: a.platform, name: String(a.name || PLATFORMS[a.platform].name).slice(0, 40), muted: !!a.muted, createdAt: a.createdAt || Date.now() };
    if (typeof a.shopUrl === 'string' && /^https?:\/\//.test(a.shopUrl)) acc.shopUrl = a.shopUrl;
    if (typeof a.homeUrl === 'string' && /^https:\/\//.test(a.homeUrl)) acc.homeUrl = a.homeUrl;
    if (Array.isArray(a.bookmarks)) acc.bookmarks = a.bookmarks.filter(b => b && /^https:\/\//.test(b.url)).slice(0, 20);
    d.accounts.push(acc);
    setupAccountSession(acc);
  }
  let n = 0;
  for (const c of BACKUP_COLLS) {
    if (c === 'accounts' || !Array.isArray(data[c])) continue;
    const ids = new Set(d[c].map(x => x.id));
    for (const x of data[c]) if (x && x.id && !ids.has(x.id)) { d[c].push(x); n++; }
  }
  if (data.business && !d.business.name) d.business = { ...d.business, ...data.business, id: 'main' };
  if (data.privacy && !d.privacy.ropa && data.privacy.ropa) d.privacy = { ...d.privacy, ...data.privacy, id: 'main' };
  return n;
}

// ---------- IPC ----------
function registerIpc() {
  const h = (ch, fn) => ipcMain.handle(ch, (_e, ...args) => fn(...args));

  h('init', () => ({
    state: publicState(),
    platforms: PLATFORMS,
    os: process.platform,
    version: app.getVersion(),
    mediaBase: 'serambi://media/',
    owner: { name: cfg.AUTHOR, email: cfg.AUTHOR_EMAIL, copyright: cfg.COPYRIGHT },
    update: updater ? updater.state : null,
    plans: PLANS, trialDays: cfg.TRIAL_DAYS, roles: ROLES,
    moments: MOMENTS, momentKinds: MOMENT_KIND,
    legalBases: privacy.LEGAL_BASES, dsrTypes: privacy.DSR_TYPES, responseHours: privacy.RESPONSE_HOURS,
    consentPurposes: CONSENT_PURPOSES
  }));

  h('accounts:add', ({ platform, name }) => {
    guard('accounts.manage');
    if (!PLATFORMS[platform]) throw new Error('Platform tidak dikenal');
    const account = { id: uid(), platform, name: String(name || PLATFORMS[platform].name).slice(0, 40), muted: false, createdAt: Date.now() };
    store.data.accounts.push(account);
    setupAccountSession(account);
    if (workspace.linked) audit({ action: 'account.add', target: account.name, detail: PLATFORMS[platform].name });
    store.save(); broadcast();
    return account;
  });
  h('accounts:update', ({ id, patch }) => {
    const onlyMute = Object.keys(patch || {}).every(k => k === 'muted');
    guard(onlyMute ? 'post.write' : 'accounts.manage');
    const a = findAccount(id); if (!a) return;
    if (typeof patch.name === 'string' && patch.name.trim()) a.name = patch.name.trim().slice(0, 40);
    if (typeof patch.muted === 'boolean') a.muted = patch.muted;
    if ('homeUrl' in patch) {
      if (patch.homeUrl && /^https:\/\//i.test(patch.homeUrl)) a.homeUrl = String(patch.homeUrl).slice(0, 2000);
      else delete a.homeUrl;
    }
    if ('shopUrl' in patch) {
      const v = String(patch.shopUrl || '').trim();
      if (v && /^https?:\/\//i.test(v)) a.shopUrl = v.slice(0, 500);
      else delete a.shopUrl;
    }
    if (Array.isArray(patch.bookmarks)) {
      a.bookmarks = patch.bookmarks
        .filter(b => b && /^https:\/\//i.test(b.url))
        .slice(0, 20)
        .map(b => ({ title: String(b.title || b.url).slice(0, 80), url: String(b.url).slice(0, 2000) }));
    }
    store.save(); broadcast();
  });
  h('accounts:reorder', (ids) => {
    guard('accounts.manage');
    const map = new Map(store.data.accounts.map(a => [a.id, a]));
    const next = ids.map(id => map.get(id)).filter(Boolean);
    for (const a of store.data.accounts) if (!next.includes(a)) next.push(a);
    store.data.accounts = next;
    store.save(); broadcast();
  });
  h('accounts:logout', async (id) => { await clearAccountSession(id); });
  h('accounts:remove', async (id) => {
    guard('accounts.manage');
    const acc = findAccount(id);
    store.data.accounts = store.data.accounts.filter(a => a.id !== id);
    delete store.data.bots[id];
    for (const p of store.data.posts) {
      if (p.status === 'posted') continue;
      p.targets = p.targets.filter(t => t.accountId !== id);
      if (!p.targets.length && p.status !== 'draft') p.status = 'draft';
      else p.status = computeStatus(p);
    }
    if (acc && workspace.linked) audit({ action: 'account.remove', target: acc.name });
    store.save(); broadcast();
    await clearAccountSession(id);
  });

  h('posts:save', (input) => {
    guard('post.write');
    const existing = input.id ? store.data.posts.find(p => p.id === input.id) : null;
    const post = sanitizePost(input, existing);
    if (existing) Object.assign(existing, post); else store.data.posts.push(post);
    store.save(); broadcast();
    if (post.status === 'scheduled' && post.scheduledAt <= Date.now()) runPost(post.id, { automatic: true });
    return post;
  });
  h('posts:remove', (id) => {
    guard('post.write');
    const p = store.data.posts.find(x => x.id === id);
    if (p && me().role === 'editor' && p.createdBy && p.createdBy !== me().id) throw new Error('Editor hanya bisa menghapus postingan buatannya sendiri.');
    store.data.posts = store.data.posts.filter(x => x.id !== id);
    store.data.comments = store.data.comments.filter(c => c.postId !== id);
    store.save(); broadcast();
  });
  h('posts:duplicate', (id) => {
    guard('post.write');
    const src = store.data.posts.find(p => p.id === id); if (!src) return null;
    const copy = {
      ...structuredClone(src), id: uid(), status: 'draft', scheduledAt: null, postedAt: null,
      createdAt: Date.now(), updatedAt: Date.now(), createdBy: me().id, approval: null, source: undefined, automationId: undefined,
      targets: src.targets.map(t => ({ accountId: t.accountId, status: 'pending', error: '' }))
    };
    store.data.posts.push(copy);
    store.save(); broadcast();
    return copy;
  });
  h('posts:run', async (id) => {
    guard('post.write');
    const p = store.data.posts.find(x => x.id === id);
    if (p && p.status === 'review') throw new Error('Postingan ini masih menunggu persetujuan.');
    await runPost(id); return store.data.posts.find(x => x.id === id);
  });
  h('posts:target', ({ postId, accountId, status }) => {
    guard('post.write');
    const post = store.data.posts.find(p => p.id === postId); if (!post) return;
    const t = post.targets.find(x => x.accountId === accountId); if (!t) return;
    if (!['done', 'waiting', 'skipped'].includes(status)) return;
    t.status = status; t.doneAt = status === 'done' ? Date.now() : null; t.error = '';
    post.status = computeStatus(post);
    post.postedAt = post.status === 'posted' ? Date.now() : null;
    store.save(); broadcast();
  });
  h('posts:decide', ({ id, approve, note }) => {
    guard('post.approve');
    const p = store.data.posts.find(x => x.id === id);
    if (!p || p.status !== 'review') return null;
    const m = me();
    p.approval = { ...(p.approval || {}), decision: approve ? 'approved' : 'rejected', decidedBy: m.id, decidedByName: m.name, decidedAt: Date.now(), decisionNote: String(note || '').slice(0, 300) };
    p.status = approve ? (p.targets.length && p.scheduledAt ? 'scheduled' : 'draft') : 'draft';
    p.updatedAt = Date.now();
    audit({ action: approve ? 'post.approve' : 'post.reject', target: (p.text || 'Postingan').replace(/\s+/g, ' ').slice(0, 60), detail: note || '' });
    store.save(); broadcast();
    if (approve && p.status === 'scheduled' && p.scheduledAt <= Date.now()) runPost(p.id, { automatic: true });
    return p;
  });

  h('templates:save', ({ id, name, text, tag }) => {
    guard('templates.write');
    const existing = id && store.data.templates.find(t => t.id === id);
    if (existing) { existing.name = String(name).slice(0, 60); existing.text = String(text); if (tag !== undefined) existing.tag = String(tag || '').slice(0, 30); }
    else store.data.templates.push({ id: uid(), name: String(name).slice(0, 60), text: String(text), tag: String(tag || '').slice(0, 30) });
    store.save(); broadcast();
  });
  h('templates:remove', (id) => {
    guard('templates.write');
    store.data.templates = store.data.templates.filter(t => t.id !== id);
    store.save(); broadcast();
  });

  h('settings:set', (patch) => {
    const s = store.data.settings;
    for (const k of ['theme', 'notifications', 'closeToTray', 'launchAtLogin', 'preloadAccounts', 'sidebarCollapsed', 'autoUpdate', 'seenVersion']) {
      if (k in patch) s[k] = patch[k];
    }
    if (typeof patch.userName === 'string') s.userName = patch.userName.trim().slice(0, 60);
    if ('theme' in patch) nativeTheme.themeSource = ['light', 'dark'].includes(s.theme) ? s.theme : 'system';
    if ('autoUpdate' in patch && updater) updater.setAutoDownload(s.autoUpdate !== false);
    if ('launchAtLogin' in patch) {
      try { app.setLoginItemSettings({ openAtLogin: !!s.launchAtLogin, args: ['--hidden'] }); } catch (_) {}
    }
    store.save(); broadcast();
  });

  h('bot:save', async ({ accountId, token, chatId }) => {
    guard('accounts.manage');
    const acc = findAccount(accountId);
    if (!acc || acc.platform !== 'telegram') return { ok: false, error: 'Akun Telegram tidak ditemukan.' };
    const useToken = (token && token.trim()) || store.getBotToken(accountId);
    if (!useToken) return { ok: false, error: 'Masukkan token bot dari @BotFather.' };
    const cid = String(chatId || '').trim();
    if (!cid) return { ok: false, error: 'Masukkan Chat ID atau @username channel.' };
    try {
      const info = await telegram.testBot(useToken.trim(), cid);
      if (token && token.trim()) store.setBotToken(accountId, token.trim());
      const bot = store.data.bots[accountId] || (store.data.bots[accountId] = {});
      Object.assign(bot, { chatId: cid, chatTitle: info.chatTitle, botName: info.botName });
      store.save(); broadcast();
      return { ok: true, ...info };
    } catch (err) {
      return { ok: false, error: telegram.friendlyError(err) };
    }
  });
  h('bot:remove', (accountId) => {
    delete store.data.bots[accountId];
    store.save(); broadcast();
  });

  h('media:pick', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Pilih foto atau video',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Foto & video', extensions: [...IMAGE_EXT, ...VIDEO_EXT].map(e => e.slice(1)) }]
    });
    return res.canceled ? [] : importMedia(res.filePaths);
  });
  h('media:import', (paths) => importMedia(paths));
  h('media:paste', () => {
    const img = clipboard.readImage();
    if (img.isEmpty()) return null;
    const file = uid() + '.png';
    fs.writeFileSync(path.join(store.mediaDir, file), img.toPNG());
    return { id: uid(), file, type: 'image', name: 'tempelan.png' };
  });

  h('clipboard:text', (text) => clipboard.writeText(String(text || '')));
  h('clipboard:image', (file) => {
    if (typeof file !== 'string' || file.includes('/') || file.includes('\\')) return false;
    const img = nativeImage.createFromPath(path.join(store.mediaDir, file));
    if (img.isEmpty()) return false;
    clipboard.writeImage(img);
    return true;
  });
  h('open:external', (url) => { if (isSafeUrl(url)) shell.openExternal(url); });
  h('open:media-folder', () => shell.openPath(store.mediaDir));

  // ---- backups (optionally password-protected) ----
  h('backup:export', async ({ password } = {}) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const res = await dialog.showSaveDialog(win, {
      title: 'Simpan cadangan', defaultPath: `serambi-cadangan-${stamp}${password ? '-terenkripsi' : ''}.json`,
      filters: [{ name: 'Cadangan Serambi', extensions: ['json'] }]
    });
    if (res.canceled || !res.filePath) return { ok: false };
    const json = JSON.stringify(backupPayload());
    const out = password ? JSON.stringify(S.encryptWithPassword(password, json)) : json;
    fs.writeFileSync(res.filePath, out);
    if (password) store.data.settings.lastBackupAt = Date.now();
    audit({ action: 'data.backup', detail: password ? 'Cadangan terenkripsi' : 'Cadangan tanpa kata sandi' });
    store.save(); broadcast();
    return { ok: true, encrypted: !!password };
  });
  let pendingImport = null;
  h('backup:import', async ({ password } = {}) => {
    let file = pendingImport && Date.now() - pendingImport.at < 5 * 60000 ? pendingImport.file : null;
    if (!file || !password) {
      const res = await dialog.showOpenDialog(win, {
        title: 'Pulihkan dari cadangan', properties: ['openFile'],
        filters: [{ name: 'Cadangan Serambi', extensions: ['json'] }]
      });
      if (res.canceled || !res.filePaths[0]) return { ok: false };
      file = res.filePaths[0];
    }
    try {
      let data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.format === 'serambi-encrypted') {
        if (!password) { pendingImport = { file, at: Date.now() }; return { ok: false, needPassword: true }; }
        try { data = JSON.parse(S.decryptWithPassword(password, data)); }
        catch (_) { pendingImport = { file, at: Date.now() }; return { ok: false, needPassword: true, error: 'Kata sandi cadangan salah.' }; }
      }
      pendingImport = null;
      if (data.app !== 'serambi' || !Array.isArray(data.accounts)) return { ok: false, error: 'Berkas ini bukan cadangan Serambi.' };
      const n = mergeBackup(data);
      audit({ action: 'data.restore', detail: `${(data.accounts || []).length} akun, ${n} data lain` });
      store.save(); broadcast();
      return { ok: true, accounts: data.accounts.length, posts: (data.posts || []).length, other: n };
    } catch (_) {
      return { ok: false, error: 'Berkas cadangan tidak bisa dibaca.' };
    }
  });

  h('update:check', () => updater ? updater.check(true) : null);
  h('update:download', () => updater && updater.download());
  h('update:install', () => updater && updater.install());
  h('open:mail', (subject) => shell.openExternal(`mailto:${cfg.AUTHOR_EMAIL}?subject=${encodeURIComponent(subject || ('Serambi ' + app.getVersion()))}`));

  const badgeImg = nativeImage.createFromPath(path.join(ASSETS, 'badge.png'));
  h('app:badge', (count) => {
    const n = Math.max(0, Number(count) || 0);
    try { app.setBadgeCount(n); } catch (_) {}
    if (isWin && win) win.setOverlayIcon(n > 0 ? badgeImg : null, n > 0 ? `${n} pesan belum dibaca` : '');
    if (tray) tray.setToolTip(n > 0 ? `Serambi — ${n} belum dibaca` : 'Serambi');
  });

  // ---- plans & licences ----
  h('plan:trial', () => {
    const d = store.data;
    if (workspace.linked && me().role !== 'owner') throw new Error('Hanya pemilik ruang kerja yang bisa memulai uji coba.');
    if (d.settings.trial || (workspace.linked && d.wsMeta.trial)) throw new Error('Uji coba sudah pernah dipakai di perangkat atau tim ini.');
    d.settings.trial = { startedAt: Date.now() };
    if (workspace.linked) d.wsMeta.trial = d.settings.trial;
    audit({ action: 'trial.start', detail: `${cfg.TRIAL_DAYS} hari MediumPreneur` });
    store.save(); broadcast();
    return plan();
  });
  h('plan:activate', (key) => {
    const r = parseLicense(key);
    if (!r.ok) return { ok: false, error: r.error };
    if (r.license.expired) return { ok: false, error: 'Masa berlaku kunci lisensi ini sudah habis. Minta perpanjangan kepada pemilik Serambi.' };
    if (workspace.linked && me().role !== 'owner') return { ok: false, error: 'Hanya pemilik ruang kerja yang bisa mengaktifkan lisensi tim.' };
    store.data.settings.license = r.license.key;
    if (workspace.linked) store.data.wsMeta.license = r.license.key;
    audit({ action: 'license.activate', target: PLANS[r.license.plan].name, detail: `${r.license.seats} pengguna · ${r.license.name}` });
    store.save(); broadcast();
    const active = store.data.members.filter(m => m.status !== 'removed').length;
    return { ok: true, plan: plan(), warning: workspace.linked && active > r.license.seats ? `Tim punya ${active} anggota, lebih banyak dari ${r.license.seats} kursi di lisensi ini.` : '' };
  });
  h('plan:deactivate', () => {
    if (workspace.linked && me().role !== 'owner') throw new Error('Hanya pemilik yang bisa melepas lisensi.');
    store.data.settings.license = null;
    if (workspace.linked) store.data.wsMeta.license = null;
    audit({ action: 'license.remove' });
    store.save(); broadcast();
  });
  h('license:issue', async (opts) => {
    if (!issuerKeyPath || opts.pickKey) {
      const r = await dialog.showOpenDialog(win, {
        title: 'Pilih kunci privat penerbit lisensi (.pem)', properties: ['openFile'],
        filters: [{ name: 'Kunci privat', extensions: ['pem'] }]
      });
      if (r.canceled || !r.filePaths[0]) return { ok: false };
      issuerKeyPath = r.filePaths[0];
    }
    try {
      const pem = fs.readFileSync(issuerKeyPath, 'utf8');
      const res = issueLicense(pem, opts);
      const log = store.data.settings.issuedLicenses || (store.data.settings.issuedLicenses = []);
      log.unshift({ ...res.payload, key: res.key });
      if (log.length > 300) log.length = 300;
      store.save(); broadcast();
      return { ok: true, key: res.key, payload: res.payload, keyFile: path.basename(issuerKeyPath) };
    } catch (e) {
      issuerKeyPath = null;
      return { ok: false, error: e.message || 'Kunci privat tidak bisa dibaca.' };
    }
  });

  // ---- team workspace ----
  h('team:create', async ({ name, ownerName, ownerEmail }) => {
    if (!plan().team) throw new Error('Kerja tim tersedia di paket SMALPreneur dan MediumPreneur. Mulai uji coba 14 hari atau aktifkan lisensi.');
    const r = await dialog.showOpenDialog(win, {
      title: 'Pilih folder bersama (misalnya di Google Drive, OneDrive, atau Dropbox)',
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    store.data.settings.userName = String(ownerName || '').trim().slice(0, 60) || store.data.settings.userName;
    const res = await workspace.create({ parentDir: r.filePaths[0], name: String(name || 'Tim').trim(), ownerName, ownerEmail });
    broadcast(); refreshTray();
    return { ok: true, ...res };
  });
  h('team:join', async ({ code, merge }) => {
    const r = await dialog.showOpenDialog(win, { title: 'Pilih folder ruang kerja yang dibagikan timmu', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    const res = await workspace.join({ dir: r.filePaths[0], code, merge: !!merge });
    for (const a of store.data.accounts) setupAccountSession(a);
    broadcast();
    return { ok: true, ...res };
  });
  h('team:leave', ({ wipe } = {}) => {
    workspace.leave({ wipe: !!wipe });
    broadcast();
  });
  h('team:invite', async (input) => {
    guard('team.manage');
    const pl = plan();
    const role = ['admin', 'editor', 'viewer'].includes(input.role) ? input.role : 'editor';
    if (role === 'viewer' && !pl.viewerRole) throw new Error('Peran Pengamat tersedia di paket MediumPreneur.');
    if (role === 'admin' && me().role !== 'owner') throw new Error('Hanya pemilik yang bisa mengundang admin.');
    const accountIds = Array.isArray(input.accountIds) ? input.accountIds.filter(id => findAccount(id)) : [];
    if (accountIds.length && !pl.accountAccess) throw new Error('Akses per akun tersedia di paket MediumPreneur.');
    const seatsUsed = store.data.members.filter(m => m.status !== 'removed').length;
    if (seatsUsed >= pl.seats) throw new Error(`Semua ${pl.seats} kursi di paket ${pl.name} sudah terpakai. Keluarkan anggota yang tidak aktif atau naikkan paket.`);
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Isi nama anggota.');
    const res = await workspace.invite({ name, email: input.email, role, accountIds, canSeeCustomers: !!input.canSeeCustomers }, me().id);
    audit({ action: 'member.invite', target: name, detail: ROLES[role].label });
    broadcast();
    return { ok: true, ...res };
  });
  h('team:reinvite', async (id) => {
    guard('team.manage');
    const res = await workspace.reinvite(id);
    const m = store.data.members.find(x => x.id === id);
    audit({ action: 'member.reinvite', target: m ? m.name : id });
    broadcast();
    return { ok: true, ...res };
  });
  h('team:member', ({ id, patch }) => {
    guard('team.manage');
    const m = store.data.members.find(x => x.id === id);
    if (!m) return;
    const pl = plan();
    if (m.role === 'owner' && patch.role && patch.role !== 'owner') throw new Error('Peran pemilik tidak bisa diubah.');
    if (patch.role && ['admin', 'editor', 'viewer'].includes(patch.role)) {
      if (patch.role === 'viewer' && !pl.viewerRole) throw new Error('Peran Pengamat tersedia di paket MediumPreneur.');
      if ((patch.role === 'admin' || m.role === 'admin') && me().role !== 'owner') throw new Error('Hanya pemilik yang bisa mengubah peran admin.');
      if (m.role !== patch.role) audit({ action: 'member.role', target: m.name, detail: `${ROLES[m.role].label} → ${ROLES[patch.role].label}` });
      m.role = patch.role;
    }
    if ('canSeeCustomers' in patch && m.role !== 'owner') {
      if (!!patch.canSeeCustomers !== !!m.canSeeCustomers) audit({ action: 'member.access', target: m.name, detail: patch.canSeeCustomers ? 'Boleh melihat data pelanggan' : 'Tidak boleh melihat data pelanggan' });
      m.canSeeCustomers = !!patch.canSeeCustomers;
    }
    if (Array.isArray(patch.accountIds)) {
      if (patch.accountIds.length && !pl.accountAccess) throw new Error('Akses per akun tersedia di paket MediumPreneur.');
      m.accountIds = patch.accountIds.filter(aid => findAccount(aid));
    }
    if (typeof patch.name === 'string' && patch.name.trim()) m.name = patch.name.trim().slice(0, 60);
    store.save(); broadcast();
  });
  h('team:remove', async (id) => {
    guard('team.manage');
    const m = store.data.members.find(x => x.id === id);
    if (!m) return;
    if (m.role === 'admin' && me().role !== 'owner') throw new Error('Hanya pemilik yang bisa mengeluarkan admin.');
    await workspace.removeMember(id);
    audit({ action: 'member.remove', target: m.name });
    broadcast();
  });
  h('team:rotate', async () => {
    guard('team.manage');
    await workspace.rotate('manual');
    broadcast();
  });
  h('team:settings', (patch) => {
    const d = store.data;
    if ('approvalRequired' in patch || 'automationDevice' in patch || 'accessReviewedAt' in patch) guard('team.manage');
    if ('approvalRequired' in patch) { d.wsMeta.approvalRequired = !!patch.approvalRequired; audit({ action: 'team.approval', detail: patch.approvalRequired ? 'Persetujuan postingan aktif' : 'Persetujuan postingan nonaktif' }); }
    if ('automationDevice' in patch) d.wsMeta.automationDevice = String(patch.automationDevice || '') || null;
    if (patch.accessReviewedAt) { d.wsMeta.accessReviewedAt = Date.now(); audit({ action: 'team.access-review', detail: 'Akses data pelanggan ditinjau' }); }
    if (typeof patch.name === 'string' && patch.name.trim()) { guard('team.manage'); d.wsMeta.name = patch.name.trim().slice(0, 60); if (d.workspace) d.workspace.name = d.wsMeta.name; }
    store.save(); broadcast();
  });
  h('team:sync', async () => { await workspace.cycle(); broadcast(); return workspace.status(); });
  h('team:open-folder', () => { if (workspace.linked) shell.openPath(workspace.link.path); });

  // ---- app lock & local security ----
  h('security:set-pin', ({ pin, current }) => { const r = security.setPin(pin, current); broadcast(); refreshTray(); return r; });
  h('security:disable', ({ current }) => { const r = security.disable(current); broadcast(); refreshTray(); return r; });
  h('security:settings', (patch) => {
    const s = store.data.settings.security;
    if ('autoLockMin' in patch) s.autoLockMin = Math.max(0, Math.min(240, Number(patch.autoLockMin) || 0));
    if ('lockOnStart' in patch) s.lockOnStart = !!patch.lockOnStart;
    if ('maskPersonal' in patch) s.maskPersonal = !!patch.maskPersonal;
    if ('encryptAtRest' in patch) {
      store.data.settings.encryptAtRest = !!patch.encryptAtRest;
      audit({ action: 'security.encryption', detail: patch.encryptAtRest ? 'Enkripsi data perangkat aktif' : 'Enkripsi data perangkat dimatikan' });
    }
    store.save(true); broadcast();
  });
  h('security:lock', () => { lockNow(); });
  h('security:unlock', (pin) => {
    const r = security.unlock(pin);
    if (r.ok) broadcast();
    return r;
  });
  h('security:reset', async () => {
    // Forgotten PIN: sign out of every account and remove customer data held only on this computer.
    for (const a of store.data.accounts) await clearAccountSession(a.id);
    if (!workspace.linked) { store.data.customers = []; store.data.dsr = []; store.data.incidents = []; }
    else workspace.leave({ wipe: true, reason: 'reset' });
    security.forceReset();
    audit({ action: 'lock.reset', detail: 'PIN dilupakan: semua akun dikeluarkan dan data pelanggan di perangkat ini dihapus' });
    store.save(true); broadcast(); refreshTray();
    return { ok: true };
  });
  h('security:logout-all', async () => {
    for (const a of store.data.accounts) await clearAccountSession(a.id);
    audit({ action: 'security.logout-all', detail: `${store.data.accounts.length} akun` });
    broadcast();
    return { ok: true, count: store.data.accounts.length };
  });
  h('store:retry', () => {
    if (store.retryUnlock()) { app.relaunch(); app.exit(0); return { ok: true }; }
    return { ok: false };
  });
  h('store:set-aside', () => {
    const dest = store.setAsideBlocked();
    app.relaunch(); app.exit(0);
    return { ok: true, dest };
  });

  // ---- tools: SEO page check, QR codes, PDF and file exports ----
  h('seo:fetch', (url) => growth.fetchPage(url, UA));
  h('qr:svg', (text, opts) => growth.qrSvg(text, opts));
  h('file:pdf', ({ html, fileName, landscape }) => growth.savePdf(win, { html, fileName, landscape, fontDir: path.join(RENDERER, 'fonts'), tmpDir: path.join(store.dir, 'tmp') }));
  h('file:save', async ({ content, fileName, kind, auditAction, auditDetail }) => {
    const r = await growth.saveText(win, { content, fileName, kind });
    if (r.ok && auditAction) audit({ action: auditAction, detail: auditDetail || path.basename(r.path) });
    return r;
  });

  registerDataIpc({ h, store, me, can, guard, plan, audit, broadcast, uid, workspace, automationTick, approvalRequired });
}

// ---------- private scheme ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm'
};
function registerProtocol() {
  protocol.handle('serambi', async (req) => {
    const url = new URL(req.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const base = url.hostname === 'app' ? RENDERER : url.hostname === 'media' ? store.mediaDir : null;
    if (!base) return new Response('Not found', { status: 404 });
    const file = path.normalize(path.join(base, rel || 'index.html'));
    if (!file.startsWith(base + path.sep)) return new Response('Forbidden', { status: 403 });
    let res;
    try { res = await net.fetch(pathToFileURL(file).href, { headers: req.headers }); }
    catch (_) { return new Response('Not found', { status: 404 }); }
    // Set the type ourselves: on some Windows machines the registry reports .js as text/plain,
    // which would stop the interface scripts from loading.
    const type = MIME[path.extname(file).toLowerCase()];
    if (!type) return res;
    const headers = new Headers(res.headers);
    headers.set('content-type', type);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  });
}

// ---------- lifecycle ----------
app.on('second-instance', () => showWindow());

app.whenReady().then(() => {
  store = new Store();
  nativeTheme.themeSource = ['light', 'dark'].includes(store.data.settings.theme) ? store.data.settings.theme : 'system';
  nativeTheme.on('updated', () => {
    if (win && !isMac) { try { win.setTitleBarOverlay(overlayColors()); } catch (_) {} }
  });
  for (const a of store.data.accounts) setupAccountSession(a);
  app.setAboutPanelOptions({
    applicationName: cfg.APP_NAME,
    applicationVersion: app.getVersion(),
    copyright: `${cfg.COPYRIGHT}\n${cfg.AUTHOR_EMAIL}`,
    authors: [cfg.AUTHOR]
  });
  workspace = new Workspace({
    store,
    appVersion: app.getVersion(),
    onChange: () => broadcast(),
    canPush: () => plan().team,
    audit: (e) => audit(e),
    notify: (t, b) => notify(t, b)
  });
  workspace.device();
  store.onSaved = () => workspace.pushSoon();
  security = new Security({
    store,
    audit: (e) => audit(e),
    onLockChange: (locked, reason) => {
      if (locked) audit({ action: 'lock.on', detail: reason === 'idle' ? 'Terkunci otomatis karena tidak dipakai' : reason === 'system' ? 'Komputer dikunci atau tidur' : 'Dikunci manual' });
      broadcast(); refreshTray();
    }
  });
  security.start();
  updater = new Updater({
    getSettings: () => store.data.settings,
    onChange: (state) => {
      if (win && !win.isDestroyed()) win.webContents.send('update', state);
      refreshTray();
    },
    notify: (title, body) => notify(title, body, () => sendCmd({ type: 'go', route: 'settings', section: 'update' })),
    prepareQuit: () => { quitting = true; if (store) store.save(true); }
  });
  registerProtocol();
  registerIpc();
  buildMenu();
  createWindow();
  try { createTray(); } catch (_) {}
  cleanupMedia();
  if (workspace.linked) workspace.start();
  setTimeout(tick, 4000);
  setInterval(tick, 15000);
  setTimeout(automationTick, 12000);
  setInterval(automationTick, 5 * 60000);
  powerMonitor.on('resume', () => { setTimeout(tick, 3000); setTimeout(automationTick, 8000); setTimeout(() => updater.maybeCheck(), 20000); });
  updater.start();
});

app.on('activate', () => showWindow());
app.on('before-quit', () => { quitting = true; if (workspace) workspace.stop(); if (store) store.save(true); });
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
