import { useState, useEffect, useRef } from 'react'
import AIMessage from './AIMessage'
import UserMessage from './UserMessage'
import BottomBar from './BottomBar'
import CircuitDrawer from '../circuit/CircuitDrawer'
import LabDashboard from '../labs/LabDashboard'
import VoiceOverlay from '../dashboard/VoiceOverlay'
import Markdown from '../../components/Markdown'
import { speak, stopSpeaking } from '../audio/tts'

export default function ChatScreen({
                                     student,
                                     messages,
                                     phase,
                                     setPhase,
                                     streamText,
                                     setStreamText,
                                     streamBuf,
                                     thinkDuration,
                                     interrupted,
                                     pipelineState,
                                     audioWsRef,
                                     liveText,
                                     setLiveText,
                                     typingOpen,
                                     setTypingOpen,
                                     typedText,
                                     setTypedText,
                                     sleeping,
                                     convoRef,
                                     suppressScrollRef,
                                     textareaRef,
                                     sendMessage,
                                     handleRetryMessage,
                                     handleCircuitSubmit,
                                     handleEnd,
                                     appWindow,
                                     scrollBottom,
                                     chatTab,
                                     setChatTab,
                                     activeLab,
                                     activeCourse,
                                     ta,
                                     dashVoice,
                                     circuitSubmitPending,
                                   }) {
  const [circuitOpen, setCircuitOpen] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const isActive = phase === 'listening' || phase === 'thinking' || phase === 'streaming' || phase === 'speaking'
  const circuitBusy = phase === 'thinking' || phase === 'streaming' || circuitSubmitPending

  // Scroll-to-bottom button
  useEffect(() => {
    const el = convoRef.current
    if (!el) return
    const onScroll = () => {
      if (suppressScrollRef.current) return
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowScrollBtn(distFromBottom > 150)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [chatTab])

  // Textarea auto-expand
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [typedText])

  // Focus textarea when typing opens
  useEffect(() => {
    if (typingOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50)
      setTimeout(() => scrollBottom(), 80)
    }
  }, [typingOpen])

  // Scroll when switching to assistant tab and there's history
  useEffect(() => {
    if (chatTab === 'assistant' && messages.length) scrollBottom()
  }, [chatTab])

  const handleStopSpeaking = () => {
    stopSpeaking()
    setPhase('idle')
    setStreamText('')
    streamBuf.current = ''
  }

  const handleRepeat = () => {
    if (dashVoice.lastAISpoken) {
      speak(
          dashVoice.lastAISpoken,
          () => setPhase('speaking'),
          () => setPhase('idle'),
      )
    }
  }

  const handleMicToggle = () => {
    const nextType = phase === 'listening' ? 'stop' : 'listen'
    const ws = audioWsRef.current
    if (!ws) return

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: nextType }))
      return
    }

    if (nextType === 'listen' && ws.readyState === WebSocket.CONNECTING) {
      if (ws.__pendingListen) return
      ws.__pendingListen = true
      ws.addEventListener('open', () => {
        ws.__pendingListen = false
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'listen' }))
        }
      }, { once: true })
    }
  }

  return (
      <div className="chat-screen">

        {sleeping && (
            <div
                className="sleep-overlay"
                onMouseDown={e => { e.stopPropagation(); handleEnd() }}
                onTouchStart={e => { e.stopPropagation(); handleEnd() }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>Tap to wake</div>
            </div>
        )}

        {/* Top bar */}
        <div className="top-bar">
          <div className="top-bar-left">
            <div className="top-name">{student?.name || ''}</div>
            {activeLab && (
                <div className="chat-tabs">
                  <button
                      className={`tab-btn${chatTab === 'lab' ? ' active' : ''}`}
                      onClick={() => setChatTab('lab')}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
                    </svg>
                    Lab Guide
                  </button>
                  <button
                      className={`tab-btn${chatTab === 'assistant' ? ' active' : ''}`}
                      onClick={() => setChatTab('assistant')}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Lab Assistant
                  </button>
                </div>
            )}
          </div>
          <div className="top-bar-right">
            {/*
          <button className="ta-btn" onClick={() => {}} title="Call TA (coming soon)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/>
            </svg>
            Call TA
          </button>
          */}
            <button className="end-btn" onClick={handleEnd}>End session</button>
          </div>
        </div>

        {/* Lab Dashboard tab — voice-first */}
        {chatTab === 'lab' && (
            <div className="chat-lab-panel">
              <LabDashboard
                  lab={activeLab}
                  course={activeCourse}
                  ta={ta}
                  highlightedSection={dashVoice.highlightedSection}
              />
              <VoiceOverlay
                  phase={phase}
                  pipelineState={pipelineState}
                  lastUserText={dashVoice.lastUserText}
                  lastAIText={dashVoice.lastAIText}
                  onStop={handleStopSpeaking}
                  onRepeat={handleRepeat}
                  onMicToggle={handleMicToggle}
                  highlightedSection={dashVoice.highlightedSection}
                  showHandoff={dashVoice.showHandoff}
                  handoffReason={dashVoice.handoffReason}
                  onHandoff={() => { setChatTab('assistant'); dashVoice.dismissHandoff() }}
                  onDismissHandoff={dashVoice.dismissHandoff}
                  errorMessage={dashVoice.errorState}
              />
            </div>
        )}

        {/* Lab Assistant tab — typed-only, full conversation */}
        {chatTab === 'assistant' && (
            <div className="convo" ref={convoRef}>
              <div className="convo-inner">
                {messages.map((m, i) => {
                  const isLatestUser = m.role === 'user' &&
                      i === [...messages].reverse().findIndex(x => x.role === 'user') * -1 + messages.length - 1
                  return m.role === 'user'
                      ? <UserMessage key={i} text={m.text} onRetry={handleRetryMessage} isLatest={isLatestUser} />
                      : <div key={i} className="msg-ai">
                        <AIMessage
                            text={m.text}
                            interrupted={interrupted && i === messages.length - 1}
                            thinkDuration={i === messages.length - 1 ? thinkDuration : null}
                        />
                      </div>
                })}
                {phase === 'thinking' && (
                    <div className="msg-ai">
                      <div className="thinking-indicator">
                        <div className="think-spinner" />
                        <span className="think-label">Thinking…</span>
                      </div>
                    </div>
                )}
                {phase === 'streaming' && streamText && (
                    <div className="msg-ai">
                      <Markdown content={streamText} />
                      <span className="cursor-blink"/>
                    </div>
                )}
                {messages.length === 0 && !isActive && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
                      Your conversation will appear here
                    </div>
                )}
              </div>
            </div>
        )}

        {chatTab === 'assistant' && (
            <BottomBar
                typingOpen={true}
                setTypingOpen={setTypingOpen}
                liveText={liveText}
                typedText={typedText}
                setTypedText={setTypedText}
                pipelineState={pipelineState}
                phase={phase}
                audioWsRef={audioWsRef}
                textareaRef={textareaRef}
                streamBuf={streamBuf}
                setPhase={setPhase}
                setStreamText={setStreamText}
                setLiveText={setLiveText}
                onCircuitOpen={() => { if (!circuitBusy) setCircuitOpen(true) }}
                circuitDisabled={circuitBusy}
                sendMessage={sendMessage}
                showScrollBtn={showScrollBtn}
                suppressScrollRef={suppressScrollRef}
                setShowScrollBtn={setShowScrollBtn}
                scrollBottom={scrollBottom}
                mode="assistant"
            />
        )}

        <CircuitDrawer
            open={circuitOpen}
            onClose={() => setCircuitOpen(false)}
            onSubmit={handleCircuitSubmit}
            activeLab={activeLab}
            submitDisabled={circuitBusy}
        />
      </div>
  )
}
