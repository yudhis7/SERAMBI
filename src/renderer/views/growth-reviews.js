// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Ulasan — ask every customer for a review (link, QR card, WhatsApp), keep an inbox of
// reviews from Google and marketplaces, reply with ready templates, and turn good reviews
// into testimonial posts.
import { icon } from '../icons.js';
import { esc, toast, openModal, confirmDialog, readForm, fmtDate, toDateInput, timeAgo, bar } from '../util.js';
import { S, api, go, emit, perm, reviewLink, hasConsent, prettyPhone, pct } from '../ctx.js';
import { reviewStats } from '../lib/score.js';
import { reviewCards } from '../lib/print.js';

let root, ctx, filter = 'all', locFilter = '';

export const SOURCES = {
  google: 'Google', tokopedia: 'Tokopedia', shopee: 'Shopee', facebook: 'Facebook', instagram: 'Instagram',
  tiktok: 'TikTok', gofood: 'GoFood', grabfood: 'GrabFood', other: 'Lainnya'
};
const DEFAULT_ASK = 'Halo {nama}, terima kasih sudah berbelanja di {usaha}! Kalau berkenan, ceritakan pengalaman Kakak lewat ulasan singkat di sini: {link}\nUlasan Kakak sangat membantu kami 🙏';
export const REPLY_TEMPLATES = {
  positive: ['Terima kasih banyak, {nama}! Senang sekali Kakak puas. Ditunggu kedatangannya lagi di {usaha} 😊', 'Terima kasih atas ulasannya, {nama}! Masukan seperti ini bikin tim kami makin semangat. Sampai jumpa lagi!'],
  neutral: ['Terima kasih atas ulasannya, {nama}. Kami ingin tahu apa yang bisa kami perbaiki supaya kunjungan berikutnya bintang lima. Boleh ceritakan lewat WhatsApp kami?'],
  negative: ['Mohon maaf atas pengalaman yang kurang menyenangkan, {nama}. Ini bukan standar kami. Boleh hubungi kami di WhatsApp {wa} supaya kami bisa memperbaikinya untuk Kakak?', 'Terima kasih sudah memberi tahu, {nama}. Kami sudah membahasnya dengan tim dan akan memperbaikinya. Kami ingin menebusnya di kunjungan berikutnya; silakan hubungi kami di {wa}.']
};
function fillReply(t, r) {
  const b = S.state.business;
  const first = String(r.author || '').trim().split(/\s+/)[0] || 'Kak';
  return t.replace(/\{nama\}/g, first).replace(/\{usaha\}/g, b.name || 'kami').replace(/\{wa\}/g, b.whatsapp ? prettyPhone(b.whatsapp) : 'kami');
}
const stars = (n) => `<span class="stars" aria-label="${n} bintang">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>`;
const canEdit = () => perm('reviews.write');
const askMsg = () => { try { return localStorage.getItem('reviewMsg') || DEFAULT_ASK; } catch (_) { return DEFAULT_ASK; } };

function statsSection() {
  const rv = reviewStats(S.state.reviews);
  return `
    <section class="g-section" id="gs-stats">
      <div class="review-stats panel">
        <div class="rs-avg"><b>${rv.avg ? rv.avg.toFixed(1).replace('.', ',') : '—'}</b>${rv.avg ? stars(Math.round(rv.avg)) : ''}<span>${rv.n} ulasan tercatat</span></div>
        <div class="rs-dist">${[5, 4, 3, 2, 1].map((s, i) => `<div><span>${s}★</span>${bar(rv.dist[i], Math.max(1, rv.n), s >= 4 ? 'good' : s === 3 ? 'mid' : 'low')}<span class="tnum">${rv.dist[i]}</span></div>`).join('')}</div>
        <div class="rs-kpis">
          <div><b class="${rv.unreplied ? 'warn' : ''}">${rv.unreplied}</b><span>belum dibalas</span></div>
          <div><b>${rv.replyRate === null ? '—' : pct(rv.replyRate)}</b><span>sudah dibalas</span></div>
          <div><b>${rv.replyHours === null ? '—' : rv.replyHours < 24 ? Math.round(rv.replyHours) + ' jam' : Math.round(rv.replyHours / 24) + ' hari'}</b><span>rata-rata waktu balas</span></div>
          <div><b>${rv.recent}</b><span>ulasan 90 hari terakhir</span></div>
        </div>
      </div>
    </section>`;
}

