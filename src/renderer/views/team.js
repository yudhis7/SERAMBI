// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Tim — shared, encrypted workspace in a cloud folder, members and roles, approvals,
// automation device, and access reviews.
import { icon } from '../icons.js';
import { esc, toast, openModal, confirmDialog, promptDialog, readForm, fmtDate, fmtDateLong, timeAgo, showMenu } from '../util.js';
import { S, api, go, perm, roleLabel, tile, orderedAccounts, planBadge } from '../ctx.js';
import { textDocument } from '../lib/print.js';

let root, tb;

function plansCompare(compact = false) {
  const P = S.plans;
  const cur = S.state.plan.id;
  const row = (label, f) => `<tr><td>${label}</td>${['solo', 'small', 'medium'].map(id => `<td>${f(P[id])}</td>`).join('')}</tr>`;
  const yes = (v) => v ? `<span class="ok">${icon('check', 15)}</span>` : '<span class="faint">—</span>';
  return `
    <div class="plan-cards ${compact ? 'compact' : ''}">${['solo', 'small', 'medium'].map(id => {
      const p = P[id];
      return `<div class="plan-card ${id} ${cur === id ? 'current' : ''}">
        <span class="plan-ic">${icon(id === 'solo' ? 'user-round' : id === 'small' ? 'users' : 'building-2', 20)}</span>
        <b>${esc(p.name)}</b><span class="plan-tag">${esc(p.tagline)}</span>
        <span class="plan-seats">${id === 'solo' ? '1 pengguna' : `${p.seatsMin}–${p.seatsMax} pengguna`}</span>
        ${cur === id ? `<span class="chip scheduled">Paket saat ini${S.state.plan.source === 'trial' ? ' (uji coba)' : ''}</span>` : ''}
      </div>`;
    }).join('')}</div>
    ${compact ? '' : `<div class="panel table-wrap"><table class="table plan-table">
      <thead><tr><th></th><th>SOLOPreneur</th><th>SMALPreneur</th><th>MediumPreneur</th></tr></thead>
      <tbody>
        ${row('Pengguna', p => p.id === 'solo' ? '1' : `${p.seatsMin}–${p.seatsMax}`)}
        ${row('Akun media sosial & toko', () => 'Tanpa batas')}
        ${row('Lokasi/cabang', p => p.locations)}
        ${row('Otomatisasi aktif', p => p.automations >= 200 ? 'Tanpa batas' : p.automations)}
        ${row('Tumbuh lokal (SEO, iklan, ulasan)', () => yes(true))}
        ${row('Pusat Kepercayaan & alat UU PDP', () => yes(true))}
        ${row('Ruang kerja tim terenkripsi', p => yes(p.team))}
        ${row('Persetujuan postingan & komentar', p => yes(p.approval))}
        ${row('Peran Pengamat', p => yes(p.viewerRole))}
        ${row('Akses per akun', p => yes(p.accountAccess))}
      </tbody></table></div>
      <p class="hint">Alat kepatuhan pelindungan data pribadi tersedia di semua paket, termasuk yang gratis.</p>`}`;
}

