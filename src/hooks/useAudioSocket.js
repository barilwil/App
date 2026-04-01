import { useState, useRef, useCallback, useEffect } from 'react'
import { AUDIO_WS_URL } from '../app/constants'

/**
 * useAudioSocket — session-scoped audio websocket hook.
 *
 * Props
 * ─────
 *   enabled     — boolean: true only while a student session is active
 *   sessionId   — string | null: opaque id for the current student voice session;
 *                 a new value must be generated for every new student login
 *
 * Guarantees
 * ──────────
 *   • The socket is created iff enabled === true && sessionId is non-null
 *   • Changing sessionId tears down the old socket before opening a new one
 *   • Setting enabled=false tears down the socket and cancels all pending timers
 *   • All socket callbacks check that they belong to the still-active session
 *     before mutating state or scheduling work
 *   • The auto-send timer re-validates the session before calling sendMessage
 *   • Inbound messages whose session_id does not match are silently dropped
 */
export function useAudioSocket({
  enabled,
  sessionId,
  screenRef,
  studentRef,
  sendMessageRef,
  onPhaseChange,
  setLiveText,
  setTypedText,
  setTypingOpen,
  onTranscriptError,
}) {
  const [pipelineState, setPipelineState] = useState('idle')

  const audioWsRef          = useRef(null)
  // Tracks the currently active session id; set to null when session is torn down
  const currentSessionIdRef = useRef(null)
  const reconnectTimerRef   = useRef(null)
  const autoSendTimerRef    = useRef(null)

  // ── Socket factory ──────────────────────────────────────────────────────────
  // Stable callback ([] deps) — all live state is read via refs or captured
  // per-socket via socketSessionId so no dep churn triggers reconnects.
  const connectAudioWs = useCallback((connectSessionId) => {
    const ws = new WebSocket(AUDIO_WS_URL)
    audioWsRef.current = ws

    // Identity of THIS socket's session — used to detect staleness in callbacks
    const socketSessionId = connectSessionId

    // Phase 3: set to true when the backend sends session_revoked for this socket.
    // Prevents the onclose handler from scheduling a reconnect after a deliberate
    // server-side revocation (as opposed to a transient network drop).
    let socketRevoked = false

    // ── Revoke cleanup helper ───────────────────────────────────────────────
    // Resets all transient voice UI to neutral idle immediately.
    // Called before ws.close() on session_revoked so the UI never stays stuck
    // in "listening" or "thinking" after being replaced by a newer session.
    // Idempotent — safe to call multiple times.
    const resetVoiceUiOnRevoke = () => {
      // Cancel any pending delayed auto-send — stale transcript must never fire
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current)
        autoSendTimerRef.current = null
      }
      // Cancel any pending reconnect timer proactively (onclose guard also handles
      // this, but clearing early is cleaner)
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      // Reset hook-owned audio/pipeline state indicator
      setPipelineState('idle')
      // Reset app-level phase (clears listening / thinking / speaking visuals)
      onPhaseChange('idle')
      // Clear transient transcript text and close the transcript input panel
      setLiveText('')
      setTypedText('')
      setTypingOpen(false)
    }
    // ───────────────────────────────────────────────────────────────────────

    ws.onopen = () => {
      // If the session changed before the socket finished opening, close it
      if (socketSessionId !== currentSessionIdRef.current) {
        ws.close()
        return
      }
      // Announce our session to the backend so it echoes the id on outbound msgs
      ws.send(JSON.stringify({ type: 'init', session_id: socketSessionId }))
    }

    ws.onmessage = (e) => {
      // Stale socket — this session is no longer active
      if (socketSessionId !== currentSessionIdRef.current) return

      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      // Backend session-id filtering: if the backend echoed a different id, drop
      if (msg.session_id && msg.session_id !== socketSessionId) return

      // ── Phase 3 control events ──────────────────────────────────────────
      if (msg.type === 'session_revoked') {
        // Backend confirmed this session was replaced by a newer one.
        // Order matters: reset UI first so there is no visible stale state,
        // then mark revoked (blocks reconnect in onclose), then close.
        socketRevoked = true
        resetVoiceUiOnRevoke()
        ws.close()
        return
      }

      if (msg.type === 'mic_busy') {
        // Another session owns the microphone — reset any active listening
        // state so the UI does not stay stuck showing the mic as active.
        onPhaseChange(p => p === 'listening' ? 'idle' : p)
        setPipelineState('idle')
        onTranscriptError?.('Microphone is in use by another session.')
        return
      }
      // ───────────────────────────────────────────────────────────────────

      if (msg.type === 'state') {
        setPipelineState(msg.state)

        if (msg.state === 'listening') {
          onPhaseChange('listening')
          if (screenRef.current === 'chat') {
            setTypingOpen(true)
            setTypedText('')
          }
        }
        if (msg.state === 'transcribing') {
          onPhaseChange('thinking')
        }
        if (msg.state === 'idle') {
          onPhaseChange(p => p === 'listening' ? 'idle' : p)
          setLiveText(t => { if (t) return t; setTypingOpen(false); return t })
          setTypedText(t => { if (t) return t; setTypingOpen(false); return t })
        }
      }

      if (msg.type === 'transcript') {
        if (screenRef.current !== 'chat') return
        if (!msg.text || msg.text.trim().length < 2) {
          onTranscriptError?.("Didn't catch that. Please try again.")
          return
        }
        setLiveText(msg.text)
        setTypingOpen(true)

        if (msg.auto_send && studentRef.current) {
          // Capture context at schedule time — will be re-validated before firing
          const capturedText      = msg.text
          const capturedSessionId = socketSessionId

          if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current)
          autoSendTimerRef.current = setTimeout(() => {
            autoSendTimerRef.current = null
            // Guard: session must still be active and unchanged
            if (capturedSessionId !== currentSessionIdRef.current) return
            if (!studentRef.current) return
            sendMessageRef.current(capturedText)
            setLiveText('')
            setTypedText('')
            setTypingOpen(false)
          }, 300)
        } else {
          setTypedText(msg.text)
          setLiveText('')
        }
      }
    }

    ws.onclose = () => {
      if (audioWsRef.current === ws) audioWsRef.current = null

      // Phase 3: session was explicitly revoked by the backend — do not reconnect.
      if (socketRevoked) return

      // Do not reconnect if this socket's session is no longer the active one
      if (socketSessionId !== currentSessionIdRef.current) return
      if (currentSessionIdRef.current === null) return

      // Schedule a reconnect for the same active session
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        // Re-validate before creating the new socket
        if (socketSessionId !== currentSessionIdRef.current) return
        if (currentSessionIdRef.current === null) return
        connectAudioWs(socketSessionId)
      }, 3000)
    }

    ws.onerror = () => ws.close()
  }, []) // stable — all live data accessed via refs or per-socket closures

  // ── Lifecycle driver ────────────────────────────────────────────────────────
  // Runs whenever enabled or sessionId changes.
  useEffect(() => {
    // Step 1: immediately claim / invalidate the active session ref.
    // Doing this BEFORE any async work ensures stale callbacks from the previous
    // socket see a mismatch and abort cleanly.
    currentSessionIdRef.current = (enabled && sessionId) ? sessionId : null

    // Step 2: cancel any timers that belong to the previous session
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current)
      autoSendTimerRef.current = null
    }

    if (!enabled || !sessionId) {
      // Session ended — close socket if open
      if (audioWsRef.current) {
        audioWsRef.current.close()
        audioWsRef.current = null
      }
      return
    }

    // Session active — open a fresh socket bound to this sessionId
    connectAudioWs(sessionId)

    return () => {
      // Cleanup: invalidate session so all in-flight callbacks abort
      currentSessionIdRef.current = null
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current)
        autoSendTimerRef.current = null
      }
      if (audioWsRef.current) {
        audioWsRef.current.close()
        audioWsRef.current = null
      }
    }
  }, [enabled, sessionId, connectAudioWs])

  return { audioWsRef, pipelineState }
}
