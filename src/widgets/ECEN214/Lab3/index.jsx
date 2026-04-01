import { useState, useEffect, useMemo } from 'react'

// ── ECEN 214 Lab 3 — Equivalent Networks and Superposition ───────────────────
// Uses the uploaded simulator as the Calculator section content, adapted to fit
// inside WidgetShell. The original standalone Theory tab has been removed.

/* ═══════════════════════════════════════════════
   CIRCUIT SOLVER  (Fig. 3.3 / Fig. 3.4)
   Nodes: A (Va) and C (Vc)
   R1=5.1kΩ: V1+ → A
   R2=1kΩ:   A → GND  (the LOAD, VL measured here)
   R3=2kΩ:   A → C
   R4=5.1kΩ: C → GND
   R5=2kΩ:   C → V2+
═══════════════════════════════════════════════ */
function solve(v1, v2, diode = false) {
  const [R1, R2, R3, R4, R5] = [5100, 1000, 2000, 5100, 2000]
  const [G1, G2, G3, G4, G5] = [1 / R1, 1 / R2, 1 / R3, 1 / R4, 1 / R5]
  const Gcc = G3 + G4 + G5

  const cramer = (Gaa, ra, rc) => {
    const det = Gaa * Gcc - G3 * G3
    return {
      Va: (ra * Gcc + rc * G3) / det,
      Vc: (rc * Gaa + ra * G3) / det,
    }
  }

  if (!diode) {
    const { Va, Vc } = cramer(G1 + G2 + G3, v1 * G1, v2 * G5)
    return {
      Va,
      Vc,
      VL: Va,
      ds: null,
      I: {
        R1: (v1 - Va) / R1,
        R2: Va / R2,
        R3: (Va - Vc) / R3,
        R4: Vc / R4,
        R5: (Vc - v2) / R5,
      },
    }
  }

  // Try diode ON: V_anode = 0.7V (bottom of R2 held at 0.7V)
  const { Va: Vt, Vc: Ct } = cramer(G1 + G2 + G3, v1 * G1 + 0.7 * G2, v2 * G5)
  if ((Vt - 0.7) / R2 >= -1e-9) {
    return {
      Va: Vt,
      Vc: Ct,
      VL: Math.max(0, Vt - 0.7),
      ds: 'on',
      I: {
        R1: (v1 - Vt) / R1,
        R2: (Vt - 0.7) / R2,
        R3: (Vt - Ct) / R3,
        R4: Ct / R4,
        R5: (Ct - v2) / R5,
      },
    }
  }

  // Diode OFF — remove R2 branch
  const { Va: Voff, Vc: Coff } = cramer(G1 + G3, v1 * G1, v2 * G5)
  return {
    Va: Voff,
    Vc: Coff,
    VL: 0,
    ds: 'off',
    I: {
      R1: (v1 - Voff) / R1,
      R2: 0,
      R3: (Voff - Coff) / R3,
      R4: Coff / R4,
      R5: (Coff - v2) / R5,
    },
  }
}

const fv = (v) => (typeof v === 'number' ? `${v.toFixed(3)}V` : '---')

/* ═══════════════════════════════════════════════
   SVG CIRCUIT PRIMITIVES
═══════════════════════════════════════════════ */
function CurrentDots({ x1, y1, x2, y2, current, tick }) {
  if (!current || Math.abs(current) < 3e-7) return null
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return null
  const speed = Math.min(Math.abs(current) * 11000, 2.8)
  const dir = current > 0 ? 1 : -1
  const n = Math.max(1, Math.min(3, Math.round(Math.abs(current) * 1800)))

  return Array.from({ length: n }, (_, i) => {
    const pos = (tick * speed + (i * len) / n) % len
    const t = dir > 0 ? pos / len : 1 - pos / len
    return (
      <circle
        key={i}
        cx={x1 + dx * t}
        cy={y1 + dy * t}
        r={2.6}
        fill="#ffe566"
        opacity={0.9}
        style={{ filter: 'drop-shadow(0 0 3px #ffc000)' }}
      />
    )
  })
}

