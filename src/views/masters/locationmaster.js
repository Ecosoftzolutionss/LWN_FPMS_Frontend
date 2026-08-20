import React, { useEffect, useMemo, useState } from 'react'
import {
  CButton, CFormInput, CCard, CCardBody,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormSelect, CFormLabel, CFormCheck, CTable, CTableHead, CTableRow,
  CTableHeaderCell, CTableBody, CTableDataCell, CBadge, CSpinner,
} from '@coreui/react'
import { FaEdit, FaTrash, FaWarehouse, FaSyncAlt, FaMinus, FaPlus } from 'react-icons/fa'
import { toast } from 'react-toastify'
import Select from 'react-select'
import API from '../../api.js'
import '../../assets/CSS/locationMaster.css'
import usePrivilege from '../hooks/usePrivilege.js'

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

// ─────────────────────────────────────────────────────────────────────
// Builds the grid from Rack No / Rows / Columns, but MERGES in any
// Front/Rear/Fixture edits already made on the previous grid, keyed by
// POSITION (column index, row index) rather than by label. This is what
// makes "change rows/cols after Generate" actually work — the grid
// updates immediately and never silently discards your edits.
// ─────────────────────────────────────────────────────────────────────
const buildGridFromInputs = (rackNo, rows, cols, prevGrid = []) => {
  const prevByPos = new Map(prevGrid.map((r) => [`${r._c}-${r._r}`, r]))
  const grid = []
  for (let c = 1; c <= cols; c++) {
    for (let r = 1; r <= rows; r++) {
      const prev = prevByPos.get(`${c}-${r}`)
      grid.push({
        columnNo: `${rackNo}${c}`,
        rowNo: `R${r}`,
        hasFront: prev ? prev.hasFront : true,
        hasRear: prev ? prev.hasRear : true,
        fixture: prev ? prev.fixture : 1, // ★ default fixture count changed from 6 -> 1
        _c: c,
        _r: r,
      })
    }
  }
  return grid
}

// Attach the hidden _c/_r position markers to a grid loaded from a saved
// rack (API), so it can be merged correctly if the user regenerates it.
const attachPositions = (columns) => {
  const grid = []
  columns.forEach((col, cIdx) => {
    col.rows.forEach((row, rIdx) => {
      grid.push({
        columnNo: col.columnNo,
        rowNo: row.rowNo,
        hasFront: row.hasFront,
        hasRear: row.hasRear,
        fixture: row.fixture,
        _c: cIdx + 1,
        _r: rIdx + 1,
      })
    })
  })
  return grid
}

// Strip the internal _c/_r markers before sending to the API.
const stripPositions = (grid) => grid.map(({ _c, _r, ...rest }) => rest)

// <select> option values are ALWAYS strings, but rack.id coming back
// from the API can be a number. Comparing with strict === silently
// fails, so every rack-id comparison goes through these helpers.
const findRackById = (racks, id) => racks.find((r) => String(r.id) === String(id))
const sameId = (a, b) => String(a) === String(b)

