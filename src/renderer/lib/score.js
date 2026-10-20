// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Local growth score (0–100) and the next best actions. The score only uses data in Serambi,
// so it measures how well the basics are in place, not your ranking on Google.
import { napCompare } from './seo.js';

export const GBP_ITEMS = [
  ['verified', 'Profil sudah diverifikasi Google', 'Tanpa verifikasi, profil tidak tampil penuh di Penelusuran dan Maps.'],
  ['category', 'Kategori utama paling tepat dipilih', 'Kategori adalah sinyal terkuat untuk pencarian lokal. Tambahkan kategori pendukung bila relevan.'],
  ['hours', 'Jam buka lengkap', 'Pelanggan sering mencari “buka sekarang”.'],
  ['special_hours', 'Jam khusus hari libur diisi', 'Isi sebelum Lebaran, Natal, dan libur panjang supaya pelanggan tidak kecewa.'],
  ['phone', 'Nomor telepon/WhatsApp aktif', 'Gunakan nomor yang sama dengan di situs dan media sosial.'],
  ['website', 'Situs atau link toko diisi', 'Boleh link Tokopedia/Shopee atau halaman Instagram bila belum punya situs.'],
  ['description', 'Deskripsi bisnis berisi layanan dan area', 'Maksimal 750 karakter. Tulis apa yang dijual, untuk siapa, dan di mana.'],
  ['photos', 'Minimal 10 foto asli', 'Tampak depan, suasana dalam, produk, dan tim. Tambah foto baru tiap bulan.'],
  ['products', 'Produk/layanan dan harga diisi', 'Membantu Google mencocokkan pencarian dengan usahamu.'],
  ['attributes', 'Atribut diisi', 'Misalnya: menerima QRIS, ada parkir, ramah keluarga.'],
  ['posts', 'Posting update rutin tiap minggu', 'Promo, produk baru, atau acara. Serambi bisa mengingatkan tiap minggu.'],
  ['reviews_reply', 'Semua ulasan dibalas', 'Balas ulasan baik dan buruk dengan sopan, sebaiknya dalam 1–2 hari.'],
  ['service_area', 'Area layanan diatur (bila antar/jemput)', 'Untuk usaha yang mendatangi pelanggan, misalnya servis AC atau laundry antar-jemput.']
];

