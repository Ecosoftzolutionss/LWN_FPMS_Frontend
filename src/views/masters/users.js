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
import { FaEdit, FaTrash, FaUsers, FaPlus, FaArrowLeft } from 'react-icons/fa'
import { toast } from 'react-toastify'
import API from '../../api.js'
import '../../assets/CSS/user.css'
import { MENU_CONFIG } from '../menuConfig.js'
import CIcon from '@coreui/icons-react'
import usePrivilege from '../hooks/usePrivilege.js'
import CreatableSelect from 'react-select/creatable'


// Small helper so we never hand toast a non-string (fixes "[object Object]" toasts)
const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  return data.message || data.error || fallback
}

const UserMaster = () => {
  const userRef = useRef()

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

  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    userId: '',
    employeeId: '',
    userName: '',
    departmentId: '',
    password: '',
    confirmPassword: '',
  })

  const [errors, setErrors] = useState({
    userId: '',
    userName: '',
    employeeId: '',
    departmentId: '',
    password: '',
    confirmPassword: '',
  })

  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPrivilegeModal, setShowPrivilegeModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [privileges, setPrivileges] = useState([])
  const [departments, setDepartments] = useState([])
  const [deleteUser, setDeleteUser] = useState(null)
  const [departmentInput, setDepartmentInput] = useState('')

  const { privileges: userPrivileges = [] } = usePrivilege()
  const uPrivilege = userPrivileges.find((p) => p.menuName === 'User Master') || {}

  const sessionUser = JSON.parse(sessionStorage.getItem('user') || 'null')
  const isAdminDepartment = sessionUser?.departmentName?.toUpperCase() === 'ADMIN'

  useEffect(() => {
    loadUsers()
    loadDepartments()
  }, [])

  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        userRef.current?.focus()
      }, 200)
    }
  }, [showForm])

  const clearError = (name) => {
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }

  const capitalizeFirstLetter = (value) => {
    if (!value) return ''
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  const loadUsers = async () => {
    try {
      const res = await API.get('/users')
      setUsers(res.data || [])
    } catch {
      toast.error('Failed to load users')
    }
  }

  const loadDepartments = async () => {
    try {
      const res = await API.get('/users/departments')
      setDepartments(res.data || [])
    } catch {
      toast.error('Failed to load departments')
    }
  }

const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
        ...prev,
        [name]: value,
    }));

    clearError(name);
};

  const validate = () => {
    const temp = {
      userId: '',
      userName: '',
      employeeId: '',
      departmentId: '',
      password: '',
      confirmPassword: '',
    }

    console.log(form);

    const userId = form.userId.trim()
    const userName = form.userName.trim()
    const employeeId = form.employeeId.trim()

    if (!userId) {
      temp.userId = 'User ID is required'
    } else if (
      users.some(
        (u) =>
          u.userId?.trim().toLowerCase() === userId.toLowerCase() &&
          u.id !== editId,
      )
    ) {
      temp.userId = 'User ID already exists'
    }

    if (!userName) {
      temp.userName = 'User Name is required'
    } else if (!/^[A-Za-z ]+$/.test(userName)) {
      temp.userName = 'User Name only allows letters'
    } else if (
      users.some(
        (u) =>
          u.userName?.trim().toLowerCase() === userName.toLowerCase() &&
          u.id !== editId,
      )
    ) {
      temp.userName = 'User Name already exists'
    }

    if (!employeeId) {
      temp.employeeId = 'Employee ID is required'
    } else if (!/^[A-Z0-9]+$/.test(employeeId)) {
      temp.employeeId = 'Employee ID can contain only capital letters and numbers'
    } else if (
      users.some(
        (u) =>
          u.employeeId?.trim().toLowerCase() === employeeId.toLowerCase() &&
          u.id !== editId,
      )
    ) {
      temp.employeeId = 'Employee ID already exists'
    }

    if (!form.departmentId && !departmentInput) {
      temp.departmentId = 'Department is required'
    }

    // Password is only mandatory when creating a new user. When editing,
    // it's optional — only validated if the person actually typed
    // something into either field.
    // Password is mandatory for both Add and Edit
  if (!form.password) {
    temp.password = 'Password is required';
}

if (!form.confirmPassword) {
    temp.confirmPassword = 'Confirm Password is required';
} else if (form.password !== form.confirmPassword) {
    temp.confirmPassword = 'Password mismatch';
}

console.log(temp);

setErrors(temp);

    return !Object.values(temp).some((x) => x)
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        userCode: form.userId.trim(),
        userName: form.userName.trim(),
        employeeId: form.employeeId.trim(),
        departmentId: Number(form.departmentId) || 0,
        departmentName: departmentInput,
      }

      // Only send a password when one was actually entered, so an edit
      // with blank password fields doesn't overwrite the existing
      // password on the backend.
      payload.passwordHash = form.password

      let res

      if (editId) {
        await API.put(`/users/${editId}`, payload)
        toast.success('User Updated Successfully')
      } else {
        res = await API.post('/users', payload)
        toast.success('User Saved Successfully')

        if (res?.data?.id) {
          openPrivilege(res.data)
        }
      }

      await loadUsers()
      resetForm()
      setShowForm(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const openPrivilege = async (user) => {
    setSelectedUser(user)

    try {
      const res = await API.get(`/users/privileges/${user.id}`)

      const mapped = MENU_CONFIG.flatMap((menu) => {
        const menus = []

        if (!menu.items) {
          menus.push(menu)
        } else {
          menus.push(...menu.items)
        }

        return menus.map((m) => {
          const existing = res.data.find((x) => x.menuName === m.name)

          return {
            menuName: m.name,
            icon: m.icon,
            canView: existing?.canView || false,
            canEdit: existing?.canEdit || false,
            canDelete: existing?.canDelete || false,
          }
        })
      })

      setPrivileges(mapped)
      setShowPrivilegeModal(true)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load privileges'))
    }
  }

  const handleEdit = async (row) => {
    try {
      const res = await API.get(`/users/${row.id}`)

      setEditId(row.id)
      setShowForm(true)

      setForm({
    userId: res.data.userId || '',
    userName: res.data.userName || res.data.UserName || '',
    employeeId: (res.data.employeeId || res.data.EmployeeId || '').toUpperCase(),
    departmentId: res.data.departmentId || res.data.DepartmentId || '',
    password: res.data.password || res.data.Password || '',
    confirmPassword: res.data.password || res.data.Password || ''
})

      setDepartmentInput(row.departmentName || '')
      setErrors({
        userId: '',
        userName: '',
        employeeId: '',
        departmentId: '',
        password: '',
        confirmPassword: '',
      })
    } catch {
      toast.error('Failed to load user')
    }
  }

  const handlePrivilegeChange = (index, field) => {
    if (index === -1) return

    const updated = [...privileges]

    if (field === 'all') {
      const val =
        !(updated[index].canView && updated[index].canEdit && updated[index].canDelete)

      updated[index] = {
        ...updated[index],
        canView: val,
        canEdit: val,
        canDelete: val,
      }
    } else if (field === 'canView') {
      updated[index].canView = !updated[index].canView
    } else if (field === 'canEdit') {
      updated[index].canEdit = !updated[index].canEdit
    } else if (field === 'canDelete') {
      updated[index].canDelete = !updated[index].canDelete
    }

    setPrivileges(updated)
  }

  const handleHeaderChange = (field, value) => {
    const updated = privileges.map((p) => {
      if (field === 'all') {
        return {
          ...p,
          canView: value,
          canEdit: value,
          canDelete: value,
        }
      }

      return {
        ...p,
        [field]: value,
      }
    })

    setPrivileges(updated)
  }

  const savePrivileges = async () => {
    const payload = privileges
      .filter((p) => p.canView || p.canEdit || p.canDelete)
      .map((p) => ({
        userId: selectedUser?.id,
        menuName: p.menuName,
        canView: p.canView,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
      }))

    if (payload.length === 0) {
      toast.error('Select at least one privilege')
      return
    }

    try {
      await API.post('/users/privileges', payload)
      toast.success('Privileges Saved')
      setShowPrivilegeModal(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save privileges'))
    }
  }

  const resetForm = () => {
    setForm({
      userId: '',
      employeeId: '',
      userName: '',
      departmentId: '',
      password: '',
      confirmPassword: '',
    })

    setErrors({
      userId: '',
      userName: '',
      employeeId: '',
      departmentId: '',
      password: '',
      confirmPassword: '',
    })

    setEditId(null)
    setDepartmentInput('')

    setTimeout(() => {
      userRef.current?.focus()
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
      await API.delete(`/users/${deleteId}`)
      toast.success('Deleted Successfully')
      resetForm()
      await loadUsers()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeleteUser(null)
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      (u.userName || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.userId || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.employeeId || '').toLowerCase().includes(search.toLowerCase()),
  )

  if (!uPrivilege.canView) {
    return <></>
  }

  const columns = [
    {
      name: 'S.NO',
      selector: (row, index) => index + 1,
    },
    {
      name: 'USER ID',
      selector: (row) => row.userId,
    },
    {
      name: 'USER NAME',
      selector: (row) => row.userName,
    },
    {
      name: 'DEPARTMENT',
      selector: (row) => row.departmentName,
    },
    {
      name: 'EMPLOYEE ID',
      selector: (row) => row.employeeId,
    },
    {
      name: 'ACTIONS',
      center: true,
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
                setDeleteUser(row)
                setShowDeleteModal(true)
              }}
            >
              <FaTrash />
            </button>
          )}

          {isAdminDepartment && (
            <button
              className="table-action-btn privilege-btn"
              title="Privileges"
              onClick={() => openPrivilege(row)}
            >
              <FaUsers />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="user-master-page">
      {/* ============================================================
          TOP BAR — list view only. In form view the back button
          moves inside the form card itself (top-right corner).
      ============================================================ */}
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">Total Item</div>
              <div className="summary-value">
                {String(users.length).padStart(2, '0')}
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
        <CCard className="user-form-card">
          <CCardBody className="user-form-card-body">
            {/* Back button lives inside the card, top-right corner */}
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
                  <strong>User Name</strong> <span className="required">*</span>
                </label>

                <CFormInput
                  ref={userRef}
                  placeholder="Enter User Name"
                  value={form.userName}
                  name="userName"
                  className={errors.userName ? 'error-input' : ''}
                  onChange={handleChange}
                />

                {errors.userName && (
                  <small className="text-danger">{errors.userName}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong> USER ID</strong> <span className="required">*</span>
                </label>

                <CFormInput
                  placeholder="Enter User ID"
                  value={form.userId}
                  className={errors.userId ? 'error-input' : ''}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      userId: capitalizeFirstLetter(e.target.value),
                    })
                    clearError('userId')
                  }}
                />

                {errors.userId && (
                  <small className="text-danger">{errors.userId}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Employee ID</strong>  <span className="required">*</span>
                </label>

                <CFormInput
                  placeholder="Enter Employee ID"
                  value={form.employeeId}
                  className={errors.employeeId ? 'error-input' : ''}
                  onChange={(e) => {
                    const value = e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')

                    setForm({
                      ...form,
                      employeeId: value,
                    })

                    clearError('employeeId')
                  }}
                />

                {errors.employeeId && (
                  <small className="text-danger">{errors.employeeId}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Department</strong> <span className="required">*</span>
                </label>

                <div className={errors.departmentId ? 'react-select-error' : ''}>
                  <CreatableSelect
                    classNamePrefix="react-select"
                    options={departments}
                    value={
                      form.departmentId === 0
                        ? {
                          value: 0,
                          label: departmentInput,
                        }
                        : departments.find(
                          (x) => String(x.value) === String(form.departmentId),
                        ) || null
                    }
                    onChange={(selected) => {
                      setForm({
                        ...form,
                        departmentId: selected?.value || '',
                      })

                      setDepartmentInput((selected?.label || '').toUpperCase())
                      clearError('departmentId')
                    }}
                    onCreateOption={(inputValue) => {
                      const upperValue = inputValue.toUpperCase()

                      setDepartmentInput(upperValue)

                      setForm({
                        ...form,
                        departmentId: 0,
                      })

                      clearError('departmentId')
                    }}
                    formatCreateLabel={(inputValue) =>
                      `Create "${inputValue.toUpperCase()}"`
                    }
                  />
                </div>

                {errors.departmentId && (
                  <small className="text-danger">{errors.departmentId}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Password</strong> <span className="required">*</span>
                </label>

                <CFormInput
                  type="password"
                  name="password"
                  placeholder="Enter Password"
                  value={form.password}
                  className={errors.password ? 'error-input' : ''}
                  onChange={handleChange}
                />

                {errors.password && (
                  <small className="text-danger">{errors.password}</small>
                )}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Confirm Password</strong> <span className="required">*</span>
                </label>

                <CFormInput
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={form.confirmPassword}
                  className={errors.confirmPassword ? 'error-input' : ''}
                  onChange={handleChange}
                />

                {errors.confirmPassword && (
                  <small className="text-danger">{errors.confirmPassword}</small>
                )}
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
            <div className="table-title">Item List</div>

            <CFormInput
              placeholder="Search by Item Number, Name, Group, HSN Code..."
              className="search-box"
              style={{ width: '320px' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredUsers}
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
          <p>Are you sure you want to delete this User?</p>

          <div
            style={{
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '10px',
            }}
          >
            <div>
              <strong>User ID :</strong>{' '}
              <span className="text-primary fw-bold">{deleteUser?.userId}</span>
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

      <CModal
        visible={showPrivilegeModal}
        onClose={() => setShowPrivilegeModal(false)}
        size="lg"
      >
        <CModalHeader className="privilege-header">
          <CModalTitle className="privilege-title">
            <FaUsers className="me-2" />
            User Privilege
            <span className="privilege-user">- {selectedUser?.userName}</span>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          <table className="table table-bordered text-center privilege-table">
            <thead>
              <tr>
                <th>Menus</th>
                <th>
                  All <br />
                  <input
                    type="checkbox"
                    checked={privileges.every(
                      (x) => x.canView && x.canEdit && x.canDelete,
                    )}
                    onChange={(e) => handleHeaderChange('all', e.target.checked)}
                  />
                </th>

                <th>
                  View <br />
                  <input
                    type="checkbox"
                    checked={privileges.every((x) => x.canView)}
                    onChange={(e) =>
                      handleHeaderChange('canView', e.target.checked)
                    }
                  />
                </th>

                <th>
                  Edit <br />
                  <input
                    type="checkbox"
                    checked={privileges.every((x) => x.canEdit)}
                    onChange={(e) =>
                      handleHeaderChange('canEdit', e.target.checked)
                    }
                  />
                </th>

                <th>
                  Delete <br />
                  <input
                    type="checkbox"
                    checked={privileges.every((x) => x.canDelete)}
                    onChange={(e) =>
                      handleHeaderChange('canDelete', e.target.checked)
                    }
                  />
                </th>
              </tr>
            </thead>

            <tbody>
              {MENU_CONFIG.map((menu) => {
                if (menu.items) {
                  return (
                    <React.Fragment key={menu.name}>
                      <tr>
                        <td
                          colSpan="5"
                          style={{
                            fontWeight: '600',
                            background: '#dfe6f1',
                            textAlign: 'left',
                          }}
                        >
                          {menu.name}
                        </td>
                      </tr>

                      {menu.items.map((child) => {
                        const childIndex = privileges.findIndex(
                          (x) => x.menuName === child.name,
                        )

                        const cp = privileges[childIndex] || {}

                        return (
                          <tr key={child.name}>
                            <td
                              className="menu-cell"
                              style={{ paddingLeft: '35px' }}
                            >
                              <div className="d-flex align-items-center gap-2">
                                <CIcon icon={child.icon} size="sm" />
                                {child.name}
                              </div>
                            </td>

                            <td>
                              <input
                                type="checkbox"
                                checked={cp.canView && cp.canEdit && cp.canDelete}
                                onChange={() =>
                                  handlePrivilegeChange(childIndex, 'all')
                                }
                              />
                            </td>

                            <td>
                              <input
                                type="checkbox"
                                checked={cp.canView || false}
                                onChange={() =>
                                  handlePrivilegeChange(childIndex, 'canView')
                                }
                              />
                            </td>

                            <td>
                              <input
                                type="checkbox"
                                checked={cp.canEdit || false}
                                onChange={() =>
                                  handlePrivilegeChange(childIndex, 'canEdit')
                                }
                              />
                            </td>

                            <td>
                              <input
                                type="checkbox"
                                checked={cp.canDelete || false}
                                onChange={() =>
                                  handlePrivilegeChange(childIndex, 'canDelete')
                                }
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  )
                }

                const index = privileges.findIndex((x) => x.menuName === menu.name)
                const p = privileges[index] || {}

                return (
                  <tr key={menu.name}>
                    <td className="menu-cell">
                      <div className="d-flex align-items-center gap-2">
                        <CIcon icon={menu.icon} size="sm" />
                        {menu.name}
                      </div>
                    </td>

                    <td>
                      <input
                        type="checkbox"
                        checked={p.canView && p.canEdit && p.canDelete}
                        onChange={() => handlePrivilegeChange(index, 'all')}
                      />
                    </td>

                    <td>
                      <input
                        type="checkbox"
                        checked={p.canView || false}
                        onChange={() => handlePrivilegeChange(index, 'canView')}
                      />
                    </td>

                    <td>
                      <input
                        type="checkbox"
                        checked={p.canEdit || false}
                        onChange={() => handlePrivilegeChange(index, 'canEdit')}
                      />
                    </td>

                    <td>
                      <input
                        type="checkbox"
                        checked={p.canDelete || false}
                        onChange={() => handlePrivilegeChange(index, 'canDelete')}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CModalBody>

        <CModalFooter className="justify-content-center gap-3">
          <CButton className="privilege-save-btn" onClick={savePrivileges}>
            Save Privilege
          </CButton>

          <CButton
            className="privilege-clear-btn"
            onClick={() => setShowPrivilegeModal(false)}
          >
            Close
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default UserMaster
