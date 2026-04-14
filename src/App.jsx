import { useEffect, useRef, useState, useCallback } from 'react'
import './index.css'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { API_URL, DEFAULT_SLEEP_MS } from './app/constants'

import TALoginScreen   from './features/auth/TALoginScreen'
import CourseDashboard from './features/auth/CourseDashboard'
import AdminPanel      from './features/admin/AdminPanel'
import StartupScreen   from './features/startup/StartupScreen'
import UINScreen       from './features/uin/UINScreen'
import ChatScreen      from './features/chat/ChatScreen'

import { useChatSocket }             from './hooks/useChatSocket'
import { useAudioSocket }            from './hooks/useAudioSocket'
import { useSleepTimer }             from './hooks/useSleepTimer'
import { useConversationPersistence } from './hooks/useConversationPersistence'
import { useDashboardVoice }         from './hooks/useDashboardVoice'
import { stopSpeaking, speak }       from './features/audio/tts'

let appWindow
try { appWindow = getCurrentWindow() } catch {}

export default function App() {
  // ── Session state ──────────────────────────────────────────────────────────
  const [screen, setScreen]             = useState('ta-login')
  const [ta, setTa]                     = useState(null)
  const [student, setStudent]           = useState(null)
  const [activeLab, setActiveLab]       = useState(null)
  const [activeCourse, setActiveCourse] = useState(null)
  const [conversationLabId, setConversationLabId] = useState(null)
  // Unique id generated for every new student voice session — drives socket lifecycle
  const [audioSessionId, setAudioSessionId] = useState(null)

  // ── UI flags ───────────────────────────────────────────────────────────────
  const [taExitOpen, setTaExitOpen] = useState(false)
  const [chatTab, setChatTab]       = useState('lab')
  const [captionsOn, setCaptionsOn] = useState(false)

  // ── Chat input state ───────────────────────────────────────────────────────
  const [messages, setMessages]     = useState([])
  const [typingOpen, setTypingOpen] = useState(false)
  const [typedText, setTypedText]   = useState('')
  const [liveText, setLiveText]     = useState('')
  const [circuitContext, setCircuitContext] = useState(null)
  const [circuitSubmitPending, setCircuitSubmitPending] = useState(false)
  const [callTAState, setCallTAState] = useState({ status: 'idle', error: '' })
  const [websiteChats, setWebsiteChats] = useState([])
  const [websiteChatsLoading, setWebsiteChatsLoading] = useState(false)
  const [websiteChatError, setWebsiteChatError] = useState('')
  const [selectedWebsiteChatId, setSelectedWebsiteChatId] = useState('')
  const [selectedWebsiteChatTitle, setSelectedWebsiteChatTitle] = useState('')
  const [websiteChatMode, setWebsiteChatMode] = useState('idle')

  // ── UIN form state ─────────────────────────────────────────────────────────
  const [uinInput, setUinInput]   = useState('')
  const [uinError, setUinError]   = useState('')
  const [uinLoading, setUinLoading] = useState(false)

  // ── Shared refs ────────────────────────────────────────────────────────────
  const convoRef          = useRef(null)
  const textareaRef       = useRef(null)
  const uinRef            = useRef(null)
  const suppressScrollRef = useRef(false)
  const messagesRef       = useRef([])
  const sleepMsRef        = useRef(DEFAULT_SLEEP_MS)
  const screenRef         = useRef(screen)
  const studentRef        = useRef(student)
  const sendMessageRef    = useRef(null)
  const chatTabRef        = useRef(chatTab)
  const prevLabIdRef      = useRef(null)
  const autoWebsiteChatKeyRef = useRef('')

  // ── Keep refs in sync ──────────────────────────────────────────────────────
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { screenRef.current  = screen   }, [screen])
  useEffect(() => { studentRef.current = student  }, [student])
  useEffect(() => { chatTabRef.current = chatTab  }, [chatTab])
  // Sync captionsOn with active tab: assistant = captions on (scrollable chat), lab = off
  useEffect(() => { setCaptionsOn(chatTab === 'assistant') }, [chatTab])

  useEffect(() => {
    if (!student) return
    if (conversationLabId == null && activeLab?.id) {
      setConversationLabId(activeLab.id)
      prevLabIdRef.current = activeLab.id
    }
  }, [student, activeLab?.id, conversationLabId])

  // ── Load settings on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(s => {
        if (!s) return
        if (s.sleep_minutes) sleepMsRef.current = parseFloat(s.sleep_minutes) * 60 * 1000
        window._ttsRate  = parseFloat(s.tts_rate  || 1.05)
        window._ttsPitch = parseFloat(s.tts_pitch || 1.0)
      })
      .catch(() => {})
  }, [])

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { saveConversation } = useConversationPersistence({
    student,
    activeLab: { id: conversationLabId },
    websiteChatSync: selectedWebsiteChatId ? {
      chatId: selectedWebsiteChatId,
      title: selectedWebsiteChatTitle,
      courseName: activeCourse?.name || null,
      courseCode: activeCourse?.code || null,
      labName: activeLab?.name || null,
      labNumber: activeLab?.number ?? null,
    } : null,
  })

  const { sleeping, setSleeping, resetSleep } = useSleepTimer({
    active: screen === 'chat',
    sleepMsRef,
  })

  const scrollBottom = useCallback(() => setTimeout(() => {
    convoRef.current?.scrollTo({ top: convoRef.current.scrollHeight, behavior: 'smooth' })
  }, 50), [])

  // ── Dashboard voice state ─────────────────────────────────────────────────
  const dashVoice = useDashboardVoice({ messages })

  const {
    wsRef,
    phase, setPhase,
    streamText, setStreamText,
    thinkDuration,
    interrupted, setInterrupted,
    streamBuf,
    thinkStartRef,
  } = useChatSocket({
    student,
    captionsOn,
    setMessages,
    onScrollBottom: scrollBottom,
    saveConversation,
    onGuidance: dashVoice.handleGuidance,
    onHandoff: dashVoice.handleHandoff,
    onSpokenText: dashVoice.setLastAISpoken,
  })

  // Clear dashboard error when voice phase changes from idle
  useEffect(() => {
    if (phase !== 'idle') dashVoice.setErrorState(null)
  }, [phase])

  const { audioWsRef, pipelineState } = useAudioSocket({
    // Socket only exists during an active student session with a live session id
    enabled:   screen === 'chat' && !!student && !!audioSessionId,
    sessionId: audioSessionId,
    screenRef,
    studentRef,
    sendMessageRef,
    onPhaseChange: setPhase,
    setLiveText,
    setTypedText,
    setTypingOpen,
    onTranscriptError: dashVoice.handleTranscriptError,
  })

  // ── Actions ────────────────────────────────────────────────────────────────
  const sendMessage = useCallback((text, ctx = null, options = {}) => {
    const {
      skipUserMessage = false,
      skipProcessingSetup = false,
      messageMode = 'default',
    } = options

    if (!text.trim()) return false
    resetSleep()

    const isAssistantTab = chatTabRef.current === 'assistant'

    // ── Dashboard: intercept pure navigation commands client-side ──────────
    // These never hit the LLM — just highlight the section + brief spoken confirm.
    if (!isAssistantTab) {
      const nav = dashVoice.detectNavCommand(text)
      if (nav) {
        // Update mini-transcript
        dashVoice.setLastUserText(text)
        dashVoice.setLastAIText(`Here's the ${nav.label} section.`)
        dashVoice.setLastAISpoken(`Here's the ${nav.label} section.`)
        // Highlight + scroll
        dashVoice.setHighlightedSection(nav.section)
        // Brief spoken confirmation
        speak(
          `Here's the ${nav.label} section.`,
          () => setPhase('speaking'),
          () => setPhase('idle'),
        )
        // Clean up input state
        setLiveText('')
        setTypingOpen(false)
        setTypedText('')
        return true // ← do not send to LLM
      }
    }

    // ── Normal message path (both tabs) ───────────────────────────────────
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false
    setInterrupted(false)
    if (!skipUserMessage) setMessages(prev => [...prev, { role: 'user', text }])
    if (!skipProcessingSetup) {
      setPhase('thinking')
      thinkStartRef.current = Date.now()
    }
    setLiveText('')
    setTypingOpen(false)
    setTypedText('')

    if (isAssistantTab) scrollBottom()

    // Build dashboard context for voice mode
    const currentPart = dashVoice.currentPart || null
    const dashCtx = !isAssistantTab ? {
      mode: 'voice',
      current_part: currentPart,
    } : null
    const labCtx = activeLab ? {
      lab_id: activeLab.id ?? null,
      lab_number: activeLab.number ?? null,
      lab_name: activeLab.name ?? null,
      current_part: currentPart,
    } : null

    wsRef.current.send(JSON.stringify({
      text,
      circuit_context: ctx || circuitContext || null,
      message_mode: messageMode,
      student_name: student?.name || 'Student',
      captions_on: isAssistantTab,
      dashboard_context: dashCtx,
      lab_context: labCtx,
    }))
    setCircuitContext(null)
    return true
  }, [activeLab, circuitContext, resetSleep, student, scrollBottom, setInterrupted, setPhase, wsRef, thinkStartRef, dashVoice])

  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // ── Send history to WS when student is set ─────────────────────────────────
  useEffect(() => {
    if (!student || !wsRef.current) return
    const tryInit = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'init', history: student.messages || [] }))
      } else setTimeout(tryInit, 300)
    }
    tryInit()
  }, [student])

  useEffect(() => {
    const currentLabId = activeLab?.id ?? null
    const previousLabId = prevLabIdRef.current

    if (!student?.uin || !currentLabId || !previousLabId || previousLabId === currentLabId) return

    let cancelled = false

    const switchLabConversation = async () => {
      await saveConversation(messagesRef.current, previousLabId)

      try {
        const resp = await fetch(`${API_URL}/verify-uin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uin: student.uin, lab_id: currentLabId })
        })

        if (!resp.ok) throw new Error('Failed to load lab conversation')

        const data = await resp.json()
        const uiMessages = (data.messages || []).map(m => ({
          role: m.role === 'assistant' ? 'ai' : 'user',
          text: m.content,
        }))

        if (cancelled) return

        prevLabIdRef.current = currentLabId
        setConversationLabId(currentLabId)
        setStudent(prev => prev ? { ...prev, messages: data.messages || [] } : prev)
        setMessages(uiMessages)
        setStreamText('')
        setLiveText('')
        setTypingOpen(false)
        setTypedText('')
        setPhase('idle')

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'init', history: data.messages || [] }))
        }
      } catch {
        if (cancelled) return

        prevLabIdRef.current = currentLabId
        setConversationLabId(currentLabId)
        setStudent(prev => prev ? { ...prev, messages: [] } : prev)
        setMessages([])
        setStreamText('')
        setLiveText('')
        setTypingOpen(false)
        setTypedText('')
        setPhase('idle')

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'init', history: [] }))
        }
      }
    }

    switchLabConversation()
    return () => { cancelled = true }
  }, [activeLab?.id, student?.uin, saveConversation, wsRef, setPhase, setStreamText])

  // ── UIN focus ──────────────────────────────────────────────────────────────
  useEffect(() => { if (screen === 'uin') setTimeout(() => uinRef.current?.focus(), 100) }, [screen])

  const handleUINSubmit = async () => {
    const uin = uinInput.trim()
    if (!uin) return
    if (!activeLab?.id) {
      setUinError('No active lab selected. Please return to the dashboard and launch a lab again.')
      return
    }
    setUinLoading(true); setUinError('')
    try {
      const resp = await fetch(`${API_URL}/verify-uin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uin, lab_id: activeLab?.id ?? null })
      })
      if (!resp.ok) {
        const err = await resp.json()
        setUinError(err.detail || 'UIN not found. Please try again.')
        return
      }
      const data = await resp.json()
      const uiMessages = (data.messages || []).map(m => ({
        role: m.role === 'assistant' ? 'ai' : 'user',
        text: m.content,
      }))
      dashVoice.reset()
      // Fresh session id for every new student — ensures audio socket is scoped
      // to this session and cannot leak state to or from any other session
      const newAudioSessionId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setAudioSessionId(newAudioSessionId)
      setConversationLabId(activeLab?.id ?? null)
      prevLabIdRef.current = activeLab?.id ?? null
      setStudent({ uin: data.uin, name: data.name, messages: data.messages || [] })
      setMessages(uiMessages)
      setScreen('chat')
    } catch { setUinError('Connection error. Make sure the backend is running.') }
    finally { setUinLoading(false) }
  }

  const handleRetryMessage = useCallback((text) => {
    setMessages(prev => {
      const lastUserIdx = [...prev].map((m,i) => m.role === 'user' ? i : -1).filter(i => i !== -1).pop()
      if (lastUserIdx !== undefined) return prev.slice(0, lastUserIdx)
      return prev
    })
    setTimeout(() => sendMessage(text), 0)
  }, [sendMessage])

  const handleCircuitSubmit = useCallback(async (payload, summary) => {
    const isChatProcessing = phase === 'thinking' || phase === 'streaming' || circuitSubmitPending
    if (isChatProcessing) return false

    const analyzerPrompt = [
      'Interpret only the current circuit analyzer submission.',
      'Explain the likely fault or mismatch, what the analyzer result suggests, and the next concrete checks the student should perform.',
      'Do not answer earlier chat topics or include lab report writing advice unless the current submission explicitly asks for that.',
      `Current circuit: ${payload?.circuit_name || 'unknown'}.`,
    ].join(' ')

    setCircuitSubmitPending(true)
    setMessages(prev => [...prev, { role: 'user', text: summary }])
    setPhase('thinking')
    thinkStartRef.current = Date.now()
    setLiveText('')
    setTypingOpen(false)
    setTypedText('')
    if (chatTabRef.current === 'assistant') scrollBottom()

    try {
      const r = await fetch(`${API_URL}/debug`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const ctx = r.ok ? (await r.json()).context : null
      const sent = sendMessage(analyzerPrompt, ctx, {
        skipUserMessage: true,
        skipProcessingSetup: true,
        messageMode: 'circuit_analyzer',
      })
      if (!sent) setPhase('idle')
      return sent
    } catch {
      const sent = sendMessage(analyzerPrompt, null, {
        skipUserMessage: true,
        skipProcessingSetup: true,
        messageMode: 'circuit_analyzer',
      })
      if (!sent) setPhase('idle')
      return sent
    } finally {
      setCircuitSubmitPending(false)
    }
  }, [phase, circuitSubmitPending, sendMessage, scrollBottom, setPhase, thinkStartRef])

  const handleCallTA = useCallback(async () => {
    if (!student || !activeLab) return false

    setCallTAState({ status: 'submitting', error: '' })

    try {
      const resp = await fetch(`${API_URL}/call-ta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_uin: student?.uin != null ? String(student.uin) : null,
          student_name: student?.name || null,
          course_id: activeCourse?.id != null ? String(activeCourse.id) : null,
          course_name: activeCourse?.name || activeCourse?.code || null,
          lab_id: activeLab?.id != null ? String(activeLab.id) : null,
          lab_name: activeLab?.name || null,
          lab_number: activeLab?.number ?? null,
        })
      })

      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.detail || 'Failed to notify the website admins')

      setCallTAState({ status: 'submitted', error: '' })
      return true
    } catch (err) {
      setCallTAState({ status: 'error', error: err?.message || 'Failed to notify the website admins' })
      return false
    }
  }, [student, activeLab, activeCourse])

  const refreshWebsiteChats = useCallback(async () => {
    if (!student?.uin || !activeCourse || !activeLab) {
      setWebsiteChats([])
      setWebsiteChatError('')
      return []
    }

    setWebsiteChatsLoading(true)
    setWebsiteChatError('')
    try {
      const params = new URLSearchParams({
        student_uin: String(student.uin),
        course_name: activeCourse?.name || '',
        course_code: activeCourse?.code || '',
        lab_name: activeLab?.name || '',
      })
      if (activeLab?.number != null) params.set('lab_number', String(activeLab.number))
      const resp = await fetch(`${API_URL}/website-chats?${params.toString()}`)
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.detail || 'Failed to load website chats')
      const items = Array.isArray(data) ? data : []
      setWebsiteChats(items)
      return items
    } catch (err) {
      setWebsiteChats([])
      setWebsiteChatError(err?.message || 'Failed to load website chats')
      return []
    } finally {
      setWebsiteChatsLoading(false)
    }
  }, [student?.uin, activeCourse?.name, activeCourse?.code, activeLab?.name, activeLab?.number])

  const loadWebsiteChat = useCallback(async (chatId) => {
    if (!chatId || !student?.uin || !activeCourse || !activeLab) {
      setSelectedWebsiteChatId('')
      setSelectedWebsiteChatTitle('')
      return false
    }

    setWebsiteChatError('')
    try {
      const params = new URLSearchParams({
        student_uin: String(student.uin),
        course_name: activeCourse?.name || '',
        course_code: activeCourse?.code || '',
        lab_name: activeLab?.name || '',
      })
      if (activeLab?.number != null) params.set('lab_number', String(activeLab.number))
      const resp = await fetch(`${API_URL}/website-chats/${encodeURIComponent(chatId)}?${params.toString()}`)
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.detail || 'Failed to open the website chat')

      const historyMessages = (data?.messages || [])
        .filter((m) => ['user', 'assistant'].includes(m.role))
        .map((m) => ({ role: m.role, content: m.content || '' }))
      const uiMessages = historyMessages.map((m) => ({ role: m.role === 'assistant' ? 'ai' : 'user', text: m.content }))

      setSelectedWebsiteChatId(data.id)
      setSelectedWebsiteChatTitle(data.title || '')
      setMessages(uiMessages)
      setStudent((prev) => prev ? { ...prev, messages: historyMessages } : prev)
      setStreamText('')
      setLiveText('')
      setTypingOpen(false)
      setTypedText('')
      setPhase('idle')
      setWebsiteChatMode('website')

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'init', history: historyMessages }))
      }
      return true
    } catch (err) {
      setWebsiteChatError(err?.message || 'Failed to open the website chat')
      return false
    }
  }, [student?.uin, activeCourse?.name, activeCourse?.code, activeLab?.name, activeLab?.number, wsRef])

  const createWebsiteChat = useCallback(async () => {
    if (!student?.uin || !activeCourse || !activeLab) return false
    setWebsiteChatError('')
    try {
      const resp = await fetch(`${API_URL}/website-chats/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_uin: String(student.uin),
          student_name: student.name || null,
          course_name: activeCourse?.name || null,
          course_code: activeCourse?.code || null,
          lab_name: activeLab?.name || null,
          lab_number: activeLab?.number ?? null,
        })
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.detail || 'Failed to create a website chat')
      await refreshWebsiteChats()
      const opened = await loadWebsiteChat(data.id)
      setWebsiteChatMode(opened ? 'website' : 'fallback')
      return opened
    } catch (err) {
      setWebsiteChatError(err?.message || 'Failed to create a website chat')
      return false
    }
  }, [student?.uin, student?.name, activeCourse?.name, activeCourse?.code, activeLab?.name, activeLab?.number, refreshWebsiteChats, loadWebsiteChat])

  useEffect(() => {
    setCallTAState({ status: 'idle', error: '' })
  }, [student?.uin, activeLab?.id])

  useEffect(() => {
    if (screen !== 'chat' || !student?.uin || !activeCourse || !activeLab) {
      setWebsiteChats([])
      setSelectedWebsiteChatId('')
      setSelectedWebsiteChatTitle('')
      setWebsiteChatError('')
      return
    }

    let cancelled = false
    refreshWebsiteChats().then((items) => {
      if (cancelled) return
      if (selectedWebsiteChatId && !items.some((item) => item.id === selectedWebsiteChatId)) {
        setSelectedWebsiteChatId('')
        setSelectedWebsiteChatTitle('')
      }
      if (selectedWebsiteChatId) {
        const selected = items.find((item) => item.id === selectedWebsiteChatId)
        if (selected) setSelectedWebsiteChatTitle(selected.title || '')
      }
    })
    return () => { cancelled = true }
  }, [screen, student?.uin, activeCourse?.name, activeCourse?.code, activeLab?.name, refreshWebsiteChats, selectedWebsiteChatId])

  useEffect(() => {
    if (screen !== 'chat' || !student?.uin || !activeCourse || !activeLab) {
      autoWebsiteChatKeyRef.current = ''
      setWebsiteChatMode('idle')
      return
    }

    const contextKey = [
      student.uin,
      activeCourse?.code || activeCourse?.name || '',
      activeLab?.number ?? activeLab?.id ?? '',
    ].join('|')

    if (autoWebsiteChatKeyRef.current === contextKey && selectedWebsiteChatId) {
      setWebsiteChatMode('website')
      return
    }

    autoWebsiteChatKeyRef.current = contextKey
    let cancelled = false

    const ensureWebsiteBackedChat = async () => {
      setWebsiteChatMode('preparing')
      const items = await refreshWebsiteChats()
      if (cancelled) return

      const preferred = (selectedWebsiteChatId && items.find((item) => item.id === selectedWebsiteChatId)) || items[0]

      if (preferred) {
        const ok = await loadWebsiteChat(preferred.id)
        if (!cancelled) setWebsiteChatMode(ok ? 'website' : 'fallback')
        return
      }

      const created = await createWebsiteChat()
      if (!cancelled) setWebsiteChatMode(created ? 'website' : 'fallback')
    }

    ensureWebsiteBackedChat()
    return () => { cancelled = true }
  }, [screen, student?.uin, activeCourse?.name, activeCourse?.code, activeLab?.id, activeLab?.number, activeLab?.name, selectedWebsiteChatId, refreshWebsiteChats, loadWebsiteChat, createWebsiteChat])

  const handleTaLogout = useCallback(async () => {
    if (ta?.token) {
      fetch(`${API_URL}/ta/logout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ta.token })
      }).catch(() => {})
    }
    setTa(null)
    setScreen('ta-login')
  }, [ta])

  const handleEnd = () => {
    if (student && conversationLabId) {
      saveConversation(messagesRef.current, conversationLabId)
    }
    stopSpeaking()
    // Clearing audioSessionId sets enabled=false in useAudioSocket, which closes
    // the socket and cancels all pending reconnect / auto-send timers.
    setAudioSessionId(null)
    dashVoice.reset()
    setStudent(null)
    setConversationLabId(null)
    prevLabIdRef.current = null
    setMessages([])
    setWebsiteChats([])
    setWebsiteChatsLoading(false)
    setWebsiteChatError('')
    setSelectedWebsiteChatId('')
    setSelectedWebsiteChatTitle('')
    setWebsiteChatMode('idle')
    setStreamText('')
    setLiveText('')
    setUinInput('')
    setUinError('')
    setPhase('idle')
    setTypingOpen(false)
    setTypedText('')
    setCaptionsOn(false)
    setChatTab('lab')
    streamBuf.current = ''
    setScreen('startup')
  }

  // ── Screen router ──────────────────────────────────────────────────────────
  if (screen === 'ta-login') {
    return <TALoginScreen onSuccess={(taData) => { setTa(taData); setScreen('course-dashboard') }} />
  }

  if (screen === 'admin-panel') {
    return <AdminPanel ta={ta} onClose={() => setScreen('course-dashboard')} />
  }

  if (screen === 'course-dashboard') {
    return (
      <CourseDashboard
        ta={ta}
        onLogout={handleTaLogout}
        onOpenAdmin={() => setScreen('admin-panel')}
        onLaunchLab={(course, lab) => { setActiveCourse(course); setActiveLab(lab); setScreen('startup') }}
        appWindow={appWindow}
      />
    )
  }

  if (screen === 'chat') {
    return (
      <ChatScreen
        student={student}
        messages={messages}
        phase={phase}
        setPhase={setPhase}
        streamText={streamText}
        setStreamText={setStreamText}
        streamBuf={streamBuf}
        thinkDuration={thinkDuration}
        interrupted={interrupted}
        pipelineState={pipelineState}
        audioWsRef={audioWsRef}
        liveText={liveText}
        setLiveText={setLiveText}
        typingOpen={typingOpen}
        setTypingOpen={setTypingOpen}
        typedText={typedText}
        setTypedText={setTypedText}
        sleeping={sleeping}
        convoRef={convoRef}
        suppressScrollRef={suppressScrollRef}
        textareaRef={textareaRef}
        sendMessage={sendMessage}
        handleRetryMessage={handleRetryMessage}
        handleCircuitSubmit={handleCircuitSubmit}
        circuitSubmitPending={circuitSubmitPending}
        handleEnd={handleEnd}
        appWindow={appWindow}
        scrollBottom={scrollBottom}
        chatTab={chatTab}
        setChatTab={setChatTab}
        activeLab={activeLab}
        activeCourse={activeCourse}
        ta={ta}
        dashVoice={dashVoice}
        onCallTA={handleCallTA}
        callTAState={callTAState}
        websiteChats={websiteChats}
        websiteChatsLoading={websiteChatsLoading}
        websiteChatError={websiteChatError}
        selectedWebsiteChatId={selectedWebsiteChatId}
        websiteChatMode={websiteChatMode}
        onSelectWebsiteChat={loadWebsiteChat}
        onRefreshWebsiteChats={refreshWebsiteChats}
        onCreateWebsiteChat={createWebsiteChat}
      />
    )
  }

  // ── Startup / UIN ──────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {screen === 'startup' && (
        <StartupScreen
          activeLab={activeLab}
          activeCourse={activeCourse}
          taExitOpen={taExitOpen}
          setTaExitOpen={setTaExitOpen}
          onEnterUIN={() => setScreen('uin')}
          onTAExitSuccess={() => {
            setTaExitOpen(false)
            setActiveLab(null)
            setActiveCourse(null)
            setScreen('course-dashboard')
          }}
        />
      )}
      {screen === 'uin' && (
        <UINScreen
          uinInput={uinInput}
          setUinInput={(val) => { setUinInput(val); setUinError('') }}
          uinError={uinError}
          uinLoading={uinLoading}
          onSubmit={handleUINSubmit}
          onBack={() => setScreen('startup')}
          uinRef={uinRef}
        />
      )}
    </div>
  )
}
