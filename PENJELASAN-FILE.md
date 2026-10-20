# Penjelasan Kode Sumber Serambi

Hak cipta © 2026 Yudhistira (yudhie7@gmail.com). Seluruh hak dilindungi. Versi 1.1.0.

Dokumen ini menjelaskan isi setiap file di folder ini, cara bagian-bagiannya saling terhubung, dan di mana mencari kode untuk tiap fitur.

## Gambaran besar

Serambi dibangun dengan **Electron** (Chromium + Node.js), tanpa framework antarmuka. Ada tiga lapisan:

```
┌──────────────────────────────────────────────────────────┐
│ PROSES UTAMA (src/main)  — Node.js, akses penuh ke sistem │
│  jendela, tray, menu, notifikasi, penyimpanan data,       │
│  penjadwal, kirim Telegram, sesi login tiap akun,         │
│  pembaruan otomatis (updater.js)                          │
└───────────────▲──────────────────────────┬───────────────┘
                │ ipcRenderer.invoke       │ webContents.send
                │ (permintaan)             │ ('state', 'cmd')
┌───────────────┴──────────────────────────▼───────────────┐
│ PRELOAD (src/preload) — jembatan aman, hanya fungsi yang  │
│  didaftarkan yang bisa dipanggil antarmuka (window.serambi)│
└───────────────▲──────────────────────────────────────────┘
                │
┌───────────────┴──────────────────────────────────────────┐
│ ANTARMUKA (src/renderer) — HTML, CSS, JavaScript modul    │
│  sidebar, Beranda, Tulis, Jadwal, Pengaturan,             │
│  <webview> untuk tiap akun (IG/FB/X/TikTok/WA/TG,          │
│  Tokopedia, Shopee)                                       │
└──────────────────────────────────────────────────────────┘
```

**Alur data:** semua data (akun, postingan, templat, pengaturan) disimpan proses utama dalam satu file JSON. Setiap kali data berubah, proses utama mengirim salinan terbarunya ke antarmuka (`'state'`), lalu antarmuka menggambar ulang bagian yang perlu.

**Tiap akun punya sesi sendiri.** Satu `<webview>` per akun dengan partisi `persist:acc_<id>`, sehingga cookie dan login tiap akun terpisah. Itu sebabnya dua akun Instagram bisa login bersamaan.

## Struktur folder

```
Serambi-source/
├── package.json                 konfigurasi proyek & build installer
├── package-lock.json            versi pasti setiap dependensi
├── README.md                    panduan pemakaian (untuk pengguna)
├── PENJELASAN-FILE.md           dokumen ini
├── LICENSE                      lisensi milik Yudhistira (juga tampil di installer)
├── THIRD_PARTY_NOTICES.md       lisensi komponen sumber terbuka
├── .gitignore
├── .github/workflows/build.yml  build Windows + Mac dan terbitkan GitHub Release
├── scripts/
│   ├── gen-icons.js             membuat src/renderer/icons.js dari Lucide
│   └── gen-assets.js            membuat ikon aplikasi, tray, badge (PNG)
├── build/                       ikon installer + license.txt (halaman lisensi installer)
├── assets/                      ikon jendela, tray, dan badge notifikasi
└── src/
    ├── main/                    PROSES UTAMA
    │   ├── main.js
    │   ├── config.js
    │   ├── updater.js
    │   ├── platforms.js
    │   ├── store.js
    │   └── telegram.js
    ├── preload/
    │   └── preload.js
    └── renderer/                ANTARMUKA
        ├── index.html
        ├── styles.css
        ├── app.js
        ├── ctx.js
        ├── util.js
        ├── icons.js
        ├── fonts/               Plus Jakarta Sans (.woff2)
        └── views/
            ├── home.js
            ├── compose.js
            ├── schedule.js
            └── settings.js
```

---

## src/main — proses utama

### `main.js` (±800 baris) — pusat aplikasi
Bagian-bagiannya berurutan di dalam file:

