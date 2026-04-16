const express = require('express')
const axios = require('axios')
const { getAllSettings, setSetting, getSetting } = require('../database')

const router = express.Router()

// GET /api/settings
router.get('/', (req, res) => {
  res.json(getAllSettings())
})

// PATCH /api/settings
router.patch('/', (req, res) => {
  const updates = req.body
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Corps de requête invalide' })
  }
  for (const [key, value] of Object.entries(updates)) {
    setSetting(key, value)
  }

  // Notify scheduler if timing settings changed
  const timingKeys = ['reminder_hour', 'reminder_interval_hours', 'reminder_max_count']
  if (timingKeys.some((k) => k in updates)) {
    try {
      const scheduler = require('../services/scheduler')
      scheduler.restartDailyJob()
    } catch {
      // Scheduler may not be initialized yet
    }
  }

  res.json(getAllSettings())
})

// GET /api/settings/models — proxy to LiteLLM /v1/models
// Accepts optional ?url= query param to test a URL before saving
router.get('/models', async (req, res) => {
  const url = req.query.url || getSetting('litellm_url')
  const apiKey = getSetting('litellm_api_key')
  const headers = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  try {
    const response = await axios.get(`${url}/v1/models`, { timeout: 10_000, headers })
    res.json(response.data)
  } catch (err) {
    res.status(502).json({ error: `Impossible de joindre LiteLLM : ${err.message}` })
  }
})

module.exports = router
