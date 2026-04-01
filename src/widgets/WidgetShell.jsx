                               // ── WidgetShell ───────────────────────────────────────────────────────────────
// Owns the full lab dashboard layout. Receives a `data` object from the widget
// registry and renders all sections in standard order.
//
// Props:
//   lab        — lab record from DB
//   course     — course record from DB
//   ta         — TA object { name, email } from session
//   data       — labData exported by the widget (objectives, parts, components, equations, notes, images)
//   calculator — optional React component rendered in the Calculator section

import { useState } from 'react'
import { createPortal } from 'react-dom'

// ── Math / equation helpers ────────────────────────────────────────────────────
function MathSpan({ tex }) {
  const clean = tex
    // 1. Expand \text{...} first so \frac patterns can match around it
    .replace(/\\text\{([^}]*)\}/g, '$1')
    // 2. \left / \right — keep the delimiter, drop the command word
    .replace(/\\left\s*\(/g, '(').replace(/\\right\s*\)/g, ')')
    .replace(/\\left\s*\[/g, '[').replace(/\\right\s*\]/g, ']')
    .replace(/\\left\s*\|/g, '|').replace(/\\right\s*\|/g, '|')
    .replace(/\\left\s*\./g, '').replace(/\\right\s*\./g, '')
    .replace(/\\left\b/g, '').replace(/\\right\b/g, '')
    // 3. Math symbols
    .replace(/\\Omega\b/g, 'Ω').replace(/\\omega\b/g, 'ω')
    .replace(/\\Rightarrow\b/g, '→').replace(/\\rightarrow\b/g, '→')
    .replace(/\\Leftarrow\b/g, '←').replace(/\\leftarrow\b/g, '←')
    .replace(/\\approx\b/g, '≈').replace(/\\times\b/g, '×').replace(/\\cdot\b/g, '×')
    .replace(/\\\|/g, '∥')
    // 4. Fractions (now safe — \text{} already expanded)
    .replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g,  '($1) / ($2)')
    // 5. Subscripts
    .replace(/_\{([^}]+)\}/g, (_, s) => s.split('').map(c => '₀₁₂₃₄₅₆₇₈₉ₐₑₒₓ'['0123456789aeoxi'.indexOf(c)] || c).join(''))
    .replace(/_([a-zA-Z0-9])/g, (_, c) => '₀₁₂₃₄₅₆₇₈₉ₐₑₒₓ'['0123456789aeoxi'.indexOf(c)] || c)
    // 6. Spacing commands
    .replace(/\\[,;!]/g, ' ').replace(/\\ /g, ' ')
    // 7. Strip any remaining \command words, lone backslashes, then braces
    .replace(/\\[a-zA-Z]+/g, '').replace(/\\/g, '')
    .replace(/\{|\}/g, '')
    // 8. Normalize whitespace
    .replace(/\s+/g, ' ').trim()
  return <span className="math-span">{clean}</span>
}

