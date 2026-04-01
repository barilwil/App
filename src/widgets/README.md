# Widget System — Layout Reference

This document explains the full layout system for lab dashboard widgets. It is written for a future LLM or developer who needs to add, modify, or understand how lab content is rendered.

---

## How it works (overview)

The lab dashboard is driven by a **data-first** model:

1. Each lab widget exports a `labData` object (plain JS — no JSX) containing all lab content.
2. `WidgetShell.jsx` reads that data and renders every section in a fixed standard order.
3. `LabDashboard.jsx` looks up the right `labData` and calculator from the registry and passes them to `WidgetShell`.

No layout logic lives in individual widget files. Widgets only own their **content** (text, equations, component lists) and their **calculator component** (if any). Everything else is handled by the shell.

---

## File structure

```
src/widgets/
├── index.js                  — registry + resolver helpers
├── widgetSchema.js           — reference schema (not imported anywhere)
├── WidgetShell.jsx           — owns the full layout, all section components live here
└── ECEN214/
    └── Lab1/
        └── index.jsx         — exports labData + VoltageDividerCalc
```

`src/features/labs/LabDashboard.jsx` is the entry point. It calls `resolveWidgetData` and `resolveCalculator` from the registry and passes the results into `WidgetShell`.

---

## The labData contract

Every widget's `index.jsx` must export a named `labData` object with this shape:

```js
export const labData = {
  objectives:  [],   // string[] — numbered list of what students will learn/do
  parts:       [],   // { label, duration, title, description }[] — lab procedure sections
  components:  [],   // { name, value, qty }[] — parts list table
  equations:   [],   // equation objects — see shape below
  notes:       [],   // string[] — safety/reminder callouts
  images:      [],   // { src, caption, alt }[] — circuit diagrams / wiring photos
}
```

All fields are optional except as needed. If a field is empty or missing, its section is omitted from the rendered layout.

### Equation object shape

```js
{
  title:    string,           // e.g. 'Voltage Divider'
  subtitle: string,           // e.g. 'Unloaded output voltage'
  tex:      string,           // LaTeX-like string — see MathSpan notes below
  color:    string,           // CSS color for the left accent bar, e.g. 'rgba(130,220,180,0.7)'
  vars:     [{ sym, def }],   // variable definitions shown in the hover tooltip
  example:  string,           // worked example string (also tex-formatted)
}
```

### MathSpan — how LaTeX is rendered

`WidgetShell` contains a `MathSpan` component that does lightweight LaTeX-to-Unicode conversion (no KaTeX dependency). It handles:

- `\dfrac{a}{b}` / `\frac{a}{b}` → `(a) / (b)`
- `\cdot` / `\times` → `×`
- `\|` → `∥`
- `_{}` subscripts → Unicode subscript characters for `0–9`, `a`, `e`, `o`, `x`, `i`
- `\text{...}` → plain text passthrough
- `\Omega` → `Ω`, `\Rightarrow` → `→`, `\approx` → `≈`

Anything not matched is stripped of backslashes and braces. Keep equations simple — deeply nested LaTeX will not render correctly.

---

## How the calculator is exported

The calculator is a **named React component export** — not part of `labData`:

```js
// In Lab1/index.jsx:
export function VoltageDividerCalc() { ... }
```

It is registered separately in `index.js`. `WidgetShell` receives it as the `calculator` prop and renders it inside a full-width widget card. If `null`, the calculator section is skipped entirely.

The calculator receives `lab` as a prop (the DB lab record) in case it needs lab-specific values.

---

## WidgetShell rendering order

`WidgetShell` renders sections in this exact order inside a CSS grid (`dash-grid`):

| Order | Section           | Grid span | Condition                    |
|-------|-------------------|-----------|------------------------------|
| 1     | Objectives        | 2 cols    | always (if objectives exists)|
| 1     | TA Info           | 1 col     | always                       |
| 2     | Lab Parts         | 2 cols    | if `parts.length > 0`        |
| 2     | Components        | 1 col     | if `components.length > 0`   |
| 3     | Calculator        | 3 cols    | if `calculator` prop exists  |
| 4     | Circuit Images    | 3 cols    | if `images.length > 0`       |
| 5     | Key Equations     | 3 cols    | if `equations.length > 0`    |
| 6     | Notes & Reminders | 3 cols    | if `notes.length > 0`        |

The grid is `repeat(3, 1fr)` at full width, collapsing to 2-col at ≤900px and 1-col at ≤600px.

### TA Info

The TA card renders name and email from the `ta` prop passed through from App.jsx:

```jsx
<DashTAInfo ta={ta} />
// ta = { name: string, email: string } — from the logged-in TA session
```

Fallbacks: `ta?.name || 'Your TA'`, `ta?.email || '—'`. No crash if `ta` is null.

---

## How LabDashboard resolves the widget

`LabDashboard.jsx` receives `lab`, `course`, and `ta` from the chat session. It calls:

