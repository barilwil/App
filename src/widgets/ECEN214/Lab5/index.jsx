import { useState } from 'react'

// ── ECEN 214 Lab 5 — Op-Amp Electronic Security System (Part 2) ───────────────
// Exports labData (content) and SecuritySystemPart2Calc (calculator).

/* ── Semantic accent colors ── */
const C_GREEN = 'rgba(80,210,130,0.92)'
const C_RED   = 'rgba(220,80,80,0.92)'
const C_AMBER = 'rgba(240,180,60,0.95)'
const C_TEAL  = 'rgba(100,210,180,0.92)'
const C_BLUE  = 'rgba(100,160,240,0.92)'
const C_MUTED = 'rgba(255,255,255,0.22)'

/* ── Helpers ── */
const fv = (v, d = 2) => isFinite(v) ? v.toFixed(d) : '---'

/* ── Shared slider (uses shared calc-* CSS classes) ─────────────────────────── */
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
          type="range" className="calc-slider"
          style={{ '--thumb-color': color }}
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(+e.target.value)}
        />
      </div>
    </div>
  )
}

/* ── Pipeline visualization ──────────────────────────────────────────────────── */
const PIPE_STAGES = [
  { label: 'IR\nEmitter',    icon: '💡' },
  { label: 'Photo\nDetect',  icon: '👁️' },
  { label: 'I→V\nConvert',  icon: '⚡' },
  { label: 'Signal\nAmp',   icon: '📈' },
  { label: 'Comparator',    icon: '⚖️' },
  { label: 'Latch',         icon: '🔒' },
  { label: 'LEDs',          icon: '🔆' },
]

