// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Everyday local-marketing automations. They run on this computer (in a team: on the one
// "automation device") and only prepare work: draft or scheduled posts and tasks with a
// ready-to-send WhatsApp message. Nothing is sent to customers without a person pressing send.
// Customers are only included when they gave consent for that purpose and are not restricted.
const { MOMENTS } = require('./moments');

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const atTime = (ts, hhmm) => { const d = new Date(ts); const [h, m] = String(hhmm || '09:00').split(':').map(Number); d.setHours(h || 0, m || 0, 0, 0); return d.getTime(); };

/** Latest consent record for a purpose decides. */
function hasConsent(c, purpose) {
  if (!c || c.restricted || c.erased) return false;
  const recs = (c.consents || []).filter(r => r.purpose === purpose).sort((a, b) => (b.at || 0) - (a.at || 0));
  return !!(recs[0] && recs[0].status === 'granted');
}

function fill(text, c, extra = {}) {
  const first = String(c && c.name || '').trim().split(/\s+/)[0] || 'Kak';
  return String(text || '')
    .replace(/\{nama\}/gi, first)
    .replace(/\{nama_lengkap\}/gi, (c && c.name) || first)
    .replace(/\{usaha\}/gi, extra.business || '')
    .replace(/\{link\}/gi, extra.link || '')
    .replace(/\{lokasi\}/gi, extra.location || '');
}

function reviewLinkFor(data, c) {
  const loc = data.locations.find(l => l.id === c.locationId) || data.locations[0];
  if (!loc) return '';
  if (loc.reviewUrl) return loc.reviewUrl;
  if (loc.placeId) return 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(loc.placeId);
  return '';
}

function remember(a, key) {
  a.keys = Array.isArray(a.keys) ? a.keys : [];
  if (a.keys.includes(key)) return false;
  a.keys.push(key);
  if (a.keys.length > 120) a.keys.splice(0, a.keys.length - 120);
  return true;
}

/**
 * Runs all enabled automations once.
 * ctx: { data, now, limit, uid, notify, memberId, approvalFor(memberId) }
 * Returns the number of things created.
 */
function runAll(ctx) {
  const { data, now = Date.now(), limit = 5 } = ctx;
  const enabled = data.automations.filter(a => a.enabled).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, limit);
  let created = 0;
  for (const a of enabled) {
    let n = 0;
    try { n = run(a, ctx, now); a.lastError = undefined; } catch (e) { a.lastError = String(e && e.message || e); }
    created += n;
    // Only touch the record when something happened or once an hour, so team folders are not rewritten every few minutes.
    if (n || !a.lastRunAt || now - a.lastRunAt > 3600000) a.lastRunAt = now;
  }
  return created;
}

