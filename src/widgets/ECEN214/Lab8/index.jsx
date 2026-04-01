import { useState } from 'react'

// ── ECEN 214 Lab 8 — Transient Response of a 2nd Order Circuit ───────────────
// Exports: labData (dashboard content) and SallenKeyCalc (calculator widget).
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
const fkΩ  = v => !isFinite(v) || v <= 0 ? '---' : v >= 1e6 ? fv(v / 1e6, 2) + ' MΩ' : v >= 1000 ? fv(v / 1000, 2) + ' kΩ' : fv(v, 0) + ' Ω'
const fnF  = v => !isFinite(v) || v <= 0 ? '---' : v >= 1e-6 ? fv(v * 1e6, 2) + ' µF' : fv(v * 1e9, 2) + ' nF'

/* ── SVG layout constants ── */
const SVW = 420, SVH = 190
const PL = 48, PR = 10, PT = 12, PB = 30
const PIW = SVW - PL - PR
const PIH = SVH - PT - PB

/* ── Pure math: 2nd order step response (step from 0 to A=1 at t=0) ── */
// Initial conditions: Vout(0) = 0, dVout/dt(0) = 0
function stepResponse(t, alpha, omega0) {
  if (t < 0) return 0
  const disc = alpha * alpha - omega0 * omega0
  if (Math.abs(disc) < 1e-8 * omega0 * omega0) {
    // Critically damped — repeated root at s = -alpha
    return 1 - (1 + alpha * t) * Math.exp(-alpha * t)
  } else if (disc > 0) {
    // Overdamped — two distinct real roots
    const sqD = Math.sqrt(disc)
    const s1  = -alpha + sqD   // slower (closer to 0)
    const s2  = -alpha - sqD   // faster
    return 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2)
  } else {
    // Underdamped — complex conjugate roots
    const omD = Math.sqrt(-disc)
    return 1 - Math.exp(-alpha * t) * (Math.cos(omD * t) + (alpha / omD) * Math.sin(omD * t))
  }
}

/* ── Choose a sensible display window ── */
function getTmax(alpha, omega0) {
  if (!isFinite(alpha) || alpha <= 0 || !isFinite(omega0) || omega0 <= 0) return 0.01
  const disc = alpha * alpha - omega0 * omega0
  if (disc >= 0) {
    // Slowest time constant = 1/|s1|
    const s1abs = alpha - Math.sqrt(Math.max(0, disc))
    const tau   = s1abs > 0 ? 1 / s1abs : 1 / alpha
    return Math.min(8 * tau, 0.5)  // cap at 500 ms
  } else {
    const omD = Math.sqrt(-disc)
    return Math.max(6 / alpha, 3 * 2 * Math.PI / omD)
  }
}

/* ── Get curve color based on damping ── */
function curveColor(alpha, omega0) {
  const disc = alpha * alpha - omega0 * omega0
  if (Math.abs(disc) < 1e-8 * omega0 * omega0) return C_TEAL    // critically damped
  if (disc > 0) return C_BLUE                                    // overdamped
  return C_AMBER                                                  // underdamped
}

