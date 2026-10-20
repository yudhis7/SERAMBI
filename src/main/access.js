// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Who may do what. Roles apply inside a team workspace; on a single computer without a team
// the user is the owner. Roles are enforced by Serambi on every device; the real boundary
// for data is the workspace key and who the shared folder is shared with.

const ROLES = {
  owner: { label: 'Pemilik', desc: 'Semua akses, termasuk lisensi, anggota, dan Pusat Kepercayaan.' },
  admin: { label: 'Admin', desc: 'Kelola akun, anggota, otomatisasi, data pelanggan, dan menyetujui postingan.' },
  editor: { label: 'Editor', desc: 'Menulis postingan, mengelola ulasan dan tugas. Postingan perlu disetujui bila persetujuan aktif.' },
  viewer: { label: 'Pengamat', desc: 'Hanya melihat jadwal dan laporan. Tidak bisa mengubah apa pun.' }
};

const PERMS = {
  admin: ['post.write', 'post.schedule', 'post.approve', 'accounts.manage', 'customers.view', 'customers.write', 'growth.write', 'reviews.write', 'automations.manage', 'team.manage', 'trust.manage', 'templates.write', 'tasks.write'],
  editor: ['post.write', 'growth.write', 'reviews.write', 'templates.write', 'tasks.write'],
  viewer: []
};

/** member: { role, canSeeCustomers }, approvalRequired: boolean */
function can(member, perm, { approvalRequired = false } = {}) {
  if (!member) return false;
  if (member.role === 'owner') return true;
  const list = PERMS[member.role] || [];
  if (perm === 'customers.view' || perm === 'customers.write') {
    return list.includes(perm) || (member.role !== 'viewer' && !!member.canSeeCustomers);
  }
  if (perm === 'post.schedule') return list.includes(perm) || (member.role === 'editor' && !approvalRequired);
  return list.includes(perm);
}

const PERM_LIST = ['post.write', 'post.schedule', 'post.approve', 'accounts.manage', 'customers.view', 'customers.write', 'growth.write', 'reviews.write', 'automations.manage', 'team.manage', 'trust.manage', 'templates.write', 'tasks.write', 'license.manage'];

function permsFor(member, opts) {
  const out = {};
  for (const p of PERM_LIST) out[p] = p === 'license.manage' ? !!member && member.role === 'owner' : can(member, p, opts);
  return out;
}

module.exports = { ROLES, can, permsFor };
