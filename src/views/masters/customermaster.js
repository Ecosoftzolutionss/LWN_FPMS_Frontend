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
import '../../assets/CSS/customerMaster.css'

const EMPTY_FORM = {
  customerCode: '',
  customerName: '',
  customerDivision: '',
  mobileNumber: '',
  emailId: '',
  gstNo: '',
}

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const MOBILE_REGEX = /^[0-9]{10}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_REGEX = /^[A-Za-z0-9_ ]+$/

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

const CustomerMaster = () => {
  const nameRef = useRef()

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

  const [customers, setCustomers] = useState([])
  const [customerGroups, setCustomerGroups] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  const [errors, setErrors] = useState({
    customerCode: '',
    customerName: '',
    customerDivision: '',
    mobileNumber: '',
    emailId: '',
    gstNo: '',
  })

  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deleteCustomer, setDeleteCustomer] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    loadCustomers()
    loadCustomerGroups()
  }, [])

  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        nameRef.current?.focus()
      }, 200)
    }
  }, [showForm])

  const clearError = (name) => {
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const loadCustomers = async () => {
    try {
      const res = await API.get('/CustomerMaster')
      setCustomers(res.data || [])
    } catch {
      toast.error('Failed to load customers')
    }
  }

  const loadCustomerGroups = async () => {
    try {
      const res = await API.get('/CustomerGroup')
      setCustomerGroups(res.data || [])
    } catch {
      toast.error('Failed to load customer groups')
    }
  }

  const customerDivisionOptions = customerGroups.map((g) => ({
    value: g.customerGroupType,
    label: g.customerGroupType,
  }))

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    clearError(name)
  }

  const validate = () => {
    const temp = {
      customerCode: '',
      customerName: '',
      customerDivision: '',
      mobileNumber: '',
      emailId: '',
      gstNo: '',
    }

    const customerCode = form.customerCode.trim()

    if (!customerCode) {
      temp.customerCode = 'Customer ID is required'
    } else if (
      customers.some(
        (c) =>
          c.customerCode?.trim().toLowerCase() === customerCode.toLowerCase() &&
          c.id !== editId,
      )
    ) {
      temp.customerCode = 'Customer ID already exists'
    }

    const customerName = form.customerName.trim()

    if (!customerName) {
      temp.customerName = 'Customer Name is required'
    } else if (!NAME_REGEX.test(customerName)) {
      temp.customerName = 'Only letters, numbers, underscore and spaces are allowed (e.g. Test_233)'
    } else if (
      customers.some(
        (c) =>
          c.customerName?.trim().toLowerCase() === customerName.toLowerCase() &&
          c.id !== editId,
      )
    ) {
      temp.customerName = 'Customer Name already exists'
    }

    if (!form.customerDivision.trim()) temp.customerDivision = 'Customer Division is required'

    const mobileNumber = form.mobileNumber.trim()
    if (!mobileNumber) {
      temp.mobileNumber = 'Customer Mobile Number is required'
    } else if (!MOBILE_REGEX.test(mobileNumber)) {
      temp.mobileNumber = 'Mobile Number must be exactly 10 digits'
    }

    const email = form.emailId.trim()
    if (!email) {
      temp.emailId = 'Customer Email ID is required'
    } else if (!EMAIL_REGEX.test(email)) {
      temp.emailId = 'Enter a valid email address'
    } else if (
      customers.some(
        (c) =>
          c.emailId?.trim().toLowerCase() === email.toLowerCase() &&
          c.id !== editId,
      )
    ) {
      temp.emailId = 'Email ID already exists'
    }

    const gstNo = form.gstNo.trim().toUpperCase()

    if (!gstNo) {
      temp.gstNo = 'GST No is required'
    } else if (!GST_REGEX.test(gstNo)) {
      temp.gstNo = 'Enter a valid 15-character GSTIN (e.g. 33ABCDE1234F1Z5)'
    } else if (
      customers.some(
        (c) =>
          c.gstNo?.trim().toUpperCase() === gstNo && c.id !== editId,
      )
    ) {
      temp.gstNo = 'GST No already exists'
    }

    setErrors(temp)

    return !Object.values(temp).some((x) => x)
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        customerCode: form.customerCode.trim(),
        customerName: form.customerName.trim(),
        customerDivision: form.customerDivision.trim(),
        mobileNumber: form.mobileNumber.trim(),
        emailId: form.emailId.trim(),
        gstNo: form.gstNo.trim().toUpperCase(),
      }

      if (editId) {
        await API.put(`/CustomerMaster/${editId}`, payload)
        toast.success('Customer Updated Successfully')
      } else {
        await API.post('/CustomerMaster', payload)
        toast.success('Customer Saved Successfully')
      }

      await loadCustomers()
      resetForm()
      setShowForm(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const handleEdit = async (row) => {
    try {
      const res = await API.get(`/CustomerMaster/${row.id}`)
      const d = res.data

      setEditId(row.id)
      setShowForm(true)

      setForm({
        customerCode: d.customerCode || '',
        customerName: d.customerName || '',
        customerDivision: d.customerDivision || '',
        mobileNumber: d.mobileNumber || '',
        emailId: d.emailId || '',
        gstNo: d.gstNo || '',
      })

      setErrors({
        customerCode: '',
        customerName: '',
        customerDivision: '',
        mobileNumber: '',
        emailId: '',
        gstNo: '',
      })
    } catch {
      toast.error('Failed to load customer')
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)

    setErrors({
      customerCode: '',
      customerName: '',
      customerDivision: '',
      mobileNumber: '',
      emailId: '',
      gstNo: '',
    })

    setEditId(null)

    setTimeout(() => {
      nameRef.current?.focus()
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
      await API.delete(`/CustomerMaster/${deleteId}`)
      toast.success('Deleted Successfully')
      resetForm()
      await loadCustomers()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeleteCustomer(null)
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      (c.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.customerCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.customerDivision || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.emailId || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.gstNo || '').toLowerCase().includes(search.toLowerCase()),
  )

  const columns = [
    { name: 'SL.NO', selector: (row, index) => index + 1, width: '80px' },
    { name: 'CUSTOMER ID', selector: (row) => row.customerCode },
    { name: 'CUSTOMER NAME', selector: (row) => row.customerName, wrap: true },
    { name: 'CUSTOMER DIVISION', selector: (row) => row.customerDivision, wrap: true },
    { name: 'MOBILE NUMBER', selector: (row) => row.mobileNumber },
    { name: 'EMAIL ADDRESS', selector: (row) => row.emailId, wrap: true },
    { name: 'GST NO.', selector: (row) => row.gstNo },
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
              setDeleteCustomer(row)
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
    <div className="customer-master-page">
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">Total Customer</div>
              <div className="summary-value">{String(customers.length).padStart(2, '0')}</div>
            </div>

            <button className="round-icon-btn add-item-btn" title="Add Customer" onClick={handleAddNew}>
              <FaPlus size={16} />
            </button>
          </CCardBody>
        </CCard>
      )}

      {showForm && (
        <CCard className="customer-master-form-card mb-3">
          <CCardBody className="customer-master-form-card-body">
            <button className="round-icon-btn back-btn card-back-btn" title="Back" onClick={handleBack}>
              <FaArrowLeft size={14} />
            </button>

            <div className="section-title">Basic Information</div>

            <CRow className="g-3">
              <CCol md={4}>
                <label className="custom-label">
                  <strong>Customer ID</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="customerCode"
                  placeholder="Enter Customer ID"
                  value={form.customerCode}
                  className={errors.customerCode ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.customerCode && <small className="text-danger">{errors.customerCode}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Customer Name</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  ref={nameRef}
                  name="customerName"
                  placeholder="Enter Customer Name (e.g. Test_233)"
                  value={form.customerName}
                  className={errors.customerName ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({
                      target: { name: 'customerName', value: e.target.value.replace(/[^A-Za-z0-9_ ]/g, '') },
                    })
                  }
                />
                {errors.customerName && <small className="text-danger">{errors.customerName}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Customer Mobile Number</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="mobileNumber"
                  placeholder="Enter Customer Mobile Number"
                  value={form.mobileNumber}
                  maxLength={10}
                  className={errors.mobileNumber ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({ target: { name: 'mobileNumber', value: e.target.value.replace(/[^0-9]/g, '') } })
                  }
                />
                {errors.mobileNumber && <small className="text-danger">{errors.mobileNumber}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Customer Division</strong> <span className="required">*</span>
                </label>
                <div className={errors.customerDivision ? 'react-select-error' : ''}>
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Customer Division"
                    options={customerDivisionOptions}
                    value={customerDivisionOptions.find((x) => x.value === form.customerDivision) || null}
                    onChange={(selected) => {
                      setForm({ ...form, customerDivision: selected?.value || '' })
                      clearError('customerDivision')
                    }}
                    isClearable
                  />
                </div>
                {errors.customerDivision && <small className="text-danger">{errors.customerDivision}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Customer Email ID</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  type="email"
                  name="emailId"
                  placeholder="Enter Email ID"
                  value={form.emailId}
                  className={errors.emailId ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.emailId && <small className="text-danger">{errors.emailId}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>GST No.</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="gstNo"
                  placeholder="Enter GSTIN (e.g. 33ABCDE1234F1Z5)"
                  value={form.gstNo}
                  className={errors.gstNo ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({ target: { name: 'gstNo', value: e.target.value.toUpperCase() } })
                  }
                  maxLength={15}
                />
                {errors.gstNo && <small className="text-danger">{errors.gstNo}</small>}
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
            <div className="table-title">Customer List</div>

            <CFormInput
              placeholder="Search..."
              className="search-box"
              style={{ width: '320px' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredCustomers}
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
          <p>Are you sure you want to delete this Customer?</p>

          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
            <div>
              <strong>Customer ID :</strong>{' '}
              <span className="text-primary fw-bold">{deleteCustomer?.customerCode}</span>
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

export default CustomerMaster
