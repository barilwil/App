import { useEffect, useState } from 'react'
import { SpeakingAnimation, ListeningAnimation } from '../audio/animations'

export default function VoiceOverlay({
  phase,
  pipelineState,
  lastUserText,
  lastAIText,
  onStop,
  onRepeat,
  onMicToggle,
  highlightedSection,
  showHandoff,
  handoffReason,
  onHandoff,
  onDismissHandoff,
  errorMessage,
}) {
  const isProcessing = phase === 'thinking' || phase === 'streaming'
  const isSpeaking = phase === 'speaking'
  const isListening = phase === 'listening'
  const hasTranscript = Boolean(lastUserText || lastAIText)
  const [showTranscript, setShowTranscript] = useState(true)
  const controlsStateClass = errorMessage
    ? ' voice-controls-error'
    : isListening
      ? ' voice-controls-listening'
      : isProcessing || pipelineState === 'transcribing'
        ? ' voice-controls-thinking'
        : ''

  useEffect(() => {
    if (hasTranscript) {
      setShowTranscript(true)
    }
  }, [hasTranscript, lastUserText, lastAIText])

  const statusText = errorMessage
    ? errorMessage
    : isListening
    ? 'Listening...'
    : phase === 'thinking'
    ? 'Thinking...'
    : phase === 'streaming'
    ? 'Generating response...'
    : isSpeaking
    ? 'Speaking...'
    : 'Tap mic to ask a question'

  const handoffLabel =
    handoffReason === 'circuit_analysis' ? 'This might work better with the Circuit Analyzer in Lab Assistant.' :
    handoffReason === 'complex_input' ? 'This needs typed input. Try Lab Assistant.' :
    handoffReason === 'detailed_explanation' ? 'Want a more detailed answer? Switch to Lab Assistant.' :
    'This might work better in Lab Assistant.'

  return (
    <div className="voice-overlay">
      {/* Guidance indicator: move above the transcript when one is visible */}
      {highlightedSection && hasTranscript && showTranscript && (
        <div className="voice-guidance-hint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="5 12 12 5 19 12" /><line x1="12" y1="5" x2="12" y2="19" />
          </svg>
          <span>See <strong>{highlightedSection.replace('-', ' ')}</strong> above</span>
        </div>
      )}

      {/* Mini transcript */}
      {hasTranscript && showTranscript && (
        <div className="voice-transcript">
          <button
            type="button"
            className="voice-transcript-close"
            onClick={() => setShowTranscript(false)}
            aria-label="Close transcript viewer"
            title="Close transcript viewer"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
          {lastUserText && (
            <div className="voice-transcript-line voice-transcript-user">
              <span className="voice-transcript-label">You</span>
              <span className="voice-transcript-text">{lastUserText}</span>
            </div>
          )}
          {lastAIText && (
            <div className="voice-transcript-line voice-transcript-ai">
              <span className="voice-transcript-label">Assistant</span>
              <span className="voice-transcript-text">{lastAIText}</span>
            </div>
          )}
        </div>
      )}

      {/* Handoff prompt */}
      {showHandoff && (
        <div className="voice-handoff">
          <span className="voice-handoff-text">{handoffLabel}</span>
          <div className="voice-handoff-actions">
            <button className="voice-handoff-btn primary" onClick={onHandoff}>Switch to Lab Assistant</button>
            <button className="voice-handoff-btn" onClick={onDismissHandoff}>Stay here</button>
          </div>
        </div>
      )}

      {/* Guidance indicator */}
      {highlightedSection && (!hasTranscript || !showTranscript) && (
        <div className="voice-guidance-hint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="5 12 12 5 19 12" /><line x1="12" y1="5" x2="12" y2="19" />
          </svg>
          <span>See <strong>{highlightedSection.replace('-', ' ')}</strong> above</span>
        </div>
      )}

      {/* Control bar */}
      <div className={`voice-controls${controlsStateClass}`}>
        <div className="voice-status">
          {/* Status indicator */}
          {isListening && <ListeningAnimation compact />}
          {isSpeaking && <SpeakingAnimation active compact />}
          {isProcessing && <div className="voice-spinner" />}
          {!isListening && !isSpeaking && !isProcessing && !errorMessage && (
            <div className="voice-idle-dot" />
          )}
          {errorMessage && (
            <div className="voice-error-dot" />
          )}
          <span className="voice-status-text">{statusText}</span>
        </div>

        <div className="voice-actions">
          {/* Stop button — visible while speaking or processing */}
          {(isSpeaking || isProcessing) && (
            <button className="voice-btn voice-btn-stop" onClick={onStop} title="Stop">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          )}

          {/* Repeat button — visible when we have a last AI response and idle */}
          {lastAIText && phase === 'idle' && !errorMessage && (
            <button className="voice-btn voice-btn-repeat" onClick={onRepeat} title="Repeat last response">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
          )}

          {/* Mic button */}
          <button
            className={`voice-mic-btn${isListening ? ' listening' : ''}${errorMessage ? ' error' : ''}`}
            onClick={onMicToggle}
            title={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
