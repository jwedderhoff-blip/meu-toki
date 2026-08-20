import { useEffect, useRef, useState } from 'react'
import styles from './VoiceButton.module.css'

export function VoiceButton({ listening, interim, onStart, onStop, onText, disabled, continuous, onToggleContinuous }) {
  const rippleRef = useRef(null)
  const inputRef = useRef(null)
  const [text, setText] = useState('')

  useEffect(() => {
    if (listening && rippleRef.current) {
      rippleRef.current.style.animation = 'ripple 1.2s ease-out infinite'
    } else if (rippleRef.current) {
      rippleRef.current.style.animation = 'none'
    }
  }, [listening])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onText(trimmed)
    setText('')
    inputRef.current?.blur()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.wrap}>
      {interim && <p className={styles.interim}>{interim}</p>}

      <div className={styles.inputRow}>
        <textarea
          ref={inputRef}
          className={styles.textInput}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escreva um comando…"
          rows={1}
          disabled={disabled}
        />
        {text.trim() ? (
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={disabled}
            aria-label="Enviar"
          >
            <SendIcon />
          </button>
        ) : (
          <div className={styles.micWrap}>
            <div ref={rippleRef} className={`${styles.ripple} ${listening ? styles.active : ''}`} />
            <button
              className={`${styles.btn} ${listening ? styles.listening : ''}`}
              onPointerDown={!disabled ? onStart : undefined}
              onPointerUp={!disabled ? onStop : undefined}
              onPointerLeave={!disabled ? onStop : undefined}
              disabled={disabled}
              aria-label={listening ? 'Soltar para enviar' : 'Segurar para falar'}
            >
              <MicIcon listening={listening} />
            </button>
          </div>
        )}
      </div>

      <div className={styles.bottomRow}>
        <p className={styles.hint}>
          {disabled ? 'Processando…' : listening ? 'Solte para enviar' : 'Segure o mic ou escreva'}
        </p>
        <button
          className={`${styles.toggle} ${continuous ? styles.toggleOn : ''}`}
          onClick={onToggleContinuous}
          title={continuous ? 'Conversa contínua ativa' : 'Ativar conversa contínua'}
          aria-label="Conversa contínua"
        >
          <span className={styles.toggleTrack}>
            <span className={styles.toggleThumb} />
          </span>
          <span className={styles.toggleLabel}>Contínuo</span>
        </button>
      </div>
    </div>
  )
}

function MicIcon({ listening }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" fill={listening ? '#fff' : 'currentColor'} />
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
