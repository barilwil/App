import { useState } from 'react'

// ── ECEN 214 Lab 9 — AC Response of 2nd Order Circuits ───────────────────────
// Exports: labData (dashboard content) and SallenKeyACCalc (calculator widget).
// Layout is owned by WidgetShell — no JSX layout lives here.

/* ── Color constants ── */
const C_BLUE  = 'rgba(100,160,240,0.92)'
const C_TEAL  = 'rgba(100,210,180,0.92)'
const C_AMBER = 'rgba(240,180,60,0.95)'
const C_GREEN = 'rgba(80,210,130,0.92)'
const C_MUTED = 'rgba(255,255,255,0.18)'

/* ── Formatting helpers ── */
const fv  = (v, d = 2) => isFinite(v) && !isNaN(v) ? v.toFixed(d) : '---'
const fHz = v => !isFinite(v) || v <= 0 ? '---' : v >= 1000 ? fv(v / 1000, 2) + ' kHz' : fv(v, 1) + ' Hz'

/* ── SVG dual-panel layout ── */
// Shared frequency axis: 10 Hz → 10 kHz (log scale)
const SVW   = 420
const SVH   = 285
const PL    = 52, PR = 10
const PIW   = SVW - PL - PR

// Magnitude panel bounds (y coords inside SVG)
const M_TOP = 10,  M_BOT = 132
const PIH_M = M_BOT - M_TOP   // 122

// Phase panel bounds
const P_TOP = 150, P_BOT = 255
const PIH_P = P_BOT - P_TOP   // 105

const FMIN = 10, FMAX = 10000
const LOG_SPAN = Math.log10(FMAX / FMIN)     // 3 decades

const mxF = f => PL + (Math.log10(Math.max(FMIN, Math.min(FMAX, f)) / FMIN) / LOG_SPAN) * PIW

// Lab-specified measurement frequencies (13 points, log-spaced)
const LAB_FREQS = [10, 18, 32, 56, 100, 178, 316, 562, 1000, 1778, 3162, 5623, 10000]

/* ── Transfer-function math ─────────────────────────────────────────────────── */

// Low-pass Sallen-Key (Fig 9.1):
// H_LP(ω) = 1 / (1 + jω(R1+R2)C2 − ω²R1C1R2C2)
function computeLP(omega, R1, C1, R2, C2) {
  const rePart = 1 - omega * omega * R1 * C1 * R2 * C2
  const imPart = omega * (R1 + R2) * C2
  const denom  = Math.sqrt(rePart * rePart + imPart * imPart)
  return {
    mag:      1 / denom,
    phaseDeg: -Math.atan2(imPart, rePart) * 180 / Math.PI,
  }
}

// High-pass Sallen-Key (Fig 9.4) — R ↔ C swapped:
// H_HP(ω) = −ω²R1R2C1C2 / (1 + jωR1(C1+C2) − ω²R1R2C1C2)
function computeHP(omega, R1, C1, R2, C2) {
  const product = omega * omega * R1 * C1 * R2 * C2
  const rePart  = 1 - product
  const imPart  = omega * R1 * (C1 + C2)
  const denom   = Math.sqrt(rePart * rePart + imPart * imPart)
  return {
    mag:      product / denom,
    phaseDeg: (Math.PI - Math.atan2(imPart, rePart)) * 180 / Math.PI,
  }
}

// Scan for −3 dB cutoff (first frequency where |H| crosses 0.707)
function findCutoffLP(R1, C1, R2, C2) {
  for (let i = 500; i >= 0; i--) {
    const f = (FMIN / 10) * Math.pow(FMAX * 10 / (FMIN / 10), i / 500)
    if (computeLP(2 * Math.PI * f, R1, C1, R2, C2).mag >= 0.707) return f
  }
  return null
}

