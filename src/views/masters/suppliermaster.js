import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import '../../assets/CSS/supplierMaster.css'
import usePrivilege from '../hooks/usePrivilege.js'

const CONTACT_REGEX = /^[0-9]{10}$/
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SUPPLIER_ID_REGEX = /^[A-Z0-9-]+$/

const EMPTY_FORM = {
  supplierCode: '',
  supplierName: '',
  supplierGroupId: '',
  email: '',
  contactNumber: '',
  personToContact: '',
  gstNo: '',
  panNo: '',
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
  const supplierIdRef = useRef(null)

  const [suppliers, setSuppliers] = useState([])
  const [supplierGroups, setSupplierGroups] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [errors, setErrors] = useState({})
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deleteSupplier, setDeleteSupplier] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const { privileges: userPrivileges = [] } = usePrivilege()
  const uPrivilege =
    userPrivileges.find((p) => p.menuName === 'Supplier Master') || {}

  const selectedGroup = useMemo(
    () =>
      supplierGroups.find(
        (g) => String(g.id) === String(form.supplierGroupId),
      ) || null,
    [supplierGroups, form.supplierGroupId],
  )

  const requiresGst = selectedGroup?.requiresGst === true
  const requiresPan = selectedGroup?.requiresPan === true

  const supplierGroupOptions = useMemo(
    () =>
      supplierGroups
        .filter((g) => g.isActive !== false)
        .map((g) => ({
          value: g.id,
          label: g.description
            ? `${g.supplierGroupType} - ${g.description}`
            : g.supplierGroupType,
          type: g.supplierGroupType,
          description: g.description,
          requiresGst: g.requiresGst === true,
          requiresPan: g.requiresPan === true,
        })),
    [supplierGroups],
  )

  useEffect(() => {
    loadSuppliers()
    loadSupplierGroups()
  }, [])

  useEffect(() => {
    if (showForm) {
      const timer = setTimeout(() => supplierIdRef.current?.focus(), 200)
      return () => clearTimeout(timer)
    }
  }, [showForm])

  // When changing the group, remove tax values that are no longer applicable.
  useEffect(() => {
    if (!selectedGroup) return

    setForm((prev) => ({
      ...prev,
      gstNo: selectedGroup.requiresGst ? prev.gstNo : '',
      panNo: selectedGroup.requiresPan ? prev.panNo : '',
    }))

    setErrors((prev) => ({
      ...prev,
      gstNo: '',
      panNo: '',
    }))
  }, [form.supplierGroupId]) // intentionally runs only when group changes

  const clearError = (name) => {
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const loadSuppliers = async () => {
    try {
      const res = await API.get('/SupplierMaster')
      setSuppliers(res.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load suppliers'))
    }
  }

  const loadSupplierGroups = async () => {
    try {
      const res = await API.get('/SupplierGroup')
      setSupplierGroups(res.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load supplier groups'))
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    clearError(name)
  }

  const handleSupplierNameChange = (e) => {
    // Supplier names commonly contain numbers, &, ., /, parentheses, etc.
    // Keep the field flexible and only trim/limit by maxLength.
    const value = e.target.value
    setForm((prev) => ({ ...prev, supplierName: value }))
    clearError('supplierName')
  }

  const validate = () => {
    const temp = {}
    const supplierCode = form.supplierCode.trim()
    const supplierName = form.supplierName.trim()
    const email = form.email.trim()
    const contactNumber = form.contactNumber.trim()
    const gstNo = form.gstNo.trim().toUpperCase()
    const panNo = form.panNo.trim().toUpperCase()

    if (!supplierCode) {
      temp.supplierCode = 'Supplier ID is required'
    } else if (!SUPPLIER_ID_REGEX.test(supplierCode.toUpperCase())) {
      temp.supplierCode =
        'Supplier ID can contain only letters, numbers and hyphen (-)'
    } else if (
      suppliers.some(
        (s) =>
          s.supplierCode?.trim().toLowerCase() === supplierCode.toLowerCase() &&
          s.id !== editId,
      )
    ) {
      temp.supplierCode = 'Supplier ID already exists'
    }

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

    if (!form.supplierGroupId) {
      temp.supplierGroupId = 'Supplier Group is required'
    }

    if (email && !EMAIL_REGEX.test(email)) {
      temp.email = 'Enter a valid email address'
    }

    if (contactNumber && !CONTACT_REGEX.test(contactNumber)) {
      temp.contactNumber = 'Contact Number must be exactly 10 digits'
    }

    if (requiresGst) {
      if (!gstNo) {
        temp.gstNo = 'GST No is required for the selected Supplier Group'
      } else if (!GST_REGEX.test(gstNo)) {
        temp.gstNo =
          'Enter a valid 15-character GSTIN (e.g. 33ABCDE1234F1Z5)'
      } else if (
        suppliers.some(
          (s) =>
            s.gstNo?.trim().toUpperCase() === gstNo && s.id !== editId,
        )
      ) {
        temp.gstNo = 'GST No already exists'
      }
    }

    if (requiresPan) {
      if (!panNo) {
        temp.panNo = 'PAN No is required for the selected Supplier Group'
      } else if (!PAN_REGEX.test(panNo)) {
        temp.panNo = 'Enter a valid 10-character PAN (e.g. ABCDE1234F)'
      } else if (
        suppliers.some(
          (s) =>
            s.panNo?.trim().toUpperCase() === panNo && s.id !== editId,
        )
      ) {
        temp.panNo = 'PAN No already exists'
      }
    }

    setErrors(temp)
    return Object.keys(temp).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        supplierCode: form.supplierCode.trim().toUpperCase(),
        supplierName: form.supplierName.trim(),
        supplierGroupId: Number(form.supplierGroupId),
        email: form.email.trim() || null,
        contactNumber: form.contactNumber.trim() || null,
        personToContact: form.personToContact.trim() || null,
        gstNo: requiresGst ? form.gstNo.trim().toUpperCase() : null,
        panNo: requiresPan ? form.panNo.trim().toUpperCase() : null,
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
      setForm({
        supplierCode: d.supplierCode || '',
        supplierName: d.supplierName || '',
        supplierGroupId: d.supplierGroupId || '',
        email: d.email || '',
        contactNumber: d.contactNumber || '',
        personToContact: d.personToContact || '',
        gstNo: d.gstNo || '',
        panNo: d.panNo || '',
      })
      setErrors({})
      setShowForm(true)

      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        supplierIdRef.current?.focus()
      }, 250)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load supplier'))
    }
  }

  const resetForm = () => {
    setForm({ ...EMPTY_FORM })
    setErrors({})
    setEditId(null)

    setTimeout(() => supplierIdRef.current?.focus(), 100)
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
      await loadSuppliers()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeleteSupplier(null)
    }
  }

  const filteredSuppliers = suppliers.filter((s) => {
    const q = search.trim().toLowerCase()
    if (!q) return true

    return [
      s.supplierName,
      s.supplierCode,
      s.supplierGroupName,
      s.supplierGroupDescription,
      s.personToContact,
      s.contactNumber,
      s.gstNo,
      s.panNo,
      s.email,
    ].some((v) => String(v || '').toLowerCase().includes(q))
  })

  const customStyles = {
    rows: { style: { minHeight: '38px' } },
    headCells: {
      style: {
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: '700',
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

  const TooltipCell = ({ value }) => {
    if (!value) return <span>—</span>
    return (
      <CTooltip content={String(value)} placement="top">
        <span className="supplier-table-cell-text">{value}</span>
      </CTooltip>
    )
  }

  const columns = [
    {
      name: 'S.NO',
      width: '70px',
      center: true,
      cell: (row, index) =>
        (currentPage - 1) * rowsPerPage + index + 1,
    },
    {
      name: 'SUPPLIER ID',
      selector: (row) => row.supplierCode,
      width: '130px',
      cell: (row) => <TooltipCell value={row.supplierCode} />,
    },
    {
      name: 'SUPPLIER NAME',
      selector: (row) => row.supplierName,
      width: '190px',
      wrap: true,
      cell: (row) => <TooltipCell value={row.supplierName} />,
    },
    {
      name: 'SUPPLIER GROUP',
      selector: (row) => row.supplierGroupName,
      width: '240px',
      wrap: true,
      cell: (row) => (
        <TooltipCell
          value={
            row.supplierGroupDescription
              ? `${row.supplierGroupName} - ${row.supplierGroupDescription}`
              : row.supplierGroupName
          }
        />
      ),
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
      width: '150px',
      cell: (row) => <TooltipCell value={row.contactNumber} />,
    },
    {
      name: 'EMAIL',
      selector: (row) => row.email,
      width: '210px',
      wrap: true,
      cell: (row) => <TooltipCell value={row.email} />,
    },
    {
      name: 'GST NO.',
      selector: (row) => row.gstNo,
      width: '175px',
      cell: (row) => <TooltipCell value={row.gstNo} />,
    },
    {
      name: 'PAN NO.',
      selector: (row) => row.panNo,
      width: '145px',
      cell: (row) => <TooltipCell value={row.panNo} />,
    },
    {
      name: 'ACTION',
      center: true,
      width: '120px',
      cell: (row) => (
        <div className="action-wrapper">
          {uPrivilege?.canEdit && (
            <button
              className="table-action-btn edit-btn"
              title="Edit"
              onClick={() => handleEdit(row)}
            >
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

  return (
    <div className="supplier-master-page">
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">Total Suppliers</div>
              <div className="summary-value">
                {String(suppliers.length).padStart(2, '0')}
              </div>
            </div>

            <button
              className="round-icon-btn add-item-btn"
              title="Add Supplier"
              onClick={handleAddNew}
            >
              <FaPlus size={16} />
            </button>
          </CCardBody>
        </CCard>
      )}

      {showForm && (
        <CCard className="supplier-master-form-card mb-3">
          <CCardBody className="supplier-master-form-card-body">
            <button
              className="round-icon-btn back-btn card-back-btn"
              title="Back"
              onClick={handleBack}
            >
              <FaArrowLeft size={14} />
            </button>

            <div className="section-title">Basic Information</div>

            <CRow className="g-3">
              <CCol md={4}>
                <label className="custom-label">
                  <strong>Supplier ID</strong>{' '}
                  <span className="required">*</span>
                </label>
                <CFormInput
                  name="supplierCode"
                  ref={supplierIdRef}
                  placeholder="Enter Supplier ID"
                  value={form.supplierCode}
                  maxLength={30}
                  className={errors.supplierCode ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({
                      target: {
                        name: 'supplierCode',
                        value: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9-]/g, ''),
                      },
                    })
                  }
                />
                {errors.supplierCode && (
                  <small className="text-danger">{errors.supplierCode}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Supplier Name</strong>{' '}
                  <span className="required">*</span>
                </label>
                <CFormInput
                  name="supplierName"
                  placeholder="Enter Supplier Name"
                  value={form.supplierName}
                  maxLength={150}
                  className={errors.supplierName ? 'error-input' : ''}
                  onChange={handleSupplierNameChange}
                />
                {errors.supplierName && (
                  <small className="text-danger">{errors.supplierName}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Supplier Group</strong>{' '}
                  <span className="required">*</span>
                </label>
                <div
                  className={
                    errors.supplierGroupId ? 'react-select-error' : ''
                  }
                >
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Supplier Group"
                    options={supplierGroupOptions}
                    value={
                      supplierGroupOptions.find(
                        (x) =>
                          String(x.value) === String(form.supplierGroupId),
                      ) || null
                    }
                    onChange={(selected) => {
                      setForm((prev) => ({
                        ...prev,
                        supplierGroupId: selected?.value || '',
                        gstNo: selected?.requiresGst ? prev.gstNo : '',
                        panNo: selected?.requiresPan ? prev.panNo : '',
                      }))
                      setErrors((prev) => ({
                        ...prev,
                        supplierGroupId: '',
                        gstNo: '',
                        panNo: '',
                      }))
                    }}
                    isClearable
                  />
                </div>
                {errors.supplierGroupId && (
                  <small className="text-danger">
                    {errors.supplierGroupId}
                  </small>
                )}
                {selectedGroup && (
                  <div className="group-requirement-note">
                    <span>
                      GST: <strong>{requiresGst ? 'Required' : 'Not Required'}</strong>
                    </span>
                    <span>
                      PAN: <strong>{requiresPan ? 'Required' : 'Not Required'}</strong>
                    </span>
                  </div>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Email</strong>
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
                {errors.email && (
                  <small className="text-danger">{errors.email}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Contact Number</strong>
                </label>
                <CFormInput
                  name="contactNumber"
                  placeholder="Enter Contact Number"
                  value={form.contactNumber}
                  maxLength={10}
                  className={errors.contactNumber ? 'error-input' : ''}
                  onChange={(e) =>
                    handleChange({
                      target: {
                        name: 'contactNumber',
                        value: e.target.value.replace(/[^0-9]/g, ''),
                      },
                    })
                  }
                />
                {errors.contactNumber && (
                  <small className="text-danger">{errors.contactNumber}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Person to Contact</strong>
                </label>
                <CFormInput
                  name="personToContact"
                  placeholder="Enter Person to Contact"
                  value={form.personToContact}
                  maxLength={100}
                  onChange={handleChange}
                />
              </CCol>

              {requiresGst && (
                <CCol md={4}>
                  <label className="custom-label">
                    <strong>GST No.</strong>{' '}
                    <span className="required">*</span>
                  </label>
                  <CFormInput
                    name="gstNo"
                    placeholder="Enter GST Number"
                    value={form.gstNo}
                    maxLength={15}
                    className={errors.gstNo ? 'error-input' : ''}
                    onChange={(e) =>
                      handleChange({
                        target: {
                          name: 'gstNo',
                          value: e.target.value.toUpperCase(),
                        },
                      })
                    }
                  />
                  {errors.gstNo && (
                    <small className="text-danger">{errors.gstNo}</small>
                  )}
                </CCol>
              )}

              {requiresPan && (
                <CCol md={4}>
                  <label className="custom-label">
                    <strong>PAN No.</strong>{' '}
                    <span className="required">*</span>
                  </label>
                  <CFormInput
                    name="panNo"
                    placeholder="Enter PAN Number"
                    value={form.panNo}
                    maxLength={10}
                    className={errors.panNo ? 'error-input' : ''}
                    onChange={(e) =>
                      handleChange({
                        target: {
                          name: 'panNo',
                          value: e.target.value.toUpperCase(),
                        },
                      })
                    }
                  />
                  {errors.panNo && (
                    <small className="text-danger">{errors.panNo}</small>
                  )}
                </CCol>
              )}
            </CRow>

            <div className="form-button-area">
              <CButton
                className={editId ? 'update-btn' : 'save-btn'}
                onClick={handleSubmit}
              >
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
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredSuppliers}
            pagination
            paginationPerPage={rowsPerPage}
            paginationRowsPerPageOptions={[10, 20, 30, 50, 100]}
            onChangePage={(page) => setCurrentPage(page)}
            onChangeRowsPerPage={(newPerPage, page) => {
              setRowsPerPage(newPerPage)
              setCurrentPage(page)
            }}
            striped
            responsive
            highlightOnHover
            customStyles={customStyles}
            noDataComponent="No suppliers found"
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
          <p>Are you sure you want to delete this Supplier?</p>
          <div className="delete-preview">
            <div>
              <strong>Supplier ID :</strong>{' '}
              <span className="text-primary fw-bold">
                {deleteSupplier?.supplierCode}
              </span>
            </div>
            <div>
              <strong>Supplier Name :</strong>{' '}
              <span className="fw-bold">{deleteSupplier?.supplierName}</span>
            </div>
          </div>
        </CModalBody>
        <CModalFooter className="border-0 d-flex justify-content-center">
          <CButton
            color="secondary"
            onClick={() => setShowDeleteModal(false)}
          >
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

export default SupplierMaster
