// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Team workspace in a shared folder (Google Drive, OneDrive, Dropbox, or a network folder).
// There is no Serambi server: every device reads and writes small encrypted files in the
// folder and the folder's own sync service carries them to the other members.
//
//   serambi-workspace.json      header (no personal data): id, key version, owner id, recovery public key
//   keys/<deviceId>.json        the workspace key, sealed for one device (X25519)
//   keys/recovery.json          the workspace key, sealed for the owner's recovery code
//   invites/<id>.json           the workspace key, sealed for a one-time invite code
//   data/<collection>/<id>.srb  one record, AES-256-GCM encrypted with the workspace key
//   media/<file>.srb            photos and videos used in posts, encrypted
//   presence/<deviceId>.srb     "last seen" for the team page, encrypted
//
// Conflicts are resolved per record: the newest change wins. Deletions leave a small marker
// (tombstone) so they reach every device.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const S = require('./secure');
const { uid } = require('./store');

const HEADER = 'serambi-workspace.json';
const COLLS = ['accounts', 'posts', 'templates', 'locations', 'campaigns', 'customers', 'reviews', 'automations', 'tasks', 'comments', 'members', 'audit', 'incidents', 'dsr'];
const SINGLE = ['business', 'privacy', 'wsMeta'];
const ALL = [...COLLS, ...SINGLE];
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
const FILE_RE = /^([A-Za-z0-9_-]{1,100})\.srb$/;
const MEDIA_RE = /^([A-Za-z0-9_.-]{1,120})\.srb$/;
const MAGIC = Buffer.from('SRB1');
const MAX_MEDIA = 300 * 1024 * 1024;
const REMOVAL_GRACE_MS = 10 * 60 * 1000;

const exists = (p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } };
async function writeAtomic(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.' + crypto.randomBytes(3).toString('hex') + '.tmp';
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
}
const writeJson = (file, obj) => writeAtomic(file, JSON.stringify(obj, null, 1));
const readJson = async (file) => JSON.parse(await fsp.readFile(file, 'utf8'));
function contentHash(e) {
  const { updatedAt, updatedBy, ...rest } = e;
  return S.sha256(S.stableStringify(rest)).slice(0, 32);
}
function safeFolderName(name) {
  return ('Serambi - ' + String(name || 'Tim').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 80);
}

class Workspace {
  /**
   * store      the local Store
   * onChange   called after data from the team arrived (broadcast to the window)
   * canPush    () => boolean — false while the plan does not include team work (read-only)
   * audit      (entry) => void
   * notify     (title, body) => void
   */
  constructor({ store, onChange, canPush, audit, notify, appVersion }) {
    this.store = store;
    this.onChange = onChange;
    this.canPush = canPush;
    this.audit = audit;
    this.notify = notify;
    this.appVersion = appVersion;
    this.syncFile = path.join(store.dir, 'serambi-sync.json');
    this.sync = this._loadSync();
    this.keyCache = new Map();
    this.state = { status: 'off', error: '', lastSyncAt: 0, lastPushAt: 0 };
    this.presence = {};
    this.busy = false;
    this._pushTimer = null;
    this._interval = null;
    this._watcher = null;
    this._presenceAt = 0;
  }