| Bagian | Fungsi |
| --- | --- |
| Pengaturan awal | Nama aplikasi, bahasa `id`, AppUserModelId Windows, **user agent Chrome** (agar WhatsApp Web mau terbuka), skema privat `serambi://`, kunci satu instance. |
| `setupAccountSession()` | Menyiapkan sesi tiap akun: user agent, izin (notifikasi, mikrofon/kamera, clipboard), dan menolak notifikasi untuk akun yang disenyapkan. |
| `commandForInput()` / `attachShortcuts()` | Pintasan keyboard (Ctrl+N, Ctrl+1..9, Ctrl+R, zoom, dll.) untuk Windows/Linux, termasuk saat kursor ada di dalam halaman akun. |
| `attachContextMenu()` | Menu klik kanan (Potong/Salin/Tempel, saran ejaan, buka tautan, salin gambar, kembali/muat ulang). Electron tidak punya menu ini secara bawaan. |
| `accountOfContents()` | Mengenali akun pemilik sebuah halaman dari sesinya, jadi aturan domain tetap benar walau Tokopedia memakai login TikTok. |
| `guardWebview()` | Keamanan halaman akun: pop-up login (Google/Apple) diizinkan, tautan ke situs luar dibuka di browser biasa, pengalihan `l.facebook.com` dibuka langsung ke tujuan aslinya. |
| `createWindow()` | Jendela utama: ukuran tersimpan, title bar menyatu (tombol lampu lalu lintas di Mac, tombol jendela overlay di Windows), menolak webview yang tidak aman, sembunyi ke tray saat ditutup. |
| `createTray()` / `buildMenu()` | Ikon tray dan menu aplikasi berbahasa Indonesia (Berkas, Edit, Tampilan, Buka, Jendela, Bantuan). Menu tray menampilkan *Mulai ulang & perbarui* saat pembaruan siap. Menu Bantuan berisi Tentang Serambi, Periksa pembaruan, dan Kirim masukan. |
| `computeStatus()` / `runPost()` / `tick()` | **Mesin jadwal.** Tiap 15 detik `tick()` mencari postingan yang waktunya tiba. `runPost()` mengirim via bot ke Telegram; akun lain ditandai "siap ditempel" dan memunculkan notifikasi. |
| `sanitizePost()` | Memeriksa data postingan dari antarmuka sebelum disimpan (target akun valid, nama file media aman). |
| `cleanupMedia()` / `importMedia()` | Menyalin foto/video ke folder data aplikasi dan menghapus file media yang tidak dipakai lagi. |
| `registerIpc()` | Semua "pintu" yang bisa dipanggil antarmuka: akun (termasuk link toko, halaman awal, pintasan), postingan, templat, pengaturan, bot, media, clipboard, cadangan, badge, pembaruan. |
| `registerProtocol()` | Melayani `serambi://app/...` (file antarmuka) dan `serambi://media/...` (foto postingan), dengan pengecekan agar tidak bisa membaca file di luar foldernya. |
| Lifecycle | `whenReady`, tray, penjadwal, catch-up setelah komputer bangun dari sleep, perilaku keluar di Mac/Windows. |

### `config.js` — pemilik & server pembaruan
Satu tempat untuk nama pemilik (Yudhistira), email, teks hak cipta, dan repositori GitHub tempat versi baru diterbitkan (`UPDATE_OWNER` / `UPDATE_REPO`). Nilainya harus sama dengan `build.publish` di `package.json`.

### `updater.js` — pembaruan otomatis
- **Windows:** memakai `electron-updater` (NSIS). Mengecek GitHub Releases 15 detik setelah dibuka lalu tiap 6 jam, mengunduh di latar, memeriksa checksum SHA-512, dan memasang saat aplikasi ditutup atau lewat *Mulai ulang & perbarui*.
- **Mac:** mengecek Release terbaru lewat GitHub API dan menampilkan tombol unduh, karena pemasangan otomatis di Mac butuh tanda tangan Apple Developer ID.
- Status (`checking`, `downloading`, `downloaded`, `available`, `latest`, `error`) dikirim ke antarmuka lewat kanal `update`.

### `platforms.js` — daftar platform
Delapan platform dengan jenisnya (`kind`): **media sosial** (Instagram, Facebook, X, TikTok, WhatsApp, Telegram) dan **toko online** (Tokopedia, Shopee). Tiap platform punya singkatan, warna tile, halaman awal, domain, batas karakter, dan petunjuk posting. TikTok punya `composeUrl` (halaman unggah). Tokopedia membuka Seller Center gabungan Tokopedia & TikTok Shop (`seller-id.tokopedia.com`), Shopee membuka `seller.shopee.co.id`.

