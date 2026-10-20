# Serambi

Hak cipta © 2026 **Yudhistira** (yudhie7@gmail.com). Seluruh hak dilindungi.

Aplikasi desktop untuk Windows dan macOS yang mengumpulkan media sosial dan toko online dalam satu jendela: **Instagram, Facebook, X, TikTok, WhatsApp, Telegram, Tokopedia, dan Shopee**. Dilengkapi penyusun postingan, kalender jadwal, dan pembaruan otomatis.

## Yang bisa dilakukan

- **Semua akun di satu tempat.** Tiap akun dibuka dari halaman resminya dan login-nya tersimpan. Bisa beberapa akun di platform yang sama.
- **Media sosial dan toko online dipisah rapi** di panel kiri.
- **Toko online (Tokopedia dan Shopee).** Masuk ke Seller Center langsung dari Serambi untuk mengurus pesanan, chat pembeli, dan promosi.
  - **Link toko:** simpan alamat toko yang dilihat pembeli, lalu sisipkan ke postingan media sosial dengan satu klik (tombol *Link toko*). Pembeli langsung diarahkan ke tokomu.
  - **Pintasan halaman:** simpan halaman Seller Center yang sering dibuka (Pesanan, Chat, Promosi, Iklan) lewat ikon penanda di bar atas.
  - **Halaman awal:** pilih halaman yang langsung terbuka setiap kali akun itu dibuka.
  - **Tulis promosi:** teks promosi bisa dikirim ke akun toko. Serambi membuka Seller Center dan menyalin teksnya untuk ditempel di menu promosi, chat, atau deskripsi produk.
- **TikTok:** saat waktunya posting, Serambi langsung membuka halaman unggah TikTok dan menyalin keterangannya.
- **Tulis sekali, kirim ke banyak akun**, dengan pratinjau dan batas karakter tiap platform.
- **Jadwal** dalam bentuk kalender dan daftar.
- **Telegram otomatis** lewat bot. Platform lain dibantu: Serambi memberi notifikasi, membuka akunnya, dan menyalin teks atau gambar.
- **Pembaruan otomatis** dari GitHub Releases.
- Templat teks, tema terang/gelap, pintasan keyboard, dan cadangan data.

## Memasang

### Windows (10 dan 11)
1. Jalankan `Serambi-Setup-1.1.0.exe`.
2. Jika muncul *Windows protected your PC*, klik **More info → Run anyway**. Ini muncul karena installer belum ditandatangani sertifikat berbayar.
3. Baca dan setujui lisensi, lalu ikuti langkah pemasangan.

### macOS (11 Big Sur atau lebih baru)
1. Pilih berkas sesuai Mac kamu: `…-mac-arm64.zip` untuk chip Apple (M1–M4), atau `…-mac-x64.zip` untuk Intel.
2. Buka zip, lalu seret **Serambi** ke folder **Applications**.
3. Pembukaan pertama: klik kanan Serambi → **Open** → **Open**. Di macOS 15 ke atas: buka sekali, lalu **System Settings → Privacy & Security → Open Anyway**.

## Pembaruan otomatis

Serambi memeriksa versi baru 15 detik setelah dibuka, lalu setiap 6 jam, dari Release terbaru di repositori GitHub **yudhis7/serambi**.

- **Windows:** versi baru diunduh di latar belakang dan terpasang otomatis saat Serambi ditutup. Bisa juga langsung lewat *Mulai ulang & perbarui* (di Pengaturan, panel kiri, atau menu tray).
- **Mac:** Serambi memberi tahu ada versi baru dan menyediakan tombol unduh. Pemasangan otomatis penuh di Mac baru bisa dilakukan setelah aplikasi ditandatangani Apple Developer ID.

Pengguna versi 1.0.0 perlu memasang 1.1.0 secara manual sekali. Mulai 1.1.0, pembaruan berjalan otomatis.

### Menyiapkan server pembaruan (sekali saja)

1. Buat akun GitHub dengan username **yudhis7** (atau pakai yang sudah ada), lalu buat repositori **publik** bernama **serambi**.
   Kalau username atau nama repo berbeda, ubah `UPDATE_OWNER` / `UPDATE_REPO` di `src/main/config.js` **dan** `build.publish` di `package.json`, lalu buat ulang installer.
