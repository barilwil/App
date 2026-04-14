import { useState, useEffect, useRef, useMemo } from 'react'
import { getCourses, getLabsForCourse } from '../../widgets/index'
import { API_URL as API } from '../../app/constants'

// ── Shared atoms ─────────────────────────────────────────────────────────────

function Badge() {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'default',
      background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac'
    }}>TA</span>
  )
}

function Avatar({ name, size = 28 }) {
  const palette = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4']
  const color = palette[(name || ' ').charCodeAt(0) % palette.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600, color: '#fff', flexShrink: 0, userSelect: 'none'
    }}>{(name || '?').charAt(0).toUpperCase()}</div>
  )
}

function Modal({ title, onClose, children, width = 460 }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-2)', border: '1px solid var(--border-2)',
        borderRadius: 'var(--r-xl)', padding: '26px 28px 22px',
        boxShadow: 'var(--shadow-lg)', animation: 'fade-up 0.22s cubic-bezier(0.16,1,0.3,1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4, lineHeight: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ style, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        background: 'var(--bg-3)', border: `1px solid ${focused ? 'var(--border-2)' : 'var(--border)'}`,
        borderRadius: 'var(--r)', padding: '9px 12px', color: 'var(--text)',
        fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: '100%', ...style
      }}
    />
  )
}

function Textarea({ style, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      {...props}
      rows={props.rows || 3}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        background: 'var(--bg-3)', border: `1px solid ${focused ? 'var(--border-2)' : 'var(--border)'}`,
        borderRadius: 'var(--r)', padding: '9px 12px', color: 'var(--text)',
        fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: '100%', resize: 'vertical', ...style
      }}
    />
  )
}

function PrimaryBtn({ children, style, ...props }) {
  return (
    <button {...props} style={{
      padding: '8px 16px', borderRadius: 'var(--r)', border: 'none',
      background: 'var(--text)', color: '#08080a', fontSize: 13, fontWeight: 600,
      cursor: props.disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      opacity: props.disabled ? 0.3 : 1, transition: 'opacity 0.15s', ...style
    }}>{children}</button>
  )
}