  // ---------- local bookkeeping ----------
  _loadSync() {
    try { const s = JSON.parse(fs.readFileSync(this.syncFile, 'utf8')); return { known: s.known || {}, seen: s.seen || {}, media: s.media || {}, ws: s.ws || null }; }
    catch (_) { return { known: {}, seen: {}, media: {}, ws: null }; }
  }
  _saveSync() {
    try {
      const tmp = this.syncFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.sync));
      fs.renameSync(tmp, this.syncFile);
    } catch (_) {}
  }
  _resetSync() { this.sync = { known: {}, seen: {}, media: {}, ws: this.link ? this.link.id : null }; this._saveSync(); }

  get link() { return this.store.data.workspace; }
  get linked() { return !!(this.link && this.link.path); }
  p(...parts) { return path.join(this.link.path, ...parts); }
  me() { return this.link ? this.link.memberId : null; }

  device() {
    const d = this.store.data;
    if (!d.device || !d.device.id) {
      d.device = { id: uid(), name: os.hostname().replace(/\.local$/, '').slice(0, 60) || 'Komputer' };
      this.store.save();
    }
    return d.device;
  }

  // ---------- keys ----------
  key(kv) {
    if (this.keyCache.has(kv)) return this.keyCache.get(kv);
    const rec = this.link && this.link.keys && this.link.keys[kv];
    const b = rec ? S.unprotectLocal(rec) : null;
    if (!b) return null;
    const k = S.unb64(b);
    this.keyCache.set(kv, k);
    return k;
  }
  rememberKey(kv, keyBuf) {
    this.link.keys = this.link.keys || {};
    this.link.keys[kv] = S.protectLocal(S.b64(keyBuf));
    this.keyCache.set(kv, keyBuf);
  }
  devicePriv() { return S.unb64(S.unprotectLocal(this.link.devicePriv) || ''); }
  currentKv() { return this.link.kv || 1; }

  encrypt(aad, plain, kv = this.currentKv()) {
    const key = this.key(kv);
    if (!key) throw Object.assign(new Error('Kunci ruang kerja belum tersedia di perangkat ini.'), { code: 'NOKEY' });
    const head = Buffer.alloc(8); MAGIC.copy(head, 0); head.writeUInt32BE(kv, 4);
    return Buffer.concat([head, S.aesEncrypt(key, plain, aad)]);
  }
  decrypt(aad, buf) {
    if (buf.length < 36 || !buf.subarray(0, 4).equals(MAGIC)) throw Object.assign(new Error('Berkas bukan data Serambi'), { code: 'FORMAT' });
    const kv = buf.readUInt32BE(4);
    const key = this.key(kv);
    if (!key) throw Object.assign(new Error('Kunci versi ' + kv + ' belum diterima'), { code: 'NOKEY', kv });
    return S.aesDecrypt(key, buf.subarray(8), aad);
  }

  // ---------- folders ----------
  /** Accepts the workspace folder itself or the folder that contains it. */
  findWorkspaceDir(dir) {
    if (!dir) return null;
    if (exists(path.join(dir, HEADER))) return dir;
    try {
      for (const name of fs.readdirSync(dir)) {
        const sub = path.join(dir, name);
        if (exists(path.join(sub, HEADER))) return sub;
      }
    } catch (_) {}
    return null;
  }
  async readHeader(dir = this.link.path) {
    const h = await readJson(path.join(dir, HEADER));
    if (h.format !== 'serambi-workspace') throw new Error('Folder ini bukan ruang kerja Serambi.');
    return h;
  }

  // ---------- create / join / leave ----------
  async create({ parentDir, name, ownerName, ownerEmail }) {
    if (this.linked) throw new Error('Perangkat ini sudah tersambung ke ruang kerja tim.');
    if (!parentDir || !exists(parentDir)) throw new Error('Folder tidak ditemukan.');
    const dir = path.join(parentDir, safeFolderName(name));
    if (exists(path.join(dir, HEADER))) throw new Error('Di folder itu sudah ada ruang kerja Serambi. Pilih “Gabung ke tim” untuk memakainya.');
    for (const sub of ['data', 'keys', 'invites', 'media', 'presence']) await fsp.mkdir(path.join(dir, sub), { recursive: true });

    const device = this.device();
    const wsId = uid();
    const kv = 1;
    const dk = crypto.randomBytes(32);
    const dev = S.keyPair();
    const recovery = S.keyPair();
    const memberId = uid();
    const now = Date.now();

    const header = { format: 'serambi-workspace', v: 1, id: wsId, kv, owner: memberId, recoveryPub: S.b64(recovery.pub), createdAt: now, createdWith: this.appVersion };
    await writeJson(path.join(dir, HEADER), header);
    await writeJson(path.join(dir, 'keys', device.id + '.json'), { kv, member: memberId, ...S.seal(dev.pub, dk) });
    await writeJson(path.join(dir, 'keys', 'recovery.json'), { kv, ...S.seal(recovery.pub, dk) });
    await writeAtomic(path.join(dir, 'BACA-SAYA.txt'),
      'Folder ini adalah ruang kerja tim Serambi.\r\nIsinya terenkripsi. Jangan mengubah atau memindahkan berkas di dalamnya secara manual.\r\n' +
      'Bagikan folder ini hanya kepada anggota tim, lalu undang mereka dari menu Tim di Serambi.\r\n');

    const d = this.store.data;
    d.workspace = {
      path: dir, id: wsId, name: String(name).slice(0, 60), kv, memberId, deviceId: device.id,
      devicePub: S.b64(dev.pub), devicePriv: S.protectLocal(S.b64(dev.priv)), keys: {}, linkedAt: now
    };
    this.keyCache.clear();
    this.rememberKey(kv, dk);
    d.members = [{
      id: memberId, name: String(ownerName || 'Pemilik').slice(0, 60), email: String(ownerEmail || '').slice(0, 120),
      role: 'owner', status: 'active', accountIds: [], canSeeCustomers: true,
      devices: [{ id: device.id, name: device.name, pub: S.b64(dev.pub), addedAt: now }], joinedAt: now, invitedAt: now
    }];
    d.wsMeta = {
      ...d.wsMeta, id: 'main', name: String(name).slice(0, 60), automationDevice: device.id,
      license: d.wsMeta.license || d.settings.license || null, trial: d.wsMeta.trial || d.settings.trial || null,
      approvalRequired: d.wsMeta.approvalRequired !== false, createdAt: now
    };
    // Records written before the team existed belong to the owner.
    for (const p of d.posts) if (!p.createdBy) p.createdBy = memberId;
    this._resetSync();
    this.store.save(true);
    this.audit({ action: 'workspace.create', target: d.workspace.name, detail: dir });
    await this.push(true);
    this.start();
    return { dir, recoveryCode: S.groupCode(recovery.priv) };
  }

  async invite({ name, email, role, accountIds, canSeeCustomers }, inviterId) {
    if (!this.linked) throw new Error('Belum ada ruang kerja tim.');
    const inv = S.keyPair();
    const memberId = uid();
    const fileId = S.sha256(S.b64(inv.pub)).slice(0, 24);
    const kv = this.currentKv();
    const payload = { ws: this.link.id, member: memberId, kv, dk: S.b64(this.key(kv)) };
    await writeJson(this.p('invites', fileId + '.json'), { kv, ...S.seal(inv.pub, JSON.stringify(payload)) });
    const now = Date.now();
    this.store.data.members.push({
      id: memberId, name: String(name).slice(0, 60), email: String(email || '').slice(0, 120),
      role, status: 'invited', accountIds: Array.isArray(accountIds) ? accountIds : [], canSeeCustomers: !!canSeeCustomers,
      devices: [], invitePub: S.b64(inv.pub), inviteFile: fileId, invitedAt: now, invitedBy: inviterId
    });
    this.store.save();
    return { code: S.groupCode(inv.priv), memberId };
  }

  /** New invite code for someone who lost theirs (the old code stops working). */
  async reinvite(memberId) {
    const m = this.store.data.members.find(x => x.id === memberId);
    if (!m || m.status !== 'invited') throw new Error('Anggota ini tidak sedang menunggu undangan.');
    if (m.inviteFile) { try { await fsp.unlink(this.p('invites', m.inviteFile + '.json')); } catch (_) {} }
    const inv = S.keyPair();
    const fileId = S.sha256(S.b64(inv.pub)).slice(0, 24);
    const kv = this.currentKv();
    await writeJson(this.p('invites', fileId + '.json'), { kv, ...S.seal(inv.pub, JSON.stringify({ ws: this.link.id, member: m.id, kv, dk: S.b64(this.key(kv)) })) });
    m.invitePub = S.b64(inv.pub); m.inviteFile = fileId; m.invitedAt = Date.now();
    this.store.save();
    return { code: S.groupCode(inv.priv) };
  }

  async join({ dir, code, merge }) {
    if (this.linked) throw new Error('Perangkat ini sudah tersambung ke ruang kerja tim.');
    const wsDir = this.findWorkspaceDir(dir);
    if (!wsDir) throw new Error('Folder ruang kerja Serambi tidak ditemukan di sana. Pilih folder yang dibagikan pemilik tim (berisi berkas serambi-workspace.json).');
    const header = await this.readHeader(wsDir);
    const priv = S.unbase32(code);
    if (priv.length !== 32) throw new Error('Kode undangan tidak lengkap. Salin seluruh kodenya.');
    let pub;
    try { pub = S.pubFromPriv(priv); } catch (_) { throw new Error('Kode undangan tidak valid.'); }
    const fileId = S.sha256(S.b64(pub)).slice(0, 24);
    let memberId, dk, kv, viaRecovery = false;
    const invFile = path.join(wsDir, 'invites', fileId + '.json');
    if (exists(invFile)) {
      const sealed = await readJson(invFile);
      let payload;
      try { payload = JSON.parse(S.unseal(priv, sealed).toString('utf8')); } catch (_) { throw new Error('Kode undangan tidak cocok.'); }
      if (payload.ws !== header.id) throw new Error('Kode undangan ini untuk ruang kerja lain.');
      memberId = payload.member; dk = S.unb64(payload.dk); kv = payload.kv;
    } else {
      // The owner's recovery code works too (new computer, lost device).
      try {
        const rec = await readJson(path.join(wsDir, 'keys', 'recovery.json'));
        dk = S.unseal(priv, rec); kv = rec.kv; memberId = header.owner; viaRecovery = true;
      } catch (_) {
        throw new Error('Kode tidak dikenali. Kode undangan hanya bisa dipakai sekali; minta kode baru kepada admin tim.');
      }
    }
    if (kv !== header.kv) throw new Error('Kode undangan ini sudah tidak berlaku karena kunci tim diganti. Minta kode baru kepada admin tim.');

    const device = this.device();
    const dev = S.keyPair();
    await writeJson(path.join(wsDir, 'keys', device.id + '.json'), { kv, member: memberId, ...S.seal(dev.pub, dk) });
    try { await fsp.unlink(path.join(wsDir, 'keys', device.id + '.revoked')); } catch (_) {} // re-invited after removal
    if (!viaRecovery) { try { await fsp.unlink(invFile); } catch (_) {} }

    const d = this.store.data;
    if (!merge) {
      // Keep a copy of what was on this device before joining, then start from the team's data.
      try { fs.copyFileSync(this.store.file, this.store.file.replace(/\.json$/, '') + '.sebelum-gabung-' + Date.now() + '.json'); } catch (_) {}
      for (const c of COLLS) d[c] = [];
      d.business = { id: 'main' }; d.privacy = { id: 'main' }; d.wsMeta = { id: 'main' };
    }
    d.workspace = {
      path: wsDir, id: header.id, name: '', kv, memberId, deviceId: device.id,
      devicePub: S.b64(dev.pub), devicePriv: S.protectLocal(S.b64(dev.priv)), keys: {}, linkedAt: Date.now()
    };
    this.keyCache.clear();
    this.rememberKey(kv, dk);
    this._resetSync();
    this.store.save(true);
    await this.pull(true);
    const m = d.members.find(x => x.id === memberId);
    if (!m) throw new Error('Data anggota belum tersinkron. Tunggu folder selesai disinkronkan, lalu coba lagi.');
    m.status = 'active';
    m.joinedAt = m.joinedAt || Date.now();
    m.devices = (m.devices || []).filter(x => x.id !== device.id).concat([{ id: device.id, name: device.name, pub: S.b64(dev.pub), addedAt: Date.now() }]);
    delete m.invitePub; delete m.inviteFile;
    d.workspace.name = d.wsMeta.name || 'Tim';
    this.store.save(true);
    this.audit({ action: viaRecovery ? 'workspace.recover' : 'workspace.join', target: d.workspace.name, detail: device.name });
    await this.push(true);
    this.start();
    return { name: d.workspace.name, member: m };
  }

  /** Disconnect this device. Team data stays in the folder; this device keeps a local copy unless `wipe`. */
  leave({ wipe = false, reason = 'leave' } = {}) {
    this.stop();
    const d = this.store.data;
    const name = this.link ? this.link.name : '';
    if (reason === 'leave') this.audit({ action: 'workspace.leave', target: name });
    d.workspace = null;
    d.members = [];
    d.wsMeta = { id: 'main', approvalRequired: true, automationDevice: null, license: d.settings.license || null, trial: d.settings.trial || null };
    if (wipe) {
      for (const c of COLLS) if (c !== 'audit') d[c] = [];
      d.business = { id: 'main' }; d.privacy = { id: 'main' };
    }
    this.keyCache.clear();
    this._resetSync();
    try { fs.unlinkSync(this.syncFile); } catch (_) {}
    this.state = { status: 'off', error: '', lastSyncAt: 0, lastPushAt: 0 };
    this.store.save(true);
  }

  // ---------- members ----------
  async removeMember(memberId) {
    const d = this.store.data;
    const m = d.members.find(x => x.id === memberId);
    if (!m) return;
    if (m.role === 'owner') throw new Error('Pemilik ruang kerja tidak bisa dikeluarkan.');
    for (const dev of m.devices || []) {
      try { await fsp.unlink(this.p('keys', dev.id + '.json')); } catch (_) {}
      // A small marker (no secrets) tells that device it was removed, even though it can no
      // longer read the re-encrypted member list.
      try { await writeJson(this.p('keys', dev.id + '.revoked'), { revokedAt: Date.now() }); } catch (_) {}
    }
    if (m.inviteFile) { try { await fsp.unlink(this.p('invites', m.inviteFile + '.json')); } catch (_) {} }
    const wasActive = m.status === 'active';
    m.status = 'removed'; m.removedAt = Date.now();
    delete m.invitePub; delete m.inviteFile;
    m.devices = [];
    this.store.save(true);
    await this.push(true);
    // A removed member's device still knows the old key, so issue a new one to everyone else.
    if (wasActive) await this.rotate('member-removed');
  }

  /** New workspace key for all active devices; every file is re-encrypted with it. */
  async rotate(reason = 'manual') {
    if (!this.linked) return;
    await this._exclusive(async () => {
      const header = await this.readHeader();
      const oldKv = header.kv;
      const kv = oldKv + 1;
      const dk = crypto.randomBytes(32);
      const d = this.store.data;
      // 1) hand the new key to every active device, pending invite and the recovery code
      for (const m of d.members) {
        if (m.status === 'active') {
          for (const dev of m.devices || []) {
            await writeJson(this.p('keys', dev.id + '.json'), { kv, member: m.id, ...S.seal(S.unb64(dev.pub), dk) });
          }
        } else if (m.status === 'invited' && m.invitePub && m.inviteFile) {
          await writeJson(this.p('invites', m.inviteFile + '.json'), { kv, ...S.seal(S.unb64(m.invitePub), JSON.stringify({ ws: this.link.id, member: m.id, kv, dk: S.b64(dk) })) });
        }
      }
      await writeJson(this.p('keys', 'recovery.json'), { kv, ...S.seal(S.unb64(header.recoveryPub), dk) });
      // 2) remove key files of devices that are no longer part of the team
      const allowed = new Set(d.members.filter(m => m.status === 'active').flatMap(m => (m.devices || []).map(x => x.id + '.json')));
      allowed.add('recovery.json');
      for (const f of await fsp.readdir(this.p('keys')).catch(() => [])) {
        if (f.endsWith('.json') && !allowed.has(f)) { try { await fsp.unlink(this.p('keys', f)); } catch (_) {} }
      }
      this.rememberKey(kv, dk);
      // 3) re-encrypt everything with the new key
      const reenc = async (dir, aadOf) => {
        for (const f of await fsp.readdir(dir).catch(() => [])) {
          if (!f.endsWith('.srb')) continue;
          const file = path.join(dir, f);
          try {
            const plain = this.decrypt(aadOf(f), await fsp.readFile(file));
            await writeAtomic(file, this.encrypt(aadOf(f), plain, kv));
          } catch (_) { /* unreadable leftovers are skipped */ }
        }
      };
      for (const c of ALL) await reenc(this.p('data', c), (f) => `${c}/${f.slice(0, -4)}`);
      await reenc(this.p('media'), (f) => `media/${f.slice(0, -4)}`);
      await reenc(this.p('presence'), (f) => `presence/${f.slice(0, -4)}`);
      header.kv = kv; header.rotatedAt = Date.now();
      await writeJson(this.p(HEADER), header);
      this.link.kv = kv;
      this.sync.seen = {};
      this._saveSync();
      this.store.save(true);
    });
    this.audit({ action: 'workspace.rotate', detail: reason === 'member-removed' ? 'Setelah anggota dikeluarkan' : 'Diganti manual' });
  }

  // ---------- sync loop ----------
  start() {
    if (!this.linked) return;
    this.stop();
    if (this.sync.ws && this.sync.ws !== this.link.id) this._resetSync();
    this.state.status = 'ok';
    this._interval = setInterval(() => this.cycle(), 12000);
    try {
      this._watcher = fs.watch(this.link.path, { recursive: true }, () => {
        clearTimeout(this._watchTimer);
        this._watchTimer = setTimeout(() => this.cycle(), 1500);
      });
      this._watcher.on('error', () => {});
    } catch (_) { this._watcher = null; }
    setTimeout(() => this.cycle(), 1500);
  }
  stop() {
    clearInterval(this._interval); this._interval = null;
    clearTimeout(this._pushTimer);
    clearTimeout(this._watchTimer);
    if (this._watcher) { try { this._watcher.close(); } catch (_) {} this._watcher = null; }
  }
  pushSoon() {
    if (!this.linked) return;
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this.push(), 900);
  }

  async _exclusive(fn) {
    while (this.busy) await new Promise(r => setTimeout(r, 120));
    this.busy = true;
    try { return await fn(); } finally { this.busy = false; }
  }

  async cycle() {
    if (!this.linked) return;
    await this.push();
    await this.pull();
    if (Date.now() - this._presenceAt > 60000) this.writePresence().catch(() => {});
  }

  _all(coll) {
    const d = this.store.data;
    if (SINGLE.includes(coll)) return d[coll] ? [{ ...d[coll], id: 'main' }] : [];
    return d[coll] || [];
  }

  async push(force = false) {
    if (!this.linked) return;
    if (!force && !this.canPush()) { this.state.status = 'read-only'; return; }
    if (this.state.status === 'waiting-key') return;
    await this._exclusive(async () => {
      const me = this.me();
      const now = Date.now();
      let wrote = 0;
      try {
        for (const coll of ALL) {
          const known = this.sync.known[coll] || (this.sync.known[coll] = {});
          const ids = new Set();
          for (const e of this._all(coll)) {
            if (!e || !ID_RE.test(String(e.id))) continue;
            ids.add(e.id);
            const h = contentHash(e);
            const k = known[e.id];
            if (k && k.h === h) continue;
            const t = Math.max(now, (k && k.t || 0) + 1);
            const target = SINGLE.includes(coll) ? this.store.data[coll] : e;
            target.updatedAt = t; target.updatedBy = me;
            await this._writeEntity(coll, { ...e, updatedAt: t, updatedBy: me });
            known[e.id] = { h, t };
            wrote++;
          }
          for (const [id, k] of Object.entries(known)) {
            if (ids.has(id) || k.h === 'x') continue;
            await this._writeEntity(coll, { id, deleted: true, updatedAt: now, updatedBy: me });
            known[id] = { h: 'x', t: now };
            wrote++;
          }
        }
        wrote += await this._pushMedia();
        if (wrote) { this.state.lastPushAt = Date.now(); this._saveSync(); this.store.save(); }
        if (this.state.status !== 'read-only') this.state.error = '';
      } catch (e) {
        this.state.status = 'error';
        this.state.error = this._friendly(e);
      }
    });
  }

  async _writeEntity(coll, ent) {
    const name = ent.id + '.srb';
    const file = this.p('data', coll, name);
    await writeAtomic(file, this.encrypt(`${coll}/${ent.id}`, Buffer.from(JSON.stringify(ent))));
    try { const st = fs.statSync(file); this.sync.seen[`${coll}/${name}`] = `${st.mtimeMs}|${st.size}`; } catch (_) {}
  }

  async _pushMedia() {
    let n = 0;
    const files = new Set(this.store.data.posts.flatMap(p => (p.media || []).map(m => m.file)));
    for (const f of files) {
      if (this.sync.media[f] || !/^[A-Za-z0-9_.-]{1,120}$/.test(f)) continue;
      const local = path.join(this.store.mediaDir, f);
      const remote = this.p('media', f + '.srb');
      try {
        if (exists(remote)) { this.sync.media[f] = 1; continue; }
        const st = await fsp.stat(local);
        if (st.size > MAX_MEDIA) { this.sync.media[f] = 'too-big'; continue; }
        await writeAtomic(remote, this.encrypt(`media/${f}`, await fsp.readFile(local)));
        this.sync.media[f] = 1; n++;
      } catch (_) { /* local file missing: nothing to share */ }
    }
    return n;
  }

  async _pullMedia() {
    const files = new Set(this.store.data.posts.flatMap(p => (p.media || []).map(m => m.file)));
    for (const f of files) {
      if (!/^[A-Za-z0-9_.-]{1,120}$/.test(f)) continue;
      const local = path.join(this.store.mediaDir, f);
      if (exists(local)) continue;
      const remote = this.p('media', f + '.srb');
      if (!exists(remote)) continue;
      try { await fsp.writeFile(local, this.decrypt(`media/${f}`, await fsp.readFile(remote))); this.sync.media[f] = 1; } catch (_) {}
    }
  }

  async _ensureKey(header) {
    if (this.key(header.kv)) { this.link.kv = Math.max(this.link.kv || 1, header.kv); return true; }
    try {
      const rec = await readJson(this.p('keys', this.link.deviceId + '.json'));
      if (rec.kv === header.kv) {
        this.rememberKey(rec.kv, S.unseal(this.devicePriv(), rec));
        this.link.kv = rec.kv;
        this.store.save();
        return true;
      }
    } catch (_) {}
    return false;
  }

  async pull(force = false) {
    if (!this.linked) return;
    let changed = false;
    await this._exclusive(async () => {
      try {
        let header;
        try { header = await this.readHeader(); }
        catch (_) { this.state.status = 'error'; this.state.error = 'Folder ruang kerja tidak bisa dibuka. Pastikan Google Drive/OneDrive/Dropbox sedang berjalan dan folder masih dibagikan.'; return; }
        if (exists(this.p('keys', this.link.deviceId + '.revoked'))) { this._removedFromTeam(); return; }
        if (!(await this._ensureKey(header))) {
          const missing = !exists(this.p('keys', this.link.deviceId + '.json'));
          if (missing && this._myMemberRemoved()) { this._removedFromTeam(); return; }
          // Our key file is gone and a newer key exists: we were removed. Wait a little in case
          // the cloud folder is still syncing the new key files.
          if (missing) {
            this._missingSince = this._missingSince || Date.now();
            if (Date.now() - this._missingSince > REMOVAL_GRACE_MS) { this._removedFromTeam(); return; }
          } else this._missingSince = 0;
          this.state.status = 'waiting-key';
          this.state.error = 'Kunci tim baru saja diganti. Menunggu kunci untuk perangkat ini tersinkron…';
          return;
        }
        for (const coll of ALL) {
          const dir = this.p('data', coll);
          let names;
          try { names = await fsp.readdir(dir); } catch (_) { continue; }
          for (const name of names) {
            const m = FILE_RE.exec(name);
            if (!m) continue;
            const key = `${coll}/${name}`;
            let st;
            try { st = await fsp.stat(path.join(dir, name)); } catch (_) { continue; }
            const sig = `${st.mtimeMs}|${st.size}`;
            if (!force && this.sync.seen[key] === sig) continue;
            let ent;
            try { ent = JSON.parse(this.decrypt(`${coll}/${m[1]}`, await fsp.readFile(path.join(dir, name))).toString('utf8')); }
            catch (e) { if (e.code === 'NOKEY') continue; this.sync.seen[key] = sig; continue; }
            this.sync.seen[key] = sig;
            if (!ent || ent.id !== m[1]) continue;
            if (this._apply(coll, ent)) changed = true;
          }
        }
        await this._readPresence();
        await this._pullMedia();
        this._saveSync();
        this.state.status = this.canPush() ? 'ok' : 'read-only';
        this.state.error = this.canPush() ? '' : 'Paket tim tidak aktif. Data tim hanya bisa dilihat sampai lisensi diaktifkan.';
        this.state.lastSyncAt = Date.now();
        if (this.store.data.wsMeta.name && this.link.name !== this.store.data.wsMeta.name) this.link.name = this.store.data.wsMeta.name;
        if (this._myMemberRemoved()) { this._removedFromTeam(); changed = false; return; }
        if (changed) this.store.save();
      } catch (e) {
        this.state.status = 'error';
        this.state.error = this._friendly(e);
      }
    });
    if (changed) this.onChange();
  }

  /** Newest change wins. Returns true when local data changed. */
  _apply(coll, remote) {
    const known = this.sync.known[coll] || (this.sync.known[coll] = {});
    const d = this.store.data;
    const rt = Number(remote.updatedAt) || 0;
    if (SINGLE.includes(coll)) {
      if (remote.deleted) return false;
      const local = d[coll] || {};
      if ((Number(local.updatedAt) || 0) >= rt && known.main) return false;
      d[coll] = { ...remote, id: 'main' };
      known.main = { h: contentHash(d[coll]), t: rt };
      return true;
    }
    const list = d[coll];
    const i = list.findIndex(x => x.id === remote.id);
    const local = i >= 0 ? list[i] : null;
    if (remote.deleted) {
      known[remote.id] = { h: 'x', t: rt };
      if (local && (Number(local.updatedAt) || 0) <= rt) { list.splice(i, 1); return true; }
      return false;
    }
    if (local) {
      const lt = Number(local.updatedAt) || 0;
      if (lt > rt) return false;
      if (lt === rt && String(local.updatedBy || '') >= String(remote.updatedBy || '')) { known[remote.id] = { h: contentHash(local), t: lt }; return false; }
      list[i] = remote;
    } else {
      const k = known[remote.id];
      if (k && k.h === 'x' && k.t >= rt) return false; // deleted here after that version
      list.push(remote);
    }
    known[remote.id] = { h: contentHash(remote), t: rt };
    return true;
  }

  _myMemberRemoved() {
    const m = this.store.data.members.find(x => x.id === this.me());
    return !!(m && m.status === 'removed');
  }
  _removedFromTeam() {
    const name = this.link ? this.link.name : 'tim';
    this.leave({ wipe: true, reason: 'removed' });
    this.notify('Kamu tidak lagi di ruang kerja ' + name, 'Admin tim mengeluarkan perangkat ini. Data tim di komputer ini sudah dihapus.');
    this.onChange();
  }

  async writePresence() {
    if (!this.linked || !this.key(this.currentKv())) return;
    this._presenceAt = Date.now();
    const d = this.device();
    const body = { deviceId: d.id, memberId: this.me(), deviceName: d.name, os: process.platform, version: this.appVersion, at: Date.now() };
    await writeAtomic(this.p('presence', d.id + '.srb'), this.encrypt(`presence/${d.id}`, Buffer.from(JSON.stringify(body))));
  }
  async _readPresence() {
    let names;
    try { names = await fsp.readdir(this.p('presence')); } catch (_) { return; }
    for (const name of names) {
      const m = FILE_RE.exec(name);
      if (!m) continue;
      try { this.presence[m[1]] = JSON.parse(this.decrypt(`presence/${m[1]}`, await fsp.readFile(this.p('presence', name))).toString('utf8')); } catch (_) {}
    }
  }

  _friendly(e) {
    const code = e && e.code;
    if (code === 'ENOSPC') return 'Penyimpanan penuh. Kosongkan ruang di Google Drive/OneDrive/Dropbox.';
    if (code === 'EACCES' || code === 'EPERM') return 'Serambi tidak diizinkan menulis ke folder tim. Periksa izin berbagi folder.';
    if (code === 'ENOENT') return 'Folder ruang kerja tidak ditemukan. Mungkin dipindah atau belum tersinkron.';
    if (code === 'NOKEY') return 'Kunci tim belum tersedia di perangkat ini.';
    return (e && e.message) || 'Sinkronisasi gagal.';
  }

  status() {
    if (!this.linked) return { linked: false };
    const l = this.link;
    return {
      linked: true, name: l.name || this.store.data.wsMeta.name || 'Tim', path: l.path, memberId: l.memberId, deviceId: l.deviceId,
      kv: l.kv || 1, status: this.state.status, error: this.state.error, lastSyncAt: this.state.lastSyncAt,
      presence: this.presence
    };
  }
}

module.exports = { Workspace, COLLS, SINGLE };
