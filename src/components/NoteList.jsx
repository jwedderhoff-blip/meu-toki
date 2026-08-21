import { useState, useRef } from 'react'
import { toggleListItem, deleteNote, updateNote, appendToList, pinNote, removeListItem } from '../services/notes'
import { shareText, formatNoteForShare } from '../services/android'
import styles from './NoteList.module.css'

function NoteCard({ note, onDelete, onRefresh }) {
  const [expanded, setExpanded] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(note.title)
  const inputRef = useRef(null)

  const handleToggle = (itemId) => { toggleListItem(note.id, itemId); onRefresh() }
  const handleRemoveItem = (e, itemId) => { e.stopPropagation(); removeListItem(note.id, itemId); onRefresh() }

  const handlePin = (e) => { e.stopPropagation(); pinNote(note.id); onRefresh() }

  const handleTitleSave = () => {
    const t = titleVal.trim()
    if (t && t !== note.title) { updateNote(note.id, { title: t }); onRefresh() }
    setEditingTitle(false)
  }

  const handleAddItem = (e) => {
    e.preventDefault()
    const text = newItem.trim()
    if (!text) return
    appendToList(note.id, text)
    setNewItem('')
    onRefresh()
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const typeLabel = { shopping: '🛒', list: '📋', note: '📝' }[note.type] || '📝'
  const date = new Date(note.updatedAt || note.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const isList = note.items?.length > 0 || ['shopping', 'list', 'checklist'].includes(note.type)
  const done = note.items?.filter(i => i.done).length || 0
  const total = note.items?.length || 0

  return (
    <div className={`${styles.card} ${note.pinned ? styles.pinned : ''}`}>
      <div className={styles.cardHeader} onClick={() => setExpanded(e => !e)}>
        <span className={styles.typeIcon}>{typeLabel}</span>

        {editingTitle ? (
          <input
            className={styles.titleInput}
            value={titleVal}
            autoFocus
            onChange={e => setTitleVal(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false) }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={styles.title} onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true) }}>
            {note.title}
          </span>
        )}

        {isList && total > 0 && (
          <span className={styles.progress}>{done}/{total}</span>
        )}
        <span className={styles.date}>{date}</span>
        <button className={`${styles.pinBtn} ${note.pinned ? styles.pinnedIcon : ''}`} onClick={handlePin} title={note.pinned ? 'Desafixar' : 'Fixar'}>
          📌
        </button>
        <button className={styles.shareBtn} onClick={e => { e.stopPropagation(); shareText(note.title, formatNoteForShare(note)) }} title="Compartilhar">↗</button>
        <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(note.id) }}>✕</button>
      </div>

      {expanded && (
        <div className={styles.body}>
          {isList ? (
            <>
              <ul className={styles.itemList}>
                {(note.items || []).map(item => (
                  <li key={item.id} className={`${styles.item} ${item.done ? styles.done : ''}`}>
                    <span className={styles.check} onClick={() => handleToggle(item.id)}>
                      {item.done ? '☑' : '☐'}
                    </span>
                    <span className={styles.itemText} onClick={() => handleToggle(item.id)}>{item.text}</span>
                    <button className={styles.removeItem} onClick={e => handleRemoveItem(e, item.id)}>✕</button>
                  </li>
                ))}
              </ul>

              {addingItem ? (
                <form className={styles.addItemRow} onSubmit={handleAddItem}>
                  <input
                    ref={inputRef}
                    autoFocus
                    className={styles.addItemInput}
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    placeholder="Novo item…"
                    onBlur={() => { if (!newItem.trim()) setAddingItem(false) }}
                  />
                  <button type="submit" className={styles.addItemBtn}>+</button>
                </form>
              ) : (
                <button className={styles.addItemTrigger} onClick={() => setAddingItem(true)}>
                  + Adicionar item
                </button>
              )}
            </>
          ) : note.content ? (
            <p className={styles.content}>{note.content}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function NoteList({ notes, onDelete, onRefresh }) {
  const [search, setSearch] = useState('')

  const filtered = notes
    .filter(n => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        n.title.toLowerCase().includes(q) ||
        n.content?.toLowerCase().includes(q) ||
        n.items?.some(i => i.text.toLowerCase().includes(q))
      )
    })
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <div className={styles.list}>
      <div className={styles.searchWrap}>
        <input
          className={styles.search}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar notas…"
        />
        {search && <button className={styles.clearSearch} onClick={() => setSearch('')}>✕</button>}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, padding: '24px 0' }}>
          {search ? 'Nenhuma nota encontrada.' : 'Nenhuma nota ainda.'}
        </p>
      )}

      {filtered.map(note => (
        <NoteCard key={note.id} note={note} onDelete={onDelete} onRefresh={onRefresh} />
      ))}
    </div>
  )
}