2. Unggah seluruh kode sumber ke repositori itu.
3. Terbitkan versi pertama dengan salah satu cara:
   - **Otomatis (disarankan):** buat tag `v1.1.0` (`git tag v1.1.0 && git push origin v1.1.0`). GitHub Actions membuat installer Windows dan Mac lalu menerbitkan Release.
   - **Manual:** di GitHub, buka **Releases → Draft a new release**, beri tag `v1.1.0`, unggah `Serambi-Setup-1.1.0.exe`, `Serambi-Setup-1.1.0.exe.blockmap`, `latest.yml`, dan kedua zip Mac, lalu klik **Publish release**.

### Menerbitkan versi berikutnya

1. Naikkan `"version"` di `package.json`, misalnya ke `1.2.0`.
2. Commit, lalu buat tag yang sama: `git tag v1.2.0 && git push origin v1.2.0`.
3. Setelah Release terbit, semua Serambi yang terpasang akan menemukannya sendiri.

## Mulai memakai

1. **Tambah akun.** Klik *Tambah akun*, pilih media sosial atau toko online, lalu masuk seperti biasa.
2. **Atur link toko** (untuk Tokopedia/Shopee): menu ⋯ akun toko → *Atur link toko*. Isi alamat toko yang dilihat pembeli, misalnya `https://shopee.co.id/namatoko`.
3. **Tulis postingan** (Ctrl/⌘+N), pilih akun tujuan, klik *Link toko* untuk menyisipkan alamat tokomu, lalu pilih *Sekarang*, *Jadwalkan*, atau *Draf*.
4. **Saat waktunya tiba**, klik notifikasinya atau *Bantu posting*, tempel dengan Ctrl/⌘+V, lalu klik *Selesai*.

### Posting otomatis ke Telegram
1. Di Telegram, buka **@BotFather**, kirim `/newbot`, salin token-nya.
2. Tambahkan bot ke channel atau grup sebagai admin yang boleh mengirim pesan.
3. Di Serambi: **Pengaturan → Posting otomatis ke Telegram**, isi token dan `@namachannel`, klik *Hubungkan & tes*.

## Perlu diketahui

- **Jadwal berjalan selama Serambi terbuka**, termasuk saat disembunyikan di tray (Windows) atau Dock (Mac).
- **Instagram, Facebook, X, TikTok, WhatsApp, Tokopedia, dan Shopee tidak bisa diposting otomatis penuh.** Platform-platform ini hanya membuka posting otomatis lewat API bisnis yang harus disetujui. Serambi mengingatkan, membuka akunnya, dan menyiapkan teksnya.
- **Shopee Feed** hanya bisa diposting dari aplikasi Shopee di HP.
- **Seller Center Tokopedia** kini bergabung dengan TikTok Shop di `seller-id.tokopedia.com`.
- **Masuk dengan Google** sering ditolak Google di aplikasi seperti ini. Masuklah dengan email/nomor HP dan kata sandi.
- **Data tersimpan di komputermu sendiri:** Windows `%APPDATA%\Serambi`, macOS `~/Library/Application Support/Serambi`. Token bot disimpan terenkripsi.
- Serambi tidak berafiliasi dengan platform-platform di atas.

## Pintasan keyboard

| Aksi | Windows | macOS |
| --- | --- | --- |
| Tulis postingan | Ctrl+N | ⌘N |
| Buka akun ke-1…9 (urutan panel kiri) | Ctrl+1…9 | ⌘1…9 |
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
npm run dist:win     # installer Windows + latest.yml di folder dist/
npm run dist:mac     # DMG dan zip Mac (jalankan di Mac)
```

## Hak cipta dan lisensi

Serambi adalah milik **Yudhistira** (yudhie7@gmail.com). Pemakaian diatur oleh berkas `LICENSE`: boleh dipasang dan dipakai, tetapi tidak boleh disalin, diubah, atau didistribusikan ulang tanpa izin tertulis. Komponen sumber terbuka di dalamnya (Electron, electron-updater, ikon Lucide, huruf Plus Jakarta Sans) tetap tunduk pada lisensinya masing-masing, lihat `THIRD_PARTY_NOTICES.md`.
