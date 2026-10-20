// Serambi — Copyright (c) 2026 Yudhistira <yudhie7@gmail.com>. All rights reserved.
//
// Posting to a Telegram channel or group through the official Bot API.
const fs = require('fs');
const path = require('path');

const API = 'https://api.telegram.org';

function friendlyError(err) {
  const msg = String((err && err.message) || err || '');
  if (/unauthorized|401/i.test(msg)) return 'Token bot salah atau sudah dicabut. Buat token baru di @BotFather.';
  if (/chat not found/i.test(msg)) return 'Channel atau grup tidak ditemukan. Periksa Chat ID dan pastikan bot sudah ditambahkan.';
  if (/not enough rights|have no rights|need administrator/i.test(msg)) return 'Bot belum menjadi admin dengan izin mengirim pesan di channel atau grup itu.';
  if (/bot was kicked|bot is not a member/i.test(msg)) return 'Bot sudah dikeluarkan dari channel atau grup itu. Tambahkan lagi sebagai admin.';
  if (/too many requests|429/i.test(msg)) return 'Terlalu banyak permintaan ke Telegram. Coba lagi beberapa menit lagi.';
  if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|timeout|aborted/i.test(msg)) return 'Tidak bisa terhubung ke Telegram. Periksa koneksi internet.';
  return 'Telegram menolak permintaan: ' + msg;
}

async function call(token, method, body) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    body: isForm ? body : JSON.stringify(body || {}),
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60000)
  });
  let json;
  try { json = await res.json(); } catch (_) { throw new Error('HTTP ' + res.status); }
  if (!json.ok) throw new Error(json.description || ('HTTP ' + res.status));
  return json.result;
}

function chunk(text, size) {
  const out = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = rest.lastIndexOf(' ', size);
    if (cut < size * 0.5) cut = size;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\s+/, '');
  }
  if (rest) out.push(rest);
  return out;
}

async function sendMessages(token, chatId, text) {
  for (const part of chunk(text, 4096)) {
    await call(token, 'sendMessage', { chat_id: chatId, text: part });
  }
}

function fileBlob(file) {
  const buf = fs.readFileSync(file);
  return new Blob([buf]);
}

async function sendPost(token, chatId, text, media, mediaDir) {
  text = (text || '').trim();
  const items = (media || []).filter(m => fs.existsSync(path.join(mediaDir, m.file))).slice(0, 10);
  const captionFits = text.length <= 1024;

  if (items.length === 0) {
    if (!text) throw new Error('Postingan kosong.');
    return sendMessages(token, chatId, text);
  }

  if (items.length === 1) {
    const m = items[0];
    const form = new FormData();
    form.append('chat_id', chatId);
    const field = m.type === 'video' ? 'video' : 'photo';
    form.append(field, fileBlob(path.join(mediaDir, m.file)), m.name || m.file);
    if (text && captionFits) form.append('caption', text);
    await call(token, m.type === 'video' ? 'sendVideo' : 'sendPhoto', form);
    if (text && !captionFits) await sendMessages(token, chatId, text);
    return;
  }

  const form = new FormData();
  form.append('chat_id', chatId);
  const group = items.map((m, i) => {
    const key = 'file' + i;
    form.append(key, fileBlob(path.join(mediaDir, m.file)), m.name || m.file);
    const entry = { type: m.type === 'video' ? 'video' : 'photo', media: 'attach://' + key };
    if (i === 0 && text && captionFits) entry.caption = text;
    return entry;
  });
  form.append('media', JSON.stringify(group));
  await call(token, 'sendMediaGroup', form);
  if (text && !captionFits) await sendMessages(token, chatId, text);
}

async function testBot(token, chatId) {
  const me = await call(token, 'getMe');
  let chatTitle = '';
  if (chatId) {
    const chat = await call(token, 'getChat', { chat_id: chatId });
    chatTitle = chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(' ');
  }
  return { botName: '@' + me.username, chatTitle };
}

module.exports = { sendPost, testBot, friendlyError };