function askSection() {
  const locs = S.state.locations;
  return `
    <section class="g-section" id="gs-ask">
      <div class="g-head"><div><h2>Minta ulasan</h2><p>Ulasan baru dan rutin adalah sinyal kepercayaan terkuat untuk usaha lokal. Kirim link ulasan setelah pelanggan berbelanja, atau pasang kartu QR di kasir.</p></div></div>
      <div class="warning info">${icon('scale', 15)}<span><b>Main bersih:</b> minta ulasan ke semua pelanggan, bukan hanya yang puas. Google melarang menyaring siapa yang diminta mengulas, memberi imbalan untuk ulasan, atau menulis ulasan palsu. Pesan WhatsApp hanya untuk pelanggan yang setuju dihubungi.</span></div>
      ${locs.length ? `<div class="ask-grid">${locs.map(l => {
        const link = reviewLink(l);
        return `<div class="panel ask-card">
          <div class="loc-top">${icon('map-pin', 17)}<b>${esc(l.name || 'Lokasi')}</b></div>
          ${link ? `<code class="selectable link-code">${esc(link)}</code>
            <div class="row-btns">
              <button class="btn sm" data-copy-link="${l.id}">${icon('copy', 14)}Salin link</button>
              <button class="btn sm" data-qr="${l.id}">${icon('qr-code', 14)}Kartu QR</button>
              <button class="btn primary sm" data-wa-ask="${l.id}">${icon('message-circle', 14)}Kirim lewat WhatsApp</button>
            </div>`
          : `<p class="hint">Link ulasan belum ada. Isi Place ID atau tempel link “Bagikan formulir ulasan” dari Profil Bisnis Google.</p>
             ${perm('growth.write') ? `<button class="btn sm" data-setup-link="${l.id}">${icon('link', 14)}Atur link ulasan</button>` : ''}`}
        </div>`;
      }).join('')}</div>` : `<div class="empty"><p>Tambahkan lokasi usaha dulu di tab Ditemukan di sekitar.</p><button class="btn" data-goto-loc>${icon('map-pin', 15)}Tambah lokasi</button></div>`}
      <details class="panel msg-panel"><summary>${icon('message-square', 15)}Pesan permintaan ulasan ${icon('chevron-down', 15)}</summary>
        <textarea class="input textarea" rows="4" data-ask-msg>${esc(askMsg())}</textarea>
        <p class="hint">{nama} = nama depan pelanggan, {usaha} = nama usaha, {link} = link ulasan. Otomatisasi “Minta ulasan setelah berkunjung” memakai pesannya sendiri.</p>
      </details>
    </section>`;
}

function reviewCard(r) {
  const loc = S.state.locations.find(l => l.id === r.locationId);
  return `
    <article class="panel review-card ${r.reply ? '' : 'unreplied'}" data-review="${r.id}">
      <div class="rv-top">${stars(r.rating || 0)}<b>${esc(r.author || 'Tanpa nama')}</b>
        <span class="chip">${esc(SOURCES[r.source] || 'Lainnya')}</span>${loc && S.state.locations.length > 1 ? `<span class="faint">${esc(loc.name)}</span>` : ''}
        <span class="grow"></span><span class="faint">${esc(fmtDate(r.date))}</span>
        ${canEdit() ? `<button class="icon-btn sm" data-rv-edit="${r.id}" title="Ubah">${icon('pencil', 14)}</button><button class="icon-btn sm" data-rv-rm="${r.id}" title="Hapus">${icon('trash-2', 14)}</button>` : ''}</div>
      ${r.text ? `<p class="rv-text selectable">${esc(r.text)}</p>` : '<p class="rv-text faint">Tanpa teks</p>'}
      ${r.reply ? `
        <div class="rv-reply"><b>${icon('message-square', 13, 'inline')}Balasanmu</b>${r.replyPosted ? ' <span class="chip posted">Sudah diposting</span>' : ' <span class="chip due">Belum diposting di platform</span>'}
          <p class="selectable">${esc(r.reply)}</p>
          <div class="row-btns">
            <button class="btn sm" data-rv-copy="${r.id}">${icon('copy', 14)}Salin balasan</button>
            ${!r.replyPosted && canEdit() ? `<button class="btn sm" data-rv-posted="${r.id}">${icon('check', 14)}Sudah saya posting</button>` : ''}
            ${canEdit() ? `<button class="btn ghost sm" data-rv-reply="${r.id}">Ubah balasan</button>` : ''}
            ${r.rating >= 4 && r.text && perm('post.write') ? `<button class="btn ghost sm" data-rv-testi="${r.id}">${icon('megaphone', 14)}Jadikan testimoni</button>` : ''}
          </div></div>`
      : canEdit() ? `<div class="row-btns"><button class="btn primary sm" data-rv-reply="${r.id}">${icon('message-square', 14)}Balas</button>
          ${r.rating >= 4 && r.text && perm('post.write') ? `<button class="btn ghost sm" data-rv-testi="${r.id}">${icon('megaphone', 14)}Jadikan testimoni</button>` : ''}
          <span class="faint">${esc(timeAgo(r.date))}</span></div>` : ''}
    </article>`;
}

