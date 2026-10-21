// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Pusat Kepercayaan — security and compliance with UU No. 27 Tahun 2022 tentang
// Pelindungan Data Pribadi: app lock, encryption, records of processing, consent,
// privacy notice, data subject requests, incidents, retention, and the audit log.
// These are working tools for a small business; they are not legal advice.
import { icon } from '../icons.js';
import { esc, toast, openModal, confirmDialog, promptDialog, readForm, tabStrip, ring, fmtDate, fmtDateTime, fmtDateLong, toDateInput, deadlineText, timeAgo, csv } from '../util.js';
import { S, api, go, perm, inTeam, hasConsent, prettyPhone } from '../ctx.js';
import { ropaDocument, complianceReport, textDocument } from '../lib/print.js';

let root, tb, tab = 'overview', auditQ = '', ropaEdit = null;

const TABS = [
  ['overview', 'Ringkasan', 'shield-check'], ['security', 'Keamanan', 'lock'], ['records', 'Data & persetujuan', 'scroll-text'],
  ['rights', 'Hak subjek data', 'user-check'], ['incidents', 'Insiden', 'shield-alert'], ['retention', 'Retensi', 'timer'],
  ['audit', 'Log audit', 'history'], ['transparency', 'Transparansi', 'eye']
];

export const AUDIT_LABELS = {
  'lock.on': 'Serambi dikunci', 'lock.fail': 'PIN salah dimasukkan', 'lock.enable': 'Kunci aplikasi diaktifkan', 'lock.change': 'PIN diganti', 'lock.disable': 'Kunci aplikasi dimatikan', 'lock.reset': 'PIN direset (lupa PIN)',
  'security.encryption': 'Pengaturan enkripsi diubah', 'security.logout-all': 'Keluar dari semua akun',
  'customer.create': 'Pelanggan ditambahkan', 'customer.update': 'Data pelanggan diubah', 'customer.erase': 'Data pelanggan dihapus', 'customer.import': 'Pelanggan diimpor', 'customer.export': 'Data pelanggan diekspor',
  'consent.grant': 'Persetujuan dicatat', 'consent.withdraw': 'Persetujuan ditarik',
  'dsr.create': 'Permintaan subjek data dicatat', 'dsr.update': 'Permintaan subjek data diperbarui', 'dsr.remove': 'Permintaan subjek data dihapus',
  'incident.create': 'Insiden dicatat', 'incident.update': 'Insiden diperbarui', 'incident.remove': 'Insiden dihapus',
  'privacy.ropa': 'Catatan pemrosesan disimpan', 'privacy.notice': 'Pemberitahuan privasi diterbitkan', 'privacy.retention': 'Kebijakan retensi diubah', 'privacy.ppdp': 'Penanggung jawab data ditunjuk', 'privacy.dpia': 'Penilaian dampak disimpan',
  'retention.purge': 'Data lewat masa simpan dihapus', 'data.backup': 'Cadangan dibuat', 'data.restore': 'Cadangan dipulihkan',
  'workspace.create': 'Ruang kerja tim dibuat', 'workspace.join': 'Bergabung ke ruang kerja', 'workspace.recover': 'Akses pemilik dipulihkan', 'workspace.leave': 'Keluar dari ruang kerja', 'workspace.rotate': 'Kunci tim diganti',
  'member.invite': 'Anggota diundang', 'member.reinvite': 'Kode undangan baru', 'member.role': 'Peran anggota diubah', 'member.access': 'Akses data pelanggan diubah', 'member.remove': 'Anggota dikeluarkan',
  'team.approval': 'Aturan persetujuan diubah', 'team.access-review': 'Akses data ditinjau', 'post.approve': 'Postingan disetujui', 'post.reject': 'Postingan ditolak',
  'license.activate': 'Lisensi diaktifkan', 'license.remove': 'Lisensi dilepas', 'trial.start': 'Uji coba dimulai', 'account.add': 'Akun ditambahkan', 'account.remove': 'Akun dihapus',
  'demo.enter': 'Masuk mode demo'
};

const manage = () => perm('trust.manage');
const disclaimer = `<p class="hint disclaimer">${icon('scale', 13, 'inline')}Pusat Kepercayaan membantu menjalankan kewajiban UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi dan PP No. 33 Tahun 2026 (berlaku 16 Januari 2027). Ini alat kerja, bukan nasihat hukum. Untuk kasus khusus, konsultasikan dengan ahli hukum.</p>`;

// ---------- overview ----------
function overview() {
  const c = S.state.compliance;
  const sec = S.state.security;
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const openDsr = S.state.dsr.filter(r => !['closed', 'rejected'].includes(r.status)).length;
  const openInc = S.state.incidents.filter(r => r.status !== 'closed').length;
  return `
    <div class="trust-top">
      <section class="panel trust-score">${ring(pct, 108)}
        <div><h2>${c.done} dari ${c.total} butir terpenuhi</h2><p>Daftar periksa pelindungan data pribadi untuk usahamu. Selesaikan butir yang belum, mulai dari atas.</p>
          ${manage() ? `<button class="btn sm" data-report>${icon('file-down', 15)}Laporan kepatuhan (PDF)</button>` : ''}</div></section>
      <section class="trust-cards">
        <div class="tcard ${sec.lock ? 'ok' : 'no'}">${icon(sec.lock ? 'lock' : 'lock-open', 18)}<b>Kunci aplikasi</b><span>${sec.lock ? `Aktif · terkunci otomatis ${sec.autoLockMin ? sec.autoLockMin + ' menit' : 'manual'}` : 'Belum aktif'}</span></div>
        <div class="tcard ${sec.encrypted ? 'ok' : 'no'}">${icon('hard-drive', 18)}<b>Data di komputer ini</b><span>${sec.encrypted ? 'Terenkripsi kunci sistem' : sec.osStrong ? 'Belum terenkripsi' : 'Enkripsi sistem tidak tersedia'}</span></div>
        <div class="tcard ${inTeam() ? 'ok' : ''}">${icon('cloud', 18)}<b>Folder tim</b><span>${inTeam() ? 'AES-256-GCM, kunci versi ' + S.state.workspace.kv : 'Tidak dipakai'}</span></div>
        <div class="tcard ${S.state.auditStatus && S.state.auditStatus.ok ? 'ok' : 'no'}">${icon('history', 18)}<b>Log audit</b><span>${S.state.auditStatus ? `${S.state.auditStatus.total} catatan · ${S.state.auditStatus.ok ? 'utuh' : 'ada yang berubah'}` : '—'}</span></div>
        <div class="tcard ${openDsr ? 'warn' : 'ok'}">${icon('user-check', 18)}<b>Permintaan subjek data</b><span>${openDsr ? `${openDsr} terbuka` : 'Tidak ada yang terbuka'}</span></div>
        <div class="tcard ${openInc ? 'warn' : 'ok'}">${icon('shield-alert', 18)}<b>Insiden</b><span>${openInc ? `${openInc} sedang ditangani` : 'Tidak ada'}</span></div>
      </section>
    </div>
    <section class="g-section">
      <div class="panel checklist big">${c.items.map(i => `
        <div class="check-row ${i.ok ? 'done' : ''}">
          <span class="box">${icon(i.ok ? 'check' : 'minus', 13)}</span>
          <span class="meta"><b>${esc(i.label)}</b><span>${esc(i.detail)} · <span class="ref">${esc(i.ref)}</span></span></span>
          ${!i.ok ? `<button class="btn sm" data-fix="${i.tab}">Perbaiki</button>` : ''}
        </div>`).join('')}</div>
    </section>
    ${disclaimer}`;
}

