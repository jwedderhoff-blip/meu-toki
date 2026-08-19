import { useState, useRef, useCallback } from 'react'

export function useSpeechRecognition({ onResult, onError }) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef(null)

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      onError?.('Seu navegador não suporta reconhecimento de voz.')
      return
    }

    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = true
    recRef.current = rec

    rec.onstart = () => setListening(true)
    rec.onend = () => { setListening(false); setInterim('') }

    rec.onresult = (e) => {
      let final = ''
      let temp = ''
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript
        else temp += r[0].transcript
      }
      setInterim(temp)
      if (final) onResult?.(final.trim())
    }

    rec.onerror = (e) => {
      setListening(false)
      setInterim('')
      if (e.error !== 'aborted') onError?.(e.error)
    }

    rec.start()
  }, [onResult, onError])

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  return { listening, interim, start, stop }
}