function EqCard({ title, subtitle, tex, color, vars, example }) {
  const [hovered, setHovered] = useState(false)
  const [coords, setCoords]   = useState({ x: 0, y: 0 })
  const onMove = (e) => {
    const TW = 280, TH = 260, OFFSET = 8
    const vw = window.innerWidth, vh = window.innerHeight
    let x = e.clientX + OFFSET
    let y = e.clientY + OFFSET
    if (x + TW > vw - 16) x = e.clientX - TW - OFFSET
    if (y + TH > vh - 16) y = e.clientY - TH - OFFSET
    setCoords({ x, y })
  }
  return (
    <div
      className={`eq-card ${hovered ? 'hovered' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={onMove}
    >
      <div className="eq-card-accent" style={{ background: color }} />
      <div className="eq-card-title">{title}</div>
      <div className="eq-card-katex"><MathSpan tex={tex} /></div>
      <div className="eq-card-subtitle">{subtitle}</div>
      {hovered && createPortal(
        <div className="eq-tooltip" style={{ position: 'fixed', left: coords.x, top: coords.y, pointerEvents: 'none' }}>
          <div className="eq-tooltip-section">
            <div className="eq-tooltip-label">Variables</div>
            {vars.map((v, i) => (
              <div key={i} className="eq-tooltip-var">
                <span className="eq-tooltip-sym"><MathSpan tex={v.sym} /></span>
                <span className="eq-tooltip-def">{v.def}</span>
              </div>
            ))}
          </div>
          <div className="eq-tooltip-divider" />
          <div className="eq-tooltip-section">
            <div className="eq-tooltip-label">Worked Example</div>
            <div className="eq-tooltip-example"><MathSpan tex={example} /></div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Base card ──────────────────────────────────────────────────────────────────
function DashWidget({ section, span = 1, highlighted = false, children, className = '', style }) {
  const classes = [
    'dash-widget',
    `dash-span-${span}`,
    highlighted ? 'dash-section-highlight' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <section data-section={section} className={classes} style={style}>
      {children}
    </section>
  )
}
function DashTitle({ icon, children }) {
  return (
    <div className="dash-widget-title">
      {icon && <span className="dash-widget-icon">{icon}</span>}
      <span>{children}</span>
    </div>
  )
}

// ── Section components ─────────────────────────────────────────────────────────
function DashHeader({ lab, course }) {
  const statusActive = lab?.status === 'active'
  return (
    <div className="dash-header">
      <div className="dash-header-left">
        <div className="dash-lab-badge">Lab {lab?.number ?? '?'}</div>
        <div>
          <div className="dash-title">{lab?.name ?? 'Lab'}</div>
          <div className="dash-subtitle">{course?.code ?? ''} — {course?.name ?? ''}</div>
        </div>
      </div>
      <div className="dash-header-right">
        {lab?.due_date && (
          <div className="dash-due">
            <div className="dash-due-label">Due</div>
            <div className="dash-due-date">{lab.due_date}</div>
          </div>
        )}
        <div className={`dash-status ${statusActive ? 'active' : ''}`}>
          <div className="dash-status-dot" />
          {statusActive ? 'In Progress' : (lab?.status ?? 'Draft')}
        </div>
      </div>
    </div>
  )
}

function DashObjectives({ objectives = [], highlighted = false }) {
  if (!objectives.length) return null
  return (
    <DashWidget section="objectives" span={2} highlighted={highlighted}>
      <DashTitle icon="◎">Objectives</DashTitle>
      <ul className="dash-objectives">
        {objectives.map((obj, i) => (
          <li key={i} className="dash-objective-item">
            <span className="dash-obj-num">{i + 1}</span>
            <span>{obj}</span>
          </li>
        ))}
      </ul>
    </DashWidget>
  )
}

function DashTAInfo({ ta, highlighted = false }) {
  return (
    <DashWidget section="ta-info" highlighted={highlighted}>
      <DashTitle icon="◈">TA Info</DashTitle>
      <div className="dash-ta">
        <div className="dash-ta-name">{ta?.name || 'Your TA'}</div>
        <div className="dash-ta-rows">
          <div className="dash-ta-row">
            <span className="dash-ta-label">Email</span>
            <span className="dash-ta-val">{ta?.email || '—'}</span>
          </div>
        </div>
      </div>
    </DashWidget>
  )
}

function DashParts({ parts = [], highlighted = false }) {
  if (!parts.length) return null
  return (
    <DashWidget section="parts" span={2} highlighted={highlighted}>
      <DashTitle icon="◇">Lab Parts</DashTitle>
      <div className="dash-parts-grid">
        {parts.map((p, i) => (
          <div key={i} className="dash-part">
            <div className="dash-part-header">
              <div className="dash-part-badge">{p.label}</div>
              <div className="dash-part-duration">{p.duration}</div>
            </div>
            <div className="dash-part-title">{p.title}</div>
            <div className="dash-part-desc">{p.description}</div>
          </div>
        ))}
      </div>
    </DashWidget>
  )
}

function DashComponents({ components = [], highlighted = false }) {
  if (!components.length) return null
  return (
    <DashWidget section="components" highlighted={highlighted}>
      <DashTitle icon="◫">Components</DashTitle>
      <div style={{ overflowY: 'auto', maxHeight: 260, borderRadius: 6 }}>
        <table className="dash-table">
          <thead><tr><th>Component</th><th>Value</th><th>Qty</th></tr></thead>
          <tbody>
            {components.map((c, i) => (
              <tr key={i}>
                <td>{c.name}</td>
                <td className="dash-mono">{c.value}</td>
                <td className="dash-center">{c.quantity ?? c.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashWidget>
  )
}

function DashImages({ images = [], highlighted = false }) {
  return (
    <DashWidget section="images" span={3} highlighted={highlighted}>
      <DashTitle icon="◻">Circuit Diagrams</DashTitle>
      <div className="dash-images-grid">
        {images.map((img, i) => (
          <div key={i} className="dash-image-card">
            <img src={img.src} alt={img.alt} />
            <div className="dash-image-caption">{img.caption}</div>
          </div>
        ))}
      </div>
    </DashWidget>
  )
}

function DashEquations({ equations = [], highlighted = false }) {
  return (
    <DashWidget section="equations" span={3} highlighted={highlighted}>
      <DashTitle icon="∑">Key Equations</DashTitle>
      <div
        className="eq-cards-grid"
        style={{ gridTemplateColumns: `repeat(${equations.length}, 1fr)` }}
      >
        {equations.map((eq, i) => <EqCard key={i} {...eq} />)}
      </div>
    </DashWidget>
  )
}

function DashNotes({ notes = [], highlighted = false }) {
  return (
    <DashWidget section="notes" span={3} highlighted={highlighted}>
      <DashTitle icon="◉">Notes & Reminders</DashTitle>
      <div className="dash-notes-grid">
        {notes.map((note, i) => (
          <div key={i} className="dash-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {note}
          </div>
        ))}
      </div>
    </DashWidget>
  )
}

// ── Shell ──────────────────────────────────────────────────────────────────────
export default function WidgetShell({ lab, course, ta, data = {}, calculator: Calculator, highlightedSection }) {
  const isHighlighted = (section) => highlightedSection === section
  return (
    <div className="dash-screen">
      <div className="dash-inner">

        <DashHeader lab={lab} course={course} />

        <div className="dash-grid">

          {/* Objectives + TA Info */}
          <DashObjectives objectives={data.objectives} highlighted={isHighlighted('objectives')} />
          <DashTAInfo ta={ta} highlighted={isHighlighted('ta-info')} />

          {/* Parts + Components */}
          <DashParts parts={data.parts} highlighted={isHighlighted('parts')} />
          <DashComponents components={data.components} highlighted={isHighlighted('components')} />

          {/* Calculator */}
          {Calculator && (
            <DashWidget section="calculator" span={3} highlighted={isHighlighted('calculator')}>
              <DashTitle icon={data.calculatorIcon ?? '⊟'}>{data.calculatorTitle ?? 'Lab Calculator'}</DashTitle>
              <Calculator lab={lab} />
            </DashWidget>
          )}

          {/* Circuit Images */}
          {data.images?.length > 0 && (
            <DashImages images={data.images} highlighted={isHighlighted('images')} />
          )}

          {/* Key Equations */}
          {data.equations?.length > 0 && (
            <DashEquations equations={data.equations} highlighted={isHighlighted('equations')} />
          )}

          {/* Notes */}
          {data.notes?.length > 0 && (
            <DashNotes notes={data.notes} highlighted={isHighlighted('notes')} />
          )}

        </div>
      </div>
    </div>
  )
}
