# Panduan Kunci Lisensi Serambi (khusus pemilik)

Hak cipta © 2026 Yudhistira (yudhie7@gmail.com).

Paket **SMALPreneur** (5–10 pengguna) dan **MediumPreneur** (10–30 pengguna) diaktifkan dengan kunci lisensi. Kunci ditandatangani secara digital (Ed25519) dengan **kunci privat** milik pemilik Serambi. Aplikasi memeriksa tanda tangan itu dengan **kunci publik** yang tertanam di `src/main/config.js`, tanpa internet dan tanpa server.

## Berkas kunci privat

- Nama berkas: `serambi-penerbit-lisensi.pem`.
- Siapa pun yang memegang berkas ini bisa menerbitkan lisensi Serambi. Simpan di tempat aman, misalnya pengelola kata sandi atau flashdisk terenkripsi, dan buat satu salinan cadangan offline.
- **Jangan** memasukkannya ke repositori GitHub, email, chat, atau folder bersama. `.gitignore` sudah menolak semua berkas `*.pem`.
- Bila berkas hilang atau bocor: buat pasangan kunci baru, ganti `LICENSE_PUBLIC_KEY` di `src/main/config.js`, terbitkan versi Serambi baru, lalu terbitkan ulang kunci untuk pelanggan. Kunci lama tidak berlaku lagi di versi baru.

## Menerbitkan kunci dari aplikasi

1. Buka Serambi → menu **Bantuan → Terbitkan kunci lisensi (pemilik Serambi)…**
2. Pilih paket, jumlah pengguna, nama usaha pelanggan, email, dan masa berlaku (1, 3, 6, 12 bulan, atau tanpa batas).
3. Klik **Terbitkan**, lalu pilih berkas `serambi-penerbit-lisensi.pem`. Berkas hanya dibaca saat itu dan tidak disalin.
4. **Salin kunci** atau **Kirim lewat email**. Riwayat kunci yang diterbitkan tersimpan di komputer itu (terenkripsi bersama data Serambi).

## Menerbitkan kunci dari terminal

```bash
node tools/terbitkan-lisensi.js --kunci /lokasi/aman/serambi-penerbit-lisensi.pem \
     --paket small --pengguna 8 --nama "Kopi Senja" --email rina@kopisenja.id --bulan 12

# lisensi demo untuk presentasi penjualan (lihat bagian Mode demo)
node tools/terbitkan-lisensi.js --kunci /lokasi/aman/serambi-penerbit-lisensi.pem \
     --paket medium --pengguna 30 --nama "Nama Anda" --email anda@contoh.id --bulan 0 --demo

# memeriksa kunci yang sudah ada
node tools/terbitkan-lisensi.js --periksa SRB1.xxxx.yyyy
```

Setiap kunci yang diterbitkan dicatat di `lisensi-terbit.csv` di folder yang sama dengan berkas `.pem`.

## Yang dilihat pelanggan

1. Pelanggan membuka **Pengaturan → Paket & lisensi → Aktifkan lisensi**, lalu menempel kunci (diawali `SRB1.`).
2. Di ruang kerja tim, hanya **Pemilik** ruang kerja yang mengaktifkan lisensi. Anggota tim otomatis mengikuti paket ruang kerja.
3. Bila masa berlaku habis, Serambi kembali ke SOLOPreneur. Data tidak hilang; ruang kerja tim menjadi hanya-lihat sampai lisensi diperpanjang.

## Isi kunci

Format: `SRB1.<data>.<tanda tangan>`. Bagian data (base64url JSON) berisi: versi, id lisensi, paket, jumlah pengguna, nama, email, tanggal terbit, tanggal berakhir, dan (khusus lisensi demo) tanda `demo`. Mengubah satu huruf saja membuat tanda tangan tidak cocok, sehingga kunci ditolak.

## Uji coba

Setiap komputer (atau ruang kerja tim) bisa memakai uji coba **MediumPreneur 14 hari** satu kali dari Pengaturan atau menu Tim.

## Mode demo (untuk presentasi penjualan)

Lisensi demo adalah lisensi MediumPreneur biasa dengan tanda `demo`. Selain membuka semua fitur, lisensi ini membuka **Mode demo**: ruang data terpisah berisi usaha contoh lengkap, *Kopi Senja* (Sleman), untuk diperagakan kepada calon pelanggan UMKM.

**Menerbitkan.** Di jendela *Terbitkan kunci lisensi*, centang **Lisensi demo**, atau tambahkan `--demo` di terminal. Berikan lisensi demo hanya kepada diri sendiri atau tim penjual Serambi; siapa pun yang memegang kuncinya bisa membuka Mode demo.

**Memakai.**
1. Aktifkan lisensi demo di **Pengaturan → Paket & lisensi → Aktifkan lisensi**.
2. Klik **Masuk mode demo**. Serambi dibuka ulang dengan data Kopi Senja. Pada pembukaan pertama, Serambi menyiapkan datanya selama beberapa detik.
3. Di bilah samping muncul **Mode demo**, dan di Beranda ada keterangan bahwa datanya fiktif.
4. Selesai presentasi: **Pengaturan → Paket & lisensi → Keluar mode demo**. Serambi kembali ke data asli.
5. **Atur ulang** membuang semua perubahan selama demo dan membuat ulang data contoh dengan tanggal terbaru. Login akun yang dibuka di mode demo juga dikeluarkan.

**Isi data contoh.**

| Bagian | Isi |
| --- | --- |
| Usaha dan akun | Profil usaha, 2 cabang, dan 7 akun (Instagram, Facebook, TikTok, WhatsApp, Telegram, Tokopedia, Shopee) |
| Konten | Postingan terkirim selama 4 minggu terakhir, jadwal mendatang, draf, 2 postingan menunggu persetujuan beserta komentar, dan 1 postingan yang perlu diposting |
| Tim | Pemilik (nama di lisensi), Admin, 2 Editor, dan Pengamat, dengan aturan persetujuan dan akses per akun |
| Tumbuh lokal | Daftar periksa Profil Bisnis Google, pemeriksaan NAP, hasil SEO, 3 kampanye beserta hasilnya, 14 ulasan, dan 8 otomatisasi yang sudah menghasilkan tugas |
| Pelanggan | 20 pelanggan fiktif dengan catatan persetujuan yang beragam |
| Pusat Kepercayaan | Catatan pemrosesan, pemberitahuan privasi v1, penanggung jawab data, 2 permintaan subjek data, 1 insiden yang sudah ditutup, dan log audit |

**Batas dan keamanan.**
- Data demo disimpan di berkas sendiri (`serambi-demo.json`, folder `media-demo`, dan ruang kerja tim lokal `demo-ruang-kerja`). Data asli (`serambi-data.json`) tidak dibaca atau diubah selama mode demo.
- Semua nama, nomor, dan alamat di data contoh fiktif. Nomor WhatsApp memakai blok 0812-0000-xxxx dan situs memakai domain `.example`.
- Mode demo hanya terbuka bila lisensi demo diaktifkan di komputer itu sendiri. Anggota tim tidak mendapat Mode demo dari lisensi pemilik.
- Folder tim demo ada di komputer itu, bukan di Google Drive. Untuk memperagakan kerja tim dengan dua komputer, pakai ruang kerja sungguhan.
- Kunci aplikasi (PIN) sengaja dibiarkan belum aktif supaya cara mengaktifkannya bisa diperagakan.
