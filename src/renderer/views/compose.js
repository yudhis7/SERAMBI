// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Tulis postingan — compose once, send to several accounts now or later.
import { icon } from '../icons.js';
import {
  esc, toast, showMenu, promptDialog, confirmDialog, fmtDayLong, fmtTime, relDay, toDateInput, toTimeInput,
  fromInputs, addDays, startOfDay, charCount, snippet
} from '../util.js';
import { S, api, go, emit, account, platformOf, tile, mediaTag, hasBot, modKey, KIND_LABEL, kindOf, orderedAccounts, perm, inTeam, memberName, member } from '../ctx.js';
import { utmUrl } from '../lib/ads.js';

let root, tb, d, unsavedWarned;

const MAX_MEDIA = 10;

function blankDraft() {
  let last = [];
  try { last = JSON.parse(localStorage.getItem('lastTargets') || '[]'); } catch (_) {}
  const ids = S.state.accounts.map(a => a.id);
  const pre = last.filter(id => ids.includes(id));
  const base = Date.now() + 60 * 60 * 1000;
  const rounded = Math.ceil(base / (15 * 60 * 1000)) * 15 * 60 * 1000;
  return {
    id: null, text: '', media: [], targets: new Set(pre.length ? pre : ids), mode: needsApproval() ? 'review' : 'now',
    date: toDateInput(rounded), time: toTimeInput(rounded), preview: null, original: null,
    assigneeId: inTeam() ? S.state.me.id : null, note: '', campaignId: null
  };
}

function fromPost(p) {
  const dflt = blankDraft();
  const when = p.scheduledAt && p.scheduledAt > Date.now() ? p.scheduledAt : null;
  return {
    ...dflt,
    id: p.id,
    text: p.text,
    media: p.media.map(m => ({ ...m })),
    targets: new Set(p.targets.map(t => t.accountId)),
    mode: p.status === 'review' ? (needsApproval() ? 'review' : 'schedule') : p.status === 'scheduled' ? (needsApproval() ? 'review' : 'schedule') : p.status === 'draft' ? 'draft' : 'now',
    date: when ? toDateInput(when) : dflt.date,
    time: when ? toTimeInput(when) : dflt.time,
    original: p, assigneeId: p.assigneeId || null, note: p.note || '', campaignId: p.campaignId || null
  };
}

/** Editors in a team with approval switched on send posts for review instead of scheduling them. */
function needsApproval() { return inTeam() && !perm('post.schedule') && perm('post.write'); }

function selectedAccounts() { return S.state.accounts.filter(a => d.targets.has(a.id)); }
function selectedPlatforms() { return [...new Set(selectedAccounts().map(a => a.platform))]; }
function scheduledTs() { return fromInputs(d.date, d.time); }

// ---------- regions ----------
function renderTargets() {
  const accs = S.state.accounts;
  const box = root.querySelector('[data-region="targets"]');
  if (!accs.length) {
    box.innerHTML = `<div class="empty"><p>Tambahkan akun dulu supaya bisa memilih tujuan postingan.</p><button class="btn primary" data-add-account>${icon('plus', 16)}Tambah akun</button></div>`;
    return;
  }
  const all = accs.every(a => d.targets.has(a.id));
  const kinds = ['social', 'shop'].filter(k => accs.some(a => kindOf(a) === k));
  const chip = (a) => {
    const on = d.targets.has(a.id);
    return `<button class="target ${on ? 'on' : ''}" data-target="${a.id}" aria-pressed="${on}" title="${esc(platformOf(a).name)}">
      ${tile(a)}<span>${esc(a.name)}</span><span class="check">${on ? icon('check', 11) : ''}</span></button>`;
  };
  box.innerHTML = `
    <div class="section-head"><h2>Kirim ke</h2><button class="link target-all" data-all>${all ? 'Kosongkan pilihan' : 'Pilih semua'}</button></div>
    ${kinds.map(k => `
      ${kinds.length > 1 ? `<div class="target-kind">${KIND_LABEL[k]}</div>` : ''}
      <div class="targets" role="group" aria-label="${KIND_LABEL[k]}">
        ${orderedAccounts().filter(a => kindOf(a) === k).map(chip).join('')}
      </div>`).join('')}`;
}

function renderMedia() {
  const strip = root.querySelector('[data-region="media"]');
  strip.innerHTML = d.media.map((m, i) => `
    <div class="media-thumb">${mediaTag(m)}
      ${m.type === 'video' ? '<span class="kind">Video</span>' : ''}
      <button class="rm" data-rm="${i}" title="Hapus" aria-label="Hapus media">${icon('x', 13)}</button>
    </div>`).join('');
  strip.classList.toggle('hidden', !d.media.length);
}

