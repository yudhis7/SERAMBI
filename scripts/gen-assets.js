// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Builds every Serambi logo file from the master artwork in branding/serambi-logo.png:
// app icons (macOS, Windows, window/notification), tray icons, the in-app mark, wordmark and
// About banner, the Windows installer sidebar, and the small mark used in printed PDFs.
// Run: node scripts/gen-assets.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SRC = path.join(root, 'branding', 'serambi-logo.png');
const out = (...p) => path.join(root, ...p);

// Positions in the master artwork (1408 × 768).
const MARK = { x: 394, y: 107, w: 653, h: 526 };          // the linked "S" mark
const HALO = { left: 330, top: 50, width: 790, height: 588 }; // mark plus its glow, above the wordmark
const WORD = { left: 405, top: 636, width: 610, height: 78 };  // "SERAMBI"
const TAG = { left: 405, top: 714, width: 610, height: 46 };   // "Unify Social, Empower Commerce"
const BG = [8, 12, 17];                                        // artwork background (far)
const HALO_BG = [13, 19, 28];                                  // artwork background right around the mark

async function raw(img) {
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, c: info.channels };
}
const rgba = (data, w, h) => sharp(data, { raw: { width: w, height: h, channels: 4 } });

/**
 * The mark as light added on top of a dark background: colour is the artwork minus its own
 * background, alpha is a soft shape around the tubes. Placed with addMark(), it blends into any
 * dark tile without a visible box.
 */
async function markLayer() {
  const base = sharp(SRC).extract(HALO);
  const rgb = await raw(base.clone().removeAlpha());
  const { w, h } = rgb;
  // Shape: everything clearly brighter than the background, widened and softened.
  const bin = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const l = (rgb.data[i * 3] + rgb.data[i * 3 + 1] + rgb.data[i * 3 + 2]) / 3;
    const x = i % w + HALO.left, y = Math.floor(i / w) + HALO.top;
    const inMark = x >= MARK.x && x < MARK.x + MARK.w && y >= MARK.y && y < MARK.y + MARK.h;
    bin[i] = inMark && l > 42 ? 255 : 0;
  }
  // libvips names morphology from the background's view: erode() grows the white shape.
  const soft = await raw(sharp(bin, { raw: { width: w, height: h, channels: 1 } }).erode(22).blur(16));
  const px = Buffer.alloc(w * h * 4);
  const cutTop = 632 - HALO.top, cutBottom = 638 - HALO.top; // fade out just above the wordmark
  for (let y = 0; y < h; y++) {
    const fade = y <= cutTop ? 1 : y >= cutBottom ? 0 : 1 - (y - cutTop) / (cutBottom - cutTop);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = (rgb.data[i * 3] + rgb.data[i * 3 + 1] + rgb.data[i * 3 + 2]) / 3;
      const knee = Math.min(1, Math.max(0, (l - 28) / 24)); // drops the faint circuit pattern behind the mark
      for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.round(Math.max(0, rgb.data[i * 3 + k] - HALO_BG[k]) * knee);
      px[i * 4 + 3] = Math.round(soft.data[i * soft.c] * fade);
    }
  }
  return { buf: await rgba(px, w, h).png().toBuffer(), w, h, cx: MARK.x - HALO.left + MARK.w / 2, cy: MARK.y - HALO.top + MARK.h / 2 };
}

/** Light text on the dark artwork → text with its own alpha (glow included). */
async function lightText(region, { floor = 14, top = 225 } = {}) {
  const r = await raw(sharp(SRC).extract(region).removeAlpha());
  const px = Buffer.alloc(r.w * r.h * 4);
  for (let i = 0; i < r.w * r.h; i++) {
    const c = [0, 1, 2].map(k => Math.max(0, r.data[i * 3 + k] - BG[k]));
    const l = (c[0] + c[1] + c[2]) / 3;
    const a = Math.min(1, Math.max(0, (l - floor) / (top - floor)));
    for (let k = 0; k < 3; k++) px[i * 4 + k] = a > 0 ? Math.min(255, Math.round(c[k] / Math.max(a, 0.05))) : 0;
    px[i * 4 + 3] = Math.round(a * 255);
  }
  return sharp(await rgba(px, r.w, r.h).png().toBuffer()).trim({ threshold: 1 }).png().toBuffer();
}