// ---------- security ----------
function security() {
  const sec = S.state.security;
  const isMac = S.os === 'darwin';
  return `
    <section class="g-section">
      <div class="g-head"><div><h2>Kunci aplikasi</h2><p>Kunci Serambi dengan PIN supaya orang lain yang memakai komputer ini tidak bisa membuka chat, data pelanggan, atau Pusat Kepercayaan. Pintasan: ${isMac ? '⌘' : 'Ctrl'}+Shift+L.</p></div></div>
      <div class="panel set-list">
        <div class="set-row"><span class="upd-icon ${sec.lock ? '' : 'error'}">${icon(sec.lock ? 'lock' : 'lock-open', 18)}</span>
          <div class="meta"><b>${sec.lock ? 'Kunci aplikasi aktif' : 'Kunci aplikasi belum aktif'}</b><span>${sec.lock ? 'PIN disimpan sebagai hash scrypt, bukan teks asli.' : 'Disarankan untuk komputer kasir atau komputer bersama.'}</span></div>
          <div class="acts">${sec.lock ? `<button class="btn sm" data-pin-change>Ganti PIN</button><button class="btn ghost sm" data-pin-off>Matikan</button><button class="btn primary sm" data-lock-now>${icon('lock', 14)}Kunci sekarang</button>` : `<button class="btn primary sm" data-pin-set>${icon('key-round', 14)}Buat PIN</button>`}</div></div>
        ${sec.lock ? `
        <div class="set-row"><div class="meta"><b>Kunci otomatis bila tidak dipakai</b><span>Serambi juga terkunci saat komputer dikunci atau tidur.</span></div>
          <select class="input sm-input" data-autolock>${[[0, 'Tidak'], [1, '1 menit'], [5, '5 menit'], [10, '10 menit'], [15, '15 menit'], [30, '30 menit'], [60, '1 jam']].map(([v, l]) => `<option value="${v}" ${Number(sec.autoLockMin) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <label class="set-row" style="cursor:pointer"><div class="meta"><b>Minta PIN saat Serambi dibuka</b><span>Termasuk saat Serambi berjalan otomatis ketika komputer menyala.</span></div>
          <span class="switch"><input type="checkbox" data-sec="lockOnStart" ${sec.lockOnStart ? 'checked' : ''}><span></span></span></label>` : ''}
      </div>
    </section>
    <section class="g-section">
      <div class="g-head"><div><h2>Enkripsi</h2></div></div>
      <div class="panel set-list">
        <label class="set-row" style="cursor:${sec.osStrong ? 'pointer' : 'default'}"><span class="upd-icon ${sec.encrypted ? '' : 'error'}">${icon('hard-drive', 18)}</span>
          <div class="meta"><b>Enkripsi data di komputer ini</b><span>${sec.osStrong ? `Semua data Serambi (akun, postingan, pelanggan, log) dienkripsi dengan kunci ${isMac ? 'Keychain macOS' : S.os === 'win32' ? 'Windows (DPAPI) milik akunmu' : 'sistem operasi'}. Berkas yang disalin ke komputer lain tidak bisa dibuka.${isMac ? ' Setelah pembaruan, macOS bisa meminta izin Keychain sekali; pilih “Selalu Izinkan”.' : ''}` : 'Sistem operasi ini tidak menyediakan penyimpanan kunci yang aman, jadi data tersimpan tanpa enkripsi. Gunakan kunci aplikasi dan enkripsi disk (BitLocker/FileVault).'}</span></div>
          ${sec.osStrong ? `<span class="switch"><input type="checkbox" data-sec="encryptAtRest" ${sec.encryptAtRest ? 'checked' : ''}><span></span></span>` : ''}</label>
        <div class="set-row"><span class="upd-icon">${icon('cloud', 18)}</span><div class="meta"><b>Enkripsi folder tim</b><span>${inTeam() ? `Aktif. Tiap data dienkripsi AES-256-GCM dengan kunci tim versi ${S.state.workspace.kv} sebelum disimpan ke folder bersama.` : 'Berlaku otomatis saat memakai ruang kerja tim.'}</span></div></div>
        <label class="set-row" style="cursor:pointer"><span class="upd-icon">${icon('eye-off', 18)}</span><div class="meta"><b>Samarkan data pribadi di layar</b><span>Nomor dan nama pelanggan disamarkan untuk anggota tim tanpa akses data pelanggan.</span></div>
          <span class="switch"><input type="checkbox" data-sec="maskPersonal" ${sec.maskPersonal ? 'checked' : ''}><span></span></span></label>
      </div>
    </section>
    <section class="g-section">
      <div class="g-head"><div><h2>Cadangan terenkripsi</h2><p>Simpan cadangan berkala dengan kata sandi. Cadangan memuat data pelanggan, jadi selalu gunakan kata sandi. ${S.state.settings.lastBackupAt ? 'Terakhir: ' + esc(fmtDateTime(S.state.settings.lastBackupAt)) + '.' : 'Belum pernah dibuat.'}</p></div></div>
      <div class="row-btns"><button class="btn primary" data-backup-enc>${icon('file-lock', 16)}Buat cadangan terenkripsi</button><button class="btn" data-restore>${icon('upload', 16)}Pulihkan</button></div>
    </section>
    <section class="g-section">
      <div class="g-head"><div><h2>Sesi akun</h2><p>Bila komputer akan dipakai orang lain atau dijual, keluarkan semua login media sosial dan toko dari Serambi.</p></div></div>
      <button class="btn danger" data-logout-all>${icon('log-out', 16)}Keluar dari semua akun (${S.state.accounts.length})</button>
    </section>`;
}

// ---------- records ----------
function noticeText() {
  const b = S.state.business;
  const ropa = S.state.privacy.ropa || [];
  const ret = (S.state.privacy.retention || {});
  const ppdp = S.state.privacy.ppdp;
  const contact = ppdp && ppdp.name ? `${ppdp.name}${ppdp.email ? ', ' + ppdp.email : ''}${ppdp.phone ? ', ' + ppdp.phone : ''}` : [b.whatsapp ? 'WhatsApp ' + prettyPhone(b.whatsapp) : '', b.email].filter(Boolean).join(' atau ') || '[kontak usaha]';
  const L = S.legalBases;
  return `PEMBERITAHUAN PRIVASI ${String(b.name || '[Nama usaha]').toUpperCase()}
Berlaku sejak ${fmtDateLong(Date.now())}

${b.name || '[Nama usaha]'}${b.city ? ' (' + b.city + ')' : ''} menghargai data pribadi Anda. Pemberitahuan ini menjelaskan data apa yang kami kumpulkan, untuk apa, berapa lama, dan apa hak Anda, sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.

1. Data yang kami kumpulkan dan tujuannya
${ropa.filter(r => r.id !== 'team' && r.id !== 'rights').map(r => `• ${r.name}: ${r.data}
  Tujuan: ${r.purpose}
  Dasar pemrosesan: ${(L[r.basis] || r.basis).replace(/\s*\(.*\)$/, '')}`).join('\n')}

2. Persetujuan
Untuk pesan promosi, permintaan ulasan, dan ucapan ulang tahun, kami hanya menghubungi Anda bila Anda setuju. Persetujuan dicatat per tujuan dan dapat ditarik kapan saja tanpa mengurangi layanan kami.

3. Siapa yang dapat mengakses data Anda
Hanya pemilik dan anggota tim kami yang memerlukannya untuk melayani Anda. Kami tidak menjual data Anda. Pesan dikirim melalui WhatsApp; bila kami memakai layanan penyimpanan awan, servernya dapat berada di luar Indonesia.

4. Berapa lama kami menyimpan data
Data pelanggan kami hapus ${ret.customersInactiveMonths || 24} bulan setelah kunjungan terakhir, atau lebih cepat bila Anda memintanya.

5. Cara kami melindungi data
Data disimpan terenkripsi, dibatasi aksesnya berdasarkan peran, dan setiap akses penting dicatat.

6. Hak Anda
Anda berhak untuk: mendapatkan informasi tentang pemrosesan data Anda; mengakses dan memperoleh salinan data; memperbaiki data yang keliru; meminta penghapusan data; menarik persetujuan; mengajukan keberatan atas keputusan yang semata-mata otomatis; meminta penundaan atau pembatasan pemrosesan; serta memperoleh data Anda dalam format yang umum digunakan.

7. Hubungi kami
Sampaikan pertanyaan atau permintaan ke ${contact}. Kami menanggapi paling lambat 3 × 24 jam sejak permintaan diterima.`;
}

function records() {
  const pv = S.state.privacy;
  const ropa = pv.ropa || [];
  const L = S.legalBases;
  const customers = S.state.customers;
  const stats = Object.entries(S.consentPurposes).map(([k, v]) => {
    const granted = customers.filter(c => hasConsent(c, k)).length;
    const withdrawn = customers.filter(c => !hasConsent(c, k) && (c.consents || []).some(r => r.purpose === k)).length;
    return { k, v, granted, withdrawn, none: customers.length - granted - withdrawn };
  });
  const notice = pv.notice;
  const ppdp = pv.ppdp || {};
  const dpia = pv.dpia || { answers: {} };
  const Q = [
    ['specific', 'Memproses data pribadi spesifik (kesehatan, biometrik, genetik, catatan kejahatan, data anak, atau keuangan pribadi)?'],
    ['automated', 'Ada keputusan otomatis yang berdampak hukum atau signifikan bagi pelanggan?'],
    ['scale', 'Memproses data dalam skala besar (misalnya puluhan ribu pelanggan)?'],
    ['monitoring', 'Melakukan pemantauan sistematis (misalnya CCTV dengan pengenalan wajah, pelacakan lokasi)?'],
    ['combine', 'Menggabungkan data pelanggan dari beberapa sumber untuk profil?'],
    ['newtech', 'Memakai teknologi baru yang berisiko bagi data pribadi?'],
    ['restrict', 'Ada pemrosesan yang membatasi pelanggan menjalankan haknya atas data?']
  ];
  const risky = Q.some(([k]) => dpia.answers && dpia.answers[k]);
  return `
    <section class="g-section" id="ts-ropa">
      <div class="g-head"><div><h2>Catatan kegiatan pemrosesan</h2><p>UU PDP mewajibkan pengendali data merekam seluruh kegiatan pemrosesan (Pasal 31). Serambi sudah menyiapkan catatan untuk fitur yang kamu pakai; tinjau, sesuaikan, lalu simpan.</p></div>
        <div class="g-acts">${pv.ropaDraft ? '<span class="chip due">Draf dari Serambi</span>' : `<span class="chip posted">Disimpan ${esc(fmtDate(pv.ropaReviewedAt))}</span>`}
          <button class="btn sm" data-ropa-pdf>${icon('file-down', 15)}PDF</button>${manage() ? `<button class="btn sm" data-ropa-add>${icon('plus', 15)}Tambah</button>${pv.ropaDraft ? `<button class="btn primary sm" data-ropa-save>${icon('check', 15)}Simpan sebagai catatan resmi</button>` : ''}` : ''}</div></div>
      <div class="ropa-list">${ropa.map((r, i) => `
        <details class="panel ropa-item"><summary><b>${esc(r.name)}</b><span class="chip">${esc((L[r.basis] || '').split(' (')[0])}</span>${icon('chevron-down', 15)}</summary>
          <dl>${[['Tujuan', r.purpose], ['Jenis data', r.data], ['Subjek', r.subjects], ['Penerima', r.recipients], ['Lokasi penyimpanan', r.storage], ['Transfer luar negeri', r.transfer], ['Retensi', r.retention], ['Keamanan', r.security]].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v || '—')}</dd>`).join('')}</dl>
          ${manage() ? `<div class="row-btns"><button class="btn sm" data-ropa-edit="${i}">${icon('pencil', 14)}Ubah</button><button class="btn ghost sm" data-ropa-rm="${i}">${icon('trash-2', 14)}Hapus</button></div>` : ''}
        </details>`).join('')}</div>
    </section>
    <section class="g-section" id="ts-consent">
      <div class="g-head"><div><h2>Persetujuan pelanggan</h2><p>Persetujuan harus eksplisit, per tujuan, dan tercatat (Pasal 20 & 22). Catat dan tarik persetujuan di halaman Pelanggan.</p></div>
        <div class="g-acts"><button class="btn sm" data-go-customers>${icon('users', 15)}Buka Pelanggan</button></div></div>
      <div class="consent-stats">${stats.map(s => `<div class="panel cs"><b>${esc(s.v.label)}</b><div class="cs-nums"><span class="ok">${s.granted} setuju</span><span>${s.withdrawn} ditarik</span><span class="faint">${s.none} belum ditanya</span></div></div>`).join('')}</div>
    </section>
    <section class="g-section" id="ts-notice">
      <div class="g-head"><div><h2>Pemberitahuan privasi</h2><p>Sampaikan kepada pelanggan data apa yang dikumpulkan, tujuan, dasar, masa simpan, dan haknya (Pasal 21). Tempel di toko (QR), situs, atau balasan otomatis WhatsApp.</p></div>
        <div class="g-acts">${notice && notice.publishedAt ? `<span class="chip posted">Versi ${notice.version} · ${esc(fmtDate(notice.publishedAt))}</span>` : '<span class="chip due">Belum diterbitkan</span>'}</div></div>
      <div class="panel form-panel">
        <textarea class="input textarea notice-text" rows="14" data-notice ${manage() ? '' : 'disabled'}>${esc(notice && notice.text ? notice.text : noticeText())}</textarea>
        <div class="form-foot">
          ${manage() ? `<button class="btn ghost sm" data-notice-regen>${icon('refresh-cw', 14)}Susun ulang dari catatan</button>` : ''}
          <button class="btn ghost sm" data-notice-copy>${icon('copy', 14)}Salin</button>
          <button class="btn ghost sm" data-notice-pdf>${icon('printer', 14)}PDF</button>
          <span class="grow"></span>
          ${manage() ? `<button class="btn primary" data-notice-publish>${icon('badge-check', 16)}Terbitkan versi ${(notice && notice.version || 0) + 1}</button>` : ''}
        </div>
      </div>
    </section>
    <section class="g-section" id="ts-ppdp">
      <div class="g-head"><div><h2>Penanggung jawab pelindungan data</h2><p>Pejabat Pelindungan Data Pribadi (PPDP) wajib ditunjuk bila pemrosesan untuk pelayanan publik, kegiatan intinya memantau data pribadi secara teratur dan sistematis dalam skala besar, atau memproses data spesifik/tindak pidana dalam skala besar (Pasal 53). Usaha kecil umumnya tidak wajib, tetapi tetap baik menunjuk satu orang yang bertanggung jawab.</p></div></div>
      <div class="panel form-panel"><div class="form-grid three">
        <div class="field"><label>Nama</label><input class="input" data-pp="name" value="${esc(ppdp.name || '')}" maxlength="80" ${manage() ? '' : 'disabled'}></div>
        <div class="field"><label>Email</label><input class="input" data-pp="email" value="${esc(ppdp.email || '')}" maxlength="120" ${manage() ? '' : 'disabled'}></div>
        <div class="field"><label>WhatsApp/telepon</label><input class="input" data-pp="phone" value="${esc(ppdp.phone || '')}" maxlength="30" ${manage() ? '' : 'disabled'}></div>
      </div>${manage() ? `<div class="form-foot"><label class="check-inline"><input type="checkbox" data-pp="required" ${ppdp.required ? 'checked' : ''}> Usaha kami memenuhi kriteria wajib PPDP</label><span class="grow"></span><button class="btn sm" data-pp-save>Simpan</button></div>` : ''}</div>
    </section>
    <section class="g-section" id="ts-dpia">
      <div class="g-head"><div><h2>Cek risiko tinggi (penilaian dampak)</h2><p>Pemrosesan berisiko tinggi wajib didahului penilaian dampak pelindungan data pribadi (Pasal 34). Jawab pertanyaan ini untuk mengetahui apakah usahamu memerlukannya.</p></div></div>
      <div class="panel checklist">${Q.map(([k, q]) => `<label class="check-row ${dpia.answers && dpia.answers[k] ? 'flag' : ''}"><input type="checkbox" data-dpia="${k}" ${dpia.answers && dpia.answers[k] ? 'checked' : ''} ${manage() ? '' : 'disabled'}><span class="box">${icon('check', 13)}</span><span class="meta"><b>${esc(q)}</b></span></label>`).join('')}
        <div class="dpia-result ${risky ? 'warn' : 'ok'}">${icon(risky ? 'triangle-alert' : 'circle-check-big', 16)}<span>${risky ? 'Ada pemrosesan berisiko tinggi. Buat penilaian dampak tertulis (uraian pemrosesan, tujuan, risiko, dan langkah mitigasi) sebelum memulai, dan pertimbangkan berkonsultasi dengan ahli.' : 'Tidak ada tanda risiko tinggi. Catatan kegiatan pemrosesan dan langkah keamanan dasar sudah memadai.'}</span></div>
        ${dpia.at ? `<p class="hint" style="padding:0 14px 12px">Disimpan ${esc(fmtDateTime(dpia.at))}</p>` : ''}
      </div>
    </section>
    ${disclaimer}`;
}

// ---------- rights ----------
function dsrStatus(r) {
  if (r.status === 'closed') return '<span class="chip posted">Selesai</span>';
  if (r.status === 'rejected') return '<span class="chip">Ditolak</span>';
  const late = r.dueAt < Date.now();
  return `<span class="chip ${late ? 'failed' : 'due'}">${late ? 'Terlambat · ' : ''}${esc(deadlineText(r.dueAt))}</span>`;
}
function rights() {
  const list = [...S.state.dsr].sort((a, b) => (['closed', 'rejected'].includes(a.status) - ['closed', 'rejected'].includes(b.status)) || (a.dueAt || 0) - (b.dueAt || 0));
  return `
    <section class="g-section">
      <div class="g-head"><div><h2>Permintaan hak subjek data</h2><p>Pelanggan berhak meminta akses, salinan, perbaikan, penghapusan, penarikan persetujuan, pembatasan, dan lainnya (Pasal 5–13). Catat setiap permintaan dan tanggapi paling lambat 3 × 24 jam (PP 33/2026).</p></div>
        <div class="g-acts">${manage() ? `<button class="btn primary sm" data-dsr-new>${icon('plus', 15)}Catat permintaan</button>` : ''}</div></div>
      ${list.length ? `<div class="panel table-wrap"><table class="table">
        <thead><tr><th>Diterima</th><th>Pemohon</th><th>Jenis</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map(r => `<tr data-dsr="${r.id}"><td>${esc(fmtDateTime(r.receivedAt))}</td><td><b>${esc(r.name || '—')}</b><span class="sub">${esc(r.contact || '')}</span></td><td>${esc(S.dsrTypes[r.type] || r.type)}</td><td>${dsrStatus(r)}</td><td class="acts"><button class="btn ghost sm" data-dsr-open="${r.id}">Buka</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><p>Belum ada permintaan. Saat pelanggan meminta datanya dilihat, diperbaiki, atau dihapus, catat di sini supaya tenggat dan tindakannya terlacak.</p></div>'}
    </section>
    <section class="g-section"><div class="tips-grid">
      <div class="tip">${icon('fingerprint', 18)}<b>Pastikan identitas</b><p>Cocokkan nomor WhatsApp atau tanyakan detail kunjungan sebelum memberikan atau menghapus data.</p></div>
      <div class="tip">${icon('file-down', 18)}<b>Salinan data</b><p>Untuk akses atau portabilitas, buka pelanggan lalu “Salinan data” (format JSON yang umum dipakai).</p></div>
      <div class="tip">${icon('user-x', 18)}<b>Penghapusan</b><p>“Hapus data” menghapus permanen dari Serambi dan ruang kerja tim; log hanya menyimpan kode acak.</p></div>
    </div></section>
    ${disclaimer}`;
}

// ---------- incidents ----------
function incidents() {
  const list = [...S.state.incidents].sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || (b.discoveredAt || 0) - (a.discoveredAt || 0));
  return `
    <section class="g-section">
      <div class="g-head"><div><h2>Insiden kegagalan pelindungan data</h2><p>Misalnya ponsel kasir hilang, data pelanggan terkirim ke grup yang salah, atau akun diretas. Bila data pribadi terungkap, beri tahu subjek data dan lembaga yang berwenang secara tertulis paling lambat 3 × 24 jam (Pasal 46).</p></div>
        <div class="g-acts">${manage() ? `<button class="btn danger sm" data-inc-new>${icon('shield-alert', 15)}Catat insiden</button>` : ''}</div></div>
      ${list.length ? list.map(r => {
        const due = (r.discoveredAt || 0) + 72 * 3600000;
        return `<div class="panel inc-card ${r.status}"><div class="loc-top">${icon('shield-alert', 18)}<b>${esc(r.title || 'Insiden')}</b>
          ${r.status === 'closed' ? '<span class="chip posted">Selesai</span>' : r.notifiedAt ? '<span class="chip scheduled">Sudah diberitahukan</span>' : `<span class="chip ${due < Date.now() ? 'failed' : 'due'}">Pemberitahuan: ${esc(deadlineText(due))}</span>`}
          <span class="grow"></span><button class="btn sm" data-inc-open="${r.id}">Buka</button></div>
          <p class="faint">Ditemukan ${esc(fmtDateTime(r.discoveredAt))}${r.subjects ? ` · sekitar ${r.subjects} orang terdampak` : ''}</p></div>`;
      }).join('') : '<div class="empty"><p>Tidak ada insiden tercatat. Semoga tetap begitu.</p></div>'}
    </section>
    ${disclaimer}`;
}

// ---------- retention ----------
function retention() {
  const p = S.state.privacy.retention || {};
  const c = S.state.retention.counts || {};
  const row = (k, label, kind, unit = 'bulan') => `
    <div class="set-row"><div class="meta"><b>${label}</b><span>${c[kind] ? `<span class="warn-text">${c[kind]} data melewati masa simpan</span>` : 'Tidak ada yang lewat masa simpan'}</span></div>
      <div class="input-affix sm"><input class="input" type="number" min="1" max="240" data-ret="${k}" value="${esc(p[k])}" ${manage() ? '' : 'disabled'}><span>${unit}</span></div>
      ${manage() && c[kind] ? `<button class="btn danger sm" data-purge="${kind}">Hapus ${c[kind]}</button>` : ''}</div>`;
  return `
    <section class="g-section">
      <div class="g-head"><div><h2>Masa simpan data</h2><p>Data pribadi disimpan hanya selama diperlukan. Atur masa simpan, lalu hapus data yang sudah lewat. Otomatisasi “Pemeriksaan masa simpan data” mengingatkan tiap bulan.</p></div>
        <div class="g-acts">${manage() ? `<button class="btn sm" data-ret-save>${icon('check', 15)}Simpan kebijakan</button>` : ''}</div></div>
      <div class="panel set-list">
        ${row('customersInactiveMonths', 'Pelanggan tidak aktif (sejak kunjungan terakhir)', 'customers')}
        ${row('reviewsMonths', 'Catatan ulasan', 'reviews')}
        ${row('tasksDoneMonths', 'Tugas yang sudah selesai', 'tasks')}
        ${row('dsrMonths', 'Permintaan subjek data yang selesai', 'dsr')}
        ${row('incidentsMonths', 'Insiden yang selesai', 'incidents')}
        ${row('auditMonths', 'Log audit', 'audit')}
      </div>
    </section>
    ${disclaimer}`;
}

// ---------- audit ----------
function audit() {
  const st = S.state.auditStatus || { ok: true, total: 0 };
  const qq = auditQ.trim().toLowerCase();
  const list = [...S.state.audit].reverse().filter(e => !qq || [AUDIT_LABELS[e.action], e.action, e.actorName, e.target, e.detail].join(' ').toLowerCase().includes(qq)).slice(0, 400);
  return `
    <section class="g-section">
      <div class="g-head"><div><h2>Log audit</h2><p>Catatan tindakan penting: akses dan perubahan data pelanggan, persetujuan, ekspor, anggota, kunci, dan lisensi. Setiap catatan mengunci catatan sebelumnya dengan hash, jadi perubahan diam-diam bisa terdeteksi.</p></div>
        <div class="g-acts"><span class="chip ${st.ok ? 'posted' : 'failed'}">${icon(st.ok ? 'badge-check' : 'triangle-alert', 13)}${st.ok ? 'Rantai hash utuh' : `${st.broken} catatan tidak cocok`}</span>
          <button class="btn sm" data-audit-csv>${icon('download', 15)}Ekspor CSV</button></div></div>
      <div class="toolbar"><div class="search">${icon('search', 16)}<input class="input" data-audit-q placeholder="Cari tindakan, orang, atau keterangan" value="${esc(auditQ)}"></div></div>
      ${list.length ? `<div class="panel table-wrap"><table class="table audit-table"><thead><tr><th>Waktu</th><th>Tindakan</th><th>Oleh</th><th>Keterangan</th></tr></thead>
        <tbody>${list.map(e => `<tr><td class="tnum">${esc(fmtDateTime(e.at))}</td><td><b>${esc(AUDIT_LABELS[e.action] || e.action)}</b></td><td>${esc(e.actorName || '—')}</td><td>${esc([e.target, e.detail].filter(Boolean).join(' · '))}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><p>Belum ada catatan.</p></div>'}
    </section>`;
}

// ---------- transparency ----------
function transparency() {
  return `
    <section class="g-section">
      <div class="g-head"><div><h2>Cara Serambi menjaga data</h2><p>Serambi dibuat agar data usahamu tetap milikmu.</p></div></div>
      <div class="tips-grid">
        <div class="tip">${icon('hard-drive', 18)}<b>Tanpa server Serambi</b><p>Serambi tidak punya server penyimpanan. Data tersimpan di komputermu, dan di folder bersama pilihanmu bila memakai tim.</p></div>
        <div class="tip">${icon('eye-off', 18)}<b>Tidak melihat kata sandimu</b><p>Kamu masuk langsung di halaman resmi Instagram, WhatsApp, Tokopedia, dan lainnya. Serambi tidak membaca atau menyimpan kata sandi.</p></div>
        <div class="tip">${icon('circle-x', 18)}<b>Tanpa pelacakan</b><p>Tidak ada analitik, iklan, atau pelaporan pemakaian ke pengembang.</p></div>
        <div class="tip">${icon('lock', 18)}<b>Terenkripsi</b><p>Data di komputer dienkripsi kunci sistem operasi; folder tim dienkripsi AES-256-GCM; PIN disimpan sebagai hash scrypt.</p></div>
        <div class="tip">${icon('send', 18)}<b>Tidak mengirim pesan sendiri</b><p>Otomatisasi hanya menyiapkan pesan. Pesan ke pelanggan baru terkirim setelah kamu menekan kirim di WhatsApp.</p></div>
        <div class="tip">${icon('key-round', 18)}<b>Lisensi luring</b><p>Kunci lisensi diperiksa di komputermu dengan tanda tangan digital. Tidak ada data yang dikirim untuk aktivasi.</p></div>
      </div>
    </section>
    <section class="g-section">
      <div class="g-head"><div><h2>Koneksi yang dibuat Serambi</h2></div></div>
      <div class="panel set-list">
        ${[['globe', 'Platform yang kamu buka', 'Instagram, Facebook, X, TikTok, WhatsApp, Telegram, Tokopedia, Shopee: langsung dari komputermu, seperti browser biasa.'],
          ['refresh-cw', 'GitHub', 'Memeriksa dan mengunduh versi baru Serambi dari halaman Releases resmi.'],
          ['bot', 'Telegram Bot API', 'Hanya bila kamu menghubungkan bot untuk posting otomatis ke channel.'],
          ['search', 'Situs yang kamu periksa', 'Pemeriksa SEO membuka halaman yang kamu masukkan, satu kali.'],
          ['cloud', 'Folder bersama', 'Google Drive/OneDrive/Dropbox menyinkronkan berkas terenkripsi tim; Serambi tidak terhubung ke akun penyimpananmu.']]
          .map(([ic, b, s]) => `<div class="set-row"><span class="upd-icon">${icon(ic, 18)}</span><div class="meta"><b>${b}</b><span>${s}</span></div></div>`).join('')}
      </div>
    </section>
    <section class="g-section">
      <div class="g-head"><div><h2>Tanggung jawab bersama</h2></div></div>
      <p class="muted" style="max-width:72ch">Sebagai pengendali data pribadi, usahamu bertanggung jawab atas data pelanggan yang dicatat. Serambi menyediakan alat: catatan pemrosesan, persetujuan, pemberitahuan privasi, permintaan subjek data, insiden, retensi, kunci, enkripsi, dan log audit. Gunakan sesuai kebutuhan usahamu, dan lindungi juga komputermu dengan kata sandi akun dan enkripsi disk.</p>
    </section>
    ${disclaimer}`;
}

const VIEWS = { overview, security, records, rights, incidents, retention, audit, transparency };

function render() {
  tb.innerHTML = `<h1>Pusat Kepercayaan</h1><span class="grow"></span>`;
  const badge = { rights: S.state.dsr.filter(r => !['closed', 'rejected'].includes(r.status)).length, incidents: S.state.incidents.filter(r => r.status !== 'closed').length };
  root.innerHTML = `<div class="subnav">${tabStrip(TABS.map(([id, l, ic]) => [id, l, ic, badge[id] ? String(badge[id]) : '']), tab)}</div><div class="page trust-page">${(VIEWS[tab] || overview)()}</div>`;
}

// ---------- modals ----------
function pinDialog(mode) {
  const m = openModal({
    title: mode === 'set' ? 'Buat PIN Serambi' : mode === 'change' ? 'Ganti PIN' : 'Matikan kunci aplikasi',
    body: `${mode !== 'set' ? `<div class="field"><label>PIN sekarang</label><input class="input" type="password" inputmode="numeric" data-cur maxlength="64" autocomplete="off" autofocus></div>` : ''}
      ${mode !== 'off' ? `<div class="field"><label>PIN baru</label><input class="input" type="password" inputmode="numeric" data-new maxlength="64" autocomplete="new-password" ${mode === 'set' ? 'autofocus' : ''}><span class="hint">4–8 angka, atau kata sandi minimal 6 karakter.</span></div>
      <div class="field"><label>Ulangi PIN baru</label><input class="input" type="password" inputmode="numeric" data-new2 maxlength="64" autocomplete="new-password"></div>
      <p class="hint">Bila lupa PIN, Serambi bisa direset, tetapi semua login akun dikeluarkan dan data pelanggan di komputer ini dihapus demi keamanan.</p>` : ''}
      <p class="error-text" data-err></p>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn ${mode === 'off' ? 'danger' : 'primary'}" data-yes>${mode === 'off' ? 'Matikan' : 'Simpan PIN'}</button>`
  });
  const err = m.el.querySelector('[data-err]');
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const cur = m.el.querySelector('[data-cur]') ? m.el.querySelector('[data-cur]').value : '';
    if (mode === 'off') {
      const r = await api.disablePin({ current: cur });
      if (!r.ok) { err.textContent = r.error; return; }
      m.close(); toast('Kunci aplikasi dimatikan'); return;
    }
    const a = m.el.querySelector('[data-new]').value, b = m.el.querySelector('[data-new2]').value;
    if (a !== b) { err.textContent = 'PIN baru tidak sama.'; return; }
    const r = await api.setPin({ pin: a, current: cur });
    if (!r.ok) { err.textContent = r.error; return; }
    m.close(); toast(mode === 'set' ? 'Kunci aplikasi aktif' : 'PIN diganti');
  };
}

async function encryptedBackup() {
  const m = openModal({
    title: 'Cadangan terenkripsi',
    body: `<p>Cadangan berisi akun, postingan, pelanggan, ulasan, dan catatan kepatuhan. Login akun dan token bot tidak ikut.</p>
      <div class="field"><label>Kata sandi cadangan</label><input class="input" type="password" data-p1 autocomplete="new-password" autofocus><span class="hint">Minimal 8 karakter. Tanpa kata sandi ini, cadangan tidak bisa dibuka siapa pun, termasuk kamu.</span></div>
      <div class="field"><label>Ulangi kata sandi</label><input class="input" type="password" data-p2 autocomplete="new-password"></div><p class="error-text" data-err></p>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>${icon('file-lock', 15)}Simpan cadangan</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const a = m.el.querySelector('[data-p1]').value, b = m.el.querySelector('[data-p2]').value;
    const err = m.el.querySelector('[data-err]');
    if (a.length < 8) { err.textContent = 'Kata sandi minimal 8 karakter.'; return; }
    if (a !== b) { err.textContent = 'Kata sandi tidak sama.'; return; }
    const r = await api.exportBackup({ password: a });
    if (r.ok) { m.close(); toast('Cadangan terenkripsi disimpan'); }
  };
}

export async function restoreBackup() {
  let r = await api.importBackup({});
  while (r && r.needPassword) {
    const pw = await promptDialog({ title: 'Cadangan terenkripsi', label: r.error ? `${r.error} Coba lagi:` : 'Kata sandi cadangan', type: 'password', maxlength: 200, confirm: 'Buka' });
    if (pw === null) return;
    r = await api.importBackup({ password: pw });
  }
  if (r && r.ok) toast(`Dipulihkan: ${r.accounts} akun, ${r.posts} postingan, ${r.other} data lain. Masuk lagi ke tiap akun.`, { ms: 7000 });
  else if (r && r.error) toast(r.error, { kind: 'err' });
}

function editRopa(idx) {
  const list = [...(S.state.privacy.ropa || [])];
  const r = idx === null ? { id: '', basis: 'consent', controller: S.state.business.name || '' } : list[idx];
  const L = S.legalBases;
  const fld = (k, label, rows = 1) => `<div class="field ${rows > 1 ? 'full' : ''}"><label>${label}</label>${rows > 1 ? `<textarea class="input textarea" rows="${rows}" data-f="${k}" maxlength="600">${esc(r[k] || '')}</textarea>` : `<input class="input" data-f="${k}" value="${esc(r[k] || '')}" maxlength="400">`}</div>`;
  const m = openModal({
    title: idx === null ? 'Tambah kegiatan pemrosesan' : `Ubah: ${r.name}`,
    xl: true,
    body: `<div class="form-grid">
      ${fld('name', 'Nama kegiatan')}${fld('controller', 'Pengendali data')}
      ${fld('purpose', 'Tujuan', 2)}
      <div class="field full"><label>Dasar pemrosesan</label><select class="input" data-f="basis">${Object.entries(L).map(([k, v]) => `<option value="${k}" ${r.basis === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      ${fld('subjects', 'Subjek data')}${fld('source', 'Sumber data')}
      ${fld('data', 'Jenis data pribadi', 2)}
      <label class="check-inline full"><input type="checkbox" data-f="specific" ${r.specific ? 'checked' : ''}> Termasuk data pribadi spesifik (kesehatan, biometrik, genetik, catatan kejahatan, data anak, keuangan pribadi)</label>
      ${fld('recipients', 'Penerima / pihak yang mengakses', 2)}${fld('transfer', 'Transfer ke luar negeri', 2)}
      ${fld('storage', 'Lokasi penyimpanan', 2)}${fld('retention', 'Masa retensi')}${fld('owner', 'Penanggung jawab')}
      ${fld('security', 'Langkah keamanan', 2)}
    </div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Simpan</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    if (!v.name.trim()) { toast('Isi nama kegiatan', { kind: 'err' }); return; }
    if (idx === null) list.push({ ...v, id: '' }); else list[idx] = { ...r, ...v };
    await api.savePrivacy({ ropa: list });
    m.close(); toast('Catatan pemrosesan disimpan');
  };
}

function dsrDialog(r) {
  const x = r || { type: 'access', receivedAt: Date.now(), status: 'open', channel: 'WhatsApp' };
  const isNew = !r;
  const custOpts = perm('customers.view') ? S.state.customers.filter(c => !c.masked).slice(0, 2000) : [];
  const templates = {
    access: 'Halo {nama}, terlampir salinan data pribadi Anda yang kami simpan beserta tujuan penggunaannya. Bila ada yang keliru, kabari kami.',
    port: 'Halo {nama}, terlampir data pribadi Anda dalam format JSON yang umum digunakan.',
    correct: 'Halo {nama}, data Anda sudah kami perbaiki sesuai permintaan. Terima kasih sudah mengabari.',
    erase: 'Halo {nama}, sesuai permintaan, data pribadi Anda sudah kami hapus dari sistem kami. Kami tidak akan menghubungi Anda lagi kecuali Anda memintanya.',
    withdraw: 'Halo {nama}, persetujuan Anda sudah kami tarik. Kami tidak akan mengirim pesan untuk tujuan tersebut lagi.',
    restrict: 'Halo {nama}, pemrosesan data Anda sudah kami batasi sesuai permintaan sampai ada pemberitahuan lebih lanjut.',
    object: 'Halo {nama}, kami tidak memakai keputusan otomatis yang berdampak pada Anda. Bila ada keberatan lain, silakan sampaikan.',
    info: 'Halo {nama}, berikut penjelasan tentang data yang kami kumpulkan, tujuan, dan hak Anda: (tempel pemberitahuan privasi).'
  };
  const m = openModal({
    title: isNew ? 'Catat permintaan subjek data' : `Permintaan: ${S.dsrTypes[x.type] || x.type}`,
    xl: true,
    body: `
      ${!isNew ? `<div class="dsr-due">${dsrStatus(x)}<span class="faint">Tenggat ${esc(fmtDateTime(x.dueAt))}</span></div>` : ''}
      <div class="form-grid">
        <div class="field"><label>Jenis permintaan</label><select class="input" data-f="type">${Object.entries(S.dsrTypes).map(([k, v]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
        <div class="field"><label>Diterima</label><input class="input" type="datetime-local" data-f="received" value="${new Date(x.receivedAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}"></div>
        <div class="field"><label>Nama pemohon</label><input class="input" data-f="name" value="${esc(x.name || '')}" maxlength="80"></div>
        <div class="field"><label>Kontak</label><input class="input" data-f="contact" value="${esc(x.contact || '')}" maxlength="120"></div>
        <div class="field"><label>Lewat</label><input class="input" data-f="channel" value="${esc(x.channel || '')}" maxlength="40" placeholder="WhatsApp, email, langsung"></div>
        ${custOpts.length ? `<div class="field"><label>Pelanggan terkait</label><select class="input" data-f="customerId"><option value="">—</option>${custOpts.map(c => `<option value="${c.id}" ${x.customerId === c.id ? 'selected' : ''}>${esc(c.name)} · ${esc(prettyPhone(c.phone))}</option>`).join('')}</select></div>` : ''}
        <div class="field full"><label>Isi permintaan</label><textarea class="input textarea" rows="2" data-f="detail" maxlength="2000">${esc(x.detail || '')}</textarea></div>
        <label class="check-inline full"><input type="checkbox" data-f="verified" ${x.verified ? 'checked' : ''}> Identitas pemohon sudah dipastikan</label>
        ${!isNew ? `<div class="field full"><label>Tanggapan</label><textarea class="input textarea" rows="3" data-f="response" maxlength="4000">${esc(x.response || (templates[x.type] || '').replace('{nama}', String(x.name || '').split(' ')[0] || 'Kak'))}</textarea></div>` : ''}
      </div>
      ${!isNew && x.customerId ? `<div class="row-btns"><b>Tindakan untuk pelanggan:</b>
        ${['access', 'port'].includes(x.type) ? `<button class="btn sm" data-act="dossier">${icon('file-down', 14)}Salinan data</button>` : ''}
        ${x.type === 'erase' ? `<button class="btn danger sm" data-act="erase">${icon('user-x', 14)}Hapus data pelanggan</button>` : ''}
        ${x.type === 'withdraw' ? `<button class="btn sm" data-act="withdraw">${icon('x', 14)}Tarik semua persetujuan</button>` : ''}
        ${x.type === 'restrict' ? `<button class="btn sm" data-act="restrict">${icon('eye-off', 14)}Batasi pemrosesan</button>` : ''}
        ${x.type === 'correct' ? `<button class="btn sm" data-act="open">${icon('pencil', 14)}Buka data pelanggan</button>` : ''}
      </div>` : ''}
      ${!isNew && (x.log || []).length ? `<details class="consent-hist"><summary>Riwayat (${x.log.length}) ${icon('chevron-down', 14)}</summary><ul>${x.log.map(l => `<li>${esc(fmtDateTime(l.at))} · ${esc(l.by || '')} · ${esc(l.text)}</li>`).join('')}</ul></details>` : ''}`,
    foot: isNew ? `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-save>Catat</button>`
      : `<button class="btn ghost danger" data-del>${icon('trash-2', 15)}Hapus catatan</button><span style="flex:1"></span><button class="btn ghost" data-copy-resp>${icon('copy', 15)}Salin tanggapan</button><button class="btn" data-save>Simpan</button><button class="btn primary" data-close-req>${icon('check', 15)}Selesai & tutup</button>`
  });
  const payload = (extra = {}) => {
    const v = readForm(m.el);
    return { id: x.id, type: v.type, name: v.name, contact: v.contact, channel: v.channel, detail: v.detail, verified: v.verified, customerId: v.customerId || x.customerId || null,
      receivedAt: v.received ? new Date(v.received).getTime() : x.receivedAt, ...(isNew ? {} : { response: v.response }), ...extra };
  };
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if ('no' in b.dataset) return m.close();
    if ('save' in b.dataset) { await api.saveDsr(payload(isNew ? {} : { status: x.status === 'open' ? 'progress' : x.status })); m.close(); return toast(isNew ? 'Permintaan dicatat. Tenggat 3 × 24 jam.' : 'Disimpan'); }
    if ('closeReq' in b.dataset) { await api.saveDsr(payload({ status: 'closed', logText: 'Ditanggapi dan ditutup' })); m.close(); return toast('Permintaan selesai'); }
    if ('copyResp' in b.dataset) { await api.copyText(m.el.querySelector('[data-f="response"]').value); return toast('Tanggapan disalin'); }
    if ('del' in b.dataset) { if (await confirmDialog({ title: 'Hapus catatan permintaan?', message: 'Sebaiknya simpan catatan permintaan sebagai bukti kepatuhan. Hapus hanya bila salah catat.', confirm: 'Hapus', danger: true })) { await api.removeDsr(x.id); m.close(); } return; }
    const act = b.dataset.act;
    if (!act) return;
    const cid = x.customerId;
    if (act === 'dossier') {
      const data = await api.customerDossier(cid);
      const r2 = await api.saveFile({ content: JSON.stringify(data, null, 2), fileName: `data-${String(x.name || 'pelanggan').toLowerCase().replace(/[^\w-]+/g, '-')}.json`, kind: 'json' });
      if (r2.ok) await api.saveDsr({ id: x.id, logText: 'Salinan data dibuat' });
    } else if (act === 'erase') {
      if (!await confirmDialog({ title: 'Hapus data pelanggan permanen?', message: 'Tidak bisa dibatalkan.', confirm: 'Hapus permanen', danger: true })) return;
      await api.eraseCustomer({ id: cid, reason: 'Permintaan subjek data' });
      await api.saveDsr({ id: x.id, logText: 'Data pelanggan dihapus' });
      toast('Data pelanggan dihapus');
    } else if (act === 'withdraw') {
      for (const p of Object.keys(S.consentPurposes)) await api.setConsent({ id: cid, purpose: p, status: 'withdrawn', method: 'pesan', evidence: 'Permintaan subjek data' });
      await api.saveDsr({ id: x.id, logText: 'Semua persetujuan ditarik' });
      toast('Persetujuan ditarik');
    } else if (act === 'restrict') {
      await api.saveCustomer({ id: cid, restricted: true, restrictedReason: 'Permintaan subjek data' });
      await api.saveDsr({ id: x.id, logText: 'Pemrosesan dibatasi' });
      toast('Pemrosesan dibatasi');
    } else if (act === 'open') { m.close(); go({ name: 'customers' }); }
  });
}

function incidentDialog(r) {
  const x = r || { discoveredAt: Date.now(), status: 'open', checklist: {}, severity: 'sedang' };
  const isNew = !r;
  const biz = S.state.business;
  const ck = [['contain', 'Hentikan kebocoran (ganti kata sandi, cabut akses, keluarkan perangkat)'], ['assess', 'Nilai data apa yang terungkap dan siapa yang terdampak'], ['notify_subjects', 'Beri tahu subjek data secara tertulis'], ['notify_authority', 'Beri tahu lembaga yang berwenang secara tertulis'], ['public', 'Umumkan ke masyarakat bila mengganggu pelayanan publik atau berdampak serius'], ['document', 'Catat penyebab dan langkah pencegahan']];
  const due = (x.discoveredAt || Date.now()) + 72 * 3600000;
  const letter = (who) => `${who === 'authority' ? 'Kepada Yth.\nLembaga yang berwenang di bidang Pelindungan Data Pribadi' : 'Kepada Yth. Pelanggan ' + (biz.name || 'kami')}

Perihal: Pemberitahuan kegagalan pelindungan data pribadi

Dengan ini ${biz.name || '[nama usaha]'}${biz.city ? ', ' + biz.city : ''}, memberitahukan bahwa telah terjadi kegagalan pelindungan data pribadi dengan keterangan sebagai berikut:

1. Data pribadi yang terungkap: ${x.dataTypes || '[jenis data]'}
2. Waktu dan cara data terungkap: ${x.occurredAt ? fmtDateTime(x.occurredAt) : '[waktu]'}${x.cause ? '. ' + x.cause : ''}
3. Perkiraan jumlah subjek data terdampak: ${x.subjects || '[jumlah]'}
4. Upaya penanganan: ${x.containment || '[langkah yang sudah dilakukan]'}
5. Upaya pemulihan dan pencegahan: ${x.recovery || '[langkah pemulihan]'}

${who === 'authority' ? 'Insiden ini kami ketahui pada ' + fmtDateTime(x.discoveredAt) + '.' : 'Kami mohon maaf atas kejadian ini. Bila ada pesan mencurigakan yang mengatasnamakan kami, jangan berikan kode OTP atau data apa pun.'}
Narahubung: ${(S.state.privacy.ppdp && S.state.privacy.ppdp.name) || '[nama]'} ${biz.whatsapp ? '· WhatsApp ' + prettyPhone(biz.whatsapp) : ''}

${fmtDateLong(Date.now())}
${biz.name || ''}`;
  const m = openModal({
    title: isNew ? 'Catat insiden' : (x.title || 'Insiden'),
    xl: true,
    body: `
      ${!isNew && x.status !== 'closed' ? `<div class="warning ${due < Date.now() && !x.notifiedAt ? '' : 'info'}">${icon('timer', 15)}<span>Batas pemberitahuan tertulis: <b>${esc(fmtDateTime(due))}</b> (${esc(deadlineText(due))}). UU PDP Pasal 46: paling lambat 3 × 24 jam.</span></div>` : ''}
      <div class="form-grid">
        <div class="field full"><label>Judul singkat</label><input class="input" data-f="title" value="${esc(x.title || '')}" maxlength="140" placeholder="Misalnya: Ponsel kasir hilang"></div>
        <div class="field"><label>Diketahui pada</label><input class="input" type="datetime-local" data-f="disc" value="${new Date((x.discoveredAt || Date.now()) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}"></div>
        <div class="field"><label>Terjadi pada (perkiraan)</label><input class="input" type="datetime-local" data-f="occ" value="${x.occurredAt ? new Date(x.occurredAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}"></div>
        <div class="field"><label>Perkiraan orang terdampak</label><input class="input" type="number" min="0" data-f="subjects" value="${esc(x.subjects || '')}"></div>
        <div class="field"><label>Tingkat</label><select class="input" data-f="severity">${['rendah', 'sedang', 'tinggi'].map(s => `<option ${x.severity === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field full"><label>Data yang terungkap</label><input class="input" data-f="dataTypes" value="${esc(x.dataTypes || '')}" maxlength="600" placeholder="Nama dan nomor WhatsApp pelanggan"></div>
        <div class="field full"><label>Apa yang terjadi</label><textarea class="input textarea" rows="2" data-f="description" maxlength="3000">${esc(x.description || '')}</textarea></div>
        <div class="field"><label>Penyebab</label><textarea class="input textarea" rows="2" data-f="cause" maxlength="2000">${esc(x.cause || '')}</textarea></div>
        <div class="field"><label>Penanganan</label><textarea class="input textarea" rows="2" data-f="containment" maxlength="2000">${esc(x.containment || '')}</textarea></div>
        <div class="field full"><label>Pemulihan & pencegahan</label><textarea class="input textarea" rows="2" data-f="recovery" maxlength="2000">${esc(x.recovery || '')}</textarea></div>
      </div>
      <div class="panel checklist">${ck.map(([k, l]) => `<label class="check-row ${x.checklist && x.checklist[k] ? 'done' : ''}"><input type="checkbox" data-ck="${k}" ${x.checklist && x.checklist[k] ? 'checked' : ''}><span class="box">${icon('check', 13)}</span><span class="meta"><b>${esc(l)}</b></span></label>`).join('')}</div>
      ${!isNew ? `<div class="row-btns"><button class="btn sm" data-letter="subjects">${icon('mail', 14)}Surat untuk subjek data</button><button class="btn sm" data-letter="authority">${icon('mail', 14)}Surat untuk lembaga</button>
        <label class="check-inline"><input type="checkbox" data-notified-s ${x.notifiedSubjectsAt ? 'checked' : ''}> Subjek data sudah diberi tahu</label>
        <label class="check-inline"><input type="checkbox" data-notified-a ${x.notifiedAuthorityAt ? 'checked' : ''}> Lembaga sudah diberi tahu</label></div>` : ''}`,
    foot: isNew ? `<button class="btn ghost" data-no>Batal</button><button class="btn danger" data-save>Catat insiden</button>`
      : `<button class="btn ghost danger" data-del>${icon('trash-2', 15)}Hapus</button><span style="flex:1"></span><button class="btn" data-save>Simpan</button>${x.status !== 'closed' ? `<button class="btn primary" data-close-inc>${icon('check', 15)}Tandai selesai</button>` : ''}`
  });
  const payload = (extra = {}) => {
    const v = readForm(m.el);
    const checklist = Object.fromEntries([...m.el.querySelectorAll('[data-ck]')].map(i => [i.dataset.ck, i.checked]));
    const ns = m.el.querySelector('[data-notified-s]'), na = m.el.querySelector('[data-notified-a]');
    return { id: x.id, title: v.title, description: v.description, dataTypes: v.dataTypes, cause: v.cause, containment: v.containment, recovery: v.recovery, severity: v.severity, subjects: v.subjects,
      discoveredAt: v.disc ? new Date(v.disc).getTime() : x.discoveredAt, occurredAt: v.occ ? new Date(v.occ).getTime() : null, checklist,
      ...(ns ? { notifiedSubjectsAt: ns.checked ? (x.notifiedSubjectsAt || Date.now()) : null } : {}), ...(na ? { notifiedAuthorityAt: na.checked ? (x.notifiedAuthorityAt || Date.now()) : null } : {}), ...extra };
  };
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if ('no' in b.dataset) return m.close();
    if ('save' in b.dataset) { await api.saveIncident(payload()); m.close(); return toast(isNew ? 'Insiden dicatat. Ikuti daftar langkahnya.' : 'Insiden disimpan'); }
    if ('closeInc' in b.dataset) { await api.saveIncident(payload({ status: 'closed' })); m.close(); return toast('Insiden ditandai selesai'); }
    if ('del' in b.dataset) { if (await confirmDialog({ title: 'Hapus catatan insiden?', message: 'Catatan insiden adalah bukti penanganan. Hapus hanya bila salah catat.', confirm: 'Hapus', danger: true })) { await api.removeIncident(x.id); m.close(); } return; }
    if (b.dataset.letter) {
      const text = letter(b.dataset.letter);
      const lm = openModal({ title: b.dataset.letter === 'authority' ? 'Surat untuk lembaga' : 'Surat untuk subjek data', wide: true,
        body: `<p class="hint">Lengkapi bagian dalam kurung siku. Kirim secara tertulis (email, surat, atau pesan) dan simpan buktinya.</p><textarea class="input textarea" rows="16" data-letter-text>${esc(text)}</textarea>`,
        foot: `<button class="btn ghost" data-pdf>${icon('printer', 15)}PDF</button><button class="btn primary" data-copy>${icon('copy', 15)}Salin</button>` });
      lm.el.querySelector('[data-copy]').onclick = async () => { await api.copyText(lm.el.querySelector('[data-letter-text]').value); toast('Surat disalin'); };
      lm.el.querySelector('[data-pdf]').onclick = () => api.savePdf({ fileName: 'pemberitahuan-insiden.pdf', html: textDocument({ biz, title: 'Pemberitahuan kegagalan pelindungan data pribadi', text: lm.el.querySelector('[data-letter-text]').value }) });
    }
  });
}

// ---------- events ----------
async function onClick(e) {
  const b = e.target.closest('button, [data-tab]');
  if (!b) return;
  const ds = b.dataset;
  try {
    if (ds.tab) { tab = ds.tab; try { localStorage.setItem('trustTab', tab); } catch (_) {} root.scrollTop = 0; return render(); }
    if (ds.fix) { if (ds.fix === 'team') return go({ name: 'team' }); tab = ds.fix; return render(); }
    if ('report' in ds) {
      const st = S.state;
      const counts = { 'Pelanggan': st.customers.length, 'Ulasan': st.reviews.length, 'Permintaan subjek data': st.dsr.length, 'Insiden': st.incidents.length, 'Anggota tim': st.members.filter(m => m.status === 'active').length || 1 };
      return api.savePdf({ fileName: `laporan-pdp-${toDateInput(Date.now())}.pdf`, html: complianceReport({ biz: st.business, compliance: st.compliance, counts, plan: st.plan, auditStatus: st.auditStatus }) });
    }
    if ('pinSet' in ds) return pinDialog('set');
    if ('pinChange' in ds) return pinDialog('change');
    if ('pinOff' in ds) return pinDialog('off');
    if ('lockNow' in ds) return api.lock();
    if ('backupEnc' in ds) return encryptedBackup();
    if ('restore' in ds) return restoreBackup();
    if ('logoutAll' in ds) {
      if (!await confirmDialog({ title: 'Keluar dari semua akun?', message: 'Semua login media sosial dan toko di Serambi dihapus dari komputer ini. Akun tetap ada di daftar; masuk lagi saat diperlukan.', confirm: 'Keluar dari semua', danger: true })) return;
      const r = await api.logoutAll();
      toast(`${r.count} akun dikeluarkan. Muat ulang tiap akun untuk masuk lagi.`);
      return;
    }
    if ('ropaSave' in ds) { await api.savePrivacy({ ropa: S.state.privacy.ropa }); return toast('Catatan pemrosesan disimpan sebagai catatan resmi'); }
    if ('ropaAdd' in ds) return editRopa(null);
    if (ds.ropaEdit !== undefined) return editRopa(Number(ds.ropaEdit));
    if (ds.ropaRm !== undefined) {
      const list = [...S.state.privacy.ropa]; const it = list[Number(ds.ropaRm)];
      if (!await confirmDialog({ title: `Hapus “${it.name}”?`, message: 'Hapus hanya bila kegiatan ini tidak lagi dilakukan.', confirm: 'Hapus', danger: true })) return;
      list.splice(Number(ds.ropaRm), 1); await api.savePrivacy({ ropa: list }); return;
    }
    if ('ropaPdf' in ds) return api.savePdf({ fileName: 'catatan-pemrosesan-data.pdf', html: ropaDocument({ biz: S.state.business, ropa: S.state.privacy.ropa || [], legalBases: S.legalBases }) });
    if ('goCustomers' in ds) return go({ name: 'customers' });
    if ('noticeRegen' in ds) { root.querySelector('[data-notice]').value = noticeText(); return toast('Disusun ulang dari profil bisnis dan catatan pemrosesan', { kind: 'info' }); }
    if ('noticeCopy' in ds) { await api.copyText(root.querySelector('[data-notice]').value); return toast('Pemberitahuan privasi disalin'); }
    if ('noticePdf' in ds) return api.savePdf({ fileName: 'pemberitahuan-privasi.pdf', html: textDocument({ biz: S.state.business, title: 'Pemberitahuan Privasi', text: root.querySelector('[data-notice]').value }) });
    if ('noticePublish' in ds) {
      const text = root.querySelector('[data-notice]').value.trim();
      if (text.length < 200) return toast('Pemberitahuan terlalu singkat', { kind: 'err' });
      await api.savePrivacy({ notice: { text } });
      return toast('Pemberitahuan privasi diterbitkan. Persetujuan baru dicatat dengan versi ini.');
    }
    if ('ppSave' in ds) {
      const g = (k) => root.querySelector(`[data-pp="${k}"]`);
      await api.savePrivacy({ ppdp: { name: g('name').value, email: g('email').value, phone: g('phone').value, required: g('required').checked } });
      return toast('Penanggung jawab disimpan');
    }
    if ('dsrNew' in ds) return dsrDialog(null);
    if (ds.dsrOpen) return dsrDialog(S.state.dsr.find(r => r.id === ds.dsrOpen));
    if ('incNew' in ds) return incidentDialog(null);
    if (ds.incOpen) return incidentDialog(S.state.incidents.find(r => r.id === ds.incOpen));
    if ('retSave' in ds) {
      const ret = Object.fromEntries([...root.querySelectorAll('[data-ret]')].map(i => [i.dataset.ret, Number(i.value)]));
      await api.savePrivacy({ retention: ret });
      return toast('Kebijakan retensi disimpan');
    }
    if (ds.purge) {
      const n = (S.state.retention.counts || {})[ds.purge];
      if (!await confirmDialog({ title: `Hapus ${n} data yang lewat masa simpan?`, message: 'Data dihapus permanen dari Serambi (dan ruang kerja tim). Buat cadangan terenkripsi dulu bila perlu.', confirm: 'Hapus', danger: true })) return;
      await api.purgeRetention({ kinds: [ds.purge] });
      return toast('Data lama dihapus');
    }
    if ('auditCsv' in ds) {
      const rows = [['waktu', 'tindakan', 'kode', 'oleh', 'sasaran', 'keterangan', 'perangkat', 'hash']];
      for (const x of S.state.audit) rows.push([new Date(x.at).toISOString(), AUDIT_LABELS[x.action] || x.action, x.action, x.actorName, x.target, x.detail, x.device, x.hash]);
      const r = await api.saveFile({ content: csv(rows), fileName: `log-audit-${toDateInput(Date.now())}.csv`, kind: 'csv' });
      if (r.ok) toast('Log audit diekspor');
    }
  } catch (err) { toast(err.message, { kind: 'err', ms: 6000 }); }
}
async function onChange(e) {
  const t = e.target;
  try {
    if (t.dataset.sec) await api.securitySettings({ [t.dataset.sec]: t.checked });
    if (t.matches('[data-autolock]')) await api.securitySettings({ autoLockMin: Number(t.value) });
    if (t.dataset.dpia) {
      const answers = Object.fromEntries([...root.querySelectorAll('[data-dpia]')].map(i => [i.dataset.dpia, i.checked]));
      await api.savePrivacy({ dpia: { answers } });
    }
  } catch (err) { toast(err.message, { kind: 'err' }); render(); }
}
function onInput(e) {
  if (e.target.matches('[data-audit-q]')) { auditQ = e.target.value; const pos = e.target.selectionStart; render(); const i = root.querySelector('[data-audit-q]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }
}

export default {
  mount(el, titlebar, route) {
    root = el; tb = titlebar;
    let saved = null; try { saved = localStorage.getItem('trustTab'); } catch (_) {}
    tab = route.tab || saved || 'overview';
    if (!VIEWS[tab]) tab = 'overview';
    root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput);
    render();
  },
  update() {
    if (root.contains(document.activeElement) && document.activeElement.matches('textarea, input[type="text"], input:not([type]), input[type="number"], input[type="email"]')) return;
    const y = root.scrollTop; render(); root.scrollTop = y;
  },
  unmount() { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); root.removeEventListener('input', onInput); }
};