function findCutoffHP(R1, C1, R2, C2) {
  for (let i = 0; i <= 500; i++) {
    const f = (FMIN / 10) * Math.pow(FMAX * 10 / (FMIN / 10), i / 500)
    if (computeHP(2 * Math.PI * f, R1, C1, R2, C2).mag >= 0.707) return f
  }
  return null
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
    <div className="lab9-stat-row">
      <span className="lab9-stat-label">{label}</span>
      <span className="lab9-stat-value" style={{ color }}>{value}</span>
    </div>
  )
}

/* ── Dual-Panel Bode SVG ─────────────────────────────────────────────────────── */
function BodeSVG({ type, R1, C1, R2, C2 }) {
  const compute  = type === 'lp' ? computeLP  : computeHP
  const findFC   = type === 'lp' ? findCutoffLP : findCutoffHP
  const curColor = type === 'lp' ? C_BLUE : C_AMBER
  const phMin    = type === 'lp' ? -190 :  -10
  const phMax    = type === 'lp' ?   10 :  190

  // Dynamic magnitude ceiling
  const N = 200
  let peakMag = 0
  for (let i = 0; i <= N; i++) {
    const f = FMIN * Math.pow(FMAX / FMIN, i / N)
    const { mag } = compute(2 * Math.PI * f, R1, C1, R2, C2)
    if (mag > peakMag) peakMag = mag
  }
  const vMax = Math.max(1.25, Math.min(3.0, peakMag * 1.12))

  const my_m = v   => M_BOT - Math.max(0, Math.min(PIH_M, (v   / vMax) * PIH_M))
  const my_p = deg => P_BOT - Math.max(0, Math.min(PIH_P, ((deg - phMin) / (phMax - phMin)) * PIH_P))

  // Curve points
  const magPts   = [], phasePts = []
  for (let i = 0; i <= N; i++) {
    const f = FMIN * Math.pow(FMAX / FMIN, i / N)
    const { mag, phaseDeg } = compute(2 * Math.PI * f, R1, C1, R2, C2)
    const x = mxF(f).toFixed(1)
    magPts  .push(`${x},${my_m(mag)    .toFixed(1)}`)
    phasePts.push(`${x},${my_p(phaseDeg).toFixed(1)}`)
  }

  // Cutoff
  const fc = findFC(R1, C1, R2, C2)
  const fcX = fc ? mxF(fc) : null

  // ωo and Q stats
  const omega0 = 1 / Math.sqrt(R1 * C1 * R2 * C2)
  const alphaLP = (R1 + R2) / (2 * R1 * C1 * R2)
  const alphaHP = (C1 + C2) / (2 * R2 * C1 * C2)
  const alpha   = type === 'lp' ? alphaLP : alphaHP
  const Q       = isFinite(omega0) && isFinite(alpha) ? omega0 / (2 * alpha) : NaN

  // X-axis decade ticks
  const xDecades = [10, 100, 1000, 10000]
  // Reference lines for phase panel
  const phaseRefs = type === 'lp' ? [-90, -180] : [90, 180]

  return (
    <svg viewBox={`0 0 ${SVW} ${SVH}`} className="lab9-svg">

      {/* ── MAGNITUDE PANEL ── */}

      {/* 0.707 (−3 dB) reference */}
      <line x1={PL} y1={my_m(0.707)} x2={SVW - PR} y2={my_m(0.707)}
        stroke={C_MUTED} strokeDasharray="4,3" strokeWidth="1" />
      <text x={PL - 4} y={my_m(0.707) + 3.5} textAnchor="end" fontSize="7"
        fill={C_MUTED} fontFamily="monospace">0.71</text>

      {/* 1.0 (unity) reference */}
      <line x1={PL} y1={my_m(1)} x2={SVW - PR} y2={my_m(1)}
        stroke="rgba(255,255,255,0.07)" strokeDasharray="3,3" strokeWidth="1" />

      {/* fc vertical */}
      {fcX && (
        <>
          <line x1={fcX} y1={M_TOP} x2={fcX} y2={M_BOT}
            stroke={C_TEAL} strokeDasharray="4,3" strokeWidth="1" opacity="0.55" />
          <line x1={fcX} y1={P_TOP} x2={fcX} y2={P_BOT}
            stroke={C_TEAL} strokeDasharray="4,3" strokeWidth="1" opacity="0.25" />
        </>
      )}

      {/* Magnitude curve */}
      <polyline points={magPts.join(' ')} fill="none" stroke={curColor}
        strokeWidth="2" strokeLinejoin="round" />

      {/* Lab measurement freq markers (magnitude) */}
      {LAB_FREQS.map(f => {
        const { mag } = compute(2 * Math.PI * f, R1, C1, R2, C2)
        return (
          <circle key={f} cx={mxF(f)} cy={my_m(mag)} r={2.5}
            fill={curColor} opacity="0.7" />
        )
      })}

      {/* Magnitude Y-axis ticks */}
      {[0, 0.5, 0.707, 1.0].map(v => (
        <g key={v}>
          <line x1={PL - 3} y1={my_m(v)} x2={PL} y2={my_m(v)}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text x={PL - 5} y={my_m(v) + 3.5} textAnchor="end" fontSize="7"
            fill="rgba(255,255,255,0.3)" fontFamily="monospace">{v}</text>
        </g>
      ))}
      {peakMag > 1.1 && (
        <g>
          <line x1={PL - 3} y1={my_m(peakMag)} x2={PL} y2={my_m(peakMag)}
            stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <text x={PL - 5} y={my_m(peakMag) + 3.5} textAnchor="end" fontSize="7"
            fill={curColor} fontFamily="monospace">{peakMag.toFixed(2)}</text>
        </g>
      )}

      {/* Magnitude axis label */}
      <text x={8} y={(M_TOP + M_BOT) / 2} textAnchor="middle" fontSize="8"
        fill="rgba(255,255,255,0.3)"
        transform={`rotate(-90, 8, ${(M_TOP + M_BOT) / 2})`}>|H(f)|</text>

      {/* Panel separator */}
      <line x1={PL} y1={M_BOT + 8} x2={SVW - PR} y2={M_BOT + 8}
        stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* ── PHASE PANEL ── */}

      {/* Phase reference lines */}
      {phaseRefs.map(deg => (
        <g key={deg}>
          <line x1={PL} y1={my_p(deg)} x2={SVW - PR} y2={my_p(deg)}
            stroke="rgba(255,255,255,0.07)" strokeDasharray="3,3" strokeWidth="1" />
          <text x={PL - 5} y={my_p(deg) + 3.5} textAnchor="end" fontSize="7"
            fill="rgba(255,255,255,0.25)" fontFamily="monospace">{deg}°</text>
        </g>
      ))}
      {/* Zero-degree line */}
      <line x1={PL} y1={my_p(0)} x2={SVW - PR} y2={my_p(0)}
        stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <text x={PL - 5} y={my_p(0) + 3.5} textAnchor="end" fontSize="7"
        fill="rgba(255,255,255,0.3)" fontFamily="monospace">0°</text>

      {/* Phase curve */}
      <polyline points={phasePts.join(' ')} fill="none" stroke={curColor}
        strokeWidth="2" strokeLinejoin="round" opacity="0.85" />

      {/* Lab measurement freq markers (phase) */}
      {LAB_FREQS.map(f => {
        const { phaseDeg } = compute(2 * Math.PI * f, R1, C1, R2, C2)
        return (
          <circle key={f} cx={mxF(f)} cy={my_p(phaseDeg)} r={2.5}
            fill={curColor} opacity="0.7" />
        )
      })}

      {/* Phase axis label */}
      <text x={8} y={(P_TOP + P_BOT) / 2} textAnchor="middle" fontSize="8"
        fill="rgba(255,255,255,0.3)"
        transform={`rotate(-90, 8, ${(P_TOP + P_BOT) / 2})`}>Phase</text>

      {/* ── SHARED AXES & X-LABELS ── */}

      {/* Magnitude Y-axis spine */}
      <line x1={PL} y1={M_TOP} x2={PL} y2={M_BOT} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <line x1={PL} y1={M_BOT} x2={SVW - PR} y2={M_BOT} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* Phase Y-axis spine */}
      <line x1={PL} y1={P_TOP} x2={PL} y2={P_BOT} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <line x1={PL} y1={P_BOT} x2={SVW - PR} y2={P_BOT} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

      {/* X-axis decade ticks (below phase panel) */}
      {xDecades.map(f => (
        <g key={f}>
          <line x1={mxF(f)} y1={P_BOT} x2={mxF(f)} y2={P_BOT + 4}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1={mxF(f)} y1={M_TOP} x2={mxF(f)} y2={M_BOT}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <line x1={mxF(f)} y1={P_TOP} x2={mxF(f)} y2={P_BOT}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <text x={mxF(f)} y={P_BOT + 14} textAnchor="middle" fontSize="8"
            fill="rgba(255,255,255,0.35)" fontFamily="monospace">
            {f >= 1000 ? f / 1000 + 'k' : f}
          </text>
        </g>
      ))}

      <text x={PL + PIW / 2} y={SVH - 1} textAnchor="middle" fontSize="8"
        fill="rgba(255,255,255,0.3)">Frequency (Hz) — log scale</text>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════
   TAB 1 — LOW-PASS FILTER
