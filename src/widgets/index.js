// ── Widget Registry ───────────────────────────────────────────────────────────
// To add a new widget:
//   1. Create src/widgets/ECENXXX/LabN/index.jsx
//   2. Export `labData` (named) and calculator component (named) from it
//   3. Import and register below — LabDashboard and AdminPanel pick it up automatically

import { labData as ecen214Lab1Data, VoltageDividerCalc }   from './ECEN214/Lab1/index'
import { labData as ecen214Lab2Data, NonIdealSourceCalc }   from './ECEN214/Lab2/index'
import { labData as ecen214Lab3Data, SuperpositionCalc }    from './ECEN214/Lab3/index'
import { labData as ecen214Lab4Data, SecuritySystemCalc }        from './ECEN214/Lab4/index'
import { labData as ecen214Lab5Data, SecuritySystemPart2Calc }  from './ECEN214/Lab5/index'
import { labData as ecen214Lab6Data, RCOscillatorCalc }         from './ECEN214/Lab6/index'
import { labData as ecen214Lab7Data, ACResponseCalc }           from './ECEN214/Lab7/index'
import { labData as ecen214Lab8Data, SallenKeyCalc }           from './ECEN214/Lab8/index'
import { labData as ecen214Lab9Data, SallenKeyACCalc }         from './ECEN214/Lab9/index'

export const WIDGET_REGISTRY = {
  'ECEN214': {
    label: 'ECEN 214 — Circuit Theory',
    labs: {
      'Lab1': {
        label:      'Lab 1 — Introduction to Measurements & Voltage Divider',
        data:       ecen214Lab1Data,
        calculator: VoltageDividerCalc,
      },
      'Lab2': {
        label:      'Lab 2 — Non-Ideal Sources',
        data:       ecen214Lab2Data,
        calculator: NonIdealSourceCalc,
      },
      'Lab3': {
        label:      'Lab 3 — Equivalent Networks and Superposition',
        data:       ecen214Lab3Data,
        calculator: SuperpositionCalc,
      },
      'Lab4': {
        label:      'Lab 4 — Op-Amp Electronic Security System (Part 1)',
        data:       ecen214Lab4Data,
        calculator: SecuritySystemCalc,
      },
      'Lab5': {
        label:      'Lab 5 — Op-Amp Security System (Part 2)',
        data:       ecen214Lab5Data,
        calculator: SecuritySystemPart2Calc,
      },
      'Lab6': {
        label:      'Lab 6 — Transient Response of 1st Order RC Circuit',
        data:       ecen214Lab6Data,
        calculator: RCOscillatorCalc,
      },
      'Lab7': {
        label:      'Lab 7 — AC Response of 1st Order RC Circuits',
        data:       ecen214Lab7Data,
        calculator: ACResponseCalc,
      },
      'Lab8': {
        label:      'Lab 8 — Transient Response of 2nd Order Circuits',
        data:       ecen214Lab8Data,
        calculator: SallenKeyCalc,
      },
      'Lab9': {
        label:      'Lab 9 — AC Response of 2nd Order Circuits',
        data:       ecen214Lab9Data,
        calculator: SallenKeyACCalc,
      },
    }
  },
  'ECEN325': {
    label: 'ECEN 325 — Electronics',
    labs: {
      // 'Lab1': { label: 'Lab 1 — BJT Biasing', data: ecen325Lab1Data, calculator: null },
    }
  },
  'ECEN326': {
    label: 'ECEN 326 — Analog Circuits',
    labs: {
      // 'Lab1': { label: 'Lab 1 — Op-Amp Fundamentals', data: ecen326Lab1Data, calculator: null },
    }
  },
  'ECEN350': {
    label: 'ECEN 350 — Computer Architecture',
    labs: {
      // 'Lab1': { label: 'Lab 1 — ...', data: ecen350Lab1Data, calculator: null },
    }
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve widget data object from a key like "ECEN214/Lab1" */
export function resolveWidgetData(key) {
  if (!key) return null
  const [course, lab] = key.split('/')
  return WIDGET_REGISTRY[course]?.labs[lab]?.data ?? null
}

/** Resolve calculator component from a key like "ECEN214/Lab1" */
export function resolveCalculator(key) {
  if (!key) return null
  const [course, lab] = key.split('/')
  return WIDGET_REGISTRY[course]?.labs[lab]?.calculator ?? null
}

/** Flat list of all registered widgets for the admin panel picker */
export function getAllWidgets() {
  const out = []
  for (const [courseKey, course] of Object.entries(WIDGET_REGISTRY)) {
    for (const [labKey, lab] of Object.entries(course.labs)) {
      out.push({
        key:         `${courseKey}/${labKey}`,
        courseKey,
        labKey,
        courseLabel: course.label,
        labLabel:    lab.label,
        display:     `${course.label} › ${lab.label}`,
      })
    }
  }
  return out
}

/** Get just the course list (for the first picker dropdown) */
export function getCourses() {
  return Object.entries(WIDGET_REGISTRY)
    .map(([key, c]) => ({ key, label: c.label, labCount: Object.keys(c.labs).length }))
}

/** Get labs for a specific course key */
export function getLabsForCourse(courseKey) {
  const course = WIDGET_REGISTRY[courseKey]
  if (!course) return []
  return Object.entries(course.labs).map(([key, lab]) => ({
    key:   `${courseKey}/${key}`,
    label: lab.label,
  }))
}
