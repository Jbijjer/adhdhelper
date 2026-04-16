const express = require('express')
const { db } = require('../database')

const router = express.Router()

// GET /api/points/balance
router.get('/balance', (req, res) => {
  const balance = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM points_log').get().total
  res.json({ balance })
})

// GET /api/points/monthly — agrégation par mois sur les 12 derniers mois
router.get('/monthly', (req, res) => {
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', created_at) as month,
      SUM(points) as total
    FROM points_log
    WHERE created_at >= date('now', '-12 months')
    GROUP BY month
    HAVING SUM(points) > 0
    ORDER BY month ASC
  `).all()

  if (rows.length === 0) {
    return res.json({ months: [], best: 0 })
  }

  const best = Math.max(...rows.map((r) => r.total))

  const months = rows.map((r) => ({
    month: r.month,
    label: formatMonth(r.month),
    total: r.total,
    percent: best > 0 ? Math.round((r.total / best) * 100) : 0,
  }))

  res.json({ months, best })
})

// GET /api/points/monthly/:month/tasks — tâches complétées dans un mois donné (YYYY-MM)
router.get('/monthly/:month/tasks', (req, res) => {
  const { month } = req.params
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Format de mois invalide (YYYY-MM)' })
  }

  const rows = db.prepare(`
    SELECT t.id, t.title, t.priority, t.points_value,
           MAX(pl.created_at) as earned_at
    FROM tasks t
    JOIN points_log pl ON pl.task_id = t.id
    WHERE pl.action = 'task_completed'
      AND strftime('%Y-%m', pl.created_at) = ?
      AND t.status = 'completed'
    GROUP BY t.id
    ORDER BY earned_at DESC
  `).all(month)

  res.json({ tasks: rows })
})

function formatMonth(yyyymm) {
  const [year, month] = yyyymm.split('-')
  const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  return `${MOIS[parseInt(month, 10) - 1]} ${year}`
}

module.exports = router
