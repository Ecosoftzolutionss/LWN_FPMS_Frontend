import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput, CFormCheck, CRow, CCol, CCard, CCardBody } from '@coreui/react'
import { FaPlus, FaTrash, FaEdit } from 'react-icons/fa'
import { toast } from 'react-toastify'
import Select from 'react-select'
import API from '../../api.js'
import '../../assets/CSS/grnEntry.css'
import usePrivilege from '../hooks/usePrivilege.js'

const GRN_TYPE_OPTIONS = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Sample', label: 'Sample' },
]

const EMPTY_HEADER = {
  grnNo: '',
  supplierId: '',
  poNumber: '',
  poDate: '',
  grnType: '',
  supplierInvoiceNumber: '',
  supplierInvoiceDate: '',
}

const EMPTY_LINE = {
  itemId: '',
  palletQuantity: '',
  rate: '',
  quantity: '',
}

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

const GRNEntry = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const editGrnId = location.state?.editGrnId || null
  const isEditMode = !!editGrnId
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])

  const [header, setHeader] = useState(EMPTY_HEADER)
  const [line, setLine] = useState(EMPTY_LINE)
  const [lineItems, setLineItems] = useState([])
  const [editingLineKey, setEditingLineKey] = useState(null)// rows added to the grid, not yet saved
  const [errors, setErrors] = useState({})
  const [grnNoIsManual, setGrnNoIsManual] = useState(true)



  // Lets a user override an auto-generated GRN No mid-sequence. When
  // unchecked (default once auto-generation is active), the GRN No
  // field stays disabled and shows the next auto value. When checked,
  // the field unlocks, the user types a new value, and on Save the
  // backend reseeds the counter from that value so future GRNs continue
  // from there.
  const [editGrnNo, setEditGrnNo] = useState(false)
  const { privileges: userPrivileges = [] } = usePrivilege()
 const grnPrivilege =
  userPrivileges.find((p) => p.menuName === 'GRN Entry') || {}

