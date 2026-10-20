// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Main process: windows, account sessions, scheduler, Telegram, notifications, tray, updates.
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

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');
const startHidden = process.argv.includes('--hidden');

app.setName('Serambi');
// Indonesian formats for the built-in date and time pickers, and for web pages by default.
app.commandLine.appendSwitch('lang', 'id');
if (isWin) app.setAppUserModelId('id.serambi.app');

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
const notifications = new Set();
const running = new Set();

const THEME = {
  light: { bg: '#F4F5F9', ink: '#1B2033' },
  dark: { bg: '#10131C', ink: '#E9EBF2' }
};

// ---------- helpers ----------
function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send('state', store.publicState());
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

// ---------- tray & menu ----------
function trayMenu() {
  const ready = updater && updater.state.status === 'downloaded';
  return Menu.buildFromTemplate([
    { label: 'Buka Serambi', click: showWindow },
    { label: 'Tulis postingan', click: () => { showWindow(); sendCmd({ type: 'go', route: 'compose' }); } },
    { label: 'Lihat jadwal', click: () => { showWindow(); sendCmd({ type: 'go', route: 'schedule' }); } },
    ...(ready ? [{ type: 'separator' }, { label: `Mulai ulang & perbarui ke ${updater.state.version}`, click: () => updater.install() }] : []),
    { type: 'separator' },
    { label: 'Keluar dari Serambi', click: () => { quitting = true; app.quit(); } }
  ]);
}

function createTray() {
  const img = isMac
    ? nativeImage.createFromPath(path.join(ASSETS, 'trayTemplate.png'))
    : nativeImage.createFromPath(path.join(ASSETS, isWin ? 'tray.png' : 'tray.png'));
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
  if (!t.length) return post.status === 'posted' ? 'posted' : 'draft';
  if (t.every(x => x.status === 'done' || x.status === 'skipped')) return 'posted';
  if (t.some(x => x.status === 'waiting' || x.status === 'failed')) return 'due';
  return post.status;
}

