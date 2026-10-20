// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Serambi — interface shell: sidebar, routing, account web views and the posting helper.
import { icon } from './icons.js';
import { $, $$, esc, toast, openModal, confirmDialog, promptDialog, showMenu, debounce, snippet } from './util.js';
import { S, api, on, go, emit, account, platformOf, tile, tileForPlatform, mediaTag, targetChip, hasBot, modKey, PLATFORM_DESC, KIND_LABEL, kindOf, orderedAccounts, homeOf, updateLine } from './ctx.js';
import HomeView from './views/home.js';
import ComposeView from './views/compose.js';
import ScheduleView from './views/schedule.js';
import SettingsView from './views/settings.js';

const VIEWS = { home: HomeView, compose: ComposeView, schedule: ScheduleView, settings: SettingsView };
let currentView = null;

const BRAND_MARK = `<svg class="brand-mark" viewBox="250 290 524 560" aria-hidden="true"><path d="M282 486 L512 316 L742 486" fill="none" stroke="#fff" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/><path d="M400 548 H624 A72 72 0 0 1 696 620 V686 A72 72 0 0 1 624 758 H468 L392 818 L404 754 A72 72 0 0 1 328 686 V620 A72 72 0 0 1 400 548 Z" fill="#F2B33D"/></svg>`;

// =====================================================================
// Sidebar
// =====================================================================
function renderSidebar() {
  const { accounts, posts, settings } = S.state;
  const r = S.route;
  const due = posts.filter(p => p.status === 'due').length;
  const collapsed = !!settings.sidebarCollapsed;
  document.body.classList.toggle('collapsed', collapsed);

  const nav = (route, ic, label, extra = '', title = label) => `
    <button class="sb-item ${r.name === route ? 'active' : ''}" data-go="${route}" title="${esc(title)}">
      ${icon(ic, 19)}<span class="label">${label}</span>${extra}
    </button>`;

  const accRow = (a) => {
    const p = platformOf(a);
    const n = S.unread[a.id] || 0;
    const active = r.name === 'account' && r.id === a.id;
    return `
      <button class="sb-item sb-acct ${active ? 'active' : ''}" data-acct="${a.id}" draggable="true"
        title="${esc(a.name)} · ${esc(p.name)}${n ? ` · ${n} belum dibaca` : ''}">
        ${tile(a, '', true)}
        <span class="label"><span class="name">${esc(a.name)}</span><span class="sub">${a.muted ? 'Notifikasi mati' : esc(p.name)}</span></span>
        ${n ? `<span class="sb-count ${a.muted ? 'soft' : ''}">${n > 99 ? '99+' : n}</span>` : ''}
      </button>`;
  };
  const social = accounts.filter(a => kindOf(a) === 'social');
  const shops = accounts.filter(a => kindOf(a) === 'shop');
  const section = (label, list, kind) => `
      <div class="sb-section"><span>${label}</span>
        <button class="sb-icon-btn" data-add="${kind}" title="Tambah ${label.toLowerCase()}">${icon('plus', 16)}</button>
      </div>
      ${list.map(accRow).join('')}`;
  const u = S.update;
  const updatePill = u && (u.status === 'downloaded' || (u.status === 'available' && u.mode === 'manual'))
    ? `<button class="sb-item sb-update" data-update title="${u.status === 'downloaded' ? 'Mulai ulang untuk memasang' : 'Unduh versi baru'} Serambi ${esc(u.version)}">
        ${icon('circle-arrow-down', 19)}<span class="label">${u.status === 'downloaded' ? 'Perbarui ke ' : 'Versi baru '}${esc(u.version)}</span></button>`
    : '';

  $('#sidebar').innerHTML = `
    <div class="sb-top">
      <div class="brand">${BRAND_MARK}<span class="brand-text">Serambi</span></div>
      <span class="grow"></span>
      <button class="sb-icon-btn collapse-btn" data-collapse title="Ciutkan panel">${icon('panel-left-close', 18)}</button>
    </div>
    <div class="sb-scroll">
      ${nav('home', 'house', 'Beranda')}
      ${nav('compose', 'square-pen', 'Tulis postingan', '', `Tulis postingan (${modKey()}+N)`)}
      ${nav('schedule', 'calendar-days', 'Jadwal', due ? `<span class="sb-count">${due}</span>` : '')}
      ${accounts.length ? section('Media sosial', social, 'social') : ''}
      ${shops.length ? section('Toko online', shops, 'shop') : ''}
      ${!accounts.length ? '<div class="sb-section"><span>Akun</span></div>' : ''}
      <button class="sb-item sb-add" data-add title="Tambah akun">
        <span class="add-box">${icon('plus', 16)}</span><span class="label">Tambah akun</span>
      </button>
    </div>
    <div class="sb-bottom">
      ${updatePill}
      ${nav('settings', 'settings', 'Pengaturan')}
      ${collapsed ? `<button class="sb-item" data-collapse title="Lebarkan panel">${icon('panel-left-open', 19)}</button>` : ''}
    </div>`;
}

