import { useState } from 'react'

// ── ECEN 214 Lab 4 — Op-Amp Electronic Security System (Part 1) ───────────────
// Exports labData (content) and SecuritySystemCalc (calculator).
// Layout is owned by WidgetShell — no JSX layout lives here.

/* ── Semantic accent colors (kept as instrument-readout indicators) ── */
const C_AMBER = 'rgba(240,180,60,0.95)'
const C_TEAL  = 'rgba(100,210,180,0.92)'
const C_RED   = 'rgba(220,80,80,0.92)'
const C_GREEN = 'rgba(80,210,130,0.92)'
const C_BLUE  = 'rgba(100,160,240,0.92)'
const C_MUTED = 'rgba(255,255,255,0.28)'

/* ── SVG circuit diagram palette (dark-board look) ── */
const SV_BG  = '#090c0e'
const SV_PNL = '#0d1215'
const SV_BDR = '#192530'

/* ── Helpers ── */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const fv  = (v, d = 3) => isFinite(v) ? v.toFixed(d) : '---'
const fmA = v => Math.abs(v) < 0.001 ? (v * 1e6).toFixed(0) + 'µA' : (v * 1e3).toFixed(2) + 'mA'
const fkΩ = v => v >= 1000 ? (v / 1000).toFixed(1) + 'kΩ' : v.toFixed(0) + 'Ω'