function renderCounters() {
  const n = charCount(d.text);
  const plats = selectedPlatforms();
  const parts = plats.map(pid => {
    const p = S.platforms[pid];
    let limit = p.limit;
    if (pid === 'telegram' && d.media.length) limit = 1024;
    if (!limit || limit > 5000) return '';
    const over = n > limit;
    return `<span class="${over ? 'over' : ''}" title="Batas ${esc(p.name)}">${esc(p.short)} ${n.toLocaleString('id-ID')}/${limit.toLocaleString('id-ID')}</span>`;
  }).filter(Boolean);
  if (!parts.length) parts.push(`<span>${n.toLocaleString('id-ID')} karakter</span>`);
  root.querySelector('[data-region="counters"]').innerHTML = parts.join('');
}

function warnings() {
  const out = [];
  const plats = selectedPlatforms();
  const n = charCount(d.text);
  if (plats.includes('x') && n > 280) out.push('Teks lebih dari 280 karakter. Di X, bagian yang berwarna merah di pratinjau tidak akan muat.');
  if (plats.includes('instagram') && !d.media.length) out.push('Instagram butuh minimal satu foto atau video.');
  const tags = (d.text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length;
  if (plats.includes('instagram') && tags > 30) out.push(`Instagram membatasi 30 tagar per postingan. Sekarang ada ${tags}.`);
  if (plats.includes('telegram') && d.media.length && n > 1024) out.push('Teks lebih dari 1.024 karakter, jadi di Telegram teksnya dikirim sebagai pesan terpisah setelah media.');
  if (plats.includes('x') && d.media.length > 4) out.push('X hanya menerima 4 gambar per postingan.');
  if (plats.includes('tiktok') && !d.media.length) out.push('TikTok butuh video atau foto.');
  if (plats.includes('tiktok') && n > 2200) out.push('Keterangan TikTok maksimal 2.200 karakter.');
  const shops = selectedAccounts().filter(a => kindOf(a) === 'shop');
  const linkInText = (a) => a.shopUrl && d.text.includes(a.shopUrl);
  const socialChosen = selectedAccounts().some(a => kindOf(a) === 'social');
  const allShops = S.state.accounts.filter(a => kindOf(a) === 'shop' && a.shopUrl);
  if (socialChosen && allShops.length && d.text.trim() && !allShops.some(linkInText)) {
    out.push({ info: true, text: 'Belum ada link toko di postingan ini. Sisipkan lewat tombol Link toko supaya pembeli langsung ke tokomu.' });
  }
  if (shops.length) out.push({ info: true, text: 'Untuk Tokopedia dan Shopee, Serambi membuka Seller Center dan menyalin teksnya. Tempel di menu promosi, chat, atau deskripsi produk.' });
  return out;
}

function renderWarnings() {
  const w = warnings();
  root.querySelector('[data-region="warnings"]').innerHTML = w.map(t => typeof t === 'string'
    ? `<div class="warning">${icon('circle-alert', 15)}<span>${esc(t)}</span></div>`
    : `<div class="warning info">${icon('info', 15)}<span>${esc(t.text)}</span></div>`).join('');
}

function highlight(text, cutAt) {
  const chars = Array.from(text);
  if (cutAt === undefined) cutAt = chars.length;
  let head = chars.slice(0, cutAt).join('');
  const tail = chars.slice(cutAt).join('');
  const mark = (s) => esc(s).replace(/(^|\s)([#@][\p{L}\p{N}_.]+)/gu, '$1<span class="tag">$2</span>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<span class="tag">$1</span>');
  return mark(head) + (tail ? `<span class="cut">${esc(tail)}</span>` : '');
}

function renderPreview() {
  const box = root.querySelector('[data-region="preview"]');
  const accs = selectedAccounts();
  const byPlatform = [];
  for (const a of accs) if (!byPlatform.find(x => x.platform === a.platform)) byPlatform.push(a);
  if (!byPlatform.length) {
    box.innerHTML = `<div class="preview-body"><p class="hint">Pilih akun tujuan untuk melihat pratinjau.</p></div>`;
    return;
  }
  if (!d.preview || !byPlatform.find(a => a.platform === d.preview)) d.preview = byPlatform[0].platform;
  const acc = byPlatform.find(a => a.platform === d.preview);
  const p = platformOf(acc);
  const limit = d.preview === 'x' ? 280 : d.preview === 'telegram' && d.media.length ? 1024 : Infinity;
  const media = d.media.slice(0, d.preview === 'x' ? 4 : 4);
  box.innerHTML = `
    <div class="preview-tabs">
      ${byPlatform.map(a => `<button class="${a.platform === d.preview ? 'on' : ''}" data-preview="${a.platform}">${esc(platformOf(a).name)}</button>`).join('')}
    </div>
    <div class="preview-body">
      <div class="pv-head">${tile(acc, '')}<div><b>${esc(acc.name)}</b><span>${esc(p.name)} · ${d.mode === 'schedule' && scheduledTs() ? esc(relDay(scheduledTs()) + ', ' + fmtTime(scheduledTs())) : 'Baru saja'}</span></div></div>
      ${d.preview === 'instagram' && media.length ? `<div class="pv-media n1">${mediaTag(media[0])}</div>` : ''}
      <div class="pv-text ${d.text ? '' : 'placeholder'}" style="${d.preview === 'instagram' && media.length ? 'margin-top:10px' : ''}">${d.text ? highlight(d.text, limit === Infinity ? undefined : limit) : 'Teks postingan akan tampil di sini.'}</div>
      ${d.preview !== 'instagram' && media.length ? `<div class="pv-media n${Math.min(media.length, 4)}">${media.map(m => mediaTag(m)).join('')}</div>` : ''}
    </div>`;
}

function renderSide() {
  const box = root.querySelector('[data-region="side"]');
  const accs = selectedAccounts();
  const ts = scheduledTs();
  const now = Date.now();
  const today = startOfDay(now);
  const quick = [];
  const at = (dayOffset, h, m = 0) => { const x = new Date(addDays(today, dayOffset)); x.setHours(h, m, 0, 0); return x.getTime(); };
  const inHour = Math.ceil((now + 3600000) / 300000) * 300000;
  quick.push({ label: '1 jam lagi', ts: inHour });
  if (at(0, 19) > now + 15 * 60000) quick.push({ label: 'Nanti 19.00', ts: at(0, 19) });
  quick.push({ label: 'Besok 09.00', ts: at(1, 9) }, { label: 'Besok 19.00', ts: at(1, 19) });
  const dow = new Date(today).getDay(); // 0 = Minggu
  const toMonday = ((8 - dow) % 7) || 7;
  if (toMonday > 1) quick.push({ label: 'Senin 09.00', ts: at(toMonday, 9) });

  const label = d.mode === 'now' ? 'Posting sekarang' : d.mode === 'schedule' ? 'Jadwalkan' : d.mode === 'review' ? 'Ajukan persetujuan' : 'Simpan draf';
  const approval = needsApproval();
  const orig = d.original;
  const team = inTeam();
  const people = team ? S.state.members.filter(m => m.status === 'active' && m.role !== 'viewer') : [];
  const comments = d.id ? S.state.comments.filter(c => c.postId === d.id).sort((a, b) => a.createdAt - b.createdAt) : [];
  const autoAccs = accs.filter(a => a.platform === 'telegram' && hasBot(a.id));
  const manualAccs = accs.filter(a => !autoAccs.includes(a));

  box.innerHTML = `
    <div class="side-card">
      <h3>Kapan diposting?</h3>
      ${orig && orig.status === 'review' ? `<div class="approval-note">${icon('hourglass', 15)}<span>Menunggu persetujuan${orig.approval && orig.approval.requestedByName ? ` · diajukan ${esc(orig.approval.requestedByName)}` : ''}</span></div>` : ''}
      ${orig && orig.approval && orig.approval.decision === 'rejected' && orig.status === 'draft' ? `<div class="approval-note rejected">${icon('circle-x', 15)}<span>Ditolak ${esc(orig.approval.decidedByName || '')}${orig.approval.decisionNote ? `: “${esc(orig.approval.decisionNote)}”` : ''}</span></div>` : ''}
      <div class="seg block" role="tablist">
        ${approval ? `<button class="${d.mode === 'review' ? 'on' : ''}" data-mode="review">${icon('send', 14)}Ajukan</button>` : `<button class="${d.mode === 'now' ? 'on' : ''}" data-mode="now">Sekarang</button>
        <button class="${d.mode === 'schedule' ? 'on' : ''}" data-mode="schedule">${icon('clock', 14)}Jadwalkan</button>`}
        <button class="${d.mode === 'draft' ? 'on' : ''}" data-mode="draft">Draf</button>
      </div>
      ${d.mode === 'schedule' || d.mode === 'review' ? `
        <div class="when-row">
          <input type="date" class="input" data-date value="${esc(d.date)}" min="${toDateInput(now)}" aria-label="Tanggal">
          <input type="time" class="input" data-time value="${esc(d.time)}" aria-label="Jam">
        </div>
        <div class="quick-times">${quick.map(q => `<button data-quick="${q.ts}">${esc(q.label)}</button>`).join('')}</div>
        <div class="when-summary" data-when>${ts ? (ts <= now ? `<span class="error-text">Waktu ini sudah lewat. Pilih waktu lain.</span>` : `Diposting <b>${esc(fmtDayLong(ts))}</b> pukul <b>${esc(fmtTime(ts))}</b>`) : ''}</div>
        ${d.mode === 'review' ? `<p class="hint" style="margin:0">Admin tim menyetujui dulu, lalu postingan otomatis masuk jadwal.</p>` : ''}
      ` : d.mode === 'draft' ? `<p class="hint" style="margin:0">Disimpan tanpa jadwal. Kamu bisa menjadwalkannya kapan saja dari halaman Jadwal.</p>` : ''}
      ${team && people.length ? `<div class="field"><label for="c-assignee">Penanggung jawab</label>
        <select id="c-assignee" class="input" data-assignee>
          ${people.map(m => `<option value="${m.id}" ${d.assigneeId === m.id ? 'selected' : ''}>${esc(m.id === S.state.me.id ? m.name + ' (kamu)' : m.name)}</option>`).join('')}
        </select><span class="hint">Pengingat waktunya posting muncul di komputer orang ini.</span></div>` : ''}
      <button class="btn primary lg block" data-submit>${d.mode === 'now' ? icon('send', 17) : d.mode === 'schedule' ? icon('calendar-days', 17) : d.mode === 'review' ? icon('send', 17) : icon('bookmark-plus', 17)}${label}</button>
      ${orig && orig.status === 'review' && perm('post.approve') ? `<div class="row-btns"><button class="btn sm block" data-decide="approve">${icon('check', 15)}Setujui</button><button class="btn sm danger block" data-decide="reject">${icon('x', 15)}Tolak</button></div>` : ''}
      ${d.id ? `<button class="btn ghost danger block" data-delete>${icon('trash-2', 16)}Hapus postingan</button>` : ''}
    </div>
    ${d.note ? `<div class="side-card note-card">${icon('lightbulb', 16)}<span>${esc(d.note)}</span></div>` : ''}
    ${team && d.id ? `
    <div class="side-card">
      <h3>Komentar tim</h3>
      <div class="comments">${comments.length ? comments.map(c => `<div class="comment"><b>${esc(c.memberName || memberName(c.memberId) || 'Anggota')}</b><span class="faint"> · ${esc(fmtTime(c.createdAt))}, ${esc(relDay(c.createdAt))}</span>
        ${c.memberId === S.state.me.id ? `<button class="icon-btn sm" data-uncomment="${c.id}" title="Hapus komentar">${icon('x', 13)}</button>` : ''}<p>${esc(c.text)}</p></div>`).join('') : '<p class="hint" style="margin:0">Belum ada komentar.</p>'}</div>
      <div class="comment-box"><input class="input" data-comment placeholder="Tulis komentar…" maxlength="2000"><button class="btn sm" data-send-comment>${icon('send', 14)}</button></div>
    </div>` : ''}
    ${accs.length && d.mode !== 'draft' && d.mode !== 'review' ? `
    <div class="side-card">
      <h3>Cara terkirimnya</h3>
      <div class="how-list">
        ${autoAccs.length ? `<div>${icon('bot', 15)}<span><b>${autoAccs.map(a => esc(a.name)).join(', ')}</b>: terkirim otomatis lewat bot Telegram.</span></div>` : ''}
        ${manualAccs.length ? `<div>${icon('clipboard-copy', 15)}<span><b>${manualAccs.map(a => esc(a.name)).join(', ')}</b>: ${d.mode === 'schedule' ? 'Serambi mengingatkanmu tepat waktu, membuka akunnya, dan menyalin teksnya.' : 'Serambi membuka akunnya dan menyalin teksnya, tinggal tempel.'}</span></div>` : ''}
        ${manualAccs.some(a => a.platform === 'telegram') ? `<div>${icon('info', 15)}<span>Ingin Telegram terkirim otomatis? Hubungkan bot di <button class="link" data-go-settings>Pengaturan</button>.</span></div>` : ''}
      </div>
    </div>` : ''}
    <div class="side-card preview" data-region="preview"></div>`;
  renderPreview();
}

function refreshAll() {
  renderTargets();
  renderMedia();
  renderCounters();
  renderWarnings();
  renderSide();
}

function onTextChanged() {
  renderCounters();
  renderWarnings();
  renderPreview();
  saveWip();
}

function saveWip() {
  if (d.id) return;
  S.composeWip = { ...d, targets: [...d.targets] };
}

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight + 2, window.innerHeight * 0.52) + 'px';
}

async function addMedia(items) {
  if (!items || !items.length) return;
  const room = MAX_MEDIA - d.media.length;
  if (room <= 0) { toast(`Maksimal ${MAX_MEDIA} media per postingan`, { kind: 'err' }); return; }
  d.media.push(...items.slice(0, room));
  if (items.length > room) toast(`Hanya ${room} media pertama yang ditambahkan`, { kind: 'info' });
  renderMedia(); renderCounters(); renderWarnings(); renderPreview(); saveWip();
}

// ---------- submit ----------
async function submit() {
  const accs = selectedAccounts();
  if (!accs.length) { toast('Pilih minimal satu akun tujuan', { kind: 'err' }); return; }
  if (!d.text.trim() && !d.media.length) { toast('Tulis sesuatu atau tambahkan foto atau video', { kind: 'err' }); root.querySelector('textarea').focus(); return; }
  let scheduledAt = null;
  if (d.mode === 'schedule' || d.mode === 'review') {
    scheduledAt = scheduledTs();
    if (!scheduledAt || scheduledAt <= Date.now() + 20000) { toast('Pilih waktu yang belum lewat', { kind: 'err' }); return; }
  }
  if (d.mode !== 'draft' && selectedPlatforms().includes('x') && charCount(d.text) > 280) {
    const ok = await confirmDialog({ title: 'Teks terlalu panjang untuk X', message: 'X hanya menampilkan 280 karakter. Kamu bisa memendekkannya nanti saat menempel. Tetap lanjut?', confirm: 'Tetap lanjut' });
    if (!ok) return;
  }
  try { localStorage.setItem('lastTargets', JSON.stringify([...d.targets])); } catch (_) {}

  const payload = {
    id: d.id, text: d.text, media: d.media, targetIds: [...d.targets],
    status: d.mode === 'schedule' ? 'scheduled' : d.mode === 'review' ? 'review' : 'draft', scheduledAt,
    assigneeId: d.assigneeId || undefined, campaignId: d.campaignId || undefined
  };
  const btn = root.querySelector('[data-submit]');
  btn.disabled = true;
  const saved = await api.savePost(payload);
  S.composeWip = null;
  d.saved = true;

  if (saved.status === 'review') {
    toast('Diajukan untuk disetujui admin tim');
    S.scheduleDay = scheduledAt; S.scheduleMonth = scheduledAt; S.scheduleMode = 'month';
    go({ name: 'schedule' });
  } else if (d.mode === 'schedule') {
    toast(`Dijadwalkan ${relDay(scheduledAt).toLowerCase() === 'hari ini' ? 'hari ini' : fmtDayLong(scheduledAt)} pukul ${fmtTime(scheduledAt)}`);
    S.scheduleDay = scheduledAt; S.scheduleMonth = scheduledAt; S.scheduleMode = 'month';
    go({ name: 'schedule' });
  } else if (d.mode === 'draft') {
    toast('Draf disimpan');
    go({ name: 'home' });
  } else {
    const result = await api.runPost(saved.id);
    go({ name: 'home' });
    const pending = result && result.targets.some(t => t.status === 'waiting' || t.status === 'failed');
    if (pending) emit('assist', saved.id);
    else toast('Postingan terkirim');
  }
}

async function removePost() {
  const ok = await confirmDialog({ title: 'Hapus postingan ini?', message: 'Postingan dan jadwalnya akan dihapus dari Serambi.', confirm: 'Hapus', danger: true });
  if (!ok) return;
  await api.removePost(d.id);
  d.saved = true;
  toast('Postingan dihapus');
  go({ name: 'schedule' });
}

// ---------- templates ----------
function insertAtCursor(text) {
  const ta = root.querySelector('textarea');
  const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? ta.value.length;
  ta.setRangeText(text, s, e, 'end');
  d.text = ta.value;
  autosize(ta);
  ta.focus();
  onTextChanged();
}

function appendText(line) {
  const ta = root.querySelector('textarea');
  const v = ta.value.replace(/\s+$/, '');
  ta.value = v ? `${v}\n\n${line}` : line;
  d.text = ta.value;
  autosize(ta);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  onTextChanged();
}

/** Insert the buyer-facing link of a Tokopedia or Shopee shop. */
function shopLinkMenu(anchor) {
  const shops = orderedAccounts().filter(a => kindOf(a) === 'shop');
  const camps = S.state.campaigns.filter(c => c.url && c.status !== 'done');
  if (!shops.length && camps.length) {
    showMenu(anchor, [{ heading: 'Sisipkan link kampanye' }, ...camps.map(c => ({ label: c.name, icon: 'link-2', onClick: () => { d.campaignId = c.id; appendText(utmUrl(c.url, c.utm || { source: 'serambi', medium: 'social', campaign: c.name })); } }))], { align: 'left' });
    return;
  }
  if (!shops.length) {
    showMenu(anchor, [
      { heading: 'Belum ada toko online' },
      { label: 'Hubungkan Tokopedia atau Shopee', icon: 'store', onClick: () => emit('add-account-kind', 'shop') }
    ], { align: 'left' });
    return;
  }
  const items = [{ heading: 'Sisipkan link toko' }];
  for (const a of shops) {
    const p = platformOf(a);
    if (a.shopUrl) items.push({ label: `${a.name} (${p.name})`, icon: 'link', onClick: () => appendText(`Belanja di ${p.name}: ${a.shopUrl}`) });
    else items.push({ label: `Atur link ${a.name} dulu`, icon: 'pencil', onClick: () => emit('edit-shop', a.id) });
  }
  if (camps.length) {
    items.push('sep', { heading: 'Link kampanye (dengan UTM)' });
    for (const c of camps) items.push({ label: c.name, icon: 'link-2', onClick: () => { d.campaignId = c.id; appendText(utmUrl(c.url, c.utm || { source: 'serambi', medium: 'social', campaign: c.name })); } });
  }
  showMenu(anchor, items, { align: 'left' });
}

function templateMenu(anchor) {
  const items = [];
  const tpls = S.state.templates;
  if (tpls.length) {
    items.push({ heading: 'Sisipkan templat' });
    tpls.slice(0, 12).forEach(t => items.push({ label: t.name, icon: 'file-text', onClick: () => insertAtCursor(t.text) }));
    items.push('sep');
  }
  items.push({
    label: 'Simpan teks ini sebagai templat', icon: 'bookmark-plus',
    onClick: async () => {
      if (!d.text.trim()) { toast('Tulis teks dulu, lalu simpan sebagai templat', { kind: 'info' }); return; }
      const name = await promptDialog({ title: 'Simpan sebagai templat', label: 'Nama templat', value: snippet(d.text, 30), placeholder: 'Misalnya: Tagar promo' });
      if (name) { await api.saveTemplate({ name, text: d.text }); toast('Templat disimpan'); }
    }
  });
  if (tpls.length) items.push({ label: 'Kelola templat', icon: 'settings', onClick: () => go({ name: 'settings', section: 'templates' }) });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soon = S.moments.filter(m => { const t = new Date(m.date + 'T00:00:00').getTime(); return t >= today.getTime() && t <= today.getTime() + 21 * 86400000 && m.kind !== 'gajian'; }).slice(0, 5);
  if (soon.length) {
    items.push('sep', { heading: 'Ide dari kalender momen' });
    soon.forEach(m => items.push({ label: `${m.name} · ${fmtDayLong(new Date(m.date + 'T09:00:00').getTime())}`, icon: 'calendar-clock', onClick: () => { d.note = m.idea; appendText(m.name); renderSide(); } }));
  }
  showMenu(anchor, items, { align: 'left' });
}

// ---------- events ----------
function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.target) {
    const id = b.dataset.target;
    d.targets.has(id) ? d.targets.delete(id) : d.targets.add(id);
    renderTargets(); renderCounters(); renderWarnings(); renderSide(); saveWip();
  } else if ('all' in b.dataset) {
    const all = S.state.accounts.every(a => d.targets.has(a.id));
    d.targets = new Set(all ? [] : S.state.accounts.map(a => a.id));
    renderTargets(); renderCounters(); renderWarnings(); renderSide(); saveWip();
  } else if (b.dataset.rm) {
    d.media.splice(Number(b.dataset.rm), 1);
    renderMedia(); renderCounters(); renderWarnings(); renderPreview(); saveWip();
  } else if ('pick' in b.dataset) {
    api.pickMedia().then(addMedia);
  } else if ('shoplink' in b.dataset) {
    shopLinkMenu(b);
  } else if ('templates' in b.dataset) {
    templateMenu(b);
  } else if (b.dataset.mode) {
    d.mode = b.dataset.mode; renderSide(); saveWip();
  } else if (b.dataset.quick) {
    const ts = Number(b.dataset.quick);
    d.date = toDateInput(ts); d.time = toTimeInput(ts); renderSide(); saveWip();
  } else if (b.dataset.preview) {
    d.preview = b.dataset.preview; renderPreview();
  } else if ('submit' in b.dataset) {
    submit().finally(() => { const s = root.querySelector('[data-submit]'); if (s) s.disabled = false; });
  } else if ('delete' in b.dataset) {
    removePost();
  } else if ('addAccount' in b.dataset) {
    emit('add-account');
  } else if ('goSettings' in b.dataset) {
    go({ name: 'settings', section: 'telegram' });
  } else if (b.dataset.decide) {
    decide(b.dataset.decide === 'approve');
  } else if ('sendComment' in b.dataset) {
    sendComment();
  } else if (b.dataset.uncomment) {
    api.removeComment(b.dataset.uncomment);
  }
}