### `store.js` — penyimpanan data
Membaca dan menulis `serambi-data.json` di folder data pengguna. Penulisannya atomik (tulis ke `.tmp` lalu rename) agar file tidak rusak jika listrik mati. Token bot Telegram dienkripsi dengan `safeStorage`, yaitu Keychain di Mac dan DPAPI di Windows. `publicState()` memastikan token tidak pernah dikirim ke antarmuka.

### `telegram.js` — kirim ke Telegram
Memakai Telegram Bot API resmi:
- teks saja → `sendMessage` (dipecah per 4.096 karakter)
- 1 foto/video → `sendPhoto` / `sendVideo` dengan keterangan
- banyak media → `sendMediaGroup`

Keterangan lebih dari 1.024 karakter dikirim sebagai pesan terpisah. `friendlyError()` menerjemahkan pesan error Telegram ke bahasa Indonesia yang jelas.

---

## src/preload

### `preload.js` — jembatan aman
Membuat `window.serambi` berisi daftar fungsi yang boleh dipakai antarmuka. Antarmuka tidak punya akses Node.js langsung (`contextIsolation`, `sandbox`), sehingga halaman web mana pun tidak bisa menyentuh file di komputer.

---

## src/renderer — antarmuka

### `index.html`
Kerangka halaman: sidebar, title bar, area tampilan, wadah webview, layar "memuat/gagal", dan panel bantu posting. Ada Content-Security-Policy ketat: hanya script dari aplikasi sendiri yang boleh jalan.

### `styles.css` (±730 baris) — seluruh tampilan
- **Token warna** di `:root`: nila (indigo) untuk identitas, kunyit (kuning) untuk hal yang butuh perhatian, plus versi gelapnya di `prefers-color-scheme: dark`.
- Bagian berurutan: layout, sidebar (termasuk mode ciut), tile monogram, tombol & kontrol, Beranda, tampilan akun & panel bantu, Tulis, Jadwal, Pengaturan, modal/menu/toast.

### `app.js` (±650 baris) — "cangkang" antarmuka
| Bagian | Fungsi |
| --- | --- |
| `renderSidebar()` / `bindSidebar()` | Panel kiri, jumlah pesan baru, seret untuk mengurutkan akun, klik kanan akun. |
| `ensureWebview()` dan sekitarnya | Membuat `<webview>` per akun, membaca jumlah belum dibaca dari judul halaman (misalnya "(3) Instagram"), status memuat/gagal, zoom per akun. |
| `renderAccountBar()` | Bar atas saat membuka akun: kembali, maju, muat ulang, beranda, Tulis postingan, menu ⋯. |
| `accountMenu()` dan aksi akun | Ganti nama, atur link toko, senyapkan, jadikan halaman awal, keluar dari akun, hapus akun. |
| `bookmarksMenu()` | Pintasan halaman per akun (misalnya halaman Pesanan di Seller Center). |
| `editShopUrl()` | Menyimpan alamat toko Tokopedia/Shopee yang dilihat pembeli. |
| `openAbout()` / `handleUpdate()` | Jendela Tentang Serambi (hak cipta Yudhistira) dan tombol pembaruan di panel kiri. |
| `openAddAccount()` / `quickAddAccount()` | Jendela Tambah akun. |
| `openAssist()` / `startDock()` / `renderDock()` | **Bantu posting:** daftar akun tujuan, salin teks/gambar, panel kecil di pojok saat akun terbuka, lanjut ke akun berikutnya. Untuk X, teks diisi lewat tautan `x.com/intent/post`. |
| `navigate()` / `handleState()` / `handleCommand()` | Perpindahan halaman, pembaruan data dari proses utama, perintah dari menu/pintasan. |
| `boot()` | Mengambil data awal dan memuat semua akun di latar secara bertahap. |

### `ctx.js` — data bersama & helper domain
Objek `S` (state antarmuka), event bus kecil (`go`, `emit`) agar halaman bisa berpindah tanpa saling import, fungsi tile monogram, URL media, label status (Draf/Terjadwal/Perlu tindakan/Terposting).

