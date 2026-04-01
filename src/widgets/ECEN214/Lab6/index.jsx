import { useState } from 'react'

// ── ECEN 214 Lab 6 — Transient Response of a 1st Order RC Circuit ─────────────
// Exports: labData, RCOscillatorCalc

/* ── Accent colors ── */
const C_BLUE  = 'rgba(100,160,240,0.92)'
const C_TEAL  = 'rgba(100,210,180,0.92)'
const C_AMBER = 'rgba(240,180,60,0.95)'
const C_GREEN = 'rgba(80,210,130,0.92)'
const C_RED   = 'rgba(220,80,80,0.92)'
const C_MUTED = 'rgba(255,255,255,0.22)'

/* ── Formatting helpers ── */
const fv = (v, d = 2) => isFinite(v) && !isNaN(v) ? v.toFixed(d) : '---'
const fHz = v => {
  if (!isFinite(v) || v <= 0) return '---'
  if (v >= 1) return fv(v, 3) + ' Hz'
  return fv(v * 1000, 2) + ' mHz'
}
const fTime = v => {
  if (!isFinite(v) || v <= 0) return '---'
  if (v >= 1)     return fv(v, 3) + ' s'
  if (v >= 0.001) return fv(v * 1000, 2) + ' ms'
  return fv(v * 1e6, 1) + ' µs'
}

/* ── Shared slider ── */
function CalcSlider({ label, value, onChange, min, max, step = 1, unit = '', fmt, color = C_AMBER }) {
  return (
    <div className="calc-ctrl-group">
      <div className="calc-ctrl-row">
        <span className="calc-ctrl-name">{label}</span>
        <span className="calc-ctrl-val" style={{ color }}>
          {fmt ? fmt(value) : value + unit}
        </span>
      </div>
      <div className="calc-slider-wrap">
        <input type="range" className="calc-slider"
          style={{ '--thumb-color': color }}
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(+e.target.value)} />
      </div>
    </div>
  )
}

/* ── SVG layout constants ── */
const SVW = 400, SVH = 175
const PL = 46, PR = 8, PT = 10, PB = 28
const PIW = SVW - PL - PR
const PIH = SVH - PT - PB

const mxFn = (t, tMax) => PL + (t / tMax) * PIW
const myFn = (v, vMin, vMax) => PT + PIH - (v - vMin) / (vMax - vMin) * PIH

/* ════════════════════════════════════════
   SVG: RC step-response plot
════════════════════════════════════════ */
function StepResponseSVG({ R, C, Vin, Vo }) {
  const tau  = R * C
  const tMax = 5 * tau
  const dV   = Vin - Vo

  // Y range with padding
  const vLo  = Math.min(Vo, Vin)
  const vHi  = Math.max(Vo, Vin)
  const vPad = Math.max(Math.abs(dV) * 0.12, 0.3)
  const vMin = vLo - vPad
  const vMax = vHi + vPad

  const mx = t => mxFn(t, tMax)
  const my = v => myFn(v, vMin, vMax)

  // 200-point curve
  const N    = 200
  const pts  = Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * tMax
    const v = Vin + (Vo - Vin) * Math.exp(-t / tau)
    return `${mx(t).toFixed(1)},${my(v).toFixed(1)}`
  }).join(' ')

  const vAtTau = Vin + (Vo - Vin) * Math.exp(-1)

  return (
    <svg viewBox={`0 0 ${SVW} ${SVH}`} className="lab6-svg">
      {/* nτ dashed grid */}
      {[1, 2, 3, 4, 5].map(n => (
        <line key={n} x1={mx(n * tau)} y1={PT} x2={mx(n * tau)} y2={PT + PIH}
          stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" strokeWidth="1" />
      ))}

      {/* V_in asymptote */}
      <line x1={PL} y1={my(Vin)} x2={SVW - PR} y2={my(Vin)}
        stroke="rgba(100,210,180,0.22)" strokeDasharray="4,3" strokeWidth="1" />

      {/* Curve */}
      <polyline points={pts} fill="none" stroke={C_BLUE} strokeWidth="2" strokeLinejoin="round" />

      {/* τ dot */}
      <line x1={mx(tau)} y1={PT} x2={mx(tau)} y2={PT + PIH}
        stroke="rgba(240,180,60,0.3)" strokeDasharray="2,2" strokeWidth="1" />
      <circle cx={mx(tau)} cy={my(vAtTau)} r="3.5" fill={C_AMBER} />

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + PIH} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <line x1={PL} y1={PT + PIH} x2={SVW - PR} y2={PT + PIH} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

      {/* Y labels */}
      <text x={PL - 5} y={my(Vo) + 4}  textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.3)">{fv(Vo, 1)}V</text>
      <text x={PL - 5} y={my(Vin) + 4} textAnchor="end" fontSize="8" fill="rgba(100,210,180,0.7)">{fv(Vin, 1)}V</text>
      {Math.abs(vAtTau - Vo) > 0.2 && Math.abs(vAtTau - Vin) > 0.2 && (
        <text x={PL - 5} y={my(vAtTau) + 4} textAnchor="end" fontSize="7" fill="rgba(240,180,60,0.6)">{fv(vAtTau, 2)}V</text>
      )}

      {/* X labels */}
      <text x={PL}           y={PT + PIH + 16} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.25)">0</text>
      {[1, 2, 3, 4, 5].map(n => (
        <text key={n} x={mx(n * tau)} y={PT + PIH + 16}
          textAnchor="middle" fontSize="8"
          fill={n === 1 ? 'rgba(240,180,60,0.6)' : 'rgba(255,255,255,0.25)'}>{n}τ</text>
      ))}
    </svg>
  )
}

