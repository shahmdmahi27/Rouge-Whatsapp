use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountRecord {
    pub id: String,
    pub name: String,
    pub phone: String,
    pub avatar_color: String,
    pub wa_cloud_phone_id: String,
    pub wa_cloud_token: String,
    pub stealth_read_receipts: bool,
    pub stealth_presence: bool,
    pub blur_previews: bool,
    pub has_lock_pin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderRecord {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRecord {
    pub id: String,
    pub account_id: String,
    pub chat_type: String,
    pub name: String,
    pub recipient_phone: String,
    pub about: String,
    pub avatar_color: String,
    pub folder_id: Option<String>,
    pub pinned: bool,
    pub muted: bool,
    pub unread_count: i64,
    pub disappearing_timer: String,
    pub safety_number: String,
    pub ratchet_step: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRecord {
    pub id: String,
    pub chat_id: String,
    pub account_id: String,
    pub sender_id: String,
    pub sender_name: String,
    pub msg_type: String,
    pub content: String,
    pub media_data_url: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<String>,
    pub voice_duration: Option<i64>,
    pub reply_to_id: Option<String>,
    pub reactions_json: String,
    pub poll_json: Option<String>,
    pub starred: bool,
    pub status: String,
    pub cipher_hex: String,
    pub ratchet_step: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledMessageRecord {
    pub id: String,
    pub account_id: String,
    pub chat_id: String,
    pub content: String,
    pub scheduled_for: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoReplyRuleRecord {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub trigger_type: String,
    pub trigger_value: String,
    pub reply_content: String,
    pub enabled: bool,
    pub hit_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateRecord {
    pub id: String,
    pub account_id: String,
    pub shortcut: String,
    pub title: String,
    pub body: String,
}

pub struct VaultDb {
    pub conn: Connection,
}

impl VaultDb {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                avatar_color TEXT NOT NULL,
                wa_cloud_phone_id TEXT DEFAULT '',
                wa_cloud_token TEXT DEFAULT '',
                stealth_read_receipts INTEGER DEFAULT 0,
                stealth_presence INTEGER DEFAULT 0,
                blur_previews INTEGER DEFAULT 0,
                lock_pin_hash TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                chat_type TEXT NOT NULL,
                name TEXT NOT NULL,
                recipient_phone TEXT NOT NULL,
                about TEXT DEFAULT '',
                avatar_color TEXT NOT NULL,
                folder_id TEXT,
                pinned INTEGER DEFAULT 0,
                muted INTEGER DEFAULT 0,
                unread_count INTEGER DEFAULT 0,
                disappearing_timer TEXT DEFAULT 'off',
                safety_number TEXT NOT NULL,
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
                media_data_url TEXT,
                file_name TEXT,
                file_size TEXT,
                voice_duration INTEGER,
                reply_to_id TEXT,
                reactions_json TEXT DEFAULT '{}',
                poll_json TEXT,
                starred INTEGER DEFAULT 0,
                status TEXT DEFAULT 'sent',
                cipher_hex TEXT NOT NULL,
                ratchet_step INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
                message_id UNINDEXED,
                chat_id UNINDEXED,
                account_id UNINDEXED,
                content
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
                hit_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                shortcut TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL
            );"
        )?;

        Ok(Self { conn })
    }

    pub fn list_accounts(&self) -> Result<Vec<AccountRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, phone, avatar_color, wa_cloud_phone_id, wa_cloud_token,
                    stealth_read_receipts, stealth_presence, blur_previews, lock_pin_hash
             FROM accounts ORDER BY rowid ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let pin_hash: String = row.get(9)?;
            Ok(AccountRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                avatar_color: row.get(3)?,
                wa_cloud_phone_id: row.get(4)?,
                wa_cloud_token: row.get(5)?,
                stealth_read_receipts: row.get::<_, i64>(6)? != 0,
                stealth_presence: row.get::<_, i64>(7)? != 0,
                blur_previews: row.get::<_, i64>(8)? != 0,
                has_lock_pin: !pin_hash.is_empty(),
            })
        })?;
        rows.collect()
    }

    pub fn insert_account(&self, id: &str, name: &str, phone: &str, color: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO accounts (id, name, phone, avatar_color) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, phone, color],
        )?;
        Ok(())
    }
}
