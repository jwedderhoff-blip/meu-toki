import { shareText, formatEventForShare } from '../services/android'
import styles from './EventList.module.css'

const TYPE_ICON = { reminder: '🔔', event: '📅', alarm: '⏰' }

export function EventList({ events, onDelete }) {
  if (!events.length) return null

  const upcoming = events.filter(e => !e.datetime || new Date(e.datetime) >= new Date())
  const past = events.filter(e => e.datetime && new Date(e.datetime) < new Date())

  return (
    <div className={styles.wrap}>
      {upcoming.map(ev => <EventCard key={ev.id} event={ev} onDelete={onDelete} />)}
      {past.length > 0 && (
        <>
          <p className={styles.pastLabel}>Anteriores</p>
          {past.map(ev => <EventCard key={ev.id} event={ev} onDelete={onDelete} past />)}
        </>
      )}
    </div>
  )
}

function EventCard({ event, onDelete, past }) {
  const handleShare = () => shareText(event.title, formatEventForShare(event))

  return (
    <div className={`${styles.card} ${past ? styles.past : ''}`}>
      <span className={styles.icon}>{TYPE_ICON[event.type] || '📌'}</span>
      <div className={styles.info}>
        <p className={styles.title}>{event.title}</p>
        {event.datetime && <p className={styles.dt}>{formatDatetime(event.datetime)}</p>}
        {event.location && <p className={styles.meta}>📍 {event.location}</p>}
        {event.with_whom && <p className={styles.meta}>👤 {event.with_whom}</p>}
        {event.notes && <p className={styles.meta}>{event.notes}</p>}
        <div className={styles.actions}>
          <button className={styles.shareBtn} onClick={handleShare} title="Compartilhar">
            <ShareIcon /> Compartilhar
          </button>
        </div>
      </div>
      <button className={styles.del} onClick={() => onDelete(event.id)} aria-label="Excluir">×</button>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}

function formatDatetime(dt) {
  return new Date(dt).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
