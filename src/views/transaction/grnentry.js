import React, { useEffect, useState } from 'react'
import { CButton, CFormInput, CRow, CCol, CCard, CCardBody } from '@coreui/react'
import { FaPlus, FaTrash } from 'react-icons/fa'
import { toast } from 'react-toastify'
import Select from 'react-select'
import API from '../../api.js'
import '../../assets/CSS/grnEntry.css'

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
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])

  const [header, setHeader] = useState(EMPTY_HEADER)
  const [line, setLine] = useState(EMPTY_LINE)
  const [lineItems, setLineItems] = useState([]) // rows added to the grid, not yet saved
  const [errors, setErrors] = useState({})
  const [grnNoIsManual, setGrnNoIsManual] = useState(true)

  useEffect(() => {
    loadItems()
    loadSuppliers()
    loadNextGrnNo()
  }, [])

  const loadNextGrnNo = async () => {
    try {
      const res = await API.get('/GrnEntry/next-number')
      setGrnNoIsManual(!!res.data?.isManual)
      setHeader((prev) => ({ ...prev, grnNo: res.data?.grnNumber || '' }))
    } catch {
      // Couldn't reach the preview endpoint — fall back to manual entry
      // so the user can still type a GRN No rather than being locked
      // out with a disabled, blank field.
      setGrnNoIsManual(true)
      setHeader((prev) => ({ ...prev, grnNo: '' }))
      toast.error('Could not check the next GRN No — enter it manually')
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
      const res = await API.get('/ItemMaster')
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

  const handleLineChange = (e) => {
    const { name, value } = e.target
    setLine({ ...line, [name]: value })
    clearError(name)
  }

  const totalValue = (Number(line.rate) || 0) * (Number(line.quantity) || 0)

  const validateAdd = () => {
    const temp = {}

    if (grnNoIsManual && !header.grnNo.trim()) {
      temp.grnNo = 'GRN No is required (first GRN ever entered)'
    }

    if (!header.supplierId) temp.supplierId = 'Supplier is required'
    if (!header.poNumber.trim()) temp.poNumber = 'PO Number is required'
    if (!header.poDate) temp.poDate = 'PO Date is required'
    if (!header.grnType) temp.grnType = 'GRN Type is required'
    if (!header.supplierInvoiceNumber.trim()) temp.supplierInvoiceNumber = 'Supplier Invoice Number is required'
    if (!header.supplierInvoiceDate) temp.supplierInvoiceDate = 'Supplier Invoice Date is required'

    if (!line.itemId) temp.itemId = 'Part Number is required'
    if (line.rate === '' || Number(line.rate) <= 0) temp.rate = 'Rate is required'
    if (line.quantity === '' || Number(line.quantity) <= 0) temp.quantity = 'Quantity is required'

    setErrors(temp)
    return Object.keys(temp).length === 0
  }

  const handleAdd = () => {
    if (!validateAdd()) return

    setLineItems((prev) => [
      ...prev,
      {
        key: `${line.itemId}-${Date.now()}`,
        itemId: line.itemId,
        partNumber: selectedItem?.label || '',
        itemName: selectedItem?.itemName || '',
        uom: selectedItem?.uom || '',
        palletQuantity: line.palletQuantity,
        rate: Number(line.rate),
        quantity: Number(line.quantity),
        totalValue: Math.round(totalValue * 100) / 100,
      },
    ])

    // Keep PO/header fields, clear only the part-specific fields for the next row.
    setLine(EMPTY_LINE)
  }

  const handleCancel = () => {
    setLine(EMPTY_LINE)
    setErrors((prev) => ({ ...prev, itemId: '', rate: '', quantity: '' }))
  }

  const handleDeleteLine = (key) => {
    setLineItems((prev) => prev.filter((x) => x.key !== key))
  }

  const handleClearAll = () => {
    setHeader(EMPTY_HEADER)
    setLine(EMPTY_LINE)
    setLineItems([])
    setErrors({})
  }

  const handleSave = async () => {
    if (lineItems.length === 0) {
      toast.error('Add at least one part before saving')
      return
    }

    if (grnNoIsManual && !header.grnNo.trim()) {
      setErrors((prev) => ({ ...prev, grnNo: 'GRN No is required (first GRN ever entered)' }))
      toast.error('Enter a GRN No before saving')
      return
    }

    try {
      const payload = {
        grnNo: grnNoIsManual ? header.grnNo.trim() : undefined,
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

      const res = await API.post('/GrnEntry', payload)
      toast.success(`GRN Saved Successfully (${res.data.grnNumber})`)
      handleClearAll()
      await loadNextGrnNo()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const totals = lineItems.reduce(
    (acc, l) => ({
      quantity: acc.quantity + l.quantity,
      rate: acc.rate + l.rate,
      totalValue: acc.totalValue + l.totalValue,
    }),
    { quantity: 0, rate: 0, totalValue: 0 },
  )

  return (
    <div className="grn-entry-page">
      <CCard className="grn-form-card mb-3">
        <CCardBody>
          <div className="section-title">Basic Information</div>

          <CRow className="g-3">
            <CCol md={4}>
              <label className="custom-label">
                <strong>GRN No</strong> <span className="required">*</span>
              </label>
              <CFormInput
                name="grnNo"
                placeholder={grnNoIsManual ? 'Enter starting GRN No (e.g. 260001)' : ''}
                value={header.grnNo}
                disabled={!grnNoIsManual}
                className={errors.grnNo ? 'error-input' : ''}
                onChange={(e) => {
                  setHeader({ ...header, grnNo: e.target.value })
                  clearError('grnNo')
                }}
              />
              {errors.grnNo && <small className="text-danger">{errors.grnNo}</small>}
              {!grnNoIsManual && !errors.grnNo && (
                <small className="text-muted">Auto-generated — continues from the last GRN entered</small>
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
                onChange={handleHeaderChange}
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
                placeholder="Enter Supplier Invoice Number"
                value={header.supplierInvoiceNumber}
                className={errors.supplierInvoiceNumber ? 'error-input' : ''}
                onChange={handleHeaderChange}
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
              />
              {errors.supplierInvoiceDate && <small className="text-danger">{errors.supplierInvoiceDate}</small>}
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>UOM</strong></label>
              <CFormInput value={selectedItem?.uom || ''} placeholder="Auto-filled from Part Number" disabled />
            </CCol>

            <CCol md={4}>
              <label className="custom-label"><strong>Pallet Quantity</strong></label>
              <CFormInput
                type="number"
                name="palletQuantity"
                placeholder="Enter Pallet Quantity"
                value={line.palletQuantity}
                onChange={handleLineChange}
              />
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
              <label className="custom-label"><strong>Total Value (₹)</strong></label>
              <CFormInput value={totalValue ? totalValue.toFixed(2) : ''} placeholder="Auto-calculated" disabled />
            </CCol>
          </CRow>

          <div className="form-button-area">
            <CButton className="add-btn" onClick={handleAdd}>
              <FaPlus size={12} /> Add
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
            <table className="grn-line-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Part</th>
                  <th>Quantity</th>
                  <th>Rate (₹)</th>
                  <th>Total Value (₹)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="grn-empty-row">No parts added yet</td>
                  </tr>
                ) : (
                  lineItems.map((l, index) => (
                    <tr key={l.key}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="grn-part-cell">
                          <strong>{l.partNumber}</strong>
                          <span>{l.itemName}</span>
                        </div>
                      </td>
                      <td>{l.quantity}</td>
                      <td>{l.rate.toFixed(2)}</td>
                      <td>{l.totalValue.toFixed(2)}</td>
                      <td>
                        <button className="grn-delete-btn" onClick={() => handleDeleteLine(l.key)}>
                          <FaTrash size={11} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {lineItems.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={2}><strong>Total</strong></td>
                    <td><strong>{totals.quantity}</strong></td>
                    <td><strong>{totals.rate.toFixed(2)}</strong></td>
                    <td><strong>{totals.totalValue.toFixed(2)}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="grn-save-area">
            <CButton className="save-btn" onClick={handleSave}>
              Save
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
