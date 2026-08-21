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

function pickVoice(voices) {
  // Prioridade: Google pt-BR > qualquer pt-BR local > qualquer pt-BR > qualquer pt
  return (
    voices.find(v => /google/i.test(v.name) && v.lang === 'pt-BR') ||
    voices.find(v => v.lang === 'pt-BR' && v.localService) ||
    voices.find(v => v.lang === 'pt-BR') ||
    voices.find(v => v.lang.startsWith('pt')) ||
    null
  )
}

export function loadVoices() {
  const synth = getSynth()
  if (!synth) return Promise.resolve([])
  return new Promise(resolve => {
    const voices = synth.getVoices()
    if (voices.length) {
      _voice = pickVoice(voices)
      resolve(voices)
      return
    }
    synth.addEventListener('voiceschanged', () => {
      const v = synth.getVoices()
      _voice = pickVoice(v)
      resolve(v)
    }, { once: true })
  })
}

export function getAvailableVoices() {
  return getSynth()?.getVoices().filter(v => v.lang.startsWith('pt')) || []
}

export function setVoice(voice) {
  _voice = voice
}

export function speak(text, { rate = 1.0, pitch = 1.0 } = {}) {
  const synth = getSynth()
  if (!synth) return
  synth.cancel()
  const clean = cleanText(text)
  if (!clean) return

  // Divide em sentenças para soar mais natural em textos longos
  const sentences = clean.match(/[^.!?]+[.!?]*/g) || [clean]

  sentences.forEach((sentence, i) => {
    const utt = new SpeechSynthesisUtterance(sentence.trim())
    utt.lang = 'pt-BR'
    utt.rate = rate
    utt.pitch = pitch
    if (_voice) utt.voice = _voice
    synth.speak(utt)
  })
}

export function stopSpeaking() {
  getSynth()?.cancel()
}

export function isSpeaking() {
  return getSynth()?.speaking || false
}
