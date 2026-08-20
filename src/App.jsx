import { useState, useCallback, useEffect } from 'react'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { sendToToki } from './services/api'
import { addEvent, deleteEvent, loadEvents, updateEvent } from './services/storage'
import { requestPermission, scheduleNotification, restoreScheduled } from './services/notifications'
import {
  initGoogleCalendar, connectGoogle, disconnectGoogle, isGoogleConnected,
  pushToGoogleCalendar, fetchFromGoogleCalendar, deleteFromGoogleCalendar,
  fetchUserProfile
} from './services/googleCalendar'
import { VoiceButton } from './components/VoiceButton'
import { ChatHistory } from './components/ChatHistory'
import { EventList } from './components/EventList'
import { LoginScreen } from './components/LoginScreen'
import styles from './App.module.css'

const HAS_GCAL = !!import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function App() {
  const [messages, setMessages] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('chat')
  const [error, setError] = useState(null)
  const [gcalConnected, setGcalConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('toki_user')) } catch { return null }
  })

  const syncFromGoogle = useCallback(async () => {
    setSyncing(true)
    const [gcalEvents, profile] = await Promise.all([
      fetchFromGoogleCalendar(),
      fetchUserProfile()
    ])
    setSyncing(false)
    if (profile) setUser(profile)
    if (gcalEvents) {
      localStorage.setItem('toki_events', JSON.stringify(gcalEvents))
      setEvents(gcalEvents)
      restoreScheduled(gcalEvents)
    }
  }, [])

  const handleConnectChange = useCallback(async (connected) => {
    setGcalConnected(connected)
    if (connected) {
      await syncFromGoogle()
    } else {
      setUser(null)
      localStorage.removeItem('toki_user')
      const local = loadEvents()
      setEvents(local)
    }
  }, [syncFromGoogle])

  useEffect(() => {
    const evs = loadEvents()
    setEvents(evs)
    restoreScheduled(evs)
    requestPermission()
    if (HAS_GCAL) initGoogleCalendar(handleConnectChange)
  }, [handleConnectChange])

  const addMsg = (role, content) => {
    const msg = { id: crypto.randomUUID(), role, content, ts: new Date().toISOString() }
    setMessages(prev => [...prev, msg])
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

          if (isGoogleConnected()) {
            const gcalId = await pushToGoogleCalendar(newEvent)
            if (gcalId) {
              updateEvent(newEvent.id, { gcalId })
            } else {
              setError('Não foi possível adicionar ao Google Agenda.')
            }
          }
        }
      }

      if (intent === 'delete' && data?.id) {
        const evToDelete = loadEvents().find(e => e.id === data.id)
        deleteEvent(data.id)
        if (evToDelete?.gcalId && isGoogleConnected()) {
          deleteFromGoogleCalendar(evToDelete.gcalId)
        }
        setEvents(loadEvents())
      }

      if (['list', 'reminder', 'event', 'alarm'].includes(intent)) {
        setTab('events')
      }
    } catch (e) {
      setError(e.message)
      addMsg('assistant', 'Desculpe, ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [messages])

  const handleError = useCallback((msg) => setError(msg), [])

  const { listening, interim, start, stop } = useSpeechRecognition({
    onResult: handleResult,
    onError: handleError
  })

  const handleDeleteEvent = async (id) => {
    const evToDelete = events.find(e => e.id === id)
    deleteEvent(id)
    if (evToDelete?.gcalId && isGoogleConnected()) {
      deleteFromGoogleCalendar(evToDelete.gcalId)
    }
    setEvents(loadEvents())
  }

  const handleLogout = () => {
    disconnectGoogle()
    setUser(null)
    setEvents([])
    localStorage.removeItem('toki_user')
    localStorage.removeItem('toki_events')
  }

  // Mostra login se Google está configurado mas não há token salvo
  if (HAS_GCAL && !gcalConnected && !syncing && !localStorage.getItem('gcal_token')) {
    return <LoginScreen onLogin={connectGoogle} />
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◎</span>
          <span>Toki</span>
        </div>
        <div className={styles.headerRight}>
          {HAS_GCAL && (
            <button
              className={`${styles.gcalBtn} ${gcalConnected ? styles.gcalOn : ''}`}
              onClick={() => gcalConnected ? disconnectGoogle() : connectGoogle()}
              title={gcalConnected ? 'Google Agenda conectado — clique para desconectar' : 'Conectar Google Agenda'}
            >
              {syncing ? '⏳' : gcalConnected ? '📅 ✓' : '📅'}
            </button>
          )}
          {user && (
            <button
              className={styles.userBtn}
              onClick={handleLogout}
              title={`${user.name} — clique para sair`}
            >
              {user.picture
                ? <img src={user.picture} alt={user.name} className={styles.avatar} />
                : <span className={styles.avatarFallback}>{user.name?.[0]}</span>
              }
            </button>
          )}
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
        </div>
      </header>

      <main className={styles.main}>
        {tab === 'chat' ? (
          <ChatHistory messages={messages} />
        ) : (
          <div className={styles.eventsScroll}>
            <EventList events={events} onDelete={handleDeleteEvent} />
            {!events.length && (
              <p className={styles.eventsEmpty}>Nenhum agendamento encontrado no Google Agenda.</p>
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
