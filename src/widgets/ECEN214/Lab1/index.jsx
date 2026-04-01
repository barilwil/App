// ── ECEN 214 Lab 1 — Introduction to Electrical Circuits and Measurements ─────
// Exports labData (content) and VoltageDividerCalc (calculator).
// Layout is owned by WidgetShell — no JSX layout lives here.

import { useState, useCallback } from 'react'

// ── Voltage Divider Calculator ─────────────────────────────────────────────────
const CONFIGS = [
  { id: 'A', label: 'Task 2A', desc: 'Variable R₁, Fixed R₂',    r1Var: true,  r2Var: false, r2Default: 2000,  potMode: false, hint: 'Max R₂ = 2 kΩ to cover 1.5–5V range' },
  { id: 'B', label: 'Task 2B', desc: 'Fixed R₁, Variable R₂',    r1Var: false, r1Default: 8000, r2Var: true,  potMode: false, hint: 'Max R₁ = 8 kΩ to cover 1.5–5V range' },
  { id: 'C', label: 'Task 2C', desc: 'Full Pot (R₁ + R₂ = 10kΩ)', r1Var: true,  r2Var: true,  potMode: true,  hint: '1.67 kΩ ≤ R₂ ≤ 5.56 kΩ for design range' },
]

function fmtR(v) { return v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 1 : 2) + ' kΩ' : v + ' Ω' }
function fmtV(v) { return v.toFixed(3) + ' V' }

