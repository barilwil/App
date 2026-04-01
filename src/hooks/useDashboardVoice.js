import { useState, useEffect, useCallback, useRef } from 'react'

const SECTION_KEYWORDS = {
  equation: 'equations', equations: 'equations', formula: 'equations', formulas: 'equations',
  component: 'components', components: 'components', resistor: 'components', capacitor: 'components',
  objective: 'objectives', objectives: 'objectives', goal: 'objectives',
  part: 'parts', parts: 'parts',
  diagram: 'images', image: 'images', images: 'images', circuit: 'images',
  calculator: 'calculator', calculate: 'calculator',
  note: 'notes', notes: 'notes', reminder: 'notes', safety: 'notes',
  ta: 'ta-info', instructor: 'ta-info',
}

const NAV_PREFIXES = ['go to', 'show me', 'take me to', 'where is', 'where are', 'find', 'open', 'scroll to']

// Human-readable labels for TTS confirmation
const SECTION_LABELS = {
  objectives: 'Objectives',
  parts: 'Lab Parts',
  components: 'Components',
  equations: 'Key Equations',
  images: 'Circuit Diagrams',
  calculator: 'Calculator',
  notes: 'Notes & Reminders',
  'ta-info': 'TA Info',
}

export function useDashboardVoice({ messages }) {
  const [lastUserText, setLastUserText] = useState('')
  const [lastAIText, setLastAIText] = useState('')
  const [lastAISpoken, setLastAISpoken] = useState('')
  const [highlightedSection, setHighlightedSection] = useState(null)
  const [showHandoff, setShowHandoff] = useState(false)
  const [handoffReason, setHandoffReason] = useState(null)
  const [errorState, setErrorState] = useState(null)
  const [currentPart, setCurrentPart] = useState(null)

  const prevMsgCountRef = useRef(0)

  // Track last user/AI text from messages array
  useEffect(() => {
    if (messages.length <= prevMsgCountRef.current) {
      prevMsgCountRef.current = messages.length
      return
    }
    prevMsgCountRef.current = messages.length
    const last = messages[messages.length - 1]
    if (!last) return
    if (last.role === 'user') setLastUserText(last.text)
    if (last.role === 'ai') setLastAIText(last.text)
  }, [messages])

  // Auto-clear highlight after 5 seconds
  useEffect(() => {
    if (!highlightedSection) return
    const t = setTimeout(() => setHighlightedSection(null), 5000)
    return () => clearTimeout(t)
  }, [highlightedSection])

  // Scroll to highlighted section
  useEffect(() => {
    if (!highlightedSection) return
    // Small delay to let the highlight class apply first
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-section="${highlightedSection}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => clearTimeout(t)
  }, [highlightedSection])

  // Detect navigation commands from user text
  const checkNavigation = useCallback((text) => {
    if (!text) return null
    const lower = text.toLowerCase()
    const isNav = NAV_PREFIXES.some(p => lower.includes(p))
    if (!isNav) return null
    for (const [kw, section] of Object.entries(SECTION_KEYWORDS)) {
      if (lower.includes(kw)) return section
    }
    return null
  }, [])

  const handleGuidance = useCallback((section) => {
    if (section) setHighlightedSection(section)
  }, [])

  const handleHandoff = useCallback((reason) => {
    if (reason) {
      setShowHandoff(true)
      setHandoffReason(reason)
    }
  }, [])

  const dismissHandoff = useCallback(() => {
    setShowHandoff(false)
    setHandoffReason(null)
  }, [])

  const handleTranscriptError = useCallback((msg) => {
    setErrorState(msg || "Didn't catch that. Please try again.")
  }, [])

  // Returns { section, label } if this is a pure navigation command, or null
  const detectNavCommand = useCallback((text) => {
    const section = checkNavigation(text)
    if (!section) return null
    const label = SECTION_LABELS[section] || section
    return { section, label }
  }, [checkNavigation])

  // Reset all session state — call this on session end and before a new student loads
  const reset = useCallback(() => {
    setLastUserText('')
    setLastAIText('')
    setLastAISpoken('')
    setHighlightedSection(null)
    setShowHandoff(false)
    setHandoffReason(null)
    setErrorState(null)
    setCurrentPart(null)
    prevMsgCountRef.current = 0
  }, [])

  return {
    lastUserText,
    setLastUserText,
    lastAIText,
    setLastAIText,
    lastAISpoken,
    setLastAISpoken,
    highlightedSection,
    setHighlightedSection,
    showHandoff,
    handoffReason,
    handleGuidance,
    handleHandoff,
    dismissHandoff,
    errorState,
    setErrorState,
    handleTranscriptError,
    currentPart,
    setCurrentPart,
    checkNavigation,
    detectNavCommand,
    reset,
  }
}
