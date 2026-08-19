import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `Você é o Toki, um assistente pessoal em português brasileiro.
Você recebe transcrições de voz do usuário e deve:
1. Entender a intenção
2. Extrair dados estruturados quando relevante
3. Responder de forma natural, direta e amigável

Responda SEMPRE em JSON com este formato:
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
- "delete": usuário quer apagar algo (inclua id em data se souber)
- "question": pergunta sobre horários, datas, fusos, calendário
- "general": qualquer outra coisa

Para datas relativas use a data atual: ${new Date().toLocaleDateString('pt-BR')}.
O fuso horário do usuário é America/Sao_Paulo.
Se não houver data/hora explícita, datetime deve ser null.
O campo "data" pode ser null se intent for "general" ou "question".`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { transcript, history = [] } = req.body || {}
  if (!transcript) return res.status(400).json({ error: 'transcript obrigatório' })

  try {
    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: transcript }
    ]

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM,
      messages
    })

    const text = response.content[0]?.text || '{}'
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      // Claude devolveu texto fora do JSON
      parsed = { reply: text, intent: 'general', data: null }
    }

    res.json(parsed)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
