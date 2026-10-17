// Pengaturan — appearance, background behaviour, accounts, Telegram bots, templates, backup.
import { icon } from '../icons.js';
import { esc, toast, confirmDialog, promptDialog, openModal, snippet } from '../util.js';
import { S, api, go, emit, account, platformOf, tile, modKey } from '../ctx.js';

let root, scrollTo;

function toggle(key, label, desc) {
  const on = !!S.state.settings[key];
  return `
    <label class="set-row" style="cursor:pointer">
      <div class="meta"><b>${label}</b><span>${desc}</span></div>
      <span class="switch"><input type="checkbox" data-setting="${key}" ${on ? 'checked' : ''} aria-label="${esc(label)}"><span></span></span>
    </label>`;
}

function botForm(a) {
  const bot = S.state.bots[a.id];
  const connected = bot && bot.hasToken && bot.chatId;
  return `
    <div class="bot-form" data-bot="${a.id}">
      <div style="display:flex;align-items:center;gap:10px">
        ${tile(a)}<b style="flex:1">${esc(a.name)}</b>
        ${connected ? `<span class="bot-status ok">${icon('circle-check-big', 16)}Terhubung ke ${esc(bot.chatTitle || bot.chatId)} lewat ${esc(bot.botName || 'bot')}</span>` : `<span class="chip">Belum terhubung</span>`}
      </div>
      <div class="row2">
        <div class="field"><label>Token bot</label>
          <input class="input" type="password" data-token placeholder="${bot && bot.hasToken ? 'Tersimpan. Isi untuk mengganti.' : '123456:ABC-DEF…'}" autocomplete="off" spellcheck="false"></div>
        <div class="field"><label>Channel atau grup</label>
          <input class="input" data-chat value="${esc(bot ? bot.chatId : '')}" placeholder="@namachannel atau -100…" spellcheck="false"></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn primary sm" data-bot-save="${a.id}">${connected ? 'Simpan & tes ulang' : 'Hubungkan & tes'}</button>
        ${bot ? `<button class="btn ghost sm" data-bot-remove="${a.id}">Putuskan</button>` : ''}
        <span class="error-text" data-bot-err></span>
      </div>
    </div>`;
}

