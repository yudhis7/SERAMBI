// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Otomatisasi — everyday local marketing that runs by itself, and the moments calendar.
import { icon } from '../icons.js';
import { esc, toast, openModal, confirmDialog, readForm, timeAgo, fmtMonth } from '../util.js';
import { S, api, perm, inTeam, memberName, tile, orderedAccounts } from '../ctx.js';
import { momentRow, openMoment } from './growth.js';

let root, ctx, kindFilter = 'all';
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const RECIPES = {
  review_request: { name: 'Minta ulasan setelah berkunjung', icon: 'star', desc: 'Sehari setelah pelanggan datang, Serambi menyiapkan pesan WhatsApp berisi link ulasan. Hanya untuk pelanggan yang setuju.', customers: true,
    defaults: { afterDays: 1, message: 'Halo {nama}, terima kasih sudah mampir ke {usaha}! Kalau berkenan, ceritakan pengalaman Kakak di sini ya: {link} 🙏' } },
  moment_prep: { name: 'Siapkan konten momen', icon: 'calendar-clock', desc: 'Seminggu sebelum hari libur dan momen belanja, Serambi membuat draf postingan dan tugas untuk menyiapkannya.',
    defaults: { daysBefore: 7, kinds: ['libur', 'belanja'], draft: true } },
  weekly_post: { name: 'Posting rutin mingguan', icon: 'repeat', desc: 'Postingan yang sama setiap minggu, misalnya “Promo Jumat”. Bisa jadi draf atau langsung terjadwal.',
    defaults: { weekday: 5, time: '11:00', mode: 'draft', text: '' } },
  review_reply: { name: 'Pengingat balas ulasan', icon: 'message-square', desc: 'Membuat tugas setiap ada ulasan yang belum dibalas lebih dari 24 jam.', defaults: { hours: 24 } },
  birthday: { name: 'Ucapan ulang tahun', icon: 'cake-slice', desc: 'Di hari ulang tahun pelanggan yang setuju, Serambi menyiapkan ucapan lewat WhatsApp.', customers: true,
    defaults: { message: 'Selamat ulang tahun, {nama}! Semoga sehat dan bahagia selalu. Ada hadiah kecil untuk Kakak di {usaha} minggu ini 🎉' } },
  winback: { name: 'Sapa pelanggan yang lama tidak datang', icon: 'heart-handshake', desc: 'Pelanggan yang tidak datang lebih dari 60 hari mendapat sapaan dan penawaran.', customers: true,
    defaults: { days: 60, message: 'Halo {nama}, lama tidak mampir ke {usaha}. Kami kangen! Minggu ini ada penawaran khusus untuk Kakak.' } },
  gbp_weekly: { name: 'Posting mingguan Profil Bisnis Google', icon: 'map-pin', desc: 'Setiap minggu mengingatkan dan menyiapkan teks update untuk Profil Bisnis Google.', defaults: { weekday: 3 } },
  weekly_report: { name: 'Laporan mingguan', icon: 'chart-column', desc: 'Setiap Senin pagi: ringkasan postingan, ulasan baru, dan tugas selesai.', defaults: { weekday: 1, time: '08:00' } },
  retention_check: { name: 'Pemeriksaan masa simpan data', icon: 'shield-check', desc: 'Tanggal 1 setiap bulan, cek data yang melewati masa simpan sesuai kebijakan retensi (UU PDP).', defaults: {} }
};

const canManage = () => perm('automations.manage');

function summary(a) {
  const c = a.config || {};
  switch (a.type) {
    case 'weekly_post': return `Setiap ${DAYS[c.weekday ?? 5]} ${String(c.time || '11:00').replace(':', '.')} · ${(c.targetIds || []).length} akun · ${c.mode === 'scheduled' ? 'langsung terjadwal' : 'sebagai draf'}`;
    case 'moment_prep': return `${c.daysBefore || 7} hari sebelum ${(c.kinds || ['libur', 'belanja']).map(k => (S.momentKinds[k] || k).toLowerCase()).join(', ')}`;
    case 'review_request': return `${c.afterDays ?? 1} hari setelah kunjungan`;
    case 'review_reply': return `Ulasan belum dibalas lebih dari ${c.hours || 24} jam`;
    case 'winback': return `Tidak datang lebih dari ${c.days || 60} hari`;
    case 'gbp_weekly': return `Setiap ${DAYS[c.weekday ?? 3]}`;
    case 'weekly_report': return `Setiap ${DAYS[c.weekday ?? 1]} ${String(c.time || '08:00').replace(':', '.')}`;
    case 'birthday': return 'Di hari ulang tahun pelanggan';
    default: return 'Tanggal 1 setiap bulan';
  }
}

