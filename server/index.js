require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const express = require('express')
const cors = require('cors')
const path = require('path')

// Init DB first — triggers schema creation and settings seed
const { db } = require('./database')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/settings', require('./routes/settings'))
app.use('/api/push', require('./routes/push'))
app.use('/api/dump', require('./routes/dump'))
app.use('/api/tasks', require('./routes/tasks'))
app.use('/api/points', require('./routes/points'))

// ── Serve built React app in production ───────────────────────────────────────
const clientDist = path.join(__dirname, '../client/dist')
app.use(express.static(clientDist))

// In dev, also serve client/public directly (for sw.js, manifest.json, etc.)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../client/public')))
}

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html')
  const fallback = path.join(__dirname, '../client/index.html')
  const file = require('fs').existsSync(indexPath) ? indexPath : fallback
  res.sendFile(file)
})

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ADHDHelper running on http://localhost:${PORT}`)

  // Start cron scheduler after server is ready
  try {
    require('./services/scheduler').start()
  } catch (err) {
    console.warn('Scheduler non démarré :', err.message)
  }
})

module.exports = app
