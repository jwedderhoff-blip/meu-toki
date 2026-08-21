import { useState, useEffect, useRef } from 'react'
import { fetchCalendarForDate } from '../services/googleCalendar'
import styles from './CalendarDayView.module.css'

const HOUR_H = 64   // px per hour
const START  = 6    // 06:00
const END    = 22   // 22:00
const HOURS  = Array.from({ length: END - START }, (_, i) => START + i)

function toKey(date) {
  return date.toLocaleDateString('sv-SE') // yyyy-mm-dd
}

function eventTop(dt) {
  const d = new Date(dt)
  return (d.getHours() + d.getMinutes() / 60 - START) * HOUR_H
}

function eventHeight(start, end) {
  if (!end) return HOUR_H
  const diff = (new Date(end) - new Date(start)) / 3600000
  return Math.max(diff * HOUR_H, 28)
}

export function CalendarDayView({ connected }) {
  const [date, setDate]     = useState(new Date())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const nowRef    = useRef(null)

  const key = toKey(date)
  const isToday = key === toKey(new Date())

  useEffect(() => {
    if (!connected) return
    setLoading(true)
    fetchCalendarForDate(key).then(evs => {
      setEvents(evs || [])
      setLoading(false)
    })
  }, [key, connected])

  // Scroll to current time indicator on load
  useEffect(() => {
    if (!isToday) return
    const now = new Date()
    const top = (now.getHours() + now.getMinutes() / 60 - START) * HOUR_H
    scrollRef.current?.scrollTo({ top: Math.max(0, top - 120), behavior: 'smooth' })
  }, [isToday, loading])

  const goDay = (d) => { const n = new Date(date); n.setDate(n.getDate() + d); setDate(n) }

  const allDay = events.filter(e => e.datetime && !e.datetime.includes('T'))
  const timed  = events.filter(e => e.datetime &&  e.datetime.includes('T'))

  const nowMinutes = isToday
    ? (new Date().getHours() + new Date().getMinutes() / 60 - START) * HOUR_H
    : -1

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.nav} onClick={() => goDay(-1)}>‹</button>
        <div className={styles.dateInfo}>
          <span className={styles.weekday}>
            {date.toLocaleDateString('pt-BR', { weekday: 'long' })}
          </span>
          <span className={`${styles.dayNum} ${isToday ? styles.today : ''}`}>
            {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
          </span>
        </div>
        <button className={styles.nav} onClick={() => goDay(1)}>›</button>
        {!isToday && (
          <button className={styles.todayBtn} onClick={() => setDate(new Date())}>Hoje</button>
        )}
      </div>

      {/* All-day events */}
      {allDay.length > 0 && (
        <div className={styles.allDayBar}>
          {allDay.map(ev => (
            <span key={ev.id} className={styles.allDayChip}>{ev.title}</span>
          ))}
        </div>
      )}

      {/* Timeline scroll area */}
      <div className={styles.scrollArea} ref={scrollRef}>
        {!connected && (
          <p className={styles.empty}>Conecte sua conta Google para ver o calendário.</p>
        )}
        {connected && loading && (
          <p className={styles.empty}>Carregando…</p>
        )}
        {connected && !loading && (
          <div className={styles.timeline} style={{ height: HOURS.length * HOUR_H }}>
            {/* Hour grid lines */}
            {HOURS.map(h => (
              <div key={h} className={styles.hourRow} style={{ top: (h - START) * HOUR_H }}>
                <span className={styles.hourLabel}>{String(h).padStart(2, '0')}h</span>
                <div className={styles.hourLine} />
              </div>
            ))}

            {/* Current time line */}
            {nowMinutes >= 0 && (
              <div className={styles.nowLine} style={{ top: nowMinutes }} ref={nowRef}>
                <div className={styles.nowDot} />
              </div>
            )}

            {/* Events */}
            {timed.length === 0 && (
              <p className={styles.noEvents}>Nenhum evento com horário.</p>
            )}
            {timed.map(ev => {
              const top = eventTop(ev.datetime)
              const height = eventHeight(ev.datetime, ev.endDatetime)
              if (top > HOURS.length * HOUR_H || top + height < 0) return null
              return (
                <div
                  key={ev.id}
                  className={styles.event}
                  style={{ top: Math.max(0, top), height, minHeight: 28 }}
                >
                  <span className={styles.evTime}>
                    {new Date(ev.datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {ev.endDatetime && ` – ${new Date(ev.endDatetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                  <span className={styles.evTitle}>{ev.title}</span>
                  {ev.location && <span className={styles.evLoc}>📍 {ev.location}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