function Res({ cx, cy, vert = false, label = '', highlight = false }) {
  const [W, H] = vert ? [14, 36] : [40, 14]
  const col = highlight ? '#00ffaa' : '#00cc66'
  return (
    <g>
      <rect
        x={cx - W / 2}
        y={cy - H / 2}
        width={W}
        height={H}
        rx={2}
        fill="#050f0a"
        stroke={col}
        strokeWidth={1.5}
      />
      {label && !vert && (
        <text
          x={cx}
          y={cy - H / 2 - 4}
          textAnchor="middle"
          fill="#2a6644"
          fontSize={8}
          fontFamily="'Courier New', monospace"
        >
          {label}
        </text>
      )}
      {label && vert && (
        <text
          x={cx - W / 2 - 3}
          y={cy}
          textAnchor="end"
          dominantBaseline="middle"
          fill="#2a6644"
          fontSize={8}
          fontFamily="'Courier New', monospace"
        >
          {label}
        </text>
      )}
    </g>
  )
}

function VSrc({ cx, cy, v, label, on, isV2 = false }) {
  const col = on ? (isV2 ? '#5599ff' : '#00dd77') : '#1e3a2a'
  const shadow = on ? (isV2 ? '0 0 12px #2255aa' : '0 0 12px #005533') : 'none'
  return (
    <g style={{ filter: on ? `drop-shadow(${shadow})` : 'none' }}>
      <circle cx={cx} cy={cy} r={20} fill="#030d07" stroke={col} strokeWidth={1.8} />
      <text x={cx} y={cy - 3} textAnchor="middle" dominantBaseline="middle" fill={col} fontSize={13} fontFamily="monospace" fontWeight="bold">+</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fill={col} fontSize={11} fontFamily="monospace">−</text>
      <text x={cx} y={cy - 33} textAnchor="middle" fill={col} fontSize={10} fontFamily="'Courier New', monospace" fontWeight="bold">{label}</text>
      <text x={cx} y={cy + 36} textAnchor="middle" fill={on ? col : '#1e3a2a'} fontSize={9} fontFamily="'Courier New', monospace">{on ? `${v}V` : 'OFF'}</text>
    </g>
  )
}

function DiodeSym({ cx, y1, y2, ds }) {
  const col = ds === 'on' ? '#ff8844' : ds === 'off' ? '#2a4433' : '#00cc66'
  const mid = (y1 + y2) / 2
  return (
    <g>
      <line x1={cx} y1={y1} x2={cx} y2={mid - 11} stroke={col} strokeWidth={1.5} />
      <polygon
        points={`${cx},${mid + 11} ${cx - 10},${mid - 11} ${cx + 10},${mid - 11}`}
        fill={ds === 'on' ? '#3a1000' : '#030d07'}
        stroke={col}
        strokeWidth={1.5}
      />
      <line x1={cx - 11} y1={mid + 11} x2={cx + 11} y2={mid + 11} stroke={col} strokeWidth={2} />
      <line x1={cx} y1={mid + 11} x2={cx} y2={y2} stroke={col} strokeWidth={1.5} />
      <text x={cx + 15} y={mid + 2} dominantBaseline="middle" fill={col} fontSize={8} fontFamily="'Courier New', monospace">
        {ds === 'on' ? '⚡ 0.7V' : ds === 'off' ? 'OPEN' : '1N4148'}
      </text>
    </g>
  )
}

function GndMark({ x, y }) {
  return (
    <g>
      {[[10, 0], [7, 4], [4, 8]].map(([hw, dy], i) => (
        <line key={i} x1={x - hw} y1={y + dy} x2={x + hw} y2={y + dy} stroke="#00cc66" strokeWidth={1.5} />
      ))}
    </g>
  )
}

function NodeDot({ cx, cy, label, value, labelAnchor = 'middle' }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={4.5} fill="#00dd77" style={{ filter: 'drop-shadow(0 0 4px #00aa44)' }} />
      {label && (
        <text x={cx} y={cy - 16} textAnchor={labelAnchor} fill="#ddaa33" fontSize={9} fontFamily="'Courier New', monospace">
          {label}={fv(value)}
        </text>
      )}
    </g>
  )
}

