import { BARS } from '../../app/constants'

const BARS_COMPACT = BARS.slice(0, 8)

export function SpeakingAnimation({ active, compact }) {
  const bars = compact ? BARS_COMPACT : BARS
  return (
    <div className={`speaking-anim${compact ? ' compact' : ''}`}>
      {bars.map((dur, i) => (
        <div
          key={i}
          className={`sa-bar${active ? ' active-speaking' : ''}`}
          style={{ '--dur': `${dur}s`, '--dl': `${i * 0.05}s` }}
        />
      ))}
    </div>
  )
}

export function ListeningAnimation({ compact }) {
  const bars = compact ? BARS_COMPACT : BARS
  return (
    <div className={`waveform${compact ? ' compact' : ''}`}>
      {bars.map((dur, i) => (
        <div key={i} className="w-bar active" style={{ '--dur': `${dur}s`, '--dl': `${i * 0.05}s` }} />
      ))}
    </div>
  )
}

export function IdleAnimation() {
  return (
    <div className="waveform">
      {BARS.map((_, i) => (
        <div key={i} className="w-bar idle" />
      ))}
    </div>
  )
}