function inboxSection() {
  let list = [...S.state.reviews].sort((a, b) => (b.date || 0) - (a.date || 0));
  if (locFilter) list = list.filter(r => r.locationId === locFilter);
  const counts = { all: list.length, unreplied: list.filter(r => !r.reply).length, low: list.filter(r => r.rating <= 3).length };
  if (filter === 'unreplied') list = list.filter(r => !r.reply);
  if (filter === 'low') list = list.filter(r => r.rating <= 3);
  return `
    <section class="g-section" id="gs-inbox">
      <div class="g-head"><div><h2>Kotak ulasan</h2><p>Catat ulasan dari Google, Tokopedia, Shopee, dan lainnya di satu tempat. Balas dari sini, salin, lalu tempel di platformnya.</p></div>
        <div class="g-acts">${S.state.locations.length > 1 ? `<select class="input sm-input" data-loc-filter><option value="">Semua lokasi</option>${S.state.locations.map(l => `<option value="${l.id}" ${locFilter === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>` : ''}
          ${canEdit() ? `<button class="btn sm" data-rv-new>${icon('plus', 15)}Catat ulasan</button>` : ''}
          <button class="btn ghost sm" data-ext="https://business.google.com/reviews">${icon('external-link', 14)}Ulasan di Google</button></div></div>
      <div class="filters">${[['all', 'Semua'], ['unreplied', 'Belum dibalas'], ['low', 'Bintang 1–3']].map(([k, l]) => `<button class="${filter === k ? 'on' : ''}" data-rv-filter="${k}">${l} <span class="n">${counts[k]}</span></button>`).join('')}</div>
      ${list.length ? `<div class="review-list">${list.map(reviewCard).join('')}</div>`
        : `<div class="empty"><p>${S.state.reviews.length ? 'Tidak ada ulasan untuk filter ini.' : 'Belum ada ulasan tercatat. Salin ulasan terbaru dari Profil Bisnis Google atau toko onlinemu.'}</p></div>`}
    </section>`;
}

function render() {
  return `<div class="page growth-page">${statsSection()}${askSection()}${inboxSection()}</div>`;
}

// ---------- actions ----------
function editReview(r) {
  const x = r || { rating: 5, source: 'google', date: Date.now(), locationId: (S.state.locations[0] || {}).id };
  const m = openModal({
    title: r ? 'Ubah ulasan' : 'Catat ulasan',
    body: `
      <div class="form-grid">
        <div class="field"><label>Sumber</label><select class="input" data-f="source">${Object.entries(SOURCES).map(([k, v]) => `<option value="${k}" ${x.source === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>Bintang</label><div class="star-pick" data-stars>${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" class="${n <= x.rating ? 'on' : ''}" aria-label="${n} bintang">★</button>`).join('')}</div></div>
        <div class="field"><label>Nama pengulas</label><input class="input" data-f="author" value="${esc(x.author || '')}" maxlength="80"></div>
        <div class="field"><label>Tanggal</label><input class="input" type="date" data-f="date" value="${toDateInput(x.date || Date.now())}"></div>
        ${S.state.locations.length > 1 ? `<div class="field full"><label>Lokasi</label><select class="input" data-f="locationId">${S.state.locations.map(l => `<option value="${l.id}" ${x.locationId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>` : ''}
        <div class="field full"><label>Isi ulasan</label><textarea class="input textarea" rows="4" data-f="text" maxlength="4000">${esc(x.text || '')}</textarea></div>
      </div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Simpan</button>`
  });
  let rating = x.rating || 5;
  m.el.querySelector('[data-stars]').onclick = (e) => {
    const b = e.target.closest('[data-star]'); if (!b) return;
    rating = Number(b.dataset.star);
    m.el.querySelectorAll('[data-star]').forEach(s => s.classList.toggle('on', Number(s.dataset.star) <= rating));
  };
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    await api.saveReview({ id: x.id, ...v, rating, locationId: v.locationId || x.locationId || null, date: v.date ? new Date(v.date + 'T12:00:00').getTime() : Date.now() });
    m.close(); toast(r ? 'Ulasan disimpan' : 'Ulasan dicatat');
  };
}

