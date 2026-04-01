import { resolveWidgetData, resolveCalculator } from '../../widgets/index'
import WidgetShell from '../../widgets/WidgetShell'

export default function LabDashboard({ lab, course, ta, highlightedSection }) {
  if (!lab) {
    return (
      <div className="dash-screen">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
          </svg>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No lab in session</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', opacity: 0.6 }}>TA must launch a lab from the Course Dashboard</div>
        </div>
      </div>
    )
  }

  const widgetData = resolveWidgetData(lab.widget_key)
  const Calculator = resolveCalculator(lab.widget_key)

  if (lab.widget_key && !widgetData) {
    return (
      <div className="dash-screen">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Widget not found: <span style={{ fontFamily: 'var(--mono)' }}>{lab.widget_key}</span></div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', opacity: 0.5 }}>Register it in src/widgets/index.js</div>
        </div>
      </div>
    )
  }

  return (
    <WidgetShell
      lab={lab}
      course={course}
      ta={ta}
      data={widgetData ?? {}}
      calculator={Calculator}
      highlightedSection={highlightedSection}
    />
  )
}
