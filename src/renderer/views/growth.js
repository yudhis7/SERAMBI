// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Tumbuh lokal — get discovered locally, run better local ads, build trust through reviews,
// and automate everyday local marketing.
import { icon } from '../icons.js';
import { esc, tabStrip, ring, bar, fmtDayLong, relDay } from '../util.js';
import { S, api, go, perm, rupiah, fmtNum, pct } from '../ctx.js';
import { growthScore } from '../lib/score.js';
import Discover from './growth-discover.js';
import Ads from './growth-ads.js';
import Reviews from './growth-reviews.js';
import Automate from './growth-automate.js';

let root, tb, tab = 'overview', section = null, sub = null, bound = null;

export const CONSOLES = [
  ['https://business.google.com/', 'Profil Bisnis Google', 'map-pin', 'Kelola profil di Penelusuran & Maps'],
  ['https://ads.google.com/', 'Google Ads', 'megaphone', 'Iklan di Penelusuran, Maps, YouTube'],
  ['https://ads.google.com/aw/keywordplanner/home', 'Perencana Kata Kunci', 'search', 'Perkiraan volume & biaya klik'],
  ['https://search.google.com/search-console', 'Google Search Console', 'globe', 'Kesehatan situs di Google'],
  ['https://adsmanager.facebook.com/', 'Meta Ads Manager', 'target', 'Iklan Facebook & Instagram'],
  ['https://ads.tiktok.com/', 'TikTok Ads Manager', 'trending-up', 'Iklan TikTok']
];

const TABS = {
  overview: { label: 'Ringkasan', icon: 'gauge' },
  discover: { label: 'Ditemukan di sekitar', icon: 'map-pin', view: Discover },
  ads: { label: 'Iklan lokal', icon: 'megaphone', view: Ads },
  reviews: { label: 'Ulasan', icon: 'star', view: Reviews },
  automate: { label: 'Otomatisasi', icon: 'zap', view: Automate }
};

function upcomingMoments(days = 45) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const end = t0.getTime() + days * 86400000;
  return S.moments.filter(m => { const t = new Date(m.date + 'T00:00:00').getTime(); return t >= t0.getTime() && t <= end && m.kind !== 'gajian'; });
}

export function momentRow(m) {
  const ts = new Date(m.date + 'T09:00:00').getTime();
  return `<div class="moment-row">
    <div class="moment-date"><b>${new Date(ts).getDate()}</b><span>${esc(new Date(ts).toLocaleDateString('id-ID', { month: 'short' }))}</span></div>
    <div class="meta"><b>${esc(m.name)}${m.estimate ? ' <span class="faint">(perkiraan)</span>' : ''}</b><span>${esc(m.idea)}</span></div>
    <span class="chip kind-${m.kind}">${esc(S.momentKinds[m.kind] || m.kind)}</span>
    ${perm('post.write') ? `<button class="btn sm" data-moment="${m.id}">${icon('square-pen', 14)}Siapkan</button>` : ''}
  </div>`;
}
export function openMoment(id) {
  const m = S.moments.find(x => x.id === id);
  if (!m) return;
  const ts = new Date(m.date + 'T09:00:00').getTime() - 86400000; // a day before, 09.00
  const biz = S.state.business.name ? ` bersama ${S.state.business.name}` : '';
  go({ name: 'compose', text: `${m.name}${biz}\n\n`, note: m.idea, scheduledAt: ts > Date.now() ? ts : Date.now() + 3600000 });
}

