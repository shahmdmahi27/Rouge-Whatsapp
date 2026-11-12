import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';

const PORT = 3000;
const DB_PATH = path.resolve(process.cwd(), 'whisper_rust_pro.db');
const AUTH_BASE_DIR = path.resolve(process.cwd(), 'wa_auth_sessions');

if (!fs.existsSync(AUTH_BASE_DIR)) {
  fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    wa_jid TEXT DEFAULT '',
    stealth_read_receipts INTEGER DEFAULT 0,
    stealth_presence INTEGER DEFAULT 0,
    blur_previews INTEGER DEFAULT 0,
    lock_pin_hash TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    wa_jid TEXT DEFAULT '',
    chat_type TEXT NOT NULL,
    name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    about TEXT DEFAULT '',
    avatar_color TEXT NOT NULL,
    folder_id TEXT DEFAULT '',
    pinned INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    muted INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    disappearing_timer TEXT DEFAULT 'off',
    safety_number TEXT NOT NULL,
    identity_key_hex TEXT NOT NULL,
    ratchet_step INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    msg_type TEXT NOT NULL,
    content TEXT NOT NULL,
    media_data_url TEXT DEFAULT '',
    file_name TEXT DEFAULT '',
    file_size TEXT DEFAULT '',
    voice_duration INTEGER DEFAULT 0,
    reply_to_id TEXT DEFAULT '',
    forwarded INTEGER DEFAULT 0,
    edited INTEGER DEFAULT 0,
    reactions_json TEXT DEFAULT '{}',
    poll_json TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    status TEXT DEFAULT 'sent',
    cipher_hex TEXT NOT NULL,
    ratchet_step INTEGER NOT NULL,
    external_wa_id TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    message_id UNINDEXED,
    chat_id UNINDEXED,
    account_id UNINDEXED,
    content
  );

  CREATE TABLE IF NOT EXISTS status_posts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_phone TEXT NOT NULL,
    content TEXT NOT NULL,
    bg_color TEXT NOT NULL,
    media_data_url TEXT DEFAULT '',
    views INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    call_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    duration TEXT NOT NULL,
    safety_fingerprint TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scheduled_messages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    content TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_value TEXT NOT NULL,
    reply_content TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    hit_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    shortcut TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Safely add new columns if upgrading an existingwhisper_rust_pro.db
try {
  db.exec(`ALTER TABLE accounts ADD COLUMN wa_jid TEXT DEFAULT '';`);
} catch {}
try {
  db.exec(`ALTER TABLE chats ADD COLUMN wa_jid TEXT DEFAULT '';`);
} catch {}
try {
  db.exec(`ALTER TABLE chats ADD COLUMN archived INTEGER DEFAULT 0;`);
} catch {}
try {
  db.exec(`ALTER TABLE messages ADD COLUMN forwarded INTEGER DEFAULT 0;`);
} catch {}
try {
  db.exec(`ALTER TABLE messages ADD COLUMN edited INTEGER DEFAULT 0;`);
} catch {}

function computeSafetyNumber(seedA: string, seedB: string): string {
  const digest = crypto
    .createHash('sha512')
    .update(seedA)
    .update(seedB)
    .digest();
  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    const offset = i * 5;
    const val = digest.readUInt32BE(offset) % 100000;
    groups.push(String(val).padStart(5, '0'));
  }
  return groups.join(' ');
}

function encryptWithRatchet(chatId: string, plaintext: string, step: number): string {
  const key = crypto
    .createHmac('sha256', 'whisper_rust_root_key_v2')
    .update(`${chatId}:${step}`)
    .digest();
  const iv = Buffer.alloc(12, 0);
  iv.writeUInt32BE(step, 8);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString('hex');
}

function hashPin(pin: string): string {
  if (!pin.trim()) return '';
  return crypto
    .createHash('sha256')
    .update(`whisper_rust_pin_salt_v2:${pin.trim()}`)
    .digest('hex');
}

