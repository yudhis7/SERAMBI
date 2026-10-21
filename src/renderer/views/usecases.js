// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Contoh penggunaan — ready-made playbooks of fictional local businesses that users and
// prospective users can follow, and apply to their own Serambi in one click.
import { LOGO_MARK } from '../lib/logo-data.js';
import { icon } from '../icons.js';
import { esc, toast, confirmDialog } from '../util.js';
import { S, api, go, perm, tileForPlatform, planBadge } from '../ctx.js';
import { USE_CASES, TIERS } from '../data/usecases.js';
import { RECIPES } from './growth-automate.js';

let root, tb, tier = 'all', openId = null;

function card(u) {
  const applied = (S.state.settings.appliedUseCases || []).includes(u.id);
  return `
    <button class="uc-card" data-uc="${u.id}">
      <span class="uc-ic">${icon(u.icon, 22)}</span>
      <span class="uc-meta"><b>${esc(u.name)}</b><span>${esc(u.type)} · ${esc(u.city)}</span></span>
      ${planBadge(u.tier)}
      <p>${esc(u.summary)}</p>
      <span class="uc-foot"><span class="tiles">${u.accounts.slice(0, 6).map(p => S.platforms[p] ? tileForPlatform(p, 'xs') : '').join('')}</span>
        ${applied ? `<span class="chip posted">${icon('check', 12)}Diterapkan</span>` : `<span class="faint">${esc(u.people)}</span>`}</span>
    </button>`;
}

function gallery() {
  const list = USE_CASES.filter(u => tier === 'all' || u.tier === tier);
  return `
    <div class="page">
      <div class="uc-hero">
        <h2>Contoh penggunaan Serambi</h2>
        <p>Cara usaha lokal memakai Serambi untuk ditemukan di sekitar, beriklan lebih hemat, membangun kepercayaan lewat ulasan, dan mengotomatiskan pemasaran harian. Pilih yang mirip usahamu, ikuti langkahnya, atau terapkan langsung.</p>
        <p class="hint">${icon('info', 13, 'inline')}Semua nama usaha di sini fiktif. Angka adalah target yang disarankan, bukan hasil usaha nyata.</p>
      </div>
      <div class="filters">${[['all', 'Semua'], ['solo', 'SOLOPreneur'], ['small', 'SMALPreneur'], ['medium', 'MediumPreneur']].map(([k, l]) => `<button class="${tier === k ? 'on' : ''}" data-tier="${k}">${l}</button>`).join('')}</div>
      <div class="uc-grid">${list.map(card).join('')}</div>
    </div>`;
}

