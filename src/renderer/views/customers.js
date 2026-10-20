// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Pelanggan — a small customer list for local marketing, built around consent
// (UU No. 27/2022 Pelindungan Data Pribadi): every purpose has its own recorded consent,
// customers can be restricted, receive a copy of their data, or be erased.
import { icon } from '../icons.js';
import { esc, toast, openModal, confirmDialog, readForm, fmtDate, fmtDateTime, toDateInput, timeAgo, csv, parseCsv, debounce } from '../util.js';
import { S, api, go, emit, perm, prettyPhone, hasConsent, inTeam } from '../ctx.js';

let root, tb, q = '', fConsent = 'all', fLoc = '', sort = 'visit';
const METHODS = { lisan: 'Lisan (dicatat petugas)', tertulis: 'Tertulis (formulir kertas)', formulir: 'Formulir online', pesan: 'Pesan WhatsApp/chat', qr: 'Pindai QR di toko', impor: 'Impor data lama' };

const canSee = () => perm('customers.view');
const canEdit = () => perm('customers.write');
const P = () => S.consentPurposes;

function consentChips(c) {
  return Object.entries(P()).map(([k, v]) => {
    const recs = (c.consents || []).filter(r => r.purpose === k);
    const st = hasConsent(c, k) ? 'on' : recs.length ? 'off' : 'none';
    return `<span class="consent ${st}" title="${esc(v.label)}: ${st === 'on' ? 'setuju' : st === 'off' ? 'ditarik' : 'belum ditanya'}">${icon(k === 'whatsapp' ? 'message-circle' : k === 'review' ? 'star' : 'cake-slice', 13)}</span>`;
  }).join('');
}

function filtered() {
  let list = [...S.state.customers];
  const qq = q.trim().toLowerCase();
  if (qq) list = list.filter(c => [c.name, c.phone, c.email, (c.tags || []).join(' ')].join(' ').toLowerCase().includes(qq));
  if (fLoc) list = list.filter(c => c.locationId === fLoc);
  if (fConsent === 'none') list = list.filter(c => !(c.consents || []).length);
  else if (fConsent === 'restricted') list = list.filter(c => c.restricted);
  else if (fConsent !== 'all') list = list.filter(c => hasConsent(c, fConsent));
  list.sort((a, b) => sort === 'name' ? String(a.name).localeCompare(String(b.name), 'id') : (b.lastVisitAt || b.createdAt || 0) - (a.lastVisitAt || a.createdAt || 0));
  return list;
}

