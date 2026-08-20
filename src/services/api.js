const BASE = import.meta.env.VITE_API_URL || '/api'

export async function sendToToki(transcript, history = [], context = null) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, history, context })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Erro ${res.status}`)
  }

  return res.json()
}
