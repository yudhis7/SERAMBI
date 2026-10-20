// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Personal data protection helpers (UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi).
// These tools help a small business keep its records in order. They are not legal advice.
const { verifyAudit } = require('./security');

const DAY = 86400000;
const MONTH = 30.44 * DAY;

const LEGAL_BASES = {
  consent: 'Persetujuan yang sah secara eksplisit (Pasal 20 ayat 2 huruf a)',
  contract: 'Pemenuhan kewajiban perjanjian dengan subjek data (huruf b)',
  legal: 'Pemenuhan kewajiban hukum (huruf c)',
  vital: 'Pelindungan kepentingan vital subjek data (huruf d)',
  public: 'Kepentingan umum, pelayanan publik, atau kewenangan (huruf e)',
  legitimate: 'Kepentingan yang sah lainnya (huruf f)'
};

const DEFAULT_RETENTION = {
  customersInactiveMonths: 24,
  reviewsMonths: 36,
  tasksDoneMonths: 6,
  dsrMonths: 24,
  auditMonths: 24,
  incidentsMonths: 60
};

function defaultRopa(biz) {
  const ctrl = (biz && biz.name) || 'Usaha ini';
  const security = 'Enkripsi data di perangkat (kunci sistem operasi), enkripsi AES-256-GCM di folder tim, kunci aplikasi (PIN), pembatasan akses berdasarkan peran, log audit.';
  const storage = 'Komputer tim yang memakai Serambi; folder bersama tim (bila dipakai) di layanan penyimpanan awan pilihan usaha.';
  return [
    {
      id: 'crm', name: 'Data pelanggan', controller: ctrl,
      purpose: 'Melayani pelanggan, mencatat kunjungan/pesanan, dan menghubungi pelanggan untuk keperluan layanan.',
      basis: 'contract', subjects: 'Pelanggan', data: 'Nama, nomor WhatsApp/telepon, email (opsional), cabang, riwayat kunjungan, catatan layanan.',
      specific: false, source: 'Langsung dari pelanggan', recipients: 'Pemilik dan anggota tim yang diberi akses data pelanggan.',
      transfer: 'Tidak ada, kecuali penyimpanan folder tim berada di server penyedia awan di luar Indonesia.', storage,
      retention: 'Dihapus 24 bulan setelah kunjungan terakhir, atau lebih cepat bila diminta pelanggan.', security, owner: 'Pemilik usaha'
    },
    {
      id: 'promo', name: 'Pesan promosi lewat WhatsApp', controller: ctrl,
      purpose: 'Mengirim info promo, produk baru, dan sapaan kepada pelanggan yang setuju.',
      basis: 'consent', subjects: 'Pelanggan yang memberi persetujuan', data: 'Nama panggilan, nomor WhatsApp, riwayat kunjungan terakhir.',
      specific: false, source: 'Langsung dari pelanggan', recipients: 'Anggota tim yang mengirim pesan; WhatsApp (Meta) sebagai sarana pengiriman.',
      transfer: 'Pesan dikirim lewat WhatsApp yang servernya dapat berada di luar Indonesia.', storage,
      retention: 'Sampai persetujuan ditarik atau 24 bulan tanpa kunjungan.', security, owner: 'Pemilik usaha'
    },
    {
      id: 'review', name: 'Permintaan & pengelolaan ulasan', controller: ctrl,
      purpose: 'Meminta pelanggan memberi ulasan, mencatat dan membalas ulasan publik.',
      basis: 'consent', subjects: 'Pelanggan; pengulas di Google/marketplace', data: 'Nama panggilan, nomor WhatsApp; nama pengulas dan isi ulasan publik.',
      specific: false, source: 'Pelanggan; halaman ulasan publik', recipients: 'Anggota tim yang mengelola ulasan.',
      transfer: 'Tidak ada.', storage, retention: 'Catatan ulasan 36 bulan.', security, owner: 'Pemilik usaha'
    },
    {
      id: 'birthday', name: 'Ucapan ulang tahun', controller: ctrl,
      purpose: 'Mengirim ucapan dan penawaran ulang tahun kepada pelanggan yang setuju.',
      basis: 'consent', subjects: 'Pelanggan yang memberi persetujuan', data: 'Nama panggilan, nomor WhatsApp, tanggal lahir.',
      specific: false, source: 'Langsung dari pelanggan', recipients: 'Anggota tim yang mengirim ucapan.',
      transfer: 'Tidak ada.', storage, retention: 'Tanggal lahir dihapus saat persetujuan ditarik.', security, owner: 'Pemilik usaha'
    },
    {
      id: 'team', name: 'Data anggota tim', controller: ctrl,
      purpose: 'Mengatur akses dan pembagian tugas di Serambi.',
      basis: 'contract', subjects: 'Anggota tim', data: 'Nama, email, peran, nama perangkat, catatan aktivitas (log audit).',
      specific: false, source: 'Anggota tim', recipients: 'Pemilik dan admin tim.',
      transfer: 'Sama dengan lokasi folder tim.', storage, retention: 'Selama menjadi anggota; log audit 24 bulan.', security, owner: 'Pemilik usaha'
    },
    {
      id: 'rights', name: 'Permintaan hak subjek data & insiden', controller: ctrl,
      purpose: 'Menanggapi permintaan pelanggan atas datanya dan mencatat kegagalan pelindungan data.',
      basis: 'legal', subjects: 'Pelanggan; pihak yang terdampak insiden', data: 'Nama, kontak, isi permintaan, tanggal dan tanggapan.',
      specific: false, source: 'Subjek data; temuan internal', recipients: 'Pemilik, admin, dan Pejabat Pelindungan Data Pribadi bila ada.',
      transfer: 'Tidak ada.', storage, retention: 'Permintaan 24 bulan; insiden 60 bulan.', security, owner: 'Pemilik usaha'
    }
  ];
}

