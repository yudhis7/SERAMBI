# Serambi

Hak cipta © 2026 **Yudhistira** (yudhie7@gmail.com). Seluruh hak dilindungi.

Aplikasi desktop untuk Windows dan macOS yang membantu usaha lokal **mengelola media sosial dan toko online, ditemukan di sekitar, beriklan lebih hemat, membangun kepercayaan lewat ulasan, dan mengotomatiskan pemasaran harian**, dengan perlindungan data pelanggan sesuai UU Pelindungan Data Pribadi.

Platform: **Instagram, Facebook, X, TikTok, WhatsApp, Telegram, Tokopedia, dan Shopee**.

## Paket

| | SOLOPreneur | SMALPreneur | MediumPreneur |
| --- | --- | --- | --- |
| Untuk | Pemilik yang mengurus sendiri | Tim 5–10 orang | Tim 10–30 orang, beberapa cabang |
| Harga | Gratis | Kunci lisensi | Kunci lisensi |
| Lokasi/cabang | 1 | 3 | 25 |
| Otomatisasi aktif | 5 | 25 | Tanpa batas |
| Tumbuh lokal (SEO, iklan, ulasan) | ✓ | ✓ | ✓ |
| Pusat Kepercayaan & alat UU PDP | ✓ | ✓ | ✓ |
| Ruang kerja tim terenkripsi | — | ✓ | ✓ |
| Persetujuan postingan & komentar | — | ✓ | ✓ |
| Peran Pengamat & akses per akun | — | — | ✓ |

Semua paket bisa mencoba fitur MediumPreneur **gratis 14 hari**. Kunci lisensi diperiksa di komputer tanpa internet (tanda tangan Ed25519).

## Yang bisa dilakukan

### Media sosial & toko online
- Semua akun di satu jendela; login tiap akun tersimpan, bisa beberapa akun di platform yang sama.
- Tulis sekali, kirim ke banyak akun, dengan pratinjau dan batas karakter tiap platform. Jadwal dalam kalender dan daftar.
- Telegram otomatis lewat bot; platform lain dibantu (notifikasi, buka akun, salin teks/gambar).
- Toko Tokopedia & Shopee: Seller Center di dalam Serambi, link toko, pintasan halaman, tulis promosi.

### Tumbuh lokal
- **Ditemukan di sekitar:** profil bisnis, lokasi/cabang, daftar periksa Profil Bisnis Google, pemeriksa **NAP** (nama, alamat, nomor seragam), **pemeriksa SEO lokal** untuk situs, dan pembuat kode **schema LocalBusiness**.
- **Iklan lokal:** perencana anggaran (klik, pembeli, laba, batas impas, ROAS), kampanye dengan hasil, penyusun **iklan responsif Google** (15 judul/4 deskripsi dengan pemeriksaan aturan), teks iklan Meta, kata kunci lokal & negatif, link **UTM** dan **QR**. Iklan dibuat di konsol resmi; Serambi menyiapkan isinya.
- **Ulasan:** link ulasan Google dari Place ID, **kartu QR siap cetak (PDF)**, kirim permintaan ulasan lewat WhatsApp, kotak ulasan dari Google/marketplace, templat balasan, jadikan testimoni.
- **Otomatisasi harian:** minta ulasan setelah berkunjung, ucapan ulang tahun, sapa pelanggan lama, posting rutin mingguan, konten momen (kalender libur nasional & cuti bersama 2026–2027, Harbolnas, gajian), update Profil Bisnis Google, pengingat balas ulasan, laporan mingguan, dan pemeriksaan masa simpan data. Otomatisasi hanya *menyiapkan* pekerjaan; pesan ke pelanggan baru terkirim setelah kamu menekan kirim.
- **Skor pertumbuhan lokal** dan langkah berikutnya yang paling berdampak.

### Pelanggan
Daftar pelanggan dengan **persetujuan per tujuan** (promo WhatsApp, permintaan ulasan, ucapan ulang tahun), riwayat persetujuan, impor CSV, ekspor, pembatasan pemrosesan, salinan data, dan penghapusan.

### Tim (SMALPreneur & MediumPreneur)
Ruang kerja di **folder bersama** yang sudah kamu punya (Google Drive, OneDrive, Dropbox, atau folder jaringan), **tanpa server**. Semua berkas dienkripsi **AES-256-GCM** di komputer sebelum disimpan; kunci dibagikan ke tiap komputer anggota lewat **X25519**. Peran Pemilik/Admin/Editor/Pengamat, akses data pelanggan terpisah, persetujuan postingan, komentar, tugas tim, dan **ganti kunci otomatis** saat anggota dikeluarkan. Pemilik menyimpan **kode pemulihan**.

