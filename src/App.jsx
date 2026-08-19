import { useState, useCallback, useEffect } from 'react'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { sendToToki } from './services/api'
import { addEvent, deleteEvent, loadEvents } from './services/storage'
import { requestPermission, scheduleNotification, restoreScheduled } from './services/notifications'
import { VoiceButton } from './components/VoiceButton'
import { ChatHistory } from './components/ChatHistory'
import { EventList } from './components/EventList'
import styles from './App.module.css'

export default function App() {
  const [messages, setMessages] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('chat') // 'chat' | 'events'
  const [error, setError] = useState(null)

  useEffect(() => {
    const evs = loadEvents()
    setEvents(evs)
    restoreScheduled(evs)
    requestPermission()
  }, [])

  const addMsg = (role, content) => {
    const msg = { id: crypto.randomUUID(), role, content, ts: new Date().toISOString() }
    setMessages(prev => [...prev, msg])
    return msg
  }

  const handleResult = useCallback(async (transcript) => {
    if (!transcript) return
    addMsg('user', transcript)
    setLoading(true)
    setError(null)

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const { reply, intent, data } = await sendToToki(transcript, history)
      addMsg('assistant', reply)

      if (['reminder', 'event', 'alarm'].includes(intent) && data?.title) {
        const newEvent = addEvent({ type: intent, ...data })
        setEvents(loadEvents())
        if (newEvent.datetime) {
          scheduleNotification(newEvent.title, newEvent.notes || reply, newEvent.datetime)
        }
      }

      if (intent === 'delete' && data?.id) {
        deleteEvent(data.id)
        setEvents(loadEvents())
      }

      if (intent === 'list') {
        setTab('events')
      }
    } catch (e) {
      setError(e.message)
      addMsg('assistant', 'Desculpe, ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [messages])

  const handleError = useCallback((msg) => {
    setError(msg)
  }, [])

  const { listening, interim, start, stop } = useSpeechRecognition({
    onResult: handleResult,
    onError: handleError
  })

  const handleDeleteEvent = (id) => {
    deleteEvent(id)
    setEvents(loadEvents())
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◎</span>
          <span>Toki</span>
        </div>
        <nav className={styles.nav}>
          <button
            className={`${styles.navBtn} ${tab === 'chat' ? styles.active : ''}`}
            onClick={() => setTab('chat')}
          >Chat</button>
          <button
            className={`${styles.navBtn} ${tab === 'events' ? styles.active : ''}`}
            onClick={() => setTab('events')}
          >
            Agenda
            {events.length > 0 && <span className={styles.badge}>{events.length}</span>}
          </button>
        </nav>
      </header>

      <main className={styles.main}>
        {tab === 'chat' ? (
          <ChatHistory messages={messages} />
        ) : (
          <div className={styles.eventsScroll}>
            <EventList events={events} onDelete={handleDeleteEvent} />
            {!events.length && (
              <p className={styles.eventsEmpty}>Nenhum agendamento ainda.</p>
            )}
          </div>
        )}
      </main>

      {error && (
        <div className={styles.error} onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {tab === 'chat' && (
        <footer className={styles.footer}>
          <VoiceButton
            listening={listening}
            interim={interim}
            onStart={start}
            onStop={stop}
            disabled={loading}
          />
        </footer>
      )}
    </div>
  )
}
