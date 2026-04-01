import { useState } from 'react'

// ── ECEN 214 Lab 7 — AC Response of 1st Order RC Circuits ────────────────────
// Exports: labData (dashboard content) and ACResponseCalc (calculator widget).
// Layout is owned by WidgetShell — no JSX layout lives here.

/* ── Color constants ── */
const C_BLUE  = 'rgba(100,160,240,0.92)'
const C_TEAL  = 'rgba(100,210,180,0.92)'
const C_AMBER = 'rgba(240,180,60,0.95)'
const C_GREEN = 'rgba(80,210,130,0.92)'
const C_RED   = 'rgba(220,80,80,0.92)'
const C_MUTED = 'rgba(255,255,255,0.18)'

/* ── Formatting helpers ── */
const fv   = (v, d = 2) => isFinite(v) && !isNaN(v) ? v.toFixed(d) : '---'
const fHz  = v => !isFinite(v) || v <= 0 ? '---' : v >= 1000 ? fv(v / 1000, 2) + ' kHz' : fv(v, 1) + ' Hz'
const fMs  = v => !isFinite(v) || v <= 0 ? '---' : v >= 0.001 ? fv(v * 1000, 2) + ' ms' : fv(v * 1e6, 1) + ' µs'
const fMag = v => isFinite(v) ? v.toFixed(3) : '---'
const fDeg = v => isFinite(v) ? v.toFixed(1) + '°' : '---'

/* ── SVG layout constants ── */
const SVW = 420, SVH = 180
const PL = 48, PR = 10, PT = 12, PB = 30
const PIW = SVW - PL - PR
const PIH = SVH - PT - PB

/* ── Shared CalcSlider ── */
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
        <input
          type="range"
          className="calc-slider"
          style={{ '--thumb-color': color }}
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(+e.target.value)}
        />
      </div>
    </div>
  )
}

