import React, { useEffect, useMemo, useState } from 'react'
import { CButton, CFormInput, CCard, CCardBody } from '@coreui/react'
import { FaEdit, FaTrash, FaWarehouse, FaSyncAlt, FaMinus, FaPlus } from 'react-icons/fa'
import { toast } from 'react-toastify'
import Select from 'react-select'
import API from '../../api.js'
import '../../assets/CSS/locationMaster.css'

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.message || data.error) return data.message || data.error

  if (data.errors && typeof data.errors === 'object') {
    const firstField = Object.keys(data.errors)[0]
    const firstMessage = data.errors[firstField]?.[0]
    if (firstMessage) return firstMessage
  }

  return fallback
}

// Front slots use ODD numbers (1,3,5...), Rear slots use EVEN numbers
// (2,4,6...) — each side gets its own full run of {fixture} slots,
// matching the reference app's makeBins() logic exactly.
const buildSlotCode = (columnNo, rowNo, slotNumber, side) =>
  `${columnNo}-${rowNo}-${slotNumber}${side === 'front' ? 'F' : 'R'}`

const buildFrontSlots = (fixture) => Array.from({ length: fixture }, (_, i) => i * 2 + 1)
const buildRearSlots = (fixture) => Array.from({ length: fixture }, (_, i) => i * 2 + 2)

