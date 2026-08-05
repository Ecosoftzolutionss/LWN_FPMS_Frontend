import React, { useEffect, useMemo, useState } from 'react'
import { CButton, CFormInput, CCard, CCardBody } from '@coreui/react'
import { FaEdit, FaTrash, FaPlus, FaWarehouse, FaSyncAlt, FaMinus } from 'react-icons/fa'
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

// e.g. Column "A1", Row "R4", slot 1, side Front -> "A1-R4-1F"
const buildSlotCode = (columnNo, rowNo, slotNumber, side) =>
  `${columnNo}-${rowNo}-${slotNumber}${side === 'front' ? 'F' : 'R'}`

const LocationMaster = () => {
  const [stores, setStores] = useState([])
  const [storeMasters, setStoreMasters] = useState([])
  const [form, setForm] = useState({ storeMasterId: '' })
  const [errors, setErrors] = useState({ storeMasterId: '' })
  const [editId, setEditId] = useState(null)

  const [activeStore, setActiveStore] = useState(null)
  const [racks, setRacks] = useState([]) // full tree: [{ id, rackNo, columns:[{ id, columnNo, rows:[...] }] }]
  const [activeTab, setActiveTab] = useState('rack') // 'rack' | 'location'

  const [batchForm, setBatchForm] = useState({ rackNo: '', rowCount: 4, fixture: 1 })
  const [batchError, setBatchError] = useState('')

  // ---- Preview (right panel) state ----
  const [selectedRackId, setSelectedRackId] = useState(null)
  const [viewSide, setViewSide] = useState('front')
  const [zoom, setZoom] = useState(100)

  const storeMasterOptions = storeMasters.map((s) => ({
    value: s.id,
    label: s.storeLocation,
    colourCode: s.colourCode,
    palletNumber: s.palletNumber,
  }))

  const selectedStoreMaster = storeMasterOptions.find(
    (x) => String(x.value) === String(form.storeMasterId),
  )

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
      if (res.data?.length && !res.data.some((r) => r.id === selectedRackId)) {
        setSelectedRackId(res.data[0].id)
      }
    } catch {
      toast.error('Failed to load racks')
    }
  }

  const refreshEverything = async (storeId) => {
    await loadStores()
    if (storeId) await loadRacks(storeId)
  }

  const clearError = (name) => setErrors((prev) => ({ ...prev, [name]: '' }))

  const validate = () => {
    const temp = { storeMasterId: '' }
    if (!form.storeMasterId) temp.storeMasterId = 'Store Name is required'
    setErrors(temp)
    return !Object.values(temp).some((x) => x)
  }

  const handleSubmit = async () => {
    if (!validate()) return

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

      setActiveStore(res.data)
      await refreshEverything(res.data.id)
      resetForm()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const handleEdit = (store) => {
    setEditId(store.id)
    setForm({ storeMasterId: store.storeMasterId })
    setErrors({ storeMasterId: '' })
    setActiveStore(store)
    loadRacks(store.id)
  }

  const handleSelectStore = (store) => {
    setActiveStore(store)
    loadRacks(store.id)
  }

  const resetForm = () => {
    setForm({ storeMasterId: '' })
    setErrors({ storeMasterId: '' })
    setEditId(null)
  }

  const handleDeleteStore = async (id) => {
    try {
      await API.delete(`/LocationMaster/${id}`)
      toast.success('Deleted Successfully')
      if (activeStore?.id === id) {
        setActiveStore(null)
        setRacks([])
      }
      await refreshEverything()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    }
  }

  // ---------- Rack batch add ----------

  const handleAddBatch = async () => {
    if (!activeStore) return

    if (!batchForm.rackNo.trim()) {
      setBatchError('Rack No is required (letters only, e.g. A, B)')
      return
    }
    if (Number(batchForm.rowCount) <= 0) {
      setBatchError('Row count must be greater than 0')
      return
    }
    if (Number(batchForm.fixture) <= 0) {
      setBatchError('Fixture must be greater than 0')
      return
    }

    try {
      await API.post(`/LocationRack/store/${activeStore.id}/batch`, {
        rackNo: batchForm.rackNo.trim().toUpperCase(),
        rowCount: Number(batchForm.rowCount),
        fixture: Number(batchForm.fixture),
      })

      toast.success('Rack Rows Added Successfully')
      setBatchError('')
      await loadRacks(activeStore.id)
    } catch (err) {
      setBatchError(getErrorMessage(err, 'Failed to add rack rows'))
    }
  }

  const handleToggleRowField = async (row, field) => {
    const updated = { ...row, [field]: !row[field] }

    if (!updated.hasFront && !updated.hasRear) {
      toast.error('A row needs at least Front or Rear')
      return
    }

    try {
      await API.put(`/LocationRack/rows/${row.id}`, updated)
      await loadRacks(activeStore.id)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update Failed'))
    }
  }

  const handleFixtureChange = async (row, value) => {
    const fixture = Number(value) || 1
    try {
      await API.put(`/LocationRack/rows/${row.id}`, { ...row, fixture })
      await loadRacks(activeStore.id)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update Failed'))
    }
  }

  const handleDeleteRow = async (rowId) => {
    try {
      await API.delete(`/LocationRack/rows/${rowId}`)
      toast.success('Row Deleted')
      await loadRacks(activeStore.id)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    }
  }

  const handleDeleteRack = async (rackId) => {
    try {
      await API.delete(`/LocationRack/${rackId}`)
      toast.success('Rack Deleted')
      if (selectedRackId === rackId) setSelectedRackId(null)
      await loadRacks(activeStore.id)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    }
  }

  // ---------- Derived: flattened row table + rack dropdown + preview ----------

  const flatRows = useMemo(() => {
    const out = []
    racks.forEach((rack) => {
      rack.columns.forEach((col) => {
        col.rows.forEach((row) => {
          out.push({ ...row, columnNo: col.columnNo, rackNo: rack.rackNo })
        })
      })
    })
    return out
  }, [racks])

  const rackOptions = racks.map((r) => ({ value: r.id, label: `Rack ${r.rackNo} (Preview)` }))
  const selectedRack = racks.find((r) => r.id === selectedRackId)

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
              <div className="colour-picker-wrap colour-readonly">
                <span className="colour-swatch" style={{ background: selectedStoreMaster?.colourCode || '#e2e8f0' }} />
                <input
                  type="text"
                  className="colour-hex-input"
                  value={selectedStoreMaster?.colourCode || ''}
                  placeholder="Auto-filled from Store Master"
                  disabled
                />
              </div>
            </div>

            {activeStore && (
              <div className="loc-summary">
                <div><span>Store Name</span> : <strong>{activeStore.storeLocation}</strong></div>
                <div><span>Store ID</span> : <strong>{activeStore.storeCode}</strong></div>
              </div>
            )}

            <div className="loc-btn-area">
              <CButton className="save-btn" onClick={handleSubmit}>
                {editId ? 'Update' : 'Save'}
              </CButton>
              <CButton className="clear-btn" onClick={resetForm}>
                Clear
              </CButton>
            </div>

            {stores.length > 0 && (
              <div className="store-list-mini">
                <div className="custom-label" style={{ marginTop: 14 }}><strong>Stores</strong></div>
                {stores.map((s) => (
                  <div
                    key={s.id}
                    className={`store-mini-row ${activeStore?.id === s.id ? 'active' : ''}`}
                    onClick={() => handleSelectStore(s)}
                  >
                    <span className="store-mini-swatch" style={{ background: s.colourCode }} />
                    <span className="store-mini-label">
                      {s.storeCode} — {s.storeLocation} ({s.palletNumber})
                    </span>
                    <span className="store-mini-actions">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(s) }}><FaEdit size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteStore(s.id) }}><FaTrash size={11} /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeStore && (
              <>
                <div className="loc-tabs">
                  <button className={activeTab === 'rack' ? 'active' : ''} onClick={() => setActiveTab('rack')}>
                    Add Rack
                  </button>
                  {/* <button className={activeTab === 'location' ? 'active' : ''} onClick={() => setActiveTab('location')}>
                    Add Location
                  </button> */}
                </div>

                {activeTab === 'rack' && (
                  <div className="rack-tab-panel">
                    <div className="add-rack-box-title">Add Rack For Store {activeStore.storeCode}</div>
                    <div className="add-rack-box-hint">Rack No: Letters only (A, B, AB, ...)</div>

                    <div className="add-rack-row">
                      <input
                        className="rack-mini-input"
                        placeholder="A"
                        value={batchForm.rackNo}
                        onChange={(e) => setBatchForm({ ...batchForm, rackNo: e.target.value.toUpperCase() })}
                      />
                      <input
                        className="rack-mini-input rack-slots-input"
                        type="number"
                        min={1}
                        title="Row count"
                        value={batchForm.rowCount}
                        onChange={(e) => setBatchForm({ ...batchForm, rowCount: e.target.value })}
                      />
                      <input
                        className="rack-mini-input rack-slots-input"
                        type="number"
                        min={1}
                        title="Fixture"
                        value={batchForm.fixture}
                        onChange={(e) => setBatchForm({ ...batchForm, fixture: e.target.value })}
                      />
                      <button type="button" className="rack-add-confirm-btn" onClick={handleAddBatch}>
                        <FaPlus size={12} />
                      </button>
                    </div>

                    {batchError && <small className="text-danger">{batchError}</small>}

                    {flatRows.length > 0 && (
                      <table className="rack-table">
                        <thead>
                          <tr>
                            <th>Column</th>
                            <th>Row</th>
                            <th>View</th>
                            <th>Fixture</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {flatRows.map((r) => (
                            <tr key={r.id}>
                              <td>{r.columnNo}</td>
                              <td>{r.rowNo}</td>
                              <td>
                                <label className="mini-check">
                                  <input
                                    type="checkbox"
                                    checked={r.hasFront}
                                    onChange={() => handleToggleRowField(r, 'hasFront')}
                                  />
                                  Front
                                </label>
                                <label className="mini-check">
                                  <input
                                    type="checkbox"
                                    checked={r.hasRear}
                                    onChange={() => handleToggleRowField(r, 'hasRear')}
                                  />
                                  Rear
                                </label>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min={1}
                                  className="fixture-mini-input"
                                  value={r.fixture}
                                  onChange={(e) => handleFixtureChange(r, e.target.value)}
                                />
                              </td>
                              <td>
                                <button className="rack-delete-btn" onClick={() => handleDeleteRow(r.id)}>
                                  <FaTrash size={11} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {racks.length > 0 && (
                      <div className="rack-list-mini">
                        {racks.map((r) => (
                          <div key={r.id} className="rack-mini-chip">
                            Rack {r.rackNo}
                            <button onClick={() => handleDeleteRack(r.id)}><FaTrash size={10} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'location' && (
                  <div className="rack-tab-panel">
                    <small className="text-muted">
                      Location assignment (linking a specific pallet to a Row/Slot) belongs to a
                      transaction screen, not this master — say the word and I'll scope that out
                      separately.
                    </small>
                  </div>
                )}
              </>
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
                        placeholder="Rack (Preview)"
                        options={rackOptions}
                        value={rackOptions.find((x) => x.value === selectedRackId) || null}
                        onChange={(selected) => setSelectedRackId(selected?.value || null)}
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

                {!selectedRack ? (
                  <div className="empty-state">
                    <div className="empty-icon"><FaWarehouse size={34} /></div>
                    <div className="empty-title">No Racks Added</div>
                    <div className="empty-sub">Use the "Add Rack" form on the left to build out this store.</div>
                  </div>
                ) : (
                  <div className="dash-scroll">
                    <div className="rack-preview-outer" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
                      <div className="rack-preview-badge">{selectedRack.rackNo}</div>

                      {selectedRack.columns.map((col) => (
                        <div key={col.id} className="rack-preview-column">
                          <div className="rack-preview-column-title">{col.columnNo}</div>

                          {[...col.rows].reverse().map((row) => {
                            const active = viewSide === 'front' ? row.hasFront : row.hasRear
                            return (
                              <div key={row.id} className="rack-preview-row">
                                <div className="rack-preview-row-label">{row.rowNo}</div>
                                <div className="rack-preview-row-slots">
                                  {active
                                    ? Array.from({ length: row.fixture }).map((_, i) => (
                                        <span
                                          key={i}
                                          className={`rack-slot-box ${viewSide === 'front' ? 'occupied-front' : 'occupied-rear'}`}
                                        >
                                          {buildSlotCode(col.columnNo, row.rowNo, i * 2 + 1, viewSide)}
                                        </span>
                                      ))
                                    : (
                                        <span className="rack-slot-box available">—</span>
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
                    <button className={viewSide === 'front' ? 'active' : ''} onClick={() => setViewSide('front')}>
                      Front
                    </button>
                    <button className={viewSide === 'rear' ? 'active' : ''} onClick={() => setViewSide('rear')}>
                      Rear
                    </button>
                  </div>

                  <div className="dash-legend">
                    <span><i className="legend-swatch occupied-front" /> Occupied (Front)</span>
                    <span><i className="legend-swatch occupied-rear" /> Occupied (Rear)</span>
                    <span><i className="legend-swatch available" /> Available</span>
                  </div>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </div>
    </div>
  )
}

export default LocationMaster
