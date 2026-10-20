// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Shared state and small domain helpers for the interface.
import { esc } from './util.js';
import { icon } from './icons.js';

export const api = window.serambi;

export const S = {
  state: {
    accounts: [], posts: [], templates: [], settings: {}, bots: {},
    business: {}, locations: [], campaigns: [], customers: [], reviews: [], automations: [], tasks: [], comments: [],
    members: [], wsMeta: {}, privacy: {}, incidents: [], dsr: [], audit: [], plan: {}, me: {}, perms: {}, workspace: { linked: false },
    security: {}, compliance: { items: [] }, retention: { counts: {}, total: 0 }
  },
  platforms: {},
  plans: {}, roles: {}, moments: [], momentKinds: {}, legalBases: {}, dsrTypes: {}, responseHours: 72, consentPurposes: {}, trialDays: 14,
  os: 'win32',
  version: '',
  mediaBase: '',
  owner: { name: '', email: '', copyright: '' },
  update: null,         // auto-update status from the main process
  route: { name: 'home' },
  unread: {},           // accountId -> number
  assist: null,         // { postId, accountId } while the posting helper is docked
  scheduleMonth: null,  // timestamp of a day in the month on screen
  scheduleDay: null,    // selected day in the calendar
  scheduleMode: 'month',
  scheduleFilter: 'all'
};

// Very small event bus so views can ask the shell to navigate without import cycles.
const listeners = {};
export function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
export function emit(evt, data) { (listeners[evt] || []).forEach(fn => fn(data)); }
export const go = (route) => emit('go', route);

export const PLATFORM_DESC = {
  instagram: 'Feed, Reels, dan DM',
  facebook: 'Halaman, grup, dan Messenger',
  x: 'Postingan dan DM',
  tiktok: 'Video, foto, dan pesan',
  whatsapp: 'Chat, grup, dan Status',
  telegram: 'Chat, grup, dan channel',
  tokopedia: 'Seller Center Tokopedia & TikTok Shop',
  shopee: 'Seller Centre Shopee'
};

export const KIND_LABEL = { social: 'Media sosial', shop: 'Toko online' };

export function kindOf(acc) { return (S.platforms[acc?.platform] || {}).kind || 'social'; }

/** Accounts in display order: social media first, then online shops (each keeps the user's order). */
export function orderedAccounts() {
  const all = S.state.accounts;
  return [...all.filter(a => kindOf(a) === 'social'), ...all.filter(a => kindOf(a) === 'shop')];
}

/** Start page for an account: the page the user pinned, or the platform's own. */
export function homeOf(acc) { return (acc && acc.homeUrl) || platformOf(acc).home; }

export const modKey = () => (S.os === 'darwin' ? '⌘' : 'Ctrl');

export function account(id) { return S.state.accounts.find(a => a.id === id); }
export function platformOf(acc) { return S.platforms[acc?.platform] || { name: '?', short: '?', color: '#888' }; }

/** Monogram tile; the number marks the 2nd, 3rd… account of the same platform. */
export function tile(acc, size = '', withNum = false) {
  const p = platformOf(acc);
  let num = '';
  if (withNum && acc) {
    const same = S.state.accounts.filter(a => a.platform === acc.platform);
    if (same.length > 1) num = `<span class="num">${same.indexOf(acc) + 1}</span>`;
  }
  return `<span class="tile ${size}" style="--c:${p.color};${p.ink ? `color:${p.ink}` : ''}" aria-hidden="true">${esc(p.short)}${num}</span>`;
}
export function tileForPlatform(pid, size = '') {
  const p = S.platforms[pid];
  return `<span class="tile ${size}" style="--c:${p.color};${p.ink ? `color:${p.ink}` : ''}" aria-hidden="true">${esc(p.short)}</span>`;
}
export function tilesFor(post, size = 'sm', max = 4) {
  const accs = post.targets.map(t => account(t.accountId)).filter(Boolean);
  const shown = accs.slice(0, max).map(a => tile(a, size)).join('');
  return `<span class="tiles">${shown}</span>`;
}

export function mediaUrl(m) { return S.mediaBase + encodeURIComponent(m.file); }
export function mediaTag(m, attrs = '') {
  return m.type === 'video'
    ? `<video src="${mediaUrl(m)}" muted preload="metadata" ${attrs}></video>`
    : `<img src="${mediaUrl(m)}" alt="" loading="lazy" ${attrs}>`;
}

