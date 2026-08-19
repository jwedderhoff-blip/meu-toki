import { useEffect, useRef } from 'react'
import styles from './VoiceButton.module.css'

export function VoiceButton({ listening, interim, onStart, onStop, disabled }) {
  const rippleRef = useRef(null)

  useEffect(() => {
    if (listening && rippleRef.current) {
      rippleRef.current.style.animation = 'ripple 1.2s ease-out infinite'
    } else if (rippleRef.current) {
      rippleRef.current.style.animation = 'none'
    }
  }, [listening])

  return (
    <div className={styles.wrap}>
      {interim && (
        <p className={styles.interim}>{interim}</p>
      )}
      <div className={styles.buttonWrap}>
        <div
          ref={rippleRef}
          className={`${styles.ripple} ${listening ? styles.active : ''}`}
        />
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
      <p className={styles.hint}>
        {disabled ? 'Processando…' : listening ? 'Solte para enviar' : 'Segure para falar'}
      </p>
    </div>
  )
}

function MicIcon({ listening }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3"
        fill={listening ? '#fff' : 'currentColor'} />
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" fill="none" />
      <line x1="12" y1="17" x2="12" y2="21"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="21" x2="15" y2="21"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