function addTask(ctx, a, key, task) {
  const id = `at_${a.id}_${key}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
  if (ctx.data.tasks.some(t => t.id === id)) return 0;
  ctx.data.tasks.push({
    id, status: 'open', createdAt: ctx.now || Date.now(), source: 'automation', automationId: a.id,
    assigneeId: (a.config && a.config.assigneeId) || a.createdBy || null, createdBy: a.createdBy || null,
    ...task
  });
  return 1;
}

function run(a, ctx, now) {
  const { data } = ctx;
  const c = a.config || {};
  const biz = data.business || {};
  const today = startOfDay(now);
  let n = 0;

  switch (a.type) {
    case 'weekly_post': {
      // Prepare the next occurrence within the coming 7 days.
      for (let i = 0; i < 7; i++) {
        const day = today + i * DAY;
        if (new Date(day).getDay() !== Number(c.weekday ?? 5)) continue;
        const at = atTime(day, c.time || '11:00');
        if (at < now) continue;
        const key = 'p' + dayKey(day);
        if (!remember(a, key)) continue;
        const accounts = new Set(data.accounts.map(x => x.id));
        const targets = (c.targetIds || []).filter(id => accounts.has(id)).map(id => ({ accountId: id, status: 'pending', error: '' }));
        let status = c.mode === 'scheduled' && targets.length ? 'scheduled' : 'draft';
        const post = {
          id: `ap_${a.id}_${dayKey(day)}`, text: String(c.text || ''), media: [], targets, status,
          scheduledAt: at, createdAt: now, updatedAt: now, postedAt: null,
          createdBy: a.createdBy || null, assigneeId: c.assigneeId || a.createdBy || null, source: 'automation', automationId: a.id
        };
        if (status === 'scheduled' && ctx.needsApproval && ctx.needsApproval(a.createdBy)) {
          post.status = 'review';
          post.approval = { requestedBy: a.createdBy, requestedAt: now, note: 'Dibuat otomatis' };
        }
        if (!data.posts.some(p => p.id === post.id)) { data.posts.push(post); n++; }
      }
      break;
    }
    case 'moment_prep': {
      const days = Math.max(1, Number(c.daysBefore) || 7);
      const kinds = Array.isArray(c.kinds) && c.kinds.length ? c.kinds : ['libur', 'belanja'];
      for (const m of MOMENTS) {
        const day0 = new Date(m.date + 'T00:00:00').getTime();
        if (day0 < today || day0 > today + days * DAY || !kinds.includes(m.kind)) continue;
        const t = day0 + 9 * 3600000;
        if (!remember(a, m.id)) continue;
        let postId = null;
        if (c.draft !== false) {
          postId = `am_${a.id}_${m.id}`.slice(0, 100);
          if (!data.posts.some(p => p.id === postId)) {
            data.posts.push({
              id: postId, media: [], targets: [], status: 'draft',
              text: `${m.name}${biz.name ? ' bersama ' + biz.name : ''}\n\n`,
              scheduledAt: t, createdAt: now, updatedAt: now, postedAt: null,
              createdBy: a.createdBy || null, source: 'automation', automationId: a.id, momentId: m.id, note: m.idea
            });
          }
        }
        n += addTask(ctx, a, m.id, {
          title: `Siapkan konten: ${m.name}`,
          detail: `${m.idea}${m.estimate ? ' (tanggal perkiraan)' : ''}`,
          dueAt: Math.max(now, t - DAY), link: postId ? { route: 'compose', postId } : { route: 'growth', tab: 'automate' }
        });
      }
      break;
    }
    case 'birthday': {
      const md = (() => { const d = new Date(now); return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
      for (const cu of data.customers) {
        if (!cu.birthday || String(cu.birthday).slice(5, 10) !== md || !cu.phone || !hasConsent(cu, 'birthday')) continue;
        const key = `${cu.id}_${new Date(now).getFullYear()}`;
        n += addTask(ctx, a, key, {
          title: `Ucapkan selamat ulang tahun untuk ${cu.name}`,
          detail: 'Pelanggan ini setuju menerima ucapan ulang tahun.',
          dueAt: atTime(now, '10:00'), customerId: cu.id,
          action: { type: 'wa', phone: cu.phone, text: fill(c.message || 'Selamat ulang tahun, {nama}! Semoga sehat dan bahagia selalu. Ada hadiah kecil untuk Kakak di {usaha} minggu ini 🎉', cu, { business: biz.name }) }
        });
      }
      break;
    }
    case 'review_request': {
      const after = Math.max(0, Number(c.afterDays ?? 1));
      let count = 0;
      for (const cu of data.customers) {
        if (count >= 15) break;
        if (!cu.lastVisitAt || !cu.phone || !hasConsent(cu, 'review')) continue;
        const age = now - cu.lastVisitAt;
        if (age < after * DAY || age > (after + 5) * DAY) continue;
        if (cu.reviewAskedAt && cu.reviewAskedAt >= cu.lastVisitAt) continue;
        const link = reviewLinkFor(data, cu);
        cu.reviewAskedAt = now;
        cu.updatedAt = now;
        n += addTask(ctx, a, `${cu.id}_${dayKey(cu.lastVisitAt)}`, {
          title: `Minta ulasan dari ${cu.name}`,
          detail: link ? 'Pesan berisi link ulasan Google.' : 'Isi link ulasan di Tumbuh lokal → Ulasan supaya pesan berisi link.',
          dueAt: now, customerId: cu.id,
          action: { type: 'wa', phone: cu.phone, text: fill(c.message || 'Halo {nama}, terima kasih sudah mampir ke {usaha}! Kalau berkenan, ceritakan pengalaman Kakak di sini ya: {link} 🙏', cu, { business: biz.name, link }) }
        });
        count++;
      }
      break;
    }
    case 'review_reply': {
      const hours = Math.max(1, Number(c.hours) || 24);
      const pending = data.reviews.filter(r => !r.reply && (r.date || r.createdAt || now) < now - hours * 3600000);
      if (pending.length) {
        n += addTask(ctx, a, 'r' + dayKey(now), {
          title: `Balas ${pending.length} ulasan yang belum dijawab`,
          detail: 'Ulasan yang dibalas cepat membangun kepercayaan calon pelanggan.',
          dueAt: atTime(now, '16:00'), link: { route: 'growth', tab: 'reviews' }
        });
      }
      break;
    }
    case 'winback': {
      const days = Math.max(14, Number(c.days) || 60);
      let count = 0;
      for (const cu of data.customers) {
        if (count >= 10) break;
        if (!cu.lastVisitAt || !cu.phone || !hasConsent(cu, 'whatsapp')) continue;
        if (now - cu.lastVisitAt < days * DAY) continue;
        if (cu.winbackAt && cu.winbackAt >= cu.lastVisitAt) continue;
        cu.winbackAt = now; cu.updatedAt = now;
        n += addTask(ctx, a, `${cu.id}_${dayKey(cu.lastVisitAt)}`, {
          title: `Sapa lagi ${cu.name}`,
          detail: `Terakhir datang lebih dari ${days} hari lalu.`,
          dueAt: now, customerId: cu.id,
          action: { type: 'wa', phone: cu.phone, text: fill(c.message || 'Halo {nama}, lama tidak mampir ke {usaha}. Kami kangen! Minggu ini ada penawaran khusus untuk Kakak.', cu, { business: biz.name }) }
        });
        count++;
      }
      break;
    }
    case 'gbp_weekly': {
      const wd = Number(c.weekday ?? 3);
      if (new Date(now).getDay() !== wd) break;
      const last = data.posts.filter(p => p.status === 'posted' && p.text).sort((x, y) => (y.postedAt || 0) - (x.postedAt || 0))[0];
      n += addTask(ctx, a, 'g' + dayKey(now), {
        title: 'Posting mingguan di Profil Bisnis Google',
        detail: 'Profil yang rutin diperbarui lebih mudah ditemukan di Google Penelusuran dan Maps. Maksimal 1.500 karakter.',
        dueAt: atTime(now, '10:00'),
        action: { type: 'gbp', text: last ? String(last.text).slice(0, 1500) : '' }
      });
      break;
    }
    case 'weekly_report': {
      const wd = Number(c.weekday ?? 1);
      if (new Date(now).getDay() !== wd || now < atTime(now, c.time || '08:00')) break;
      const key = 'w' + dayKey(now);
      if (!remember(a, key)) break;
      const since = now - 7 * DAY;
      const posted = data.posts.filter(p => p.postedAt && p.postedAt >= since).length;
      const reviews = data.reviews.filter(r => (r.date || 0) >= since);
      const avg = reviews.length ? (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1).replace('.', ',') : null;
      const done = data.tasks.filter(t => t.doneAt && t.doneAt >= since).length;
      const body = `${posted} postingan terkirim, ${reviews.length} ulasan baru${avg ? ` (rata-rata ${avg}★)` : ''}, ${done} tugas selesai.`;
      if (ctx.notify) ctx.notify('Laporan mingguan Serambi', body);
      n += addTask(ctx, a, key, { title: 'Tinjau laporan mingguan', detail: body, dueAt: now, link: { route: 'growth', tab: 'overview' } });
      break;
    }
    case 'retention_check': {
      if (new Date(now).getDate() !== 1) break;
      const due = ctx.retentionDue ? ctx.retentionDue() : 0;
      if (due > 0) {
        n += addTask(ctx, a, 'k' + dayKey(now), {
          title: `Tinjau ${due} data yang melewati masa simpan`,
          detail: 'Kebijakan retensi di Pusat Kepercayaan. Hapus atau anonimkan data yang tidak lagi diperlukan.',
          dueAt: now, link: { route: 'trust', tab: 'retention' }
        });
      }
      break;
    }
  }
  return n;
}

module.exports = { runAll, hasConsent, fill };
