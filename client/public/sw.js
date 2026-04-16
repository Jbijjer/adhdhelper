// ADHDHelper Service Worker
// Handles web push notifications and notification click actions.

self.addEventListener('push', (event) => {
  let payload = { title: 'ADHDHelper', body: '', data: {} }

  if (event.data) {
    try {
      payload = JSON.parse(event.data.text())
    } catch {}
  }

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
    actions: payload.data?.taskId
      ? [
          { action: 'view',     title: 'Voir la tâche' },
          { action: 'complete', title: 'Marquer complétée' },
        ]
      : [],
    vibrate: [100, 50, 100],
    requireInteraction: false,
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { taskId } = event.notification.data || {}

  if (event.action === 'complete' && taskId) {
    fetch(`/api/tasks/${taskId}/complete`, { method: 'POST' }).catch(() => {})
  }

  // Toujours ouvrir l'onglet des tâches
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          client.navigate('/tasks')
          return
        }
      }
      return clients.openWindow('/tasks')
    })
  )
})
