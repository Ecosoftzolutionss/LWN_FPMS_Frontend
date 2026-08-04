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
  CFormCheck,
} from '@coreui/react'
import { FaEdit, FaTrash, FaSave } from 'react-icons/fa'
import { toast } from 'react-toastify'
import API from '../../api.js'
import usePrivilege from '../hooks/usePrivilege.js'

const CustomerMaster = () => {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [deleteCustomer, setDeleteCustomer] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const customerRef = useRef()

  const [form, setForm] = useState({
    customerCode: '',
    customerName: '',
    gstNumber: '',
    address: '',
    barcodeType: '',
    isInvoice: true,
    isBox: false,
    isPart: false,
  })

  const [errors, setErrors] = useState({
    customerCode: '',
    customerName: '',
    gstNumber: '',
    address: '',
    barcodeType: '',
    options: '',
  })

  const { privileges: userPrivileges = [] } = usePrivilege()
  const uPrivilege =
    userPrivileges.find((p) => p.menuName === 'Customer Master') || {}

  useEffect(() => {
    loadCustomers()
    setTimeout(() => customerRef.current?.focus(), 200)
  }, [])

  const loadCustomers = async () => {
    try {
      const res = await API.get('/customer')
      setCustomers(res.data)
    } catch {
      toast.error('Failed to load customers')
    }
  }

  const clearError = (name) => {
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target

    setForm({
      ...form,
      [name]: type === 'checkbox' ? checked : value,
    })

    if (name === 'isBox' || name === 'isPart') {
      setErrors((prev) => ({
        ...prev,
        options: '',
      }))
    } else {
      clearError(name)
    }
  }

  const capitalizeFirstLetter = (value) => {
    if (!value) return ''
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  const validate = () => {
    const newErrors = {
      customerCode: '',
      customerName: '',
      gstNumber: '',
      address: '',
      barcodeType: '',
      options: '',
    }

    const customerCode = form.customerCode.trim()
    const customerName = form.customerName.trim()
    const gstNumber = form.gstNumber.trim().toUpperCase()
    const address = form.address.trim()
    const barcodeType = form.barcodeType.trim()

    if (!customerCode) {
      newErrors.customerCode = 'Customer ID is required'
    } else if (!/^[A-Za-z0-9-]+$/.test(customerCode)) {
      newErrors.customerCode =
        'Customer ID allows only letters, numbers and hyphen'
    } else {
      const duplicateCustomerCode = customers.some(
        (c) =>
          c.customerCode?.trim().toLowerCase() ===
          customerCode.toLowerCase() && c.customerId !== editId,
      )

      if (duplicateCustomerCode) {
        newErrors.customerCode = 'Customer ID already exists'
      }
    }

    if (!customerName) {
      newErrors.customerName = 'Customer Name is required'
    } else if (!/^[A-Za-z0-9\s&.,\-\/()]+$/.test(customerName)) {
  newErrors.customerName =
    'Customer Name contains invalid characters'
    } else {
      const duplicateCustomerName = customers.some(
        (c) =>
          c.customerName?.trim().toLowerCase() ===
          customerName.toLowerCase() && c.customerId !== editId,
      )

      if (duplicateCustomerName) {
        newErrors.customerName = 'Customer Name already exists'
      }
    }

    if (!gstNumber) {
      newErrors.gstNumber = 'GST Number is required'
    } else if (
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
        gstNumber,
      )
    ) {
      newErrors.gstNumber = 'Enter valid GST Number'
    } 

    if (!address) {
      newErrors.address = 'Address is required'
    } else if (address.length < 3) {
      newErrors.address = 'Address must be at least 3 characters'
    }

    if (!barcodeType) {
      newErrors.barcodeType = 'Barcode Type is required'
    }

    if (!form.isBox && !form.isPart) {
      newErrors.options = 'Please select Box or Part'
    }

    setErrors(newErrors)

    return !Object.values(newErrors).some((x) => x)
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const payload = {
      customerCode: form.customerCode.trim(),
      customerName: form.customerName.trim(),
      gstNumber: form.gstNumber.trim().toUpperCase(),
      address: form.address.trim(),
      barcodeType: form.barcodeType,
      isInvoice: true,
      isBox: form.isBox,
      isPart: form.isPart,
      createdBy: 0,
      modifiedBy: 0,
    }

    try {
      if (editId && Number(editId) > 0) {
        await API.put(`/customer/${editId}`, payload)
        toast.success('Customer Updated Successfully')
      } else {
        await API.post('/customer', payload)
        toast.success('Customer Saved Successfully')
      }

      resetForm()
      await loadCustomers()
    } catch (err) {
      toast.error(err?.response?.data || 'Save Failed')
    }
  }

  const handleEdit = (row) => {
    setEditId(row.customerId)

    setForm({
      customerCode: row.customerCode || '',
      customerName: capitalizeFirstLetter(row.customerName || ''),
      gstNumber: row.gstNumber || '',
      address: row.address || '',
      barcodeType: row.barcodeType || '', // was missing — value was silently lost on every edit
      isInvoice: row.isInvoice ?? true,
      isBox: row.isBox ?? false,
      isPart: row.isPart ?? false,
    })

    setErrors({
      customerCode: '',
      customerName: '',
      gstNumber: '',
      address: '',
      barcodeType: '',
      options: '',
    })

    setTimeout(() => customerRef.current?.focus(), 100)
  }

  const resetForm = () => {
    setEditId(null)
    setDeleteId(null)
    setDeleteCustomer(null)

    setForm({
      customerCode: '',
      customerName: '',
      gstNumber: '',
      address: '',
      barcodeType: '',
      isInvoice: true,
      isBox: false,
      isPart: false,
    })

    setErrors({
      customerCode: '',
      customerName: '',
      gstNumber: '',
      address: '',
      barcodeType: '',
      options: '',
    })

    setTimeout(() => customerRef.current?.focus(), 100)
  }

  const confirmDelete = async () => {
    try {
      await API.delete(`/customer/${deleteId}`)

      toast.success('Customer Deleted Successfully')

      setCustomers((prev) => prev.filter((x) => x.customerId !== deleteId))
    } catch (err) {
      toast.error(err?.response?.data || 'Delete Failed')
    } finally {
      resetForm()
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeleteCustomer(null)
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      (c.customerCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.gstNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.barcodeType || '').toLowerCase().includes(search.toLowerCase()),
  )

  const customStyles = {
    rows: { style: { minHeight: '55px' } },
    headCells: {
      style: { justifyContent: 'center', fontSize: '14px', fontWeight: '700' },
    },
    cells: { style: { justifyContent: 'center', fontSize: '14px' } },
  }

  const columns = [
    {
      name: 'S.NO',
      selector: (row, index) => index + 1,
      width: '70px',
    },
    {
      name: 'CUSTOMER ID',
      selector: (row) => row.customerCode,
    },
    {
      name: 'CUSTOMER NAME',
      selector: (row) => row.customerName,
    },
    {
      name: 'GST NO',
      selector: (row) => row.gstNumber,
    },
    {
      name: 'ADDRESS',
      selector: (row) => row.address,
      wrap: true,
    },
    {
      name: 'BARCODE TYPE',
      selector: (row) => row.barcodeType,
      width: '180px',
    },
    {
      name: 'ACTIONS',
      center: true,
      cell: (row) => (
        <div className="action-wrapper">
          {uPrivilege?.canEdit && (
            <button
              className="table-action-btn edit-btn"
              onClick={() => handleEdit(row)}
            >
              <FaEdit />
            </button>
          )}

          {uPrivilege?.canDelete && (
            <button
              className="table-action-btn delete-btn"
              onClick={() => {
                setDeleteId(row.customerId)
                setDeleteCustomer(row)
                setShowDeleteModal(true)
              }}
            >
              <FaTrash />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="user-master-page">
      <CCard className="user-form-card">
        <CCardBody>
          <div className="section-title">CUSTOMER DETAILS</div>

          <CRow className="g-3">
            <CCol md={3}>
              <label className="custom-label">
                Customer ID <span className="required">*</span>
              </label>

              <CFormInput
                ref={customerRef}
                name="customerCode"
                placeholder="CUST001"
                value={form.customerCode}
                className={errors.customerCode ? 'error-input' : ''}
                onChange={(e) => {
                  setForm({
                    ...form,
                    customerCode: e.target.value.toUpperCase(),
                  })
                  clearError('customerCode')
                }}
              />

              {errors.customerCode && (
                <div className="field-error">{errors.customerCode}</div>
              )}
            </CCol>

            <CCol md={3}>
              <label className="custom-label">
                Customer Name <span className="required">*</span>
              </label>

              <CFormInput
                name="customerName"
                placeholder="Enter Customer Name"
                value={form.customerName}
                className={errors.customerName ? 'error-input' : ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^A-Za-z0-9\s&.,\-\/()]/g, '')

                  setForm({
                    ...form,
                    customerName: capitalizeFirstLetter(value),
                  })

                  clearError('customerName')
                }}
              />

              {errors.customerName && (
                <div className="field-error">{errors.customerName}</div>
              )}
            </CCol>

            <CCol md={3}>
              <label className="custom-label">
                GST Number <span className="required">*</span>
              </label>

              <CFormInput
                name="gstNumber"
                placeholder="Enter GST Number"
                value={form.gstNumber}
                maxLength={15}
                className={errors.gstNumber ? 'error-input' : ''}
                onChange={(e) => {
                  setForm({
                    ...form,
                    gstNumber: e.target.value.toUpperCase(),
                  })
                  clearError('gstNumber')
                }}
              />

              {errors.gstNumber && (
                <div className="field-error">{errors.gstNumber}</div>
              )}
            </CCol>

            <CCol md={3}>
              <label className="custom-label">
                Address <span className="required">*</span>
              </label>

              <CFormInput
                name="address"
                placeholder="Enter Address"
                value={form.address}
                className={errors.address ? 'error-input' : ''}
                onChange={handleChange}
              />

              {errors.address && (
                <div className="field-error">{errors.address}</div>
              )}
            </CCol>

            <CCol md={3}>
              <label className="custom-label">
                Barcode Type <span className="required">*</span>
              </label>

              <select
                className={`form-select${errors.barcodeType ? ' error-input' : ''}`}
                name="barcodeType"
                value={form.barcodeType}
                onChange={handleChange}
              >
                <option value="">Select</option>
                <option value="TYPE1">TYPE1</option>
                <option value="TYPE2">TYPE2</option>
              </select>

              {errors.barcodeType && (
                <div className="field-error">{errors.barcodeType}</div>
              )}
            </CCol>
          </CRow>

          <CRow className="mt-3">
            <CCol md={12}>
              <div className="checkbox-group">
                <CFormCheck
                  className="invoice-check"
                  label="Invoice"
                  checked={true}
                  disabled
                  readOnly
                />

                <CFormCheck
                  label="Box"
                  name="isBox"
                  checked={form.isBox}
                  onChange={handleChange}
                />

                <CFormCheck
                  label="Part"
                  name="isPart"
                  checked={form.isPart}
                  onChange={handleChange}
                />
              </div>

              {errors.options && (
                <div className="field-error mt-2">{errors.options}</div>
              )}

              <div className="form-button-area">
                <CButton
                  className={editId ? 'update-btn' : 'save-btn'}
                  onClick={handleSubmit}
                >
                  <FaSave className="me-2" />
                  {editId ? 'UPDATE' : 'SAVE'}
                </CButton>

                <CButton className="clear-btn" onClick={resetForm}>
                  CANCEL
                </CButton>
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      <CCard className="mt-3 table-card">
        <CCardBody>
          <div className="table-header">
            <div className="table-title">CUSTOMER LIST</div>

            <CFormInput
              placeholder="Search..."
              className="search-box"
              value={search}
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

      <CModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        alignment="center"
        backdrop="static"
      >
        <CModalHeader className="border-0">
          <CModalTitle className="w-100 text-center text-danger fw-bold">
            ⚠ Confirm Delete
          </CModalTitle>
        </CModalHeader>

        <CModalBody className="text-center">
          <p>Are you sure you want to delete this Customer?</p>

          <div
            style={{
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '10px',
            }}
          >
            <strong>Customer ID :</strong>{' '}
            <span className="text-primary fw-bold">
              {deleteCustomer?.customerCode}
            </span>
          </div>
        </CModalBody>

        <CModalFooter className="border-0 d-flex justify-content-center">
          <CButton color="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </CButton>

          <CButton color="danger" onClick={confirmDelete}>
            Delete
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default CustomerMaster