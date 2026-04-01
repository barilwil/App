export default function UINScreen({ uinInput, setUinInput, uinError, uinLoading, onSubmit, onBack, uinRef }) {
  return (
    <div className="screen uin-screen">
      <div className="uin-card" style={{ WebkitAppRegion: 'no-drag' }}>
        <div>
          <div className="uin-title">Welcome</div>
          <div className="uin-sub" style={{ marginTop: 6 }}>Enter your UIN to continue</div>
        </div>
        <input
          ref={uinRef}
          className="uin-input"
          type="text"
          inputMode="numeric"
          maxLength={12}
          placeholder="Enter UIN"
          value={uinInput}
          onChange={e => { setUinInput(e.target.value.replace(/\D/g, '')); }}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
        />
        {uinError && <div className="uin-error">{uinError}</div>}
        <button className="uin-btn" onClick={onSubmit} disabled={!uinInput.trim() || uinLoading}>
          {uinLoading
            ? <div className="uin-spinner"><div className="spinner" /></div>
            : 'Continue →'
          }
        </button>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
