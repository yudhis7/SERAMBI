// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Local SEO check of one web page, done inside Serambi from the page's HTML.
// The page is parsed as an inert document (scripts never run).
import { normPhone } from '../ctx.js';

const LOCAL_TYPES = /LocalBusiness|Restaurant|Cafe|Coffee|Bakery|Store|Shop|Repair|Salon|Spa|Dentist|Clinic|Physician|Hotel|Lodging|FoodEstablishment|Beauty|Laundry|DryCleaning|Gym|Agency|Pharmacy|Optician|Veterinary|ChildCare|Florist|Automotive|ProfessionalService|HomeAndConstruction|Contractor|Plumber|Electrician|Locksmith|Bar|Winery|Brewery/;

function words(text) { return (String(text || '').match(/[\p{L}\p{N}]+/gu) || []); }
function lower(s) { return String(s || '').toLowerCase(); }

function jsonLdTypes(doc) {
  const out = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try {
      const walk = (v) => {
        if (!v || typeof v !== 'object') return;
        if (Array.isArray(v)) return v.forEach(walk);
        if (v['@type']) out.push({ type: [].concat(v['@type']).join(','), node: v });
        if (v['@graph']) walk(v['@graph']);
      };
      walk(JSON.parse(s.textContent));
    } catch (_) {}
  });
  return out;
}

/**
 * Returns { score, checks:[{id, ok, label, level, fix, detail}] }.
 * biz: business profile, loc: location (city/address/phone).
 */
