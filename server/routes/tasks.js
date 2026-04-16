const express = require('express')
const { db, getSetting, calcPoints } = require('../database')

const router = express.Router()

// GET /api/tasks/daily — today's suggested task (active only)
// Auto-generates a suggestion if none exists yet for today
router.get('/daily', (req, res) => {
  const today = new Date().toISOString().slice(0, 10)

  // Try to find an existing suggestion for today
  let row = db.prepare(`
    SELECT t.* FROM tasks t
    INNER JOIN daily_suggestions ds ON ds.task_id = t.id
    WHERE ds.date = ? AND t.status = 'active'
    LIMIT 1
  `).get(today)

  // If none, auto-pick the highest-priority non-ludic active task
  if (!row) {
    const task = db.prepare(`
      SELECT * FROM tasks
      WHERE is_ludic = 0
        AND status = 'active'
        AND id NOT IN (SELECT task_id FROM daily_suggestions WHERE date = ?)
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `).get(today)

    if (task) {
      db.prepare(`
        INSERT INTO daily_suggestions (task_id, reminder_count, date) VALUES (?, 0, ?)
      `).run(task.id, today)
      row = task
    }
  }

  res.json(row || null)
})

// GET /api/tasks
router.get('/', (req, res) => {
  const { status = 'active', ludic } = req.query

  let query = 'SELECT * FROM tasks WHERE 1=1'
  const params = []

  if (status) { query += ' AND status = ?'; params.push(status) }
  if (ludic !== undefined) { query += ' AND is_ludic = ?'; params.push(ludic === 'true' ? 1 : 0) }

  query += ' ORDER BY priority DESC, created_at DESC'

  res.json(db.prepare(query).all(...params))
})

// POST /api/tasks — manual creation
router.post('/', (req, res) => {
  const { title, description, priority = 5, is_ludic = false, recurrence = 'one_time' } = req.body
  if (!title) return res.status(400).json({ error: 'title est requis' })

  const pointsPerTask = getSetting('points_per_task') || '10'
  const pointsValue = calcPoints(priority, pointsPerTask)

  const result = db.prepare(`
    INSERT INTO tasks (title, description, priority, is_ludic, recurrence, status, points_value)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run(title, description || null, priority, is_ludic ? 1 : 0, recurrence, pointsValue)

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(task)
})

// PATCH /api/tasks/:id
router.patch('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' })

  const allowed = ['title', 'description', 'priority', 'is_ludic', 'recurrence', 'status', 'points_value']
  const updates = {}
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key]
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucune mise à jour valide' })
  }

  // Recalculate points when priority changes
  if ('priority' in updates && !('points_value' in req.body)) {
    const pointsPerTask = getSetting('points_per_task') || '10'
    updates.points_value = calcPoints(updates.priority, pointsPerTask)
  }

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ')
  db.prepare(`UPDATE tasks SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...Object.values(updates), req.params.id)

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id))
})

// POST /api/tasks/:id/complete
router.post('/:id/complete', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' })
  if (task.status === 'completed') {
    return res.status(400).json({ error: 'Tâche déjà complétée' })
  }

  const complete = db.transaction(() => {
    db.prepare(`
      UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(task.id)

    db.prepare(`
      INSERT INTO points_log (task_id, points, action) VALUES (?, ?, 'task_completed')
    `).run(task.id, task.points_value)

    const today = new Date().toISOString().slice(0, 10)
    db.prepare(`
      UPDATE daily_suggestions SET completed = 1
      WHERE task_id = ? AND date = ? AND completed = 0
    `).run(task.id, today)
  })
  complete()

  const balance = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM points_log').get().total
  res.json({ pointsEarned: task.points_value, newBalance: balance })
})

// POST /api/tasks/:id/uncomplete
router.post('/:id/uncomplete', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' })
  if (task.status !== 'completed') {
    return res.status(400).json({ error: 'Tâche non complétée' })
  }

  const uncomplete = db.transaction(() => {
    db.prepare(`
      UPDATE tasks SET status = 'active', completed_at = NULL,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(task.id)

    db.prepare(`
      INSERT INTO points_log (task_id, points, action) VALUES (?, ?, 'task_uncompleted')
    `).run(task.id, -task.points_value)
  })
  uncomplete()

  const balance = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM points_log').get().total
  res.json({ pointsRemoved: task.points_value, newBalance: balance })
})

// DELETE /api/tasks/:id — soft delete
router.delete('/:id', (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ error: 'Tâche introuvable' })

  db.prepare("UPDATE tasks SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(req.params.id)

  res.json({ ok: true })
})

module.exports = router
