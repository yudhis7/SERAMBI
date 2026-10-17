// Jadwal — month calendar with a day panel, or a filtered list.
import { icon } from '../icons.js';
import {
  esc, fmtTime, fmtDayLong, fmtMonth, relDay, startOfDay, addDays, dayKey, sameDay, snippet, confirmDialog, toast, showMenu
} from '../util.js';
import { S, api, go, emit, account, platformOf, tile, tilesFor, statusChip, targetChip, mediaTag, postTime } from '../ctx.js';

let root, tb;
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function postsOnDay(ts) {
  return S.state.posts.filter(p => p.scheduledAt && sameDay(p.scheduledAt, ts))
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

function renderTitlebar() {
  const m = S.scheduleMonth || Date.now();
  tb.innerHTML = `
    <h1>Jadwal</h1>
    ${S.scheduleMode === 'month' ? `
      <div class="no-drag" style="display:flex;align-items:center;gap:2px;margin-left:12px">
        <button class="icon-btn" data-month="-1" title="Bulan sebelumnya">${icon('chevron-left')}</button>
        <button class="icon-btn" data-month="1" title="Bulan berikutnya">${icon('chevron-right')}</button>
        <span style="font-weight:700;font-size:15px;margin-left:6px;text-transform:capitalize">${esc(fmtMonth(m))}</span>
      </div>
      <button class="btn sm" data-today style="margin-left:8px">Hari ini</button>` : ''}
    <span class="grow"></span>
    <div class="seg">
      <button class="${S.scheduleMode === 'month' ? 'on' : ''}" data-view="month">${icon('calendar', 15)}Kalender</button>
      <button class="${S.scheduleMode === 'list' ? 'on' : ''}" data-view="list">${icon('list', 15)}Daftar</button>
    </div>
    <button class="btn primary sm" data-compose>${icon('square-pen', 15)}Tulis postingan</button>`;
}

function calendar() {
  const ref = new Date(S.scheduleMonth || Date.now());
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const start = addDays(first.getTime(), -offset);
  const lastOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  const weeks = Math.ceil((offset + lastOfMonth.getDate()) / 7);
  const sel = S.scheduleDay || Date.now();
  const today = Date.now();
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i);
    const inMonth = new Date(day).getMonth() === ref.getMonth();
    const posts = postsOnDay(day);
    const max = 3;
    cells.push(`
      <div class="cal-day ${inMonth ? '' : 'other'} ${sameDay(day, today) ? 'today' : ''} ${sameDay(day, sel) ? 'selected' : ''}" data-day="${day}" role="button" tabindex="0" aria-label="${esc(fmtDayLong(day))}${posts.length ? `, ${posts.length} postingan` : ''}">
        <span class="num">${new Date(day).getDate()}</span>
        ${posts.slice(0, max).map(p => `
          <button class="cal-chip ${p.status}" data-post="${p.id}" title="${esc(snippet(p.text, 90) || 'Postingan')}">
            <span class="t">${esc(fmtTime(p.scheduledAt))}</span><span class="s">${esc(snippet(p.text, 40) || 'Media')}</span>
          </button>`).join('')}
        ${posts.length > max ? `<span class="cal-more">+${posts.length - max} lagi</span>` : ''}
      </div>`);
  }
  return `
    <div class="cal-head">${WEEKDAYS.map(w => `<span>${w}</span>`).join('')}</div>
    <div class="cal" style="grid-template-rows:repeat(${weeks}, minmax(96px, 1fr))">${cells.join('')}</div>`;
}

function postCard(p) {
  const time = p.scheduledAt ? fmtTime(p.scheduledAt) : '';
  const canAssist = p.status === 'due' || p.status === 'scheduled';
  return `
    <div class="day-post">
      <div class="top"><span class="t">${esc(time)}</span>${statusChip(p.status)}<span class="grow"></span>
        <button class="icon-btn sm" data-more="${p.id}" title="Pilihan">${icon('ellipsis', 16)}</button></div>
      ${p.text ? `<div class="txt">${esc(p.text)}</div>` : ''}
      ${p.media.length ? `<div class="thumbs">${p.media.slice(0, 5).map(m => mediaTag(m)).join('')}</div>` : ''}
      <div class="targets-mini">
        ${p.targets.map(t => { const a = account(t.accountId); return a ? `<div>${tile(a, 'xs')}<span class="grow">${esc(a.name)}</span>${targetChip(t)}</div>` : ''; }).join('')}
      </div>
      <div class="btns">
        ${canAssist ? `<button class="btn ${p.status === 'due' ? 'warn' : ''} sm" data-assist="${p.id}">${icon('clipboard-copy', 14)}${p.status === 'due' ? 'Bantu posting' : 'Posting sekarang'}</button>` : ''}
        <button class="btn sm" data-edit="${p.id}">${icon('pencil', 14)}Edit</button>
      </div>
    </div>`;
}

