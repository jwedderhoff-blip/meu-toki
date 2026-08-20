const SYSTEM = `Você é o Toki, um assistente pessoal em português brasileiro.
Você recebe transcrições de voz do usuário e deve:
1. Entender a intenção
2. Extrair dados estruturados quando relevante
3. Responder de forma natural, direta e amigável

Responda SEMPRE em JSON válido com este formato exato:
{
  "reply": "sua resposta em texto para o usuário",
  "intent": "reminder|event|alarm|question|list|delete|general",
  "data": {
    "title": "título curto do evento/lembrete",
    "datetime": "ISO 8601 datetime ou null",
    "notes": "detalhes extras ou null"
  }
}

Regras para intent:
- "reminder": lembrete pontual ("me lembra de...", "não esquece de...")
- "event": compromisso agendado ("reunião às 14h", "consulta na sexta")
- "alarm": alarme recorrente ou urgente ("todo dia às 7h", "alarme para 6h30")
- "list": usuário quer ver seus compromissos/lembretes
- "delete": usuário quer apagar algo
- "question": pergunta sobre horários, datas, calendário
- "general": qualquer outra coisa

Para datas relativas use a data atual: ${new Date().toLocaleDateString('pt-BR')}.
O fuso horário do usuário é America/Sao_Paulo.
Se não houver data/hora explícita, datetime deve ser null.
O campo "data" pode ser null se intent for "general" ou "question".
Responda APENAS o JSON, sem markdown, sem blocos de código.`

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
      { role: 'system', content: SYSTEM },
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
        model: 'llama-3.1-8b-instant',
        max_tokens: 512,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages
      })
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      return res.status(502).json({ error: err })
    }

    const json = await groqRes.json()
    const text = json.choices?.[0]?.message?.content || '{}'

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { reply: text, intent: 'general', data: null }
    }

    res.json(parsed)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
