import { useState, useEffect, useMemo } from 'react'
import { API_URL } from '../../app/constants'

function parseCircuitVariationLabel(name = '') {
  const trimmed = String(name || '').trim()
  if (!trimmed) return ''
  const parts = trimmed.split('_')
  return parts.length > 1 ? parts[parts.length - 1] : trimmed
}

function normalizeImagePath(imagePath = '') {
  return String(imagePath || '').trim().replaceAll('\\', '/')
}

function buildCircuitImageUrl(imagePath = '') {
  const normalized = normalizeImagePath(imagePath)
  return normalized ? `${API_URL}/circuit-images/files/${encodeURI(normalized)}` : ''
}

function findExistingImagePath(imagePath = '', circuitName = '', catalog = []) {
  const normalizedPath = normalizeImagePath(imagePath)
  if (normalizedPath) {
    const exact = catalog.find(image => normalizeImagePath(image?.relative_path) === normalizedPath)
    if (exact?.relative_path) return normalizeImagePath(exact.relative_path)

    const filename = normalizedPath.split('/').pop()?.trim().toLowerCase()
    if (filename) {
      const filenameMatch = catalog.find(image => String(image?.filename || '').trim().toLowerCase() === filename)
      if (filenameMatch?.relative_path) return normalizeImagePath(filenameMatch.relative_path)
    }
  }

  const target = String(circuitName || '').trim().toLowerCase()
  if (!target) return normalizedPath

  const exactCircuit = catalog.find(image => String(image?.stem || '').trim().toLowerCase() === target)
  if (exactCircuit?.relative_path) return normalizeImagePath(exactCircuit.relative_path)

  const normalizedTarget = target.replace(/[^a-z0-9]+/gi, '')
  if (!normalizedTarget) return normalizedPath

  const relaxedCircuit = catalog.find(
    image => String(image?.stem || '').trim().toLowerCase().replace(/[^a-z0-9]+/gi, '') === normalizedTarget,
  )
  return normalizeImagePath(relaxedCircuit?.relative_path || normalizedPath)
}

function groupMappings(mappings = []) {
  const ordered = []
  const seen = new Map()

  for (const item of mappings) {
    const taskKey = String(item?.task_key || '').trim() || String(item?.task_label || '').trim() || 'task'
    if (!seen.has(taskKey)) {
      const group = {
        task_key: taskKey,
        task_label: String(item?.task_label || '').trim() || taskKey,
        variations: [],
      }
      seen.set(taskKey, group)
      ordered.push(group)
    }

    seen.get(taskKey).variations.push({
      id: item?.id ?? `${taskKey}-${item?.circuit_name || Math.random()}`,
      circuit_name: String(item?.circuit_name || '').trim(),
      variation_label: String(item?.variation_label || '').trim() || parseCircuitVariationLabel(item?.circuit_name || ''),
      image_path: normalizeImagePath(item?.resolved_image_path || item?.image_path || ''),
      image_url: String(item?.image_url || '').trim() || buildCircuitImageUrl(item?.resolved_image_path || item?.image_path || ''),
    })
  }

  return ordered.map(group => ({
    ...group,
    variations: group.variations.filter(v => v.circuit_name),
  })).filter(group => group.variations.length)
}