/* ── StatRow ── */
function StatRow({ label, value, color = C_AMBER }) {
  return (
    <div className="lab7-stat-row">
      <span className="lab7-stat-label">{label}</span>
      <span className="lab7-stat-value" style={{ color }}>{value}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   TAB 1 — BODE PLOT
═══════════════════════════════════════════════════ */

function BodeSVG({ R_k, C_n, f_in }) {
  const R   = R_k * 1e3
  const C   = C_n * 1e-9
  const tau = R * C
  const fc  = 1 / (2 * Math.PI * tau)

  // Log-scale x axis spanning ~4 decades centered on fc
  const fMin   = Math.max(1, fc / 100)
  const fMax   = Math.min(1e5, fc * 100)
  const logMin = Math.log10(fMin)
  const logMax = Math.log10(fMax)

  const mx = f   => PL + ((Math.log10(Math.max(fMin, Math.min(fMax, f))) - logMin) / (logMax - logMin)) * PIW
  const my = mag => PT + PIH - mag * PIH

  // Magnitude curve (150 points along log scale)
  const pts = Array.from({ length: 151 }, (_, i) => {
    const logF = logMin + (i / 150) * (logMax - logMin)
    const f    = 10 ** logF
    const mag  = 1 / Math.sqrt(1 + (f / fc) ** 2)
    return `${mx(f).toFixed(1)},${my(mag).toFixed(1)}`
  }).join(' ')

  // Operating point
  const mag_op = 1 / Math.sqrt(1 + (f_in / fc) ** 2)
  const xOp    = mx(f_in)
  const yOp    = my(mag_op)

  // X-axis decade ticks
  const xTicks = []
  for (let d = Math.ceil(logMin); d <= Math.floor(logMax); d++) xTicks.push(10 ** d)

  const showFc = fc >= fMin && fc <= fMax

  return (
    <svg viewBox={`0 0 ${SVW} ${SVH}`} className="lab7-svg">
      {/* –3 dB reference */}
      <line x1={PL} y1={my(0.707)} x2={SVW - PR} y2={my(0.707)}
        stroke={C_MUTED} strokeDasharray="4,3" strokeWidth="1" />
      <text x={PL - 4} y={my(0.707) + 3.5} textAnchor="end" fontSize="7"
        fill={C_MUTED} fontFamily="monospace">0.71</text>

      {/* fc vertical */}
      {showFc && (
        <>
          <line x1={mx(fc)} y1={PT} x2={mx(fc)} y2={PT + PIH}
            stroke={C_TEAL} strokeDasharray="4,3" strokeWidth="1" opacity="0.65" />
          <text x={mx(fc)} y={PT + PIH + 18} textAnchor="middle" fontSize="8"
            fill={C_TEAL} fontFamily="monospace">fc</text>
        </>
      )}

      {/* Magnitude curve */}
      <polyline points={pts} fill="none" stroke={C_BLUE} strokeWidth="2" strokeLinejoin="round" />

      {/* Operating-point crosshairs */}
      <line x1={xOp} y1={PT} x2={xOp} y2={PT + PIH}
        stroke={C_AMBER} strokeDasharray="2,2" strokeWidth="1" opacity="0.55" />
      <line x1={PL} y1={yOp} x2={SVW - PR} y2={yOp}
        stroke={C_AMBER} strokeDasharray="2,2" strokeWidth="1" opacity="0.55" />
      <circle cx={xOp} cy={yOp} r={4} fill={C_AMBER} />

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + PIH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <line x1={PL} y1={PT + PIH} x2={SVW - PR} y2={PT + PIH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

      {/* X ticks */}
      {xTicks.map(f => (
        <g key={f}>
          <line x1={mx(f)} y1={PT + PIH} x2={mx(f)} y2={PT + PIH + 4}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text x={mx(f)} y={PT + PIH + 14} textAnchor="middle" fontSize="8"
            fill="rgba(255,255,255,0.35)" fontFamily="monospace">
            {f >= 1000 ? (f / 1000) + 'k' : f}
          </text>
        </g>
      ))}

      {/* Y ticks */}
      {[0, 0.25, 0.5, 0.707, 1.0].map(m => (
        <g key={m}>
          <line x1={PL - 3} y1={my(m)} x2={PL} y2={my(m)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text x={PL - 5} y={my(m) + 3.5} textAnchor="end" fontSize="7"
            fill="rgba(255,255,255,0.3)" fontFamily="monospace">{m}</text>
        </g>
      ))}

      {/* Axis labels */}
      <text x={PL + PIW / 2} y={SVH - 1} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)">
        Frequency (Hz)
      </text>
      <text x={8} y={PT + PIH / 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)"
        transform={`rotate(-90, 8, ${PT + PIH / 2})`}>|H(f)|</text>
    </svg>
  )
}

function BodeTab() {
  const [R_k, setR] = useState(16)    // 16 kΩ → fc ≈ 1 kHz with C = 10 nF
  const [C_n, setC] = useState(10)    // nF
  const [f_in, setF] = useState(250)  // Hz

  const R        = R_k * 1e3
  const C        = C_n * 1e-9
  const tau      = R * C
  const fc       = 1 / (2 * Math.PI * tau)
  const mag      = 1 / Math.sqrt(1 + (f_in / fc) ** 2)
  const phaseDeg = -Math.atan(f_in / fc) * 180 / Math.PI
  const Vout_pp  = 2 * mag  // for 2 Vpp input

  return (
    <div className="lab7-sim">
      <div className="lab7-two-col">
        {/* Controls */}
        <div className="lab7-panel">
          <div className="lab7-panel-title">Filter Parameters</div>
          <div className="calc-controls">
            <CalcSlider label="Resistance R" value={R_k} onChange={setR}
              min={1} max={100} step={1} unit=" kΩ" color={C_BLUE} />
            <CalcSlider label="Capacitance C" value={C_n} onChange={setC}
              min={1} max={1000} step={1} unit=" nF" color={C_TEAL} />
            <CalcSlider label="Input Frequency" value={f_in} onChange={setF}
              min={10} max={10000} step={10} fmt={v => fHz(v)} color={C_AMBER} />
          </div>
        </div>

        {/* Plot + stats */}
        <div className="lab7-panel">
          <div className="lab7-panel-title">Magnitude Response (Bode Plot)</div>
          <BodeSVG R_k={R_k} C_n={C_n} f_in={f_in} />
          <div className="lab7-stat-grid">
            <StatRow label="Cutoff Frequency fc"  value={fHz(fc)}              color={C_TEAL}  />
            <StatRow label="Time Constant τ"       value={fMs(tau)}             color={C_BLUE}  />
            <StatRow label="|H(f)|"                value={fMag(mag)}            color={C_AMBER} />
            <StatRow label="Phase Shift"           value={fDeg(phaseDeg)}       color={C_AMBER} />
            <StatRow label="Output (2 Vpp in)"    value={fv(Vout_pp, 3) + ' Vpp'} color={C_GREEN} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   TAB 2 — CASCADED FILTERS
═══════════════════════════════════════════════════ */

function CascadeSVG({ R1_k, C1_n, R2_k, C2_n, f_in }) {
  const R1  = R1_k * 1e3, C1 = C1_n * 1e-9
  const R2  = R2_k * 1e3, C2 = C2_n * 1e-9
  const fc1 = 1 / (2 * Math.PI * R1 * C1)
  const fc2 = 1 / (2 * Math.PI * R2 * C2)

  const fMin   = Math.max(1, Math.min(fc1, fc2) / 100)
  const fMax   = Math.min(1e5, Math.max(fc1, fc2) * 100)
  const logMin = Math.log10(fMin)
  const logMax = Math.log10(fMax)

  const mx = f   => PL + ((Math.log10(Math.max(fMin, Math.min(fMax, f))) - logMin) / (logMax - logMin)) * PIW
  const my = mag => PT + PIH - mag * PIH

  const buildCurve = (fcX) =>
    Array.from({ length: 151 }, (_, i) => {
      const logF = logMin + (i / 150) * (logMax - logMin)
      const f    = 10 ** logF
      const mag  = 1 / Math.sqrt(1 + (f / fcX) ** 2)
      return `${mx(f).toFixed(1)},${my(mag).toFixed(1)}`
    }).join(' ')

  const cascadePts = Array.from({ length: 151 }, (_, i) => {
    const logF = logMin + (i / 150) * (logMax - logMin)
    const f    = 10 ** logF
    const mag  = 1 / Math.sqrt(1 + (f / fc1) ** 2) / Math.sqrt(1 + (f / fc2) ** 2)
    return `${mx(f).toFixed(1)},${my(mag).toFixed(1)}`
  }).join(' ')

  const mag1_op = 1 / Math.sqrt(1 + (f_in / fc1) ** 2)
  const mag2_op = 1 / Math.sqrt(1 + (f_in / fc2) ** 2)
  const magT_op = mag1_op * mag2_op
  const xOp     = mx(f_in)

  const xTicks = []
  for (let d = Math.ceil(logMin); d <= Math.floor(logMax); d++) xTicks.push(10 ** d)

  return (
    <svg viewBox={`0 0 ${SVW} ${SVH}`} className="lab7-svg">
      {/* –3 dB reference */}
      <line x1={PL} y1={my(0.707)} x2={SVW - PR} y2={my(0.707)}
        stroke={C_MUTED} strokeDasharray="4,3" strokeWidth="1" />

      {/* fc1 and fc2 verticals */}
      {fc1 >= fMin && fc1 <= fMax && (
        <line x1={mx(fc1)} y1={PT} x2={mx(fc1)} y2={PT + PIH}
          stroke={C_BLUE} strokeDasharray="3,3" strokeWidth="1" opacity="0.45" />
      )}
      {fc2 >= fMin && fc2 <= fMax && (
        <line x1={mx(fc2)} y1={PT} x2={mx(fc2)} y2={PT + PIH}
          stroke={C_TEAL} strokeDasharray="3,3" strokeWidth="1" opacity="0.45" />
      )}

      {/* Stage curves (dashed) */}
      <polyline points={buildCurve(fc1)} fill="none" stroke={C_BLUE} strokeWidth="1.5" strokeDasharray="5,3" />
      <polyline points={buildCurve(fc2)} fill="none" stroke={C_TEAL} strokeWidth="1.5" strokeDasharray="5,3" />
      {/* Cascade (solid, thicker) */}
      <polyline points={cascadePts} fill="none" stroke={C_AMBER} strokeWidth="2.5" />

      {/* Operating point */}
      <circle cx={xOp} cy={my(magT_op)} r={4} fill={C_AMBER} />

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + PIH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <line x1={PL} y1={PT + PIH} x2={SVW - PR} y2={PT + PIH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

      {xTicks.map(f => (
        <g key={f}>
          <line x1={mx(f)} y1={PT + PIH} x2={mx(f)} y2={PT + PIH + 4}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text x={mx(f)} y={PT + PIH + 14} textAnchor="middle" fontSize="8"
            fill="rgba(255,255,255,0.35)" fontFamily="monospace">
            {f >= 1000 ? (f / 1000) + 'k' : f}
          </text>
        </g>
      ))}

      {[0, 0.25, 0.5, 0.707, 1.0].map(m => (
        <g key={m}>
          <line x1={PL - 3} y1={my(m)} x2={PL} y2={my(m)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text x={PL - 5} y={my(m) + 3.5} textAnchor="end" fontSize="7"
            fill="rgba(255,255,255,0.3)" fontFamily="monospace">{m}</text>
        </g>
      ))}

      <text x={PL + PIW / 2} y={SVH - 1} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)">
        Frequency (Hz)
      </text>
      <text x={8} y={PT + PIH / 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)"
        transform={`rotate(-90, 8, ${PT + PIH / 2})`}>|H(f)|</text>

      {/* Legend */}
      <line x1={PL + 4}   y1={PT + 6} x2={PL + 18}  y2={PT + 6} stroke={C_BLUE}  strokeWidth="1.5" strokeDasharray="5,3" />
      <text x={PL + 21}  y={PT + 9} fontSize="7" fill={C_BLUE}  fontFamily="monospace">Stage 1</text>
      <line x1={PL + 58}  y1={PT + 6} x2={PL + 72}  y2={PT + 6} stroke={C_TEAL}  strokeWidth="1.5" strokeDasharray="5,3" />
      <text x={PL + 75}  y={PT + 9} fontSize="7" fill={C_TEAL}  fontFamily="monospace">Stage 2</text>
      <line x1={PL + 112} y1={PT + 6} x2={PL + 126} y2={PT + 6} stroke={C_AMBER} strokeWidth="2.5" />
      <text x={PL + 129} y={PT + 9} fontSize="7" fill={C_AMBER} fontFamily="monospace">Cascade</text>
    </svg>
  )
}

function CascadeTab() {
  const [R1_k, setR1] = useState(16)
  const [C1_n, setC1] = useState(10)
  const [R2_k, setR2] = useState(16)
  const [C2_n, setC2] = useState(10)
  const [f_in, setF]  = useState(250)

  const R1  = R1_k * 1e3, C1 = C1_n * 1e-9
  const R2  = R2_k * 1e3, C2 = C2_n * 1e-9
  const fc1 = 1 / (2 * Math.PI * R1 * C1)
  const fc2 = 1 / (2 * Math.PI * R2 * C2)
  const mag1 = 1 / Math.sqrt(1 + (f_in / fc1) ** 2)
  const mag2 = 1 / Math.sqrt(1 + (f_in / fc2) ** 2)
  const magT = mag1 * mag2
  const ph1  = -Math.atan(f_in / fc1) * 180 / Math.PI
  const ph2  = -Math.atan(f_in / fc2) * 180 / Math.PI

  return (
    <div className="lab7-sim">
      <div className="lab7-two-col">
        <div className="lab7-panel">
          <div className="lab7-panel-title">Stage 1</div>
          <div className="calc-controls">
            <CalcSlider label="R₁" value={R1_k} onChange={setR1}
              min={1} max={100} step={1} unit=" kΩ" color={C_BLUE} />
            <CalcSlider label="C₁" value={C1_n} onChange={setC1}
              min={1} max={1000} step={1} unit=" nF" color={C_BLUE} />
          </div>
          <div className="lab7-panel-title" style={{ marginTop: 14 }}>Stage 2</div>
          <div className="calc-controls">
            <CalcSlider label="R₂" value={R2_k} onChange={setR2}
              min={1} max={100} step={1} unit=" kΩ" color={C_TEAL} />
            <CalcSlider label="C₂" value={C2_n} onChange={setC2}
              min={1} max={1000} step={1} unit=" nF" color={C_TEAL} />
          </div>
          <div className="lab7-panel-title" style={{ marginTop: 14 }}>Input</div>
          <div className="calc-controls">
            <CalcSlider label="Frequency f" value={f_in} onChange={setF}
              min={10} max={10000} step={10} fmt={v => fHz(v)} color={C_AMBER} />
          </div>
        </div>

        <div className="lab7-panel">
          <div className="lab7-panel-title">Cascaded Bode Plot</div>
          <CascadeSVG R1_k={R1_k} C1_n={C1_n} R2_k={R2_k} C2_n={C2_n} f_in={f_in} />
          <div className="lab7-stat-grid">
            <StatRow label="fc₁ (Stage 1)"   value={fHz(fc1)}                color={C_BLUE}  />
            <StatRow label="fc₂ (Stage 2)"   value={fHz(fc2)}                color={C_TEAL}  />
            <StatRow label="|H₁(f)|"         value={fMag(mag1)}              color={C_BLUE}  />
            <StatRow label="|H₂(f)|"         value={fMag(mag2)}              color={C_TEAL}  />
            <StatRow label="|H_total(f)|"    value={fMag(magT)}              color={C_AMBER} />
            <StatRow label="φ_total"         value={fDeg(ph1 + ph2)}         color={C_AMBER} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   TAB 3 — WAVEFORM GENERATOR
═══════════════════════════════════════════════════ */

const VSAT = 4.5  // 741 ≈ ±4.5V with ±5V supply

function WaveformSVG({ fosc, gamma, mag3, ph3_deg }) {
  if (!isFinite(fosc) || fosc <= 0) {
    return (
      <svg viewBox={`0 0 ${SVW} ${SVH}`} className="lab7-svg">
        <text x={SVW / 2} y={SVH / 2} textAnchor="middle" fontSize="11"
          fill="rgba(255,255,255,0.25)" fontFamily="monospace">
          Adjust R₁/C₁ to set oscillation frequency
        </text>
      </svg>
    )
  }

  const Tperiod = 1 / fosc
  const halfT   = Tperiod / 2
  const tMax    = 2 * Tperiod

  const V1_amp = VSAT
  const V2_amp = gamma * VSAT
  // Fundamental amplitude of ideal triangle wave with peak V2_amp
  const V3_amp = mag3 * (8 / (Math.PI * Math.PI)) * V2_amp

  const vMin   = -(VSAT + 0.5)
  const vMax   =  (VSAT + 0.5)
  const vRange = vMax - vMin

  const mx = t => PL + (t / tMax) * PIW
  const my = v => PT + PIH - ((v - vMin) / vRange) * PIH

  // V1 — square wave with exact vertical jumps
  const ptsV1 = []
  for (let seg = 0; seg < 4; seg++) {
    const tStart = seg * halfT
    const tEnd   = (seg + 1) * halfT
    const vNow   = seg % 2 === 0 ? V1_amp : -V1_amp
    const vPrev  = seg % 2 === 0 ? -V1_amp : V1_amp
    if (seg > 0) {
      // vertical segment at the switch point
      ptsV1.push(`${mx(tStart).toFixed(1)},${my(vPrev).toFixed(1)}`)
      ptsV1.push(`${mx(tStart).toFixed(1)},${my(vNow).toFixed(1)}`)
    }
    ptsV1.push(`${mx(tStart).toFixed(1)},${my(vNow).toFixed(1)}`)
    ptsV1.push(`${mx(tEnd).toFixed(1)},${my(vNow).toFixed(1)}`)
  }

  // V2 — ideal triangle wave
  const N = 200
  const ptsV2 = Array.from({ length: N + 1 }, (_, i) => {
    const t     = (i / N) * tMax
    const phase = (t % Tperiod) / halfT  // 0..2
    const v2    = phase < 1
      ? -V2_amp + 2 * V2_amp * phase          // rising: -peak → +peak
      : V2_amp - 2 * V2_amp * (phase - 1)    // falling: +peak → -peak
    return `${mx(t).toFixed(1)},${my(v2).toFixed(1)}`
  }).join(' ')

  // V3 — sinusoidal fundamental of V2 after filtering
  const ph3_rad = ph3_deg * Math.PI / 180
  const ptsV3 = Array.from({ length: N + 1 }, (_, i) => {
    const t  = (i / N) * tMax
    const v3 = V3_amp * Math.sin(2 * Math.PI * fosc * t + ph3_rad)
    return `${mx(t).toFixed(1)},${my(v3).toFixed(1)}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${SVW} ${SVH}`} className="lab7-svg">
      {/* Reference lines */}
      {[VSAT, V2_amp, 0, -V2_amp, -VSAT].map(v => (
        <line key={v} x1={PL} y1={my(v)} x2={SVW - PR} y2={my(v)}
          stroke={v === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
          strokeDasharray={v === 0 ? 'none' : '3,3'} strokeWidth="1" />
      ))}

      {/* Period markers */}
      <line x1={mx(halfT)}   y1={PT} x2={mx(halfT)}   y2={PT + PIH}
        stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <line x1={mx(Tperiod)} y1={PT} x2={mx(Tperiod)} y2={PT + PIH}
        stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

      {/* Waveforms */}
      <polyline points={ptsV1.join(' ')} fill="none" stroke={C_BLUE}  strokeWidth="1.5" />
      <polyline points={ptsV2}           fill="none" stroke={C_TEAL}  strokeWidth="1.5" />
      <polyline points={ptsV3}           fill="none" stroke={C_AMBER} strokeWidth="2"   />

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + PIH}
        stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <line x1={PL} y1={PT + PIH} x2={SVW - PR} y2={PT + PIH}
        stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

      {/* Y-axis labels */}
      {[VSAT, V2_amp, 0, -V2_amp, -VSAT].map(v => (
        <text key={v} x={PL - 5} y={my(v) + 3.5} textAnchor="end" fontSize="7"
          fill="rgba(255,255,255,0.28)" fontFamily="monospace">{v.toFixed(1)}</text>
      ))}

      {/* Axis labels */}
      <text x={PL + PIW / 2} y={SVH - 1} textAnchor="middle" fontSize="8"
        fill="rgba(255,255,255,0.3)">Time</text>
      <text x={8} y={PT + PIH / 2} textAnchor="middle" fontSize="8"
        fill="rgba(255,255,255,0.3)"
        transform={`rotate(-90, 8, ${PT + PIH / 2})`}>Voltage (V)</text>

      {/* Legend */}
      <line x1={PL + 4}   y1={PT + 7} x2={PL + 18}  y2={PT + 7} stroke={C_BLUE}  strokeWidth="1.5" />
      <text x={PL + 21}  y={PT + 10} fontSize="7" fill={C_BLUE}  fontFamily="monospace">V1 sq</text>
      <line x1={PL + 56}  y1={PT + 7} x2={PL + 70}  y2={PT + 7} stroke={C_TEAL}  strokeWidth="1.5" />
      <text x={PL + 73}  y={PT + 10} fontSize="7" fill={C_TEAL}  fontFamily="monospace">V2 tri</text>
      <line x1={PL + 110} y1={PT + 7} x2={PL + 124} y2={PT + 7} stroke={C_AMBER} strokeWidth="2"   />
      <text x={PL + 127} y={PT + 10} fontSize="7" fill={C_AMBER} fontFamily="monospace">V4 sine</text>
    </svg>
  )
}

function WaveformGenTab() {
  const [R1_k,  setR1]    = useState(10)    // kΩ — oscillator
  const [C1_n,  setC1]    = useState(100)   // nF — oscillator
  const [gamma, setGamma] = useState(0.50)  // voltage divider ratio
  const [R2_k,  setR2]    = useState(16)    // kΩ — filter
  const [C2_n,  setC2]    = useState(10)    // nF — filter

  const R1   = R1_k * 1e3
  const C1   = C1_n * 1e-9
  const tau1 = R1 * C1
  const k    = (1 - gamma) / (1 + gamma)
  const halfT = k > 0 ? -tau1 * Math.log(k) : Infinity
  const fosc  = isFinite(halfT) && halfT > 0 ? 1 / (2 * halfT) : 0

  const R2   = R2_k * 1e3
  const C2   = C2_n * 1e-9
  const fc2  = 1 / (2 * Math.PI * R2 * C2)
  const mag3 = 1 / Math.sqrt(1 + (fosc / fc2) ** 2)
  const ph3  = -Math.atan(fosc / fc2) * 180 / Math.PI

  const ratio     = fosc > 0 ? fosc / fc2 : NaN
  const goodMatch = isFinite(ratio) && ratio >= 0.05 && ratio <= 5

  return (
    <div className="lab7-sim">
      <div className="lab7-two-col">
        <div className="lab7-panel">
          <div className="lab7-panel-title">Oscillator — V1 &amp; V2</div>
          <div className="calc-controls">
            <CalcSlider label="R₁ (oscillator)" value={R1_k} onChange={setR1}
              min={1} max={50} step={1} unit=" kΩ" color={C_BLUE} />
            <CalcSlider label="C₁ (oscillator)" value={C1_n} onChange={setC1}
              min={1} max={1000} step={1} unit=" nF" color={C_BLUE} />
            <CalcSlider label="γ (pot ratio)" value={gamma} onChange={setGamma}
              min={0.10} max={0.90} step={0.01} fmt={v => v.toFixed(2)} color={C_TEAL} />
          </div>

          <div className="lab7-panel-title" style={{ marginTop: 14 }}>Filter — V4</div>
          <div className="calc-controls">
            <CalcSlider label="R₂ (filter)" value={R2_k} onChange={setR2}
              min={1} max={100} step={1} unit=" kΩ" color={C_AMBER} />
            <CalcSlider label="C₂ (filter)" value={C2_n} onChange={setC2}
              min={1} max={1000} step={1} unit=" nF" color={C_AMBER} />
          </div>
        </div>

        <div className="lab7-panel">
          <div className="lab7-panel-title">Output Waveforms</div>
          <WaveformSVG fosc={fosc} gamma={gamma} mag3={mag3} ph3_deg={ph3} />
          <div className="lab7-stat-grid">
            <StatRow label="Oscillation Freq (fosc)" value={fHz(fosc)}                           color={C_BLUE}  />
            <StatRow label="Half-period"              value={fMs(halfT)}                          color={C_BLUE}  />
            <StatRow label="Filter cutoff fc₂"        value={fHz(fc2)}                            color={C_AMBER} />
            <StatRow label="|H(fosc)|"                value={fMag(mag3)}                          color={C_AMBER} />
            <StatRow label="Phase shift (V4)"         value={fDeg(ph3)}                           color={C_AMBER} />
            <StatRow label="fosc / fc₂"               value={isFinite(ratio) ? ratio.toFixed(3) : '---'}
              color={goodMatch ? C_GREEN : C_RED} />
          </div>
          {!goodMatch && isFinite(ratio) && fosc > 0 && (
            <div className="lab7-note-chip warn">
              fosc/fc₂ = {ratio.toFixed(2)} — tune R₂ or C₂ so this ratio sits between 0.05 and 5
              for effective sine shaping
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   ROOT CALCULATOR COMPONENT
═══════════════════════════════════════════════════ */

const TABS = [
  { id: 'bode',    label: 'Bode Plot',          short: 'Magnitude & phase vs. frequency'          },
  { id: 'cascade', label: 'Cascaded Filters',   short: 'Two-stage back-to-back filter response'   },
  { id: 'gen',     label: 'Waveform Generator', short: 'Square + triangle + sine output designer' },
]

const styles = `
.lab7-root .calc-body {
  display: flex; flex-direction: column;
  grid-template-columns: none;
  padding: 18px 20px;
}
.lab7-root .calc-tab { min-height: 56px; }
.lab7-root .calc-tab-desc { white-space: normal; text-align: center; line-height: 1.3; }

.lab7-root { display: flex; flex-direction: column; gap: 0; }
.lab7-sim  { display: flex; flex-direction: column; gap: 0; }
.lab7-two-col {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 14px;
  align-items: start;
}
.lab7-panel {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 14px;
}
.lab7-panel-title {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 10px;
}
.lab7-svg {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--r-sm);
  background: #060a0c;
  margin-bottom: 10px;
}
.lab7-stat-grid  { display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
.lab7-stat-row   {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 6px;
  border-radius: var(--r-sm);
  background: rgba(255,255,255,0.03);
}
.lab7-stat-label { font-size: 11px; color: var(--text-2); font-family: var(--mono); }
.lab7-stat-value { font-size: 12px; font-family: var(--mono); font-weight: 600; }
.lab7-note-chip  {
  margin-top: 10px;
  padding: 7px 10px;
  border-radius: var(--r-sm);
  font-size: 11px;
  font-family: var(--mono);
  background: rgba(255,255,255,0.04);
  color: var(--text-2);
  border-left: 3px solid var(--border);
}
.lab7-note-chip.warn {
  background: rgba(220,80,80,0.08);
  border-left-color: rgba(220,80,80,0.7);
  color: rgba(220,80,80,0.9);
}
`

export function ACResponseCalc() {
  const [tab, setTab] = useState('bode')

  return (
    <div className="lab7-root">
      <style>{styles}</style>
      <div className="calc-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`calc-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="calc-tab-id">{t.label}</span>
            <span className="calc-tab-desc">{t.short}</span>
          </button>
        ))}
      </div>
      <div className="calc-body">
        {tab === 'bode'    && <BodeTab />}
        {tab === 'cascade' && <CascadeTab />}
        {tab === 'gen'     && <WaveformGenTab />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   labData — DASHBOARD CONTENT
═══════════════════════════════════════════════════ */

export const labData = {
  objectives: [
    'Understand the sinusoidal steady-state frequency response (magnitude and phase) of a first-order RC low-pass filter.',
    'Apply Fourier series superposition to analyze how the filter selectively attenuates harmonics of periodic (non-sinusoidal) inputs.',
    'Experimentally convert triangle and square waves into approximate sinusoidal signals using single and cascaded active RC low-pass filters.',
    'Design and build a multi-waveform function generator that simultaneously outputs a square wave, a triangle wave, and a sine wave.',
  ],

  parts: [
    {
      label:       'Task 1',
      duration:    '~30 min',
      title:       'Triangle Wave → Sine Wave',
      description: 'Build the active first-order RC low-pass filter (Fig 7.3) with cutoff fc ≈ 1 kHz. ' +
        'Input a 2 Vpp triangle wave at 250 Hz and screenshot both input and output. ' +
        'Then sweep frequency until the output looks most sinusoidal; record that frequency and screenshot again.',
    },
    {
      label:       'Task 2',
      duration:    '~40 min',
      title:       'Square Wave → Sine Wave',
      description: 'Replace the triangle input with a 2 Vpp square wave. Screenshot signals at 250 Hz and at the optimal frequency. ' +
        'Then cascade two active filters (Fig 7.4): fix stage 1 at fc1 ≈ 1 kHz, vary stage 2 cutoff and input frequency until output is maximally sinusoidal. ' +
        'Record all R, C, and frequency values.',
    },
    {
      label:       'Task 3',
      duration:    '~45 min',
      title:       'Multi-Waveform Generator',
      description: 'Wire the Lab 6 relaxation oscillator (Fig 7.5): choose R1, C1 so it oscillates near 250 Hz with γ = 0.5. ' +
        'V1 = square wave; V2 at the potentiometer tap — adjust γ until V2 looks roughly triangular. ' +
        'Add a second-stage active RC filter (R2, C2) tuned to fosc to produce V4 ≈ sine wave. ' +
        'Record all component values, measure fosc and γ, and screenshot V1, V2, and V4 simultaneously.',
    },
  ],

  components: [
    { name: '741 Op-Amp',             value: '—',           qty: 2          },
    { name: '10 kΩ Potentiometer',    value: '10 kΩ',       qty: 1          },
    { name: '¼W Resistors',           value: 'various',     qty: 'assorted' },
    { name: 'Capacitors',             value: 'various',     qty: 'assorted' },
    { name: 'Oscilloscope',           value: '2-channel',   qty: 1          },
    { name: 'Function Generator',     value: 'tri + sq',    qty: 1          },
    { name: 'Dual-rail Power Supply', value: '±5–15 V DC',  qty: 1          },
  ],

  equations: [
    {
      title:    'Magnitude Response',
      subtitle: 'Amplitude ratio of output to input vs. frequency',
      tex:      '\\left|H(j\\omega)\\right| = \\dfrac{1}{\\sqrt{1+(\\omega/\\omega_c)^2}}',
      color:    'rgba(100,160,240,0.92)',
      vars: [
        { sym: '\\omega',   def: 'Input angular frequency (rad/s) = 2πf' },
        { sym: '\\omega_c', def: 'Cutoff angular frequency (rad/s) = 1/(RC)' },
      ],
      example: 'f=f_c \\Rightarrow |H|=\\tfrac{1}{\\sqrt{2}}\\approx 0.707',
    },
    {
      title:    'Phase Response',
      subtitle: 'Phase shift introduced by the filter',
      tex:      '\\angle H(j\\omega) = -\\tan^{-1}\\!\\left(\\dfrac{\\omega}{\\omega_c}\\right)',
      color:    'rgba(240,180,60,0.95)',
      vars: [
        { sym: '\\omega',   def: 'Input angular frequency (rad/s)' },
        { sym: '\\omega_c', def: 'Cutoff angular frequency (rad/s) = 1/(RC)' },
      ],
      example: 'f=f_c \\Rightarrow \\angle H = -45°',
    },
    {
      title:    'Cutoff Frequency',
      subtitle: 'Choose R and C so fc ≈ 1 kHz for Tasks 1 & 2',
      tex:      'f_c = \\dfrac{1}{2\\pi RC} \\qquad \\omega_c = \\dfrac{1}{RC}',
      color:    'rgba(100,210,180,0.92)',
      vars: [
        { sym: 'R', def: 'Filter resistor (Ω)' },
        { sym: 'C', def: 'Filter capacitor (F)' },
      ],
      example: 'R=15.9\\,k\\Omega,\\;C=10\\,\\text{nF} \\Rightarrow f_c\\approx 1\\,\\text{kHz}',
    },
    {
      title:    'Cascaded Filter Response',
      subtitle: 'Two independent stages — multiply magnitudes, add phases',
      tex:      '|H_{\\text{total}}| = |H_1||H_2|, \\quad \\angle H_{\\text{total}} = \\angle H_1 + \\angle H_2',
      color:    'rgba(220,80,80,0.92)',
      vars: [
        { sym: '|H_1|', def: 'Stage 1 magnitude at the given frequency' },
        { sym: '|H_2|', def: 'Stage 2 magnitude at the given frequency' },
      ],
      example: 'f=f_{c1}=f_{c2} \\Rightarrow |H_{\\text{total}}|=0.5,\\;\\angle=-90°',
    },
  ],

  notes: [
    'For Tasks 1 and 2, choose R and C so fc = 1/(2πRC) ≈ 1 kHz — e.g. R ≈ 15.9 kΩ, C = 10 nF.',
    'Triangle wave harmonics fall as 1/k²; square wave harmonics fall as 1/k. One filter stage usually converts a triangle wave to a good sine; a square wave typically needs two stages.',
    'The active filter (Fig 7.3) inverts the output (Vout ≈ −Vin filtered). For this lab, the waveform shape is the goal — polarity inversion is acceptable.',
    'Set the input frequency well below fc — not equal to it — for the most sinusoidal output. The third harmonic must be attenuated much more than the fundamental.',
    'For Task 3, use your Lab 6 R1/C1 component values as a starting point. Set γ = 0.5 (potentiometer centered) first, then fine-tune until V2 appears triangular.',
    'After completing Task 3, V1, V2, and V4 simultaneously display a square wave, a triangle wave, and an approximate sine wave — you have built a 3-output mini function generator.',
  ],

  images: [
    {
      src:     new URL('./images/schematic.png', import.meta.url).href,
      caption: 'Lab 7 Schematics — Passive RC filter (Fig 7.1), active low-pass filter (Fig 7.3), cascaded filters (Fig 7.4), and multi-waveform generator (Fig 7.5)',
      alt:     'ECEN 214 Lab 7 schematics showing RC low-pass filter, active op-amp filter, cascaded filter stages, and full oscillator + filter circuit',
    },
  ],

  calculatorTitle: 'AC Response Designer',
  calculatorIcon:  '〜',
}
