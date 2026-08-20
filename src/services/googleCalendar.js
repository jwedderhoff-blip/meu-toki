const SCOPE = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ')
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const TOKI_TAG = '[toki]'

let tokenClient = null
let _token = null
let _onConnect = null

function saveToken(token) {
  _token = token
  localStorage.setItem('gcal_token', JSON.stringify({
    token,
    expiry: Date.now() + 55 * 60 * 1000
  }))
  // Compartilha token com Google Tasks
  import('./googleTasks.js').then(m => m.setTasksToken(token))
}

function clearToken() {
  _token = null
  localStorage.removeItem('gcal_token')
  _onConnect?.(false)
}

function refreshToken() {
  return new Promise((resolve) => {
    if (!tokenClient) { resolve(false); return }
    tokenClient._cb_resolve = resolve
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

export function initGoogleCalendar(onConnectChange) {
  _onConnect = onConnectChange

  const tryInit = () => {
    if (!window.google?.accounts?.oauth2 || !CLIENT_ID) return

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        const resolve = tokenClient._cb_resolve
        tokenClient._cb_resolve = null
        if (resp.access_token) {
          saveToken(resp.access_token)
          onConnectChange(true)
          resolve?.(true)
        } else {
          clearToken()
          resolve?.(false)
        }
      },
      error_callback: () => {
        const resolve = tokenClient._cb_resolve
        tokenClient._cb_resolve = null
        clearToken()
        resolve?.(false)
      }
    })

    // Restaura token salvo se ainda válido
    const saved = localStorage.getItem('gcal_token')
    if (saved) {
      try {
        const { token, expiry } = JSON.parse(saved)
        if (expiry && Date.now() < expiry) {
          _token = token
          import('./googleTasks.js').then(m => m.setTasksToken(token))
          onConnectChange(true)
        } else {
          localStorage.removeItem('gcal_token')
        }
      } catch {
        localStorage.removeItem('gcal_token')
      }
    }
  }

  if (window.google?.accounts) tryInit()
  else window.addEventListener('load', tryInit)
}

export function connectGoogle() {
  if (!tokenClient) return
  tokenClient.requestAccessToken({ prompt: '' })
}

export function disconnectGoogle() {
  if (_token) window.google?.accounts?.oauth2?.revoke(_token)
  clearToken()
}

export function isGoogleConnected() {
  return !!_token
}

async function gcalFetch(url, options = {}) {
  let res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${_token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  if (res.status === 401) {
    const ok = await refreshToken()
    if (!ok) return null
    res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${_token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    })
  }

  return res
}

// Busca eventos do Google Agenda criados pelo Toki (próximos 90 dias + passados 30 dias)
// Busca perfil do usuário logado
export async function fetchUserProfile() {
  if (!_token) return null
  const res = await gcalFetch('https://www.googleapis.com/oauth2/v2/userinfo')
  if (!res || !res.ok) return null
  const { name, email, picture } = await res.json()
  const profile = { name, email, picture }
  localStorage.setItem('toki_user', JSON.stringify(profile))
  return profile
}

// period: 'today' | 'tomorrow' | 'week' | 'month' | 'all'
export async function fetchFromGoogleCalendar(period = 'all') {
  if (!_token) return null

  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const endOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)

  let timeMin, timeMax
  if (period === 'today') {
    timeMin = startOfDay(now).toISOString()
    timeMax = endOfDay(now).toISOString()
  } else if (period === 'tomorrow') {
    const tom = new Date(now); tom.setDate(now.getDate() + 1)
    timeMin = startOfDay(tom).toISOString()
    timeMax = endOfDay(tom).toISOString()
  } else if (period === 'week') {
    timeMin = now.toISOString()
    timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  } else if (period === 'month') {
    timeMin = now.toISOString()
    timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  } else {
    timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  }

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50'
  })

  const res = await gcalFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`
  )

  if (!res || !res.ok) return null

  const data = await res.json()

  // Converte formato Google → formato Toki
  return (data.items || []).map(item => {
    const desc = item.description || ''
    const withWhomMatch = desc.match(/Participantes: (.+)/)
    const notes = desc.replace(/\nParticipantes: .+/, '').replace(TOKI_TAG, '').trim()

    return {
      id: item.id,           // usa o ID do Google como ID local
      gcalId: item.id,
      title: item.summary || '(sem título)',
      datetime: item.start?.dateTime || item.start?.date,
      location: item.location || '',
      with_whom: withWhomMatch?.[1] || '',
      notes,
      type: 'event',
      createdAt: item.created
    }
  })
}

export async function pushToGoogleCalendar(event) {
  if (!_token) return false

  const descParts = [
    TOKI_TAG,
    event.notes,
    event.with_whom ? `Participantes: ${event.with_whom}` : null
  ].filter(Boolean)

  // Com horário: evento com hora exata. Sem horário: evento de dia inteiro
  let startField, endField
  if (event.datetime) {
    const startDt = new Date(event.datetime).toISOString()
    const endDt = new Date(new Date(event.datetime).getTime() + 60 * 60 * 1000).toISOString()
    startField = { dateTime: startDt, timeZone: 'America/Sao_Paulo' }
    endField   = { dateTime: endDt,   timeZone: 'America/Sao_Paulo' }
  } else {
    const today = new Date().toISOString().split('T')[0]
    startField = { date: today }
    endField   = { date: today }
  }

  const body = {
    summary: event.title,
    location: event.location || undefined,
    description: descParts.join('\n') || undefined,
    start: startField,
    end:   endField
  }

  const res = await gcalFetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    { method: 'POST', body: JSON.stringify(body) }
  )

  if (!res) return false

  if (res.ok) {
    const created = await res.json()
    return created.id  // retorna o ID do Google para sincronizar
  }

  return false
}

export async function deleteFromGoogleCalendar(gcalId) {
  if (!_token || !gcalId) return false
  const res = await gcalFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalId}`,
    { method: 'DELETE' }
  )
  return res?.status === 204
}