/** Adds the mark (scaled so its width is markPx, centred at cx, cy) onto a raw RGBA background. */
async function addMark(bg, W, H, layer, markPx, cx, cy, { brightness = 1.06 } = {}) {
  const scale = markPx / MARK.w;
  const lw = Math.max(1, Math.round(layer.w * scale)), lh = Math.max(1, Math.round(layer.h * scale));
  const m = await raw(sharp(layer.buf).resize(lw, lh, { kernel: 'lanczos3' }).ensureAlpha());
  const ox = Math.round(cx - layer.cx * scale), oy = Math.round(cy - layer.cy * scale);
  for (let y = 0; y < lh; y++) {
    const ty = oy + y; if (ty < 0 || ty >= H) continue;
    for (let x = 0; x < lw; x++) {
      const tx = ox + x; if (tx < 0 || tx >= W) continue;
      const si = (y * lw + x) * m.c, ti = (ty * W + tx) * 4;
      const a = m.data[si + 3] / 255;
      if (!a) continue;
      for (let k = 0; k < 3; k++) bg[ti + k] = Math.min(255, Math.round(bg[ti + k] + a * m.data[si + k] * brightness));
    }
  }
  return bg;
}

/** Rounded tile with the glowing mark. inset/radius are fractions of the canvas, markW of the tile. */
async function tile(layer, size, { inset, radius, markW, stroke = true }) {
  const S = 1024;
  const x0 = Math.round(S * inset), side = S - 2 * x0, rx = Math.round(S * radius);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs>
      <radialGradient id="g" cx="50%" cy="44%" r="70%"><stop offset="0" stop-color="#16213A"/><stop offset=".55" stop-color="#0B111C"/><stop offset="1" stop-color="#05070B"/></radialGradient>
      <radialGradient id="glow" cx="50%" cy="48%" r="44%"><stop offset="0" stop-color="#2F7BFF" stop-opacity=".20"/><stop offset="1" stop-color="#2F7BFF" stop-opacity="0"/></radialGradient>
    </defs>
    <rect x="${x0}" y="${x0}" width="${side}" height="${side}" rx="${rx}" fill="url(#g)"/>
    <rect x="${x0}" y="${x0}" width="${side}" height="${side}" rx="${rx}" fill="url(#glow)"/>
    ${stroke ? `<rect x="${x0 + 3}" y="${x0 + 3}" width="${side - 6}" height="${side - 6}" rx="${rx - 3}" fill="none" stroke="#7FB2FF" stroke-opacity=".30" stroke-width="6"/>` : ''}
  </svg>`;
  const bg = await raw(sharp(Buffer.from(svg)).ensureAlpha());
  await addMark(bg.data, S, S, layer, side * markW, S / 2, S / 2);
  return sharp(await rgba(bg.data, S, S).png().toBuffer()).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
}

/** macOS menu-bar template: the mark's light as black on transparent (system tints it). */
async function trayTemplate(size) {
  const box = { left: 386, top: 100, width: 668, height: 540 };
  const w = size, h = Math.round(size * box.height / box.width);
  const r = await raw(sharp(SRC).extract(box).removeAlpha().resize(w, h, { kernel: 'cubic' }));
  const px = Buffer.alloc(size * size * 4);
  const oy = Math.floor((size - h) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    const v = Math.max(r.data[i], r.data[i + 1], r.data[i + 2]);
    px[((y + oy) * size + x) * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (v - 50) / 120)));
  }
  return rgba(px, size, size).png().toBuffer();
}

/** 24-bit Windows bitmap (NSIS needs BMP). */
async function bmp(pngBuf, file) {
  const r = await raw(sharp(pngBuf).flatten({ background: { r: BG[0], g: BG[1], b: BG[2] } }).removeAlpha());
  const rowLen = Math.ceil((r.w * 3) / 4) * 4;
  const size = 54 + rowLen * r.h;
  const b = Buffer.alloc(size);
  b.write('BM', 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14); b.writeInt32LE(r.w, 18); b.writeInt32LE(r.h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28);
  b.writeUInt32LE(rowLen * r.h, 34); b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42);
  for (let y = 0; y < r.h; y++) {
    const row = 54 + (r.h - 1 - y) * rowLen;
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 3;
      b[row + x * 3] = r.data[i + 2]; b[row + x * 3 + 1] = r.data[i + 1]; b[row + x * 3 + 2] = r.data[i];
    }
  }
  fs.writeFileSync(file, b);
}

/** Windows installer welcome/finish sidebar, 164 × 314. */
async function installerSidebar(layer, word, tag) {
  const W = 164, H = 314, K = 3; // drawn at 3× then reduced
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * K}" height="${H * K}">
    <defs>
      <radialGradient id="g" cx="50%" cy="34%" r="75%"><stop offset="0" stop-color="#15203A"/><stop offset=".6" stop-color="#090E16"/><stop offset="1" stop-color="#05070B"/></radialGradient>
      <radialGradient id="glow" cx="50%" cy="36%" r="40%"><stop offset="0" stop-color="#2F7BFF" stop-opacity=".16"/><stop offset="1" stop-color="#2F7BFF" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#glow)"/></svg>`;
  const bg = await raw(sharp(Buffer.from(svg)).ensureAlpha());
  await addMark(bg.data, W * K, H * K, layer, W * K * 0.80, (W * K) / 2, H * K * 0.36);
  const wordW = Math.round(W * K * 0.74), tagW = Math.round(W * K * 0.86);
  const wordImg = await sharp(word).resize({ width: wordW }).png().toBuffer();
  const tagImg = await sharp(tag).resize({ width: tagW }).png().toBuffer();
  const wm = await sharp(wordImg).metadata(), tm = await sharp(tagImg).metadata();
  const top = Math.round(H * K * 0.64);
  const full = await sharp(await rgba(bg.data, W * K, H * K).png().toBuffer()).composite([
    { input: wordImg, left: Math.round((W * K - wm.width) / 2), top },
    { input: tagImg, left: Math.round((W * K - tm.width) / 2), top: top + wm.height + 14 }
  ]).png().toBuffer();
  return sharp(full).resize(W, H, { kernel: 'lanczos3' }).png().toBuffer();
}

