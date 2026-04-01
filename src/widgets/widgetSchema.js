// ── Widget Data Contract ───────────────────────────────────────────────────────
// Reference only — not imported anywhere.
//
// Every widget module (e.g. ECEN214/Lab1/index.jsx) must export:
//   - `labData`  (named)  — the content object below
//   - a calculator component (named, optional) — e.g. VoltageDividerCalc
//
// WidgetShell reads `labData` and renders all sections in standard order.
// Add the widget to src/widgets/index.js to register it.

export const WIDGET_SCHEMA = {
  objectives:   [],   // string[]
  parts:        [],   // { label, duration, title, description }[]
  components:   [],   // { name, value, qty }[]
  equations:    [],   // { title, subtitle, tex, color, vars: [{ sym, def }][], example }[]
  notes:        [],   // string[]
  images:       [],   // { src, caption, alt }[]
  calculatorTitle: '', // optional section title override for the calculator card
  calculatorIcon:  '', // optional icon override for the calculator card
  // calculator is exported separately as a named React component, not in this object
}