function Pipeline({ beamObstructed, compHigh, latchQ }) {
  const active = [true, !beamObstructed, !beamObstructed, !beamObstructed, compHigh, latchQ, true]
  const vals   = [
    'IR ON',
    beamObstructed ? '↓ low'  : '↑ high',
    beamObstructed ? '↑ high' : '↓ low',
    beamObstructed ? '0.4V'   : '4.5V',
    compHigh       ? '+5V'    : '0V',
    latchQ         ? 'H'      : 'L',
    latchQ         ? '🔴'     : '🟢',
  ]
  return (
    <div className="lab5-pipeline">
      {PIPE_STAGES.map((s, i) => (
        <div className="lab5-stage-wrap" key={i}>
          <div className="lab5-stage">
            <div className={`lab5-stage-box${active[i] ? ' active' : ''}`}>
              <div className="lab5-stage-icon">{s.icon}</div>
              <div className="lab5-stage-lbl">{s.label}</div>
            </div>
            <div className={`lab5-v-badge${active[i] ? ' high' : ' low'}`}>{vals[i]}</div>
          </div>
          {i < PIPE_STAGES.length - 1 && (
            <div className="lab5-arrow">
              <div className={`lab5-arrow-line${active[i] ? ' on' : ''}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Status bar ──────────────────────────────────────────────────────────────── */
function StatusBar({ beamObstructed, compHigh, latchQ }) {
  return (
    <div className="lab5-status-bar">
      <span className="lab5-status-label">SYSTEM</span>
      <div className="lab5-status-chip">
        <div className={`lab5-dot${beamObstructed ? ' amber' : ' green'}`} />
        <span>{beamObstructed ? 'BEAM BLOCKED' : 'BEAM CLEAR'}</span>
      </div>
      <div className="lab5-status-chip">
        <div className={`lab5-dot${compHigh ? ' green' : ''}`} />
        <span>COMP: {compHigh ? 'HIGH' : 'LOW'}</span>
      </div>
      <div className="lab5-status-chip">
        <div className={`lab5-dot${latchQ ? ' red' : ' green'}`} />
        <span>LATCH Q: {latchQ ? 'HIGH' : 'LOW'}</span>
      </div>
      <div className="lab5-status-chip">
        <div className={`lab5-dot${latchQ ? ' red' : ''}`} />
        <span>{latchQ ? 'ALARM: ACTIVE' : 'ALARM: OFF'}</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB 1 — SYSTEM SIMULATOR
═══════════════════════════════════════════════ */
function SimTab({ beamObstructed, latchQ, compHigh, sHigh, ampOut, refV, setRefV, toggleBeam, resetLatch }) {
  return (
    <div className="lab5-sim">

      <Pipeline beamObstructed={beamObstructed} compHigh={compHigh} latchQ={latchQ} />
      <StatusBar beamObstructed={beamObstructed} compHigh={compHigh} latchQ={latchQ} />

      <div className="lab5-panels">

        {/* ── Panel 1: IR Emitter / Detector ── */}
        <div className="lab5-panel">
          <div className="lab5-panel-title">01 · IR EMITTER / DETECTOR</div>
          <div className="lab5-ir-scene">
            <div className="lab5-ir-device">
              <div className="lab5-ir-icon">💡</div>
              <div className="lab5-ir-label">IR EMIT</div>
            </div>
            <div className="lab5-beam-track">
              <div className={`lab5-beam-line${beamObstructed ? '' : ' active'}`} />
              <div className={`lab5-obstruction${beamObstructed ? ' visible' : ''}`}>🫷</div>
            </div>
            <div className="lab5-ir-device">
              <div className="lab5-ir-icon">👁️</div>
              <div className="lab5-ir-label">DETECT</div>
            </div>
          </div>
          <button
            className={`lab5-obstruct-btn${beamObstructed ? ' obstructed' : ''}`}
            onClick={toggleBeam}
          >
            {beamObstructed ? '[ CLICK TO CLEAR BEAM ]' : '[ CLICK TO OBSTRUCT BEAM ]'}
          </button>
          <div className="lab5-sig-readouts">
            <div className="lab5-sig-row">
              <span>Photodetector I<sub>d</sub></span>
              <span style={{ color: C_TEAL }}>{beamObstructed ? '~2 µA (low)' : '~50 µA (high)'}</span>
            </div>
            <div className="lab5-sig-row">
              <span>After I→V converter</span>
              <span style={{ color: beamObstructed ? C_AMBER : C_MUTED }}>
                {beamObstructed ? '~4.0 V (high)' : '~0.5 V (low)'}
              </span>
            </div>
            <div className="lab5-sig-row">
              <span>After signal amp</span>
              <span style={{ color: beamObstructed ? C_MUTED : C_GREEN }}>
                {beamObstructed ? '~0.4 V (low)' : '~4.5 V (high)'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Panel 2: Comparator ── */}
        <div className="lab5-panel">
          <div className="lab5-panel-title">02 · COMPARATOR (LM319)</div>
          <div className="lab5-comp-viz">
            <div className="lab5-comp-inputs">
              <div className="lab5-comp-input">
                <div className="lab5-comp-input-lbl">V⁺ (SIGNAL IN)</div>
                <div className="lab5-comp-input-val" style={{ color: compHigh ? C_GREEN : C_MUTED }}>
                  {ampOut.toFixed(1)}V
                </div>
              </div>
              <div className="lab5-comp-input">
                <div className="lab5-comp-input-lbl">V⁻ (REFERENCE)</div>
                <div className="lab5-comp-input-val" style={{ color: C_AMBER }}>
                  {refV.toFixed(1)}V
                </div>
              </div>
            </div>
            <div className="lab5-comp-triangle">▷</div>
            <div className="lab5-comp-output">
              <div className="lab5-comp-out-lbl">OUTPUT</div>
              <div className="lab5-comp-out-val" style={{ color: compHigh ? C_GREEN : C_MUTED }}>
                {compHigh ? '+5V' : '0V'}
              </div>
              <div className="lab5-comp-out-state">{compHigh ? 'HIGH' : 'LOW'}</div>
              <div className="lab5-comp-out-note">{compHigh ? 'V⁺ > V⁻ ✓' : 'V⁺ < V⁻'}</div>
            </div>
          </div>
          <CalcSlider
            label="Reference Voltage (Vref)"
            value={refV} onChange={setRefV}
            min={0.5} max={4.5} step={0.1} unit="V"
            color={C_AMBER}
          />
          <div className="lab5-note" style={{ marginTop: 10 }}>
            Output = +5V when V⁺ {'>'} V⁻, else 0V (open-loop saturation)
          </div>
        </div>

        {/* ── Panel 3: SR Latch ── */}
        <div className="lab5-panel">
          <div className="lab5-panel-title">03 · CD4044B SR LATCH</div>
          <div className="lab5-latch-viz">
            <div className="lab5-latch-inputs">
              <div className={`lab5-io-node${sHigh ? ' high' : ' low'}`}>
                <span className="lab5-io-label">S (SET)</span>
                <span className="lab5-io-val">{sHigh ? 'H' : 'L'}</span>
              </div>
              <div className="lab5-io-node high">
                <span className="lab5-io-label">R (RESET)</span>
                <span className="lab5-io-val">H</span>
              </div>
              <div className="lab5-io-hint">
                S ← comparator<br />R ← manual reset
              </div>
            </div>
            <div className="lab5-latch-box">
              <div className="lab5-chip-name">CD4044B</div>
              <div className="lab5-chip-icon">🔒</div>
              <div className="lab5-chip-sub">SR LATCH</div>
            </div>
            <div className="lab5-latch-output">
              <div className={`lab5-io-node${latchQ ? ' high' : ' low'}`}>
                <span className="lab5-io-label">Q OUT</span>
                <span className="lab5-io-val" style={{ color: latchQ ? C_RED : C_GREEN }}>
                  {latchQ ? 'H' : 'L'}
                </span>
              </div>
              <div className="lab5-io-hint">Q → LEDs</div>
            </div>
          </div>
          <button className="lab5-reset-btn" onClick={resetLatch}>
            [ MANUAL RESET (GROUND R) ]
          </button>
          <table className="lab5-truth-table">
            <thead>
              <tr><th>S</th><th>R</th><th>Q</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr className={sHigh ? 'active-row' : ''}>
                <td>H</td><td>H</td><td>—</td><td>No change</td>
              </tr>
              <tr className={!sHigh ? 'active-row' : ''}>
                <td>L</td><td>H</td><td>H</td><td>Set (alarm!)</td>
              </tr>
              <tr>
                <td>H</td><td>L</td><td>L</td><td>Reset (clear)</td>
              </tr>
              <tr>
                <td style={{ color: C_RED }}>L</td>
                <td style={{ color: C_RED }}>L</td>
                <td style={{ color: C_RED }}>?</td>
                <td style={{ color: C_RED }}>AVOID</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Panel 4: Indicator LEDs ── */}
        <div className="lab5-panel">
          <div className="lab5-panel-title">04 · INDICATOR LEDs</div>
          <div className="lab5-led-display">
            <div className="lab5-led-unit">
              <div className={`lab5-led-bulb lab5-led-green${!latchQ ? ' lit' : ''}`}>🟢</div>
              <div className="lab5-led-label">GREEN</div>
              <div className="lab5-led-status" style={{ color: !latchQ ? C_GREEN : C_MUTED }}>
                {!latchQ ? '● ON — SAFE' : '○ OFF'}
              </div>
            </div>
            <div className="lab5-led-divider">← Q →</div>
            <div className="lab5-led-unit">
              <div className={`lab5-led-bulb lab5-led-red${latchQ ? ' lit' : ''}`}>🔴</div>
              <div className="lab5-led-label">RED</div>
              <div className="lab5-led-status" style={{ color: latchQ ? C_RED : C_MUTED }}>
                {latchQ ? '● ON — ALARM!' : '○ OFF'}
              </div>
            </div>
          </div>
          <div className="lab5-led-info">
            <div>Q = LOW → <span style={{ color: C_GREEN }}>Green ON</span>, Red OFF</div>
            <div>Q = HIGH → Green OFF, <span style={{ color: C_RED }}>Red ON</span></div>
            <div className="lab5-led-formula">
              R = (5 – 0.7) / 0.010 = <strong style={{ color: C_TEAL }}>430 Ω</strong> min
            </div>
          </div>
        </div>

      </div>

      {/* ── Explainer cards ── */}
      <div className="lab5-explainers">
        <div className="lab5-explainer">
          <div className="lab5-explainer-title">HOW THE LATCH HOLDS STATE</div>
          When the beam is obstructed, the comparator drops to 0V → S goes LOW → Q sets HIGH (alarm).
          When the obstruction is removed, S returns HIGH — but S=H, R=H means <em>no change</em>.
          Q stays HIGH until you manually pull R LOW to reset it.
        </div>
        <div className="lab5-explainer">
          <div className="lab5-explainer-title">WHY THE SIGNAL AMPLIFIER MATTERS</div>
          The I→V converter produces ~0.5V — too close to Vref for a reliable comparator decision.
          The signal amplifier boosts it to ~4.5V, giving clean high/low levels and rejecting noise.
        </div>
        <div className="lab5-explainer">
          <div className="lab5-explainer-title">COMPARATOR vs. OP-AMP</div>
          The LM319 operates in open-loop saturation — output is either +5V or 0V, nothing in between.
          This gives clean digital logic levels to drive the CD4044B latch's S input.
        </div>
        <div className="lab5-explainer">
          <div className="lab5-explainer-title">SETTING THE REFERENCE VOLTAGE</div>
          Set Vref between the amp's "beam clear" (~4.5V) and "beam blocked" (~0.4V) outputs.
          The midpoint (~2.5V) maximizes noise margin. Too high → missed detections. Too low → false alarms.
        </div>
      </div>

    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB 2 — SR LATCH EXPLORER
═══════════════════════════════════════════════ */
function LatchTab() {
  const [S, setS] = useState(true)
  const [R, setR] = useState(true)
  const [Q, setQ] = useState(false)

  function handleS(val) {
    setS(val)
    if (!val && R)  setQ(true)   // S→LOW, R=H → set
    if (val  && !R) setQ(false)  // S→HIGH, R=L → reset
  }
  function handleR(val) {
    setR(val)
    if (!val && S)  setQ(false)  // R→LOW, S=H → reset
    if (val  && !S) setQ(true)   // R→HIGH, S=L → set
  }

  const stateDesc =
    !S && R  ? 'SET — alarm triggered (Q goes HIGH)' :
    S  && !R ? 'RESET — latch cleared (Q goes LOW)'  :
    S  && R  ? 'HOLD — Q retains previous state'     :
               'UNDEFINED — avoid this state!'
  const stateColor = !S && R ? C_RED : S && !R ? C_GREEN : S && R ? C_AMBER : C_MUTED

  return (
    <div className="lab5-latch-explorer">
      <div className="lab5-panel">
        <div className="lab5-panel-title">SR LATCH TRUTH TABLE EXPLORER</div>
        <div className="lab5-explorer-grid">
          <div className="lab5-explorer-col">
            <div className="lab5-explorer-col-head">INPUTS</div>
            <div className="lab5-toggle-group">
              <div className="lab5-toggle-label">S (SET) input</div>
              <div className="lab5-hl-btns">
                <button className={`lab5-hl-btn${S ? ' active' : ''}`} onClick={() => handleS(true)}>H (HIGH)</button>
                <button className={`lab5-hl-btn${!S ? ' active' : ''}`} onClick={() => handleS(false)}>L (LOW)</button>
              </div>
            </div>
            <div className="lab5-toggle-group">
              <div className="lab5-toggle-label">R (RESET) input</div>
              <div className="lab5-hl-btns">
                <button className={`lab5-hl-btn${R ? ' active' : ''}`} onClick={() => handleR(true)}>H (HIGH)</button>
                <button className={`lab5-hl-btn${!R ? ' active' : ''}`} onClick={() => handleR(false)}>L (LOW)</button>
              </div>
            </div>
          </div>
          <div className="lab5-explorer-col">
            <div className="lab5-explorer-col-head">OUTPUT</div>
            <div className="lab5-q-display">
              <div className="lab5-q-label">Q</div>
              <div className="lab5-q-value" style={{ color: Q ? C_RED : C_GREEN }}>
                {S && R ? '?' : (Q ? 'HIGH' : 'LOW')}
              </div>
              <div className="lab5-q-voltage" style={{ color: Q ? C_RED : C_GREEN }}>
                {S && R ? '—' : (Q ? '~5V' : '~0V')}
              </div>
            </div>
            <div className="lab5-state-desc" style={{ color: stateColor }}>
              {stateDesc}
            </div>
          </div>
        </div>
        <table className="lab5-truth-table" style={{ marginTop: 20 }}>
          <thead>
            <tr><th>S</th><th>R</th><th>Q</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr className={S && R ? 'active-row' : ''}>
              <td>H</td><td>H</td><td>No Chg</td><td>Hold state — alarm persists if set</td>
            </tr>
            <tr className={!S && R ? 'active-row' : ''}>
              <td>L</td><td>H</td><td>H</td><td>Set — alarm triggers</td>
            </tr>
            <tr className={S && !R ? 'active-row' : ''}>
              <td>H</td><td>L</td><td>L</td><td>Reset — system cleared</td>
            </tr>
            <tr className={!S && !R ? 'active-row' : ''}>
              <td style={{ color: C_RED }}>L</td>
              <td style={{ color: C_RED }}>L</td>
              <td style={{ color: C_RED }}>?</td>
              <td style={{ color: C_RED }}>UNDEFINED — avoid!</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="lab5-panel" style={{ marginTop: 12 }}>
        <div className="lab5-panel-title">HOW IT CONNECTS IN THE LAB</div>
        <div className="lab5-note">
          <strong>S</strong> is driven by the comparator output. Beam clear → comparator = +5V → S=H.
          Beam blocked → comparator = 0V → S=L (SET — alarm latches).<br /><br />
          <strong>R</strong> is normally HIGH (+5V via 10 kΩ pull-up). To reset, momentarily touch the
          R wire to ground → R=L → then disconnect. Q goes LOW and the alarm clears.<br /><br />
          Always tie pin 5 (ENABLE) to +5V or the CD4044B will not function.
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB 3 — LED RESISTOR CALCULATOR
═══════════════════════════════════════════════ */
const STD_RESISTORS = [330, 390, 430, 470, 510, 560, 620, 680, 750, 820, 910, 1000, 1200, 1500, 1800, 2200]

function LedTab() {
  const [Vcc,  setVcc]  = useState(5.0)
  const [Vled, setVled] = useState(0.7)
  const [Imax, setImax] = useState(10)

  const R      = (Vcc - Vled) / (Imax / 1000)
  const nearest = STD_RESISTORS.reduce((a, b) => Math.abs(b - R) < Math.abs(a - R) ? b : a)
  const Iatnearest = (Vcc - Vled) / nearest * 1000  // mA
  const safe = Iatnearest <= Imax

  return (
    <div className="lab5-led-calc">
      <div className="lab5-panels">
        <div className="lab5-panel">
          <div className="lab5-panel-title">PARAMETERS</div>
          <div className="calc-controls">
            <CalcSlider
              label="Supply Voltage (V_cc)" value={Vcc} onChange={setVcc}
              min={3} max={15} step={0.5} unit="V" color={C_BLUE}
            />
            <CalcSlider
              label="LED Forward Voltage (V_LED)" value={Vled} onChange={setVled}
              min={0.3} max={2.5} step={0.1} unit="V" color={C_GREEN}
            />
            <CalcSlider
              label="Max LED Current (I_max)" value={Imax} onChange={setImax}
              min={1} max={20} step={1} unit=" mA" color={C_AMBER}
            />
          </div>
          <div className="lab5-note" style={{ marginTop: 14 }}>
            Both R_G (green LED) and R_R (red LED) use the same formula — the circuit
            is symmetric. Use the same resistor value for both.
          </div>
        </div>

        <div className="lab5-panel">
          <div className="lab5-panel-title">RESULTS</div>
          <div className="lab5-readout">
            <div className="lab5-readout-label">MINIMUM RESISTOR (R_G = R_R)</div>
            <div className="lab5-readout-value" style={{ color: C_TEAL }}>
              {fv(R, 0)}<span className="lab5-readout-unit"> Ω</span>
            </div>
            <div className="lab5-readout-sub">= ({fv(Vcc,1)} – {fv(Vled,1)}) / {fv(Imax/1000, 4)} A</div>
          </div>
          <div className="lab5-readout" style={{ marginTop: 10 }}>
            <div className="lab5-readout-label">NEAREST STANDARD VALUE</div>
            <div className="lab5-readout-value" style={{ color: C_AMBER }}>
              {nearest}<span className="lab5-readout-unit"> Ω</span>
            </div>
            <div className="lab5-readout-sub" style={{ color: safe ? C_GREEN : C_RED }}>
              I_LED = {fv(Iatnearest, 1)} mA {safe ? '✓ within limit' : '⚠ exceeds I_max — use next larger value'}
            </div>
          </div>
          <div className="lab5-formula" style={{ marginTop: 14 }}>
            R = (V_cc – V_LED) / I_max<br />
            R = ({fv(Vcc,1)} – {fv(Vled,1)}) / {fv(Imax/1000,4)} = {fv(R,1)} Ω
          </div>
          <div className="lab5-note" style={{ marginTop: 10 }}>
            Choose a value ≥ calculated minimum. Using a larger resistor reduces current
            (dimmer LED) but protects both the LED and the latch output driver.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════ */
const styles = `
.lab5-root .calc-body {
  display: flex; flex-direction: column;
  grid-template-columns: none;
  padding: 18px 20px;
}
.lab5-root .calc-tab { min-height: 56px; }
.lab5-root .calc-tab-desc { white-space: normal; text-align: center; line-height: 1.3; }

/* ── Pipeline ── */
.lab5-pipeline {
  display: flex; align-items: flex-start;
  overflow-x: auto; padding-bottom: 6px; margin-bottom: 14px; gap: 0;
}
.lab5-stage-wrap { display: flex; align-items: center; }
.lab5-stage { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.lab5-stage-box {
  width: 70px; height: 50px;
  border: 1.5px solid var(--border); border-radius: var(--r-sm);
  background: var(--bg-3);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 8px; color: var(--text-3); text-align: center; line-height: 1.3;
  transition: border-color 0.25s, box-shadow 0.25s; padding: 4px;
}
.lab5-stage-box.active {
  border-color: rgba(80,210,130,0.5);
  box-shadow: 0 0 10px rgba(80,210,130,0.15);
  color: var(--text-2);
}
.lab5-stage-icon { font-size: 15px; margin-bottom: 2px; }
.lab5-stage-lbl { font-size: 7px; white-space: pre-line; }
.lab5-v-badge {
  font-size: 9px; padding: 1px 5px;
  border-radius: 3px; background: var(--surface);
  border: 1px solid var(--border); color: var(--text-3);
  font-family: var(--mono); white-space: nowrap; transition: all 0.25s;
}
.lab5-v-badge.high { border-color: rgba(80,210,130,0.4); color: rgba(80,210,130,0.92); }
.lab5-v-badge.low  { color: var(--text-3); }
.lab5-arrow { width: 26px; height: 2px; flex-shrink: 0; }
.lab5-arrow-line {
  height: 2px; background: var(--border); width: 100%;
  transition: background 0.25s; position: relative;
}
.lab5-arrow-line.on { background: rgba(80,210,130,0.6); box-shadow: 0 0 5px rgba(80,210,130,0.25); }
.lab5-arrow-line::after {
  content: ''; position: absolute; right: -1px; top: -4px;
  border: 5px solid transparent; border-left-color: inherit;
}
.lab5-arrow-line.on::after { border-left-color: rgba(80,210,130,0.6); }

/* ── Status bar ── */
.lab5-status-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  padding: 9px 14px; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); margin-bottom: 14px; font-size: 10px; font-family: var(--mono);
}
.lab5-status-label {
  font-size: 8px; color: var(--text-3); letter-spacing: 2px; text-transform: uppercase; margin-right: 4px;
}
.lab5-status-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 8px; border-radius: 3px;
  background: var(--bg-3); border: 1px solid var(--border); color: var(--text-2);
}
.lab5-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--border); flex-shrink: 0;
}
.lab5-dot.green { background: rgba(80,210,130,0.85); box-shadow: 0 0 4px rgba(80,210,130,0.5); }
.lab5-dot.red   { background: rgba(220,80,80,0.85);  box-shadow: 0 0 4px rgba(220,80,80,0.5); }
.lab5-dot.amber { background: rgba(240,180,60,0.85); box-shadow: 0 0 4px rgba(240,180,60,0.5); }

/* ── Sim layout ── */
.lab5-sim { display: flex; flex-direction: column; gap: 0; }
.lab5-panels {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;
}
.lab5-panel {
  background: var(--bg-3); border: 1px solid var(--border);
  border-radius: var(--r); padding: 16px 18px;
}
.lab5-panel-title {
  font-size: 9px; color: var(--text-3); font-family: var(--mono);
  letter-spacing: 2px; text-transform: uppercase;
  padding-bottom: 10px; margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px;
}
.lab5-panel-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

/* ── IR scene ── */
.lab5-ir-scene {
  display: flex; align-items: center; justify-content: space-around;
  height: 76px; margin-bottom: 12px; position: relative;
}
.lab5-ir-device { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.lab5-ir-icon { font-size: 22px; }
.lab5-ir-label { font-size: 8px; color: var(--text-3); font-family: var(--mono); letter-spacing: 1px; }
.lab5-beam-track {
  flex: 1; height: 40px; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.lab5-beam-line {
  position: absolute; top: 50%; transform: translateY(-50%);
  left: 0; right: 0; height: 3px;
  background: repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(100,60,200,0.2) 6px, rgba(100,60,200,0.2) 12px);
  border-radius: 2px; transition: all 0.3s;
}
.lab5-beam-line.active {
  background: repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(180,80,255,0.7) 6px, rgba(180,80,255,0.7) 12px);
  box-shadow: 0 0 8px rgba(160,60,255,0.4);
  animation: lab5-beam-pulse 1.6s ease-in-out infinite;
}
@keyframes lab5-beam-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
.lab5-obstruction {
  position: absolute; left: 50%; transform: translateX(-50%);
  width: 22px; height: 30px; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; opacity: 0; transition: opacity 0.2s;
}
.lab5-obstruction.visible { opacity: 1; }
.lab5-obstruct-btn {
  width: 100%; padding: 9px; border-radius: var(--r-sm);
  border: 1.5px solid rgba(100,60,200,0.4);
  background: transparent; color: rgba(160,100,240,0.8);
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.5px;
  cursor: pointer; transition: all 0.2s; margin-bottom: 12px;
}
.lab5-obstruct-btn:hover { border-color: rgba(180,80,255,0.7); color: rgba(200,120,255,0.95); }
.lab5-obstruct-btn.obstructed {
  border-color: rgba(240,180,60,0.6); color: rgba(240,180,60,0.9);
  background: rgba(240,180,60,0.04);
}
.lab5-sig-readouts { display: flex; flex-direction: column; gap: 5px; }
.lab5-sig-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; color: var(--text-3); font-family: var(--mono);
  padding: 3px 0; border-bottom: 1px solid var(--border);
}
.lab5-sig-row:last-child { border-bottom: none; }

/* ── Comparator ── */
.lab5-comp-viz {
  display: grid; grid-template-columns: 1fr auto 1fr;
  gap: 8px; align-items: center; margin-bottom: 14px;
}
.lab5-comp-inputs { display: flex; flex-direction: column; gap: 6px; }
.lab5-comp-input {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 7px; text-align: center;
}
.lab5-comp-input-lbl { font-size: 8px; color: var(--text-3); font-family: var(--mono); margin-bottom: 3px; }
.lab5-comp-input-val { font-size: 16px; font-family: var(--mono); font-weight: bold; transition: color 0.3s; }
.lab5-comp-triangle { font-size: 26px; color: rgba(80,210,130,0.7); }
.lab5-comp-output {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 8px; text-align: center;
}
.lab5-comp-out-lbl  { font-size: 8px; color: var(--text-3); font-family: var(--mono); margin-bottom: 4px; }
.lab5-comp-out-val  { font-size: 22px; font-family: var(--mono); font-weight: bold; transition: color 0.3s; }
.lab5-comp-out-state{ font-size: 9px; color: var(--text-3); margin-top: 2px; font-family: var(--mono); }
.lab5-comp-out-note { font-size: 9px; color: var(--text-3); font-family: var(--mono); margin-top: 3px; }

/* ── Latch ── */
.lab5-latch-viz {
  display: flex; gap: 10px; align-items: stretch; margin-bottom: 12px;
}
.lab5-latch-inputs  { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.lab5-latch-output  { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.lab5-latch-box {
  flex: 1.2; background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-sm); display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 10px 6px; text-align: center; gap: 4px;
}
.lab5-chip-name { font-size: 8px; color: var(--text-3); font-family: var(--mono); letter-spacing: 2px; }
.lab5-chip-icon { font-size: 24px; }
.lab5-chip-sub  { font-size: 7px; color: var(--text-3); font-family: var(--mono); }
.lab5-io-node {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 5px; padding: 6px 8px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 6px; font-size: 10px; transition: all 0.3s;
}
.lab5-io-node.high { border-color: rgba(80,210,130,0.5); }
.lab5-io-node.low  { border-color: var(--border); }
.lab5-io-label { font-size: 8px; color: var(--text-3); font-family: var(--mono); }
.lab5-io-val   { font-weight: bold; font-size: 14px; font-family: var(--mono); color: var(--text); }
.lab5-io-node.high .lab5-io-val { color: rgba(80,210,130,0.92); }
.lab5-io-node.low  .lab5-io-val { color: var(--text-3); }
.lab5-io-hint { font-size: 8px; color: var(--text-3); font-family: var(--mono); line-height: 1.5; }
.lab5-reset-btn {
  width: 100%; padding: 8px; border-radius: var(--r-sm);
  border: 1px solid rgba(100,160,240,0.3); background: transparent;
  color: rgba(100,160,240,0.7); font-family: var(--mono); font-size: 10px;
  letter-spacing: 0.5px; cursor: pointer; transition: all 0.2s; margin-bottom: 12px;
}
.lab5-reset-btn:hover { border-color: rgba(100,160,240,0.7); color: rgba(100,160,240,0.95); }

/* ── Truth table ── */
.lab5-truth-table {
  width: 100%; border-collapse: collapse;
  font-size: 10px; font-family: var(--mono);
}
.lab5-truth-table th {
  background: var(--surface); color: var(--text-2);
  padding: 5px 8px; border: 1px solid var(--border);
  text-align: center; font-size: 9px; letter-spacing: 1px;
}
.lab5-truth-table td {
  padding: 5px 8px; border: 1px solid var(--bg-3);
  text-align: center; color: var(--text-3); transition: all 0.25s;
}
.lab5-truth-table tr.active-row td {
  background: rgba(80,210,130,0.07); color: var(--text-2);
  border-color: rgba(80,210,130,0.15);
}
.lab5-truth-table tr.active-row td:last-child { color: rgba(80,210,130,0.9); }

/* ── LEDs ── */
.lab5-led-display {
  display: flex; gap: 16px; align-items: center; justify-content: center; padding: 16px 0;
}
.lab5-led-unit   { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.lab5-led-bulb {
  width: 52px; height: 52px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; transition: all 0.3s; filter: grayscale(0.7) opacity(0.4);
}
.lab5-led-bulb.lit { filter: none; }
.lab5-led-green.lit { box-shadow: 0 0 18px rgba(80,210,130,0.6), 0 0 36px rgba(80,210,130,0.25); }
.lab5-led-red.lit   {
  box-shadow: 0 0 18px rgba(220,80,80,0.6), 0 0 36px rgba(220,80,80,0.25);
  animation: lab5-red-pulse 0.8s ease-in-out infinite;
}
@keyframes lab5-red-pulse {
  0%,100%{ box-shadow:0 0 18px rgba(220,80,80,0.6),0 0 36px rgba(220,80,80,0.25) }
  50%    { box-shadow:0 0 28px rgba(220,80,80,0.9),0 0 56px rgba(220,80,80,0.45) }
}
.lab5-led-label  { font-size: 11px; color: var(--text-2); font-family: var(--mono); }
.lab5-led-status { font-size: 9px; font-family: var(--mono); letter-spacing: 0.5px; }
.lab5-led-divider{
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  color: var(--text-3); font-size: 9px; font-family: var(--mono);
}
.lab5-led-divider::before,.lab5-led-divider::after {
  content:''; display:block; width:1px; height:18px; background: var(--border);
}
.lab5-led-info {
  font-size: 10px; color: var(--text-3); font-family: var(--mono);
  padding: 10px 12px; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); line-height: 1.8;
}
.lab5-led-formula { margin-top: 6px; font-size: 9px; }

/* ── Explainer cards ── */
.lab5-explainers {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 0;
}
.lab5-explainer {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 13px;
  font-size: 10px; color: var(--text-3); line-height: 1.65;
}
.lab5-explainer-title {
  font-size: 8px; color: var(--text-2); font-family: var(--mono);
  letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 7px;
}

/* ── Latch explorer ── */
.lab5-latch-explorer { display: flex; flex-direction: column; gap: 0; }
.lab5-explorer-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 4px; }
.lab5-explorer-col   { display: flex; flex-direction: column; gap: 12px; }
.lab5-explorer-col-head {
  font-size: 8px; color: var(--text-3); font-family: var(--mono);
  letter-spacing: 2px; text-transform: uppercase; padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.lab5-toggle-group   { display: flex; flex-direction: column; gap: 6px; }
.lab5-toggle-label   { font-size: 11px; color: var(--text-2); }
.lab5-hl-btns        { display: flex; gap: 0; border-radius: var(--r-sm); overflow: hidden; border: 1px solid var(--border); width: fit-content; }
.lab5-hl-btn {
  padding: 7px 18px; border: none; cursor: pointer;
  font-size: 11px; font-family: var(--mono);
  background: var(--surface); color: var(--text-3); transition: all 0.15s;
}
.lab5-hl-btn:not(:last-child) { border-right: 1px solid var(--border); }
.lab5-hl-btn.active { background: rgba(80,210,130,0.1); color: rgba(80,210,130,0.95); }
.lab5-q-display {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r); padding: 16px; text-align: center;
}
.lab5-q-label   { font-size: 9px; color: var(--text-3); font-family: var(--mono); letter-spacing: 2px; margin-bottom: 4px; }
.lab5-q-value   { font-size: 28px; font-family: var(--mono); font-weight: bold; transition: color 0.3s; }
.lab5-q-voltage { font-size: 13px; font-family: var(--mono); color: var(--text-3); margin-top: 2px; }
.lab5-state-desc{ font-size: 10px; color: var(--text-3); font-family: var(--mono); line-height: 1.5; margin-top: 4px; text-align: center; }

/* ── LED calculator ── */
.lab5-led-calc  { display: flex; flex-direction: column; gap: 0; }
.lab5-readout   {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 12px 16px;
}
.lab5-readout-label {
  font-size: 8px; color: var(--text-3); letter-spacing: 2px;
  text-transform: uppercase; font-family: var(--mono); margin-bottom: 3px;
}
.lab5-readout-value  { font-size: 22px; font-family: var(--mono); font-weight: bold; letter-spacing: 1px; }
.lab5-readout-unit   { font-size: 11px; opacity: 0.6; margin-left: 2px; }
.lab5-readout-sub    { font-size: 9px; color: var(--text-3); font-family: var(--mono); margin-top: 3px; }

/* ── Shared helpers ── */
.lab5-formula {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 8px 14px;
  font-family: var(--mono); font-size: 11px; color: rgba(240,180,60,0.9);
  letter-spacing: 0.5px; line-height: 1.7;
}
.lab5-note {
  font-size: 10px; color: var(--text-3); font-family: var(--mono);
  padding: 8px 12px; background: var(--surface);
  border-radius: var(--r-sm); border: 1px solid var(--border); line-height: 1.65;
}
`

/* ═══════════════════════════════════════════════
   CALCULATOR WIDGET
═══════════════════════════════════════════════ */
const TABS = [
  { id: 'latch', label: 'Task 2 · Latch', short: 'SR latch truth table explorer' },
  { id: 'led',   label: 'Task 3 · LEDs',  short: 'LED resistor sizing calculator' },
]

export function SecuritySystemPart2Calc() {
  const [tab, setTab] = useState('latch')

  return (
    <div className="lab5-root">
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
        {tab === 'latch' && <LatchTab />}
        {tab === 'led'   && <LedTab />}
      </div>
    </div>
  )
}

// ── Lab content data ──────────────────────────────────────────────────────────
export const labData = {

  objectives: [
    'Integrate all Lab 4 circuit stages — IR emitter, photodetector, I→V converter, signal amplifier, and comparator — into a complete security system signal chain.',
    'Analyze and construct the CD4044B SR latch circuit, understanding how it latches an alarm state even after the triggering condition is removed.',
    'Design indicator LED circuits (green = safe, red = alarm) with current-limiting resistors to keep I_LED ≤ 10 mA.',
  ],

  parts: [
    {
      label:       'Prelab',
      duration:    '~45 min',
      title:       'System design & analysis',
      description: 'Design the full system schematic from Lab 4 measurements (Task A). Run SPICE simulations with and without beam obstruction (Task B). Analyze the SR latch truth table using Figure 5.3 (Task C). Calculate LED resistor values R_G and R_R assuming 0.7 V forward drop and 10 mA max current (Task D).',
    },
    {
      label:       'Task 1',
      duration:    '~60 min',
      title:       'Integrate Lab 4 components',
      description: 'Wire the IR emitter, photodetector, I→V converter, signal amplifier, and comparator so the comparator output is +5V when the beam is unobstructed and 0V when blocked. Demonstrate correct operation to your TA.',
    },
    {
      label:       'Task 2',
      duration:    '~30 min',
      title:       'Construct the SR latch',
      description: 'Connect the comparator output to the S input of the CD4044B latch (Fig. 5.6). Tie ENABLE (pin 5) to +5V. Verify the latch holds Q HIGH even after the beam is restored, and that manually pulling R LOW resets it.',
    },
    {
      label:       'Task 3',
      duration:    '~30 min',
      title:       'Add indicator LEDs',
      description: 'Wire the green and red LEDs (Fig. 5.7) to the latch Q output with current-limiting resistors. Confirm that only one LED is lit at any time — green under normal conditions (Q=LOW), red when the alarm is latched (Q=HIGH).',
    },
  ],

  components: [
    { name: '¼W resistors',              value: 'various',   qty: 'assorted' },
    { name: 'Red LED',                   value: '—',         qty: 1 },
    { name: 'Green LED',                 value: '—',         qty: 1 },
    { name: 'CD4044B Latch (IC)',         value: '—',         qty: 1 },
    { name: 'Battery pack',              value: '4.5–5V DC', qty: 1 },
    { name: 'LM319 comparator',          value: '—',         qty: 1 },
    { name: 'LM741 op-amp',              value: '—',         qty: 2 },
    { name: 'IR emitter / detector pair',value: '—',         qty: 1 },
    { name: 'Connection wires (24 ga)',   value: 'colored',   qty: '15+' },
  ],

  equations: [
    {
      title:    'LED Current-Limiting Resistor',
      subtitle: 'Limits current through each indicator LED',
      tex:      'R = \\frac{V_{cc} - V_{LED}}{I_{max}}',
      color:    'rgba(100,210,180,0.92)',
      vars: [
        { sym: 'V_{cc}',  def: 'Supply voltage (5 V)' },
        { sym: 'V_{LED}', def: 'LED forward voltage drop (≈ 0.7 V)' },
        { sym: 'I_{max}', def: 'Maximum LED current (10 mA)' },
      ],
      example: 'R = \\frac{5 - 0.7}{0.010} = 430\\,\\Omega',
    },
    {
      title:    'SR Latch Output (CD4044B)',
      subtitle: 'Active-LOW inputs; Q holds state when S=H, R=H',
      tex:      'Q_{next} = \\overline{S} \\cdot R + S \\cdot \\overline{R} \\cdot 0 + (S \\cdot R) \\cdot Q',
      color:    'rgba(240,180,60,0.95)',
      vars: [
        { sym: 'S', def: 'Set input — active LOW, driven by comparator' },
        { sym: 'R', def: 'Reset input — active LOW, manual ground pulse' },
        { sym: 'Q', def: 'Latch output — drives LED indicator circuit' },
      ],
      example: 'S=L,\\;R=H \\Rightarrow Q=H\\;(\\text{alarm latches})',
    },
    {
      title:    'Comparator Output (LM319)',
      subtitle: 'Open-loop — saturates to rail voltage',
      tex:      'V_{out} = \\begin{cases} +V_{cc} & V_{in} > V_{ref} \\\\ 0\\text{ V} & V_{in} < V_{ref} \\end{cases}',
      color:    'rgba(100,160,240,0.92)',
      vars: [
        { sym: 'V_{in}',  def: 'Amplified photodetector signal voltage' },
        { sym: 'V_{ref}', def: 'Reference voltage (resistor voltage divider)' },
        { sym: 'V_{cc}',  def: 'Supply rail (+5 V)' },
      ],
      example: 'V_{in}=4.5\\text{ V},\\;V_{ref}=2.5\\text{ V} \\Rightarrow V_{out}=+5\\text{ V}',
    },
  ],

  notes: [
    'Tie ENABLE (pin 5) of the CD4044B to +5V — if left floating or at 0V, the latch will not function.',
    'Never let S=L and R=L simultaneously — this creates the undefined state for the CD4044B latch.',
    'Set V_ref at the midpoint between the amplifier\'s "beam clear" and "beam blocked" output voltages to maximize noise margin and prevent false alarms.',
    'Use 0.7 V for the LED forward voltage drop in all resistor calculations.',
    'You may need to pulse the R input LOW briefly after power-on to initialize Q to the known LOW state.',
    'The green LED is ON under normal conditions (Q=LOW); the red LED is ON and alarm is latched when Q=HIGH.',
  ],

  images: [
    {
      src:     new URL('./images/schematic.png', import.meta.url).href,
      caption: 'Lab 5 Full Schematic — SR latch (CD4044B), comparator, and LED indicator circuits',
      alt:     'ECEN 214 Lab 5 schematic showing the complete security system with SR latch and indicator LEDs',
    },
  ],

  calculatorTitle: 'Security System Part 2',
  calculatorIcon:  '🔒',
}
