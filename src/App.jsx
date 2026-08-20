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
import { loadNotes, addNote, deleteNote } from './services/notes'
import { openAndroidAlarm, openAndroidTimer, extractTime, isAndroid, formatDuration } from './services/android'
import { addGoogleTask, addGoogleTaskList } from './services/googleTasks'
import { VoiceButton } from './components/VoiceButton'
import { ChatHistory } from './components/ChatHistory'
import { EventList } from './components/EventList'
import { NoteList } from './components/NoteList'
import { LoginScreen } from './components/LoginScreen'
import styles from './App.module.css'

const HAS_GCAL = !!import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function App() {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('toki_chat') || '[]') } catch { return [] }
  })
  const [events, setEvents] = useState([])
  const [notes, setNotes] = useState(() => loadNotes())
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('tab')
    return ['chat','events','notes'].includes(p) ? p : 'chat'
  })
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
      setEvents(loadEvents())
    }
  }, [syncFromGoogle])

  useEffect(() => {
    setEvents(loadEvents())
    restoreScheduled(loadEvents())
    requestPermission()
    if (HAS_GCAL) initGoogleCalendar(handleConnectChange)
  }, [handleConnectChange])

  const addMsg = (role, content) => {
    const msg = { id: crypto.randomUUID(), role, content, ts: new Date().toISOString() }
    setMessages(prev => {
      const trimmed = [...prev, msg].slice(-100)
      localStorage.setItem('toki_chat', JSON.stringify(trimmed))
      return trimmed
    })
  }

  const handleResult = useCallback(async (transcript) => {
    if (!transcript) return
    addMsg('user', transcript)
    setLoading(true)
    setError(null)

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))

      // Pré-carrega agenda quando a pergunta parece ser sobre compromissos
      const agendaKeywords = /agenda|compromisso|reunião|evento|hoje|amanhã|semana|mês|horário|tenho hoje|tenho amanhã/i
      let context = null
      if (agendaKeywords.test(transcript) && isGoogleConnected()) {
        const period = /amanhã/i.test(transcript) ? 'tomorrow'
          : /semana/i.test(transcript) ? 'week'
          : /mês/i.test(transcript) ? 'month'
          : 'today'
        const events = await fetchFromGoogleCalendar(period)
        context = { events: events || [], period }
      }

      const { reply, intent, data } = await sendToToki(transcript, history, context)
      addMsg('assistant', reply)

      // Compromissos no Google Agenda
      if (['reminder', 'event'].includes(intent) && data?.title) {
        const newEvent = addEvent({ type: intent, ...data })
        setEvents(loadEvents())
        if (newEvent.datetime) scheduleNotification(newEvent.title, data.notes || reply, newEvent.datetime)
        if (isGoogleConnected()) {
          const gcalId = await pushToGoogleCalendar(newEvent)
          if (gcalId) updateEvent(newEvent.id, { gcalId })
        }
        setTab('events')
      }

      // Alarme no Android
      if (intent === 'alarm' && data?.datetime) {
        const newEvent = addEvent({ type: 'alarm', ...data })
        setEvents(loadEvents())
        scheduleNotification(data.title, reply, data.datetime)
        const time = extractTime(data.datetime)
        if (time) openAndroidAlarm({ ...time, message: data.title })
        setTab('events')
      }

      // Cronômetro no Android
      if (intent === 'timer' && data?.duration_seconds) {
        const opened = openAndroidTimer(data.duration_seconds, data.title)
        if (!opened) {
          // Não Android: agenda notificação como fallback
          const future = new Date(Date.now() + data.duration_seconds * 1000).toISOString()
          scheduleNotification(data.title || 'Cronômetro', `Tempo de ${formatDuration(data.duration_seconds)} encerrado!`, future)
        }
      }

      // Notas e listas
      if (['note', 'shopping', 'checklist'].includes(intent) && data?.title) {
        const items = data.items?.map(text => ({
          id: crypto.randomUUID(), text, done: false
        }))
        addNote({ type: intent, title: data.title, content: data.content || null, items: items || [] })
        setNotes(loadNotes())

        // Sincroniza com Google Tasks se conectado
        if (isGoogleConnected()) {
          if (items?.length > 0) {
            addGoogleTaskList({ title: data.title, items: data.items })
          } else {
            addGoogleTask({ title: data.title, notes: data.content })
          }
        }
        setTab('notes')
      }

      // Reminder também vai para Google Tasks
      if (intent === 'reminder' && data?.title && isGoogleConnected()) {
        addGoogleTask({ title: data.title, notes: data.notes, due: data.datetime })
      }

      // Apagar
      if (intent === 'delete' && data?.id) {
        const evToDelete = loadEvents().find(e => e.id === data.id)
        deleteEvent(data.id)
        if (evToDelete?.gcalId && isGoogleConnected()) deleteFromGoogleCalendar(evToDelete.gcalId)
        setEvents(loadEvents())
      }

      if (intent === 'list_notes') setTab('notes')

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
    const ev = events.find(e => e.id === id)
    deleteEvent(id)
    if (ev?.gcalId && isGoogleConnected()) deleteFromGoogleCalendar(ev.gcalId)
    setEvents(loadEvents())
  }

  const handleDeleteNote = (id) => {
    deleteNote(id)
    setNotes(loadNotes())
  }

  const handleLogout = () => {
    disconnectGoogle()
    setUser(null)
    setEvents([])
    localStorage.removeItem('toki_user')
    localStorage.removeItem('toki_events')
  }

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
              title={gcalConnected ? 'Desconectar Google Agenda' : 'Conectar Google Agenda'}
            >
              {syncing ? '⏳' : gcalConnected ? '📅 ✓' : '📅'}
            </button>
          )}
          {user && (
            <button className={styles.userBtn} onClick={handleLogout} title={`${user.name} — sair`}>
              {user.picture
                ? <img src={user.picture} alt={user.name} className={styles.avatar} />
                : <span className={styles.avatarFallback}>{user.name?.[0]}</span>
              }
            </button>
          )}
          <nav className={styles.nav}>
            <button className={`${styles.navBtn} ${tab === 'chat' ? styles.active : ''}`} onClick={() => setTab('chat')}>Chat</button>
            <button className={`${styles.navBtn} ${tab === 'events' ? styles.active : ''}`} onClick={() => setTab('events')}>
              Agenda
              {events.length > 0 && <span className={styles.badge}>{events.length}</span>}
            </button>
            <button className={`${styles.navBtn} ${tab === 'notes' ? styles.active : ''}`} onClick={() => setTab('notes')}>
              Notas
              {notes.length > 0 && <span className={styles.badge}>{notes.length}</span>}
            </button>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        {tab === 'chat' && <ChatHistory messages={messages} />}
        {tab === 'events' && (
          <div className={styles.eventsScroll}>
            <EventList events={events} onDelete={handleDeleteEvent} />
            {!events.length && <p className={styles.eventsEmpty}>Nenhum agendamento ainda.</p>}
          </div>
        )}
        {tab === 'notes' && (
          <div className={styles.eventsScroll}>
            <NoteList notes={notes} onDelete={handleDeleteNote} onRefresh={() => setNotes(loadNotes())} />
            {!notes.length && <p className={styles.eventsEmpty}>Nenhuma nota ainda. Peça ao Toki para criar uma lista ou anotação.</p>}
          </div>
        )}
      </main>

      {error && <div className={styles.error} onClick={() => setError(null)}>{error}</div>}

      {tab === 'chat' && (
        <footer className={styles.footer}>
          <VoiceButton
            listening={listening}
            interim={interim}
            onStart={start}
            onStop={stop}
            onText={handleResult}
            disabled={loading}
          />
        </footer>
      )}
    </div>
  )
}