/* ── Step Response SVG ── */
function StepResponseSVG({ alpha, omega0 }) {
  if (!isFinite(alpha) || alpha <= 0 || !isFinite(omega0) || omega0 <= 0) {
    return (
      <svg viewBox={`0 0 ${SVW} ${SVH}`} className="lab8-svg">
        <text x={SVW / 2} y={SVH / 2} textAnchor="middle" fontSize="11"
          fill="rgba(255,255,255,0.25)" fontFamily="monospace">
          Set component values to view response
        </text>
      </svg>
    )
  }

  const tMax = getTmax(alpha, omega0)

  // Determine voltage range (account for underdamped overshoot)
  const disc = alpha * alpha - omega0 * omega0
  let vMax = 1.25, vMin = -0.1
  if (disc < 0) {
    const omD     = Math.sqrt(-disc)
    const overshoot = Math.exp(-Math.PI * alpha / omD)
    vMax = Math.min(1 + overshoot + 0.15, 2.0)
    vMin = -0.1
  }
  const vRange = vMax - vMin

  const mx = t => PL + (t / tMax) * PIW
  const my = v => PT + PIH - ((v - vMin) / vRange) * PIH

  // Generate curve (200 points)
  const N = 200
  const color = curveColor(alpha, omega0)
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * tMax
    const v = stepResponse(t, alpha, omega0)
    return `${mx(t).toFixed(1)},${my(v).toFixed(1)}`
  }).join(' ')

  // Steady-state line and time constant marker
  const xTau = mx(Math.min(1 / alpha, tMax * 0.95))
  const yTau = my(stepResponse(1 / alpha, alpha, omega0))

  // X-axis time ticks (5 evenly spaced)
  const xTicks = [0, 1, 2, 3, 4, 5].map(k => k * tMax / 5)

  return (
    <svg viewBox={`0 0 ${SVW} ${SVH}`} className="lab8-svg">
      {/* Steady-state reference at Vout = 1 */}
      <line x1={PL} y1={my(1)} x2={SVW - PR} y2={my(1)}
        stroke="rgba(255,255,255,0.12)" strokeDasharray="4,3" strokeWidth="1" />
      <text x={PL - 4} y={my(1) + 3.5} textAnchor="end" fontSize="7"
        fill="rgba(255,255,255,0.25)" fontFamily="monospace">1</text>

      {/* Zero reference */}
      <line x1={PL} y1={my(0)} x2={SVW - PR} y2={my(0)}
        stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* τ = 1/alpha marker */}
      {1 / alpha <= tMax * 0.95 && (
        <>
          <line x1={xTau} y1={PT} x2={xTau} y2={PT + PIH}
            stroke={C_AMBER} strokeDasharray="3,3" strokeWidth="1" opacity="0.4" />
          <circle cx={xTau} cy={yTau} r={3} fill={C_AMBER} opacity="0.85" />
          <text x={xTau} y={PT + PIH + 18} textAnchor="middle" fontSize="8"
            fill={C_AMBER} fontFamily="monospace">1/α</text>
        </>
      )}

      {/* Step response curve */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + PIH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <line x1={PL} y1={PT + PIH} x2={SVW - PR} y2={PT + PIH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

      {/* X ticks */}
      {xTicks.map((t, i) => (
        <g key={i}>
          <line x1={mx(t)} y1={PT + PIH} x2={mx(t)} y2={PT + PIH + 4}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text x={mx(t)} y={PT + PIH + 14} textAnchor="middle" fontSize="7"
            fill="rgba(255,255,255,0.3)" fontFamily="monospace">{fMs(t)}</text>
        </g>
      ))}

      {/* Y ticks */}
      {[0, 0.5, 1.0].map(v => (
        <g key={v}>
          <line x1={PL - 3} y1={my(v)} x2={PL} y2={my(v)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text x={PL - 5} y={my(v) + 3.5} textAnchor="end" fontSize="7"
            fill="rgba(255,255,255,0.3)" fontFamily="monospace">{v.toFixed(1)}</text>
        </g>
      ))}

      {/* Axis labels */}
      <text x={PL + PIW / 2} y={SVH - 1} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)">Time</text>
      <text x={8} y={PT + PIH / 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)"
        transform={`rotate(-90, 8, ${PT + PIH / 2})`}>Vout (norm.)</text>
    </svg>
  )
}

/* ── Shared sub-components ── */
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

function StatRow({ label, value, color = C_AMBER }) {
  return (
    <div className="lab8-stat-row">
      <span className="lab8-stat-label">{label}</span>
      <span className="lab8-stat-value" style={{ color }}>{value}</span>
    </div>
  )
}

