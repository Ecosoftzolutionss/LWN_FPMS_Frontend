import React, { useEffect, useState } from 'react'
import { CButton, CFormInput, CCard, CCardBody } from '@coreui/react'
import { FaBoxOpen, FaCheckCircle, FaHistory, FaTrash } from 'react-icons/fa'
import { toast } from 'react-toastify'
import Select from 'react-select'
import API from '../../api.js'
import '../../assets/CSS/materialIssue.css'

const EMPTY_FORM = {
  itemId: '',
  quantity: '',
  issuedTo: '',
  issuedBy: '',
  storeLocation: '',
  remarks: '',
}

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.message || data.error) return data.message || data.error
  return fallback
}

const formatDateTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const MaterialIssue = () => {
  const [items, setItems] = useState([])
  const [issues, setIssues] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [showHistory, setShowHistory] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadItems()
    loadIssues()
  }, [])

  const loadItems = async () => {
    try {
      const res = await API.get('/ItemMaster')
      setItems(res.data || [])
    } catch {
      toast.error('Failed to load parts list')
    }
  }

  const loadIssues = async () => {
    try {
      const res = await API.get('/MaterialIssue')
      setIssues(res.data || [])
    } catch {
      toast.error('Failed to load issue history')
    }
  }

  const itemOptions = items.map((i) => ({
    value: i.id,
    label: `${i.itemNumber} — ${i.itemName}`,
    uom: i.uom,
  }))

  const selectedItem = itemOptions.find((x) => String(x.value) === String(form.itemId))

  const clearError = (name) => setErrors((prev) => ({ ...prev, [name]: '' }))

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    clearError(name)
  }

  const validate = () => {
    const temp = {}

    if (!form.itemId) temp.itemId = 'Part Number is required'
    if (!form.quantity || Number(form.quantity) <= 0) temp.quantity = 'Enter a valid quantity'
    if (!form.issuedTo.trim()) temp.issuedTo = 'Issued To is required'
    if (!form.issuedBy.trim()) temp.issuedBy = 'Issued By is required'

    setErrors(temp)
    return Object.keys(temp).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        itemId: Number(form.itemId),
        quantity: Number(form.quantity),
        issuedTo: form.issuedTo.trim(),
        issuedBy: form.issuedBy.trim(),
        storeLocation: form.storeLocation.trim(),
        remarks: form.remarks.trim(),
      }

      const res = await API.post('/MaterialIssue', payload)
      toast.success(`Material Issued Successfully (${res.data.issueNumber})`)
      setForm(EMPTY_FORM)
      setErrors({})
      await loadIssues()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Issue Failed'))
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    setForm(EMPTY_FORM)
    setErrors({})
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material issue record?')) return

    try {
      await API.delete(`/MaterialIssue/${id}`)
      toast.success('Deleted Successfully')
      await loadIssues()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    }
  }

  return (
    <div className="material-issue-page">
      {!showHistory ? (
        <CCard className="mi-form-card">
          <CCardBody>
            <div className="mi-header">
              <FaBoxOpen size={18} />
              <div>
                <div className="mi-title">Material Issue</div>
                <div className="mi-subtitle">Issue stock out to a department or person</div>
              </div>
            </div>

            <div className="mi-field">
              <label className="custom-label">Part Number *</label>
              <div className={errors.itemId ? 'react-select-error' : ''}>
                <Select
                  classNamePrefix="react-select"
                  placeholder="Select Part Number"
                  options={itemOptions}
                  value={selectedItem || null}
                  onChange={(selected) => {
                    setForm({ ...form, itemId: selected?.value || '' })
                    clearError('itemId')
                  }}
                  isClearable
                />
              </div>
              {errors.itemId && <small className="text-danger">{errors.itemId}</small>}
            </div>

            <div className="mi-field">
              <label className="custom-label">Quantity {selectedItem?.uom ? `(${selectedItem.uom})` : ''} *</label>
              <CFormInput
                type="number"
                name="quantity"
                placeholder="Enter quantity to issue"
                value={form.quantity}
                className={errors.quantity ? 'error-input' : ''}
                onChange={handleChange}
              />
              {errors.quantity && <small className="text-danger">{errors.quantity}</small>}
            </div>

            <div className="mi-field">
              <label className="custom-label">Issued To *</label>
              <CFormInput
                name="issuedTo"
                placeholder="Department / person receiving the material"
                value={form.issuedTo}
                className={errors.issuedTo ? 'error-input' : ''}
                onChange={handleChange}
              />
              {errors.issuedTo && <small className="text-danger">{errors.issuedTo}</small>}
            </div>

            <div className="mi-field">
              <label className="custom-label">Issued By *</label>
              <CFormInput
                name="issuedBy"
                placeholder="Your name"
                value={form.issuedBy}
                className={errors.issuedBy ? 'error-input' : ''}
                onChange={handleChange}
              />
              {errors.issuedBy && <small className="text-danger">{errors.issuedBy}</small>}
            </div>

            <div className="mi-field">
              <label className="custom-label">Store Location</label>
              <CFormInput
                name="storeLocation"
                placeholder="Where this was picked from (optional)"
                value={form.storeLocation}
                onChange={handleChange}
              />
            </div>

            <div className="mi-field">
              <label className="custom-label">Remarks</label>
              <textarea
                name="remarks"
                className="mi-remarks-input"
                placeholder="Any additional notes (optional)"
                value={form.remarks}
                onChange={handleChange}
                rows={3}
              />
            </div>

            <div className="mi-btn-area">
              <CButton className="mi-submit-btn" onClick={handleSubmit} disabled={saving}>
                <FaCheckCircle size={14} /> {saving ? 'Issuing...' : 'Issue Material'}
              </CButton>
              <CButton className="mi-clear-btn" onClick={handleClear}>
                Clear
              </CButton>
            </div>

            <button className="mi-history-link" onClick={() => setShowHistory(true)}>
              <FaHistory size={12} /> View Issue History ({issues.length})
            </button>
          </CCardBody>
        </CCard>
      ) : (
        <CCard className="mi-history-card">
          <CCardBody>
            <div className="mi-header">
              <FaHistory size={18} />
              <div>
                <div className="mi-title">Issue History</div>
                <div className="mi-subtitle">{issues.length} record(s)</div>
              </div>
            </div>

            {issues.length === 0 ? (
              <div className="mi-empty">No material issued yet</div>
            ) : (
              <div className="mi-history-list">
                {issues.map((i) => (
                  <div key={i.id} className="mi-history-item">
                    <div className="mi-history-top">
                      <span className="mi-history-number">{i.issueNumber}</span>
                      <button className="mi-history-delete" onClick={() => handleDelete(i.id)}>
                        <FaTrash size={12} />
                      </button>
                    </div>
                    <div className="mi-history-part">{i.partNumber} — {i.partName}</div>
                    <div className="mi-history-row">
                      <span>Qty: <strong>{i.quantity}</strong></span>
                      <span>To: <strong>{i.issuedTo}</strong></span>
                    </div>
                    <div className="mi-history-row">
                      <span>By: <strong>{i.issuedBy}</strong></span>
                      <span>{formatDateTime(i.issueDate)}</span>
                    </div>
                    {i.remarks && <div className="mi-history-remarks">"{i.remarks}"</div>}
                  </div>
                ))}
              </div>
            )}

            <button className="mi-history-link" onClick={() => setShowHistory(false)}>
              ← Back to Issue Form
            </button>
          </CCardBody>
        </CCard>
      )}
    </div>
  )
}

export default MaterialIssue
