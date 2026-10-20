// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Contoh penggunaan Serambi. Every business here is fictional and the numbers are targets
// to aim for, not results achieved by a real company.

export const USE_CASES = [
  {
    id: 'kopi', name: 'Kopi Senja', type: 'Kedai kopi', city: 'Sleman', tier: 'solo', people: 'Pemilik + 2 barista (pemilik yang memegang Serambi)', icon: 'coffee',
    summary: 'Kedai kopi dekat kampus yang ramai di akhir pekan, ingin hari kerja ikut ramai dan ulasan Google bertambah.',
    accounts: ['instagram', 'tiktok', 'whatsapp'],
    challenge: ['Pengunjung hari kerja sepi, ramai hanya Sabtu–Minggu.', 'Baru 14 ulasan Google, banyak yang belum dibalas.', 'Posting Instagram tidak rutin karena sibuk melayani.'],
    setup: [
      { title: 'Lengkapi profil bisnis', detail: 'Kategori “Kedai kopi”, layanan: kopi susu gula aren, manual brew, roti bakar, wifi. Area: Depok, Caturtunggal.', link: { route: 'growth', tab: 'discover' } },
      { title: 'Rapikan Profil Bisnis Google', detail: 'Centang daftar periksa: jam buka, 10 foto (etalase, suasana, menu), atribut “wifi gratis”, “menerima QRIS”.', link: { route: 'growth', tab: 'discover' } },
      { title: 'Pasang kartu QR ulasan di meja', detail: 'Cetak kartu dari tab Ulasan, laminasi, letakkan di tiap meja dan kasir.', link: { route: 'growth', tab: 'reviews' } },
      { title: 'Nyalakan otomatisasi', detail: 'Minta ulasan sehari setelah berkunjung, posting rutin “Promo Kamis”, dan pengingat balas ulasan.', link: { route: 'growth', tab: 'automate' } }
    ],
    routine: [['Senin', 'Tinjau laporan mingguan dan balas ulasan baru'], ['Selasa', 'Rekam 2 video pendek (proses seduh, menu baru) untuk TikTok & Reels'], ['Kamis', 'Postingan otomatis “Promo Kamis: kopi kedua setengah harga” terkirim'], ['Jumat', 'Posting update di Profil Bisnis Google'], ['Setiap hari', 'Catat pelanggan langganan yang setuju dihubungi']],
    automations: [
      { type: 'review_request', name: 'Minta ulasan setelah berkunjung', config: { afterDays: 1, message: 'Halo {nama}, makasih sudah ngopi di {usaha}! Kalau berkenan, ceritakan pengalamanmu di sini ya: {link} ☕' } },
      { type: 'weekly_post', name: 'Promo Kamis', config: { weekday: 4, time: '10:00', mode: 'draft', text: 'Kamis waktunya ngopi! ☕ Kopi kedua setengah harga, khusus hari ini sampai jam 17.00. Tunjukkan postingan ini di kasir.\n\n#kopisleman #kopijogja #ngopidekatkampus' } },
      { type: 'review_reply', name: 'Pengingat balas ulasan', config: { hours: 24 } }
    ],
    templates: [
      { name: 'Penutup postingan Kopi Senja', text: '📍 Jl. Kaliurang Km 5, Sleman · Buka 08.00–22.00\nPesan lewat WhatsApp: (nomor kamu)\n#kopisleman #kopijogja' },
      { name: 'Menu baru', text: 'Menu baru! ✨ [nama menu]: [rasa dan bahan singkat]. Cobain minggu ini dan ceritakan pendapatmu di kolom komentar 👇' }
    ],
    metrics: ['Ulasan Google baru: target 6–10 per bulan', 'Ulasan dibalas dalam 24 jam: 100%', 'Pengunjung Senin–Kamis: naik dari minggu ke minggu', 'Skor pertumbuhan lokal: di atas 70'],
    pdp: ['Catat pelanggan hanya bila mereka setuju; tanyakan saat membayar (“Mau dikabari promo lewat WhatsApp?”).', 'Minta ulasan ke semua pelanggan, bukan hanya yang terlihat puas.'],
    business: { category: 'Kedai kopi', services: ['kopi susu gula aren', 'manual brew', 'roti bakar', 'tempat nongkrong'], keywords: ['wifi kencang', 'dekat kampus', 'colokan banyak'] }
  },
  {
    id: 'laundry', name: 'Bersih Wangi Laundry', type: 'Laundry kiloan', city: 'Bekasi', tier: 'solo', people: 'Pemilik + 1 kurir', icon: 'washing-machine',
    summary: 'Laundry kiloan dengan antar-jemput yang ingin muncul di pencarian “laundry terdekat” dan menjaga pelanggan langganan.',
    accounts: ['whatsapp', 'instagram', 'facebook'],
    challenge: ['Pelanggan baru hanya dari mulut ke mulut.', 'Banyak pelanggan lama berhenti tanpa kabar.', 'Belum pernah beriklan dan takut boros.'],
    setup: [
      { title: 'Atur area layanan di Profil Bisnis Google', detail: 'Isi kecamatan yang dijangkau kurir. Usaha antar-jemput tetap bisa muncul di Maps.', link: { route: 'growth', tab: 'discover' } },
      { title: 'Hitung anggaran iklan dulu', detail: 'Di Perencana anggaran: Rp25.000/hari, biaya klik Rp1.200, 6% jadi pelanggan, belanja Rp60.000, margin 45%.', link: { route: 'growth', tab: 'ads' } },
      { title: 'Buat kampanye Google Ads kecil', detail: 'Kata kunci frasa “laundry kiloan bekasi”, “laundry antar jemput”, radius 3 km, jam iklan 07.00–20.00.', link: { route: 'growth', tab: 'ads' } },
      { title: 'Sapa pelanggan yang lama tidak datang', detail: 'Nyalakan otomatisasi sapaan setelah 30 hari, dengan penawaran gratis setrika 1 kg.', link: { route: 'growth', tab: 'automate' } }
    ],
    routine: [['Senin', 'Catat hasil iklan minggu lalu (klik, chat WhatsApp, pelanggan baru)'], ['Rabu', 'Posting tips perawatan pakaian'], ['Setiap hari', 'Kirim tugas WhatsApp yang disiapkan otomatisasi (sapaan & minta ulasan)'], ['Sabtu', 'Posting promo akhir pekan']],
    automations: [
      { type: 'winback', name: 'Sapa pelanggan 30 hari tidak laundry', config: { days: 30, message: 'Halo {nama}, cucian menumpuk? 😄 {usaha} siap jemput hari ini. Khusus Kakak: gratis setrika 1 kg minggu ini.' } },
      { type: 'review_request', name: 'Minta ulasan setelah cucian diantar', config: { afterDays: 1, message: 'Halo {nama}, cuciannya sudah sampai? Bagaimana hasilnya? Ceritakan lewat ulasan singkat di sini ya, masukanmu membantu kami: {link} 🙏' } },
      { type: 'gbp_weekly', name: 'Posting mingguan Profil Bisnis Google', config: { weekday: 3 } }
    ],
    templates: [{ name: 'Info antar-jemput', text: 'Antar-jemput GRATIS minimal 3 kg untuk area [kecamatan]. Chat WhatsApp: (nomor kamu) · Selesai 1×24 jam.' }],
    metrics: ['Biaya per pelanggan baru dari iklan: di bawah batas impas', 'Pelanggan kembali setelah disapa: dihitung tiap bulan', 'Ulasan Google: minimal 4,7★'],
    pdp: ['Alamat jemput adalah data pribadi; simpan di catatan hanya bila perlu dan hapus bila pelanggan berhenti.', 'Tawarkan pelanggan memilih: mau dikabari promo atau hanya notifikasi cucian.'],
    business: { category: 'Laundry', services: ['laundry kiloan', 'laundry antar jemput', 'cuci sepatu', 'cuci karpet'], keywords: ['selesai 1 hari', 'antar jemput gratis'] }
  },
  {
    id: 'kue', name: 'Dapur Bu Rina', type: 'Toko kue rumahan', city: 'Malang', tier: 'solo', people: 'Pemilik dibantu keluarga', icon: 'cake-slice',
    summary: 'Kue rumahan yang berjualan lewat Instagram, WhatsApp, dan Shopee, ramai musiman saat Lebaran, Natal, dan Imlek.',
    accounts: ['instagram', 'whatsapp', 'shopee', 'facebook'],
    challenge: ['Pesanan hampers datang mendadak dan sering kewalahan.', 'Promosi momen sering terlambat.', 'Pelanggan ulang tahun terlewat padahal kue ulang tahun produk utama.'],
    setup: [
      { title: 'Hubungkan Shopee dan atur link toko', detail: 'Sisipkan link toko di setiap postingan Instagram dengan tombol “Link toko”.', link: { route: 'settings' } },
      { title: 'Siapkan konten momen 14 hari sebelumnya', detail: 'Otomatisasi membuat draf dan tugas untuk Lebaran, Imlek, Natal, dan Hari Ibu.', link: { route: 'growth', tab: 'automate' } },
      { title: 'Ucapan ulang tahun pelanggan', detail: 'Catat tanggal lahir hanya bagi pelanggan yang setuju, lalu nyalakan otomatisasi ucapan.', link: { route: 'customers' } },
      { title: 'Jadikan ulasan bintang 5 sebagai testimoni', detail: 'Di tab Ulasan, tombol “Jadikan testimoni” membuat postingan dengan nama yang disingkat.', link: { route: 'growth', tab: 'reviews' } }
    ],
    routine: [['Senin', 'Cek kalender momen 3 minggu ke depan'], ['Rabu', 'Posting foto proses membuat kue'], ['Jumat', 'Posting testimoni pelanggan'], ['H-14 momen', 'Buka pre-order hampers']],
    automations: [
      { type: 'moment_prep', name: 'Pre-order momen 14 hari sebelumnya', config: { daysBefore: 14, kinds: ['libur', 'belanja', 'peringatan'], draft: true } },
      { type: 'birthday', name: 'Ucapan ulang tahun', config: { message: 'Selamat ulang tahun, {nama}! 🎂 Semoga bahagia selalu. Ada diskon 15% kue ulang tahun dari {usaha} untuk Kakak bulan ini.' } }
    ],
    templates: [{ name: 'Pre-order hampers', text: 'PRE-ORDER HAMPERS [momen] dibuka! 🎁\nIsi: [isi hampers]\nHarga: [harga]\nBatas pesan: [tanggal]\nPesan lewat WhatsApp atau Shopee (link di bawah).' }],
    metrics: ['Pre-order dibuka paling lambat H-14 setiap momen', 'Pesanan ulang tahun dari ucapan otomatis: dihitung per bulan', 'Ulasan Shopee & Google dibalas semua'],
    pdp: ['Tanggal lahir hanya disimpan dengan persetujuan “ucapan ulang tahun”, dan otomatis terhapus bila persetujuan ditarik.', 'Testimoni dari chat pribadi perlu izin pelanggan sebelum diunggah.'],
    business: { category: 'Toko kue & roti', services: ['kue ulang tahun', 'hampers lebaran', 'kue kering', 'bolu'], keywords: ['pesan antar', 'custom'] }
  },
  {
    id: 'barber', name: 'Rapi Kece Barbershop', type: 'Barbershop', city: 'Bandung', tier: 'small', people: '6 orang: pemilik, 4 kapster, 1 admin', icon: 'scissors',
    summary: 'Barbershop dengan admin yang mengurus media sosial dan kapster yang ikut membuat konten, butuh persetujuan sebelum posting.',
    accounts: ['instagram', 'tiktok', 'whatsapp', 'facebook'],
    challenge: ['Kapster ingin ikut posting hasil potongan, tetapi pemilik ingin menjaga kualitas.', 'Booking lewat WhatsApp berantakan antar-shift.', 'Pelanggan kembali rata-rata 6 minggu, banyak yang lupa.'],
    setup: [
      { title: 'Buat ruang kerja tim di Google Drive', detail: 'Pemilik membuat ruang kerja, admin jadi Admin, kapster jadi Editor tanpa akses data pelanggan.', link: { route: 'team' } },
      { title: 'Aktifkan persetujuan postingan', detail: 'Postingan kapster masuk “Menunggu persetujuan”; admin menyetujui atau memberi komentar.', link: { route: 'team' } },
      { title: 'Sapa pelanggan setelah 35 hari', detail: 'Otomatisasi menyiapkan pesan “Sudah waktunya rapikan rambut?” untuk dikirim admin.', link: { route: 'growth', tab: 'automate' } },
      { title: 'Kirim permintaan ulasan setelah potong', detail: 'Admin mengirim dari tugas harian; kapster bisa meminta pelanggan memindai QR di cermin.', link: { route: 'growth', tab: 'reviews' } }
    ],
    routine: [['Setiap hari', 'Kapster mengajukan 1 foto/video hasil potongan'], ['Setiap hari', 'Admin menyetujui dan menjadwalkan; membalas ulasan'], ['Senin', 'Pemilik meninjau laporan mingguan dan tugas tim'], ['Akhir bulan', 'Tinjau akses anggota tim']],
    automations: [
      { type: 'winback', name: 'Pengingat potong rambut 35 hari', config: { days: 35, message: 'Halo {nama}, sudah 5 minggu sejak potong terakhir di {usaha}. Mau booking jam berapa minggu ini? ✂️' } },
      { type: 'review_request', name: 'Minta ulasan setelah potong', config: { afterDays: 0, message: 'Makasih sudah potong di {usaha}, {nama}! Bagaimana pengalamanmu? Ceritakan lewat ulasan singkat di sini ya: {link}' } },
      { type: 'weekly_report', name: 'Laporan mingguan untuk pemilik', config: { weekday: 1, time: '08:00' } }
    ],
    templates: [{ name: 'Caption hasil potongan', text: 'Fresh cut by [nama kapster] ✂️ Gaya: [nama gaya].\nBooking: WhatsApp (nomor) · Buka 10.00–21.00\n#barbershopbandung #potongrambutpria' }],
    metrics: ['Postingan disetujui dalam 2 jam kerja', 'Pelanggan kembali dalam 6 minggu: naik', 'Rating Google: minimal 4,8★'],
    pdp: ['Kapster tidak perlu akses data pelanggan; cukup admin dan pemilik.', 'Foto pelanggan untuk konten hanya dengan izin; catat izinnya di komentar postingan.'],
    business: { category: 'Barbershop', services: ['potong rambut pria', 'cukur jenggot', 'hair coloring', 'perm pria'], keywords: ['booking WhatsApp', 'tanpa antre'] }
  },
  {
    id: 'klinik', name: 'Klinik Gigi Senyum Sehat', type: 'Klinik gigi', city: 'Surabaya', tier: 'small', people: '8 orang: 2 dokter, perawat, resepsionis, admin', icon: 'stethoscope',
    summary: 'Klinik yang ingin lebih dikenal di sekitarnya tanpa melanggar kerahasiaan pasien: contoh penerapan Pusat Kepercayaan.',
    accounts: ['instagram', 'whatsapp', 'facebook'],
    challenge: ['Data kesehatan termasuk data pribadi spesifik, jadi harus ekstra hati-hati.', 'Komputer resepsionis dipakai bergantian.', 'Ulasan negatif kadang menyebut detail perawatan.'],
    setup: [
      { title: 'Jangan simpan data kesehatan di Serambi', detail: 'Catatan medis tetap di sistem rekam medis klinik. Di Serambi cukup nama panggilan, nomor WhatsApp, dan persetujuan.', link: { route: 'trust', tab: 'records' } },
      { title: 'Isi cek risiko tinggi dan tunjuk penanggung jawab', detail: 'Tinjau penilaian dampak, tunjuk penanggung jawab pelindungan data, dan terbitkan pemberitahuan privasi.', link: { route: 'trust', tab: 'records' } },
      { title: 'Kunci aplikasi di komputer resepsionis', detail: 'Aktifkan PIN dan kunci otomatis 5 menit.', link: { route: 'trust', tab: 'security' } },
      { title: 'Balas ulasan tanpa menyebut detail pasien', detail: 'Gunakan templat balasan; ajak lanjut lewat jalur pribadi.', link: { route: 'growth', tab: 'reviews' } }
    ],
    routine: [['Senin', 'Posting edukasi kesehatan gigi (tanpa foto pasien)'], ['Rabu', 'Admin membalas ulasan; dokter menyetujui konten edukasi'], ['Setiap hari', 'Resepsionis mengunci Serambi saat meninggalkan meja'], ['Bulanan', 'Pemeriksaan masa simpan data dan peninjauan akses']],
    automations: [
      { type: 'review_reply', name: 'Pengingat balas ulasan', config: { hours: 24 } },
      { type: 'retention_check', name: 'Pemeriksaan masa simpan data', config: {} },
      { type: 'moment_prep', name: 'Konten hari peringatan', config: { daysBefore: 7, kinds: ['peringatan', 'libur'], draft: true } }
    ],
    templates: [{ name: 'Balasan ulasan klinik (aman)', text: 'Terima kasih atas masukannya. Demi menjaga kerahasiaan, kami tidak membahas detail perawatan di sini. Mohon hubungi kami lewat WhatsApp (nomor) agar dapat kami bantu langsung.' }],
    metrics: ['Daftar periksa Pusat Kepercayaan: 12/12', 'Tidak ada data kesehatan di catatan pelanggan', 'Semua ulasan dibalas tanpa detail medis'],
    pdp: ['Data kesehatan adalah data pribadi spesifik (UU PDP Pasal 4 ayat 2).', 'Pertimbangkan penilaian dampak untuk pemrosesan data pasien di sistem klinik.', 'Tanggapi permintaan pasien atas datanya paling lambat 3 × 24 jam.'],
    business: { category: 'Klinik gigi', services: ['scaling', 'tambal gigi', 'kawat gigi', 'pemutihan gigi'], keywords: ['dokter gigi terdekat', 'ramah anak'] }
  },
  {
    id: 'bengkel', name: 'Jaya Motor', type: 'Bengkel motor', city: 'Semarang', tier: 'small', people: '5 orang: pemilik, 3 mekanik, kasir', icon: 'wrench',
    summary: 'Bengkel motor yang ingin lebih banyak telepon dan kunjungan dari pencarian “bengkel terdekat”, dan pelanggan servis rutin.',
    accounts: ['whatsapp', 'facebook', 'tiktok'],
    challenge: ['Kalah dari bengkel resmi di hasil pencarian.', 'Pelanggan servis tidak kembali setelah 2–3 bulan.', 'Kasir ganti-ganti, akses data pelanggan perlu dibatasi.'],
    setup: [
      { title: 'Periksa SEO situs atau halaman sederhana', detail: 'Pastikan nama, alamat, nomor sama dengan Profil Bisnis Google; pasang kode schema LocalBusiness.', link: { route: 'growth', tab: 'discover' } },
      { title: 'Kampanye panggilan telepon', detail: 'Google Ads dengan aset telepon dan lokasi, radius 5 km, jam iklan sesuai jam buka.', link: { route: 'growth', tab: 'ads' } },
      { title: 'Pengingat servis 60 hari', detail: 'Otomatisasi sapaan setelah 60 hari untuk pelanggan yang setuju.', link: { route: 'growth', tab: 'automate' } },
      { title: 'Kasir sebagai Editor tanpa akses pelanggan', detail: 'Pemilik atau admin yang mengirim pengingat servis.', link: { route: 'team' } }
    ],
    routine: [['Setiap hari', 'Catat kunjungan pelanggan (tombol “Datang”)'], ['Selasa', 'Video tips perawatan motor di TikTok'], ['Jumat', 'Catat hasil iklan: telepon dan kunjungan'], ['Bulanan', 'Bandingkan biaya per pelanggan dengan batas impas']],
    automations: [
      { type: 'winback', name: 'Pengingat servis berkala', config: { days: 60, message: 'Halo {nama}, sudah 2 bulan sejak servis di {usaha}. Saatnya ganti oli dan cek rem. Mau dijadwalkan kapan? 🏍️' } },
      { type: 'review_request', name: 'Minta ulasan setelah servis', config: { afterDays: 1 } }
    ],
    templates: [{ name: 'Promo servis', text: 'Servis rutin + ganti oli mulai [harga]. Cek rem & rantai gratis. 📍 [alamat] · Telepon/WA (nomor) · Buka 08.00–17.00' }],
    metrics: ['Telepon dari iklan per minggu', 'Pelanggan servis ulang dalam 90 hari', 'Skor SEO situs: di atas 80'],
    pdp: ['Nomor polisi kendaraan bisa mengidentifikasi orang; catat hanya bila perlu.', 'Batasi akses data pelanggan hanya untuk pemilik dan admin.'],
    business: { category: 'Bengkel motor', services: ['servis motor', 'ganti oli', 'tune up', 'servis injeksi'], keywords: ['bengkel terdekat', 'buka minggu'] }
  },
  {
    id: 'bimbel', name: 'Bimbel Juara', type: 'Bimbingan belajar', city: 'Medan', tier: 'small', people: '9 orang: pemilik, 6 tentor, 2 admin', icon: 'book-open',
    summary: 'Lembaga bimbel dengan murid usia sekolah: contoh mengelola data anak dengan persetujuan orang tua.',
    accounts: ['instagram', 'whatsapp', 'tiktok', 'facebook'],
    challenge: ['Murid adalah anak-anak, datanya butuh perlakuan khusus.', 'Pendaftaran ramai hanya saat tahun ajaran baru.', 'Testimoni sering memakai foto murid.'],
    setup: [
      { title: 'Hubungi orang tua, bukan murid', detail: 'Catat nama dan WhatsApp orang tua/wali sebagai pelanggan, dengan persetujuan dari orang tua.', link: { route: 'customers' } },
      { title: 'Tandai data anak di catatan pemrosesan', detail: 'Tambahkan kegiatan “Data murid” dan centang data pribadi spesifik; isi cek risiko tinggi.', link: { route: 'trust', tab: 'records' } },
      { title: 'Siapkan kampanye tahun ajaran baru', detail: 'Otomatisasi momen 30 hari sebelumnya; kampanye Meta ke WhatsApp untuk orang tua di radius 5 km.', link: { route: 'growth', tab: 'ads' } },
      { title: 'Izin foto untuk konten', detail: 'Unggah foto murid hanya dengan izin tertulis orang tua; catat di komentar postingan.', link: { route: 'schedule' } }
    ],
    routine: [['Senin', 'Posting tips belajar'], ['Kamis', 'Posting jadwal kelas dan kuota tersisa'], ['Bulanan', 'Laporan perkembangan ke orang tua lewat WhatsApp'], ['Juni–Juli', 'Kampanye tahun ajaran baru']],
    automations: [
      { type: 'moment_prep', name: 'Persiapan tahun ajaran & ujian', config: { daysBefore: 30, kinds: ['belanja', 'peringatan'], draft: true } },
      { type: 'review_request', name: 'Minta ulasan dari orang tua', config: { afterDays: 30, message: 'Halo Bapak/Ibu {nama}, terima kasih sudah mempercayakan belajar putra-putri di {usaha}. Bila berkenan, mohon ulasannya di sini: {link}' } }
    ],
    templates: [{ name: 'Info pendaftaran', text: 'Pendaftaran kelas [jenjang] dibuka! 📚 Kelas kecil maks. 8 murid, tentor berpengalaman. Kuota: [jumlah]. Info & daftar: WhatsApp (nomor).' }],
    metrics: ['Pendaftar baru per kampanye', 'Persetujuan orang tua tercatat: 100%', 'Ulasan orang tua: minimal 4,8★'],
    pdp: ['Pemrosesan data anak memerlukan persetujuan orang tua atau wali (UU PDP Pasal 25).', 'Data anak termasuk data pribadi spesifik (Pasal 4 ayat 2).', 'Simpan data murid seperlunya dan hapus setelah tidak lagi belajar sesuai kebijakan retensi.'],
    business: { category: 'Lembaga kursus', services: ['bimbel SD', 'bimbel SMP', 'persiapan UTBK', 'les privat'], keywords: ['kelas kecil', 'dekat sekolah'] }
  },
  {
    id: 'batik', name: 'Batik Larasati', type: 'Butik & toko online', city: 'Pekalongan', tier: 'medium', people: '15 orang, 3 cabang + Tokopedia & Shopee', icon: 'shirt',
    summary: 'Butik batik dengan tiga cabang dan toko online, tim terpisah untuk marketplace, media sosial, dan cabang.',
    accounts: ['instagram', 'facebook', 'tiktok', 'whatsapp', 'tokopedia', 'shopee'],
    challenge: ['Admin marketplace tidak perlu melihat akun media sosial, dan sebaliknya.', 'Kampanye Harbolnas dan 12.12 butuh koordinasi lintas tim.', 'Sulit tahu penjualan datang dari iklan mana.'],
    setup: [
      { title: 'Akses per akun (MediumPreneur)', detail: 'Admin marketplace hanya melihat Tokopedia & Shopee; tim konten hanya media sosial.', link: { route: 'team' } },
      { title: 'Profil Google per cabang', detail: 'Tambahkan 3 lokasi, isi daftar periksa dan link ulasan masing-masing.', link: { route: 'growth', tab: 'discover' } },
      { title: 'Link UTM untuk setiap kampanye', detail: 'Bedakan sumber: instagram, tiktok, brosur_toko. Pantau di laporan toko online.', link: { route: 'growth', tab: 'ads' } },
      { title: 'Peran Pengamat untuk akuntan', detail: 'Akuntan melihat jadwal dan hasil kampanye tanpa bisa mengubah apa pun.', link: { route: 'team' } }
    ],
    routine: [['Senin', 'Rapat 15 menit: tugas tim dan kalender momen'], ['Setiap hari', 'Tim konten mengajukan postingan; supervisor menyetujui'], ['H-7 tanggal kembar', 'Siapkan voucher marketplace dan postingan pengingat'], ['Bulanan', 'Bandingkan ROAS antar kampanye']],
    automations: [
      { type: 'moment_prep', name: 'Persiapan tanggal kembar & Harbolnas', config: { daysBefore: 10, kinds: ['belanja'], draft: true } },
      { type: 'weekly_report', name: 'Laporan mingguan', config: { weekday: 1, time: '08:00' } },
      { type: 'gbp_weekly', name: 'Update Profil Bisnis Google cabang', config: { weekday: 2 } },
      { type: 'review_reply', name: 'Pengingat balas ulasan', config: { hours: 12 } }
    ],
    templates: [{ name: 'Pengingat Harbolnas', text: '⏰ Besok [tanggal]! Voucher [nominal] khusus Harbolnas di toko kami. Simpan voucher sekarang:\nTokopedia: [link]\nShopee: [link]' }],
    metrics: ['ROAS per kampanye: di atas titik impas', 'Postingan disetujui dalam 4 jam kerja', 'Ulasan tiap cabang dibalas dalam 12 jam'],
    pdp: ['Tinjau akses anggota tiap 6 bulan dan catat di menu Tim.', 'Data pembeli dari marketplace tetap di marketplace; jangan menyalinnya tanpa dasar yang sah.'],
    business: { category: 'Toko pakaian', services: ['batik tulis', 'batik cap', 'kemeja batik', 'kain batik'], keywords: ['batik pekalongan', 'seragam batik'] }
  },
  {
    id: 'rm', name: 'Rumah Makan Rasa Minang', type: 'Rumah makan', city: 'Jakarta Timur', tier: 'medium', people: '25 orang, 4 cabang', icon: 'utensils',
    summary: 'Rumah makan dengan empat cabang yang ingin semua cabang terlihat rapi di Maps dan ulasan dari GoFood/GrabFood terkelola.',
    accounts: ['instagram', 'facebook', 'tiktok', 'whatsapp'],
    challenge: ['Kualitas profil Google tiap cabang berbeda-beda.', 'Ulasan datang dari Google, GoFood, dan GrabFood; tidak ada yang memantau semuanya.', 'Pemilik ingin laporan singkat tanpa membuka banyak aplikasi.'],
    setup: [
      { title: 'Satu lokasi per cabang', detail: 'Isi alamat, Place ID, dan link ulasan untuk 4 cabang. Bandingkan skor tiap cabang.', link: { route: 'growth', tab: 'discover' } },
      { title: 'Kotak ulasan terpusat', detail: 'Admin tiap cabang mencatat ulasan GoFood/GrabFood/Google dan membalas dengan templat.', link: { route: 'growth', tab: 'reviews' } },
      { title: 'Kalender momen Ramadan', detail: 'Siapkan menu buka puasa dan jam operasional 3 minggu sebelumnya.', link: { route: 'growth', tab: 'automate' } },
      { title: 'Laporan mingguan untuk pemilik', detail: 'Ringkasan postingan, ulasan, dan tugas tim setiap Senin pagi.', link: { route: 'growth', tab: 'automate' } }
    ],
    routine: [['Senin', 'Pemilik membaca laporan mingguan'], ['Setiap hari', 'Admin cabang membalas ulasan'], ['Kamis', 'Posting menu andalan dan promo makan siang'], ['Bulanan', 'Bandingkan rating antar cabang']],
    automations: [
      { type: 'review_reply', name: 'Pengingat balas ulasan', config: { hours: 24 } },
      { type: 'weekly_report', name: 'Laporan mingguan', config: { weekday: 1, time: '07:30' } },
      { type: 'moment_prep', name: 'Persiapan Ramadan & libur', config: { daysBefore: 21, kinds: ['libur', 'peringatan'], draft: true } },
      { type: 'gbp_weekly', name: 'Update Profil Bisnis Google', config: { weekday: 4 } }
    ],
    templates: [{ name: 'Menu buka puasa', text: 'Paket buka puasa [nama paket]: [isi] cukup [harga]. Tersedia di semua cabang mulai pukul 16.00. Pesan antar via GoFood/GrabFood atau WhatsApp cabang terdekat.' }],
    metrics: ['Rating rata-rata semua cabang: minimal 4,6★', 'Daftar periksa Profil Google tiap cabang: di atas 90%', 'Ulasan baru per cabang per bulan'],
    pdp: ['Ulasan publik boleh dikutip; untuk ulasan dari chat, minta izin dulu.', 'Gunakan kebijakan retensi untuk catatan ulasan lama.'],
    business: { category: 'Rumah makan', services: ['nasi padang', 'rendang', 'paket nasi kotak', 'katering kantor'], keywords: ['buka sampai malam', 'parkir luas'] }
  }
];

export const TIERS = {
  solo: { name: 'SOLOPreneur', note: 'Satu orang mengurus semuanya' },
  small: { name: 'SMALPreneur', note: 'Tim 5–10 orang' },
  medium: { name: 'MediumPreneur', note: 'Tim 10–30 orang, beberapa cabang' }
};