function replyReview(r) {
  const kind = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';
  const all = [...REPLY_TEMPLATES[kind], ...Object.entries(REPLY_TEMPLATES).filter(([k]) => k !== kind).flatMap(([, v]) => v)];
  const m = openModal({
    title: `Balas ulasan ${r.author || ''}`,
    wide: true,
    body: `
      <div class="rv-quote">${stars(r.rating)}<p>${esc(r.text || 'Tanpa teks')}</p></div>
      ${r.rating <= 3 ? `<div class="warning">${icon('lightbulb', 15)}<span>Untuk ulasan rendah: minta maaf tanpa membela diri, sebutkan perbaikannya, dan ajak lanjut di jalur pribadi. Jangan menyebut data pribadi pelanggan di balasan publik.</span></div>` : ''}
      <div class="field"><label>Pilih templat</label><select class="input" data-tpl><option value="">Tulis sendiri…</option>${all.map((t, i) => `<option value="${i}">${esc(t.slice(0, 90))}…</option>`).join('')}</select></div>
      <div class="field"><label>Balasan</label><textarea class="input textarea" rows="5" data-reply maxlength="4000">${esc(r.reply || fillReply(REPLY_TEMPLATES[kind][0], r))}</textarea></div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn" data-copy>${icon('copy', 15)}Simpan & salin</button><button class="btn primary" data-yes>Simpan balasan</button>`
  });
  m.el.querySelector('[data-tpl]').onchange = (e) => { if (e.target.value !== '') m.el.querySelector('[data-reply]').value = fillReply(all[Number(e.target.value)], r); };
  const save = async (copy) => {
    const reply = m.el.querySelector('[data-reply]').value.trim();
    await api.saveReview({ id: r.id, reply, replyPosted: false });
    if (copy && reply) { await api.copyText(reply); toast('Balasan disimpan dan disalin. Tempel di platformnya.'); }
    else toast('Balasan disimpan');
    m.close();
  };
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = () => save(false);
  m.el.querySelector('[data-copy]').onclick = () => save(true);
}

async function qrCard(loc) {
  const link = reviewLink(loc);
  const qr = await api.qrSvg(link, { margin: 1 });
  const m = openModal({
    title: `Kartu QR ulasan · ${loc.name || ''}`,
    body: `<div class="qr-preview"><div class="qr-big">${qr}</div><div><p>Cetak dan pasang di kasir, meja, atau tempel di kemasan pesanan. Pelanggan cukup memindai dengan kamera ponsel.</p>
      <div class="field"><label>Judul kartu</label><input class="input" data-h value="Bagaimana pengalamanmu?" maxlength="40"></div>
      <div class="field"><label>Kalimat ajakan</label><input class="input" data-s value="Ceritakan di Google. Ulasanmu membantu tetangga menemukan kami dan membantu kami jadi lebih baik." maxlength="120"></div></div></div>`,
    foot: `<button class="btn ghost" data-no>Tutup</button><button class="btn primary" data-pdf>${icon('printer', 15)}Simpan PDF untuk dicetak</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-pdf]').onclick = async () => {
    const html = reviewCards({ biz: S.state.business, loc, qr, link, headline: m.el.querySelector('[data-h]').value, subline: m.el.querySelector('[data-s]').value });
    const r = await api.savePdf({ html, fileName: `kartu-ulasan-${(loc.name || 'lokasi').toLowerCase().replace(/[^\w-]+/g, '-')}.pdf` });
    if (r.ok) toast('PDF disimpan (2 kartu A5 per halaman)');
  };
}

function askViaWhatsApp(loc) {
  const link = reviewLink(loc);
  const canSee = perm('customers.view');
  const list = canSee ? S.state.customers.filter(c => c.phone && hasConsent(c, 'review') && (!c.locationId || c.locationId === loc.id || S.state.locations.length === 1))
    .sort((a, b) => (b.lastVisitAt || 0) - (a.lastVisitAt || 0)) : [];
  const msgFor = (c) => askMsg().replace(/\{nama\}/g, String(c.name || '').split(/\s+/)[0] || 'Kak').replace(/\{usaha\}/g, S.state.business.name || 'kami').replace(/\{link\}/g, link);
  const m = openModal({
    title: 'Kirim permintaan ulasan',
    wide: true,
    body: !canSee ? `<p>Peranmu tidak mengizinkan melihat data pelanggan. Salin pesan ini dan kirim ke pelanggan secara langsung:</p><pre class="code selectable">${esc(msgFor({ name: '' }))}</pre>`
      : `<p>Pelanggan yang setuju diminta ulasan, diurutkan dari kunjungan terbaru. Tekan “Buka WhatsApp”, periksa pesannya, lalu kirim.</p>
        ${list.length ? `<div class="pick-list">${list.slice(0, 40).map(c => `
          <div class="pick-row"><div class="meta"><b>${esc(c.name)}</b><span>${esc(prettyPhone(c.phone))}${c.lastVisitAt ? ' · datang ' + esc(timeAgo(c.lastVisitAt)) : ''}${c.reviewAskedAt ? ' · terakhir diminta ' + esc(timeAgo(c.reviewAskedAt)) : ''}</span></div>
            <button class="btn sm ${c.reviewAskedAt && c.reviewAskedAt > (c.lastVisitAt || 0) ? '' : 'primary'}" data-send="${c.id}">${icon('message-circle', 14)}Buka WhatsApp</button></div>`).join('')}</div>`
        : `<div class="empty"><p>Belum ada pelanggan yang setuju diminta ulasan. Catat persetujuan di halaman Pelanggan.</p></div>`}`,
    foot: `<button class="btn ghost" data-copy>${icon('copy', 15)}Salin pesan umum</button><span style="flex:1"></span><button class="btn" data-no>Selesai</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-copy]').onclick = async () => { await api.copyText(msgFor({ name: '' })); toast('Pesan disalin'); };
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-send]'); if (!b) return;
    const c = S.state.customers.find(x => x.id === b.dataset.send); if (!c) return;
    emit('wa', { phone: c.phone, text: msgFor(c) });
    b.classList.remove('primary'); b.innerHTML = `${icon('check', 14)}Dibuka`;
    try { await api.saveCustomer({ id: c.id, reviewAskedAt: Date.now() }); } catch (_) {}
  });
}

