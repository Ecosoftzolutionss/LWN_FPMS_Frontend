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
import { INDIAN_STATES } from '../../assets/data/indianStates.js'
import '../../assets/CSS/supplierMaster.css'
import usePrivilege from '../hooks/usePrivilege.js'

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s.name, label: s.name, code: s.code }))

const CONTACT_REGEX = /^[0-9]{10}$/
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PINCODE_REGEX = /^[0-9]{6}$/

const EMPTY_ADDRESS = {
  companyName: '',
  addressLine1: '',
  addressLine2: '',
  state: '',
  stateCode: '',
  pinCode: '',
}

const EMPTY_FORM = {
  supplierCode: '',
  supplierName: '',
  vendorCode: '',
  supplierGroupId: '',
  email: '',
  contactNumber: '',
  personToContact: '',
  gstNo: '',
  panNo: '',
  billing: { ...EMPTY_ADDRESS },
  shipping: { ...EMPTY_ADDRESS },
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

const SupplierMaster = () => {
  const supplierIdRef = useRef()

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

  const [suppliers, setSuppliers] = useState([])
  const [supplierGroups, setSupplierGroups] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [sameAsBilling, setSameAsBilling] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  const [errors, setErrors] = useState({})

  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deleteSupplier, setDeleteSupplier] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const { privileges: userPrivileges = [] } = usePrivilege()
  const uPrivilege = userPrivileges.find((p) => p.menuName === 'Supplier Master') || {}

  useEffect(() => {
    loadSuppliers()
    loadSupplierGroups()
  }, [])

 useEffect(() => {
  if (showForm) {
    setTimeout(() => {
      supplierIdRef.current?.focus()
    }, 200)
  }
}, [showForm])
  // Keep shipping address mirrored to billing while the checkbox is on.
  useEffect(() => {
    if (sameAsBilling) {
      setForm((prev) => ({ ...prev, shipping: { ...prev.billing } }))
    }
  }, [sameAsBilling, form.billing])

  const clearError = (name) => {
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const loadSuppliers = async () => {
    try {
      const res = await API.get('/SupplierMaster')
      setSuppliers(res.data || [])
    } catch {
      toast.error('Failed to load suppliers')
    }
  }

  const loadSupplierGroups = async () => {
    try {
      const res = await API.get('/SupplierGroup')
      setSupplierGroups(res.data || [])
    } catch {
      toast.error('Failed to load supplier groups')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    clearError(name)
  }

  // Supplier Name -> Billing ("From") Company Name only. Shipping
  // ("To") Company Name is NOT touched — stays fully manual.
  const handleSupplierNameChange = (e) => {
    const value = e.target.value

    setForm((prev) => ({
      ...prev,
      supplierName: value,
      billing: { ...prev.billing, companyName: value },
    }))

    clearError('supplierName')
    clearError('billing.companyName')
  }

  const handleAddressChange = (section, field, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }))
    clearError(`${section}.${field}`)
  }

  const handleStateChange = (section, selected) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        state: selected?.value || '',
        stateCode: selected?.code || '',
      },
    }))
    clearError(`${section}.state`)
  }

  const validateAddress = (section, temp) => {
    const addr = form[section]
    if (!addr.companyName.trim()) temp[`${section}.companyName`] = 'Company Name is required'
    if (!addr.addressLine1.trim()) temp[`${section}.addressLine1`] = 'Address Line 1 is required'
    if (!addr.state) temp[`${section}.state`] = 'State is required'
    if (!addr.stateCode.trim()) temp[`${section}.stateCode`] = 'State Code is required'

    const pinCode = addr.pinCode.trim()
    if (!pinCode) {
      temp[`${section}.pinCode`] = 'Pin Code is required'
    } else if (!PINCODE_REGEX.test(pinCode)) {
      temp[`${section}.pinCode`] = 'Pin Code must be exactly 6 digits'
    }
  }

  const validate = () => {
    const temp = {}

    const supplierCode = form.supplierCode.trim()

    if (!supplierCode) {
      temp.supplierCode = 'Supplier ID is required'
    } else if (
      suppliers.some(
        (s) =>
          s.supplierCode?.trim().toLowerCase() === supplierCode.toLowerCase() &&
          s.id !== editId,
      )
    ) {
      temp.supplierCode = 'Supplier ID already exists'
    }

    const supplierName = form.supplierName.trim()

    if (!supplierName) {
      temp.supplierName = 'Supplier Name is required'
    } else if (
      suppliers.some(
        (s) =>
          s.supplierName?.trim().toLowerCase() === supplierName.toLowerCase() &&
          s.id !== editId,
      )
    ) {
      temp.supplierName = 'Supplier Name already exists'
    }

    if (!form.vendorCode.trim()) temp.vendorCode = 'Vendor Code is required'
    if (!form.supplierGroupId) temp.supplierGroupId = 'Supplier Group is required'
    if (!form.email.trim()) {
      temp.email = 'Email is required'
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      temp.email = 'Enter a valid email address'
    }

    if (!form.contactNumber.trim()) {
      temp.contactNumber = 'Contact Number is required'
    } else if (!CONTACT_REGEX.test(form.contactNumber.trim())) {
      temp.contactNumber = 'Contact Number must be exactly 10 digits'
    }

    if (!form.personToContact.trim()) temp.personToContact = 'Person to Contact is required'

    const gstNo = form.gstNo.trim().toUpperCase()
    if (!gstNo) {
      temp.gstNo = 'GST No is required'
    } else if (!GST_REGEX.test(gstNo)) {
      temp.gstNo = 'Enter a valid 15-character GSTIN (e.g. 33ABCDE1234F1Z5)'
    } else if (
      suppliers.some((s) => s.gstNo?.trim().toUpperCase() === gstNo && s.id !== editId)
    ) {
      temp.gstNo = 'GST No already exists'
    }

    const panNo = form.panNo.trim().toUpperCase()
    if (!panNo) {
      temp.panNo = 'PAN No is required'
    } else if (!PAN_REGEX.test(panNo)) {
      temp.panNo = 'Enter a valid 10-character PAN (e.g. ABCDE1234F)'
    }

    validateAddress('billing', temp)
    if (!sameAsBilling) validateAddress('shipping', temp)

    setErrors(temp)

    return Object.keys(temp).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const shipping = sameAsBilling ? form.billing : form.shipping

      const payload = {
        supplierCode: form.supplierCode.trim(),
        supplierName: form.supplierName.trim(),
        vendorCode: form.vendorCode.trim(),
        supplierGroupId: Number(form.supplierGroupId),
        email: form.email.trim(),
        contactNumber: form.contactNumber.trim(),
        personToContact: form.personToContact.trim(),
        gstNo: form.gstNo.trim().toUpperCase(),
        panNo: form.panNo.trim().toUpperCase(),
        billingCompanyName: form.billing.companyName.trim(),
        billingAddressLine1: form.billing.addressLine1.trim(),
        billingAddressLine2: form.billing.addressLine2.trim(),
        billingState: form.billing.state,
        billingStateCode: form.billing.stateCode,
        billingPinCode: form.billing.pinCode.trim(),
        shippingCompanyName: shipping.companyName.trim(),
        shippingAddressLine1: shipping.addressLine1.trim(),
        shippingAddressLine2: shipping.addressLine2.trim(),
        shippingState: shipping.state,
        shippingStateCode: shipping.stateCode,
        shippingPinCode: shipping.pinCode.trim(),
      }

      if (editId) {
        await API.put(`/SupplierMaster/${editId}`, payload)
        toast.success('Supplier Updated Successfully')
      } else {
        await API.post('/SupplierMaster', payload)
        toast.success('Supplier Saved Successfully')
      }

      await loadSuppliers()
      resetForm()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const handleEdit = async (row) => {
    try {
      const res = await API.get(`/SupplierMaster/${row.id}`)
      const d = res.data

      setEditId(row.id)
      setShowForm(true)

      const billing = {
        companyName: d.billingCompanyName || '',
        addressLine1: d.billingAddressLine1 || '',
        addressLine2: d.billingAddressLine2 || '',
        state: d.billingState || '',
        stateCode: d.billingStateCode || '',
        pinCode: d.billingPinCode || '',
      }

      const shipping = {
        companyName: d.shippingCompanyName || '',
        addressLine1: d.shippingAddressLine1 || '',
        addressLine2: d.shippingAddressLine2 || '',
        state: d.shippingState || '',
        stateCode: d.shippingStateCode || '',
        pinCode: d.shippingPinCode || '',
      }

      setForm({
        supplierCode: d.supplierCode || '',
        supplierName: d.supplierName || '',
        vendorCode: d.vendorCode || '',
        supplierGroupId: d.supplierGroupId || '',
        email: d.email || '',
        contactNumber: d.contactNumber || '',
        personToContact: d.personToContact || '',
        gstNo: d.gstNo || '',
        panNo: d.panNo || '',
        billing,
        shipping,
      })

      setSameAsBilling(JSON.stringify(billing) === JSON.stringify(shipping))
      setErrors({})
    } catch {
      toast.error('Failed to load supplier')
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setSameAsBilling(false)
    setErrors({})
    setEditId(null)

   setTimeout(() => {
  supplierIdRef.current?.focus()
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
      await API.delete(`/SupplierMaster/${deleteId}`)
      toast.success('Deleted Successfully')
      resetForm()
      await loadSuppliers()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeleteSupplier(null)
    }
  }

  const filteredSuppliers = suppliers.filter(
    (s) =>
      (s.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.supplierCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.vendorCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.gstNo || '').toLowerCase().includes(search.toLowerCase()),
  )

  const supplierGroupOptions = supplierGroups.map((g) => ({ value: g.id, label: g.supplierGroupType }))

  // Wraps a cell's value in a CoreUI tooltip so the full text shows
  // on hover — useful since most columns below have a fixed width
  // and can visually truncate/wrap longer values.
  const TooltipCell = ({ value }) => {
    if (!value) return <span>—</span>
    return (
      <CTooltip content={value} placement="top">
        <span className="supplier-table-cell-text">{value}</span>
      </CTooltip>
    )
  }

  const columns = [
    { name: 'SL.NO', selector: (row, index) => index + 1, width: '90px' },
    {
      name: 'SUPPLIER ID',
      selector: (row) => row.supplierCode,
      width: '130px',
      cell: (row) => <TooltipCell value={row.supplierCode} />,
    },
    {
      name: 'SUPPLIER NAME',
      selector: (row) => row.supplierName,
      width: '150px',
      wrap: true,
      cell: (row) => <TooltipCell value={row.supplierName} />,
    },
    {
      name: 'VENDOR CODE',
      selector: (row) => row.vendorCode,
      width: '140px',
      cell: (row) => <TooltipCell value={row.vendorCode} />,
    },
    {
      name: 'CONTACT PERSON',
      selector: (row) => row.personToContact,
      width: '170px',
      wrap: true,
      cell: (row) => <TooltipCell value={row.personToContact} />,
    },
    {
      name: 'CONTACT NUMBER',
      selector: (row) => row.contactNumber,
      width: '170px',
      cell: (row) => <TooltipCell value={row.contactNumber} />,
    },
    {
      name: 'GST NO.',
      selector: (row) => row.gstNo,
      width: '120px',
      cell: (row) => <TooltipCell value={row.gstNo} />,
    },
    {
      name: 'STATE',
      selector: (row) => row.billingState,
      width: '120px',
      cell: (row) => <TooltipCell value={row.billingState} />,
    },
    {
      name: 'ACTION',
      center: true,
      cell: (row) => (
        <div className="action-wrapper">
          {uPrivilege?.canEdit && (
            <button className="table-action-btn edit-btn" title="Edit" onClick={() => handleEdit(row)}>
              <FaEdit />
            </button>
          )}
          {uPrivilege?.canDelete && (
            <button
              className="table-action-btn delete-btn"
              title="Delete"
              onClick={() => {
                setDeleteId(row.id)
                setDeleteSupplier(row)
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

  const renderAddressBlock = (section, title, disabled) => (
    <div className={`address-block ${disabled ? 'address-block-disabled' : ''}`}>
      <div className="address-block-header">
        <div className="section-title address-title">{title}</div>

        {section === 'shipping' && (
          <label className="same-as-checkbox">
            <input
              type="checkbox"
              checked={sameAsBilling}
              onChange={(e) => setSameAsBilling(e.target.checked)}
            />
            Same as Billing Address
          </label>
        )}
      </div>

      <CRow className="g-3">
        <CCol md={12}>
          <label className="custom-label">
            <strong>Company Name</strong> <span className="required">*</span>
          </label>
          <CFormInput
            placeholder="Enter Company Name"
            value={form[section].companyName}
            disabled={disabled}
            className={errors[`${section}.companyName`] ? 'error-input' : ''}
            onChange={(e) => handleAddressChange(section, 'companyName', e.target.value)}
          />
          {errors[`${section}.companyName`] && (
            <small className="text-danger">{errors[`${section}.companyName`]}</small>
          )}
        </CCol>

        <CCol md={12}>
          <label className="custom-label">
            <strong>Address Line 1</strong> <span className="required">*</span>
          </label>
          <CFormInput
            placeholder="Enter Address Line 1"
            value={form[section].addressLine1}
            disabled={disabled}
            className={errors[`${section}.addressLine1`] ? 'error-input' : ''}
            onChange={(e) => handleAddressChange(section, 'addressLine1', e.target.value)}
          />
          {errors[`${section}.addressLine1`] && (
            <small className="text-danger">{errors[`${section}.addressLine1`]}</small>
          )}
        </CCol>

        <CCol md={12}>
          <label className="custom-label"><strong>Address Line 2</strong></label>
          <CFormInput
            placeholder="Enter Address Line 2"
            value={form[section].addressLine2}
            disabled={disabled}
            onChange={(e) => handleAddressChange(section, 'addressLine2', e.target.value)}
          />
        </CCol>

        <CCol md={5}>
          <label className="custom-label">
            <strong>State</strong> <span className="required">*</span>
          </label>
          <div className={errors[`${section}.state`] ? 'react-select-error' : ''}>
            <Select
              classNamePrefix="react-select"
              placeholder="Select State"
              isDisabled={disabled}
              options={STATE_OPTIONS}
              value={STATE_OPTIONS.find((x) => x.value === form[section].state) || null}
              onChange={(selected) => handleStateChange(section, selected)}
              isClearable
            />
          </div>
          {errors[`${section}.state`] && (
            <small className="text-danger">{errors[`${section}.state`]}</small>
          )}
        </CCol>

        <CCol md={3}>
          <label className="custom-label">
            <strong>State Code</strong> <span className="required">*</span>
          </label>
          <CFormInput value={form[section].stateCode} placeholder="State Code" disabled />
        </CCol>

        <CCol md={4}>
          <label className="custom-label">
            <strong>Pin Code</strong> <span className="required">*</span>
          </label>
          <CFormInput
            placeholder="Enter Pin Code"
            value={form[section].pinCode}
            disabled={disabled}
            maxLength={6}
            className={errors[`${section}.pinCode`] ? 'error-input' : ''}
            onChange={(e) => handleAddressChange(section, 'pinCode', e.target.value.replace(/[^0-9]/g, ''))}
          />
          {errors[`${section}.pinCode`] && (
            <small className="text-danger">{errors[`${section}.pinCode`]}</small>
          )}
        </CCol>
      </CRow>
    </div>
  )

  return (
    <div className="supplier-master-page">
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">Total Supplier</div>
              <div className="summary-value">{String(suppliers.length).padStart(2, '0')}</div>
            </div>

            <button className="round-icon-btn add-item-btn" title="Add Supplier" onClick={handleAddNew}>
              <FaPlus size={16} />
            </button>
          </CCardBody>
        </CCard>
      )}

      {showForm && (
        <CCard className="supplier-master-form-card mb-3">
          <CCardBody className="supplier-master-form-card-body">
            <button className="round-icon-btn back-btn card-back-btn" title="Back" onClick={handleBack}>
              <FaArrowLeft size={14} />
            </button>

            <div className="section-title">Basic Information</div>

            <CRow className="g-3">
              <CCol md={4}>
                <label className="custom-label"><strong>Supplier ID</strong> <span className="required">*</span></label>
                <CFormInput
                  name="supplierCode"
                    ref={supplierIdRef}
                  placeholder="Enter Supplier ID"
                  value={form.supplierCode}
                  className={errors.supplierCode ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({ target: { name: 'supplierCode', value: e.target.value.toUpperCase() } })
                  }
                />
                {errors.supplierCode && <small className="text-danger">{errors.supplierCode}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Supplier Name</strong> <span className="required">*</span>
                </label>
                <CFormInput
      
                  name="supplierName"
                  placeholder="Enter Supplier Name"
                  value={form.supplierName}
                  className={errors.supplierName ? 'error-input' : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^a-zA-Z\s]/g, '')

                    handleSupplierNameChange({
                      target: {
                        value,
                      },
                    })
                  }}
                />
                {errors.supplierName && <small className="text-danger">{errors.supplierName}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Vendor Code</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="vendorCode"
                  placeholder="Enter Vendor Code"
                  value={form.vendorCode}
                  className={errors.vendorCode ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({
                      target: {
                        name: 'vendorCode',
                        value: e.target.value.replace(/[^a-zA-Z0-9]/g, ''),
                      },
                    })
                  }
                />
                {errors.vendorCode && <small className="text-danger">{errors.vendorCode}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Supplier Group</strong> <span className="required">*</span>
                </label>
                <div className={errors.supplierGroupId ? 'react-select-error' : ''}>
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Supplier Group"
                    options={supplierGroupOptions}
                    value={supplierGroupOptions.find((x) => String(x.value) === String(form.supplierGroupId)) || null}
                    onChange={(selected) => {
                      setForm({ ...form, supplierGroupId: selected?.value || '' })
                      clearError('supplierGroupId')
                    }}
                    isClearable
                  />
                </div>
                {errors.supplierGroupId && <small className="text-danger">{errors.supplierGroupId}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Email</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  type="email"
                  name="email"
                  placeholder="Enter Email Address"
                  value={form.email}
                  maxLength={100}
                  className={errors.email ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.email && <small className="text-danger">{errors.email}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Contact Number</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="contactNumber"
                  placeholder="Enter Contact Number"
                  value={form.contactNumber}
                  maxLength={10}
                  className={errors.contactNumber ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({ target: { name: 'contactNumber', value: e.target.value.replace(/[^0-9]/g, '') } })
                  }
                />
                {errors.contactNumber && <small className="text-danger">{errors.contactNumber}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Person to Contact</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="personToContact"
                  placeholder="Enter Person to Contact"
                  value={form.personToContact}
                  maxLength={100}
                  className={errors.personToContact ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.personToContact && <small className="text-danger">{errors.personToContact}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>GST No.</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="gstNo"
                  placeholder="Enter GST Number"
                  value={form.gstNo}
                  maxLength={15}
                  className={errors.gstNo ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({ target: { name: 'gstNo', value: e.target.value.toUpperCase() } })
                  }
                />
                {errors.gstNo && <small className="text-danger">{errors.gstNo}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>PAN No.</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="panNo"
                  placeholder="Enter PAN Number"
                  value={form.panNo}
                  maxLength={10}
                  className={errors.panNo ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({ target: { name: 'panNo', value: e.target.value.toUpperCase() } })
                  }
                />
                {errors.panNo && <small className="text-danger">{errors.panNo}</small>}
              </CCol>
            </CRow>

            <CRow className="g-3 mt-1">
              <CCol md={6}>
                {renderAddressBlock('billing', 'From', false)}
              </CCol>

              <CCol md={6}>
                {renderAddressBlock('shipping', 'To', sameAsBilling)}
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
            <div className="table-title">Supplier List</div>

            <CFormInput
              placeholder="Search..."
              className="search-box"
              style={{ width: '320px' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredSuppliers}
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
          <p>Are you sure you want to delete this Supplier?</p>

          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
            <div>
              <strong>Supplier ID :</strong>{' '}
              <span className="text-primary fw-bold">{deleteSupplier?.supplierCode}</span>
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

export default SupplierMaster
