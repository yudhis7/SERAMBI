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

# memeriksa kunci yang sudah ada
node tools/terbitkan-lisensi.js --periksa SRB1.xxxx.yyyy
```

Setiap kunci yang diterbitkan dicatat di `lisensi-terbit.csv` di folder yang sama dengan berkas `.pem`.

## Yang dilihat pelanggan

1. Pelanggan membuka **Pengaturan → Paket & lisensi → Aktifkan lisensi**, lalu menempel kunci (diawali `SRB1.`).
2. Di ruang kerja tim, hanya **Pemilik** ruang kerja yang mengaktifkan lisensi. Anggota tim otomatis mengikuti paket ruang kerja.
3. Bila masa berlaku habis, Serambi kembali ke SOLOPreneur. Data tidak hilang; ruang kerja tim menjadi hanya-lihat sampai lisensi diperpanjang.

## Isi kunci

Format: `SRB1.<data>.<tanda tangan>`. Bagian data (base64url JSON) berisi: versi, id lisensi, paket, jumlah pengguna, nama, email, tanggal terbit, dan tanggal berakhir. Mengubah satu huruf saja membuat tanda tangan tidak cocok, sehingga kunci ditolak.

## Uji coba

Setiap komputer (atau ruang kerja tim) bisa memakai uji coba **MediumPreneur 14 hari** satu kali dari Pengaturan atau menu Tim.
