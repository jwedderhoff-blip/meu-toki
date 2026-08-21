const KEY = 'toki_notes'

export function loadNotes() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

function saveNotes(notes) {
  localStorage.setItem(KEY, JSON.stringify(notes))
}

export function addNote(note) {
  const notes = loadNotes()
  const newNote = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...note
  }
  notes.unshift(newNote)
  saveNotes(notes)
  return newNote
}

export function updateNote(id, patch) {
  const notes = loadNotes().map(n =>
    n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
  )
  saveNotes(notes)
}

export function deleteNote(id) {
  saveNotes(loadNotes().filter(n => n.id !== id))
}

// Adiciona item a uma lista existente ou cria nova
export function appendToList(id, item) {
  const notes = loadNotes()
  const note = notes.find(n => n.id === id)
  if (!note) return null
  const items = [...(note.items || []), { id: crypto.randomUUID(), text: item, done: false }]
  return updateNote(id, { items })
}

export function pinNote(id) {
  const notes = loadNotes()
  const note = notes.find(n => n.id === id)
  if (!note) return
  updateNote(id, { pinned: !note.pinned })
}

export function removeListItem(noteId, itemId) {
  const notes = loadNotes()
  const note = notes.find(n => n.id === noteId)
  if (!note) return
  updateNote(noteId, { items: note.items.filter(i => i.id !== itemId) })
}

export function toggleListItem(noteId, itemId) {
  const notes = loadNotes()
  const note = notes.find(n => n.id === noteId)
  if (!note) return
  const items = note.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i)
  updateNote(noteId, { items })
}