function bindSidebar() {
  const sb = $('#sidebar');
  sb.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.go) go({ name: b.dataset.go });
    else if (b.dataset.acct) go({ name: 'account', id: b.dataset.acct });
    else if ('add' in b.dataset) openAddAccount(null, b.dataset.add || null);
    else if ('update' in b.dataset) {
      if (S.update && S.update.status === 'downloaded') api.installUpdate();
      else api.downloadUpdate();
    }
    else if ('collapse' in b.dataset) api.setSettings({ sidebarCollapsed: !S.state.settings.sidebarCollapsed });
  });
  sb.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-acct]');
    if (!b) return;
    e.preventDefault();
    accountMenu(b, b.dataset.acct, 'left');
  });

  // drag to reorder accounts
  let dragId = null;
  sb.addEventListener('dragstart', (e) => {
    const b = e.target.closest('[data-acct]');
    if (!b) return;
    dragId = b.dataset.acct;
    b.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  sb.addEventListener('dragend', () => { dragId = null; $$('.sb-acct', sb).forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after')); });
  sb.addEventListener('dragover', (e) => {
    const b = e.target.closest('[data-acct]');
    if (!dragId || !b) return;
    e.preventDefault();
    const r = b.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    $$('.sb-acct', sb).forEach(x => x.classList.remove('drop-before', 'drop-after'));
    if (b.dataset.acct !== dragId) b.classList.add(after ? 'drop-after' : 'drop-before');
  });
  sb.addEventListener('drop', (e) => {
    const b = e.target.closest('[data-acct]');
    if (!dragId || !b || b.dataset.acct === dragId) return;
    e.preventDefault();
    const after = b.classList.contains('drop-after');
    const ids = S.state.accounts.map(a => a.id).filter(id => id !== dragId);
    let idx = ids.indexOf(b.dataset.acct);
    if (after) idx++;
    ids.splice(idx, 0, dragId);
    api.reorderAccounts(ids);
  });
}

// =====================================================================
// Account web views
// =====================================================================
const WV = new Map(); // accountId -> { el, state, error, zoom, failed }
const ZOOM_STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75];

function loadZoom(id) {
  try { return Number(localStorage.getItem('zoom:' + id)) || 1; } catch (_) { return 1; }
}

function ensureWebview(acc) {
  if (WV.has(acc.id)) return WV.get(acc.id);
  const p = platformOf(acc);
  const el = document.createElement('webview');
  el.setAttribute('partition', 'persist:acc_' + acc.id);
  el.setAttribute('allowpopups', '');
  el.setAttribute('webpreferences', 'spellcheck=yes');
  el.className = 'off';
  el.dataset.acct = acc.id;
  const rec = { el, state: 'loading', error: '', zoom: loadZoom(acc.id), failed: false, ready: false };
  WV.set(acc.id, rec);

  const refresh = () => { if (S.route.name === 'account' && S.route.id === acc.id) { renderWvState(); updateAccountBar(); } };
  el.addEventListener('did-start-loading', () => { rec.failed = false; if (!rec.ready) { rec.state = 'loading'; refresh(); } });
  el.addEventListener('dom-ready', () => {
    rec.ready = true;
    if (!rec.failed) rec.state = 'ready';
    try { el.setZoomFactor(rec.zoom); } catch (_) {}
    refresh();
  });
  el.addEventListener('did-stop-loading', () => { if (!rec.failed) rec.state = 'ready'; refresh(); });
  el.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return; // -3 = navigation replaced by another one
    rec.failed = true; rec.state = 'failed'; rec.error = e.errorDescription || '';
    refresh();
  });
  el.addEventListener('page-title-updated', (e) => {
    const m = String(e.title || '').match(/\((\d+)\+?\)/);
    setUnread(acc.id, m ? Number(m[1]) : 0);
  });
  el.addEventListener('did-navigate', refresh);
  el.addEventListener('did-navigate-in-page', refresh);
  el.setAttribute('src', homeOf(acc));
  $('#webviews').appendChild(el);
  return rec;
}

function removeWebview(id) {
  const rec = WV.get(id);
  if (rec) rec.el.remove();
  WV.delete(id);
  delete S.unread[id];
  pushBadge();
}

function activeRec() {
  return S.route.name === 'account' ? WV.get(S.route.id) : null;
}

function showAccount(id) {
  const acc = account(id);
  if (!acc) return go({ name: 'home' });
  const rec = ensureWebview(acc);
  for (const [k, r] of WV) {
    r.el.classList.toggle('on', k === id);
    r.el.classList.toggle('off', k !== id);
  }
  $('#webviews').classList.add('active');
  renderAccountBar(acc);
  renderWvState();
  renderDock();
  setTimeout(() => { if (rec.state === 'ready') rec.el.focus(); }, 50);
}

function hideWebviews() {
  $('#webviews').classList.remove('active');
  for (const r of WV.values()) { r.el.classList.remove('on'); r.el.classList.add('off'); }
  $('#wv-state').classList.add('hidden');
  $('#dock').classList.add('hidden');
}

