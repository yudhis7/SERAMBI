// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Ditemukan di sekitar — business profile, locations, Google Business Profile checklist,
// NAP consistency, and the local SEO checker.
import { icon } from '../icons.js';
import { esc, toast, openModal, confirmDialog, ring, bar, readForm, charLen, fmtDateTime } from '../util.js';
import { S, api, perm, prettyPhone, reviewLink } from '../ctx.js';
import { GBP_ITEMS, LISTING_SOURCES, locationGbpPct, napStats } from '../lib/score.js';
import { analyse, schemaFor } from '../lib/seo.js';

let root, ctx, dirty = false, selLoc = null, seoState = null; // seoState: { url, loading, result, error, locId }

export const CATEGORIES = ['Kedai kopi', 'Rumah makan', 'Toko kue & roti', 'Katering', 'Laundry', 'Salon kecantikan', 'Barbershop', 'Bengkel motor', 'Bengkel mobil', 'Klinik gigi', 'Klinik kecantikan', 'Apotek', 'Toko pakaian', 'Toko bangunan', 'Jasa servis AC', 'Percetakan & fotokopi', 'Toko kelontong', 'Penginapan', 'Pusat kebugaran', 'Lembaga kursus', 'Toko online'];
const PLACE_ID_FINDER = 'https://developers.google.com/maps/documentation/places/web-service/place-id';

const canEdit = () => perm('growth.write');
const locs = () => S.state.locations;
const curLoc = () => locs().find(l => l.id === selLoc) || locs()[0] || null;

function locPicker(name) {
  const list = locs();
  if (list.length < 2) return '';
  const cur = curLoc();
  return `<select class="input sm-input" data-locpick="${name}" aria-label="Pilih lokasi">${list.map(l => `<option value="${l.id}" ${cur && cur.id === l.id ? 'selected' : ''}>${esc(l.name || 'Lokasi')}</option>`).join('')}</select>`;
}