const LocationMaster = () => {
  // ---- Store (Add Location) state — Store Name is linked to Store Master ----
  const [stores, setStores] = useState([])
  const [storeMasters, setStoreMasters] = useState([])
  const [form, setForm] = useState({ storeMasterId: '' })
  const [errors, setErrors] = useState({ storeMasterId: '' })
  const [editId, setEditId] = useState(null)
  const [activeStore, setActiveStore] = useState(null)

  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'store'|'rack', label, id, extra, source }

  // ---- Racks (saved) ----
  const [racks, setRacks] = useState([]) // [{ id, rackNo, columns:[{ id, columnNo, rows:[...] }] }]
  const [occupancy, setOccupancy] = useState([])

  // ---- Add Rack panel (inline, left card) ----
  const [showRackPanel, setShowRackPanel] = useState(false)
  const [rackFormNo, setRackFormNo] = useState('')
  const [rackFormRows, setRackFormRows] = useState(5)
  const [rackFormCols, setRackFormCols] = useState(1)
  const [draftGrid, setDraftGrid] = useState([]) // [{ columnNo, rowNo, hasFront, hasRear, fixture, _c, _r }]
  const [editingRackNo, setEditingRackNo] = useState('') // set when bulk-editing an existing rack
  const [rackFormTouched, setRackFormTouched] = useState(false) // becomes true once user has generated at least once

  // ---- "Manage Racks" modal (opened from the pencil/edit icon) ----
  const [showManageModal, setShowManageModal] = useState(false)
  const [modalSelectedRackId, setModalSelectedRackId] = useState('') // '' = "— New Rack —"
  const [modalEditingRackNo, setModalEditingRackNo] = useState('')
  const [modalRackNo, setModalRackNo] = useState('')
  const [modalRows, setModalRows] = useState(5)
  const [modalCols, setModalCols] = useState(1)
  const [modalGrid, setModalGrid] = useState([])
  const [modalTouched, setModalTouched] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)

  // ---- Right panel preview ----
  const [selectedRackKey, setSelectedRackKey] = useState(null) // rack.id, or '__PREVIEW__'
  const [viewSide, setViewSide] = useState('front')
  const [zoom, setZoom] = useState(100)
  const { privileges: userPrivileges = [] } = usePrivilege()
  const uPrivilege = userPrivileges.find((p) => p.menuName === 'Location Master') || {}

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
    partNumber: s.partNumberCode || '',
  }))

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
      return res.data || []
    } catch {
      toast.error('Failed to load racks')
      return []
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
    setRackFormTouched(false)
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

  const handleDeleteStore = () => {
    if (!activeStore) return
    setConfirmDelete({
      type: 'store',
      id: activeStore.id,
      label: activeStore.storeLocation,
      extra: activeStore.storeCode,
    })
  }

  // ─────────────────────────────────────────────────────────────────
  // ---------- Add Rack (inline panel) ----------
  // The grid auto-syncs live from Rack No / Rows / Columns any time
  // they change, instead of only updating once when "+ Generate" is
  // clicked. Per-row edits are preserved by position.
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showRackPanel) return
    const rackNo = rackFormNo.trim().toUpperCase()
    const rows = Number(rackFormRows)
    const cols = Number(rackFormCols)
    if (!rackNo || !rows || rows < 1 || !cols || cols < 1) return

    setDraftGrid((prev) => buildGridFromInputs(rackNo, rows, cols, prev))
    setSelectedRackKey('__PREVIEW__')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rackFormNo, rackFormRows, rackFormCols, showRackPanel])

  const handleOpenAddRack = () => {
    setShowRackPanel(true)
    setEditingRackNo('')
    setRackFormNo('')
    setRackFormRows(5)
    setRackFormCols(1)
    setDraftGrid([])
    setRackFormTouched(false)
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

    setDraftGrid((prev) => buildGridFromInputs(rackNo, rows, cols, prev))
    setSelectedRackKey('__PREVIEW__')
    setRackFormTouched(true)
    toast.success('Grid generated — you can still change Rows/Columns any time')
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
    setRackFormTouched(false)
    setSelectedRackKey(racks[0]?.id ?? null)
  }

  const handleSaveRack = async () => {
    const rackNo = rackFormNo.trim().toUpperCase()

    if (!rackNo) {
      toast.error('Enter Rack No')
      return
    }
    if (draftGrid.length === 0) {
      toast.error('Enter Rows and Columns to build the grid first')
      return
    }

    try {
      await API.post(`/LocationRack/store/${activeStore.id}/save-grid`, {
        rackNo,
        rows: stripPositions(draftGrid),
      })

      toast.success(editingRackNo ? `Rack "${rackNo}" updated` : `Rack "${rackNo}" saved`)

      setRackFormNo('')
      setRackFormRows(5)
      setRackFormCols(1)
      setDraftGrid([])
      setEditingRackNo('')
      setRackFormTouched(false)

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
    setDraftGrid(attachPositions(rack.columns))
    setRackFormTouched(true)
    setSelectedRackKey('__PREVIEW__')
    toast.info(`Editing Rack ${rack.rackNo} — modify and click Save`)
  }

  const handleDeleteRack = (rackId, rackNo) => {
    setConfirmDelete({ type: 'rack', id: rackId, label: `Rack ${rackNo}`, source: 'list' })
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
        setShowManageModal(false)
        await loadStores()
      } else {
        await API.delete(`/LocationRack/${confirmDelete.id}`)
        toast.success(`${confirmDelete.label} deleted`)

        if (sameId(selectedRackKey, confirmDelete.id)) setSelectedRackKey(null)

        await loadRacks(activeStore.id)

        // If the delete was triggered from inside the Manage Racks modal,
        // reset the modal back to "New Rack" state.
        if (confirmDelete.source === 'modal') {
          setModalSelectedRackId('')
          resetModalRackForm()
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      // Only close the delete-confirm modal here — never touch
      // showManageModal, so the two modals never fight each other.
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
    ...(draftGrid.length > 0
      ? [{ value: '__PREVIEW__', label: `Rack ${rackFormNo.trim().toUpperCase() || '?'} (preview)` }]
      : []),
  ]

  const draftColumns = useMemo(() => {
    const map = new Map()
    draftGrid.forEach((r) => {
      if (!map.has(r.columnNo)) map.set(r.columnNo, [])
      map.get(r.columnNo).push(r)
    })
    return Array.from(map.entries()).map(([columnNo, rows]) => ({ columnNo, rows }))
  }, [draftGrid])

  const isPreviewSelected = selectedRackKey === '__PREVIEW__' && draftGrid.length > 0
  const selectedSavedRack = racks.find((r) => sameId(r.id, selectedRackKey))

  // =====================================================================
  // ---------- "Manage Racks" MODAL (CoreUI CModal) -----------------------
  // =====================================================================

  const resetModalRackForm = () => {
    setModalEditingRackNo('')
    setModalRackNo('')
    setModalRows(5)
    setModalCols(1)
    setModalGrid([])
    setModalTouched(false)
  }

  const handleOpenManageModal = () => {
    if (!activeStore) return
    setModalSelectedRackId('')
    resetModalRackForm()
    setShowManageModal(true)
  }

  const closeManageModal = () => setShowManageModal(false)

  // Same live auto-sync for the modal grid.
  useEffect(() => {
    if (!showManageModal) return
    const rackNo = modalRackNo.trim().toUpperCase()
    const rows = Number(modalRows)
    const cols = Number(modalCols)
    if (!rackNo || !rows || rows < 1 || !cols || cols < 1) return

    setModalGrid((prev) => buildGridFromInputs(rackNo, rows, cols, prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalRackNo, modalRows, modalCols, showManageModal])

  const handleModalRackSelectChange = (rackIdRaw) => {
    setModalSelectedRackId(rackIdRaw)

    if (!rackIdRaw) {
      // "— New Rack —"
      resetModalRackForm()
      return
    }

    // <select> always returns a string value. Compare against rack.id
    // (which may be numeric) using String() on both sides.
    const rack = findRackById(racks, rackIdRaw)
    if (!rack) {
      toast.error('Rack data not loaded')
      return
    }

    setModalEditingRackNo(rack.rackNo)
    setModalRackNo(rack.rackNo)
    setModalRows(rack.columns[0]?.rows.length || 1)
    setModalCols(rack.columns.length || 1)
    setModalGrid(attachPositions(rack.columns))
    setModalTouched(true)
    toast.info(`Editing Rack ${rack.rackNo} — modify and click Update`)
  }

  const handleModalGenerateGrid = () => {
    const rackNo = modalRackNo.trim().toUpperCase()
    const rows = Number(modalRows)
    const cols = Number(modalCols)

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

    setModalGrid((prev) => buildGridFromInputs(rackNo, rows, cols, prev))
    setModalTouched(true)
  }

  const updateModalRow = (index, field, value) => {
    setModalGrid((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const toggleModalAllView = (checked) => {
    setModalGrid((prev) => prev.map((r) => ({ ...r, hasFront: checked, hasRear: checked })))
  }

  const handleModalSaveRack = async () => {
    const rackNo = modalRackNo.trim().toUpperCase()

    if (!rackNo) {
      toast.error('Enter Rack No')
      return
    }
    if (!/^[A-Z]{1,5}$/.test(rackNo)) {
      toast.error('Rack No must be letters only (A-Z)')
      return
    }
    if (modalGrid.length === 0) {
      toast.error('Enter Rows and Columns to build the grid first')
      return
    }

    const isEdit = !!modalEditingRackNo
    setModalSaving(true)
    try {
      await API.post(`/LocationRack/store/${activeStore.id}/save-grid`, {
        rackNo,
        rows: stripPositions(modalGrid),
      })

      toast.success(isEdit ? `Rack "${rackNo}" updated` : `Rack "${rackNo}" added`)

      const freshRacks = await loadRacks(activeStore.id)
      await loadOccupancy(activeStore.id)

      const savedRack = freshRacks.find((r) => r.rackNo === rackNo)
      if (savedRack) setSelectedRackKey(savedRack.id)
      resetModalRackForm()
      setModalSelectedRackId('')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    } finally {
      setModalSaving(false)
    }
  }

  const handleModalDeleteRack = () => {
    if (!modalSelectedRackId) {
      toast.error('Select a rack to delete')
      return
    }
    const rack = findRackById(racks, modalSelectedRackId)
    setConfirmDelete({
      type: 'rack',
      id: modalSelectedRackId,
      label: `Rack ${rack?.rackNo ?? ''}`,
      source: 'modal',
    })
  }

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
              <label className="custom-label">
                <strong>Pallet Number</strong>
              </label>

              <CFormInput
                value={selectedStoreMaster?.palletNumber || ''}
                placeholder="Auto-filled from Store Master"
                disabled
              />
            </div>

            <div className="loc-field">
              <label className="custom-label">
                <strong>Part Number</strong>
              </label>

              <CFormInput
                value={selectedStoreMaster?.partNumber || ''}
                placeholder="Auto-filled from Store Master"
                disabled
              />
            </div>

            <div className="loc-field">
              <label className="custom-label">
                <strong>Colour Picker</strong>
              </label>

              <div className="colour-picker-wrap colour-readonly loc-colour-with-add">
                <span
                  className="colour-swatch"
                  style={{
                    background: selectedStoreMaster?.colourCode || '#e2e8f0',
                  }}
                />

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
                      {uPrivilege.canEdit && (
                        <FaEdit className="icon-edit" onClick={handleOpenManageModal} title="Manage Racks" />
                      )}
                      {uPrivilege.canDelete && (
                        <FaTrash className="icon-delete" onClick={handleDeleteStore} title="Delete Store" />
                      )}
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
                        <span className="rack-input-help">Change any time — grid updates live</span>
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
                        <span className="rack-input-help">Change any time — grid updates live</span>
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
                    <FaPlus size={12} /> {rackFormTouched ? 'Regenerate Grid' : 'Generate Grid'}
                  </button>

                  {draftGrid.length > 0 && (
                    <>
                      <small style={{ display: 'block', margin: '6px 0', color: '#4e73df', fontWeight: 600, fontSize: 10.5 }}>
                        {draftGrid.length} slot row(s) — edit Front/Rear/Fixture below, or change Rows/Columns above any time.
                      </small>
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
                            <tr key={`${row._c}-${row._r}`}>
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
                    </>
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

              
              </>
            )}
          </CCardBody>
        </CCard>
      </div>

      {/* ═══════════ MANAGE RACKS — CoreUI CModal (clean header/footer) ═══════════ */}
      <CModal
        visible={showManageModal}
        onClose={closeManageModal}
        size="lg"
        alignment="center"
        backdrop="static"
      >
        <CModalHeader className="border-0">
          <CModalTitle className="w-100 text-center fw-bold" style={{ color: '#1d5cff' }}>
            <FaWarehouse style={{ marginRight: 8 }} />
            Manage Racks{activeStore ? ` — ${activeStore.storeLocation} (${activeStore.storeCode})` : ''}
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {racks.length > 0 && (
            <div className="mb-3">
              <CFormLabel className="fw-bold small">Select Rack</CFormLabel>
              <div className="d-flex gap-2">
                <CFormSelect
                  value={modalSelectedRackId}
                  onChange={(e) => handleModalRackSelectChange(e.target.value)}
                >
                  <option value="">— New Rack —</option>
                  {racks.map((r) => (
                    <option key={r.id} value={r.id}>Rack {r.rackNo}</option>
                  ))}
                </CFormSelect>
                <CButton
                  color="danger"
                  variant="outline"
                  disabled={!modalSelectedRackId}
                  onClick={handleModalDeleteRack}
                  className="text-nowrap"
                >
                  <FaTrash className="me-1" /> Delete
                </CButton>
              </div>
            </div>
          )}

          {modalEditingRackNo && (
            <div className="mb-3">
              <CBadge color="warning" shape="rounded-pill" className="px-3 py-2">
                ✏️ Editing Rack: {modalEditingRackNo}
              </CBadge>
            </div>
          )}

          <div className="fw-bold small mb-1">
            {modalEditingRackNo ? `Edit Rack ${modalEditingRackNo}` : 'Add New Rack'}
          </div>
          <div className="text-muted mb-2" style={{ fontSize: 11 }}>
            Rack No: letters only (A, B, AB…). Rows/Columns update the grid live — change them any time.
          </div>

          <div className="row g-2 align-items-end mb-3">
            <div className="col-4">
              <CFormLabel className="small mb-1">Rack No</CFormLabel>
              <CFormInput
                placeholder="A"
                value={modalRackNo}
                disabled={!!modalEditingRackNo}
                onChange={(e) => setModalRackNo(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
              />
            </div>
            <div className="col-3">
              <CFormLabel className="small mb-1">Rows</CFormLabel>
              <CFormInput
                type="number"
                min={1}
                value={modalRows}
                onChange={(e) => setModalRows(e.target.value)}
              />
            </div>
            <div className="col-3">
              <CFormLabel className="small mb-1">Columns</CFormLabel>
              <CFormInput
                type="number"
                min={1}
                value={modalCols}
                onChange={(e) => setModalCols(e.target.value)}
              />
            </div>
            <div className="col-2">
              <CButton color="primary" className="w-100" onClick={handleModalGenerateGrid}>
                <FaPlus size={12} /> {modalTouched ? 'Redo' : 'Go'}
              </CButton>
            </div>
          </div>

          {modalGrid.length > 0 && (
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e0e8f8', borderRadius: 6 }}>
              <CTable small bordered className="mb-0">
                <CTableHead style={{ position: 'sticky', top: 0, background: '#d4e4f5', zIndex: 1 }}>
                  <CTableRow>
                    <CTableHeaderCell>Column</CTableHeaderCell>
                    <CTableHeaderCell>Row</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">
                      <CFormCheck
                        label="View"
                        checked={modalGrid.every((r) => r.hasFront && r.hasRear)}
                        onChange={(e) => toggleModalAllView(e.target.checked)}
                      />
                    </CTableHeaderCell>
                    <CTableHeaderCell>Fixture</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {modalGrid.map((row, index) => (
                    <CTableRow key={`${row._c}-${row._r}`}>
                      <CTableDataCell className="fw-bold text-primary">{row.columnNo}</CTableDataCell>
                      <CTableDataCell>{row.rowNo}</CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex gap-2 justify-content-center">
                          <CFormCheck
                            label="Front"
                            checked={row.hasFront}
                            onChange={(e) => updateModalRow(index, 'hasFront', e.target.checked)}
                          />
                          <CFormCheck
                            label="Rear"
                            checked={row.hasRear}
                            onChange={(e) => updateModalRow(index, 'hasRear', e.target.checked)}
                          />
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          type="number"
                          min={1}
                          size="sm"
                          style={{ width: 60 }}
                          value={row.fixture}
                          onChange={(e) => updateModalRow(index, 'fixture', Number(e.target.value) || 1)}
                        />
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>
          )}
        </CModalBody>

        <CModalFooter className="border-0 d-flex justify-content-center">
          <CButton color="secondary" variant="outline" onClick={resetModalRackForm}>
            Clear
          </CButton>
          <CButton color="primary" onClick={handleModalSaveRack} disabled={modalSaving}>
            {modalSaving && <CSpinner size="sm" className="me-2" />}
            {modalEditingRackNo ? 'Update' : 'Save'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ═══════════ CONFIRM DELETE — matches ItemGroupMaster style ═══════════ */}
      <CModal
        visible={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        alignment="center"
        backdrop="static"
        keyboard={false}
        portal
      >
        <CModalHeader className="border-0">
          <CModalTitle className="w-100 text-center text-danger fw-bold">
            ⚠ Confirm Delete
          </CModalTitle>
        </CModalHeader>

        <CModalBody className="text-center">
          <p>
            Are you sure you want to delete this {confirmDelete?.type === 'store' ? 'Store' : 'Rack'}?
            {confirmDelete?.type === 'store' && ' This removes all its racks too.'}
            {confirmDelete?.type === 'rack' && ' This removes all its locations and cannot be undone.'}
          </p>

          <div
            style={{
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '10px',
            }}
          >
            <div>
              <strong>{confirmDelete?.type === 'store' ? 'Store Name' : 'Rack'} :</strong>{' '}
              <span>
                {confirmDelete?.label}{confirmDelete?.extra ? ` (${confirmDelete.extra})` : ''}
              </span>
            </div>
          </div>
        </CModalBody>

        <CModalFooter className="border-0 d-flex justify-content-center">
          <CButton color="secondary" onClick={() => setConfirmDelete(null)}>
            Cancel
          </CButton>

          <CButton color="danger" onClick={executeConfirmedDelete}>
            Delete
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default LocationMaster