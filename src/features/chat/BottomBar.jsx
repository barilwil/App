import WaveformIcon from '../audio/WaveformIcon'

export default function BottomBar({
  typingOpen,
  setTypingOpen,
  liveText,
  typedText,
  setTypedText,
  pipelineState,
  phase,
  audioWsRef,
  textareaRef,
  streamBuf,
  setPhase,
  setStreamText,
  setLiveText,
  onCircuitOpen,
  sendMessage,
  showScrollBtn,
  suppressScrollRef,
  setShowScrollBtn,
  scrollBottom,
  mode = 'assistant', // 'assistant' (typed-only) or 'voice' (with mic)
  circuitDisabled = false,
  disabled = false,
}) {
  const typedOnly = mode === 'assistant'
  const barStateClass = !typedOnly && pipelineState === 'listening'
    ? ' bar-listening'
    : !typedOnly && (pipelineState === 'transcribing' || phase === 'thinking' || phase === 'streaming')
      ? ' bar-thinking'
      : ''


  const toggleMic = () => {
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
    <div className="bottom-wrap">
      {showScrollBtn && (
        <div className="scroll-float-anchor">
          <button
            className="scroll-to-bottom-btn"
            onClick={() => {
              suppressScrollRef.current = true
              setShowScrollBtn(false)
              scrollBottom()
              setTimeout(() => { suppressScrollRef.current = false }, 800)
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            Jump to latest
          </button>
        </div>
      )}

      <div className={`bar-shell${barStateClass}`}>

        {/* Typed-only mode: always show expanded text input */}
        {typedOnly && (
          <>
            <div className="bar-input-area">
              <textarea
                ref={textareaRef}
                className="bar-textarea"
                value={typedText}
                disabled={disabled}
                onChange={e => setTypedText(e.target.value)}
                onKeyDown={e => {
                  if (disabled) return
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (typedText.trim()) sendMessage(typedText) }
                }}
                placeholder={disabled ? 'Preparing website-backed chat…' : 'Type a message…'}
                rows={1}
                autoFocus
              />
            </div>
            <div className="bar-actions">
              <div className="bar-left">
                <button className="bar-btn bar-btn-debug" onClick={onCircuitOpen} title={circuitDisabled ? 'Please wait for the current response to finish' : 'Open circuit debug analyzer'} disabled={circuitDisabled || disabled}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 12h2l2-4 2 8 2-4h2"/>
                  </svg>
                  <span>Debug</span>
                </button>
              </div>
              {(phase === 'thinking' || phase === 'streaming')
                ? <button
                    className="stop-icon-btn"
                    onClick={() => { setPhase('idle'); setStreamText(''); streamBuf.current = '' }}
                    title="Stop"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <rect x="5" y="5" width="14" height="14" rx="2" fill="#08080a"/>
                    </svg>
                  </button>
                : typedText.trim()
                  ? <button className="send-btn" onClick={() => sendMessage(typedText)} disabled={disabled}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                      </svg>
                    </button>
                  : null
              }
            </div>
          </>
        )}

        {/* Voice mode: original behavior with mic */}
        {!typedOnly && typingOpen && (
          <>
            <div className="bar-input-area">
              <textarea
                ref={textareaRef}
                className={`bar-textarea${(pipelineState === 'listening' || pipelineState === 'transcribing') && !liveText && !typedText ? ' bar-textarea-pulse' : ''}${(liveText || (pipelineState === 'listening' && typedText)) ? ' bar-textarea-live' : ''}`}
                value={liveText || typedText}
                onChange={e => { if (pipelineState === 'idle') setTypedText(e.target.value) }}
                onKeyDown={e => {
                  if (disabled) return
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (typedText.trim()) sendMessage(typedText) }
                  if (e.key === 'Escape') { setLiveText(''); setTypingOpen(false); setTypedText('') }
                }}
                placeholder={pipelineState === 'listening' ? 'Say something���' : pipelineState === 'transcribing' ? 'Transcribing…' : 'Type a message…'}
                rows={1}
                readOnly={pipelineState === 'listening' || pipelineState === 'transcribing'}
                autoFocus={pipelineState === 'idle'}
              />
            </div>
            <div className="bar-actions">
              <div className="bar-left">
                <button className="bar-btn bar-btn-debug" onClick={onCircuitOpen} title={circuitDisabled ? 'Please wait for the current response to finish' : 'Open circuit debug analyzer'} disabled={circuitDisabled || disabled}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 12h2l2-4 2 8 2-4h2"/>
                  </svg>
                  <span>Debug</span>
                </button>
                <button className="bar-btn" onClick={() => { setTypingOpen(false); setTypedText('') }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              {(phase === 'thinking' || phase === 'streaming')
                ? <button
                    className="stop-icon-btn"
                    onClick={() => { setPhase('idle'); setStreamText(''); streamBuf.current = '' }}
                    title="Stop"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <rect x="5" y="5" width="14" height="14" rx="2" fill="#08080a"/>
                    </svg>
                  </button>
                : typedText.trim()
                  ? <button className="send-btn" onClick={() => sendMessage(typedText)} disabled={disabled}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                      </svg>
                    </button>
                  : <button
                      className={`mic-btn ${phase === 'listening' ? 'listening' : ''}`}
                      onClick={toggleMic}
                    >
                      <WaveformIcon size={18} color={phase === 'listening' ? 'white' : '#000'} />
                    </button>
              }
            </div>
          </>
        )}

        {!typedOnly && !typingOpen && (
          <div className="bar-row">
            <button className="bar-btn bar-btn-debug" onClick={onCircuitOpen} title={circuitDisabled ? 'Please wait for the current response to finish' : 'Open circuit debug analyzer'} disabled={circuitDisabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 12h2l2-4 2 8 2-4h2"/>
              </svg>
              <span>Debug</span>
            </button>

            <button className="type-hint-btn" onClick={() => setTypingOpen(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M7 8h.01M12 8h.01M17 8h.01M7 12h.01M12 12h.01M17 12h.01M7 16h10"/>
              </svg>
              <span>click to type</span>
            </button>

            <div style={{ flex: 1 }} />

            {(phase === 'thinking' || phase === 'streaming')
              ? <button
                  className="stop-icon-btn"
                  onClick={() => { setPhase('idle'); setStreamText(''); streamBuf.current = '' }}
                  title="Stop"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <rect x="5" y="5" width="14" height="14" rx="2" fill="#08080a"/>
                  </svg>
                </button>
              : <button
                  className={`mic-btn ${phase === 'listening' ? 'listening' : ''}`}
                  onClick={toggleMic}
                  title={phase === 'listening' ? 'Stop listening' : 'Start listening'}
                >
                  <WaveformIcon size={18} color={phase === 'listening' ? 'white' : '#000'} />
                </button>
            }
          </div>
        )}
      </div>
    </div>
  )
}
