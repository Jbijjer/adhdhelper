const cron = require('node-cron')
const { db, getSetting } = require('../database')
const { sendPushToAll } = require('./notification')
const { generateNotificationMessage } = require('./llm')

let dailyJob = null

/**
 * Converts a "HH:MM" time string to a cron expression.
 * e.g. "08:00" → "0 8 * * *"
 */
function timeToCron(timeStr) {
  const [hh, mm] = (timeStr || '08:00').split(':').map(Number)
  return `${mm || 0} ${hh || 8} * * *`
}

async function runDailySuggestion() {
  // Check if today is an allowed day (0=Sun, 1=Mon, ..., 6=Sat)
  const allowedDays = (getSetting('reminder_days') || '1,2,3,4,5')
    .split(',').map((d) => parseInt(d.trim(), 10))
  if (!allowedDays.includes(new Date().getDay())) return

  const today = new Date().toISOString().slice(0, 10)

  // Skip if we already sent one today
  const existing = db.prepare('SELECT id FROM daily_suggestions WHERE date = ?').get(today)
  if (existing) return

  const task = db.prepare(`
    SELECT * FROM tasks
    WHERE is_ludic = 0
      AND status = 'active'
      AND id NOT IN (
        SELECT task_id FROM daily_suggestions WHERE date = ?
      )
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
  `).get(today)

  if (!task) return

  db.prepare(`
    INSERT INTO daily_suggestions (task_id, reminder_count, date) VALUES (?, 0, ?)
  `).run(task.id, today)

  const msg = await generateNotificationMessage(task.title, 'daily')
  await sendPushToAll(msg.title, msg.body, { taskId: task.id, action: 'daily' })
}


function restartDailyJob() {
  if (dailyJob) {
    dailyJob.stop()
    dailyJob = null
  }

  const reminderHour = getSetting('reminder_hour') || '08:00'
  const cronExpr = timeToCron(reminderHour)

  dailyJob = cron.schedule(cronExpr, () => {
    runDailySuggestion().catch((err) =>
      console.error('[scheduler] Erreur rappel quotidien:', err.message)
    )
  })

  console.log(`[scheduler] Rappel quotidien programmé : ${cronExpr} (${reminderHour})`)
}

function start() {
  restartDailyJob()
}

function stop() {
  if (dailyJob) { dailyJob.stop(); dailyJob = null }
}

module.exports = { start, stop, restartDailyJob }