async function decide(approve) {
  const note = approve ? '' : await promptDialog({ title: 'Tolak postingan', label: 'Alasan (dikirim ke penulis)', placeholder: 'Misalnya: ganti foto, harga salah', maxlength: 300, confirm: 'Tolak' });
  if (!approve && note === null) return;
  await api.decidePost({ id: d.id, approve, note });
  d.saved = true;
  toast(approve ? 'Disetujui dan masuk jadwal' : 'Postingan dikembalikan ke penulis');
  go({ name: 'schedule' });
}
async function sendComment() {
  const input = root.querySelector('[data-comment]');
  const text = input && input.value.trim();
  if (!text) return;
  await api.addComment({ postId: d.id, text });
  input.value = '';
}

function onInput(e) {
  const t = e.target;
  if (t.matches('textarea')) { d.text = t.value; autosize(t); onTextChanged(); }
  else if (t.matches('[data-date]')) { d.date = t.value; refreshWhen(); }
  else if (t.matches('[data-time]')) { d.time = t.value; refreshWhen(); }
  else if (t.matches('[data-assignee]')) { d.assigneeId = t.value; saveWip(); }
}
function refreshWhen() {
  const ts = scheduledTs();
  const el = root.querySelector('[data-when]');
  if (el) el.innerHTML = ts ? (ts <= Date.now() ? `<span class="error-text">Waktu ini sudah lewat. Pilih waktu lain.</span>` : `Diposting <b>${esc(fmtDayLong(ts))}</b> pukul <b>${esc(fmtTime(ts))}</b>`) : '';
  renderPreview();
  saveWip();
}