```js
const widgetData = resolveWidgetData(lab.widget_key)  // returns labData or null
const Calculator = resolveCalculator(lab.widget_key)  // returns component or null
```

The `widget_key` is a string like `"ECEN214/Lab1"` stored in the DB when the TA creates/edits a lab in the Admin Panel. If no widget is registered for that key, an error state is shown.

---

## How to add a new widget

### 1 — Create the widget file

```
src/widgets/ECENXXX/LabN/index.jsx
```

Export your data and (optionally) a calculator:

```js
export const labData = {
  objectives: ['...'],
  parts:      [{ label: 'Part A', duration: '~30 min', title: '...', description: '...' }],
  components: [{ name: 'Resistor', value: '1 kΩ', qty: 2 }],
  equations:  [{ title: '...', subtitle: '...', tex: '...', color: '...', vars: [], example: '...' }],
  notes:      ['...'],
  images:     [],   // { src, caption, alt }[] — leave empty until images are ready
}

// optional — omit if no calculator needed
export function MyCalc() { ... }
```

### 2 — Register it in `src/widgets/index.js`

```js
import { labData as ecenXXXLabNData, MyCalc } from './ECENXXX/LabN/index'

// Inside WIDGET_REGISTRY:
'ECENXXX': {
  label: 'ECEN XXX — Course Name',
  labs: {
    'LabN': {
      label:      'Lab N — Title',
      data:       ecenXXXLabNData,
      calculator: MyCalc,   // or null if no calculator
    },
  }
},
```

That's it. The Admin Panel widget picker and LabDashboard resolver pick it up automatically.

---

## Adding circuit images

To add images to an existing widget:

1. Create `src/widgets/ECENXXX/LabN/images/` and drop in PNG/SVG files.
2. Reference them using Vite's `import.meta.url` pattern:

```js
images: [
  {
    src:     new URL('./images/schematic.png',  import.meta.url).href,
    caption: 'Circuit Schematic',
    alt:     'Voltage divider schematic diagram',
  },
  {
    src:     new URL('./images/breadboard.png', import.meta.url).href,
    caption: 'Breadboard Layout',
    alt:     'Breadboard wiring diagram',
  },
],
```

The `DashImages` section in WidgetShell renders them in a horizontally scrollable flex row with captions below each image.

---

## Where each section component lives

All section components are **local to `WidgetShell.jsx`** — they are not exported. The full list:

| Component       | What it renders                                          |
|-----------------|----------------------------------------------------------|
| `MathSpan`      | Lightweight LaTeX-to-Unicode inline text                 |
| `EqCard`        | Single equation card with hover tooltip                  |
| `DashWidget`    | Base card wrapper (`dash-widget` class)                  |
| `DashTitle`     | Section header with icon + text                          |
| `DashHeader`    | Top lab header: badge, name, course, due date, status    |
| `DashObjectives`| Numbered objectives list                                 |
| `DashTAInfo`    | TA name + email card                                     |
| `DashParts`     | Lab procedure parts grid                                 |
| `DashComponents`| Component parts list table                               |
| `DashImages`    | Horizontal scrollable image gallery with captions        |
| `DashEquations` | Grid of `EqCard` components                              |
| `DashNotes`     | Amber warning callout cards                              |

If you need to add a new section type, add its component to `WidgetShell.jsx` and add the corresponding render slot in the `WidgetShell` default export in the correct order.

---

## CSS classes reference

Key classes in `src/index.css`:

| Class                | Purpose                                              |
|----------------------|------------------------------------------------------|
| `.dash-screen`       | Full-height scrollable container for the dashboard   |
| `.dash-inner`        | Max-width (1100px) centered content wrapper          |
| `.dash-header`       | Top header bar with lab info and status              |
| `.dash-grid`         | 3-col CSS grid for widget cards                      |
| `.dash-widget`       | Individual card (`bg-2`, border, padding, radius)    |
| `.dash-widget-title` | Section title row with icon                          |
| `.dash-objectives`   | Numbered objectives list                             |
| `.dash-parts-grid`   | Flex-wrap grid for part cards                        |
| `.dash-table`        | Components table styling                             |
| `.dash-images-grid`  | Horizontally scrollable flex row for images          |
| `.dash-image-card`   | Individual image + caption card (280px wide)         |
| `.dash-image-caption`| Image caption text (11px, text-3 color)              |
| `.dash-notes-grid`   | 2-col grid for note callouts                         |
| `.dash-note`         | Single note callout with warning icon                |
| `.eq-grid`           | Grid layout for equation cards                       |
| `.eq-card`           | Individual equation card with accent bar             |
| `.eq-tooltip`        | Portal-rendered hover tooltip for equation details   |
| `.dash-ta`           | TA info card body                                    |
| `.dash-ta-name`      | TA name (larger text)                                |
| `.dash-ta-rows`      | Container for label/value rows                       |
| `.dash-ta-label`     | Row label (e.g. "Email")                             |
| `.dash-ta-val`       | Row value text                                       |
