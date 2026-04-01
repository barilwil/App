import { useMemo, useState } from 'react'

const TABS = [
  { id: 'explorer', label: 'Battery Explorer', short: 'Single battery behavior' },
  { id: 'data', label: 'Data Table', short: 'Collect sample points' },
  { id: 'fit', label: 'Linear Fit', short: 'Estimate Vₛ and Rₛ' },
  { id: 'series', label: 'Series Check', short: 'Compare two batteries' },
]

const LOAD_PRESETS = [50, 75, 100, 150, 220, 330, 470, 680, 1000, 1500, 2000]
const MAX_DATA_POINTS = 10

function fmtOhms(value) {
  if (value >= 1000) {
    const k = value / 1000
    return `${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(2)} kΩ`
  }
  return `${Number(value).toFixed(value >= 10 ? 0 : 1)} Ω`
}

function fmtVolts(value, digits = 3) {
  return `${Number(value).toFixed(digits)} V`
}

function fmtMilliAmps(value, digits = 2) {
  return `${Number(value).toFixed(digits)} mA`
}

function fmtMilliWatts(value, digits = 2) {
  return `${Number(value).toFixed(digits)} mW`
}

function practicalSource(vs, rs, rl) {
  const denom = rs + rl
  const vl = denom > 0 ? (vs * rl) / denom : 0
  const il = denom > 0 ? vs / denom : 0
  const currentMa = il * 1000
  const powerLoadMw = rl > 0 ? ((vl * vl) / rl) * 1000 : 0
  const powerSourceMw = vs * il * 1000
  const internalDrop = Math.max(vs - vl, 0)
  const fitX = rl > 0 ? vl / rl : 0
  return { vl, il, currentMa, powerLoadMw, powerSourceMw, internalDrop, fitX }
}

function linearRegression(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const sx = xs.reduce((sum, value) => sum + value, 0)
  const sy = ys.reduce((sum, value) => sum + value, 0)
  const sxy = xs.reduce((sum, value, index) => sum + value * ys[index], 0)
  const sxx = xs.reduce((sum, value) => sum + value * value, 0)
  const denom = n * sxx - sx * sx
  if (Math.abs(denom) < 1e-12) return null
  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  return { slope, intercept }
}