function renderWvState() {
  const box = $('#wv-state');
  const rec = activeRec();
  const acc = account(S.route.id);
  if (!rec || !acc || rec.state === 'ready') { box.classList.add('hidden'); return; }
  const p = platformOf(acc);
  box.classList.remove('hidden');
  box.classList.toggle('failed', rec.state === 'failed');
  if (rec.state === 'failed') {
    box.innerHTML = `
      ${tile(acc, 'xl')}
      <h3>${esc(p.name)} tidak bisa dibuka</h3>
      <p>Periksa koneksi internet, lalu coba lagi.${rec.error ? ` <span class="faint">(${esc(rec.error)})</span>` : ''}</p>
      <button class="btn primary" data-retry>${icon('rotate-cw', 16)}Coba lagi</button>`;
    box.querySelector('[data-retry]').onclick = () => { rec.state = 'loading'; rec.failed = false; renderWvState(); rec.el.loadURL(homeOf(acc)); };
  } else {
    box.innerHTML = `${tile(acc, 'xl')}<h3>Membuka ${esc(p.name)}…</h3><p>Masuk sekali saja. Serambi mengingat login akun ini.</p>`;
  }
}

function renderAccountBar(acc) {
  const p = platformOf(acc);
  const tb = $('#titlebar');
  tb.className = 'titlebar bordered acct-bar';
  tb.innerHTML = `
    ${tile(acc, '')}
    <div class="title"><b>${esc(acc.name)}</b><span>${esc(p.name)}${acc.muted ? ' · notifikasi mati' : ''}</span></div>
    <div class="nav">
      <button class="icon-btn" data-nav="back" title="Kembali">${icon('arrow-left')}</button>
      <button class="icon-btn" data-nav="forward" title="Maju">${icon('arrow-right')}</button>
      <button class="icon-btn" data-nav="reload" title="Muat ulang (${modKey()}+R)">${icon('rotate-cw')}</button>
      <button class="icon-btn" data-nav="home" title="${acc.homeUrl ? 'Halaman awal akun ini' : 'Halaman utama ' + esc(p.name)}">${icon('house')}</button>
      <button class="icon-btn" data-marks title="Pintasan halaman">${icon('bookmark')}</button>
    </div>
    <span class="zoom-label" data-zoom></span>
    <span class="grow"></span>
    ${kindOf(acc) === 'shop' && acc.shopUrl ? `<button class="btn ghost sm" data-copy-shop title="${esc(acc.shopUrl)}">${icon('link', 15)}Salin link toko</button>` : ''}
    <button class="btn sm" data-write>${icon('square-pen', 15)}${kindOf(acc) === 'shop' ? 'Tulis promosi' : 'Tulis postingan'}</button>
    <button class="icon-btn" data-more title="Pilihan akun">${icon('ellipsis')}</button>`;
  tb.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const rec = WV.get(acc.id);
    if (b.dataset.nav && rec) {
      const el = rec.el;
      try {
        if (b.dataset.nav === 'back') el.goBack();
        if (b.dataset.nav === 'forward') el.goForward();
        if (b.dataset.nav === 'reload') el.reload();
        if (b.dataset.nav === 'home') el.loadURL(homeOf(acc));
      } catch (_) {}
    } else if ('marks' in b.dataset) {
      bookmarksMenu(b, acc.id);
    } else if ('copyShop' in b.dataset) {
      api.copyText(acc.shopUrl).then(() => toast('Link toko disalin'));
    } else if ('write' in b.dataset) {
      go({ name: 'compose', targets: [acc.id] });
    } else if ('more' in b.dataset) {
      accountMenu(b, acc.id);
    } else if ('zoomReset' in b.dataset) {
      zoom(0);
    }
  };
  updateAccountBar();
}

function updateAccountBar() {
  const rec = activeRec();
  if (!rec) return;
  const tb = $('#titlebar');
  let back = false, fwd = false;
  try { back = rec.el.canGoBack(); fwd = rec.el.canGoForward(); } catch (_) {}
  const b = tb.querySelector('[data-nav="back"]'); if (b) b.disabled = !back;
  const f = tb.querySelector('[data-nav="forward"]'); if (f) f.disabled = !fwd;
  const z = tb.querySelector('[data-zoom]');
  if (z) z.textContent = Math.abs(rec.zoom - 1) > 0.01 ? Math.round(rec.zoom * 100) + '%' : '';
}

function zoom(dir) {
  const rec = activeRec();
  if (!rec) return;
  let i = ZOOM_STEPS.findIndex(s => Math.abs(s - rec.zoom) < 0.01);
  if (i < 0) i = ZOOM_STEPS.indexOf(1);
  rec.zoom = dir === 0 ? 1 : ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))];
  try { rec.el.setZoomFactor(rec.zoom); } catch (_) {}
  try { localStorage.setItem('zoom:' + S.route.id, String(rec.zoom)); } catch (_) {}
  updateAccountBar();
}

function setUnread(id, n) {
  if ((S.unread[id] || 0) === n) return;
  S.unread[id] = n;
  renderSidebar();
  if (currentView && currentView.onUnread) currentView.onUnread();
  pushBadge();
}
const pushBadge = debounce(() => {
  const total = S.state.accounts.filter(a => !a.muted).reduce((s, a) => s + (S.unread[a.id] || 0), 0);
  api.setBadge(total);
}, 300);

