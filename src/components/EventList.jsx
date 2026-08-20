import styles from './EventList.module.css'

const TYPE_ICON = {
  reminder: '🔔',
  event:    '📅',
  alarm:    '⏰',
}

const TYPE_LABEL = {
  reminder: 'Lembrete',
  event:    'Evento',
  alarm:    'Alarme',
}

export function EventList({ events, onDelete }) {
  if (!events.length) return null

  const upcoming = events.filter(e => !e.datetime || new Date(e.datetime) >= new Date())
  const past = events.filter(e => e.datetime && new Date(e.datetime) < new Date())

  return (
    <div className={styles.wrap}>
      <h3 className={styles.heading}>Agendamentos</h3>
      {upcoming.map(ev => (
        <EventCard key={ev.id} event={ev} onDelete={onDelete} />
      ))}
      {past.length > 0 && (
        <>
          <p className={styles.pastLabel}>Anteriores</p>
          {past.map(ev => (
            <EventCard key={ev.id} event={ev} onDelete={onDelete} past />
          ))}
        </>
      )}
    </div>
  )
}

function EventCard({ event, onDelete, past }) {
  return (
    <div className={`${styles.card} ${past ? styles.past : ''}`}>
      <span className={styles.icon}>{TYPE_ICON[event.type] || '📌'}</span>
      <div className={styles.info}>
        <p className={styles.title}>{event.title}</p>
        {event.datetime && (
          <p className={styles.dt}>{formatDatetime(event.datetime)}</p>
        )}
        {event.location && <p className={styles.notes}>📍 {event.location}</p>}
        {event.with_whom && <p className={styles.notes}>👤 {event.with_whom}</p>}
        {event.notes && <p className={styles.notes}>{event.notes}</p>}
      </div>
      <button
        className={styles.del}
        onClick={() => onDelete(event.id)}
        aria-label="Excluir"
      >×</button>
    </div>
  )
}

function formatDatetime(dt) {
  return new Date(dt).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
