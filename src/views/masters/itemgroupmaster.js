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
import '../../assets/CSS/itemGroup.css'

// Small helper so we never hand toast a non-string (fixes "[object Object]" toasts)
const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  return data.message || data.error || fallback
}

const ItemGroupMaster = () => {
  const groupNameRef = useRef()

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
    groupName: '',
    description: '',
    isActive: true,
  })

  const [errors, setErrors] = useState({
    groupName: '',
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
        groupNameRef.current?.focus()
      }, 200)
    }
  }, [showForm])

  const clearError = (name) => {
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }

  const loadGroups = async () => {
    try {
      const res = await API.get('/ItemGroup')
      setGroups(res.data || [])
    } catch {
      toast.error('Failed to load item groups')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm({
      ...form,
      [name]: value,
    })

    clearError(name)
  }

  const validate = () => {
    const temp = {
      groupName: '',
    }

    const groupName = form.groupName.trim()

    if (!groupName) {
      temp.groupName = 'Group Name is required'
    } else if (
      groups.some(
        (g) =>
          g.groupName?.trim().toLowerCase() === groupName.toLowerCase() &&
          g.id !== editId
      )
    ) {
      temp.groupName = 'Group Name already exists'
    }

    setErrors(temp)

    return !Object.values(temp).some((x) => x)
  }
  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        groupName: form.groupName.trim(),
        description: form.description.trim(),
        isActive: form.isActive === true || form.isActive === 'true',
      }

      if (editId) {
        await API.put(`/ItemGroup/${editId}`, payload)
        toast.success('Item Group Updated Successfully')
      } else {
        await API.post('/ItemGroup', payload)
        toast.success('Item Group Saved Successfully')
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
      const res = await API.get(`/ItemGroup/${row.id}`)

      setEditId(row.id)
      setShowForm(true)

      setForm({
        groupName: res.data.groupName || '',
        description: res.data.description || '',
        isActive: res.data.isActive,
      })

      setErrors({
        groupName: '',
      })
    } catch {
      toast.error('Failed to load item group')
    }
  }

  const resetForm = () => {
    setForm({
      groupName: '',
      description: '',
      isActive: true,
    })

    setErrors({
      groupName: '',
    })

    setEditId(null)

    setTimeout(() => {
      groupNameRef.current?.focus()
    }, 100)
  }

  // Used by the back-arrow: leave the form entirely and return to the
  // summary + grid view.
  const handleBack = () => {
    resetForm()
    setShowForm(false)
  }

  const confirmDelete = async () => {
    try {
      await API.delete(`/ItemGroup/${deleteId}`)
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
      (g.groupName || '').toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    {
      name: 'S.NO',
      selector: (row, index) => index + 1,
      width: '80px',
    },
    {
      name: 'GROUP NAME',
      selector: (row) => row.groupName,
    },
    {
      name: 'DESCRIPTION',
      selector: (row) => row.description,
    },
    {
      name: 'STATUS',
      center: true,
      cell: (row) => (
        <span className={row.isActive ? 'status-badge active' : 'status-badge inactive'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      name: 'ACTIONS',
      center: true,
      cell: (row) => (
        <div className="action-wrapper">
          <button
            className="table-action-btn edit-btn"
            title="Edit"
            onClick={() => handleEdit(row)}
          >
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
    <div className="item-group-page">
      {/* ============================================================
          TOP BAR — list view only. In form view the back button
          moves inside the form card itself (top-right corner).
      ============================================================ */}
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">Total Item Group</div>
              <div className="summary-value">
                {String(groups.length).padStart(2, '0')}
              </div>
            </div>

            <button
              className="round-icon-btn add-item-btn"
              title="Add Item"
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
            >
              <FaPlus size={16} />
            </button>
          </CCardBody>
        </CCard>
      )}

      {showForm && (
        <CCard className="item-group-form-card">
          <CCardBody className="item-group-form-card-body">
            {/* Back button lives inside the card, top-right corner */}
            <button
              className="round-icon-btn back-btn card-back-btn"
              title="Back"
              onClick={handleBack}
            >
              <FaArrowLeft size={14} />
            </button>

            <div className="section-title">Item Group Information</div>

            <CRow className="g-3">

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Group Name</strong> <span className="required">*</span>
                </label>

                <CFormInput
                  placeholder="Enter Group Name"
                  name="groupName"
                  ref={groupNameRef}
                  value={form.groupName}
                  className={errors.groupName ? 'error-input' : ''}
                  onChange={handleChange}
                />

                {errors.groupName && (
                  <small className="text-danger">{errors.groupName}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Description</strong>
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
            <div className="table-title">Item Group List</div>

            <CFormInput
              placeholder="Search by Group Name..."
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
          <p>Are you sure you want to delete this Item Group?</p>

          <div
            style={{
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '10px',
            }}
          >
            <div>
              <strong>Group Name :</strong>
              <span>{deleteGroup?.groupName}</span>
            </div>
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

export default ItemGroupMaster