const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="28" fill="#E5484D" stroke="#FFFFFF" stroke-width="6"/></svg>`;

(async () => {
  for (const d of ['build', 'assets', 'src/renderer/img']) fs.mkdirSync(out(d), { recursive: true });
  const layer = await markLayer();
  const mac = { inset: 100 / 1024, radius: 186 / 1024, markW: 0.80 };   // Apple icon grid
  const win = { inset: 24 / 1024, radius: 220 / 1024, markW: 0.80 };    // full bleed
  const small = { inset: 0, radius: 200 / 1024, markW: 0.90, stroke: false }; // 16–32 px

  fs.writeFileSync(out('build/icon.png'), await tile(layer, 1024, mac));      // macOS (icns made by electron-builder)
  fs.writeFileSync(out('build/icon-win.png'), await tile(layer, 256, win));   // Windows (ico made by electron-builder)
  fs.writeFileSync(out('assets/icon.png'), await tile(layer, 512, win));      // window & notification icon
  fs.writeFileSync(out('assets/tray.png'), await tile(layer, 32, small));     // Windows tray
  fs.writeFileSync(out('assets/tray-16.png'), await tile(layer, 16, small));
  fs.writeFileSync(out('assets/trayTemplate.png'), await trayTemplate(18));   // macOS menu bar
  fs.writeFileSync(out('assets/trayTemplate@2x.png'), await trayTemplate(36));
  await sharp(Buffer.from(badge)).resize(16, 16).png().toFile(out('assets/badge.png'));
  await sharp(Buffer.from(badge)).resize(32, 32).png().toFile(out('assets/badge@2x.png'));

  // In-app logo: mark tile, wordmark, and the full artwork for the About window.
  fs.writeFileSync(out('src/renderer/img/logo-mark.png'), await tile(layer, 192, win));
  const word = await lightText(WORD);
  const tag = await lightText(TAG, { floor: 10, top: 200 });
  fs.writeFileSync(out('src/renderer/img/logo-wordmark.png'), await sharp(word).resize({ height: 72 }).png().toBuffer());
  await sharp(SRC).removeAlpha().resize({ width: 960 }).jpeg({ quality: 86, mozjpeg: true }).toFile(out('src/renderer/img/logo-lockup.jpg'));

  // Mark for printed PDFs (the print window has no access to app files, so it is embedded).
  const pdfMark = await tile(layer, 64, win);
  fs.writeFileSync(out('src/renderer/lib/logo-data.js'),
    `// Generated by scripts/gen-assets.js. Serambi mark for printed documents.\nexport const LOGO_MARK = 'data:image/png;base64,${pdfMark.toString('base64')}';\n`);

  await bmp(await installerSidebar(layer, word, tag), out('build/installerSidebar.bmp'));
  console.log('assets generated');
})();