const LocationMaster = () => {
  // ---- Store (Add Location) state — Store Name is linked to Store Master ----
  const [stores, setStores] = useState([])
  const [storeMasters, setStoreMasters] = useState([])
  const [form, setForm] = useState({ storeMasterId: '' })
  const [errors, setErrors] = useState({ storeMasterId: '' })
  const [editId, setEditId] = useState(null)
  const [activeStore, setActiveStore] = useState(null)

  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'store'|'rack', label, id, extra }

  // ---- Racks (saved) ----
  const [racks, setRacks] = useState([]) // [{ id, rackNo, columns:[{ id, columnNo, rows:[...] }] }]
  const [occupancy, setOccupancy] = useState([])

  // ---- Add Rack panel ----
  const [showRackPanel, setShowRackPanel] = useState(false)
  const [rackFormNo, setRackFormNo] = useState('')
  const [rackFormRows, setRackFormRows] = useState(5)
  const [rackFormCols, setRackFormCols] = useState(1)
  const [draftGrid, setDraftGrid] = useState([]) // [{ columnNo, rowNo, hasFront, hasRear, fixture }]
  const [editingRackNo, setEditingRackNo] = useState('') // set when bulk-editing an existing rack

  // ---- Right panel preview ----
  const [selectedRackKey, setSelectedRackKey] = useState(null) // rack.id, or '__PREVIEW__'
  const [viewSide, setViewSide] = useState('front')
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    loadStores()
    loadStoreMasters()
  }, [])

  const loadStoreMasters = async () => {
    try {
      const res = await API.get('/StoreMaster')
      setStoreMasters(res.data || [])
    } catch {
      toast.error('Failed to load stores from Store Master')
    }
  }

  const storeMasterOptions = storeMasters.map((s) => ({
    value: s.id,
    label: `${s.storeLocation}-${s.palletNumber}`,
    colourCode: s.colourCode,
    palletNumber: s.palletNumber,
  }))

  // react-select's default filter does a plain substring match on the
  // label — that breaks if the user types a separator that doesn't
  // exactly match what's rendered (spaces, dashes, case, etc.). This
  // normalizes both sides (strip everything but letters/digits, lowercase)
  // before comparing, so "R-BR", "r br", "RBR01" all still find "R-BR-01".
  const filterStoreMasterOption = (option, rawInput) => {
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    return normalize(option.label).includes(normalize(rawInput))
  }

  const selectedStoreMaster = storeMasterOptions.find(
    (x) => String(x.value) === String(form.storeMasterId),
  )

  const clearError = (name) => setErrors((prev) => ({ ...prev, [name]: '' }))

  const loadStores = async () => {
    try {
      const res = await API.get('/LocationMaster')
      setStores(res.data || [])
    } catch {
      toast.error('Failed to load stores')
    }
  }

  const loadRacks = async (storeId) => {
    try {
      const res = await API.get(`/LocationRack/store/${storeId}`)
      setRacks(res.data || [])
    } catch {
      toast.error('Failed to load racks')
    }
  }

  const loadOccupancy = async (storeId) => {
    try {
      const res = await API.get(`/LocationRack/store/${storeId}/occupancy`)
      setOccupancy(res.data || [])
    } catch {
      toast.error('Failed to load slot occupancy')
    }
  }

  const openStore = async (store) => {
    setActiveStore(store)
    setShowRackPanel(false)
    setDraftGrid([])
    setRackFormNo('')
    setSelectedRackKey(null)

    const res = await API.get(`/LocationRack/store/${store.id}`)
    const freshRacks = res.data || []
    setRacks(freshRacks)
    setSelectedRackKey(freshRacks[0]?.id ?? null)

    await loadOccupancy(store.id)
  }

  const handleSubmit = async () => {
    if (!form.storeMasterId) {
      setErrors({ storeMasterId: 'Store Name is required' })
      return
    }
    setErrors({ storeMasterId: '' })

    try {
      const payload = { storeMasterId: Number(form.storeMasterId) }

      let res
      if (editId) {
        res = await API.put(`/LocationMaster/${editId}`, payload)
        toast.success('Store Updated Successfully')
      } else {
        res = await API.post('/LocationMaster', payload)
        toast.success('Store Saved Successfully')
      }

      await loadStores()

      // res.data is the raw LocationMaster entity (no joined
      // storeLocation/palletNumber/colourCode) — look up the freshly
      // loaded, fully-joined record instead so activeStore never shows
      // "undefined".
      const freshList = (await API.get('/LocationMaster')).data || []
      const fullRecord = freshList.find((s) => s.id === res.data.id) || res.data

      await openStore(fullRecord)
      resetForm()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const resetForm = () => {
    setForm({ storeMasterId: '' })
    setErrors({ storeMasterId: '' })
    setEditId(null)
  }

  const handleEditStoreLink = (store) => {
    setEditId(store.id)
    setForm({ storeMasterId: store.storeMasterId })
    setErrors({ storeMasterId: '' })
    openStore(store)
  }

  const handleDeleteStore = () => {
    if (!activeStore) return
    setConfirmDelete({
      type: 'store',
      id: activeStore.id,
      label: activeStore.storeLocation,
      extra: activeStore.storeCode,
    })
  }

  // ---------- Add Rack: client-side grid generation ----------

  // Live preview, built directly from the Rack No / Rows / Columns inputs
  // as they're typed — before "+" is ever clicked, matching the reference
  // app's livePreview(). Uses sensible defaults (Front+Rear on, Fixture 6)
  // since nothing's been fine-tuned in a generated grid yet.
  const livePreviewGrid = useMemo(() => {
    const rackNo = rackFormNo.trim().toUpperCase()
    const rows = Number(rackFormRows)
    const cols = Number(rackFormCols)

    if (!rackNo || !rows || rows < 1 || !cols || cols < 1) return null

    const grid = []
    for (let c = 1; c <= cols; c++) {
      for (let r = 1; r <= rows; r++) {
        grid.push({
          columnNo: `${rackNo}${c}`,
          rowNo: `R${r}`,
          hasFront: true,
          hasRear: true,
          fixture: 6,
        })
      }
    }
    return grid
  }, [rackFormNo, rackFormRows, rackFormCols])

  // The grid actually shown in the right panel: the fine-tuned draftGrid
  // (after "+ Generate" and any per-row edits) takes priority; otherwise
  // fall back to the raw live preview from the inputs alone.
  const effectiveDraftGrid = draftGrid.length > 0 ? draftGrid : (livePreviewGrid || [])

  useEffect(() => {
    if (showRackPanel && livePreviewGrid) {
      setSelectedRackKey('__PREVIEW__')
    }
  }, [rackFormNo, rackFormRows, rackFormCols, showRackPanel])

  const handleOpenAddRack = () => {
    setShowRackPanel(true)
    setEditingRackNo('')
    setRackFormNo('')
    setRackFormRows(5)
    setRackFormCols(1)
    setDraftGrid([])
  }

  const handleGenerateGrid = () => {
    const rackNo = rackFormNo.trim().toUpperCase()
    const rows = Number(rackFormRows)
    const cols = Number(rackFormCols)

    if (!rackNo) {
      toast.error('Enter Rack No')
      return
    }
    if (!/^[A-Z]{1,5}$/.test(rackNo)) {
      toast.error('Rack No must be letters only (A-Z)')
      return
    }
    if (!rows || rows < 1 || !cols || cols < 1) {
      toast.error('Enter Rows and Columns')
      return
    }

    const grid = []
    for (let c = 1; c <= cols; c++) {
      for (let r = 1; r <= rows; r++) {
        grid.push({
          columnNo: `${rackNo}${c}`,
          rowNo: `R${r}`,
          hasFront: true,
          hasRear: true,
          fixture: 6,
        })
      }
    }

    setDraftGrid(grid)
    setSelectedRackKey('__PREVIEW__')
  }

  const updateDraftRow = (index, field, value) => {
    setDraftGrid((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const toggleAllView = (checked) => {
    setDraftGrid((prev) => prev.map((r) => ({ ...r, hasFront: checked, hasRear: checked })))
  }

  const handleClearRackForm = () => {
    setRackFormNo('')
    setRackFormRows(5)
    setRackFormCols(1)
    setDraftGrid([])
    setEditingRackNo('')
    setSelectedRackKey(racks[0]?.id ?? null)
  }

  const handleSaveRack = async () => {
    const rackNo = rackFormNo.trim().toUpperCase()

    if (!rackNo) {
      toast.error('Enter Rack No')
      return
    }
    if (draftGrid.length === 0) {
      toast.error('Click + to generate the grid first')
      return
    }

    try {
      await API.post(`/LocationRack/store/${activeStore.id}/save-grid`, {
        rackNo,
        rows: draftGrid,
      })

      toast.success(editingRackNo ? `Rack "${rackNo}" updated` : `Rack "${rackNo}" saved`)

      // Clear the form first...
      setRackFormNo('')
      setRackFormRows(5)
      setRackFormCols(1)
      setDraftGrid([])
      setEditingRackNo('')

      // ...then reload racks and explicitly select the one we just saved,
      // so the populated grid shows immediately instead of requiring a
      // manual reselect from the dropdown.
      const res = await API.get(`/LocationRack/store/${activeStore.id}`)
      const freshRacks = res.data || []
      setRacks(freshRacks)

      const savedRack = freshRacks.find((r) => r.rackNo === rackNo)
      setSelectedRackKey(savedRack ? savedRack.id : (freshRacks[0]?.id ?? null))

      await loadOccupancy(activeStore.id)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const handleEditRack = (rack) => {
    setShowRackPanel(true)
    setEditingRackNo(rack.rackNo)
    setRackFormNo(rack.rackNo)
    setRackFormRows(rack.columns[0]?.rows.length || 1)
    setRackFormCols(rack.columns.length || 1)

    const grid = []
    rack.columns.forEach((col) => {
      col.rows.forEach((row) => {
        grid.push({
          columnNo: col.columnNo,
          rowNo: row.rowNo,
          hasFront: row.hasFront,
          hasRear: row.hasRear,
          fixture: row.fixture,
        })
      })
    })

    setDraftGrid(grid)
    setSelectedRackKey('__PREVIEW__')
    toast.info(`Editing Rack ${rack.rackNo} — modify and click Save`)
  }

  const handleDeleteRack = (rackId, rackNo) => {
    setConfirmDelete({ type: 'rack', id: rackId, label: `Rack ${rackNo}` })
  }

  const executeConfirmedDelete = async () => {
    if (!confirmDelete) return

    try {
      if (confirmDelete.type === 'store') {
        await API.delete(`/LocationMaster/${confirmDelete.id}`)
        toast.success('Store Deleted')
        setActiveStore(null)
        setRacks([])
        setShowRackPanel(false)
        await loadStores()
      } else {
        await API.delete(`/LocationRack/${confirmDelete.id}`)
        toast.success(`${confirmDelete.label} deleted`)
        if (selectedRackKey === confirmDelete.id) setSelectedRackKey(null)
        await loadRacks(activeStore.id)
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setConfirmDelete(null)
    }
  }

  // ---------- Occupancy (click a saved slot to occupy/vacate) ----------

  const occupancyMap = useMemo(() => {
    const map = new Map()
    occupancy.forEach((o) => map.set(`${o.rackRowId}-${o.slotNumber}-${o.side}`, o))
    return map
  }, [occupancy])

  const handleSlotClick = async (row, slotNumber, side) => {
    const key = `${row.id}-${slotNumber}-${side}`
    const existing = occupancyMap.get(key)

    if (existing) {
      try {
        await API.delete(`/LocationRack/slots/occupy/${existing.id}`)
        toast.success('Slot Vacated')
        await loadOccupancy(activeStore.id)
      } catch (err) {
        toast.error(getErrorMessage(err, 'Vacate Failed'))
      }
      return
    }

    const qtyInput = window.prompt('Quantity to place in this slot?', '1')
    if (!qtyInput) return
    const qty = Number(qtyInput)
    if (!qty || qty <= 0) {
      toast.error('Enter a valid quantity')
      return
    }

    try {
      await API.post('/LocationRack/slots/occupy', {
        rackRowId: row.id,
        slotNumber,
        side: side === 'front' ? 'Front' : 'Rear',
        quantity: qty,
      })
      toast.success('Slot Occupied')
      await loadOccupancy(activeStore.id)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Occupy Failed'))
    }
  }

  // ---------- Right panel: rack selector options + resolved view ----------

  const rackOptions = [
    ...racks.map((r) => ({ value: r.id, label: `Rack ${r.rackNo}` })),
    ...(effectiveDraftGrid.length > 0
      ? [{ value: '__PREVIEW__', label: `Rack ${rackFormNo.trim().toUpperCase() || '?'} (preview)` }]
      : []),
  ]

  // Group the current draft grid into { columnNo: [rows] } for rendering,
  // same shape as a saved rack's columns.
  const draftColumns = useMemo(() => {
    const map = new Map()
    effectiveDraftGrid.forEach((r) => {
      if (!map.has(r.columnNo)) map.set(r.columnNo, [])
      map.get(r.columnNo).push(r)
    })
    return Array.from(map.entries()).map(([columnNo, rows]) => ({ columnNo, rows }))
  }, [effectiveDraftGrid])

  const isPreviewSelected = selectedRackKey === '__PREVIEW__' && effectiveDraftGrid.length > 0
  const selectedSavedRack = racks.find((r) => r.id === selectedRackKey)

  return (
    <div className="location-master-page">
      <div className="location-grid">
        {/* LEFT PANEL */}
        <CCard className="location-form-card">
          <CCardBody>
            <div className="section-title">Add Location</div>

            <div className="loc-field">
              <label className="custom-label">
                <strong>Store Name</strong> <span className="required">*</span>
              </label>
              <div className={errors.storeMasterId ? 'react-select-error' : ''}>
                <Select
                  classNamePrefix="react-select"
                  placeholder="Select Store Name"
                  options={storeMasterOptions}
                  filterOption={filterStoreMasterOption}
                  value={storeMasterOptions.find((x) => String(x.value) === String(form.storeMasterId)) || null}
                  onChange={(selected) => {
                    setForm({ ...form, storeMasterId: selected?.value || '' })
                    clearError('storeMasterId')
                  }}
                  isClearable
                />
              </div>
              {errors.storeMasterId && <small className="text-danger">{errors.storeMasterId}</small>}
            </div>

            <div className="loc-field">
              <label className="custom-label">Pallet Number</label>
              <CFormInput value={selectedStoreMaster?.palletNumber || ''} placeholder="Auto-filled from Store Master" disabled />
            </div>

            <div className="loc-field">
              <label className="custom-label">Colour Picker</label>
              <div className="colour-picker-wrap colour-readonly loc-colour-with-add">
                <span className="colour-swatch" style={{ background: selectedStoreMaster?.colourCode || '#e2e8f0' }} />
                <input
                  type="text"
                  className="colour-hex-input"
                  value={selectedStoreMaster?.colourCode || ''}
                  placeholder="Auto-filled from Store Master"
                  disabled
                />
                <button
                  type="button"
                  className="loc-colour-add-btn"
                  title={editId ? 'Update this store' : 'Add this store'}
                  onClick={handleSubmit}
                >
                  <FaPlus size={12} />
                </button>
              </div>
            </div>

            {activeStore && (
              <div className="sc">
                <div className="sc-row"><div className="sc-lbl">Store Name</div><div className="sc-val">{activeStore.storeLocation}</div></div>
                <div className="sc-row"><div className="sc-lbl">Store ID</div><div className="sc-val">{activeStore.storeCode}</div></div>
                <div className="sc-row"><div className="sc-lbl">Pallet No</div><div className="sc-val">{activeStore.palletNumber}</div></div>
                <div className="sc-row">
                  <div className="sc-lbl">Racks</div>
                  <div className="sc-val">
                    {racks.map((r) => (
                      <span key={r.id} className="rack-chip-inline">
                        <FaWarehouse size={9} /> {r.rackNo}
                      </span>
                    ))}
                    <button type="button" className="btn-ar" onClick={handleOpenAddRack}>+ Add Rack</button>
                  </div>
                </div>
                <div className="sc-row">
                  <div className="sc-lbl">Action</div>
                  <div className="sc-val">
                    <span className="aicons">
                      <FaEdit className="icon-edit" onClick={() => handleEditStoreLink(activeStore)} title="Change Linked Store" />
                      <FaTrash className="icon-delete" onClick={handleDeleteStore} title="Delete Store" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeStore && showRackPanel && (
              <div className="ip">
                <div className="ip-hdr">
                  <span className="ip-single-title">Add / Edit Rack</span>
                  <button className="ip-close" onClick={() => setShowRackPanel(false)}>✕</button>
                </div>

                <div className="pb">
                    <div className="sec-t">
                      {editingRackNo ? `Edit Rack ${editingRackNo} — Store ${activeStore.storeCode}` : `Add Rack For Store ${activeStore.storeCode}`}
                    </div>

                    <div className="rack-input-grid">
                      <div className="rack-input-field">
                        <label className="rack-input-label">
                          Rack No
                          <span className="rack-input-help">Letters only — A, B, AB...</span>
                        </label>
                        <input
                          className="ri-full"
                          placeholder="e.g. A"
                          value={rackFormNo}
                          disabled={!!editingRackNo}
                          onChange={(e) => setRackFormNo(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                        />
                      </div>

                      <div className="rack-input-field">
                        <label className="rack-input-label">
                          Rows
                          <span className="rack-input-help">How many rows tall</span>
                        </label>
                        <input
                          className="ri-full"
                          type="number"
                          min={1}
                          placeholder="e.g. 5"
                          value={rackFormRows}
                          onChange={(e) => setRackFormRows(e.target.value)}
                        />
                      </div>

                      <div className="rack-input-field">
                        <label className="rack-input-label">
                          Columns
                          <span className="rack-input-help">How many columns wide</span>
                        </label>
                        <input
                          className="ri-full"
                          type="number"
                          min={1}
                          placeholder="e.g. 1"
                          value={rackFormCols}
                          onChange={(e) => setRackFormCols(e.target.value)}
                        />
                      </div>
                    </div>

                    <button className="rack-generate-btn" type="button" onClick={handleGenerateGrid}>
                      <FaPlus size={12} /> Generate Grid
                    </button>

                    {draftGrid.length > 0 && (
                      <table className="rgt">
                        <thead>
                          <tr>
                            <th>Column</th>
                            <th>Row</th>
                            <th>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={draftGrid.every((r) => r.hasFront && r.hasRear)}
                                  onChange={(e) => toggleAllView(e.target.checked)}
                                />
                                View
                              </label>
                            </th>
                            <th>Fixture</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftGrid.map((row, index) => (
                            <tr key={`${row.columnNo}-${row.rowNo}`}>
                              <td>{row.columnNo}</td>
                              <td>{row.rowNo}</td>
                              <td>
                                <label className="chk-l">
                                  <input
                                    type="checkbox"
                                    checked={row.hasFront}
                                    onChange={(e) => updateDraftRow(index, 'hasFront', e.target.checked)}
                                  />
                                  Front
                                </label>
                                <label className="chk-l">
                                  <input
                                    type="checkbox"
                                    checked={row.hasRear}
                                    onChange={(e) => updateDraftRow(index, 'hasRear', e.target.checked)}
                                  />
                                  Rear
                                </label>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min={1}
                                  className="fix-i"
                                  value={row.fixture}
                                  onChange={(e) => updateDraftRow(index, 'fixture', Number(e.target.value) || 1)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div className="pf">
                      <button className="bs" onClick={handleSaveRack}>{editingRackNo ? 'Update' : 'Save'}</button>
                      <button className="bc" onClick={handleClearRackForm}>Clear</button>
                    </div>
                </div>
              </div>
            )}

            {stores.length > 0 && (
              <div className="store-list-mini">
                <div className="custom-label" style={{ marginTop: 14 }}><strong>Stores</strong></div>
                {stores.map((s) => (
                  <div
                    key={s.id}
                    className={`store-mini-row ${activeStore?.id === s.id ? 'active' : ''}`}
                    onClick={() => openStore(s)}
                  >
                    <span className="store-mini-label">
                      {s.storeCode} — {s.storeLocation}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CCardBody>
        </CCard>

        {/* RIGHT PANEL — Rack -> Column -> Row visualization */}
        <CCard className="location-preview-card">
          <CCardBody className="location-preview-body">
            {!activeStore ? (
              <div className="empty-state">
                <div className="empty-icon"><FaWarehouse size={34} /></div>
                <div className="empty-title">No Stores Added</div>
                <div className="empty-sub">Add a new store using the form on the left to get started.</div>
              </div>
            ) : (
              <>
                <div className="dash-header">
                  <div className="dash-title">
                    Store : {activeStore.storeLocation} (ID : {activeStore.storeCode})
                  </div>

                  <div className="dash-controls">
                    <span className="dash-rack-view-label">RACK</span>
                    <div className="dash-rack-view-select">
                      <Select
                        classNamePrefix="react-select"
                        placeholder="Rack"
                        options={rackOptions}
                        value={rackOptions.find((x) => x.value === selectedRackKey) || null}
                        onChange={(selected) => setSelectedRackKey(selected?.value ?? null)}
                      />
                    </div>

                    <div className="dash-zoom">
                      <button onClick={() => setZoom((z) => Math.max(50, z - 10))}><FaMinus size={10} /></button>
                      <span>{zoom}%</span>
                      <button onClick={() => setZoom((z) => Math.min(150, z + 10))}><FaPlus size={10} /></button>
                      <button onClick={() => setZoom(100)}><FaSyncAlt size={11} /></button>
                    </div>
                  </div>
                </div>

                {!isPreviewSelected && !selectedSavedRack ? (
                  <div className="empty-state">
                    <div className="empty-icon"><FaWarehouse size={34} /></div>
                    <div className="empty-title">No Racks Added</div>
                    <div className="empty-sub">Use "+ Add Rack" on the left to build out this store.</div>
                  </div>
                ) : (
                  <div className="dash-scroll">
                    <div className="rack-preview-outer" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
                      <div className="rack-preview-badge">
                        {isPreviewSelected ? `${rackFormNo.trim().toUpperCase()} (preview)` : selectedSavedRack.rackNo}
                      </div>

                      {(isPreviewSelected ? draftColumns : selectedSavedRack.columns).map((col) => (
                        <div key={col.columnNo} className="rack-preview-column">
                          <div className="rack-preview-column-title">{col.columnNo}</div>

                          {[...col.rows].reverse().map((row) => {
                            const enabled = viewSide === 'front' ? row.hasFront : row.hasRear
                            const slotNumbers = viewSide === 'front' ? buildFrontSlots(row.fixture) : buildRearSlots(row.fixture)

                            return (
                              <div key={row.rowNo} className="rack-preview-row">
                                <div className="rack-preview-row-label">{row.rowNo}</div>
                                <div className="rack-preview-row-slots">
                                  {!enabled ? (
                                    <span className="rack-slot-box disabled">— side not configured —</span>
                                  ) : (
                                    slotNumbers.map((slotNumber) => {
                                      if (isPreviewSelected) {
                                        // Draft rows have no `id`, so they're not clickable/occupiable yet.
                                        return (
                                          <span key={slotNumber} className={`rack-slot-box ${viewSide === 'front' ? 'occupied-front' : 'occupied-rear'}`}>
                                            {buildSlotCode(col.columnNo, row.rowNo, slotNumber, viewSide)}
                                          </span>
                                        )
                                      }

                                      const key = `${row.id}-${slotNumber}-${viewSide === 'front' ? 'Front' : 'Rear'}`
                                      const occ = occupancyMap.get(key)
                                      const cls = occ ? (viewSide === 'front' ? 'occupied-front' : 'occupied-rear') : 'available'

                                      return (
                                        <span
                                          key={slotNumber}
                                          className={`rack-slot-box clickable ${cls}`}
                                          title={occ ? `Qty: ${occ.quantity} — click to vacate` : 'Click to occupy'}
                                          onClick={() => handleSlotClick(row, slotNumber, viewSide)}
                                        >
                                          {buildSlotCode(col.columnNo, row.rowNo, slotNumber, viewSide)}
                                        </span>
                                      )
                                    })
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="dash-footer">
                  <div className="dash-side-toggle">
                    <button className={viewSide === 'front' ? 'active' : ''} onClick={() => setViewSide('front')}>Front</button>
                    <button className={viewSide === 'rear' ? 'active' : ''} onClick={() => setViewSide('rear')}>Rear</button>
                  </div>

                  <div className="dash-legend">
                    <span><i className="legend-swatch occupied-front" /> Occupied (Front)</span>
                    <span><i className="legend-swatch occupied-rear" /> Occupied (Rear)</span>
                    <span><i className="legend-swatch available" /> Available</span>
                  </div>
                </div>

                {racks.length > 0 && (
                  <div className="rack-manage-list">
                    {racks.map((r) => (
                      <div key={r.id} className="rack-list-item">
                        <span>Rack {r.rackNo}</span>
                        <span className="rack-actions">
                          <FaEdit className="icon-edit" onClick={() => handleEditRack(r)} title="Edit" />
                          <FaTrash className="icon-delete" onClick={() => handleDeleteRack(r.id, r.rackNo)} title="Delete" />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CCardBody>
        </CCard>
      </div>

      {confirmDelete && (
        <div className="loc-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="loc-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="loc-confirm-header">
              <span className="loc-confirm-warning">⚠</span>
              <span className="loc-confirm-title">Confirm Delete</span>
              <button className="loc-confirm-close" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>

            <div className="loc-confirm-body">
              <p>
                Are you sure you want to delete this {confirmDelete.type === 'store' ? 'Store' : 'Rack'}?
                {confirmDelete.type === 'store' && ' This removes all its racks too.'}
                {confirmDelete.type === 'rack' && ' This removes all its locations and cannot be undone.'}
              </p>

              <div className="loc-confirm-id-box">
                <strong>{confirmDelete.type === 'store' ? 'Store' : 'Rack'} :</strong>{' '}
                <span className="loc-confirm-id-value">
                  {confirmDelete.label}
                  {confirmDelete.extra ? ` (${confirmDelete.extra})` : ''}
                </span>
              </div>
            </div>

            <div className="loc-confirm-footer">
              <CButton color="secondary" onClick={() => setConfirmDelete(null)}>Cancel</CButton>
              <CButton color="danger" onClick={executeConfirmedDelete}>Delete</CButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LocationMaster
