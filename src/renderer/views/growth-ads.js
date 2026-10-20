// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Iklan lokal — budget planner, campaigns with results, Google responsive search ads,
// Meta ad copy, local keywords, UTM links and QR codes. Ads are created in the official
// consoles; Serambi prepares the content and keeps the numbers.
import { icon } from '../icons.js';
import { esc, toast, openModal, confirmDialog, readForm, showMenu, csv, fmtDate, toDateInput, bar } from '../util.js';
import { S, api, perm, rupiah, fmtNum, pct } from '../ctx.js';
import { LIMITS, META_LIMITS, adLen, keywordIdeas, formatKeyword, NEGATIVE_DEFAULT, rsaDraft, rsaProblems, metaProblems, budgetPlan, utmUrl, editorCsv } from '../lib/ads.js';
import { reviewStats } from '../lib/score.js';

let root, ctx;

export const CHANNELS = {
  google: { name: 'Google Ads', icon: 'search', console: 'https://ads.google.com/' },
  meta: { name: 'Meta (Facebook & Instagram)', icon: 'target', console: 'https://adsmanager.facebook.com/' },
  tiktok: { name: 'TikTok Ads', icon: 'trending-up', console: 'https://ads.tiktok.com/' },
  marketplace: { name: 'Iklan marketplace', icon: 'shopping-bag', console: '' },
  offline: { name: 'Brosur / spanduk / offline', icon: 'printer', console: '' },
  other: { name: 'Lainnya', icon: 'megaphone', console: '' }
};
const OBJECTIVES = {
  calls: ['Panggilan telepon', 'Google Ads Penelusuran dengan aset telepon dan aset lokasi (tautkan Profil Bisnis Google). Tampilkan iklan hanya di jam buka.'],
  messages: ['Pesan WhatsApp', 'Iklan Meta yang membuka chat WhatsApp (klik ke WhatsApp), target radius sekitar toko. Siapkan balasan cepat di WhatsApp Business.'],
  visits: ['Kunjungan ke toko', 'Google Ads dengan aset lokasi agar muncul di Maps dan tombol petunjuk arah. Pilih radius 3–10 km dan opsi lokasi “orang di atau rutin berada di” area target.'],
  sales: ['Penjualan online', 'Iklan toko di marketplace (TopAds/Iklan Shopee) atau iklan Penelusuran ke link toko. Ukur dengan link UTM dan kode voucher khusus.'],
  awareness: ['Dikenal warga sekitar', 'Video pendek di Meta atau TikTok dengan target lokasi sempit. Ukur dari kenaikan pesan, kunjungan, dan pencarian nama usaha.']
};
const STATUS = { plan: ['Rencana', ''], live: ['Berjalan', 'scheduled'], done: ['Selesai', 'posted'] };

const canEdit = () => perm('growth.write');
function loadBudget() {
  const d = { daily: 50000, days: 30, cpc: 1500, conv: 6, aov: 75000, margin: 40 };
  try { return { ...d, ...JSON.parse(localStorage.getItem('adBudget') || '{}') }; } catch (_) { return d; }
}