function profileSection() {
  const b = S.state.business;
  const ro = canEdit() ? '' : 'disabled';
  const f = (key, label, val, { type = 'text', ph = '', hint = '', list = '', full = false, max = 120 } = {}) => `
    <div class="field ${full ? 'full' : ''}"><label for="bz-${key}">${label}</label>
      <input id="bz-${key}" class="input" data-f="${key}" type="${type}" value="${esc(val || '')}" placeholder="${esc(ph)}" maxlength="${max}" ${list ? `list="${list}"` : ''} ${ro}>
      ${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const desc = b.description || '';
  return `
    <section class="g-section" id="gs-profile">
      <div class="g-head"><div><h2>Profil bisnis</h2><p>Data utama usahamu. Dipakai untuk draf deskripsi Profil Bisnis Google, kode schema situs, pemeriksaan SEO, draf iklan, dan pesan ke pelanggan.</p></div></div>
      <div class="panel form-panel" data-profile>
        <div class="form-grid">
          ${f('name', 'Nama usaha', b.name, { ph: 'Misalnya: Kopi Senja', max: 80 })}
          ${f('category', 'Kategori utama', b.category, { ph: 'Misalnya: Kedai kopi', list: 'cat-list', hint: 'Samakan dengan kategori utama di Profil Bisnis Google.', max: 80 })}
          ${f('city', 'Kota/kabupaten', b.city, { ph: 'Misalnya: Sleman', max: 60 })}
          ${f('areas', 'Area layanan', (b.areas || []).join(', '), { ph: 'Depok, Ngaglik, Mlati', hint: 'Pisahkan dengan koma.', max: 400 })}
          ${f('whatsapp', 'Nomor WhatsApp', b.whatsapp ? prettyPhone(b.whatsapp) : '', { type: 'tel', ph: '0812-3456-7890', max: 30 })}
          ${f('phone', 'Telepon lain (opsional)', b.phone, { type: 'tel', ph: '(0274) 123456', max: 30 })}
          ${f('email', 'Email', b.email, { type: 'email', ph: 'halo@usahamu.id' })}
          ${f('website', 'Situs web atau link toko', b.website, { type: 'url', ph: 'https://…', max: 300 })}
          ${f('hours', 'Jam buka', b.hours, { ph: 'Senin–Sabtu 08.00–20.00, Minggu tutup', max: 300 })}
          ${f('priceRange', 'Kisaran harga', b.priceRange, { ph: 'Rp15.000–Rp50.000', max: 30 })}
          ${f('services', 'Layanan/produk utama', (b.services || []).join(', '), { full: true, ph: 'kopi susu gula aren, roti bakar, tempat nongkrong', hint: 'Tulis dengan kata yang dipakai pelanggan saat mencari. Pisahkan dengan koma.', max: 1200 })}
          ${f('keywords', 'Kata kunci tambahan', (b.keywords || []).join(', '), { full: true, ph: 'wifi kencang, dekat kampus, ramah keluarga', max: 1200 })}
          <div class="field full"><label for="bz-description">Deskripsi usaha <span class="faint tnum" data-desc-count>${charLen(desc)}/750</span></label>
            <textarea id="bz-description" class="input textarea" data-f="description" rows="4" maxlength="750" placeholder="Apa yang kamu jual, untuk siapa, di mana, dan apa yang membuatnya berbeda." ${ro}>${esc(desc)}</textarea>
            <span class="hint">Profil Bisnis Google menerima maksimal 750 karakter. Jangan isi link atau promo harga di deskripsi.</span></div>
        </div>
        <datalist id="cat-list">${CATEGORIES.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        ${canEdit() ? `<div class="form-foot">
          <button class="btn ghost sm" data-draft-desc>${icon('sparkle', 15)}Buat draf deskripsi</button>
          <button class="btn ghost sm" data-copy-desc>${icon('copy', 15)}Salin deskripsi</button>
          <span class="grow"></span>
          <span class="hint" data-save-hint>${dirty ? 'Ada perubahan yang belum disimpan' : ''}</span>
          <button class="btn primary" data-save-profile ${dirty ? '' : 'disabled'}>${icon('check', 16)}Simpan profil</button>
        </div>` : ''}
      </div>
    </section>`;
}

function locationsSection() {
  const list = locs();
  const pl = S.state.plan;
  return `
    <section class="g-section" id="gs-locations">
      <div class="g-head"><div><h2>Lokasi & cabang</h2><p>Tiap lokasi punya Profil Bisnis Google, link ulasan, dan pemeriksaannya sendiri.</p></div>
        <div class="g-acts"><span class="faint">${list.length}/${pl.locations} lokasi di paket ${esc(pl.name || '')}</span>
        ${canEdit() ? `<button class="btn sm" data-add-loc ${list.length >= pl.locations ? 'disabled' : ''}>${icon('plus', 15)}Tambah lokasi</button>` : ''}</div></div>
      ${list.length ? `<div class="loc-grid">${list.map(l => {
        const g = Math.round(locationGbpPct(l) * 100);
        const link = reviewLink(l);
        return `<div class="panel loc-card">
          <div class="loc-top">${icon('map-pin', 18)}<b>${esc(l.name || 'Lokasi')}</b><span class="grow"></span>
            ${canEdit() ? `<button class="icon-btn sm" data-edit-loc="${l.id}" title="Ubah">${icon('pencil', 15)}</button><button class="icon-btn sm" data-rm-loc="${l.id}" title="Hapus">${icon('trash-2', 15)}</button>` : ''}</div>
          <p class="loc-addr">${esc([l.address, l.city].filter(Boolean).join(', ') || 'Alamat belum diisi')}</p>
          <div class="loc-stats">
            <span class="${link ? 'ok' : 'no'}">${icon(link ? 'circle-check-big' : 'circle-alert', 14)}${link ? 'Link ulasan siap' : 'Link ulasan belum ada'}</span>
            <span>${icon('list-checks', 14)}Profil Google ${g}%</span>
            <span>${icon('gauge', 14)}SEO ${l.seo ? l.seo.score : '—'}</span>
          </div>
          ${l.mapsUrl ? `<button class="link" data-ext="${esc(l.mapsUrl)}">${icon('external-link', 13, 'inline')}Buka di Google Maps</button>` : ''}
        </div>`;
      }).join('')}</div>` : `<div class="empty"><p>Tambahkan lokasi usaha (atau satu lokasi utama bila tidak punya toko fisik).</p>${canEdit() ? `<button class="btn primary" data-add-loc>${icon('plus', 16)}Tambah lokasi</button>` : ''}</div>`}
    </section>`;
}

function gbpSection() {
  const l = curLoc();
  if (!l) return '';
  const g = l.gbp || {};
  const pctDone = locationGbpPct(l);
  return `
    <section class="g-section" id="gs-gbp">
      <div class="g-head"><div><h2>Daftar periksa Profil Bisnis Google</h2><p>Profil Bisnis Google adalah sumber utama pelanggan menemukan usaha lokal di Penelusuran dan Maps. Periksa tiap butir di konsol resminya, lalu centang di sini.</p></div>
        <div class="g-acts">${locPicker('gbp')}<button class="btn sm" data-ext="https://business.google.com/">${icon('external-link', 15)}Buka Profil Bisnis Google</button></div></div>
      <div class="panel">
        <div class="check-progress">${bar(pctDone * 100, 100, pctDone >= .75 ? 'good' : pctDone >= .4 ? 'mid' : 'low')}<b class="tnum">${GBP_ITEMS.filter(([k]) => g[k]).length}/${GBP_ITEMS.length}</b></div>
        <div class="checklist">${GBP_ITEMS.map(([k, label, tip]) => `
          <label class="check-row ${g[k] ? 'done' : ''}">
            <input type="checkbox" data-gbp="${k}" ${g[k] ? 'checked' : ''} ${canEdit() ? '' : 'disabled'}>
            <span class="box">${icon('check', 13)}</span>
            <span class="meta"><b>${esc(label)}</b><span>${esc(tip)}</span></span>
          </label>`).join('')}</div>
      </div>
    </section>`;
}

function napSection() {
  const l = curLoc();
  if (!l) return '';
  const st = napStats(S.state.business, l);
  const mark = (v) => v === null ? '<span class="faint">—</span>' : v ? `<span class="ok">${icon('check', 14)}</span>` : `<span class="no">${icon('x', 14)}</span>`;
  const m = st.master;
  return `
    <section class="g-section" id="gs-nap">
      <div class="g-head"><div><h2>Nama, alamat & nomor seragam</h2><p>Google dan pelanggan lebih percaya bila nama, alamat, dan nomor (NAP) usahamu sama persis di semua platform. Salin dari tiap platform lalu bandingkan di sini.</p></div>
        <div class="g-acts">${locPicker('nap')}${st.ratio !== null ? `<span class="chip ${st.ratio >= .9 ? 'posted' : 'due'}">${Math.round(st.ratio * 100)}% cocok</span>` : ''}</div></div>
      <div class="panel table-wrap">
        <table class="table">
          <thead><tr><th>Sumber</th><th>Nama</th><th>Alamat</th><th>Nomor</th><th></th></tr></thead>
          <tbody>
            <tr class="master"><td><b>Data utama</b><span class="hint">dari profil & lokasi</span></td><td>${esc(m.name || '—')}</td><td>${esc(m.address || '—')}</td><td>${esc(prettyPhone(m.phone) || '—')}</td><td></td></tr>
            ${LISTING_SOURCES.map(([k, label]) => {
              const row = st.rows.find(r => r.key === k);
              const li = (l.listings || {})[k];
              return `<tr><td>${esc(label)}</td>
                ${row ? `<td>${mark(row.cmp.name)} ${esc(li.name || '')}</td><td>${mark(row.cmp.address)} ${esc(li.address || '')}</td><td>${mark(row.cmp.phone)} ${esc(li.phone || '')}</td>` : '<td colspan="3" class="faint">Belum diisi</td>'}
                <td>${canEdit() ? `<button class="btn ghost sm" data-nap="${k}">${row ? 'Ubah' : 'Isi'}</button>` : ''}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}

function seoSection() {
  const l = curLoc();
  const s = seoState || {};
  const url = s.url || S.state.business.website || '';
  let results = '';
  if (s.loading) results = `<div class="seo-loading">${icon('refresh-cw', 18)}Memeriksa ${esc(url)}…</div>`;
  else if (s.error) results = `<div class="warning">${icon('circle-alert', 15)}<span>${esc(s.error)}</span></div>`;
  else if (s.result) {
    const r = s.result;
    const fails = r.checks.filter(c => !c.ok).sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.level] - { high: 0, mid: 1, low: 2 }[b.level]));
    const passes = r.checks.filter(c => c.ok);
    results = `
      <div class="seo-summary">${ring(r.score, 92)}
        <div><b>${r.score >= 80 ? 'Siap untuk pencarian lokal' : r.score >= 55 ? 'Cukup, masih bisa ditingkatkan' : 'Perlu banyak perbaikan'}</b>
          <p>${fails.length} perbaikan · ${passes.length} sudah baik · diperiksa ${esc(fmtDateTime(Date.now()))}</p>
          ${r.title ? `<p class="faint">Judul: “${esc(r.title)}”</p>` : ''}</div></div>
      ${fails.length ? `<h3 class="sub-h">Perlu diperbaiki</h3><div class="seo-list">${fails.map(c => `
        <details class="seo-item ${c.level}"><summary><span class="lvl">${c.level === 'high' ? 'Penting' : c.level === 'mid' ? 'Sedang' : 'Ringan'}</span><b>${esc(c.label)}</b>${icon('chevron-down', 15)}</summary>
          <p>${esc(c.fix)}</p>${c.detail ? `<p class="faint">Sekarang: “${esc(c.detail)}”</p>` : ''}</details>`).join('')}</div>` : ''}
      <details class="seo-pass"><summary>${passes.length} pemeriksaan sudah baik ${icon('chevron-down', 15)}</summary>
        <ul>${passes.map(c => `<li>${icon('check', 13, 'inline')}${esc(c.label)}</li>`).join('')}</ul></details>`;
  } else if (l && l.seo) {
    results = `<p class="hint">Pemeriksaan terakhir untuk ${esc(l.name || 'lokasi ini')}: skor <b>${l.seo.score}</b> (${esc(fmtDateTime(l.seo.checkedAt))}). Periksa lagi setelah memperbaiki situs.</p>`;
  }
  return `
    <section class="g-section" id="gs-seo">
      <div class="g-head"><div><h2>Pemeriksa SEO lokal</h2><p>Memeriksa halaman situsmu: judul, deskripsi, tampilan ponsel, data terstruktur LocalBusiness, nomor dan kota, peta, kecepatan, dan lainnya. Halaman dibaca sekali; tidak ada data yang dikirim ke tempat lain.</p></div>
        <div class="g-acts">${locPicker('seo')}</div></div>
      <div class="panel form-panel">
        <div class="seo-form">
          <input class="input" data-seo-url type="url" value="${esc(url)}" placeholder="https://usahamu.id" aria-label="Alamat situs">
          <button class="btn primary" data-seo-run ${s.loading ? 'disabled' : ''}>${icon('search', 16)}Periksa</button>
          <button class="btn" data-schema>${icon('file-text', 16)}Buat kode schema</button>
        </div>
        ${results}
      </div>
      <p class="hint">Setelah memperbaiki, minta Google memeriksa ulang lewat <button class="link" data-ext="https://search.google.com/search-console">Google Search Console</button>.</p>
    </section>`;
}

function render() {
  return `<div class="page growth-page">${profileSection()}${locationsSection()}${gbpSection()}${napSection()}${seoSection()}</div>`;
}

// ---------- actions ----------
async function saveProfile() {
  const form = root.querySelector('[data-profile]');
  const v = readForm(form);
  await api.saveBusiness(v);
  dirty = false;
  toast('Profil bisnis disimpan');
  ctx.rerender();
}

function draftDescription() {
  const v = readForm(root.querySelector('[data-profile]'));
  const services = String(v.services || '').split(',').map(x => x.trim()).filter(Boolean);
  const areas = String(v.areas || '').split(',').map(x => x.trim()).filter(Boolean);
  const parts = [];
  parts.push(`${v.name || 'Kami'} adalah ${String(v.category || 'usaha lokal').toLowerCase()} di ${v.city || 'kota kami'}${areas.length ? ` yang melayani ${areas.slice(0, 4).join(', ')}` : ''}.`);
  if (services.length) parts.push(`Kami menyediakan ${services.slice(0, 6).join(', ')}.`);
  const kw = String(v.keywords || '').split(',').map(x => x.trim()).filter(Boolean);
  if (kw.length) parts.push(`Pelanggan menyukai kami karena ${kw.slice(0, 3).join(', ')}.`);
  if (v.hours) parts.push(`Buka ${v.hours}.`);
  parts.push(v.whatsapp ? 'Pesan atau tanya dulu lewat WhatsApp, kami siap membantu.' : 'Kunjungi kami atau hubungi kami untuk pemesanan.');
  const text = parts.join(' ').slice(0, 750);
  const ta = root.querySelector('[data-f="description"]');
  ta.value = text;
  markDirty();
  updateDescCount();
  toast('Draf deskripsi dibuat. Sesuaikan dengan gayamu.', { kind: 'info' });
}
function updateDescCount() {
  const ta = root.querySelector('[data-f="description"]');
  const c = root.querySelector('[data-desc-count]');
  if (ta && c) c.textContent = `${charLen(ta.value)}/750`;
}
function markDirty() {
  dirty = true;
  const b = root.querySelector('[data-save-profile]'); if (b) b.disabled = false;
  const h = root.querySelector('[data-save-hint]'); if (h) h.textContent = 'Ada perubahan yang belum disimpan';
}

function editLocation(loc) {
  const l = loc || {};
  const m = openModal({
    title: loc ? `Ubah ${l.name || 'lokasi'}` : 'Tambah lokasi',
    wide: true,
    body: `
      <div class="form-grid">
        <div class="field"><label>Nama lokasi/cabang</label><input class="input" data-f="name" value="${esc(l.name || S.state.business.name || '')}" maxlength="80" placeholder="Misalnya: Cabang Jakal"></div>
        <div class="field"><label>Kota</label><input class="input" data-f="city" value="${esc(l.city || S.state.business.city || '')}" maxlength="60"></div>
        <div class="field full"><label>Alamat lengkap</label><input class="input" data-f="address" value="${esc(l.address || '')}" maxlength="300" placeholder="Jl. Kaliurang Km 5 No. 12, Caturtunggal, Depok"></div>
        <div class="field"><label>Telepon/WhatsApp lokasi</label><input class="input" data-f="phone" value="${esc(l.phone ? prettyPhone(l.phone) : '')}" maxlength="30"></div>
        <div class="field"><label>Jam buka</label><input class="input" data-f="hours" value="${esc(l.hours || S.state.business.hours || '')}" maxlength="300"></div>
        <div class="field full"><label>Link Google Maps</label><input class="input" data-f="mapsUrl" value="${esc(l.mapsUrl || '')}" placeholder="https://maps.app.goo.gl/…" maxlength="500"></div>
        <div class="field"><label>Place ID Google</label><input class="input" data-f="placeId" value="${esc(l.placeId || '')}" placeholder="ChIJ…" maxlength="200" spellcheck="false">
          <span class="hint">Cari di <button class="link" data-ext="${PLACE_ID_FINDER}">Place ID Finder Google</button>. Dipakai untuk link ulasan.</span></div>
        <div class="field"><label>Link ulasan (opsional)</label><input class="input" data-f="reviewUrl" value="${esc(l.reviewUrl || '')}" placeholder="https://g.page/r/…/review" maxlength="500">
          <span class="hint">Atau salin dari “Bagikan formulir ulasan” di Profil Bisnis Google.</span></div>
      </div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>${loc ? 'Simpan' : 'Tambah lokasi'}</button>`
  });
  m.el.addEventListener('click', (e) => { const x = e.target.closest('[data-ext]'); if (x) api.openExternal(x.dataset.ext); });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    try {
      const saved = await api.saveLocation({ id: l.id, ...v });
      selLoc = saved.id;
      m.close();
      toast(loc ? 'Lokasi disimpan' : 'Lokasi ditambahkan');
    } catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
  };
}

function editListing(key) {
  const l = curLoc();
  if (!l) return;
  const label = (LISTING_SOURCES.find(x => x[0] === key) || [])[1] || key;
  const li = (l.listings || {})[key] || {};
  const m = openModal({
    title: `Data di ${label}`,
    body: `<p>Salin persis seperti yang tertulis di ${esc(label)}, termasuk singkatan dan tanda baca.</p>
      <div class="field"><label>Nama</label><input class="input" data-f="name" value="${esc(li.name || '')}" maxlength="120"></div>
      <div class="field"><label>Alamat</label><input class="input" data-f="address" value="${esc(li.address || '')}" maxlength="300"></div>
      <div class="field"><label>Nomor</label><input class="input" data-f="phone" value="${esc(li.phone || '')}" maxlength="40"></div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Simpan</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    await api.saveLocation({ id: l.id, listings: { [key]: readForm(m.el) } });
    m.close();
  };
}

async function runSeo() {
  const url = root.querySelector('[data-seo-url]').value.trim();
  if (!url) { toast('Isi alamat situs dulu', { kind: 'err' }); return; }
  const l = curLoc();
  seoState = { url, loading: true, locId: l && l.id };
  ctx.rerender();
  const res = await api.fetchPage(url);
  if (!res.ok && !res.html) { seoState = { url, error: res.error || 'Situs tidak bisa diperiksa.' }; ctx.rerender(); return; }
  const result = analyse(res, S.state.business, l || {});
  seoState = { url, result, locId: l && l.id };
  if (l && canEdit()) {
    await api.saveLocation({ id: l.id, seo: { url: res.url, score: result.score, issues: result.checks.map(c => ({ id: c.id, ok: c.ok, label: c.label, level: c.level })) } });
  } else ctx.rerender();
}

function showSchema() {
  const l = curLoc() || {};
  const sameAs = S.state.accounts.map(a => a.shopUrl).filter(Boolean);
  const code = schemaFor(S.state.business, l, sameAs);
  const m = openModal({
    title: 'Kode schema LocalBusiness',
    wide: true,
    body: `<p>Tempel kode ini di bagian <code>&lt;head&gt;</code> situsmu (di WordPress bisa lewat plugin “header & footer”). Google memakainya untuk memahami nama, alamat, nomor, dan jam bukamu.</p>
      <pre class="code selectable">${esc(code)}</pre>
      <p class="hint">Uji hasilnya di <button class="link" data-ext="https://search.google.com/test/rich-results">Pengujian Hasil Kaya Google</button>.</p>`,
    foot: `<button class="btn" data-copy>${icon('copy', 15)}Salin kode</button><button class="btn primary" data-ok>Selesai</button>`
  });
  m.el.addEventListener('click', (e) => { const x = e.target.closest('[data-ext]'); if (x) api.openExternal(x.dataset.ext); });
  m.el.querySelector('[data-copy]').onclick = async () => { await api.copyText(code); toast('Kode disalin'); };
  m.el.querySelector('[data-ok]').onclick = () => m.close();
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b || !root.contains(b)) return;
  const ds = b.dataset;
  if (ds.ext) return api.openExternal(ds.ext);
  if ('saveProfile' in ds) return saveProfile();
  if ('draftDesc' in ds) return draftDescription();
  if ('copyDesc' in ds) { const t = root.querySelector('[data-f="description"]').value; if (!t.trim()) return toast('Deskripsi masih kosong', { kind: 'info' }); await api.copyText(t); return toast('Deskripsi disalin. Tempel di Profil Bisnis Google.'); }
  if ('addLoc' in ds) return editLocation(null);
  if (ds.editLoc) return editLocation(locs().find(l => l.id === ds.editLoc));
  if (ds.rmLoc) {
    const l = locs().find(x => x.id === ds.rmLoc);
    const ok = await confirmDialog({ title: `Hapus ${l.name || 'lokasi'}?`, message: 'Data lokasi, daftar periksa, dan hasil pemeriksaan untuk lokasi ini dihapus dari Serambi.', confirm: 'Hapus', danger: true });
    if (ok) await api.removeLocation(l.id);
    return;
  }
  if (ds.nap) return editListing(ds.nap);
  if ('seoRun' in ds) return runSeo();
  if ('schema' in ds) return showSchema();
}
async function onChange(e) {
  const t = e.target;
  if (t.dataset.gbp) {
    const l = curLoc(); if (!l) return;
    await api.saveLocation({ id: l.id, gbp: { [t.dataset.gbp]: t.checked } });
  } else if (t.dataset.locpick) {
    selLoc = t.value; seoState = null; ctx.rerender();
  }
}
function onInput(e) {
  if (e.target.closest('[data-profile]') && e.target.dataset.f) { markDirty(); if (e.target.dataset.f === 'description') updateDescCount(); }
}
function onKey(e) { if (e.key === 'Enter' && e.target.matches('[data-seo-url]')) runSeo(); }

export default {
  render,
  bind(el, c) {
    root = el; ctx = c;
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKey);
  },
  unbind() {
    if (!root) return;
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKey);
    dirty = false;
  },
  isDirty() { return dirty || !!(seoState && seoState.loading) || (root && root.contains(document.activeElement) && document.activeElement.matches('input, textarea, select')); }
};