function render() {
  const all = S.state.customers;
  const list = filtered();
  const locs = S.state.locations;
  tb.innerHTML = `<h1>Pelanggan</h1><span class="faint tnum" style="margin-left:6px">${all.length}</span><span class="grow"></span>
    ${canSee() ? `<button class="btn ghost sm" data-export ${all.length ? '' : 'disabled'}>${icon('download', 15)}Ekspor</button>` : ''}
    ${canEdit() ? `<button class="btn ghost sm" data-import>${icon('upload', 15)}Impor CSV</button><button class="btn primary sm" data-new>${icon('user-plus', 15)}Tambah pelanggan</button>` : ''}`;
  const noConsent = all.filter(c => !(c.consents || []).length).length;
  root.innerHTML = `
    <div class="page">
      ${!canSee() ? `<div class="warning info" style="margin-bottom:14px">${icon('eye-off', 15)}<span>Data pelanggan disamarkan karena peranmu di tim tidak mencakup akses data pribadi pelanggan. Minta pemilik tim bila kamu memerlukannya untuk pekerjaan.</span></div>` : ''}
      <div class="cust-intro">
        <div><b>Catat hanya yang perlu, dengan persetujuan.</b> Setiap tujuan (promo WhatsApp, permintaan ulasan, ucapan ulang tahun) punya persetujuannya sendiri. Otomatisasi Serambi hanya memakai pelanggan yang setuju.</div>
        <button class="btn ghost sm" data-go-trust>${icon('shield-check', 15)}Pemberitahuan privasi</button>
      </div>
      ${noConsent && canSee() ? `<div class="warning" style="margin-bottom:14px">${icon('triangle-alert', 15)}<span>${noConsent} pelanggan belum punya catatan persetujuan. Tanyakan saat mereka datang lagi, lalu catat di detail pelanggan.</span></div>` : ''}
      <div class="toolbar">
        <div class="search">${icon('search', 16)}<input class="input" data-q placeholder="Cari nama, nomor, atau tag" value="${esc(q)}"></div>
        <select class="input sm-input" data-fconsent>
          ${[['all', 'Semua pelanggan'], ...Object.entries(P()).map(([k, v]) => [k, 'Setuju: ' + v.short]), ['none', 'Belum ada persetujuan'], ['restricted', 'Pemrosesan dibatasi']].map(([k, l]) => `<option value="${k}" ${fConsent === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
        ${locs.length > 1 ? `<select class="input sm-input" data-floc><option value="">Semua lokasi</option>${locs.map(l => `<option value="${l.id}" ${fLoc === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>` : ''}
        <select class="input sm-input" data-sort><option value="visit" ${sort === 'visit' ? 'selected' : ''}>Terakhir datang</option><option value="name" ${sort === 'name' ? 'selected' : ''}>Nama A–Z</option></select>
      </div>
      ${all.length ? `
      <div class="panel table-wrap">
        <table class="table cust-table">
          <thead><tr><th>Nama</th><th>WhatsApp</th>${locs.length > 1 ? '<th>Lokasi</th>' : ''}<th>Terakhir datang</th><th class="num">Kunjungan</th><th>Persetujuan</th><th></th></tr></thead>
          <tbody>${list.slice(0, 500).map(c => `
            <tr data-cust="${c.id}" class="${c.restricted ? 'restricted' : ''}">
              <td><b>${esc(c.name)}</b>${(c.tags || []).length ? `<span class="tags">${c.tags.slice(0, 3).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')}</span>` : ''}${c.restricted ? ' <span class="chip failed">Dibatasi</span>' : ''}</td>
              <td class="tnum">${esc(c.masked ? c.phone : prettyPhone(c.phone))}</td>
              ${locs.length > 1 ? `<td>${esc((locs.find(l => l.id === c.locationId) || {}).name || '—')}</td>` : ''}
              <td>${c.lastVisitAt ? esc(timeAgo(c.lastVisitAt)) : '—'}</td>
              <td class="num tnum">${c.visits || 0}</td>
              <td><span class="consents">${consentChips(c)}</span></td>
              <td class="acts">${canEdit() ? `<button class="btn ghost sm" data-visit="${c.id}" title="Catat kunjungan hari ini">${icon('plus', 14)}Datang</button>` : ''}
                ${canSee() && c.phone && hasConsent(c, 'whatsapp') ? `<button class="icon-btn sm" data-wa="${c.id}" title="Kirim WhatsApp">${icon('message-circle', 15)}</button>` : ''}</td>
            </tr>`).join('')}</tbody>
        </table>
        ${list.length > 500 ? `<p class="hint" style="padding:10px 14px">Menampilkan 500 dari ${list.length}. Persempit dengan pencarian.</p>` : ''}
        ${!list.length ? `<p class="hint" style="padding:14px">Tidak ada pelanggan yang cocok.</p>` : ''}
      </div>` : `
      <div class="empty">
        <p>Belum ada pelanggan. Catat pelanggan yang setuju dihubungi supaya Serambi bisa membantu meminta ulasan, menyapa yang lama tidak datang, dan mengucapkan ulang tahun.</p>
        ${canEdit() ? `<div class="row-btns"><button class="btn primary" data-new>${icon('user-plus', 16)}Tambah pelanggan</button><button class="btn" data-import>${icon('upload', 16)}Impor dari CSV/Excel</button></div>` : ''}
      </div>`}
    </div>`;
}

// ---------- forms ----------
function consentFields(existing) {
  const nv = S.state.privacy.notice;
  return `
    <div class="consent-box">
      <b>Persetujuan pelanggan</b>
      <p class="hint">Centang hanya yang benar-benar disetujui pelanggan, setelah kamu menjelaskan tujuannya. Persetujuan bisa ditarik kapan saja.</p>
      ${Object.entries(P()).map(([k, v]) => `<label class="check-inline"><input type="checkbox" data-consent="${k}" ${existing && hasConsent(existing, k) ? 'checked' : ''}> ${esc(v.label)}</label>`).join('')}
      <div class="form-grid" style="margin-top:8px">
        <div class="field"><label>Cara persetujuan diberikan</label><select class="input" data-f="method">${Object.entries(METHODS).filter(([k]) => k !== 'impor').map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
        <div class="field"><label>Bukti (opsional)</label><input class="input" data-f="evidence" maxlength="300" placeholder="Misalnya: formulir no. 12, chat 20 Okt"></div>
      </div>
      <p class="hint">${nv && nv.version ? `Dicatat dengan pemberitahuan privasi versi ${nv.version}.` : `Belum ada pemberitahuan privasi. <button class="link" data-go-notice>Buat di Pusat Kepercayaan</button>.`}</p>
    </div>`;
}

function newCustomer() {
  const locs = S.state.locations;
  const m = openModal({
    title: 'Tambah pelanggan',
    wide: true,
    body: `
      <div class="form-grid">
        <div class="field"><label>Nama</label><input class="input" data-f="name" maxlength="80" autofocus></div>
        <div class="field"><label>Nomor WhatsApp</label><input class="input" type="tel" data-f="phone" maxlength="30" placeholder="0812-3456-7890"></div>
        <div class="field"><label>Email (opsional)</label><input class="input" type="email" data-f="email" maxlength="120"></div>
        ${locs.length ? `<div class="field"><label>Lokasi</label><select class="input" data-f="locationId">${locs.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label>Tag (opsional)</label><input class="input" data-f="tags" maxlength="200" placeholder="langganan, kantor"></div>
        <div class="field"><label>Datang terakhir</label><input class="input" type="date" data-f="lastVisit" value="${toDateInput(Date.now())}"></div>
        <div class="field full" data-bday hidden><label>Tanggal lahir</label><input class="input" type="date" data-f="birthday"><span class="hint">Hanya disimpan bila pelanggan setuju menerima ucapan ulang tahun.</span></div>
      </div>
      ${consentFields(null)}`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Simpan pelanggan</button>`
  });
  const bday = m.el.querySelector('[data-bday]');
  m.el.addEventListener('change', (e) => { if (e.target.dataset.consent === 'birthday') bday.hidden = !e.target.checked; });
  m.el.addEventListener('click', (e) => { if (e.target.closest('[data-go-notice]')) { m.close(); go({ name: 'trust', tab: 'records' }); } });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    if (!v.name.trim() && !v.phone.trim()) { toast('Isi nama atau nomor', { kind: 'err' }); return; }
    const consents = [...m.el.querySelectorAll('[data-consent]:checked')].map(i => ({ purpose: i.dataset.consent, status: 'granted', method: v.method, evidence: v.evidence }));
    const birthday = consents.some(c => c.purpose === 'birthday') ? v.birthday : '';
    await api.saveCustomer({
      name: v.name, phone: v.phone, email: v.email, locationId: v.locationId || null, tags: v.tags, birthday,
      lastVisitAt: v.lastVisit ? new Date(v.lastVisit + 'T12:00:00').getTime() : null, consents
    });
    m.close(); toast('Pelanggan disimpan');
  };
}

function customerDetail(id) {
  let m;
  const draw = () => {
    const c = S.state.customers.find(x => x.id === id);
    if (!c) { if (m) m.close(); return; }
    const locs = S.state.locations;
    const ro = !canEdit() || c.masked;
    const hist = [...(c.consents || [])].sort((a, b) => (b.at || 0) - (a.at || 0));
    const tasks = S.state.tasks.filter(t => t.customerId === id).slice(-5).reverse();
    m.el.querySelector('.modal-body').innerHTML = `
      <div class="form-grid">
        <div class="field"><label>Nama</label><input class="input" data-f="name" value="${esc(c.name)}" maxlength="80" ${ro ? 'disabled' : ''}></div>
        <div class="field"><label>Nomor WhatsApp</label><input class="input" data-f="phone" value="${esc(c.masked ? c.phone : prettyPhone(c.phone))}" maxlength="30" ${ro ? 'disabled' : ''}></div>
        <div class="field"><label>Email</label><input class="input" data-f="email" value="${esc(c.email || '')}" maxlength="120" ${ro ? 'disabled' : ''}></div>
        ${locs.length ? `<div class="field"><label>Lokasi</label><select class="input" data-f="locationId" ${ro ? 'disabled' : ''}><option value="">—</option>${locs.map(l => `<option value="${l.id}" ${c.locationId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label>Tag</label><input class="input" data-f="tags" value="${esc((c.tags || []).join(', '))}" maxlength="200" ${ro ? 'disabled' : ''}></div>
        <div class="field"><label>Tanggal lahir</label><input class="input" type="date" data-f="birthday" value="${esc(c.birthday || '')}" ${ro || !hasConsent(c, 'birthday') ? 'disabled' : ''}>
          ${!hasConsent(c, 'birthday') ? '<span class="hint">Perlu persetujuan ucapan ulang tahun.</span>' : ''}</div>
        <div class="field full"><label>Catatan</label><textarea class="input textarea" rows="2" data-f="notes" maxlength="1000" ${ro ? 'disabled' : ''} placeholder="Hanya catatan yang diperlukan untuk melayani. Jangan catat data kesehatan atau keuangan pribadi.">${esc(c.notes || '')}</textarea></div>
      </div>
      <div class="cust-facts"><span>${icon('calendar', 14)}Datang terakhir: <b>${c.lastVisitAt ? esc(fmtDate(c.lastVisitAt)) : '—'}</b></span><span>${icon('repeat', 14)}Kunjungan: <b>${c.visits || 0}</b></span><span>${icon('clock', 14)}Dicatat: <b>${esc(fmtDate(c.createdAt))}</b></span>${c.source === 'impor' ? `<span>${icon('upload', 14)}Dari impor</span>` : ''}</div>
      <div class="consent-box">
        <b>Persetujuan</b>
        <div class="consent-rows">${Object.entries(P()).map(([k, v]) => {
          const on = hasConsent(c, k);
          const last = hist.find(r => r.purpose === k);
          return `<div class="consent-row"><span class="consent ${on ? 'on' : last ? 'off' : 'none'}">${icon(on ? 'check' : last ? 'x' : 'minus', 13)}</span>
            <div class="meta"><b>${esc(v.label)}</b><span>${last ? `${on ? 'Setuju' : 'Ditarik'} ${esc(fmtDateTime(last.at))} · ${esc(METHODS[last.method] || last.method || '')}${last.byName ? ' · ' + esc(last.byName) : ''}` : 'Belum ditanya'}</span></div>
            ${!ro ? (on ? `<button class="btn ghost sm" data-withdraw="${k}">Tarik</button>` : `<button class="btn sm" data-grant="${k}">Catat setuju</button>`) : ''}</div>`;
        }).join('')}</div>
        ${hist.length ? `<details class="consent-hist"><summary>Riwayat persetujuan (${hist.length}) ${icon('chevron-down', 14)}</summary><ul>${hist.map(r => `<li>${esc(fmtDateTime(r.at))} · ${esc((P()[r.purpose] || {}).short || r.purpose)} · <b>${r.status === 'granted' ? 'setuju' : 'ditarik'}</b> · ${esc(METHODS[r.method] || r.method || '')}${r.evidence ? ' · ' + esc(r.evidence) : ''}${r.noticeVersion ? ` · pemberitahuan v${r.noticeVersion}` : ''}</li>`).join('')}</ul></details>` : ''}
      </div>
      ${!ro ? `<label class="set-row restrict-row" style="cursor:pointer;border:1px solid var(--line);border-radius:12px">
        <div class="meta"><b>Batasi pemrosesan</b><span>Pelanggan meminta datanya tidak dipakai sementara (UU PDP Pasal 11). Semua otomatisasi melewati pelanggan ini.</span></div>
        <span class="switch"><input type="checkbox" data-restrict ${c.restricted ? 'checked' : ''}><span></span></span></label>` : ''}
      ${tasks.length ? `<div><b class="sub-h">Tugas terkait</b><ul class="mini-list">${tasks.map(t => `<li>${icon(t.status === 'done' ? 'square-check' : 'square', 14, 'inline')}${esc(t.title)} <span class="faint">· ${esc(fmtDate(t.createdAt))}</span></li>`).join('')}</ul></div>` : ''}`;
  };
  m = openModal({
    title: 'Detail pelanggan',
    xl: true,
    body: '',
    foot: `${canSee() ? `<button class="btn ghost" data-dossier>${icon('file-down', 15)}Salinan data</button>` : ''}
      ${canEdit() ? `<button class="btn ghost danger" data-erase>${icon('user-x', 15)}Hapus data</button>` : ''}
      <span style="flex:1"></span>
      ${canSee() ? `<button class="btn" data-wa-c>${icon('message-circle', 15)}WhatsApp</button>` : ''}
      ${canEdit() ? `<button class="btn primary" data-save>Simpan</button>` : '<button class="btn primary" data-close-foot>Tutup</button>'}`,
    onClose: () => unsub()
  });
  const unsub = (() => { const fn = () => { if (!m.el.contains(document.activeElement) || !document.activeElement.matches('input, textarea, select')) draw(); }; listeners.add(fn); return () => listeners.delete(fn); })();
  draw();
  setTimeout(() => { m.el.scrollTop = 0; }, 60);
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const c = S.state.customers.find(x => x.id === id); if (!c) return;
    if (b.dataset.grant) return recordConsent(c, b.dataset.grant);
    if (b.dataset.withdraw) {
      if (!await confirmDialog({ title: 'Tarik persetujuan?', message: `${P()[b.dataset.withdraw].label}: pelanggan tidak akan dihubungi untuk tujuan ini lagi.${b.dataset.withdraw === 'birthday' ? ' Tanggal lahir ikut dihapus.' : ''}`, confirm: 'Tarik persetujuan' })) return;
      await api.setConsent({ id, purpose: b.dataset.withdraw, status: 'withdrawn', method: 'lisan' });
      return toast('Persetujuan ditarik dan dicatat');
    }
    if ('save' in b.dataset) {
      const v = readForm(m.el);
      await api.saveCustomer({ id, name: v.name, phone: v.phone, email: v.email, locationId: v.locationId || null, tags: v.tags, notes: v.notes, ...(hasConsent(c, 'birthday') ? { birthday: v.birthday } : {}) });
      toast('Pelanggan disimpan'); m.close(); return;
    }
    if ('closeFoot' in b.dataset) return m.close();
    if ('waC' in b.dataset) {
      if (!hasConsent(c, 'whatsapp')) { if (!await confirmDialog({ title: 'Belum ada persetujuan promo WhatsApp', message: 'Kamu tetap boleh membalas atau melayani pelanggan ini, tetapi jangan kirim promosi tanpa persetujuannya. Lanjut buka WhatsApp?', confirm: 'Buka WhatsApp' })) return; }
      return emit('wa', { phone: c.phone, text: '' });
    }
    if ('dossier' in b.dataset) return exportDossier(c);
    if ('erase' in b.dataset) return eraseCustomer(c, m);
  });
  m.el.addEventListener('change', async (e) => {
    if (e.target.matches('[data-restrict]')) {
      await api.saveCustomer({ id, restricted: e.target.checked, restrictedReason: e.target.checked ? 'Permintaan pelanggan' : '' });
      toast(e.target.checked ? 'Pemrosesan dibatasi' : 'Pembatasan dicabut');
    }
  });
}

function recordConsent(c, purpose) {
  const m = openModal({
    title: 'Catat persetujuan',
    body: `<p><b>${esc(P()[purpose].label)}</b> untuk ${esc(c.name)}.</p>
      <p class="hint">Pastikan pelanggan sudah dijelaskan tujuannya dengan bahasa yang mudah dipahami dan tahu bahwa persetujuan bisa ditarik kapan saja.</p>
      <div class="field"><label>Cara persetujuan diberikan</label><select class="input" data-f="method">${Object.entries(METHODS).filter(([k]) => k !== 'impor').map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label>Bukti (opsional)</label><input class="input" data-f="evidence" maxlength="300" placeholder="Misalnya: chat WhatsApp 20 Okt 2026"></div>
      ${purpose === 'birthday' ? `<div class="field"><label>Tanggal lahir</label><input class="input" type="date" data-f="birthday" value="${esc(c.birthday || '')}"></div>` : ''}`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Catat</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    await api.setConsent({ id: c.id, purpose, status: 'granted', method: v.method, evidence: v.evidence });
    if (purpose === 'birthday' && v.birthday) await api.saveCustomer({ id: c.id, birthday: v.birthday });
    m.close(); toast('Persetujuan dicatat');
  };
}

async function exportDossier(c) {
  const data = await api.customerDossier(c.id);
  if (!data) return;
  const safe = String(c.name || 'pelanggan').toLowerCase().replace(/[^\w-]+/g, '-');
  const r = await api.saveFile({ content: JSON.stringify(data, null, 2), fileName: `data-${safe}.json`, kind: 'json' });
  if (r.ok) toast('Salinan data disimpan. Berikan kepada pelanggan lewat jalur yang aman.');
}

async function eraseCustomer(c, modal) {
  const ok = await confirmDialog({
    title: `Hapus semua data ${c.name}?`,
    message: 'Data pelanggan ini dihapus permanen dari Serambi (dan dari ruang kerja tim). Log audit hanya menyimpan kode acak, bukan nama atau nomor. Tindakan ini tidak bisa dibatalkan.',
    confirm: 'Hapus permanen', danger: true
  });
  if (!ok) return;
  await api.eraseCustomer({ id: c.id, reason: 'Permintaan penghapusan' });
  modal.close();
  toast('Data pelanggan dihapus');
}

function importCsv() {
  const m = openModal({
    title: 'Impor pelanggan dari CSV',
    wide: true,
    body: `
      <p>Simpan daftar dari Excel atau Google Sheets sebagai CSV. Kolom yang dikenali: <code>nama</code>, <code>whatsapp</code>, <code>email</code>, <code>tanggal_lahir</code>, <code>tag</code>, <code>terakhir_datang</code>, <code>catatan</code>, serta persetujuan <code>setuju_wa</code>, <code>setuju_ulasan</code>, <code>setuju_ultah</code> (isi “ya”).</p>
      <div class="row-btns"><input type="file" accept=".csv,text/csv" data-file class="input"><button class="btn ghost sm" data-template>${icon('download', 14)}Unduh contoh CSV</button></div>
      <div data-preview></div>
      <div class="consent-box">
        <label class="check-inline"><input type="checkbox" data-attest> Saya menyatakan data ini dikumpulkan secara sah, dan persetujuan yang ditandai “ya” memang diberikan oleh pelanggan.</label>
        <div class="field" style="margin-top:8px"><label>Asal data & bukti persetujuan</label><input class="input" data-evidence maxlength="300" placeholder="Misalnya: buku tamu toko 2025, formulir kartu member"></div>
      </div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes disabled>Impor</button>`
  });
  let rows = [];
  const yes = m.el.querySelector('[data-yes]');
  const refreshBtn = () => { yes.disabled = !(rows.length && m.el.querySelector('[data-attest]').checked); };
  const pick = (h, names) => h.findIndex(x => names.includes(x));
  const truthy = (v) => /^(ya|y|yes|1|true|setuju|v|x|✓)$/i.test(String(v || '').trim());
  const parseDate = (v) => {
    const s = String(v || '').trim(); if (!s) return null;
    let m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    m2 = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
    return null;
  };
  m.el.querySelector('[data-file]').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const table = parseCsv(reader.result);
      if (table.length < 2) { m.el.querySelector('[data-preview]').innerHTML = '<p class="error-text">Berkas kosong atau tidak ada baris data.</p>'; return; }
      const h = table[0].map(x => String(x).trim().toLowerCase().replace(/\s+/g, '_'));
      const col = {
        name: pick(h, ['nama', 'name', 'nama_pelanggan']), phone: pick(h, ['whatsapp', 'wa', 'telepon', 'telp', 'hp', 'no_hp', 'phone', 'nomor']),
        email: pick(h, ['email', 'e-mail', 'surel']), birthday: pick(h, ['tanggal_lahir', 'ulang_tahun', 'birthday', 'tgl_lahir']),
        tags: pick(h, ['tag', 'tags', 'label', 'kategori']), last: pick(h, ['terakhir_datang', 'kunjungan_terakhir', 'last_visit', 'tanggal']), notes: pick(h, ['catatan', 'notes', 'keterangan']),
        cw: pick(h, ['setuju_wa', 'setuju_whatsapp', 'consent_whatsapp']), cr: pick(h, ['setuju_ulasan', 'consent_review']), cb: pick(h, ['setuju_ultah', 'setuju_ulang_tahun', 'consent_birthday'])
      };
      const g = (r, i) => i >= 0 ? r[i] : '';
      rows = table.slice(1).map(r => {
        const lv = parseDate(g(r, col.last));
        const bd = parseDate(g(r, col.birthday));
        return { name: g(r, col.name), phone: g(r, col.phone), email: g(r, col.email), tags: g(r, col.tags), notes: g(r, col.notes),
          lastVisitAt: lv ? new Date(lv + 'T12:00:00').getTime() : null,
          consent_whatsapp: truthy(g(r, col.cw)), consent_review: truthy(g(r, col.cr)), consent_birthday: truthy(g(r, col.cb)),
          birthday: truthy(g(r, col.cb)) && bd ? bd : '' };
      }).filter(r => r.name || r.phone);
      const withConsent = rows.filter(r => r.consent_whatsapp || r.consent_review || r.consent_birthday).length;
      m.el.querySelector('[data-preview]').innerHTML = `<div class="warning info">${icon('info', 15)}<span><b>${rows.length} baris</b> siap diimpor; ${withConsent} punya persetujuan. ${col.name < 0 && col.phone < 0 ? 'Kolom nama/nomor tidak ditemukan; periksa judul kolom.' : ''} Nomor dengan nomor yang sudah ada akan memperbarui data lama.</span></div>`;
      refreshBtn();
    };
    reader.readAsText(f);
  };
  m.el.querySelector('[data-attest]').onchange = refreshBtn;
  m.el.querySelector('[data-template]').onclick = async () => {
    await api.saveFile({ kind: 'csv', fileName: 'contoh-pelanggan-serambi.csv', content: csv([['nama', 'whatsapp', 'email', 'tanggal_lahir', 'tag', 'terakhir_datang', 'catatan', 'setuju_wa', 'setuju_ulasan', 'setuju_ultah'], ['Rina Wulandari', '081234567890', '', '1995-04-12', 'langganan', '2026-10-15', '', 'ya', 'ya', 'ya'], ['Budi Santoso', '085600011122', '', '', 'kantor', '2026-09-30', '', 'ya', 'tidak', 'tidak']]) });
  };
  m.el.querySelector('[data-no]').onclick = () => m.close();
  yes.onclick = async () => {
    yes.disabled = true;
    try {
      const r = await api.importCustomers({ rows, attest: { confirmed: true, evidence: m.el.querySelector('[data-evidence]').value } });
      m.close(); toast(`${r.added} pelanggan baru, ${r.updated} diperbarui`);
    } catch (e) { yes.disabled = false; toast(e.message, { kind: 'err', ms: 6000 }); }
  };
}

async function exportCsv() {
  const list = filtered();
  const ok = await confirmDialog({ title: `Ekspor ${list.length} pelanggan?`, message: 'Berkas CSV berisi data pribadi dan tidak terenkripsi. Simpan di tempat aman dan hapus bila tidak diperlukan. Ekspor ini dicatat di log audit.', confirm: 'Ekspor' });
  if (!ok) return;
  const rows = [['nama', 'whatsapp', 'email', 'tanggal_lahir', 'tag', 'terakhir_datang', 'kunjungan', 'setuju_wa', 'setuju_ulasan', 'setuju_ultah', 'dibatasi']];
  for (const c of list) rows.push([c.name, c.phone, c.email || '', c.birthday || '', (c.tags || []).join(' '), c.lastVisitAt ? toDateInput(c.lastVisitAt) : '', c.visits || 0,
    hasConsent(c, 'whatsapp') ? 'ya' : 'tidak', hasConsent(c, 'review') ? 'ya' : 'tidak', hasConsent(c, 'birthday') ? 'ya' : 'tidak', c.restricted ? 'ya' : 'tidak']);
  const r = await api.saveFile({ content: csv(rows), fileName: `pelanggan-${toDateInput(Date.now())}.csv`, kind: 'csv', auditAction: 'customer.export', auditDetail: `${list.length} pelanggan ke CSV` });
  if (r.ok) toast('Data pelanggan diekspor');
}

// ---------- events ----------
const listeners = new Set();
const rerenderSoon = debounce(() => { render(); const i = root.querySelector('[data-q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200);

async function onClick(e) {
  const b = e.target.closest('button, tr[data-cust]');
  if (!b) return;
  const ds = b.dataset;
  if ('new' in ds) return newCustomer();
  if ('import' in ds) return importCsv();
  if ('export' in ds) return exportCsv();
  if ('goTrust' in ds) return go({ name: 'trust', tab: 'records' });
  if (ds.visit) { e.stopPropagation(); await api.visitCustomer({ id: ds.visit }); return toast('Kunjungan hari ini dicatat'); }
  if (ds.wa) { e.stopPropagation(); const c = S.state.customers.find(x => x.id === ds.wa); return emit('wa', { phone: c.phone, text: '' }); }
  if (ds.cust) return customerDetail(ds.cust);
}
function onInput(e) { if (e.target.matches('[data-q]')) { q = e.target.value; rerenderSoon(); } }
function onChange(e) {
  const t = e.target;
  if (t.matches('[data-fconsent]')) { fConsent = t.value; render(); }
  if (t.matches('[data-floc]')) { fLoc = t.value; render(); }
  if (t.matches('[data-sort]')) { sort = t.value; render(); }
}

export default {
  mount(el, titlebar) {
    root = el; tb = titlebar;
    tb.onclick = onClick;
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    render();
  },
  update() {
    listeners.forEach(fn => fn());
    if (root.contains(document.activeElement) && document.activeElement.matches('[data-q]')) return;
    const y = root.scrollTop; render(); root.scrollTop = y;
  },
  unmount() {
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onChange);
  }
};