export function analyse(res, biz = {}, loc = {}) {
  const doc = new DOMParser().parseFromString(res.html || '', 'text/html');
  const text = doc.body ? doc.body.textContent.replace(/\s+/g, ' ') : '';
  const title = (doc.querySelector('title') || {}).textContent || '';
  const desc = (doc.querySelector('meta[name="description" i]') || {}).content || '';
  const h1s = [...doc.querySelectorAll('h1')].map(h => h.textContent.trim()).filter(Boolean);
  const robots = lower((doc.querySelector('meta[name="robots" i]') || {}).content || '') + ' ' + lower(res.xRobots);
  const viewport = !!doc.querySelector('meta[name="viewport" i]');
  const imgs = [...doc.querySelectorAll('img')];
  const alts = imgs.filter(i => (i.getAttribute('alt') || '').trim()).length;
  const links = [...doc.querySelectorAll('a[href]')].map(a => a.getAttribute('href') || '');
  const iframes = [...doc.querySelectorAll('iframe[src]')].map(f => f.getAttribute('src') || '');
  const types = jsonLdTypes(doc);
  const local = types.find(t => LOCAL_TYPES.test(t.type));
  const city = lower(loc.city || biz.city || '');
  const nameL = lower(biz.name || '');
  const phoneDigits = normPhone(loc.phone || biz.whatsapp || biz.phone || '');
  // Compare digits only, so "0812-3456-7890", "+62 812 3456 7890" and "wa.me/6281234567890" all match.
  const pageDigits = (text + ' ' + links.join(' ')).replace(/\D/g, '');
  const localDigits = phoneDigits.startsWith('62') ? '0' + phoneDigits.slice(2) : phoneDigits;
  const hasPhone = phoneDigits.length > 8 && (pageDigits.includes(phoneDigits) || pageDigits.includes(localDigits));
  const services = (biz.services || []).map(lower).filter(Boolean);
  const textL = lower(text);
  const wordCount = words(text).length;
  const titleLen = Array.from(title.trim()).length;
  const descLen = Array.from(desc.trim()).length;

  const checks = [
    { id: 'noindex', w: 10, level: 'high', ok: !/noindex/.test(robots), label: 'Izin tampil di Google (tanpa noindex)', fix: 'Hapus tag “noindex” di meta robots atau header X-Robots-Tag. Dengan tag itu Google tidak menampilkan halaman ini.' },
    { id: 'status', w: 5, level: 'high', ok: res.status >= 200 && res.status < 300, label: `Halaman bisa dibuka (kode ${res.status})`, fix: 'Pastikan alamat situs benar dan halaman tidak mengarah ke halaman error.' },
    { id: 'https', w: 5, level: 'high', ok: !!res.https, label: 'HTTPS (gembok aman)', fix: 'Aktifkan sertifikat SSL di hosting. Kebanyakan hosting menyediakannya gratis (Let’s Encrypt).' },
    { id: 'title', w: 10, level: 'high', ok: titleLen >= 25 && titleLen <= 65, label: title ? `Judul halaman ${titleLen} karakter` : 'Judul halaman belum ada', detail: title.trim(), fix: 'Tulis judul 25–65 karakter berisi layanan utama + kota, misalnya “Laundry Kiloan Sleman – Antar Jemput | Bersih Wangi”.' },
    { id: 'title_local', w: 6, level: 'mid', ok: !!title && ((city && lower(title).includes(city)) || (nameL && lower(title).includes(nameL.split(' ')[0]))), label: 'Kota atau nama usaha di judul halaman', fix: 'Masukkan nama kota/area dan nama usaha di judul halaman agar cocok dengan pencarian lokal.' },
    { id: 'desc', w: 8, level: 'mid', ok: descLen >= 70 && descLen <= 160, label: desc ? `Deskripsi meta ${descLen} karakter` : 'Deskripsi meta belum ada', detail: desc.trim(), fix: 'Tulis deskripsi 70–160 karakter: apa yang dijual, di mana, dan ajakan (misalnya “Pesan lewat WhatsApp”).' },
    { id: 'h1', w: 6, level: 'mid', ok: h1s.length === 1, label: h1s.length ? `${h1s.length} judul utama (H1)` : 'Belum ada judul utama (H1)', detail: h1s[0] || '', fix: 'Gunakan tepat satu H1 yang menjelaskan layanan dan lokasi.' },
    { id: 'viewport', w: 6, level: 'high', ok: viewport, label: 'Tampilan ramah ponsel (viewport)', fix: 'Tambahkan <meta name="viewport" content="width=device-width, initial-scale=1"> dan pakai tema yang responsif.' },
    { id: 'schema', w: 10, level: 'high', ok: !!local, label: local ? `Data terstruktur ${local.type.split(',')[0]} ada` : 'Belum ada data terstruktur LocalBusiness', fix: 'Tempel kode JSON-LD LocalBusiness dari Serambi (tombol “Buat kode schema”) ke bagian <head> situs.' },
    { id: 'schema_fields', w: 4, level: 'low', ok: !!(local && local.node.address && (local.node.telephone || local.node.contactPoint)), label: 'Alamat dan telepon di data terstruktur', fix: 'Lengkapi address dan telephone di data terstruktur.' },
    { id: 'phone', w: 8, level: 'high', ok: hasPhone, label: phoneDigits ? 'Nomor telepon/WA usaha di halaman' : 'Isi nomor telepon/WA di profil bisnis untuk dicek', fix: 'Tulis nomor yang sama persis dengan di Profil Bisnis Google, di header atau footer situs.' },
    { id: 'city', w: 5, level: 'mid', ok: !!city && textL.includes(city), label: city ? `Kota “${loc.city || biz.city}” disebut di halaman` : 'Isi kota di profil bisnis untuk dicek', fix: 'Sebutkan kota/kecamatan di isi halaman, misalnya di paragraf pembuka dan alamat.' },
    { id: 'click_contact', w: 5, level: 'mid', ok: links.some(l => /^tel:|wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i.test(l)), label: 'Tombol telepon/WhatsApp yang bisa diklik', fix: 'Tambahkan tautan tel:+62… atau https://wa.me/62… supaya pengunjung dari ponsel langsung bisa menghubungi.' },
    { id: 'maps', w: 4, level: 'low', ok: [...links, ...iframes].some(l => /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/i.test(l)), label: 'Peta atau link Google Maps', fix: 'Sematkan peta Google Maps atau tautan “Petunjuk arah” ke lokasi usaha.' },
    { id: 'services', w: 5, level: 'mid', ok: services.length ? services.some(s => textL.includes(s)) : wordCount > 0, label: services.length ? 'Layanan utama disebut di halaman' : 'Isi layanan di profil bisnis untuk dicek', fix: 'Tulis daftar layanan/produk utama dengan kata yang dipakai pelanggan saat mencari.' },
    { id: 'content', w: 5, level: 'low', ok: wordCount >= 300, label: `${wordCount} kata di halaman`, fix: 'Tambah isi yang berguna (layanan, harga, area, FAQ) sampai sekitar 300 kata atau lebih.' },
    { id: 'alt', w: 4, level: 'low', ok: !imgs.length || alts / imgs.length >= 0.8, label: imgs.length ? `${alts} dari ${imgs.length} gambar punya teks alternatif` : 'Tidak ada gambar', fix: 'Isi atribut alt gambar dengan deskripsi singkat, misalnya “Etalase Toko Kue Bu Rina di Sleman”.' },
    { id: 'speed', w: 4, level: 'low', ok: res.ms <= 2500, label: `Server merespons dalam ${(res.ms / 1000).toFixed(1).replace('.', ',')} detik`, fix: 'Kompres gambar, pakai hosting lebih cepat, atau aktifkan cache.' },
    { id: 'lang', w: 2, level: 'low', ok: /^id/i.test(doc.documentElement.getAttribute('lang') || ''), label: 'Bahasa halaman Indonesia (lang="id")', fix: 'Tambahkan lang="id" pada tag <html>.' },
    { id: 'canonical', w: 2, level: 'low', ok: !!doc.querySelector('link[rel="canonical" i]'), label: 'Alamat kanonis (canonical)', fix: 'Tambahkan <link rel="canonical" href="…"> agar Google tahu alamat utama halaman.' },
    { id: 'og', w: 3, level: 'low', ok: !!doc.querySelector('meta[property="og:title" i]') && !!doc.querySelector('meta[property="og:image" i]'), label: 'Pratinjau saat dibagikan (Open Graph)', fix: 'Tambahkan og:title dan og:image supaya link tampil menarik di WhatsApp dan Facebook.' },
    { id: 'sitemap', w: 3, level: 'low', ok: res.sitemap >= 200 && res.sitemap < 300, label: 'Berkas sitemap.xml', fix: 'Buat sitemap.xml (kebanyakan CMS menyediakannya) lalu kirim di Google Search Console.' },
    { id: 'robots', w: 2, level: 'low', ok: res.robots >= 200 && res.robots < 300, label: 'Berkas robots.txt', fix: 'Tambahkan berkas robots.txt sederhana di akar situs.' }
  ];
  const total = checks.reduce((s, c) => s + c.w, 0);
  const got = checks.reduce((s, c) => s + (c.ok ? c.w : 0), 0);
  return { score: Math.round((got / total) * 100), checks, title, desc, h1: h1s[0] || '', wordCount };
}

