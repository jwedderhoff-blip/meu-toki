import { useState, useCallback, useEffect, useRef } from 'react'
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
    return ['chat', 'events', 'notes'].includes(p) ? p : 'chat'
  })
  const [error, setError] = useState(null)
  const [gcalConnected, setGcalConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('toki_user')) } catch { return null }
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

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

      // Detecta consultas de agenda e responde direto do Google Calendar
      const agendaQuery = /agenda|compromisso|o que (tenho|tem)|tenho (hoje|amanhã)|minha semana|eventos (de|do|da)/i
      if (agendaQuery.test(transcript) && isGoogleConnected()) {
        const period = /amanhã/i.test(transcript) ? 'tomorrow'
          : /semana/i.test(transcript) ? 'week'
          : /m[eê]s/i.test(transcript) ? 'month'
          : 'today'
        const evs = await fetchFromGoogleCalendar(period)
        const periodLabel = { today: 'hoje', tomorrow: 'amanhã', week: 'nos próximos 7 dias', month: 'nos próximos 30 dias' }[period]

        if (!evs || evs.length === 0) {
          addMsg('assistant', `Você não tem compromissos agendados ${periodLabel}.`)
        } else {
          const lines = evs.map(e => {
            const dt = e.datetime
              ? new Date(e.datetime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
              : 'sem horário'
            let line = `📅 **${e.title}** — ${dt}`
            if (e.location) line += `\n   📍 ${e.location}`
            if (e.with_whom) line += `\n   👤 ${e.with_whom}`
            return line
          }).join('\n\n')
          addMsg('assistant', `Sua agenda ${periodLabel}:\n\n${lines}`)
        }
        setTab('events')
        setLoading(false)
        return
      }

      const { reply, intent, data } = await sendToToki(transcript, history)
      addMsg('assistant', reply)

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

      if (intent === 'alarm' && data?.datetime) {
        const newEvent = addEvent({ type: 'alarm', ...data })
        setEvents(loadEvents())
        scheduleNotification(data.title, reply, data.datetime)
        const time = extractTime(data.datetime)
        if (time) openAndroidAlarm({ ...time, message: data.title })
        setTab('events')
      }

      if (intent === 'timer' && data?.duration_seconds) {
        const opened = openAndroidTimer(data.duration_seconds, data.title)
        if (!opened) {
          const future = new Date(Date.now() + data.duration_seconds * 1000).toISOString()
          scheduleNotification(data.title || 'Cronômetro', `${formatDuration(data.duration_seconds)} encerrado!`, future)
        }
      }

      if (['note', 'shopping', 'checklist'].includes(intent) && data?.title) {
        const items = data.items?.map(text => ({ id: crypto.randomUUID(), text, done: false }))
        addNote({ type: intent, title: data.title, content: data.content || null, items: items || [] })
        setNotes(loadNotes())
        if (isGoogleConnected()) {
          items?.length > 0
            ? addGoogleTaskList({ title: data.title, items: data.items })
            : addGoogleTask({ title: data.title, notes: data.content })
        }
        setTab('notes')
      }

      if (intent === 'reminder' && data?.title && isGoogleConnected()) {
        addGoogleTask({ title: data.title, notes: data.notes, due: data.datetime })
      }

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
  const { listening, interim, start, stop } = useSpeechRecognition({ onResult: handleResult, onError: handleError })

  const handleDeleteEvent = async (id) => {
    const ev = events.find(e => e.id === id)
    deleteEvent(id)
    if (ev?.gcalId && isGoogleConnected()) deleteFromGoogleCalendar(ev.gcalId)
    setEvents(loadEvents())
  }

  const handleDeleteNote = (id) => { deleteNote(id); setNotes(loadNotes()) }

  const handleLogout = () => {
    disconnectGoogle()
    setUser(null); setEvents([])
    localStorage.removeItem('toki_user')
    localStorage.removeItem('toki_events')
    setMenuOpen(false)
  }

  if (HAS_GCAL && !gcalConnected && !syncing && !localStorage.getItem('gcal_token')) {
    return <LoginScreen onLogin={connectGoogle} />
  }

  return (
    <div className={styles.app}>

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◎</span>
          <span>Toki</span>
        </div>
        <div className={styles.headerRight}>
          {gcalConnected && !syncing && (
            <span className={styles.gcalBadge}>📅 conectado</span>
          )}
          {syncing && <span className={styles.gcalBadge}>⏳ sincronizando…</span>}

          {/* Avatar abre submenu */}
          {user && (
            <button className={styles.avatarBtn} onClick={() => setMenuOpen(o => !o)}>
              {user.picture
                ? <img src={user.picture} alt={user.name} className={styles.avatar} />
                : <span className={styles.avatarFallback}>{user.name?.[0]}</span>
              }
            </button>
          )}
        </div>
      </header>

      {/* ── DROPDOWN MENU ── */}
      {menuOpen && (
        <>
          <div className={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
          <div className={styles.menu} ref={menuRef}>
            {user && (
              <div className={styles.menuUser}>
                <div className={styles.menuName}>{user.name}</div>
                <div className={styles.menuEmail}>{user.email}</div>
              </div>
            )}
            <button className={styles.menuItem} onClick={() => { connectGoogle(); setMenuOpen(false) }}>
              🔄 Sincronizar agenda
            </button>
            <button className={styles.menuItem} onClick={() => { disconnectGoogle(); setMenuOpen(false) }}>
              📅 Desconectar Google Agenda
            </button>
            <button className={`${styles.menuItem} ${styles.danger}`} onClick={handleLogout}>
              🚪 Sair da conta
            </button>
          </div>
        </>
      )}

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className={styles.main}>
        {tab === 'chat' && <ChatHistory messages={messages} />}
        {tab === 'events' && (
          <div className={styles.scroll}>
            <EventList events={events} onDelete={handleDeleteEvent} />
            {!events.length && <p className={styles.empty}>Nenhum compromisso ainda.<br/>Peça ao Toki para agendar algo.</p>}
          </div>
        )}
        {tab === 'notes' && (
          <div className={styles.scroll}>
            <NoteList notes={notes} onDelete={handleDeleteNote} onRefresh={() => setNotes(loadNotes())} />
            {!notes.length && <p className={styles.empty}>Nenhuma nota ainda.<br/>Peça ao Toki para criar uma lista ou anotação.</p>}
          </div>
        )}
      </main>

      {error && <div className={styles.error} onClick={() => setError(null)}>{error}</div>}

      {/* ── INPUT DE VOZ/TEXTO (só no chat) ── */}
      {tab === 'chat' && (
        <div className={styles.inputArea}>
          <VoiceButton
            listening={listening}
            interim={interim}
            onStart={start}
            onStop={stop}
            onText={handleResult}
            disabled={loading}
          />
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <nav className={styles.bottomNav}>
        <button className={`${styles.navTab} ${tab === 'chat' ? styles.active : ''}`} onClick={() => setTab('chat')}>
          <span className={styles.navIcon}>💬</span>
          Chat
        </button>
        <button className={`${styles.navTab} ${tab === 'events' ? styles.active : ''}`} onClick={() => setTab('events')}>
          <span className={styles.navIcon}>📅</span>
          Agenda
          {events.length > 0 && <span className={styles.navBadge}>{events.length}</span>}
        </button>
        <button className={`${styles.navTab} ${tab === 'notes' ? styles.active : ''}`} onClick={() => setTab('notes')}>
          <span className={styles.navIcon}>📝</span>
          Notas
          {notes.length > 0 && <span className={styles.navBadge}>{notes.length}</span>}
        </button>
      </nav>

    </div>
  )
}
