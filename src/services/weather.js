const WMO = {
  0:  { label: 'Céu limpo',         icon: '☀️' },
  1:  { label: 'Predominantemente limpo', icon: '🌤️' },
  2:  { label: 'Parcialmente nublado', icon: '⛅' },
  3:  { label: 'Nublado',            icon: '☁️' },
  45: { label: 'Neblina',           icon: '🌫️' },
  48: { label: 'Neblina com geada', icon: '🌫️' },
  51: { label: 'Garoa leve',        icon: '🌦️' },
  53: { label: 'Garoa moderada',    icon: '🌦️' },
  55: { label: 'Garoa intensa',     icon: '🌧️' },
  61: { label: 'Chuva leve',        icon: '🌧️' },
  63: { label: 'Chuva moderada',    icon: '🌧️' },
  65: { label: 'Chuva intensa',     icon: '🌧️' },
  71: { label: 'Neve leve',         icon: '🌨️' },
  73: { label: 'Neve moderada',     icon: '❄️' },
  75: { label: 'Neve intensa',      icon: '❄️' },
  80: { label: 'Pancadas de chuva leve',    icon: '🌦️' },
  81: { label: 'Pancadas de chuva',         icon: '🌧️' },
  82: { label: 'Pancadas de chuva forte',   icon: '⛈️' },
  95: { label: 'Tempestade',        icon: '⛈️' },
  96: { label: 'Tempestade com granizo', icon: '⛈️' },
  99: { label: 'Tempestade com granizo forte', icon: '⛈️' },
}

function wmo(code) {
  return WMO[code] || { label: 'Condição desconhecida', icon: '🌡️' }
}

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocalização não suportada')); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      e => reject(new Error(e.code === 1 ? 'Permissão de localização negada' : 'Não foi possível obter sua localização'))
    )
  })
}

async function getCity(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
      headers: { 'Accept-Language': 'pt-BR' }
    })
    const d = await r.json()
    return d.address?.city || d.address?.town || d.address?.village || d.address?.county || ''
  } catch { return '' }
}

export async function fetchWeather() {
  const { lat, lon } = await getLocation()

  const [weatherRes, city] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
      `&timezone=America%2FSao_Paulo&forecast_days=4`
    ),
    getCity(lat, lon)
  ])

  if (!weatherRes.ok) throw new Error('Erro ao buscar dados do clima')
  const data = await weatherRes.json()
  const c = data.current
  const d = data.daily

  const days = ['hoje', 'amanhã', 'depois de amanhã', 'em 3 dias']
  const weekday = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const forecast = d.time.slice(0, 4).map((date, i) => ({
    label: days[i] || weekday[new Date(date + 'T12:00:00').getDay()],
    max: Math.round(d.temperature_2m_max[i]),
    min: Math.round(d.temperature_2m_min[i]),
    rain: d.precipitation_probability_max[i],
    ...wmo(d.weather_code[i])
  }))

  return {
    city,
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    wind: Math.round(c.wind_speed_10m),
    ...wmo(c.weather_code),
    forecast
  }
}

export function formatWeather(w) {
  const loc = w.city ? `📍 **${w.city}**\n` : ''
  const current = `${w.icon} **${w.label}** · ${w.temp}°C (sensação ${w.feels}°C)\n💧 Umidade: ${w.humidity}% · 💨 Vento: ${w.wind} km/h`

  const days = w.forecast.map(d =>
    `  ${d.icon} **${d.label}**: ${d.max}°/${d.min}°${d.rain > 20 ? ` · 🌧 ${d.rain}% chuva` : ''}`
  ).join('\n')

  return `${loc}${current}\n\n📅 **Próximos dias:**\n${days}`
}