const canEditGRN = grnPrivilege.canEdit === true

  const getCurrentUsername = () => {
    try {
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      return user?.username || ''
    } catch {
      return ''
    }
  }

  useEffect(() => {
    loadItems()
    loadSuppliers()

    if (editGrnId) {
      loadGrnForEdit(editGrnId)
    } else {
      loadNextGrnNo()
    }
  }, [editGrnId])

  const loadNextGrnNo = async () => {
    try {
      const res = await API.get('/GrnEntry/next-number')
      setGrnNoIsManual(!!res.data?.isManual)
      setHeader((prev) => ({ ...prev, grnNo: res.data?.grnNumber || '' }))
      setEditGrnNo(false)
    } catch {
      // Couldn't reach the preview endpoint — fall back to manual entry
      // so the user can still type a GRN No rather than being locked
      // out with a disabled, blank field.
      setGrnNoIsManual(true)
      setHeader((prev) => ({ ...prev, grnNo: '' }))
      toast.error('Could not check the next GRN No — enter it manually')
    }
  }

  const toInputDate = (value) => {
    if (!value) return ''

    const d = new Date(value)

    if (Number.isNaN(d.getTime())) return ''

    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')

    return `${yyyy}-${mm}-${dd}`
  }

  const loadGrnForEdit = async (id) => {
    try {
      const res = await API.get(`/GrnEntry/${id}`)
      const data = res.data

      if (!data) {
        toast.error('GRN details not found')
        return
      }

      // Header
      setHeader({
        grnNo: data.grnNumber || '',
        supplierId: data.supplierId || '',
        poNumber: data.poNumber || '',
        poDate: toInputDate(data.poDate),
        grnType: data.grnType || '',
        supplierInvoiceNumber: data.supplierInvoiceNumber || '',
        supplierInvoiceDate: toInputDate(data.supplierInvoiceDate),
      })

      // Existing lines
      const existingLines = (data.lines || []).map((l, index) => ({
        key: `existing-${l.id || index}`,
        id: l.id,
        itemId: String(l.itemId),
        partNumber: l.partNumber || '',
        itemName: l.partName || '',
        uom: l.uom || '',
        quantity: Number(l.quantity || 0),
        palletQuantity:
          l.palletQuantity === null || l.palletQuantity === undefined
            ? ''
            : Number(l.palletQuantity),
        rate: Number(l.rate || 0),
        totalValue: Number(l.totalValue || 0),
        isPosted: !!l.isPosted,
      }))

      setLineItems(existingLines)

      // GRN number is fixed during edit
      setGrnNoIsManual(false)
      setEditGrnNo(false)
      setLine(EMPTY_LINE)
      setEditingLineKey(null)
      setErrors({})
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load GRN for editing'))
    }
  }

  const loadSuppliers = async () => {
    try {
      const res = await API.get('/SupplierMaster')
      setSuppliers(res.data || [])
    } catch {
      toast.error('Failed to load suppliers')
    }
  }

  const loadItems = async () => {
    try {
      const res = await API.get('/StoreMaster/configured-parts')
      setItems(res.data || [])
    } catch {
      toast.error('Failed to load part numbers')
    }
  }

  const itemOptions = items.map((i) => ({
    value: i.id,
    label: i.itemNumber,
    itemName: i.itemName,
    uom: i.uom,
  }))

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.supplierName }))

  const selectedItem = itemOptions.find((x) => String(x.value) === String(line.itemId))

  const clearError = (name) => setErrors((prev) => ({ ...prev, [name]: '' }))

  const handleHeaderChange = (e) => {
    const { name, value } = e.target
    setHeader({ ...header, [name]: value })
    clearError(name)
  }

  // Native <input type="date"> only opens its picker when the small
  // calendar icon is clicked, not the rest of the field. This makes a
  // click anywhere in the field open it too (showPicker is supported in
  // Chrome/Edge; other browsers just no-op and keep default behavior).
  const handleDateFieldClick = (e) => {
    if (typeof e.target.showPicker === 'function') {
      try {
        e.target.showPicker()
      } catch {
        // Some browsers throw if called too frequently/without a user
        // gesture context — safe to ignore, default click behavior still works.
      }
    }
  }

  const handleLineChange = (e) => {
    const { name, value } = e.target
    setLine({ ...line, [name]: value })
    clearError(name)
  }

  // Toggling the "Edit GRN No" checkbox. Turning it on unlocks the
  // field and clears the current value so the user types a fresh one;
  // turning it off restores the last auto-generated preview value.
  const handleToggleEditGrnNo = async (checked) => {
    if (!canEditGRN) {
      toast.error('You do not have permission to edit GRN No')
      return
    }
    setEditGrnNo(checked)
    clearError('grnNo')

    if (checked) {
      setHeader((prev) => ({ ...prev, grnNo: '' }))
    } else {
      // Revert to the auto value by re-fetching the preview.
      try {
        const res = await API.get('/GrnEntry/next-number')
        setHeader((prev) => ({ ...prev, grnNo: res.data?.grnNumber || '' }))
      } catch {
        toast.error('Could not refresh the next GRN No')
      }
    }
  }

  // ★ CHANGED: Total Value now = Quantity × Rate (was Pallet Quantity × Rate)
  const totalValue = (Number(line.rate) || 0) * (Number(line.quantity) || 0)

  // Field is editable whenever the counter hasn't been seeded yet
  // (first-ever GRN) OR the user has explicitly ticked "Edit GRN No".
 const grnNoEditable =
  canEditGRN && (grnNoIsManual || editGrnNo)
  
  const validateAdd = () => {
    const temp = {}

    if (grnNoEditable && !header.grnNo.trim()) {
      temp.grnNo = grnNoIsManual
        ? 'GRN No is required (first GRN ever entered)'
        : 'Enter a GRN No or uncheck "Edit GRN No" to use the auto value'
    }

    if (!header.supplierId) temp.supplierId = 'Supplier is required'
    if (!header.poNumber.trim()) temp.poNumber = 'PO Number is required'
    if (!header.poDate) temp.poDate = 'PO Date is required'
    if (!header.grnType) temp.grnType = 'GRN Type is required'
    const invoiceNumber = header.supplierInvoiceNumber.trim()
    if (!invoiceNumber) {
      temp.supplierInvoiceNumber = 'Supplier Invoice Number is required'
    } else if (!/^[0-9]+$/.test(invoiceNumber)) {
      temp.supplierInvoiceNumber = 'Supplier Invoice Number must be numbers only'
    }

    if (!header.supplierInvoiceDate) temp.supplierInvoiceDate = 'Supplier Invoice Date is required'

    if (!line.itemId) {
      temp.itemId = 'Part Number is required'
    } else if (
      !editingLineKey &&
      lineItems.some((l) => l.itemId === line.itemId)
    ) {
      temp.itemId = 'This part has already been added'
    }
    if (line.rate === '' || Number(line.rate) <= 0) temp.rate = 'Rate is required'
    if (line.quantity === '' || Number(line.quantity) <= 0) temp.quantity = 'Quantity is required'

    if (line.palletQuantity !== '' && Number(line.palletQuantity) > 0 && line.quantity !== '') {
      if (Number(line.palletQuantity) > Number(line.quantity)) {
        temp.palletQuantity = 'Pallet Quantity cannot be greater than Quantity'
      }
    }

    setErrors(temp)
    return Object.keys(temp).length === 0
  }

  const handleAdd = () => {
    if (!validateAdd()) return

    const quantity = Number(line.quantity)
    const palletQty = Number(line.palletQuantity) || 0
    const rate = Number(line.rate)

    const baseRow = {
      itemId: line.itemId,
      partNumber: selectedItem?.label || '',
      itemName: selectedItem?.itemName || '',
      uom: selectedItem?.uom || '',
      rate,
    }

    let newRows = []

    if (palletQty > 0 && palletQty < quantity) {
      // Split into full pallets of `palletQty` each, plus one remainder
      // row if the quantity doesn't divide evenly — e.g. Quantity 1000,
      // Pallet Qty 200 -> five rows of 200 each. Each split row's Total
      // Value = rate × that row's own quantity (its pallet chunk), which
      // is still "Qty × Rate" per row — no change needed here.
      const fullPallets = Math.floor(quantity / palletQty)
      const remainder = quantity % palletQty

      for (let i = 0; i < fullPallets; i++) {
        newRows.push({
          ...baseRow,
          key: `${line.itemId}-${Date.now()}-${i}`,
          quantity: palletQty,
          palletQuantity: palletQty,
          totalValue: Math.round(rate * palletQty * 100) / 100,
        })
      }

      if (remainder > 0) {
        newRows.push({
          ...baseRow,
          key: `${line.itemId}-${Date.now()}-rem`,
          quantity: remainder,
          palletQuantity: remainder,
          totalValue: Math.round(rate * remainder * 100) / 100,
        })
      }
    } else {
      // No split needed — Pallet Qty blank, zero, or >= Quantity.
      // ★ CHANGED: totalValue here now comes from the Qty × Rate constant above.
      newRows = [
        {
          ...baseRow,
          key: `${line.itemId}-${Date.now()}`,
          quantity,
          palletQuantity: line.palletQuantity,
          totalValue: Math.round(totalValue * 100) / 100,
        },
      ]
    }

    if (editingLineKey) {
      setLineItems((prev) => [...prev, ...newRows])
    } else {
      setLineItems((prev) => [...prev, ...newRows])
    }
    setLine(EMPTY_LINE)
    setEditingLineKey(null)
  }

  const handleCancel = () => {
    setLine(EMPTY_LINE)
    setEditingLineKey(null)

    setErrors((prev) => ({
      ...prev,
      itemId: '',
      rate: '',
      quantity: '',
      palletQuantity: '',
    }))
  }

  const handleDeleteLine = (key) => {
    setLineItems((prev) => prev.filter((x) => x.key !== key))
  }

  const handleEditLine = (row) => {
    if (row.isPosted) {
      toast.info('Posted item cannot be edited')
      return
    }

    setLine({
      itemId: String(row.itemId),
      palletQuantity:
        row.palletQuantity === null || row.palletQuantity === undefined
          ? ''
          : row.palletQuantity,
      rate: row.rate,
      quantity: row.quantity,
    })

    setEditingLineKey(row.key)

    // Remove it temporarily from the grid.
    // It will be added back when Update Item is clicked.
    setLineItems((prev) => prev.filter((x) => x.key !== row.key))

    setErrors({})
  }

  const handleClearAll = () => {
    setHeader(EMPTY_HEADER)
    setLine(EMPTY_LINE)
    setLineItems([])
    setErrors({})
    setEditGrnNo(false)
    loadNextGrnNo()
  }

  const handleSave = async () => {
    if (lineItems.length === 0) {
      toast.error('Add at least one part before saving')
      return
    }

    if (grnNoEditable && !header.grnNo.trim()) {
      setErrors((prev) => ({ ...prev, grnNo: 'GRN No is required' }))
      toast.error('Enter a GRN No before saving')
      return
    }

    try {
      const payload = {
        // Send grnNo whenever the field was editable (first-ever GRN OR
        // user explicitly overrode it via the checkbox). Also send
        // overrideGrnNo so the backend knows this is a mid-sequence
        // reseed request, not just the initial seed.
        grnNo: isEditMode
          ? header.grnNo.trim()
          : grnNoEditable
            ? header.grnNo.trim()
            : undefined,

        overrideGrnNo: isEditMode ? false : editGrnNo,
        createdBy: getCurrentUsername(),
        supplierId: Number(header.supplierId),
        poNumber: header.poNumber.trim(),
        poDate: header.poDate,
        grnType: header.grnType,
        supplierInvoiceNumber: header.supplierInvoiceNumber.trim(),
        supplierInvoiceDate: header.supplierInvoiceDate,
        lines: lineItems.map((l) => ({
          itemId: Number(l.itemId),
          uom: l.uom,
          palletQuantity: l.palletQuantity === '' ? null : Number(l.palletQuantity),
          rate: l.rate,
          quantity: l.quantity,
        })),
      }

      let res

      if (isEditMode) {
        res = await API.put(`/GrnEntry/${editGrnId}`, payload)

        toast.success(
          `GRN Updated Successfully (${res.data.grnNumber})`
        )
      } else {
        res = await API.post('/GrnEntry', payload)

        toast.success(
          `GRN Saved Successfully (${res.data.grnNumber})`
        )
      }

      handleClearAll()
      navigate('/transaction/grnpost')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  // Totals sum only Quantity, Rate, and Total Value. Pallet Quantity is
  // intentionally excluded — it's a per-line split marker, not a
  // meaningful running total. Computed over the FULL lineItems array
  // regardless of which page the DataTable below is currently showing.
  const totals = lineItems.reduce(
    (acc, l) => ({
      quantity: acc.quantity + l.quantity,
      rate: acc.rate + l.rate,
      totalValue: acc.totalValue + l.totalValue,
    }),
    { quantity: 0, rate: 0, totalValue: 0 },
  )

  // ★ NEW: added-lines grid now uses react-data-table-component
  // (DataTable), matching the rest of the app (GRN Post, Store
  // Movement, etc.) instead of a plain HTML <table>, with built-in
  // pagination for GRNs that end up with a lot of split pallet rows.
  const lineColumns = [
    { name: 'S.NO', selector: (row, index) => index + 1, width: '70px' },
    {
      name: 'PART',
      grow: 2,
      cell: (row) => (
        <div className="grn-part-cell">
          <strong>{row.partNumber}</strong>
          <span>{row.itemName}</span>
        </div>
      ),
    },
    { name: 'QUANTITY', selector: (row) => row.quantity, center: true },
    { name: 'PALLET QTY', selector: (row) => row.palletQuantity || '—', center: true },
    { name: 'RATE (₹)', selector: (row) => Number(row.rate).toFixed(2), center: true },
    { name: 'TOTAL VALUE (₹)', selector: (row) => Number(row.totalValue).toFixed(2), center: true },
    {
      name: 'ACTION',
      center: true,
      cell: (row) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button
            type="button"
            className="grn-edit-btn"
            onClick={() => handleEditLine(row)}
            disabled={row.isPosted}
            title={row.isPosted ? 'Posted item cannot be edited' : 'Edit Item'}
          >
            <FaEdit size={11} /> Edit
          </button>

          <button
            type="button"
            className="grn-delete-btn"
            onClick={() => handleDeleteLine(row.key)}
            disabled={row.isPosted}
          >
            <FaTrash size={11} /> Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="grn-entry-page">
      <CCard className="grn-form-card mb-3">
        <CCardBody>
          <div className="section-title">
            {isEditMode ? 'Edit GRN' : 'Basic Information'}
          </div>
          <CRow className="g-3">
            <CCol md={4}>
              <label className="custom-label">
                <strong>GRN No</strong> <span className="required">*</span>
              </label>
              <CFormInput
                name="grnNo"
                placeholder={grnNoEditable ? 'Enter GRN No (e.g. 260001)' : ''}
                value={header.grnNo}
                disabled={isEditMode || !grnNoEditable}
                className={errors.grnNo ? 'error-input' : ''}
                onChange={(e) => {
                  setHeader({ ...header, grnNo: e.target.value })
                  clearError('grnNo')
                }}
              />
              {errors.grnNo && <small className="text-danger">{errors.grnNo}</small>}

              {/* Checkbox to unlock GRN No even once auto-generation is active */}
              {!grnNoIsManual && !isEditMode && canEditGRN && (
                <div className="mt-1">
                  <CFormCheck
                    id="editGrnNoCheck"
                    label="Edit GRN No (override auto-generated value)"
                    checked={editGrnNo}
                    onChange={(e) => handleToggleEditGrnNo(e.target.checked)}
                  />
                </div>
              )}

              {!grnNoIsManual && !editGrnNo && !errors.grnNo && (
                <small className="text-muted">Auto-generated — continues from the last GRN entered</small>
              )}
              {editGrnNo && !errors.grnNo && (
                <small className="text-muted">Auto-numbering will continue from this value after saving</small>
              )}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Supplier</strong> <span className="required">*</span></label>
              <div className={errors.supplierId ? 'react-select-error' : ''}>
                <Select
                  classNamePrefix="react-select"
                  placeholder="Select Supplier"
                  options={supplierOptions}
                  value={supplierOptions.find((x) => String(x.value) === String(header.supplierId)) || null}
                  onChange={(selected) => {
                    setHeader({ ...header, supplierId: selected?.value || '' })
                    clearError('supplierId')
                  }}
                  isClearable
                />
              </div>
              {errors.supplierId && <small className="text-danger">{errors.supplierId}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>PO Number</strong> <span className="required">*</span></label>
              <CFormInput
                name="poNumber"
                placeholder="Enter PO Number"
                value={header.poNumber}
                className={errors.poNumber ? 'error-input' : ''}
                onChange={(e) =>
                  handleHeaderChange({
                    target: {
                      name: 'poNumber',
                      value: e.target.value.replace(/[^a-zA-Z0-9]/g, ''),
                    },
                  })
                }
              />
              {errors.poNumber && <small className="text-danger">{errors.poNumber}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>PO Date</strong> <span className="required">*</span></label>
              <CFormInput
                type="date"
                name="poDate"
                value={header.poDate}
                className={errors.poDate ? 'error-input' : ''}
                onChange={handleHeaderChange}
                onClick={handleDateFieldClick}
              />
              {errors.poDate && <small className="text-danger">{errors.poDate}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>GRN Type</strong> <span className="required">*</span></label>
              <div className={errors.grnType ? 'react-select-error' : ''}>
                <Select
                  classNamePrefix="react-select"
                  placeholder="Select GRN Type"
                  options={GRN_TYPE_OPTIONS}
                  value={GRN_TYPE_OPTIONS.find((x) => x.value === header.grnType) || null}
                  onChange={(selected) => {
                    setHeader({ ...header, grnType: selected?.value || '' })
                    clearError('grnType')
                  }}
                  isClearable
                />
              </div>
              {errors.grnType && <small className="text-danger">{errors.grnType}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Part Number</strong> <span className="required">*</span></label>
              <div className={errors.itemId ? 'react-select-error' : ''}>
                <Select
                  classNamePrefix="react-select"
                  placeholder="Select Part Number"
                  options={itemOptions}
                  value={selectedItem || null}
                  onChange={(selected) => {
                    setLine({ ...line, itemId: selected?.value || '' })
                    clearError('itemId')
                  }}
                  isClearable
                />
              </div>
              {errors.itemId && <small className="text-danger">{errors.itemId}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Part Name</strong></label>
              <CFormInput value={selectedItem?.itemName || ''} placeholder="Auto-filled from Part Number" disabled />
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Supplier Invoice Number</strong> <span className="required">*</span></label>
              <CFormInput
                name="supplierInvoiceNumber"
                placeholder="Enter Supplier Invoice Number (numbers only)"
                value={header.supplierInvoiceNumber}
                className={errors.supplierInvoiceNumber ? 'error-input' : ''}
                onChange={(e) =>
                  handleHeaderChange({
                    target: { name: 'supplierInvoiceNumber', value: e.target.value.replace(/[^0-9]/g, '') },
                  })
                }
              />
              {errors.supplierInvoiceNumber && <small className="text-danger">{errors.supplierInvoiceNumber}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Supplier Invoice Date</strong> <span className="required">*</span></label>
              <CFormInput
                type="date"
                name="supplierInvoiceDate"
                value={header.supplierInvoiceDate}
                className={errors.supplierInvoiceDate ? 'error-input' : ''}
                onChange={handleHeaderChange}
                onClick={handleDateFieldClick}
              />
              {errors.supplierInvoiceDate && <small className="text-danger">{errors.supplierInvoiceDate}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>UOM</strong></label>
              <CFormInput value={selectedItem?.uom || ''} placeholder="Auto-filled from Part Number" disabled />
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Quantity</strong> <span className="required">*</span></label>
              <CFormInput
                type="number"
                name="quantity"
                placeholder="Enter Quantity"
                value={line.quantity}
                className={errors.quantity ? 'error-input' : ''}
                onChange={handleLineChange}
              />
              {errors.quantity && <small className="text-danger">{errors.quantity}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Rate (₹)</strong> <span className="required">*</span></label>
              <CFormInput
                type="number"
                name="rate"
                placeholder="Enter Rate"
                value={line.rate}
                className={errors.rate ? 'error-input' : ''}
                onChange={handleLineChange}
              />
              {errors.rate && <small className="text-danger">{errors.rate}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Pallet Quantity</strong></label>
              <CFormInput
                type="number"
                name="palletQuantity"
                placeholder="Enter Pallet Quantity"
                value={line.palletQuantity}
                className={errors.palletQuantity ? 'error-input' : ''}
                onChange={handleLineChange}
              />
              {errors.palletQuantity && <small className="text-danger">{errors.palletQuantity}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Total Value (₹)</strong></label>
              <CFormInput value={totalValue ? totalValue.toFixed(2) : ''} placeholder="Auto-calculated" disabled />
            </CCol>
          </CRow>

          <div className="form-button-area">
            <CButton className="add-btn" onClick={handleAdd}>
              {editingLineKey ? (
                <>
                  <FaEdit size={12} /> Update Item
                </>
              ) : (
                <>
                  <FaPlus size={12} /> Add
                </>
              )}
            </CButton>
            <CButton className="cancel-btn" onClick={handleCancel}>
              Cancel
            </CButton>
          </div>
        </CCardBody>
      </CCard>

      <CCard>
        <CCardBody>
          <div className="grn-table-wrap">
            <DataTable
              columns={lineColumns}
              data={lineItems}
              pagination
              paginationPerPage={5}
              paginationRowsPerPageOptions={[5, 10, 25, 50]}
              persistTableHead
              striped
              responsive
              highlightOnHover
              noDataComponent={<div className="grn-empty-row">No parts added yet</div>}
              customStyles={{
                rows: { style: { minHeight: '38px' } },
                headRow: { style: { backgroundColor: '#f1f4fa' } },
                headCells: {
                  style: {
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#23395d',
                    textTransform: 'uppercase',
                    backgroundColor: '#f1f4fa',
                  },
                },
                cells: {
                  style: {
                    justifyContent: 'center',
                    fontSize: '14px',
                  },
                },
              }}
            />

            {/* Totals bar — sums the FULL lineItems array (every page),
                not just whichever page the DataTable happens to be
                showing. Pallet Qty is intentionally excluded, same as
                before — it's a per-line split marker, not a meaningful
                running total. */}
            {lineItems.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 28,
                  padding: '12px 16px',
                  marginTop: 8,
                  background: '#f7f9fd',
                  border: '1px solid #dbe2ee',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span>Total Quantity: <strong>{totals.quantity}</strong></span>
                <span>Total Rate: <strong>₹{totals.rate.toFixed(2)}</strong></span>
                <span>Total Value: <strong>₹{totals.totalValue.toFixed(2)}</strong></span>
              </div>
            )}
          </div>

          <div className="grn-save-area">
            <CButton className="save-btn" onClick={handleSave}>
              {isEditMode ? 'Update' : 'Save'}
            </CButton>
            <CButton className="clear-btn" onClick={handleClearAll}>
              Clear
            </CButton>
          </div>
        </CCardBody>
      </CCard>
    </div>
  )
}

export default GRNEntry