/* ═══════════════════════════════════════════════
   CIRCUIT DIAGRAM SVG
═══════════════════════════════════════════════ */
function CircuitDiagram({ V1, V2, sol, useDiode, tick }) {
  const { Va, Vc, VL, I, ds } = sol
  const cg = '#00cc66'
  const sw = 1.5

  const xL = 45
  const xA = 162
  const xC = 303
  const xR = 445
  const yT = 58
  const yM = 132
  const yB = 206

  const Wire = ({ x1, y1, x2, y2, curr }) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={cg} strokeWidth={sw} />
      <CurrentDots x1={x1} y1={y1} x2={x2} y2={y2} current={curr} tick={tick} />
    </g>
  )

  const yR2 = useDiode ? yM - 28 : yM
  const loadCurr = useDiode && ds === 'off' ? 0 : I.R2

  return (
    <svg viewBox="0 0 492 228" style={{ width: '100%', maxWidth: 492 }}>
      <line x1={xL} y1={yB} x2={xR} y2={yB} stroke={cg} strokeWidth={sw} />
      <GndMark x={(xL + xA) / 2} y={yB} />
      <GndMark x={(xA + xC) / 2} y={yB} />
      <GndMark x={(xC + xR) / 2} y={yB} />

      <Wire x1={xL} y1={yT} x2={xL} y2={yM - 20} curr={I.R1} />
      <VSrc cx={xL} cy={yM} v={5} label="V1" on={V1 > 0} />
      <line x1={xL} y1={yM + 20} x2={xL} y2={yB} stroke={cg} strokeWidth={sw} />

      <Wire x1={xL} y1={yT} x2={(xL + xA) / 2 - 21} y2={yT} curr={I.R1} />
      <Res cx={(xL + xA) / 2} cy={yT} label="R1 = 5.1kΩ" />
      <Wire x1={(xL + xA) / 2 + 21} y1={yT} x2={xA} y2={yT} curr={I.R1} />

      <Wire x1={xA} y1={yT} x2={(xA + xC) / 2 - 21} y2={yT} curr={I.R3} />
      <Res cx={(xA + xC) / 2} cy={yT} label="R3 = 2kΩ" />
      <Wire x1={(xA + xC) / 2 + 21} y1={yT} x2={xC} y2={yT} curr={I.R3} />

      <Wire x1={xC} y1={yT} x2={(xC + xR) / 2 - 21} y2={yT} curr={-I.R5} />
      <Res cx={(xC + xR) / 2} cy={yT} label="R5 = 2kΩ" />
      <Wire x1={(xC + xR) / 2 + 21} y1={yT} x2={xR} y2={yT} curr={-I.R5} />

      <line x1={xR} y1={yT} x2={xR} y2={yM - 20} stroke={cg} strokeWidth={sw} />
      <VSrc cx={xR} cy={yM} v={2} label="V2" on={V2 > 0} isV2 />
      <line x1={xR} y1={yM + 20} x2={xR} y2={yB} stroke={cg} strokeWidth={sw} />

      {!useDiode ? (
        <>
          <Wire x1={xA} y1={yT} x2={xA} y2={yM - 19} curr={I.R2} />
          <Res cx={xA} cy={yM} vert label="1kΩ" highlight />
          <Wire x1={xA} y1={yM + 19} x2={xA} y2={yB} curr={I.R2} />
        </>
      ) : (
        <>
          <Wire x1={xA} y1={yT} x2={xA} y2={yR2 - 19} curr={loadCurr} />
          <Res cx={xA} cy={yR2} vert label="1kΩ" highlight />
          <DiodeSym cx={xA} y1={yR2 + 19} y2={yB - 12} ds={ds} />
          <Wire x1={xA} y1={yB - 12} x2={xA} y2={yB} curr={loadCurr} />
        </>
      )}

      <Wire x1={xC} y1={yT} x2={xC} y2={yM - 19} curr={I.R4} />
      <Res cx={xC} cy={yM} vert label="5.1kΩ" />
      <Wire x1={xC} y1={yM + 19} x2={xC} y2={yB} curr={I.R4} />

      <NodeDot cx={xA} cy={yT} label="Va" value={Va} labelAnchor="end" />
      <NodeDot cx={xC} cy={yT} label="Vc" value={Vc} labelAnchor="middle" />

      <rect x={xA + 15} y={yM - 22} width={86} height={44} rx={4} fill="#080f05" stroke="#ddaa22" strokeWidth={1.5} strokeDasharray="5,3" />
      <text x={xA + 58} y={yM - 8} textAnchor="middle" fill="#cc8822" fontSize={8} fontFamily="'Courier New', monospace">V_L (load)</text>
      <text x={xA + 58} y={yM + 10} textAnchor="middle" fill="#ffdd22" fontSize={13} fontFamily="'Courier New', monospace" fontWeight="bold">{VL.toFixed(3)} V</text>

      <circle cx={xR - 16} cy={yB + 18} r={3} fill="#ffe566" />
      <text x={xR - 10} y={yB + 22} fill="#664433" fontSize={8} fontFamily="'Courier New', monospace">= conventional current</text>
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════════════ */
function Toggle({ on, onChange, label, sublabel, color = 'rgba(130,210,180,0.95)' }) {
  return (
    <div className="lab3-toggle-wrap" onClick={() => onChange(!on)}>
      <div className={`lab3-toggle ${on ? 'on' : ''}`} style={on ? { background: color, borderColor: color } : undefined}>
        <div className="lab3-toggle-thumb" style={{ left: on ? 24 : 3 }} />
      </div>
      <div>
        <div className="lab3-toggle-label" style={on ? { color } : undefined}>{label}</div>
        <div className="lab3-toggle-sub">{sublabel}</div>
      </div>
    </div>
  )
}

function Meter({ label, value, unit = 'V', accent = 'default', small = false }) {
  return (
    <div className={`lab3-meter ${small ? 'small' : ''}`}>
      <div className="lab3-meter-label">{label}</div>
      <div className={`lab3-meter-value ${accent}`}>
        {typeof value === 'number' ? `${value.toFixed(3)}${unit}` : '---'}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   SIMULATOR TAB
═══════════════════════════════════════════════ */
function SimTab({ v1, setV1, v2, setV2, useDiode, setUseDiode, sol, V1, V2, tick }) {
  const { Va, Vc, I, ds } = sol

  return (
    <div className="lab3-sim">
      <div className="lab3-toggle-row">
        <Toggle on={v1} onChange={setV1} label="V1 = 5V" sublabel="Left source" color="rgba(130,210,180,0.95)" />
        <Toggle on={v2} onChange={setV2} label="V2 = 2V" sublabel="Right source" color="rgba(100,180,255,0.95)" />
        <div className="lab3-toggle-divider" />
        <Toggle on={useDiode} onChange={setUseDiode} label="Add Diode" sublabel="1N4148 in load path" color="rgba(255,160,80,0.95)" />
        {useDiode && (
          <div className={`lab3-diode-badge ${ds === 'on' ? 'conducting' : ''}`}>
            DIODE: {ds === 'on' ? 'CONDUCTING (0.7V drop)' : 'OPEN / BLOCKING'}
          </div>
        )}
      </div>

      <div className="lab3-circuit-wrap">
        <CircuitDiagram V1={V1} V2={V2} sol={sol} useDiode={useDiode} tick={tick} />
      </div>

      <div className="lab3-meters">
        <Meter label="Va (Node A)" value={Va} accent="node" />
        <Meter label="Vc (Node C)" value={Vc} accent="node" />
        <Meter label="VL (Load)" value={sol.VL} accent="load" />
        <div className="lab3-meter-divider" />
        <Meter label="I through R1" value={I.R1 * 1000} unit="mA" accent="current" small />
        <Meter label="I through R2" value={I.R2 * 1000} unit="mA" accent="current" small />
        <Meter label="I through R4" value={I.R4 * 1000} unit="mA" accent="current" small />
      </div>

      <div className="lab3-note">
        Tip: toggle one source off at a time, record V_L for each case, then add the individual responses to test superposition.
        {useDiode && <span className="lab3-note-diode"> Notice how the diode state changes with source configuration.</span>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   LAB-3-SPECIFIC STYLES
═══════════════════════════════════════════════ */
const styles = `
.lab3-root { display: flex; flex-direction: column; gap: 0; }
.lab3-root .calc-body {
  display: flex; flex-direction: column;
  grid-template-columns: none;
  padding: 18px 20px;
}

/* ── Simulator layout ── */
.lab3-sim { display: flex; flex-direction: column; gap: 16px; align-items: center; }
.lab3-toggle-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: center; width: 100%; }
.lab3-toggle-divider { border-left: 1px solid var(--border); padding-left: 12px; height: 36px; }

.lab3-toggle-wrap {
  display: flex; align-items: center; gap: 10px; cursor: pointer;
}
.lab3-toggle {
  position: relative; width: 46px; height: 24px; border-radius: 12px;
  background: var(--bg-3); border: 1px solid var(--border);
  transition: all .25s;
}
.lab3-toggle.on { }
.lab3-toggle-thumb {
  position: absolute; top: 3px; width: 16px; height: 16px;
  border-radius: 50%; background: var(--text-3); transition: left .25s;
}
.lab3-toggle.on .lab3-toggle-thumb { background: #fff; }
.lab3-toggle-label {
  font-size: 12px; font-family: var(--mono); color: var(--text-3); font-weight: 600;
}
.lab3-toggle-sub {
  font-size: 9px; color: var(--text-3); font-family: var(--mono);
}

.lab3-diode-badge {
  padding: 4px 10px; border-radius: var(--r-sm);
  background: var(--surface); border: 1px solid var(--border);
  font-size: 9px; font-family: var(--mono); color: var(--text-3);
}
.lab3-diode-badge.conducting {
  border-color: rgba(255,160,80,0.3); color: rgba(255,160,80,0.9);
  background: rgba(255,160,80,0.06);
}

.lab3-circuit-wrap {
  background: var(--bg-3); border: 1px solid var(--border);
  border-radius: var(--r); padding: 16px 12px 8px;
  width: 100%;
  display: flex; justify-content: center;
}

/* ── Meters ── */
.lab3-meters { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; width: 100%; }
.lab3-meter-divider { border-left: 1px solid var(--border); padding-left: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
.lab3-meter {
  background: var(--bg-3); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 10px 16px; text-align: center; min-width: 92;
}
.lab3-meter.small { padding: 6px 10px; min-width: 72px; }
.lab3-meter-label {
  font-size: 8px; color: var(--text-3); font-family: var(--mono);
  letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px;
}
.lab3-meter-value {
  font-size: 15px; font-family: var(--mono); font-weight: 700; color: var(--text);
}
.lab3-meter.small .lab3-meter-value { font-size: 11px; }
.lab3-meter-value.node { color: rgba(255,200,100,0.9); }
.lab3-meter-value.load { color: rgba(255,240,100,0.95); }
.lab3-meter-value.current { color: rgba(130,210,180,0.9); }

/* ── Notes ── */
.lab3-note {
  font-size: 11px; color: var(--text-3); font-family: var(--mono);
  padding: 10px 12px; background: var(--bg-3); border-radius: var(--r-sm);
  border-left: 2px solid var(--border); line-height: 1.55;
  width: 100%; text-align: center;
}
.lab3-note-diode { color: rgba(255,160,80,0.65); }

`

/* ═══════════════════════════════════════════════
   CALCULATOR WIDGET
═══════════════════════════════════════════════ */
export function SuperpositionCalc() {
  const [v1, setV1] = useState(true)
  const [v2, setV2] = useState(true)
  const [useDiode, setUseDiode] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 400), 55)
    return () => clearInterval(id)
  }, [])

  const V1 = v1 ? 5 : 0
  const V2 = v2 ? 2 : 0
  const sol = useMemo(() => solve(V1, V2, useDiode), [V1, V2, useDiode])

  return (
    <div className="lab3-root">
      <style>{styles}</style>

      <div className="calc-body">
        <SimTab
          v1={v1}
          setV1={setV1}
          v2={v2}
          setV2={setV2}
          useDiode={useDiode}
          setUseDiode={setUseDiode}
          sol={sol}
          V1={V1}
          V2={V2}
          tick={tick}
        />
      </div>
    </div>
  )
}

// ── Lab content data ──────────────────────────────────────────────────────────
export const labData = {
  objectives: [
    'Explore circuit-solving techniques used in lecture by building two DC circuits that test Thévenin-equivalent ideas and the superposition principle.',
    'Verify superposition on the resistor-only circuit, then compare it against the diode circuit to determine when superposition can and cannot be applied.',
    'Use SPICE/LTspice to simulate the circuits, inspect node voltages and currents, and compare simulation results with hand calculations and bench measurements.',
    'Practice interpreting diode behavior as a non-linear element with an approximate 0.7 V drop when forward biased.',
  ],

  parts: [
    {
      label: 'Prelab',
      duration: '~45 min',
      title: 'Hand analysis + SPICE preparation',
      description: 'Read Lab 3, solve the Figure 3.3 circuit using superposition for the three required cases, then simulate Figures 3.3 and 3.4 in SPICE and complete Table 3.1.',
    },
    {
      label: 'Task 1',
      duration: '~30 min',
      title: 'Verify superposition on the linear circuit (Fig. 3.3)',
      description: 'Build the resistor-only circuit, measure V_L with both sources present, then replace V2 with a short and re-measure. Restore V2, replace V1 with a short, and re-measure again.',
    },
    {
      label: 'Task 2',
      duration: '~25 min',
      title: 'Repeat with the 1N4148 diode (Fig. 3.4)',
      description: 'Insert the diode with the polarity shown in the figure, repeat the same three measurements, and explain why superposition no longer holds for the non-linear circuit.',
    },
    {
      label: 'Report',
      duration: '~20 min',
      title: 'Tables + sample calculations + discussion',
      description: 'Reproduce Tables 3.2 and 3.3, show the calculation method used for the theoretical columns, and discuss why superposition works for the resistor network but fails for the diode circuit.',
    },
  ],

  components: [
    { name: '1.0 kΩ resistor, 1/4 W', value: '1.00 kΩ', qty: 3 },
    { name: '2.0 kΩ resistor, 1/4 W', value: '2.00 kΩ', qty: 2 },
    { name: '3.3 kΩ resistor, 1/4 W', value: '3.30 kΩ', qty: 1 },
    { name: '5.1 kΩ resistor, 1/4 W', value: '5.10 kΩ', qty: 2 },
    { name: '1N4148 signal diode', value: 'forward drop ≈ 0.7 V', qty: 1 },
    { name: '1.5 V AA batteries', value: '~1.5 V each',                     qty: 2 },
    { name: 'DC bench supply',    value: '5 V and 2 V (if available)',      qty: 1 },
    { name: '24 AWG jumper wires', value: 'assorted colors', qty: '≥ 7' },
  ],

  equations: [
    {
      title: 'Superposition',
      subtitle: 'Total response equals the sum of the individual source responses',
      tex: 'V_L = V_{L,1} + V_{L,2}',
      color: 'rgba(130,220,180,0.75)',
      vars: [
        { sym: 'V_L', def: 'Voltage across the 1 kΩ load with all sources active' },
        { sym: 'V_{L,1}', def: 'Load voltage with only V1 present (V2 replaced by a short)' },
        { sym: 'V_{L,2}', def: 'Load voltage with only V2 present (V1 replaced by a short)' },
      ],
      example: 'V_L = V_{L,1} + V_{L,2}',
    },
    {
      title: 'Source zeroing',
      subtitle: 'Deactivate unused sources before solving',
      tex: 'V_s \\rightarrow 0 \\Rightarrow \\text{short}',
      color: 'rgba(245,200,66,0.82)',
      vars: [
        { sym: 'V_s = 0', def: 'A zeroed ideal voltage source is replaced by a short circuit' },
        { sym: 'I_s = 0', def: 'A zeroed ideal current source is replaced by an open circuit' },
      ],
      example: 'To find V_{L,1}, set V_2 = 0 and short its terminals',
    },
    {
      title: 'Thévenin equivalent',
      subtitle: 'Any linear two-terminal network can be reduced to Vth in series with Rth',
      tex: 'V_{th} = V_{oc},\\quad R_{th} = \\dfrac{V_{oc}}{I_{sc}}',
      color: 'rgba(106,169,255,0.82)',
      vars: [
        { sym: 'V_{oc}', def: 'Open-circuit voltage at the load terminals' },
        { sym: 'I_{sc}', def: 'Short-circuit current at the load terminals' },
        { sym: 'R_{th}', def: 'Equivalent resistance seen by the load' },
      ],
      example: 'Remove the load to measure V_{oc}, then short the terminals to measure I_{sc}',
    },
    {
      title: 'Diode model',
      subtitle: 'Piecewise view used for the non-linear case',
      tex: 'V_D \\approx 0.7\\text{ V when forward biased}',
      color: 'rgba(255,120,120,0.78)',
      vars: [
        { sym: 'V_D', def: 'Voltage from anode to cathode when the diode conducts' },
        { sym: 'I_D > 0', def: 'Forward-biased diode conducts with an approximate 0.7 V drop' },
        { sym: 'I_D = 0', def: 'Reverse-biased diode behaves like an open switch' },
      ],
      example: 'If the circuit cannot support about 0.7 V across the diode, treat it as open',
    },
  ],

  notes: [
    'Save your SPICE simulations and calculations; the lab handout says you will need those values in the report.',
    'When testing superposition with voltage sources, replace the inactive source with a short circuit rather than removing it entirely.',
    'Check resistor values and source voltages before building the circuit so measurement error is easier to explain later.',
    'For Task 2, place the 1N4148 diode with the polarity shown in Figure 3.4 or the measured results will not match the intended circuit behavior.',
    'When checking whether the diode is on or off, calculate the voltage at its anode. If that node cannot rise to about 0.7 V, treat the diode as an open circuit for your hand calculation.',
  ],

  images: [
    {
      src: new URL('./images/schematic.png', import.meta.url).href,
      caption: 'Figures 3.3 and 3.4 — resistor-only superposition circuit and the diode-modified version',
      alt: 'ECEN 214 Lab 3 schematics showing the linear circuit and the 1N4148 diode circuit',
    },
  ],

  calculatorTitle: 'Lab 3 Interactive Simulator',
  calculatorIcon: '⊕',
}