function overview() {
  const st = S.state;
  const g = growthScore(st);
  const rv = g.reviews;
  const open = st.tasks.filter(t => t.status === 'open');
  const live = st.campaigns.filter(c => c.status === 'live');
  const spend = live.reduce((s, c) => s + (c.spend || 0), 0);
  const leads = live.reduce((s, c) => s + (c.leads || 0), 0);
  const posted = st.posts.filter(p => (p.postedAt || 0) > Date.now() - 28 * 86400000).length;
  const setup = !st.business.name;
  const moments = upcomingMoments(40).slice(0, 5);
  return `
    <div class="page">
      ${setup ? `
      <div class="setup-card">
        <span class="setup-icon">${icon('sprout', 24)}</span>
        <div><b>Mulai dari profil bisnismu</b><p>Isi nama, kategori, kota, dan layanan. Serambi memakainya untuk pemeriksaan SEO, kode schema, draf iklan, dan pesan ulasan.</p></div>
        <button class="btn primary" data-tab-go="discover">${icon('pencil', 16)}Isi profil bisnis</button>
        <button class="btn" data-go-usecases>${icon('lightbulb', 16)}Lihat contoh usaha</button>
      </div>` : ''}
      <div class="growth-top">
        <section class="panel score-panel">
          <div class="score-head">${ring(g.score, 108)}
            <div><h2>Skor pertumbuhan lokal</h2><p>Mengukur seberapa lengkap dasar-dasar pemasaran lokalmu di Serambi. Ini bukan peringkat Google, tetapi semakin tinggi skornya, semakin siap usahamu ditemukan dan dipercaya.</p></div></div>
          <div class="score-parts">${g.parts.map(p => `
            <div class="score-part"><span class="lbl">${esc(p.label)}</span>${bar(p.got, p.max, p.got / p.max >= .75 ? 'good' : p.got / p.max >= .4 ? 'mid' : 'low')}<span class="val tnum">${Math.round(p.got)}/${p.max}</span><span class="det">${esc(p.detail)}</span></div>`).join('')}</div>
        </section>
        <section class="next-steps">
          <div class="section-head"><h2>Langkah berikutnya</h2></div>
          ${g.actions.slice(0, 4).map((a, i) => `
            <button class="next-step" data-action="${i}">
              <span class="n">${i + 1}</span>
              <span class="meta"><b>${esc(a.title)}</b><span>${esc(a.detail)}</span></span>
              <span class="gain">+${Math.max(1, Math.round(a.gain))}</span>${icon('chevron-right', 16)}
            </button>`).join('') || `<div class="empty"><p>Semua dasar sudah terpenuhi. Pertahankan ritme posting dan balas ulasan.</p></div>`}
        </section>
      </div>
      <div class="kpis">
        <div class="kpi"><span>${icon('star', 16)}Rating rata-rata</span><b>${rv.avg ? rv.avg.toFixed(1).replace('.', ',') + '★' : '—'}</b><small>${rv.n} ulasan tercatat</small></div>
        <div class="kpi"><span>${icon('message-square', 16)}Ulasan belum dibalas</span><b class="${rv.unreplied ? 'warn' : ''}">${rv.unreplied}</b><small>${rv.replyRate === null ? 'Belum ada ulasan' : pct(rv.replyRate) + ' sudah dibalas'}</small></div>
        <div class="kpi"><span>${icon('send', 16)}Postingan 4 minggu</span><b>${posted}</b><small>Target 8 (2 per minggu)</small></div>
        <div class="kpi"><span>${icon('list-checks', 16)}Tugas terbuka</span><b>${open.length}</b><small>${open.filter(t => t.source === 'automation').length} dari otomatisasi</small></div>
        <div class="kpi"><span>${icon('megaphone', 16)}Kampanye berjalan</span><b>${live.length}</b><small>${live.length ? `${rupiah(spend)} · ${fmtNum(leads)} prospek` : 'Belum ada'}</small></div>
      </div>
      <div class="growth-cols">
        <section>
          <div class="section-head"><h2>Momen terdekat</h2><button class="link" data-tab-go="automate">Kalender lengkap</button></div>
          <div class="panel moment-list">${moments.length ? moments.map(momentRow).join('') : '<div class="empty"><p>Tidak ada momen dalam 40 hari ke depan.</p></div>'}</div>
        </section>
        <section>
          <div class="section-head"><h2>Konsol resmi</h2><span class="faint">Dibuka di browser</span></div>
          <div class="console-grid">${CONSOLES.map(([url, name, ic, d]) => `
            <button class="console" data-ext="${esc(url)}">${icon(ic, 18)}<span><b>${esc(name)}</b><span>${esc(d)}</span></span>${icon('arrow-up-right', 15)}</button>`).join('')}
          </div>
          <p class="hint" style="margin-top:10px">${icon('info', 13, 'inline')}Google bisa memblokir login dari jendela aplikasi, jadi konsol resmi selalu dibuka di browser biasa. Serambi menyiapkan isinya; kamu tinggal menempel.</p>
        </section>
      </div>
    </div>`;
}