function retentionOf(privacy) { return { ...DEFAULT_RETENTION, ...((privacy && privacy.retention) || {}) }; }

/** Records older than the retention policy. */
function retentionReport(data, now = Date.now()) {
  const r = retentionOf(data.privacy);
  const old = (ts, months) => ts && now - ts > months * MONTH;
  const customers = data.customers.filter(c => !c.erased && old(c.lastVisitAt || c.createdAt, r.customersInactiveMonths));
  const reviews = data.reviews.filter(x => old(x.date || x.createdAt, r.reviewsMonths));
  const tasks = data.tasks.filter(t => t.status === 'done' && old(t.doneAt, r.tasksDoneMonths));
  const dsr = data.dsr.filter(x => x.status === 'closed' && old(x.closedAt || x.receivedAt, r.dsrMonths));
  const audit = data.audit.filter(x => old(x.at, r.auditMonths));
  const incidents = data.incidents.filter(x => x.status === 'closed' && old(x.closedAt || x.discoveredAt, r.incidentsMonths));
  return {
    policy: r,
    counts: { customers: customers.length, reviews: reviews.length, tasks: tasks.length, dsr: dsr.length, audit: audit.length, incidents: incidents.length },
    total: customers.length + reviews.length + tasks.length + dsr.length + audit.length + incidents.length,
    ids: { customers: customers.map(x => x.id), reviews: reviews.map(x => x.id), tasks: tasks.map(x => x.id), dsr: dsr.map(x => x.id), audit: audit.map(x => x.id), incidents: incidents.map(x => x.id) }
  };
}

const DSR_TYPES = {
  access: 'Akses & salinan data (Pasal 7)',
  correct: 'Perbaikan data (Pasal 6)',
  erase: 'Penghapusan data (Pasal 8)',
  withdraw: 'Penarikan persetujuan (Pasal 9)',
  object: 'Keberatan atas keputusan otomatis (Pasal 10)',
  restrict: 'Penundaan atau pembatasan pemrosesan (Pasal 11)',
  port: 'Salinan dalam format umum / portabilitas (Pasal 13)',
  info: 'Informasi tentang pemrosesan (Pasal 5)'
};
const RESPONSE_HOURS = 72; // 3 × 24 jam (PP 33/2026, berlaku 16 Januari 2027)

function hasRecentConsentGap(data) {
  const active = data.customers.filter(c => !c.erased);
  const missing = active.filter(c => !(c.consents || []).length).length;
  return { total: active.length, missing };
}

/**
 * Compliance checklist shown in the Trust Center.
 * Each item: { id, label, ref, ok, detail, tab }
 */