/* ════════════════════════════════════════
   Oscillator waveform generator (analytical)
════════════════════════════════════════ */
function generateOscWaveform(Vsat, gamma, tau, numPeriods = 2.5) {
  const k = (1 - gamma) / (1 + gamma)
  if (k <= 0 || k >= 1 || !isFinite(k) || tau <= 0) return null
  const halfT = -tau * Math.log(k)
  if (!isFinite(halfT) || halfT <= 0) return null

  const PTS = 60  // points per half-period
  const numHalves = Math.ceil(numPeriods * 2) + 1
  const t = [], vout = [], v1 = [], v2 = []

  for (let n = 0; n < numHalves; n++) {
    const sign    = n % 2 === 0 ? 1 : -1
    const Vo_n    = sign * Vsat
    const V2start = -sign * gamma * Vsat  // V2 start of this half-period
    const tOff    = n * halfT

    for (let i = 0; i <= PTS; i++) {
      const tLoc = (i / PTS) * halfT
      const tAbs = tOff + tLoc
      if (tAbs > numPeriods * 2 * halfT + 1e-10) break
      const V2t = Vo_n + (V2start - Vo_n) * Math.exp(-tLoc / tau)
      t.push(tAbs)
      vout.push(Vo_n)
      v1.push(gamma * Vo_n)
      v2.push(V2t)
    }
  }
  return { t, vout, v1, v2, halfT, T: 2 * halfT }
}

