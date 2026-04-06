import { useState, useEffect, useMemo } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { API_URL } from '../../app/constants'

export default function CourseDashboard({ ta, onLogout, onOpenAdmin, onLaunchLab }) {
  const [courses, setCourses] = useState([])
  const [labsMap, setLabsMap] = useState({})
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(true)
  const [appWindow, setAppWindow] = useState(null)
  const [windowReady, setWindowReady] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    try {
      const win = getCurrentWindow()
      setAppWindow(win)
      setWindowReady(!!win)
    } catch {
      setAppWindow(null)
      setWindowReady(false)
    }
  }, [])

  useEffect(() => {
    if (!appWindow) return
    let unlisten = null

    const syncWindowState = async () => {
      try {
        setIsMaximized(await appWindow.isMaximized())
      } catch {
        setIsMaximized(false)
      }
    }

    syncWindowState()

    ;(async () => {
      try {
        unlisten = await appWindow.onResized(syncWindowState)
      } catch {}
    })()

    return () => {
      if (typeof unlisten === 'function') unlisten()
    }
  }, [appWindow])

  const canUseWindowControls = useMemo(() => (
    !!appWindow &&
    typeof appWindow.minimize === 'function' &&
    typeof appWindow.toggleMaximize === 'function' &&
    typeof appWindow.close === 'function'
  ), [appWindow])

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/courses`)
      if (r.ok) {
        const data = await r.json()
        setCourses(data)
        if (data.length === 1) {
          setExpanded({ [data[0].id]: true })
          fetchLabs(data[0].id)
        }
      }
    } finally { setLoading(false) }
  }

  const fetchLabs = async (courseId) => {
    const r = await fetch(`${API_URL}/courses/${courseId}/labs`)
    if (r.ok) {
      const labs = await r.json()
      setLabsMap(prev => ({ ...prev, [courseId]: labs }))
    }
  }

  useEffect(() => { fetchCourses() }, [])

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
    if (!labsMap[id]) fetchLabs(id)
  }

  const handleMinimize = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!canUseWindowControls) return
    try { await appWindow.minimize() } catch {}
  }

  const handleToggleMaximize = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!canUseWindowControls) return
    try {
      await appWindow.toggleMaximize()
      setIsMaximized(await appWindow.isMaximized())
    } catch {}
  }

  const handleClose = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!canUseWindowControls) return
    try { await appWindow.close() } catch {}
  }

  const windowBtnBase = {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: canUseWindowControls ? 'pointer' : 'default',
    fontFamily: 'var(--font)',
    transition: 'color 0.15s, background 0.15s, border-color 0.15s, opacity 0.15s',
    opacity: canUseWindowControls ? 1 : 0.45,
  }

  const topBar = (
    <div style={{ height: 52, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-tauri-drag-region>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' }}>Circuit AI</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '2px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--pill)' }}>TA Dashboard</span>
      </div>

      <div style={{ flex: 1, height: '100%' }} data-tauri-drag-region />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{ta?.name}</span>
        <button onClick={onLogout} style={{ padding: '5px 12px', borderRadius: 'var(--pill)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}>Sign out</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <button
            onClick={handleMinimize}
            title={windowReady ? 'Minimize' : 'Window controls unavailable'}
            aria-label="Minimize window"
            disabled={!canUseWindowControls}
            style={windowBtnBase}
            onMouseEnter={e => {
              if (!canUseWindowControls) return
              e.currentTarget.style.color = 'var(--text)'
              e.currentTarget.style.background = 'var(--surface-2)'
              e.currentTarget.style.borderColor = 'var(--border-2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-2)'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
          </button>

          <button
            onClick={handleToggleMaximize}
            title={!windowReady ? 'Window controls unavailable' : (isMaximized ? 'Restore' : 'Maximize')}
            aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
            disabled={!canUseWindowControls}
            style={windowBtnBase}
            onMouseEnter={e => {
              if (!canUseWindowControls) return
              e.currentTarget.style.color = 'var(--text)'
              e.currentTarget.style.background = 'var(--surface-2)'
              e.currentTarget.style.borderColor = 'var(--border-2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-2)'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            {isMaximized ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3h11a2 2 0 0 1 2 2v11" />
                <path d="M5 8h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="1.5" />
              </svg>
            )}
          </button>

          <button
            onClick={handleClose}
            title={windowReady ? 'Close' : 'Window controls unavailable'}
            aria-label="Close window"
            disabled={!canUseWindowControls}
            style={windowBtnBase}
            onMouseEnter={e => {
              if (!canUseWindowControls) return
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.9)'
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 1)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-2)'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {topBar}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px 32px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>Courses</div>
          <button onClick={onOpenAdmin} style={{ padding: '6px 14px', borderRadius: 'var(--pill)', border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'color 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = 'var(--surface-2)' }}>Manage in Admin Panel →</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)', fontSize: 13 }}>Loading courses…</div>
        ) : courses.length === 0 ? (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
            <div style={{ fontSize: 14, color: 'var(--text-3)' }}>No courses yet</div>
            <button onClick={onOpenAdmin} style={{ padding: '7px 16px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>Create one in Admin Panel →</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {courses.map(course => {
              const isOpen = expanded[course.id]
              const labs = labsMap[course.id] || []
              return (
                <div key={course.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                  <div onClick={() => toggleExpand(course.id)} style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 'var(--r)', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.8"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{course.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{course.code} · {course.lab_count} lab{course.lab_count !== 1 ? 's' : ''} · {course.student_count} student{course.student_count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {labs.length === 0 ? (
                        <div style={{ padding: '20px 20px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>No labs — add them in Admin Panel</div>
                      ) : [...labs].sort((a, b) => a.number - b.number).map((lab, i) => (
                        <div key={lab.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < labs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>L{lab.number}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lab.name}</div>
                              {lab.due_date && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Due: {lab.due_date}</div>}
                            </div>
                          </div>
                          <button
                            onClick={() => onLaunchLab(course, lab)}
                            style={{ padding: '6px 14px', borderRadius: 'var(--r)', border: 'none', background: 'var(--text)', color: '#08080a', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, transition: 'opacity 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#08080a" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Launch
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
