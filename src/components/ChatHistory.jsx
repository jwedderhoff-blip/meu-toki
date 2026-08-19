import { useEffect, useRef } from 'react'
import styles from './ChatHistory.module.css'

export function ChatHistory({ messages }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!messages.length) {
    return (
      <div className={styles.empty}>
        <p>Olá! Segure o botão e fale comigo.</p>
        <p className={styles.examples}>
          Exemplos: "me lembra de beber água às 8h", "agende reunião amanhã às 14h",
          "que compromissos tenho hoje?"
        </p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {messages.map((msg) => (
        <div key={msg.id} className={`${styles.msg} ${styles[msg.role]}`}>
          {msg.role === 'assistant' && <span className={styles.label}>Toki</span>}
          <p className={styles.text}>{msg.content}</p>
          {msg.role === 'user' && (
            <p className={styles.ts}>{formatTime(msg.ts)}</p>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