function detail(u) {
  const applied = (S.state.settings.appliedUseCases || []).includes(u.id);
  const plan = S.state.plan;
  const order = { solo: 0, small: 1, medium: 2 };
  const fits = order[plan.id] >= order[u.tier];
  return `
    <div class="page uc-detail">
      <button class="link" data-back>${icon('arrow-left', 14, 'inline')}Semua contoh</button>
      <div class="uc-head">
        <span class="uc-ic big">${icon(u.icon, 28)}</span>
        <div><h2>${esc(u.name)}</h2><p>${esc(u.type)} · ${esc(u.city)} · ${esc(u.people)}</p>${planBadge(u.tier)}</div>
        <span class="grow"></span>
        <div class="row-btns">
          <button class="btn" data-pdf="${u.id}">${icon('printer', 15)}Simpan PDF</button>
          ${perm('templates.write') ? `<button class="btn primary" data-apply="${u.id}">${icon(applied ? 'refresh-cw' : 'rocket', 16)}${applied ? 'Terapkan lagi' : 'Terapkan ke Serambi saya'}</button>` : ''}
        </div>
      </div>
      <p class="uc-summary">${esc(u.summary)}</p>
      ${!fits ? `<div class="warning info">${icon('crown', 15)}<span>Contoh ini memakai fitur ${esc(TIERS[u.tier].name)} (${esc(TIERS[u.tier].note)}). Kamu tetap bisa menerapkan templat, tugas, dan otomatisasi yang tersedia di paket ${esc(plan.name)}.</span></div>` : ''}
      <div class="uc-cols">
        <section>
          <h3 class="sub-h">Tantangan</h3>
          <ul class="uc-list">${u.challenge.map(c => `<li>${icon('target', 14, 'inline')}${esc(c)}</li>`).join('')}</ul>
          <h3 class="sub-h">Langkah di Serambi</h3>
          <ol class="uc-steps">${u.setup.map((s, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(s.title)}</b><p>${esc(s.detail)}</p>${s.link ? `<button class="link" data-goto='${esc(JSON.stringify(s.link))}'>Buka ${icon('arrow-right', 13, 'inline')}</button>` : ''}</div></li>`).join('')}</ol>
          <h3 class="sub-h">Ritme mingguan</h3>
          <div class="panel uc-routine">${u.routine.map(([d, t]) => `<div><b>${esc(d)}</b><span>${esc(t)}</span></div>`).join('')}</div>
        </section>
        <aside>
          <div class="side-card"><h3>Otomatisasi yang dipakai</h3>
            ${u.automations.map(a => `<div class="uc-auto">${icon((RECIPES[a.type] || {}).icon || 'zap', 16)}<div><b>${esc(a.name)}</b><span>${esc((RECIPES[a.type] || {}).desc || '')}</span></div></div>`).join('')}</div>
          <div class="side-card"><h3>Ukuran keberhasilan</h3><ul class="uc-list">${u.metrics.map(m => `<li>${icon('chart-column', 14, 'inline')}${esc(m)}</li>`).join('')}</ul></div>
          <div class="side-card pdp"><h3>${icon('shield-check', 16, 'inline')}Catatan pelindungan data</h3><ul class="uc-list">${u.pdp.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>
          <div class="side-card"><h3>Templat siap pakai</h3>${u.templates.map(t => `<div class="uc-tpl"><b>${esc(t.name)}</b><pre class="selectable">${esc(t.text)}</pre></div>`).join('')}</div>
        </aside>
      </div>
    </div>`;
}

function render() {
  const u = openId && USE_CASES.find(x => x.id === openId);
  tb.innerHTML = `<h1>Contoh penggunaan</h1><span class="grow"></span>`;
  root.innerHTML = u ? detail(u) : gallery();
}

function printable(u) {
  const e = esc;
  return `<!doctype html><html lang="id"><head><title>${e(u.name)}</title><style>
    @page{size:A4;margin:0} body{margin:0;font-family:'Plus Jakarta Sans',sans-serif;color:#1B2033;font-size:10.5pt;line-height:1.5}
    .p{padding:16mm 16mm 14mm} .brand{color:#1F2A6B;font-weight:800;font-size:10pt;margin-bottom:10pt} .brand{display:flex;align-items:center} .brand img{width:14pt;height:14pt;margin-right:6pt}
    h1{font-size:22pt;margin:0} .sub{color:#555C74;margin:2pt 0 10pt} .tier{display:inline-block;background:#EEF0FB;color:#3446A8;border-radius:10pt;padding:2pt 8pt;font-weight:700;font-size:9pt}
    h2{font-size:12pt;color:#1F2A6B;margin:14pt 0 5pt} ol,ul{margin:0;padding-left:16pt} li{margin-bottom:4pt} .cols{display:grid;grid-template-columns:1.3fr 1fr;gap:14pt}
    .box{border:1px solid #E1E4EC;border-radius:8pt;padding:8pt 10pt;margin-bottom:8pt} pre{white-space:pre-wrap;font-family:inherit;margin:3pt 0 0;color:#555C74}
    .foot{margin-top:14pt;border-top:1px solid #E1E4EC;padding-top:6pt;color:#8A90A6;font-size:8pt}</style></head><body><div class="p">
    <div class="brand"><img src="${LOGO_MARK}" alt="">Serambi · Contoh penggunaan</div>
    <h1>${e(u.name)}</h1><p class="sub">${e(u.type)} · ${e(u.city)} · ${e(u.people)}</p><span class="tier">${e(TIERS[u.tier].name)}</span>
    <p>${e(u.summary)}</p>
    <div class="cols"><div>
      <h2>Tantangan</h2><ul>${u.challenge.map(c => `<li>${e(c)}</li>`).join('')}</ul>
      <h2>Langkah di Serambi</h2><ol>${u.setup.map(s => `<li><b>${e(s.title)}.</b> ${e(s.detail)}</li>`).join('')}</ol>
      <h2>Ritme mingguan</h2><ul>${u.routine.map(([d, t]) => `<li><b>${e(d)}:</b> ${e(t)}</li>`).join('')}</ul>
    </div><div>
      <h2>Otomatisasi</h2>${u.automations.map(a => `<div class="box"><b>${e(a.name)}</b><br>${e((RECIPES[a.type] || {}).desc || '')}</div>`).join('')}
      <h2>Ukuran keberhasilan</h2><ul>${u.metrics.map(m => `<li>${e(m)}</li>`).join('')}</ul>
      <h2>Pelindungan data</h2><ul>${u.pdp.map(m => `<li>${e(m)}</li>`).join('')}</ul>
    </div></div>
    <div class="foot">Nama usaha fiktif; angka adalah target, bukan hasil nyata. Serambi · ${e(S.owner.copyright)} · ${e(S.owner.email)}</div>
  </div></body></html>`;
}

async function apply(u) {
  const ok = await confirmDialog({
    title: `Terapkan “${u.name}”?`,
    message: `Serambi menambahkan ${u.templates.length} templat, ${u.automations.length} otomatisasi, dan ${u.setup.length} tugas langkah awal. Profil bisnis yang masih kosong diisi contoh kategori dan layanan. Data yang sudah ada tidak diubah.`,
    confirm: 'Terapkan'
  });
  if (!ok) return;
  const res = await api.applyUseCase({
    id: u.id, tag: u.name,
    templates: u.templates,
    automations: u.automations,
    tasks: u.setup.map((s, i) => ({ key: 's' + i, title: s.title, detail: s.detail, link: s.link, inDays: i })),
    business: u.business
  });
  const parts = [`${res.templates} templat`, `${res.automations} otomatisasi`, `${res.tasks} tugas`];
  toast(`Diterapkan: ${parts.join(', ')}.${res.skipped.length ? ' ' + res.skipped.join('; ') + '.' : ''} Lihat tugasnya di Beranda.`, { ms: 8000 });
}

function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const ds = b.dataset;
  if (ds.tier) { tier = ds.tier; return render(); }
  if (ds.uc) { openId = ds.uc; root.scrollTop = 0; return render(); }
  if ('back' in ds) { openId = null; return render(); }
  if (ds.apply) return apply(USE_CASES.find(x => x.id === ds.apply)).catch(err => toast(err.message, { kind: 'err' }));
  if (ds.pdf) { const u = USE_CASES.find(x => x.id === ds.pdf); return api.savePdf({ html: printable(u), fileName: `contoh-serambi-${u.id}.pdf` }); }
  if (ds.goto) { const l = JSON.parse(ds.goto); return go({ name: l.route, tab: l.tab }); }
}

export default {
  mount(el, titlebar, route) { root = el; tb = titlebar; openId = route.id || null; root.addEventListener('click', onClick); render(); },
  update() { const y = root.scrollTop; render(); root.scrollTop = y; },
  unmount() { root.removeEventListener('click', onClick); }
};
