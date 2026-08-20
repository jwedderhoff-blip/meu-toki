import { useEffect, useRef, useCallback, useState } from 'react'

const WAKE_WORDS = ['ei toki', 'oi toki', 'hey toki', 'e toki', 'ei toque', 'oi toque']

// Toca um beep curto via Web Audio API para confirmar detecção
function playWakeBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.18)
  } catch {}
}

export function useWakeWord({ enabled, onWake }) {
  const recRef = useRef(null)
  const enabledRef = useRef(enabled)
  const restartRef = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => { enabledRef.current = enabled }, [enabled])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR || !enabledRef.current) return

    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = true
    recRef.current = rec

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.toLowerCase().trim()
        const hit = WAKE_WORDS.find(w => text.includes(w))
        if (!hit) continue

        // Extrai comando que veio junto com a wake word (ex: "Ei Toki, qual minha agenda")
        const after = text.slice(text.indexOf(hit) + hit.length).replace(/^[,\s]+/, '').trim()
        playWakeBeep()
        navigator.vibrate?.(150)
        rec.stop()
        onWake(after)
        return
      }
    }

    rec.onend = () => {
      setActive(false)
      if (enabledRef.current) {
        restartRef.current = setTimeout(startListening, 400)
      }
    }

    rec.onerror = (e) => {
      setActive(false)
      if (e.error === 'not-allowed') return // microfone negado — não reinicia
      if (enabledRef.current && e.error !== 'aborted') {
        restartRef.current = setTimeout(startListening, 1200)
      }
    }

    try { rec.start(); setActive(true) } catch {}
  }, [onWake])

  useEffect(() => {
    if (enabled) {
      startListening()
    } else {
      clearTimeout(restartRef.current)
      recRef.current?.stop()
      setActive(false)
    }
    return () => {
      clearTimeout(restartRef.current)
      recRef.current?.stop()
    }
  }, [enabled, startListening])

  return { active }
}
