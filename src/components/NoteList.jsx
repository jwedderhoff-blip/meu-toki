import { useState } from 'react'
import { toggleListItem, deleteNote } from '../services/notes'
import styles from './NoteList.module.css'

function NoteCard({ note, onDelete, onRefresh }) {
  const [expanded, setExpanded] = useState(true)

  const handleToggle = (itemId) => {
    toggleListItem(note.id, itemId)
    onRefresh()
  }

  const typeLabel = { shopping: '🛒', list: '📋', note: '📝' }[note.type] || '📝'
  const date = new Date(note.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader} onClick={() => setExpanded(e => !e)}>
        <span className={styles.typeIcon}>{typeLabel}</span>
        <span className={styles.title}>{note.title}</span>
        <span className={styles.date}>{date}</span>
        <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(note.id) }}>✕</button>
      </div>

      {expanded && (
        <div className={styles.body}>
          {note.items?.length > 0 ? (
            <ul className={styles.itemList}>
              {note.items.map(item => (
                <li
                  key={item.id}
                  className={`${styles.item} ${item.done ? styles.done : ''}`}
                  onClick={() => handleToggle(item.id)}
                >
                  <span className={styles.check}>{item.done ? '☑' : '☐'}</span>
                  {item.text}
                </li>
              ))}
            </ul>
          ) : note.content ? (
            <p className={styles.content}>{note.content}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function NoteList({ notes, onDelete, onRefresh }) {
  if (!notes.length) return null
  return (
    <div className={styles.list}>
      {notes.map(note => (
        <NoteCard key={note.id} note={note} onDelete={onDelete} onRefresh={onRefresh} />
      ))}
    </div>
  )
}