// =====================================================================
// Account actions
// =====================================================================
function accountMenu(anchor, id, align = 'right') {
  const acc = account(id);
  if (!acc) return;
  const p = platformOf(acc);
  const shop = kindOf(acc) === 'shop';
  showMenu(anchor, [
    { heading: `${acc.name} · ${p.name}` },
    { label: 'Ganti nama', icon: 'pencil', onClick: () => renameAccount(acc) },
    ...(shop ? [{ label: acc.shopUrl ? 'Ubah link toko' : 'Atur link toko', icon: 'link', onClick: () => editShopUrl(acc) }] : []),
    { label: acc.muted ? 'Nyalakan notifikasi' : 'Matikan notifikasi', icon: acc.muted ? 'bell' : 'bell-off', onClick: () => toggleMute(acc) },
    { label: shop ? 'Tulis promosi untuk toko ini' : 'Tulis postingan untuk akun ini', icon: 'square-pen', onClick: () => go({ name: 'compose', targets: [acc.id] }) },
    'sep',
    { label: 'Jadikan halaman ini halaman awal', icon: 'house-plus', onClick: () => setHomeHere(acc) },
    ...(acc.homeUrl ? [{ label: `Kembalikan halaman awal ${p.name}`, icon: 'house', onClick: () => resetHome(acc) }] : []),
    { label: 'Muat ulang', icon: 'rotate-cw', onClick: () => { const r = WV.get(acc.id); if (r) r.el.reload(); } },
    { label: 'Buka di browser', icon: 'external-link', onClick: () => { const r = WV.get(acc.id); let url = p.home; try { if (r && r.ready) url = r.el.getURL(); } catch (_) {} api.openExternal(url); } },
    'sep',
    { label: 'Keluar dari akun', icon: 'log-out', onClick: () => logoutAccount(acc) },
    { label: 'Hapus dari Serambi', icon: 'trash-2', danger: true, onClick: () => removeAccount(acc) }
  ], { align });
}

function currentUrl(accId) {
  const rec = WV.get(accId);
  try { return rec && rec.ready ? rec.el.getURL() : null; } catch (_) { return null; }
}
function currentTitle(accId) {
  const rec = WV.get(accId);
  try { return rec && rec.ready ? rec.el.getTitle() : ''; } catch (_) { return ''; }
}