async function runPost(postId, { automatic = false } = {}) {
  if (running.has(postId)) return;
  const post = store.data.posts.find(p => p.id === postId);
  if (!post) return;
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

function tick() {
  const now = Date.now();
  for (const p of store.data.posts) {
    if (p.status === 'scheduled' && p.scheduledAt && p.scheduledAt <= now) runPost(p.id, { automatic: true });
  }
}

function sanitizePost(input, existing) {
  const now = Date.now();
  const accounts = new Set(store.data.accounts.map(a => a.id));
  const prevTargets = existing ? existing.targets : [];
  const targets = [...new Set((input.targetIds || []).filter(id => accounts.has(id)))].map(id => {
    const prev = prevTargets.find(t => t.accountId === id);
    return prev && prev.status === 'done' ? prev : { accountId: id, status: 'pending', error: '' };
  });
  const status = ['draft', 'scheduled'].includes(input.status) ? input.status : 'draft';
  return {
    id: existing ? existing.id : uid(),
    text: String(input.text || '').slice(0, 70000),
    media: (input.media || []).filter(m => m && typeof m.file === 'string' && !m.file.includes('/') && !m.file.includes('\\'))
      .map(m => ({ id: m.id || uid(), file: m.file, type: m.type === 'video' ? 'video' : 'image', name: String(m.name || '') })),
    targets,
    status,
    scheduledAt: status === 'scheduled' ? Number(input.scheduledAt) || now : (input.scheduledAt ? Number(input.scheduledAt) : null),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    postedAt: null
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

// ---------- IPC ----------
function registerIpc() {
  const h = (ch, fn) => ipcMain.handle(ch, (_e, ...args) => fn(...args));

  h('init', () => ({
    state: store.publicState(),
    platforms: PLATFORMS,
    os: process.platform,
    version: app.getVersion(),
    mediaBase: 'serambi://media/',
    owner: { name: cfg.AUTHOR, email: cfg.AUTHOR_EMAIL, copyright: cfg.COPYRIGHT },
    update: updater ? updater.state : null
  }));

  h('accounts:add', ({ platform, name }) => {
    if (!PLATFORMS[platform]) throw new Error('Platform tidak dikenal');
    const account = { id: uid(), platform, name: String(name || PLATFORMS[platform].name).slice(0, 40), muted: false, createdAt: Date.now() };
    store.data.accounts.push(account);
    setupAccountSession(account);
    store.save(); broadcast();
    return account;
  });
  h('accounts:update', ({ id, patch }) => {
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
    const map = new Map(store.data.accounts.map(a => [a.id, a]));
    const next = ids.map(id => map.get(id)).filter(Boolean);
    for (const a of store.data.accounts) if (!next.includes(a)) next.push(a);
    store.data.accounts = next;
    store.save(); broadcast();
  });
  h('accounts:logout', async (id) => {
    const ses = session.fromPartition(partitionFor(id));
    await ses.clearStorageData();
    await ses.clearCache();
  });
  h('accounts:remove', async (id) => {
    store.data.accounts = store.data.accounts.filter(a => a.id !== id);
    delete store.data.bots[id];
    for (const p of store.data.posts) {
      if (p.status === 'posted') continue;
      p.targets = p.targets.filter(t => t.accountId !== id);
      if (!p.targets.length && p.status !== 'draft') p.status = 'draft';
      else p.status = computeStatus(p);
    }
    store.save(); broadcast();
    try {
      const ses = session.fromPartition(partitionFor(id));
      await ses.clearStorageData(); await ses.clearCache();
    } catch (_) {}
  });

  h('posts:save', (input) => {
    const existing = input.id ? store.data.posts.find(p => p.id === input.id) : null;
    const post = sanitizePost(input, existing);
    if (existing) Object.assign(existing, post); else store.data.posts.push(post);
    store.save(); broadcast();
    if (post.status === 'scheduled' && post.scheduledAt <= Date.now()) runPost(post.id, { automatic: true });
    return post;
  });
  h('posts:remove', (id) => {
    store.data.posts = store.data.posts.filter(p => p.id !== id);
    store.save(); broadcast();
  });
  h('posts:duplicate', (id) => {
    const src = store.data.posts.find(p => p.id === id); if (!src) return null;
    const copy = {
      ...structuredClone(src), id: uid(), status: 'draft', scheduledAt: null, postedAt: null,
      createdAt: Date.now(), updatedAt: Date.now(),
      targets: src.targets.map(t => ({ accountId: t.accountId, status: 'pending', error: '' }))
    };
    store.data.posts.push(copy);
    store.save(); broadcast();
    return copy;
  });
  h('posts:run', async (id) => { await runPost(id); return store.data.posts.find(p => p.id === id); });
  h('posts:target', ({ postId, accountId, status }) => {
    const post = store.data.posts.find(p => p.id === postId); if (!post) return;
    const t = post.targets.find(x => x.accountId === accountId); if (!t) return;
    if (!['done', 'waiting', 'skipped'].includes(status)) return;
    t.status = status; t.doneAt = status === 'done' ? Date.now() : null; t.error = '';
    post.status = computeStatus(post);
    post.postedAt = post.status === 'posted' ? Date.now() : null;
    store.save(); broadcast();
  });

  h('templates:save', ({ id, name, text }) => {
    const existing = id && store.data.templates.find(t => t.id === id);
    if (existing) { existing.name = String(name).slice(0, 60); existing.text = String(text); }
    else store.data.templates.push({ id: uid(), name: String(name).slice(0, 60), text: String(text) });
    store.save(); broadcast();
  });
  h('templates:remove', (id) => {
    store.data.templates = store.data.templates.filter(t => t.id !== id);
    store.save(); broadcast();
  });

  h('settings:set', (patch) => {
    const s = store.data.settings;
    for (const k of ['theme', 'notifications', 'closeToTray', 'launchAtLogin', 'preloadAccounts', 'sidebarCollapsed', 'autoUpdate']) {
      if (k in patch) s[k] = patch[k];
    }
    if ('theme' in patch) nativeTheme.themeSource = ['light', 'dark'].includes(s.theme) ? s.theme : 'system';
    if ('autoUpdate' in patch && updater) updater.setAutoDownload(s.autoUpdate !== false);
    if ('launchAtLogin' in patch) {
      try { app.setLoginItemSettings({ openAtLogin: !!s.launchAtLogin, args: ['--hidden'] }); } catch (_) {}
    }
    store.save(); broadcast();
  });

  h('bot:save', async ({ accountId, token, chatId }) => {
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

  h('backup:export', async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const res = await dialog.showSaveDialog(win, {
      title: 'Simpan cadangan', defaultPath: `serambi-cadangan-${stamp}.json`,
      filters: [{ name: 'Cadangan Serambi', extensions: ['json'] }]
    });
    if (res.canceled || !res.filePath) return false;
    const { accounts, posts, templates, settings } = store.data;
    const { window: _w, ...cleanSettings } = settings;
    fs.writeFileSync(res.filePath, JSON.stringify({ app: 'serambi', exportedAt: Date.now(), accounts, posts, templates, settings: cleanSettings }, null, 1));
    return true;
  });
  h('backup:import', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Pulihkan dari cadangan', properties: ['openFile'],
      filters: [{ name: 'Cadangan Serambi', extensions: ['json'] }]
    });
    if (res.canceled || !res.filePaths[0]) return { ok: false };
    try {
      const data = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
      if (data.app !== 'serambi' || !Array.isArray(data.accounts)) return { ok: false, error: 'Berkas ini bukan cadangan Serambi.' };
      const known = new Set(store.data.accounts.map(a => a.id));
      for (const a of data.accounts) {
        if (!PLATFORMS[a.platform] || known.has(a.id)) continue;
        const acc = { id: a.id, platform: a.platform, name: a.name, muted: !!a.muted, createdAt: a.createdAt || Date.now() };
        if (typeof a.shopUrl === 'string' && /^https?:\/\//.test(a.shopUrl)) acc.shopUrl = a.shopUrl;
        if (typeof a.homeUrl === 'string' && /^https:\/\//.test(a.homeUrl)) acc.homeUrl = a.homeUrl;
        if (Array.isArray(a.bookmarks)) acc.bookmarks = a.bookmarks.filter(b => b && /^https:\/\//.test(b.url)).slice(0, 20);
        store.data.accounts.push(acc);
        setupAccountSession(a);
      }
      const knownPosts = new Set(store.data.posts.map(p => p.id));
      for (const p of data.posts || []) if (!knownPosts.has(p.id)) store.data.posts.push(p);
      const knownTpl = new Set(store.data.templates.map(t => t.id));
      for (const t of data.templates || []) if (!knownTpl.has(t.id)) store.data.templates.push(t);
      store.save(); broadcast();
      return { ok: true, accounts: data.accounts.length, posts: (data.posts || []).length };
    } catch (_) {
      return { ok: false, error: 'Berkas cadangan tidak bisa dibaca.' };
    }
  });

  h('update:check', () => updater ? updater.check(true) : null);
  h('update:download', () => updater && updater.download());
  h('update:install', () => updater && updater.install());
  h('open:mail', () => shell.openExternal(`mailto:${cfg.AUTHOR_EMAIL}?subject=${encodeURIComponent('Serambi ' + app.getVersion())}`));

  const badgeImg = nativeImage.createFromPath(path.join(ASSETS, 'badge.png'));
  h('app:badge', (count) => {
    const n = Math.max(0, Number(count) || 0);
    try { app.setBadgeCount(n); } catch (_) {}
    if (isWin && win) win.setOverlayIcon(n > 0 ? badgeImg : null, n > 0 ? `${n} pesan belum dibaca` : '');
    if (tray) tray.setToolTip(n > 0 ? `Serambi — ${n} belum dibaca` : 'Serambi');
  });
}

// ---------- private scheme ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm'
};
function registerProtocol() {
  const RENDERER = path.join(ROOT, 'src', 'renderer');
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
  updater = new Updater({
    getSettings: () => store.data.settings,
    onChange: (state) => {
      if (win && !win.isDestroyed()) win.webContents.send('update', state);
      if (tray) tray.setContextMenu(trayMenu());
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
  setTimeout(tick, 4000);
  setInterval(tick, 15000);
  powerMonitor.on('resume', () => { setTimeout(tick, 3000); setTimeout(() => updater.maybeCheck(), 20000); });
  updater.start();
});

app.on('activate', () => showWindow());
app.on('before-quit', () => { quitting = true; if (store) store.save(true); });
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
