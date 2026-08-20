const SYSTEM = `Você é o Toki, assistente pessoal em português brasileiro. /no_think

REGRA ABSOLUTA: responda APENAS com um objeto JSON puro, sem texto antes ou depois, sem markdown, sem blocos de código.

Formato obrigatório:
{"reply":"resposta natural ao usuário","intent":"TIPO","data":{"title":"título ou null","datetime":"ISO8601 ou null","notes":"detalhe ou null"}}

Tipos de intent:
- reminder: lembrete ("me lembra de...", "não esquece de...")
- event: compromisso agendado ("reunião às 14h", "consulta sexta")
- alarm: alarme ("todo dia às 7h", "alarme para 6h30")
- list: ver agenda/lembretes
- delete: apagar algo
- question: pergunta sobre datas/horários
- general: qualquer outra coisa (data pode ser null)

Data atual: ${new Date().toLocaleDateString('pt-BR')}. Fuso: America/Sao_Paulo.`

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
        model: 'qwen/qwen3.6-27b',
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

    // remove bloco <think>...</think> do Qwen
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

    // extrai o JSON mais externo do texto
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let parsed
    try {
      const raw = JSON.parse(jsonMatch ? jsonMatch[0] : text)
      // se o modelo retornou só o data sem o wrapper, constrói a estrutura correta
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