function budgetSection() {
  const b = loadBudget();
  const r = budgetPlan({ daily: b.daily, days: b.days, cpc: b.cpc, conv: b.conv / 100, aov: b.aov, margin: b.margin / 100 });
  const good = r.leads > 0 && r.cpa < r.breakEvenCpa;
  const inp = (k, label, suffix, step, hint) => `<div class="field"><label>${label}</label><div class="input-affix"><input class="input" type="number" min="0" step="${step}" data-b="${k}" value="${esc(b[k])}">${suffix ? `<span>${suffix}</span>` : ''}</div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  return `
    <section class="g-section" id="gs-budget">
      <div class="g-head"><div><h2>Perencana anggaran iklan</h2><p>Hitung dulu sebelum membayar iklan: berapa klik, pembeli, dan laba yang masuk akal dari anggaranmu. Angka biaya per klik bisa dilihat di Perencana Kata Kunci Google.</p></div>
        <div class="g-acts"><button class="btn sm" data-ext="https://ads.google.com/aw/keywordplanner/home">${icon('external-link', 15)}Perencana Kata Kunci</button></div></div>
      <div class="panel form-panel budget">
        <div class="form-grid three">
          ${inp('daily', 'Anggaran per hari', 'Rp', 1000)}
          ${inp('days', 'Lama kampanye', 'hari', 1)}
          ${inp('cpc', 'Perkiraan biaya per klik', 'Rp', 100, 'Iklan lokal di kota kecil sering lebih murah.')}
          ${inp('conv', 'Klik yang jadi pembeli', '%', 0.5, 'Usaha lokal umumnya 2–10%.')}
          ${inp('aov', 'Rata-rata belanja per pembeli', 'Rp', 1000)}
          ${inp('margin', 'Margin kotor', '%', 1, 'Laba kotor dari tiap penjualan.')}
        </div>
        <div class="budget-out" data-budget-out>${budgetOut(r, good)}</div>
      </div>
    </section>`;
}
function budgetOut(r, good) {
  return `
    <div class="kpis small">
      <div class="kpi"><span>Total biaya</span><b>${rupiah(r.spend)}</b></div>
      <div class="kpi"><span>Perkiraan klik</span><b>${fmtNum(r.clicks)}</b></div>
      <div class="kpi"><span>Perkiraan pembeli</span><b>${fmtNum(r.leads)}</b></div>
      <div class="kpi"><span>Pendapatan</span><b>${rupiah(r.revenue)}</b></div>
      <div class="kpi"><span>Laba setelah iklan</span><b class="${r.profit >= 0 ? 'good' : 'warn'}">${rupiah(r.profit)}</b></div>
      <div class="kpi"><span>Biaya per pembeli</span><b>${rupiah(r.cpa)}</b><small>Batas impas ${rupiah(r.breakEvenCpa)}</small></div>
      <div class="kpi"><span>ROAS</span><b>${r.roas.toFixed(1).replace('.', ',')}×</b><small>Impas di ${r.breakEvenRoas.toFixed(1).replace('.', ',')}×</small></div>
    </div>
    <p class="verdict ${good ? 'good' : 'warn'}">${icon(good ? 'circle-check-big' : 'triangle-alert', 16)}${good
      ? 'Masuk akal: biaya per pembeli di bawah batas impas. Mulai kecil, ukur, lalu naikkan anggaran untuk iklan yang terbukti.'
      : 'Belum untung dengan angka ini. Turunkan biaya per klik (kata kunci lebih spesifik, radius lebih sempit), naikkan konversi (halaman/WhatsApp yang jelas), atau naikkan nilai belanja.'}</p>`;
}

function campaignCard(c) {
  const ch = CHANNELS[c.channel] || CHANNELS.other;
  const [sl, sc] = STATUS[c.status] || STATUS.plan;
  const cpa = c.leads ? c.spend / c.leads : null;
  const roas = c.spend ? (c.revenue || 0) / c.spend : null;
  const ctr = c.impressions ? (c.clicks || 0) / c.impressions : null;
  const loc = S.state.locations.find(l => l.id === c.locationId);
  return `
    <div class="panel camp-card">
      <div class="camp-top">${icon(ch.icon, 18)}<div class="meta"><b>${esc(c.name)}</b><span>${esc(ch.name)}${c.objective && OBJECTIVES[c.objective] ? ' · ' + esc(OBJECTIVES[c.objective][0]) : ''}${loc ? ' · ' + esc(loc.name) : ''}${c.radiusKm ? ` · ${c.radiusKm} km` : ''}</span></div>
        <span class="chip ${sc}">${sl}</span>
        ${canEdit() ? `<button class="icon-btn sm" data-camp-more="${c.id}" title="Pilihan">${icon('ellipsis', 16)}</button>` : ''}</div>
      <div class="camp-budget"><span>${rupiah(c.spend || 0)} dari ${rupiah(c.budget || 0)}</span>${bar(c.spend || 0, c.budget || 0, (c.spend || 0) > (c.budget || 0) ? 'low' : '')}
        <span class="faint">${c.startAt ? esc(fmtDate(c.startAt)) : '—'} – ${c.endAt ? esc(fmtDate(c.endAt)) : '—'}</span></div>
      <div class="camp-metrics">
        <span><b>${fmtNum(c.clicks || 0)}</b> klik${ctr !== null ? ` · CTR ${pct(ctr, 1)}` : ''}</span>
        <span><b>${fmtNum(c.leads || 0)}</b> prospek</span>
        <span>Biaya/prospek <b>${cpa !== null ? rupiah(cpa) : '—'}</b></span>
        <span>ROAS <b>${roas !== null ? roas.toFixed(1).replace('.', ',') + '×' : '—'}</b></span>
      </div>
      <div class="camp-btns">
        ${c.channel === 'google' || c.channel === 'meta' || c.channel === 'tiktok' ? `<button class="btn sm" data-camp-ads="${c.id}">${icon('pen-line', 14)}Iklan</button>` : ''}
        <button class="btn sm" data-camp-results="${c.id}">${icon('chart-column', 14)}Hasil</button>
        <button class="btn sm" data-camp-link="${c.id}">${icon('qr-code', 14)}Link & QR</button>
        ${ch.console ? `<button class="btn ghost sm" data-ext="${ch.console}">${icon('external-link', 14)}Konsol</button>` : ''}
      </div>
    </div>`;
}

function campaignsSection() {
  const list = [...S.state.campaigns].sort((a, b) => ({ live: 0, plan: 1, done: 2 }[a.status] - { live: 0, plan: 1, done: 2 }[b.status]) || (b.createdAt || 0) - (a.createdAt || 0));
  return `
    <section class="g-section" id="gs-campaigns">
      <div class="g-head"><div><h2>Kampanye</h2><p>Catat tiap kampanye: tujuan, anggaran, iklan, dan hasilnya. Dengan link UTM kamu tahu pembeli datang dari iklan mana.</p></div>
        <div class="g-acts">${canEdit() ? `<button class="btn primary sm" data-new-camp>${icon('plus', 15)}Kampanye baru</button>` : ''}</div></div>
      ${list.length ? `<div class="camp-grid">${list.map(campaignCard).join('')}</div>`
        : `<div class="empty"><p>Belum ada kampanye. Mulai dengan satu kampanye kecil, misalnya Google Ads Rp30.000/hari selama 2 minggu untuk radius 5 km.</p>${canEdit() ? `<button class="btn primary" data-new-camp>${icon('plus', 16)}Kampanye baru</button>` : ''}</div>`}
    </section>`;
}

function keywordsSection() {
  const b = S.state.business;
  const ideas = keywordIdeas({ services: b.services || [], city: b.city, areas: b.areas || [] });
  return `
    <section class="g-section" id="gs-keywords">
      <div class="g-head"><div><h2>Kata kunci lokal</h2><p>Ide kata kunci dari layanan dan area di profil bisnismu. Tanda kutip berarti <b>pencocokan frasa</b>, kurung siku berarti <b>pencocokan tepat</b>. Untuk iklan lokal dengan anggaran kecil, mulai dari frasa dan tepat.</p></div>
        <div class="g-acts">${ideas.length ? `<button class="btn sm" data-copy-kw>${icon('copy', 15)}Salin semua</button>` : ''}</div></div>
      ${ideas.length ? `
      <div class="panel kw-panel">
        <div class="kw-list">${ideas.map(k => `<span class="kw" title="${esc(k.why)}">${esc(formatKeyword(k))}</span>`).join('')}</div>
        <div class="kw-neg"><b>Kata kunci negatif yang disarankan</b><p class="hint">Mencegah iklan muncul untuk pencarian yang tidak akan membeli.</p>
          <div class="kw-list">${NEGATIVE_DEFAULT.map(k => `<span class="kw neg">-${esc(k)}</span>`).join('')}</div>
          <button class="btn ghost sm" data-copy-neg>${icon('copy', 14)}Salin negatif</button></div>
      </div>` : `<div class="empty"><p>Isi “Layanan/produk utama” dan kota di profil bisnis untuk mendapat ide kata kunci.</p><button class="btn" data-goto-profile>${icon('pencil', 15)}Isi profil bisnis</button></div>`}
    </section>`;
}

function tipsSection() {
  return `
    <section class="g-section" id="gs-tips">
      <div class="g-head"><div><h2>Prinsip iklan lokal yang hemat</h2></div></div>
      <div class="tips-grid">
        <div class="tip">${icon('map-pin', 18)}<b>Sempitkan lokasi</b><p>Pilih radius realistis (3–10 km) dan targetkan orang yang berada atau rutin berada di area itu, bukan sekadar “tertarik”.</p></div>
        <div class="tip">${icon('clock', 18)}<b>Ikuti jam buka</b><p>Jadwalkan iklan saat kamu bisa menjawab telepon dan WhatsApp. Iklan di luar jam buka sering terbuang.</p></div>
        <div class="tip">${icon('link-2', 18)}<b>Tautkan Profil Bisnis</b><p>Di Google Ads, tautkan Profil Bisnis Google sebagai aset lokasi supaya alamat dan petunjuk arah tampil.</p></div>
        <div class="tip">${icon('target', 18)}<b>Satu tujuan per kampanye</b><p>Panggilan, chat WhatsApp, kunjungan, atau penjualan online. Ukur satu angka utama.</p></div>
        <div class="tip">${icon('tag', 18)}<b>Kode voucher khusus</b><p>Pakai kode berbeda per iklan (misalnya SENJA-G untuk Google). Mudah menghitung pembeli dari tiap iklan.</p></div>
        <div class="tip">${icon('star', 18)}<b>Rapikan ulasan dulu</b><p>Iklan mengantar orang ke profilmu. Rating dan balasan ulasan yang baik membuat klik jadi pembeli.</p></div>
      </div>
    </section>`;
}

function render() {
  return `<div class="page growth-page">${budgetSection()}${campaignsSection()}${keywordsSection()}${tipsSection()}</div>`;
}

// ---------- campaign editor ----------
function editCampaign(c) {
  const x = c || { channel: 'google', objective: 'visits', status: 'plan', budget: 900000, radiusKm: 5, utm: {} };
  const locs = S.state.locations;
  const m = openModal({
    title: c ? `Ubah ${c.name}` : 'Kampanye baru',
    wide: true,
    body: `
      <div class="form-grid">
        <div class="field full"><label>Nama kampanye</label><input class="input" data-f="name" value="${esc(x.name || '')}" maxlength="100" placeholder="Misalnya: Kopi Pagi – Google – Okt"></div>
        <div class="field"><label>Saluran</label><select class="input" data-f="channel">${Object.entries(CHANNELS).map(([k, v]) => `<option value="${k}" ${x.channel === k ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Tujuan utama</label><select class="input" data-f="objective">${Object.entries(OBJECTIVES).map(([k, v]) => `<option value="${k}" ${x.objective === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}</select></div>
        <div class="full warning info" data-obj-tip>${icon('lightbulb', 15)}<span>${esc((OBJECTIVES[x.objective] || OBJECTIVES.visits)[1])}</span></div>
        <div class="field"><label>Lokasi</label><select class="input" data-f="locationId"><option value="">Semua lokasi</option>${locs.map(l => `<option value="${l.id}" ${x.locationId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Radius target</label><div class="input-affix"><input class="input" type="number" min="0" step="1" data-f="radiusKm" value="${esc(x.radiusKm || '')}"><span>km</span></div></div>
        <div class="field"><label>Mulai</label><input class="input" type="date" data-f="start" value="${x.startAt ? toDateInput(x.startAt) : ''}"></div>
        <div class="field"><label>Selesai</label><input class="input" type="date" data-f="end" value="${x.endAt ? toDateInput(x.endAt) : ''}"></div>
        <div class="field"><label>Anggaran total</label><div class="input-affix"><span>Rp</span><input class="input" type="number" min="0" step="1000" data-f="budget" value="${esc(x.budget || '')}"></div></div>
        <div class="field"><label>Halaman tujuan</label><input class="input" data-f="url" value="${esc(x.url || S.state.business.website || '')}" placeholder="https://…" maxlength="500"></div>
        <div class="field full"><label>Catatan</label><textarea class="input textarea" rows="2" data-f="notes" maxlength="2000" placeholder="Penawaran, kode voucher, target audiens">${esc(x.notes || '')}</textarea></div>
      </div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>${c ? 'Simpan' : 'Buat kampanye'}</button>`
  });
  m.el.querySelector('[data-f="objective"]').onchange = (e) => { m.el.querySelector('[data-obj-tip] span').textContent = OBJECTIVES[e.target.value][1]; };
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    if (!v.name.trim()) { toast('Isi nama kampanye', { kind: 'err' }); return; }
    const slug = v.name.trim().toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
    const utm = x.utm && x.utm.campaign ? x.utm : { source: v.channel === 'meta' ? 'facebook' : v.channel, medium: v.channel === 'offline' ? 'offline' : 'cpc', campaign: slug };
    await api.saveCampaign({
      id: x.id, name: v.name, channel: v.channel, objective: v.objective, locationId: v.locationId || null, radiusKm: v.radiusKm,
      startAt: v.start ? new Date(v.start + 'T00:00:00').getTime() : null, endAt: v.end ? new Date(v.end + 'T23:59:00').getTime() : null,
      budget: v.budget, url: v.url, notes: v.notes, utm
    });
    m.close();
    toast(c ? 'Kampanye disimpan' : 'Kampanye dibuat');
  };
}

function counterField(kind, i, val, max) {
  const n = adLen(val);
  return `<div class="ad-field"><input class="input" data-ad="${kind}" data-i="${i}" value="${esc(val || '')}" maxlength="${max + 10}" placeholder="${kind === 'h' ? `Judul ${i + 1}` : kind === 'd' ? `Deskripsi ${i + 1}` : `jalur${i + 1}`}"><span class="cnt ${n > max ? 'over' : ''}" data-cnt>${n}/${max}</span></div>`;
}

function editAds(c) {
  if (c.channel !== 'google') return editMetaAds(c);
  const loc = S.state.locations.find(l => l.id === c.locationId) || S.state.locations[0] || {};
  const rv = reviewStats(S.state.reviews);
  let ads = c.ads && c.ads.headlines && c.ads.headlines.length ? structuredClone(c.ads) : { headlines: [], descriptions: [], paths: [], keywords: [], negatives: [] };
  const m = openModal({
    title: `Iklan Penelusuran · ${c.name}`,
    xl: true,
    body: `
      <div class="ad-editor">
        <div class="ad-cols">
          <div>
            <div class="section-head"><h2>Judul <span class="faint">(3–15, maks. ${LIMITS.headline} karakter)</span></h2><button class="btn ghost sm" data-fill>${icon('sparkle', 14)}Isi draf otomatis</button></div>
            <div class="ad-grid" data-heads>${Array.from({ length: 15 }, (_, i) => counterField('h', i, ads.headlines[i], LIMITS.headline)).join('')}</div>
            <div class="section-head" style="margin-top:14px"><h2>Deskripsi <span class="faint">(2–4, maks. ${LIMITS.description})</span></h2></div>
            <div class="ad-grid one" data-descs>${Array.from({ length: 4 }, (_, i) => counterField('d', i, ads.descriptions[i], LIMITS.description)).join('')}</div>
            <div class="section-head" style="margin-top:14px"><h2>Jalur tampilan <span class="faint">(maks. ${LIMITS.path})</span></h2></div>
            <div class="ad-grid two">${Array.from({ length: 2 }, (_, i) => counterField('p', i, ads.paths[i], LIMITS.path)).join('')}</div>
            <div class="form-grid" style="margin-top:14px">
              <div class="field"><label>Kata kunci (satu per baris)</label><textarea class="input textarea" rows="6" data-kw>${esc((ads.keywords || []).join('\n'))}</textarea><button class="link" data-kw-fill>Isi dari ide kata kunci lokal</button></div>
              <div class="field"><label>Kata kunci negatif</label><textarea class="input textarea" rows="6" data-neg>${esc((ads.negatives && ads.negatives.length ? ads.negatives : NEGATIVE_DEFAULT).join('\n'))}</textarea></div>
            </div>
          </div>
          <aside class="ad-side">
            <h3>Pratinjau</h3>
            <div class="serp" data-preview></div>
            <h3>Pemeriksaan</h3>
            <div class="ad-problems" data-problems></div>
          </aside>
        </div>
      </div>`,
    foot: `<button class="btn ghost" data-csv>${icon('file-down', 15)}Ekspor CSV (Google Ads Editor)</button><button class="btn ghost" data-copy-all>${icon('copy', 15)}Salin semua</button><span style="flex:1"></span>
      <button class="btn ghost" data-ext="https://ads.google.com/">${icon('external-link', 15)}Buka Google Ads</button><button class="btn primary" data-save>${icon('check', 15)}Simpan iklan</button>`
  });
  const read = () => {
    const get = (k) => [...m.el.querySelectorAll(`[data-ad="${k}"]`)].map(i => i.value.trim()).filter(Boolean);
    return { headlines: get('h'), descriptions: get('d'), paths: get('p'),
      keywords: m.el.querySelector('[data-kw]').value.split('\n').map(x => x.trim()).filter(Boolean),
      negatives: m.el.querySelector('[data-neg]').value.split('\n').map(x => x.trim()).filter(Boolean) };
  };
  const refresh = () => {
    const a = read();
    const host = (() => { try { return new URL(c.url || S.state.business.website || 'https://contoh.id').hostname.replace(/^www\./, ''); } catch (_) { return 'contoh.id'; } })();
    m.el.querySelector('[data-preview]').innerHTML = `
      <span class="serp-sp">Bersponsor</span>
      <span class="serp-url">${esc(host)}${a.paths.map(p => ' › ' + esc(p)).join('')}</span>
      <span class="serp-h">${esc(a.headlines.slice(0, 3).join(' | ') || 'Judul iklan akan tampil di sini')}</span>
      <span class="serp-d">${esc(a.descriptions.slice(0, 2).join(' ') || 'Deskripsi iklan akan tampil di sini.')}</span>
      ${loc.address ? `<span class="serp-loc">${icon('map-pin', 12)}${esc(loc.address)}</span>` : ''}`;
    const probs = rsaProblems(a);
    m.el.querySelector('[data-problems]').innerHTML = probs.length
      ? probs.map(p => `<div class="prob ${p.level}">${icon(p.level === 'err' ? 'circle-x' : p.level === 'warn' ? 'triangle-alert' : 'lightbulb', 14)}<span>${esc(p.text)}</span></div>`).join('')
      : `<div class="prob ok">${icon('circle-check-big', 14)}<span>Siap dipakai di Google Ads.</span></div>`;
  };
  m.el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.ad) {
      const max = t.dataset.ad === 'h' ? LIMITS.headline : t.dataset.ad === 'd' ? LIMITS.description : LIMITS.path;
      const cnt = t.parentElement.querySelector('[data-cnt]');
      const n = adLen(t.value);
      cnt.textContent = `${n}/${max}`; cnt.classList.toggle('over', n > max);
    }
    refresh();
  });
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ext) return api.openExternal(b.dataset.ext);
    if ('fill' in b.dataset) {
      const draft = rsaDraft({ biz: S.state.business, loc, rating: rv.avg ? Math.round(rv.avg * 10) / 10 : null, offer: '' });
      const fillInto = (k, arr) => {
        const inputs = [...m.el.querySelectorAll(`[data-ad="${k}"]`)];
        const present = new Set(inputs.map(i => i.value.trim().toLowerCase()).filter(Boolean));
        const queue = arr.filter(x => !present.has(x.toLowerCase()));
        for (const inp of inputs) if (!inp.value.trim() && queue.length) inp.value = queue.shift();
      };
      fillInto('h', draft.headlines);
      fillInto('d', draft.descriptions);
      fillInto('p', draft.paths);
      m.el.querySelectorAll('[data-ad]').forEach(i => i.dispatchEvent(new Event('input', { bubbles: true })));
      toast('Draf diisi dari profil bisnis. Sesuaikan supaya terasa seperti usahamu.', { kind: 'info' });
    } else if ('kwFill' in b.dataset) {
      const b2 = S.state.business;
      m.el.querySelector('[data-kw]').value = keywordIdeas({ services: b2.services || [], city: b2.city, areas: b2.areas || [] }).slice(0, 20).map(formatKeyword).join('\n');
      refresh();
    } else if ('copyAll' in b.dataset) {
      const a = read();
      const text = `JUDUL\n${a.headlines.join('\n')}\n\nDESKRIPSI\n${a.descriptions.join('\n')}\n\nJALUR\n${a.paths.join(' / ')}\n\nKATA KUNCI\n${a.keywords.join('\n')}\n\nNEGATIF\n${a.negatives.map(k => '-' + k).join('\n')}`;
      await api.copyText(text); toast('Semua isi iklan disalin');
    } else if ('csv' in b.dataset) {
      const a = read();
      const rows = editorCsv(c.name, (S.state.business.services || [])[0] || 'Grup iklan 1', a, utmUrl(c.url, c.utm));
      const r = await api.saveFile({ content: csv(rows), fileName: `iklan-${c.name.replace(/[^\w-]+/g, '-').toLowerCase()}.csv`, kind: 'csv' });
      if (r.ok) toast('CSV disimpan. Impor lewat Google Ads Editor → Akun → Impor.');
    } else if ('save' in b.dataset) {
      await api.saveCampaign({ id: c.id, ads: { ...read(), meta: c.ads && c.ads.meta } });
      m.close(); toast('Iklan disimpan');
    }
  });
  refresh();
}

