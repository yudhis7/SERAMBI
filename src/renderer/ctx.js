// Shared state and small domain helpers for the interface.
import { esc } from './util.js';
import { icon } from './icons.js';

export const api = window.serambi;

export const S = {
  state: { accounts: [], posts: [], templates: [], settings: {}, bots: {} },
  platforms: {},
  os: 'win32',
  version: '',
  mediaBase: '',
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
  whatsapp: 'Chat, grup, dan Status',
  telegram: 'Chat, grup, dan channel'
};

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
  return `<span class="tile ${size}" style="--c:${p.color}" aria-hidden="true">${esc(p.short)}${num}</span>`;
}
export function tileForPlatform(pid, size = '') {
  const p = S.platforms[pid];
  return `<span class="tile ${size}" style="--c:${p.color}" aria-hidden="true">${esc(p.short)}</span>`;
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