function notLinked() {
  const pl = S.state.plan;
  return `
    <div class="page">
      <div class="team-hero">
        <div><h2>Kerja bareng tim, tanpa server</h2>
          <p>Serambi memakai folder bersama yang sudah kamu punya (Google Drive, OneDrive, Dropbox, atau folder jaringan kantor). Semua isinya dienkripsi di komputer sebelum disimpan, jadi penyedia penyimpanan pun tidak bisa membacanya.</p></div>
      </div>
      <div class="team-steps">
        <div>${icon('folder-sync', 20)}<b>1. Siapkan folder bersama</b><span>Buat folder di Google Drive/OneDrive/Dropbox yang tersinkron ke komputer.</span></div>
        <div>${icon('lock', 20)}<b>2. Buat ruang kerja</b><span>Serambi membuat ruang kerja terenkripsi dan kode pemulihan untuk pemilik.</span></div>
        <div>${icon('user-plus', 20)}<b>3. Undang anggota</b><span>Bagikan folder ke email anggota, lalu kirim kode undangan sekali pakai.</span></div>
      </div>
      <div class="team-choice">
        <div class="panel choice">
          ${icon('building-2', 22)}<b>Buat ruang kerja tim</b><p>Untuk pemilik usaha. Data di komputer ini menjadi data tim.</p>
          ${pl.team ? `<button class="btn primary" data-create>${icon('plus', 16)}Buat ruang kerja</button>`
            : `<p class="hint">Butuh paket SMALPreneur atau MediumPreneur.</p>
               <div class="row-btns">${!pl.trialUsed && pl.source === 'free' ? `<button class="btn primary" data-trial>${icon('rocket', 16)}Coba gratis ${S.trialDays} hari</button>` : ''}<button class="btn" data-license>${icon('key-round', 16)}Aktifkan lisensi</button></div>`}
        </div>
        <div class="panel choice">
          ${icon('log-in', 22)}<b>Gabung ke tim</b><p>Untuk anggota yang menerima kode undangan dari admin tim. Paket mengikuti ruang kerja tim.</p>
          <button class="btn" data-join>${icon('key-round', 16)}Masukkan kode undangan</button>
        </div>
      </div>
      <h3 class="sub-h">Pilih paket sesuai ukuran usaha</h3>
      ${plansCompare()}
    </div>`;
}

function syncLine(w) {
  if (w.status === 'error') return `<span class="sync err">${icon('circle-alert', 14)}${esc(w.error)}</span>`;
  if (w.status === 'waiting-key') return `<span class="sync warn">${icon('key-round', 14)}${esc(w.error)}</span>`;
  if (w.status === 'read-only') return `<span class="sync warn">${icon('eye', 14)}${esc(w.error || 'Hanya bisa dilihat')}</span>`;
  return `<span class="sync ok">${icon('refresh-ccw', 14)}Tersinkron ${w.lastSyncAt ? esc(timeAgo(w.lastSyncAt)) : 'sebentar lagi'}</span>`;
}