/* ── Slider — uses shared calc-* CSS classes ─────────────────────────────────── */
function CalcSlider({ label, value, onChange, min, max, step = 1, unit = '', fmt: fmtFn, color = C_AMBER }) {
  return (
    <div className="calc-ctrl-group">
      <div className="calc-ctrl-row">
        <span className="calc-ctrl-name">{label}</span>
        <span className="calc-ctrl-val" style={{ color }}>
          {fmtFn ? fmtFn(value) : value + unit}
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

/* ── Big readout card ─────────────────────────────────────────────────────────── */
function Readout({ label, value, unit = 'V', color = C_AMBER, sub }) {
  return (
    <div className="lab4-readout">
      <div className="lab4-readout-label">{label}</div>
      <div className="lab4-readout-value" style={{ color, textShadow: `0 0 10px ${color}55` }}>
        {value}<span className="lab4-readout-unit">{unit}</span>
      </div>
      {sub && <div className="lab4-readout-sub">{sub}</div>}
    </div>
  )
}

/* ── Formula bar ─────────────────────────────────────────────────────────────── */
function FormulaBar({ children }) {
  return <div className="lab4-formula">{children}</div>
}

/* ── Section header ──────────────────────────────────────────────────────────── */
function SectionHead({ title, note }) {
  return (
    <div className="lab4-section-head">
      <div className="lab4-section-title">{title}</div>
      {note && <div className="lab4-section-note">{note}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB 1 — TASK 1: IR Emitter & Photodetector
═══════════════════════════════════════════════ */
function EmitterTab() {
  const [RE,    setRE]  = useState(220)
  const [RD_k,  setRD]  = useState(10)
  const [beam,  setBeam] = useState(true)
  const [Id_uA, setId]  = useState(400)
  const Vcc = 5, Vfwd = 1.2

  const IE      = (Vcc - Vfwd) / RE
  const Id_on   = Id_uA * 1e-6
  const VD_on   = Id_on * RD_k * 1e3
  const VD_curr = beam ? VD_on : 0
  const delta   = VD_on
  const safe    = IE >= 0.010 && IE <= 0.030
  const danger  = IE > 0.050
  const RE_min  = Math.ceil((Vcc - Vfwd) / 0.030)
  const RE_max  = Math.floor((Vcc - Vfwd) / 0.010)

  return (
    <div className="lab4-sim">

      {/* ── Emitter Circuit ── */}
      <div className="lab4-panel">
        <SectionHead
          title="Task 1A — Emitter Circuit  (Fig 4.10 left)"
          note="RE limits current — never connect IR emitter directly to the supply"
        />
        <FormulaBar>
          IE = (Vcc − Vfwd) / RE = ({Vcc}−{Vfwd}) / {fkΩ(RE)} ={' '}
          <span style={{ color: danger ? C_RED : safe ? C_GREEN : C_AMBER }}>{fmA(IE)}</span>
        </FormulaBar>

        <div style={{ marginBottom: 14 }}>
          <CalcSlider label="RE — current-limit resistor" value={RE} onChange={setRE}
                      min={100} max={2000} step={10} fmt={fkΩ} />
        </div>

        <div className="lab4-grid-3" style={{ marginBottom: 12 }}>
          <Readout label="Emitter current IE" value={fmA(IE)} unit=""
                   color={danger ? C_RED : safe ? C_GREEN : C_AMBER} />
          <Readout label="Safe RE range" value={`${RE_min}–${RE_max}`} unit="Ω"
                   color={C_TEAL} sub="target: 10–30 mA" />
          <Readout label="Voltage across RE" value={fv(Vcc - Vfwd, 2)} color={C_MUTED}
                   sub="constant = Vcc−Vfwd" />
        </div>

        {/* Current bar */}
        <div className="lab4-bar-wrap" style={{ height: 20 }}>
          <div style={{ position: 'absolute', top: 0, height: '100%',
                        left: (10 / 50 * 100) + '%', width: ((30 - 10) / 50 * 100) + '%',
                        background: `${C_GREEN}18`, borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                        width: clamp(IE / 0.050, 0, 1) * 100 + '%',
                        background: danger ? C_RED : safe ? C_GREEN : C_AMBER,
                        borderRadius: 3, transition: 'width .15s' }} />
          <div style={{ position: 'absolute', top: 4, left: (10 / 50 * 100 + 1) + '%',
                        fontSize: 7, color: C_GREEN, fontFamily: 'var(--mono)' }}>10</div>
          <div style={{ position: 'absolute', top: 4, left: (30 / 50 * 100 + 1) + '%',
                        fontSize: 7, color: C_MUTED, fontFamily: 'var(--mono)' }}>30</div>
          <div style={{ position: 'absolute', top: 4, right: '2%',
                        fontSize: 7, color: C_RED, fontFamily: 'var(--mono)' }}>50mA MAX</div>
        </div>

        {danger && (
          <div className="lab4-alert danger">
            ⚠ Over limit — increase RE above {Math.ceil((Vcc - Vfwd) / 0.050)}Ω
          </div>
        )}
      </div>

      {/* ── Photodetector Circuit ── */}
      <div className="lab4-panel">
        <SectionHead
          title="Task 1B — Photodetector Circuit  (Fig 4.10 right)"
          note="RD converts photocurrent to voltage. Goal: maximize ΔVD between beam states."
        />
        <FormulaBar>
          VD = ID × RD ={' '}
          <span style={{ color: C_TEAL }}>{beam ? fmA(Id_on) : '0µA'}</span> × {RD_k}kΩ ={' '}
          <span style={{ color: C_AMBER }}>{fv(VD_curr, 3)} V</span>
        </FormulaBar>

        {/* Beam toggle */}
        <div
          className="lab4-beam-toggle"
          style={{ borderColor: beam ? C_TEAL : 'var(--border)' }}
          onClick={() => setBeam(b => !b)}
        >
          <svg viewBox="0 0 150 44" width={150} height={44}>
            <circle cx={16} cy={22} r={12} fill="#0d1a14" stroke={C_TEAL} strokeWidth={1.5} />
            <text x={16} y={20} textAnchor="middle" fill={C_TEAL} fontSize={7} fontFamily="monospace">IR</text>
            <text x={16} y={30} textAnchor="middle" fill={C_TEAL} fontSize={6}>TX</text>
            {beam ? (
              <>
                <line x1={30} y1={22} x2={120} y2={22} stroke={C_TEAL} strokeWidth={2} strokeDasharray="7,4" opacity={0.75} />
                <line x1={30} y1={17} x2={85}  y2={17} stroke={C_TEAL} strokeWidth={1} strokeDasharray="4,7" opacity={0.3} />
                <line x1={30} y1={27} x2={85}  y2={27} stroke={C_TEAL} strokeWidth={1} strokeDasharray="4,7" opacity={0.3} />
              </>
            ) : (
              <>
                <line x1={30} y1={22} x2={68} y2={22} stroke={C_TEAL} strokeWidth={2} strokeDasharray="4,4" opacity={0.35} />
                <rect x={65} y={9} width={8} height={26} rx={1} fill={C_RED} opacity={0.85} />
              </>
            )}
            <circle cx={134} cy={22} r={12} fill="#0d1014" stroke={beam ? C_TEAL : SV_BDR} strokeWidth={1.5} />
            <text x={134} y={20} textAnchor="middle" fill={beam ? C_TEAL : C_MUTED} fontSize={7} fontFamily="monospace">PD</text>
            <text x={134} y={30} textAnchor="middle" fill={beam ? C_TEAL : C_MUTED} fontSize={6}>RX</text>
          </svg>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                          borderRadius: 20, background: 'var(--surface)', border: `1px solid ${beam ? C_TEAL : C_RED}`,
                          boxShadow: `0 0 8px ${beam ? C_TEAL : C_RED}44` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: beam ? C_TEAL : C_RED,
                            boxShadow: `0 0 5px ${beam ? C_TEAL : C_RED}` }} />
              <span style={{ fontSize: 11, color: beam ? C_TEAL : C_RED, fontFamily: 'var(--mono)', fontWeight: 'bold' }}>
                {beam ? 'BEAM CLEAR' : 'BEAM BLOCKED'}
              </span>
            </div>
            <div className="lab4-beam-hint">click to toggle beam state</div>
          </div>
        </div>

        <div className="lab4-grid-2" style={{ marginBottom: 14 }}>
          <CalcSlider label="RD — detector load" value={RD_k} onChange={setRD} min={1} max={100} step={1} unit="kΩ" color={C_TEAL} />
          <CalcSlider label="ID when beam is ON" value={Id_uA} onChange={setId} min={50} max={800} step={25} unit="µA" />
        </div>

        <div className="lab4-grid-3" style={{ marginBottom: 12 }}>
          <Readout label="VD now" value={fv(VD_curr, 3)} color={beam ? C_GREEN : C_RED}
                   sub={beam ? 'beam ON' : 'beam OFF → 0V'} />
          <Readout label="VD beam ON" value={fv(VD_on, 3)} color={C_MUTED} />
          <Readout label="ΔVD (swing)" value={fv(delta, 3)}
                   color={delta > 1 ? C_GREEN : delta > 0.3 ? C_AMBER : C_RED}
                   sub={delta > 1 ? '✓ strong signal' : delta > 0.3 ? 'ok — amplify it' : '⚠ too weak'} />
        </div>

        <div className="lab4-bar-wrap" style={{ marginBottom: 8 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                        width: clamp(delta / 5, 0, 1) * 100 + '%',
                        background: delta > 1 ? C_GREEN : delta > 0.3 ? C_AMBER : C_RED,
                        borderRadius: 3, transition: 'width .15s' }} />
          <div style={{ position: 'absolute', top: 3, right: '2%', fontSize: 7, color: C_MUTED, fontFamily: 'var(--mono)' }}>5V</div>
        </div>

        <div className="lab4-note">
          Max RD before VD clips: {fv(5 / (Id_on * 1e3), 1)}kΩ&nbsp;&nbsp;
          {VD_on > 5
            ? <span style={{ color: C_RED }}>⚠ Currently clipping — reduce RD below {Math.floor(5 / (Id_on * 1e3))}kΩ</span>
            : <span style={{ color: C_TEAL }}>✓ VD_on = {fv(VD_on, 3)}V &lt; 5V</span>
          }
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB 3 — TASK 2: Signal Amplifier
═══════════════════════════════════════════════ */
function AmpTab() {
  const [R1,   setR1]  = useState(10)
  const [R2,   setR2]  = useState(47)
  const [Vin,  setVin] = useState(0.5)
  const [mode, setMode] = useState('inv')
  const Vcc = 5

  const vsat    = Vcc - 1.5
  const gain    = mode === 'inv' ? -(R2 / R1) : (1 + R2 / R1)
  const vout_l  = gain * Vin
  const vout    = clamp(vout_l, -vsat, vsat)
  const satd    = Math.abs(vout_l) > vsat
  const vin_sat = vsat / Math.abs(gain)

  const W = 300, H = 150
  const toX = v => ((v + Vcc) / (2 * Vcc)) * W
  const toY = v => ((vsat - clamp(v, -vsat, vsat)) / (2 * vsat)) * H
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const xv = -Vcc + (2 * Vcc) * (i / 120)
    pts.push(`${toX(xv)},${toY(gain * xv)}`)
  }

  return (
    <div className="lab4-panel">
      <SectionHead
        title="Task 2 — Signal Voltage Amplifier  (Fig 4.13)"
        note="Amplify detector output so beam-on and beam-off voltages differ enough to drive the comparator"
      />

      {/* Mode toggle */}
      <div className="lab4-mode-toggle">
        {[['inv', 'Inverting'], ['noninv', 'Non-Inverting']].map(([m, l]) => (
          <button key={m} className={`lab4-mode-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
            {l}
          </button>
        ))}
      </div>

      <FormulaBar>
        {mode === 'inv'
          ? `Gain = −R2/R1 = −${R2}/${R1} = ${fv(gain, 2)}   Vout = ${fv(gain, 2)} × ${Vin}V = ${fv(vout_l, 3)}V`
          : `Gain = 1+R2/R1 = 1+${R2}/${R1} = ${fv(gain, 2)}   Vout = ${fv(gain, 2)} × ${Vin}V = ${fv(vout_l, 3)}V`
        }
        {satd && <span style={{ color: C_RED }}>  → clipped to ±{vsat.toFixed(1)}V  ⚠</span>}
      </FormulaBar>

      <div className="lab4-grid-2" style={{ marginBottom: 16 }}>
        <div className="lab4-sliders">
          <CalcSlider label="R1" value={R1} onChange={setR1} min={1} max={100} step={1} unit="kΩ" />
          <CalcSlider label="R2" value={R2} onChange={setR2} min={1} max={200} step={1} unit="kΩ" color={C_TEAL} />
          <CalcSlider label="Vin" value={Vin} onChange={setVin} min={-Vcc} max={Vcc} step={0.05} unit="V" color={C_GREEN} />
        </div>
        <div className="lab4-sliders">
          <Readout label="Gain" value={fv(gain, 2)} unit="×" color={C_TEAL} />
          <Readout label="Vout" value={fv(vout, 3)} color={satd ? C_RED : C_AMBER} />
          <Readout label="Saturates when |Vin| >" value={fv(vin_sat, 3)} color={C_MUTED} />
        </div>
      </div>

      <div className="lab4-bar-label">Transfer curve — green dot = operating point</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', maxWidth: W, display: 'block', background: SV_BG,
                 borderRadius: 5, border: `1px solid ${SV_BDR}`, margin: '0 auto' }}
      >
        <line x1={0} y1={toY(vsat)}  x2={W} y2={toY(vsat)}  stroke={C_RED} strokeWidth={0.8} strokeDasharray="4,4" />
        <line x1={0} y1={toY(-vsat)} x2={W} y2={toY(-vsat)} stroke={C_RED} strokeWidth={0.8} strokeDasharray="4,4" />
        <line x1={toX(0)} y1={0} x2={toX(0)} y2={H} stroke={SV_BDR} strokeWidth={1} />
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={SV_BDR} strokeWidth={1} />
        <polyline points={pts.join(' ')} fill="none" stroke={C_AMBER} strokeWidth={2} />
        <circle cx={toX(Vin)} cy={toY(vout)} r={5} fill={C_GREEN}
                style={{ filter: `drop-shadow(0 0 4px ${C_GREEN})` }} />
        <text x={4} y={12} fill={C_RED} fontSize={7} fontFamily="monospace">+Vsat</text>
        <text x={4} y={H - 4} fill={C_RED} fontSize={7} fontFamily="monospace">−Vsat</text>
      </svg>

      {mode === 'noninv' && (
        <div className="lab4-note" style={{ marginTop: 12, borderLeft: `2px solid ${C_TEAL}55` }}>
          ✓ Non-inverting: high input impedance couples well with photodetector. Output polarity matches input.
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB 4 — TASK 3: Voltage Comparator
═══════════════════════════════════════════════ */
function ComparatorTab() {
  const [R1_k, setR1] = useState(1.0)
  const [R2_k, setR2] = useState(2.2)
  const [Vi,   setVi] = useState(2.0)
  const Vcc = 5

  const Vr     = Vcc * (R2_k / (R1_k + R2_k))
  const isHigh = Vi > Vr
  const margin = Vi - Vr

  const W = 300, H = 120
  const toX = v => (v / Vcc) * W
  const toY = v => ((Vcc - v) / Vcc) * H

  return (
    <div className="lab4-panel">
      <SectionHead
        title="Task 3 — Voltage Comparator  (LM392, Fig 4.14)"
        note="R1/R2 voltage divider sets threshold Vr. Comparator output switches when Vi crosses Vr."
      />
      <FormulaBar>
        Vr = 5V × R2/(R1+R2) = {fv(Vr, 4)}V&nbsp;&nbsp;&nbsp;
        Vi = {Vi}V&nbsp;&nbsp;&nbsp;
        <span style={{ color: isHigh ? C_GREEN : C_RED }}>
          {Vi} {isHigh ? '>' : '<'} {fv(Vr, 4)}V → Output {isHigh ? 'HIGH (+5V)' : 'LOW (0V)'}
        </span>
      </FormulaBar>

      <div className="lab4-grid-2" style={{ marginBottom: 16 }}>
        <div className="lab4-sliders">
          <CalcSlider label="R1 — top (to +5V)" value={R1_k} onChange={setR1} min={0.5} max={10} step={0.1} unit="kΩ" />
          <CalcSlider label="R2 — bottom (to GND)" value={R2_k} onChange={setR2} min={0.5} max={10} step={0.1} unit="kΩ" color={C_TEAL} />
          <CalcSlider label="Vi — signal input" value={Vi} onChange={setVi} min={0} max={Vcc} step={0.05} unit="V" color={C_GREEN} />
        </div>
        <div className="lab4-sliders">
          <Readout label="Reference Vr" value={fv(Vr, 4)} color={C_TEAL} />
          <Readout label="Margin (Vi − Vr)" value={(margin >= 0 ? '+' : '') + fv(margin, 3)}
                   color={Math.abs(margin) < 0.1 ? C_AMBER : isHigh ? C_GREEN : C_RED} />
          <div className="lab4-readout" style={{ borderColor: isHigh ? C_GREEN : C_RED,
                                                  boxShadow: `0 0 12px ${isHigh ? C_GREEN : C_RED}33` }}>
            <div className="lab4-readout-label">Output Vo</div>
            <div className="lab4-readout-value" style={{ color: isHigh ? C_GREEN : C_RED,
                                                          textShadow: `0 0 14px ${isHigh ? C_GREEN : C_RED}` }}>
              {isHigh ? '+5V  HIGH' : '0V   LOW'}
            </div>
            <div className="lab4-readout-sub">
              {isHigh ? 'open-collector → pulled to +5V via 10kΩ' : 'output tied to GND'}
            </div>
          </div>
        </div>
      </div>

      <div className="lab4-bar-label">Vo vs Vi — move Vi slider across the threshold</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', maxWidth: W, display: 'block', background: SV_BG,
                 borderRadius: 5, border: `1px solid ${SV_BDR}`, margin: '0 auto 12px' }}
      >
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={SV_BDR} strokeWidth={0.8} />
        <polyline
          points={`0,${toY(0)} ${toX(Vr)},${toY(0)} ${toX(Vr)},${toY(Vcc)} ${W},${toY(Vcc)}`}
          fill="none" stroke={C_AMBER} strokeWidth={2}
        />
        <line x1={toX(Vr)} y1={0} x2={toX(Vr)} y2={H} stroke={C_BLUE} strokeWidth={1} strokeDasharray="4,3" />
        <text x={toX(Vr) + 3} y={12} fill={C_BLUE} fontSize={8} fontFamily="monospace">Vr={fv(Vr, 3)}V</text>
        <circle cx={toX(Vi)} cy={toY(isHigh ? Vcc : 0)} r={5} fill={C_GREEN}
                style={{ filter: `drop-shadow(0 0 5px ${C_GREEN})` }} />
        <text x={4} y={14} fill={C_MUTED} fontSize={7} fontFamily="monospace">+5V</text>
        <text x={4} y={H - 4} fill={C_MUTED} fontSize={7} fontFamily="monospace">0V</text>
        <text x={W - 22} y={H - 4} fill={C_MUTED} fontSize={7} fontFamily="monospace">+5V</text>
      </svg>

      <div className="lab4-note">
        Lab tip: set Vr between your amplifier's beam-ON and beam-OFF output voltages.
        Current margin = {fv(Math.abs(margin), 3)}V&nbsp;&nbsp;
        {Math.abs(margin) > 0.5
          ? <span style={{ color: C_TEAL }}>✓ comfortable headroom</span>
          : <span style={{ color: C_AMBER }}>⚠ narrow — choose a Vr further from Vi</span>
        }
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   LAB-4-SPECIFIC STYLES
═══════════════════════════════════════════════ */
const styles = `
.lab4-root .calc-body {
  display: flex; flex-direction: column;
  grid-template-columns: none;
  padding: 18px 20px;
}
.lab4-root .calc-tab { min-height: 56px; }
.lab4-root .calc-tab-desc { white-space: normal; text-align: center; line-height: 1.3; }

/* ── Layout ── */
.lab4-sim { display: flex; flex-direction: column; gap: 20px; }
.lab4-panel {
  background: var(--bg-3); border: 1px solid var(--border);
  border-radius: var(--r); padding: 20px;
}
.lab4-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.lab4-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.lab4-sliders { display: flex; flex-direction: column; gap: 10px; }

/* ── Section header ── */
.lab4-section-head {
  border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 16px;
}
.lab4-section-title {
  font-size: 13px; color: var(--text); font-family: var(--mono); font-weight: bold;
}
.lab4-section-note {
  font-size: 9px; color: var(--text-3); font-family: var(--mono); margin-top: 3px;
}

/* ── Formula bar ── */
.lab4-formula {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 8px 14px;
  font-family: var(--mono); font-size: 11px; color: rgba(240,180,60,0.9);
  letter-spacing: 0.5px; margin-bottom: 12px; line-height: 1.6;
}

/* ── Readout cards ── */
.lab4-readout {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 12px 16px;
}
.lab4-readout-label {
  font-size: 8px; color: var(--text-3); letter-spacing: 2px;
  text-transform: uppercase; font-family: var(--mono); margin-bottom: 3px;
}
.lab4-readout-value {
  font-size: 22px; font-family: var(--mono); font-weight: bold; letter-spacing: 1px;
}
.lab4-readout-unit { font-size: 11px; opacity: 0.6; margin-left: 2px; }
.lab4-readout-sub { font-size: 9px; color: var(--text-3); font-family: var(--mono); margin-top: 3px; }

/* ── Bar / threshold indicator ── */
.lab4-bar-label {
  font-size: 9px; color: var(--text-3); letter-spacing: 2px; text-transform: uppercase;
  font-family: var(--mono); margin-bottom: 6px;
}
.lab4-bar-wrap {
  position: relative; height: 24px; background: var(--surface);
  border-radius: 3px; border: 1px solid var(--border); margin-bottom: 10px;
  overflow: hidden;
}

/* ── Comparator state chips (Prelab B) ── */
.lab4-comp-state-card {
  padding: 8px 10px; background: var(--surface);
  border-radius: var(--r-sm); border: 1px solid var(--border);
  font-size: 10px; color: var(--text-3); font-family: var(--mono);
}

/* ── Alert banners ── */
.lab4-alert {
  margin-top: 10px; padding: 8px 12px;
  border-radius: var(--r-sm); font-size: 10px; font-family: var(--mono);
}
.lab4-alert.danger {
  background: rgba(220,80,80,0.08); border: 1px solid rgba(220,80,80,0.28);
  color: rgba(220,80,80,0.92);
}
.lab4-alert.warn {
  background: rgba(240,180,60,0.08); border: 1px solid rgba(240,180,60,0.28);
  color: rgba(240,180,60,0.92);
}

/* ── Note bar ── */
.lab4-note {
  font-size: 10px; color: var(--text-3); font-family: var(--mono);
  padding: 8px 12px; background: var(--surface);
  border-radius: var(--r-sm); border: 1px solid var(--border); line-height: 1.6;
}

/* ── Beam toggle ── */
.lab4-beam-toggle {
  display: flex; align-items: center; gap: 16px; margin-bottom: 16px;
  padding: 12px 16px; background: var(--surface); border-radius: var(--r-sm);
  border: 1px solid var(--border); cursor: pointer; transition: border-color 0.2s;
}
.lab4-beam-hint { font-size: 9px; color: var(--text-3); font-family: var(--mono); margin-top: 5px; }

/* ── Mode toggle (Amp tab) ── */
.lab4-mode-toggle {
  display: flex; gap: 0; margin-bottom: 14px;
  border-radius: var(--r-sm); overflow: hidden; border: 1px solid var(--border);
  width: fit-content;
}
.lab4-mode-btn {
  padding: 7px 18px; border: none; cursor: pointer;
  font-size: 10px; font-family: var(--mono);
  background: var(--surface); color: var(--text-3); transition: all 0.15s;
}
.lab4-mode-btn:not(:last-child) { border-right: 1px solid var(--border); }
.lab4-mode-btn.active { background: rgba(100,210,180,0.1); color: rgba(100,210,180,0.95); }
`

/* ═══════════════════════════════════════════════
   CALCULATOR WIDGET
═══════════════════════════════════════════════ */
const TABS = [
  { id: 'ir',     label: 'Task 1 · IR',    short: 'Emitter & photodetector circuits' },
  { id: 'amp',    label: 'Task 2 · Amp',   short: 'Signal voltage amplifier' },
  { id: 'cmp',    label: 'Task 3 · Comp',  short: 'Voltage comparator' },
]

export function SecuritySystemCalc() {
  const [tab, setTab] = useState('ir')
  return (
    <div className="lab4-root">
      <style>{styles}</style>

      <div className="calc-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`calc-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="calc-tab-id">{t.label}</span>
            <span className="calc-tab-desc">{t.short}</span>
          </button>
        ))}
      </div>

      <div className="calc-body">
        {tab === 'ir'     && <EmitterTab />}
        {tab === 'amp'    && <AmpTab />}
        {tab === 'cmp'    && <ComparatorTab />}
      </div>
    </div>
  )
}

// ── Lab content data ──────────────────────────────────────────────────────────
export const labData = {

  objectives: [
    'Design and analyze a current-to-voltage (I→V) converter using an LM741 op-amp, and find the feedback resistor R that produces a desired output voltage for a given photodetector current.',
    'Build and test the IR emitter and photodetector circuits, selecting resistor values that keep the emitter current in a safe range (10–30 mA) and maximize the voltage swing at the detector output.',
    'Design a signal amplifier in both inverting and non-inverting configurations to boost the photodetector output to a level suitable for driving the comparator.',
    'Use an LM392 voltage comparator with a resistor-divider reference to create a circuit that switches HIGH or LOW based on whether the IR beam is clear or interrupted.',
    'Verify all designs in SPICE before building, and compare simulation results with bench measurements.',
  ],

  parts: [
    {
      label: 'Prelab',
      duration: '~45 min',
      title: 'Hand calculations + SPICE simulations',
      description: 'Solve for Vo as a function of R and Id in the I→V circuit (Fig 4.6). Find R when Id=400µA and Vo=−1.6V. Then calculate Vr and the comparator threshold Vi for the Fig 4.7 circuit. Simulate both in SPICE.',
    },
    {
      label: 'Task 1',
      duration: '~30 min',
      title: 'IR Emitter & Photodetector circuits (Fig 4.10)',
      description: 'Build the IR emitter with a series resistor RE to limit current to 10–30 mA. Build the photodetector with load resistor RD. Measure VD with the beam clear and blocked. Record ΔVD.',
    },
    {
      label: 'Task 2',
      duration: '~25 min',
      title: 'Signal Voltage Amplifier (Fig 4.13)',
      description: 'Build the inverting amplifier configuration first (Fig 4.13a): choose R1 and R2 for a gain that clearly separates beam-on and beam-off levels without saturating the op-amp. Plot Vout vs. Vin and verify the gain. Then rebuild in the non-inverting configuration (Fig 4.13b) with similar gain, and compare how the output polarity and coupling to the comparator differ.',
    },
    {
      label: 'Task 3',
      duration: '~20 min',
      title: 'Voltage Comparator (LM392, Fig 4.14)',
      description: 'Using the amplifier output levels measured in Task 2, choose R1/R2 so that Vr falls midway between beam-on and beam-off. Verify the comparator switches cleanly: HIGH when beam is clear, LOW when blocked. Record Vr, both amplifier output levels, and the switching margin.',
    },
  ],

  components: [
    { name: 'LM741CN op-amp (DIP-8)',          value: '±5V supply',               qty: 2 },
    { name: 'LM392 comparator (or LM319N)',    value: '±5V supply',               qty: 1 },
    { name: 'IR emitter LED',                  value: 'Vf ≈ 1.2V',                qty: 1 },
    { name: 'IR detector / photodiode',        value: 'Id ≈ 400µA typical',       qty: 1 },
    { name: 'Resistor — emitter series (RE)',  value: 'chosen to set 10–30 mA, 1/4 W',   qty: 1 },
    { name: 'Resistor — detector load (RD)',   value: 'chosen for max ΔVD swing, 1/4 W', qty: 1 },
    { name: 'Resistors — voltage divider',     value: '1 kΩ and 2.2 kΩ, 1/4 W',         qty: 2 },
    { name: 'Resistors — amplifier R1/R2',     value: 'chosen for desired gain, 1/4 W',   qty: 2 },
    { name: 'Resistor — pull-up',              value: '10 kΩ, 1/4 W',                     qty: 1 },
    { name: '±5V DC bench supply',             value: 'dual-rail',                qty: 1 },
    { name: 'Digital multimeter (DMM)',         value: 'voltage / resistance',     qty: 1 },
    { name: 'Breadboard + 24 AWG jumpers',     value: 'assorted colors',          qty: 1 },
  ],

  equations: [
    {
      title: 'I→V Converter',
      subtitle: 'Op-amp transimpedance: output voltage proportional to photodetector current',
      tex: 'V_o = -I_d \\times R_f',
      color: 'rgba(100,210,180,0.75)',
      vars: [
        { sym: 'V_o',  def: 'Output voltage of the op-amp (negative of input current × Rf)' },
        { sym: 'I_d',  def: 'Photodetector current flowing into the virtual ground at the − input' },
        { sym: 'R_f',  def: 'Feedback resistor connecting output back to the − input' },
      ],
      example: 'I_d=400\\mu A,\\ R_f=4\\text{k}\\Omega \\Rightarrow V_o = -400\\mu A \\times 4\\text{k}\\Omega = -1.6\\text{ V}',
    },
    {
      title: 'Reference Voltage Divider',
      subtitle: 'Sets the comparator switching threshold',
      tex: 'V_r = V_{cc} \\cdot \\dfrac{R_2}{R_1 + R_2}',
      color: 'rgba(240,180,60,0.82)',
      vars: [
        { sym: 'V_r',  def: 'Reference voltage at comparator − input' },
        { sym: 'R_1',  def: 'Top resistor (connected to +Vcc)' },
        { sym: 'R_2',  def: 'Bottom resistor (connected to GND)' },
      ],
      example: 'V_{cc}=5\\text{V},\\ R_1=1\\text{k}\\Omega,\\ R_2=2.2\\text{k}\\Omega \\Rightarrow V_r = 5 \\times \\frac{2.2}{3.2} \\approx 3.44\\text{ V}',
    },
    {
      title: 'Inverting Amplifier Gain',
      subtitle: 'Output is inverted and scaled by R2/R1',
      tex: 'A_v = -\\dfrac{R_2}{R_1},\\quad V_{out} = A_v \\cdot V_{in}',
      color: 'rgba(106,169,255,0.82)',
      vars: [
        { sym: 'A_v',   def: 'Closed-loop voltage gain (negative = inverting)' },
        { sym: 'R_1',   def: 'Input resistor (from Vin to virtual ground)' },
        { sym: 'R_2',   def: 'Feedback resistor (from output to virtual ground)' },
      ],
      example: 'R_1=10\\text{k}\\Omega,\\ R_2=47\\text{k}\\Omega \\Rightarrow A_v = -4.7,\\ V_{out}=-4.7\\times 0.5=-2.35\\text{ V}',
    },
    {
      title: 'Non-Inverting Amplifier Gain',
      subtitle: 'Output has same polarity as input, gain ≥ 1',
      tex: 'A_v = 1 + \\dfrac{R_2}{R_1}',
      color: 'rgba(255,120,120,0.78)',
      vars: [
        { sym: 'A_v',   def: 'Closed-loop voltage gain (positive, always ≥ 1)' },
        { sym: 'R_1',   def: 'Resistor from − input to GND' },
        { sym: 'R_2',   def: 'Feedback resistor from output to − input' },
      ],
      example: 'R_1=10\\text{k}\\Omega,\\ R_2=47\\text{k}\\Omega \\Rightarrow A_v = 1+4.7=5.7,\\ V_{out}=5.7\\times 0.5=2.85\\text{ V}',
    },
  ],

  notes: [
    'Never connect the IR emitter LED directly to the power supply — always include a series resistor RE to limit current to the 10–30 mA safe range.',
    'Use the ideal op-amp model: virtual short (v_p = v_n) and infinite input resistance (i_p = i_n = 0). Analysis starts from these two assumptions.',
    'The LM741 saturation voltage is approximately Vcc − 1.5V. With ±5V supplies, |Vout| is limited to about ±3.5V — keep your gain and input range within those limits.',
    'The LM392 comparator has an open-collector output: it actively pulls LOW but floats HIGH. Connect a 10 kΩ pull-up resistor to +5V to get a clean HIGH output level.',
    'Set the comparator reference Vr between the amplified beam-ON and beam-OFF voltages. Choose values that give comfortable margin on both sides of the threshold.',
    'Both inverting and non-inverting configurations are required in Task 2. The key difference is output polarity — ensure the comparator reference Vr is set to match whichever amplifier output polarity you use in Task 3.',
    'Save all SPICE schematics with bias-point annotations displayed. Printed copies of the Fig 4.6 and Fig 4.7 simulations are required to hand in.',
  ],

  images: [
    {
      src:     new URL('./images/schematic.png', import.meta.url).href,
      caption: 'SPICE Schematics — Emitter/Detector, I→V Converter, Inverting Amplifier, and Comparator circuits',
      alt:     'ECEN 214 Lab 4 SPICE schematics showing all four circuit configurations',
    },
  ],

  calculatorTitle: 'Security System Designer',
  calculatorIcon:  '⊡',
}