function testimonial(r) {
  const initials = String(r.author || '').split(/\s+/).filter(Boolean).map((w, i) => i === 0 ? w : w[0] + '.').join(' ') || 'Pelanggan';
  const text = `“${r.text.trim()}”\n— ${initials}, ulasan ${'★'.repeat(r.rating)} di ${SOURCES[r.source] || 'Google'}\n\nTerima kasih untuk semua pelanggan ${S.state.business.name || 'kami'}! 🙏`;
  go({ name: 'compose', text, note: 'Ulasan publik boleh dikutip, tetapi sebaiknya tampilkan nama yang disingkat. Untuk ulasan dari chat pribadi, minta izin pelanggan dulu.' });
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b || !root.contains(b)) return;
  const ds = b.dataset;
  const rv = (id) => S.state.reviews.find(x => x.id === id);
  const loc = (id) => S.state.locations.find(x => x.id === id);
  if (ds.ext) return api.openExternal(ds.ext);
  if (ds.rvFilter) { filter = ds.rvFilter; return ctx.rerender(); }
  if ('rvNew' in ds) return editReview(null);
  if (ds.rvEdit) return editReview(rv(ds.rvEdit));
  if (ds.rvRm) { if (await confirmDialog({ title: 'Hapus catatan ulasan?', message: 'Hanya catatan di Serambi yang dihapus. Ulasan asli di platform tidak berubah.', confirm: 'Hapus', danger: true })) api.removeReview(ds.rvRm); return; }
  if (ds.rvReply) return replyReview(rv(ds.rvReply));
  if (ds.rvCopy) { await api.copyText(rv(ds.rvCopy).reply); return toast('Balasan disalin'); }
  if (ds.rvPosted) return api.saveReview({ id: ds.rvPosted, replyPosted: true });
  if (ds.rvTesti) return testimonial(rv(ds.rvTesti));
  if (ds.copyLink) { await api.copyText(reviewLink(loc(ds.copyLink))); return toast('Link ulasan disalin'); }
  if (ds.qr) return qrCard(loc(ds.qr));
  if (ds.waAsk) return askViaWhatsApp(loc(ds.waAsk));
  if (ds.setupLink || 'gotoLoc' in ds) return ctx.setTab('discover', 'locations');
}
function onChange(e) {
  if (e.target.matches('[data-loc-filter]')) { locFilter = e.target.value; ctx.rerender(); }
}
function onInput(e) {
  if (e.target.matches('[data-ask-msg]')) { try { localStorage.setItem('reviewMsg', e.target.value); } catch (_) {} }
}

export default {
  render,
  bind(el, c) { root = el; ctx = c; el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('input', onInput); },
  unbind() { if (!root) return; root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); root.removeEventListener('input', onInput); },
  isDirty() { return !!(root && root.contains(document.activeElement) && document.activeElement.matches('textarea')); }
};
