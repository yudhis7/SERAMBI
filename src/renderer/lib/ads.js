// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Local ads helpers: keyword ideas, a responsive search ad (RSA) draft that respects
// Google Ads limits, policy-style checks, budget maths, and UTM links.
// Limits (Google Ads): 3–15 headlines of 30 characters, 2–4 descriptions of 90, 2 display paths of 15.
// Meta recommends: primary text ≈125, headline ≈40, description ≈25 characters.

export const LIMITS = { headline: 30, description: 90, path: 15, headlines: [3, 15], descriptions: [2, 4] };
export const META_LIMITS = { primary: 125, headline: 40, description: 25 };

/** Google counts full-width (CJK) characters as two. */
export function adLen(s) {
  let n = 0;
  for (const ch of String(s || '')) n += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return n;
}
const titleCase = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/\b\p{L}/gu, c => c.toUpperCase());
const fit = (list, max) => [...new Set(list.map(x => String(x).replace(/\s+/g, ' ').trim()).filter(x => x && adLen(x) <= max))];

export const NEGATIVE_DEFAULT = ['gratis', 'lowongan', 'loker', 'gaji', 'magang', 'cara membuat', 'tutorial', 'resep', 'pdf', 'download', 'contoh', 'arti', 'adalah'];

export function keywordIdeas({ services = [], city = '', areas = [] }) {
  const places = [city, ...areas].map(x => String(x || '').trim()).filter(Boolean).slice(0, 4);
  const out = [];
  for (const s0 of services.slice(0, 8)) {
    const s = String(s0).toLowerCase().trim();
    if (!s) continue;
    out.push({ text: `${s} terdekat`, match: 'phrase', why: 'Orang mencari yang dekat dengan lokasinya' });
    for (const p of places) {
      const pl = p.toLowerCase();
      out.push({ text: `${s} ${pl}`, match: 'phrase', why: 'Layanan + area' });
      out.push({ text: `${s} di ${pl}`, match: 'phrase', why: 'Layanan + area' });
    }
    out.push({ text: `${s} murah`, match: 'phrase', why: 'Pencari yang sensitif harga' });
    out.push({ text: `jasa ${s}`.replace('jasa jasa', 'jasa'), match: 'broad', why: 'Variasi umum' });
    out.push({ text: `${s} buka sekarang`, match: 'phrase', why: 'Niat datang hari ini' });
  }
  const seen = new Set();
  return out.filter(k => { const key = k.text; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 60);
}
export const formatKeyword = (k) => k.match === 'exact' ? `[${k.text}]` : k.match === 'phrase' ? `"${k.text}"` : k.text;

/** A first draft of a responsive search ad from the business profile. Edit before use. */
export function rsaDraft({ biz = {}, loc = {}, offer = '', rating = null }) {
  const city = loc.city || biz.city || '';
  const name = biz.name || '';
  const svc = (biz.services || []).map(titleCase).filter(Boolean);
  const main = svc[0] || titleCase(biz.category || 'Layanan Kami');
  const H = [
    name,
    city ? `${main} ${titleCase(city)}` : main,
    `${main} Terdekat`,
    city ? `${main} di ${titleCase(city)}` : '',
    ...svc.slice(1, 4),
    offer ? titleCase(offer) : '',
    biz.whatsapp ? 'Pesan Lewat WhatsApp' : 'Hubungi Kami Sekarang',
    rating && rating >= 4.3 ? `Rating ${String(rating).replace('.', ',')} di Google` : 'Pelanggan Puas Kembali Lagi',
    'Buka Hari Ini',
    city ? `Melayani ${titleCase(city)} & Sekitar` : 'Melayani Area Sekitar',
    'Harga Jelas Tanpa Biaya Kejutan',
    'Pelayanan Ramah & Cepat',
    name ? `Kunjungi ${name}` : ''
  ];
  const D = [
    `${main}${city ? ' di ' + titleCase(city) : ''}. ${offer ? titleCase(offer) + '. ' : ''}Hubungi kami hari ini.`,
    svc.length > 1 ? `Tersedia ${svc.slice(0, 3).join(', ')}. Pesan mudah lewat WhatsApp atau datang langsung.` : 'Pesan mudah lewat WhatsApp atau datang langsung ke toko kami.',
    name ? `${name} melayani dengan ramah. Lihat ulasan pelanggan kami di Google.` : 'Lihat ulasan pelanggan kami di Google sebelum datang.',
    city ? `Lokasi mudah dijangkau di ${titleCase(city)}. Cek jam buka dan petunjuk arah.` : 'Cek jam buka dan petunjuk arah ke lokasi kami.'
  ];
  const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return {
    headlines: fit(H, LIMITS.headline).slice(0, 15),
    descriptions: fit(D, LIMITS.description).slice(0, 4),
    paths: fit([slug(main).slice(0, 15).replace(/-+$/, ''), slug(city).slice(0, 15).replace(/-+$/, '')], LIMITS.path).slice(0, 2)
  };
}

const EMOJI = /\p{Extended_Pictographic}/u;
/** Problems that would block or weaken the ad, in plain Indonesian. */
export function rsaProblems(ads) {
  const out = [];
  const hs = (ads.headlines || []).filter(Boolean), ds = (ads.descriptions || []).filter(Boolean), ps = (ads.paths || []).filter(Boolean);
  if (hs.length < LIMITS.headlines[0]) out.push({ level: 'err', text: `Minimal ${LIMITS.headlines[0]} judul (sekarang ${hs.length}). Google menyarankan 8–15 judul.` });
  if (hs.length > LIMITS.headlines[1]) out.push({ level: 'err', text: `Maksimal ${LIMITS.headlines[1]} judul.` });
  if (ds.length < LIMITS.descriptions[0]) out.push({ level: 'err', text: `Minimal ${LIMITS.descriptions[0]} deskripsi.` });
  if (ds.length > LIMITS.descriptions[1]) out.push({ level: 'err', text: `Maksimal ${LIMITS.descriptions[1]} deskripsi.` });
  hs.forEach((h, i) => {
    if (adLen(h) > LIMITS.headline) out.push({ level: 'err', text: `Judul ${i + 1} lebih dari ${LIMITS.headline} karakter.` });
    if (/!/.test(h)) out.push({ level: 'err', text: `Judul ${i + 1}: tanda seru tidak diizinkan di judul Google Ads.` });
  });
  ds.forEach((d, i) => { if (adLen(d) > LIMITS.description) out.push({ level: 'err', text: `Deskripsi ${i + 1} lebih dari ${LIMITS.description} karakter.` }); });
  ps.forEach((p, i) => { if (adLen(p) > LIMITS.path) out.push({ level: 'err', text: `Jalur tampilan ${i + 1} lebih dari ${LIMITS.path} karakter.` }); });
  [...hs, ...ds].forEach((t) => {
    if (EMOJI.test(t)) out.push({ level: 'err', text: `“${t}”: emoji tidak diizinkan di iklan Google.` });
    if (/([!?.])\1/.test(t)) out.push({ level: 'err', text: `“${t}”: hindari tanda baca berulang.` });
    const caps = t.replace(/[^A-Z]/g, '').length, letters = t.replace(/[^A-Za-z]/g, '').length;
    if (letters >= 6 && caps / letters > 0.6) out.push({ level: 'warn', text: `“${t}”: huruf kapital berlebihan biasanya ditolak.` });
  });
  const dupe = hs.map(h => h.toLowerCase()).filter((h, i, a) => a.indexOf(h) !== i);
  if (dupe.length) out.push({ level: 'warn', text: 'Ada judul yang sama persis. Buat variasi berbeda.' });
  if (hs.length >= 3 && hs.length < 8) out.push({ level: 'tip', text: 'Tambah judul sampai 8–15 supaya Google bisa menguji lebih banyak kombinasi.' });
  return out;
}

export function metaProblems(m = {}) {
  const out = [];
  const L = (s) => Array.from(String(s || '')).length;
  if (L(m.primary) > META_LIMITS.primary) out.push({ level: 'warn', text: `Teks utama ${L(m.primary)} karakter; di ponsel teks setelah ±${META_LIMITS.primary} karakter dipotong.` });
  if (L(m.headline) > META_LIMITS.headline) out.push({ level: 'warn', text: `Judul ${L(m.headline)} karakter; disarankan ±${META_LIMITS.headline}.` });
  if (L(m.description) > META_LIMITS.description) out.push({ level: 'warn', text: `Deskripsi ${L(m.description)} karakter; disarankan ±${META_LIMITS.description}.` });
  return out;
}

/**
 * Budget planner. All money in rupiah.
 * daily: budget per day, days, cpc: estimated cost per click, conv: conversion rate (0–1),
 * aov: average order value, margin: gross margin (0–1)
 */
export function budgetPlan({ daily = 50000, days = 30, cpc = 1500, conv = 0.05, aov = 75000, margin = 0.4 }) {
  const spend = daily * days;
  const clicks = cpc > 0 ? spend / cpc : 0;
  const leads = clicks * conv;
  const revenue = leads * aov;
  const profit = revenue * margin - spend;
  const cpa = leads ? spend / leads : 0;
  const breakEvenCpa = aov * margin;
  const roas = spend ? revenue / spend : 0;
  return { spend, clicks, leads, revenue, profit, cpa, breakEvenCpa, roas, breakEvenRoas: margin ? 1 / margin : 0 };
}

export function utmUrl(url, utm = {}) {
  if (!url) return '';
  let u;
  try { u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url); } catch (_) { return url; }
  const set = (k, v) => { if (v) u.searchParams.set(k, String(v).trim().toLowerCase().replace(/\s+/g, '_')); };
  set('utm_source', utm.source); set('utm_medium', utm.medium); set('utm_campaign', utm.campaign); set('utm_content', utm.content);
  return u.toString();
}

/** CSV with the column names Google Ads Editor understands when pasting or importing ads. */
export function editorCsv(campaign, adGroup, ads, finalUrl) {
  const head = ['Campaign', 'Ad group', 'Ad type', 'Final URL', ...Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`), 'Path 1', 'Path 2'];
  const row = [campaign, adGroup, 'Responsive search ad', finalUrl || '',
    ...Array.from({ length: 15 }, (_, i) => (ads.headlines || [])[i] || ''),
    ...Array.from({ length: 4 }, (_, i) => (ads.descriptions || [])[i] || ''),
    (ads.paths || [])[0] || '', (ads.paths || [])[1] || ''];
  return [head, row];
}
