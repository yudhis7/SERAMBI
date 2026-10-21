// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Mode demo for the owner's sales presentations.
// A separate data profile (serambi-demo.json, media-demo, its own team folder) is filled with a
// complete fictional business, "Kopi Senja", so every Serambi feature can be shown to UMKM
// prospects without touching real data. Only a demo licence key unlocks it.
// All people, phone numbers, and the business are fictional. Dates are relative to "now", so
// the demo always looks current; "Atur ulang data demo" rebuilds it.
const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const { pathToFileURL } = require('url');
const S = require('./secure');
const privacy = require('./privacy');

const D = 86400000;
const H = 3600000;
const PROFILE_FILE = 'serambi-profile.json';

function readProfile(dir) {
  try { const p = JSON.parse(fs.readFileSync(path.join(dir, PROFILE_FILE), 'utf8')); return { active: p.active === 'demo' ? 'demo' : 'main', key: p.key || null }; }
  catch (_) { return { active: 'main', key: null }; }
}
function writeProfile(dir, profile) {
  fs.writeFileSync(path.join(dir, PROFILE_FILE), JSON.stringify(profile));
}
const demoTeamDir = (dir) => path.join(dir, 'demo-ruang-kerja');

// ---------- images for the sample posts ----------
const IMAGES = [
  ['kopi-gula-aren.png', 'linear-gradient(160deg,#7A4A2A,#3B2314)', '#F6E7D2', 'Kopi Susu<br>Gula Aren', 'Rp22.000 · favorit sejak 2021'],
  ['promo-kamis.png', 'linear-gradient(160deg,#F2B33D,#E08A1E)', '#3D2900', 'Promo Kamis<br>kopi kedua 50%', 'Setiap Kamis, sampai 17.00'],
  ['es-kopi-pandan.png', 'linear-gradient(160deg,#3F8F5E,#1F5A3A)', '#E7F7EC', 'Menu baru<br>Es Kopi Pandan', 'Segar, wangi, Rp25.000'],
  ['ngopi-nugas.png', 'linear-gradient(160deg,#3446A8,#1F2A6B)', '#E8EBFA', 'Ngopi sambil<br>nugas', 'Wifi kencang · colokan di tiap meja'],
  ['live-akustik.png', 'linear-gradient(160deg,#B4436C,#6A1F45)', '#FCE8F1', 'Live akustik<br>Sabtu malam', 'Mulai 19.30 · gratis masuk'],
  ['manual-brew.png', 'linear-gradient(160deg,#5B6770,#2C3338)', '#EEF1F3', 'Manual brew<br>V60 Gayo', 'Diseduh di depanmu, Rp25.000'],
  ['giveaway.png', 'linear-gradient(160deg,#E2573B,#A3301B)', '#FFEDE8', 'Giveaway<br>5 voucher kopi', 'Follow, like, tag 2 teman'],
  ['terima-kasih.png', 'linear-gradient(160deg,#C98B2B,#7A5212)', '#FFF4DF', 'Terima kasih<br>500 ulasan ★★★★★', 'Dari Google dan GoFood']
];
async function renderImages(mediaDir, fontDir) {
  const out = {};
  fs.mkdirSync(mediaDir, { recursive: true });
  const font = (f) => pathToFileURL(path.join(fontDir, f)).href;
  for (const [file, bg, ink, title, sub] of IMAGES) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face{font-family:'PJS';src:url('${font('PlusJakartaSans.woff2')}') format('woff2');font-weight:200 800}
      html,body{margin:0;width:540px;height:540px;overflow:hidden}
      body{background:${bg};color:${ink};font-family:'PJS',sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:44px;box-sizing:border-box}
      .brand{font-weight:800;letter-spacing:.18em;font-size:16px;opacity:.85}
      .cup{width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.14);align-self:flex-end;box-shadow:inset 0 0 0 14px rgba(255,255,255,.12)}
      h1{font-size:56px;line-height:1.04;margin:0 0 14px;font-weight:800;letter-spacing:-.02em}
      p{margin:0;font-size:20px;font-weight:600;opacity:.9}</style></head>
      <body><div class="brand">KOPI SENJA · SLEMAN</div><div class="cup"></div><div><h1>${title}</h1><p>${sub}</p></div></body></html>`;
    const tmp = path.join(mediaDir, '.render-' + file + '.html');
    fs.writeFileSync(tmp, html);
    let w;
    try {
      w = new BrowserWindow({ show: false, width: 540, height: 540, useContentSize: true, paintWhenInitiallyHidden: true, webPreferences: { javascript: false, sandbox: true, offscreen: true } });
      let painted = null;
      w.webContents.on('paint', (_e, _dirty, image) => { painted = image; });
      await w.loadFile(tmp);
      await new Promise(r => setTimeout(r, 300));
      let img = await w.webContents.capturePage();
      if ((!img || img.isEmpty()) && painted) img = painted;
      if (img && !img.isEmpty()) { fs.writeFileSync(path.join(mediaDir, file), img.toPNG()); out[file] = true; }
    } catch (_) { /* no image: the post simply has no media */ }
    finally { try { w && w.destroy(); } catch (_) {} try { fs.unlinkSync(tmp); } catch (_) {} }
  }
  return out;
}

/**
 * Fills a fresh demo store.
 * ctx: { store, workspace, appendAudit, uid, licenseKey, ownerName, ownerEmail, fontDir, runAutomations }
 */
async function seed(ctx) {
  const { store, workspace, appendAudit, uid, licenseKey, fontDir } = ctx;
  const now = Date.now();
  const day0 = (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const at = (days, h = 10, m = 0) => day0 + days * D + h * H + m * 60000;
  const d = store.data;
  const id = () => uid();

  // ---- device settings ----
  Object.assign(d.settings, {
    license: licenseKey, userName: ctx.ownerName || 'Pemilik', seenVersion: '1.2', preloadAccounts: false, welcomeSeen: true,
    lastBackupAt: now - 6 * D, appliedUseCases: ['kopi'], notifications: false
  });

  // ---- business & locations ----
  d.business = {
    id: 'main', name: 'Kopi Senja', category: 'Kedai kopi', city: 'Sleman', areas: ['Depok', 'Caturtunggal', 'Seturan'],
    description: 'Kopi Senja adalah kedai kopi di Sleman, dekat kampus, untuk mahasiswa dan pekerja yang butuh tempat nyaman. Kami menyajikan kopi susu gula aren, manual brew, es kopi pandan, dan roti bakar. Wifi kencang, colokan di tiap meja, dan suasana tenang untuk nugas maupun rapat kecil. Pesan antar lewat WhatsApp atau GoFood.',
    phone: '', whatsapp: '6281200001234', email: 'halo@kopisenja.example', website: 'https://kopisenja.example',
    hours: 'Setiap hari 08.00–22.00', priceRange: 'Rp15.000–Rp45.000',
    services: ['kopi susu gula aren', 'manual brew', 'es kopi pandan', 'roti bakar', 'paket nugas'], keywords: ['wifi kencang', 'dekat kampus', 'colokan banyak', 'buka sampai malam']
  };
  const L1 = id(), L2 = id();
  const gbp = (keys) => Object.fromEntries(keys.map(k => [k, true]));
  d.locations = [
    {
      id: L1, name: 'Kopi Senja Jakal', address: 'Jl. Kaliurang Km 5,5 No. 21, Caturtunggal, Depok', city: 'Sleman', phone: '6281200001234',
      hours: 'Setiap hari 08.00–22.00', mapsUrl: 'https://kopisenja.example/peta-jakal', placeId: 'ChIJ_DEMO_KopiSenjaJakal', reviewUrl: '',
      gbp: gbp(['verified', 'category', 'hours', 'special_hours', 'phone', 'website', 'description', 'photos', 'products', 'reviews_reply']),
      listings: {
        google: { name: 'Kopi Senja Jakal', address: 'Jl. Kaliurang Km 5,5 No. 21, Caturtunggal, Depok', phone: '0812-0000-1234' },
        instagram: { name: 'Kopi Senja', address: 'Jl. Kaliurang km 5,5 no 21', phone: '0812 0000 1234' },
        gofood: { name: 'Kopi Senja - Kaliurang', address: 'Jl. Kaliurang Km 5 No. 21, Depok', phone: '0812-0000-1243' },
        tokopedia: { name: 'Kopi Senja Official', address: 'Sleman, DI Yogyakarta', phone: '' }
      },
      seo: { url: 'https://kopisenja.example/', score: 74, checkedAt: now - 3 * D, issues: [
        { id: 'schema', ok: false, label: 'Belum ada data terstruktur LocalBusiness', level: 'high' },
        { id: 'click_contact', ok: false, label: 'Tombol telepon/WhatsApp yang bisa diklik', level: 'mid' },
        { id: 'alt', ok: false, label: '4 dari 9 gambar punya teks alternatif', level: 'low' }] },
      createdAt: now - 60 * D
    },
    {
      id: L2, name: 'Kopi Senja Seturan', address: 'Jl. Seturan Raya No. 8, Caturtunggal, Depok', city: 'Sleman', phone: '6281200005678',
      hours: 'Senin–Sabtu 09.00–23.00', mapsUrl: '', placeId: 'ChIJ_DEMO_KopiSenjaSeturan', reviewUrl: '',
      gbp: gbp(['verified', 'category', 'hours', 'phone', 'photos', 'description']), listings: {}, seo: null, createdAt: now - 25 * D
    }
  ];

  // ---- social media & shop accounts ----
  const acc = (platform, name, extra = {}) => ({ id: id(), platform, name, muted: false, createdAt: now - 60 * D, ...extra });
  const IG = acc('instagram', 'Kopi Senja'), FB = acc('facebook', 'Kopi Senja'), TT = acc('tiktok', 'kopisenja.id');
  const WA = acc('whatsapp', 'WA Kedai'), TG = acc('telegram', 'Info Kopi Senja');
  const TP = acc('tokopedia', 'Kopi Senja Official', { shopUrl: 'https://kopisenja.example/tokopedia' });
  const SP = acc('shopee', 'Kopi Senja Store', { shopUrl: 'https://kopisenja.example/shopee' });
  d.accounts = [IG, FB, TT, WA, TG, TP, SP];

  d.templates = [
    { id: id(), name: 'Penutup Kopi Senja', text: '📍 Jl. Kaliurang Km 5,5 & Jl. Seturan Raya · Buka setiap hari\nPesan lewat WhatsApp 0812-0000-1234\n#kopisleman #kopijogja #ngopidekatkampus', tag: 'Kopi Senja' },
    { id: id(), name: 'Promo Kamis', text: 'Kamis waktunya ngopi! ☕ Kopi kedua setengah harga sampai jam 17.00. Tunjukkan postingan ini di kasir.', tag: 'Kopi Senja' },
    { id: id(), name: 'Menu baru', text: 'Menu baru! ✨ [nama menu]: [rasa singkat]. Cobain minggu ini dan ceritakan pendapatmu di kolom komentar 👇', tag: 'Kopi Senja' },
    { id: id(), name: 'Balasan tanya harga', text: 'Halo Kak! Kopi susu gula aren Rp22.000, manual brew mulai Rp25.000, roti bakar Rp18.000. Bisa pesan antar lewat WhatsApp ya 😊' }
  ];

  // ---- team workspace (a local folder stands in for Google Drive in the demo) ----
  const teamParent = demoTeamDir(store.dir);
  fs.mkdirSync(teamParent, { recursive: true });
  await workspace.create({ parentDir: teamParent, name: 'Kopi Senja', ownerName: ctx.ownerName || 'Pemilik', ownerEmail: ctx.ownerEmail || '' });
  const owner = d.members[0];
  const person = (name, email, role, canSeeCustomers, device, lastSeenAgo) => {
    const kp = S.keyPair();
    return { m: { id: id(), name, email, role, status: 'active', accountIds: [], canSeeCustomers, devices: [{ id: id(), name: device, pub: S.b64(kp.pub), addedAt: now - 40 * D }], invitedAt: now - 42 * D, joinedAt: now - 41 * D, invitedBy: owner.id }, lastSeenAgo };
  };
  const team = [
    person('Sinta Maharani', 'sinta@kopisenja.example', 'admin', true, 'Laptop Sinta', 6 * 60000),
    person('Bayu Pratama', 'bayu@kopisenja.example', 'editor', false, 'PC Konten', 2 * H),
    person('Dimas Saputra', 'dimas@kopisenja.example', 'editor', true, 'Komputer Kasir Jakal', 25 * 60000),
    person('Laras (akuntan)', 'laras@kopisenja.example', 'viewer', false, 'Laptop Laras', 3 * D)
  ];
  const [SINTA, BAYU, DIMAS, LARAS] = team.map(t => t.m);
  d.members.push(SINTA, BAYU, DIMAS, LARAS);
  DIMAS.accountIds = [WA.id, TP.id, SP.id];
  d.wsMeta.accessReviewedAt = now - 20 * D;
  d.wsMeta.automationDevice = d.device.id;
  // Presence so the team page shows who was active recently.
  for (const t of team) {
    const dev = t.m.devices[0];
    try {
      fs.writeFileSync(path.join(workspace.link.path, 'presence', dev.id + '.srb'),
        workspace.encrypt(`presence/${dev.id}`, Buffer.from(JSON.stringify({ deviceId: dev.id, memberId: t.m.id, deviceName: dev.name, os: 'win32', version: '1.2.1', at: now - t.lastSeenAgo }))));
    } catch (_) {}
  }

  // ---- posts ----
  const imgs = await renderImages(store.mediaDir, fontDir);
  const media = (file) => imgs[file] ? [{ id: id(), file, type: 'image', name: file }] : [];
  const tgt = (accs, status = 'pending', doneAt = null) => accs.map(a => ({ accountId: a.id, status, error: '', ...(doneAt ? { doneAt } : {}) }));
  const P = [];
  const post = (o) => { const p = { id: id(), media: [], postedAt: null, createdAt: (o.scheduledAt || now) - 2 * D, updatedAt: now - D, createdBy: owner.id, assigneeId: null, approval: null, ...o }; P.push(p); return p; };
  const posted = [
    [-27, 'Selamat pagi, Sleman! Kopi susu gula aren hangat sudah siap ☕', [IG, FB], 'kopi-gula-aren.png'],
    [-24, 'Promo Kamis! Kopi kedua setengah harga sampai jam 17.00.', [IG, FB, TT], 'promo-kamis.png'],
    [-20, 'Ngopi sambil nugas? Wifi kencang dan colokan di tiap meja 💻', [IG, TT], 'ngopi-nugas.png'],
    [-17, 'Promo Kamis minggu ini: kopi kedua 50%. Ajak teman sekelas!', [IG, FB, TT], 'promo-kamis.png'],
    [-14, 'Biji kopi Gayo baru datang. Cobain manual brew-nya ya.', [IG, TG], 'manual-brew.png'],
    [-10, 'Menu baru: Es Kopi Pandan! Segar dan wangi 🌿', [IG, FB, TT, TP, SP], 'es-kopi-pandan.png'],
    [-7, 'Promo Kamis! Kopi kedua setengah harga.', [IG, FB, TT], 'promo-kamis.png'],
    [-4, 'Terima kasih 500 ulasan bintang lima di Google dan GoFood 🙏', [IG, FB], 'terima-kasih.png'],
    [-2, 'Paket nugas: kopi + roti bakar Rp35.000, khusus Senin–Jumat.', [IG, WA, TG], 'ngopi-nugas.png']
  ];
  for (const [days, text, accs, img] of posted) {
    const t = at(days, 10, 30);
    post({ text, media: media(img), targets: tgt(accs, 'done', t + 20 * 60000), status: 'posted', scheduledAt: t, postedAt: t + 20 * 60000, createdBy: [owner.id, BAYU.id, SINTA.id][Math.abs(days) % 3], assigneeId: SINTA.id });
  }
  const dueAt = Math.min(now - 40 * 60000, at(0, 9, 0));
  post({ text: 'Selamat pagi! Kopi Senja Seturan buka jam 09.00 hari ini. Sampai ketemu ☕', media: media('kopi-gula-aren.png'), targets: [{ accountId: IG.id, status: 'waiting', error: '' }, { accountId: FB.id, status: 'waiting', error: '' }], status: 'due', scheduledAt: dueAt, assigneeId: owner.id });
  const later = now + 2 * H;
  post({ text: 'Sore-sore enaknya es kopi pandan. Pesan antar lewat WhatsApp atau GoFood!', media: media('es-kopi-pandan.png'), targets: tgt([IG, FB, TT]), status: 'scheduled', scheduledAt: later, assigneeId: owner.id });
  const thursday = (() => { for (let i = 1; i <= 7; i++) { const t = at(i, 11, 0); if (new Date(t).getDay() === 4) return t; } return at(3, 11, 0); })();
  post({ text: 'Promo Kamis! Kopi kedua setengah harga sampai jam 17.00. Tunjukkan postingan ini di kasir ☕\n\n#kopisleman #kopijogja', media: media('promo-kamis.png'), targets: tgt([IG, FB, TT]), status: 'scheduled', scheduledAt: thursday, assigneeId: SINTA.id, createdBy: SINTA.id });
  post({ text: 'Info buat pelanggan Tokopedia & Shopee: biji kopi 250 g sekarang bisa dikirim ke seluruh Indonesia.', targets: tgt([TP, SP, TG]), status: 'scheduled', scheduledAt: at(2, 13, 0), assigneeId: DIMAS.id, createdBy: DIMAS.id });
  post({ text: 'Weekend di Kopi Senja: live akustik Sabtu malam jam 19.30 🎸', media: media('live-akustik.png'), targets: tgt([IG, FB, TT]), status: 'scheduled', scheduledAt: at(4, 16, 0), assigneeId: SINTA.id });
  const r1 = post({ text: 'Behind the scene: cara barista kami menyeduh V60 ☕', media: media('manual-brew.png'), targets: tgt([TT, IG]), status: 'review', scheduledAt: at(1, 19, 0), createdBy: BAYU.id, assigneeId: BAYU.id,
    approval: { requestedBy: BAYU.id, requestedByName: BAYU.name, requestedAt: now - 3 * H, note: 'Fotonya sudah diedit, tolong dicek teksnya' } });
  const r2 = post({ text: 'Giveaway 5 voucher kopi gratis! Follow, like, dan tag 2 temanmu 🎁', media: media('giveaway.png'), targets: tgt([IG]), status: 'review', scheduledAt: at(3, 18, 0), createdBy: BAYU.id, assigneeId: BAYU.id,
    approval: { requestedBy: BAYU.id, requestedByName: BAYU.name, requestedAt: now - 50 * 60000, note: '' } });
  post({ text: 'Diskon 50% semua menu!!!', media: media('promo-kamis.png'), targets: tgt([IG]), status: 'draft', scheduledAt: null, createdBy: BAYU.id,
    approval: { requestedBy: BAYU.id, requestedByName: BAYU.name, requestedAt: now - 2 * D, decision: 'rejected', decidedBy: SINTA.id, decidedByName: SINTA.name, decidedAt: now - 2 * D + H, decisionNote: 'Diskonnya belum disetujui pemilik, pakai promo Kamis saja' } });
  post({ text: 'Hari Pelanggan: terima kasih sudah jadi bagian dari Kopi Senja…', targets: [], status: 'draft', scheduledAt: null, createdBy: owner.id });
  d.posts = P;
  d.comments = [
    { id: id(), postId: r1.id, memberId: SINTA.id, memberName: SINTA.name, text: 'Teksnya aman, tapi tambahkan harga di caption ya', createdAt: now - 2 * H },
    { id: id(), postId: r1.id, memberId: BAYU.id, memberName: BAYU.name, text: 'Siap kak, sudah saya tambahkan', createdAt: now - 90 * 60000 },
    { id: id(), postId: r2.id, memberId: SINTA.id, memberName: SINTA.name, text: 'Pastikan syarat giveaway sesuai aturan Instagram', createdAt: now - 30 * 60000 }
  ];

  // ---- campaigns ----
  d.campaigns = [
    {
      id: id(), name: 'Kopi Pagi – Google Penelusuran', channel: 'google', objective: 'visits', status: 'live', locationId: L1, radiusKm: 5,
      startAt: at(-18, 0), endAt: at(12, 23, 59), budget: 1500000, spend: 860000, impressions: 18400, clicks: 640, leads: 72, sales: 58, revenue: 2900000,
      url: 'https://kopisenja.example/', utm: { source: 'google', medium: 'cpc', campaign: 'kopi_pagi', content: '' },
      ads: {
        headlines: ['Kopi Senja Sleman', 'Kopi Susu Gula Aren Sleman', 'Kedai Kopi Dekat Kampus', 'Wifi Kencang & Colokan Banyak', 'Buka Setiap Hari 08.00–22.00', 'Pesan Lewat WhatsApp', 'Rating 4,8 di Google', 'Paket Nugas Rp35.000'],
        descriptions: ['Kopi susu gula aren, manual brew, dan roti bakar di Jl. Kaliurang. Tempat nyaman buat nugas.', 'Pesan antar lewat WhatsApp atau datang langsung. Lihat ulasan pelanggan kami di Google.'],
        paths: ['kopi', 'sleman'], keywords: ['"kedai kopi sleman"', '"kopi dekat ugm"', '[kopi susu gula aren jogja]', '"tempat nugas jogja"'], negatives: ['gratis', 'lowongan', 'resep'], meta: null
      },
      notes: 'Kode voucher KS-GOOGLE di kasir', createdAt: now - 18 * D, createdBy: owner.id
    },
    {
      id: id(), name: 'Klik ke WhatsApp – Paket Nugas', channel: 'meta', objective: 'messages', status: 'live', locationId: L1, radiusKm: 3,
      startAt: at(-10, 0), endAt: at(20, 23, 59), budget: 1000000, spend: 540000, impressions: 41000, clicks: 920, leads: 64, sales: 37, revenue: 1480000,
      url: 'https://kopisenja.example/', utm: { source: 'facebook', medium: 'cpc', campaign: 'paket_nugas', content: '' },
      ads: { headlines: [], descriptions: [], paths: [], keywords: [], negatives: [], meta: { primary: 'Mahasiswa Jakal, cari tempat nugas yang nyaman? Paket kopi + roti bakar Rp35.000, wifi kencang, colokan di tiap meja.', headline: 'Paket Nugas Rp35.000', description: 'Chat untuk reservasi' } },
      notes: 'Iklan klik ke WhatsApp, radius 3 km dari kampus', createdAt: now - 10 * D, createdBy: SINTA.id
    },
    {
      id: id(), name: 'Brosur kampus Oktober', channel: 'offline', objective: 'visits', status: 'done', locationId: L2, radiusKm: 0,
      startAt: at(-35, 0), endAt: at(-21, 23, 59), budget: 300000, spend: 300000, impressions: 1500, clicks: 0, leads: 25, sales: 21, revenue: 840000,
      url: 'https://kopisenja.example/', utm: { source: 'brosur', medium: 'offline', campaign: 'kampus_oktober', content: 'a5' }, ads: null,
      notes: 'QR di brosur A5, dibagikan di 3 kampus', createdAt: now - 36 * D, createdBy: owner.id
    }
  ];

  // ---- customers (fictional; numbers use the 0812-0000 block) ----
  const g = (purpose, daysAgo, by = SINTA, method = 'lisan') => ({ id: id(), purpose, status: 'granted', at: now - daysAgo * D, method, evidence: '', noticeVersion: 1, by: by.id, byName: by.name });
  const w = (purpose, daysAgo, by = SINTA) => ({ id: id(), purpose, status: 'withdrawn', at: now - daysAgo * D, method: 'pesan', evidence: 'Minta tidak dikirimi promo', noticeVersion: 1, by: by.id, byName: by.name });
  const md = (offsetDays) => { const x = new Date(now + offsetDays * D); return `19${90 + (Math.abs(offsetDays) % 9)}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const C = [
    ['Rina Wulandari', 1.3, 18, ['langganan'], [g('whatsapp', 40), g('review', 40), g('birthday', 40)], md(0), L1],
    ['Andi Pratama', 75, 6, ['mahasiswa'], [g('whatsapp', 90)], '', L1],
    ['Siti Rahmawati', 1.2, 9, ['kantor'], [g('review', 30), g('whatsapp', 30)], md(12), L1],
    ['Budi Hartono', 52, 4, [], [g('whatsapp', 60)], '', L2],
    ['Dewi Lestari', 4, 22, ['langganan', 'member'], [g('whatsapp', 100, DIMAS), g('review', 100, DIMAS), g('birthday', 100, DIMAS)], md(5), L1],
    ['Fajar Nugroho', 1.4, 2, ['mahasiswa'], [g('review', 3, DIMAS, 'qr')], '', L2],
    ['Maya Anggraini', 12, 11, ['langganan'], [g('whatsapp', 70), w('whatsapp', 8)], '', L1],
    ['Rizky Ramadhan', 2, 3, ['mahasiswa'], [], '', L2],
    ['Putri Ayu', 30, 7, ['kantor'], [g('whatsapp', 50), g('birthday', 50)], md(20), L1],
    ['Hendra Wijaya', 95, 5, [], [g('whatsapp', 120)], '', L1],
    ['Nadia Safitri', 6, 14, ['member'], [g('whatsapp', 80, DIMAS), g('review', 80, DIMAS)], '', L2],
    ['Yoga Permana', 1.1, 1, [], [g('review', 1, DIMAS, 'qr'), g('whatsapp', 1, DIMAS, 'qr')], '', L1],
    ['Intan Permatasari', 18, 9, ['langganan'], [g('whatsapp', 60), g('review', 60)], md(-2), L1],
    ['Agus Setiawan', 64, 3, ['kantor'], [g('whatsapp', 65)], '', L2],
    ['Lestari Handayani', 9, 6, [], [g('review', 20)], '', L1],
    ['Bagas Kurniawan', 3, 2, ['mahasiswa'], [], '', L1],
    ['Citra Kirana', 22, 16, ['member'], [g('whatsapp', 110), g('review', 110), g('birthday', 110)], md(30), L2],
    ['Eko Prasetyo', 140, 2, [], [g('whatsapp', 160)], '', L1],
    ['Wulan Sari', 5, 8, ['kantor'], [g('whatsapp', 40, DIMAS)], '', L2],
    ['Galih Saputra', 1.25, 4, ['mahasiswa'], [g('review', 10, DIMAS), g('whatsapp', 10, DIMAS)], '', L2]
  ];
  d.customers = C.map(([name, daysAgo, visits, tags, consents, birthday, loc], i) => ({
    id: id(), name, phone: '628120000' + String(1001 + i * 37).padStart(4, '0'), email: '', birthday, locationId: loc, tags,
    lastVisitAt: now - daysAgo * D, visits, notes: '', consents, restricted: i === 9, restrictedReason: i === 9 ? 'Permintaan pelanggan' : '',
    source: i % 4 === 0 ? 'impor' : 'manual', createdAt: now - (45 + i) * D, createdBy: i % 2 ? DIMAS.id : SINTA.id
  }));

  // ---- reviews ----
  const rv = (source, rating, author, text, daysAgo, loc, reply, replyAfterH, posted = true) => ({
    id: id(), locationId: loc, source, rating, author, text, date: now - daysAgo * D,
    ...(reply ? { reply, repliedAt: now - daysAgo * D + replyAfterH * H, repliedBy: SINTA.id, replyPosted: posted } : { reply: '' }), createdAt: now - daysAgo * D
  });
  d.reviews = [
    rv('google', 5, 'Rina Wulandari', 'Kopi susu gula arennya juara, tempatnya nyaman buat nugas. Wifi kencang!', 2, L1, 'Terima kasih banyak, Rina! Ditunggu kedatangannya lagi di Kopi Senja 😊', 5),
    rv('google', 5, 'Fajar N.', 'Baristanya ramah, manual brew Gayo enak banget.', 1, L2, ''),
    rv('google', 2, 'Hendra', 'Pesanan saya lama sekali datangnya, hampir 30 menit.', 1.5, L1, ''),
    rv('gofood', 4, 'Siti R.', 'Es kopi pandan segar, packaging rapi.', 3, L1, 'Terima kasih, Siti! Senang Kakak suka es kopi pandannya.', 20, true),
    rv('google', 5, 'Yoga Permana', 'Tempat favorit buat rapat kecil. Colokan banyak.', 0.4, L1, ''),
    rv('tokopedia', 5, 'pembeli_kopi', 'Biji kopi fresh, roasting date jelas. Pengiriman cepat.', 6, L1, 'Terima kasih sudah belanja di Kopi Senja Official!', 3),
    rv('shopee', 4, 'nadia.s', 'Rasa enak, cuma kemasan agak penyok di ekspedisi.', 8, L2, 'Mohon maaf soal kemasannya, Kak. Kami sudah tambah bubble wrap untuk pengiriman berikutnya.', 10),
    rv('google', 3, 'Agus S.', 'Kopinya oke, tapi parkir motor sempit kalau sore.', 11, L2, 'Terima kasih masukannya, Agus. Mulai minggu depan ada area parkir tambahan di samping kedai.', 26),
    rv('google', 5, 'Citra Kirana', 'Live akustik Sabtu malam seru! Roti bakarnya juga enak.', 14, L2, 'Terima kasih, Citra! Sampai ketemu di live akustik berikutnya 🎸', 4),
    rv('gofood', 5, 'Bagas K.', 'Pesan antar cepat, kopi masih dingin pas sampai.', 4, L1, ''),
    rv('google', 5, 'Dewi Lestari', 'Sudah langganan 2 tahun. Konsisten enaknya.', 20, L1, 'Terima kasih Kak Dewi sudah setia bersama Kopi Senja 🙏', 2),
    rv('google', 4, 'Maya A.', 'Suasana enak, harga bersahabat untuk mahasiswa.', 26, L1, 'Terima kasih, Maya! Ditunggu lagi ya.', 7),
    rv('shopee', 5, 'wulansari', 'Drip bag-nya praktis buat di kantor.', 33, L2, 'Terima kasih, Kak Wulan!', 30),
    rv('google', 5, 'Putri Ayu', 'Pelayanannya cepat dan ramah. Rekomen!', 40, L1, 'Terima kasih Putri! 😊', 6)
  ];

  // ---- automations ----
  const auto = (type, name, config, createdBy = owner.id) => ({ id: id(), type, name, enabled: true, config, keys: [], createdAt: now - 30 * D, createdBy });
  d.automations = [
    auto('review_request', 'Minta ulasan setelah berkunjung', { afterDays: 1 }),
    auto('birthday', 'Ucapan ulang tahun', {}),
    auto('winback', 'Sapa pelanggan 45 hari tidak datang', { days: 45, assigneeId: SINTA.id }),
    auto('moment_prep', 'Siapkan konten momen', { daysBefore: 21, kinds: ['libur', 'belanja', 'peringatan'], draft: true, assigneeId: BAYU.id }),
    auto('review_reply', 'Pengingat balas ulasan', { hours: 24 }),
    auto('gbp_weekly', 'Update mingguan Profil Bisnis Google', { weekday: new Date(now).getDay(), assigneeId: BAYU.id }),
    auto('weekly_report', 'Laporan mingguan untuk pemilik', { weekday: 1, time: '08:00' }),
    auto('retention_check', 'Pemeriksaan masa simpan data', {})
  ];

  // ---- tasks ----
  const task = (title, detail, assignee, dueDays, extra = {}) => ({ id: id(), title, detail, dueAt: at(dueDays, 17, 0), assigneeId: assignee.id, status: 'open', source: 'manual', createdAt: now - D, createdBy: owner.id, ...extra });
  d.tasks = [
    task('Ganti 5 foto menu di Profil Bisnis Google', 'Pakai foto es kopi pandan dan suasana malam.', BAYU, 1),
    task('Pasang kartu QR ulasan di meja Seturan', 'Cetak dari Tumbuh lokal → Ulasan → Kartu QR.', DIMAS, 2, { link: { route: 'growth', tab: 'reviews' } }),
    task('Isi daftar periksa Profil Google cabang Seturan', 'Jam khusus libur, atribut QRIS, produk & harga.', SINTA, 3, { link: { route: 'growth', tab: 'discover' } }),
    task('Cek hasil iklan Google minggu ini', 'Catat klik, prospek, dan pembeli dari kode voucher KS-GOOGLE.', owner, 0, { link: { route: 'growth', tab: 'ads' } }),
    { ...task('Rekap penjualan marketplace September', '', DIMAS, -12), status: 'done', doneAt: now - 11 * D, doneBy: DIMAS.id },
    { ...task('Balas ulasan Agus soal parkir', '', SINTA, -10), status: 'done', doneAt: now - 10 * D, doneBy: SINTA.id }
  ];

  // ---- Trust Center ----
  d.privacy = {
    id: 'main', ropa: privacy.defaultRopa(d.business), ropaReviewedAt: now - 30 * D,
    notice: { version: 1, publishedAt: now - 30 * D, publishedBy: owner.name, contact: 'Sinta Maharani · privasi@kopisenja.example', text: noticeText(d.business) },
    retention: privacy.retentionOf(null), ppdp: { name: 'Sinta Maharani', email: 'privasi@kopisenja.example', phone: '0812-0000-1234', role: 'Admin', required: false },
    dpia: { answers: {}, note: '', at: now - 30 * D }
  };
  d.dsr = [
    { id: id(), type: 'access', name: 'Maya Anggraini', contact: 'WhatsApp', channel: 'WhatsApp', detail: 'Minta salinan data yang disimpan Kopi Senja.', customerId: d.customers[6].id, verified: true,
      receivedAt: now - 9 * D, dueAt: now - 9 * D + 72 * H, status: 'closed', closedAt: now - 8 * D, response: 'Salinan data sudah dikirim lewat WhatsApp.', log: [{ at: now - 8 * D, by: SINTA.name, text: 'Salinan data dibuat' }], createdAt: now - 9 * D, createdBy: SINTA.id },
    { id: id(), type: 'correct', name: 'Budi Hartono', contact: 'Datang ke kasir', channel: 'Langsung', detail: 'Nomor WhatsApp ganti, minta diperbarui.', customerId: d.customers[3].id, verified: true,
      receivedAt: now - 20 * H, dueAt: now - 20 * H + 72 * H, status: 'progress', closedAt: null, response: '', log: [{ at: now - 19 * H, by: DIMAS.name, text: 'Status: progress' }], createdAt: now - 20 * H, createdBy: DIMAS.id }
  ];
  d.incidents = [
    { id: id(), title: 'Ponsel kasir tertinggal di angkot', discoveredAt: now - 40 * D, occurredAt: now - 40 * D - 3 * H, description: 'Ponsel cadangan kasir Seturan tertinggal. Berisi chat WhatsApp pelanggan.', dataTypes: 'Nama dan nomor WhatsApp sekitar 30 pelanggan',
      subjects: 30, cause: 'Ponsel tanpa kunci layar.', containment: 'WhatsApp di ponsel itu dikeluarkan dari perangkat tertaut, kata sandi akun diganti.', recovery: 'Semua ponsel kasir wajib kunci layar; data pelanggan hanya di Serambi dengan PIN.', severity: 'sedang',
      notifiedSubjectsAt: now - 39 * D, notifiedAuthorityAt: now - 39 * D + 2 * H, notifiedAt: now - 39 * D + 2 * H, checklist: { contain: true, assess: true, notify_subjects: true, notify_authority: true, document: true }, status: 'closed', closedAt: now - 30 * D, createdAt: now - 40 * D, createdBy: owner.id }
  ];

  // ---- automations produce today's tasks and drafts ----
  if (ctx.runAutomations) ctx.runAutomations();

  // ---- audit log, rebuilt in time order so the hash chain stays intact ----
  d.audit = [];
  const ev = (daysAgo, actor, action, target = '', detail = '') => ({ at: now - daysAgo * D, actor, action, target, detail });
  const short = (c) => '#' + c.id.slice(0, 6);
  const events = [
    ev(45, owner, 'license.activate', 'MediumPreneur', '30 pengguna'),
    ev(44.9, owner, 'workspace.create', 'Kopi Senja', 'Google Drive'),
    ev(42, owner, 'member.invite', SINTA.name, 'Admin'), ev(42, owner, 'member.invite', BAYU.name, 'Editor'),
    ev(42, owner, 'member.invite', DIMAS.name, 'Editor'), ev(42, owner, 'member.invite', LARAS.name, 'Pengamat'),
    ev(41, SINTA, 'workspace.join', 'Kopi Senja', 'Laptop Sinta'), ev(41, BAYU, 'workspace.join', 'Kopi Senja', 'PC Konten'),
    ev(41, DIMAS, 'workspace.join', 'Kopi Senja', 'Komputer Kasir Jakal'), ev(40.5, LARAS, 'workspace.join', 'Kopi Senja', 'Laptop Laras'),
    ev(40, owner, 'member.access', DIMAS.name, 'Boleh melihat data pelanggan'),
    ev(40, owner, 'incident.create', 'Ponsel kasir tertinggal di angkot', 'open'),
    ev(39, owner, 'incident.update', 'Ponsel kasir tertinggal di angkot', 'Subjek data & lembaga diberi tahu'),
    ev(30, owner, 'privacy.ropa', '', '6 kegiatan pemrosesan'), ev(30, owner, 'privacy.notice', '', 'Versi 1'),
    ev(30, owner, 'privacy.ppdp', 'Sinta Maharani'), ev(30, owner, 'incident.update', 'Ponsel kasir tertinggal di angkot', 'closed'),
    ev(29, SINTA, 'customer.import', '', '5 baru, 0 diperbarui'),
    ...d.customers.slice(0, 6).map((c, i) => ev(28 - i, i % 2 ? DIMAS : SINTA, 'consent.grant', short(c), 'Promo WhatsApp')),
    ev(20, owner, 'team.access-review', '', 'Akses data pelanggan ditinjau'),
    ev(12, SINTA, 'post.approve', 'Menu baru: Es Kopi Pandan!'), ev(9, SINTA, 'dsr.create', 'Akses & salinan data (Pasal 7)', 'open'),
    ev(8, SINTA, 'customer.export', short(d.customers[6]), 'Salinan data untuk pelanggan'), ev(8, SINTA, 'dsr.update', 'Akses & salinan data (Pasal 7)', 'closed'),
    ev(8, SINTA, 'consent.withdraw', short(d.customers[6]), 'Promo WhatsApp'), ev(6, owner, 'data.backup', '', 'Cadangan terenkripsi'),
    ev(2, SINTA, 'post.reject', 'Diskon 50% semua menu!!!', 'Diskonnya belum disetujui pemilik'),
    ev(0.83, DIMAS, 'dsr.create', 'Perbaikan data (Pasal 6)', 'open'), ev(0.8, DIMAS, 'customer.update', short(d.customers[3]))
  ].sort((a, b) => a.at - b.at);
  for (const e of events) appendAudit(store, { id: e.actor.id, name: e.actor.name }, e);

  d.demo = { seededAt: now, version: 1 };
  store.save(true);
  await workspace.push(true);
}

