import { useState, useRef, useCallback, useEffect } from 'react'
import { WS_URL } from '../app/constants'
import { speak } from '../features/audio/tts'

export function useChatSocket({ student, captionsOn, setMessages, onScrollBottom, saveConversation, onGuidance, onHandoff, onSpokenText }) {
  const [phase, setPhase]               = useState('idle')
  const [streamText, setStreamText]     = useState('')
  const [thinkDuration, setThinkDuration] = useState(null)
  const [interrupted, setInterrupted]   = useState(false)

  const wsRef         = useRef(null)
  const streamBuf     = useRef('')
  const thinkStartRef = useRef(null)
  const spokenTextRef = useRef('')

  // Keep a stable ref to the latest captionsOn value so the WS handler
  // can read it without creating a dependency that triggers reconnect.
  const captionsOnRef = useRef(captionsOn)
  useEffect(() => { captionsOnRef.current = captionsOn }, [captionsOn])

  // Same for student — needed inside the done handler for saveConversation.
  const studentRef = useRef(student)
  useEffect(() => { studentRef.current = student }, [student])

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'ready') return

      if (msg.type === 'token') {
        streamBuf.current += msg.content
        const displayText = streamBuf.current.replace(/<spoken>[\s\S]*?<\/spoken>/g, '').trimEnd()
        setStreamText(displayText)
        setPhase('streaming')
      }

      if (msg.type === 'done') {
        const rawBuf   = streamBuf.current
        const cleanBuf = rawBuf.replace(/<spoken>[\s\S]*?<\/spoken>/g, '').trimEnd()
        const final        = msg.display_text || cleanBuf
        const textToSpeak  = msg.spoken_text  || ''
        streamBuf.current  = ''
        setStreamText('')
        setPhase('idle')

        if (thinkStartRef.current) {
          const secs = ((Date.now() - thinkStartRef.current) / 1000).toFixed(1)
          setThinkDuration(secs)
          thinkStartRef.current = null
        }

        setMessages(prev => {
          const next = [...prev, { role: 'ai', text: final }]
          saveConversation(next)
          return next
        })

        if (captionsOnRef.current) onScrollBottom?.()

        if (msg.guidance_section) onGuidance?.(msg.guidance_section)
        if (msg.handoff) onHandoff?.(msg.handoff)
        if (textToSpeak) onSpokenText?.(textToSpeak)

        // Only auto-speak on the dashboard (voice) tab.
        // captionsOnRef is true when on the typed Lab Assistant tab.
        if (textToSpeak && !captionsOnRef.current) {
          setTimeout(() => speak(
            textToSpeak,
            () => setPhase('speaking'),
            () => setPhase('idle'),
          ), 50)
        }
      }
    }

    ws.onclose = () => setTimeout(connect, 2000)
    ws.onerror = () => ws.close()
  }, [setMessages, onScrollBottom, saveConversation])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  return {
    wsRef,
    phase,
    setPhase,
    streamText,
    setStreamText,
    thinkDuration,
    setThinkDuration,
    interrupted,
    setInterrupted,
    streamBuf,
    thinkStartRef,
  }
}
