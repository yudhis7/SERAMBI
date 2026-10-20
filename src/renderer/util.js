// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
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
export function openModal({ title, body, foot, wide = false, xl = false, onClose, headExtra = '', cls = '' }) {
  const root = $('#modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''} ${xl ? 'xl' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
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

export function promptDialog({ title, label, value = '', confirm = 'Simpan', placeholder = '', type = 'text', maxlength = 60, hint = '' }) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title,
      body: `<div class="field"><label for="pd-input">${esc(label)}</label><input id="pd-input" class="input" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="${maxlength}">${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`,
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

// ---------- v1.2 helpers ----------
const fmtDateF = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateLongF = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDateTimeF = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export const fmtDate = (ts) => ts ? fmtDateF.format(new Date(ts)) : '—';
export const fmtDateLong = (ts) => ts ? fmtDateLongF.format(new Date(ts)) : '—';
export const fmtDateTime = (ts) => ts ? fmtDateTimeF.format(new Date(ts)) : '—';

/** "5 menit lalu", "2 hari lalu", "dalam 3 jam" */
export function timeAgo(ts, now = Date.now()) {
  if (!ts) return '—';
  const diff = ts - now;
  const abs = Math.abs(diff);
  const unit = abs < 60000 ? null : abs < 3600000 ? [Math.round(abs / 60000), 'menit'] : abs < 86400000 ? [Math.round(abs / 3600000), 'jam'] : abs < 30 * 86400000 ? [Math.round(abs / 86400000), 'hari'] : [Math.round(abs / (30 * 86400000)), 'bulan'];
  if (!unit) return diff < 0 ? 'baru saja' : 'sebentar lagi';
  return diff < 0 ? `${unit[0]} ${unit[1]} lalu` : `dalam ${unit[0]} ${unit[1]}`;
}

/** Remaining time until a deadline, e.g. "41 jam lagi" or "lewat 5 jam". */
export function deadlineText(due, now = Date.now()) {
  const h = Math.round((due - now) / 3600000);
  if (h >= 48) return `${Math.round(h / 24)} hari lagi`;
  if (h >= 1) return `${h} jam lagi`;
  if (h > -1) return 'kurang dari 1 jam';
  return `lewat ${Math.abs(h) >= 48 ? Math.round(Math.abs(h) / 24) + ' hari' : Math.abs(h) + ' jam'}`;
}

/** Segmented tab strip. tabs: [[id, label, iconName?, badge?]] */
export function tabStrip(tabs, active, attr = 'data-tab') {
  return `<div class="tabs" role="tablist">${tabs.map(([id, label, ic, badge]) =>
    `<button role="tab" ${attr}="${id}" class="${id === active ? 'on' : ''}" aria-selected="${id === active}">${ic ? icon(ic, 16) : ''}<span>${esc(label)}</span>${badge ? `<span class="tab-badge">${esc(badge)}</span>` : ''}</button>`).join('')}</div>`;
}

/** Score ring 0–100 as inline SVG. */
export function ring(score, size = 76, label = '') {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, Math.round(score)));
  const tone = v >= 75 ? 'good' : v >= 45 ? 'mid' : 'low';
  return `<span class="ring ${tone}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    ${v > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}</svg>
    <b>${v}</b>${label ? `<small>${esc(label)}</small>` : ''}</span>`;
}

/** Thin progress bar. */
export function bar(value, max = 100, tone = '') {
  const w = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<span class="bar ${tone}"><span style="width:${w.toFixed(1)}%"></span></span>`;
}

export function csv(rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map(r => r.map(cell).join(',')).join('\r\n');
}

/** Parses CSV or semicolon-separated text (Excel in Indonesian locale uses ";"). */
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}

/** Reads values of [data-f] fields inside a container into an object. */
export function readForm(root) {
  const out = {};
  root.querySelectorAll('[data-f]').forEach(el => {
    const k = el.dataset.f;
    if (el.type === 'checkbox') out[k] = el.checked;
    else if (el.type === 'number') out[k] = el.value === '' ? '' : Number(el.value);
    else out[k] = el.value;
  });
  return out;
}

export function charLen(s) { return Array.from(String(s || '')).length; }
