module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const r = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
  })
  const json = await r.json()
  const ids = (json.data || []).map(m => m.id).sort()
  res.json(ids)
}