export const LISTING_SOURCES = [
  ['google', 'Profil Bisnis Google'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tokopedia', 'Tokopedia'],
  ['shopee', 'Shopee'], ['gofood', 'GoFood/GrabFood'], ['website', 'Situs web']
];

const DAY = 86400000;

export function locationGbpPct(loc) {
  const g = loc.gbp || {};
  return GBP_ITEMS.filter(([k]) => g[k]).length / GBP_ITEMS.length;
}

export function napStats(biz, loc) {
  const master = { name: biz.name || loc.name, address: loc.address, phone: loc.phone || biz.phone || biz.whatsapp };
  let ok = 0, total = 0;
  const rows = [];
  for (const [k, label] of LISTING_SOURCES) {
    const l = (loc.listings || {})[k];
    if (!l || !(l.name || l.address || l.phone)) continue;
    const c = napCompare(master, l);
    rows.push({ key: k, label, listing: l, cmp: c });
    for (const v of Object.values(c)) if (v !== null) { total++; if (v) ok++; }
  }
  return { ok, total, ratio: total ? ok / total : null, rows, master };
}

export function reviewStats(reviews, now = Date.now()) {
  const n = reviews.length;
  const avg = n ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / n : null;
  const recent = reviews.filter(r => (r.date || 0) > now - 90 * DAY).length;
  const replied = reviews.filter(r => r.reply).length;
  const unreplied = n - replied;
  const replyRate = n ? replied / n : null;
  const dist = [5, 4, 3, 2, 1].map(s => reviews.filter(r => Number(r.rating) === s).length);
  const times = reviews.filter(r => r.reply && r.repliedAt && r.date).map(r => r.repliedAt - r.date).filter(t => t >= 0);
  const replyHours = times.length ? times.reduce((a, b) => a + b, 0) / times.length / 3600000 : null;
  return { n, avg, recent, replied, unreplied, replyRate, dist, replyHours };
}

/**
 * Returns { score, parts:[{id,label,got,max,detail}], actions:[{title, detail, go:{name,tab}, gain}] }
 */
export function growthScore(st, now = Date.now()) {
  const biz = st.business || {};
  const locs = st.locations || [];
  const parts = [];
  const actions = [];

  // 1. Business profile (15)
  const profileItems = [
    [!!biz.name, 'nama usaha'], [!!biz.category, 'kategori'], [!!(biz.whatsapp || biz.phone), 'nomor WhatsApp/telepon'],
    [!!biz.city, 'kota'], [String(biz.description || '').length >= 200, 'deskripsi (minimal 200 karakter)'],
    [(biz.services || []).length >= 3, 'minimal 3 layanan/produk'], [!!(biz.hours || locs.some(l => l.hours)), 'jam buka'], [locs.length > 0, 'lokasi usaha']
  ];
  const pGot = profileItems.filter(x => x[0]).length / profileItems.length * 15;
  parts.push({ id: 'profile', label: 'Profil bisnis', got: pGot, max: 15, detail: profileItems.filter(x => !x[0]).map(x => x[1]).join(', ') || 'Lengkap' });
  if (pGot < 15) actions.push({ title: 'Lengkapi profil bisnis', detail: 'Belum ada: ' + profileItems.filter(x => !x[0]).map(x => x[1]).slice(0, 3).join(', ') + '.', go: { name: 'growth', tab: 'discover' }, gain: 15 - pGot });

  // 2. Google Business Profile checklist (20)
  const gbp = locs.length ? locs.reduce((s, l) => s + locationGbpPct(l), 0) / locs.length : 0;
  parts.push({ id: 'gbp', label: 'Profil Bisnis Google', got: gbp * 20, max: 20, detail: locs.length ? `${Math.round(gbp * 100)}% daftar periksa terpenuhi` : 'Tambahkan lokasi dulu' });
  if (gbp < 0.85) actions.push({ title: 'Rapikan Profil Bisnis Google', detail: 'Centang daftar periksa satu per satu di konsol resmi Google.', go: { name: 'growth', tab: 'discover' }, gain: (1 - gbp) * 20 });

  // 3. NAP consistency (10)
  const naps = locs.map(l => napStats(biz, l)).filter(x => x.ratio !== null);
  const nap = naps.length ? naps.reduce((s, x) => s + x.ratio, 0) / naps.length : 0;
  parts.push({ id: 'nap', label: 'Nama, alamat & nomor seragam', got: nap * 10, max: 10, detail: naps.length ? `${Math.round(nap * 100)}% cocok di semua platform` : 'Belum ada data platform untuk dibandingkan' });
  if (nap < 0.9) actions.push({ title: 'Samakan nama, alamat, dan nomor di semua platform', detail: 'Data yang berbeda-beda membingungkan Google dan pelanggan.', go: { name: 'growth', tab: 'discover', section: 'nap' }, gain: (1 - nap) * 10 });

  // 4. Website / SEO (15)
  const seos = locs.map(l => l.seo).filter(Boolean);
  const seo = seos.length ? seos.reduce((s, x) => s + (x.score || 0), 0) / seos.length / 100 : 0;
  parts.push({ id: 'seo', label: 'Situs web siap pencarian lokal', got: seo * 15, max: 15, detail: seos.length ? `Skor pemeriksaan ${Math.round(seo * 100)}` : (biz.website ? 'Belum diperiksa' : 'Belum ada situs') });
  if (seo < 0.8) actions.push({ title: biz.website ? 'Periksa dan perbaiki SEO situs' : 'Siapkan situs atau halaman sederhana', detail: biz.website ? 'Pemeriksa SEO lokal memberi daftar perbaikan yang jelas.' : 'Halaman sederhana dengan nama, alamat, nomor, dan data terstruktur sudah sangat membantu.', go: { name: 'growth', tab: 'discover', section: 'seo' }, gain: (1 - seo) * 15 });

  // 5. Reviews (20)
  const rv = reviewStats(st.reviews || [], now);
  const rAvg = rv.avg === null ? 0 : Math.max(0, Math.min(1, (rv.avg - 3.5) / 1.3));
  const rRecent = Math.min(1, rv.recent / 10);
  const rReply = rv.replyRate === null ? 0 : rv.replyRate;
  const rGot = rAvg * 8 + rRecent * 6 + rReply * 6;
  parts.push({ id: 'reviews', label: 'Ulasan & kepercayaan', got: rGot, max: 20, detail: rv.n ? `${rv.avg.toFixed(1).replace('.', ',')}★ · ${rv.recent} ulasan 90 hari terakhir · ${Math.round(rReply * 100)}% dibalas` : 'Belum ada ulasan tercatat' });
  if (rv.unreplied) actions.push({ title: `Balas ${rv.unreplied} ulasan`, detail: 'Calon pelanggan membaca balasanmu sebelum memutuskan.', go: { name: 'growth', tab: 'reviews' }, gain: (1 - rReply) * 6 });
  if (rRecent < 1) actions.push({ title: 'Minta ulasan dari semua pelanggan', detail: 'Kirim link ulasan lewat WhatsApp atau pasang kartu QR di kasir.', go: { name: 'growth', tab: 'reviews', section: 'ask' }, gain: (1 - rRecent) * 6 });

  // 6. Posting rhythm (12)
  const posted = (st.posts || []).filter(p => (p.postedAt || 0) > now - 28 * DAY).length;
  const pr = Math.min(1, posted / 8);
  parts.push({ id: 'posting', label: 'Rutin posting', got: pr * 12, max: 12, detail: `${posted} postingan terkirim 4 minggu terakhir` });
  if (pr < 1) actions.push({ title: 'Jadwalkan 2 postingan per minggu', detail: 'Pakai kalender momen dan otomatisasi “Posting rutin mingguan”.', go: { name: 'compose' }, gain: (1 - pr) * 12 });

  // 7. Automations (8)
  const on = (st.automations || []).filter(a => a.enabled);
  const au = Math.min(1, on.length / 3);
  parts.push({ id: 'auto', label: 'Pemasaran otomatis', got: au * 8, max: 8, detail: `${on.length} otomatisasi aktif` });
  if (au < 1) actions.push({ title: 'Nyalakan otomatisasi harian', detail: 'Minta ulasan, ucapan ulang tahun, dan pengingat momen bekerja sendiri.', go: { name: 'growth', tab: 'automate' }, gain: (1 - au) * 8 });

  const score = Math.round(parts.reduce((s, p) => s + p.got, 0));
  actions.sort((a, b) => b.gain - a.gain);
  return { score, parts, actions, reviews: rv };
}
