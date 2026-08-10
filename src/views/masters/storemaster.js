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
import { FaEdit, FaTrash, FaPlus, FaArrowLeft, FaPen } from 'react-icons/fa'
import { toast } from 'react-toastify'
import Select from 'react-select'
import API from '../../api.js'
import '../../assets/CSS/storeMaster.css'

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

const EMPTY_FORM = {
  storeLocation: '',
  palletTypeId: '',
  colourCode: '#1E88E5',
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

const StoreMaster = () => {
  const locationRef = useRef()
  const colourInputRef = useRef()

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

  const [stores, setStores] = useState([])
  const [palletTypes, setPalletTypes] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  const [errors, setErrors] = useState({
    storeLocation: '',
    palletTypeId: '',
    colourCode: '',
  })

  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deleteStore, setDeleteStore] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    loadStores()
    loadPalletTypes()
  }, [])

  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        locationRef.current?.focus()
      }, 200)
    }
  }, [showForm])

  const clearError = (name) => {
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const loadStores = async () => {
    try {
      const res = await API.get('/StoreMaster')
      setStores(res.data || [])
    } catch {
      toast.error('Failed to load store list')
    }
  }

  const loadPalletTypes = async () => {
    try {
      const res = await API.get('/PalletType')
      setPalletTypes(res.data || [])
    } catch {
      toast.error('Failed to load pallet types')
    }
  }

  const palletTypeOptions = palletTypes.map((p) => {
    const next = p.currentSequence + 1 > p.rangeTo ? p.rangeFrom : p.currentSequence + 1
    return {
      value: p.id,
      label: `${p.palletName} (next: ${p.palletName}-${String(next).padStart(2, '0')})`,
    }
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    clearError(name)
  }

  const validate = () => {
    const temp = {
      storeLocation: '',
      palletTypeId: '',
      colourCode: '',
    }

    if (!form.storeLocation.trim()) temp.storeLocation = 'Store Location is required'
    if (!editId && !form.palletTypeId) temp.palletTypeId = 'Pallet Type is required'

    const colour = form.colourCode.trim()
    if (!colour) {
      temp.colourCode = 'Colour is required'
    } else if (!HEX_REGEX.test(colour)) {
      temp.colourCode = 'Enter a valid hex colour (e.g. #1E88E5)'
    }

    setErrors(temp)

    return !Object.values(temp).some((x) => x)
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      if (editId) {
        // Editing only ever touches Store Location + Colour — Pallet
        // Number/Type are assigned once at creation and never change.
        await API.put(`/StoreMaster/${editId}`, {
          storeLocation: form.storeLocation.trim(),
          colourCode: form.colourCode.trim().toUpperCase(),
        })
        toast.success('Store Updated Successfully')
      } else {
        await API.post('/StoreMaster', {
          storeLocation: form.storeLocation.trim(),
          palletTypeId: Number(form.palletTypeId),
          colourCode: form.colourCode.trim().toUpperCase(),
        })
        toast.success('Store Saved Successfully')
      }

      await loadStores()
      await loadPalletTypes() // refresh "next" preview since a sequence moved
      resetForm()
      setShowForm(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const handleEdit = async (row) => {
    try {
      const res = await API.get(`/StoreMaster/${row.id}`)
      const d = res.data

      setEditId(row.id)
      setShowForm(true)

      setForm({
        storeLocation: d.storeLocation || '',
        palletTypeId: d.palletTypeId || '',
        colourCode: d.colourCode || '#1E88E5',
      })

      setErrors({ storeLocation: '', palletTypeId: '', colourCode: '' })
    } catch {
      toast.error('Failed to load store record')
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setErrors({ storeLocation: '', palletTypeId: '', colourCode: '' })
    setEditId(null)

    setTimeout(() => {
      locationRef.current?.focus()
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
      await API.delete(`/StoreMaster/${deleteId}`)
      toast.success('Deleted Successfully')
      resetForm()
      await loadStores()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeleteStore(null)
    }
  }

  const filteredStores = stores.filter(
    (s) =>
      (s.storeLocation || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.palletNumber || '').toLowerCase().includes(search.toLowerCase()),
  )

  const columns = [
    { name: 'SL.NO', selector: (row, index) => index + 1, width: '90px' },
    { name: 'PALLET NUMBER', selector: (row) => row.palletNumber },
    { name: 'PALLET TYPE', selector: (row) => row.palletTypeName },
    { name: 'STORE LOCATION', selector: (row) => row.storeLocation, wrap: true },
    {
      name: 'COLOUR',
      center: true,
      cell: (row) => <span className="colour-dot" style={{ background: row.colourCode }} />,
    },
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
              setDeleteStore(row)
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
    <div className="store-master-page">
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">Total Store</div>
              <div className="summary-value">{String(stores.length).padStart(2, '0')}</div>
            </div>

            <button className="round-icon-btn add-item-btn" title="Add Store" onClick={handleAddNew}>
              <FaPlus size={16} />
            </button>
          </CCardBody>
        </CCard>
      )}

      {showForm && (
        <CCard className="store-master-form-card mb-3">
          <CCardBody className="store-master-form-card-body">
            <button className="round-icon-btn back-btn card-back-btn" title="Back" onClick={handleBack}>
              <FaArrowLeft size={14} />
            </button>

            <div className="section-title">Basic Information</div>

            <CRow className="g-3">
              <CCol md={4}>
                <label className="custom-label">
                  <strong>Colour Picker</strong> <span className="required">*</span>
                </label>

                <div className={`colour-picker-wrap ${errors.colourCode ? 'error-input' : ''}`}>
                  <span className="colour-swatch" style={{ background: form.colourCode }} />

                  <input
                    type="text"
                    className="colour-hex-input"
                    value={form.colourCode}
                    maxLength={7}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase()
                      setForm({ ...form, colourCode: value })
                      clearError('colourCode')
                    }}
                  />

                  <button
                    type="button"
                    className="colour-edit-btn"
                    title="Pick colour"
                    onClick={() => colourInputRef.current?.click()}
                  >
                    <FaPen size={12} />
                  </button>

                  <input
                    ref={colourInputRef}
                    type="color"
                    className="colour-native-input"
                    value={HEX_REGEX.test(form.colourCode) ? form.colourCode : '#1E88E5'}
                    onChange={(e) => {
                      setForm({ ...form, colourCode: e.target.value.toUpperCase() })
                      clearError('colourCode')
                    }}
                  />
                </div>

                {errors.colourCode && <small className="text-danger">{errors.colourCode}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Store Location</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  ref={locationRef}
                  name="storeLocation"
                  placeholder="Enter Store Location"
                  value={form.storeLocation}
                  className={errors.storeLocation ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.storeLocation && <small className="text-danger">{errors.storeLocation}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Pallet Type</strong> <span className="required">*</span>
                </label>

                {editId ? (
                  <CFormInput
                    value={stores.find((s) => s.id === editId)?.palletNumber || ''}
                    disabled
                  />
                ) : (
                  <>
                    <div className={errors.palletTypeId ? 'react-select-error' : ''}>
                      <Select
                        classNamePrefix="react-select"
                        placeholder="Select Pallet Type"
                        options={palletTypeOptions}
                        value={palletTypeOptions.find((x) => String(x.value) === String(form.palletTypeId)) || null}
                        onChange={(selected) => {
                          setForm({ ...form, palletTypeId: selected?.value || '' })
                          clearError('palletTypeId')
                        }}
                        isClearable
                      />
                    </div>
                    {errors.palletTypeId && <small className="text-danger">{errors.palletTypeId}</small>}
                  </>
                )}
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
            <div className="table-title">Store List</div>

            <CFormInput
              placeholder="Search..."
              className="search-box"
              style={{ width: '320px' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredStores}
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
          <p>Are you sure you want to delete this Store record?</p>

          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
            <div>
              <strong>Pallet Number :</strong>{' '}
              <span className="text-primary fw-bold">{deleteStore?.palletNumber}</span>
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

export default StoreMaster