═══════════════════════════════════════════════════ */
function LPTab() {
  // Defaults: Q = 1.5, ωo ≈ 3333 rad/s (fc ≈ 530 Hz)
  const [R1_k, setR1] = useState(10)   // kΩ
  const [R2_k, setR2] = useState(10)   // kΩ
  const [C1_n, setC1] = useState(90)   // nF
  const [C2_n, setC2] = useState(10)   // nF

  const R1 = R1_k * 1e3,  R2 = R2_k * 1e3
  const C1 = C1_n * 1e-9, C2 = C2_n * 1e-9

  const omega0  = 1 / Math.sqrt(R1 * C1 * R2 * C2)
  const alphaLP = (R1 + R2) / (2 * R1 * C1 * R2)
  const Q       = isFinite(omega0) ? omega0 / (2 * alphaLP) : NaN
  const fc      = findCutoffLP(R1, C1, R2, C2)

  // Peak magnitude (if underdamped)
  const qSq  = Q * Q
  const hasPeak = qSq > 0.5
  const peakMag = hasPeak ? Q / Math.sqrt(1 - 1 / (4 * qSq)) : 1

  return (
    <div className="lab9-sim">
      <div className="lab9-two-col">
        <div className="lab9-panel">
          <div className="lab9-panel-title">Component Values</div>
          <div className="calc-controls">
            <CalcSlider label="R₁" value={R1_k} onChange={setR1}
              min={1} max={100} step={1} unit=" kΩ" color={C_BLUE} />
            <CalcSlider label="R₂" value={R2_k} onChange={setR2}
              min={1} max={100} step={1} unit=" kΩ" color={C_BLUE} />
            <CalcSlider label="C₁" value={C1_n} onChange={setC1}
              min={1} max={1000} step={1} unit=" nF" color={C_TEAL} />
            <CalcSlider label="C₂" value={C2_n} onChange={setC2}
              min={1} max={1000} step={1} unit=" nF" color={C_TEAL} />
          </div>
          <div className="lab9-panel-title" style={{ marginTop: 16 }}>Circuit Parameters</div>
          <div className="lab9-stat-grid">
            <StatRow label="ωo (resonant)"    value={isFinite(omega0) ? fv(omega0, 0) + ' rad/s' : '---'} color={C_TEAL}  />
            <StatRow label="fo"               value={fHz(omega0 / (2 * Math.PI))}                         color={C_TEAL}  />
            <StatRow label="Q-factor"         value={isFinite(Q) ? Q.toFixed(3) : '---'}                 color={C_AMBER} />
            <StatRow label="fc (−3 dB)"       value={fc ? fHz(fc) : '---'}                               color={C_BLUE}  />
            {hasPeak && (
              <StatRow label="Peak |H|"       value={isFinite(peakMag) ? peakMag.toFixed(3) : '---'}     color={C_AMBER} />
            )}
          </div>
          <div className="lab9-note-chip">
            ● = 13 lab measurement points
          </div>
        </div>

        <div className="lab9-panel">
          <div className="lab9-panel-title">Bode Plot — Low-Pass</div>
          <BodeSVG type="lp" R1={R1} C1={C1} R2={R2} C2={C2} />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   TAB 2 — HIGH-PASS FILTER
═══════════════════════════════════════════════════ */
function HPTab() {
  // Same component defaults (lab uses same physical components)
  const [R1_k, setR1] = useState(10)
  const [R2_k, setR2] = useState(10)
  const [C1_n, setC1] = useState(90)
  const [C2_n, setC2] = useState(10)

  const R1 = R1_k * 1e3,  R2 = R2_k * 1e3
  const C1 = C1_n * 1e-9, C2 = C2_n * 1e-9

  const omega0  = 1 / Math.sqrt(R1 * C1 * R2 * C2)
  const alphaHP = (C1 + C2) / (2 * R2 * C1 * C2)
  const Q       = isFinite(omega0) ? omega0 / (2 * alphaHP) : NaN
  const fc      = findCutoffHP(R1, C1, R2, C2)

  return (
    <div className="lab9-sim">
      <div className="lab9-two-col">
        <div className="lab9-panel">
          <div className="lab9-panel-title">Component Values</div>
          <div className="calc-controls">
            <CalcSlider label="R₁" value={R1_k} onChange={setR1}
              min={1} max={100} step={1} unit=" kΩ" color={C_AMBER} />
            <CalcSlider label="R₂" value={R2_k} onChange={setR2}
              min={1} max={100} step={1} unit=" kΩ" color={C_AMBER} />
            <CalcSlider label="C₁" value={C1_n} onChange={setC1}
              min={1} max={1000} step={1} unit=" nF" color={C_TEAL} />
            <CalcSlider label="C₂" value={C2_n} onChange={setC2}
              min={1} max={1000} step={1} unit=" nF" color={C_TEAL} />
          </div>
          <div className="lab9-panel-title" style={{ marginTop: 16 }}>Circuit Parameters</div>
          <div className="lab9-stat-grid">
            <StatRow label="ωo (resonant)"    value={isFinite(omega0) ? fv(omega0, 0) + ' rad/s' : '---'} color={C_TEAL}  />
            <StatRow label="fo"               value={fHz(omega0 / (2 * Math.PI))}                         color={C_TEAL}  />
            <StatRow label="Q-factor (HP)"    value={isFinite(Q) ? Q.toFixed(3) : '---'}                 color={C_AMBER} />
            <StatRow label="fc (−3 dB)"       value={fc ? fHz(fc) : '---'}                               color={C_AMBER} />
          </div>
          <div className="lab9-note-chip">
            Same R/C values as LP — only positions are swapped.
            Q changes because α_HP = (C₁+C₂)/(2R₂C₁C₂).
          </div>
          <div className="lab9-note-chip" style={{ marginTop: 6 }}>
            ● = 13 lab measurement points
          </div>
        </div>

        <div className="lab9-panel">
          <div className="lab9-panel-title">Bode Plot — High-Pass</div>
          <BodeSVG type="hp" R1={R1} C1={C1} R2={R2} C2={C2} />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   ROOT CALCULATOR COMPONENT
═══════════════════════════════════════════════════ */

const TABS = [
  { id: 'lp', label: 'Low-Pass Filter',  short: 'Magnitude & phase — Fig 9.1 topology' },
  { id: 'hp', label: 'High-Pass Filter', short: 'Magnitude & phase — Fig 9.4 topology' },
]

const styles = `
.lab9-root .calc-body {
  display: flex; flex-direction: column;
  grid-template-columns: none;
  padding: 18px 20px;
}
.lab9-root .calc-tab { min-height: 56px; }
.lab9-root .calc-tab-desc { white-space: normal; text-align: center; line-height: 1.3; }

.lab9-root { display: flex; flex-direction: column; gap: 0; }
.lab9-sim  { display: flex; flex-direction: column; gap: 0; }

.lab9-two-col {
  display: grid;
  grid-template-columns: 1fr 1.7fr;
  gap: 14px;
  align-items: start;
}
.lab9-panel {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px;
}
.lab9-panel-title {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 12px;
}
.lab9-svg {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--r-sm);
  background: #060a0c;
}
.lab9-stat-grid { display: flex; flex-direction: column; gap: 4px; }
.lab9-stat-row  {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 6px;
  border-radius: var(--r-sm);
  background: rgba(255,255,255,0.03);
}
.lab9-stat-label { font-size: 11px; color: var(--text-2); font-family: var(--mono); }
.lab9-stat-value { font-size: 12px; font-family: var(--mono); font-weight: 600; }
.lab9-note-chip  {
  margin-top: 10px;
  padding: 7px 10px;
  border-radius: var(--r-sm);
  font-size: 10px;
  font-family: var(--mono);
  background: rgba(255,255,255,0.03);
  color: var(--text-3);
  border-left: 3px solid var(--border);
  line-height: 1.5;
}
`

export function SallenKeyACCalc() {
  const [tab, setTab] = useState('lp')

  return (
    <div className="lab9-root">
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
        {tab === 'lp' && <LPTab />}
        {tab === 'hp' && <HPTab />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   labData — DASHBOARD CONTENT
═══════════════════════════════════════════════════ */

export const labData = {
  objectives: [
    'Measure the sinusoidal steady-state magnitude and phase response of a Sallen-Key 2nd order low-pass filter across 13 log-spaced frequencies from 10 Hz to 10 kHz.',
    'Apply phasor analysis and the transfer function H(ω) to predict and verify measured amplitude ratios and phase shifts.',
    'Identify the −3 dB cutoff frequency by finding where |Vout|/|Vin| = 1/√2 ≈ 0.707.',
    'Repeat all measurements for the high-pass version (Fig 9.4) obtained by exchanging resistors and capacitors, and compare the two filter responses.',
  ],

  parts: [
    {
      label:       'Task 1',
      duration:    '~50 min',
      title:       'Low-Pass Sinusoidal Response',
      description: 'Build the Sallen-Key circuit (Fig 9.1). Apply a sine wave input. ' +
        'At each of the 13 specified frequencies (10 Hz → 10 kHz), measure the input amplitude, output amplitude, and time delay between the two signals. ' +
        'Convert time delay to phase shift (φ = 2π f Δt). ' +
        'Then sweep frequency until |Vout|/|Vin| = 0.707 and record that cutoff frequency fc.',
    },
    {
      label:       'Task 2',
      duration:    '~40 min',
      title:       'High-Pass Sinusoidal Response',
      description: 'Rebuild the circuit with resistors and capacitors exchanged (Fig 9.4). ' +
        'Repeat the same 13-frequency measurement sweep and cutoff search. ' +
        'Note that the same component values produce a different Q and different cutoff frequency in the high-pass topology. ' +
        'Show circuit to TA before leaving.',
    },
  ],

  components: [
    { name: '741 Op-Amp',             value: '—',           qty: 1          },
    { name: '¼W Resistors (> 500 Ω)', value: 'various',     qty: 'assorted' },
    { name: 'Non-polarized Capacitors', value: 'various',   qty: 'assorted' },
    { name: 'Function Generator',     value: 'sine output', qty: 1          },
    { name: 'Oscilloscope',           value: '2-channel',   qty: 1          },
    { name: 'Dual-rail Power Supply', value: '±5 V DC',     qty: 1          },
  ],

  equations: [
    {
      title:    'LP Transfer Function',
      subtitle: 'Input-to-output ratio in phasor domain — Sallen-Key Fig 9.1',
      tex:      'H_{LP}(\\omega) = \\dfrac{1}{1 + j\\omega(R_1+R_2)C_2 - \\omega^2 R_1 C_1 R_2 C_2}',
      color:    'rgba(100,160,240,0.92)',
      vars: [
        { sym: '\\omega', def: 'Angular frequency (rad/s) = 2πf' },
        { sym: 'R_1,R_2,C_1,C_2', def: 'Sallen-Key component values' },
      ],
      example:  '|H_{LP}(0)| = 1,\\quad |H_{LP}(\\infty)| = 0',
    },
    {
      title:    'LP Magnitude Response',
      subtitle: 'Amplitude ratio output/input as a function of frequency',
      tex:      '|H_{LP}(\\omega)| = \\dfrac{1}{\\sqrt{(1-\\omega^2 R_1C_1R_2C_2)^2 + (\\omega(R_1+R_2)C_2)^2}}',
      color:    'rgba(100,210,180,0.92)',
      vars: [
        { sym: '\\omega_o', def: 'Natural frequency = 1/√(R₁C₁R₂C₂)' },
      ],
      example:  '\\omega=\\omega_o \\Rightarrow |H_{LP}|=Q',
    },
    {
      title:    'LP Phase Response',
      subtitle: 'Phase shift from input to output',
      tex:      '\\angle H_{LP}(\\omega) = -\\tan^{-1}\\!\\left(\\dfrac{\\omega(R_1+R_2)C_2}{1 - \\omega^2 R_1C_1R_2C_2}\\right)',
      color:    'rgba(240,180,60,0.95)',
      vars: [
        { sym: '\\angle H', def: 'Phase shift (0° at DC, −180° at high frequency)' },
      ],
      example:  '\\omega=\\omega_o \\Rightarrow \\angle H_{LP}=-90°',
    },
    {
      title:    'HP Transfer Function',
      subtitle: 'Fig 9.4 — R ↔ C swapped; same ωo, different Q and cutoff',
      tex:      'H_{HP}(\\omega) = \\dfrac{-\\omega^2 R_1R_2C_1C_2}{1 + j\\omega R_1(C_1+C_2) - \\omega^2 R_1R_2C_1C_2}',
      color:    'rgba(240,180,60,0.95)',
      vars: [
        { sym: 'Q_{HP}', def: 'ωo/(2α), where α_HP = (C₁+C₂)/(2R₂C₁C₂)' },
      ],
      example:  '|H_{HP}(0)| = 0,\\quad |H_{HP}(\\infty)| = 1',
    },
  ],

  notes: [
    'Design target for Task 1: Q = 3/2 and ωo = 1000π rad/s (fo ≈ 500 Hz). With equal resistors R₁ = R₂ = R: choose C₁ = 9C₂ (e.g. 90 nF + 10 nF) and R = 1/(2Q·ωo·C₂) ≈ 10.6 kΩ.',
    'Avoid resistors smaller than a few hundred ohms — very low resistance can cause op-amp instability due to excessive output current.',
    'Measure phase by reading the time delay Δt between corresponding zero-crossings on the oscilloscope, then compute φ = 360°·f·Δt (or 2π·f·Δt in radians).',
    'The 13 measurement frequencies are log-spaced (each is roughly 1.78× the previous). Plotting on a logarithmic frequency axis reveals the filter shape symmetrically.',
    'For the high-pass circuit, the same physical R and C components are used but their positions are swapped. ωo is unchanged, but Q and fc are different.',
    'At the cutoff frequency fc, the output power is exactly half the input power, and the amplitude ratio is 1/√2 ≈ 0.707 (the "−3 dB" point).',
  ],

  images: [
    {
      src:     new URL('./images/schematic.png', import.meta.url).href,
      caption: 'Lab 9 Schematics — Sallen-Key 2nd order low-pass filter (Fig 9.1), phasor-domain equivalent (Fig 9.2), and high-pass version with R ↔ C swapped (Fig 9.4)',
      alt:     'ECEN 214 Lab 9 schematics: Sallen-Key low-pass (R₁,R₂ series; C₁,C₂ shunt) and high-pass (C₁,C₂ series; R₁,R₂ shunt) topologies',
    },
  ],

  calculatorTitle: '2nd Order Filter Analyser',
  calculatorIcon:  '≈',
}