function dayPanel() {
  const day = S.scheduleDay || Date.now();
  const posts = postsOnDay(day);
  const isPast = startOfDay(day) < startOfDay(Date.now());
  return `
    <aside class="day-panel">
      <div class="day-panel-head">
        <div class="r">${esc(relDay(day))}</div>
        <div class="d">${esc(fmtDayLong(day))}</div>
      </div>
      <div class="day-panel-body">
        ${posts.length ? posts.map(postCard).join('') : `<div class="empty" style="margin:0 8px"><p>${isPast ? 'Tidak ada postingan di hari ini.' : 'Belum ada postingan di hari ini.'}</p></div>`}
        ${!isPast ? `<div style="padding:4px 8px"><button class="btn block" data-new-day="${day}">${icon('plus', 16)}Jadwalkan di hari ini</button></div>` : ''}
      </div>
    </aside>`;
}

function groupTitle(ts) {
  const rel = relDay(ts);
  const long = fmtDayLong(ts);
  return ['Hari ini', 'Besok', 'Kemarin'].includes(rel) ? `${rel}, ${long.replace(',', '')}` : long;
}

function listView() {
  const f = S.scheduleFilter;
  const all = S.state.posts;
  const counts = {
    all: all.length,
    scheduled: all.filter(p => p.status === 'scheduled').length,
    due: all.filter(p => p.status === 'due').length,
    draft: all.filter(p => p.status === 'draft').length,
    posted: all.filter(p => p.status === 'posted').length
  };
  const labels = { all: 'Semua', scheduled: 'Terjadwal', due: 'Perlu tindakan', draft: 'Draf', posted: 'Terposting' };
  let list = f === 'all' ? all.slice() : all.filter(p => p.status === f);
  const asc = f === 'scheduled' || f === 'due';
  list.sort((a, b) => asc ? postTime(a) - postTime(b) : postTime(b) - postTime(a));
  if (f === 'all') {
    // upcoming first (soonest on top), then everything else newest first
    const up = list.filter(p => p.status === 'scheduled' || p.status === 'due').sort((a, b) => postTime(a) - postTime(b));
    const rest = list.filter(p => !up.includes(p)).sort((a, b) => postTime(b) - postTime(a));
    list = [...up, ...rest];
  }
  const groups = [];
  for (const p of list) {
    const key = p.status === 'draft' ? 'draft' : dayKey(postTime(p));
    let g = groups.find(x => x.key === key);
    if (!g) groups.push(g = { key, title: p.status === 'draft' ? 'Draf' : groupTitle(postTime(p)), posts: [] });
    g.posts.push(p);
  }
  return `
    <div class="page list-view">
      <div class="filters" role="tablist">
        ${Object.keys(labels).map(k => `<button class="${f === k ? 'on' : ''}" data-filter="${k}">${labels[k]} <span class="n">${counts[k]}</span></button>`).join('')}
      </div>
      ${groups.length ? groups.map(g => `
        <div class="day-group"><h3>${esc(g.title)}</h3>
          <div class="post-list">${g.posts.map(p => `
            <div class="post-row" role="button" tabindex="0" data-row="${p.id}">
              <div class="when"><b>${p.scheduledAt ? esc(fmtTime(p.scheduledAt)) : '—'}</b>${p.status === 'draft' ? 'Draf' : esc(relDay(postTime(p)))}</div>
              ${tilesFor(p, 'sm')}
              <div class="text ${p.text ? '' : 'empty'}">${p.text ? esc(snippet(p.text, 180)) : `${p.media.length} media tanpa teks`}</div>
              <div class="actions">${statusChip(p.status)}<button class="icon-btn sm" data-more="${p.id}" title="Pilihan">${icon('ellipsis', 16)}</button></div>
            </div>`).join('')}
          </div></div>`).join('')
      : `<div class="empty"><p>${f === 'all' ? 'Belum ada postingan. Tulis yang pertama dan pilih kapan diposting.' : `Tidak ada postingan berstatus “${labels[f]}”.`}</p>
          <button class="btn primary" data-compose>${icon('square-pen', 16)}Tulis postingan</button></div>`}
    </div>`;
}

function render() {
  renderTitlebar();
  if (S.scheduleMode === 'list') {
    root.innerHTML = listView();
  } else {
    root.innerHTML = `<div class="sched"><div class="sched-main">${calendar()}</div>${dayPanel()}</div>`;
  }
}

