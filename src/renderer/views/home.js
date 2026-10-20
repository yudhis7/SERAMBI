// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Beranda — today at a glance.
import { icon } from '../icons.js';
import { esc, fmtTime, fmtDayLong, relDay, greeting, startOfDay, addDays, snippet } from '../util.js';
import { S, go, emit, account, platformOf, tile, tileForPlatform, tilesFor, statusChip, postTime, hasBot, PLATFORM_DESC, KIND_LABEL, kindOf } from '../ctx.js';

let root, timer;

function postRow(p, { showAction = false } = {}) {
  const t = postTime(p);
  const text = snippet(p.text, 160);
  return `
    <div class="post-row" role="button" tabindex="0" data-post="${p.id}">
      <div class="when"><b>${p.scheduledAt ? fmtTime(p.scheduledAt) : '—'}</b>${esc(relDay(t))}</div>
      ${tilesFor(p, 'sm')}
      <div class="text ${text ? '' : 'empty'}">${text ? esc(text) : (p.media.length ? `${p.media.length} media tanpa teks` : 'Belum ada isi')}</div>
      <div class="actions">${showAction
        ? `<button class="btn warn sm" data-assist="${p.id}">${icon('clipboard-copy', 14)}Bantu posting</button>`
        : statusChip(p.status)}</div>
    </div>`;
}

function ribbon(posts) {
  const day0 = startOfDay(Date.now());
  const now = Date.now();
  const pct = (ts) => ((ts - day0) / 86400000) * 100;
  const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const marks = posts.map(p => {
    const left = Math.min(99, Math.max(1, pct(p.scheduledAt)));
    const past = p.scheduledAt < now;
    return `<button class="ribbon-mark ${past ? 'past' : ''} ${p.status === 'due' ? 'due' : ''}" style="left:${left}%" data-post="${p.id}"
      title="${esc(fmtTime(p.scheduledAt))} · ${esc(snippet(p.text, 60) || 'Postingan')}">
      ${tilesFor(p, 'sm', 3)}<span class="pin"></span></button>`;
  }).join('');
  return `
    <div class="ribbon" aria-label="Jadwal hari ini">
      <div class="ribbon-track"></div>
      <div class="ribbon-past" style="width:${pct(now)}%"></div>
      <div class="ribbon-hours">${hours.map(h => `<span style="left:${(h / 24) * 100}%">${String(h % 24).padStart(2, '0')}.00</span>`).join('')}</div>
      ${marks}
      <div class="ribbon-now" style="left:${pct(now)}%" data-label="${esc(fmtTime(now))}"></div>
    </div>`;
}

function summarySentence(today, due) {
  const planned = today.length;
  const upcomingToday = today.filter(p => p.scheduledAt > Date.now() && p.status === 'scheduled').length;
  if (!planned && !due.length) return 'Belum ada postingan untuk hari ini. Tulis satu dan pilih waktunya, Serambi akan mengingatkanmu.';
  const parts = [];
  if (planned) parts.push(`<b>${planned} postingan</b> dijadwalkan hari ini${upcomingToday ? `, ${upcomingToday} masih akan datang` : ''}`);
  if (due.length) parts.push(`<b>${due.length} perlu kamu posting</b> sekarang`);
  return parts.join('. ') + '.';
}

