export async function requestPermission() {
  if (!('Notification' in window)) return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

export function scheduleNotification(title, body, datetime) {
  const delay = new Date(datetime).getTime() - Date.now()
  if (delay <= 0) return null

  const id = setTimeout(() => {
    if (Notification.permission === 'granted') {
      const n = new Notification(title, {
        body,
        icon: '/meu-toki/icon-192.png',
        badge: '/meu-toki/icon-192.png',
        tag: `toki-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200]
      })
      n.onclick = () => { window.focus(); n.close() }
    }
  }, delay)

  return id
}

export function cancelNotification(id) {
  if (id != null) clearTimeout(id)
}

// Restore scheduled notifications from localStorage on app start
export function restoreScheduled(events) {
  const now = Date.now()
  events.forEach(ev => {
    if (!ev.datetime) return
    const delay = new Date(ev.datetime).getTime() - now
    if (delay > 0) {
      scheduleNotification(ev.title, ev.notes || 'Lembrete Toki', ev.datetime)
    }
  })
}
