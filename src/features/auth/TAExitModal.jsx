import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../../app/constants'

export default function TAExitModal({ onClose, onSuccess }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const emailRef = useRef(null)
  useEffect(() => { setTimeout(() => emailRef.current?.focus(), 80) }, [])

  const handleSubmit = async () => {
    if (!email.trim() || !password) return
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API_URL}/ta/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      })
      if (!r.ok) { setError('Invalid credentials'); return }
      onSuccess()
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 340, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-xl)', padding: '26px 28px 22px', boxShadow: 'var(--shadow-lg)', animation: 'fade-up 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>TA Verification</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input ref={emailRef} type="email" placeholder="TA Email" value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: '100%' }} />
          <input type="password" placeholder="Password" value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: '100%' }} />
        </div>
        {error && <div style={{ fontSize: 12, color: '#f07070', marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 'var(--pill)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!email.trim() || !password || loading}
            style={{ padding: '7px 16px', borderRadius: 'var(--r)', border: 'none', background: 'var(--text)', color: '#08080a', fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font)', opacity: (!email.trim() || !password) ? 0.3 : 1 }}>
            {loading ? '…' : 'Verify & Exit'}
          </button>
        </div>
      </div>
    </div>
  )
}