async function setHomeHere(acc) {
  const url = currentUrl(acc.id);
  if (!url || !/^https:\/\//.test(url)) { toast('Buka dulu halaman yang ingin dijadikan halaman awal', { kind: 'info' }); return; }
  await api.updateAccount({ id: acc.id, patch: { homeUrl: url } });
  toast(`${acc.name} akan selalu dibuka di halaman ini`);
}
async function resetHome(acc) {
  await api.updateAccount({ id: acc.id, patch: { homeUrl: '' } });
  toast(`Halaman awal ${acc.name} dikembalikan`);
}

/** Saved pages per account: Seller Center menus, a group, a page inbox, and so on. */
function bookmarksMenu(anchor, accId) {
  const acc = account(accId);
  if (!acc) return;
  const marks = acc.bookmarks || [];
  const url = currentUrl(acc.id);
  const saved = url && marks.some(m => m.url === url);
  const open = (u) => { const rec = WV.get(acc.id); if (rec) rec.el.loadURL(u); };
  const items = [];
  if (marks.length) {
    items.push({ heading: 'Pintasan tersimpan' });
    marks.forEach(m => items.push({ label: m.title, icon: 'bookmark', onClick: () => open(m.url) }));
    items.push('sep');
  }
  items.push({ label: 'Halaman awal', icon: 'house', onClick: () => open(homeOf(acc)) });
  if (url && !saved) items.push({ label: 'Simpan halaman ini sebagai pintasan', icon: 'bookmark-plus', onClick: () => addBookmark(acc, url) });
  if (saved) items.push({ label: 'Hapus halaman ini dari pintasan', icon: 'trash-2', onClick: () => removeBookmark(acc, url) });
  showMenu(anchor, items, { align: 'left' });
}
async function addBookmark(acc, url) {
  const suggested = (currentTitle(acc.id) || '').replace(/^\(\d+\+?\)\s*/, '').slice(0, 60) || platformOf(acc).name;
  const title = await promptDialog({ title: 'Simpan pintasan', label: 'Nama pintasan', value: suggested, confirm: 'Simpan pintasan', placeholder: 'Misalnya: Pesanan baru' });
  if (!title) return;
  const marks = [...(account(acc.id).bookmarks || []), { title, url }];
  await api.updateAccount({ id: acc.id, patch: { bookmarks: marks } });
  toast('Pintasan disimpan');
}
async function removeBookmark(acc, url) {
  const marks = (account(acc.id).bookmarks || []).filter(m => m.url !== url);
  await api.updateAccount({ id: acc.id, patch: { bookmarks: marks } });
  toast('Pintasan dihapus');
}

export async function editShopUrl(acc) {
  const p = platformOf(acc);
  const v = await promptDialog({
    title: `Link toko ${acc.name}`,
    label: `Alamat toko yang dilihat pembeli di ${p.name}`,
    value: acc.shopUrl || '',
    placeholder: p.shopUrlHint || 'https://',
    confirm: 'Simpan link'
  });
  if (v === null) return;
  const url = /^https?:\/\//i.test(v) ? v : 'https://' + v;
  await api.updateAccount({ id: acc.id, patch: { shopUrl: url } });
  toast('Link toko disimpan. Sisipkan ke postingan lewat tombol Link toko.');
}

async function renameAccount(acc) {
  const name = await promptDialog({ title: 'Ganti nama akun', label: 'Nama yang tampil di Serambi', value: acc.name });
  if (name) { await api.updateAccount({ id: acc.id, patch: { name } }); toast('Nama akun diganti'); }
}
async function toggleMute(acc) {
  await api.updateAccount({ id: acc.id, patch: { muted: !acc.muted } });
  const r = WV.get(acc.id);
  if (r) r.el.reload();
  toast(acc.muted ? `Notifikasi ${acc.name} dinyalakan` : `Notifikasi ${acc.name} dimatikan`);
}
async function logoutAccount(acc) {
  const ok = await confirmDialog({
    title: `Keluar dari ${acc.name}?`,
    message: 'Login dan data tersimpan untuk akun ini akan dihapus dari Serambi. Akun tetap ada di daftar, kamu tinggal masuk lagi.',
    confirm: 'Keluar dari akun'
  });
  if (!ok) return;
  await api.logoutAccount(acc.id);
  const r = WV.get(acc.id);
  if (r) { r.ready = false; r.el.loadURL(platformOf(acc).home); }
  setUnread(acc.id, 0);
  toast(`Kamu sudah keluar dari ${acc.name}`);
}
async function removeAccount(acc) {
  const ok = await confirmDialog({
    title: `Hapus ${acc.name}?`,
    message: 'Akun ini dan login-nya akan dihapus dari Serambi. Postingan yang belum terkirim tidak lagi menyasar akun ini. Akun aslimu di platform tidak terpengaruh.',
    confirm: 'Hapus akun',
    danger: true
  });
  if (!ok) return;
  if (S.route.name === 'account' && S.route.id === acc.id) go({ name: 'home' });
  if (S.assist && S.assist.accountId === acc.id) S.assist = null;
  removeWebview(acc.id);
  await api.removeAccount(acc.id);
  toast(`${acc.name} dihapus`);
}

export function openAddAccount(preset, kindFirst) {
  const ids = Object.keys(S.platforms);
  let chosen = preset || null;
  const desc = PLATFORM_DESC;
  const kinds = kindFirst === 'shop' ? ['shop', 'social'] : ['social', 'shop'];
  const group = (kind) => `
      <div class="pick-group">
        <h3>${KIND_LABEL[kind]}</h3>
        <div class="pick-grid" role="radiogroup" aria-label="${KIND_LABEL[kind]}">
          ${ids.filter(id => (S.platforms[id].kind || 'social') === kind).map(id => {
            const p = S.platforms[id];
            return `<button class="pick-card ${chosen === id ? 'selected' : ''}" data-p="${id}" style="--c:${p.color}" role="radio" aria-checked="${chosen === id}">
              ${tileForPlatform(id, '')}<span><b>${esc(p.name)}</b><span>${esc(desc[id] || '')}</span></span></button>`;
          }).join('')}
        </div>
      </div>`;
  const m = openModal({
    title: 'Tambah akun',
    wide: true,
    body: `
      ${kinds.map(group).join('')}
      <div class="field">
        <label for="acc-name">Nama akun di Serambi</label>
        <input id="acc-name" class="input" maxlength="40" placeholder="Pilih platform dulu">
        <span class="hint">Misalnya “Toko Batik” atau “Pribadi”. Berguna kalau kamu punya beberapa akun di platform yang sama.</span>
      </div>
      <p class="hint" data-kind-hint>${icon('info', 14, 'inline')} Kamu masuk langsung di halaman resmi platform. Serambi tidak melihat atau menyimpan kata sandimu.</p>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes disabled>Tambah & masuk</button>`
  });
  const name = m.el.querySelector('#acc-name');
  const yes = m.el.querySelector('[data-yes]');
  const suggest = (pid) => {
    const n = S.state.accounts.filter(a => a.platform === pid).length;
    return S.platforms[pid].name + (n ? ' ' + (n + 1) : '');
  };
  let edited = false;
  const pick = (pid) => {
    chosen = pid;
    m.el.querySelectorAll('.pick-card').forEach(c => { c.classList.toggle('selected', c.dataset.p === pid); c.setAttribute('aria-checked', c.dataset.p === pid); });
    if (!edited) name.value = suggest(pid);
    const hint = m.el.querySelector('[data-kind-hint]');
    hint.innerHTML = S.platforms[pid].kind === 'shop'
      ? `${icon('info', 14, 'inline')} Masuk dengan akun penjual di Seller Center ${esc(S.platforms[pid].name)} resmi. Serambi tidak melihat atau menyimpan kata sandimu.`
      : `${icon('info', 14, 'inline')} Kamu masuk langsung di halaman resmi platform. Serambi tidak melihat atau menyimpan kata sandimu.`;
    name.placeholder = '';
    yes.disabled = false;
  };
  m.el.querySelectorAll('.pick-card').forEach(c => c.onclick = () => pick(c.dataset.p));
  name.addEventListener('input', () => { edited = true; });
  if (preset) pick(preset);
  m.el.querySelector('[data-no]').onclick = () => m.close();
  const submit = async () => {
    if (!chosen) return;
    const acc = await api.addAccount({ platform: chosen, name: name.value.trim() || suggest(chosen) });
    m.close();
    S.state.accounts.push(acc); // state broadcast follows; this lets us navigate right away
    go({ name: 'account', id: acc.id });
  };
  yes.onclick = submit;
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

/** One-click add from the welcome screen. */
export async function quickAddAccount(pid) {
  const n = S.state.accounts.filter(a => a.platform === pid).length;
  const acc = await api.addAccount({ platform: pid, name: S.platforms[pid].name + (n ? ' ' + (n + 1) : '') });
  S.state.accounts.push(acc);
  go({ name: 'account', id: acc.id });
}

// =====================================================================
// Posting helper (modal + dock)
// =====================================================================
function post(id) { return S.state.posts.find(p => p.id === id); }

export function openAssist(postId) {
  const p = post(postId);
  if (!p) return;
  let m;
  const images = p.media.filter(x => x.type === 'image');
  const render = () => {
    const cur = post(postId);
    if (!cur) { m.close(); return; }
    const rows = cur.targets.map(t => {
      const a = account(t.accountId);
      if (!a) return '';
      const pl = platformOf(a);
      const bot = a.platform === 'telegram' && hasBot(a.id);
      const done = t.status === 'done' || t.status === 'skipped';
      let sub = t.status === 'failed' ? `<span class="err">${esc(t.error || 'Gagal dikirim')}</span>` : `<span>${bot ? 'Dikirim otomatis lewat bot' : esc(pl.name)}</span>`;
      let acts = '';
      if (done) acts = `<button class="btn ghost sm" data-undo="${a.id}">Batalkan tanda</button>`;
      else if (bot) acts = `<button class="btn primary sm" data-bot>${icon('send', 14)}Kirim lewat bot</button><button class="btn sm" data-done="${a.id}">Tandai selesai</button>`;
      else acts = `<button class="btn primary sm" data-open="${a.id}">${icon('clipboard-copy', 14)}Buka & salin</button><button class="btn sm" data-done="${a.id}">${icon('check', 14)}Selesai</button>`;
      return `<div class="assist-row">${tile(a, '')}<div class="meta"><b>${esc(a.name)}</b>${sub}</div>${targetChip(t)}<div class="acts">${acts}</div></div>`;
    }).join('');
    m.el.querySelector('.assist-list').innerHTML = rows || '<div class="assist-row"><div class="meta"><span>Postingan ini belum punya akun tujuan.</span></div></div>';
  };
  m = openModal({
    title: 'Bantu posting',
    wide: true,
    body: `
      <p>Pilih akun, Serambi akan membukanya dan menyalin teksnya. Tinggal tempel dengan <span class="kbd">${modKey()}+V</span>, lalu tandai selesai.</p>
      <div class="assist-text">${p.text ? esc(p.text) : '<span class="faint">Tanpa teks</span>'}</div>
      <div class="assist-tools">
        ${p.media.length ? `<span class="thumbs">${p.media.slice(0, 6).map(x => mediaTag(x)).join('')}</span>` : ''}
        <button class="btn sm" data-copy-text ${p.text ? '' : 'disabled'}>${icon('copy', 14)}Salin teks</button>
        ${images.length ? `<button class="btn sm" data-copy-img>${icon('image', 14)}Salin gambar${images.length > 1 ? '…' : ''}</button>` : ''}
        ${p.media.some(x => x.type === 'video') ? `<span class="hint">Video perlu diunggah manual dari folder media.</span>` : ''}
      </div>
      <div class="assist-list"></div>`,
    foot: `<button class="btn ghost" data-edit>${icon('pencil', 15)}Edit postingan</button><span style="flex:1"></span><button class="btn" data-close-foot>Tutup</button>`,
    onClose: () => { unsub(); }
  });
  const unsub = onState(render);
  render();
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('copyText' in b.dataset) { await api.copyText(p.text); toast('Teks disalin'); }
    else if ('copyImg' in b.dataset) copyImageMenu(b, images);
    else if (b.dataset.open) { m.close(); startDock(postId, b.dataset.open); }
    else if (b.dataset.done) { await api.setTarget({ postId, accountId: b.dataset.done, status: 'done' }); afterDone(postId); }
    else if (b.dataset.undo) await api.setTarget({ postId, accountId: b.dataset.undo, status: 'waiting' });
    else if ('bot' in b.dataset) {
      b.disabled = true; b.innerHTML = 'Mengirim…';
      const res = await api.runPost(postId);
      const failed = res && res.targets.find(t => t.status === 'failed');
      if (failed) toast(failed.error || 'Gagal dikirim', { kind: 'err', ms: 6000 }); else toast('Terkirim lewat bot Telegram');
    }
    else if ('edit' in b.dataset) { m.close(); go({ name: 'compose', postId }); }
    else if ('closeFoot' in b.dataset) m.close();
  });
}