### Pusat Kepercayaan (UU No. 27 Tahun 2022)
- **Keamanan:** kunci aplikasi PIN dengan kunci otomatis, enkripsi data di komputer (DPAPI Windows / Keychain macOS), cadangan terenkripsi kata sandi, keluar dari semua akun.
- **Kepatuhan:** daftar periksa 12 butir, catatan kegiatan pemrosesan (Pasal 31), pemberitahuan privasi berversi (Pasal 21), persetujuan (Pasal 20 & 22), permintaan hak subjek data dengan tenggat 3×24 jam, insiden dengan surat pemberitahuan (Pasal 46), penanggung jawab data (Pasal 53), cek risiko tinggi (Pasal 34), kebijakan retensi, dan **log audit berantai hash**.
- **Laporan kepatuhan (PDF)** dan halaman transparansi.

Alat ini membantu menjalankan kewajiban, **bukan nasihat hukum**.

### Contoh penggunaan
Sembilan contoh usaha lokal (fiktif) yang bisa diikuti atau **diterapkan dengan satu klik**: kedai kopi, laundry, kue rumahan, barbershop, klinik gigi, bengkel, bimbel, butik batik, dan rumah makan.

## Memasang

### Windows (10 dan 11)
1. Jalankan `Serambi-Setup-1.2.0.exe`.
2. Jika muncul *Windows protected your PC*, klik **More info → Run anyway** (installer belum ditandatangani sertifikat berbayar).
3. Setujui lisensi, lalu ikuti langkah pemasangan.

### macOS (11 Big Sur atau lebih baru)
1. Pilih `Serambi-1.2.0-arm64.dmg` (chip Apple M1–M4) atau `Serambi-1.2.0-x64.dmg` (Intel).
2. Seret **Serambi** ke **Applications**.
3. Pembukaan pertama: klik kanan → **Open** → **Open**. Di macOS 15 ke atas: **System Settings → Privacy & Security → Open Anyway**.
4. Sejak 1.2, data dienkripsi dengan Keychain. Setelah memperbarui Serambi, macOS bisa meminta izin Keychain sekali; masukkan kata sandi login Mac lalu pilih **Selalu Izinkan**.

## Pembaruan otomatis
Serambi memeriksa Release terbaru di **github.com/yudhis7/serambi** 15 detik setelah dibuka lalu tiap 6 jam. Windows mengunduh dan memasang sendiri; Mac memberi tahu dan menyediakan tombol unduh.

Untuk merilis versi baru: naikkan `version` di `package.json`, tulis `.github/release-notes/vX.Y.Z.md`, lalu push ke `main`. Workflow **Rilis Serambi** membangun installer dan menerbitkan Release.

## Kunci lisensi (khusus pemilik Serambi)
Lihat **PANDUAN-LISENSI.md**. Singkatnya: kunci diterbitkan dari menu **Bantuan → Terbitkan kunci lisensi** atau `node tools/terbitkan-lisensi.js`, memakai berkas kunci privat `serambi-penerbit-lisensi.pem` yang **tidak boleh** masuk repositori.

## Perlu diketahui
- Jadwal dan otomatisasi berjalan selama Serambi terbuka, termasuk saat disembunyikan di tray/Dock.
- Instagram, Facebook, X, TikTok, WhatsApp, Tokopedia, dan Shopee tidak bisa diposting otomatis penuh tanpa API bisnis yang disetujui; Serambi mengingatkan dan menyiapkan teksnya.
- Konsol resmi Google dan Meta dibuka di browser biasa karena Google sering menolak login dari jendela aplikasi.
- Data tersimpan di komputermu: Windows `%APPDATA%\Serambi`, macOS `~/Library/Application Support/Serambi`. Tidak ada server Serambi dan tidak ada pelacakan.
- Serambi tidak berafiliasi dengan platform-platform di atas, Google, atau Meta.

## Pintasan keyboard

| Aksi | Windows | macOS |
| --- | --- | --- |
| Tulis postingan | Ctrl+N | ⌘N |
| Buka akun ke-1…9 | Ctrl+1…9 | ⌘1…9 |
| Akun berikutnya / sebelumnya | Ctrl+Tab / Ctrl+Shift+Tab | sama |
| Beranda / Jadwal | Ctrl+Shift+H / Ctrl+Shift+J | ⌘⇧H / ⌘⇧J |
| Kunci Serambi | Ctrl+Shift+L | ⌘⇧L |
| Muat ulang akun | Ctrl+R atau F5 | ⌘R |
| Perbesar / perkecil / normal | Ctrl+= / Ctrl+− / Ctrl+0 | ⌘= / ⌘− / ⌘0 |
| Pengaturan | Ctrl+, | ⌘, |

## Membangun dari kode sumber
Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm start            # mode pengembangan
npm run dist:win     # installer Windows
npm run dist:mac     # DMG dan zip Mac (jalankan di Mac)
```

## Hak cipta dan lisensi
Serambi adalah milik **Yudhistira** (yudhie7@gmail.com). Pemakaian diatur oleh `LICENSE`. Komponen sumber terbuka (Electron, electron-updater, node-qrcode, ikon Lucide, huruf Plus Jakarta Sans) tunduk pada lisensinya masing-masing, lihat `THIRD_PARTY_NOTICES.md`.
