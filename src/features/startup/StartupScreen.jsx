import TAExitModal from '../auth/TAExitModal'

export default function StartupScreen({ activeLab, activeCourse, taExitOpen, setTaExitOpen, onEnterUIN, onTAExitSuccess }) {
  return (
    <div className="startup-screen" style={{ WebkitAppRegion: 'no-drag' }}>

      <div className="startup-bg-glow" />

      {activeLab && (
        <div className="startup-lab-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18"/>
          </svg>
          <span>{activeCourse?.code}</span>
          <span className="startup-lab-sep">·</span>
          <span>Lab {activeLab.number}: {activeLab.name}</span>
        </div>
      )}

      <div className="startup-center">
        <div className="startup-orb-wrap">
          <div className="startup-orb" />
          <div className="startup-orb-ring" />
          <div className="startup-orb-ring startup-orb-ring-2" />
        </div>

        <div className="startup-wordmark">
          <span className="startup-wordmark-circuit">Circuit</span>
          <span className="startup-wordmark-ai">AI</span>
        </div>
        <div className="startup-tagline">Your intelligent lab assistant</div>

        <div className="startup-hint">
          <div className="pulse-dot" />
          <span>Tap below to begin</span>
        </div>

        <button className="startup-uin-btn" onClick={onEnterUIN}>
          Enter UIN
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>

      <button
        className="startup-ta-exit"
        onClick={() => setTaExitOpen(true)}
        onMouseEnter={e => e.currentTarget.classList.add('hov')}
        onMouseLeave={e => e.currentTarget.classList.remove('hov')}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        TA Exit
      </button>

      {taExitOpen && (
        <TAExitModal
          onClose={() => setTaExitOpen(false)}
          onSuccess={onTAExitSuccess}
        />
      )}
    </div>
  )
}