function render() {
  const { accounts, posts } = S.state;
  const now = Date.now();
  const day0 = startOfDay(now);
  const day1 = addDays(day0, 1);

  if (!accounts.length) {
    root.innerHTML = `
      <div class="page"><div class="welcome">
        <h2>Media sosial dan toko onlinemu, di satu tempat</h2>
        <p>Tambahkan akun pertamamu. Kamu akan masuk di halaman resmi platformnya, lalu chat, notifikasi, jadwal postingan, dan promosi toko bisa diurus dari sini.</p>
        ${['social', 'shop'].map(kind => `
          <h3 class="welcome-group">${KIND_LABEL[kind]}</h3>
          <div class="platform-grid ${kind}">
            ${Object.values(S.platforms).filter(p => (p.kind || 'social') === kind).map(p => `
              <button class="platform-card" data-quick="${p.id}" style="--c:${p.color}">
                ${tileForPlatform(p.id, 'lg')}
                <div><b>${esc(p.name)}</b><span>${esc(PLATFORM_DESC[p.id] || '')}</span></div>
              </button>`).join('')}
          </div>`).join('')}
        <div class="welcome-steps">
          <div><b>Masuk sekali</b>Login tiap akun tersimpan. Bisa beberapa akun di platform yang sama.</div>
          <div><b>Tulis sekali, kirim ke banyak akun</b>Susun postingan atau promosi, pilih akun dan waktunya.</div>
          <div><b>Promosi langsung ke toko</b>Sisipkan link toko Tokopedia atau Shopee ke setiap postingan.</div>
        </div>
      </div></div>`;
    return;
  }

  const today = posts.filter(p => p.scheduledAt && p.scheduledAt >= day0 && p.scheduledAt < day1 && p.status !== 'draft')
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  const due = posts.filter(p => p.status === 'due').sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));
  const upcoming = posts.filter(p => p.status === 'scheduled' && p.scheduledAt > now && p.scheduledAt < addDays(day0, 8))
    .sort((a, b) => a.scheduledAt - b.scheduledAt).slice(0, 7);
  const drafts = posts.filter(p => p.status === 'draft').sort((a, b) => b.updatedAt - a.updatedAt);

  root.innerHTML = `
    <div class="page">
      <div class="home-hero">
        <p class="greet">${greeting()}</p>
        <h2 class="date">${esc(fmtDayLong(now))}</h2>
        <p class="summary">${summarySentence(today, due)}</p>
      </div>
      ${ribbon(today)}
      <div class="home-grid">
        <div class="home-col">
          ${due.length ? `
            <section class="attention">
              <div class="section-head"><h2>${icon('hourglass', 17)}Perlu diposting sekarang</h2></div>
              <div class="post-list">${due.map(p => postRow(p, { showAction: true })).join('')}</div>
            </section>` : ''}
          <section>
            <div class="section-head"><h2>Akan datang</h2><button class="link" data-go="schedule">Lihat jadwal</button></div>
            ${upcoming.length
              ? `<div class="panel post-list">${upcoming.map(p => postRow(p)).join('')}</div>`
              : `<div class="empty"><p>Tidak ada postingan terjadwal untuk 7 hari ke depan.</p>
                 <button class="btn primary" data-go="compose">${icon('square-pen', 16)}Tulis postingan</button></div>`}
          </section>
          ${drafts.length ? `
            <section>
              <div class="section-head"><h2>Draf</h2><span class="faint">${drafts.length} tersimpan</span></div>
              <div class="panel post-list">${drafts.slice(0, 4).map(p => postRow(p)).join('')}</div>
            </section>` : ''}
        </div>
        <div class="home-col">
          <section>
            <div class="section-head"><h2>Akun</h2><button class="link" data-add>Tambah akun</button></div>
            ${['social', 'shop'].map(kind => {
              const list = accounts.filter(a => kindOf(a) === kind);
              if (!list.length) return kind === 'shop'
                ? `<button class="acct-row add-shop" data-add-kind="shop"><span class="add-box-lg">${icon('store', 20)}</span>
                    <span class="meta"><b>Hubungkan toko online</b><span>Tokopedia atau Shopee, untuk promosi langsung ke tokomu</span></span></button>`
                : '';
              return `<h3 class="acct-kind">${KIND_LABEL[kind]}</h3>
                <div class="acct-list">${list.map(a => {
                  const p = platformOf(a);
                  const n = S.unread[a.id] || 0;
                  const auto = a.platform === 'telegram' && hasBot(a.id);
                  const extra = kind === 'shop' ? (a.shopUrl ? ' · link toko tersimpan' : ' · link toko belum diatur') : (auto ? ' · posting otomatis' : '');
                  return `<button class="acct-row" data-acct="${a.id}">
                    ${tile(a, 'lg', true)}
                    <span class="meta"><b>${esc(a.name)}</b><span>${esc(p.name)}${extra}${a.muted ? ' · notifikasi mati' : ''}</span></span>
                    ${n ? `<span class="unread">${n} baru</span>` : ''}
                  </button>`;
                }).join('')}</div>`;
            }).join('')}
          </section>
        </div>
      </div>
    </div>`;
}

function onClick(e) {
  const b = e.target.closest('[data-assist],[data-post],[data-go],[data-acct],[data-add],[data-add-kind],[data-quick]');
  if (!b) return;
  if (b.dataset.assist) { e.stopPropagation(); emit('assist', b.dataset.assist); return; }
  if (b.dataset.post) {
    const p = S.state.posts.find(x => x.id === b.dataset.post);
    if (!p) return;
    if (p.status === 'due') emit('assist', p.id);
    else go({ name: 'compose', postId: p.id });
    return;
  }
  if (b.dataset.go) go({ name: b.dataset.go });
  if (b.dataset.acct) go({ name: 'account', id: b.dataset.acct });
  if ('add' in b.dataset) emit('add-account');
  if (b.dataset.addKind) emit('add-account-kind', b.dataset.addKind);
  if (b.dataset.quick) emit('quick-add', b.dataset.quick);
}
function onKey(e) {
  if (e.key === 'Enter' && e.target.matches('.post-row')) onClick(e);
}

export default {
  mount(el, tb) {
    root = el;
    tb.innerHTML = S.state.accounts.length ? `<span class="grow"></span><button class="btn primary sm" data-compose>${icon('square-pen', 15)}Tulis postingan</button>` : '';
    tb.onclick = (e) => { if (e.target.closest('[data-compose]')) go({ name: 'compose' }); };
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    render();
    timer = setInterval(render, 60000); // keep the clock and "now" line fresh
  },
  update() { render(); },
  onUnread() { render(); },
  unmount() {
    clearInterval(timer);
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
  }
};