function render() {
  const { settings, accounts, templates } = S.state;
  const tgs = accounts.filter(a => a.platform === 'telegram');
  const mk = modKey();
  root.innerHTML = `
    <div class="page narrow" style="padding-top:12px">
      <section class="settings-group">
        <h2>Tampilan</h2>
        <p>Pilih tema terang atau gelap, atau ikuti pengaturan komputermu.</p>
        <div class="seg" role="radiogroup" aria-label="Tema">
          ${[['system', 'monitor', 'Ikuti sistem'], ['light', 'sun', 'Terang'], ['dark', 'moon', 'Gelap']].map(([v, ic, l]) =>
            `<button class="${settings.theme === v ? 'on' : ''}" data-theme="${v}" role="radio" aria-checked="${settings.theme === v}">${icon(ic, 15)}${l}</button>`).join('')}
        </div>
      </section>

      <section class="settings-group">
        <h2>Notifikasi & latar belakang</h2>
        <p>Pengingat jadwal hanya berjalan saat Serambi terbuka, termasuk saat disembunyikan di ${S.os === 'darwin' ? 'Dock' : 'tray'}.</p>
        <div class="set-list">
          ${toggle('notifications', 'Ingatkan saat waktunya posting', 'Muncul notifikasi ketika postingan terjadwal perlu ditempel atau gagal dikirim.')}
          ${S.os !== 'darwin' ? toggle('closeToTray', 'Tetap berjalan saat jendela ditutup', 'Serambi pindah ke tray, jadi chat dan jadwal tetap aktif. Keluar lewat menu tray.') : ''}
          ${toggle('launchAtLogin', 'Buka Serambi saat komputer menyala', 'Serambi langsung berjalan di latar setelah kamu masuk ke komputer.')}
          ${toggle('preloadAccounts', 'Muat semua akun saat Serambi dibuka', 'Chat dan jumlah pesan baru langsung tampil. Matikan untuk menghemat memori.')}
        </div>
      </section>

      <section class="settings-group">
        <h2>Akun</h2>
        <p>Urutkan akun dengan menarik di panel kiri. ${mk}+1 sampai ${mk}+9 membuka akun sesuai urutannya.</p>
        <div class="set-list">
          ${accounts.length ? accounts.map((a, i) => `
            <div class="set-row">
              ${tile(a, '', true)}
              <div class="meta"><b>${esc(a.name)}</b><span>${esc(platformOf(a).name)}${i < 9 ? ` · ${mk}+${i + 1}` : ''}${a.muted ? ' · notifikasi mati' : ''}</span></div>
              <div class="acts">
                <button class="icon-btn" data-rename="${a.id}" title="Ganti nama">${icon('pencil', 16)}</button>
                <button class="icon-btn" data-mute="${a.id}" title="${a.muted ? 'Nyalakan notifikasi' : 'Matikan notifikasi'}">${icon(a.muted ? 'bell-off' : 'bell', 16)}</button>
                <button class="icon-btn" data-open="${a.id}" title="Buka">${icon('arrow-right', 16)}</button>
              </div>
            </div>`).join('') : `<div class="set-row"><div class="meta"><span>Belum ada akun.</span></div><button class="btn primary sm" data-add>${icon('plus', 15)}Tambah akun</button></div>`}
        </div>
      </section>

      <section class="settings-group" id="sec-telegram">
        <h2>Posting otomatis ke Telegram</h2>
        <p>Hubungkan bot Telegram supaya postingan ke channel atau grup terkirim sendiri tepat waktu, tanpa perlu ditempel.</p>
        <ol class="steps" style="margin-bottom:14px">
          <li>Buka chat dengan <b>@BotFather</b> di Telegram, kirim <code>/newbot</code>, lalu salin token yang diberikan.</li>
          <li>Tambahkan bot itu ke channel atau grupmu sebagai admin yang boleh mengirim pesan.</li>
          <li>Isi channel dengan <code>@namachannel</code> untuk channel publik, atau ID angka seperti <code>-1001234567890</code> untuk channel/grup privat.</li>
        </ol>
        <div class="set-list">
          ${tgs.length ? tgs.map(botForm).join('') : `<div class="set-row"><div class="meta"><span>Tambahkan akun Telegram dulu, lalu hubungkan bot di sini.</span></div><button class="btn sm" data-add-tg>${icon('plus', 15)}Tambah Telegram</button></div>`}
        </div>
        <p class="hint" style="margin-top:10px">Token disimpan terenkripsi di komputer ini dan hanya dipakai untuk menghubungi Telegram.</p>
      </section>

      <section class="settings-group" id="sec-templates">
        <h2>Templat</h2>
        <p>Teks yang sering dipakai, seperti tagar, alamat toko, atau penutup promo. Sisipkan dari tombol Templat saat menulis.</p>
        <div class="set-list">
          ${templates.length ? templates.map(t => `
            <div class="set-row">
              <div class="meta"><b>${esc(t.name)}</b><span>${esc(snippet(t.text, 90))}</span></div>
              <div class="acts">
                <button class="icon-btn" data-tpl-edit="${t.id}" title="Edit">${icon('pencil', 16)}</button>
                <button class="icon-btn" data-tpl-del="${t.id}" title="Hapus">${icon('trash-2', 16)}</button>
              </div>
            </div>`).join('') : ''}
          <div class="set-row"><div class="meta"><span>${templates.length ? '' : 'Belum ada templat.'}</span></div><button class="btn sm" data-tpl-new>${icon('plus', 15)}Templat baru</button></div>
        </div>
      </section>

      <section class="settings-group">
        <h2>Cadangan</h2>
        <p>Simpan daftar akun, postingan, dan templat ke satu berkas. Login dan token bot tidak ikut tersimpan.</p>
        <div style="display:flex;gap:8px">
          <button class="btn" data-export>${icon('download', 16)}Simpan cadangan</button>
          <button class="btn" data-import>${icon('upload', 16)}Pulihkan dari cadangan</button>
        </div>
      </section>

      <section class="settings-group">
        <h2>Pintasan keyboard</h2>
        <div class="set-list"><div class="shortcut-grid">
          <span>Tulis postingan</span><span class="kbd">${mk}+N</span>
          <span>Buka akun ke-1 sampai ke-9</span><span class="kbd">${mk}+1 … 9</span>
          <span>Akun berikutnya / sebelumnya</span><span class="kbd">Ctrl+Tab / Ctrl+Shift+Tab</span>
          <span>Beranda</span><span class="kbd">${mk}+Shift+H</span>
          <span>Jadwal</span><span class="kbd">${mk}+Shift+J</span>
          <span>Muat ulang akun</span><span class="kbd">${mk}+R</span>
          <span>Perbesar / perkecil / normal</span><span class="kbd">${mk}+= / ${mk}+− / ${mk}+0</span>
          <span>Pengaturan</span><span class="kbd">${mk}+,</span>
        </div></div>
      </section>

      <p class="hint">Serambi ${esc(S.version)}. Semua data tersimpan di komputer ini.</p>
    </div>`;
}

