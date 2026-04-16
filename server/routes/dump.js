const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { db, getSetting, calcPoints } = require('../database')
const { transcribeAudio } = require('../services/whisper')
const { structureTasks } = require('../services/llm')
const { sendPushToAll } = require('../services/notification')

const router = express.Router()

// ── Multer config ──────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.AUDIO_PATH || path.join(__dirname, '../../data/audio')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, `dump_${Date.now()}${path.extname(file.originalname) || '.webm'}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) return cb(null, true)
    cb(new Error('Seuls les fichiers audio sont acceptés'))
  },
})

// ── Background pipeline ────────────────────────────────────────────────────────

async function runPipeline(sessionId, filePath, skipTranscription = false, rawText = null) {
  const updateStatus = db.prepare('UPDATE sessions SET status = ? WHERE id = ?')
  const updateText = db.prepare('UPDATE sessions SET raw_text = ?, status = ? WHERE id = ?')

  try {
    let text = rawText

    if (!skipTranscription) {
      updateStatus.run('transcribing', sessionId)
      text = await transcribeAudio(filePath)
      updateText.run(text, 'structuring', sessionId)
    } else {
      updateStatus.run('structuring', sessionId)
    }

    const tasks = await structureTasks(text)

    const insertTask = db.prepare(`
      INSERT INTO tasks
        (session_id, title, description, priority, is_ludic, recurrence,
         ai_reasoning, points_value, status)
      VALUES (?, ?, ?, ?, ?, 'one_time', ?, ?, 'pending')
    `)

    const pointsPerTask = getSetting('points_per_task') || '10'

    const insertAll = db.transaction((taskList) => {
      for (const t of taskList) {
        const priority = Math.min(10, Math.max(1, parseInt(t.priority, 10) || 5))
        insertTask.run(
          sessionId,
          t.title,
          t.description || null,
          priority,
          t.is_ludic ? 1 : 0,
          t.reasoning || null,
          calcPoints(priority, pointsPerTask)
        )
      }
    })
    insertAll(tasks)

    db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('ready', sessionId)

    await sendPushToAll(
      'Brain dump prêt !',
      `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} à valider`,
      { sessionId }
    )
  } catch (err) {
    console.error(`[pipeline] Session ${sessionId} erreur:`, err.message)
    db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('error', sessionId)
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// POST /api/dump/audio
router.post('/audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier audio reçu' })
  }

  const session = db.prepare(`
    INSERT INTO sessions (audio_file_path, status) VALUES (?, 'processing')
  `).run(req.file.path)

  const sessionId = session.lastInsertRowid
  res.status(202).json({ sessionId, status: 'processing' })

  // Fire and forget — intentionally not awaited
  setImmediate(() => runPipeline(sessionId, req.file.path))
})

// POST /api/dump/text
router.post('/text', (req, res) => {
  const { text } = req.body
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Texte vide' })
  }

  const session = db.prepare(`
    INSERT INTO sessions (raw_text, status) VALUES (?, 'processing')
  `).run(text.trim())

  const sessionId = session.lastInsertRowid
  res.status(202).json({ sessionId, status: 'processing' })

  setImmediate(() => runPipeline(sessionId, null, true, text.trim()))
})

// GET /api/dump/sessions
router.get('/sessions', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)))
  const offset = (page - 1) * limit
  const status = req.query.status

  let query = `
    SELECT s.*,
           COUNT(t.id) as task_count
    FROM sessions s
    LEFT JOIN tasks t ON t.session_id = s.id
  `
  const params = []
  if (status) {
    query += ' WHERE s.status = ?'
    params.push(status)
  }
  query += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const sessions = db.prepare(query).all(...params)
  const total = db.prepare(`SELECT COUNT(*) as n FROM sessions${status ? ' WHERE status = ?' : ''}`).get(...(status ? [status] : [])).n

  res.json({ sessions, page, limit, total })
})

// GET /api/dump/sessions/:id
router.get('/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id)
  if (!session) return res.status(404).json({ error: 'Session introuvable' })

  const tasks = db.prepare('SELECT * FROM tasks WHERE session_id = ? ORDER BY id').all(req.params.id)
  res.json({ ...session, tasks })
})

// POST /api/dump/sessions/:id/validate
router.post('/sessions/:id/validate', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id)
  if (!session) return res.status(404).json({ error: 'Session introuvable' })

  const { tasks } = req.body
  if (!Array.isArray(tasks)) return res.status(400).json({ error: 'Tableau de tâches requis' })

  const deleteTask = db.prepare('DELETE FROM tasks WHERE id = ? AND session_id = ?')
  const updateTask = db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, priority = ?, is_ludic = ?,
        recurrence = ?, points_value = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND session_id = ?
  `)

  const pointsPerTask = getSetting('points_per_task') || '10'

  const validate = db.transaction((taskList) => {
    for (const t of taskList) {
      if (t._delete) {
        deleteTask.run(t.id, session.id)
      } else {
        const priority = Math.min(10, Math.max(1, parseInt(t.priority, 10) || 5))
        updateTask.run(
          t.title,
          t.description || null,
          priority,
          t.is_ludic ? 1 : 0,
          t.recurrence || 'one_time',
          calcPoints(priority, pointsPerTask),
          t.id,
          session.id
        )
      }
    }
    db.prepare("UPDATE sessions SET status = 'validated' WHERE id = ?").run(session.id)
  })
  validate(tasks)

  res.json({ ok: true })
})

module.exports = router
