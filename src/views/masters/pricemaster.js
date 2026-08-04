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
} from '@coreui/react'
import { FaEdit, FaTrash, FaPlus, FaArrowLeft } from 'react-icons/fa'
import { toast } from 'react-toastify'
import Select from 'react-select'
import API from '../../api.js'
import '../../assets/CSS/priceMaster.css'

const TYPE_OPTIONS = [
  { value: 'Customer', label: 'Customer' },
  { value: 'Supplier', label: 'Supplier' },
]

const EMPTY_FORM = {
  partNumberId: '',
  groupCode: '',
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

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const PriceMaster = () => {
  const groupCodeRef = useRef()

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
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  const [errors, setErrors] = useState({
    partNumberId: '',
    groupCode: '',
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
    loadItems()
  }, [])

  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        groupCodeRef.current?.focus()
      }, 200)
    }
  }, [showForm])

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

  const loadItems = async () => {
    try {
      const res = await API.get('/ItemMaster')
      setItems(res.data || [])
    } catch {
      toast.error('Failed to load part numbers')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    clearError(name)
  }

  const validate = () => {
    const temp = {
      partNumberId: '',
      groupCode: '',
      customerOrSupplier: '',
      rate: '',
      effectiveDate: '',
    }

    if (!form.partNumberId) temp.partNumberId = 'Part Number is required'
    if (!form.groupCode.trim()) temp.groupCode = 'Group Code is required'
    if (!form.customerOrSupplier) temp.customerOrSupplier = 'Customer/Supplier is required'
    if (form.rate === '' || form.rate === null) temp.rate = 'Rate is required'
    if (!form.effectiveDate) temp.effectiveDate = 'Effective Date is required'

    setErrors(temp)

    return !Object.values(temp).some((x) => x)
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        partNumberId: Number(form.partNumberId),
        groupCode: form.groupCode.trim(),
        customerOrSupplier: form.customerOrSupplier,
        rate: Number(form.rate) || 0,
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
        groupCode: d.groupCode || '',
        customerOrSupplier: d.customerOrSupplier || '',
        rate: d.rate ?? '',
        effectiveDate: d.effectiveDate ? d.effectiveDate.substring(0, 10) : '',
      })

      setErrors({
        partNumberId: '',
        groupCode: '',
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
      groupCode: '',
      customerOrSupplier: '',
      rate: '',
      effectiveDate: '',
    })

    setEditId(null)

    setTimeout(() => {
      groupCodeRef.current?.focus()
    }, 100)
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
      (p.partNumberText || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.groupCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.customerOrSupplier || '').toLowerCase().includes(search.toLowerCase()),
  )

  const partNumberOptions = items.map((i) => ({ value: i.id, label: i.itemNumber }))

  const columns = [
    { name: 'SL.NO', selector: (row, index) => index + 1, width: '70px' },
    { name: 'PART NUMBER', selector: (row) => row.partNumberText },
    { name: 'GROUP CODE', selector: (row) => row.groupCode },
    {
      name: 'CUSTOMER / SUPPLIER',
      selector: (row) => row.customerOrSupplier,
      cell: (row) => (
        <span className={`type-badge ${row.customerOrSupplier === 'Customer' ? 'type-customer' : 'type-supplier'}`}>
          {row.customerOrSupplier}
        </span>
      ),
    },
    {
      name: 'RATE (₹)',
      selector: (row) => row.rate,
      cell: (row) => Number(row.rate || 0).toFixed(2),
    },
    {
      name: 'EFFECTIVE DATE',
      selector: (row) => row.effectiveDate,
      cell: (row) => formatDate(row.effectiveDate),
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
              <div className="summary-label">Total Price</div>
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

            <div className="section-title">Basic Information</div>

            <CRow className="g-3">
              <CCol md={4}>
                <label className="custom-label">
                  <strong>Part Number</strong> <span className="required">*</span>
                </label>
                <div className={errors.partNumberId ? 'react-select-error' : ''}>
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Part Number"
                    options={partNumberOptions}
                    value={partNumberOptions.find((x) => String(x.value) === String(form.partNumberId)) || null}
                    onChange={(selected) => {
                      setForm({ ...form, partNumberId: selected?.value || '' })
                      clearError('partNumberId')
                    }}
                    isClearable
                  />
                </div>
                {errors.partNumberId && <small className="text-danger">{errors.partNumberId}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Group Code</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  ref={groupCodeRef}
                  name="groupCode"
                  placeholder="Enter Group Code"
                  value={form.groupCode}
                  className={errors.groupCode ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.groupCode && <small className="text-danger">{errors.groupCode}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Customer/Supplier</strong> <span className="required">*</span>
                </label>
                <div className={errors.customerOrSupplier ? 'react-select-error' : ''}>
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Customer/Supplier"
                    options={TYPE_OPTIONS}
                    value={TYPE_OPTIONS.find((x) => x.value === form.customerOrSupplier) || null}
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
                  <strong>Effective Date</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  type="date"
                  name="effectiveDate"
                  value={form.effectiveDate}
                  className={errors.effectiveDate ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.effectiveDate && <small className="text-danger">{errors.effectiveDate}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Rate</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  type="number"
                  name="rate"
                  placeholder="Enter Rate"
                  value={form.rate}
                  className={errors.rate ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.rate && <small className="text-danger">{errors.rate}</small>}
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
              placeholder="Search..."
              className="search-box"
              style={{ width: '320px' }}
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
              <span className="text-primary fw-bold">{deletePrice?.partNumberText}</span>
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