function autoSection() {
  const list = S.state.automations;
  const on = list.filter(a => a.enabled).length;
  const pl = S.state.plan;
  const team = inTeam();
  const devNote = team ? (S.state.automationDevice ? 'Otomatisasi berjalan di komputer ini.' : 'Otomatisasi berjalan di komputer lain di tim (atur di menu Tim).') : 'Otomatisasi berjalan saat Serambi terbuka, termasuk saat disembunyikan.';
  const used = new Set(list.map(a => a.type));
  return `
    <section class="g-section" id="gs-auto">
      <div class="g-head"><div><h2>Otomatisasi aktif</h2><p>${esc(devNote)} Otomatisasi hanya <b>menyiapkan</b> pekerjaan (draf, jadwal, tugas, dan pesan WhatsApp siap kirim). Tidak ada pesan yang terkirim ke pelanggan tanpa kamu menekan kirim.</p></div>
        <div class="g-acts"><span class="faint">${on}/${pl.automations >= 200 ? '∞' : pl.automations} aktif di ${esc(pl.name || '')}</span>
          ${canManage() && list.length ? `<button class="btn sm" data-run-now>${icon('zap', 15)}Jalankan sekarang</button>` : ''}</div></div>
      ${list.length ? `<div class="panel set-list">${list.map(a => {
        const r = RECIPES[a.type] || { icon: 'zap', name: a.type };
        return `<div class="set-row auto-row">
          <span class="auto-ic">${icon(r.icon, 18)}</span>
          <div class="meta"><b>${esc(a.name || r.name)}</b><span>${esc(summary(a))}${a.lastRunAt ? ' · diperiksa ' + esc(timeAgo(a.lastRunAt)) : ''}${team && (a.config || {}).assigneeId ? ' · untuk ' + esc(memberName(a.config.assigneeId)) : ''}</span>
            ${a.lastError ? `<span class="error-text">${esc(a.lastError)}</span>` : ''}</div>
          ${canManage() ? `<button class="icon-btn" data-auto-edit="${a.id}" title="Atur">${icon('settings', 16)}</button>
            <button class="icon-btn" data-auto-rm="${a.id}" title="Hapus">${icon('trash-2', 16)}</button>
            <span class="switch"><input type="checkbox" data-auto-toggle="${a.id}" ${a.enabled ? 'checked' : ''} aria-label="Aktifkan ${esc(r.name)}"><span></span></span>` : `<span class="chip ${a.enabled ? 'posted' : ''}">${a.enabled ? 'Aktif' : 'Mati'}</span>`}
        </div>`;
      }).join('')}</div>` : '<div class="empty"><p>Belum ada otomatisasi. Pilih resep di bawah, cukup sekali atur.</p></div>'}
      <h3 class="sub-h">Resep otomatisasi</h3>
      <div class="recipe-grid">${Object.entries(RECIPES).map(([k, r]) => `
        <div class="recipe ${used.has(k) ? 'used' : ''}">
          <span class="auto-ic">${icon(r.icon, 18)}</span>
          <b>${esc(r.name)}</b><p>${esc(r.desc)}</p>
          ${r.customers ? `<span class="hint">${icon('shield-check', 12, 'inline')}Memakai data pelanggan dengan persetujuan</span>` : ''}
          ${canManage() ? `<button class="btn sm ${used.has(k) ? '' : 'primary'}" data-recipe="${k}">${used.has(k) ? 'Tambah lagi' : 'Aktifkan'}</button>` : ''}
        </div>`).join('')}</div>
    </section>`;
}

