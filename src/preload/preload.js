// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Bridge between the interface and the main process. Only these calls are exposed.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('serambi', {
  init: invoke('init'),
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
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch (_) { return null; } },
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  onCommand: (fn) => ipcRenderer.on('cmd', (_e, c) => fn(c)),
  onUpdate: (fn) => ipcRenderer.on('update', (_e, u) => fn(u))
});