async function onPaste(e) {
  if (!e.target.matches('textarea')) return;
  const cd = e.clipboardData;
  const hasText = cd && cd.getData('text/plain');
  if (cd && cd.files && cd.files.length && !hasText) {
    e.preventDefault();
    const paths = Array.from(cd.files).map(f => api.pathForFile(f)).filter(Boolean);
    if (paths.length) addMedia(await api.importMedia(paths));
    else { const m = await api.pasteMedia(); if (m) addMedia([m]); }
  }
}

function onDragOver(e) {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  e.preventDefault();
  root.querySelector('.editor').classList.add('drop');
}
function onDragLeave(e) {
  if (!root.querySelector('.editor').contains(e.relatedTarget)) root.querySelector('.editor').classList.remove('drop');
}
async function onDrop(e) {
  const ed = root.querySelector('.editor');
  ed.classList.remove('drop');
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const paths = Array.from(e.dataTransfer.files).map(f => api.pathForFile(f)).filter(Boolean);
  addMedia(await api.importMedia(paths));
}

function onCommentKey(e) { if (e.key === 'Enter' && e.target.matches('[data-comment]')) { e.preventDefault(); sendComment(); } }

export default {
  mount(el, titlebar, route) {
    root = el; tb = titlebar;
    const existing = route.postId && S.state.posts.find(p => p.id === route.postId);
    if (existing) d = fromPost(existing);
    else if (S.composeWip && !route.targets && !route.date) d = { ...S.composeWip, targets: new Set(S.composeWip.targets) };
    else d = blankDraft();
    if (route.targets) d.targets = new Set(route.targets);
    if (route.text !== undefined && !existing) { d.text = String(route.text); d.note = route.note || ''; d.campaignId = route.campaignId || null; }
    if (route.scheduledAt && !existing) {
      const ts = route.scheduledAt > Date.now() ? route.scheduledAt : Math.ceil((Date.now() + 3600000) / 900000) * 900000;
      d.mode = needsApproval() ? 'review' : 'schedule'; d.date = toDateInput(ts); d.time = toTimeInput(ts);
    }
    if (route.date) {
      const x = new Date(route.date); x.setHours(9, 0, 0, 0);
      const ts = x.getTime() > Date.now() ? x.getTime() : Math.ceil((Date.now() + 3600000) / 900000) * 900000;
      d.mode = needsApproval() ? 'review' : 'schedule'; d.date = toDateInput(ts); d.time = toTimeInput(ts);
    }
    if (!perm('post.write')) {
      tb.innerHTML = '<h1>Tulis postingan</h1>';
      root.innerHTML = `<div class="page narrow"><div class="empty" style="margin-top:24px">${icon('eye', 22)}<p>${S.state.readOnly ? 'Paket tim tidak aktif, jadi data tim hanya bisa dilihat.' : 'Peranmu di tim adalah Pengamat, jadi kamu bisa melihat jadwal tetapi tidak menulis postingan.'}</p>
        <button class="btn" data-go-sched>${icon('calendar-days', 16)}Lihat jadwal</button></div></div>`;
      root.querySelector('[data-go-sched]').onclick = () => go({ name: 'schedule' });
      d = blankDraft(); d.saved = true; d.readOnly = true;
      return;
    }

    tb.innerHTML = `<h1>${d.id ? 'Edit postingan' : 'Tulis postingan'}</h1><span class="grow"></span>
      ${!d.id && (d.text || d.media.length) ? `<button class="btn ghost sm" data-clear>Mulai dari kosong</button>` : ''}`;
    tb.onclick = (e) => {
      if (e.target.closest('[data-clear]')) { S.composeWip = null; go({ name: 'compose', fresh: Date.now() }); }
    };

    root.innerHTML = `
      <div class="compose">
        <div class="compose-main">
          <section data-region="targets"></section>
          <section>
            <div class="editor">
              <textarea placeholder="Tulis sesuatu untuk pengikutmu…" aria-label="Isi postingan" spellcheck="true">${esc(d.text)}</textarea>
              <div class="media-strip" data-region="media"></div>
              <div class="editor-tools">
                <button class="btn ghost sm" data-pick title="Tambah foto atau video">${icon('image', 16)}Foto/video</button>
                <button class="btn ghost sm" data-templates>${icon('file-text', 16)}Templat</button>
                <button class="btn ghost sm" data-shoplink>${icon('store', 16)}Link toko</button>
                <span class="grow"></span>
                <div class="counters" data-region="counters"></div>
              </div>
            </div>
            <p class="hint" style="margin:8px 2px 0">Tarik foto ke kotak ini atau tempel dengan ${modKey()}+V.</p>
          </section>
          <section class="warnings" data-region="warnings"></section>
        </div>
        <aside class="compose-side" data-region="side"></aside>
      </div>`;

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('paste', onPaste);
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('dragleave', onDragLeave);
    root.addEventListener('drop', onDrop);
    root.addEventListener('keydown', onCommentKey);
    refreshAll();
    const ta = root.querySelector('textarea');
    autosize(ta);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
  },
  update() {
    if (d.readOnly) return;
    // Accounts may have been added or removed elsewhere; keep the text untouched.
    const keepComment = root.querySelector('[data-comment]') ? root.querySelector('[data-comment]').value : '';
    if (d.id) { const fresh = S.state.posts.find(p => p.id === d.id); if (fresh) d.original = fresh; }
    const ids = new Set(S.state.accounts.map(a => a.id));
    d.targets = new Set([...d.targets].filter(id => ids.has(id)));
    renderTargets(); renderCounters(); renderWarnings(); renderSide();
    const ci = root.querySelector('[data-comment]'); if (ci && keepComment) ci.value = keepComment;
  },
  unmount() {
    if (d.readOnly) return;
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('paste', onPaste);
    root.removeEventListener('dragover', onDragOver);
    root.removeEventListener('dragleave', onDragLeave);
    root.removeEventListener('drop', onDrop);
    root.removeEventListener('keydown', onCommentKey);
    if (!d.saved && !d.id && (d.text.trim() || d.media.length)) saveWip();
  }
};