function copyImageMenu(anchor, images) {
  const copy = async (img, i) => {
    const ok = await api.copyImage(img.file);
    toast(ok ? `Gambar ${images.length > 1 ? i + 1 + ' ' : ''}disalin. Tempel di kolom postingan.` : 'Gambar tidak bisa disalin', { kind: ok ? 'ok' : 'err' });
  };
  if (images.length === 1) return copy(images[0], 0);
  showMenu(anchor, images.map((img, i) => ({ label: `Gambar ${i + 1}${img.name ? ' · ' + snippet(img.name, 24) : ''}`, icon: 'image', onClick: () => copy(img, i) })), { align: 'left' });
}

async function startDock(postId, accountId) {
  const p = post(postId);
  const acc = account(accountId);
  if (!p || !acc) return;
  S.assist = { postId, accountId };
  if (p.text) await api.copyText(p.text);
  go({ name: 'account', id: accountId });
  const pl = platformOf(acc);
  if (pl.composeUrl && !acc.homeUrl) {
    const rec = ensureWebview(acc);
    const load = () => { try { rec.el.loadURL(pl.composeUrl); } catch (_) {} };
    if (rec.ready) load(); else rec.el.addEventListener('dom-ready', load, { once: true });
  }
  // X accepts the text through its share link, so the compose box opens pre-filled.
  if (acc.platform === 'x' && p.text && p.text.length < 4000) {
    const rec = ensureWebview(acc);
    const url = 'https://x.com/intent/post?text=' + encodeURIComponent(p.text);
    const load = () => { try { rec.el.loadURL(url); } catch (_) {} };
    if (rec.ready) load(); else rec.el.addEventListener('dom-ready', load, { once: true });
  }
  renderDock();
}

