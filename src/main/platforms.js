// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Platform definitions shared with the renderer (sent once at start-up).
// Colors are plain tints for the monogram tiles — no brand marks are used.
// kind: 'social' = media sosial, 'shop' = toko online (seller center).

const PLATFORMS = {
  instagram: {
    id: 'instagram',
    kind: 'social',
    name: 'Instagram',
    short: 'IG',
    color: '#D6336C',
    home: 'https://www.instagram.com/',
    domains: ['instagram.com', 'cdninstagram.com', 'facebook.com', 'fbcdn.net'],
    limit: 2200,
    needsMedia: true,
    hint: 'Klik tombol Buat (+) di Instagram, pilih foto atau video, lalu tempel keterangannya.'
  },
  facebook: {
    id: 'facebook',
    kind: 'social',
    name: 'Facebook',
    short: 'FB',
    color: '#2F6FDE',
    home: 'https://www.facebook.com/',
    domains: ['facebook.com', 'fbcdn.net', 'fb.com', 'fb.me', 'messenger.com'],
    limit: 63206,
    hint: 'Klik kolom membuat postingan di beranda Facebook, lalu tempel.'
  },
  x: {
    id: 'x',
    kind: 'social',
    name: 'X',
    short: 'X',
    color: '#3A3F4B',
    home: 'https://x.com/home',
    domains: ['x.com', 'twitter.com', 'twimg.com', 't.co'],
    limit: 280,
    hint: 'Teks sudah terisi di jendela postingan. Tambahkan gambar dengan menempel, lalu klik Post.'
  },
  tiktok: {
    id: 'tiktok',
    kind: 'social',
    name: 'TikTok',
    short: 'TT',
    color: '#16161D',
    ink: '#3BE8E2',
    home: 'https://www.tiktok.com/',
    // TikTok Studio opens straight on the upload page when a post is being prepared.
    composeUrl: 'https://www.tiktok.com/upload',
    domains: ['tiktok.com', 'tiktokv.com', 'tiktokcdn.com', 'tiktokw.com', 'ttwstatic.com', 'byteoversea.com', 'ibytedtos.com'],
    limit: 2200,
    needsMedia: true,
    hint: 'Halaman unggah TikTok sudah terbuka. Pilih video atau foto, lalu tempel keterangannya.'
  },
  whatsapp: {
    id: 'whatsapp',
    kind: 'social',
    name: 'WhatsApp',
    short: 'WA',
    color: '#1FA855',
    home: 'https://web.whatsapp.com/',
    domains: ['whatsapp.com', 'whatsapp.net', 'wa.me'],
    limit: 65536,
    hint: 'Buka chat, grup, atau Status yang dituju, lalu tempel.'
  },
  telegram: {
    id: 'telegram',
    kind: 'social',
    name: 'Telegram',
    short: 'TG',
    color: '#2AA3D9',
    home: 'https://web.telegram.org/a/',
    domains: ['telegram.org', 't.me', 'telegram.me', 'telesco.pe'],
    limit: 4096,
    hint: 'Buka chat atau channel yang dituju, lalu tempel.'
  },
  tokopedia: {
    id: 'tokopedia',
    kind: 'shop',
    name: 'Tokopedia',
    short: 'TP',
    color: '#0A8F3C',
    // Tokopedia & TikTok Shop Seller Center (gabungan sejak 2025)
    home: 'https://seller-id.tokopedia.com/',
    domains: ['tokopedia.com', 'tokopedia.net', 'tiktok.com', 'tiktokshop.com', 'tiktokcdn.com', 'ttwstatic.com', 'byteoversea.com', 'ibytedtos.com'],
    limit: null,
    shopUrlHint: 'https://www.tokopedia.com/namatoko',
    hint: 'Teks promosi sudah disalin. Buka menu Promosi atau Chat di Seller Center, lalu tempel. Untuk produk baru, tempel di deskripsi produk.'
  },
  shopee: {
    id: 'shopee',
    kind: 'shop',
    name: 'Shopee',
    short: 'SP',
    color: '#EE4D2D',
    home: 'https://seller.shopee.co.id/',
    domains: ['shopee.co.id', 'shopee.com', 'shopeemobile.com', 'susercontent.com', 'shopee.io'],
    limit: null,
    shopUrlHint: 'https://shopee.co.id/namatoko',
    hint: 'Teks promosi sudah disalin. Buka Pusat Promosi atau Chat di Seller Centre, lalu tempel. Shopee Feed hanya bisa diposting dari aplikasi Shopee di HP.'
  }
};

// Sign-in pages that may open as pop-ups from inside an account.
const AUTH_HOSTS = [
  'accounts.google.com', 'appleid.apple.com', 'login.live.com', 'login.microsoftonline.com',
  'facebook.com', 'm.facebook.com', 'api.twitter.com', 'x.com', 'twitter.com',
  'instagram.com', 'oauth.telegram.org', 'tiktok.com', 'accounts.tokopedia.com', 'accounts.shopee.co.id'
];

function hostMatches(host, domains) {
  host = (host || '').toLowerCase();
  return domains.some(d => host === d || host.endsWith('.' + d));
}

module.exports = { PLATFORMS, AUTH_HOSTS, hostMatches };
