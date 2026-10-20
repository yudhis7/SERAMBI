// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Pengaturan — appearance, background behaviour, accounts, Telegram bots, templates, backup.
import { icon } from '../icons.js';
import { esc, toast, confirmDialog, promptDialog, openModal, snippet, fmtDateLong, fmtDate } from '../util.js';
import { S, api, go, emit, account, platformOf, tile, modKey, KIND_LABEL, kindOf, orderedAccounts, updateLine, perm, inTeam, planBadge } from '../ctx.js';
import { plansCompare } from './team.js';
import { restoreBackup } from './trust.js';

let root, scrollTo;

function toggle(key, label, desc) {
  const on = key === 'autoUpdate' ? S.state.settings[key] !== false : !!S.state.settings[key];
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

function updateSection() {
  const u = S.update || { status: 'unavailable', mode: 'none' };
  const busy = u.status === 'checking' || u.status === 'downloading';
  let action = `<button class="btn sm" data-upd-check ${busy || u.status === 'unavailable' ? 'disabled' : ''}>${icon('refresh-cw', 15)}Periksa sekarang</button>`;
  if (u.status === 'downloaded') action = `<button class="btn primary sm" data-upd-install>${icon('rotate-cw', 15)}Mulai ulang & perbarui</button>`;
  else if (u.status === 'available' && u.mode === 'manual') action = `<button class="btn primary sm" data-upd-download>${icon('download', 15)}Unduh versi ${esc(u.version)}</button>`;
  else if (u.status === 'available') action = `<button class="btn primary sm" data-upd-download>${icon('download', 15)}Unduh pembaruan</button>`;
  const when = u.checkedAt ? ` Terakhir diperiksa ${new Date(u.checkedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : '';
  return `
      <section class="settings-group" id="sec-update">
        <h2>Pembaruan</h2>
        <p>${u.mode === 'manual'
          ? 'Serambi memeriksa versi baru secara otomatis. Di Mac, unduh versi barunya lalu ganti aplikasi lama di folder Applications.'
          : 'Serambi memeriksa versi baru secara otomatis dan memasangnya saat aplikasi ditutup.'}</p>
        <div class="set-list">
          <div class="set-row">
            <span class="upd-icon ${u.status}">${icon(u.status === 'downloaded' || u.status === 'available' ? 'circle-arrow-down' : u.status === 'error' ? 'circle-alert' : 'circle-check-big', 20)}</span>
            <div class="meta"><b>Serambi ${esc(S.version)}</b><span data-upd-line>${esc(updateLine(u))}${u.status === 'latest' || u.status === 'error' ? esc(when) : ''}</span>
              ${u.status === 'downloading' ? `<span class="upd-bar"><span style="width:${u.progress || 0}%"></span></span>` : ''}</div>
            <div class="acts">${action}</div>
          </div>
          ${u.mode === 'auto' ? toggle('autoUpdate', 'Unduh dan pasang pembaruan otomatis', 'Kalau dimatikan, Serambi hanya memberi tahu dan kamu memilih kapan mengunduh.') : ''}
        </div>
      </section>`;
}

function planSection() {
  const pl = S.state.plan;
  const lic = pl.license;
  const owner = S.state.me.role === 'owner';
  const src = pl.source === 'license' ? `Lisensi untuk <b>${esc(lic.name || '—')}</b>${lic.email ? ` (${esc(lic.email)})` : ''} · ${lic.seats} pengguna · ${lic.expiresAt ? 'berlaku sampai ' + esc(fmtDateLong(lic.expiresAt)) : 'tanpa batas waktu'}`
    : pl.source === 'trial' ? `Uji coba MediumPreneur, <b>${pl.daysLeft} hari lagi</b> (sampai ${esc(fmtDateLong(pl.trialEndsAt))})`
    : pl.lapsed === 'license' ? 'Lisensi sudah habis. Kembali ke paket gratis.' : pl.lapsed === 'trial' ? 'Masa uji coba sudah berakhir.' : 'Gratis untuk satu pengguna, tanpa batas waktu.';
  return `
      <section class="settings-group" id="sec-plan">
        <h2>Paket & lisensi</h2>
        <p>${inTeam() && !owner ? 'Paket mengikuti ruang kerja tim yang diaktifkan pemilik.' : 'SOLOPreneur gratis. SMALPreneur dan MediumPreneur diaktifkan dengan kunci lisensi dari pemilik Serambi; diperiksa di komputer ini tanpa internet.'}</p>
        <div class="set-list">
          <div class="set-row"><span class="plan-ic ${pl.id}">${icon(pl.id === 'solo' ? 'user-round' : pl.id === 'small' ? 'users' : 'building-2', 20)}</span>
            <div class="meta"><b>${esc(pl.name)}</b><span>${src}</span></div>
            <div class="acts">
              ${(!inTeam() || owner) && pl.source === 'free' && !pl.trialUsed ? `<button class="btn sm" data-trial>${icon('rocket', 15)}Coba ${S.trialDays} hari</button>` : ''}
              ${(!inTeam() || owner) ? `<button class="btn primary sm" data-activate>${icon('key-round', 15)}${pl.source === 'license' ? 'Ganti lisensi' : 'Aktifkan lisensi'}</button>` : ''}
              ${(!inTeam() || owner) && lic ? `<button class="btn ghost sm" data-unlicense>Lepas</button>` : ''}
            </div></div>
          <div class="set-row"><div class="meta"><b>Ingin SMALPreneur atau MediumPreneur?</b><span>Hubungi pemilik Serambi untuk kunci lisensi sesuai jumlah anggota timmu.</span></div>
            <button class="btn sm" data-request-license>${icon('mail', 15)}Minta kunci lisensi</button></div>
        </div>
        <details class="plan-details"><summary>Bandingkan paket ${icon('chevron-down', 15)}</summary>${plansCompare()}</details>
      </section>`;
}

function render() {
  const { settings, accounts, templates } = S.state;
  const tgs = accounts.filter(a => a.platform === 'telegram');
  const mk = modKey();
  root.innerHTML = `
    <div class="page narrow" style="padding-top:12px">
      ${planSection()}
      <section class="settings-group">
        <h2>Profil</h2>
        <p>Namamu dipakai di log audit, komentar tim, dan tugas.</p>
        <div class="set-list"><div class="set-row"><div class="meta"><b>Nama pengguna</b><span>${inTeam() ? 'Di ruang kerja tim, nama diatur di menu Tim.' : 'Misalnya “Rina (pemilik)”.'}</span></div>
          <input class="input sm-input" data-username value="${esc(inTeam() ? S.state.me.name : (settings.userName || ''))}" maxlength="60" placeholder="Pemilik" ${inTeam() ? 'disabled' : ''} style="width:220px"></div></div>
      </section>
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
        <p>Urutkan akun dengan menarik di panel kiri. ${mk}+1 sampai ${mk}+9 membuka akun sesuai urutan di panel kiri.</p>
        <div class="set-list">
          ${accounts.length ? orderedAccounts().map((a, i) => `
            <div class="set-row">
              ${tile(a, '', true)}
              <div class="meta"><b>${esc(a.name)}</b><span>${esc(platformOf(a).name)}${i < 9 ? ` · ${mk}+${i + 1}` : ''}${a.muted ? ' · notifikasi mati' : ''}</span>
                ${kindOf(a) === 'shop' ? `<span class="shop-link">${a.shopUrl ? `${icon('link', 13, 'inline')}${esc(a.shopUrl)}` : 'Link toko belum diatur'}</span>` : ''}</div>
              <div class="acts">
                ${kindOf(a) === 'shop' ? `<button class="icon-btn" data-shop="${a.id}" title="${a.shopUrl ? 'Ubah link toko' : 'Atur link toko'}">${icon('link', 16)}</button>` : ''}
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

      ${updateSection()}

      <section class="settings-group" id="sec-backup">
        <h2>Cadangan</h2>
        <p>Simpan akun, postingan, templat, pelanggan, ulasan, dan catatan kepatuhan ke satu berkas. Login dan token bot tidak ikut. Karena berisi data pelanggan, gunakan cadangan terenkripsi.${settings.lastBackupAt ? ` Cadangan terenkripsi terakhir: ${esc(fmtDate(settings.lastBackupAt))}.` : ''}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" data-export-enc>${icon('file-lock', 16)}Cadangan terenkripsi</button>
          <button class="btn" data-export>${icon('download', 16)}Tanpa kata sandi</button>
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
          <span>Kunci Serambi</span><span class="kbd">${mk}+Shift+L</span>
        </div></div>
      </section>

      <div class="owner-foot">
        <span>${icon('copyright', 15)}</span>
        <div><b>${esc(S.owner.copyright)}</b>
          <span>Serambi ${esc(S.version)} · Pemilik dan pengembang: ${esc(S.owner.name)} · <button class="link" data-mail>${esc(S.owner.email)}</button> · <button class="link" data-about>Tentang Serambi</button></span>
          <span>${inTeam() ? 'Data tersimpan di komputer ini dan di folder tim (terenkripsi).' : 'Semua data tersimpan di komputer ini.'} <button class="link" data-trust>Pusat Kepercayaan</button></span></div>
      </div>
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
  if (ds.shop) return emit('edit-shop', ds.shop);
  if ('mail' in ds) return api.openMail();
  if ('about' in ds) return emit('about');
  if ('updCheck' in ds) return api.checkUpdate();
  if ('updDownload' in ds) return api.downloadUpdate();
  if ('updInstall' in ds) return api.installUpdate();
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
  if ('exportEnc' in ds) return go({ name: 'trust', tab: 'security' });
  if ('export' in ds) {
    if (S.state.customers.length) {
      const ok = await confirmDialog({ title: 'Simpan tanpa kata sandi?', message: `Cadangan berisi ${S.state.customers.length} data pelanggan. Tanpa kata sandi, siapa pun yang mendapat berkasnya bisa membaca data itu. Disarankan memakai cadangan terenkripsi.`, confirm: 'Tetap simpan' });
      if (!ok) return;
    }
    const r = await api.exportBackup({}); if (r && r.ok) toast('Cadangan disimpan'); return;
  }
  if ('import' in ds) return restoreBackup();
  if ('trust' in ds) return go({ name: 'trust' });
  if ('trial' in ds) { try { await api.startTrial(); toast(`Uji coba MediumPreneur ${S.trialDays} hari dimulai`); } catch (e) { toast(e.message, { kind: 'err' }); } return; }
  if ('activate' in ds) return activateDialog();
  if ('unlicense' in ds) { if (await confirmDialog({ title: 'Lepas lisensi?', message: 'Serambi kembali ke paket SOLOPreneur. Data tidak hilang; fitur tim menjadi hanya-lihat.', confirm: 'Lepas lisensi', danger: true })) { await api.removeLicense(); toast('Lisensi dilepas'); } return; }
  if ('requestLicense' in ds) return api.openMail('Permintaan kunci lisensi Serambi (SMALPreneur/MediumPreneur)');
}

function activateDialog() {
  const m = openModal({
    title: 'Aktifkan kunci lisensi',
    body: `<p>Tempel kunci lisensi yang kamu terima (diawali <code>SRB1.</code>). Kunci diperiksa di komputer ini, tanpa internet.</p>
      <div class="field"><textarea class="input textarea code-input" rows="4" data-key spellcheck="false" placeholder="SRB1.…"></textarea></div><p class="error-text" data-err></p>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Aktifkan</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const r = await api.activateLicense(m.el.querySelector('[data-key]').value);
    if (!r.ok) { m.el.querySelector('[data-err]').textContent = r.error; return; }
    m.close();
    toast(`${r.plan.name} aktif untuk ${r.plan.seats} pengguna${r.warning ? '. ' + r.warning : ''}`, { ms: 7000 });
  };
}

/** Owner-only tool (Bantuan → Terbitkan kunci lisensi): signs licence keys with the private key file. */
export function openLicenseIssuer() {
  const issued = S.state.settings.issuedLicenses || [];
  const m = openModal({
    title: 'Terbitkan kunci lisensi',
    wide: true,
    body: `
      <div class="warning info">${icon('key-round', 15)}<span>Khusus pemilik Serambi. Kunci ditandatangani dengan berkas kunci privat <code>serambi-penerbit-lisensi.pem</code>. Berkas itu hanya dibaca saat menerbitkan dan tidak disalin ke mana pun.</span></div>
      <div class="form-grid">
        <div class="field"><label>Paket</label><select class="input" data-f="plan"><option value="small">SMALPreneur (5–10 pengguna)</option><option value="medium">MediumPreneur (10–30 pengguna)</option></select></div>
        <div class="field"><label>Jumlah pengguna</label><input class="input" type="number" min="1" max="30" data-f="seats" value="10"></div>
        <div class="field"><label>Nama usaha/pelanggan</label><input class="input" data-f="name" maxlength="80"></div>
        <div class="field"><label>Email pelanggan</label><input class="input" type="email" data-f="email" maxlength="120"></div>
        <div class="field"><label>Masa berlaku</label><select class="input" data-f="months"><option value="1">1 bulan</option><option value="3">3 bulan</option><option value="6">6 bulan</option><option value="12" selected>12 bulan</option><option value="0">Tanpa batas waktu</option></select></div>
      </div>
      <div data-out></div>
      ${issued.length ? `<details class="consent-hist"><summary>Lisensi yang pernah diterbitkan (${issued.length}) ${icon('chevron-down', 14)}</summary><ul>${issued.slice(0, 50).map((l, i) => `<li>${esc(fmtDate(l.iat))} · ${esc(S.plans[l.plan] ? S.plans[l.plan].name : l.plan)} · ${l.seats} pengguna · ${esc(l.name)}${l.email ? ' · ' + esc(l.email) : ''} · ${l.exp ? 's.d. ' + esc(fmtDate(l.exp)) : 'tanpa batas'} <button class="link" data-copy-old="${i}">salin</button></li>`).join('')}</ul></details>` : ''}`,
    foot: `<button class="btn ghost" data-pick>Ganti berkas kunci…</button><span style="flex:1"></span><button class="btn ghost" data-no>Tutup</button><button class="btn primary" data-yes>${icon('badge-check', 15)}Terbitkan</button>`
  });
  const plan = m.el.querySelector('[data-f="plan"]'), seats = m.el.querySelector('[data-f="seats"]');
  plan.onchange = () => { const p = S.plans[plan.value]; seats.max = p.seatsMax; seats.min = 1; seats.value = p.seatsMax; };
  const issue = async (pickKey) => {
    const v = Object.fromEntries([...m.el.querySelectorAll('[data-f]')].map(i => [i.dataset.f, i.value]));
    if (!v.name.trim()) { toast('Isi nama pelanggan', { kind: 'err' }); return; }
    const r = await api.issueLicense({ plan: v.plan, seats: Number(v.seats), name: v.name, email: v.email, months: Number(v.months), pickKey });
    if (!r.ok) { if (r.error) toast(r.error, { kind: 'err', ms: 7000 }); return; }
    const mail = `mailto:${encodeURIComponent(v.email)}?subject=${encodeURIComponent('Kunci lisensi Serambi ' + S.plans[v.plan].name)}&body=${encodeURIComponent(`Halo ${v.name},

Berikut kunci lisensi Serambi ${S.plans[v.plan].name} untuk ${r.payload.seats} pengguna${r.payload.exp ? ', berlaku sampai ' + fmtDateLong(r.payload.exp) : ''}:

${r.key}

Cara mengaktifkan: buka Serambi → Pengaturan → Paket & lisensi → Aktifkan lisensi, lalu tempel kunci di atas.

Salam,
${S.owner.name}`)}`;
    m.el.querySelector('[data-out]').innerHTML = `<div class="field"><label>Kunci lisensi (${esc(r.keyFile)})</label><pre class="code selectable">${esc(r.key)}</pre>
      <div class="row-btns"><button class="btn sm" data-copy-key>${icon('copy', 14)}Salin kunci</button>${v.email ? `<button class="btn sm" data-mail-key>${icon('mail', 14)}Kirim lewat email</button>` : ''}</div></div>`;
    m.el.querySelector('[data-copy-key]').onclick = async () => { await api.copyText(r.key); toast('Kunci lisensi disalin'); };
    const mk = m.el.querySelector('[data-mail-key]'); if (mk) mk.onclick = () => api.openExternal(mail);
  };
  m.el.querySelector('[data-yes]').onclick = () => issue(false);
  m.el.querySelector('[data-pick]').onclick = () => issue(true);
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.addEventListener('click', async (e) => { const b = e.target.closest('[data-copy-old]'); if (b) { await api.copyText(issued[Number(b.dataset.copyOld)].key); toast('Kunci disalin'); } });
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.setting) api.setSettings({ [t.dataset.setting]: t.checked });
  if (t.matches('[data-username]')) { api.setSettings({ userName: t.value }); toast('Nama disimpan'); }
}

export default {
  mount(el, tb, route) {
    root = el;
    tb.innerHTML = '<h1>Pengaturan</h1>';
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    render();
    scrollTo = route.section;
    if (scrollTo === 'update' && S.update && S.update.status !== 'unavailable') api.checkUpdate();
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
  onUpdate() {
    const sec = root.querySelector('#sec-update');
    if (!sec) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = updateSection();
    sec.replaceWith(tmp.firstElementChild);
  },
  unmount() {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
  }
};
