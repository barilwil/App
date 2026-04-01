import { useState, useEffect, useRef } from 'react'

export default function UserMessage({ text, onRetry, isLatest }) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(text)
  const [expanded, setExpanded] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const innerRef = useRef(null)
  const editRef  = useRef(null)
  const MAX_H    = 300

  useEffect(() => {
    if (innerRef.current) setOverflow(innerRef.current.scrollHeight > MAX_H + 8)
  }, [text])

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus()
      editRef.current.style.height = 'auto'
      editRef.current.style.height = editRef.current.scrollHeight + 'px'
    }
  }, [editing])

  const handleSave   = () => { if (editVal.trim()) { onRetry(editVal.trim()); setEditing(false) } }
  const handleCancel = () => { setEditVal(text); setEditing(false) }

  if (editing) {
    return (
      <div className="user-msg-wrap">
        <div className="inline-edit-shell">
          <textarea
            ref={editRef}
            className="inline-edit-area"
            value={editVal}
            onChange={e => {
              setEditVal(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
              if (e.key === 'Escape') handleCancel()
            }}
          />
          <div className="inline-edit-actions">
            <button className="msg-action-btn" onClick={handleCancel}>Cancel</button>
            <button className="msg-action-btn primary" onClick={handleSave}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
              Send
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="user-msg-wrap"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && isLatest && (
        <div className="msg-actions">
          <button className="msg-action-btn" onClick={() => { setEditVal(text); setEditing(true) }} title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button className="msg-action-btn" onClick={() => onRetry(text)} title="Retry">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
            </svg>
            Retry
          </button>
        </div>
      )}
      <div
        className="msg-user"
        style={{ maxHeight: expanded ? 'none' : MAX_H, overflow: expanded ? 'visible' : 'hidden', position: 'relative' }}
      >
        <div ref={innerRef} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{text}</div>
        {!expanded && overflow && <div className="fade-overlay-user" />}
      </div>
      {overflow && !expanded && (
        <button className="show-more-btn" onClick={() => setExpanded(true)}>Show more</button>
      )}
      {expanded && overflow && (
        <button className="show-more-btn" onClick={() => setExpanded(false)}>Show less</button>
      )}
    </div>
  )
}
