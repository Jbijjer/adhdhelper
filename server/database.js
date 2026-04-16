require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/adhdhelper.db')

// Ensure the directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)

// WAL mode for better concurrency
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_text       TEXT,
    audio_file_path TEXT,
    status         TEXT DEFAULT 'processing'
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   INTEGER REFERENCES sessions(id),
    title        TEXT NOT NULL,
    description  TEXT,
    priority     INTEGER DEFAULT 5,
    is_ludic     BOOLEAN DEFAULT 0,
    recurrence   TEXT DEFAULT 'one_time',
    status       TEXT DEFAULT 'pending',
    ai_reasoning TEXT,
    points_value INTEGER DEFAULT 10,
    completed_at DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS points_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER REFERENCES tasks(id),
    points     INTEGER NOT NULL,
    action     TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_suggestions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id        INTEGER REFERENCES tasks(id),
    suggested_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    reminder_count INTEGER DEFAULT 0,
    completed      BOOLEAN DEFAULT 0,
    date           TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint    TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth   TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// ── Migrations ────────────────────────────────────────────────────────────────

// Migrations
try { db.exec(`ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 5`) } catch {}
try { db.exec(`ALTER TABLE tasks DROP COLUMN quadrant`) } catch {}
try { db.exec(`ALTER TABLE tasks DROP COLUMN ai_suggested_quadrant`) } catch {}

// ── Default settings (INSERT OR IGNORE so user changes are preserved) ─────────

const defaults = [
  ['litellm_url', 'http://100.64.0.1:4000'],
  ['litellm_model', 'gemma-4-light'],
  ['litellm_api_key', ''],
  ['whisper_url', 'http://localhost:9000'],
  ['reminder_hour', '08:00'],
  ['reminder_days', '1,2,3,4,5'],
  ['points_per_task', '10'],
]

const insertDefault = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
const seedDefaults = db.transaction((rows) => {
  for (const [key, value] of rows) insertDefault.run(key, value)
})
seedDefaults(defaults)

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : null
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value))
}

function calcPoints(priority, pointsPerTask) {
  return Math.round((parseInt(priority, 10) / 10) * parseInt(pointsPerTask, 10))
}

module.exports = { db, getSetting, getAllSettings, setSetting, calcPoints }