function momentsSection() {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const end = t0.getTime() + 150 * 86400000;
  const list = S.moments.filter(m => { const t = new Date(m.date + 'T00:00:00').getTime(); return t >= t0.getTime() && t <= end && (kindFilter === 'all' ? m.kind !== 'gajian' : m.kind === kindFilter); });
  const groups = [];
  for (const m of list) {
    const key = m.date.slice(0, 7);
    let g = groups.find(x => x.key === key);
    if (!g) groups.push(g = { key, title: fmtMonth(new Date(m.date + 'T00:00:00').getTime()), items: [] });
    g.items.push(m);
  }
  return `
    <section class="g-section" id="gs-moments">
      <div class="g-head"><div><h2>Kalender momen</h2><p>Hari libur nasional dan cuti bersama mengikuti SKB 3 Menteri. Tanggal hari besar keagamaan bisa bergeser setelah sidang isbat; tanggal bertanda “perkiraan” belum ditetapkan.</p></div></div>
      <div class="filters">${[['all', 'Semua'], ['libur', 'Libur nasional'], ['cuti', 'Cuti bersama'], ['belanja', 'Momen belanja'], ['peringatan', 'Hari peringatan'], ['gajian', 'Gajian']].map(([k, l]) => `<button class="${kindFilter === k ? 'on' : ''}" data-kind="${k}">${l}</button>`).join('')}</div>
      ${groups.length ? groups.map(g => `<div class="day-group"><h3 style="text-transform:capitalize">${esc(g.title)}</h3><div class="panel moment-list">${g.items.map(momentRow).join('')}</div></div>`).join('') : '<div class="empty"><p>Tidak ada momen untuk filter ini.</p></div>'}
    </section>`;
}

function render() {
  return `<div class="page growth-page">${autoSection()}${momentsSection()}</div>`;
}