function editMetaAds(c) {
  const meta = (c.ads && c.ads.meta) || { primary: '', headline: '', description: '' };
  const name = c.channel === 'tiktok' ? 'TikTok' : 'Facebook & Instagram';
  const m = openModal({
    title: `Teks iklan ${name} · ${c.name}`,
    wide: true,
    body: `
      <div class="field"><label>Teks utama <span class="faint tnum" data-c="primary"></span></label><textarea class="input textarea" rows="4" data-m="primary" maxlength="600" placeholder="Kalimat pembuka yang menyebut area dan manfaat. Contoh: Warga Jakal, kopi susu gula aren hangat siap diantar 15 menit!">${esc(meta.primary)}</textarea>
        <span class="hint">Sekitar ${META_LIMITS.primary} karakter pertama yang terlihat di ponsel.</span></div>
      <div class="form-grid">
        <div class="field"><label>Judul <span class="faint tnum" data-c="headline"></span></label><input class="input" data-m="headline" value="${esc(meta.headline)}" maxlength="120"></div>
        <div class="field"><label>Deskripsi <span class="faint tnum" data-c="description"></span></label><input class="input" data-m="description" value="${esc(meta.description)}" maxlength="120"></div>
      </div>
      <div class="ad-problems" data-problems></div>
      <div class="warning info">${icon('lightbulb', 15)}<span>Untuk usaha lokal, pilih tujuan “Interaksi” dengan tujuan percakapan ke WhatsApp, lalu batasi lokasi ke radius sekitar tokomu.</span></div>`,
    foot: `<button class="btn ghost" data-copy-all>${icon('copy', 15)}Salin</button><span style="flex:1"></span><button class="btn ghost" data-ext="${CHANNELS[c.channel].console}">${icon('external-link', 15)}Buka konsol</button><button class="btn primary" data-save>Simpan</button>`
  });
  const read = () => Object.fromEntries([...m.el.querySelectorAll('[data-m]')].map(i => [i.dataset.m, i.value]));
  const refresh = () => {
    const v = read();
    for (const k of ['primary', 'headline', 'description']) m.el.querySelector(`[data-c="${k}"]`).textContent = `${Array.from(v[k] || '').length}/${META_LIMITS[k]}`;
    const probs = metaProblems(v);
    m.el.querySelector('[data-problems]').innerHTML = probs.map(p => `<div class="prob ${p.level}">${icon('triangle-alert', 14)}<span>${esc(p.text)}</span></div>`).join('');
  };
  m.el.addEventListener('input', refresh);
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ext) return api.openExternal(b.dataset.ext);
    if ('copyAll' in b.dataset) { const v = read(); await api.copyText(`${v.primary}\n\nJudul: ${v.headline}\nDeskripsi: ${v.description}`); toast('Teks iklan disalin'); }
    if ('save' in b.dataset) { await api.saveCampaign({ id: c.id, ads: { ...(c.ads || {}), meta: read() } }); m.close(); toast('Teks iklan disimpan'); }
  });
  refresh();
}