function linked() {
  const st = S.state;
  const w = st.workspace;
  const pl = st.plan;
  const manage = perm('team.manage');
  const members = st.members.filter(m => m.status !== 'removed').sort((a, b) => ({ owner: 0, admin: 1, editor: 2, viewer: 3 }[a.role] - { owner: 0, admin: 1, editor: 2, viewer: 3 }[b.role]));
  const removed = st.members.filter(m => m.status === 'removed');
  const presence = w.presence || {};
  const lastSeen = (m) => Math.max(0, ...(m.devices || []).map(d => (presence[d.id] || {}).at || 0));
  const devices = st.members.filter(m => m.status === 'active').flatMap(m => (m.devices || []).map(d => ({ ...d, member: m })));
  const used = members.length;
  const open = st.tasks.filter(t => t.status === 'open');
  return `
    <div class="page">
      <div class="panel ws-head">
        <span class="ws-ic">${icon('users', 22)}</span>
        <div class="meta"><b>${esc(w.name)}</b>${syncLine(w)}<span class="faint ws-path" title="${esc(w.path)}">${icon('folder-open', 13, 'inline')}${esc(w.path)}</span></div>
        <div class="ws-plan">${planBadge(pl.id)}<span class="faint">${used}/${pl.seats} kursi</span></div>
        <button class="btn sm" data-sync>${icon('refresh-cw', 15)}Sinkronkan</button>
        <button class="icon-btn" data-ws-more title="Pilihan ruang kerja">${icon('ellipsis', 18)}</button>
      </div>
      ${st.readOnly ? `<div class="warning">${icon('triangle-alert', 15)}<span>Paket tim tidak aktif (${pl.lapsed === 'trial' ? 'masa uji coba berakhir' : 'lisensi habis'}). Data tim tetap ada dan bisa dilihat, tetapi perubahan tidak disinkronkan sampai lisensi diaktifkan.</span>${st.me.role === 'owner' ? `<button class="btn sm" data-license>Aktifkan lisensi</button>` : ''}</div>` : ''}

      <section class="g-section">
        <div class="g-head"><div><h2>Anggota</h2><p>Peran menentukan apa yang bisa dilakukan tiap orang. Akses data pelanggan diberikan terpisah, hanya kepada yang memerlukan.</p></div>
          <div class="g-acts">${manage ? `<button class="btn primary sm" data-invite ${used >= pl.seats ? 'disabled' : ''}>${icon('user-plus', 15)}Undang anggota</button>` : ''}</div></div>
        <div class="panel table-wrap">
          <table class="table member-table">
            <thead><tr><th>Anggota</th><th>Peran</th><th>Data pelanggan</th>${pl.accountAccess ? '<th>Akses akun</th>' : ''}<th>Terakhir aktif</th><th></th></tr></thead>
            <tbody>${members.map(m => {
              const seen = lastSeen(m);
              const isMe = m.id === st.me.id;
              const editable = manage && m.role !== 'owner' && !isMe && !(m.role === 'admin' && st.me.role !== 'owner');
              return `<tr>
                <td><b>${esc(m.name)}${isMe ? ' <span class="faint">(kamu)</span>' : ''}</b><span class="sub">${esc(m.email || '')}</span></td>
                <td>${editable ? `<select class="input sm-input" data-role="${m.id}">${['admin', 'editor', ...(pl.viewerRole ? ['viewer'] : [])].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''} ${r === 'admin' && st.me.role !== 'owner' ? 'disabled' : ''}>${esc(roleLabel(r))}</option>`).join('')}</select>` : `<span class="chip ${m.role === 'owner' ? 'scheduled' : ''}">${esc(roleLabel(m.role))}</span>`}</td>
                <td>${m.role === 'owner' || m.role === 'admin' ? '<span class="faint">Ya (peran)</span>' : editable ? `<span class="switch"><input type="checkbox" data-cust-access="${m.id}" ${m.canSeeCustomers ? 'checked' : ''} ${m.role === 'viewer' ? 'disabled' : ''} aria-label="Boleh melihat data pelanggan"><span></span></span>` : (m.canSeeCustomers ? 'Ya' : 'Tidak')}</td>
                ${pl.accountAccess ? `<td>${m.role === 'owner' || m.role === 'admin' ? '<span class="faint">Semua</span>' : `<button class="btn ghost sm" data-acc-access="${m.id}" ${editable ? '' : 'disabled'}>${m.accountIds && m.accountIds.length ? `${m.accountIds.length} akun` : 'Semua akun'}</button>`}</td>` : ''}
                <td>${m.status === 'invited' ? `<span class="chip due">Menunggu bergabung</span>` : seen ? esc(timeAgo(seen)) : '—'}${(m.devices || []).length ? `<span class="sub">${(m.devices || []).map(d => esc(d.name)).join(', ')}</span>` : ''}</td>
                <td class="acts">${editable || (manage && m.status === 'invited') ? `<button class="icon-btn sm" data-member-more="${m.id}" title="Pilihan">${icon('ellipsis', 16)}</button>` : ''}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
        ${removed.length ? `<p class="hint">${removed.length} anggota sudah dikeluarkan; kunci tim sudah diganti sehingga mereka tidak bisa membaca data baru.</p>` : ''}
      </section>

      <section class="g-section">
        <div class="g-head"><div><h2>Aturan kerja</h2></div></div>
        <div class="panel set-list">
          <label class="set-row" style="cursor:${manage ? 'pointer' : 'default'}">
            <div class="meta"><b>Postingan Editor perlu disetujui</b><span>Postingan dari Editor masuk “Menunggu persetujuan” sampai Admin atau Pemilik menyetujuinya.</span></div>
            <span class="switch"><input type="checkbox" data-approval ${st.wsMeta.approvalRequired !== false ? 'checked' : ''} ${manage ? '' : 'disabled'}><span></span></span>
          </label>
          <div class="set-row">
            <div class="meta"><b>Komputer yang menjalankan otomatisasi</b><span>Satu komputer saja supaya tugas dan draf tidak dibuat dobel. Pilih yang paling sering menyala.</span></div>
            <select class="input sm-input" data-auto-device ${manage ? '' : 'disabled'}>${devices.map(d => `<option value="${d.id}" ${st.wsMeta.automationDevice === d.id ? 'selected' : ''}>${esc(d.name)} · ${esc(d.member.name)}</option>`).join('')}</select>
          </div>
          <div class="set-row">
            <div class="meta"><b>Tinjau akses data pelanggan</b><span>Periksa siapa saja yang boleh melihat data pelanggan, minimal tiap 6 bulan. ${st.wsMeta.accessReviewedAt ? 'Terakhir ditinjau ' + esc(fmtDateLong(st.wsMeta.accessReviewedAt)) + '.' : 'Belum pernah ditinjau.'}</span></div>
            ${manage ? `<button class="btn sm" data-reviewed>${icon('clipboard-check', 15)}Sudah saya tinjau</button>` : ''}
          </div>
        </div>
      </section>

      <section class="g-section">
        <div class="g-head"><div><h2>Tugas tim</h2><p>Tugas dari otomatisasi, contoh penggunaan, dan yang dibuat anggota.</p></div><div class="g-acts"><button class="btn sm" data-new-task>${icon('plus', 15)}Tugas baru</button></div></div>
        <div class="task-board">${members.filter(m => m.status === 'active' && m.role !== 'viewer').map(m => {
          const mine = open.filter(t => t.assigneeId === m.id);
          return `<div class="panel task-col"><b>${esc(m.name)}</b><span class="faint">${mine.length} terbuka</span>
            <ul class="mini-list">${mine.slice(0, 6).map(t => `<li>${icon('square', 13, 'inline')}${esc(t.title)}</li>`).join('') || '<li class="faint">Tidak ada</li>'}</ul></div>`;
        }).join('')}</div>
      </section>

      <div class="ws-security">${icon('shield-check', 18)}<div><b>Keamanan ruang kerja</b><span>Semua data di folder dienkripsi AES-256-GCM dengan kunci tim versi ${w.kv}. Tiap komputer menerima kunci lewat enkripsi kunci publik (X25519). Saat anggota dikeluarkan, kunci diganti otomatis dan semua berkas dienkripsi ulang. Konflik diselesaikan per data: perubahan terbaru yang dipakai.</span></div></div>
    </div>`;
}

