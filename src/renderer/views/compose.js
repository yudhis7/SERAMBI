// Tulis postingan — compose once, send to several accounts now or later.
import { icon } from '../icons.js';
import {
  esc, toast, showMenu, promptDialog, confirmDialog, fmtDayLong, fmtTime, relDay, toDateInput, toTimeInput,
  fromInputs, addDays, startOfDay, charCount, snippet
} from '../util.js';
import { S, api, go, emit, account, platformOf, tile, mediaTag, hasBot, modKey } from '../ctx.js';

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
    id: null, text: '', media: [], targets: new Set(pre.length ? pre : ids), mode: 'now',
    date: toDateInput(rounded), time: toTimeInput(rounded), preview: null, original: null
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
    mode: p.status === 'scheduled' ? 'schedule' : p.status === 'draft' ? 'draft' : 'now',
    date: when ? toDateInput(when) : dflt.date,
    time: when ? toTimeInput(when) : dflt.time,
    original: p
  };
}

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
  box.innerHTML = `
    <div class="section-head"><h2>Kirim ke</h2><button class="link target-all" data-all>${all ? 'Kosongkan pilihan' : 'Pilih semua'}</button></div>
    <div class="targets" role="group" aria-label="Akun tujuan">
      ${accs.map(a => {
        const on = d.targets.has(a.id);
        return `<button class="target ${on ? 'on' : ''}" data-target="${a.id}" aria-pressed="${on}" title="${esc(platformOf(a).name)}">
          ${tile(a)}<span>${esc(a.name)}</span><span class="check">${on ? icon('check', 11) : ''}</span></button>`;
      }).join('')}
    </div>`;
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
    if (limit > 5000) return '';
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
  return out;
}

function renderWarnings() {
  const w = warnings();
  root.querySelector('[data-region="warnings"]').innerHTML = w.map(t => `<div class="warning">${icon('circle-alert', 15)}<span>${esc(t)}</span></div>`).join('');
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

  const label = d.mode === 'now' ? 'Posting sekarang' : d.mode === 'schedule' ? 'Jadwalkan' : 'Simpan draf';
  const autoAccs = accs.filter(a => a.platform === 'telegram' && hasBot(a.id));
  const manualAccs = accs.filter(a => !autoAccs.includes(a));

  box.innerHTML = `
    <div class="side-card">
      <h3>Kapan diposting?</h3>
      <div class="seg block" role="tablist">
        <button class="${d.mode === 'now' ? 'on' : ''}" data-mode="now">Sekarang</button>
        <button class="${d.mode === 'schedule' ? 'on' : ''}" data-mode="schedule">${icon('clock', 14)}Jadwalkan</button>
        <button class="${d.mode === 'draft' ? 'on' : ''}" data-mode="draft">Draf</button>
      </div>
      ${d.mode === 'schedule' ? `
        <div class="when-row">
          <input type="date" class="input" data-date value="${esc(d.date)}" min="${toDateInput(now)}" aria-label="Tanggal">
          <input type="time" class="input" data-time value="${esc(d.time)}" aria-label="Jam">
        </div>
        <div class="quick-times">${quick.map(q => `<button data-quick="${q.ts}">${esc(q.label)}</button>`).join('')}</div>
        <div class="when-summary" data-when>${ts ? (ts <= now ? `<span class="error-text">Waktu ini sudah lewat. Pilih waktu lain.</span>` : `Diposting <b>${esc(fmtDayLong(ts))}</b> pukul <b>${esc(fmtTime(ts))}</b>`) : ''}</div>
      ` : d.mode === 'draft' ? `<p class="hint" style="margin:0">Disimpan tanpa jadwal. Kamu bisa menjadwalkannya kapan saja dari halaman Jadwal.</p>` : ''}
      <button class="btn primary lg block" data-submit>${d.mode === 'now' ? icon('send', 17) : d.mode === 'schedule' ? icon('calendar-days', 17) : icon('bookmark-plus', 17)}${label}</button>
      ${d.id ? `<button class="btn ghost danger block" data-delete>${icon('trash-2', 16)}Hapus postingan</button>` : ''}
    </div>
    ${accs.length && d.mode !== 'draft' ? `
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
  if (d.mode === 'schedule') {
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
    status: d.mode === 'schedule' ? 'scheduled' : 'draft', scheduledAt
  };
  const btn = root.querySelector('[data-submit]');
  btn.disabled = true;
  const saved = await api.savePost(payload);
  S.composeWip = null;
  d.saved = true;

  if (d.mode === 'schedule') {
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
  }
}

function onInput(e) {
  const t = e.target;
  if (t.matches('textarea')) { d.text = t.value; autosize(t); onTextChanged(); }
  else if (t.matches('[data-date]')) { d.date = t.value; refreshWhen(); }
  else if (t.matches('[data-time]')) { d.time = t.value; refreshWhen(); }
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

export default {
  mount(el, titlebar, route) {
    root = el; tb = titlebar;
    const existing = route.postId && S.state.posts.find(p => p.id === route.postId);
    if (existing) d = fromPost(existing);
    else if (S.composeWip && !route.targets && !route.date) d = { ...S.composeWip, targets: new Set(S.composeWip.targets) };
    else d = blankDraft();
    if (route.targets) d.targets = new Set(route.targets);
    if (route.date) {
      const x = new Date(route.date); x.setHours(9, 0, 0, 0);
      const ts = x.getTime() > Date.now() ? x.getTime() : Math.ceil((Date.now() + 3600000) / 900000) * 900000;
      d.mode = 'schedule'; d.date = toDateInput(ts); d.time = toTimeInput(ts);
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
    refreshAll();
    const ta = root.querySelector('textarea');
    autosize(ta);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
  },
  update() {
    // Accounts may have been added or removed elsewhere; keep the text untouched.
    const ids = new Set(S.state.accounts.map(a => a.id));
    d.targets = new Set([...d.targets].filter(id => ids.has(id)));
    renderTargets(); renderCounters(); renderWarnings(); renderSide();
  },
  unmount() {
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('paste', onPaste);
    root.removeEventListener('dragover', onDragOver);
    root.removeEventListener('dragleave', onDragLeave);
    root.removeEventListener('drop', onDrop);
    if (!d.saved && !d.id && (d.text.trim() || d.media.length)) saveWip();
  }
};
