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

// Compartilha texto via Web Share API (abre WhatsApp, Telegram, etc.)
export async function shareText(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
      // fallthrough para WhatsApp direto
    }
  }
  // Fallback: abre WhatsApp web/app diretamente
  return openWhatsApp(text)
}

// Abre WhatsApp com texto pré-preenchido (número opcional)
export function openWhatsApp(text, phone = '') {
  const encoded = encodeURIComponent(text)
  const url = phone
    ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`
  window.open(url, '_blank')
  return 'whatsapp'
}

// Formata um evento para compartilhar
export function formatEventForShare(event) {
  const lines = [`📅 *${event.title}*`]
  if (event.datetime) {
    const dt = new Date(event.datetime).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'full',
      timeStyle: 'short'
    })
    lines.push(`🕐 ${dt}`)
  }
  if (event.location) lines.push(`📍 ${event.location}`)
  if (event.with_whom) lines.push(`👤 ${event.with_whom}`)
  if (event.notes) lines.push(`📝 ${event.notes}`)
  lines.push('\n_Enviado pelo Toki_')
  return lines.join('\n')
}

// Formata uma nota/lista para compartilhar
export function formatNoteForShare(note) {
  const lines = [`📝 *${note.title}*\n`]
  if (note.items?.length) {
    note.items.forEach(i => lines.push(`${i.done ? '✅' : '⬜'} ${i.text}`))
  } else if (note.content) {
    lines.push(note.content)
  }
  lines.push('\n_Enviado pelo Toki_')
  return lines.join('\n')
}