function nextWaiting(p, exceptId) {
  return p.targets.find(t => t.accountId !== exceptId && (t.status === 'waiting' || (t.status === 'failed' && !hasBot(t.accountId)) || t.status === 'pending') && account(t.accountId) && !(account(t.accountId).platform === 'telegram' && hasBot(t.accountId)));
}

function afterDone(postId) {
  const p = post(postId);
  if (p && p.targets.every(t => t.status === 'done' || t.status === 'skipped')) toast('Semua akun sudah diposting');
}

function renderDock() {
  const dock = $('#dock');
  const a = S.assist;
  if (!a || S.route.name !== 'account' || S.route.id !== a.accountId) { dock.classList.add('hidden'); return; }
  const p = post(a.postId);
  const acc = account(a.accountId);
  if (!p || !acc) { S.assist = null; dock.classList.add('hidden'); return; }
  const t = p.targets.find(x => x.accountId === acc.id);
  const pl = platformOf(acc);
  const images = p.media.filter(x => x.type === 'image');
  const total = p.targets.length;
  const doneCount = p.targets.filter(x => x.status === 'done' || x.status === 'skipped').length;
  const isDone = t && (t.status === 'done' || t.status === 'skipped');
  const next = nextWaiting(p, acc.id);
  const nextAcc = next && account(next.accountId);
  const xPrefilled = acc.platform === 'x' && p.text;

  dock.classList.remove('hidden');
  dock.innerHTML = `
    <div class="dock-head">${tile(acc, 'sm')}<b>${isDone ? 'Selesai di ' : 'Posting ke '}${esc(acc.name)}</b>
      <span class="progress">${doneCount}/${total} akun</span>
      <button class="icon-btn sm" data-x title="Tutup bantuan">${icon('x', 16)}</button></div>
    ${isDone
      ? `<p>${nextAcc ? `Berikutnya: ${esc(nextAcc.name)}.` : 'Semua akun sudah beres.'}</p>
         <div class="row">${nextAcc ? `<button class="btn primary sm" data-next="${nextAcc.id}">${icon('arrow-right', 14)}Lanjut ke ${esc(nextAcc.name)}</button>` : ''}
         <button class="btn sm" data-x>${nextAcc ? 'Nanti saja' : 'Tutup'}</button></div>`
      : `<p>${xPrefilled ? '' : (p.text ? `Teks sudah disalin. Tempel dengan <span class="kbd">${modKey()}+V</span>. ` : '')}${esc(pl.hint || '')}</p>
         <div class="row">
           <button class="btn sm" data-copy-text ${p.text ? '' : 'disabled'}>${icon('copy', 14)}Salin teks</button>
           ${images.length ? `<button class="btn sm" data-copy-img>${icon('image', 14)}Salin gambar</button>` : ''}
           <button class="btn primary sm" data-done style="margin-left:auto" title="Tandai sudah diposting">${icon('check', 14)}Selesai</button>
         </div>`}`;
  dock.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('x' in b.dataset) { S.assist = null; renderDock(); }
    else if ('copyText' in b.dataset) { await api.copyText(p.text); toast('Teks disalin'); }
    else if ('copyImg' in b.dataset) copyImageMenu(b, images);
    else if ('done' in b.dataset) { await api.setTarget({ postId: p.id, accountId: acc.id, status: 'done' }); afterDone(p.id); }
    else if (b.dataset.next) startDock(p.id, b.dataset.next);
  };
}

// =====================================================================
// Routing & state
// =====================================================================
const stateListeners = new Set();
function onState(fn) { stateListeners.add(fn); return () => stateListeners.delete(fn); }

function navigate(route) {
  if (currentView && currentView.unmount) currentView.unmount();
  currentView = null;
  S.route = route;
  renderSidebar();
  const viewEl = $('#view');
  const tb = $('#titlebar');
  if (route.name === 'account') {
    viewEl.classList.add('hidden');
    viewEl.innerHTML = '';
    showAccount(route.id);
    return;
  }
  hideWebviews();
  viewEl.classList.remove('hidden');
  const View = VIEWS[route.name] || HomeView;
  currentView = View;
  tb.className = 'titlebar';
  tb.onclick = null;
  tb.innerHTML = '';
  viewEl.scrollTop = 0;
  View.mount(viewEl, tb, route);
}

