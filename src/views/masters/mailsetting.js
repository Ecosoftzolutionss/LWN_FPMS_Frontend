import React, { useState, useEffect } from 'react'
import DataTable from 'react-data-table-component'
import {
  CButton,
  CFormInput,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CModal,
  CModalBody,
  CTooltip,
} from '@coreui/react'
import {
  FaEdit,
  FaTrash,
  FaSave,
  FaEye,
  FaEyeSlash
} from 'react-icons/fa'
import { toast } from 'react-toastify'
import API from '../../api'
import '../../assets/CSS/user.css'
import usePrivilege from '../hooks/usePrivilege.js'

const MailSettings = () => {
  const [selectedMail, setSelectedMail] = useState(null)
  const [mailList, setMailList] = useState([])
  const hasMailSetting = mailList.length > 0
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const { privileges: userPrivileges = [] } = usePrivilege()
  const uPrivilege =
    userPrivileges.find((p) => p.menuName === 'Mail Settings') || {}

  const [form, setForm] = useState({
    host: '',
    port: '',
    fromMail: '',
    passwordHash: '',
    toMail: '',
    ccMail: '',
  })

  const [errors, setErrors] = useState({
    host: '',
    port: '',
    fromMail: '',
    passwordHash: '',
    toMail: '',
    ccMail: '',
  })



  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const res = await API.get('/MailSettings')
      setMailList(res.data || [])
    } catch {
      toast.error('Failed to load data')
    }
  }

  const clearError = (name) => {
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }

  const handleChange = (name, value) => {
    setForm({
      ...form,
      [name]: value,
    })

    clearError(name)
  }

  const resetForm = () => {
    setEditId(null)

    setForm({
      host: '',
      port: '',
      fromMail: '',
      passwordHash: '',
      toMail: '',
      ccMail: '',
    })

    setErrors({
      host: '',
      port: '',
      fromMail: '',
      passwordHash: '',
      toMail: '',
      ccMail: '',
    })
  }

  const validateEmails = (emails) => {
    if (!emails) return true

    const emailArray = emails
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x)

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    return emailArray.every((email) => regex.test(email))
  }

  const getEmailArray = (emails) => {
    return emails
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x)
  }

  const hasDuplicateEmails = (emails) => {
    const arr = getEmailArray(emails)
    return arr.length !== new Set(arr).size
  }

  const validate = () => {
    const newErrors = {
      host: '',
      port: '',
      fromMail: '',
      passwordHash: '',
      toMail: '',
      ccMail: '',
    }

    if (!form.fromMail.trim()) {
      newErrors.fromMail = 'From Email is required'
    } else if (!validateEmails(form.fromMail)) {
      newErrors.fromMail = 'Invalid From Email'
    }

    if (!form.passwordHash.trim()) {
      newErrors.passwordHash = 'Password is required'
    }

    if (!form.host.trim()) {
      newErrors.host = 'Host is required'
    }
    else if (!/^[a-zA-Z0-9.-]+$/.test(form.host.trim())) {
      newErrors.host =
        'Host can contain only letters, numbers, dots (.) and hyphens (-)'
    }

    if (!form.port) {
      newErrors.port = 'Port is required'
    } else if (!/^\d+$/.test(form.port)) {
      newErrors.port = 'Port must contain only numbers'
    }

    if (!form.toMail.trim()) {
      newErrors.toMail = 'To Email is required'
    } else if (!validateEmails(form.toMail)) {
      newErrors.toMail = 'Invalid To Email format. Use comma separated emails'
    }

    if (form.ccMail && !validateEmails(form.ccMail)) {
      newErrors.ccMail = 'Invalid CC Email format. Use comma separated emails'
    }

    const fromMail = form.fromMail.trim().toLowerCase()
    const toEmails = getEmailArray(form.toMail)
    const ccEmails = getEmailArray(form.ccMail || '')

    if (!newErrors.fromMail && fromMail && toEmails.includes(fromMail)) {
      newErrors.toMail = 'From Email cannot be used in To Email'
    }

    if (!newErrors.fromMail && fromMail && ccEmails.includes(fromMail)) {
      newErrors.ccMail = 'From Email cannot be used in CC Email'
    }

    if (!newErrors.toMail && hasDuplicateEmails(form.toMail)) {
      newErrors.toMail = 'Duplicate emails found in To Email'
    }

    if (!newErrors.ccMail && hasDuplicateEmails(form.ccMail)) {
      newErrors.ccMail = 'Duplicate emails found in CC Email'
    }

    const commonEmails = toEmails.filter((email) => ccEmails.includes(email))

    if (!newErrors.toMail && !newErrors.ccMail && commonEmails.length > 0) {
      newErrors.ccMail = 'Same email cannot exist in both To Email and CC Email'
    }

    setErrors(newErrors)

    return !Object.values(newErrors).some((x) => x)
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        host: form.host,
        port: Number(form.port),
        from_Mail: form.fromMail,
        password_Hash: form.passwordHash,
        to_Mail: form.toMail,
        cc_Mail: form.ccMail,
      }

      if (editId) {
        await API.put(`/MailSettings/${editId}`, payload)
        toast.success('Updated Successfully')
      } else {
        await API.post('/MailSettings', payload)
        toast.success('Saved Successfully')
      }

      resetForm()
      loadData()
    } catch (error) {
      toast.error(error?.response?.data || 'Save Failed')
    }
  }

  const handleEdit = (row) => {
    setEditId(row.mail_Setting_ID)

    setForm({
      fromMail: row.from_Mail || '',
      passwordHash: row.password_Hash || '',
      host: row.host || '',
      port: row.port || '',
      toMail: row.to_Mail || '',
      ccMail: row.cC_Mail || '',
    })

    setErrors({
      host: '',
      port: '',
      fromMail: '',
      passwordHash: '',
      toMail: '',
      ccMail: '',
    })
  }

  const confirmDelete = async () => {
    try {
      await API.delete(`/MailSettings/${deleteId}`)

      toast.success('Deleted Successfully')

      setShowDeleteModal(false)
      setDeleteId(null)
      setSelectedMail(null)

      resetForm()
      loadData()
    } catch {
      toast.error('Delete Failed')
    }
  }

  const filteredData = mailList.filter(
    (x) =>
      (x.from_Mail || '').toLowerCase().includes(search.toLowerCase()) ||
      (x.password_Hash || '').toLowerCase().includes(search.toLowerCase()) ||
      (x.host || '').toLowerCase().includes(search.toLowerCase()) ||
      String(x.port || '').toLowerCase().includes(search.toLowerCase()) ||
      (x.to_Mail || '').toLowerCase().includes(search.toLowerCase()) ||
      (x.cC_Mail || '').toLowerCase().includes(search.toLowerCase()),
  )

  const columns = [
    {
      name: 'S.NO',
      cell: (row, index) => index + 1,
      width: '80px',
    },
    {
      name: 'FROM EMAIL',
      cell: (row) => (
        <CTooltip content={row.from_Mail}>
          <span>{row.from_Mail}</span>
        </CTooltip>
      ),
    },
    {
      name: 'HOST',
      cell: (row) => (
        <CTooltip content={row.host}>
          <span>{row.host}</span>
        </CTooltip>
      ),
    },
    {
      name: 'PORT',
      center: true,
      cell: (row) => (
        <CTooltip content={row.port}>
          <span>{row.port}</span>
        </CTooltip>
      ),
    },
    {
      name: 'TO EMAIL',
      cell: (row) => (
        <CTooltip content={row.to_Mail}>
          <span>{row.to_Mail}</span>
        </CTooltip>
      ),
    },
    {
      name: 'CC EMAIL',
      cell: (row) => (
        <CTooltip content={row.cC_Mail}>
          <span>{row.cC_Mail || '-'}</span>
        </CTooltip>
      ),
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
                setDeleteId(row.mail_Setting_ID)
                setSelectedMail(row)
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
          <div className="section-title">
            {editId ? 'UPDATE MAIL SETTINGS' : 'MAIL SETTINGS'}
          </div>

          <CRow className="g-3">
            <CCol md={6}>
              <label className="custom-label">
                From Email <span className="required">*</span>
              </label>

              <CFormInput
                placeholder="Enter from email"
                value={form.fromMail}
                className={errors.fromMail ? 'error-input' : ''}
                onChange={(e) => handleChange('fromMail', e.target.value)}
              />

              {errors.fromMail && (
                <div className="field-error">{errors.fromMail}</div>
              )}
            </CCol>

            <CCol md={6}>
              <label className="custom-label">
                Password <span className="required">*</span>
              </label>

              <div style={{ position: 'relative' }}>
                <CFormInput
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={form.passwordHash}
                  className={errors.passwordHash ? 'error-input' : ''}
                  onChange={(e) => handleChange('passwordHash', e.target.value)}
                  style={{ paddingRight: '40px' }}
                />

                <span
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#6c757d',
                    fontSize: '16px'
                  }}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>

              {errors.passwordHash && (
                <div className="field-error">{errors.passwordHash}</div>
              )}
            </CCol>

            <CCol md={6}>
              <label className="custom-label">
                Host <span className="required">*</span>
              </label>

              <CFormInput
                placeholder="Enter host"
                value={form.host}
                className={errors.host ? 'error-input' : ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^a-zA-Z0-9.-]/g, '')
                  handleChange('host', value)
                }}
              />

              {errors.host && <div className="field-error">{errors.host}</div>}
            </CCol>

            <CCol md={6}>
              <label className="custom-label">
                Port <span className="required">*</span>
              </label>

              <CFormInput
                placeholder="Enter port"
                value={form.port}
                className={errors.port ? 'error-input' : ''}
                maxLength={5}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  handleChange('port', value)
                }}
              />

              {errors.port && <div className="field-error">{errors.port}</div>}
            </CCol>

            <CCol md={6}>
              <label className="custom-label">
                To Email <span className="required">*</span>
              </label>

              <CFormInput
                placeholder="Enter to email"
                value={form.toMail}
                className={errors.toMail ? 'error-input' : ''}
                onChange={(e) => handleChange('toMail', e.target.value)}
              />

              {errors.toMail && (
                <div className="field-error">{errors.toMail}</div>
              )}
            </CCol>

            <CCol md={6}>
              <label className="custom-label">CC Email</label>

              <CFormInput
                placeholder="Enter cc email"
                value={form.ccMail}
                className={errors.ccMail ? 'error-input' : ''}
                onChange={(e) => handleChange('ccMail', e.target.value)}
              />

              {errors.ccMail && (
                <div className="field-error">{errors.ccMail}</div>
              )}
            </CCol>
          </CRow>

          <div className="form-button-area">
            <CButton
              className={editId ? 'update-btn' : 'save-btn'}
              onClick={handleSubmit}
              disabled={!editId && hasMailSetting}
            >
              <FaSave className="me-2" />
              {editId ? 'UPDATE' : 'SAVE'}
            </CButton>

            <CButton className="clear-btn" onClick={resetForm}>
              CLEAR
            </CButton>
          </div>
        </CCardBody>
      </CCard>

      <CCard className="mt-3">
        <CCardBody>
          <div className="table-header">
            <div className="table-title">MAIL SETTINGS LIST</div>

            <CFormInput
              placeholder="Search..."
              className="search-box"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredData}
            pagination
            striped
            responsive
            highlightOnHover
          />
        </CCardBody>
      </CCard>

      <CModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        alignment="center"
        backdrop="static"
      >
        <CModalBody className="text-center p-4">
          <div
            style={{
              fontSize: '32px',
              color: '#f0ad4e',
              marginBottom: '10px',
            }}
          >
            ⚠
          </div>

          <h4
            style={{
              color: '#e55353',
              fontWeight: '600',
              marginBottom: '20px',
            }}
          >
            Confirm Delete
          </h4>

          <p
            style={{
              fontSize: '16px',
              marginBottom: '20px',
            }}
          >
            Are you sure you want to delete this Mail Setting?
          </p>

          <div
            style={{
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '25px',
            }}
          >
            <strong>From Email :</strong>{' '}
            <span style={{ color: '#4f46e5' }}>
              {selectedMail?.from_Mail}
            </span>
          </div>

          <div className="d-flex justify-content-center gap-2">
            <CButton
              color="secondary"
              onClick={() => {
                setShowDeleteModal(false)
                setSelectedMail(null)
              }}
            >
              Cancel
            </CButton>

            <CButton color="danger" onClick={confirmDelete}>
              Delete
            </CButton>
          </div>
        </CModalBody>
      </CModal>
    </div>
  )
}

export default MailSettings