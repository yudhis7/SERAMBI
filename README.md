# Serambi

Aplikasi desktop untuk Windows dan macOS yang mengumpulkan Instagram, Facebook, X, WhatsApp, dan Telegram di satu jendela, lengkap dengan penyusun postingan dan kalender jadwal.

## Yang bisa dilakukan

- **Semua akun di satu tempat.** Tiap akun dibuka dari halaman web resminya dan login-nya tersimpan. Bisa beberapa akun di platform yang sama (misalnya dua Instagram).
- **Notifikasi dan jumlah pesan baru** tampil di panel kiri, di ikon aplikasi, dan sebagai notifikasi sistem.
- **Tulis sekali, kirim ke banyak akun.** Pilih akun tujuan, tambahkan foto atau video, lihat pratinjau dan batas karakter tiap platform.
- **Jadwal.** Kalender bulanan dan daftar postingan, dengan status Draf, Terjadwal, Perlu tindakan, dan Terposting.
- **Telegram otomatis.** Hubungkan bot Telegram, dan postingan ke channel atau grup terkirim sendiri tepat waktu.
- **Bantu posting untuk platform lain.** Saat waktunya tiba, Serambi memberi notifikasi, membuka akunnya, dan menyalin teks (serta gambar) ke clipboard. Tinggal tempel dan tandai selesai. Untuk X, kolom postingan langsung terisi.
- **Templat** untuk teks yang sering dipakai, **tema terang/gelap**, **pintasan keyboard**, dan **cadangan data**.

## Memasang

### Windows (10 dan 11)

1. Jalankan `Serambi-Setup-1.0.0.exe`.
2. Jika muncul layar biru *Windows protected your PC*, klik **More info**, lalu **Run anyway**. Ini muncul karena aplikasi belum ditandatangani sertifikat berbayar.
3. Ikuti langkah pemasangan. Serambi muncul di Start Menu dan desktop.

### macOS (11 Big Sur atau lebih baru)

1. Pilih berkas sesuai Mac kamu:
   - `Serambi-1.0.0-mac-arm64.zip` untuk Mac dengan chip Apple (M1, M2, M3, M4 dan seterusnya)
   - `Serambi-1.0.0-mac-x64.zip` untuk Mac dengan prosesor Intel
2. Buka berkas zip, lalu seret **Serambi** ke folder **Applications**.
3. Pembukaan pertama: klik kanan Serambi, pilih **Open**, lalu **Open** lagi.
   Di macOS 15 Sequoia ke atas, buka Serambi sekali, lalu masuk ke **System Settings → Privacy & Security** dan klik **Open Anyway**.
   Cara alternatif lewat Terminal: `xattr -cr /Applications/Serambi.app`

## Mulai memakai

1. **Tambah akun.** Klik *Tambah akun*, pilih platform, lalu masuk seperti biasa. WhatsApp dan Telegram memakai pindai kode QR dari ponsel.
2. **Tulis postingan.** Klik *Tulis postingan* (Ctrl/⌘+N), pilih akun tujuan, tulis teks, tambahkan foto, lalu pilih *Sekarang*, *Jadwalkan*, atau *Draf*.
3. **Saat waktunya tiba**, klik notifikasinya atau tombol *Bantu posting*. Pilih akun, tempel dengan Ctrl/⌘+V, lalu klik *Selesai*.

### Posting otomatis ke Telegram

1. Di Telegram, buka **@BotFather**, kirim `/newbot`, dan salin token-nya.
2. Tambahkan bot itu ke channel atau grup sebagai admin yang boleh mengirim pesan.
3. Di Serambi, buka **Pengaturan → Posting otomatis ke Telegram**, isi token dan `@namachannel` (atau ID angka seperti `-1001234567890` untuk channel privat), lalu klik *Hubungkan & tes*.

## Perlu diketahui

- **Jadwal berjalan selama Serambi terbuka.** Menutup jendela tidak menghentikannya: di Windows Serambi pindah ke tray, di macOS tetap di Dock. Kalau komputer mati saat jadwal tiba, Serambi mengingatkan begitu dibuka lagi. Aktifkan *Buka Serambi saat komputer menyala* di Pengaturan.
- **Kenapa Instagram, Facebook, X, dan WhatsApp tidak terkirim otomatis?** Platform-platform ini hanya mengizinkan posting otomatis lewat API bisnis berbayar atau yang harus disetujui. Serambi memilih cara yang langsung bisa dipakai: mengingatkan dan menyiapkan teksnya.
- **Masuk dengan Google** sering ditolak Google di dalam aplikasi seperti ini. Masuklah dengan email/nama pengguna dan kata sandi.
- **Data tersimpan di komputermu sendiri**:
  Windows `%APPDATA%\Serambi`, macOS `~/Library/Application Support/Serambi`.
  Token bot disimpan terenkripsi. Serambi tidak mengirim data ke server mana pun selain platform yang kamu buka.

## Pintasan keyboard

| Aksi | Windows | macOS |
| --- | --- | --- |
| Tulis postingan | Ctrl+N | ⌘N |
| Buka akun ke-1…9 | Ctrl+1…9 | ⌘1…9 |
| Akun berikutnya / sebelumnya | Ctrl+Tab / Ctrl+Shift+Tab | sama |
| Beranda / Jadwal | Ctrl+Shift+H / Ctrl+Shift+J | ⌘⇧H / ⌘⇧J |
| Muat ulang akun | Ctrl+R atau F5 | ⌘R |
| Perbesar / perkecil / normal | Ctrl+= / Ctrl+− / Ctrl+0 | ⌘= / ⌘− / ⌘0 |
| Pengaturan | Ctrl+, | ⌘, |

## Membangun dari kode sumber

Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm start            # jalankan dalam mode pengembangan
npm run dist:win     # buat installer Windows (dist/Serambi-Setup-*.exe)
npm run dist:mac     # buat DMG macOS untuk Intel dan Apple Silicon (jalankan di Mac)
```

Repositori ini juga berisi alur kerja GitHub Actions (`.github/workflows/build.yml`) yang membuat installer Windows dan DMG macOS sekaligus setiap kali kamu membuat tag `v*`, misalnya `v1.0.1`.

Untuk menghilangkan peringatan keamanan saat memasang, tandatangani aplikasi dengan sertifikat Code Signing (Windows) dan Apple Developer ID (macOS), lalu isi `win.certificateFile` serta `mac.identity` di `package.json`.

## Struktur

```
src/main/       proses utama: jendela, sesi akun, jadwal, Telegram, notifikasi, tray
src/preload/    jembatan aman antara antarmuka dan proses utama
src/renderer/   antarmuka (HTML, CSS, JavaScript tanpa framework)
assets/, build/ ikon aplikasi dan tray
scripts/        pembuat ikon dan aset
```

Ikon antarmuka dari [Lucide](https://lucide.dev) (lisensi ISC). Huruf [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans) (SIL Open Font License 1.1).
