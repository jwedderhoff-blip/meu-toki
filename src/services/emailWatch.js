const WATCHES_KEY = 'toki_email_watches'
const LAST_ID_KEY = 'toki_email_last_id'

export function loadWatches() {
  try { return JSON.parse(localStorage.getItem(WATCHES_KEY) || '[]') } catch { return [] }
}

export function saveWatches(w) {
  localStorage.setItem(WATCHES_KEY, JSON.stringify(w))
}

export function addWatch({ sender, subject, label }) {
  const watches = loadWatches()
  const entry = {
    id: crypto.randomUUID(),
    sender: sender?.toLowerCase().trim() || null,
    subject: subject?.toLowerCase().trim() || null,
    label: label || sender || subject || 'email',
    createdAt: new Date().toISOString()
  }
  watches.push(entry)
  saveWatches(watches)
  return entry
}

export function removeWatch(id) {
  saveWatches(loadWatches().filter(w => w.id !== id))
}

export function getLastEmailId() {
  return localStorage.getItem(LAST_ID_KEY) || null
}

export function setLastEmailId(id) {
  if (id) localStorage.setItem(LAST_ID_KEY, id)
}

// Retorna watches que correspondem ao email
export function matchWatches(email, watches) {
  const from = email.from.toLowerCase()
  const subject = email.subject.toLowerCase()
  return watches.filter(w => {
    const senderMatch = w.sender && from.includes(w.sender)
    const subjectMatch = w.subject && subject.includes(w.subject)
    if (w.sender && w.subject) return senderMatch && subjectMatch
    return senderMatch || subjectMatch
  })
}
