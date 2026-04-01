import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../../app/constants'

export default function TALoginScreen({ onSuccess }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const emailRef = useRef(null)
  useEffect(() => { setTimeout(() => emailRef.current?.focus(), 100) }, [])

  const handleSubmit = async () => {
    if (!email.trim() || !password) return
    setLoading(true); setError('')
    try {
      const resp = await fetch(`${API_URL}/ta/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      })
      if (!resp.ok) {
        const err = await resp.json()
        setError(err.detail || 'Invalid credentials')
        return
      }
      const data = await resp.json()
      onSuccess(data)
    } catch { setError('Connection error. Make sure the backend is running.') }
    finally { setLoading(false) }
  }

  return (
    <div className="screen" style={{ height: '100vh' }}>
      <div className="uin-card" style={{ WebkitAppRegion: 'no-drag' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="uin-title">TA Login</div>
          <div className="uin-sub" style={{ marginTop: 6 }}>Sign in to manage your course</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            ref={emailRef}
            className="uin-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ fontSize: 14, letterSpacing: '0.01em', textAlign: 'left', fontFamily: 'var(--font)' }}
          />
          <input
            className="uin-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ fontSize: 14, letterSpacing: '0.01em', textAlign: 'left', fontFamily: 'var(--font)' }}
          />
        </div>
        {error && <div className="uin-error">{error}</div>}
        <button className="uin-btn" onClick={handleSubmit} disabled={!email.trim() || !password || loading}>
          {loading ? <div className="uin-spinner"><div className="spinner" /></div> : 'Sign In →'}
        </button>
      </div>
    </div>
  )
}