function editResults(c) {
  const m = openModal({
    title: `Hasil · ${c.name}`,
    body: `
      <p>Salin angka dari konsol iklan (atau hitung manual untuk iklan offline). Perbarui seminggu sekali.</p>
      <div class="form-grid">
        ${[['spend', 'Biaya terpakai', 'Rp'], ['impressions', 'Tayangan', ''], ['clicks', 'Klik', ''], ['leads', 'Prospek (chat, telepon, kunjungan)', ''], ['sales', 'Pembeli', ''], ['revenue', 'Pendapatan dari pembeli ini', 'Rp']]
          .map(([k, l, pre]) => `<div class="field"><label>${l}</label><div class="input-affix">${pre ? `<span>${pre}</span>` : ''}<input class="input" type="number" min="0" data-f="${k}" value="${esc(c[k] || '')}"></div></div>`).join('')}
        <div class="field"><label>Status</label><select class="input" data-f="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${c.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
      </div>
      <div class="kpis small" data-calc></div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Simpan hasil</button>`
  });
  const calc = () => {
    const v = readForm(m.el);
    const cpa = v.leads ? v.spend / v.leads : null, roas = v.spend ? v.revenue / v.spend : null, ctr = v.impressions ? v.clicks / v.impressions : null, cr = v.clicks ? v.leads / v.clicks : null;
    m.el.querySelector('[data-calc]').innerHTML = `
      <div class="kpi"><span>CTR</span><b>${ctr !== null ? pct(ctr, 1) : '—'}</b></div>
      <div class="kpi"><span>Klik → prospek</span><b>${cr !== null ? pct(cr, 1) : '—'}</b></div>
      <div class="kpi"><span>Biaya/prospek</span><b>${cpa !== null ? rupiah(cpa) : '—'}</b></div>
      <div class="kpi"><span>ROAS</span><b>${roas !== null ? roas.toFixed(1).replace('.', ',') + '×' : '—'}</b></div>`;
  };
  m.el.addEventListener('input', calc);
  calc();
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => { await api.saveCampaign({ id: c.id, ...readForm(m.el) }); m.close(); toast('Hasil disimpan'); };
}

