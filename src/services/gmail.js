import { getToken } from './googleCalendar'

async function gmailFetch(url, options = {}) {
  const token = getToken()
  if (!token) return null
  const res = await fetch(url, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  })
  if (res.status === 401) return null
  return res
}

// Busca os N emails mais recentes
export async function fetchRecentEmails(maxResults = 8) {
  if (!getToken()) return null

  const listRes = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`
  )
  if (!listRes?.ok) return null
  const { messages = [] } = await listRes.json()
  if (!messages.length) return []

  // Busca detalhes de cada email em paralelo
  const details = await Promise.all(messages.map(async m => {
    const r = await gmailFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
    )
    if (!r?.ok) return null
    const data = await r.json()
    const headers = data.payload?.headers || []
    const get = name => headers.find(h => h.name === name)?.value || ''
    return {
      id: m.id,
      from: get('From'),
      subject: get('Subject') || '(sem assunto)',
      date: get('Date'),
      snippet: data.snippet || '',
      isUnread: data.labelIds?.includes('UNREAD')
    }
  }))

  return details.filter(Boolean)
}

// Busca o corpo completo de um email específico
export async function fetchEmailBody(messageId) {
  if (!getToken()) return null
  const res = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
  )
  if (!res?.ok) return null
  const data = await res.json()

  function extractText(payload) {
    if (!payload) return ''
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))
    }
    for (const part of payload.parts || []) {
      const text = extractText(part)
      if (text) return text
    }
    return ''
  }

  return extractText(data.payload)
}

// Envia um email via Gmail API
export async function sendEmail({ to, subject, body }) {
  if (!getToken()) return false

  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ].join('\r\n')

  const encoded = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await gmailFetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    { method: 'POST', body: JSON.stringify({ raw: encoded }) }
  )
  return res?.ok || false
}

// Marca email como lido
export async function markAsRead(messageId) {
  if (!getToken()) return
  await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    { method: 'POST', body: JSON.stringify({ removeLabelIds: ['UNREAD'] }) }
  )
}
