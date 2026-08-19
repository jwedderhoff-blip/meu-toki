const KEY = 'toki_events'

export function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveEvents(events) {
  localStorage.setItem(KEY, JSON.stringify(events))
}

export function addEvent(event) {
  const events = loadEvents()
  const newEvent = { ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  events.unshift(newEvent)
  saveEvents(events)
  return newEvent
}

export function deleteEvent(id) {
  const events = loadEvents().filter(e => e.id !== id)
  saveEvents(events)
}

export function updateEvent(id, patch) {
  const events = loadEvents().map(e => e.id === id ? { ...e, ...patch } : e)
  saveEvents(events)
}
