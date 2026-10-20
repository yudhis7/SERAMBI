// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Calendar of marketing moments for Indonesian local businesses.
// National holidays and cuti bersama follow the SKB 3 Menteri for 2026 and 2027.
// Dates of religious holidays can shift after the government's isbat session; Ramadan start is an estimate.
//
// kind: libur (national holiday) | cuti (cuti bersama) | belanja (shopping campaign) | peringatan (observance)

const M = [
  // ---- 2026 (from late October) ----
  ['2026-10-28', 'Hari Sumpah Pemuda', 'peringatan', 'Angkat cerita anak muda di balik usahamu: pegawai, pemasok, atau pelanggan setia.'],
  ['2026-11-10', 'Hari Pahlawan', 'peringatan', 'Terima kasih untuk “pahlawan” usahamu: kurir, petani pemasok, atau pelanggan pertama.'],
  ['2026-11-11', 'Harbolnas 11.11', 'belanja', 'Siapkan voucher toko di Tokopedia/Shopee dan umumkan di semua akun sehari sebelumnya.'],
  ['2026-11-25', 'Hari Guru Nasional', 'peringatan', 'Diskon khusus guru dengan menunjukkan kartu, atau ucapan untuk guru di sekitar tokomu.'],
  ['2026-12-12', 'Harbolnas 12.12', 'belanja', 'Puncak belanja online akhir tahun. Jadwalkan pengingat H-3, H-1, dan pagi hari H.'],
  ['2026-12-22', 'Hari Ibu', 'peringatan', 'Paket hadiah untuk ibu, atau cerita ibu-ibu pejuang usaha di sekitarmu.'],
  ['2026-12-24', 'Cuti bersama Natal', 'cuti', 'Umumkan jam buka selama libur panjang dan jadwal pengiriman terakhir sebelum Natal.'],
  ['2026-12-25', 'Hari Raya Natal', 'libur', 'Ucapan Natal yang hangat. Sebutkan jam buka toko selama libur.'],
  ['2026-12-31', 'Malam Tahun Baru', 'belanja', 'Promo akhir tahun dan ajakan untuk mampir di awal tahun.'],
  // ---- 2027 ----
  ['2027-01-01', 'Tahun Baru 2027 Masehi', 'libur', 'Ucapan tahun baru dan rangkuman setahun usahamu: terima kasih untuk pelanggan.'],
  ['2027-01-05', 'Isra Mikraj Nabi Muhammad SAW', 'libur', 'Ucapan singkat dan informasi jam buka.'],
  ['2027-02-05', 'Cuti bersama Tahun Baru Imlek', 'cuti', 'Informasikan jam buka dan stok untuk kebutuhan Imlek.'],
  ['2027-02-06', 'Tahun Baru Imlek 2578 Kongzili', 'libur', 'Ucapan Gong Xi Fa Cai, menu atau paket bernuansa merah-emas.'],
  ['2027-02-08', 'Awal Ramadan 1448 H (perkiraan)', 'peringatan', 'Siapkan jadwal buka-sahur, menu takjil, dan jam operasional selama Ramadan.', true],
  ['2027-02-14', 'Hari Valentine', 'belanja', 'Paket berdua atau hadiah kecil untuk orang tersayang.'],
  ['2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)', 'libur', 'Ucapan hari suci Nyepi; informasikan toko tutup bila di Bali.'],
  ['2027-03-09', 'Cuti bersama Idulfitri', 'cuti', 'Informasi jam buka selama libur Lebaran dan batas pemesanan.'],
  ['2027-03-10', 'Hari Raya Idulfitri 1448 H', 'libur', 'Ucapan Selamat Idulfitri, mohon maaf lahir dan batin.'],
  ['2027-03-11', 'Hari Raya Idulfitri 1448 H (hari kedua)', 'libur', 'Sapa pelanggan yang mudik; info kapan toko buka kembali.'],
  ['2027-03-12', 'Cuti bersama Idulfitri', 'cuti', 'Pengingat jam buka setelah Lebaran.'],
  ['2027-03-15', 'Cuti bersama Idulfitri', 'cuti', 'Umumkan toko buka kembali dan promo “halalbihalal”.'],
  ['2027-03-25', 'Cuti bersama Wafat Yesus Kristus', 'cuti', 'Informasi jam buka akhir pekan panjang.'],
  ['2027-03-26', 'Wafat Yesus Kristus', 'libur', 'Ucapan yang khidmat dan informasi jam buka.'],
  ['2027-03-28', 'Hari Kebangkitan Yesus Kristus (Paskah)', 'libur', 'Ucapan Selamat Paskah.'],
  ['2027-04-21', 'Hari Kartini', 'peringatan', 'Kisah perempuan hebat di tim atau pelangganmu.'],
  ['2027-05-01', 'Hari Buruh Internasional', 'libur', 'Apresiasi untuk tim dan pekerja di sekitar usahamu.'],
  ['2027-05-02', 'Hari Pendidikan Nasional', 'peringatan', 'Promo pelajar atau berbagi ilmu seputar usahamu.'],
  ['2027-05-06', 'Kenaikan Yesus Kristus', 'libur', 'Ucapan dan informasi jam buka.'],
  ['2027-05-17', 'Hari Raya Iduladha 1448 H', 'libur', 'Ucapan Iduladha dan info pesanan menjelang hari raya.'],
  ['2027-05-18', 'Cuti bersama Iduladha', 'cuti', 'Informasi jam buka.'],
  ['2027-05-19', 'Cuti bersama Waisak', 'cuti', 'Informasi jam buka libur panjang.'],
  ['2027-05-20', 'Hari Raya Waisak 2571 BE', 'libur', 'Ucapan Selamat Hari Waisak.'],
  ['2027-06-01', 'Hari Lahir Pancasila', 'libur', 'Nilai gotong royong dalam usahamu.'],
  ['2027-06-06', 'Tahun Baru Islam 1449 H', 'libur', 'Ucapan tahun baru Hijriah.'],
  ['2027-07-12', 'Tahun ajaran baru (perkiraan)', 'belanja', 'Promo perlengkapan sekolah, seragam, atau paket keluarga.', true],
  ['2027-07-23', 'Hari Anak Nasional', 'peringatan', 'Kegiatan atau promo ramah anak.'],
  ['2027-08-12', 'Hari UMKM Nasional', 'peringatan', 'Ceritakan perjalanan usahamu dan ajak pelanggan mendukung UMKM lokal.'],
  ['2027-08-15', 'Maulid Nabi Muhammad SAW', 'libur', 'Ucapan Maulid Nabi.'],
  ['2027-08-17', 'Hari Kemerdekaan RI ke-82', 'libur', 'Promo bertema 17-an (misalnya diskon 17% atau 8,2%), lomba, dan dekorasi merah putih.'],
  ['2027-09-04', 'Hari Pelanggan Nasional', 'belanja', 'Hari terbaik untuk berterima kasih: voucher khusus pelanggan setia dan minta ulasan.'],
  ['2027-09-09', 'Promo 9.9', 'belanja', 'Kampanye tanggal kembar di Tokopedia/Shopee.'],
  ['2027-10-02', 'Hari Batik Nasional', 'peringatan', 'Ajak tim berbatik, unggah foto bersama.'],
  ['2027-10-10', 'Promo 10.10', 'belanja', 'Kampanye tanggal kembar di Tokopedia/Shopee.'],
  ['2027-10-28', 'Hari Sumpah Pemuda', 'peringatan', 'Cerita anak muda di balik usahamu.'],
  ['2027-11-10', 'Hari Pahlawan', 'peringatan', 'Terima kasih untuk “pahlawan” usahamu.'],
  ['2027-11-11', 'Harbolnas 11.11', 'belanja', 'Voucher toko dan pengumuman sehari sebelumnya.'],
  ['2027-11-25', 'Hari Guru Nasional', 'peringatan', 'Promo atau ucapan untuk guru.'],
  ['2027-12-12', 'Harbolnas 12.12', 'belanja', 'Puncak belanja online akhir tahun.'],
  ['2027-12-22', 'Hari Ibu', 'peringatan', 'Paket hadiah untuk ibu.'],
  ['2027-12-24', 'Cuti bersama Natal', 'cuti', 'Jam buka dan pengiriman terakhir sebelum Natal.'],
  ['2027-12-25', 'Hari Raya Natal', 'libur', 'Ucapan Natal dan jam buka selama libur.'],
  ['2027-12-26', 'Isra Mikraj Nabi Muhammad SAW', 'libur', 'Ucapan singkat dan informasi jam buka.']
];

const KIND = {
  libur: 'Libur nasional',
  cuti: 'Cuti bersama',
  belanja: 'Momen belanja',
  peringatan: 'Hari peringatan',
  gajian: 'Gajian'
};

function list() {
  const out = M.map(([date, name, kind, idea, estimate]) => ({ id: 'm' + date.replace(/-/g, '') + '_' + kind[0], date, name, kind, idea, estimate: !!estimate }));
  // Payday (end of month) is the most reliable monthly sales moment for many local businesses.
  for (let y = 2026; y <= 2027; y++) {
    for (let mo = 0; mo < 12; mo++) {
      const date = `${y}-${String(mo + 1).padStart(2, '0')}-25`;
      if (date < '2026-10-25') continue;
      out.push({ id: 'g' + date.replace(/-/g, ''), date, name: 'Gajian (tanggal 25)', kind: 'gajian', idea: 'Pengingat promo “gajian” mulai tanggal 25 sampai awal bulan.', estimate: false });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = { MOMENTS: list(), MOMENT_KIND: KIND };
