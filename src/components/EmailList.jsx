import styles from './EmailList.module.css'

function parseFrom(from) {
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</)
  const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/)
  return {
    name: nameMatch?.[1]?.trim() || emailMatch?.[1] || from,
    email: emailMatch?.[1] || from
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  } catch { return dateStr }
}

export function EmailList({ emails, onSelect }) {
  if (!emails?.length) return (
    <p className={styles.empty}>Nenhum email recente.</p>
  )

  return (
    <div className={styles.list}>
      {emails.map(email => {
        const { name } = parseFrom(email.from)
        return (
          <div
            key={email.id}
            className={`${styles.card} ${email.isUnread ? styles.unread : ''}`}
            onClick={() => onSelect?.(email)}
          >
            <div className={styles.row}>
              <span className={styles.sender}>{name}</span>
              <span className={styles.date}>{formatDate(email.date)}</span>
            </div>
            <div className={styles.subject}>{email.subject}</div>
            <div className={styles.snippet}>{email.snippet}</div>
          </div>
        )
      })}
    </div>
  )
}
