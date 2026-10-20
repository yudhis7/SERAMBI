// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Handlers for the data behind local growth, customers, tasks, automations and the Trust Center.
// Every input from the window is cleaned here before it is stored.
const privacy = require('./privacy');

const CONSENT_PURPOSES = {
  whatsapp: { label: 'Pesan promo & info lewat WhatsApp', short: 'Promo WhatsApp' },
  review: { label: 'Diminta memberi ulasan setelah berkunjung', short: 'Permintaan ulasan' },
  birthday: { label: 'Ucapan ulang tahun (menyimpan tanggal lahir)', short: 'Ulang tahun' }
};
const CONSENT_METHODS = ['lisan', 'tertulis', 'formulir', 'pesan', 'qr', 'impor'];
const AUTOMATION_TYPES = ['weekly_post', 'moment_prep', 'birthday', 'review_request', 'review_reply', 'winback', 'gbp_weekly', 'weekly_report', 'retention_check'];
const REVIEW_SOURCES = ['google', 'tokopedia', 'shopee', 'facebook', 'instagram', 'tiktok', 'gofood', 'grabfood', 'other'];
const CHANNELS = ['google', 'meta', 'tiktok', 'marketplace', 'offline', 'other'];
const DAY = 86400000;

const str = (v, max = 200) => String(v ?? '').slice(0, max);
const num = (v, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
const strs = (v, max = 30, len = 80) => (Array.isArray(v) ? v : String(v || '').split(/[,\n]/)).map(x => String(x).trim()).filter(Boolean).slice(0, max).map(x => x.slice(0, len));
const optUrl = (v) => { const s = String(v || '').trim(); if (!s) return ''; return (/^https?:\/\//i.test(s) ? s : 'https://' + s).slice(0, 2000); };
function normPhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  d = d.replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d.slice(0, 16);
}
const ID = (v) => /^[A-Za-z0-9_-]{1,100}$/.test(String(v || '')) ? String(v) : null;
const shortId = (id) => '#' + String(id).slice(0, 6);

function registerDataIpc(ctx) {
  const { h, store, me, guard, plan, audit, broadcast, uid, automationTick } = ctx;
  const D = () => store.data;
  const done = (ret) => { store.save(); broadcast(); return ret; };
  const find = (coll, id) => D()[coll].find(x => x.id === id);
  const stamp = (obj, existing) => {
    const now = Date.now();
    if (!existing) { obj.createdAt = now; obj.createdBy = me().id; }
    return obj;
  };

  // ---------- business profile ----------
  h('business:save', (p) => {
    guard('growth.write');
    const b = D().business;
    const fields = { name: 80, category: 80, description: 750, phone: 30, whatsapp: 30, email: 120, city: 60, area: 120, hours: 300, priceRange: 30 };
    for (const [k, max] of Object.entries(fields)) if (k in p) b[k] = str(p[k], max).trim();
    if ('website' in p) b.website = optUrl(p.website);
    if ('services' in p) b.services = strs(p.services, 30, 60);
    if ('keywords' in p) b.keywords = strs(p.keywords, 40, 60);
    if ('areas' in p) b.areas = strs(p.areas, 20, 60);
    if ('whatsapp' in p) b.whatsapp = normPhone(p.whatsapp);
    return done(b);
  });

  // ---------- locations ----------
  h('locations:save', (p) => {
    guard('growth.write');
    const list = D().locations;
    const existing = p.id && find('locations', p.id);
    if (!existing && list.length >= plan().locations) {
      throw new Error(`Paket ${plan().name} mencakup ${plan().locations} lokasi. Naikkan paket untuk menambah cabang.`);
    }
    const l = existing || stamp({ id: uid(), gbp: {}, listings: {}, seo: null }, null);
    const fields = { name: 80, address: 300, city: 60, phone: 30, hours: 300, placeId: 200 };
    for (const [k, max] of Object.entries(fields)) if (k in p) l[k] = str(p[k], max).trim();
    if ('mapsUrl' in p) l.mapsUrl = optUrl(p.mapsUrl);
    if ('reviewUrl' in p) l.reviewUrl = optUrl(p.reviewUrl);
    if (p.gbp && typeof p.gbp === 'object') {
      l.gbp = l.gbp || {};
      for (const [k, v] of Object.entries(p.gbp)) if (/^[a-z_]{1,30}$/.test(k)) l.gbp[k] = !!v;
    }
    if (p.listings && typeof p.listings === 'object') {
      l.listings = l.listings || {};
      for (const [k, v] of Object.entries(p.listings)) {
        if (!/^[a-z]{1,20}$/.test(k) || !v) continue;
        l.listings[k] = { name: str(v.name, 120), address: str(v.address, 300), phone: str(v.phone, 40), hours: str(v.hours, 200) };
      }
    }
    if ('seo' in p) {
      const s = p.seo;
      l.seo = s ? { url: str(s.url, 500), score: num(s.score), checkedAt: Date.now(), issues: (s.issues || []).slice(0, 40).map(i => ({ id: str(i.id, 30), ok: !!i.ok, label: str(i.label, 160), level: str(i.level, 10) })) } : null;
    }
    if (!existing) list.push(l);
    return done(l);
  });
  h('locations:remove', (id) => {
    guard('growth.write');
    D().locations = D().locations.filter(x => x.id !== id);
    return done(true);
  });

  // ---------- campaigns (ads) ----------
  h('campaigns:save', (p) => {
    guard('growth.write');
    const existing = p.id && find('campaigns', p.id);
    const c = existing || stamp({ id: uid(), status: 'plan' }, null);
    if ('name' in p) c.name = str(p.name, 100).trim() || 'Kampanye';
    if ('channel' in p) c.channel = CHANNELS.includes(p.channel) ? p.channel : 'other';
    if ('objective' in p) c.objective = str(p.objective, 30);
    if ('status' in p) c.status = ['plan', 'live', 'done'].includes(p.status) ? p.status : 'plan';
    if ('locationId' in p) c.locationId = ID(p.locationId);
    for (const k of ['startAt', 'endAt']) if (k in p) c[k] = p[k] ? num(p[k]) : null;
    for (const k of ['budget', 'spend', 'impressions', 'clicks', 'leads', 'sales', 'revenue', 'radiusKm', 'cpc', 'convRate', 'aov', 'margin']) if (k in p) c[k] = Math.max(0, num(p[k]));
    if ('url' in p) c.url = optUrl(p.url);
    if ('notes' in p) c.notes = str(p.notes, 2000);
    if (p.utm) c.utm = { source: str(p.utm.source, 60), medium: str(p.utm.medium, 60), campaign: str(p.utm.campaign, 80), content: str(p.utm.content, 80) };
    if (p.ads) {
      const a = p.ads;
      c.ads = {
        headlines: strs(a.headlines, 15, 60), descriptions: strs(a.descriptions, 4, 180), paths: strs(a.paths, 2, 30),
        keywords: strs(a.keywords, 80, 80), negatives: strs(a.negatives, 80, 80),
        meta: a.meta ? { primary: str(a.meta.primary, 600), headline: str(a.meta.headline, 120), description: str(a.meta.description, 120) } : (c.ads && c.ads.meta) || null
      };
    }
    if (!existing) D().campaigns.push(c);
    return done(c);
  });
  h('campaigns:remove', (id) => { guard('growth.write'); D().campaigns = D().campaigns.filter(x => x.id !== id); return done(true); });

  // ---------- reviews ----------
  h('reviews:save', (p) => {
    guard('reviews.write');
    const existing = p.id && find('reviews', p.id);
    const r = existing || stamp({ id: uid() }, null);
    if ('locationId' in p) r.locationId = ID(p.locationId);
    if ('source' in p) r.source = REVIEW_SOURCES.includes(p.source) ? p.source : 'other';
    if ('rating' in p) r.rating = Math.min(5, Math.max(1, Math.round(num(p.rating, 5))));
    if ('author' in p) r.author = str(p.author, 80).trim();
    if ('text' in p) r.text = str(p.text, 4000);
    if ('date' in p) r.date = num(p.date, Date.now());
    if ('reply' in p) {
      const reply = str(p.reply, 4000).trim();
      if (reply && reply !== r.reply) { r.repliedAt = Date.now(); r.repliedBy = me().id; }
      if (!reply) { r.repliedAt = null; }
      r.reply = reply;
    }
    if ('replyPosted' in p) r.replyPosted = !!p.replyPosted;
    if (!r.date) r.date = Date.now();
    if (!existing) D().reviews.push(r);
    return done(r);
  });
  h('reviews:remove', (id) => { guard('reviews.write'); D().reviews = D().reviews.filter(x => x.id !== id); return done(true); });

  // ---------- customers (personal data) ----------
  function cleanCustomer(input, existing) {
    const c = existing || stamp({ id: uid(), consents: [], visits: 0, source: str(input.source || 'manual', 20) }, null);
    if ('name' in input) c.name = str(input.name, 80).trim() || 'Pelanggan';
    if ('phone' in input) c.phone = normPhone(input.phone);
    if ('email' in input) c.email = str(input.email, 120).trim().toLowerCase();
    if ('birthday' in input) c.birthday = /^\d{4}-\d{2}-\d{2}$/.test(String(input.birthday || '')) ? input.birthday : '';
    if ('locationId' in input) c.locationId = ID(input.locationId);
    if ('tags' in input) c.tags = strs(input.tags, 12, 30);
    if ('notes' in input) c.notes = str(input.notes, 1000);
    if ('lastVisitAt' in input) {
      c.lastVisitAt = input.lastVisitAt ? num(input.lastVisitAt) : null;
      if (!existing && c.lastVisitAt && !c.visits) c.visits = 1;
    }
    if ('restricted' in input) { c.restricted = !!input.restricted; c.restrictedReason = str(input.restrictedReason, 200); }
    if ('reviewAskedAt' in input) c.reviewAskedAt = input.reviewAskedAt ? num(input.reviewAskedAt) : null;
    return c;
  }
  function addConsent(c, { purpose, status, method, evidence }) {
    if (!CONSENT_PURPOSES[purpose]) return;
    const m = me();
    const notice = D().privacy.notice;
    c.consents = c.consents || [];
    c.consents.push({
      id: uid(), purpose, status: status === 'withdrawn' ? 'withdrawn' : 'granted', at: Date.now(),
      method: CONSENT_METHODS.includes(method) ? method : 'lisan', evidence: str(evidence, 300),
      noticeVersion: notice && notice.version ? notice.version : null, by: m.id, byName: m.name
    });
    if (purpose === 'birthday' && status === 'withdrawn') c.birthday = ''; // the date is only kept with consent
  }
  h('customers:save', (input) => {
    guard('customers.write');
    const existing = input.id && find('customers', input.id);
    const c = cleanCustomer(input, existing);
    if (!existing) {
      for (const k of input.consents || []) addConsent(c, k);
      D().customers.push(c);
      audit({ action: 'customer.create', target: shortId(c.id) });
    } else {
      audit({ action: 'customer.update', target: shortId(c.id) });
    }
    return done(c);
  });
  h('customers:visit', ({ id, at }) => {
    guard('customers.write');
    const c = find('customers', id); if (!c) return null;
    c.lastVisitAt = num(at, Date.now()) || Date.now();
    c.visits = (c.visits || 0) + 1;
    return done(c);
  });
  h('customers:consent', ({ id, purpose, status, method, evidence }) => {
    guard('customers.write');
    const c = find('customers', id); if (!c) return null;
    addConsent(c, { purpose, status, method, evidence });
    audit({ action: status === 'withdrawn' ? 'consent.withdraw' : 'consent.grant', target: shortId(c.id), detail: (CONSENT_PURPOSES[purpose] || {}).short || purpose });
    return done(c);
  });
  /** Right to erasure: the record is deleted; the audit log keeps only a pseudonymous id. */
  h('customers:erase', ({ id, reason }) => {
    guard('customers.write');
    const c = find('customers', id); if (!c) return false;
    D().customers = D().customers.filter(x => x.id !== id);
    for (const t of D().tasks) if (t.customerId === id && t.status === 'open') { t.status = 'done'; t.doneAt = Date.now(); t.action = null; t.title = 'Tugas dibatalkan (data pelanggan dihapus)'; }
    for (const r of D().dsr) if (r.customerId === id) { r.customerId = null; }
    audit({ action: 'customer.erase', target: shortId(id), detail: str(reason, 120) });
    return done(true);
  });
  h('customers:import', ({ rows, attest }) => {
    guard('customers.write');
    if (!attest || !attest.confirmed) throw new Error('Konfirmasi dulu bahwa data ini dikumpulkan secara sah dan persetujuan yang ditandai memang diberikan pelanggan.');
    const list = D().customers;
    const byPhone = new Map(list.filter(c => c.phone).map(c => [c.phone, c]));
    let added = 0, updated = 0;
    for (const row of (rows || []).slice(0, 5000)) {
      const phone = normPhone(row.phone);
      if (!row.name && !phone) continue;
      let c = phone && byPhone.get(phone);
      const isNew = !c;
      c = cleanCustomer({ name: row.name, phone: row.phone, email: row.email, birthday: row.birthday, tags: row.tags, lastVisitAt: row.lastVisitAt, notes: row.notes, source: 'impor' }, c || null);
      for (const p of Object.keys(CONSENT_PURPOSES)) if (row['consent_' + p]) addConsent(c, { purpose: p, status: 'granted', method: 'impor', evidence: attest.evidence });
      if (isNew) { list.push(c); if (phone) byPhone.set(phone, c); added++; } else updated++;
    }
    audit({ action: 'customer.import', detail: `${added} baru, ${updated} diperbarui` });
    return done({ added, updated });
  });
  /** Everything Serambi holds about one customer (right of access / portability). */
  h('customers:dossier', (id) => {
    guard('customers.view');
    const c = find('customers', id); if (!c) return null;
    audit({ action: 'customer.export', target: shortId(id), detail: 'Salinan data untuk pelanggan' });
    store.save();
    return {
      exportedAt: new Date().toISOString(), controller: D().business.name || '',
      customer: c,
      tasks: D().tasks.filter(t => t.customerId === id).map(t => ({ title: t.title, status: t.status, createdAt: t.createdAt, doneAt: t.doneAt })),
      requests: D().dsr.filter(r => r.customerId === id).map(r => ({ type: r.type, receivedAt: r.receivedAt, status: r.status, closedAt: r.closedAt }))
    };
  });
  h('customers:audit-export', ({ count }) => {
    guard('customers.view');
    audit({ action: 'customer.export', detail: `${num(count)} pelanggan diekspor ke berkas` });
    store.save();
  });

  // ---------- tasks & comments ----------
  h('tasks:save', (p) => {
    guard('tasks.write');
    const existing = p.id && find('tasks', p.id);
    const t = existing || stamp({ id: uid(), status: 'open', source: 'manual' }, null);
    if ('title' in p) t.title = str(p.title, 160).trim() || 'Tugas';
    if ('detail' in p) t.detail = str(p.detail, 1000);
    if ('dueAt' in p) t.dueAt = p.dueAt ? num(p.dueAt) : null;
    if ('assigneeId' in p) t.assigneeId = ID(p.assigneeId);
    if (p.link && typeof p.link === 'object') t.link = { route: str(p.link.route, 20), tab: str(p.link.tab, 20), postId: ID(p.link.postId) };
    if (!existing) D().tasks.push(t);
    return done(t);
  });
  h('tasks:done', ({ id, done: isDone }) => {
    guard('tasks.write');
    const t = find('tasks', id); if (!t) return null;
    t.status = isDone ? 'done' : 'open';
    t.doneAt = isDone ? Date.now() : null;
    t.doneBy = isDone ? me().id : null;
    return done(t);
  });
  h('tasks:remove', (id) => { guard('tasks.write'); D().tasks = D().tasks.filter(x => x.id !== id); return done(true); });
  h('tasks:clear-done', () => { guard('tasks.write'); D().tasks = D().tasks.filter(x => x.status !== 'done'); return done(true); });

  h('comments:add', ({ postId, text }) => {
    guard('post.write');
    const t = str(text, 2000).trim();
    if (!t || !find('posts', postId)) return null;
    const m = me();
    const c = { id: uid(), postId, memberId: m.id, memberName: m.name, text: t, createdAt: Date.now() };
    D().comments.push(c);
    return done(c);
  });
  h('comments:remove', (id) => {
    const c = find('comments', id);
    if (!c) return false;
    if (c.memberId !== me().id) guard('team.manage'); else guard('post.write');
    D().comments = D().comments.filter(x => x.id !== id);
    return done(true);
  });

  // ---------- automations ----------
  h('automations:save', (p) => {
    guard('automations.manage');
    const list = D().automations;
    const existing = p.id && find('automations', p.id);
    if (!existing && !AUTOMATION_TYPES.includes(p.type)) throw new Error('Jenis otomatisasi tidak dikenal.');
    const a = existing || stamp({ id: uid(), type: p.type, enabled: true, config: {}, keys: [] }, null);
    if ('name' in p) a.name = str(p.name, 80).trim() || a.type;
    if (p.config && typeof p.config === 'object') {
      const c = p.config;
      a.config = {
        ...a.config,
        ...(c.weekday !== undefined ? { weekday: Math.min(6, Math.max(0, Math.round(num(c.weekday)))) } : {}),
        ...(c.time !== undefined ? { time: /^\d{2}:\d{2}$/.test(c.time) ? c.time : '09:00' } : {}),
        ...(c.text !== undefined ? { text: str(c.text, 5000) } : {}),
        ...(c.message !== undefined ? { message: str(c.message, 1000) } : {}),
        ...(c.mode !== undefined ? { mode: c.mode === 'scheduled' ? 'scheduled' : 'draft' } : {}),
        ...(c.targetIds !== undefined ? { targetIds: (c.targetIds || []).filter(id => find('accounts', id)) } : {}),
        ...(c.daysBefore !== undefined ? { daysBefore: Math.min(30, Math.max(1, Math.round(num(c.daysBefore, 7)))) } : {}),
        ...(c.afterDays !== undefined ? { afterDays: Math.min(30, Math.max(0, Math.round(num(c.afterDays, 1)))) } : {}),
        ...(c.days !== undefined ? { days: Math.min(365, Math.max(14, Math.round(num(c.days, 60)))) } : {}),
        ...(c.hours !== undefined ? { hours: Math.min(240, Math.max(1, Math.round(num(c.hours, 24)))) } : {}),
        ...(c.kinds !== undefined ? { kinds: strs(c.kinds, 6, 20) } : {}),
        ...(c.draft !== undefined ? { draft: !!c.draft } : {}),
        ...(c.assigneeId !== undefined ? { assigneeId: ID(c.assigneeId) } : {})
      };
    }
    const wantOn = 'enabled' in p ? !!p.enabled : a.enabled;
    if (wantOn) {
      const on = list.filter(x => x.enabled && x.id !== a.id).length;
      if (on >= plan().automations) throw new Error(`Paket ${plan().name} mencakup ${plan().automations} otomatisasi aktif. Matikan yang lain atau naikkan paket.`);
    }
    a.enabled = wantOn;
    if (!existing) list.push(a);
    store.save(); broadcast();
    setTimeout(automationTick, 300);
    return a;
  });
  h('automations:remove', (id) => { guard('automations.manage'); D().automations = D().automations.filter(x => x.id !== id); return done(true); });
  h('automations:run', () => { guard('automations.manage'); automationTick(); return true; });

  // ---------- Trust Center ----------
  h('privacy:save', (p) => {
    guard('trust.manage');
    const pv = D().privacy;
    if (Array.isArray(p.ropa)) {
      pv.ropa = p.ropa.slice(0, 60).map(r => ({
        id: ID(r.id) || uid(), name: str(r.name, 120), controller: str(r.controller, 120), purpose: str(r.purpose, 600),
        basis: privacy.LEGAL_BASES[r.basis] ? r.basis : 'consent', subjects: str(r.subjects, 200), data: str(r.data, 600),
        specific: !!r.specific, source: str(r.source, 200), recipients: str(r.recipients, 400), transfer: str(r.transfer, 400),
        storage: str(r.storage, 400), retention: str(r.retention, 300), security: str(r.security, 600), owner: str(r.owner, 120)
      }));
      pv.ropaReviewedAt = Date.now();
      audit({ action: 'privacy.ropa', detail: `${pv.ropa.length} kegiatan pemrosesan` });
    }
    if (p.notice) {
      const prev = pv.notice || { version: 0 };
      pv.notice = { version: (prev.version || 0) + 1, text: str(p.notice.text, 20000), contact: str(p.notice.contact, 200), publishedAt: Date.now(), publishedBy: me().name };
      audit({ action: 'privacy.notice', detail: `Versi ${pv.notice.version}` });
    }
    if (p.retention) {
      const r = {};
      for (const k of Object.keys(privacy.DEFAULT_RETENTION)) if (k in p.retention) r[k] = Math.min(240, Math.max(1, Math.round(num(p.retention[k], privacy.DEFAULT_RETENTION[k]))));
      pv.retention = { ...privacy.retentionOf(pv), ...r };
      audit({ action: 'privacy.retention', detail: 'Kebijakan retensi diperbarui' });
    }
    if (p.ppdp) {
      pv.ppdp = { name: str(p.ppdp.name, 80), email: str(p.ppdp.email, 120), phone: str(p.ppdp.phone, 30), role: str(p.ppdp.role, 80), required: !!p.ppdp.required };
      audit({ action: 'privacy.ppdp', target: pv.ppdp.name });
    }
    if (p.dpia) {
      pv.dpia = { answers: p.dpia.answers && typeof p.dpia.answers === 'object' ? Object.fromEntries(Object.entries(p.dpia.answers).slice(0, 30).map(([k, v]) => [str(k, 30), !!v])) : {}, note: str(p.dpia.note, 2000), at: Date.now() };
      audit({ action: 'privacy.dpia', detail: 'Penilaian dampak disimpan' });
    }
    return done(pv);
  });

  h('dsr:save', (p) => {
    guard('trust.manage');
    const existing = p.id && find('dsr', p.id);
    const r = existing || stamp({ id: uid(), status: 'open', log: [] }, null);
    const isNew = !existing;
    if ('type' in p) r.type = privacy.DSR_TYPES[p.type] ? p.type : 'info';
    if ('name' in p) r.name = str(p.name, 80);
    if ('contact' in p) r.contact = str(p.contact, 120);
    if ('channel' in p) r.channel = str(p.channel, 40);
    if ('detail' in p) r.detail = str(p.detail, 2000);
    if ('customerId' in p) r.customerId = ID(p.customerId);
    if ('verified' in p) r.verified = !!p.verified;
    if ('receivedAt' in p || isNew) { r.receivedAt = num(p.receivedAt, Date.now()) || Date.now(); r.dueAt = r.receivedAt + privacy.RESPONSE_HOURS * 3600000; }
    if ('response' in p) r.response = str(p.response, 4000);
    if ('status' in p && ['open', 'progress', 'closed', 'rejected'].includes(p.status)) {
      if (p.status !== r.status) r.log.push({ at: Date.now(), by: me().name, text: `Status: ${p.status}` });
      r.status = p.status;
      r.closedAt = ['closed', 'rejected'].includes(p.status) ? Date.now() : null;
    }
    if (p.logText) r.log.push({ at: Date.now(), by: me().name, text: str(p.logText, 300) });
    if (isNew) D().dsr.push(r);
    audit({ action: isNew ? 'dsr.create' : 'dsr.update', target: privacy.DSR_TYPES[r.type] || r.type, detail: r.status });
    return done(r);
  });
  h('dsr:remove', (id) => { guard('trust.manage'); D().dsr = D().dsr.filter(x => x.id !== id); audit({ action: 'dsr.remove', target: shortId(id) }); return done(true); });

  h('incidents:save', (p) => {
    guard('trust.manage');
    const existing = p.id && find('incidents', p.id);
    const r = existing || stamp({ id: uid(), status: 'open', checklist: {} }, null);
    const isNew = !existing;
    for (const [k, max] of Object.entries({ title: 140, description: 3000, dataTypes: 600, cause: 2000, containment: 2000, recovery: 2000, severity: 10, affected: 200 })) if (k in p) r[k] = str(p[k], max);
    for (const k of ['discoveredAt', 'occurredAt', 'notifiedSubjectsAt', 'notifiedAuthorityAt']) if (k in p) r[k] = p[k] ? num(p[k]) : null;
    if (isNew && !r.discoveredAt) r.discoveredAt = Date.now();
    if ('subjects' in p) r.subjects = Math.max(0, Math.round(num(p.subjects)));
    if (p.checklist && typeof p.checklist === 'object') for (const [k, v] of Object.entries(p.checklist)) if (/^[a-z_]{1,30}$/.test(k)) r.checklist[k] = !!v;
    r.notifiedAt = r.notifiedSubjectsAt && r.notifiedAuthorityAt ? Math.max(r.notifiedSubjectsAt, r.notifiedAuthorityAt) : null;
    if ('status' in p && ['open', 'closed'].includes(p.status)) { r.status = p.status; r.closedAt = p.status === 'closed' ? Date.now() : null; }
    if (isNew) D().incidents.push(r);
    audit({ action: isNew ? 'incident.create' : 'incident.update', target: r.title || 'Insiden', detail: r.status });
    return done(r);
  });
  h('incidents:remove', (id) => { guard('trust.manage'); D().incidents = D().incidents.filter(x => x.id !== id); audit({ action: 'incident.remove', target: shortId(id) }); return done(true); });

  h('retention:purge', ({ kinds }) => {
    guard('trust.manage');
    const rep = privacy.retentionReport(D());
    const counts = {};
    for (const k of kinds || []) {
      const ids = new Set(rep.ids[k] || []);
      if (!ids.size || !Array.isArray(D()[k])) continue;
      D()[k] = D()[k].filter(x => !ids.has(x.id));
      counts[k] = ids.size;
    }
    audit({ action: 'retention.purge', detail: Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ') || 'tidak ada' });
    return done(counts);
  });

  // ---------- use cases ----------
  /** Applies a ready-made example: templates, automations, a checklist of tasks and profile hints. Idempotent by name. */
  h('usecase:apply', (p) => {
    guard('templates.write');
    const d = D();
    const res = { templates: 0, automations: 0, tasks: 0, skipped: [] };
    for (const t of (p.templates || []).slice(0, 20)) {
      if (d.templates.some(x => x.name === t.name)) continue;
      d.templates.push({ id: uid(), name: str(t.name, 60), text: str(t.text, 5000), tag: str(p.tag || '', 30) });
      res.templates++;
    }
    const canAuto = ctx.can('automations.manage');
    for (const a of (p.automations || []).slice(0, 10)) {
      if (!canAuto) { res.skipped.push('otomatisasi (perlu peran admin)'); break; }
      if (!AUTOMATION_TYPES.includes(a.type) || d.automations.some(x => x.name === a.name)) continue;
      const on = d.automations.filter(x => x.enabled).length;
      const enabled = on < plan().automations;
      if (!enabled) res.skipped.push(`“${a.name}” dibuat tetapi belum aktif (batas paket)`);
      d.automations.push({ id: uid(), type: a.type, name: str(a.name, 80), enabled, config: a.config || {}, keys: [], createdAt: Date.now(), createdBy: me().id, fromUseCase: str(p.id, 40) });
      res.automations++;
    }
    for (const t of (p.tasks || []).slice(0, 15)) {
      const id = ('uc_' + str(p.id, 30) + '_' + (t.key || res.tasks)).replace(/[^A-Za-z0-9_-]/g, '');
      if (d.tasks.some(x => x.id === id)) continue;
      d.tasks.push({ id, title: str(t.title, 160), detail: str(t.detail, 1000), status: 'open', source: 'usecase', link: t.link || null, dueAt: Date.now() + (num(t.inDays, 0) * DAY), assigneeId: me().id, createdAt: Date.now(), createdBy: me().id });
      res.tasks++;
    }
    if (p.business && ctx.can('growth.write')) {
      const b = d.business;
      if (!b.category && p.business.category) b.category = str(p.business.category, 80);
      if ((!b.services || !b.services.length) && p.business.services) b.services = strs(p.business.services, 30, 60);
      if ((!b.keywords || !b.keywords.length) && p.business.keywords) b.keywords = strs(p.business.keywords, 40, 60);
    }
    d.settings.appliedUseCases = [...new Set([...(d.settings.appliedUseCases || []), str(p.id, 40)])];
    store.save(); broadcast();
    setTimeout(automationTick, 500);
    return res;
  });
}

module.exports = { registerDataIpc, CONSENT_PURPOSES, normPhone };