function editAutomation(type, existing) {
  const r = RECIPES[type];
  const c = { ...r.defaults, ...((existing && existing.config) || {}) };
  const team = inTeam();
  const people = team ? S.state.members.filter(m => m.status === 'active' && m.role !== 'viewer') : [];
  const field = {
    weekday: () => `<div class="field"><label>Hari</label><select class="input" data-f="weekday">${DAYS.map((d, i) => `<option value="${i}" ${Number(c.weekday) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div>`,
    time: () => `<div class="field"><label>Jam</label><input class="input" type="time" data-f="time" value="${esc(c.time || '09:00')}"></div>`,
    text: () => `<div class="field full"><label>Isi postingan</label><textarea class="input textarea" rows="5" data-f="text" maxlength="5000" placeholder="Promo Jumat! Beli 2 gratis 1 untuk semua minuman dingin…">${esc(c.text || '')}</textarea><span class="hint">Bisa diubah tiap minggu sebelum diposting.</span></div>`,
    mode: () => `<div class="field"><label>Cara</label><select class="input" data-f="mode"><option value="draft" ${c.mode !== 'scheduled' ? 'selected' : ''}>Buat draf untuk diperiksa</option><option value="scheduled" ${c.mode === 'scheduled' ? 'selected' : ''}>Langsung jadwalkan</option></select></div>`,
    targets: () => `<div class="field full"><label>Akun tujuan</label><div class="targets small" data-targets>${orderedAccounts().map(a => `<label class="target ${(c.targetIds || []).includes(a.id) ? 'on' : ''}"><input type="checkbox" value="${a.id}" ${(c.targetIds || []).includes(a.id) ? 'checked' : ''} hidden>${tile(a)}<span>${esc(a.name)}</span></label>`).join('') || '<span class="hint">Tambahkan akun dulu.</span>'}</div></div>`,
    daysBefore: () => `<div class="field"><label>Berapa hari sebelumnya</label><input class="input" type="number" min="1" max="30" data-f="daysBefore" value="${esc(c.daysBefore || 7)}"></div>`,
    kinds: () => `<div class="field full"><label>Jenis momen</label><div class="check-inline">${['libur', 'cuti', 'belanja', 'peringatan'].map(k => `<label><input type="checkbox" data-kind-opt="${k}" ${(c.kinds || []).includes(k) ? 'checked' : ''}> ${esc(S.momentKinds[k])}</label>`).join('')}</div></div>`,
    draft: () => `<div class="field"><label class="check-inline"><input type="checkbox" data-f="draft" ${c.draft !== false ? 'checked' : ''}> Buat draf postingan juga</label></div>`,
    afterDays: () => `<div class="field"><label>Kirim berapa hari setelah kunjungan</label><input class="input" type="number" min="0" max="30" data-f="afterDays" value="${esc(c.afterDays ?? 1)}"></div>`,
    days: () => `<div class="field"><label>Dianggap lama setelah</label><div class="input-affix"><input class="input" type="number" min="14" max="365" data-f="days" value="${esc(c.days || 60)}"><span>hari</span></div></div>`,
    hours: () => `<div class="field"><label>Ingatkan setelah</label><div class="input-affix"><input class="input" type="number" min="1" max="240" data-f="hours" value="${esc(c.hours || 24)}"><span>jam</span></div></div>`,
    message: () => `<div class="field full"><label>Pesan WhatsApp</label><textarea class="input textarea" rows="4" data-f="message" maxlength="1000">${esc(c.message || '')}</textarea><span class="hint">{nama} nama depan, {usaha} nama usaha${type === 'review_request' ? ', {link} link ulasan' : ''}.</span></div>`
  };
  const layout = {
    weekly_post: ['weekday', 'time', 'mode', 'targets', 'text'], moment_prep: ['daysBefore', 'draft', 'kinds'], review_request: ['afterDays', 'message'],
    review_reply: ['hours'], birthday: ['message'], winback: ['days', 'message'], gbp_weekly: ['weekday'], weekly_report: ['weekday', 'time'], retention_check: []
  }[type];
  const m = openModal({
    title: existing ? `Atur: ${existing.name || r.name}` : r.name,
    wide: true,
    body: `<p>${esc(r.desc)}</p>
      ${r.customers ? `<div class="warning info">${icon('shield-check', 15)}<span>Hanya pelanggan yang tercatat setuju untuk tujuan ini, tidak sedang dibatasi, dan punya nomor WhatsApp. Pesan disiapkan sebagai tugas; kamu yang menekan kirim.</span></div>` : ''}
      <div class="form-grid">
        <div class="field full"><label>Nama</label><input class="input" data-f="name" value="${esc((existing && existing.name) || r.name)}" maxlength="80"></div>
        ${layout.map(k => field[k]()).join('')}
        ${team && people.length ? `<div class="field"><label>Tugas untuk</label><select class="input" data-f="assigneeId">${people.map(p => `<option value="${p.id}" ${(c.assigneeId || S.state.me.id) === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>` : ''}
      </div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>${existing ? 'Simpan' : 'Aktifkan'}</button>`
  });
  m.el.addEventListener('change', (e) => { const l = e.target.closest('.target'); if (l) l.classList.toggle('on', e.target.checked); });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    const config = { ...v };
    delete config.name;
    if (layout.includes('targets')) config.targetIds = [...m.el.querySelectorAll('[data-targets] input:checked')].map(i => i.value);
    if (layout.includes('kinds')) config.kinds = [...m.el.querySelectorAll('[data-kind-opt]:checked')].map(i => i.dataset.kindOpt);
    if (type === 'weekly_post' && config.mode === 'scheduled' && !config.targetIds.length) { toast('Pilih akun tujuan untuk postingan terjadwal', { kind: 'err' }); return; }
    try {
      await api.saveAutomation({ id: existing && existing.id, type, name: v.name, config, enabled: existing ? existing.enabled : true });
      m.close();
      toast(existing ? 'Otomatisasi disimpan' : 'Otomatisasi aktif');
    } catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
  };
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b || !root.contains(b)) return;
  const ds = b.dataset;
  if (ds.recipe) return editAutomation(ds.recipe, null);
  if (ds.autoEdit) { const a = S.state.automations.find(x => x.id === ds.autoEdit); return editAutomation(a.type, a); }
  if (ds.autoRm) {
    const a = S.state.automations.find(x => x.id === ds.autoRm);
    if (await confirmDialog({ title: `Hapus “${a.name}”?`, message: 'Otomatisasi berhenti. Draf dan tugas yang sudah dibuat tetap ada.', confirm: 'Hapus', danger: true })) api.removeAutomation(a.id);
    return;
  }
  if ('runNow' in ds) { await api.runAutomations(); return toast('Otomatisasi dijalankan. Hasilnya muncul di Beranda (tugas) dan Jadwal (draf).'); }
  if (ds.kind) { kindFilter = ds.kind; return ctx.rerender(); }
  if (ds.moment) return openMoment(ds.moment);
}
async function onChange(e) {
  const t = e.target;
  if (t.dataset.autoToggle) {
    try { await api.saveAutomation({ id: t.dataset.autoToggle, enabled: t.checked }); }
    catch (err) { t.checked = !t.checked; toast(err.message, { kind: 'err', ms: 6000 }); }
  }
}

export default {
  render,
  bind(el, c) { root = el; ctx = c; el.addEventListener('click', onClick); el.addEventListener('change', onChange); },
  unbind() { if (!root) return; root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); }
};