function DampingChip({ alpha, omega0 }) {
  const disc = alpha * alpha - omega0 * omega0
  const isCrit = Math.abs(disc) < 1e-8 * omega0 * omega0
  const isOver = !isCrit && disc > 0
  const label  = isCrit ? 'Critically Damped' : isOver ? 'Overdamped' : 'Underdamped'
  const color  = isCrit ? C_TEAL : isOver ? C_BLUE : C_AMBER
  const q      = omega0 / (2 * alpha)
  return (
    <div className="lab8-damp-chip" style={{ borderLeftColor: color, color }}>
      {label} &nbsp;·&nbsp; Q = {isFinite(q) ? q.toFixed(3) : '---'}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   TAB 1 — STEP RESPONSE SIMULATOR
═══════════════════════════════════════════════════ */
function StepTab() {
  const [R1_k, setR1] = useState(16)    // kΩ
  const [R2_k, setR2] = useState(16)    // kΩ
  const [C1_n, setC1] = useState(10)    // nF
  const [C2_n, setC2] = useState(10)    // nF

  const R1 = R1_k * 1e3,  R2 = R2_k * 1e3
  const C1 = C1_n * 1e-9, C2 = C2_n * 1e-9

  const omega0 = 1 / Math.sqrt(R1 * C1 * R2 * C2)
  const alpha  = (R1 + R2) / (2 * R1 * C1 * R2)
  const Q      = omega0 / (2 * alpha)
  const fc     = omega0 / (2 * Math.PI)
  const disc   = alpha * alpha - omega0 * omega0
  const omegaD = disc < 0 ? Math.sqrt(-disc) : 0
  const fd     = omegaD / (2 * Math.PI)

  return (
    <div className="lab8-sim">
      <div className="lab8-two-col">
        {/* Left: controls */}
        <div className="lab8-panel">
          <div className="lab8-panel-title">Component Values</div>
          <div className="calc-controls">
            <CalcSlider label="R₁" value={R1_k} onChange={setR1}
              min={1} max={200} step={1} unit=" kΩ" color={C_BLUE} />
            <CalcSlider label="R₂" value={R2_k} onChange={setR2}
              min={1} max={200} step={1} unit=" kΩ" color={C_BLUE} />
            <CalcSlider label="C₁" value={C1_n} onChange={setC1}
              min={1} max={2000} step={1} unit=" nF" color={C_TEAL} />
            <CalcSlider label="C₂" value={C2_n} onChange={setC2}
              min={1} max={2000} step={1} unit=" nF" color={C_TEAL} />
          </div>
        </div>

        {/* Right: plot + stats */}
        <div className="lab8-panel">
          <div className="lab8-panel-title">Step Response — V_out(t)</div>
          <StepResponseSVG alpha={alpha} omega0={omega0} />
          <DampingChip alpha={alpha} omega0={omega0} />
          <div className="lab8-stat-grid">
            <StatRow label="Natural Freq ωo"   value={isFinite(omega0) ? fv(omega0, 0) + ' rad/s' : '---'} color={C_TEAL}  />
            <StatRow label="Cutoff fc"          value={fHz(fc)}                                              color={C_TEAL}  />
            <StatRow label="Damping Factor α"   value={isFinite(alpha)  ? fv(alpha,  0) + ' Np/s' : '---'}  color={C_BLUE}  />
            <StatRow label="Q-factor"           value={isFinite(Q)      ? Q.toFixed(4) : '---'}             color={C_AMBER} />
            <StatRow label="Damped Freq fd"     value={omegaD > 0 ? fHz(fd) : 'N/A (non-osc.)'}            color={C_AMBER} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   TAB 2 — Q-FACTOR DESIGNER
   Equal-resistor design: R1 = R2 = R
   → Q = √(C1/C2)/2,  ωo = 1/(R·√(C1·C2))
   → C1 = 4Q²·C2,     R  = 1/(2Q·ωo·C2)
═══════════════════════════════════════════════════ */

const Q_PRESETS = [
  { label: 'Q = 0.5',  q: 0.5,  note: 'Critically damped' },
  { label: 'Q = 0.25', q: 0.25, note: 'Slightly overdamped' },
  { label: 'Q = 0.1',  q: 0.1,  note: 'Overdamped' },
  { label: 'Q = 1.0',  q: 1.0,  note: 'Slightly underdamped' },
  { label: 'Q = 2.5',  q: 2.5,  note: 'Underdamped' },
]

function DesignerTab() {
  const [Q_t,   setQt]  = useState(0.50)
  const [fc,    setFc]  = useState(1000)   // Hz
  const [C2_n,  setC2]  = useState(10)     // nF

  const omega0 = 2 * Math.PI * fc
  const C2     = C2_n * 1e-9
  const C1     = 4 * Q_t * Q_t * C2         // derived: C1 = 4Q²·C2
  const R      = 1 / (2 * Q_t * omega0 * C2) // R1 = R2 = R
  const alpha  = 1 / (R * C1)               // = ωo/(2Q) by construction

  const isValid = isFinite(R) && R > 0 && isFinite(C1) && C1 > 0

  return (
    <div className="lab8-sim">
      {/* Preset buttons */}
      <div className="lab8-presets">
        {Q_PRESETS.map(p => (
          <button key={p.q}
            className={`lab8-preset-btn${Math.abs(Q_t - p.q) < 0.001 ? ' active' : ''}`}
            onClick={() => setQt(p.q)}>
            <span className="lab8-preset-q">{p.label}</span>
            <span className="lab8-preset-note">{p.note}</span>
          </button>
        ))}
      </div>

      <div className="lab8-two-col">
        {/* Left: design inputs */}
        <div className="lab8-panel">
          <div className="lab8-panel-title">Design Targets</div>
          <div className="calc-controls">
            <CalcSlider label="Target Q" value={Q_t} onChange={setQt}
              min={0.05} max={5.0} step={0.05} fmt={v => v.toFixed(2)} color={C_AMBER} />
            <CalcSlider label="Target fc" value={fc} onChange={setFc}
              min={10} max={5000} step={10} fmt={v => fHz(v)} color={C_TEAL} />
            <CalcSlider label="C₂ (base cap)" value={C2_n} onChange={setC2}
              min={1} max={1000} step={1} unit=" nF" color={C_BLUE} />
          </div>

          <div className="lab8-panel-title" style={{ marginTop: 16 }}>Computed Values (R₁ = R₂ = R)</div>
          <div className="lab8-stat-grid">
            <StatRow label="R₁ = R₂" value={isValid ? fkΩ(R)    : '---'} color={C_BLUE}  />
            <StatRow label="C₁"      value={isValid ? fnF(C1)   : '---'} color={C_TEAL}  />
            <StatRow label="C₂"      value={fnF(C2)}                     color={C_TEAL}  />
            <StatRow label="ωo"      value={isValid ? fv(omega0, 0) + ' rad/s' : '---'} color={C_AMBER} />
          </div>

          <div className="lab8-note-chip" style={{ marginTop: 12 }}>
            Equal-R design: C₁ = 4Q²·C₂ &nbsp;·&nbsp; R = 1/(2Q·ωo·C₂)
          </div>
        </div>

        {/* Right: preview */}
        <div className="lab8-panel">
          <div className="lab8-panel-title">Step Response Preview</div>
          <StepResponseSVG alpha={isValid ? alpha : 1} omega0={isValid ? omega0 : 1} />
          <DampingChip alpha={isValid ? alpha : 1} omega0={isValid ? omega0 : 1} />
          <div className="lab8-stat-grid" style={{ marginTop: 8 }}>
            <StatRow label="Actual α" value={isValid ? fv(alpha, 1) + ' Np/s' : '---'} color={C_BLUE}  />
            <StatRow label="Actual fc" value={isValid ? fHz(omega0 / (2 * Math.PI)) : '---'} color={C_TEAL}  />
            <StatRow label="Actual Q" value={isValid ? Q_t.toFixed(4) : '---'} color={C_AMBER} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   ROOT CALCULATOR COMPONENT
═══════════════════════════════════════════════════ */

const TABS = [
  { id: 'step',   label: 'Step Response',  short: 'Sallen-Key Vout(t) from R₁ R₂ C₁ C₂' },
  { id: 'design', label: 'Q Designer',     short: 'Equal-R component values for target Q & fc' },
]

const styles = `
.lab8-root .calc-body {
  display: flex; flex-direction: column;
  grid-template-columns: none;
  padding: 18px 20px;
}
.lab8-root .calc-tab { min-height: 56px; }
.lab8-root .calc-tab-desc { white-space: normal; text-align: center; line-height: 1.3; }

.lab8-root { display: flex; flex-direction: column; gap: 0; }
.lab8-sim  { display: flex; flex-direction: column; gap: 12px; }

.lab8-presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.lab8-preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 14px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--bg-3);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.lab8-preset-btn:hover { border-color: rgba(240,180,60,0.5); }
.lab8-preset-btn.active {
  border-color: rgba(240,180,60,0.85);
  background: rgba(240,180,60,0.08);
}
.lab8-preset-q {
  font-size: 12px;
  font-family: var(--mono);
  font-weight: 600;
  color: var(--text);
}
.lab8-preset-note {
  font-size: 10px;
  font-family: var(--mono);
  color: var(--text-3);
}

.lab8-two-col {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 14px;
  align-items: start;
}
.lab8-panel {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px;
}
.lab8-panel-title {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 12px;
}
.lab8-svg {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--r-sm);
  background: #060a0c;
  margin-bottom: 10px;
}
.lab8-stat-grid  { display: flex; flex-direction: column; gap: 4px; }
.lab8-stat-row   {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 6px;
  border-radius: var(--r-sm);
  background: rgba(255,255,255,0.03);
}
.lab8-stat-label { font-size: 11px; color: var(--text-2); font-family: var(--mono); }
.lab8-stat-value { font-size: 12px; font-family: var(--mono); font-weight: 600; }
.lab8-damp-chip  {
  padding: 5px 10px;
  border-radius: var(--r-sm);
  border-left: 3px solid var(--border);
  font-size: 11px;
  font-family: var(--mono);
  background: rgba(255,255,255,0.03);
  margin-bottom: 8px;
}
.lab8-note-chip {
  padding: 7px 10px;
  border-radius: var(--r-sm);
  font-size: 10px;
  font-family: var(--mono);
  background: rgba(255,255,255,0.04);
  color: var(--text-3);
  border-left: 3px solid var(--border);
  line-height: 1.5;
}
`

export function SallenKeyCalc() {
  const [tab, setTab] = useState('step')

  return (
    <div className="lab8-root">
      <style>{styles}</style>
      <div className="calc-tabs">
        {TABS.map(t => (
          <button key={t.id}
            className={`calc-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}>
            <span className="calc-tab-id">{t.label}</span>
            <span className="calc-tab-desc">{t.short}</span>
          </button>
        ))}
      </div>
      <div className="calc-body">
        {tab === 'step'   && <StepTab />}
        {tab === 'design' && <DesignerTab />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   labData — DASHBOARD CONTENT
═══════════════════════════════════════════════════ */

export const labData = {
  objectives: [
    'Analyze the transient (step) response of a Sallen-Key 2nd order active filter and compare measured results with theoretical predictions and SPICE simulations.',
    'Understand how the Q-factor determines the character of the 2nd order response: overdamped (Q < ½), critically damped (Q = ½), or underdamped (Q > ½).',
    'Select resistor and capacitor values (R₁, R₂, C₁, C₂) in the Sallen-Key topology to achieve five specific Q-factor targets.',
    'Recognize how op-amp active circuits synthesize 2nd order behavior without inductors, making them suitable for integrated circuit implementation.',
  ],

  parts: [
    {
      label:       'Task 1 · Case 1',
      duration:    '~15 min',
      title:       'Critically Damped  (Q = 0.5)',
      description: 'Build the Sallen-Key circuit with component values that give Q = ½. ' +
        'Apply a 100 Hz, 2 Vpp square wave. Display Vin on CH1 and Vout on CH2. ' +
        'Trigger on edge; scale axes so both waveforms are clearly visible. Save a screenshot.',
    },
    {
      label:       'Task 1 · Case 2',
      duration:    '~10 min',
      title:       'Slightly Overdamped  (Q = 0.25)',
      description: 'Swap to component values giving Q = 0.25. Observe Vout approaches steady state without oscillation but more slowly than case 1. Save screenshot.',
    },
    {
      label:       'Task 1 · Case 3',
      duration:    '~10 min',
      title:       'Overdamped  (Q = 0.1)',
      description: 'Use component values for Q = 0.1. The response is heavily overdamped — two very different real time constants. Vout rises slowly and monotonically. Save screenshot.',
    },
    {
      label:       'Task 1 · Case 4',
      duration:    '~10 min',
      title:       'Slightly Underdamped  (Q = 1.0)',
      description: 'Component values for Q = 1. A small overshoot and single ring is visible before Vout settles. Save screenshot.',
    },
    {
      label:       'Task 1 · Case 5',
      duration:    '~10 min',
      title:       'Underdamped  (Q = 2.5)',
      description: 'Component values for Q = 2.5. Vout overshoots and oscillates visibly before decaying to steady state. Show circuit to TA. Save screenshot.',
    },
  ],

  components: [
    { name: '741 Op-Amp',             value: '—',          qty: 1          },
    { name: '¼W Resistors',           value: 'various',    qty: 'assorted' },
    { name: 'Non-polarized Capacitors', value: 'various',  qty: 'assorted' },
    { name: 'Function Generator',     value: '100 Hz sq.', qty: 1          },
    { name: 'Oscilloscope',           value: '2-channel',  qty: 1          },
    { name: 'Dual-rail Power Supply', value: '±5 V DC',    qty: 1          },
  ],

  equations: [
    {
      title:    '2nd Order ODE (Sallen-Key)',
      subtitle: 'Governing differential equation of the circuit',
      tex:      'R_1C_1R_2C_2\\,\\ddot{V}_{out} + (R_1+R_2)C_2\\,\\dot{V}_{out} + V_{out} = V_{in}',
      color:    'rgba(100,160,240,0.92)',
      vars: [
        { sym: 'R_1, R_2', def: 'Series resistors (Ω)' },
        { sym: 'C_1, C_2', def: 'Filter capacitors (F)' },
      ],
      example:  'R_1=R_2=R,\\;C_1=C_2=C \\Rightarrow RC^2R\\,\\ddot{V}+2RC\\,\\dot{V}+V=V_{in}',
    },
    {
      title:    'Natural Frequency ωo',
      subtitle: 'Frequency at which circuit would oscillate if undamped',
      tex:      '\\omega_o = \\dfrac{1}{\\sqrt{R_1 C_1 R_2 C_2}}',
      color:    'rgba(100,210,180,0.92)',
      vars: [
        { sym: '\\omega_o', def: 'Natural (resonant) radian frequency (rad/s)' },
      ],
      example:  'R_1=R_2=16\\,k\\Omega,\\;C_1=C_2=10\\,\\text{nF} \\Rightarrow \\omega_o\\approx 6250\\,\\text{rad/s}',
    },
    {
      title:    'Damping Factor α',
      subtitle: 'Controls the rate of exponential decay',
      tex:      '\\alpha = \\dfrac{R_1 + R_2}{2\\,R_1 C_1 R_2}',
      color:    'rgba(240,180,60,0.95)',
      vars: [
        { sym: '\\alpha', def: 'Neper frequency (Np/s)' },
      ],
      example:  'R_1=R_2=R \\Rightarrow \\alpha = \\dfrac{1}{R\\,C_1}',
    },
    {
      title:    'Q-Factor',
      subtitle: 'Q < ½ overdamped · Q = ½ critical · Q > ½ underdamped',
      tex:      'Q = \\dfrac{\\omega_o}{2\\alpha} = \\dfrac{\\sqrt{R_1 R_2 C_1/C_2}}{R_1+R_2}',
      color:    'rgba(220,80,80,0.92)',
      vars: [
        { sym: 'Q', def: 'Quality factor (dimensionless)' },
      ],
      example:  'R_1=R_2=R \\Rightarrow Q = \\dfrac{1}{2}\\sqrt{C_1/C_2}',
    },
  ],

  notes: [
    'V₂ = Vout because the op-amp is configured as a unity-gain voltage follower (buffer): negative feedback drives V⁻ = V⁺ = V₂, so Vout = V₂.',
    'With equal resistors (R₁ = R₂ = R), Q simplifies to √(C₁/C₂)/2 — a capacitor ratio alone determines damping. Useful for lab design.',
    'Initial conditions for a step at t = 0: Vout(0⁺) = Vin(0⁻) and dVout/dt(0⁺) = 0, because capacitors hold their voltage instantaneously.',
    'Use a 100 Hz square wave. The half-period (5 ms) must be long enough for Vout to fully settle before the next step — verify this for each Q case.',
    'Lab component values will differ slightly from design targets; SPICE lets you simulate the actual component values to predict the exact waveform.',
    'Save oscilloscope screenshots for all five cases. Lab report requires side-by-side comparison of theoretical, simulated, and measured waveforms.',
  ],

  images: [
    {
      src:     new URL('./images/schematic.png', import.meta.url).href,
      caption: 'Lab 8 Schematic — Sallen-Key 2nd order active low-pass filter (Fig 8.1) and example overdamped / underdamped step responses (Fig 8.2)',
      alt:     'ECEN 214 Lab 8 Sallen-Key circuit schematic with R₁, R₂, C₁, C₂ and unity-gain op-amp buffer, plus example step response plots',
    },
  ],

  calculatorTitle: 'Sallen-Key Designer',
  calculatorIcon:  '⊕',
}