/* ════════════════════════════════════════
   SVG: oscillator waveform plot
════════════════════════════════════════ */
function OscWaveformSVG({ Vsat, gamma, tau }) {
  const data = generateOscWaveform(Vsat, gamma, tau, 2.5)
  if (!data) {
    return (
      <div className="lab6-svg-placeholder">Invalid parameters — check γ and τ</div>
    )
  }

  const { t, vout, v1, v2, T } = data
  const tMax = t[t.length - 1]
  const vPad = Vsat * 0.15
  const vMin = -Vsat - vPad
  const vMax =  Vsat + vPad

  const mx = tv => mxFn(tv, tMax)
  const my = v  => myFn(v, vMin, vMax)
  const polyPts = arr => t.map((tv, i) => `${mx(tv).toFixed(1)},${my(arr[i]).toFixed(1)}`).join(' ')

  const periodXs = [1, 2].map(n => ({ x: mx(n * T), label: `${fv(n * T, 2)}s` }))
    .filter(p => p.x > PL + 4 && p.x < SVW - PR - 4)

  return (
    <svg viewBox={`0 0 ${SVW} ${SVH}`} className="lab6-svg">
      {/* Zero line */}
      <line x1={PL} y1={my(0)} x2={SVW - PR} y2={my(0)}
        stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      {/* ±Vsat reference */}
      <line x1={PL} y1={my( Vsat)} x2={SVW - PR} y2={my( Vsat)}
        stroke="rgba(100,160,240,0.12)" strokeDasharray="4,3" strokeWidth="1" />
      <line x1={PL} y1={my(-Vsat)} x2={SVW - PR} y2={my(-Vsat)}
        stroke="rgba(100,160,240,0.12)" strokeDasharray="4,3" strokeWidth="1" />

      {/* ±γVsat switching thresholds */}
      <line x1={PL} y1={my( gamma * Vsat)} x2={SVW - PR} y2={my( gamma * Vsat)}
        stroke="rgba(80,210,130,0.12)" strokeDasharray="2,4" strokeWidth="1" />
      <line x1={PL} y1={my(-gamma * Vsat)} x2={SVW - PR} y2={my(-gamma * Vsat)}
        stroke="rgba(80,210,130,0.12)" strokeDasharray="2,4" strokeWidth="1" />

      {/* Period markers */}
      {periodXs.map((p, i) => (
        <g key={i}>
          <line x1={p.x} y1={PT} x2={p.x} y2={PT + PIH}
            stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" strokeWidth="1" />
          <text x={p.x} y={PT + PIH + 16} textAnchor="middle" fontSize="7"
            fill="rgba(255,255,255,0.25)">{p.label}</text>
        </g>
      ))}

      {/* Waveforms: V2 behind, then V1, then Vout on top */}
      <polyline points={polyPts(v2)}   fill="none" stroke="rgba(240,180,60,0.85)"  strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points={polyPts(v1)}   fill="none" stroke="rgba(80,210,130,0.8)"   strokeWidth="1.5" />
      <polyline points={polyPts(vout)} fill="none" stroke="rgba(100,160,240,0.9)"  strokeWidth="2" />

      {/* Axes */}
      <line x1={PL} y1={PT}       x2={PL}       y2={PT + PIH} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <line x1={PL} y1={PT + PIH} x2={SVW - PR} y2={PT + PIH} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

      {/* Y labels */}
      <text x={PL - 5} y={my( Vsat) + 4}         textAnchor="end" fontSize="8" fill="rgba(100,160,240,0.6)">+{fv(Vsat, 1)}</text>
      <text x={PL - 5} y={my(0) + 4}              textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.25)">0</text>
      <text x={PL - 5} y={my(-Vsat) + 4}          textAnchor="end" fontSize="8" fill="rgba(100,160,240,0.6)">-{fv(Vsat, 1)}</text>
      <text x={PL - 5} y={my( gamma * Vsat) + 4}  textAnchor="end" fontSize="7" fill="rgba(80,210,130,0.45)">+γVs</text>
      <text x={PL - 5} y={my(-gamma * Vsat) + 4}  textAnchor="end" fontSize="7" fill="rgba(80,210,130,0.45)">-γVs</text>

      {/* X origin */}
      <text x={PL} y={PT + PIH + 16} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.25)">0</text>
    </svg>
  )
}

/* ════════════════════════════════════════
   Numerical V2 RMS over one half-period
   (by symmetry = RMS over full period)
════════════════════════════════════════ */
function computeV2rms(Vsat, gamma, tau) {
  const k = (1 - gamma) / (1 + gamma)
  if (k <= 0 || k >= 1 || !isFinite(k) || tau <= 0) return 0
  const halfT = -tau * Math.log(k)
  if (!isFinite(halfT) || halfT <= 0) return 0
  const N = 2000
  const dt = halfT / N
  let sumSq = 0
  for (let i = 0; i < N; i++) {
    const tMid = (i + 0.5) * dt
    // Positive half-period: V2 = Vsat + (-γVsat - Vsat)·e^(-t/τ) = Vsat(1-(1+γ)e^(-t/τ))
    const V2 = Vsat + (-gamma * Vsat - Vsat) * Math.exp(-tMid / tau)
    sumSq += V2 * V2 * dt
  }
  return Math.sqrt(sumSq / halfT)
}

