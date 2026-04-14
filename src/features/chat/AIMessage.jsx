import Markdown from '../../components/Markdown'

const REASONING_RE = /<details\b[^>]*type=["']reasoning["'][^>]*>/i

export default function AIMessage({ text, interrupted, thinkDuration }) {
  const content = REASONING_RE.test(text || '')
    ? text
    : (thinkDuration !== null && thinkDuration !== undefined
      ? `<details type="reasoning" done="true" duration="0"><summary>Thought for ${thinkDuration} seconds</summary></details>\n\n${text || ''}`
      : (text || ''))

  return (
    <div className="ai-msg-wrap">
      <Markdown content={content} />
      {interrupted && (
        <div className="interrupted-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Response was interrupted
        </div>
      )}
    </div>
  )
}