function compliance(data, { lockOn, encOn, now = Date.now() }) {
  const p = data.privacy || {};
  const ropa = p.ropa || [];
  const notice = p.notice;
  const ret = retentionReport(data, now);
  const overdueDsr = data.dsr.filter(x => x.status !== 'closed' && x.dueAt && x.dueAt < now).length;
  const openIncidentsLate = data.incidents.filter(x => x.status !== 'closed' && !x.notifiedAt && x.discoveredAt && now - x.discoveredAt > 72 * 3600000).length;
  const consent = hasRecentConsentGap(data);
  const lastBackup = data.settings.lastBackupAt;
  const auditOk = verifyAudit(data.audit).ok;
  // In a team, the owner reviews who may see customer data at least every 6 months.
  const reviewedAt = data.wsMeta && data.wsMeta.accessReviewedAt;
  const teamRoles = !data.workspace || !!(reviewedAt && now - reviewedAt < 183 * DAY);
  const items = [
    { id: 'ropa', label: 'Catatan kegiatan pemrosesan data dibuat', ref: 'Pasal 31', ok: ropa.length > 0 && !!p.ropaReviewedAt, detail: ropa.length ? (p.ropaReviewedAt ? `${ropa.length} kegiatan tercatat` : 'Tinjau dan simpan catatan yang disiapkan Serambi') : 'Belum ada catatan', tab: 'records' },
    { id: 'notice', label: 'Pemberitahuan privasi diterbitkan untuk pelanggan', ref: 'Pasal 21', ok: !!(notice && notice.publishedAt), detail: notice && notice.publishedAt ? `Versi ${notice.version}` : 'Buat dari templat di tab Data & persetujuan', tab: 'records' },
    { id: 'consent', label: 'Persetujuan pelanggan tercatat', ref: 'Pasal 20 & 22', ok: consent.total === 0 || consent.missing === 0, detail: consent.total ? (consent.missing ? `${consent.missing} dari ${consent.total} pelanggan belum punya catatan persetujuan` : 'Semua pelanggan punya catatan') : 'Belum ada data pelanggan', tab: 'records' },
    { id: 'lock', label: 'Kunci aplikasi (PIN) aktif', ref: 'Pasal 35', ok: !!lockOn, detail: lockOn ? 'Serambi terkunci otomatis saat ditinggal' : 'Aktifkan di tab Keamanan', tab: 'security' },
    { id: 'enc', label: 'Data di perangkat ini terenkripsi', ref: 'Pasal 35', ok: !!encOn, detail: encOn ? 'Dienkripsi dengan kunci sistem operasi' : 'Enkripsi tidak aktif di perangkat ini', tab: 'security' },
    { id: 'access', label: 'Akses data pelanggan dibatasi dan ditinjau', ref: 'Pasal 35', ok: teamRoles, detail: !data.workspace ? 'Hanya kamu yang memakai Serambi ini' : reviewedAt ? 'Ditinjau ' + new Date(reviewedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tinjau siapa yang boleh melihat data pelanggan di menu Tim', tab: 'team' },
    { id: 'retention', label: 'Tidak ada data yang melewati masa simpan', ref: 'Prinsip pembatasan penyimpanan', ok: ret.total === 0, detail: ret.total ? `${ret.total} data perlu ditinjau` : 'Sesuai kebijakan retensi', tab: 'retention' },
    { id: 'dsr', label: 'Permintaan subjek data ditanggapi tepat waktu', ref: 'Pasal 5–13', ok: overdueDsr === 0, detail: overdueDsr ? `${overdueDsr} permintaan melewati 3×24 jam` : 'Tidak ada yang terlambat', tab: 'rights' },
    { id: 'incident', label: 'Insiden dilaporkan dalam 3×24 jam', ref: 'Pasal 46', ok: openIncidentsLate === 0, detail: openIncidentsLate ? `${openIncidentsLate} insiden belum diberitahukan` : 'Tidak ada insiden terlambat', tab: 'incidents' },
    { id: 'ppdp', label: 'Penanggung jawab pelindungan data ditunjuk', ref: 'Pasal 53', ok: !!(p.ppdp && p.ppdp.name), detail: p.ppdp && p.ppdp.name ? p.ppdp.name : 'Tunjuk penanggung jawab (wajib PPDP untuk kriteria tertentu)', tab: 'records' },
    { id: 'backup', label: 'Cadangan terenkripsi dibuat dalam 30 hari terakhir', ref: 'Pasal 35', ok: !!(lastBackup && now - lastBackup < 30 * DAY), detail: lastBackup ? new Date(lastBackup).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Belum pernah', tab: 'security' },
    { id: 'audit', label: 'Log audit utuh', ref: 'Pasal 31 & 35', ok: auditOk, detail: auditOk ? `${data.audit.length} catatan, rantai hash cocok` : 'Ada catatan yang berubah atau hilang', tab: 'audit' }
  ];
  return { items, done: items.filter(i => i.ok).length, total: items.length };
}

module.exports = { LEGAL_BASES, DEFAULT_RETENTION, defaultRopa, retentionOf, retentionReport, DSR_TYPES, RESPONSE_HOURS, compliance };
