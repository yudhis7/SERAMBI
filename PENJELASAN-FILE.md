# Penjelasan Kode Sumber Serambi

Hak cipta © 2026 Yudhistira (yudhie7@gmail.com). Seluruh hak dilindungi. Versi 1.2.0.

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
├── PANDUAN-LISENSI.md           cara pemilik menerbitkan kunci lisensi
├── LICENSE                      lisensi milik Yudhistira (juga tampil di installer)
├── THIRD_PARTY_NOTICES.md       lisensi komponen sumber terbuka
├── .gitignore
├── .github/workflows/build.yml  build Windows + Mac dan terbitkan GitHub Release
├── scripts/
│   ├── gen-icons.js             membuat src/renderer/icons.js dari Lucide
│   └── gen-assets.js            membuat ikon aplikasi, tray, badge (PNG)
├── tools/
│   └── terbitkan-lisensi.js     alat terminal pemilik untuk menerbitkan kunci lisensi
├── build/                       ikon installer + license.txt (halaman lisensi installer)
├── assets/                      ikon jendela, tray, dan badge notifikasi
└── src/
    ├── main/                    PROSES UTAMA
    │   ├── main.js
    │   ├── config.js
    │   ├── updater.js
    │   ├── platforms.js
    │   ├── store.js             data (terenkripsi kunci sistem sejak 1.2)
    │   ├── telegram.js
    │   ├── plans.js             3 paket & kunci lisensi (1.2)
    │   ├── demo.js              Mode demo: data usaha contoh untuk presentasi (1.2.1)
    │   ├── secure.js            kriptografi: AES-GCM, scrypt, X25519 (1.2)
    │   ├── workspace.js         ruang kerja tim di folder bersama (1.2)
    │   ├── access.js            peran & izin (1.2)
    │   ├── security.js          kunci PIN & log audit (1.2)
    │   ├── privacy.js           alat UU PDP (1.2)
    │   ├── automation.js        otomatisasi pemasaran (1.2)
    │   ├── moments.js           kalender momen 2026–2027 (1.2)
    │   ├── growth.js            ambil halaman SEO, QR, PDF (1.2)
    │   └── data-ipc.js          pintu data pertumbuhan, pelanggan, kepatuhan (1.2)
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
        ├── lib/                 seo.js, ads.js, score.js, print.js (1.2)
        ├── data/usecases.js     9 contoh penggunaan (1.2)
        └── views/
            ├── home.js
            ├── compose.js
            ├── schedule.js
            ├── settings.js
            ├── growth.js + growth-discover/ads/reviews/automate.js   Tumbuh lokal (1.2)
            ├── customers.js     Pelanggan (1.2)
            ├── team.js          Tim (1.2)
            ├── usecases.js      Contoh penggunaan (1.2)
            └── trust.js         Pusat Kepercayaan (1.2)
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

## Baru di 1.2: paket, tim, pertumbuhan lokal, contoh, dan Pusat Kepercayaan

