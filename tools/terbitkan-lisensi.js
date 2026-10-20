#!/usr/bin/env node
// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Alat pemilik Serambi untuk menerbitkan kunci lisensi SMALPreneur / MediumPreneur dari terminal.
// (Cara yang sama juga tersedia di aplikasi: menu Bantuan → Terbitkan kunci lisensi.)
//
// Pemakaian:
//   node tools/terbitkan-lisensi.js --kunci /lokasi/aman/serambi-penerbit-lisensi.pem \
//        --paket small --pengguna 8 --nama "Kopi Senja" --email rina@kopisenja.id --bulan 12
//
//   --paket     small (SMALPreneur, 5–10 pengguna) atau medium (MediumPreneur, 10–30 pengguna)
//   --pengguna  jumlah pengguna (kursi) di ruang kerja tim
//   --bulan     masa berlaku dalam bulan; 0 = tanpa batas waktu
//   --periksa   periksa kunci yang sudah ada, contoh: --periksa SRB1.xxxx.yyyy
//
// JANGAN pernah menaruh berkas .pem di repositori, email, atau folder bersama.
const fs = require('fs');
const path = require('path');
const { PLANS, parseLicense, issueLicense } = require(path.join(__dirname, '..', 'src', 'main', 'plans.js'));

function args() {
  const out = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; out[k] = v; }
  }
  return out;
}

const o = args();
if (o.periksa) {
  const r = parseLicense(o.periksa);
  if (!r.ok) { console.error('Tidak sah: ' + r.error); process.exit(1); }
  const l = r.license;
  console.log(`Sah. ${PLANS[l.plan].name}, ${l.seats} pengguna, untuk ${l.name}${l.email ? ' <' + l.email + '>' : ''}.`);
  console.log(`Diterbitkan ${new Date(l.issuedAt).toLocaleDateString('id-ID')}, ${l.expiresAt ? 'berlaku sampai ' + new Date(l.expiresAt).toLocaleDateString('id-ID') : 'tanpa batas waktu'}${l.expired ? ' (SUDAH HABIS)' : ''}.`);
  process.exit(0);
}
if (!o.kunci || !o.paket || !o.nama) {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(3, 16).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(1);
}
try {
  const pem = fs.readFileSync(o.kunci, 'utf8');
  const r = issueLicense(pem, { plan: o.paket, seats: Number(o.pengguna) || undefined, name: o.nama, email: o.email || '', months: o.bulan === undefined ? 12 : Number(o.bulan) });
  const p = r.payload;
  console.log(`\n${PLANS[p.plan].name} · ${p.seats} pengguna · ${p.name}${p.email ? ' <' + p.email + '>' : ''} · ${p.exp ? 'sampai ' + new Date(p.exp).toLocaleDateString('id-ID') : 'tanpa batas waktu'}\n`);
  console.log(r.key + '\n');
  const log = path.join(path.dirname(o.kunci), 'lisensi-terbit.csv');
  if (!fs.existsSync(log)) fs.writeFileSync(log, 'tanggal,id,paket,pengguna,nama,email,berlaku_sampai,kunci\n');
  fs.appendFileSync(log, [new Date(p.iat).toISOString(), p.id, p.plan, p.seats, JSON.stringify(p.name), p.email, p.exp ? new Date(p.exp).toISOString().slice(0, 10) : '', r.key].join(',') + '\n');
  console.log('Dicatat di ' + log);
} catch (e) {
  console.error('Gagal: ' + e.message);
  process.exit(1);
}
