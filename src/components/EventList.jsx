import styles from './EventList.module.css'

const TYPE_ICON = {
  reminder: '🔔',
  event:    '📅',
  alarm:    '⏰',
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
        {event.location && <p className={styles.meta}>📍 {event.location}</p>}
        {event.with_whom && <p className={styles.meta}>👤 {event.with_whom}</p>}
        {event.notes && <p className={styles.meta}>{event.notes}</p>}
        {event.datetime && (
          <a
            href={buildGCalUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.gcal}
          >
            + Google Agenda
          </a>
        )}
      </div>
      <button
        className={styles.del}
        onClick={() => onDelete(event.id)}
        aria-label="Excluir"
      >×</button>
    </div>
  )
}

function buildGCalUrl(event) {
  const start = toGCalDate(event.datetime)
  // duração padrão: 1 hora
  const end = toGCalDate(new Date(new Date(event.datetime).getTime() + 60 * 60 * 1000).toISOString())

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || '',
    dates: `${start}/${end}`,
    details: [event.notes, event.with_whom ? `Com: ${event.with_whom}` : ''].filter(Boolean).join('\n'),
    location: event.location || '',
  })

  return `https://calendar.google.com/calendar/render?${params}`
}

function toGCalDate(dt) {
  return new Date(dt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function formatDatetime(dt) {
  return new Date(dt).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