/* ════════════════════════════════════════
   TAB 1 — RC Step Response
════════════════════════════════════════ */
function RCStepTab() {
  const [R_k, setR] = useState(10)   // kΩ
  const [C_u, setC] = useState(100)  // µF
  const [Vin,  setVin] = useState(5) // V (final / input voltage)
  const [Vo,   setVo]  = useState(0) // V (initial / starting voltage)

  // Convert to SI
  const R   = R_k * 1000       // Ω
  const C   = C_u * 1e-6       // F
  const tau = R * C             // seconds

  // Key voltages at nτ
  const vAt1 = Vin + (Vo - Vin) * Math.exp(-1)  // 63.2% of transition complete
  const vAt2 = Vin + (Vo - Vin) * Math.exp(-2)  // 86.5%
  const vAt3 = Vin + (Vo - Vin) * Math.exp(-3)  // 95.0%
  const vAt5 = Vin + (Vo - Vin) * Math.exp(-5)  // 99.3%

  return (
    <div className="lab6-sim">
      <div className="lab6-two-col">

        {/* Left: controls */}
        <div className="lab6-panel">
          <div className="lab6-panel-title">PARAMETERS</div>
          <div className="calc-controls">
            <CalcSlider label="Resistance (R)" value={R_k} onChange={setR}
              min={1} max={100} step={1} unit=" kΩ" color={C_BLUE} />
            <CalcSlider label="Capacitance (C)" value={C_u} onChange={setC}
              min={1} max={1000} step={1} unit=" µF" color={C_TEAL} />
            <CalcSlider label="Input Voltage (V_in)" value={Vin} onChange={setVin}
              min={-10} max={10} step={0.5} unit=" V" color={C_GREEN} />
            <CalcSlider label="Initial Voltage (V_o)" value={Vo} onChange={setVo}
              min={-10} max={10} step={0.5} unit=" V" color={C_AMBER} />
          </div>
          <div className="lab6-formula" style={{ marginTop: 14 }}>
            V_out(t) = V_in + (V_o – V_in)·e^(–t/RC)<br />
            τ = RC = {fv(R_k, 0)} kΩ · {fv(C_u, 0)} µF = <strong>{fTime(tau)}</strong>
          </div>
          <div className="lab6-note" style={{ marginTop: 10 }}>
            At t = 5τ ({fTime(5 * tau)}), V_out has settled to 99.3% of V_in.
            The dot on the curve marks the τ point (63.2% complete).
          </div>
        </div>

        {/* Right: plot + stats */}
        <div className="lab6-panel">
          <div className="lab6-panel-title">TRANSIENT RESPONSE — V_out(t)</div>
          <StepResponseSVG R={R} C={C} Vin={Vin} Vo={Vo} />
          <div className="lab6-stat-grid" style={{ marginTop: 12 }}>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">Time constant τ = RC</span>
              <span className="lab6-stat-value" style={{ color: C_AMBER }}>{fTime(tau)}</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V(τ) — 63.2% complete</span>
              <span className="lab6-stat-value" style={{ color: C_BLUE }}>{fv(vAt1, 3)} V</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V(2τ) — 86.5% complete</span>
              <span className="lab6-stat-value" style={{ color: C_BLUE }}>{fv(vAt2, 3)} V</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V(3τ) — 95.0% complete</span>
              <span className="lab6-stat-value" style={{ color: C_BLUE }}>{fv(vAt3, 3)} V</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V(5τ) — 99.3% settled</span>
              <span className="lab6-stat-value" style={{ color: C_GREEN }}>{fv(vAt5, 3)} V</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">5τ settling time</span>
              <span className="lab6-stat-value" style={{ color: C_TEAL }}>{fTime(5 * tau)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ════════════════════════════════════════
   TAB 2 — Oscillator Designer
════════════════════════════════════════ */
function OscillatorTab() {
  const [R1_k,  setR1]   = useState(5)    // kΩ
  const [R2_k,  setR2]   = useState(5)    // kΩ
  const [R_k,   setR]    = useState(10)   // kΩ (timing)
  const [C_u,   setC]    = useState(100)  // µF
  const [Vsat,  setVsat] = useState(5)    // V

  // SI values
  const R1 = R1_k * 1000, R2 = R2_k * 1000
  const R  = R_k  * 1000
  const C  = C_u  * 1e-6

  // Derived
  const gamma  = R2 / (R1 + R2)                         // voltage divider ratio γ
  const tau    = R * C                                    // time constant τ = RC
  const k      = (1 - gamma) / (1 + gamma)
  const halfT  = (k > 0 && k < 1) ? -tau * Math.log(k) : Infinity
  const T      = 2 * halfT                               // period
  const fo     = isFinite(T) && T > 0 ? 1 / T : 0       // oscillation frequency

  // Waveform amplitudes
  const VoutVpp = 2 * Vsat
  const V1pp    = 2 * gamma * Vsat                       // V1 = γ·Vout → Vpp = 2γVsat
  const V2pp    = 2 * gamma * Vsat                       // V2 swings ±γVsat
  const V2rms   = computeV2rms(Vsat, gamma, tau)
  const VoutRms = Vsat                                   // square wave: Vrms = amplitude
  const V1rms   = gamma * Vsat                           // square wave: Vrms = amplitude

  const R12sum     = R1_k + R2_k
  const R12ok      = Math.abs(R12sum - 10) <= 1.5

  return (
    <div className="lab6-sim">
      <div className="lab6-two-col">

        {/* Left: sliders + derived */}
        <div className="lab6-panel">
          <div className="lab6-panel-title">COMPONENT VALUES</div>
          <div className="calc-controls">
            <CalcSlider label="R₁ (feedback divider)" value={R1_k} onChange={setR1}
              min={0.5} max={15} step={0.5} unit=" kΩ" color={C_BLUE} />
            <CalcSlider label="R₂ (feedback divider)" value={R2_k} onChange={setR2}
              min={0.5} max={15} step={0.5} unit=" kΩ" color={C_GREEN} />
            <CalcSlider label="R (timing resistor)" value={R_k} onChange={setR}
              min={1} max={100} step={1} unit=" kΩ" color={C_AMBER} />
            <CalcSlider label="C (timing capacitor)" value={C_u} onChange={setC}
              min={1} max={1000} step={1} unit=" µF" color={C_TEAL} />
            <CalcSlider label="V_sat (op-amp rail)" value={Vsat} onChange={setVsat}
              min={1} max={15} step={0.5} unit=" V" color={C_MUTED} />
          </div>

          <div className={`lab6-r12-badge${R12ok ? ' ok' : ' warn'}`}>
            R₁ + R₂ = {fv(R12sum, 1)} kΩ
            {R12ok ? ' ✓ near 10 kΩ target' : ' — aim for ≈ 10 kΩ'}
          </div>

          <div className="lab6-formula" style={{ marginTop: 10 }}>
            γ = R₂/(R₁+R₂) = {fv(R2_k,1)}/({fv(R1_k+R2_k,1)}) = <strong>{fv(gamma, 4)}</strong><br />
            τ = RC = {fv(R_k, 0)} kΩ · {fv(C_u, 0)} µF = <strong>{fTime(tau)}</strong><br />
            t½ = –τ·ln((1–γ)/(1+γ)) = <strong>{fTime(halfT)}</strong>
          </div>

          <div className="lab6-formula" style={{ marginTop: 8 }}>
            f₀ = –1 / (2τ·ln((1–γ)/(1+γ))) = <strong style={{ color: C_TEAL }}>{fHz(fo)}</strong><br />
            T = 1/f₀ = <strong style={{ color: C_BLUE }}>{fTime(T)}</strong>
          </div>

          <div className="lab6-stat-grid" style={{ marginTop: 12 }}>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V_out Vpp</span>
              <span className="lab6-stat-value" style={{ color: C_BLUE }}>{fv(VoutVpp, 2)} V</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V_out Vrms</span>
              <span className="lab6-stat-value" style={{ color: C_BLUE }}>{fv(VoutRms, 3)} V</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V₁ Vpp (= V₂ Vpp)</span>
              <span className="lab6-stat-value" style={{ color: C_GREEN }}>{fv(V1pp, 3)} V</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V₁ Vrms</span>
              <span className="lab6-stat-value" style={{ color: C_GREEN }}>{fv(V1rms, 3)} V</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V₂ Vpp</span>
              <span className="lab6-stat-value" style={{ color: C_AMBER }}>{fv(V2pp, 3)} V</span>
            </div>
            <div className="lab6-stat-row">
              <span className="lab6-stat-label">V₂ Vrms</span>
              <span className="lab6-stat-value" style={{ color: C_AMBER }}>{fv(V2rms, 3)} V</span>
            </div>
          </div>
        </div>

        {/* Right: waveform */}
        <div className="lab6-panel">
          <div className="lab6-panel-title">OSCILLATOR WAVEFORMS</div>
          <OscWaveformSVG Vsat={Vsat} gamma={gamma} tau={tau} />

          {/* Legend */}
          <div className="lab6-legend">
            <div className="lab6-legend-item">
              <div className="lab6-legend-dot" style={{ background: 'rgba(100,160,240,0.9)' }} />
              <span>V_out — square wave (±{fv(Vsat,1)} V)</span>
            </div>
            <div className="lab6-legend-item">
              <div className="lab6-legend-dot" style={{ background: 'rgba(80,210,130,0.8)' }} />
              <span>V₁ = γ·V_out — threshold (±{fv(gamma * Vsat, 2)} V)</span>
            </div>
            <div className="lab6-legend-item">
              <div className="lab6-legend-dot" style={{ background: 'rgba(240,180,60,0.85)' }} />
              <span>V₂ — capacitor voltage (exponential, ±{fv(gamma * Vsat, 2)} V pp)</span>
            </div>
          </div>

          <div className="lab6-note" style={{ marginTop: 10 }}>
            Dashed lines show ±V_sat and the ±γV_sat switching thresholds.
            V₂ oscillates between –γV_sat and +γV_sat, switching when it reaches V₁.
          </div>

          {/* Target indicator */}
          {fo > 0 && (
            <div className={`lab6-target-badge${Math.abs(fo - 0.5) < 0.05 ? ' on' : ''}`}>
              {Math.abs(fo - 0.5) < 0.05
                ? `✓ On target — ${fHz(fo)} ≈ 0.5 Hz`
                : `Current: ${fHz(fo)} — target: 0.5 Hz`}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

/* ════════════════════════════════════════
   STYLES
════════════════════════════════════════ */
const styles = `
.lab6-root .calc-body {
  display: flex; flex-direction: column;
  grid-template-columns: none;
  padding: 18px 20px;
}
.lab6-root .calc-tab { min-height: 56px; }
.lab6-root .calc-tab-desc { white-space: normal; text-align: center; line-height: 1.3; }

.lab6-sim { display: flex; flex-direction: column; gap: 0; }

.lab6-two-col {
  display: grid;
  grid-template-columns: 1fr 1.45fr;
  gap: 14px;
}

.lab6-panel {
  background: var(--bg-3); border: 1px solid var(--border);
  border-radius: var(--r); padding: 16px 18px;
}
.lab6-panel-title {
  font-size: 9px; color: var(--text-3); font-family: var(--mono);
  letter-spacing: 2px; text-transform: uppercase;
  border-bottom: 1px solid var(--border);
  padding-bottom: 9px; margin-bottom: 14px;
  display: flex; align-items: center; gap: 8px;
}
.lab6-panel-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

/* ── SVG ── */
.lab6-svg {
  width: 100%; height: auto; display: block; overflow: visible;
}
.lab6-svg-placeholder {
  height: 100px; display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: var(--text-3); font-family: var(--mono);
  border: 1px dashed var(--border); border-radius: var(--r-sm);
}

/* ── Stat rows ── */
.lab6-stat-grid { display: flex; flex-direction: column; gap: 0; }
.lab6-stat-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 0; border-bottom: 1px solid var(--border);
  font-size: 11px;
}
.lab6-stat-row:last-child { border-bottom: none; }
.lab6-stat-label { color: var(--text-3); font-family: var(--mono); }
.lab6-stat-value { font-family: var(--mono); font-weight: 600; color: var(--text); }

/* ── Formula / note ── */
.lab6-formula {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 9px 14px;
  font-family: var(--mono); font-size: 11px; color: rgba(240,180,60,0.85);
  letter-spacing: 0.3px; line-height: 1.8;
}
.lab6-note {
  font-size: 10px; color: var(--text-3); font-family: var(--mono);
  padding: 8px 12px; background: var(--surface);
  border-radius: var(--r-sm); border: 1px solid var(--border); line-height: 1.65;
}

/* ── R1+R2 badge ── */
.lab6-r12-badge {
  margin-top: 10px; padding: 7px 12px;
  border-radius: var(--r-sm); font-size: 10px; font-family: var(--mono);
  border: 1px solid var(--border); background: var(--surface); color: var(--text-3);
  transition: all 0.2s;
}
.lab6-r12-badge.ok   { border-color: rgba(80,210,130,0.4); color: rgba(80,210,130,0.9); background: rgba(80,210,130,0.06); }
.lab6-r12-badge.warn { border-color: rgba(240,180,60,0.35); color: rgba(240,180,60,0.85); background: rgba(240,180,60,0.05); }

/* ── Target badge ── */
.lab6-target-badge {
  margin-top: 10px; padding: 7px 12px;
  border-radius: var(--r-sm); font-size: 10px; font-family: var(--mono);
  border: 1px solid var(--border); background: var(--surface); color: var(--text-3);
  transition: all 0.25s;
}
.lab6-target-badge.on { border-color: rgba(80,210,130,0.4); color: rgba(80,210,130,0.9); background: rgba(80,210,130,0.06); }

/* ── Legend ── */
.lab6-legend { display: flex; flex-direction: column; gap: 5px; margin-top: 10px; }
.lab6-legend-item {
  display: flex; align-items: center; gap: 7px;
  font-size: 10px; color: var(--text-3); font-family: var(--mono);
}
.lab6-legend-dot {
  width: 22px; height: 3px; border-radius: 2px; flex-shrink: 0;
}
`

/* ════════════════════════════════════════
   CALCULATOR WIDGET
════════════════════════════════════════ */
const TABS = [
  { id: 'step', label: 'RC Step Response', short: 'V_out(t) = V_in + (V_o – V_in)e^(–t/RC)' },
  { id: 'osc',  label: 'Oscillator Design', short: 'Frequency, waveforms & prelab quantities' },
]

export function RCOscillatorCalc() {
  const [tab, setTab] = useState('step')
  return (
    <div className="lab6-root">
      <style>{styles}</style>
      <div className="calc-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`calc-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}>
            <span className="calc-tab-id">{t.label}</span>
            <span className="calc-tab-desc">{t.short}</span>
          </button>
        ))}
      </div>
      <div className="calc-body">
        {tab === 'step' && <RCStepTab />}
        {tab === 'osc'  && <OscillatorTab />}
      </div>
    </div>
  )
}

// ── Lab content data ──────────────────────────────────────────────────────────
export const labData = {

  objectives: [
    'Understand the transient (step) response of a first-order RC circuit and the physical meaning of the time constant τ = RC.',
    'Analyze an op-amp relaxation oscillator: derive the oscillation frequency f₀ in terms of R, C, R₁, R₂, and V_sat, and verify the result experimentally.',
    'Design an oscillator circuit to target f₀ = 0.5 Hz; measure frequency, peak-to-peak voltage, and RMS voltage for V₁(t) and V₂(t); compare theoretical and measured values.',
    'Replace the fixed R₁/R₂ voltage divider with a 10 kΩ potentiometer to continuously tune the oscillation frequency.',
  ],

  parts: [
    {
      label:       'Prelab',
      duration:    '~30 min',
      title:       'Circuit design & hand calculations',
      description: 'Choose R, C, R₁, R₂ to target f₀ = 0.5 Hz with R₁+R₂ ≈ 10 kΩ. Calculate: (a) actual f₀, (b) V₂ peak-to-peak voltage, (c) V₂ RMS voltage. Run SPICE transient simulation; turn in waveforms of V₁, V₂, and V_out.',
    },
    {
      label:       'Task 1',
      duration:    '~45 min',
      title:       'Flashing LED circuit',
      description: 'Build the circuit from Fig. 6.5 using your prelab component values. Display V₁(t) and V₂(t) on the oscilloscope (≈70% of full scale, two periods visible). Measure: (a) frequency, (b) V₁ and V₂ peak-to-peak, (c) V₁ and V₂ RMS. Save waveform screenshots.',
    },
    {
      label:       'Task 2',
      duration:    '~30 min',
      title:       'Potentiometer tuning',
      description: 'Replace R₁ and R₂ with a 10 kΩ potentiometer (Fig. 6.7). Tune to f = 1 Hz; remove pot and measure R₁, R₂, and γ. Replace R with R/2 (parallel identical resistor) and record the new frequency. Re-tune to 1 Hz with R/2 and record the new γ.',
    },
  ],

  components: [
    { name: '¼W resistors',           value: 'various', qty: 'assorted' },
    { name: 'Capacitors',             value: 'various', qty: 'assorted' },
    { name: 'Red LED',                value: '—',       qty: 1 },
    { name: 'Green LED',              value: '—',       qty: 1 },
    { name: '10 kΩ potentiometer',    value: '10 kΩ',   qty: 1 },
    { name: 'Potentiometer turner',   value: 'slotted', qty: 1 },
    { name: 'LM741 op-amp',           value: '—',       qty: 1 },
  ],

  equations: [
    {
      title:    'RC Step Response',
      subtitle: 'Output voltage as a function of time — τ = RC is the time constant',
      tex:      'V_{out}(t) = V_{in} + (V_o - V_{in})e^{-t/RC}',
      color:    'rgba(100,160,240,0.92)',
      vars: [
        { sym: 'V_{in}', def: 'Final (input) voltage — the value V_out approaches' },
        { sym: 'V_o',    def: 'Initial voltage at t = 0' },
        { sym: 'RC',     def: 'Time constant τ — time to reach 63.2% of final value' },
      ],
      example: 'V_o=0,\\;V_{in}=5\\text{V},\\;\\tau=1\\text{s} \\Rightarrow V(1)=5(1-e^{-1})\\approx3.16\\text{V}',
    },
    {
      title:    'Voltage Divider Ratio γ',
      subtitle: 'Sets the threshold at which the op-amp switches — also determines V₁',
      tex:      '\\gamma = \\frac{R_2}{R_1 + R_2}, \\quad V_1 = \\gamma V_{out}',
      color:    'rgba(80,210,130,0.92)',
      vars: [
        { sym: 'R_1', def: 'Upper resistor of voltage divider' },
        { sym: 'R_2', def: 'Lower resistor of voltage divider' },
        { sym: 'V_1', def: 'Non-inverting (+) input of op-amp — the switching threshold' },
      ],
      example: 'R_1=R_2=5\\text{k}\\Omega \\Rightarrow \\gamma=0.5,\\;V_1=0.5V_{sat}',
    },
    {
      title:    'Oscillation Frequency',
      subtitle: 'Period is twice the half-period; frequency is the reciprocal',
      tex:      'f_o = \\frac{-1}{2\\tau\\ln\\!\\left(\\dfrac{1-\\gamma}{1+\\gamma}\\right)}',
      color:    'rgba(100,210,180,0.92)',
      vars: [
        { sym: '\\tau',   def: 'Time constant τ = RC' },
        { sym: '\\gamma', def: 'Voltage divider ratio R₂/(R₁+R₂)' },
        { sym: 'f_o',     def: 'Oscillation frequency (Hz)' },
      ],
      example: '\\gamma=0.5,\\;\\tau=1\\text{s} \\Rightarrow f_o=\\frac{-1}{2\\ln(1/3)}\\approx0.455\\text{ Hz}',
    },
    {
      title:    'RMS Voltage (periodic signal)',
      subtitle: 'Integrate x²(t) over one full period T₀ and take the square root',
      tex:      'X_{rms} = \\sqrt{\\frac{1}{T_o}\\int_{T_o} x^2(t)\\,dt}',
      color:    'rgba(240,180,60,0.95)',
      vars: [
        { sym: 'T_o',   def: 'Period of the signal' },
        { sym: 'x(t)',  def: 'Instantaneous signal value' },
        { sym: 'X_{rms}', def: 'Root-mean-square value' },
      ],
      example: 'V_{out}=\\pm V_{sat}\\text{ (square wave)} \\Rightarrow V_{rms}=V_{sat}',
    },
  ],

  notes: [
    'By t = 5τ, V_out has reached 99.3% of V_in — consider the capacitor "fully charged" after 5 time constants.',
    'The LM741 with ±5V supply saturates at approximately ±(V_supply − 1V) ≈ ±4.5V; use your measured V_sat from Lab 4.',
    'Choose R₁ and R₂ so their sum is as close to 10 kΩ as possible; series/parallel resistor combinations are allowed.',
    'SPICE requires a non-zero initial condition to start oscillation — add ".ic V(n001)=1" to your schematic.',
    'Make sure V₁ connects to the + (non-inverting) terminal and V₂ connects to the − (inverting) terminal of the 741; a common mistake is to swap them.',
    'Halving R (by adding an identical resistor in parallel) doubles f₀ because τ = RC halves while γ stays the same.',
  ],

  images: [
    {
      src:     new URL('./images/schematic.png', import.meta.url).href,
      caption: 'Lab 6 Full Schematic — RC step-response circuit and op-amp relaxation oscillator',
      alt:     'ECEN 214 Lab 6 schematic showing the RC charging circuit and the 741 op-amp relaxation oscillator',
    },
  ],

  calculatorTitle: 'RC Oscillator Designer',
  calculatorIcon:  '〜',
}
