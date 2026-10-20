// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Printable documents (saved as PDF by the main process with JavaScript disabled).
import { esc, fmtDateLong, fmtDateTime } from '../util.js';

const BASE_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #1B2033; font-size: 11pt; line-height: 1.5; }
  .page { padding: 18mm 18mm 16mm; }
  h1 { font-size: 20pt; margin: 0 0 4pt; letter-spacing: -.01em; }
  h2 { font-size: 12.5pt; margin: 16pt 0 6pt; color: #1F2A6B; }
  p { margin: 0 0 8pt; }
  .muted { color: #555C74; }
  .small { font-size: 9pt; color: #555C74; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { text-align: left; vertical-align: top; padding: 5pt 6pt; border-bottom: 1px solid #E1E4EC; }
  th { background: #F4F5F9; font-weight: 700; }
  .brand { display: flex; align-items: center; gap: 8pt; color: #1F2A6B; font-weight: 750; font-size: 10pt; margin-bottom: 14pt; }
  .dot { width: 10pt; height: 10pt; border-radius: 3pt; background: #F2B33D; display: inline-block; }
  .foot { margin-top: 18pt; padding-top: 8pt; border-top: 1px solid #E1E4EC; font-size: 8.5pt; color: #8A90A6; }
  .ok { color: #16915A; font-weight: 700; } .no { color: #CC3640; font-weight: 700; }
  pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
`;

function doc(title, body, extraCss = '') {
  return `<!doctype html><html lang="id"><head><title>${esc(title)}</title><style>${BASE_CSS}${extraCss}</style></head><body>${body}</body></html>`;
}
const brand = (biz) => `<div class="brand"><span class="dot"></span>${esc(biz.name || 'Usaha kami')}</div>`;
const stamp = () => `Dibuat dengan Serambi · ${esc(fmtDateTime(Date.now()))}`;

/** Two A5 review cards with a QR code, cut along the dashed line. */
export function reviewCards({ biz, loc, qr, link, headline, subline }) {
  const card = `
    <div class="card">
      <div class="stars">★★★★★</div>
      <h1>${esc(headline || 'Bagaimana pengalamanmu?')}</h1>
      <p class="sub">${esc(subline || 'Ceritakan di Google. Ulasanmu membantu tetangga menemukan kami dan membantu kami jadi lebih baik.')}</p>
      <div class="qr">${qr}</div>
      <p class="how">Arahkan kamera ponsel ke kode ini</p>
      <p class="name">${esc(biz.name || '')}${loc && loc.name && loc.name !== biz.name ? ' · ' + esc(loc.name) : ''}</p>
      <p class="link">${esc(link)}</p>
    </div>`;
  return doc('Kartu ulasan', `<div class="sheet">${card}<div class="cut"></div>${card}</div>`, `
    .sheet { height: 297mm; display: flex; flex-direction: column; }
    .card { height: 148mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 10mm 22mm; }
    .cut { border-top: 1.5px dashed #C9CDD9; }
    .stars { color: #F2B33D; font-size: 22pt; letter-spacing: 4pt; }
    h1 { font-size: 24pt; margin: 4pt 0 6pt; }
    .sub { color: #555C74; max-width: 120mm; font-size: 11.5pt; }
    .qr { width: 54mm; height: 54mm; margin: 6pt 0; } .qr svg { width: 100%; height: 100%; }
    .how { font-size: 9.5pt; color: #8A90A6; margin: 0; }
    .name { font-weight: 750; margin: 8pt 0 0; color: #1F2A6B; }
    .link { font-size: 7.5pt; color: #8A90A6; word-break: break-all; max-width: 130mm; }`);
}

export function textDocument({ biz, title, text, note }) {
  return doc(title, `<div class="page">${brand(biz)}<h1>${esc(title)}</h1>
    ${note ? `<p class="small">${esc(note)}</p>` : ''}
    <pre>${esc(text)}</pre>
    <div class="foot">${stamp()}</div></div>`);
}

export function ropaDocument({ biz, ropa, legalBases }) {
  const rows = ropa.map((r, i) => `
    <h2>${i + 1}. ${esc(r.name)}</h2>
    <table>
      ${[['Pengendali data', r.controller], ['Tujuan', r.purpose], ['Dasar pemrosesan', legalBases[r.basis] || r.basis], ['Subjek data', r.subjects],
         ['Jenis data pribadi', r.data], ['Data pribadi spesifik', r.specific ? 'Ya' : 'Tidak'], ['Sumber data', r.source], ['Penerima / pihak yang mengakses', r.recipients],
         ['Transfer ke luar negeri', r.transfer], ['Lokasi penyimpanan', r.storage], ['Masa retensi', r.retention], ['Langkah keamanan', r.security], ['Penanggung jawab', r.owner]]
        .map(([k, v]) => `<tr><th style="width:34%">${esc(k)}</th><td>${esc(v || '—')}</td></tr>`).join('')}
    </table>`).join('');
  return doc('Catatan kegiatan pemrosesan data pribadi', `<div class="page">${brand(biz)}
    <h1>Catatan Kegiatan Pemrosesan Data Pribadi</h1>
    <p class="muted">Disusun sesuai kewajiban merekam kegiatan pemrosesan (UU No. 27 Tahun 2022 Pasal 31). Per ${esc(fmtDateLong(Date.now()))}.</p>
    ${rows}
    <div class="foot">${stamp()} · Dokumen pendukung kepatuhan, bukan nasihat hukum.</div></div>`);
}

export function complianceReport({ biz, compliance, counts, plan, auditStatus }) {
  return doc('Laporan kepatuhan pelindungan data', `<div class="page">${brand(biz)}
    <h1>Laporan Pelindungan Data Pribadi</h1>
    <p class="muted">${esc(biz.name || '')} · ${esc(fmtDateLong(Date.now()))} · Paket ${esc(plan.name || '')}</p>
    <h2>Ringkasan</h2>
    <p><b>${compliance.done} dari ${compliance.total}</b> butir daftar periksa terpenuhi.</p>
    <table><tr><th>Butir</th><th>Rujukan</th><th>Status</th><th>Keterangan</th></tr>
      ${compliance.items.map(i => `<tr><td>${esc(i.label)}</td><td>${esc(i.ref)}</td><td class="${i.ok ? 'ok' : 'no'}">${i.ok ? 'Terpenuhi' : 'Perlu tindakan'}</td><td>${esc(i.detail)}</td></tr>`).join('')}
    </table>
    <h2>Data yang dikelola</h2>
    <table>${Object.entries(counts).map(([k, v]) => `<tr><th style="width:50%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
    <h2>Log audit</h2>
    <p>${esc(auditStatus.total)} catatan dari ${esc(auditStatus.devices)} perangkat. Rantai hash ${auditStatus.ok ? '<span class="ok">utuh</span>' : '<span class="no">tidak cocok (' + esc(auditStatus.broken) + ')</span>'}.</p>
    <div class="foot">${stamp()} · Dokumen pendukung kepatuhan, bukan nasihat hukum. Rujukan: UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.</div></div>`);
}