export const STATUS = {
  draft: { label: 'Draf', cls: '' },
  review: { label: 'Menunggu persetujuan', cls: 'review' },
  scheduled: { label: 'Terjadwal', cls: 'scheduled' },
  due: { label: 'Perlu tindakan', cls: 'due' },
  posted: { label: 'Terposting', cls: 'posted' }
};
export function statusChip(status) {
  const s = STATUS[status] || STATUS.draft;
  return `<span class="chip ${s.cls}">${s.label}</span>`;
}
export const TARGET_STATUS = {
  pending: { label: 'Menunggu jadwal', cls: '' },
  waiting: { label: 'Siap ditempel', cls: 'due' },
  done: { label: 'Selesai', cls: 'posted' },
  failed: { label: 'Gagal', cls: 'failed' },
  skipped: { label: 'Dilewati', cls: '' }
};
export function targetChip(t) {
  const s = TARGET_STATUS[t.status] || TARGET_STATUS.pending;
  const label = t.status === 'done' && t.auto ? 'Terkirim otomatis' : s.label;
  return `<span class="chip ${s.cls}">${label}</span>`;
}

/** Time a post is filed under: posted time, schedule time, or last edit. */
export function postTime(p) { return p.scheduledAt || p.postedAt || p.updatedAt; }

export function hasBot(accId) {
  const b = S.state.bots[accId];
  return !!(b && b.hasToken && b.chatId);
}

export function emptyIcon(name) { return `<span class="faint">${icon(name, 22)}</span>`; }

/** One plain sentence describing the auto-update status. */
export function updateLine(u) {
  if (!u) return '';
  switch (u.status) {
    case 'unavailable': return 'Pembaruan otomatis aktif di versi yang sudah dipasang.';
    case 'checking': return 'Memeriksa versi terbaru…';
    case 'latest': return 'Serambi sudah versi terbaru.';
    case 'available': return u.mode === 'manual' ? `Versi ${u.version} tersedia untuk diunduh.` : `Versi ${u.version} tersedia.`;
    case 'downloading': return `Mengunduh versi ${u.version}… ${u.progress || 0}%`;
    case 'downloaded': return `Versi ${u.version} siap dipasang. Terpasang otomatis saat Serambi ditutup.`;
    case 'error': return u.error || 'Gagal memeriksa pembaruan.';
    default: return 'Belum diperiksa.';
  }
}

// ---------- v1.2: plans, team, permissions ----------
/** True when the current member may do this (see src/main/access.js). */
export function perm(p) { return !!(S.state.perms && S.state.perms[p]) && !S.state.readOnly; }
export function planName(id) { return (S.plans[id] || {}).name || ''; }
export function member(id) { return S.state.members.find(m => m.id === id); }
export function memberName(id) {
  if (!id || id === 'local') return S.state.me && S.state.me.solo ? (S.state.settings.userName || 'Kamu') : '';
  if (S.state.me && id === S.state.me.id) return 'Kamu';
  const m = member(id);
  return m ? m.name : '';
}
export function roleLabel(r) { return (S.roles[r] || {}).label || r; }
export const inTeam = () => !!(S.state.workspace && S.state.workspace.linked);

// ---------- money & numbers (Indonesian formats) ----------
const nf = new Intl.NumberFormat('id-ID');
export const fmtNum = (n) => nf.format(Math.round(Number(n) || 0));
export const rupiah = (n) => 'Rp' + nf.format(Math.round(Number(n) || 0));
export const pct = (n, digits = 0) => (Number.isFinite(n) ? (n * 100).toFixed(digits).replace('.', ',') : '0') + '%';

// ---------- WhatsApp & phones ----------
export function normPhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  d = d.replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}
export function prettyPhone(p) {
  const d = String(p || '');
  if (!/^62\d+$/.test(d)) return d;
  const local = '0' + d.slice(2);
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}
export const waMe = (phone, text) => `https://wa.me/${normPhone(phone)}${text ? '?text=' + encodeURIComponent(text) : ''}`;

/** Review link for a location: the one saved, or the official link built from the Place ID. */
export function reviewLink(loc) {
  if (!loc) return '';
  if (loc.reviewUrl) return loc.reviewUrl;
  if (loc.placeId) return 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(loc.placeId);
  return '';
}

export function hasConsent(c, purpose) {
  if (!c || c.restricted) return false;
  const recs = (c.consents || []).filter(r => r.purpose === purpose).sort((a, b) => (b.at || 0) - (a.at || 0));
  return !!(recs[0] && recs[0].status === 'granted');
}

/** Small lock badge for features outside the current plan. */
export function planBadge(planId) {
  const p = S.plans[planId];
  return p ? `<span class="plan-badge ${planId}">${icon('crown', 12)}${esc(p.name)}</span>` : '';
}
