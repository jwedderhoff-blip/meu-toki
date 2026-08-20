const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

let tokenClient = null
let _token = null
let _onConnect = null

function saveToken(token) {
  _token = token
  localStorage.setItem('gcal_token', JSON.stringify({
    token,
    expiry: Date.now() + 55 * 60 * 1000
  }))
}

function clearToken() {
  _token = null
  localStorage.removeItem('gcal_token')
  _onConnect?.(false)
}

// Solicita novo token; resolve com true se obteve, false se falhou
function refreshToken() {
  return new Promise((resolve) => {
    if (!tokenClient) { resolve(false); return }
    const origCallback = tokenClient._cb_resolve
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

    // Restaura token salvo apenas se ainda válido
    const saved = localStorage.getItem('gcal_token')
    if (saved) {
      try {
        const { token, expiry } = JSON.parse(saved)
        if (expiry && Date.now() < expiry) {
          _token = token
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

async function postEvent(body) {
  return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

export async function pushToGoogleCalendar(event) {
  if (!_token) return false

  const startDt = new Date(event.datetime).toISOString()
  const endDt = new Date(new Date(event.datetime).getTime() + 60 * 60 * 1000).toISOString()

  const body = {
    summary: event.title,
    location: event.location || undefined,
    description: [
      event.notes,
      event.with_whom ? `Participantes: ${event.with_whom}` : null
    ].filter(Boolean).join('\n') || undefined,
    start: { dateTime: startDt, timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: endDt,   timeZone: 'America/Sao_Paulo' }
  }

  let res = await postEvent(body)

  if (res.status === 401) {
    // Token expirado — renova silenciosamente e tenta de novo
    const ok = await refreshToken()
    if (!ok) return false
    res = await postEvent(body)
  }

  return res.ok
}
