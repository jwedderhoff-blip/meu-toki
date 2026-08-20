const synth = window.speechSynthesis

// Remove markdown antes de falar
function cleanText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // **negrito**
    .replace(/\*(.*?)\*/g, '$1')        // *itálico*
    .replace(/__(.*?)__/g, '$1')
    .replace(/`[^`]+`/g, '')            // código inline
    .replace(/#{1,6}\s/g, '')           // títulos
    .replace(/!\[.*?\]\(.*?\)/g, '')    // imagens
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*•]\s/gm, '')          // listas
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
}

let _voice = null

function getVoice() {
  if (_voice) return _voice
  const voices = synth.getVoices()
  _voice =
    voices.find(v => v.lang === 'pt-BR' && v.localService) ||
    voices.find(v => v.lang === 'pt-BR') ||
    voices.find(v => v.lang.startsWith('pt')) ||
    null
  return _voice
}

// Fala o texto. Cancela fala anterior automaticamente.
export function speak(text) {
  if (!synth) return
  synth.cancel()
  const clean = cleanText(text)
  if (!clean) return

  const utt = new SpeechSynthesisUtterance(clean)
  utt.lang = 'pt-BR'
  utt.rate = 1.05
  utt.pitch = 1.0
  const voice = getVoice()
  if (voice) utt.voice = voice
  synth.speak(utt)
}

export function stopSpeaking() {
  synth?.cancel()
}

export function isSpeaking() {
  return synth?.speaking || false
}

// Carrega vozes (algumas plataformas carregam assíncronamente)
export function loadVoices() {
  return new Promise(resolve => {
    const voices = synth.getVoices()
    if (voices.length) { resolve(voices); return }
    synth.addEventListener('voiceschanged', () => resolve(synth.getVoices()), { once: true })
  })
}