async function linkAndQr(c) {
  const utm = c.utm || { source: c.channel, medium: 'cpc', campaign: c.name };
  const make = (u) => utmUrl(c.url || S.state.business.website || '', u);
  let url = make(utm);
  const m = openModal({
    title: `Link & QR · ${c.name}`,
    wide: true,
    body: `
      <p>Link dengan UTM memberi tahu Google Analytics atau toko onlinemu dari mana pengunjung datang. QR cocok untuk brosur, spanduk, dan meja kasir.</p>
      <div class="form-grid">
        <div class="field full"><label>Halaman tujuan</label><input class="input" data-u="url" value="${esc(c.url || S.state.business.website || '')}" placeholder="https://…"></div>
        <div class="field"><label>Sumber (utm_source)</label><input class="input" data-u="source" value="${esc(utm.source || '')}"></div>
        <div class="field"><label>Media (utm_medium)</label><input class="input" data-u="medium" value="${esc(utm.medium || '')}"></div>
        <div class="field"><label>Kampanye (utm_campaign)</label><input class="input" data-u="campaign" value="${esc(utm.campaign || '')}"></div>
        <div class="field"><label>Konten (utm_content, opsional)</label><input class="input" data-u="content" value="${esc(utm.content || '')}" placeholder="brosur_a5"></div>
      </div>
      <div class="utm-out"><div class="qr-box" data-qr></div><div><code class="selectable" data-url></code>
        <div class="row-btns"><button class="btn sm" data-copy>${icon('copy', 14)}Salin link</button></div></div></div>`,
    foot: `<button class="btn ghost" data-no>Tutup</button><button class="btn primary" data-yes>Simpan UTM</button>`
  });
  const refresh = async () => {
    const v = Object.fromEntries([...m.el.querySelectorAll('[data-u]')].map(i => [i.dataset.u, i.value]));
    url = utmUrl(v.url, v);
    m.el.querySelector('[data-url]').textContent = url || 'Isi halaman tujuan dulu';
    m.el.querySelector('[data-qr]').innerHTML = url ? await api.qrSvg(url, { margin: 1 }) : '';
  };
  m.el.addEventListener('input', refresh);
  refresh();
  m.el.querySelector('[data-copy]').onclick = async () => { if (url) { await api.copyText(url); toast('Link disalin'); } };
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = Object.fromEntries([...m.el.querySelectorAll('[data-u]')].map(i => [i.dataset.u, i.value]));
    if (!canEdit()) { m.close(); return; }
    await api.saveCampaign({ id: c.id, url: v.url, utm: { source: v.source, medium: v.medium, campaign: v.campaign, content: v.content } });
    m.close(); toast('UTM disimpan');
  };
}

