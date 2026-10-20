// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Cryptography helpers. Everything here uses Node's built-in crypto module:
// - AES-256-GCM for data files (authenticated encryption)
// - scrypt for PINs and password-protected backups
// - X25519 + HKDF "sealed boxes" so a workspace key can be handed to one device only
// - the operating system's keychain (Electron safeStorage) for secrets kept on this computer
const crypto = require('crypto');
const { safeStorage } = require('electron');

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

// ---------- encoding ----------
const b64 = (buf) => Buffer.from(buf).toString('base64');
const unb64 = (s) => Buffer.from(String(s || ''), 'base64');
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s || ''), 'base64url');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
/** 32 random bytes shown as groups of four letters/digits, easy to read aloud or print. */
function groupCode(buf) { return base32(buf).match(/.{1,4}/g).join('-'); }

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- symmetric ----------
/** iv(12) | tag(16) | ciphertext. `aad` binds the ciphertext to its purpose (for example the file it lives in). */
function aesEncrypt(key, plain, aad) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}
function aesDecrypt(key, blob, aad) {
  const iv = blob.subarray(0, 12), tag = blob.subarray(12, 28), ct = blob.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

function scryptKey(secret, salt) {
  return crypto.scryptSync(String(secret).normalize('NFKC'), salt, 32, SCRYPT);
}
function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  return { salt: b64(salt), hash: b64(scryptKey(secret, salt)) };
}
function checkSecret(secret, rec) {
  if (!rec || !rec.salt || !rec.hash) return false;
  const a = scryptKey(secret, unb64(rec.salt));
  const b = unb64(rec.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Password-protected envelope (backups). */
function encryptWithPassword(password, plain) {
  const salt = crypto.randomBytes(16);
  const key = scryptKey(password, salt);
  return { format: 'serambi-encrypted', v: 1, kdf: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt: b64(salt), data: b64(aesEncrypt(key, Buffer.from(plain), 'serambi-backup')) };
}
function decryptWithPassword(password, env) {
  const key = scryptKey(password, unb64(env.salt));
  return aesDecrypt(key, unb64(env.data), 'serambi-backup').toString('utf8');
}

// ---------- X25519 sealed boxes ----------
const PKCS8_X25519 = Buffer.from('302e020100300506032b656e04220420', 'hex');
const SPKI_X25519 = Buffer.from('302a300506032b656e032100', 'hex');
const privKey = (raw) => crypto.createPrivateKey({ key: Buffer.concat([PKCS8_X25519, raw]), format: 'der', type: 'pkcs8' });
const pubKey = (raw) => crypto.createPublicKey({ key: Buffer.concat([SPKI_X25519, raw]), format: 'der', type: 'spki' });
function keyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'der' }).subarray(SPKI_X25519.length),
    priv: privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(PKCS8_X25519.length)
  };
}
function pubFromPriv(priv) {
  return crypto.createPublicKey(privKey(priv)).export({ type: 'spki', format: 'der' }).subarray(SPKI_X25519.length);
}
function boxKey(shared, epk, rpk) {
  return Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.concat([epk, rpk]), 'serambi-seal-v1', 32));
}
/** Encrypt `plain` so only the holder of the private key for `recipientPub` can read it. */
function seal(recipientPub, plain) {
  const rpk = Buffer.from(recipientPub);
  const eph = keyPair();
  const shared = crypto.diffieHellman({ privateKey: privKey(eph.priv), publicKey: pubKey(rpk) });
  return { epk: b64(eph.pub), box: b64(aesEncrypt(boxKey(shared, eph.pub, rpk), Buffer.from(plain), 'serambi-seal')) };
}
function unseal(priv, sealed) {
  const epk = unb64(sealed.epk);
  const rpk = pubFromPriv(priv);
  const shared = crypto.diffieHellman({ privateKey: privKey(priv), publicKey: pubKey(epk) });
  return aesDecrypt(boxKey(shared, epk, rpk), unb64(sealed.box), 'serambi-seal');
}

// ---------- this computer's keychain ----------
/** True when the OS keychain really protects secrets (Windows DPAPI, macOS Keychain, Linux Secret Service). */
function osEncryption() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return { strong: false, backend: 'none' };
    if (process.platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function') {
      const backend = safeStorage.getSelectedStorageBackend();
      const weak = backend === 'basic_text' || backend === 'unknown';
      return { strong: !weak || !!process.env.SERAMBI_FORCE_ENC, backend };
    }
    return { strong: true, backend: process.platform === 'darwin' ? 'keychain' : process.platform === 'win32' ? 'dpapi' : 'os' };
  } catch (_) { return { strong: false, backend: 'none' }; }
}
function protectLocal(str) {
  if (osEncryption().strong) return { os: b64(safeStorage.encryptString(String(str))) };
  return { plain: String(str) };
}
function unprotectLocal(rec) {
  if (!rec) return null;
  if (rec.os) { try { return safeStorage.decryptString(unb64(rec.os)); } catch (_) { return null; } }
  return rec.plain ?? null;
}

module.exports = {
  b64, unb64, b64u, unb64u, base32, unbase32, groupCode, stableStringify, sha256,
  aesEncrypt, aesDecrypt, scryptKey, hashSecret, checkSecret, encryptWithPassword, decryptWithPassword,
  keyPair, pubFromPriv, seal, unseal, osEncryption, protectLocal, unprotectLocal
};