/** JSON-LD LocalBusiness for the business and one location. */
export function schemaFor(biz = {}, loc = {}, sameAs = []) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: biz.name || loc.name || '',
    description: biz.description || undefined,
    url: biz.website || undefined,
    telephone: (loc.phone || biz.phone || biz.whatsapp) ? '+' + normPhone(loc.phone || biz.phone || biz.whatsapp) : undefined,
    priceRange: biz.priceRange || undefined,
    address: (loc.address || loc.city || biz.city) ? {
      '@type': 'PostalAddress',
      streetAddress: loc.address || undefined,
      addressLocality: loc.city || biz.city || undefined,
      addressCountry: 'ID'
    } : undefined,
    hasMap: loc.mapsUrl || undefined,
    openingHours: (loc.hours || biz.hours) ? String(loc.hours || biz.hours) : undefined,
    areaServed: (biz.areas && biz.areas.length) ? biz.areas : undefined,
    sameAs: sameAs.length ? sameAs : undefined
  };
  return '<script type="application/ld+json">\n' + JSON.stringify(data, (k, v) => v === undefined ? undefined : v, 2) + '\n</script>';
}

// ---------- NAP consistency ----------
const ABBR = [[/\bjl\.?\b|\bjln\.?\b/g, 'jalan'], [/\bno\.?\b/g, 'nomor'], [/\bkec\.?\b/g, 'kecamatan'], [/\bkel\.?\b/g, 'kelurahan'], [/\bkab\.?\b/g, 'kabupaten'], [/\bgg\.?\b/g, 'gang'], [/\brt\.?\s*/g, 'rt '], [/\brw\.?\s*/g, 'rw ']];
export function normText(s) {
  let t = lower(s).normalize('NFKD').replace(/[̀-ͯ]/g, '');
  for (const [re, rep] of ABBR) t = t.replace(re, rep);
  return t.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function jaccard(a, b) {
  const A = new Set(normText(a).split(' ').filter(Boolean)), B = new Set(normText(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
/** Compares one listing against the master data. Returns { name, address, phone } each true/false/null. */
export function napCompare(master, listing) {
  const cmp = (a, b, kind) => {
    if (!b) return null;
    if (!a) return null;
    if (kind === 'phone') { const x = normPhone(a), y = normPhone(b); return !!x && x === y; }
    return jaccard(a, b) >= (kind === 'name' ? 0.6 : 0.7);
  };
  return { name: cmp(master.name, listing.name, 'name'), address: cmp(master.address, listing.address, 'address'), phone: cmp(master.phone, listing.phone, 'phone') };
}
