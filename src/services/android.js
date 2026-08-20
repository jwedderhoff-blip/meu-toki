// Integração Android via Android Intent URLs (funciona no Chrome Android)

export function isAndroid() {
  return /android/i.test(navigator.userAgent)
}

// Abre app Relógio com alarme pré-preenchido
export function openAndroidAlarm({ hour, minute, message }) {
  if (!isAndroid()) return false

  const params = [
    'action=android.intent.action.SET_ALARM',
    `i.android.intent.extra.alarm.HOUR=${hour}`,
    `i.android.intent.extra.alarm.MINUTES=${minute}`,
    message ? `S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(message)}` : '',
    'B.android.intent.extra.alarm.SKIP_UI=false'
  ].filter(Boolean).join(';')

  window.location.href = `intent://alarm/create#Intent;scheme=alarm;${params};end`
  return true
}

// Abre app Relógio com cronômetro pré-preenchido
export function openAndroidTimer(seconds, message) {
  if (!isAndroid()) return false

  const params = [
    'action=android.intent.action.SET_TIMER',
    `i.android.intent.extra.TIMER_LENGTH_SECONDS=${seconds}`,
    message ? `S.android.intent.extra.TIMER_MESSAGE=${encodeURIComponent(message)}` : '',
    'B.android.intent.extra.SKIP_UI=false'
  ].filter(Boolean).join(';')

  window.location.href = `intent://timer/create#Intent;scheme=timer;${params};end`
  return true
}

// Extrai hora e minuto de uma string datetime ISO
export function extractTime(datetime) {
  if (!datetime) return null
  const d = new Date(datetime)
  return { hour: d.getHours(), minute: d.getMinutes() }
}

// Formata segundos para leitura humana
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}min`)
  if (s && !h) parts.push(`${s}s`)
  return parts.join(' ')
}

// Solicita wake lock para manter tela acesa durante timer
export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      return await navigator.wakeLock.request('screen')
    }
  } catch { /* silencia — recurso opcional */ }
  return null
}

// Compartilha texto via Web Share API (integra com WhatsApp, etc.)
export async function shareText(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return true
    } catch { return false }
  }
  // Fallback: copia para área de transferência
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch { return false }
}