function handleState(next) {
  const prevIds = new Set(S.state.accounts.map(a => a.id));
  S.state = next;
  for (const id of prevIds) if (!next.accounts.find(a => a.id === id)) removeWebview(id);
  renderSidebar();
  if (S.route.name === 'account') {
    const acc = account(S.route.id);
    if (!acc) return navigate({ name: 'home' });
    renderAccountBar(acc);
    renderDock();
  } else if (currentView && currentView.update) {
    currentView.update();
  }
  stateListeners.forEach(fn => fn());
}

function handleCommand(cmd) {
  const accs = orderedAccounts();
  switch (cmd.type) {
    case 'go': return go({ name: cmd.route, section: cmd.section });
    case 'about': return openAbout();
    case 'account': if (accs[cmd.index]) go({ name: 'account', id: accs[cmd.index].id }); return;
    case 'next-account':
    case 'prev-account': {
      if (!accs.length) return;
      const cur = S.route.name === 'account' ? accs.findIndex(a => a.id === S.route.id) : -1;
      const step = cmd.type === 'next-account' ? 1 : -1;
      const i = cur < 0 ? (step > 0 ? 0 : accs.length - 1) : (cur + step + accs.length) % accs.length;
      return go({ name: 'account', id: accs[i].id });
    }
    case 'reload': { const r = activeRec(); if (r) r.el.reload(); return; }
    case 'zoom': return zoom(cmd.dir);
    case 'add-account': return openAddAccount();
    case 'assist': return openAssist(cmd.postId);
  }
}

// Keyboard shortcuts while the interface itself has focus are handled by the main
// process (before-input-event) on Windows/Linux and by the menu on macOS.

// =====================================================================
// About & updates
// =====================================================================
function openAbout() {
  const m = openModal({
    title: 'Tentang Serambi',
    body: `
      <div class="about">
        <div class="about-mark">${BRAND_MARK}</div>
        <div>
          <b class="about-name">Serambi</b>
          <span class="about-ver">Versi ${esc(S.version)}</span>
        </div>
      </div>
      <p>Satu aplikasi untuk mengelola media sosial dan toko online: Instagram, Facebook, X, TikTok, WhatsApp, Telegram, Tokopedia, dan Shopee.</p>
      <div class="about-owner">
        <span>${icon('copyright', 16)}</span>
        <div><b>${esc(S.owner.copyright)}</b>
          <span>Pemilik dan pengembang: ${esc(S.owner.name)} · <button class="link" data-mail>${esc(S.owner.email)}</button></span></div>
      </div>
      <p class="hint" data-about-update>${esc(updateLine(S.update))}</p>
      <p class="hint">Dibangun dengan Electron (MIT), ikon Lucide (ISC), dan huruf Plus Jakarta Sans (SIL Open Font License 1.1).</p>`,
    foot: `<button class="btn ghost" data-check>${icon('refresh-cw', 15)}Periksa pembaruan</button><span style="flex:1"></span><button class="btn primary" data-ok>Tutup</button>`
  });
  m.el.querySelector('[data-mail]').onclick = () => api.openMail();
  m.el.querySelector('[data-ok]').onclick = () => m.close();
  m.el.querySelector('[data-check]').onclick = () => api.checkUpdate();
  const unsub = onUpdateChange(() => { const el = m.el.querySelector('[data-about-update]'); if (el) el.textContent = updateLine(S.update); });
  const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { unsub(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}

const updateListeners = new Set();
function onUpdateChange(fn) { updateListeners.add(fn); return () => updateListeners.delete(fn); }
function handleUpdate(u) {
  const prev = S.update;
  S.update = u;
  const changed = !prev || prev.status !== u.status || prev.version !== u.version;
  if (changed) renderSidebar();
  if (currentView && currentView.onUpdate) currentView.onUpdate();
  updateListeners.forEach(fn => fn());
}

on('go', navigate);
on('assist', openAssist);
on('add-account', (preset) => openAddAccount(preset, preset ? null : undefined));
on('add-account-kind', (kind) => openAddAccount(null, kind));
on('quick-add', quickAddAccount);
on('about', openAbout);
on('edit-shop', (id) => { const a = account(id); if (a) editShopUrl(a); });

async function boot() {
  const init = await api.init();
  S.state = init.state;
  S.platforms = init.platforms;
  S.os = init.os;
  S.version = init.version;
  S.mediaBase = init.mediaBase;
  S.owner = init.owner;
  S.update = init.update;
  document.body.classList.add('os-' + S.os);
  bindSidebar();
  api.onState(handleState);
  api.onCommand(handleCommand);
  api.onUpdate(handleUpdate);
  navigate({ name: 'home' });

  // Load every account in the background so chats, notifications and badges stay live.
  if (S.state.settings.preloadAccounts !== false) {
    orderedAccounts().forEach((acc, i) => setTimeout(() => { if (account(acc.id)) ensureWebview(acc); }, 1200 + i * 1500));
  }
}

boot();

export { emit };
