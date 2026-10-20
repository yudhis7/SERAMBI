// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// The three Serambi plans and their licence keys.
// SOLOPreneur is free. SMALPreneur and MediumPreneur are unlocked with a licence key that
// Yudhistira signs with his private key; Serambi checks the signature offline with the
// public key in config.js, so no licence server is needed.
//
// Key format:  SRB1.<payload, base64url JSON>.<Ed25519 signature of the payload text, base64url>
const crypto = require('crypto');
const cfg = require('./config');

const PLANS = {
  solo: {
    id: 'solo', name: 'SOLOPreneur', short: 'Solo', tagline: 'Untuk pemilik usaha yang mengurus semuanya sendiri',
    seatsMin: 1, seatsMax: 1, locations: 1, automations: 5,
    team: false, approval: false, viewerRole: false, accountAccess: false, branchReport: false
  },
  small: {
    id: 'small', name: 'SMALPreneur', short: 'Small', tagline: 'Untuk usaha dengan tim 5–10 orang',
    seatsMin: 5, seatsMax: 10, locations: 3, automations: 25,
    team: true, approval: true, viewerRole: false, accountAccess: false, branchReport: false
  },
  medium: {
    id: 'medium', name: 'MediumPreneur', short: 'Medium', tagline: 'Untuk usaha dengan tim 10–30 orang dan beberapa cabang',
    seatsMin: 10, seatsMax: 30, locations: 25, automations: 200,
    team: true, approval: true, viewerRole: true, accountAccess: true, branchReport: true
  }
};

const DAY = 86400000;
let PUBLIC_KEY = null;
function publicKey() {
  if (!PUBLIC_KEY) PUBLIC_KEY = crypto.createPublicKey(cfg.LICENSE_PUBLIC_KEY);
  return PUBLIC_KEY;
}

/** Reads and checks a licence key. Never throws. */
function parseLicense(key) {
  const text = String(key || '').replace(/\s+/g, '');
  const m = /^SRB1\.([A-Za-z0-9_-]{10,2000})\.([A-Za-z0-9_-]{40,200})$/.exec(text);
  if (!m) return { ok: false, error: 'Format kunci lisensi tidak dikenali. Kunci diawali “SRB1.”' };
  let valid = false;
  try { valid = crypto.verify(null, Buffer.from(m[1]), publicKey(), Buffer.from(m[2], 'base64url')); } catch (_) {}
  if (!valid) return { ok: false, error: 'Kunci lisensi tidak sah atau sudah diubah. Periksa lagi, atau hubungi pemilik Serambi.' };
  let p;
  try { p = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch (_) { return { ok: false, error: 'Isi kunci lisensi rusak.' }; }
  const plan = PLANS[p.plan];
  if (!plan || p.plan === 'solo') return { ok: false, error: 'Paket pada kunci lisensi tidak dikenal.' };
  const seats = Math.min(plan.seatsMax, Math.max(1, Number(p.seats) || plan.seatsMax));
  const lic = {
    key: text, id: String(p.id || ''), plan: p.plan, seats,
    name: String(p.name || ''), email: String(p.email || ''),
    issuedAt: Number(p.iat) || 0, expiresAt: p.exp ? Number(p.exp) : null
  };
  lic.expired = !!(lic.expiresAt && Date.now() > lic.expiresAt);
  return { ok: true, license: lic };
}

/** Signs a new licence key. Used by the owner's licence tool; the private key never leaves memory. */
function issueLicense(privatePem, { plan, seats, name, email, months }) {
  if (!PLANS[plan] || plan === 'solo') throw new Error('Pilih paket SMALPreneur atau MediumPreneur.');
  const key = crypto.createPrivateKey(privatePem);
  // Make sure the private key belongs to the public key built into this version of Serambi.
  const derived = crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString().trim();
  if (derived !== cfg.LICENSE_PUBLIC_KEY.trim()) throw new Error('Kunci privat ini bukan pasangan kunci publik Serambi. Lisensi yang dibuat dengannya tidak akan diterima.');
  const p = PLANS[plan];
  const now = Date.now();
  const payload = {
    v: 1, id: crypto.randomBytes(6).toString('hex'), plan,
    seats: Math.min(p.seatsMax, Math.max(1, Number(seats) || p.seatsMax)),
    name: String(name || '').trim().slice(0, 80), email: String(email || '').trim().slice(0, 120),
    iat: now, exp: Number(months) > 0 ? now + Math.round(Number(months) * 30.44 * DAY) : null
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.sign(null, Buffer.from(body), key).toString('base64url');
  return { key: `SRB1.${body}.${sig}`, payload };
}

/**
 * The plan in force for this device right now.
 * `license` and `trial` come from the workspace when the device belongs to a team, so every
 * member sees the plan the owner activated.
 */
function currentPlan({ license, trial }) {
  const now = Date.now();
  let lic = null;
  if (license) { const r = parseLicense(license); if (r.ok) lic = r.license; }
  if (lic && !lic.expired) {
    return { ...PLANS[lic.plan], source: 'license', seats: lic.seats, license: publicLicense(lic), expiresAt: lic.expiresAt };
  }
  const trialEnds = trial && trial.startedAt ? trial.startedAt + cfg.TRIAL_DAYS * DAY : 0;
  if (trialEnds && now < trialEnds) {
    return { ...PLANS.medium, source: 'trial', seats: PLANS.medium.seatsMax, trialEndsAt: trialEnds, daysLeft: Math.max(1, Math.ceil((trialEnds - now) / DAY)) };
  }
  return {
    ...PLANS.solo, source: 'free', seats: 1,
    lapsed: lic && lic.expired ? 'license' : trialEnds ? 'trial' : null,
    license: lic ? publicLicense(lic) : null,
    trialUsed: !!trialEnds
  };
}
function publicLicense(l) {
  return { id: l.id, plan: l.plan, planName: PLANS[l.plan].name, seats: l.seats, name: l.name, email: l.email, issuedAt: l.issuedAt, expiresAt: l.expiresAt, expired: l.expired };
}

module.exports = { PLANS, parseLicense, issueLicense, currentPlan };
