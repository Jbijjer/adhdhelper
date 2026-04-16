const express = require('express')
const { db } = require('../database')
const { getVapidPublicKey } = require('../services/notification')

const router = express.Router()

// GET /api/push/vapid-key
router.get('/vapid-key', (req, res) => {
  const key = getVapidPublicKey()
  if (!key) {
    return res.status(503).json({ error: 'Clé VAPID non configurée' })
  }
  res.json({ publicKey: key })
})

// POST /api/push/subscribe
router.post('/subscribe', (req, res) => {
  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Souscription invalide' })
  }

  db.prepare(`
    INSERT OR IGNORE INTO push_subscriptions (endpoint, keys_p256dh, keys_auth)
    VALUES (?, ?, ?)
  `).run(endpoint, keys.p256dh, keys.auth)

  res.status(201).json({ ok: true })
})

// POST /api/push/test
// body: { mode: 'static' | 'ai' }
router.post('/test', async (req, res) => {
  const { sendPushToAll } = require('../services/notification')
  const { generateNotificationMessage } = require('../services/llm')
  const mode = req.body?.mode || 'static'

  const subs = db.prepare('SELECT COUNT(*) as n FROM push_subscriptions').get()
  if (subs.n === 0) {
    return res.status(400).json({ error: 'Aucun appareil abonné aux notifications' })
  }

  try {
    let title, body

    if (mode === 'ai') {
      // Pick a random active task, or use a placeholder
      const task = db.prepare(`SELECT title FROM tasks WHERE status = 'active' ORDER BY RANDOM() LIMIT 1`).get()
      const taskTitle = task?.title || 'Finir un projet important'
      const msg = await generateNotificationMessage(taskTitle, 'daily')
      title = msg.title
      body = msg.body
    } else {
      title = '🧠 ADHDHelper'
      body = 'Test de notification réussi !'
    }

    await sendPushToAll(title, body, {})
    res.json({ ok: true, sent: subs.n, title, body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
