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
import API from '../../api.js'
import '../../assets/CSS/customerGroup.css'

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

const CustomerGroupMaster = () => {
  const typeRef = useRef()

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

  const [groups, setGroups] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    customerGroupType: '',
    description: '',
  })

  const [errors, setErrors] = useState({
    customerGroupType: '',
  })

  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deleteGroup, setDeleteGroup] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    loadGroups()
  }, [])

  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        typeRef.current?.focus()
      }, 200)
    }
  }, [showForm])

  const clearError = (name) => {
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const loadGroups = async () => {
    try {
      const res = await API.get('/CustomerGroup')
      setGroups(res.data || [])
    } catch {
      toast.error('Failed to load customer groups')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    clearError(name)
  }

  const validate = () => {
    const temp = { customerGroupType: '' }

    const type = form.customerGroupType.trim()

    if (!type) {
      temp.customerGroupType = 'Customer Group Type is required'
    } else if (
      groups.some(
        (g) =>
          g.customerGroupType?.trim().toLowerCase() === type.toLowerCase() &&
          g.id !== editId,
      )
    ) {
      temp.customerGroupType = 'Customer Group Type already exists'
    }

    setErrors(temp)

    return !Object.values(temp).some((x) => x)
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        customerGroupType: form.customerGroupType.trim(),
        description: form.description.trim(),
      }

      if (editId) {
        await API.put(`/CustomerGroup/${editId}`, payload)
        toast.success('Customer Group Updated Successfully')
      } else {
        await API.post('/CustomerGroup', payload)
        toast.success('Customer Group Saved Successfully')
      }

      await loadGroups()
      resetForm()
      setShowForm(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const handleEdit = async (row) => {
    try {
      const res = await API.get(`/CustomerGroup/${row.id}`)

      setEditId(row.id)
      setShowForm(true)

      setForm({
        customerGroupType: res.data.customerGroupType || '',
        description: res.data.description || '',
      })

      setErrors({ customerGroupType: '' })
    } catch {
      toast.error('Failed to load customer group')
    }
  }

  const resetForm = () => {
    setForm({
      customerGroupType: '',
      description: '',
    })

    setErrors({ customerGroupType: '' })
    setEditId(null)

    setTimeout(() => {
      typeRef.current?.focus()
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
      await API.delete(`/CustomerGroup/${deleteId}`)
      toast.success('Deleted Successfully')
      resetForm()
      await loadGroups()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeleteGroup(null)
    }
  }

  const filteredGroups = groups.filter(
    (g) =>
      (g.customerGroupType || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.description || '').toLowerCase().includes(search.toLowerCase()),
  )

  const columns = [
    { name: 'SL.NO', selector: (row, index) => index + 1, width: '80px' },
    { name: 'CUSTOMER GROUP TYPE', selector: (row) => row.customerGroupType, wrap: true },
    { name: 'DESCRIPTION', selector: (row) => row.description, wrap: true },
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
              setDeleteGroup(row)
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
    <div className="customer-group-page">
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">Total Customer Master Group</div>
              <div className="summary-value">{String(groups.length).padStart(2, '0')}</div>
            </div>

            <button className="round-icon-btn add-item-btn" title="Add Customer Type" onClick={handleAddNew}>
              <FaPlus size={16} />
            </button>
          </CCardBody>
        </CCard>
      )}

      {showForm && (
        <CCard className="customer-group-form-card">
          <CCardBody className="customer-group-form-card-body">
            <button className="round-icon-btn back-btn card-back-btn" title="Back" onClick={handleBack}>
              <FaArrowLeft size={14} />
            </button>

            <div className="section-title">Basic Information</div>

            <CRow className="g-3">
              <CCol md={6}>
                <label className="custom-label">
                  <strong>Customer Group Type</strong> <span className="required">*</span>
                </label>

                <CFormInput
                  ref={typeRef}
                  placeholder="Enter Customer Group Type"
                  name="customerGroupType"
                  value={form.customerGroupType}
                  className={errors.customerGroupType ? 'error-input' : ''}
                  onChange={handleChange}
                />

                {errors.customerGroupType && (
                  <small className="text-danger">{errors.customerGroupType}</small>
                )}
              </CCol>

              <CCol md={6}>
                <label className="custom-label">
                  <strong>Description</strong> <span className="required">*</span>
                </label>

                <CFormInput
                  placeholder="Enter Description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                />
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
            <div className="table-title">Customer Group List</div>

            <CFormInput
              placeholder="Search..."
              className="search-box"
              style={{ width: '320px' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredGroups}
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
          <p>Are you sure you want to delete this Customer Group?</p>

          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
            <div>
              <strong>Customer Group Type :</strong>{' '}
              <span className="text-primary fw-bold">{deleteGroup?.customerGroupType}</span>
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

export default CustomerGroupMaster
