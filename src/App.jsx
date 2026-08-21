import { useState, useCallback, useEffect, useRef } from 'react'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useWakeWord } from './hooks/useWakeWord'
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
import { fetchRecentEmails, sendEmail } from './services/gmail'
import { loadWatches, addWatch, removeWatch, getLastEmailId, setLastEmailId, matchWatches } from './services/emailWatch'
import { VoiceButton } from './components/VoiceButton'
import { ChatHistory } from './components/ChatHistory'
import { EventList } from './components/EventList'
import { NoteList } from './components/NoteList'
import { EmailList } from './components/EmailList'
import { LoginScreen } from './components/LoginScreen'
import styles from './App.module.css'

const HAS_GCAL = !!import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function App() {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('toki_chat') || '[]') } catch { return [] }
  })
  const [events, setEvents] = useState([])
  const [notes, setNotes] = useState(() => loadNotes())
  const [emails, setEmails] = useState([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('tab')
    return ['chat', 'events', 'notes', 'email'].includes(p) ? p : 'chat'
  })
  const [error, setError] = useState(null)
  const [gcalConnected, setGcalConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('toki_user')) } catch { return null }
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [watches, setWatches] = useState(() => loadWatches())
  const [wakeEnabled, setWakeEnabled] = useState(() => localStorage.getItem('toki_wake') === '1')
  const [wakeListening, setWakeListening] = useState(false)
  const startRef = useRef(null)
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

  // Polling de vigilância de emails (a cada 2 min quando app está visível)
  useEffect(() => {
    if (!watches.length || !isGoogleConnected()) return

    const poll = async () => {
      if (document.hidden) return
      const result = await fetchRecentEmails(10)
      if (!Array.isArray(result) || !result.length) return

      const lastId = getLastEmailId()
      if (!lastId) { setLastEmailId(result[0].id); return }

      const newEmails = []
      for (const email of result) {
        if (email.id === lastId) break
        newEmails.push(email)
      }
      if (!newEmails.length) return
      setLastEmailId(result[0].id)

      for (const email of newEmails) {
        const matched = matchWatches(email, watches)
        for (const watch of matched) {
          const from = email.from.replace(/<[^>]+>/, '').trim()
          scheduleNotification(`📧 Email de ${from}`, email.subject, new Date().toISOString())
          setMessages(prev => {
            const msg = { id: crypto.randomUUID(), role: 'assistant', ts: new Date().toISOString(),
              content: `📧 **Email recebido de "${watch.label}"!**\n\n**De:** ${from}\n**Assunto:** ${email.subject}\n\n${email.snippet}` }
            const trimmed = [...prev, msg].slice(-100)
            localStorage.setItem('toki_chat', JSON.stringify(trimmed))
            return trimmed
          })
        }
      }
    }

    poll()
    const interval = setInterval(poll, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [watches])

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

      // Detecta pedido de resumo do dia (hoje ou amanhã)
      const summaryQuery = /r[eu]{1,2}mo|como (está|tá|esta) (meu dia|o dia)|o que (tenho|tem) (hoje|amanhã|pra (hoje|amanhã))|meu dia|bom dia/i
      const summaryIsTomorrow = /amanhã/i.test(transcript)
      if (summaryQuery.test(transcript) && isGoogleConnected()) {
        const period = summaryIsTomorrow ? 'tomorrow' : 'today'
        const [evs, emailResult] = await Promise.all([
          fetchFromGoogleCalendar(period),
          fetchRecentEmails(20)
        ])

        const now = new Date()
        const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
        const refDate = summaryIsTomorrow ? new Date(now.getTime() + 86400000) : now
        const dayLabel = summaryIsTomorrow ? 'Amanhã' : 'Hoje'
        const dateStr = refDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
        const parts = [`☀️ **${greeting}!** ${dayLabel} é ${dateStr}.\n`]

        // Agenda
        if (!evs || evs.length === 0) {
          parts.push(`📅 **Agenda:** ${dayLabel} está livre, sem compromissos.`)
        } else {
          const evLines = evs.map(e => {
            const dt = e.datetime
              ? new Date(e.datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : 'dia todo'
            return `  • ${dt} — ${e.title}${e.location ? ` (${e.location})` : ''}`
          }).join('\n')
          parts.push(`📅 **Agenda de ${dayLabel.toLowerCase()}** (${evs.length} compromisso${evs.length > 1 ? 's' : ''}):\n${evLines}`)
        }

        // Emails
        if (Array.isArray(emailResult)) {
          const unread = emailResult.filter(e => e.isUnread)
          if (unread.length === 0) {
            parts.push('✉️ **Emails:** Nenhum email não lido.')
          } else {
            const emailLines = unread.slice(0, 4).map(e => {
              const from = e.from.replace(/<[^>]+>/, '').trim() || e.from
              return `  • **${e.subject}** — ${from}`
            }).join('\n')
            const extra = unread.length > 4 ? `\n  _+ ${unread.length - 4} outros_` : ''
            parts.push(`✉️ **Emails não lidos** (${unread.length}):\n${emailLines}${extra}`)
          }
          setEmails(emailResult)
        }

        addMsg('assistant', parts.join('\n\n'))
        setLoading(false)
        return
      }

      // Detecta consultas de email e responde direto da Gmail API
      const emailQuery = /email|e-mail|inbox|caixa de entrada|mensagem.*recebi|recebi.*mensagem/i
      if (emailQuery.test(transcript) && isGoogleConnected()) {
        setTab('email')
        setEmailLoading(true)
        const result = await fetchRecentEmails(10)
        setEmailLoading(false)
        if (result?.error) {
          const msgs = {
            no_token: 'Não estou conectado ao Google. Use o menu para sincronizar.',
            auth: 'Token expirado. Abra o menu e toque em **Sincronizar agenda** para renovar.',
            forbidden: 'Sem permissão para acessar o Gmail. Pode ser que a API do Gmail não esteja ativada no Google Cloud, ou você precisa reconectar a conta para incluir o escopo de email.',
            api: `Erro da API Gmail (${result.status}): ${result.details || 'tente novamente.'}`
          }
          addMsg('assistant', msgs[result.error] || 'Erro ao acessar o Gmail.')
        } else if (!result || result.length === 0) {
          addMsg('assistant', 'Sua caixa de entrada está vazia.')
        } else {
          setEmails(result)
          const unread = result.filter(e => e.isUnread).length
          const lines = result.slice(0, 5).map(e => {
            const from = e.from.replace(/<[^>]+>/, '').trim() || e.from
            const date = e.date ? new Date(e.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''
            return `${e.isUnread ? '🔵' : '📧'} **${e.subject}**\n   De: ${from}${date ? ` · ${date}` : ''}\n   ${e.snippet}`
          }).join('\n\n')
          const header = unread > 0 ? `Você tem **${unread} não lido${unread > 1 ? 's' : ''}** de ${result.length} emails recentes:` : `Seus ${result.length} emails mais recentes:`
          addMsg('assistant', `${header}\n\n${lines}`)
        }
        setLoading(false)
        return
      }

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

      // Vigilância de emails
      if (intent === 'watch_email' && (data?.sender || data?.subject)) {
        const entry = addWatch({ sender: data.sender, subject: data.subject, label: data.label })
        if (!getLastEmailId()) {
          fetchRecentEmails(1).then(r => { if (Array.isArray(r) && r.length) setLastEmailId(r[0].id) })
        }
        setWatches(loadWatches())
      }

      if (intent === 'unwatch_email' && data?.label) {
        const ws = loadWatches()
        const target = ws.find(w => w.label.toLowerCase().includes(data.label.toLowerCase()))
        if (target) { removeWatch(target.id); setWatches(loadWatches()) }
      }

      if (intent === 'list_watches') {
        const ws = loadWatches()
        if (!ws.length) {
          addMsg('assistant', 'Não há emails sendo monitorados no momento.')
        } else {
          const lines = ws.map(w => {
            const parts = []
            if (w.sender) parts.push(`remetente: ${w.sender}`)
            if (w.subject) parts.push(`assunto: ${w.subject}`)
            return `  • **${w.label}** (${parts.join(', ')})`
          }).join('\n')
          addMsg('assistant', `📧 **Emails monitorados (${ws.length}):**\n${lines}`)
        }
      }

      // Email
      if (intent === 'read_emails') {
        setTab('email')
        loadEmails()
      }

      if (intent === 'send_email' && data?.to && data?.subject && data?.body) {
        setPendingEmail({ to: data.to, subject: data.subject, body: data.body })
      }

    } catch (e) {
      setError(e.message)
      addMsg('assistant', 'Desculpe, ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [messages])

  const handleError = useCallback((msg) => setError(msg), [])
  const { listening, interim, start, stop } = useSpeechRecognition({ onResult: handleResult, onError: handleError })
  useEffect(() => { startRef.current = start }, [start])

  // Wake word: "Ei Toki"
  const handleWake = useCallback((commandAfter) => {
    setTab('chat')
    setWakeListening(true)
    if (commandAfter) {
      setWakeListening(false)
      handleResult(commandAfter)
    } else {
      setTimeout(() => {
        setWakeListening(false)
        startRef.current?.()
      }, 300)
    }
  }, [handleResult])

  const { active: wakeActive } = useWakeWord({
    enabled: wakeEnabled && !listening,
    onWake: handleWake
  })

  const toggleWake = () => {
    const next = !wakeEnabled
    setWakeEnabled(next)
    localStorage.setItem('toki_wake', next ? '1' : '0')
  }

  const handleDeleteEvent = async (id) => {
    const ev = events.find(e => e.id === id)
    deleteEvent(id)
    if (ev?.gcalId && isGoogleConnected()) deleteFromGoogleCalendar(ev.gcalId)
    setEvents(loadEvents())
  }

  const handleDeleteNote = (id) => { deleteNote(id); setNotes(loadNotes()) }

  const loadEmails = useCallback(async () => {
    if (!isGoogleConnected()) return
    setEmailLoading(true)
    const result = await fetchRecentEmails(10)
    setEmailLoading(false)
    if (Array.isArray(result)) setEmails(result)
  }, [])

  // Carrega emails ao abrir a aba
  useEffect(() => {
    if (tab === 'email') loadEmails()
  }, [tab, loadEmails])

  const handleConfirmEmail = async () => {
    if (!pendingEmail) return
    const ok = await sendEmail(pendingEmail)
    addMsg('assistant', ok ? `✅ Email enviado para ${pendingEmail.to}.` : '❌ Não foi possível enviar o email.')
    setPendingEmail(null)
    setTab('chat')
  }

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
          {wakeEnabled && (
            <button
              onClick={toggleWake}
              className={`${styles.wakeBadge} ${wakeActive || wakeListening ? styles.wakeActive : ''}`}
              title="Escuta contínua ativa — diga 'Ei Toki'"
            >
              🎙 {wakeListening ? 'ouvindo…' : 'Ei Toki'}
            </button>
          )}
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
            <button className={styles.menuItem} onClick={() => { toggleWake(); setMenuOpen(false) }}>
              {wakeEnabled ? '🎙 Desativar "Ei Toki"' : '🎙 Ativar "Ei Toki"'}
            </button>
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
        {tab === 'email' && (
          <div className={styles.scroll}>
            {emailLoading
              ? <p className={styles.empty}>Carregando emails…</p>
              : emails.length > 0
                ? <EmailList emails={emails} />
                : (
                  <div className={styles.empty}>
                    Nenhum email recente.<br />
                    <button onClick={loadEmails} style={{ marginTop: 16, color: 'var(--accent2)', background: 'none', fontSize: 14, textDecoration: 'underline' }}>
                      Recarregar
                    </button>
                  </div>
                )
            }
          </div>
        )}
      </main>

      {error && <div className={styles.error} onClick={() => setError(null)}>{error}</div>}

      {/* Modal de confirmação de envio de email */}
      {pendingEmail && (
        <div className={styles.emailModal}>
          <div className={styles.emailModalCard}>
            <h3 className={styles.emailModalTitle}>Confirmar envio</h3>
            <div className={styles.emailModalField}><b>Para:</b> {pendingEmail.to}</div>
            <div className={styles.emailModalField}><b>Assunto:</b> {pendingEmail.subject}</div>
            <div className={styles.emailModalBody}>{pendingEmail.body}</div>
            <div className={styles.emailModalActions}>
              <button className={styles.emailCancel} onClick={() => setPendingEmail(null)}>Cancelar</button>
              <button className={styles.emailSend} onClick={handleConfirmEmail}>Enviar</button>
            </div>
          </div>
        </div>
      )}

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
        <button className={`${styles.navTab} ${tab === 'email' ? styles.active : ''}`} onClick={() => setTab('email')}>
          <span className={styles.navIcon}>✉️</span>
          Email
          {emails.filter(e => e.isUnread).length > 0 && (
            <span className={styles.navBadge}>{emails.filter(e => e.isUnread).length}</span>
          )}
        </button>
      </nav>

    </div>
  )
}
