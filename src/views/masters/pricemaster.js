import React, { useEffect, useState, useRef } from 'react'
import DataTable from 'react-data-table-component'
import {
  CButton,
  CFormInput,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CTooltip,
} from '@coreui/react'
import { FaEdit, FaTrash, FaPlus, FaArrowLeft } from 'react-icons/fa'
import { toast } from 'react-toastify'
import Select from 'react-select'
import API from '../../api.js'
import '../../assets/CSS/priceMaster.css'

const CUSTOMER_OR_SUPPLIER_OPTIONS = [
  { value: 'Customer', label: 'Customer' },
  { value: 'Supplier', label: 'Supplier' },
]

const EMPTY_FORM = {
  partNumberId: '',
  partName: '',
  customerOrSupplier: '',
  rate: '',
  effectiveDate: '',
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

const PriceMaster = () => {
  const rateRef = useRef()

  const customStyles = {
    rows: { style: { minHeight: '34px' } },
    headCells: {
      style: {
        justifyContent: 'center',
        fontSize: '14px',
        paddingTop: '2px',
        paddingBottom: '2px',
      },
    },
    cells: {
      style: {
        justifyContent: 'center',
        fontSize: '13px',
        paddingTop: '0px',
        paddingBottom: '0px',
      },
    },
  }

  const [prices, setPrices] = useState([])
  const [parts, setParts] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  const [errors, setErrors] = useState({
    partNumberId: '',
    customerOrSupplier: '',
    rate: '',
    effectiveDate: '',
  })

  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deletePrice, setDeletePrice] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    loadPrices()
    loadParts()
  }, [])

  const clearError = (name) => {
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const loadPrices = async () => {
    try {
      const res = await API.get('/PriceMaster')
      setPrices(res.data || [])
    } catch {
      toast.error('Failed to load price list')
    }
  }

  const loadParts = async () => {
    try {
      const res = await API.get('/PriceMaster/parts-list')
      setParts(res.data || [])
    } catch {
      toast.error('Failed to load parts')
    }
  }

  // Selecting a Part Number auto-fills Part Name — /PriceMaster/parts-list
  // already returns partName alongside each option, no extra lookup needed.
  const handlePartSelect = (selected) => {
    const match = parts.find((p) => p.value === selected?.value)

    setForm((prev) => ({
      ...prev,
      partNumberId: selected?.value || '',
      partName: match?.partName || '',
    }))

    clearError('partNumberId')
  }

  const validate = () => {
    const temp = {
      partNumberId: '',
      customerOrSupplier: '',
      rate: '',
      effectiveDate: '',
    }

    if (!form.partNumberId) temp.partNumberId = 'Part Number is required'
    if (!form.customerOrSupplier) temp.customerOrSupplier = 'Customer/Supplier is required'

    if (form.rate === '' || form.rate === null) {
      temp.rate = 'Rate is required'
    } else if (Number(form.rate) <= 0) {
      temp.rate = 'Rate must be greater than 0'
    }

    if (!form.effectiveDate) temp.effectiveDate = 'Effective Date is required'

    setErrors(temp)

    return !Object.values(temp).some((x) => x)
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        partNumberId: Number(form.partNumberId),
        customerOrSupplier: form.customerOrSupplier,
        rate: Number(form.rate),
        effectiveDate: form.effectiveDate,
      }

      if (editId) {
        await API.put(`/PriceMaster/${editId}`, payload)
        toast.success('Price Updated Successfully')
      } else {
        await API.post('/PriceMaster', payload)
        toast.success('Price Saved Successfully')
      }

      await loadPrices()
      resetForm()
      setShowForm(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const handleEdit = async (row) => {
    try {
      const res = await API.get(`/PriceMaster/${row.id}`)
      const d = res.data

      setEditId(row.id)
      setShowForm(true)

      setForm({
        partNumberId: d.partNumberId || '',
        partName: d.partName || '',
        customerOrSupplier: d.customerOrSupplier || '',
        rate: d.rate ?? '',
        effectiveDate: d.effectiveDate ? d.effectiveDate.substring(0, 10) : '',
      })

      setErrors({
        partNumberId: '',
        customerOrSupplier: '',
        rate: '',
        effectiveDate: '',
      })
    } catch {
      toast.error('Failed to load price record')
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setErrors({
      partNumberId: '',
      customerOrSupplier: '',
      rate: '',
      effectiveDate: '',
    })
    setEditId(null)
  }

  const handleAddNew = () => {
    resetForm()
    setShowForm(true)
  }

  const handleBack = () => {
    resetForm()
    setShowForm(false)
  }

  const confirmDelete = async () => {
    try {
      await API.delete(`/PriceMaster/${deleteId}`)
      toast.success('Deleted Successfully')
      resetForm()
      await loadPrices()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeletePrice(null)
    }
  }

  const filteredPrices = prices.filter(
    (p) =>
      (p.partNumberCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.partName || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.customerOrSupplier || '').toLowerCase().includes(search.toLowerCase()),
  )

  const partOptions = parts.map((p) => ({ value: p.value, label: p.label }))

  const TooltipCell = ({ value }) => {
    if (value === null || value === undefined || value === '') return <span>—</span>
    return (
      <CTooltip content={value} placement="top">
        <span className="price-table-cell-text">{value}</span>
      </CTooltip>
    )
  }

  const formatDate = (value) => {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  const columns = [
    { name: 'SL.NO', selector: (row, index) => index + 1, width: '80px' },
    {
      name: 'PART NUMBER',
      selector: (row) => row.partNumberCode,
      cell: (row) => <TooltipCell value={row.partNumberCode} />,
    },
    {
      name: 'PART NAME',
      selector: (row) => row.partName,
      wrap: true,
      cell: (row) => <TooltipCell value={row.partName} />,
    },
    {
      name: 'CUSTOMER/SUPPLIER',
      selector: (row) => row.customerOrSupplier,
      cell: (row) => <TooltipCell value={row.customerOrSupplier} />,
    },
    {
      name: 'RATE (₹)',
      selector: (row) => row.rate,
      cell: (row) => <TooltipCell value={Number(row.rate || 0).toFixed(2)} />,
    },
    {
      name: 'EFFECTIVE DATE',
      selector: (row) => row.effectiveDate,
      cell: (row) => <TooltipCell value={formatDate(row.effectiveDate)} />,
    },
    {
      name: 'ACTION',
      center: true,
      cell: (row) => (
        <div className="action-wrapper">
          <button className="table-action-btn edit-btn" title="Edit" onClick={() => handleEdit(row)}>
            <FaEdit />
          </button>

          <button
            className="table-action-btn delete-btn"
            title="Delete"
            onClick={() => {
              setDeleteId(row.id)
              setDeletePrice(row)
              setShowDeleteModal(true)
            }}
          >
            <FaTrash />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="price-master-page">
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">Total Price Records</div>
              <div className="summary-value">{String(prices.length).padStart(2, '0')}</div>
            </div>

            <button className="round-icon-btn add-item-btn" title="Add Price" onClick={handleAddNew}>
              <FaPlus size={16} />
            </button>
          </CCardBody>
        </CCard>
      )}

      {showForm && (
        <CCard className="price-master-form-card mb-3">
          <CCardBody className="price-master-form-card-body">
            <button className="round-icon-btn back-btn card-back-btn" title="Back" onClick={handleBack}>
              <FaArrowLeft size={14} />
            </button>

            <div className="section-title">Price Information</div>

            <CRow className="g-3">
              <CCol md={4}>
                <label className="custom-label">
                  <strong>Part Number</strong> <span className="required">*</span>
                </label>
                <div className={errors.partNumberId ? 'react-select-error' : ''}>
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Part Number"
                    options={partOptions}
                    value={partOptions.find((x) => String(x.value) === String(form.partNumberId)) || null}
                    onChange={handlePartSelect}
                    isClearable
                  />
                </div>
                {errors.partNumberId && <small className="text-danger">{errors.partNumberId}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label"><strong>Part Name</strong></label>
                <CFormInput value={form.partName} placeholder="Auto-filled from Part Number" disabled />
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Customer / Supplier</strong> <span className="required">*</span>
                </label>
                <div className={errors.customerOrSupplier ? 'react-select-error' : ''}>
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Type"
                    options={CUSTOMER_OR_SUPPLIER_OPTIONS}
                    value={CUSTOMER_OR_SUPPLIER_OPTIONS.find((x) => x.value === form.customerOrSupplier) || null}
                    onChange={(selected) => {
                      setForm({ ...form, customerOrSupplier: selected?.value || '' })
                      clearError('customerOrSupplier')
                    }}
                    isClearable
                  />
                </div>
                {errors.customerOrSupplier && <small className="text-danger">{errors.customerOrSupplier}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Rate</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  ref={rateRef}
                  type="number"
                  name="rate"
                  placeholder="Enter Rate"
                  value={form.rate}
                  className={errors.rate ? 'error-input' : ''}
                  onChange={(e) => {
                    setForm({ ...form, rate: e.target.value })
                    clearError('rate')
                  }}
                />
                {errors.rate && <small className="text-danger">{errors.rate}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Effective Date</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  type="date"
                  name="effectiveDate"
                  value={form.effectiveDate}
                  className={errors.effectiveDate ? 'error-input' : ''}
                  onChange={(e) => {
                    setForm({ ...form, effectiveDate: e.target.value })
                    clearError('effectiveDate')
                  }}
                />
                {errors.effectiveDate && <small className="text-danger">{errors.effectiveDate}</small>}
              </CCol>
            </CRow>

            <div className="form-button-area">
              <CButton className={editId ? 'update-btn' : 'save-btn'} onClick={handleSubmit}>
                {editId ? 'Update' : 'Save'}
              </CButton>

              <CButton className="clear-btn" onClick={resetForm}>
                Clear
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      )}

      <CCard className="mt-3">
        <CCardBody>
          <div className="table-header">
            <div className="table-title">Price List</div>

            <CFormInput
              placeholder="Search by Part Number, Part Name, Customer/Supplier..."
              className="search-box"
              style={{ width: '340px' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredPrices}
            pagination
            striped
            responsive
            highlightOnHover
            customStyles={customStyles}
          />
        </CCardBody>
      </CCard>

      <CModal visible={showDeleteModal} onClose={() => setShowDeleteModal(false)} alignment="center" backdrop="static">
        <CModalHeader className="border-0">
          <CModalTitle className="w-100 text-center text-danger fw-bold">⚠ Confirm Delete</CModalTitle>
        </CModalHeader>

        <CModalBody className="text-center">
          <p>Are you sure you want to delete this Price record?</p>

          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
            <div>
              <strong>Part Number :</strong>{' '}
              <span className="text-primary fw-bold">{deletePrice?.partNumberCode}</span>
            </div>
          </div>
        </CModalBody>

        <CModalFooter className="border-0 d-flex justify-content-center">
          <CButton color="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</CButton>
          <CButton color="danger" onClick={confirmDelete}>Delete</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default PriceMaster