function GhostBtn({ children, style, ...props }) {
  const [hov, setHov] = useState(false)
  return (
    <button {...props}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: '6px 12px', borderRadius: 'var(--pill)',
        border: `1px solid ${hov ? 'var(--border-2)' : 'var(--border)'}`,
        background: 'transparent', color: hov ? 'var(--text)' : 'var(--text-2)',
        fontSize: 12, cursor: props.disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font)', display: 'inline-flex', alignItems: 'center', gap: 5,
        opacity: props.disabled ? 0.35 : 1, transition: 'color 0.15s, border-color 0.15s', ...style
      }}>{children}</button>
  )
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 42, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative',
      background: value ? '#22c55e' : 'var(--surface-2)',
      border: `1px solid ${value ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
      transition: 'background 0.2s, border-color 0.2s', flexShrink: 0
    }}>
      <div style={{
        position: 'absolute', top: 2, left: value ? 19 : 2, width: 18, height: 18,
        borderRadius: '50%', background: value ? '#fff' : 'var(--text-3)',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
      }} />
    </div>
  )
}

function EmptyState({ icon, text, sub }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
      padding: '44px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
        <path d={icon}/>
      </svg>
      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{text}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', opacity: 0.6 }}>{sub}</div>}
    </div>
  )
}

function SettingRow({ label, description, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '15px 0', borderBottom: '1px solid var(--border)'
    }}>
      <div style={{ flex: 1, paddingRight: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: description ? 3 : 0 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{description}</div>}
      </div>
      {children}
    </div>
  )
}

function selectStyle(hasValue = true, extra = {}) {
  return {
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    padding: '9px 12px',
    color: hasValue ? 'var(--text)' : 'var(--text-3)',
    fontSize: 13,
    fontFamily: 'var(--font)',
    outline: 'none',
    width: '100%',
    ...extra,
  }
}

function deriveVariationLabel(circuitName = '') {
  const name = String(circuitName || '').trim()
  if (!name) return ''

  const vectorOnlyMatch = name.match(/_V(\d+)_only$/i)
  if (vectorOnlyMatch) return `V${vectorOnlyMatch[1]} only`

  const parts = name.split('_')
  return parts.length > 1 ? parts[parts.length - 1] : name
}

function naturalCompare(a = '', b = '') {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' })
}

function deriveCircuitFamilyKey(circuitName = '', availableCircuits = []) {
  const name = String(circuitName || '').trim()
  if (!name) return ''

  const vectorOnlyMatch = name.match(/^(.*)_V\d+_only$/i)
  if (vectorOnlyMatch) return vectorOnlyMatch[1]

  const hasSpecializedVariants = availableCircuits.some(circuit => String(circuit || '').trim().startsWith(`${name}_V`))
  if (hasSpecializedVariants) return name

  const parts = name.split('_').filter(Boolean)
  return parts.length > 1 ? parts.slice(0, -1).join('_') : name
}

function suggestVariationLabel(circuitName = '', availableCircuits = []) {
  const name = String(circuitName || '').trim()
  if (!name) return ''

  const familyKey = deriveCircuitFamilyKey(name, availableCircuits)
  const hasSpecializedVariants = availableCircuits.some(candidate => String(candidate || '').trim().startsWith(`${familyKey}_V`))
  return name === familyKey && hasSpecializedVariants ? 'Base' : deriveVariationLabel(name)
}

function buildCircuitFamilies(availableCircuits = []) {
  const groups = new Map()

  for (const circuit of availableCircuits) {
    const circuitName = String(circuit || '').trim()
    if (!circuitName) continue

    const familyKey = deriveCircuitFamilyKey(circuitName, availableCircuits)
    const hasSpecializedVariants = availableCircuits.some(candidate => String(candidate || '').trim().startsWith(`${familyKey}_V`))
    const variationLabel = circuitName === familyKey && hasSpecializedVariants
      ? 'Base'
      : suggestVariationLabel(circuitName, availableCircuits)

    if (!groups.has(familyKey)) {
      groups.set(familyKey, {
        key: familyKey,
        label: familyKey,
        variations: [],
      })
    }

    groups.get(familyKey).variations.push({
      circuit_name: circuitName,
      label: variationLabel,
    })
  }

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      variations: group.variations.sort((a, b) => naturalCompare(a.label, b.label) || naturalCompare(a.circuit_name, b.circuit_name)),
    }))
    .sort((a, b) => naturalCompare(a.label, b.label))
}

function getCircuitFamilyByKey(circuitFamilies = [], familyKey = '') {
  const key = String(familyKey || '').trim()
  return circuitFamilies.find(family => family.key === key) || null
}

function getCircuitFamilyByCircuitName(circuitFamilies = [], circuitName = '') {
  const name = String(circuitName || '').trim()
  return circuitFamilies.find(family => family.variations.some(variation => variation.circuit_name === name)) || null
}

function getFirstCircuitInFamily(circuitFamilies = [], familyKey = '') {
  return getCircuitFamilyByKey(circuitFamilies, familyKey)?.variations?.[0]?.circuit_name || ''
}

function normalizeImagePath(imagePath = '') {
  return String(imagePath || '').trim().replaceAll('\\', '/')
}

function buildCircuitImageUrl(imagePath = '') {
  const normalized = normalizeImagePath(imagePath)
  return normalized ? `${API}/circuit-images/files/${encodeURI(normalized)}` : ''
}

function suggestImagePath(imageCatalog = [], circuitName = '') {
  const target = String(circuitName || '').trim().toLowerCase()
  if (!target) return ''

  const exact = imageCatalog.find(image => String(image?.stem || '').trim().toLowerCase() === target)
  if (exact?.relative_path) return exact.relative_path

  const normalizedTarget = target.replace(/[^a-z0-9]+/gi, '')
  if (!normalizedTarget) return ''

  const relaxed = imageCatalog.find(image => String(image?.stem || '').trim().toLowerCase().replace(/[^a-z0-9]+/gi, '') === normalizedTarget)
  return relaxed?.relative_path || ''
}

function resolveExistingImagePath(imageCatalog = [], imagePath = '', circuitName = '') {
  const normalizedPath = normalizeImagePath(imagePath)
  if (normalizedPath) {
    const exact = imageCatalog.find(image => normalizeImagePath(image?.relative_path) === normalizedPath)
    if (exact?.relative_path) return normalizeImagePath(exact.relative_path)

    const filename = normalizedPath.split('/').pop()?.trim().toLowerCase()
    if (filename) {
      const filenameMatch = imageCatalog.find(image => String(image?.filename || '').trim().toLowerCase() === filename)
      if (filenameMatch?.relative_path) return normalizeImagePath(filenameMatch.relative_path)
    }
  }

  return normalizeImagePath(suggestImagePath(imageCatalog, circuitName) || normalizedPath)
}

function createBlankVariation(availableCircuits = [], imageCatalog = []) {
  const circuit = availableCircuits[0] || ''
  return {
    circuit_name: circuit,
    variation_label: circuit ? suggestVariationLabel(circuit, availableCircuits) : '',
    image_path: circuit ? suggestImagePath(imageCatalog, circuit) : '',
  }
}

function createBlankTask(index = 0, availableCircuits = [], imageCatalog = []) {
  const n = index + 1
  return {
    task_key: `task_${n}`,
    task_label: `Task ${n}`,
    variations: [createBlankVariation(availableCircuits, imageCatalog)],
  }
}

function groupMappingsToTasks(rows = [], availableCircuits = [], imageCatalog = []) {
  if (!rows.length) return [createBlankTask(0, availableCircuits, imageCatalog)]
  const groups = []
  const seen = new Map()
  for (const row of rows) {
    const taskKey = String(row?.task_key || '').trim() || String(row?.task_label || '').trim() || 'task'
    if (!seen.has(taskKey)) {
      const task = {
        task_key: taskKey,
        task_label: String(row?.task_label || '').trim() || taskKey,
        variations: [],
      }
      seen.set(taskKey, task)
      groups.push(task)
    }
    seen.get(taskKey).variations.push({
      circuit_name: String(row?.circuit_name || '').trim(),
      variation_label: String(row?.variation_label || '').trim() || suggestVariationLabel(row?.circuit_name || '', availableCircuits),
      image_path: resolveExistingImagePath(imageCatalog, row?.resolved_image_path || row?.image_path || '', row?.circuit_name || ''),
    })
  }
  return groups.map(task => ({
    ...task,
    variations: task.variations.length ? task.variations : [createBlankVariation(availableCircuits, imageCatalog)],
  }))
}

function flattenTaskMappings(tasks = [], availableCircuits = []) {
  const payload = []
  let sortOrder = 0
  for (const task of tasks) {
    const taskKey = String(task?.task_key || '').trim()
    const taskLabel = String(task?.task_label || '').trim()
    if (!taskKey && !taskLabel) continue
    for (const variation of task?.variations || []) {
      const circuitName = String(variation?.circuit_name || '').trim()
      if (!circuitName) continue
      payload.push({
        task_key: taskKey,
        task_label: taskLabel || taskKey,
        circuit_name: circuitName,
        variation_label: String(variation?.variation_label || '').trim() || suggestVariationLabel(circuitName, availableCircuits),
        image_path: normalizeImagePath(variation?.image_path || ''),
        sort_order: sortOrder++,
      })
    }
  }
  return payload
}

// ── Edit Course Modal ─────────────────────────────────────────────────────────
function EditCourseModal({ course, onClose, onSave }) {
  const [name, setName] = useState(course.name)
  const [code, setCode] = useState(course.code)
  const [desc, setDesc] = useState(course.description || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) return
    setSaving(true)
    await onSave(course.id, { name: name.trim(), code: code.trim(), description: desc.trim() })
    setSaving(false)
  }

  return (
    <Modal title="Edit Course" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Course Name"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Course Code"><Input value={code} onChange={e => setCode(e.target.value)} /></Field>
        <Field label="Description"><Textarea value={desc} onChange={e => setDesc(e.target.value)} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} disabled={!name.trim() || !code.trim() || saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

// ── Edit Lab Modal ────────────────────────────────────────────────────────────
function EditLabModal({ lab, onClose, onSave }) {
  const [num, setNum] = useState(String(lab.number))
  const [name, setName] = useState(lab.name)
  const [dueDate, setDueDate] = useState(lab.due_date || '')
  const [status, setStatus] = useState(lab.status || 'draft')
  const [widgetCourse, setWidgetCourse] = useState(lab.widget_key ? lab.widget_key.split('/')[0] : '')
  const [widgetKey, setWidgetKey] = useState(lab.widget_key || '')
  const [saving, setSaving] = useState(false)

  const [availableCircuits, setAvailableCircuits] = useState([])
  const [availableImages, setAvailableImages] = useState([])
  const [mappingTasks, setMappingTasks] = useState([createBlankTask(0, [], [])])
  const circuitFamilies = useMemo(() => buildCircuitFamilies(availableCircuits), [availableCircuits])
  const [mappingsLoading, setMappingsLoading] = useState(true)
  const [circuitsLoading, setCircuitsLoading] = useState(true)
  const [imagesLoading, setImagesLoading] = useState(true)
  const [mappingError, setMappingError] = useState('')

  useEffect(() => {
    let cancelled = false
    setCircuitsLoading(true)
    fetch(`${API}/circuits`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return
        const list = Array.isArray(d?.circuits) ? d.circuits : []
        setAvailableCircuits(list)
      })
      .catch(() => {
        if (!cancelled) setAvailableCircuits([])
      })
      .finally(() => {
        if (!cancelled) setCircuitsLoading(false)
      })

    return () => { cancelled = true }
  }, [lab.id])

  useEffect(() => {
    let cancelled = false
    setImagesLoading(true)
    fetch(`${API}/circuit-images`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return
        setAvailableImages(Array.isArray(d?.images) ? d.images : [])
      })
      .catch(() => {
        if (!cancelled) setAvailableImages([])
      })
      .finally(() => {
        if (!cancelled) setImagesLoading(false)
      })

    return () => { cancelled = true }
  }, [lab.id])

  useEffect(() => {
    let cancelled = false
    setMappingsLoading(true)
    fetch(`${API}/labs/${lab.id}/circuit-mappings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return
        const rows = Array.isArray(d?.mappings) ? d.mappings : []
        setMappingTasks(groupMappingsToTasks(rows, availableCircuits, availableImages))
      })
      .catch(() => {
        if (!cancelled) {
          setMappingTasks(groupMappingsToTasks([], availableCircuits, availableImages))
          setMappingError('Could not load saved lab-to-circuit mappings.')
        }
      })
      .finally(() => {
        if (!cancelled) setMappingsLoading(false)
      })

    return () => { cancelled = true }
  }, [lab.id, availableCircuits.length, availableImages.length])

  const updateTask = (taskIndex, fields) => {
    setMappingTasks(prev => prev.map((task, index) => index === taskIndex ? { ...task, ...fields } : task))
  }

  const addTask = () => {
    setMappingTasks(prev => [...prev, createBlankTask(prev.length, availableCircuits, availableImages)])
  }

  const removeTask = (taskIndex) => {
    setMappingTasks(prev => {
      const next = prev.filter((_, index) => index !== taskIndex)
      return next.length ? next : [createBlankTask(0, availableCircuits, availableImages)]
    })
  }

  const addVariation = (taskIndex) => {
    setMappingTasks(prev => prev.map((task, index) => {
      if (index !== taskIndex) return task
      return { ...task, variations: [...task.variations, createBlankVariation(availableCircuits, availableImages)] }
    }))
  }

  const removeVariation = (taskIndex, variationIndex) => {
    setMappingTasks(prev => prev.map((task, index) => {
      if (index !== taskIndex) return task
      const nextVariations = task.variations.filter((_, vIndex) => vIndex !== variationIndex)
      return { ...task, variations: nextVariations.length ? nextVariations : [createBlankVariation(availableCircuits, availableImages)] }
    }))
  }

  const updateVariation = (taskIndex, variationIndex, fields) => {
    setMappingTasks(prev => prev.map((task, index) => {
      if (index !== taskIndex) return task
      return {
        ...task,
        variations: task.variations.map((variation, vIndex) => {
          if (vIndex !== variationIndex) return variation
          const next = { ...variation, ...fields }
          if (Object.prototype.hasOwnProperty.call(fields, 'circuit_name')) {
            if (!Object.prototype.hasOwnProperty.call(fields, 'variation_label')) {
              next.variation_label = suggestVariationLabel(fields.circuit_name, availableCircuits)
            }
            if (!Object.prototype.hasOwnProperty.call(fields, 'image_path')) {
              const previousSuggested = suggestImagePath(availableImages, variation.circuit_name)
              const currentImagePath = normalizeImagePath(variation.image_path)
              if (!currentImagePath || currentImagePath === previousSuggested) {
                next.image_path = suggestImagePath(availableImages, fields.circuit_name)
              }
            }
          }
          return next
        }),
      }
    }))
  }

  const updateVariationFamily = (taskIndex, variationIndex, familyKey) => {
    const nextCircuitName = getFirstCircuitInFamily(circuitFamilies, familyKey)
    updateVariation(taskIndex, variationIndex, { circuit_name: nextCircuitName })
  }

  const resolveVariationImagePath = (variation) => resolveExistingImagePath(availableImages, variation?.image_path || '', variation?.circuit_name || '')
  const resolveVariationImageUrl = (variation) => buildCircuitImageUrl(resolveVariationImagePath(variation))

  const handleSave = async () => {
    if (!name.trim() || !num) return
    setMappingError('')
    setSaving(true)

    const mappings = flattenTaskMappings(mappingTasks, availableCircuits)
    if (mappingTasks.some(task => !String(task.task_key || '').trim() && !String(task.task_label || '').trim())) {
      setMappingError('Each task needs a task key or task label.')
      setSaving(false)
      return
    }
    if (mappingTasks.some(task => (task.variations || []).some(variation => !String(variation.circuit_name || '').trim()))) {
      setMappingError('Each mapped variation needs a circuit selected.')
      setSaving(false)
      return
    }

    await onSave(lab.id, {
      number: parseInt(num, 10),
      name: name.trim(),
      due_date: dueDate.trim(),
      status,
      widget_key: widgetKey || '',
    }, mappings)

    setSaving(false)
  }

  return (
    <Modal title={`Edit Lab ${lab.number}`} onClose={onClose} width={760}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Lab Number">
            <Input type="number" min="1" value={num} onChange={e => setNum(e.target.value)} style={{ width: 92 }} />
          </Field>
          <Field label="Status">
            <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle(true)}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </div>

        <Field label="Lab Name"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Due Date"><Input placeholder="e.g. Feb 14, 2025" value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>

        <Field label="Widget">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <select value={widgetCourse} onChange={e => { setWidgetCourse(e.target.value); setWidgetKey('') }} style={selectStyle(!!widgetCourse)}>
              <option value="">No widget</option>
              {getCourses().map(c => (
                <option key={c.key} value={c.key} disabled={c.labCount === 0}>{c.label}{c.labCount === 0 ? ' (no widgets)' : ''}</option>
              ))}
            </select>
            {widgetCourse && (
              <select value={widgetKey} onChange={e => setWidgetKey(e.target.value)} style={selectStyle(!!widgetKey)}>
                <option value="">Select widget…</option>
                {getLabsForCourse(widgetCourse).map(l => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
            )}
            {widgetKey && (
              <div style={{ fontSize: 11, color: 'rgba(130,210,180,0.7)', fontFamily: 'var(--mono)', padding: '2px 2px' }}>✓ {widgetKey}</div>
            )}
            {!widgetKey && lab.widget_key && (
              <div style={{ fontSize: 11, color: '#f07070', padding: '2px 2px' }}>⚠ Clearing existing widget: {lab.widget_key}</div>
            )}
          </div>
        </Field>

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Circuit mappings</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Map this lab’s tasks to the exact API circuit variations students should see.</div>
            </div>
            <GhostBtn onClick={addTask} disabled={circuitsLoading || saving}>Add Task</GhostBtn>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(mappingsLoading || circuitsLoading || imagesLoading) && (
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading circuit mappings and images…</div>
            )}

            {!mappingsLoading && !circuitsLoading && !imagesLoading && mappingTasks.map((task, taskIndex) => (
              <div key={`${task.task_key}-${taskIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 12, background: 'var(--bg-3)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Task {taskIndex + 1}</div>
                  <button onClick={() => removeTask(taskIndex)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)' }}>Remove Task</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
                  <Field label="Task Key">
                    <Input placeholder="e.g. task_1" value={task.task_key} onChange={e => updateTask(taskIndex, { task_key: e.target.value })} />
                  </Field>
                  <Field label="Task Label">
                    <Input placeholder="e.g. Task 1 · Divider" value={task.task_label} onChange={e => updateTask(taskIndex, { task_label: e.target.value })} />
                  </Field>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {task.variations.map((variation, variationIndex) => {
                    const previewPath = resolveVariationImagePath(variation)
                    const previewUrl = resolveVariationImageUrl(variation)
                    const selectedFamily = getCircuitFamilyByCircuitName(circuitFamilies, variation.circuit_name)
                    const selectedFamilyKey = selectedFamily?.key || ''
                    const familyVariations = selectedFamily?.variations || []
                    return (
                      <div key={`${taskIndex}-${variationIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 10, background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 0.95fr auto', gap: 10, alignItems: 'end' }}>
                          <Field label={variationIndex === 0 ? 'Circuit Group' : 'Circuit Group '}>
                            <select
                              value={selectedFamilyKey}
                              onChange={e => updateVariationFamily(taskIndex, variationIndex, e.target.value)}
                              style={selectStyle(!!selectedFamilyKey)}
                              disabled={availableCircuits.length === 0}
                            >
                              <option value="">Select group…</option>
                              {circuitFamilies.map(family => (
                                <option key={family.key} value={family.key}>{family.label}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label={variationIndex === 0 ? 'Circuit Variant' : 'Circuit Variant '}>
                            <select
                              value={variation.circuit_name}
                              onChange={e => updateVariation(taskIndex, variationIndex, { circuit_name: e.target.value })}
                              style={selectStyle(!!variation.circuit_name)}
                              disabled={!selectedFamily}
                            >
                              <option value="">Select variant…</option>
                              {familyVariations.map(option => (
                                <option key={option.circuit_name} value={option.circuit_name}>{option.label}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label={variationIndex === 0 ? 'Variation Label' : 'Variation Label '}>
                            <Input placeholder="e.g. Base, 0, 1000" value={variation.variation_label} onChange={e => updateVariation(taskIndex, variationIndex, { variation_label: e.target.value })} />
                          </Field>
                          <button onClick={() => removeVariation(taskIndex, variationIndex)} style={{ height: 36, padding: '0 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                            Remove
                          </button>
                        </div>

                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: -2 }}>
                          Pick a circuit group first, then choose the exact API variant from the shorter list.
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr auto 120px', gap: 10, alignItems: 'end' }}>
                          <Field label={variationIndex === 0 ? 'Variation Image' : 'Variation Image '}>
                            <select
                              value={normalizeImagePath(variation.image_path)}
                              onChange={e => updateVariation(taskIndex, variationIndex, { image_path: e.target.value })}
                              style={selectStyle(true)}
                            >
                              <option value="">Auto-match from circuit name</option>
                              {availableImages.map(image => (
                                <option key={image.relative_path} value={image.relative_path}>{image.relative_path}</option>
                              ))}
                            </select>
                          </Field>
                          <button
                            onClick={() => updateVariation(taskIndex, variationIndex, { image_path: suggestImagePath(availableImages, variation.circuit_name) })}
                            style={{ height: 36, padding: '0 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}
                          >
                            Auto
                          </button>
                          <div style={{ height: 72, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {previewUrl ? (
                              <img src={previewUrl} alt={previewPath || variation.circuit_name || 'variation preview'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '0 8px' }}>No image</div>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {previewPath ? `Preview: ${previewPath}` : 'Leave image blank to auto-match by filename when possible.'}
                        </div>
                      </div>
                    )
                  })}

                  <GhostBtn onClick={() => addVariation(taskIndex)} disabled={saving}>Add Variation</GhostBtn>
                </div>
              </div>
            ))}

            {!mappingsLoading && !circuitsLoading && availableCircuits.length === 0 && (
              <div style={{ fontSize: 12, color: '#f7b955' }}>No circuits were returned from the backend API proxy yet. The lab can still be saved, but mappings will need circuit options before they’re useful.</div>
            )}
            {!mappingsLoading && !imagesLoading && availableImages.length === 0 && (
              <div style={{ fontSize: 12, color: '#f7b955' }}>No circuit images were found in backend/circuit_images yet. You can still save mappings and add images later.</div>
            )}
          </div>
        </div>

        {mappingError && <div style={{ fontSize: 12, color: '#f07070' }}>{mappingError}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} disabled={!name.trim() || !num || saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

// ── COURSES TAB ───────────────────────────────────────────────────────────────

function CoursesTab() {
  const [courses, setCourses] = useState([])
  const [selected, setSelected] = useState(null)
  const [labs, setLabs] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  const [showNewCourse, setShowNewCourse] = useState(false)
  const [showNewLab, setShowNewLab] = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [editingLab, setEditingLab] = useState(null)

  const [courseName, setCourseName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [courseDesc, setCourseDesc] = useState('')

  const [labNum, setLabNum] = useState('')
  const [labName, setLabName] = useState('')
  const [labDesc, setLabDesc] = useState('')
  const [labWidgetCourse, setLabWidgetCourse] = useState('')
  const [labWidgetKey, setLabWidgetKey] = useState('')

  const [stuUin, setStuUin] = useState('')
  const [stuName, setStuName] = useState('')
  const [stuErr, setStuErr] = useState('')

  const selectedCourse = courses.find(c => c.id === selected)

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/courses`)
      if (r.ok) setCourses(await r.json())
    } finally {
      setLoading(false)
    }
  }

  const fetchDetail = async (id) => {
    const [lr, sr] = await Promise.all([
      fetch(`${API}/courses/${id}/labs`),
      fetch(`${API}/courses/${id}/students`),
    ])
    if (lr.ok) setLabs(await lr.json())
    if (sr.ok) setStudents(await sr.json())
  }

  useEffect(() => { fetchCourses() }, [])
  useEffect(() => { if (selected) fetchDetail(selected) }, [selected])

  const createCourse = async () => {
    if (!courseName.trim() || !courseCode.trim()) return
    const r = await fetch(`${API}/courses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: courseName.trim(), code: courseCode.trim(), description: courseDesc.trim() })
    })
    if (r.ok) {
      setCourseName('')
      setCourseCode('')
      setCourseDesc('')
      setShowNewCourse(false)
      fetchCourses()
    }
  }

  const deleteCourse = async (id) => {
    await fetch(`${API}/courses/${id}`, { method: 'DELETE' })
    if (selected === id) setSelected(null)
    fetchCourses()
  }

  const createLab = async () => {
    if (!labName.trim() || !labNum) return
    const r = await fetch(`${API}/courses/${selected}/labs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: labName.trim(), number: parseInt(labNum, 10), description: labDesc.trim(), widget_key: labWidgetKey || null })
    })
    if (r.ok) {
      setLabNum('')
      setLabName('')
      setLabDesc('')
      setLabWidgetCourse('')
      setLabWidgetKey('')
      setShowNewLab(false)
      fetchDetail(selected)
    }
  }

  const updateCourse = async (id, fields) => {
    await fetch(`${API}/courses/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    })
    fetchCourses()
    setEditingCourse(null)
  }

  const updateLab = async (id, fields, mappings = []) => {
    await fetch(`${API}/labs/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    })
    await fetch(`${API}/labs/${id}/circuit-mappings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings })
    })
    fetchDetail(selected)
    setEditingLab(null)
  }

  const deleteLab = async (lid) => {
    await fetch(`${API}/labs/${lid}`, { method: 'DELETE' })
    fetchDetail(selected)
  }

  const addStudent = async () => {
    setStuErr('')
    const r = await fetch(`${API}/courses/${selected}/students`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uin: stuUin.trim(), name: stuName.trim() || null })
    })
    if (r.ok) {
      setStuUin('')
      setStuName('')
      setShowAddStudent(false)
      fetchDetail(selected)
    } else {
      const e = await r.json()
      setStuErr(e.detail || 'Failed to add student')
    }
  }

  const removeStudent = async (uin) => {
    await fetch(`${API}/courses/${selected}/students/${uin}`, { method: 'DELETE' })
    fetchDetail(selected)
  }

  const iconAdd = 'M12 5v14M5 12h14'

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '14px 10px', gap: 4, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Courses</span>
          <button onClick={() => setShowNewCourse(true)} title="New course" style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={iconAdd}/></svg>
          </button>
        </div>
        {loading
          ? <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>Loading…</div>
          : courses.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '20px 8px' }}>No courses yet</div>
            : courses.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)} style={{
                textAlign: 'left', padding: '9px 12px', borderRadius: 'var(--r)', cursor: 'pointer',
                background: selected === c.id ? 'var(--surface-2)' : 'transparent',
                border: `1px solid ${selected === c.id ? 'var(--border)' : 'transparent'}`,
                fontFamily: 'var(--font)', transition: 'background 0.12s'
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{c.code} · {c.lab_count} labs · {c.student_count} students</div>
              </button>
            ))
        }
      </div>

      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 28 }}>
        {!selected ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Select a course or create one</div>
            <GhostBtn onClick={() => setShowNewCourse(true)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={iconAdd}/></svg>
              New Course
            </GhostBtn>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>{selectedCourse?.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>{selectedCourse?.code}{selectedCourse?.description ? ` · ${selectedCourse.description}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <GhostBtn onClick={() => setEditingCourse(selectedCourse)}>Edit</GhostBtn>
                <button onClick={() => deleteCourse(selected)} style={{ padding: '5px 11px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(229,83,75,0.25)', background: 'rgba(229,83,75,0.07)', color: '#e5534b', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Delete</button>
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Labs ({labs.length})</span>
                <GhostBtn onClick={() => setShowNewLab(true)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={iconAdd}/></svg>
                  Add Lab
                </GhostBtn>
              </div>
              {labs.length === 0
                ? <EmptyState icon="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18" text="No labs yet" sub="Add the first lab for this course" />
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...labs].sort((a, b) => a.number - b.number).map(lab => (
                    <div key={lab.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', fontFamily: 'var(--mono)', flexShrink: 0 }}>L{lab.number}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lab.name}</div>
                          <div style={{ fontSize: 11, color: lab.widget_key ? 'rgba(130,210,180,0.7)' : 'var(--text-3)', marginTop: 2, fontFamily: 'var(--mono)' }}>{lab.widget_key || 'no widget assigned'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{lab.mapping_count || 0} mapped variation{Number(lab.mapping_count || 0) === 1 ? '' : 's'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => setEditingLab(lab)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 5, lineHeight: 0 }} title="Edit">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => deleteLab(lab.id)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 5, lineHeight: 0 }} title="Delete">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Enrolled Students ({students.length})</span>
                <GhostBtn onClick={() => setShowAddStudent(true)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={iconAdd}/></svg>
                  Add Student
                </GhostBtn>
              </div>
              {students.length === 0
                ? <EmptyState icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0" text="No students enrolled" />
                : <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['UIN', 'Name', 'Enrolled', ''].map(h => (
                          <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s, i) => (
                        <tr key={s.uin} style={{ borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)' }}>{s.uin}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text)' }}>{s.name || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-3)' }}>{s.added_at ? new Date(s.added_at).toLocaleDateString() : '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button onClick={() => removeStudent(s.uin)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)' }}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </>
        )}
      </div>

      {showNewCourse && (
        <Modal title="New Course" onClose={() => setShowNewCourse(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Course Name"><Input placeholder="e.g. Intro to Electrical Circuits" value={courseName} onChange={e => setCourseName(e.target.value)} /></Field>
            <Field label="Course Code"><Input placeholder="e.g. ECEN 214" value={courseCode} onChange={e => setCourseCode(e.target.value)} /></Field>
            <Field label="Description (optional)"><Textarea placeholder="Short description…" value={courseDesc} onChange={e => setCourseDesc(e.target.value)} /></Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <GhostBtn onClick={() => setShowNewCourse(false)}>Cancel</GhostBtn>
              <PrimaryBtn onClick={createCourse} disabled={!courseName.trim() || !courseCode.trim()}>Create</PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}

      {showNewLab && (
        <Modal title="Add Lab" onClose={() => setShowNewLab(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Lab Number"><Input type="number" min="1" placeholder="1" value={labNum} onChange={e => setLabNum(e.target.value)} /></Field>
            <Field label="Lab Name"><Input placeholder="e.g. Introduction to Measurements" value={labName} onChange={e => setLabName(e.target.value)} /></Field>
            <Field label="Description (optional)"><Textarea placeholder="What this lab covers…" value={labDesc} onChange={e => setLabDesc(e.target.value)} /></Field>
            <Field label="Widget (optional)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <select value={labWidgetCourse} onChange={e => { setLabWidgetCourse(e.target.value); setLabWidgetKey('') }} style={selectStyle(!!labWidgetCourse)}>
                  <option value="">Select course…</option>
                  {getCourses().map(c => (
                    <option key={c.key} value={c.key} disabled={c.labCount === 0}>{c.label}{c.labCount === 0 ? ' (no widgets)' : ''}</option>
                  ))}
                </select>
                {labWidgetCourse && (
                  <select value={labWidgetKey} onChange={e => setLabWidgetKey(e.target.value)} style={selectStyle(!!labWidgetKey)}>
                    <option value="">Select widget…</option>
                    {getLabsForCourse(labWidgetCourse).map(l => (
                      <option key={l.key} value={l.key}>{l.label}</option>
                    ))}
                  </select>
                )}
                {labWidgetKey && (
                  <div style={{ fontSize: 11, color: 'rgba(130,210,180,0.7)', fontFamily: 'var(--mono)', padding: '4px 2px' }}>✓ {labWidgetKey}</div>
                )}
              </div>
            </Field>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Create the lab first, then open Edit to map its tasks to API circuit variations.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <GhostBtn onClick={() => setShowNewLab(false)}>Cancel</GhostBtn>
              <PrimaryBtn onClick={createLab} disabled={!labName.trim() || !labNum}>Add Lab</PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}

      {showAddStudent && (
        <Modal title="Add Student" onClose={() => setShowAddStudent(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="UIN"><Input placeholder="9-digit UIN" maxLength={12} value={stuUin} onChange={e => { setStuUin(e.target.value.replace(/\\D/g, '')); setStuErr('') }} /></Field>
            <Field label="Name (required if new student)"><Input placeholder="Student full name" value={stuName} onChange={e => setStuName(e.target.value)} /></Field>
            {stuErr && <div style={{ fontSize: 12, color: '#f07070' }}>{stuErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <GhostBtn onClick={() => { setShowAddStudent(false); setStuErr('') }}>Cancel</GhostBtn>
              <PrimaryBtn onClick={addStudent} disabled={!stuUin.trim()}>Add</PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}

      {editingCourse && <EditCourseModal course={editingCourse} onClose={() => setEditingCourse(null)} onSave={updateCourse} />}
      {editingLab && <EditLabModal lab={editingLab} onClose={() => setEditingLab(null)} onSave={updateLab} />}
    </div>
  )
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────

function UsersTab({ ta }) {
  const [users, setUsers]     = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const [newEmail, setNewEmail]       = useState('')
  const [newName, setNewName]         = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole]         = useState('TA')
  const [addErr, setAddErr]           = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    try { const r = await fetch(`${API}/users`); if (r.ok) setUsers(await r.json()) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const createUser = async () => {
    if (!newEmail.trim() || !newName.trim() || !newPassword) return
    setAddErr('')
    const r = await fetch(`${API}/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim(), name: newName.trim(), password: newPassword, role: 'TA' })
    })
    if (r.ok) {
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('TA'); setShowAdd(false); fetchUsers()
    } else { const e = await r.json(); setAddErr(e.detail || 'Failed to create user') }
  }

  const deleteUser = async (id) => {
    if (users.find(u => u.id === id)?.email === ta?.email) return
    await fetch(`${API}/users/${id}`, { method: 'DELETE' })
    fetchUsers()
  }

  const fmtDate = (ts) => {
    if (!ts) return '—'
    try { return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }
    catch { return '—' }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '14px 10px' }}>
        <button style={{
          width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--r-sm)',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Overview
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Users</span>
            <span style={{ fontSize: 16, color: 'var(--text-3)', fontWeight: 400 }}>{filtered.length}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '7px 12px 7px 32px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none', width: 200 }} />
            </div>
            <button onClick={() => setShowAdd(true)} title="Add user" style={{
              width: 30, height: 30, borderRadius: 'var(--r-sm)', background: 'var(--surface)',
              border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)'
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Role', 'Name', 'Email', 'Created At', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No users found</td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 16px' }}><Badge /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Avatar name={u.name} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {u.email !== ta?.email && (
                      <button onClick={() => deleteUser(u.id)} title="Delete" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4, lineHeight: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
          ℹ Only TA and Admin accounts appear here. Students authenticate via UIN.
        </div>
      </div>

      {showAdd && (
        <Modal title="Add User" onClose={() => { setShowAdd(false); setAddErr('') }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full Name"><Input placeholder="Jane Smith" value={newName} onChange={e => setNewName(e.target.value)} /></Field>
            <Field label="Email"><Input type="email" placeholder="jane@tamu.edu" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></Field>
            <Field label="Password"><Input type="password" placeholder="Temporary password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></Field>
            {addErr && <div style={{ fontSize: 12, color: '#f07070' }}>{addErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <GhostBtn onClick={() => { setShowAdd(false); setAddErr('') }}>Cancel</GhostBtn>
              <PrimaryBtn onClick={createUser} disabled={!newEmail.trim() || !newName.trim() || !newPassword}>Add User</PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── SETTINGS TAB ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const [section, setSection] = useState('connections')
  const [settings, setSettings] = useState({})
  const [loading, setLoading]   = useState(true)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    fetch(`${API}/settings`).then(r => r.ok ? r.json() : {}).then(d => { setSettings(d); setLoading(false) })
  }, [])

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }))

  const save = async () => {
    const r = await fetch(`${API}/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  const sections = [
    { id: 'general',     label: 'General',    icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' },
    { id: 'connections', label: 'Connections', icon: 'M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-.1-9.999 5.002 5.002 0 0 0-9.78 2.096A4.001 4.001 0 0 0 3 15z' },
    { id: 'models',      label: 'Models',      icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' },
    { id: 'voice',       label: 'Voice / STT', icon: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8' },
    { id: 'audio',       label: 'Audio',       icon: 'M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07' },
    { id: 'elevenlabs',  label: 'ElevenLabs',  icon: 'M9 18V5l12-2v13M6 15H3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zM18 13h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z' },
    { id: 'database',    label: 'Database',    icon: 'M12 2a9 3 0 1 0 0 6 9 3 0 0 0 0-6zM3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0' },
  ]

  const ConnectionBlock = ({ title, desc, enableKey, urlKey, urlPlaceholder }) => (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
        </div>
        <Toggle value={settings[enableKey] !== 'false'} onChange={v => set(enableKey, v ? 'true' : 'false')} />
      </div>
      <Field label="Base URL">
        <Input value={settings[urlKey] || urlPlaceholder} onChange={e => set(urlKey, e.target.value)} placeholder={urlPlaceholder} />
      </Field>
    </div>
  )

  const renderContent = () => {
    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
    switch (section) {
      case 'general':
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, letterSpacing: '-0.01em' }}>General</h2>
            <SettingRow label="App Name" description="Display name shown in the TA dashboard header. Takes effect after Save.">
              <Input value={settings.app_name || 'Circuit AI'} onChange={e => set('app_name', e.target.value)} style={{ width: 200 }} />
            </SettingRow>
            <SettingRow label="Sleep Timeout" description="Minutes before the screen sleeps and the student session ends. Next tap starts a fresh session.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input type="number" min="1" max="60" value={settings.sleep_minutes || '15'} onChange={e => set('sleep_minutes', e.target.value)} style={{ width: 70 }} />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>min</span>
              </div>
            </SettingRow>
          </>
        )
      case 'connections':
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 22, letterSpacing: '-0.01em' }}>Connections</h2>
            <ConnectionBlock title="OpenAI API" desc="Manage OpenAI-compatible API connections" enableKey="openai_enabled" urlKey="openai_url" urlPlaceholder="https://api.openai.com/v1" />
            <ConnectionBlock title="Ollama API" desc="Manage Ollama API connections" enableKey="ollama_enabled" urlKey="ollama_url" urlPlaceholder="http://localhost:11434/v1" />
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
              <SettingRow label="Direct Connections" description="Allow connecting to custom OpenAI-compatible API endpoints.">
                <Toggle value={settings.enable_direct !== 'false'} onChange={v => set('enable_direct', v ? 'true' : 'false')} />
              </SettingRow>
              <SettingRow label="Cache Base Model List" description="Base Model List Cache speeds up access by fetching base models only at startup or on settings save — faster, but may not show recent base model changes.">
                <Toggle value={settings.cache_models === 'true'} onChange={v => set('cache_models', v ? 'true' : 'false')} />
              </SettingRow>
            </div>
          </>
        )
      case 'models': {
        const ModelPicker = ({ settingKey, currentVal, placeholder }) => {
          const [models, setModels] = useState([])
          const [fetching, setFetching] = useState(true)
          const [open, setOpen] = useState(false)
          const ref = useRef(null)

          useEffect(() => {
            const ollamaUrl = (settings.ollama_url || 'http://localhost:11434/v1').replace('/v1', '')
            fetch(`${ollamaUrl}/api/tags`)
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d?.models) setModels(d.models.map(m => m.name)) })
              .catch(() => {})
              .finally(() => setFetching(false))
          }, [])

          useEffect(() => {
            if (!open) return
            const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
            document.addEventListener('mousedown', handler)
            return () => document.removeEventListener('mousedown', handler)
          }, [open])

          const current = currentVal || placeholder
          return (
            <div ref={ref} style={{ position: 'relative', width: 260 }}>
              <button onClick={() => setOpen(o => !o)} style={{
                width: '100%', padding: '8px 12px', background: 'var(--bg-3)',
                border: `1px solid ${open ? 'var(--border-2)' : 'var(--border)'}`,
                borderRadius: 'var(--r)', color: 'var(--text)', fontSize: 13,
                fontFamily: 'var(--mono)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', gap: 8,
                textAlign: 'left', transition: 'border-color 0.15s'
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"
                  style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {open && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: '100%', zIndex: 50,
                  background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--r)',
                  boxShadow: 'var(--shadow-lg)', maxHeight: 220, overflowY: 'auto'
                }}>
                  {fetching ? (
                    <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--text-3)' }}>Fetching from Ollama…</div>
                  ) : models.length === 0 ? (
                    <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--text-3)' }}>No models found — type manually below</div>
                  ) : models.map(m => (
                    <button key={m} onClick={() => { set(settingKey, m); setOpen(false) }} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                      background: current === m ? 'var(--surface-2)' : 'transparent',
                      border: 'none', borderBottom: '1px solid var(--border)',
                      color: current === m ? 'var(--text)' : 'var(--text-2)',
                      fontSize: 13, fontFamily: 'var(--mono)', cursor: 'pointer',
                      transition: 'background 0.1s'
                    }}
                      onMouseEnter={e => { if (current !== m) e.currentTarget.style.background = 'var(--surface)' }}
                      onMouseLeave={e => { if (current !== m) e.currentTarget.style.background = 'transparent' }}
                    >{m}</button>
                  ))}
                  {/* Always show a manual entry option at the bottom */}
                  <div style={{ padding: '8px 12px', borderTop: models.length ? '1px solid var(--border)' : 'none' }}>
                    <input
                      placeholder="Or type a model name…"
                      defaultValue={current}
                      onKeyDown={e => { if (e.key === 'Enter') { set(settingKey, e.target.value); setOpen(false) } }}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--mono)', padding: '2px 0' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        }

        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, letterSpacing: '-0.01em' }}>Models</h2>
            <SettingRow label="Captions ON (large model)" description="Used when captions are enabled. Should support markdown, math, and long-form responses.">
              <ModelPicker settingKey="model_captions_on" currentVal={settings.model_captions_on} placeholder="gpt-oss:120b-cloud" />
            </SettingRow>
            <SettingRow label="Captions OFF (small model)" description="Voice-first mode. Should be fast and produce short, conversational output.">
              <ModelPicker settingKey="model_captions_off" currentVal={settings.model_captions_off} placeholder="qwen3:1.7b" />
            </SettingRow>
            <SettingRow label="Max tokens (captions ON)">
              <Input type="number" value={settings.max_tokens_large || '4096'} onChange={e => set('max_tokens_large', e.target.value)} style={{ width: 90 }} />
            </SettingRow>
            <SettingRow label="Max tokens (captions OFF)">
              <Input type="number" value={settings.max_tokens_small || '512'} onChange={e => set('max_tokens_small', e.target.value)} style={{ width: 90 }} />
            </SettingRow>
          </>
        )
      }
      case 'audio':
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, letterSpacing: '-0.01em' }}>Audio</h2>
            <SettingRow label="TTS Engine" description="Piper is recommended for Jetson. ElevenLabs requires an API key (configure in ElevenLabs tab). Web Speech is the fallback.">
              <select value={settings.tts_engine || 'piper'} onChange={e => set('tts_engine', e.target.value)} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer' }}>
                <option value="piper">Piper (local, offline)</option>
                <option value="elevenlabs">ElevenLabs (API)</option>
              </select>
            </SettingRow>
            <SettingRow label="Speech Rate" description="Controls Piper and Web Speech API playback speed. 1.0 is normal.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="range" min="0.5" max="2.0" step="0.05" value={settings.tts_rate || '1.05'} onChange={e => set('tts_rate', e.target.value)} style={{ width: 120, accentColor: 'var(--text)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--mono)', minWidth: 36 }}>{parseFloat(settings.tts_rate || 1.05).toFixed(2)}</span>
              </div>
            </SettingRow>
            <SettingRow label="Speech Pitch" description="Controls Web Speech API pitch only. Does not affect Piper or ElevenLabs.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="range" min="0.5" max="1.5" step="0.05" value={settings.tts_pitch || '1.0'} onChange={e => set('tts_pitch', e.target.value)} style={{ width: 120, accentColor: 'var(--text)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--mono)', minWidth: 36 }}>{parseFloat(settings.tts_pitch || 1.0).toFixed(2)}</span>
              </div>
            </SettingRow>
          </>
        )
      case 'voice':
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, letterSpacing: '-0.01em' }}>Voice / STT</h2>
            <SettingRow label="Whisper Model" description="Larger models are more accurate but slower. 'small' is recommended for Jetson. Restart required to apply.">
              <select value={settings.whisper_model || 'small'} onChange={e => set('whisper_model', e.target.value)} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer' }}>
                {['tiny', 'base', 'small', 'medium', 'large-v3'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </SettingRow>
            <SettingRow label="Whisper Device" description="'cpu' for Windows dev. 'cuda' for Jetson GPU acceleration. Restart required to apply.">
              <select value={settings.whisper_device || 'cpu'} onChange={e => set('whisper_device', e.target.value)} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer' }}>
                <option value="cpu">CPU (Windows dev)</option>
                <option value="cuda">CUDA (Jetson)</option>
              </select>
            </SettingRow>
            <SettingRow label="Energy Threshold (RMS)" description="Mic sensitivity for speech detection. Lower = more sensitive. Raise if false triggers occur. Takes effect immediately after Save.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="range" min="20" max="800" step="10" value={settings.energy_silence_rms || '50'} onChange={e => set('energy_silence_rms', e.target.value)} style={{ width: 120, accentColor: 'var(--text)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--mono)', minWidth: 36 }}>{settings.energy_silence_rms || 50}</span>
              </div>
            </SettingRow>
            <SettingRow label="Silence Threshold" description="Milliseconds of silence before utterance is considered complete. Takes effect immediately after Save.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input type="number" min="300" max="3000" step="100" value={settings.silence_threshold_ms || '1000'} onChange={e => set('silence_threshold_ms', e.target.value)} style={{ width: 90 }} />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>ms</span>
              </div>
            </SettingRow>
          </>
        )
      case 'elevenlabs':
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, letterSpacing: '-0.01em' }}>ElevenLabs</h2>
            <div style={{ padding: '10px 14px', marginBottom: 20, background: 'rgba(255,200,100,0.06)', border: '1px solid rgba(255,200,100,0.15)', borderRadius: 'var(--r)', fontSize: 12, color: 'rgba(255,200,100,0.7)' }}>
              Set TTS Engine to "ElevenLabs" in Audio settings to use this. Requires a valid API key.
            </div>
            <SettingRow label="API Key" description="Your ElevenLabs API key. Get one free at elevenlabs.io.">
              <Input type="password" placeholder="sk-…" value={settings.elevenlabs_api_key || ''} onChange={e => set('elevenlabs_api_key', e.target.value)} style={{ width: 260 }} />
            </SettingRow>
            <SettingRow label="Voice ID" description="ElevenLabs voice ID. Default is Rachel (21m00Tcm4TlvDq8ikWAM).">
              <Input value={settings.elevenlabs_voice || '21m00Tcm4TlvDq8ikWAM'} onChange={e => set('elevenlabs_voice', e.target.value)} style={{ width: 260, fontFamily: 'var(--mono)', fontSize: 12 }} />
            </SettingRow>
            <SettingRow label="Model" description="eleven_turbo_v2 is fastest. eleven_multilingual_v2 is highest quality.">
              <select value={settings.elevenlabs_model || 'eleven_turbo_v2'} onChange={e => set('elevenlabs_model', e.target.value)} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer' }}>
                <option value="eleven_turbo_v2">eleven_turbo_v2 (fastest)</option>
                <option value="eleven_monolingual_v1">eleven_monolingual_v1</option>
                <option value="eleven_multilingual_v2">eleven_multilingual_v2 (best quality)</option>
              </select>
            </SettingRow>
          </>
        )
      case 'database':
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, letterSpacing: '-0.01em' }}>Database</h2>
            <SettingRow label="Database Path" description="Location of the SQLite database file on disk.">
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>./students.db</span>
            </SettingRow>
            <SettingRow label="Reset All Conversations" description="Immediately wipes all student conversation histories. Same effect as restarting the backend.">
              <button onClick={async () => {
                await fetch(`${API}/admin/reset-conversations`, { method: 'POST' })
                alert('All conversations cleared.')
              }} style={{ padding: '7px 14px', borderRadius: 'var(--r)', border: '1px solid rgba(229,83,75,0.3)', background: 'rgba(229,83,75,0.08)', color: '#e5534b', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                Reset Now
              </button>
            </SettingRow>
          </>
        )
      default: return null
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 'var(--r-sm)',
            background: section === s.id ? 'var(--surface-2)' : 'transparent',
            border: `1px solid ${section === s.id ? 'var(--border)' : 'transparent'}`,
            color: section === s.id ? 'var(--text)' : 'var(--text-2)',
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
            transition: 'background 0.12s, color 0.12s'
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={s.icon}/></svg>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, padding: '28px 32px', overflowY: 'auto' }}>
        {renderContent()}
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {saved && (
            <span style={{ fontSize: 12, color: '#86efac', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </span>
          )}
          <PrimaryBtn onClick={save}>Save Changes</PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export default function AdminPanel({ ta, onClose }) {
  const [tab, setTab] = useState('courses')

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header tabs bar */}
      <div style={{ height: 48, borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', WebkitAppRegion: 'drag' }}>
        <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
          {[{ id: 'courses', label: 'Courses' }, { id: 'users', label: 'Users' }, { id: 'settings', label: 'Settings' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '0 22px', height: 48, background: 'none', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--text)' : '2px solid transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-2)',
              fontSize: 13, fontWeight: tab === t.id ? 500 : 400,
              cursor: 'pointer', fontFamily: 'var(--font)', transition: 'color 0.15s'
            }}>{t.label}</button>
          ))}
        </div>
        <button onClick={onClose} style={{
          marginRight: 20, padding: '5px 14px', borderRadius: 'var(--pill)',
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)',
          WebkitAppRegion: 'no-drag', transition: 'color 0.15s, border-color 0.15s'
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-2)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >← Dashboard</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'courses'  && <CoursesTab ta={ta} />}
        {tab === 'users'    && <UsersTab ta={ta} />}
        {tab === 'settings' && <SettingsTab ta={ta} />}
      </div>
    </div>
  )
}