### Proses utama
| File | Isi |
| --- | --- |
| `plans.js` | Definisi **SOLOPreneur / SMALPreneur / MediumPreneur** (kursi, lokasi, otomatisasi, fitur). `parseLicense()` memeriksa kunci `SRB1.<data>.<tanda tangan>` dengan `crypto.verify` Ed25519 terhadap kunci publik di `config.js`. `issueLicense()` menandatangani kunci baru (dipakai menu Bantuan dan `tools/terbitkan-lisensi.js`). `currentPlan()` menentukan paket aktif dari lisensi, uji coba 14 hari, atau gratis. |
| `demo.js` | **Mode demo** untuk presentasi penjualan pemilik Serambi. `readProfile()`/`writeProfile()` mencatat profil data aktif di `serambi-profile.json`. `seed()` mengisi profil demo yang terpisah (`serambi-demo.json`, `media-demo`, ruang kerja lokal `demo-ruang-kerja`) dengan usaha fiktif *Kopi Senja*: akun, postingan bergambar, tim, kampanye, ulasan, pelanggan, otomatisasi, Pusat Kepercayaan, dan log audit berurutan waktu. Hanya terbuka dengan lisensi bertanda `demo`; pemilihan profil ada di `openStore()` di `main.js`. |
| `secure.js` | Semua kriptografi bawaan Node: AES-256-GCM dengan data terkait (AAD), scrypt untuk PIN dan cadangan berkata sandi, *sealed box* X25519 + HKDF untuk membagikan kunci tim ke satu perangkat, kode base32 bergrup (kode undangan/pemulihan), dan `safeStorage` untuk rahasia di komputer. |
| `store.js` | Sejak 1.2 seluruh berkas data dienkripsi dengan kunci sistem operasi (DPAPI/Keychain) bila tersedia. Bila berkas terenkripsi tidak bisa dibuka (izin Keychain ditolak, komputer lain), Serambi masuk mode **terblokir**: tidak menimpa apa pun, menawarkan *Coba lagi* atau *Mulai dengan data kosong*. |
| `workspace.js` | **Ruang kerja tim tanpa server.** Tiap data disimpan sebagai berkas terenkripsi `data/<koleksi>/<id>.srb` di folder bersama. Sinkron: kirim perubahan (hash isi), tarik berkas yang berubah, konflik per data diselesaikan oleh perubahan terbaru, penghapusan memakai *tombstone*. Undangan sekali pakai, kode pemulihan pemilik, kehadiran perangkat, media terenkripsi, **ganti kunci** (semua berkas dienkripsi ulang) saat anggota dikeluarkan, dan penanda pencabutan untuk perangkat yang dikeluarkan. |
| `access.js` | Peran Pemilik, Admin, Editor, Pengamat dan daftar izin (`post.approve`, `customers.view`, `trust.manage`, dst.). Setiap pintu IPC memeriksa izin di proses utama. |
| `security.js` | Kunci aplikasi (PIN di-hash scrypt, kunci otomatis saat tidak dipakai/layar terkunci/tidur, jeda setelah 5 kali salah) dan **log audit** berantai hash per perangkat (`verifyAudit()`). |
| `privacy.js` | Dasar pemrosesan Pasal 20, catatan kegiatan pemrosesan bawaan (Pasal 31), kebijakan retensi dan laporan data yang lewat masa simpan, jenis permintaan subjek data (Pasal 5–13) dengan tenggat 3×24 jam, dan **daftar periksa kepatuhan** 12 butir. |
| `automation.js` | Sembilan resep otomatisasi. Hanya pelanggan dengan persetujuan untuk tujuan itu dan tidak dibatasi yang diikutkan. Hasilnya tugas (dengan pesan WhatsApp siap kirim) atau draf/jadwal postingan dengan ID tetap, jadi aman dijalankan berulang. |
| `moments.js` | Libur nasional & cuti bersama (SKB 3 Menteri) akhir 2026–2027, momen belanja (Harbolnas, tanggal kembar, gajian), dan hari peringatan, masing-masing dengan ide konten. |
| `growth.js` | Mengambil satu halaman situs untuk pemeriksa SEO (maks. 3 MB, batas waktu 15 detik, plus cek robots.txt & sitemap.xml), membuat QR SVG, dan menyimpan PDF dari halaman cetak di jendela tersembunyi tanpa JavaScript. |
| `data-ipc.js` | Pintu IPC untuk profil bisnis, lokasi, kampanye, ulasan, pelanggan & persetujuan, impor/ekspor, tugas, komentar, otomatisasi, catatan pemrosesan, pemberitahuan privasi, permintaan subjek data, insiden, retensi, dan contoh penggunaan. Semua masukan dibersihkan dan dibatasi panjangnya. |
| `main.js` | Ditambah: `plan()`, `me()`, `can()`/`guard()`, `publicState()` yang menyamarkan data pelanggan untuk peran tanpa akses dan menyembunyikan data sensitif saat terkunci, penjadwal yang menghormati penanggung jawab postingan di tim, `automationTick()`, notifikasi tugas & persetujuan, cadangan terenkripsi, dan menu Bantuan baru. |