function CalcSlider({ value, min, max, step, onChange, disabled, color = 'rgba(255,255,255,0.8)' }) {
  return (
    <div className="calc-slider-wrap">
      <input type="range" className={`calc-slider ${disabled ? 'disabled' : ''}`}
        style={{ '--thumb-color': disabled ? 'rgba(255,255,255,0.15)' : color }}
        min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}

export function VoltageDividerCalc() {
  const [cfgIdx, setCfgIdx] = useState(0)
  const [v1, setV1]         = useState(9.0)
  const [r1, setR1]         = useState(5000)
  const [r2, setR2]         = useState(2000)
  const [loadOn, setLoadOn] = useState(false)
  const [rl, setRl]         = useState(10000)

  const cfg = CONFIGS[cfgIdx]

  const handleCfg = (idx) => {
    setCfgIdx(idx)
    const c = CONFIGS[idx]
    if (c.potMode) { setR1(5000); setR2(5000) }
    else if (!c.r1Var && c.r1Default) setR1(c.r1Default)
    else if (!c.r2Var && c.r2Default) setR2(c.r2Default)
  }
  const handleR1 = useCallback((v) => { setR1(v); if (cfg.potMode) setR2(10000 - v) }, [cfg])
  const handleR2 = useCallback((v) => { setR2(v); if (cfg.potMode) setR1(10000 - v) }, [cfg])

  const r2eff    = loadOn && r2 > 0 ? (r2 * rl) / (r2 + rl) : r2
  const denom    = r1 + r2eff
  const v2       = denom > 0 ? v1 * r2eff / denom : 0
  const v2UL     = (r1 + r2) > 0 ? v1 * r2 / (r1 + r2) : 0
  const loadDrop = loadOn && v2UL > 0 ? ((v2UL - v2) / v2UL * 100) : 0
  const current  = denom > 0 ? (v1 / denom) * 1000 : 0
  const inRange  = v2 >= 1.499 && v2 <= 5.001
  const barPct   = Math.min(100, (v2 / 9) * 100)

  return (
    <div className="calc-widget">
      <div className="calc-tabs">
        {CONFIGS.map((c, i) => (
          <button key={c.id} className={`calc-tab ${i === cfgIdx ? 'active' : ''}`} onClick={() => handleCfg(i)}>
            <span className="calc-tab-id">{c.id}</span>
            <span className="calc-tab-desc">{c.desc}</span>
          </button>
        ))}
      </div>
      <div className="calc-body">
        <div className="calc-controls">
          <div className="calc-ctrl-group">
            <div className="calc-ctrl-label">Source Voltage</div>
            <div className="calc-ctrl-row"><span className="calc-ctrl-name">V₁</span><span className="calc-ctrl-val">{v1.toFixed(1)} V</span></div>
            <CalcSlider value={v1} min={6} max={9.5} step={0.1} onChange={setV1} />
          </div>
          <div className="calc-ctrl-group">
            <div className="calc-ctrl-label">Resistors</div>
            <div className="calc-ctrl-row">
              <span className="calc-ctrl-name">R₁ {!cfg.r1Var && <span className="calc-fixed-tag">FIXED</span>}</span>
              <span className="calc-ctrl-val">{fmtR(r1)}</span>
            </div>
            <CalcSlider value={r1} min={0} max={10000} step={100} onChange={handleR1} disabled={!cfg.r1Var} />
            <div className="calc-ctrl-row" style={{ marginTop: 10 }}>
              <span className="calc-ctrl-name">
                R₂ {!cfg.r2Var && <span className="calc-fixed-tag">FIXED</span>}
                {cfg.potMode && <span className="calc-fixed-tag" style={{ color: 'rgba(130,210,180,0.8)', borderColor: 'rgba(130,210,180,0.25)' }}>POT</span>}
              </span>
              <span className="calc-ctrl-val">{fmtR(r2)}</span>
            </div>
            <CalcSlider value={r2} min={0} max={10000} step={100} onChange={handleR2} disabled={!cfg.r2Var} color="rgba(130,210,180,0.9)" />
          </div>
          <div className="calc-ctrl-group">
            <div className="calc-ctrl-label">Load</div>
            <label className="calc-toggle-row">
              <div className={`calc-toggle ${loadOn ? 'on' : ''}`} onClick={() => setLoadOn(v => !v)}><div className="calc-toggle-thumb" /></div>
              <span className="calc-toggle-label">Load Resistor R_L</span>
            </label>
            {loadOn && (
              <div className="calc-rl-select">
                {[100, 1000, 10000, 100000].map(v => (
                  <button key={v} className={`calc-rl-btn ${rl === v ? 'active' : ''}`} onClick={() => setRl(v)}>{fmtR(v)}</button>
                ))}
              </div>
            )}
          </div>
          <div className="calc-hint">{cfg.hint}</div>
        </div>
        <div className="calc-output">
          <div className={`calc-dmm ${inRange ? 'in-range' : 'out-range'}`}>
            <div className="calc-dmm-label">V₂ OUTPUT</div>
            <div className="calc-dmm-value">{fmtV(v2)}</div>
            <div className={`calc-dmm-status ${inRange ? 'in' : 'out'}`}>
              <div className="calc-dmm-dot" />
              {inRange ? 'IN RANGE  1.5 – 5.0 V' : 'OUT OF RANGE'}
            </div>
            <div className="calc-bar-track">
              <div className={`calc-bar-fill ${!inRange ? 'danger' : ''}`} style={{ width: `${barPct}%` }} />
              <div className="calc-bar-markers"><span>0</span><span>1.5V</span><span>5V</span><span>9V</span></div>
            </div>
          </div>
          <div className="calc-secondaries">
            <div className="calc-sec-item"><div className="calc-sec-val">{current.toFixed(2)}</div><div className="calc-sec-label">mA CURRENT</div></div>
            {loadOn && <div className="calc-sec-item"><div className="calc-sec-val" style={{ color: loadDrop > 10 ? '#f07070' : 'inherit' }}>{loadDrop.toFixed(1)}%</div><div className="calc-sec-label">LOAD DROP</div></div>}
            <div className="calc-sec-item"><div className="calc-sec-val">{(r2 / (r1 + r2 || 1)).toFixed(3)}</div><div className="calc-sec-label">RATIO R₂/(R₁+R₂)</div></div>
          </div>
          <div className="calc-formula">
            <div className="calc-formula-label">LIVE CALCULATION</div>
            {loadOn ? (
              <>
                <div className="calc-formula-eq">V₂ = V₁ × (R₂‖R_L) / (R₁ + R₂‖R_L)</div>
                <div className="calc-formula-nums">= {v1.toFixed(1)} × {fmtR(Math.round(r2eff))} / ({fmtR(r1)} + {fmtR(Math.round(r2eff))})</div>
                <div className="calc-formula-result">= {fmtV(v2)}</div>
                <div className="calc-formula-note">Unloaded: {fmtV(v2UL)} → Loaded: {fmtV(v2)} ({loadDrop.toFixed(1)}% drop)</div>
              </>
            ) : (
              <>
                <div className="calc-formula-eq">V₂ = V₁ × R₂ / (R₁ + R₂)</div>
                <div className="calc-formula-nums">= {v1.toFixed(1)} × {fmtR(r2)} / ({fmtR(r1)} + {fmtR(r2)})</div>
                <div className="calc-formula-result">= {fmtV(v2)}</div>
              </>
            )}
          </div>
          <div className="calc-prelab">
            <div className="calc-prelab-title">Prelab Reference</div>
            <div className="calc-prelab-row"><span>Config A max R₂</span><span>2 kΩ</span></div>
            <div className="calc-prelab-row"><span>Config B max R₁</span><span>8 kΩ</span></div>
            <div className="calc-prelab-row"><span>Config C R₂ range</span><span>1.67–5.56 kΩ</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Lab content data ───────────────────────────────────────────────────────────
export const labData = {
  objectives: [
    'Become familiar with the Digital Multimeter (DMM) and practice measuring DC voltage, current, and resistance.',
    'Learn to use a potentiometer as an adjustable resistor and understand how its three-terminal configuration works.',
    'Design and build a variable voltage source that outputs 1.5 V – 5 V using a 9 V battery and voltage-divider resistor networks.',
  ],

  parts: [
    {
      label: 'Task 1', duration: '~25 min', title: 'Battery & Load Measurements',
      description: 'Measure the open-circuit voltage of the 9V battery with the DMM. ' +
        'Then connect four different load resistors in turn and record the terminal voltage for each. ' +
        'Compare loaded vs. unloaded readings and calculate the implied internal resistance.',
    },
    {
      label: 'Task 2A', duration: '~20 min', title: 'Variable R₁, Fixed R₂',
      description: 'Build the divider with R₂ fixed (≤ 2 kΩ) and R₁ adjustable. ' +
        'Sweep R₁ and record V₂ at several settings. Verify V₂ stays in the 1.5–5 V target range.',
    },
    {
      label: 'Task 2B', duration: '~20 min', title: 'Fixed R₁, Variable R₂',
      description: 'Build the divider with R₁ fixed (≤ 8 kΩ) and R₂ adjustable. ' +
        'Sweep R₂ and record V₂ at several settings. Verify coverage of the 1.5–5 V range.',
    },
    {
      label: 'Task 2C', duration: '~20 min', title: '10 kΩ Potentiometer (3-terminal)',
      description: 'Wire the 10 kΩ pot so the wiper connects directly to the output node. ' +
        'Rotate through the full travel and record V₂ at each extreme and the midpoint. ' +
        'Note how both R₁ and R₂ change together, and confirm coverage of the 1.5–5 V range.',
    },
  ],

  components: [
    { name: '9V Battery + holder', value: '~9 V',     qty: 1 },
    { name: '10 kΩ Potentiometer', value: '10 kΩ',    qty: 1 },
    { name: '¼W Resistors',        value: 'assorted', qty: 'assorted' },
    { name: 'Digital Multimeter',  value: '—',         qty: 1 },
    { name: 'Breadboard',          value: '—',         qty: 1 },
    { name: 'Jumper Wires',        value: 'assorted', qty: '≥ 10' },
  ],

  equations: [
    {
      title: 'Voltage Divider', subtitle: 'Unloaded output voltage',
      tex: 'V_2 = V_1 \\cdot \\dfrac{R_2}{R_1 + R_2}', color: 'rgba(130,220,180,0.7)',
      vars: [
        { sym: 'V_1', def: 'Source voltage (9V battery)' },
        { sym: 'R_1', def: 'Upper resistor / pot section' },
        { sym: 'R_2', def: 'Lower resistor / pot section' },
        { sym: 'V_2', def: 'Output voltage across R_2' },
      ],
      example: 'V_1=9\\text{V},\\ R_1=7\\text{k}\\Omega,\\ R_2=2\\text{k}\\Omega \\Rightarrow V_2 = 9 \\times \\frac{2}{9} = 2.0\\text{ V}',
    },
    {
      title: 'Loaded Divider', subtitle: 'Output with load attached',
      tex: 'V_2 = V_1 \\cdot \\dfrac{R_2 \\| R_L}{R_1 + R_2 \\| R_L}', color: 'rgba(255,200,100,0.7)',
      vars: [
        { sym: 'R_L',        def: 'Load resistance connected across V_2' },
        { sym: 'R_2 \\| R_L', def: 'R_2 and R_L in parallel' },
        { sym: 'V_2',        def: 'Loaded output — always lower than unloaded' },
      ],
      example: 'V_1=9\\text{V},\\ R_1=5\\text{k},\\ R_2=2\\text{k},\\ R_L=1\\text{k}\\Rightarrow R_2\\|R_L=667\\Omega\\Rightarrow V_2=1.06\\text{ V}',
    },
    {
      title: 'Parallel Resistance', subtitle: 'Two resistors in parallel',
      tex: 'R \\| R_L = \\dfrac{R \\cdot R_L}{R + R_L}', color: 'rgba(120,160,255,0.7)',
      vars: [
        { sym: 'R',   def: 'First resistor (R_2 in divider)' },
        { sym: 'R_L', def: 'Second resistor (load)' },
      ],
      example: 'R_2=2\\text{k}\\Omega,\\ R_L=10\\text{k}\\Omega \\Rightarrow R\\|R_L = \\frac{20\\text{M}}{12\\text{k}} = 1.67\\text{ k}\\Omega',
    },
    {
      title: 'Branch Current', subtitle: 'Current through the divider',
      tex: 'I = \\dfrac{V_1}{R_1 + R_2 \\| R_L}', color: 'rgba(210,130,255,0.7)',
      vars: [
        { sym: 'I',               def: 'Total current from source through R_1' },
        { sym: 'V_1',             def: 'Battery voltage' },
        { sym: 'R_1 + R_2\\|R_L', def: 'Total equivalent series resistance' },
      ],
      example: 'V_1=9\\text{V},\\ R_1=7\\text{k},\\ R_2\\|R_L=1.67\\text{k} \\Rightarrow I = \\frac{9}{8.67\\text{k}} = 1.04\\text{ mA}',
    },
  ],

  notes: [
    'Never exceed the DMM\'s current input rating (200 mA on the fused terminal). Always check probe placement before measuring current.',
    'Power the circuit OFF before rearranging breadboard connections.',
    'For Tasks 2A and 2B, larger divider resistors mean less current drain on the battery but more sensitivity to load — smaller resistors are stiffer but waste more power.',
    'In Task 2C the wiper controls both R₁ and R₂ simultaneously (R₁ + R₂ = 10 kΩ always). They are not independent, unlike Tasks 2A and 2B.',
    'Record both theoretical (calculated) and measured values for every step; calculate percent error and note possible sources such as resistor tolerance and battery sag.',
  ],

  images: [
    {
      src:     new URL('./images/schematic.png', import.meta.url).href,
      caption: 'Circuit Schematic',
      alt:     'Voltage divider circuit schematic',
    },
  ],
}
