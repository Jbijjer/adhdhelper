require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const webpush = require('web-push')
const { db } = require('../database')

let vapidInitialized = false

function ensureVapid() {
  if (vapidInitialized) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) {
    throw new Error('Clés VAPID manquantes — exécutez npx web-push generate-vapid-keys et renseignez le .env')
  }
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@example.com',
    pub,
    priv
  )
  vapidInitialized = true
}

/**
 * Sends a push notification to all registered subscribers.
 * Automatically removes stale subscriptions (410/404 responses).
 */
async function sendPushToAll(title, body, data = {}) {
  try {
    ensureVapid()
  } catch (err) {
    console.warn('[push] VAPID non configuré, notification ignorée:', err.message)
    return
  }

  const subs = db.prepare('SELECT * FROM push_subscriptions').all()
  if (subs.length === 0) return

  const payload = JSON.stringify({ title, body, data })
  const deleteSub = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')

  await Promise.allSettled(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      }
      try {
        await webpush.sendNotification(subscription, payload)
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          deleteSub.run(sub.endpoint)
        } else {
          console.error(`Push failed for ${sub.endpoint}:`, err.message)
        }
      }
    })
  )
}

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null
}

module.exports = { sendPushToAll, getVapidPublicKey }