function CalcSlider({ value, min, max, step, onChange, disabled, color = 'rgba(255,255,255,0.85)' }) {
  return (
    <div className="calc-slider-wrap">
      <input
        type="range"
        className={`calc-slider ${disabled ? 'disabled' : ''}`}
        style={{ '--thumb-color': disabled ? 'rgba(255,255,255,0.16)' : color }}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function MetricCard({ label, value, hint, accent = 'default' }) {
  return (
    <div className={`lab2-metric ${accent}`}>
      <div className="lab2-metric-value">{value}</div>
      <div className="lab2-metric-label">{label}</div>
      {hint && <div className="lab2-metric-hint">{hint}</div>}
    </div>
  )
}

function PlotCard({ title, subtitle, xLabel, yLabel, points, line = null, curvePoints = null, xFormatter, yFormatter }) {
  const width = 520
  const height = 280
  const pad = { top: 20, right: 18, bottom: 42, left: 56 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const hasPoints = points.length > 0
  const xValues = hasPoints ? points.map((point) => point.x) : [0, 1]
  const yValues = hasPoints ? points.map((point) => point.y) : [0, 1]

  const rawXMin = Math.min(...xValues)
  const rawXMax = Math.max(...xValues)
  const rawYMin = Math.min(...yValues)
  const rawYMax = Math.max(...yValues)

  const xPad = (rawXMax - rawXMin || 1) * 0.08
  const yPad = (rawYMax - rawYMin || 1) * 0.12

  const xMin = rawXMin - xPad
  const xMax = rawXMax + xPad
  const yMin = rawYMin - yPad
  const yMax = rawYMax + yPad

  const xScale = (value) => pad.left + ((value - xMin) / (xMax - xMin || 1)) * innerW
  const yScale = (value) => height - pad.bottom - ((value - yMin) / (yMax - yMin || 1)) * innerH

  const xTicks = Array.from({ length: 6 }, (_, index) => xMin + ((xMax - xMin) * index) / 5)
  const yTicks = Array.from({ length: 6 }, (_, index) => yMin + ((yMax - yMin) * index) / 5)

  const linePoints = line
    ? `${xScale(xMin)},${yScale(line.intercept + line.slope * xMin)} ${xScale(xMax)},${yScale(line.intercept + line.slope * xMax)}`
    : null

  return (
    <div className="lab2-plot-card">
      <div className="lab2-plot-title">{title}</div>
      <div className="lab2-plot-subtitle">{subtitle}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="lab2-plot-svg" role="img" aria-label={title}>
        {xTicks.map((tick, index) => (
          <g key={`x-${index}`}>
            <line x1={xScale(tick)} y1={pad.top} x2={xScale(tick)} y2={height - pad.bottom} className="lab2-grid" />
            <text x={xScale(tick)} y={height - 18} className="lab2-tick" textAnchor="middle">{xFormatter(tick)}</text>
          </g>
        ))}
        {yTicks.map((tick, index) => (
          <g key={`y-${index}`}>
            <line x1={pad.left} y1={yScale(tick)} x2={width - pad.right} y2={yScale(tick)} className="lab2-grid" />
            <text x={pad.left - 8} y={yScale(tick) + 3} className="lab2-tick" textAnchor="end">{yFormatter(tick)}</text>
          </g>
        ))}
        <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} className="lab2-axis" />
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} className="lab2-axis" />

        {curvePoints?.length > 1 && <polyline points={curvePoints.map((point) => `${xScale(point.x)},${yScale(point.y)}`).join(' ')} className="lab2-fit-curve" />}
        {linePoints && <polyline points={linePoints} className="lab2-fit-line" />}
        {points.map((point, index) => (
          <circle key={index} cx={xScale(point.x)} cy={yScale(point.y)} r="4.5" className="lab2-point" />
        ))}

        <text x={width / 2} y={height - 4} className="lab2-axis-label" textAnchor="middle">{xLabel}</text>
        <text x="15" y={height / 2} className="lab2-axis-label" textAnchor="middle" transform={`rotate(-90 15 ${height / 2})`}>
          {yLabel}
        </text>
      </svg>
      {!points.length && <div className="lab2-empty">Add measurements in the Data Table tab to populate this plot.</div>}
    </div>
  )
}

const styles = `
.lab2-root { display: flex; flex-direction: column; gap: 0; }
.lab2-root .calc-tab { min-height: 56px; }
.lab2-root .calc-tab-desc { white-space: normal; text-align: center; line-height: 1.3; }
.lab2-panel {
  padding: 14px;
  border-radius: var(--r);
  background: var(--bg-3);
  border: 1px solid var(--border);
}
.lab2-section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: var(--mono);
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
  margin-bottom: 10px;
}
.lab2-kicker {
  font-size: 11px;
  color: var(--text-3);
  font-family: var(--mono);
}
.lab2-note {
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.55;
}
.lab2-note.warning {
  border-left: 3px solid rgba(240,100,100,0.55);
  color: rgba(255,210,210,0.9);
}
.lab2-note.success {
  border-left: 3px solid rgba(130,210,180,0.55);
}
.lab2-grid-2 { display: grid; grid-template-columns: 1fr 1.12fr; gap: 20px; align-items: start; }
.lab2-fit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.lab2-series-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.lab2-controls { display: flex; flex-direction: column; gap: 16px; }
.lab2-inline-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.lab2-btn {
  padding: 8px 12px;
  border-radius: var(--pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
  font-family: var(--mono);
  cursor: pointer;
  transition: all 0.15s;
}
.lab2-btn:hover { border-color: var(--border-2); color: var(--text); background: var(--surface-2); }
.lab2-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.lab2-btn.active { border-color: rgba(255,255,255,0.22); color: var(--text); background: var(--surface-2); }
.lab2-btn.danger:hover { border-color: rgba(240,100,100,0.25); color: rgba(255,210,210,0.95); }
.lab2-table-panel { max-height: 660px; display: flex; flex-direction: column; }
.lab2-table-wrap { overflow-x: auto; overflow-y: auto; border-radius: var(--r-sm); max-height: 400px; }
.lab2-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.lab2-table th {
  text-align: left;
  padding: 8px 10px;
  color: var(--text-3);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
  font-family: var(--mono);
}
.lab2-table td {
  padding: 9px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: var(--text-2);
}
.lab2-table td.mono { font-family: var(--mono); }
.lab2-table td.delete-cell { text-align: right; }
.lab2-delete {
  background: transparent;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 14px;
}
.lab2-delete:hover { color: rgba(255,170,170,0.95); }
.lab2-empty {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-3);
}
.lab2-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.lab2-metric {
  padding: 12px;
  border-radius: var(--r-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}
.lab2-metric-value {
  font-family: var(--mono);
  font-size: 16px;
  color: var(--text);
  margin-bottom: 4px;
}
.lab2-metric-label {
  font-size: 9px;
  color: var(--text-3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-family: var(--mono);
}
.lab2-metric-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.45;
}
.lab2-metric.good .lab2-metric-value { color: rgba(130,210,180,0.95); }
.lab2-metric.warn .lab2-metric-value { color: rgba(255,200,120,0.95); }
.lab2-metric.danger .lab2-metric-value { color: rgba(255,140,140,0.96); }
.lab2-plot-card {
  padding: 12px;
  border-radius: var(--r);
  background: var(--bg-3);
  border: 1px solid var(--border);
}
.lab2-plot-title { font-size: 14px; color: var(--text); margin-bottom: 2px; }
.lab2-plot-subtitle { font-size: 11px; color: var(--text-3); margin-bottom: 8px; }
.lab2-plot-svg { width: 100%; height: auto; display: block; }
.lab2-grid { stroke: rgba(255,255,255,0.06); stroke-width: 1; }
.lab2-axis { stroke: rgba(255,255,255,0.16); stroke-width: 1.5; }
.lab2-fit-line { fill: none; stroke: rgba(130,210,180,0.9); stroke-width: 2.2; }
.lab2-fit-curve { fill: none; stroke: rgba(130,210,180,0.9); stroke-width: 2.2; }
.lab2-point { fill: rgba(255,255,255,0.92); stroke: rgba(0,0,0,0.35); stroke-width: 1.5; }
.lab2-tick {
  fill: var(--text-3);
  font-size: 9px;
  font-family: var(--mono);
}
.lab2-axis-label {
  fill: var(--text-2);
  font-size: 10px;
  font-family: var(--mono);
  letter-spacing: 0.05em;
}
.lab2-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.lab2-summary-card {
  padding: 12px;
  border-radius: var(--r-sm);
  background: var(--bg-3);
  border: 1px solid var(--border);
}
.lab2-summary-title {
  font-size: 9px;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: var(--mono);
  margin-bottom: 8px;
}
.lab2-summary-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  margin-bottom: 8px;
}
.lab2-summary-row:last-child { margin-bottom: 0; }
.lab2-summary-key { color: var(--text-2); }
.lab2-summary-value { color: var(--text); font-family: var(--mono); }
.lab2-summary-value.good { color: rgba(130,210,180,0.95); }
.lab2-summary-value.warn { color: rgba(255,200,120,0.95); }
@media (max-width: 980px) {
  .lab2-grid-2,
  .lab2-fit-grid,
  .lab2-series-grid,
  .lab2-summary-grid,
  .lab2-metrics,
  .calc-body {
    grid-template-columns: 1fr;
  }
}
`

export function NonIdealSourceCalc() {
  const [tab, setTab] = useState('explorer')

  const [vs, setVs] = useState(1.5)
  const [rs, setRs] = useState(2.0)
  const [rl, setRl] = useState(100)

  const [trueVs, setTrueVs] = useState(1.51)
  const [trueRs, setTrueRs] = useState(2.2)
  const [measureRl, setMeasureRl] = useState(100)
  const [measurements, setMeasurements] = useState([])

  const [vsA, setVsA] = useState(1.52)
  const [rsA, setRsA] = useState(1.9)
  const [vsB, setVsB] = useState(1.48)
  const [rsB, setRsB] = useState(2.1)
  const [seriesRl, setSeriesRl] = useState(220)

  const single = useMemo(() => practicalSource(vs, rs, rl), [vs, rs, rl])
  const preview = useMemo(() => practicalSource(trueVs, trueRs, measureRl), [trueVs, trueRs, measureRl])

  const regression = useMemo(() => {
    if (measurements.length < 2) return null
    const xs = measurements.map((row) => (row.vl / row.rlMeasured) * 1000)
    const ys = measurements.map((row) => row.vl)
    const line = linearRegression(xs, ys)
    if (!line) return null
    const fitVs = line.intercept
    const fitRs = -line.slope * 1000
    const pointsCurve = measurements.map((row) => ({ x: row.rlMeasured, y: row.vl }))
    const rlValues = measurements.map((row) => row.rlMeasured)
    const minRl = Math.min(...rlValues)
    const maxRl = Math.max(...rlValues)
    const fitCurve = Array.from({ length: 60 }, (_, index) => {
      const rlValue = minRl + ((maxRl - minRl || 1) * index) / 59
      return {
        x: rlValue,
        y: (fitVs * rlValue) / (rlValue + Math.max(fitRs, 1e-6)),
      }
    })
    return {
      ...line,
      fitVs,
      fitRs,
      pointsCurve,
      fitCurve,
      pointsLinear: xs.map((x, index) => ({ x, y: ys[index] })),
      errorVs: Math.abs(((fitVs - trueVs) / trueVs) * 100),
      errorRs: Math.abs(((fitRs - trueRs) / trueRs) * 100),
    }
  }, [measurements, trueVs, trueRs])

  const seriesEquivalent = useMemo(() => {
    const vsEq = vsA + vsB
    const rsEq = rsA + rsB
    return {
      vsEq,
      rsEq,
      ...practicalSource(vsEq, rsEq, seriesRl),
    }
  }, [vsA, rsA, vsB, rsB, seriesRl])

  const loadIsUnsafe = rl < 10
  const previewUnsafe = measureRl < 10
  const seriesUnsafe = seriesRl < 10

  const handleAddMeasurement = () => {
    if (measurements.length >= MAX_DATA_POINTS) return
    const nominal = measureRl
    const rlMeasured = Number((nominal * (1 + (Math.random() - 0.5) * 0.024)).toFixed(1))
    const ideal = practicalSource(trueVs, trueRs, rlMeasured)
    const noisyVl = Number((ideal.vl * (1 + (Math.random() - 0.5) * 0.01)).toFixed(4))
    setMeasurements((rows) => [
      ...rows,
      {
        id: `${Date.now()}-${rows.length}`,
        rlNominal: nominal,
        rlMeasured,
        vl: noisyVl,
      },
    ])
  }

  const handleDeleteMeasurement = (id) => {
    setMeasurements((rows) => rows.filter((row) => row.id !== id))
  }

  const clearMeasurements = () => setMeasurements([])

  return (
    <div className="lab2-root">
      <style>{styles}</style>

      <div className="calc-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`calc-tab ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <span className="calc-tab-id">{item.label}</span>
            <span className="calc-tab-desc">{item.short}</span>
          </button>
        ))}
      </div>

      {tab === 'explorer' && (
        <div className="calc-body">
          <div className="calc-controls">
            <div className="calc-ctrl-group">
              <div className="calc-ctrl-label">Source Parameters</div>
              <div className="calc-ctrl-row">
                <span className="calc-ctrl-name">Vₛ</span>
                <span className="calc-ctrl-val">{fmtVolts(vs, 2)}</span>
              </div>
              <CalcSlider value={vs} min={1.2} max={1.65} step={0.01} onChange={setVs} />

              <div className="calc-ctrl-row" style={{ marginTop: 10 }}>
                <span className="calc-ctrl-name">Rₛ</span>
                <span className="calc-ctrl-val">{fmtOhms(rs)}</span>
              </div>
              <CalcSlider value={rs} min={0.1} max={10} step={0.1} onChange={setRs} color="rgba(130,210,180,0.85)" />
            </div>

            <div className="calc-ctrl-group">
              <div className="calc-ctrl-label">Load</div>
              <div className="calc-ctrl-row">
                <span className="calc-ctrl-name">Rₗ</span>
                <span className="calc-ctrl-val">{fmtOhms(rl)}</span>
              </div>
              <CalcSlider value={rl} min={10} max={2000} step={10} onChange={setRl} />
              <div className="calc-rl-select">
                {LOAD_PRESETS.map((value) => (
                  <button
                    key={value}
                    className={`calc-rl-btn ${rl === value ? 'active' : ''}`}
                    onClick={() => setRl(value)}
                  >
                    {value >= 1000 ? `${value / 1000}kΩ` : `${value}Ω`}
                  </button>
                ))}
              </div>
            </div>

            <div className="calc-hint">
              Use this tab like a quick intuition builder: when Rₗ gets large, Vₗ approaches the open-circuit voltage. When Rₗ gets small, more of the source voltage drops across Rₛ.
            </div>

            <div className={`lab2-note ${loadIsUnsafe ? 'warning' : ''}`}>
              Lab reminder: the handout says not to place a resistance less than 10 Ω directly across the battery. Staying roughly in the 50 Ω to 2000 Ω range gives a safer and more useful measurement sweep.
            </div>
          </div>

          <div className="calc-output">
            <div className={`calc-dmm ${loadIsUnsafe ? 'out-range' : 'in-range'}`}>
              <div className="calc-dmm-label">Load Voltage</div>
              <div className="calc-dmm-value">{fmtVolts(single.vl, 4)}</div>
              <div className={`calc-dmm-status ${loadIsUnsafe ? 'out' : 'in'}`}>
                <div className="calc-dmm-dot" />
                {loadIsUnsafe ? 'TOO LOW FOR LAB USE' : 'WITHIN THE HANDOUT SWEEP RANGE'}
              </div>
              <div className="calc-bar-track">
                <div className={`calc-bar-fill ${loadIsUnsafe ? 'danger' : ''}`} style={{ width: `${Math.min(100, (single.vl / Math.max(vs, 0.01)) * 100)}%` }} />
                <div className="calc-bar-markers"><span>0</span><span>½Vₛ</span><span>Vₛ</span><span>open</span></div>
              </div>
            </div>

            <div className="lab2-metrics">
              <MetricCard label="Load current" value={fmtMilliAmps(single.currentMa, 3)} hint="Current through the series loop." />
              <MetricCard label="Power in Rₗ" value={fmtMilliWatts(single.powerLoadMw, 2)} hint="Useful power delivered to the load." accent="good" />
              <MetricCard label="Drop across Rₛ" value={fmtVolts(single.internalDrop, 4)} hint="What the internal resistance steals." accent="warn" />
            </div>

            <div className="calc-formula">
              <div className="calc-formula-label">Live calculation</div>
              <div className="calc-formula-eq">Vₗ = Vₛ × Rₗ / (Rₗ + Rₛ)</div>
              <div className="calc-formula-nums">= {vs.toFixed(2)} × {rl.toFixed(0)} / ({rl.toFixed(0)} + {rs.toFixed(1)})</div>
              <div className="calc-formula-result">= {fmtVolts(single.vl, 4)}</div>
              <div className="calc-formula-note">For the linearized plot used in the report, the x-axis is Vₗ/Rₗ, which is numerically the current.</div>
            </div>

            <div className="calc-prelab">
              <div className="calc-prelab-title">What to watch in lab</div>
              <div className="calc-prelab-row"><span>Open circuit</span><span>Vₗ ≈ Vₛ</span></div>
              <div className="calc-prelab-row"><span>Low load resistance</span><span>larger current and larger Rₛ drop</span></div>
              <div className="calc-prelab-row"><span>Better fitting</span><span>collect 7+ points across the range</span></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="lab2-grid-2">
          <div className="lab2-controls">
            <div className="lab2-panel">
              <div className="lab2-section-title">Hidden sample source</div>
              <div className="lab2-kicker" style={{ marginBottom: 10 }}>
                This simulates the unknown battery you are trying to characterize.
              </div>
              <div className="calc-ctrl-row">
                <span className="calc-ctrl-name">True Vₛ</span>
                <span className="calc-ctrl-val">{fmtVolts(trueVs, 3)}</span>
              </div>
              <CalcSlider value={trueVs} min={1.2} max={1.65} step={0.005} onChange={setTrueVs} />
              <div className="calc-ctrl-row" style={{ marginTop: 10 }}>
                <span className="calc-ctrl-name">True Rₛ</span>
                <span className="calc-ctrl-val">{fmtOhms(trueRs)}</span>
              </div>
              <CalcSlider value={trueRs} min={0.1} max={10} step={0.1} onChange={setTrueRs} color="rgba(130,210,180,0.85)" />
            </div>

            <div className="lab2-panel">
              <div className="lab2-section-title">Measurement point</div>
              <div className="calc-ctrl-row">
                <span className="calc-ctrl-name">Nominal Rₗ</span>
                <span className="calc-ctrl-val">{fmtOhms(measureRl)}</span>
              </div>
              <CalcSlider value={measureRl} min={10} max={2500} step={5} onChange={setMeasureRl} />
              <div className="lab2-inline-actions" style={{ marginTop: 10 }}>
                {LOAD_PRESETS.map((value) => (
                  <button
                    key={value}
                    className={`lab2-btn ${measureRl === value ? 'active' : ''}`}
                    onClick={() => setMeasureRl(value)}
                  >
                    {value >= 1000 ? `${value / 1000}kΩ` : `${value}Ω`}
                  </button>
                ))}
              </div>
            </div>

            <div className="calc-dmm in-range">
              <div className="calc-dmm-label">Preview reading</div>
              <div className="calc-dmm-value">{fmtVolts(preview.vl, 4)}</div>
              <div className="calc-dmm-status in">
                <div className="calc-dmm-dot" />
                READY TO LOG A SAMPLE ROW
              </div>
            </div>

            <div className="lab2-inline-actions">
              <button className="lab2-btn active" onClick={handleAddMeasurement} disabled={measurements.length >= MAX_DATA_POINTS}>Measure → Add row</button>
              <button className="lab2-btn danger" onClick={clearMeasurements}>Clear table</button>
            </div>

            <div className={`lab2-note ${measurements.length >= MAX_DATA_POINTS || previewUnsafe ? 'warning' : ''}`}>
              {measurements.length >= MAX_DATA_POINTS ? 'You have reached the 10-row cap for this practice table. Delete a row or clear the table to log a different point.' : 'In the real lab you would record nominal Rₗ, measured Rₗ, and measured Vₗ for battery 1, battery 2, and then the series pair. This table gives you the same structure for quick practice.'}
            </div>
          </div>

          <div className="lab2-panel lab2-table-panel">
            <div className="lab2-section-title">Collected rows ({measurements.length}/{MAX_DATA_POINTS})</div>
            <div className="lab2-table-wrap">
              <table className="lab2-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nominal Rₗ</th>
                    <th>Measured Rₗ</th>
                    <th>Measured Vₗ</th>
                    <th>Vₗ/Rₗ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td className="mono">{fmtOhms(row.rlNominal)}</td>
                      <td className="mono">{fmtOhms(row.rlMeasured)}</td>
                      <td className="mono">{fmtVolts(row.vl, 4)}</td>
                      <td className="mono">{fmtMilliAmps((row.vl / row.rlMeasured) * 1000, 3)}</td>
                      <td className="delete-cell"><button className="lab2-delete" onClick={() => handleDeleteMeasurement(row.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!measurements.length && <div className="lab2-empty">No rows yet. Add up to 10 measurements spread across roughly 50 Ω to 2000 Ω.</div>}
          </div>
        </div>
      )}

      {tab === 'fit' && (
        <div className="lab2-controls">
          <div className="lab2-fit-grid">
            <PlotCard
              title="Measured Vₗ vs Rₗ"
              subtitle="This is the direct battery sweep from the lab report."
              xLabel="Rₗ (Ω)"
              yLabel="Vₗ (V)"
              points={regression?.pointsCurve ?? []}
              curvePoints={regression?.fitCurve ?? null}
              xFormatter={(value) => `${Math.round(value)}`}
              yFormatter={(value) => value.toFixed(3)}
            />
            <PlotCard
              title="Linearized Vₗ vs Vₗ/Rₗ"
              subtitle="The best-fit line should have intercept Vₛ and slope −Rₛ."
              xLabel="Vₗ / Rₗ  (mA)"
              yLabel="Vₗ (V)"
              points={regression?.pointsLinear ?? []}
              line={regression ? { slope: regression.slope, intercept: regression.intercept } : null}
              xFormatter={(value) => value.toFixed(2)}
              yFormatter={(value) => value.toFixed(3)}
            />
          </div>

          <div className="lab2-summary-grid">
            <div className="lab2-summary-card">
              <div className="lab2-summary-title">Extracted from fit</div>
              <div className="lab2-summary-row"><span className="lab2-summary-key">Vₛ</span><span className="lab2-summary-value">{regression ? fmtVolts(regression.fitVs, 4) : '—'}</span></div>
              <div className="lab2-summary-row"><span className="lab2-summary-key">Rₛ</span><span className="lab2-summary-value">{regression ? fmtOhms(regression.fitRs) : '—'}</span></div>
            </div>
            <div className="lab2-summary-card">
              <div className="lab2-summary-title">True practice values</div>
              <div className="lab2-summary-row"><span className="lab2-summary-key">Vₛ</span><span className="lab2-summary-value good">{fmtVolts(trueVs, 3)}</span></div>
              <div className="lab2-summary-row"><span className="lab2-summary-key">Rₛ</span><span className="lab2-summary-value good">{fmtOhms(trueRs)}</span></div>
            </div>
            <div className="lab2-summary-card">
              <div className="lab2-summary-title">Fit error</div>
              <div className="lab2-summary-row"><span className="lab2-summary-key">ΔVₛ</span><span className="lab2-summary-value warn">{regression ? `${regression.errorVs.toFixed(2)}%` : '—'}</span></div>
              <div className="lab2-summary-row"><span className="lab2-summary-key">ΔRₛ</span><span className="lab2-summary-value warn">{regression ? `${regression.errorRs.toFixed(2)}%` : '—'}</span></div>
            </div>
          </div>

          <div className={`lab2-note ${regression ? 'success' : ''}`}>
            {regression
              ? `With ${measurements.length} rows, the linearized fit gives Vₛ = ${regression.fitVs.toFixed(4)} V and Rₛ = ${regression.fitRs.toFixed(3)} Ω. In the real report, explain why resistor tolerance, meter noise, and limited spread in Rₗ values affect these estimates.`
              : 'You need at least two rows for a line, but the handout asks for several measurements spanning the range. Add a fuller data sweep in the Data Table tab first.'}
          </div>
        </div>
      )}

      {tab === 'series' && (
        <div className="lab2-series-grid">
          <div className="lab2-controls">
            <div className="lab2-panel">
              <div className="lab2-section-title">Battery A</div>
              <div className="calc-ctrl-row"><span className="calc-ctrl-name">Vₛ₁</span><span className="calc-ctrl-val">{fmtVolts(vsA, 2)}</span></div>
              <CalcSlider value={vsA} min={1.2} max={1.65} step={0.01} onChange={setVsA} />
              <div className="calc-ctrl-row" style={{ marginTop: 10 }}><span className="calc-ctrl-name">Rₛ₁</span><span className="calc-ctrl-val">{fmtOhms(rsA)}</span></div>
              <CalcSlider value={rsA} min={0.1} max={10} step={0.1} onChange={setRsA} color="rgba(130,210,180,0.85)" />
            </div>

            <div className="lab2-panel">
              <div className="lab2-section-title">Battery B</div>
              <div className="calc-ctrl-row"><span className="calc-ctrl-name">Vₛ₂</span><span className="calc-ctrl-val">{fmtVolts(vsB, 2)}</span></div>
              <CalcSlider value={vsB} min={1.2} max={1.65} step={0.01} onChange={setVsB} />
              <div className="calc-ctrl-row" style={{ marginTop: 10 }}><span className="calc-ctrl-name">Rₛ₂</span><span className="calc-ctrl-val">{fmtOhms(rsB)}</span></div>
              <CalcSlider value={rsB} min={0.1} max={10} step={0.1} onChange={setRsB} color="rgba(130,210,180,0.85)" />
            </div>

            <div className="lab2-panel">
              <div className="lab2-section-title">Series load</div>
              <div className="calc-ctrl-row"><span className="calc-ctrl-name">Rₗ</span><span className="calc-ctrl-val">{fmtOhms(seriesRl)}</span></div>
              <CalcSlider value={seriesRl} min={10} max={2000} step={10} onChange={setSeriesRl} />
              <div className="calc-hint" style={{ marginTop: 10 }}>
                In the ideal comparison, the two-battery series model should satisfy Vₛ,total = Vₛ₁ + Vₛ₂ and Rₛ,total = Rₛ₁ + Rₛ₂.
              </div>
            </div>
          </div>

          <div className="calc-output">
            <div className={`calc-dmm ${seriesUnsafe ? 'out-range' : 'in-range'}`}>
              <div className="calc-dmm-label">Series-pair load voltage</div>
              <div className="calc-dmm-value">{fmtVolts(seriesEquivalent.vl, 4)}</div>
              <div className={`calc-dmm-status ${seriesUnsafe ? 'out' : 'in'}`}>
                <div className="calc-dmm-dot" />
                {seriesUnsafe ? 'TOO LOW FOR LAB USE' : 'MATCH THIS AGAINST YOUR MEASURED SERIES SWEEP'}
              </div>
            </div>

            <div className="lab2-metrics">
              <MetricCard label="Vₛ,total" value={fmtVolts(seriesEquivalent.vsEq, 3)} hint="Expected sum of the two open-circuit voltages." accent="good" />
              <MetricCard label="Rₛ,total" value={fmtOhms(seriesEquivalent.rsEq)} hint="Expected sum of the two internal resistances." accent="good" />
              <MetricCard label="Iₗ,total" value={fmtMilliAmps(seriesEquivalent.currentMa, 3)} hint="Predicted loop current for the series pair." accent="warn" />
            </div>

            <div className="calc-formula">
              <div className="calc-formula-label">Series comparison</div>
              <div className="calc-formula-eq">Vₛ,total = Vₛ₁ + Vₛ₂</div>
              <div className="calc-formula-nums">= {vsA.toFixed(2)} + {vsB.toFixed(2)} = {seriesEquivalent.vsEq.toFixed(3)} V</div>
              <div className="calc-formula-eq" style={{ marginTop: 8 }}>Rₛ,total = Rₛ₁ + Rₛ₂</div>
              <div className="calc-formula-nums">= {rsA.toFixed(1)} + {rsB.toFixed(1)} = {seriesEquivalent.rsEq.toFixed(2)} Ω</div>
              <div className="calc-formula-note">Your measured series result should be close to these sums, but contact resistance, meter noise, and battery mismatch can cause differences.</div>
            </div>

            <div className="lab2-note">
              This tab is meant to mirror Task 2 of the handout: characterize each battery individually, then check whether the model for the series combination agrees with the sum of the two single-battery models.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const labData = {
  calculatorTitle: 'Non-Ideal Sources Calculator',
  calculatorIcon: '⊞',

  objectives: [
    'Model a practical AA battery as an ideal voltage source in series with a source resistance.',
    'Measure load voltage for several resistor values and estimate the battery’s Thevenin-equivalent Vₛ and Rₛ.',
    'Use the linearized Vₗ versus Vₗ/Rₗ relationship to extract source parameters from measured data.',
    'Repeat the workflow for a second AA battery and then for the series combination of two batteries.',
    'Discuss likely uncertainty sources such as resistor tolerance, measurement noise, and incorrect meter placement.',
  ],

  parts: [
    {
      label: 'Prelab',
      duration: '~20 min',
      title: 'Review the source model',
      description: 'Work the given practical-source questions, connect open-circuit and short-circuit conditions to Thevenin parameters, and check the linearized fit idea before you enter the lab.',
    },
    {
      label: 'Task 1',
      duration: '~35 min',
      title: 'Characterize one AA battery',
      description: 'Collect at least 7 load points over roughly 50 Ω to 2000 Ω, then fit the measured data to estimate Vₛ and Rₛ for the first battery.',
    },
    {
      label: 'Task 2A',
      duration: '~20 min',
      title: 'Repeat with a second battery',
      description: 'Use the same measurement method on a second AA battery and build a second practical-source model.',
    },
    {
      label: 'Task 2B',
      duration: '~25 min',
      title: 'Measure the series pair',
      description: 'Place the two batteries in series, repeat the sweep, and compare the measured combined model to the sum of the two individual models.',
    },
  ],

  components: [
    { name: 'AA batteries with holders', value: '1.5 V nominal', qty: 2 },
    { name: 'Load resistors / combinations', value: '≈ 50 Ω to 2000 Ω, 1/4 W', qty: 'assorted' },
    { name: 'Digital multimeter / PMD', value: 'measure V, I, and R', qty: 1 },
    { name: 'Breadboard', value: 'solderless', qty: 1 },
    { name: 'Jumper wires', value: 'assorted', qty: 'set' },
  ],

  equations: [
    {
      title: 'Load Voltage',
      subtitle: 'Voltage-divider form for a practical source',
      tex: 'V_L = V_S \\cdot \\dfrac{R_L}{R_L + R_S}',
      color: 'rgba(106,169,255,0.82)',
      vars: [
        { sym: 'V_S', def: 'Open-circuit battery voltage in the practical-source model' },
        { sym: 'R_S', def: 'Internal source resistance of the battery' },
        { sym: 'R_L', def: 'External load resistor across the battery terminals' },
        { sym: 'V_L', def: 'Measured voltage across the load' },
      ],
      example: 'V_S=1.50\\text{ V},\\ R_S=2\\Omega,\\ R_L=100\\Omega \\Rightarrow V_L \\approx 1.471\\text{ V}',
    },
    {
      title: 'Load Current',
      subtitle: 'Same current flows through Rₛ and Rₗ',
      tex: 'I_L = \\dfrac{V_S}{R_L + R_S}',
      color: 'rgba(245,200,66,0.82)',
      vars: [
        { sym: 'I_L', def: 'Load current through the single-loop practical-source circuit' },
        { sym: 'V_S', def: 'Source voltage of the battery model' },
        { sym: 'R_L + R_S', def: 'Total series resistance seen by the source' },
      ],
      example: 'V_S=1.50\\text{ V},\\ R_L=100\\Omega,\\ R_S=2\\Omega \\Rightarrow I_L \\approx 14.7\\text{ mA}',
    },
    {
      title: 'Linearized Fit',
      subtitle: 'Use the best-fit line to identify Vₛ and Rₛ',
      tex: 'V_L = V_S - \\left(\\dfrac{V_L}{R_L}\\right) R_S',
      color: 'rgba(69,209,175,0.82)',
      vars: [
        { sym: 'V_L', def: 'Vertical-axis variable in the linearized plot' },
        { sym: 'V_L/R_L', def: 'Horizontal-axis variable; numerically equal to current' },
        { sym: 'V_S', def: 'Y-intercept of the fitted line' },
        { sym: 'R_S', def: 'Magnitude of the negative slope' },
      ],
      example: 'y = V_L,\\ x = V_L / R_L \\Rightarrow y = V_S - R_S x',
    },
  ],

  notes: [
    'Measure voltage with the meter in parallel across the load resistor, and measure current with the meter in series with the circuit loop.',
    'The handout asks for at least 7 load points spanning about 50 Ω to 2000 Ω so that the fit is not dominated by only one resistance region.',
    'Do not connect a resistance less than 10 Ω directly across the battery terminals; the lab explicitly warns against it.',
    'Measure the actual resistor values with the DMM and comment on how the difference from nominal values affects the fitted source parameters.',
    'Your report should include data tables for battery 1, battery 2, and the two-battery series combination.',
  ],

  images: [
    {
      src:     new URL('./images/schematic.jpg', import.meta.url).href,
      caption: 'Circuit Schematic',
      alt:     'Non-ideal source circuit schematic',
    },
  ],
}
