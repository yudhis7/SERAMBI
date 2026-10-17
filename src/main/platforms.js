// Platform definitions shared with the renderer (sent once at start-up).
// Colors are plain tints for the monogram tiles — no brand marks are used.

const PLATFORMS = {
  instagram: {
    id: 'instagram',
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
    name: 'X',
    short: 'X',
    color: '#3A3F4B',
    home: 'https://x.com/home',
    domains: ['x.com', 'twitter.com', 'twimg.com', 't.co'],
    limit: 280,
    hint: 'Teks sudah terisi di jendela postingan. Tambahkan gambar dengan menempel, lalu klik Post.'
  },
  whatsapp: {
    id: 'whatsapp',
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
    name: 'Telegram',
    short: 'TG',
    color: '#2AA3D9',
    home: 'https://web.telegram.org/a/',
    domains: ['telegram.org', 't.me', 'telegram.me', 'telesco.pe'],
    limit: 4096,
    hint: 'Buka chat atau channel yang dituju, lalu tempel.'
  }
};

// Sign-in pages that may open as pop-ups from inside an account.
const AUTH_HOSTS = [
  'accounts.google.com', 'appleid.apple.com', 'login.live.com', 'login.microsoftonline.com',
  'facebook.com', 'm.facebook.com', 'api.twitter.com', 'x.com', 'twitter.com',
  'instagram.com', 'oauth.telegram.org'
];

function hostMatches(host, domains) {
  host = (host || '').toLowerCase();
  return domains.some(d => host === d || host.endsWith('.' + d));
}

module.exports = { PLATFORMS, AUTH_HOSTS, hostMatches };