function render() {
  const w = S.state.workspace;
  tb.innerHTML = `<h1>Tim</h1>${w && w.linked ? `<span class="faint" style="margin-left:6px">${esc(w.name)}</span>` : ''}<span class="grow"></span>`;
  root.innerHTML = w && w.linked ? linked() : notLinked();
}

// ---------- flows ----------
function createFlow() {
  const m = openModal({
    title: 'Buat ruang kerja tim',
    body: `
      <div class="field"><label>Nama ruang kerja</label><input class="input" data-f="name" value="${esc(S.state.business.name || '')}" maxlength="60" placeholder="Misalnya: Kopi Senja" autofocus></div>
      <div class="form-grid">
        <div class="field"><label>Namamu</label><input class="input" data-f="ownerName" value="${esc(S.state.settings.userName || '')}" maxlength="60"></div>
        <div class="field"><label>Email</label><input class="input" data-f="ownerEmail" type="email" maxlength="120"></div>
      </div>
      <p class="hint">Setelah ini pilih folder bersama yang tersinkron, misalnya <code>Google Drive/Serambi</code>. Serambi membuat subfolder “Serambi - ${esc(S.state.business.name || 'Nama')}” di dalamnya.</p>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>${icon('folder-open', 16)}Pilih folder & buat</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    if (!v.name.trim() || !v.ownerName.trim()) { toast('Isi nama ruang kerja dan namamu', { kind: 'err' }); return; }
    try {
      const r = await api.createTeam(v);
      if (!r.ok) return;
      m.close();
      showRecovery(r.recoveryCode, r.dir);
    } catch (e) { toast(e.message, { kind: 'err', ms: 7000 }); }
  };
}

function showRecovery(code, dir) {
  const m = openModal({
    title: 'Simpan kode pemulihan',
    body: `
      <p>Ruang kerja tim sudah dibuat di <b>${esc(dir)}</b>.</p>
      <div class="warning">${icon('key-round', 15)}<span>Kode ini satu-satunya cara memulihkan akses pemilik bila komputermu hilang atau rusak. Serambi tidak menyimpannya dan tidak bisa membuatnya ulang. Simpan di tempat aman (dicetak, atau di pengelola kata sandi). Jangan dibagikan.</span></div>
      <pre class="code big selectable">${esc(code)}</pre>
      <label class="check-inline"><input type="checkbox" data-ok-check> Saya sudah menyimpan kode pemulihan</label>`,
    foot: `<button class="btn ghost" data-copy>${icon('copy', 15)}Salin</button><button class="btn ghost" data-pdf>${icon('printer', 15)}Simpan PDF</button><span style="flex:1"></span><button class="btn primary" data-done disabled>Selesai</button>`
  });
  m.el.querySelector('[data-ok-check]').onchange = (e) => { m.el.querySelector('[data-done]').disabled = !e.target.checked; };
  m.el.querySelector('[data-copy]').onclick = async () => { await api.copyText(code); toast('Kode pemulihan disalin'); };
  m.el.querySelector('[data-pdf]').onclick = () => api.savePdf({ fileName: 'kode-pemulihan-serambi.pdf', html: textDocument({ biz: S.state.business, title: 'Kode pemulihan ruang kerja Serambi', note: `Ruang kerja: ${S.state.workspace.name} · Dibuat ${fmtDateLong(Date.now())}. Simpan di tempat aman. Siapa pun yang memegang kode ini dan folder tim bisa membuka data tim.`, text: code + '\n\nCara memakai: di komputer baru, buka Serambi → Tim → Gabung ke tim → masukkan kode ini → pilih folder ruang kerja.' }) });
  m.el.querySelector('[data-done]').onclick = () => { m.close(); toast('Ruang kerja siap. Undang anggota timmu.'); };
}

function joinFlow() {
  const m = openModal({
    title: 'Gabung ke tim',
    body: `
      <ol class="steps"><li>Pastikan folder ruang kerja yang dibagikan sudah muncul dan tersinkron di komputer ini.</li><li>Tempel kode undangan dari admin tim (atau kode pemulihan pemilik).</li><li>Pilih folder ruang kerjanya.</li></ol>
      <div class="field"><label>Kode undangan</label><textarea class="input textarea code-input" rows="2" data-code placeholder="ABCD-EFGH-…" spellcheck="false"></textarea></div>
      <label class="check-inline"><input type="checkbox" data-merge> Gabungkan data yang sudah ada di komputer ini ke ruang kerja tim</label>
      <p class="hint">Bila tidak dicentang, Serambi menyimpan salinan data lama di komputer ini lalu memakai data tim.</p>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>${icon('folder-open', 16)}Pilih folder & gabung</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const code = m.el.querySelector('[data-code]').value.trim();
    if (code.replace(/[^A-Za-z2-7]/g, '').length < 50) { toast('Kode undangan belum lengkap', { kind: 'err' }); return; }
    const btn = m.el.querySelector('[data-yes]'); btn.disabled = true;
    try {
      const r = await api.joinTeam({ code, merge: m.el.querySelector('[data-merge]').checked });
      btn.disabled = false;
      if (!r.ok) return;
      m.close();
      toast(`Kamu bergabung ke ${r.name} sebagai ${roleLabel(r.member.role)}`, { ms: 6000 });
    } catch (e) { btn.disabled = false; toast(e.message, { kind: 'err', ms: 8000 }); }
  };
}

function inviteFlow() {
  const pl = S.state.plan;
  const m = openModal({
    title: 'Undang anggota',
    wide: true,
    body: `
      <div class="form-grid">
        <div class="field"><label>Nama</label><input class="input" data-f="name" maxlength="60" autofocus></div>
        <div class="field"><label>Email (yang dipakai untuk folder bersama)</label><input class="input" type="email" data-f="email" maxlength="120"></div>
        <div class="field full"><label>Peran</label>
          <div class="role-pick">${['editor', 'admin', 'viewer'].map(r => {
            const dis = (r === 'viewer' && !pl.viewerRole) || (r === 'admin' && S.state.me.role !== 'owner');
            return `<label class="role-opt ${dis ? 'dis' : ''}"><input type="radio" name="role" value="${r}" ${r === 'editor' ? 'checked' : ''} ${dis ? 'disabled' : ''}><b>${esc(roleLabel(r))}</b><span>${esc(S.roles[r].desc)}${r === 'viewer' && !pl.viewerRole ? ' (MediumPreneur)' : ''}</span></label>`;
          }).join('')}</div></div>
        <label class="check-inline full"><input type="checkbox" data-f="canSeeCustomers"> Boleh melihat dan mengubah data pelanggan (nama, nomor WhatsApp)</label>
      </div>
      <p class="hint">Setelah undangan dibuat, bagikan folder ruang kerja ke email anggota lewat Google Drive/OneDrive/Dropbox, lalu kirim kode undangannya lewat pesan pribadi.</p>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Buat kode undangan</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    v.role = (m.el.querySelector('input[name="role"]:checked') || {}).value || 'editor';
    try {
      const r = await api.inviteMember(v);
      m.close();
      showInviteCode(v.name, r.code);
    } catch (e) { toast(e.message, { kind: 'err', ms: 7000 }); }
  };
}

function showInviteCode(name, code) {
  const w = S.state.workspace;
  const msg = `Halo ${name}, kamu diundang ke ruang kerja Serambi “${w.name}”.\n\n1. Pasang Serambi: https://github.com/yudhis7/serambi/releases/latest\n2. Pastikan folder “${w.path.split(/[\\/]/).pop()}” yang saya bagikan sudah tersinkron di komputermu.\n3. Buka Serambi → Tim → Gabung ke tim, lalu masukkan kode ini:\n\n${code}\n\nKode hanya bisa dipakai sekali. Jangan bagikan ke orang lain.`;
  const m = openModal({
    title: `Kode undangan untuk ${name}`,
    body: `<p>Kode ini hanya muncul sekali dan hanya bisa dipakai sekali. Kirim lewat pesan pribadi, bukan grup.</p>
      <pre class="code big selectable">${esc(code)}</pre>
      <details class="msg-panel panel"><summary>${icon('message-square', 15)}Pesan siap kirim ${icon('chevron-down', 15)}</summary><pre class="code selectable">${esc(msg)}</pre></details>`,
    foot: `<button class="btn ghost" data-copy-code>${icon('copy', 15)}Salin kode</button><button class="btn" data-copy-msg>${icon('copy', 15)}Salin pesan</button><span style="flex:1"></span><button class="btn primary" data-ok>Selesai</button>`
  });
  m.el.querySelector('[data-copy-code]').onclick = async () => { await api.copyText(code); toast('Kode disalin'); };
  m.el.querySelector('[data-copy-msg]').onclick = async () => { await api.copyText(msg); toast('Pesan undangan disalin'); };
  m.el.querySelector('[data-ok]').onclick = () => m.close();
}

function accountAccess(member) {
  const sel = new Set(member.accountIds || []);
  const m = openModal({
    title: `Akses akun · ${member.name}`,
    body: `<p>Pilih akun yang boleh dibuka dan diposting oleh ${esc(member.name)}. Kosongkan semua untuk memberi akses ke semua akun.</p>
      <div class="pick-list">${orderedAccounts().map(a => `<label class="pick-row"><input type="checkbox" value="${a.id}" ${sel.has(a.id) ? 'checked' : ''}>${tile(a)}<div class="meta"><b>${esc(a.name)}</b><span>${esc((S.platforms[a.platform] || {}).name || '')}</span></div></label>`).join('')}</div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Simpan</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const ids = [...m.el.querySelectorAll('input:checked')].map(i => i.value);
    try { await api.updateMember({ id: member.id, patch: { accountIds: ids } }); m.close(); toast('Akses akun disimpan'); }
    catch (e) { toast(e.message, { kind: 'err' }); }
  };
}

function memberMenu(anchor, mem) {
  showMenu(anchor, [
    { heading: mem.name },
    ...(mem.status === 'invited' ? [{ label: 'Buat kode undangan baru', icon: 'key-round', onClick: async () => { try { const r = await api.reinviteMember(mem.id); showInviteCode(mem.name, r.code); } catch (e) { toast(e.message, { kind: 'err' }); } } }] : []),
    { label: 'Ganti nama', icon: 'pencil', onClick: async () => { const n = await promptDialog({ title: 'Ganti nama anggota', label: 'Nama', value: mem.name }); if (n) api.updateMember({ id: mem.id, patch: { name: n } }); } },
    'sep',
    { label: mem.status === 'invited' ? 'Batalkan undangan' : 'Keluarkan dari tim', icon: 'user-x', danger: true, onClick: async () => {
      const ok = await confirmDialog({ title: `${mem.status === 'invited' ? 'Batalkan undangan' : 'Keluarkan'} ${mem.name}?`, message: mem.status === 'invited' ? 'Kode undangannya tidak bisa dipakai lagi.' : 'Kunci tim akan diganti dan semua berkas dienkripsi ulang, jadi komputernya tidak bisa membaca data baru. Hapus juga aksesnya ke folder bersama di Google Drive/OneDrive/Dropbox.', confirm: mem.status === 'invited' ? 'Batalkan undangan' : 'Keluarkan', danger: true });
      if (!ok) return;
      try { await api.removeMember(mem.id); toast(mem.status === 'invited' ? 'Undangan dibatalkan' : `${mem.name} dikeluarkan dan kunci tim diganti`); } catch (e) { toast(e.message, { kind: 'err' }); }
    } }
  ]);
}

function wsMenu(anchor) {
  const manage = perm('team.manage');
  showMenu(anchor, [
    { label: 'Buka folder ruang kerja', icon: 'folder-open', onClick: () => api.openTeamFolder() },
    ...(manage ? [
      { label: 'Ganti nama ruang kerja', icon: 'pencil', onClick: async () => { const n = await promptDialog({ title: 'Nama ruang kerja', label: 'Nama', value: S.state.workspace.name }); if (n) api.teamSettings({ name: n }); } },
      { label: 'Ganti kunci tim sekarang', icon: 'key-round', onClick: async () => { if (await confirmDialog({ title: 'Ganti kunci tim?', message: 'Semua berkas di folder dienkripsi ulang dengan kunci baru. Lakukan bila curiga kode undangan atau komputer anggota bocor.', confirm: 'Ganti kunci' })) { try { await api.rotateTeamKey(); toast('Kunci tim diganti'); } catch (e) { toast(e.message, { kind: 'err' }); } } } }
    ] : []),
    'sep',
    { label: 'Keluar dari ruang kerja di komputer ini', icon: 'log-out', danger: true, onClick: leaveFlow }
  ]);
}

async function leaveFlow() {
  const m = openModal({
    title: 'Keluar dari ruang kerja?',
    body: `<p>Komputer ini berhenti tersinkron dengan tim. Data di folder tim tidak terhapus.</p>
      <label class="check-inline"><input type="checkbox" data-wipe checked> Hapus data tim dari komputer ini (disarankan bila komputer ini bukan milikmu)</label>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn danger" data-yes>Keluar</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => { await api.leaveTeam({ wipe: m.el.querySelector('[data-wipe]').checked }); m.close(); toast('Komputer ini keluar dari ruang kerja'); };
}

function newTask() {
  const people = S.state.members.filter(m => m.status === 'active' && m.role !== 'viewer');
  const m = openModal({
    title: 'Tugas baru',
    body: `<div class="field"><label>Tugas</label><input class="input" data-f="title" maxlength="160" autofocus></div>
      <div class="form-grid"><div class="field"><label>Untuk</label><select class="input" data-f="assigneeId">${people.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Tenggat</label><input class="input" type="date" data-f="due"></div></div>
      <div class="field"><label>Catatan</label><textarea class="input textarea" rows="2" data-f="detail" maxlength="1000"></textarea></div>`,
    foot: `<button class="btn ghost" data-no>Batal</button><button class="btn primary" data-yes>Simpan</button>`
  });
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    const v = readForm(m.el);
    if (!v.title.trim()) return;
    await api.saveTask({ title: v.title, detail: v.detail, assigneeId: v.assigneeId, dueAt: v.due ? new Date(v.due + 'T17:00:00').getTime() : null });
    m.close(); toast('Tugas dibuat');
  };
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const ds = b.dataset;
  const mem = (id) => S.state.members.find(x => x.id === id);
  try {
    if ('create' in ds) return createFlow();
    if ('join' in ds) return joinFlow();
    if ('trial' in ds) { await api.startTrial(); return toast(`Uji coba MediumPreneur ${S.trialDays} hari dimulai`); }
    if ('license' in ds) return go({ name: 'settings', section: 'plan' });
    if ('invite' in ds) return inviteFlow();
    if ('sync' in ds) { b.disabled = true; await api.syncTeam(); b.disabled = false; return toast('Sinkronisasi selesai'); }
    if ('wsMore' in ds) return wsMenu(b);
    if (ds.memberMore) return memberMenu(b, mem(ds.memberMore));
    if (ds.accAccess) return accountAccess(mem(ds.accAccess));
    if ('reviewed' in ds) { await api.teamSettings({ accessReviewedAt: true }); return toast('Peninjauan akses dicatat di log audit'); }
    if ('newTask' in ds) return newTask();
  } catch (err) { b.disabled = false; toast(err.message, { kind: 'err', ms: 6000 }); }
}
async function onChange(e) {
  const t = e.target;
  try {
    if (t.dataset.role) await api.updateMember({ id: t.dataset.role, patch: { role: t.value } });
    if (t.dataset.custAccess) await api.updateMember({ id: t.dataset.custAccess, patch: { canSeeCustomers: t.checked } });
    if (t.matches('[data-approval]')) await api.teamSettings({ approvalRequired: t.checked });
    if (t.matches('[data-auto-device]')) await api.teamSettings({ automationDevice: t.value });
  } catch (err) { toast(err.message, { kind: 'err', ms: 6000 }); render(); }
}

export { plansCompare };
export default {
  mount(el, titlebar) { root = el; tb = titlebar; root.addEventListener('click', onClick); root.addEventListener('change', onChange); render(); },
  update() { const y = root.scrollTop; render(); root.scrollTop = y; },
  unmount() { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); }
};
