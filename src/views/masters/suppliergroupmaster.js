import React, { useEffect, useRef, useState } from 'react'
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
import usePrivilege from '../hooks/usePrivilege.js'
import '../../assets/CSS/supplierGroup.css'

const EMPTY_FORM = {
  supplierGroupType: '',
  description: '',
  requiresGst: false,
  requiresPan: false,
}

const EMPTY_ERRORS = {
  supplierGroupType: '',
  description: '',
}

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data

  if (!data) return fallback

  if (typeof data === 'string') return data

  if (data.message || data.error) {
    return data.message || data.error
  }

  if (data.errors && typeof data.errors === 'object') {
    const firstField = Object.keys(data.errors)[0]
    const firstMessage = data.errors[firstField]?.[0]

    if (firstMessage) return firstMessage
  }

  return fallback
}

const normalize = (value) => (value || '').trim().toLowerCase()

const SupplierGroupMaster = () => {
  const typeRef = useRef(null)

  const [groups, setGroups] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [errors, setErrors] = useState({ ...EMPTY_ERRORS })

  const [editId, setEditId] = useState(null)

  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const [deleteId, setDeleteId] = useState(null)
  const [deleteGroup, setDeleteGroup] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const { privileges: userPrivileges = [] } = usePrivilege()

  const uPrivilege =
    userPrivileges.find(
      (p) => p.menuName === 'Supplier Group Master',
    ) || {}

  const customStyles = {
    rows: {
      style: {
        minHeight: '38px',
      },
    },
    headCells: {
      style: {
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 700,
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
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }

  const loadGroups = async () => {
    try {
      const res = await API.get('/SupplierGroup')
      setGroups(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          'Failed to load supplier groups',
        ),
      )
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))

    clearError(name)
  }

  /*
   * Duplicate rule:
   *
   * Supplier Group Type can repeat.
   *
   * Type + Description must be unique.
   *
   * Example:
   * Packaging Material Suppliers + Test  -> allowed
   * Packaging Material Suppliers + Test2 -> allowed
   * Packaging Material Suppliers + Test  -> NOT allowed
   */
  const validate = () => {
    const temp = {
      supplierGroupType: '',
      description: '',
    }

    const type = form.supplierGroupType.trim()
    const description = form.description.trim()

    if (!type) {
      temp.supplierGroupType =
        'Supplier Group Type is required'
    }

    if (
      type &&
      groups.some(
        (g) =>
          normalize(g.supplierGroupType) === normalize(type) &&
          normalize(g.description) === normalize(description) &&
          g.id !== editId,
      )
    ) {
      if (description) {
        temp.description =
          'Supplier Group Type with this Description already exists'
      } else {
        temp.supplierGroupType =
          'Supplier Group Type already exists'
      }
    }

    setErrors(temp)

    return !Object.values(temp).some(Boolean)
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        supplierGroupType:
          form.supplierGroupType.trim(),

        description:
          form.description.trim()
            ? form.description.trim()
            : null,

        requiresGst:
          form.requiresGst === true,

        requiresPan:
          form.requiresPan === true,
      }

      if (editId) {
        await API.put(
          `/SupplierGroup/${editId}`,
          payload,
        )

        toast.success(
          'Supplier Group Updated Successfully',
        )
      } else {
        await API.post(
          '/SupplierGroup',
          payload,
        )

        toast.success(
          'Supplier Group Saved Successfully',
        )
      }

      await loadGroups()
      resetForm()
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          'Save Failed',
        ),
      )
    }
  }

  const handleEdit = async (row) => {
    try {
      const res = await API.get(
        `/SupplierGroup/${row.id}`,
      )

      const data = res.data || {}

      setEditId(row.id)

      setForm({
        supplierGroupType:
          data.supplierGroupType || '',

        description:
          data.description || '',

        requiresGst:
          data.requiresGst === true,

        requiresPan:
          data.requiresPan === true,
      })

      setErrors({ ...EMPTY_ERRORS })
      setShowForm(true)

      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        })

        typeRef.current?.focus()
      }, 250)
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          'Failed to load supplier group',
        ),
      )
    }
  }

  const resetForm = () => {
    setForm({ ...EMPTY_FORM })
    setErrors({ ...EMPTY_ERRORS })
    setEditId(null)

    if (showForm) {
      setTimeout(() => {
        typeRef.current?.focus()
      }, 100)
    }
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
      await API.delete(
        `/SupplierGroup/${deleteId}`,
      )

      toast.success(
        'Supplier Group Deleted Successfully',
      )

      await loadGroups()
      resetForm()
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          'Delete Failed',
        ),
      )
    } finally {
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeleteGroup(null)
    }
  }

  const filteredGroups = groups.filter((g) => {
    const value = search.trim().toLowerCase()

    if (!value) return true

    return (
      normalize(g.supplierGroupType).includes(value) ||
      normalize(g.description).includes(value) ||
      (g.requiresGst ? 'yes gst' : 'no gst').includes(value) ||
      (g.requiresPan ? 'yes pan' : 'no pan').includes(value)
    )
  })

  const columns = [
    {
      name: 'S.NO',
      width: '80px',
      center: true,
      cell: (row, index) =>
        (currentPage - 1) * rowsPerPage +
        index +
        1,
    },

    {
      name: 'SUPPLIER GROUP TYPE',
      selector: (row) =>
        row.supplierGroupType || '',
      sortable: true,
      wrap: true,
      minWidth: '260px',
    },

    {
      name: 'DESCRIPTION',
      selector: (row) =>
        row.description || '',
      sortable: true,
      wrap: true,
      minWidth: '280px',
      cell: (row) => (
        <span
          title={
            row.description ||
            'No Description'
          }
        >
          {row.description || '—'}
        </span>
      ),
    },

    {
      name: 'GST',
      center: true,
      width: '110px',
      cell: (row) => (
        <span
          className={
            row.requiresGst
              ? 'status-badge status-yes'
              : 'status-badge status-no'
          }
        >
          {row.requiresGst ? 'Yes' : 'No'}
        </span>
      ),
    },

    {
      name: 'PAN',
      center: true,
      width: '110px',
      cell: (row) => (
        <span
          className={
            row.requiresPan
              ? 'status-badge status-yes'
              : 'status-badge status-no'
          }
        >
          {row.requiresPan ? 'Yes' : 'No'}
        </span>
      ),
    },

    {
      name: 'ACTION',
      center: true,
      width: '140px',
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
                setDeleteGroup(row)
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
    <div className="supplier-group-page">
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">
                Total Supplier Groups
              </div>

              <div className="summary-value">
                {String(groups.length).padStart(
                  2,
                  '0',
                )}
              </div>
            </div>

            {uPrivilege?.canAdd !== false && (
              <button
                className="round-icon-btn add-item-btn"
                title="Add Supplier Group"
                onClick={handleAddNew}
              >
                <FaPlus size={16} />
              </button>
            )}
          </CCardBody>
        </CCard>
      )}

      {showForm && (
        <CCard className="supplier-group-form-card">
          <CCardBody className="supplier-group-form-card-body">
            <button
              className="round-icon-btn back-btn card-back-btn"
              title="Back"
              onClick={handleBack}
            >
              <FaArrowLeft size={14} />
            </button>

            <div className="section-title">
              Basic Information
            </div>

            <CRow className="g-3">
              <CCol md={4}>
                <label className="custom-label">
                  <strong>
                    Supplier Group Type
                  </strong>{' '}
                  <span className="required">
                    *
                  </span>
                </label>

                <CFormInput
                  ref={typeRef}
                  name="supplierGroupType"
                  placeholder="Enter Supplier Group Type"
                  value={
                    form.supplierGroupType
                  }
                  className={
                    errors.supplierGroupType
                      ? 'error-input'
                      : ''
                  }
                  maxLength={100}
                  onChange={handleChange}
                />

                {errors.supplierGroupType && (
                  <small className="text-danger">
                    {errors.supplierGroupType}
                  </small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>
                    Description
                  </strong>
                </label>

                <CFormInput
                  name="description"
                  placeholder="Enter Description"
                  value={form.description}
                  className={
                    errors.description
                      ? 'error-input'
                      : ''
                  }
                  maxLength={250}
                  onChange={handleChange}
                />

                {errors.description && (
                  <small className="text-danger">
                    {errors.description}
                  </small>
                )}
              </CCol>

              <CCol md={2}>
                <div className="checkbox-wrapper">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={
                        form.requiresGst === true
                      }
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          requiresGst:
                            e.target.checked,
                        }))
                      }
                    />

                    <span>GST No</span>
                  </label>

                  <small>
                    GST details required
                  </small>
                </div>
              </CCol>

              <CCol md={2}>
                <div className="checkbox-wrapper">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={
                        form.requiresPan === true
                      }
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          requiresPan:
                            e.target.checked,
                        }))
                      }
                    />

                    <span>PAN No</span>
                  </label>

                  <small>
                    PAN details required
                  </small>
                </div>
              </CCol>
            </CRow>

            <div className="form-button-area">
              <CButton
                className={
                  editId
                    ? 'update-btn'
                    : 'save-btn'
                }
                onClick={handleSubmit}
              >
                {editId ? 'Update' : 'Save'}
              </CButton>

              <CButton
                className="clear-btn"
                onClick={resetForm}
              >
                Clear
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      )}

      <CCard className="mt-3">
        <CCardBody>
          <div className="table-header">
            <div className="table-title">
              Supplier Group List
            </div>

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
            data={filteredGroups}
            pagination
            paginationPerPage={rowsPerPage}
            paginationRowsPerPageOptions={[
              10,
              20,
              30,
              50,
              100,
            ]}
            onChangePage={(page) => {
              setCurrentPage(page)
            }}
            onChangeRowsPerPage={(
              newPerPage,
              page,
            ) => {
              setRowsPerPage(newPerPage)
              setCurrentPage(page)
            }}
            striped
            responsive
            highlightOnHover
            persistTableHead
            customStyles={customStyles}
            noDataComponent={
              <div className="empty-table-message">
                No Supplier Groups Found
              </div>
            }
          />
        </CCardBody>
      </CCard>

      <CModal
        visible={showDeleteModal}
        onClose={() =>
          setShowDeleteModal(false)
        }
        alignment="center"
        backdrop="static"
      >
        <CModalHeader className="border-0">
          <CModalTitle className="w-100 text-center text-danger fw-bold">
            ⚠ Confirm Delete
          </CModalTitle>
        </CModalHeader>

        <CModalBody className="text-center">
          <p>
            Are you sure you want to delete this
            Supplier Group?
          </p>

          <div className="delete-preview">
            <div>
              <strong>
                Supplier Group Type:
              </strong>{' '}
              <span className="text-primary fw-bold">
                {deleteGroup?.supplierGroupType ||
                  '—'}
              </span>
            </div>

            <div>
              <strong>Description:</strong>{' '}
              <span className="text-primary fw-bold">
                {deleteGroup?.description ||
                  '—'}
              </span>
            </div>
          </div>
        </CModalBody>

        <CModalFooter className="border-0 d-flex justify-content-center">
          <CButton
            color="secondary"
            onClick={() =>
              setShowDeleteModal(false)
            }
          >
            Cancel
          </CButton>

          <CButton
            color="danger"
            onClick={confirmDelete}
          >
            Delete
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default SupplierGroupMaster