export default function CircuitDrawer({ open, onClose, onSubmit, activeLab }) {
  const [circuits, setCircuits] = useState([])
  const [selected, setSelected] = useState('')
  const [schema, setSchema] = useState(null)
  const [loading, setLoading] = useState(false)
  const [nodeVals, setNodeVals] = useState({})
  const [srcVals, setSrcVals] = useState({})
  const [temp, setTemp] = useState('27')
  const [tnom, setTnom] = useState('27')
  const [strict, setStrict] = useState(false)
  const [mappings, setMappings] = useState([])
  const [taskKey, setTaskKey] = useState('')
  const [mappingLoading, setMappingLoading] = useState(false)
  const [imageCatalog, setImageCatalog] = useState([])
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.classList.add('circuit-overlay-open')
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.classList.remove('circuit-overlay-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return

    fetch(`${API_URL}/circuit-images`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const images = Array.isArray(d?.images) ? d.images : []
        setImageCatalog(images)
      })
      .catch(() => setImageCatalog([]))
  }, [open])

  useEffect(() => {
    if (!open) return

    fetch(`${API_URL}/circuits`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list = Array.isArray(d?.circuits) ? d.circuits : []
        setCircuits(list)
        if (list.length && !selected) setSelected(list[0])
      })
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!activeLab?.id) {
      setMappings([])
      setTaskKey('')
      return
    }

    setMappingLoading(true)
    fetch(`${API_URL}/labs/${activeLab.id}/circuit-mappings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const rows = Array.isArray(d?.mappings) ? d.mappings : []
        setMappings(rows)
      })
      .catch(() => setMappings([]))
      .finally(() => setMappingLoading(false))
  }, [open, activeLab?.id])

  const groupedMappings = useMemo(() => groupMappings(mappings), [mappings])
  const hasMappedMode = groupedMappings.length > 0

  useEffect(() => {
    if (!hasMappedMode) {
      setTaskKey('')
      return
    }
    const stillExists = groupedMappings.some(group => group.task_key === taskKey)
    if (!taskKey || !stillExists) setTaskKey(groupedMappings[0].task_key)
  }, [groupedMappings, hasMappedMode, taskKey])

  const activeTask = useMemo(() => {
    if (!hasMappedMode) return null
    return groupedMappings.find(group => group.task_key === taskKey) || groupedMappings[0] || null
  }, [groupedMappings, hasMappedMode, taskKey])

  useEffect(() => {
    if (!hasMappedMode) return
    const firstCircuit = activeTask?.variations?.[0]?.circuit_name || ''
    const stillExists = activeTask?.variations?.some(v => v.circuit_name === selected)
    if (!selected || !stillExists) setSelected(firstCircuit)
  }, [activeTask, hasMappedMode, selected])

  useEffect(() => {
    if (!open || !selected) return
    setLoading(true)
    setSchema(null)

    fetch(`${API_URL}/circuits/${encodeURIComponent(selected)}/nodes`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setSchema(d)
        const nv = {}
        ;(d.nodes || []).forEach(n => { nv[n.node_name] = '' })
        setNodeVals(nv)
        const sv = {}
        ;(d.source_currents || []).forEach(s => { sv[s.source_name] = '' })
        setSrcVals(sv)
        if (d.golden_defaults?.temp !== undefined) setTemp(String(d.golden_defaults.temp))
        if (d.golden_defaults?.tnom !== undefined) setTnom(String(d.golden_defaults.tnom))
        setStrict(false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, selected])

  const parseMap = (vals, label) => {
    const out = {}
    for (const [k, v] of Object.entries(vals)) {
      const t = String(v || '').trim()
      if (!t) continue
      const n = Number(t)
      if (!Number.isFinite(n)) throw new Error(`${label} '${k}' must be numeric.`)
      out[k] = n
    }
    return out
  }

  const parseOpt = (label, v) => {
    const t = String(v || '').trim()
    if (!t) return null
    const n = Number(t)
    if (!Number.isFinite(n)) throw new Error(`${label} must be numeric.`)
    return n
  }

  const selectedVariation = useMemo(() => {
    return activeTask?.variations?.find(v => v.circuit_name === selected) || null
  }, [activeTask, selected])
  const selectedVariationImagePath = useMemo(() => (
    findExistingImagePath(selectedVariation?.resolved_image_path || selectedVariation?.image_path || '', selectedVariation?.circuit_name || selected, imageCatalog)
  ), [imageCatalog, selectedVariation, selected])
  const selectedVariationImageUrl = selectedVariationImagePath ? buildCircuitImageUrl(selectedVariationImagePath) : ''

  useEffect(() => {
    setImageLoadFailed(false)
  }, [selectedVariationImageUrl])

  const buildSummary = (p) => {
    const nl = Object.entries(p.node_voltages).map(([k, v]) => `- ${k}: ${v} V`).join('\n')
    const sl = Object.entries(p.source_currents).map(([k, v]) => `- ${k}: ${v} A`).join('\n')
    const taskLine = activeTask ? `Task: ${activeTask.task_label}` : null
    const variationLine = selectedVariation?.variation_label ? `Variation: ${selectedVariation.variation_label}` : null
    return [
      'Circuit Analyzer Submission',
      activeLab?.name ? `Lab: ${activeLab.name}` : null,
      taskLine,
      `Circuit: ${p.circuit_name}`,
      variationLine,
      '',
      'Node Voltages:',
      nl || '- none',
      '',
      'Source Currents:',
      sl || '- none',
      '',
      `Temp: ${p.temp ?? 'n/a'} °C`,
      `Tnom: ${p.tnom ?? 'n/a'} °C`,
    ].filter(Boolean).join('\n')
  }

  const handleDone = () => {
    if (!schema) return
    try {
      const nv = parseMap(nodeVals, 'Node voltage')
      const sv = parseMap(srcVals, 'Source current')
      if (strict) {
        const missing = (schema.nodes || []).map(n => n.node_name).filter(n => nv[n] === undefined)
        if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`)
      }
      const payload = {
        circuit_name: selected,
        node_voltages: nv,
        source_currents: sv,
        temp: parseOpt('Temp', temp),
        tnom: parseOpt('Tnom', tnom),
        strict,
      }
      onSubmit(payload, buildSummary(payload))
      onClose()
    } catch (e) {
      alert(e.message)
    }
  }

  const handleReset = () => {
    if (!schema) return
    const nv = {}
    ;(schema.nodes || []).forEach(n => { nv[n.node_name] = '' })
    setNodeVals(nv)
    const sv = {}
    ;(schema.source_currents || []).forEach(s => { sv[s.source_name] = '' })
    setSrcVals(sv)
    if (schema.golden_defaults?.temp !== undefined) setTemp(String(schema.golden_defaults.temp))
    if (schema.golden_defaults?.tnom !== undefined) setTnom(String(schema.golden_defaults.tnom))
    setStrict(false)
  }

  const availableVariations = activeTask?.variations || []
  const nodeCount = Array.isArray(schema?.nodes) ? schema.nodes.length : 0
  const sourceCount = Array.isArray(schema?.source_currents) ? schema.source_currents.length : 0

  if (!open) return null

  return (
    <div className="circuit-overlay" onMouseDown={onClose}>
      <div
        className="circuit-modal"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Circuit analyzer"
      >
        <div className="circuit-modal-header">
          <div>
            <div className="drawer-title">Circuit analyzer</div>
            <div className="circuit-modal-heading-row">
              <h2 className="circuit-modal-heading">Embedded analyzer workspace</h2>
              {activeLab?.name && <span className="circuit-chip">{activeLab.name}</span>}
            </div>
            <div className="circuit-modal-subtitle">
              Select the mapped task and variation, enter measurements, and send a structured analyzer summary back into the lab assistant.
            </div>
          </div>
          <button className="bar-btn circuit-close-btn" onClick={onClose} title="Close analyzer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="circuit-modal-body">
          <aside className="circuit-modal-sidebar">
            <div className="circuit-card">
              <div className="circuit-card-header">
                <div>
                  <div className="field-label">Selection</div>
                  <div className="circuit-card-title">Circuit target</div>
                </div>
                {selected && <div className="circuit-name-tag">{selected}</div>}
              </div>

              {hasMappedMode ? (
                <div className="circuit-stack">
                  <div>
                    <div className="field-label">Task</div>
                    <select className="field-select" value={taskKey} onChange={e => setTaskKey(e.target.value)} disabled={mappingLoading || !groupedMappings.length}>
                      {groupedMappings.map(group => (
                        <option key={group.task_key} value={group.task_key}>{group.task_label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="field-label">Variation</div>
                    <select className="field-select" value={selected} onChange={e => setSelected(e.target.value)} disabled={mappingLoading || !availableVariations.length}>
                      {availableVariations.map(variation => (
                        <option key={variation.id} value={variation.circuit_name}>
                          {variation.variation_label || variation.circuit_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="field-label">Circuit</div>
                  <select className="field-select" value={selected} onChange={e => setSelected(e.target.value)} disabled={!circuits.length}>
                    {!circuits.length ? <option>No circuits available</option> : circuits.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {hasMappedMode && activeLab?.name && (
                <div className="schema-note">
                  Using mapped circuits for {activeLab.name}. Only the configured task variations are shown here.
                </div>
              )}

              {!hasMappedMode && !mappingLoading && activeLab?.name && (
                <div className="schema-note">
                  No task-to-circuit mappings are configured for {activeLab.name} yet, so all API circuits are shown.
                </div>
              )}
            </div>

            <div className="circuit-card circuit-image-card">
              <div className="circuit-card-header">
                <div>
                  <div className="field-label">Diagram</div>
                  <div className="circuit-card-title">Variation preview</div>
                </div>
                {selectedVariation?.variation_label && <span className="circuit-chip subtle">{selectedVariation.variation_label}</span>}
              </div>

              {!!selectedVariationImageUrl && !imageLoadFailed ? (
                <img
                  src={selectedVariationImageUrl}
                  alt={selectedVariation?.variation_label || selected || 'Circuit variation'}
                  className="circuit-preview-image"
                  onError={() => setImageLoadFailed(true)}
                />
              ) : (
                <div className="empty-box circuit-preview-empty">
                  {imageLoadFailed ? 'Could not load the mapped image for this variation.' : 'No diagram is available for this selection yet.'}
                </div>
              )}

              {selectedVariationImagePath && (
                <div className="schema-note circuit-path-note">{selectedVariationImagePath}</div>
              )}
            </div>

            <div className="circuit-card">
              <div className="circuit-card-header">
                <div>
                  <div className="field-label">Run settings</div>
                  <div className="circuit-card-title">Solver defaults</div>
                </div>
                <span className="circuit-chip subtle">{nodeCount} nodes • {sourceCount} currents</span>
              </div>

              <div className="grid-2">
                <div>
                  <div className="field-label">Temp (°C)</div>
                  <input className="field-input" value={temp} onChange={e => setTemp(e.target.value)} disabled={loading} />
                </div>
                <div>
                  <div className="field-label">Tnom (°C)</div>
                  <input className="field-input" value={tnom} onChange={e => setTnom(e.target.value)} disabled={loading} />
                </div>
              </div>

              <label className="check-row">
                <input type="checkbox" checked={strict} onChange={e => setStrict(e.target.checked)} disabled={loading} />
                Require all node measurements
              </label>
            </div>
          </aside>

          <section className="circuit-modal-main">
            {(loading || mappingLoading) && (
              <div className="loading-row circuit-inline-status">
                <div className="db-spinner" />
                {mappingLoading ? 'Loading mapped circuits…' : 'Loading schema…'}
              </div>
            )}

            {!loading && schema && (
              <div className="circuit-measurement-grid">
                <div className="circuit-card circuit-measurements-card">
                  <div className="circuit-card-header">
                    <div>
                      <div className="field-label">Inputs</div>
                      <div className="circuit-card-title">Node voltages</div>
                    </div>
                    <span className="circuit-chip subtle">{nodeCount}</span>
                  </div>

                  {!(schema.nodes || []).length ? (
                    <div className="empty-box">No nodes.</div>
                  ) : (
                    <div className="circuit-measurement-list">
                      {(schema.nodes || []).map(n => (
                        <div key={n.node_name} className="mrow circuit-mrow">
                          <div>
                            <div className="mname">{n.node_name}</div>
                            {n.measurement_key && <div className="mkey">{n.measurement_key}</div>}
                          </div>
                          <input
                            className="field-input"
                            value={nodeVals[n.node_name] || ''}
                            onChange={e => setNodeVals(v => ({ ...v, [n.node_name]: e.target.value }))}
                            placeholder={n.golden_value != null ? String(n.golden_value) : ''}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="circuit-card circuit-measurements-card">
                  <div className="circuit-card-header">
                    <div>
                      <div className="field-label">Optional</div>
                      <div className="circuit-card-title">Source currents</div>
                    </div>
                    <span className="circuit-chip subtle">{sourceCount}</span>
                  </div>

                  {!(schema.source_currents || []).length ? (
                    <div className="empty-box">None required.</div>
                  ) : (
                    <div className="circuit-measurement-list">
                      {(schema.source_currents || []).map(s => (
                        <div key={s.source_name} className="mrow circuit-mrow">
                          <div>
                            <div className="mname">{s.source_name}</div>
                            {s.measurement_key && <div className="mkey">{s.measurement_key}</div>}
                          </div>
                          <input
                            className="field-input"
                            value={srcVals[s.source_name] || ''}
                            onChange={e => setSrcVals(v => ({ ...v, [s.source_name]: e.target.value }))}
                            placeholder={s.golden_value != null ? String(s.golden_value) : ''}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!loading && !schema && !mappingLoading && (
              <div className="circuit-card circuit-empty-card">
                <div className="empty-box">Select a circuit to load its schema.</div>
              </div>
            )}

            {schema?.notes?.recommended && (
              <div className="circuit-card circuit-note-card">
                <div className="field-label">Recommended</div>
                <div className="schema-note circuit-note-copy">{schema.notes.recommended}</div>
              </div>
            )}
          </section>
        </div>

        <div className="circuit-modal-actions drawer-actions">
          <div className="circuit-actions-meta">
            {selected && <span className="circuit-chip subtle">{selected}</span>}
            {activeTask?.task_label && <span className="circuit-chip subtle">{activeTask.task_label}</span>}
          </div>
          <div className="circuit-actions-buttons">
            <button className="btn-ghost" onClick={handleReset} disabled={loading || !schema}>Reset</button>
            <button className="btn-white" onClick={handleDone} disabled={loading || !schema || !selected}>Submit to AI →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
