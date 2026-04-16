import { useState, useEffect } from 'react'
import { api } from './useApi'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isSupported) return
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription()
      setIsSubscribed(!!existing)
    })
  }, [isSupported])

  async function subscribe() {
    if (!isSupported) throw new Error('Push non supporté sur ce navigateur')
    setLoading(true)
    try {
      const { publicKey } = await api.get('/push/vapid-key')
      if (!publicKey) throw new Error('Clé VAPID non configurée sur le serveur')

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const json = sub.toJSON()
      await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys })
      setIsSubscribed(true)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      setIsSubscribed(false)
    } finally {
      setLoading(false)
    }
  }

  return { isSupported, isSubscribed, loading, subscribe, unsubscribe }
}
