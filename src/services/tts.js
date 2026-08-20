function getSynth() {
  return typeof window !== 'undefined' ? window.speechSynthesis : null
}

function cleanText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*•]\s/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
}

let _voice = null

function getVoice() {
  if (_voice) return _voice
  const synth = getSynth()
  if (!synth) return null
  const voices = synth.getVoices()
  _voice =
    voices.find(v => v.lang === 'pt-BR' && v.localService) ||
    voices.find(v => v.lang === 'pt-BR') ||
    voices.find(v => v.lang.startsWith('pt')) ||
    null
  return _voice
}

export function speak(text) {
  const synth = getSynth()
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
  getSynth()?.cancel()
}

export function loadVoices() {
  const synth = getSynth()
  if (!synth) return Promise.resolve([])
  return new Promise(resolve => {
    const voices = synth.getVoices()
    if (voices.length) { resolve(voices); return }
    synth.addEventListener('voiceschanged', () => resolve(synth.getVoices()), { once: true })
  })
}
