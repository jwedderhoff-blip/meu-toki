const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

let tokenClient = null
let _token = null
let _onConnect = null

export function initGoogleCalendar(onConnectChange) {
  _onConnect = onConnectChange

  // Restaura token salvo
  const saved = localStorage.getItem('gcal_token')
  if (saved) {
    _token = saved
    onConnectChange(true)
  }

  // Aguarda o script do Google carregar
  const tryInit = () => {
    if (!window.google?.accounts?.oauth2 || !CLIENT_ID) return

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.access_token) {
          _token = resp.access_token
          localStorage.setItem('gcal_token', resp.access_token)
          onConnectChange(true)
        }
      },
      error_callback: () => onConnectChange(false)
    })
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
  _token = null
  localStorage.removeItem('gcal_token')
  _onConnect?.(false)
}

export function isGoogleConnected() {
  return !!_token
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

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  )

  if (res.status === 401) {
    // Token expirado — desconecta para o usuário reconectar
    _token = null
    localStorage.removeItem('gcal_token')
    _onConnect?.(false)
    return false
  }

  return res.ok
}