### `util.js` — helper umum
`esc()` untuk mencegah XSS, format tanggal/jam Indonesia (`id-ID`), hari relatif (Hari ini/Besok), salam waktu, toast, modal, dialog konfirmasi, dialog isian, dan menu pop-up.

### `icons.js`
Ikon garis dari Lucide (lisensi ISC), dibuat otomatis oleh `scripts/gen-icons.js`. File ini panjang dalam satu baris karena berisi data SVG.

### `views/home.js` — Beranda
Salam dan tanggal, kalimat ringkasan hari ini, **pita waktu 24 jam** dengan penanda postingan, bagian "Perlu diposting sekarang", "Akan datang" (7 hari), Draf, daftar akun. Untuk pengguna baru, tampil layar sambutan dengan 5 tombol platform.

### `views/compose.js` — Tulis postingan
Pemilih akun tujuan, kotak teks (otomatis membesar), foto/video (pilih, seret-lepas, atau tempel), penghitung karakter per platform, peringatan (X >280, Instagram tanpa media, >30 tagar, dll.), templat, pilihan Sekarang/Jadwalkan/Draf dengan jam cepat (1 jam lagi, Besok 09.00, …), pratinjau per platform, dan simpan otomatis tulisan yang belum selesai.

### `views/schedule.js` — Jadwal
Kalender bulanan (Senin di kolom pertama) dengan chip berwarna sesuai status, panel hari terpilih, tampilan Daftar dengan filter, dan menu per postingan (Edit, Bantu posting, Duplikat, Salin teks, Hapus).

### `views/settings.js` — Pengaturan
Tema, notifikasi & perilaku latar, daftar akun, formulir bot Telegram (dengan tes koneksi), pengelolaan templat, cadangan/pulihkan, dan daftar pintasan keyboard.

---

## scripts, build, assets

- `scripts/gen-icons.js` mengambil ikon yang dipakai dari paket `lucide-static`.
- `scripts/gen-assets.js` menggambar ikon aplikasi (atap serambi + gelembung chat) dalam SVG, lalu mengubahnya ke PNG berbagai ukuran dengan `sharp`. Ikon tray Mac dibuat sebagai *template image* hitam agar menyesuaikan menu bar.
- `build/icon.png` (1024 px) diubah otomatis menjadi `.icns` (Mac), dan `build/icon-win.png` menjadi `.ico` (Windows).

## package.json — bagian `build`
- **Windows:** installer NSIS bahasa Indonesia, pengguna bisa memilih folder, pintasan desktop & Start Menu.
- **Mac:** DMG untuk Intel (`x64`) dan Apple Silicon (`arm64`), tanda tangan ad-hoc (`identity: "-"`), keterangan izin mikrofon/kamera.

## Di mana mencari kode per fitur

| Fitur | File & fungsi |
| --- | --- |
| Tambah platform baru | `src/main/platforms.js` |
| Pemilik, hak cipta, repo pembaruan | `src/main/config.js`, `package.json`, `LICENSE` |
| Pembaruan otomatis | `src/main/updater.js`, bagian Pembaruan di `views/settings.js` |
| Link toko ke postingan | `shopLinkMenu()` di `views/compose.js` |
| Login tersimpan per akun | `setupAccountSession()` di `main.js`, `ensureWebview()` di `app.js` |
| Hitungan pesan belum dibaca | event `page-title-updated` di `ensureWebview()` (`app.js`) |
| Jadwal & pengingat | `tick()`, `runPost()` di `main.js` |
| Kirim otomatis Telegram | `telegram.js`, dipanggil dari `runPost()` |
| Bantu posting (salin & tempel) | `openAssist()`, `startDock()`, `renderDock()` di `app.js` |
| Warna & tema | variabel di awal `styles.css` |
| Teks antarmuka | langsung di file `views/*.js` dan `app.js` (bahasa Indonesia) |

## Menjalankan dan memeriksa

```bash
npm install          # pasang dependensi
npm start            # jalankan aplikasi
npm run icons        # buat ulang ikon & aset
npm run dist:win     # buat installer Windows
npm run dist:mac     # buat DMG Mac (di komputer Mac)
```

Saat dijalankan dengan `npm start`, menu **Tampilan → Alat pengembang** (atau Ctrl+Shift+I di Windows) membuka DevTools untuk memeriksa antarmuka.
