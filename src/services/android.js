// Tenta abrir o app Relógio do Android com alarme/timer pré-preenchido
// Funciona no Chrome Android via Android Intent URLs

export function openAndroidAlarm({ hour, minute, message }) {
  const params = [
    'action=android.intent.action.SET_ALARM',
    `i.android.intent.extra.alarm.HOUR=${hour}`,
    `i.android.intent.extra.alarm.MINUTES=${minute}`,
    message ? `S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(message)}` : '',
    'B.android.intent.extra.alarm.SKIP_UI=false'
  ].filter(Boolean).join(';')

  const intentUrl = `intent://alarm/create#Intent;scheme=alarm;${params};end`
  window.location.href = intentUrl
}

export function openAndroidTimer(seconds, message) {
  const params = [
    'action=android.intent.action.SET_TIMER',
    `i.android.intent.extra.TIMER_LENGTH_SECONDS=${seconds}`,
    message ? `S.android.intent.extra.TIMER_MESSAGE=${encodeURIComponent(message)}` : '',
    'B.android.intent.extra.SKIP_UI=false'
  ].filter(Boolean).join(';')

  const intentUrl = `intent://timer/create#Intent;scheme=timer;${params};end`
  window.location.href = intentUrl
}

// Extrai hora e minuto de uma string datetime ISO
export function extractTime(datetime) {
  if (!datetime) return null
  const d = new Date(datetime)
  return { hour: d.getHours(), minute: d.getMinutes() }
}

// Converte "5 minutos", "1 hora 30", "90 segundos" em segundos
export function parseDuration(text) {
  if (!text) return null
  let seconds = 0
  const h = text.match(/(\d+)\s*h/i)
  const m = text.match(/(\d+)\s*min/i)
  const s = text.match(/(\d+)\s*seg/i)
  if (h) seconds += parseInt(h[1]) * 3600
  if (m) seconds += parseInt(m[1]) * 60
  if (s) seconds += parseInt(s[1])
  return seconds > 0 ? seconds : null
}
