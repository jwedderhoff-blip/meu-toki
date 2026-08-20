const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function buildSystem() {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return `Você é o Toki, assistente pessoal em português brasileiro. /no_think

REGRA ABSOLUTA: responda APENAS com um objeto JSON puro, sem texto antes ou depois, sem markdown, sem blocos de código.

Formato obrigatório (substitua cada campo pelo valor real, nunca use reticências):
{"reply":"[texto da resposta]","intent":"[tipo]","data":{"title":"[título do evento]","datetime":"[2026-MM-DDTHH:mm:ss ou null]","location":"[local ou null]","with_whom":"[participantes ou null]","notes":"[observações ou null]"}}

Exemplo correto:
{"reply":"Reunião agendada para amanhã às 19h!","intent":"event","data":{"title":"Reunião de negócios","datetime":"2026-08-20T19:00:00","location":"Sala de conferências","with_whom":"João","notes":null}}

Tipos de intent:
- reminder: lembrete ("me lembra de...", "não esquece de...")
- event: compromisso agendado ("reunião às 14h", "consulta sexta")
- alarm: alarme ("todo dia às 7h", "alarme para 6h30")
- list: ver agenda/lembretes
- delete: apagar algo
- question: pergunta sobre datas/horários
- general: qualquer outra coisa (data pode ser null)

Para eventos (event/reminder): extraia o máximo de detalhes da fala — assunto, local, com quem.
Se faltar informação importante (sem data/hora para event), pergunte na reply de forma natural.
Seja criterioso: "reunião" sem mais detalhes deve ter reply perguntando assunto, local e participantes.

Data e hora EXATA agora: ${now} (fuso America/Sao_Paulo).
Use SEMPRE essa data para calcular datas relativas como hoje, amanhã, semana que vem.
Se não houver data/hora explícita, datetime deve ser null.`
}

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { transcript, history = [] } = req.body || {}
  if (!transcript) return res.status(400).json({ error: 'transcript obrigatório' })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' })

  try {
    const messages = [
      { role: 'system', content: buildSystem() },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: transcript }
    ]

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        max_tokens: 512,
        temperature: 0.3,
        messages
      })
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      return res.status(502).json({ error: err })
    }

    const json = await groqRes.json()
    let text = json.choices?.[0]?.message?.content || '{}'

    // remove blocos <think> e raciocínio em texto antes do JSON
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

    // procura o JSON que contém "reply" (ignora JSONs parciais do raciocínio)
    const jsonMatch = text.match(/\{"reply"[\s\S]*\}/) || text.match(/\{[\s\S]*"reply"[\s\S]*\}/)
    let parsed
    try {
      const raw = JSON.parse(jsonMatch ? jsonMatch[0] : text)
      if (!raw.reply && !raw.intent) {
        parsed = {
          reply: raw.title ? `Agendado: ${raw.title}` : 'Feito!',
          intent: raw.datetime ? 'event' : 'general',
          data: raw
        }
      } else {
        parsed = raw
      }
    } catch {
      parsed = { reply: text || 'Olá! Como posso te ajudar?', intent: 'general', data: null }
    }

    res.json(parsed)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