function postMenu(anchor, id) {
  const p = S.state.posts.find(x => x.id === id);
  if (!p) return;
  showMenu(anchor, [
    { label: 'Edit', icon: 'pencil', onClick: () => go({ name: 'compose', postId: id }) },
    ...(p.status !== 'posted' && p.status !== 'draft' ? [{ label: 'Bantu posting', icon: 'clipboard-copy', onClick: () => emit('assist', id) }] : []),
    { label: 'Duplikat jadi draf', icon: 'copy-plus', onClick: async () => { await api.duplicatePost(id); toast('Salinan disimpan sebagai draf'); } },
    { label: 'Salin teks', icon: 'copy', onClick: async () => { await api.copyText(p.text); toast('Teks disalin'); } },
    'sep',
    { label: 'Hapus', icon: 'trash-2', danger: true, onClick: async () => {
      const ok = await confirmDialog({ title: 'Hapus postingan ini?', message: 'Postingan dan jadwalnya akan dihapus dari Serambi.', confirm: 'Hapus', danger: true });
      if (ok) { await api.removePost(id); toast('Postingan dihapus'); }
    } }
  ]);
}

async function startNow(id) {
  const p = S.state.posts.find(x => x.id === id);
  if (!p) return;
  if (p.status === 'scheduled') {
    const ok = await confirmDialog({ title: 'Posting sekarang?', message: `Postingan ini dijadwalkan ${relDay(p.scheduledAt).toLowerCase()} pukul ${fmtTime(p.scheduledAt)}. Posting sekarang tanpa menunggu?`, confirm: 'Posting sekarang' });
    if (!ok) return;
    const res = await api.runPost(id);
    if (res && res.targets.some(t => t.status === 'waiting' || t.status === 'failed')) emit('assist', id);
    else toast('Postingan terkirim');
    return;
  }
  emit('assist', id);
}

function onClick(e) {
  const b = e.target.closest('button, [data-day], [data-row]');
  if (!b) return;
  const ds = b.dataset;
  if (ds.more) { e.stopPropagation(); postMenu(b, ds.more); return; }
  if (ds.post) {
    e.stopPropagation();
    const p = S.state.posts.find(x => x.id === ds.post);
    S.scheduleDay = p.scheduledAt;
    render();
    return;
  }
  if (ds.assist) return startNow(ds.assist);
  if (ds.edit) return go({ name: 'compose', postId: ds.edit });
  if (ds.newDay) return go({ name: 'compose', date: Number(ds.newDay) });
  if (ds.filter) { S.scheduleFilter = ds.filter; render(); return; }
  if ('compose' in ds) return go({ name: 'compose' });
  if (ds.row) {
    const p = S.state.posts.find(x => x.id === ds.row);
    if (p && p.status === 'due') emit('assist', p.id); else go({ name: 'compose', postId: ds.row });
    return;
  }
  if (ds.day) {
    S.scheduleDay = Number(ds.day);
    render();
  }
}

function onDblClick(e) {
  const c = e.target.closest('[data-day]');
  if (c && !e.target.closest('[data-post]') && startOfDay(Number(c.dataset.day)) >= startOfDay(Date.now())) {
    go({ name: 'compose', date: Number(c.dataset.day) });
  }
}

function onTitle(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.month) {
    const d = new Date(S.scheduleMonth || Date.now());
    d.setDate(1); d.setMonth(d.getMonth() + Number(b.dataset.month));
    S.scheduleMonth = d.getTime();
    render();
  } else if ('today' in b.dataset) {
    S.scheduleMonth = Date.now(); S.scheduleDay = Date.now(); render();
  } else if (b.dataset.view) {
    S.scheduleMode = b.dataset.view; render();
  } else if ('compose' in b.dataset) {
    go({ name: 'compose' });
  }
}

function onKey(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (e.target.matches('[data-day], [data-row]')) { e.preventDefault(); onClick(e); }
}

export default {
  mount(el, titlebar) {
    root = el; tb = titlebar;
    if (!S.scheduleMonth) S.scheduleMonth = Date.now();
    if (!S.scheduleDay) S.scheduleDay = Date.now();
    root.addEventListener('click', onClick);
    root.addEventListener('dblclick', onDblClick);
    root.addEventListener('keydown', onKey);
    tb.onclick = onTitle;
    render();
  },
  update() { render(); },
  unmount() {
    root.removeEventListener('click', onClick);
    root.removeEventListener('dblclick', onDblClick);
    root.removeEventListener('keydown', onKey);
  }
};