function renderTitle() {
  tb.innerHTML = `<h1>Tumbuh lokal</h1><span class="grow"></span>${perm('post.write') ? `<button class="btn primary sm" data-compose>${icon('square-pen', 15)}Tulis postingan</button>` : ''}`;
}
function subnav() {
  return `<div class="subnav">${tabStrip(Object.entries(TABS).map(([id, t]) => [id, t.label, t.icon, id === 'reviews' && unreplied() ? String(unreplied()) : '']), tab)}</div>`;
}
const unreplied = () => S.state.reviews.filter(r => !r.reply).length;

function render() {
  renderTitle();
  const t = TABS[tab];
  if (t.view) {
    root.innerHTML = subnav() + t.view.render({ section });
    // Bind each sub-view's listeners once, when it becomes active.
    if (bound !== t.view) {
      if (bound && bound.unbind) bound.unbind();
      bound = t.view;
      t.view.bind && t.view.bind(root, { rerender: render, setTab });
    }
  } else {
    if (bound && bound.unbind) bound.unbind();
    bound = null;
    root.innerHTML = subnav() + overview();
  }
  if (section) {
    const target = root.querySelector('#gs-' + section);
    if (target) setTimeout(() => target.scrollIntoView({ block: 'start', behavior: 'smooth' }), 40);
    section = null;
  }
}

function onTitle(e) {
  if (e.target.closest('[data-compose]')) go({ name: 'compose' });
}
function setTab(id, sec) {
  tab = TABS[id] ? id : 'overview';
  section = sec || null;
  sub = TABS[tab].view || null;
  try { localStorage.setItem('growthTab', tab); } catch (_) {}
  root.scrollTop = 0;
  render();
}

function onClick(e) {
  const tb2 = e.target.closest('.subnav [data-tab]');
  if (tb2) { setTab(tb2.dataset.tab); return; }
  if (tab !== 'overview') return;
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tabGo) return setTab(b.dataset.tabGo);
  if (b.dataset.ext) return api.openExternal(b.dataset.ext);
  if (b.dataset.moment) return openMoment(b.dataset.moment);
  if ('goUsecases' in b.dataset) return go({ name: 'usecases' });
  if (b.dataset.action) {
    const a = growthScore(S.state).actions[Number(b.dataset.action)];
    if (!a) return;
    if (a.go.name === 'growth') setTab(a.go.tab, a.go.section);
    else go(a.go);
  }
}

export default {
  mount(el, titlebar, route) {
    root = el; tb = titlebar;
    let saved = null;
    try { saved = localStorage.getItem('growthTab'); } catch (_) {}
    tab = TABS[route.tab] ? route.tab : (TABS[saved] ? saved : 'overview');
    section = route.section || null;
    sub = TABS[tab].view || null;
    tb.onclick = onTitle;
    root.addEventListener('click', onClick);
    render();
  },
  update() {
    // Do not re-render while the user is typing in a form on a sub-tab.
    if (sub && sub.isDirty && sub.isDirty()) { const n = root.querySelector('.subnav'); if (n) n.outerHTML = subnav(); return; }
    const y = root.scrollTop;
    render();
    root.scrollTop = y;
  },
  unmount() {
    if (bound && bound.unbind) bound.unbind();
    bound = null;
    root.removeEventListener('click', onClick);
  }
};