function noticeText(b) {
  return `PEMBERITAHUAN PRIVASI KOPI SENJA

Kopi Senja (Sleman) menghargai data pribadi Anda. Pemberitahuan ini menjelaskan data yang kami kumpulkan, tujuannya, masa simpan, dan hak Anda, sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.

1. Data yang kami kumpulkan: nama panggilan, nomor WhatsApp, cabang, riwayat kunjungan, dan tanggal lahir (hanya bila Anda setuju menerima ucapan ulang tahun).
2. Tujuan: melayani pesanan, mengirim promo (bila Anda setuju), meminta ulasan (bila Anda setuju), dan ucapan ulang tahun (bila Anda setuju).
3. Persetujuan dicatat per tujuan dan dapat ditarik kapan saja.
4. Akses: hanya pemilik dan tim yang memerlukan. Kami tidak menjual data Anda.
5. Masa simpan: 24 bulan setelah kunjungan terakhir, atau lebih cepat bila Anda meminta.
6. Hak Anda: informasi, akses dan salinan, perbaikan, penghapusan, penarikan persetujuan, keberatan atas keputusan otomatis, penundaan/pembatasan, dan portabilitas data.
7. Kontak: Sinta Maharani, privasi@kopisenja.example, WhatsApp ${b.whatsapp ? '0812-0000-1234' : ''}. Kami menanggapi paling lambat 3 × 24 jam.`;
}

module.exports = { seed, readProfile, writeProfile, demoTeamDir, PROFILE_FILE };