### Antarmuka
| File | Isi |
| --- | --- |
| `views/growth.js` | Tumbuh lokal: skor pertumbuhan, langkah berikutnya, KPI, momen terdekat, konsol resmi. Sub-tab di `growth-discover.js` (profil, lokasi, daftar periksa Google, NAP, SEO, schema), `growth-ads.js` (anggaran, kampanye, iklan responsif Google, teks Meta, kata kunci, UTM & QR), `growth-reviews.js` (statistik, minta ulasan, kartu QR, kotak ulasan, balasan, testimoni), `growth-automate.js` (resep, otomatisasi aktif, kalender momen). |
| `views/customers.js` | Pelanggan dengan persetujuan per tujuan, riwayat, pembatasan, salinan data (JSON), penghapusan, impor CSV (koma atau titik koma), ekspor. |
| `views/team.js` | Perbandingan paket, buat/gabung ruang kerja, kode pemulihan, undangan, peran, akses pelanggan & akun, aturan persetujuan, komputer otomatisasi, tinjauan akses, tugas tim. |
| `views/usecases.js` + `data/usecases.js` | Galeri contoh, halaman detail, terapkan ke Serambi, simpan PDF untuk calon pengguna. |
| `views/trust.js` | Pusat Kepercayaan: ringkasan & laporan PDF, keamanan, data & persetujuan, hak subjek data, insiden, retensi, log audit, transparansi. |
| `lib/seo.js` | Analisis 23 butir SEO lokal dari HTML (DOMParser, script tidak dijalankan), pembuat JSON-LD LocalBusiness, pembanding NAP. |
| `lib/ads.js` | Batas Google Ads (judul 30, deskripsi 90, jalur 15; huruf lebar dihitung 2), draf iklan dari profil, pemeriksaan aturan (tanda seru di judul, emoji, kapital berlebihan), perencana anggaran, UTM, CSV Google Ads Editor. |
| `lib/score.js` | Skor pertumbuhan lokal 0–100 (profil, Profil Bisnis Google, NAP, SEO, ulasan, ritme posting, otomatisasi) dan daftar periksa Google. |
| `lib/print.js` | Dokumen cetak: kartu QR ulasan (2 × A5), catatan pemrosesan, laporan kepatuhan, surat & dokumen teks. |
| `app.js` | Menu panel kiri baru, layar kunci, layar data terblokir, pembuka WhatsApp dengan pesan terisi (`web.whatsapp.com/send`), jendela “Baru di Serambi 1.2”, pesan error yang ramah. |

### Di mana mencari kode per fitur (1.2)
| Fitur | File & fungsi |
| --- | --- |
| Batas paket | `PLANS` di `plans.js`; pemeriksaan di `data-ipc.js` (`locations:save`, `automations:save`) dan `team:invite` di `main.js` |
| Kunci publik lisensi | `LICENSE_PUBLIC_KEY` di `config.js` |
| Sinkronisasi tim | `push()`, `pull()`, `_apply()` di `workspace.js` |
| Ganti kunci tim | `rotate()` dan `removeMember()` di `workspace.js` |
| Izin peran | `PERMS` di `access.js`, `guard()` di `main.js` |
| Penyamaran data pelanggan | `maskCustomer()` dan `publicState()` di `main.js` |
| Persetujuan pelanggan | `addConsent()` di `data-ipc.js`, `hasConsent()` di `automation.js` |
| Daftar periksa UU PDP | `compliance()` di `privacy.js` |
| Log audit | `appendAudit()` / `verifyAudit()` di `security.js` |
| Kunci aplikasi | kelas `Security` di `security.js`, `renderLock()` di `app.js` |
| Pemeriksa SEO | `fetchPage()` di `growth.js`, `analyse()` di `lib/seo.js` |
| Otomatisasi | `run()` di `automation.js`, `RECIPES` di `views/growth-automate.js` |

## Menjalankan dan memeriksa

```bash
npm install          # pasang dependensi
npm start            # jalankan aplikasi
npm run icons        # buat ulang ikon & aset
npm run dist:win     # buat installer Windows
npm run dist:mac     # buat DMG Mac (di komputer Mac)
```

Saat dijalankan dengan `npm start`, menu **Tampilan → Alat pengembang** (atau Ctrl+Shift+I di Windows) membuka DevTools untuk memeriksa antarmuka.
