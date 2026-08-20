const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function buildSystem() {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return `Você é o Toki, assistente pessoal em português brasileiro. /no_think

REGRA ABSOLUTA: responda APENAS com um objeto JSON puro, sem texto antes ou depois, sem markdown, sem blocos de código.

Formato obrigatório:
{"reply":"[texto]","intent":"[tipo]","data":{"title":"[título]","datetime":"[2026-MM-DDTHH:mm:ss ou null]","location":"[local ou null]","with_whom":"[participantes ou null]","notes":"[obs ou null]","duration_seconds":[número ou null],"items":[[lista de strings] ou null],"content":"[texto livre ou null]"}}

=== REGRAS PARA AGENDAMENTO (event / reminder / alarm) ===

NUNCA salve um evento incompleto. Antes de usar intent "event", "reminder" ou "alarm", você DEVE ter coletado:
1. TÍTULO — qual é o evento/compromisso?
2. DATA E HORA — quando será? (obrigatório para "event" e "alarm")
3. LOCAL — onde será? (pergunte se não informado)
4. PARTICIPANTES — quem vai estar presente? (pergunte se não informado)

Se QUALQUER uma dessas informações estiver faltando, use intent "gathering" e pergunte UMA informação por vez de forma natural e direta.
Com intent "gathering", data.title pode conter o que já foi coletado, e os campos faltantes ficam null.

Exemplo de fluxo:
Usuário: "agenda uma reunião"
→ {"reply":"Claro! Qual é o assunto da reunião?","intent":"gathering","data":{"title":null,"datetime":null,"location":null,"with_whom":null,"notes":null}}

Usuário: "reunião de planejamento"
→ {"reply":"Ótimo! Quando será e em que horário?","intent":"gathering","data":{"title":"Reunião de planejamento","datetime":null,"location":null,"with_whom":null,"notes":null}}

Usuário: "sexta às 14h"
→ {"reply":"Entendido! Onde vai acontecer?","intent":"gathering","data":{"title":"Reunião de planejamento","datetime":"2026-08-21T14:00:00","location":null,"with_whom":null,"notes":null}}

Usuário: "na sala de reuniões"
→ {"reply":"Quem vai participar?","intent":"gathering","data":{"title":"Reunião de planejamento","datetime":"2026-08-21T14:00:00","location":"Sala de reuniões","with_whom":null,"notes":null}}

Usuário: "João e Maria"
→ {"reply":"Perfeito! Reunião de planejamento na sexta às 14h na sala de reuniões com João e Maria. Agendado!","intent":"event","data":{"title":"Reunião de planejamento","datetime":"2026-08-21T14:00:00","location":"Sala de reuniões","with_whom":"João e Maria","notes":null}}

Para "reminder" simples (ex: "me lembra de tomar remédio"), local e participantes não são obrigatórios — apenas título e horário.
Para "alarm" (ex: "alarme às 7h"), apenas horário é obrigatório.

=== ALARMES E CRONÔMETROS (Android) ===
- alarm: criar alarme no relógio do Android. Extraia hour e minute do datetime. Ex: "alarme às 7h" → datetime:"2026-08-19T07:00:00"
- timer: cronômetro/temporizador. Preencha duration_seconds. Ex: "cronômetro de 5 minutos" → duration_seconds:300. "timer de 1h30" → duration_seconds:5400.
  Para timer, title deve descrever o motivo ("Cozinhar macarrão", "Exercício", etc).

=== NOTAS E LISTAS ===
- note: anotação de texto livre. Preencha title e content. Ex: "anota que preciso ligar pro médico" → intent:"note", content:"Ligar para o médico"
- shopping: lista de compras. Preencha title e items (array de strings). Ex: "lista de compras: leite, pão, ovos" → items:["Leite","Pão","Ovos"]
- checklist: lista de tarefas/afazeres. Preencha title e items. Ex: "lista de tarefas para o projeto"

=== CONSULTA ===
- list: ver agenda de compromissos
- list_notes: ver notas e listas salvas
- delete: apagar compromisso ou nota (informe id se disponível)
- question: pergunta geral
- general: conversa, qualquer outra coisa

Data e hora EXATA agora: ${now} (fuso America/Sao_Paulo).
Use SEMPRE essa data para calcular datas relativas (hoje, amanhã, semana que vem, etc).`
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
