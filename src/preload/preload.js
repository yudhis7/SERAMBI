// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Bridge between the interface and the main process. Only these calls are exposed.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Errors thrown in the main process arrive as "Error invoking remote method '…': Error: message".
// Keep only the message so the interface can show it as is.
const invoke = (channel) => async (...args) => {
  try { return await ipcRenderer.invoke(channel, ...args); }
  catch (e) {
    const msg = String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    throw new Error(msg);
  }
};

contextBridge.exposeInMainWorld('serambi', {
  init: invoke('init'),
  // accounts & posts
  addAccount: invoke('accounts:add'),
  updateAccount: invoke('accounts:update'),
  reorderAccounts: invoke('accounts:reorder'),
  logoutAccount: invoke('accounts:logout'),
  removeAccount: invoke('accounts:remove'),
  savePost: invoke('posts:save'),
  removePost: invoke('posts:remove'),
  duplicatePost: invoke('posts:duplicate'),
  runPost: invoke('posts:run'),
  setTarget: invoke('posts:target'),
  decidePost: invoke('posts:decide'),
  saveTemplate: invoke('templates:save'),
  removeTemplate: invoke('templates:remove'),
  setSettings: invoke('settings:set'),
  saveBot: invoke('bot:save'),
  removeBot: invoke('bot:remove'),
  pickMedia: invoke('media:pick'),
  importMedia: invoke('media:import'),
  pasteMedia: invoke('media:paste'),
  copyText: invoke('clipboard:text'),
  copyImage: invoke('clipboard:image'),
  openExternal: invoke('open:external'),
  exportBackup: invoke('backup:export'),
  importBackup: invoke('backup:import'),
  setBadge: invoke('app:badge'),
  checkUpdate: invoke('update:check'),
  downloadUpdate: invoke('update:download'),
  installUpdate: invoke('update:install'),
  openMail: invoke('open:mail'),
  // plans & licences
  startTrial: invoke('plan:trial'),
  activateLicense: invoke('plan:activate'),
  removeLicense: invoke('plan:deactivate'),
  issueLicense: invoke('license:issue'),
  // team
  createTeam: invoke('team:create'),
  joinTeam: invoke('team:join'),
  leaveTeam: invoke('team:leave'),
  inviteMember: invoke('team:invite'),
  reinviteMember: invoke('team:reinvite'),
  updateMember: invoke('team:member'),
  removeMember: invoke('team:remove'),
  rotateTeamKey: invoke('team:rotate'),
  teamSettings: invoke('team:settings'),
  syncTeam: invoke('team:sync'),
  openTeamFolder: invoke('team:open-folder'),
  // local growth
  saveBusiness: invoke('business:save'),
  saveLocation: invoke('locations:save'),
  removeLocation: invoke('locations:remove'),
  saveCampaign: invoke('campaigns:save'),
  removeCampaign: invoke('campaigns:remove'),
  saveReview: invoke('reviews:save'),
  removeReview: invoke('reviews:remove'),
  fetchPage: invoke('seo:fetch'),
  qrSvg: invoke('qr:svg'),
  savePdf: invoke('file:pdf'),
  saveFile: invoke('file:save'),
  // customers
  saveCustomer: invoke('customers:save'),
  visitCustomer: invoke('customers:visit'),
  setConsent: invoke('customers:consent'),
  eraseCustomer: invoke('customers:erase'),
  importCustomers: invoke('customers:import'),
  customerDossier: invoke('customers:dossier'),
  logCustomerExport: invoke('customers:audit-export'),
  // tasks, comments, automations, use cases
  saveTask: invoke('tasks:save'),
  doneTask: invoke('tasks:done'),
  removeTask: invoke('tasks:remove'),
  clearDoneTasks: invoke('tasks:clear-done'),
  addComment: invoke('comments:add'),
  removeComment: invoke('comments:remove'),
  saveAutomation: invoke('automations:save'),
  removeAutomation: invoke('automations:remove'),
  runAutomations: invoke('automations:run'),
  applyUseCase: invoke('usecase:apply'),
  // Trust Center
  savePrivacy: invoke('privacy:save'),
  saveDsr: invoke('dsr:save'),
  removeDsr: invoke('dsr:remove'),
  saveIncident: invoke('incidents:save'),
  removeIncident: invoke('incidents:remove'),
  purgeRetention: invoke('retention:purge'),
  setPin: invoke('security:set-pin'),
  disablePin: invoke('security:disable'),
  securitySettings: invoke('security:settings'),
  lock: invoke('security:lock'),
  unlock: invoke('security:unlock'),
  resetPin: invoke('security:reset'),
  logoutAll: invoke('security:logout-all'),
  retryStore: invoke('store:retry'),
  setAsideStore: invoke('store:set-aside'),

  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch (_) { return null; } },
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  onCommand: (fn) => ipcRenderer.on('cmd', (_e, c) => fn(c)),
  onUpdate: (fn) => ipcRenderer.on('update', (_e, u) => fn(u))
});