// Bootstrap default account & starter slash templates if DB is brand new
const existingAccounts = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as {
  cnt: number;
};
if (existingAccounts.cnt === 0) {
  const defaultAccountId = 'acc_primary';
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO accounts (id, name, phone, avatar_color, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(defaultAccountId, 'My WhatsApp', 'Click QR to link phone', '#00A884', nowIso);

  const insertTpl = db.prepare(`
    INSERT INTO templates (id, account_id, shortcut, title, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertTpl.run(
    'tpl_hello',
    defaultAccountId,
    '/hello',
    'Friendly Greeting',
    'Hi {{name}}, hope you are doing well!',
    nowIso
  );
  insertTpl.run(
    'tpl_thanks',
    defaultAccountId,
    '/thanks',
    'Thank You',
    'Thanks so much, {{name}}! Talk to you soon.',
    nowIso
  );
  insertTpl.run(
    'tpl_omw',
    defaultAccountId,
    '/onmyway',
    'On My Way',
    'Hey {{name}}, I am on my way and will be there shortly!',
    nowIso
  );
} else {
  // Remove any legacy technical /rust template if present
  db.prepare(`DELETE FROM templates WHERE shortcut = '/rust'`).run();
}

export interface WaCompanionState {
  accountId: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'pairing_code_ready' | 'connected';
  qrDataUrl?: string;
  rawQrString?: string;
  pairingCode?: string;
  connectedJid?: string;
  pushName?: string;
  lastError?: string;
  updatedAt: string;
}

const waSockets = new Map<string, ReturnType<typeof makeWASocket>>();
const waStates = new Map<string, WaCompanionState>();
const contactNamesCache = new Map<string, string>();

const AVATAR_PALETTE = [
  '#00A884',
  '#0284C7',
  '#7C3AED',
  '#D97706',
  '#E11D48',
  '#0D9488',
];

function colorForId(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

function mapAccountRow(r: any) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    waJid: r.wa_jid || '',
    avatarColor: r.avatar_color,
    stealthReadReceipts: Boolean(r.stealth_read_receipts),
    stealthPresence: Boolean(r.stealth_presence),
    blurPreviews: Boolean(r.blur_previews),
    hasLockPin: Boolean(r.lock_pin_hash),
    createdAt: r.created_at,
  };
}

function mapChatRow(r: any) {
  return {
    id: r.id,
    accountId: r.account_id,
    waJid: r.wa_jid || '',
    type: r.chat_type as 'direct' | 'group',
    name: r.name,
    recipientPhone: r.recipient_phone,
    about: r.about || '',
    avatarColor: r.avatar_color,
    folderId: r.folder_id || '',
    pinned: Boolean(r.pinned),
    archived: Boolean(r.archived),
    muted: Boolean(r.muted),
    unreadCount: Number(r.unread_count || 0),
    disappearingTimer: r.disappearing_timer || 'off',
    safetyNumber: r.safety_number,
    identityKeyHex: r.identity_key_hex,
    ratchetStep: Number(r.ratchet_step || 1),
    createdAt: r.created_at,
  };
}

function mapMessageRow(r: any) {
  let reactions = {};
  let poll = undefined;
  try {
    reactions = JSON.parse(r.reactions_json || '{}');
  } catch {
    reactions = {};
  }
  if (r.poll_json) {
    try {
      poll = JSON.parse(r.poll_json);
    } catch {
      poll = undefined;
    }
  }
  return {
    id: r.id,
    chatId: r.chat_id,
    accountId: r.account_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    type: r.msg_type,
    content: r.content,
    mediaDataUrl: r.media_data_url || undefined,
    fileName: r.file_name || undefined,
    fileSize: r.file_size || undefined,
    voiceDuration: r.voice_duration ? Number(r.voice_duration) : undefined,
    replyToId: r.reply_to_id || undefined,
    forwarded: Boolean(r.forwarded),
    edited: Boolean(r.edited),
    reactions,
    poll,
    starred: Boolean(r.starred),
    status: r.status || 'sent',
    cipherHex: r.cipher_hex,
    ratchetStep: Number(r.ratchet_step || 1),
    externalWaId: r.external_wa_id || undefined,
    createdAt: r.created_at,
  };
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.use(express.json({ limit: '25mb' }));

  const broadcast = (event: string, payload: unknown) => {
    const raw = JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    });
  };

  function updateWaState(accountId: string, patch: Partial<WaCompanionState>) {
    const prev = waStates.get(accountId) || {
      accountId,
      status: 'disconnected',
      updatedAt: new Date().toISOString(),
    };
    const next: WaCompanionState = {
      ...prev,
      ...patch,
      accountId,
      updatedAt: new Date().toISOString(),
    };
    waStates.set(accountId, next);
    broadcast('wa:session', next);
    return next;
  }

  // Ensure a WhatsApp JID exists as a Chat row in SQLite
  function ensureChatForWaJid(
    accountId: string,
    jid: string,
    preferredName?: string
  ): any {
    if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) {
      return null;
    }
    const existing = db
      .prepare('SELECT * FROM chats WHERE account_id = ? AND wa_jid = ?')
      .get(accountId, jid) as any;
    if (existing) {
      if (
        preferredName &&
        preferredName !== existing.name &&
        existing.name.includes('@')
      ) {
        db.prepare('UPDATE chats SET name = ? WHERE id = ?').run(
          preferredName,
          existing.id
        );
        const updated = db
          .prepare('SELECT * FROM chats WHERE id = ?')
          .get(existing.id);
        broadcast('chat:updated', mapChatRow(updated));
        return updated;
      }
      return existing;
    }

    const isGroup = jid.endsWith('@g.us');
    const phonePart = jid.split('@')[0].split(':')[0];
    const displayPhone = isGroup ? 'WhatsApp Group' : `+${phonePart}`;
    const displayName =
      preferredName ||
      contactNamesCache.get(jid) ||
      (isGroup ? `Group ${phonePart.slice(-6)}` : displayPhone);

    const chatId = `chat_wa_${accountId}_${phonePart.replace(/[^\w]/g, '')}`;
    const nowIso = new Date().toISOString();
    const ikHex = crypto.randomBytes(32).toString('hex');
    const safetyNum = computeSafetyNumber(accountId, jid);

    db.prepare(`
      INSERT OR IGNORE INTO chats (
        id, account_id, wa_jid, chat_type, name, recipient_phone, about,
        avatar_color, folder_id, pinned, archived, muted, unread_count,
        disappearing_timer, safety_number, identity_key_hex, ratchet_step, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 0, 0, 0, 0, 'off', ?, ?, 1, ?)
    `).run(
      chatId,
      accountId,
      jid,
      isGroup ? 'group' : 'direct',
      displayName,
      displayPhone,
      'Synced via WhatsApp Multi-Device Companion Socket',
      colorForId(jid),
      safetyNum,
      ikHex,
      nowIso
    );

    const created = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    if (created) {
      broadcast('chat:created', mapChatRow(created));
    }
    return created;
  }

  function extractWaMessageText(msgObj: any): {
    text: string;
    type: string;
  } {
    const m = msgObj?.message;
    if (!m) return { text: '', type: 'text' };
    if (m.conversation) return { text: m.conversation, type: 'text' };
    if (m.extendedTextMessage?.text)
      return { text: m.extendedTextMessage.text, type: 'text' };
    if (m.imageMessage)
      return {
        text: m.imageMessage.caption || '📷 Photo received from WhatsApp',
        type: 'text',
      };
    if (m.videoMessage)
      return {
        text: m.videoMessage.caption || '🎬 Video received from WhatsApp',
        type: 'text',
      };
    if (m.audioMessage)
      return {
        text: `🎙️ Voice Note (${m.audioMessage.seconds || 5}s · Opus E2EE)`,
        type: 'voice',
      };
    if (m.documentMessage)
      return {
        text: `📄 Document: ${m.documentMessage.fileName || 'Attachment'}`,
        type: 'file',
      };
    if (m.pollCreationMessage)
      return {
        text: `📊 Poll: ${m.pollCreationMessage.name || 'Poll'}`,
        type: 'text',
      };
    return { text: '', type: 'text' };
  }

  // Start a real @whiskeysockets/baileys Companion WebSocket session for an account
  async function startWhatsAppCompanionSocket(
    accountId: string,
    opts?: { phoneForPairingCode?: string }
  ) {
    const existingSock = waSockets.get(accountId);
    if (existingSock) {
      try {
        existingSock.end(undefined);
      } catch {}
      waSockets.delete(accountId);
    }

    updateWaState(accountId, {
      status: 'connecting',
      qrDataUrl: undefined,
      pairingCode: undefined,
      lastError: undefined,
    });

    const sessionDir = path.join(AUTH_BASE_DIR, accountId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    let version: [number, number, number] = [2, 3000, 1017531287];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version) version = latest.version;
    } catch {}

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }) as any,
      browser: Browsers.ubuntu('WhisperRust Desktop'),
      syncFullHistory: true,
      markOnlineOnConnect: false,
    });

    waSockets.set(accountId, sock);

    // If user requested an 8-digit Phone Pairing Code
    if (opts?.phoneForPairingCode && !sock.authState.creds.registered) {
      const cleanDigits = opts.phoneForPairingCode.replace(/[^\d]/g, '');
      if (cleanDigits.length >= 7) {
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(cleanDigits);
            const formatted =
              code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
            updateWaState(accountId, {
              status: 'pairing_code_ready',
              pairingCode: formatted,
            });
          } catch (err: any) {
            updateWaState(accountId, {
              lastError: err?.message || 'Failed to request pairing code',
            });
          }
        }, 1800);
      }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !opts?.phoneForPairingCode) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 280,
            color: { dark: '#111B21', light: '#FFFFFF' },
          });
          updateWaState(accountId, {
            status: 'qr_ready',
            qrDataUrl,
            rawQrString: qr,
          });
        } catch {}
      }

      if (connection === 'open') {
        const userJid = sock.user?.id || '';
        const pushName = sock.user?.name || 'Linked WhatsApp Account';
        const phoneNum = userJid ? `+${userJid.split('@')[0].split(':')[0]}` : '';

        db.prepare(`
          UPDATE accounts
          SET name = ?, phone = ?, wa_jid = ?
          WHERE id = ?
        `).run(pushName, phoneNum || 'Linked via Companion QR', userJid, accountId);

        const updatedAcc = mapAccountRow(
          db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId)
        );
        broadcast('account:updated', updatedAcc);

        updateWaState(accountId, {
          status: 'connected',
          connectedJid: userJid,
          pushName,
          qrDataUrl: undefined,
          pairingCode: undefined,
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (statusCode === DisconnectReason.loggedOut) {
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          } catch {}
          updateWaState(accountId, {
            status: 'disconnected',
            qrDataUrl: undefined,
            pairingCode: undefined,
            connectedJid: undefined,
          });
        } else if (shouldReconnect) {
          updateWaState(accountId, {
            status: 'disconnected',
            lastError: 'Connection closed or timed out — click Generate QR to reconnect.',
          });
        }
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts) {
        if (c.id && (c.name || c.notify)) {
          contactNamesCache.set(c.id, c.name || c.notify || c.id);
          ensureChatForWaJid(accountId, c.id, c.name || c.notify);
        }
      }
    });

    sock.ev.on('chats.upsert', (waChats) => {
      for (const ch of waChats) {
        if (ch.id) {
          ensureChatForWaJid(accountId, ch.id, ch.name || undefined);
        }
      }
    });

    sock.ev.on('messaging-history.set', ({ chats: hChats, contacts: hContacts, messages: hMessages }) => {
      for (const c of hContacts || []) {
        if (c.id && (c.name || c.notify)) {
          contactNamesCache.set(c.id, c.name || c.notify || c.id);
        }
      }
      for (const ch of hChats || []) {
        if (ch.id) {
          ensureChatForWaJid(accountId, ch.id, ch.name || undefined);
        }
      }
      for (const m of (hMessages || []).slice(-100)) {
        const remoteJid = m.key?.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;
        const extracted = extractWaMessageText(m);
        if (!extracted.text) continue;
        const chatRow = ensureChatForWaJid(
          accountId,
          remoteJid,
          m.pushName || undefined
        );
        if (!chatRow) continue;

        const waMsgId = m.key?.id || `wa_${Date.now()}_${Math.random()}`;
        const existingMsg = db
          .prepare('SELECT id FROM messages WHERE external_wa_id = ?')
          .get(waMsgId);
        if (existingMsg) continue;

        const fromMe = Boolean(m.key?.fromMe);
        const step = Number(chatRow.ratchet_step || 1) + 1;
        const cipherHex = encryptWithRatchet(chatRow.id, extracted.text, step);
        const tsIso = m.messageTimestamp
          ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();
        const localId = `msg_wa_${waMsgId}`;

        db.prepare(`
          INSERT OR IGNORE INTO messages (
            id, chat_id, account_id, sender_id, sender_name, msg_type, content,
            reactions_json, starred, status, cipher_hex, ratchet_step, external_wa_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', 0, 'read', ?, ?, ?, ?)
        `).run(
          localId,
          chatRow.id,
          accountId,
          fromMe ? 'me' : remoteJid,
          fromMe ? 'You' : m.pushName || chatRow.name,
          extracted.type,
          extracted.text,
          cipherHex,
          step,
          waMsgId,
          tsIso
        );
      }
    });

    sock.ev.on('messages.upsert', async ({ messages: upserted, type }) => {
      for (const m of upserted) {
        const remoteJid = m.key?.remoteJid;
        if (!remoteJid) continue;

        // Handle 24h Status Story broadcasts
        if (remoteJid === 'status@broadcast') {
          const extracted = extractWaMessageText(m);
          if (extracted.text) {
            const stId = `st_${m.key?.id || Date.now()}`;
            db.prepare(`
              INSERT OR IGNORE INTO status_posts (
                id, account_id, author_name, author_phone, content, bg_color, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              stId,
              accountId,
              m.pushName || 'WhatsApp Contact',
              m.key?.participant || '',
              extracted.text,
              'linear-gradient(135deg, #005C4B 0%, #0B141A 100%)',
              new Date().toISOString()
            );
            const row = db
              .prepare('SELECT * FROM status_posts WHERE id = ?')
              .get(stId);
            if (row) broadcast('status:created', row);
          }
          continue;
        }

        const extracted = extractWaMessageText(m);
        if (!extracted.text) continue;
        const chatRow = ensureChatForWaJid(
          accountId,
          remoteJid,
          m.pushName || undefined
        );
        if (!chatRow) continue;

        const waMsgId = m.key?.id || `${Date.now()}`;
        const existing = db
          .prepare('SELECT id FROM messages WHERE external_wa_id = ?')
          .get(waMsgId);
        if (existing) continue;

        const fromMe = Boolean(m.key?.fromMe);
        await createAndPersistMessage({
          accountId,
          chatId: chatRow.id,
          senderId: fromMe ? 'me' : remoteJid,
          senderName: fromMe ? 'You' : m.pushName || chatRow.name,
          type: extracted.type,
          content: extracted.text,
          externalWaId: waMsgId,
          skipWaSocketSend: true,
        });
      }
    });
  }

  // Persist message to SQLite + FTS5 + dispatch over live WhatsApp Companion socket if linked
  async function createAndPersistMessage(params: {
    accountId: string;
    chatId: string;
    senderId: string;
    senderName: string;
    type: string;
    content: string;
    mediaDataUrl?: string;
    fileName?: string;
    fileSize?: string;
    voiceDuration?: number;
    replyToId?: string;
    forwarded?: boolean;
    poll?: unknown;
    externalWaId?: string;
    skipWaSocketSend?: boolean;
  }) {
    const chatRow = db
      .prepare('SELECT * FROM chats WHERE id = ?')
      .get(params.chatId) as any;
    if (!chatRow) {
      throw new Error('Target conversation not found');
    }

    const nextStep = Number(chatRow.ratchet_step || 1) + 1;
    const cipherHex = encryptWithRatchet(params.chatId, params.content, nextStep);
    const msgId = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const nowIso = new Date().toISOString();

    let externalWaId = params.externalWaId || '';
    let status = 'delivered';

    // Dispatch over live @whiskeysockets/baileys Companion WebSocket if this account is connected
    if (params.senderId === 'me' && !params.skipWaSocketSend) {
      const sock = waSockets.get(params.accountId);
      const sessionState = waStates.get(params.accountId);
      let targetJid = chatRow.wa_jid || '';
      if (!targetJid && chatRow.recipient_phone) {
        const cleanDigits = chatRow.recipient_phone.replace(/[^\d]/g, '');
        if (cleanDigits.length >= 7) {
          targetJid = `${cleanDigits}@s.whatsapp.net`;
        }
      }

      if (sock && sessionState?.status === 'connected' && targetJid) {
        try {
          const sent = await sock.sendMessage(targetJid, {
            text: params.content,
          });
          if (sent?.key?.id) {
            externalWaId = sent.key.id;
            status = 'read';
          }
        } catch (err) {
          console.error('Baileys sendMessage error:', err);
        }
      }
    }

    db.prepare(`
      INSERT INTO messages (
        id, chat_id, account_id, sender_id, sender_name, msg_type, content,
        media_data_url, file_name, file_size, voice_duration, reply_to_id,
        forwarded, edited, reactions_json, poll_json, starred, status,
        cipher_hex, ratchet_step, external_wa_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '{}', ?, 0, ?, ?, ?, ?, ?)
    `).run(
      msgId,
      params.chatId,
      params.accountId,
      params.senderId,
      params.senderName,
      params.type || 'text',
      params.content,
      params.mediaDataUrl || '',
      params.fileName || '',
      params.fileSize || '',
      params.voiceDuration || 0,
      params.replyToId || '',
      params.forwarded ? 1 : 0,
      params.poll ? JSON.stringify(params.poll) : '',
      status,
      cipherHex,
      nextStep,
      externalWaId,
      nowIso
    );

    db.prepare(`
      INSERT INTO messages_fts (message_id, chat_id, account_id, content)
      VALUES (?, ?, ?, ?)
    `).run(msgId, params.chatId, params.accountId, params.content);

    const unreadDelta = params.senderId === 'me' ? 0 : 1;
    db.prepare(`
      UPDATE chats
      SET ratchet_step = ?, unread_count = unread_count + ?
      WHERE id = ?
    `).run(nextStep, unreadDelta, params.chatId);

    const insertedRow = db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(msgId);
    const updatedChatRow = db
      .prepare('SELECT * FROM chats WHERE id = ?')
      .get(params.chatId);

    const mappedMsg = mapMessageRow(insertedRow);
    const mappedChat = mapChatRow(updatedChatRow);

    broadcast('message:created', { message: mappedMsg, chat: mappedChat });

    // Evaluate Auto-Reply Rules on incoming peer/WhatsApp messages
    if (params.senderId !== 'me') {
      const activeRules = db
        .prepare(
          'SELECT * FROM auto_reply_rules WHERE account_id = ? AND enabled = 1'
        )
        .all(params.accountId) as any[];

      for (const rule of activeRules) {
        let matched = false;
        const textLower = params.content.toLowerCase();
        const trigLower = (rule.trigger_value || '').toLowerCase();

        if (rule.trigger_type === 'all_incoming') {
          matched = true;
        } else if (rule.trigger_type === 'keyword') {
          matched = textLower === trigLower;
        } else if (rule.trigger_type === 'contains') {
          matched = Boolean(trigLower) && textLower.includes(trigLower);
        } else if (rule.trigger_type === 'regex') {
          try {
            const re = new RegExp(rule.trigger_value, 'i');
            matched = re.test(params.content);
          } catch {
            matched = false;
          }
        }

        if (matched) {
          db.prepare(
            'UPDATE auto_reply_rules SET hit_count = hit_count + 1 WHERE id = ?'
          ).run(rule.id);
          const updatedRule = db
            .prepare('SELECT * FROM auto_reply_rules WHERE id = ?')
            .get(rule.id);
          broadcast('autorule:updated', updatedRule);

          await createAndPersistMessage({
            accountId: params.accountId,
            chatId: params.chatId,
            senderId: 'me',
            senderName: 'Auto-Responder',
            type: 'text',
            content: rule.reply_content
              .replace(/\{\{name\}\}/g, params.senderName)
              .replace(/\{\{date\}\}/g, new Date().toLocaleDateString()),
            replyToId: msgId,
          });
          break;
        }
      }
    }

    return mappedMsg;
  }

  // 1-Second Background Scheduler Worker
  setInterval(async () => {
    try {
      const nowIso = new Date().toISOString();
      const dueJobs = db
        .prepare(
          `SELECT * FROM scheduled_messages WHERE status = 'pending' AND scheduled_for <= ?`
        )
        .all(nowIso) as any[];

      for (const job of dueJobs) {
        db.prepare(`UPDATE scheduled_messages SET status = 'sent' WHERE id = ?`).run(
          job.id
        );
        await createAndPersistMessage({
          accountId: job.account_id,
          chatId: job.chat_id,
          senderId: 'me',
          senderName: 'You (Scheduled)',
          type: 'text',
          content: job.content,
        });
        const updatedJob = db
          .prepare('SELECT * FROM scheduled_messages WHERE id = ?')
          .get(job.id);
        broadcast('schedule:updated', updatedJob);
      }
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  }, 1000);

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.event === 'presence:typing' || data.event === 'rtc:signal') {
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
      } catch {}
    });
  });

  // REST API: Workspace Bootstrap
  app.get('/api/bootstrap', (req, res) => {
    const accounts = (
      db.prepare('SELECT * FROM accounts ORDER BY created_at ASC').all() as any[]
    ).map(mapAccountRow);
    const activeAccountId =
      (req.query.accountId as string) || accounts[0]?.id || 'acc_primary';

    const folders = db
      .prepare('SELECT * FROM folders WHERE account_id = ? ORDER BY created_at ASC')
      .all(activeAccountId);
    const chats = (
      db
        .prepare(
          'SELECT * FROM chats WHERE account_id = ? ORDER BY pinned DESC, created_at DESC'
        )
        .all(activeAccountId) as any[]
    ).map(mapChatRow);
    const messages = (
      db
        .prepare(
          'SELECT * FROM messages WHERE account_id = ? ORDER BY created_at ASC'
        )
        .all(activeAccountId) as any[]
    ).map(mapMessageRow);
    const statusPosts = db
      .prepare(
        'SELECT * FROM status_posts WHERE account_id = ? ORDER BY created_at DESC'
      )
      .all(activeAccountId);
    const callLogs = db
      .prepare(
        'SELECT * FROM call_logs WHERE account_id = ? ORDER BY created_at DESC'
      )
      .all(activeAccountId);
    const scheduled = db
      .prepare(
        'SELECT * FROM scheduled_messages WHERE account_id = ? ORDER BY scheduled_for ASC'
      )
      .all(activeAccountId);
    const autoRules = db
      .prepare(
        'SELECT * FROM auto_reply_rules WHERE account_id = ? ORDER BY created_at DESC'
      )
      .all(activeAccountId);
    const templates = db
      .prepare('SELECT * FROM templates WHERE account_id = ? ORDER BY shortcut ASC')
      .all(activeAccountId);

    const waSession = waStates.get(activeAccountId) || {
      accountId: activeAccountId,
      status: 'disconnected',
      updatedAt: new Date().toISOString(),
    };

    res.json({
      accounts,
      activeAccountId,
      waSession,
      folders,
      chats,
      messages,
      statusPosts,
      callLogs,
      scheduled,
      autoRules,
      templates,
    });
  });

  // Real WhatsApp Multi-Device Companion QR & Phone Pairing Endpoints
  app.post('/api/wa/connect-qr', async (req, res) => {
    const { accountId } = req.body;
    const targetAcc = accountId || 'acc_primary';
    startWhatsAppCompanionSocket(targetAcc).catch((err) => {
      updateWaState(targetAcc, {
        status: 'disconnected',
        lastError: err?.message || 'Failed to initialize WhatsApp socket',
      });
    });
    res.json(
      waStates.get(targetAcc) || {
        accountId: targetAcc,
        status: 'connecting',
        updatedAt: new Date().toISOString(),
      }
    );
  });

  app.post('/api/wa/pair-phone', async (req, res) => {
    const { accountId, phoneNumber } = req.body;
    const targetAcc = accountId || 'acc_primary';
    if (!phoneNumber?.trim()) {
      res.status(400).json({ error: 'Phone number with country code is required' });
      return;
    }
    startWhatsAppCompanionSocket(targetAcc, {
      phoneForPairingCode: phoneNumber.trim(),
    }).catch((err) => {
      updateWaState(targetAcc, {
        status: 'disconnected',
        lastError: err?.message || 'Pairing error',
      });
    });
    res.json(
      waStates.get(targetAcc) || {
        accountId: targetAcc,
        status: 'connecting',
        updatedAt: new Date().toISOString(),
      }
    );
  });

  app.post('/api/wa/disconnect', (req, res) => {
    const { accountId } = req.body;
    const targetAcc = accountId || 'acc_primary';
    const sock = waSockets.get(targetAcc);
    if (sock) {
      try {
        sock.logout();
      } catch {}
      try {
        sock.end(undefined);
      } catch {}
      waSockets.delete(targetAcc);
    }
    const sessionDir = path.join(AUTH_BASE_DIR, targetAcc);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {}
    const st = updateWaState(targetAcc, {
      status: 'disconnected',
      qrDataUrl: undefined,
      pairingCode: undefined,
      connectedJid: undefined,
    });
    res.json(st);
  });

  // Accounts API
  app.post('/api/accounts', (req, res) => {
    const { name, phone, avatarColor } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: 'Account name is required' });
      return;
    }
    const id = `acc_${Date.now()}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO accounts (id, name, phone, avatar_color, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      (phone || 'Unlinked — Click QR to Pair').trim(),
      avatarColor || '#0284C7',
      nowIso
    );

    const created = mapAccountRow(
      db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
    );
    broadcast('account:created', created);
    res.json(created);
  });

  app.patch('/api/accounts/:id', (req, res) => {
    const { id } = req.params;
    const {
      name,
      phone,
      stealthReadReceipts,
      stealthPresence,
      blurPreviews,
      newLockPin,
      clearLockPin,
    } = req.body;

    const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    let pinHash = existing.lock_pin_hash;
    if (clearLockPin) {
      pinHash = '';
    } else if (typeof newLockPin === 'string' && newLockPin.trim()) {
      pinHash = hashPin(newLockPin);
    }

    db.prepare(`
      UPDATE accounts
      SET name = ?,
          phone = ?,
          stealth_read_receipts = ?,
          stealth_presence = ?,
          blur_previews = ?,
          lock_pin_hash = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      phone ?? existing.phone,
      stealthReadReceipts !== undefined
        ? Number(Boolean(stealthReadReceipts))
        : existing.stealth_read_receipts,
      stealthPresence !== undefined
        ? Number(Boolean(stealthPresence))
        : existing.stealth_presence,
      blurPreviews !== undefined
        ? Number(Boolean(blurPreviews))
        : existing.blur_previews,
      pinHash,
      id
    );

    const updated = mapAccountRow(
      db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
    );
    broadcast('account:updated', updated);
    res.json(updated);
  });

  app.post('/api/accounts/:id/verify-pin', (req, res) => {
    const { id } = req.params;
    const { pin } = req.body;
    const row = db
      .prepare('SELECT lock_pin_hash FROM accounts WHERE id = ?')
      .get(id) as any;
    if (!row || !row.lock_pin_hash) {
      res.json({ valid: true });
      return;
    }
    const candidate = hashPin(String(pin || ''));
    res.json({ valid: candidate === row.lock_pin_hash });
  });

  // Folders API
  app.post('/api/folders', (req, res) => {
    const { accountId, name, color } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: 'Folder name required' });
      return;
    }
    const id = `fld_${Date.now()}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO folders (id, account_id, name, color, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, accountId, name.trim(), color || '#00A884', nowIso);
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
    broadcast('folder:created', folder);
    res.json(folder);
  });

  app.delete('/api/folders/:id', (req, res) => {
    const { id } = req.params;
    db.prepare(`UPDATE chats SET folder_id = '' WHERE folder_id = ?`).run(id);
    db.prepare(`DELETE FROM folders WHERE id = ?`).run(id);
    broadcast('folder:deleted', { id });
    res.json({ deleted: true });
  });

  // Chats API
  app.post('/api/chats', (req, res) => {
    const {
      accountId,
      type,
      name,
      recipientPhone,
      about,
      avatarColor,
      folderId,
    } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: 'Contact or group name is required' });
      return;
    }
    const id = `chat_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const nowIso = new Date().toISOString();
    const ikHex = crypto.randomBytes(32).toString('hex');
    const safetyNum = computeSafetyNumber(accountId || 'acc_primary', id);
    const cleanDigits = (recipientPhone || '').replace(/[^\d]/g, '');
    const waJid =
      type !== 'group' && cleanDigits.length >= 7
        ? `${cleanDigits}@s.whatsapp.net`
        : '';

    db.prepare(`
      INSERT INTO chats (
        id, account_id, wa_jid, chat_type, name, recipient_phone, about,
        avatar_color, folder_id, pinned, archived, muted, unread_count,
        disappearing_timer, safety_number, identity_key_hex, ratchet_step, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 'off', ?, ?, 1, ?)
    `).run(
      id,
      accountId || 'acc_primary',
      waJid,
      type === 'group' ? 'group' : 'direct',
      name.trim(),
      (recipientPhone || '').trim(),
      (about || 'Signal Double Ratchet E2EE').trim(),
      avatarColor || colorForId(name),
      folderId || '',
      safetyNum,
      ikHex,
      nowIso
    );

    const created = mapChatRow(
      db.prepare('SELECT * FROM chats WHERE id = ?').get(id)
    );
    broadcast('chat:created', created);
    res.json(created);
  });

  app.patch('/api/chats/:id', (req, res) => {
    const { id } = req.params;
    const {
      pinned,
      archived,
      muted,
      folderId,
      disappearingTimer,
      clearUnread,
      about,
      name,
    } = req.body;
    const existing = db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    db.prepare(`
      UPDATE chats
      SET pinned = ?,
          archived = ?,
          muted = ?,
          folder_id = ?,
          disappearing_timer = ?,
          unread_count = ?,
          about = ?,
          name = ?
      WHERE id = ?
    `).run(
      pinned !== undefined ? Number(Boolean(pinned)) : existing.pinned,
      archived !== undefined ? Number(Boolean(archived)) : existing.archived || 0,
      muted !== undefined ? Number(Boolean(muted)) : existing.muted,
      folderId !== undefined ? folderId : existing.folder_id,
      disappearingTimer ?? existing.disappearing_timer,
      clearUnread ? 0 : existing.unread_count,
      about ?? existing.about,
      name ?? existing.name,
      id
    );

    const updated = mapChatRow(
      db.prepare('SELECT * FROM chats WHERE id = ?').get(id)
    );
    broadcast('chat:updated', updated);
    res.json(updated);
  });

  app.delete('/api/chats/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM messages WHERE chat_id = ?').run(id);
    db.prepare('DELETE FROM messages_fts WHERE chat_id = ?').run(id);
    db.prepare('DELETE FROM scheduled_messages WHERE chat_id = ?').run(id);
    db.prepare('DELETE FROM chats WHERE id = ?').run(id);
    broadcast('chat:deleted', { id });
    res.json({ deleted: true });
  });

  // Messages API (Send, Edit, Forward, React, Star, Poll Vote)
  app.post('/api/messages', async (req, res) => {
    try {
      const msg = await createAndPersistMessage(req.body);
      res.json(msg);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to persist message' });
    }
  });

  app.post('/api/webhook/incoming', async (req, res) => {
    try {
      const { accountId, chatId, senderName, content } = req.body;
      const msg = await createAndPersistMessage({
        accountId: accountId || 'acc_primary',
        chatId,
        senderId: `peer_${Date.now()}`,
        senderName: senderName || 'Remote Contact',
        type: 'text',
        content,
      });
      res.json(msg);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Webhook error' });
    }
  });

  app.patch('/api/messages/:id', (req, res) => {
    const { id } = req.params;
    const { emoji, userId, toggleStar, voteOptionId, editedContent } = req.body;
    const existing = db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    let reactionsJson = existing.reactions_json;
    if (emoji) {
      const map = JSON.parse(existing.reactions_json || '{}');
      const actor = userId || 'me';
      const list: string[] = map[emoji] || [];
      if (list.includes(actor)) {
        map[emoji] = list.filter((u) => u !== actor);
        if (map[emoji].length === 0) delete map[emoji];
      } else {
        map[emoji] = [...list, actor];
      }
      reactionsJson = JSON.stringify(map);
    }

    let pollJson = existing.poll_json;
    if (voteOptionId && existing.poll_json) {
      const poll = JSON.parse(existing.poll_json);
      poll.options = (poll.options || []).map((o: any) => {
        if (o.id === voteOptionId) {
          const nextVoted = !o.votedByMe;
          return {
            ...o,
            votedByMe: nextVoted,
            votes: nextVoted ? o.votes + 1 : Math.max(0, o.votes - 1),
          };
        }
        return o;
      });
      pollJson = JSON.stringify(poll);
    }

    const nextStarred =
      toggleStar !== undefined ? Number(!existing.starred) : existing.starred;
    const nextContent =
      typeof editedContent === 'string' && editedContent.trim()
        ? editedContent.trim()
        : existing.content;
    const nextEdited =
      typeof editedContent === 'string' && editedContent.trim()
        ? 1
        : existing.edited || 0;

    db.prepare(`
      UPDATE messages
      SET reactions_json = ?, poll_json = ?, starred = ?, content = ?, edited = ?
      WHERE id = ?
    `).run(reactionsJson, pollJson, nextStarred, nextContent, nextEdited, id);

    if (typeof editedContent === 'string' && editedContent.trim()) {
      db.prepare(`UPDATE messages_fts SET content = ? WHERE message_id = ?`).run(
        nextContent,
        id
      );
    }

    const updated = mapMessageRow(
      db.prepare('SELECT * FROM messages WHERE id = ?').get(id)
    );
    broadcast('message:updated', updated);
    res.json(updated);
  });

  app.delete('/api/messages/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    db.prepare('DELETE FROM messages_fts WHERE message_id = ?').run(id);
    broadcast('message:deleted', { id });
    res.json({ deleted: true });
  });

  // Status Stories (24h Updates) API
  app.post('/api/status', (req, res) => {
    const { accountId, authorName, authorPhone, content, bgColor } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ error: 'Status content required' });
      return;
    }
    const id = `st_${Date.now()}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO status_posts (id, account_id, author_name, author_phone, content, bg_color, views, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      id,
      accountId || 'acc_primary',
      authorName || 'My Status',
      authorPhone || '',
      content.trim(),
      bgColor || 'linear-gradient(135deg, #005C4B 0%, #0B141A 100%)',
      nowIso
    );
    const row = db.prepare('SELECT * FROM status_posts WHERE id = ?').get(id);
    broadcast('status:created', row);
    res.json(row);
  });

  app.delete('/api/status/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM status_posts WHERE id = ?').run(id);
    broadcast('status:deleted', { id });
    res.json({ deleted: true });
  });

  // Call Logs API
  app.post('/api/calls', (req, res) => {
    const {
      accountId,
      chatId,
      contactName,
      callType,
      direction,
      duration,
      safetyFingerprint,
    } = req.body;
    const id = `call_${Date.now()}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO call_logs (id, account_id, chat_id, contact_name, call_type, direction, duration, safety_fingerprint, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      accountId || 'acc_primary',
      chatId || '',
      contactName || 'Contact',
      callType || 'voice',
      direction || 'outgoing',
      duration || '00:00',
      safetyFingerprint || '',
      nowIso
    );
    const row = db.prepare('SELECT * FROM call_logs WHERE id = ?').get(id);
    broadcast('call:created', row);
    res.json(row);
  });

  // FTS5 Full-Text Search Endpoint
  app.get('/api/search', (req, res) => {
    const accountId = (req.query.accountId as string) || 'acc_primary';
    const q = ((req.query.q as string) || '').trim();
    if (!q) {
      res.json([]);
      return;
    }
    try {
      const safeFts = q.replace(/["']/g, '') + '*';
      const rows = db
        .prepare(
          `SELECT m.* FROM messages_fts f
           JOIN messages m ON m.id = f.message_id
           WHERE f.account_id = ? AND messages_fts MATCH ?
           ORDER BY rank LIMIT 30`
        )
        .all(accountId, safeFts) as any[];
      res.json(rows.map(mapMessageRow));
    } catch {
      const rows = db
        .prepare(
          `SELECT * FROM messages WHERE account_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT 30`
        )
        .all(accountId, `%${q}%`) as any[];
      res.json(rows.map(mapMessageRow));
    }
  });

  // Scheduled Messages API
  app.post('/api/schedules', (req, res) => {
    const { accountId, chatId, content, scheduledFor } = req.body;
    if (!chatId || !content?.trim() || !scheduledFor) {
      res
        .status(400)
        .json({ error: 'chatId, content, and scheduledFor are required' });
      return;
    }
    const id = `sched_${Date.now()}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO scheduled_messages (id, account_id, chat_id, content, scheduled_for, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      id,
      accountId || 'acc_primary',
      chatId,
      content.trim(),
      scheduledFor,
      nowIso
    );
    const row = db
      .prepare('SELECT * FROM scheduled_messages WHERE id = ?')
      .get(id);
    broadcast('schedule:updated', row);
    res.json(row);
  });

  app.delete('/api/schedules/:id', (req, res) => {
    const { id } = req.params;
    db.prepare(
      `UPDATE scheduled_messages SET status = 'cancelled' WHERE id = ?`
    ).run(id);
    const row = db
      .prepare('SELECT * FROM scheduled_messages WHERE id = ?')
      .get(id);
    broadcast('schedule:updated', row);
    res.json(row);
  });

  // Auto-Reply Rules Engine API
  app.post('/api/autorules', (req, res) => {
    const { accountId, name, triggerType, triggerValue, replyContent } = req.body;
    if (!name?.trim() || !replyContent?.trim()) {
      res
        .status(400)
        .json({ error: 'Rule name and reply content are required' });
      return;
    }
    const id = `rule_${Date.now()}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO auto_reply_rules (id, account_id, name, trigger_type, trigger_value, reply_content, enabled, hit_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)
    `).run(
      id,
      accountId || 'acc_primary',
      name.trim(),
      triggerType || 'contains',
      (triggerValue || '').trim(),
      replyContent.trim(),
      nowIso
    );
    const row = db
      .prepare('SELECT * FROM auto_reply_rules WHERE id = ?')
      .get(id);
    broadcast('autorule:updated', row);
    res.json(row);
  });

  app.patch('/api/autorules/:id', (req, res) => {
    const { id } = req.params;
    const existing = db
      .prepare('SELECT * FROM auto_reply_rules WHERE id = ?')
      .get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    const nextEnabled = Number(!existing.enabled);
    db.prepare('UPDATE auto_reply_rules SET enabled = ? WHERE id = ?').run(
      nextEnabled,
      id
    );
    const row = db
      .prepare('SELECT * FROM auto_reply_rules WHERE id = ?')
      .get(id);
    broadcast('autorule:updated', row);
    res.json(row);
  });

  app.delete('/api/autorules/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM auto_reply_rules WHERE id = ?').run(id);
    broadcast('autorule:deleted', { id });
    res.json({ deleted: true });
  });

  // Slash Templates API
  app.post('/api/templates', (req, res) => {
    const { accountId, shortcut, title, body } = req.body;
    if (!shortcut?.trim() || !body?.trim()) {
      res.status(400).json({ error: 'Shortcut and body required' });
      return;
    }
    const cleanShortcut = shortcut.trim().startsWith('/')
      ? shortcut.trim()
      : `/${shortcut.trim()}`;
    const id = `tpl_${Date.now()}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO templates (id, account_id, shortcut, title, body, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      accountId || 'acc_primary',
      cleanShortcut,
      (title || cleanShortcut).trim(),
      body.trim(),
      nowIso
    );
    const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    broadcast('template:updated', row);
    res.json(row);
  });

  app.delete('/api/templates/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    broadcast('template:deleted', { id });
    res.json({ deleted: true });
  });

  // Power-User SQLite Query Console
  app.post('/api/sql/query', (req, res) => {
    const sql = ((req.body?.sql as string) || '').trim();
    if (!sql) {
      res.status(400).json({ error: 'SQL query is empty' });
      return;
    }
    const upper = sql.toUpperCase();
    if (
      !upper.startsWith('SELECT') &&
      !upper.startsWith('PRAGMA') &&
      !upper.startsWith('EXPLAIN')
    ) {
      res.status(400).json({
        error:
          'Only SELECT, PRAGMA, and EXPLAIN queries are permitted in the console.',
      });
      return;
    }
    try {
      const start = performance.now();
      const rows = db.prepare(sql).all();
      const durationMs = Number((performance.now() - start).toFixed(2));
      res.json({ rows, durationMs, rowCount: rows.length });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'SQL execution error' });
    }
  });

  // On-Disk Tauri v2 Project Files Inspector
  app.get('/api/tauri-files', (_req, res) => {
    const filesToRead = [
      'src-tauri/Cargo.toml',
      'src-tauri/tauri.conf.json',
      'src-tauri/capabilities/default.json',
      'src-tauri/src/main.rs',
      'src-tauri/src/lib.rs',
      'src-tauri/src/db.rs',
      'src-tauri/src/crypto.rs',
      'src-tauri/src/whatsapp_bridge.rs',
    ];
    const result = filesToRead.map((relPath) => {
      const abs = path.resolve(process.cwd(), relPath);
      const content = fs.existsSync(abs)
        ? fs.readFileSync(abs, 'utf8')
        : '// File not found';
      return { path: relPath, content };
    });
    res.json(result);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `WhisperRust Pro Companion Engine running on http://0.0.0.0:${PORT}`
    );
  });
}

startServer();
