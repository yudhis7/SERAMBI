// Small helpers shared by every view.
import { icon } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const LOCALE = 'id-ID';
const fmtTimeF = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDayLongF = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDayShortF = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtMonthF = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const fmtWeekdayF = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });

export const fmtTime = (ts) => fmtTimeF.format(new Date(ts));
export const fmtDayLong = (ts) => fmtDayLongF.format(new Date(ts));
export const fmtDayShort = (ts) => fmtDayShortF.format(new Date(ts));
export const fmtMonth = (ts) => fmtMonthF.format(new Date(ts));
export const fmtWeekday = (ts) => fmtWeekdayF.format(new Date(ts));

export function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function sameDay(a, b) { return dayKey(a) === dayKey(b); }

/** "Hari ini", "Besok", "Kemarin", or "Sen, 19 Okt" */
export function relDay(ts) {
  const today = startOfDay(Date.now());
  const d = startOfDay(ts);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff === -1) return 'Kemarin';
  return fmtDayShort(ts);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 4) return 'Selamat malam';
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function toDateInput(ts) { return dayKey(ts); }
export function toTimeInput(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function fromInputs(date, time) {
  if (!date || !time) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

export function snippet(text, n = 120) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/** Counts characters roughly the way platforms do (emoji count as one). */
export function charCount(text) { return Array.from(text || '').length; }

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- toasts ----------
export function toast(message, { kind = 'ok', action, onAction, ms = 3600 } = {}) {
  const root = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = `${icon(kind === 'err' ? 'circle-alert' : kind === 'info' ? 'info' : 'circle-check-big', 17)}<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.remove(); onAction && onAction(); };
  root.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- modal ----------
export function openModal({ title, body, foot, wide = false, onClose, headExtra = '' }) {
  const root = $('#modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">${headExtra}<h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Tutup">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div>`;
  const prevFocus = document.activeElement;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-close]').onclick = close;
  document.addEventListener('keydown', onKey, true);
  root.appendChild(overlay);
  const first = overlay.querySelector('[autofocus], input, textarea, .modal-foot .primary');
  setTimeout(() => (first || overlay.querySelector('.modal')).focus?.(), 30);
  return { el: overlay.querySelector('.modal'), close };
}

export function confirmDialog({ title, message, confirm = 'Lanjutkan', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title,
      body: `<p>${esc(message)}</p>`,
      foot: `<button class="btn ghost" data-no>Batal</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirm)}</button>`,
      onClose: () => { if (!done) resolve(false); }
    });
    m.el.querySelector('[data-no]').onclick = () => m.close();
    m.el.querySelector('[data-yes]').onclick = () => { done = true; m.close(); resolve(true); };
    setTimeout(() => m.el.querySelector('[data-yes]').focus(), 40);
  });
}

export function promptDialog({ title, label, value = '', confirm = 'Simpan', placeholder = '' }) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title,
      body: `<div class="field"><label for="pd-input">${esc(label)}</label><input id="pd-input" class="input" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="60"></div>`,
      foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>${esc(confirm)}</button>`,
      onClose: () => { if (!done) resolve(null); }
    });
    const input = m.el.querySelector('input');
    const ok = () => { const v = input.value.trim(); if (!v) { input.focus(); return; } done = true; m.close(); resolve(v); };
    m.el.querySelector('[data-no]').onclick = () => m.close();
    m.el.querySelector('[data-yes]').onclick = ok;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    setTimeout(() => { input.focus(); input.select(); }, 40);
  });
}

// ---------- popover menu ----------
let openMenuEl = null;
export function closeMenu() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; } }
/** items: [{label, icon, onClick, danger}] | 'sep' | {heading} */
export function showMenu(anchor, items, { align = 'right' } = {}) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'menu';
  el.setAttribute('role', 'menu');
  el.innerHTML = items.map((it, i) => {
    if (it === 'sep') return '<hr>';
    if (it.heading) return `<div class="menu-label">${esc(it.heading)}</div>`;
    return `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? icon(it.icon, 16) : ''}<span>${esc(it.label)}</span></button>`;
  }).join('');
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = align === 'right' ? r.right - w : r.left;
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const it = items[Number(b.dataset.i)];
    closeMenu();
    it.onClick && it.onClick();
  });
  openMenuEl = el;
  setTimeout(() => el.querySelector('button')?.focus(), 10);
  return el;
}
document.addEventListener('mousedown', (e) => { if (openMenuEl && !openMenuEl.contains(e.target)) closeMenu(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('blur', closeMenu);
