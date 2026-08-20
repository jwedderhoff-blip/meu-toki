// Google Tasks API — listas de tarefas integradas ao Gmail e Google Calendar

let _token = null  // compartilhado via setter do googleCalendar

export function setTasksToken(token) { _token = token }

async function tasksFetch(url, options = {}) {
  if (!_token) return null
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${_token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  if (res.status === 401) return null
  return res
}

// Busca ou cria a lista "Toki"
let _tokiListId = null

async function getTokiList() {
  if (_tokiListId) return _tokiListId

  const res = await tasksFetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists')
  if (!res?.ok) return null
  const data = await res.json()
  const existing = (data.items || []).find(l => l.title === 'Toki')
  if (existing) { _tokiListId = existing.id; return _tokiListId }

  // Cria nova lista "Toki"
  const create = await tasksFetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    body: JSON.stringify({ title: 'Toki' })
  })
  if (!create?.ok) return null
  const newList = await create.json()
  _tokiListId = newList.id
  return _tokiListId
}

// Adiciona tarefa única (reminder/note)
export async function addGoogleTask({ title, notes, due }) {
  const listId = await getTokiList()
  if (!listId) return false

  const body = { title, notes: notes || undefined }
  if (due) body.due = new Date(due).toISOString()

  const res = await tasksFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`,
    { method: 'POST', body: JSON.stringify(body) }
  )
  return res?.ok || false
}

// Adiciona lista de itens (shopping/checklist) — cada item vira subtarefa
export async function addGoogleTaskList({ title, items }) {
  const listId = await getTokiList()
  if (!listId) return false

  // Cria tarefa-pai com o título da lista
  const parentRes = await tasksFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`,
    { method: 'POST', body: JSON.stringify({ title }) }
  )
  if (!parentRes?.ok) return false
  const parent = await parentRes.json()

  // Cria cada item como subtarefa
  for (const item of (items || [])) {
    await tasksFetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`,
      { method: 'POST', body: JSON.stringify({ title: item, parent: parent.id }) }
    )
  }
  return true
}

// Busca tarefas recentes da lista Toki
export async function fetchGoogleTasks() {
  const listId = await getTokiList()
  if (!listId) return null

  const res = await tasksFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&maxResults=50`
  )
  if (!res?.ok) return null
  const data = await res.json()
  return data.items || []
}

export function resetTasksCache() { _tokiListId = null }