async function editTemplate(t) {
  const m = openModal({
    title: t ? 'Edit templat' : 'Templat baru',
    body: `
      <div class="field"><label for="tpl-name">Nama</label><input id="tpl-name" class="input" maxlength="60" value="${esc(t ? t.name : '')}" placeholder="Misalnya: Tagar promo"></div>
      <div class="field"><label for="tpl-text">Isi</label><textarea id="tpl-text" class="input" style="height:160px;padding:10px 12px;resize:vertical">${esc(t ? t.text : '')}</textarea></div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Simpan templat</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const name = m.el.querySelector('#tpl-name').value.trim();
    const text = m.el.querySelector('#tpl-text').value;
    if (!name || !text.trim()) { toast('Isi nama dan teks templat', { kind: 'err' }); return; }
    await api.saveTemplate({ id: t && t.id, name, text });
    m.close();
    toast('Templat disimpan');
  };
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const ds = b.dataset;
  if (ds.theme) return api.setSettings({ theme: ds.theme });
  if (ds.rename) {
    const a = account(ds.rename);
    const name = await promptDialog({ title: 'Ganti nama akun', label: 'Nama yang tampil di Serambi', value: a.name });
    if (name) api.updateAccount({ id: a.id, patch: { name } });
    return;
  }
  if (ds.mute) { const a = account(ds.mute); return api.updateAccount({ id: a.id, patch: { muted: !a.muted } }); }
  if (ds.open) return go({ name: 'account', id: ds.open });
  if ('add' in ds) return emit('add-account');
  if ('addTg' in ds) return emit('add-account', 'telegram');
  if (ds.botSave) {
    const form = b.closest('[data-bot]');
    const err = form.querySelector('[data-bot-err]');
    err.textContent = '';
    b.disabled = true; const label = b.textContent; b.textContent = 'Mengetes…';
    const res = await api.saveBot({ accountId: ds.botSave, token: form.querySelector('[data-token]').value, chatId: form.querySelector('[data-chat]').value });
    b.disabled = false; b.textContent = label;
    const fresh = root.querySelector(`[data-bot="${ds.botSave}"]`) || form;
    if (res.ok) {
      fresh.querySelector('[data-token]').value = '';
      toast(`Terhubung ke ${res.chatTitle || 'channel'} lewat ${res.botName}`);
    } else {
      fresh.querySelector('[data-bot-err]').textContent = res.error;
    }
    return;
  }
  if (ds.botRemove) {
    const ok = await confirmDialog({ title: 'Putuskan bot?', message: 'Postingan ke akun Telegram ini tidak lagi terkirim otomatis. Kamu akan diingatkan untuk menempelnya sendiri.', confirm: 'Putuskan' });
    if (ok) { await api.removeBot(ds.botRemove); toast('Bot diputuskan'); }
    return;
  }
  if (ds.tplNew !== undefined) return editTemplate(null);
  if (ds.tplEdit) return editTemplate(S.state.templates.find(t => t.id === ds.tplEdit));
  if (ds.tplDel) {
    const t = S.state.templates.find(x => x.id === ds.tplDel);
    const ok = await confirmDialog({ title: `Hapus templat “${t.name}”?`, message: 'Templat ini akan hilang dari daftar.', confirm: 'Hapus', danger: true });
    if (ok) api.removeTemplate(t.id);
    return;
  }
  if ('export' in ds) { const ok = await api.exportBackup(); if (ok) toast('Cadangan disimpan'); return; }
  if ('import' in ds) {
    const res = await api.importBackup();
    if (res.ok) toast(`Dipulihkan: ${res.accounts} akun dan ${res.posts} postingan. Masuk lagi ke tiap akun.`, { ms: 6000 });
    else if (res.error) toast(res.error, { kind: 'err' });
  }
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.setting) api.setSettings({ [t.dataset.setting]: t.checked });
}

export default {
  mount(el, tb, route) {
    root = el;
    tb.innerHTML = '<h1>Pengaturan</h1>';
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    render();
    scrollTo = route.section;
    if (scrollTo) setTimeout(() => root.querySelector('#sec-' + scrollTo)?.scrollIntoView({ block: 'start' }), 30);
  },
  update() {
    // keep typed-but-unsaved bot fields when the state refreshes
    const keep = {};
    root.querySelectorAll('[data-bot]').forEach(f => { keep[f.dataset.bot] = { token: f.querySelector('[data-token]').value, chat: f.querySelector('[data-chat]').value }; });
    const y = root.scrollTop;
    render();
    for (const [id, v] of Object.entries(keep)) {
      const f = root.querySelector(`[data-bot="${id}"]`);
      if (f) { f.querySelector('[data-token]').value = v.token; if (v.chat) f.querySelector('[data-chat]').value = v.chat; }
    }
    root.scrollTop = y;
  },
  unmount() {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
  }
};