function campMenu(anchor, c) {
  showMenu(anchor, [
    { label: 'Ubah kampanye', icon: 'pencil', onClick: () => editCampaign(c) },
    ...(c.status !== 'live' ? [{ label: 'Tandai berjalan', icon: 'circle-dot', onClick: () => api.saveCampaign({ id: c.id, status: 'live' }) }] : []),
    ...(c.status !== 'done' ? [{ label: 'Tandai selesai', icon: 'check', onClick: () => api.saveCampaign({ id: c.id, status: 'done' }) }] : []),
    'sep',
    { label: 'Hapus', icon: 'trash-2', danger: true, onClick: async () => { if (await confirmDialog({ title: `Hapus ${c.name}?`, message: 'Data kampanye, iklan, dan hasilnya dihapus dari Serambi. Kampanye di konsol iklan tidak terpengaruh.', confirm: 'Hapus', danger: true })) api.removeCampaign(c.id); } }
  ]);
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b || !root.contains(b)) return;
  const ds = b.dataset;
  const camp = (id) => S.state.campaigns.find(x => x.id === id);
  if (ds.ext) return api.openExternal(ds.ext);
  if ('newCamp' in ds) return editCampaign(null);
  if (ds.campMore) return campMenu(b, camp(ds.campMore));
  if (ds.campAds) return editAds(camp(ds.campAds));
  if (ds.campResults) return editResults(camp(ds.campResults));
  if (ds.campLink) return linkAndQr(camp(ds.campLink));
  if ('gotoProfile' in ds) return ctx.setTab('discover', 'profile');
  if ('copyKw' in ds) {
    const b2 = S.state.business;
    await api.copyText(keywordIdeas({ services: b2.services || [], city: b2.city, areas: b2.areas || [] }).map(formatKeyword).join('\n'));
    return toast('Kata kunci disalin. Tempel di Google Ads.');
  }
  if ('copyNeg' in ds) { await api.copyText(NEGATIVE_DEFAULT.join('\n')); return toast('Kata kunci negatif disalin'); }
}
function onInput(e) {
  const t = e.target;
  if (!t.dataset.b) return;
  const b = loadBudget();
  b[t.dataset.b] = Number(t.value) || 0;
  try { localStorage.setItem('adBudget', JSON.stringify(b)); } catch (_) {}
  const r = budgetPlan({ daily: b.daily, days: b.days, cpc: b.cpc, conv: b.conv / 100, aov: b.aov, margin: b.margin / 100 });
  root.querySelector('[data-budget-out]').innerHTML = budgetOut(r, r.leads > 0 && r.cpa < r.breakEvenCpa);
}

export default {
  render,
  bind(el, c) { root = el; ctx = c; el.addEventListener('click', onClick); el.addEventListener('input', onInput); },
  unbind() { if (!root) return; root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); },
  isDirty() { return !!(root && root.contains(document.activeElement) && document.activeElement.matches('input, textarea, select')); }
};
