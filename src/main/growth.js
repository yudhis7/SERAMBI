// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Helpers for the local-growth tools: fetching a web page for the SEO check,
// QR codes, and saving printable pages (review cards, privacy notice, reports) as PDF.
const { BrowserWindow, net, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const QRCode = require('qrcode');

const MAX_HTML = 3 * 1024 * 1024;

async function readLimited(res, limit) {
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) return Buffer.from(await res.arrayBuffer()).subarray(0, limit);
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value)); size += value.length;
    if (size >= limit) { try { await reader.cancel(); } catch (_) {} break; }
  }
  return Buffer.concat(chunks).subarray(0, limit);
}

async function timedFetch(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await net.fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

/** Downloads one page (HTML only) so the interface can analyse it. Nothing is stored. */
async function fetchPage(input, ua) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + String(input).trim()); } catch (_) { return { ok: false, error: 'Alamat situs tidak valid.' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, error: 'Hanya alamat http/https yang bisa diperiksa.' };
  const t0 = Date.now();
  let res;
  try {
    res = await timedFetch(u.href, { redirect: 'follow', headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.6' } }, 15000);
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'Situs terlalu lama merespons (lebih dari 15 detik).' : 'Situs tidak bisa dibuka. Periksa alamatnya atau koneksi internet.' };
  }
  const ms = Date.now() - t0;
  const type = res.headers.get('content-type') || '';
  const buf = await readLimited(res, MAX_HTML);
  const html = /html|xml|text/i.test(type) || !type ? buf.toString('utf8') : '';
  const finalUrl = res.url || u.href;
  const origin = new URL(finalUrl).origin;
  const probe = async (p) => {
    try { const r = await timedFetch(origin + p, { redirect: 'follow', headers: { 'User-Agent': ua } }, 8000); const ok = r.ok; try { await r.body?.cancel(); } catch (_) {} return ok ? r.status : r.status || 0; }
    catch (_) { return 0; }
  };
  const [robots, sitemap] = await Promise.all([probe('/robots.txt'), probe('/sitemap.xml')]);
  return {
    ok: res.ok, status: res.status, url: finalUrl, https: finalUrl.startsWith('https:'), ms, bytes: buf.length,
    contentType: type, xRobots: res.headers.get('x-robots-tag') || '', html, robots, sitemap,
    error: res.ok ? '' : `Situs menjawab dengan kode ${res.status}.`
  };
}

async function qrSvg(text, { margin = 1, dark = '#111111', light = '#ffffff' } = {}) {
  return QRCode.toString(String(text || ''), { type: 'svg', margin, errorCorrectionLevel: 'M', color: { dark, light } });
}

/**
 * Turns a self-contained HTML page into a PDF and asks where to save it.
 * The page is rendered in a hidden window with JavaScript disabled.
 */
async function savePdf(parent, { html, fileName = 'serambi.pdf', fontDir, tmpDir, landscape = false }) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmp = path.join(tmpDir, 'cetak-' + crypto.randomBytes(5).toString('hex') + '.html');
  const font = (f) => pathToFileURL(path.join(fontDir, f)).href;
  const fontCss = `<style>@font-face{font-family:'Plus Jakarta Sans';src:url('${font('PlusJakartaSans.woff2')}') format('woff2');font-weight:200 800}
@font-face{font-family:'Plus Jakarta Sans';src:url('${font('PlusJakartaSans-ext.woff2')}') format('woff2');font-weight:200 800;unicode-range:U+0100-02AF,U+1E00-1EFF}</style>`;
  const page = String(html).replace('<head>', '<head><meta charset="utf-8">' + fontCss);
  fs.writeFileSync(tmp, page);
  const w = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { javascript: false, sandbox: true, contextIsolation: true } });
  try {
    await w.loadFile(tmp);
    const pdf = await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', landscape, margins: { marginType: 'none' } });
    const res = await dialog.showSaveDialog(parent, { title: 'Simpan PDF', defaultPath: fileName, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (res.canceled || !res.filePath) return { ok: false };
    fs.writeFileSync(res.filePath, pdf);
    shell.openPath(res.filePath);
    return { ok: true, path: res.filePath };
  } finally {
    w.destroy();
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

/** Generic "save as" for CSV, JSON and text exports made by the interface. */
async function saveText(parent, { content, fileName, kind = 'csv' }) {
  const filters = {
    csv: [{ name: 'CSV (Excel, Google Sheets)', extensions: ['csv'] }],
    json: [{ name: 'JSON', extensions: ['json'] }],
    txt: [{ name: 'Teks', extensions: ['txt'] }],
    html: [{ name: 'Halaman web', extensions: ['html'] }]
  }[kind] || [{ name: 'Berkas', extensions: ['*'] }];
  const res = await dialog.showSaveDialog(parent, { title: 'Simpan berkas', defaultPath: fileName, filters });
  if (res.canceled || !res.filePath) return { ok: false };
  // A byte-order mark lets Excel open Indonesian text in CSV files correctly.
  fs.writeFileSync(res.filePath, (kind === 'csv' ? '﻿' : '') + String(content));
  return { ok: true, path: res.filePath };
}

module.exports = { fetchPage, qrSvg, savePdf, saveText };
