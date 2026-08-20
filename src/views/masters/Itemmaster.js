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
import CreatableSelect from 'react-select/creatable'
import Select from 'react-select'
import API from '../../api.js'
import '../../assets/CSS/itemMaster.css'
import usePrivilege from '../hooks/usePrivilege.js'

const EMPTY_FORM = {
  itemNumber: '',
  itemName: '',
  itemTypeId: '',
  itemGroupId: '',
  hsnCode: '',
  unitPrice: '',
  uom: '',
  weightPerUnit: '',
  stuffQuantity: '',
  itemModel: '',
  usage: '',
  length: '',
  width: '',
  height: '',
  description: '',
  safetyLevel: '',
  reorderLevel: '',
  dangerLevel: '',
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

const ItemMaster = () => {
  const itemNameRef = useRef()

 const customStyles = {
  rows: {
    style: {
      minHeight: '34px',
    },
  },

  headCells: {
    style: {
      justifyContent: 'center',
      fontSize: '13px',
      fontWeight: '700',
      paddingTop: '6px',
      paddingBottom: '6px',
      whiteSpace: 'normal',
      overflow: 'visible',
      textOverflow: 'clip',
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

  const [items, setItems] = useState([])
  const [itemGroups, setItemGroups] = useState([])
  const [itemTypes, setItemTypes] = useState([])
  const [itemTypeInput, setItemTypeInput] = useState('')

  // UOM dropdown — same CreatableSelect pattern as Item Type. Options
  // come from GET /ItemMaster/uom-list; the value is stored as a plain
  // string on form.uom (ItemMaster.Uom is a string column, not a FK).
  const [uomOptions, setUomOptions] = useState([])

  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  const [errors, setErrors] = useState({
    itemNumber: '',
    itemName: '',
    itemTypeId: '',
    itemGroupId: '',
    unitPrice: '',
    uom: '',
    safetyLevel: '',
    reorderLevel: '',
    dangerLevel: '',
  })

  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const { privileges: userPrivileges = [] } = usePrivilege()
  const uPrivilege = userPrivileges.find((p) => p.menuName === 'Item Master') || {}

  useEffect(() => {
    loadItems()
    loadItemGroups()
    loadItemTypes()
    loadUomOptions()
  }, [])

  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        itemNameRef.current?.focus()
      }, 200)
    }
  }, [showForm])

  const clearError = (name) => {
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }

  const loadItems = async () => {
    try {
      const res = await API.get('/ItemMaster')
      setItems(res.data || [])
    } catch {
      toast.error('Failed to load items')
    }
  }

  const loadItemGroups = async () => {
    try {
      const res = await API.get('/ItemGroup')
      setItemGroups(res.data || [])
    } catch {
      toast.error('Failed to load item groups')
    }
  }

  const loadItemTypes = async () => {
    try {
      const res = await API.get('/ItemMaster/item-types')
      setItemTypes(res.data || [])
    } catch {
      toast.error('Failed to load item types')
    }
  }

  const loadUomOptions = async () => {
    try {
      const res = await API.get('/ItemMaster/uom-list')
      setUomOptions(res.data || [])
    } catch {
      toast.error('Failed to load UOM list')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    clearError(name)
  }

  const validate = () => {
    const temp = {
      itemNumber: '',
      itemName: '',
      itemTypeId: '',
      itemGroupId: '',
      unitPrice: '',
      uom: '',
      safetyLevel: '',
      reorderLevel: '',
      dangerLevel: '',
    }

    const itemNumber = form.itemNumber.trim()

    if (!itemNumber) {
      temp.itemNumber = 'Item Number is required'
    } else if (
      items.some(
        (i) =>
          i.itemNumber?.trim().toLowerCase() === itemNumber.toLowerCase() &&
          i.id !== editId,
      )
    ) {
      temp.itemNumber = 'Item Number already exists'
    }

    const itemName = form.itemName.trim()

    if (!itemName) {
      temp.itemName = 'Item Name is required'
    } else if (
      items.some(
        (i) =>
          i.itemName?.trim().toLowerCase() === itemName.toLowerCase() &&
          i.id !== editId,
      )
    ) {
      temp.itemName = 'Item Name already exists'
    }

    if (!form.itemTypeId && !itemTypeInput) temp.itemTypeId = 'Item Type is required'
    if (!form.itemGroupId) temp.itemGroupId = 'Item Group is required'
    if (form.unitPrice === '' || form.unitPrice === null) temp.unitPrice = 'Unit Price is required'
    if (!form.uom.trim()) temp.uom = 'UOM is required'
    if (form.safetyLevel === '' || form.safetyLevel === null) temp.safetyLevel = 'Safety Level is required'
    if (form.reorderLevel === '' || form.reorderLevel === null) temp.reorderLevel = 'Reorder Level is required'
    if (!form.dangerLevel.trim()) temp.dangerLevel = 'Danger Level is required'

    setErrors(temp)

    return !Object.values(temp).some((x) => x)
  }

  const toNumberOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      const payload = {
        itemNumber: form.itemNumber.trim(),
        itemName: form.itemName.trim(),
        itemTypeId: Number(form.itemTypeId) || 0,
        itemTypeName: itemTypeInput,
        itemGroupId: Number(form.itemGroupId),
        hsnCode: form.hsnCode.trim(),
        unitPrice: Number(form.unitPrice) || 0,
        uom: form.uom.trim(),
        weightPerUnit: toNumberOrNull(form.weightPerUnit),
        stuffQuantity: toNumberOrNull(form.stuffQuantity),
        itemModel: form.itemModel.trim(),
        usage: form.usage.trim(),
        length: toNumberOrNull(form.length),
        width: toNumberOrNull(form.width),
        height: toNumberOrNull(form.height),
        description: form.description.trim(),
        safetyLevel: Number(form.safetyLevel) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        dangerLevel: form.dangerLevel.trim(),
      }

      if (editId) {
        await API.put(`/ItemMaster/${editId}`, payload)
        toast.success('Item Updated Successfully')
      } else {
        await API.post('/ItemMaster', payload)
        toast.success('Item Saved Successfully')
      }

      await loadItems()
      await loadItemTypes()
      await loadUomOptions()
      resetForm()
      setShowForm(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Save Failed'))
    }
  }

  const handleEdit = async (row) => {
    try {
      const res = await API.get(`/ItemMaster/${row.id}`)
      const d = res.data

      setEditId(row.id)
      setShowForm(true)

      setForm({
        itemNumber: d.itemNumber || '',
        itemName: d.itemName || '',
        itemTypeId: d.itemTypeId || '',
        itemGroupId: d.itemGroupId || '',
        hsnCode: d.hsnCode || '',
        unitPrice: d.unitPrice ?? '',
        uom: d.uom || '',
        weightPerUnit: d.weightPerUnit ?? '',
        stuffQuantity: d.stuffQuantity ?? '',
        itemModel: d.itemModel || '',
        usage: d.usage || '',
        length: d.length ?? '',
        width: d.width ?? '',
        height: d.height ?? '',
        description: d.description || '',
        safetyLevel: d.safetyLevel ?? '',
        reorderLevel: d.reorderLevel ?? '',
        dangerLevel: d.dangerLevel || '',
      })

      setItemTypeInput(d.itemTypeName || '')

      setErrors({
        itemNumber: '',
        itemName: '',
        itemTypeId: '',
        itemGroupId: '',
        unitPrice: '',
        uom: '',
        safetyLevel: '',
        reorderLevel: '',
        dangerLevel: '',
      })
    } catch {
      toast.error('Failed to load item')
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setItemTypeInput('')

    setErrors({
      itemNumber: '',
      itemName: '',
      itemTypeId: '',
      itemGroupId: '',
      unitPrice: '',
      uom: '',
      safetyLevel: '',
      reorderLevel: '',
      dangerLevel: '',
    })

    setEditId(null)

    setTimeout(() => {
      itemNameRef.current?.focus()
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
      await API.delete(`/ItemMaster/${deleteId}`)
      toast.success('Deleted Successfully')
      resetForm()
      await loadItems()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteModal(false)
      setDeleteId(null)
      setDeleteItem(null)
    }
  }

  const filteredItems = items.filter(
    (i) =>
      (i.itemName || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.itemNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.itemGroupName || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.hsnCode || '').toLowerCase().includes(search.toLowerCase()),
  )

  const itemGroupOptions = itemGroups.map((g) => ({ value: g.id, label: g.groupName }))

  // Wraps a cell's value in a CoreUI tooltip so the full text shows
  // on hover — same pattern as SupplierMaster.jsx.
  const TooltipCell = ({ value }) => {
    if (value === null || value === undefined || value === '') return <span>—</span>
    return (
      <CTooltip content={value} placement="top">
        <span className="item-table-cell-text">{value}</span>
      </CTooltip>
    )
  }

const columns = [
  {
    name: 'SL.NO',
    selector: (row, index) => index + 1,
    width: '90px',
    center: true,
  },
  {
    name: 'ITEM NUMBER',
    selector: (row) => row.itemNumber,
    minWidth: '150px',
    width: '150px',
    cell: (row) => <TooltipCell value={row.itemNumber} />,
  },
  {
    name: 'ITEM NAME',
    selector: (row) => row.itemName,
    minWidth: '120px',
    wrap: true,
    cell: (row) => <TooltipCell value={row.itemName} />,
  },
  {
    name: 'ITEM TYPE',
    selector: (row) => row.itemTypeName,
    minWidth: '130px',
    wrap: true,
    cell: (row) => <TooltipCell value={row.itemTypeName} />,
  },
  {
    name: 'ITEM GROUP',
    selector: (row) => row.itemGroupName,
    minWidth: '120px',
    wrap: true,
    cell: (row) => <TooltipCell value={row.itemGroupName} />,
  },
  {
    name: 'HSN CODE',
    selector: (row) => row.hsnCode,
    minWidth: '130px',
    cell: (row) => <TooltipCell value={row.hsnCode} />,
  },
  {
    name: 'UNIT PRICE (₹)',
    selector: (row) => row.unitPrice,
    minWidth: '150px',
    width: '150px',
    center: true,
    cell: (row) => (
      <TooltipCell value={Number(row.unitPrice || 0).toFixed(2)} />
    ),
  },
  {
    name: 'DESCRIPTION',
    selector: (row) => row.description,
    minWidth: '130px',
    wrap: true,
    cell: (row) => <TooltipCell value={row.description} />,
  },
  {
    name: 'STUFF QUANTITY',
    selector: (row) => row.stuffQuantity,
    minWidth: '160px',
    width: '160px',
    center: true,
    cell: (row) => <TooltipCell value={row.stuffQuantity} />,
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
            setDeleteItem(row)
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
    <div className="item-master-page">
      {!showForm && (
        <CCard className="mb-3">
          <CCardBody className="summary-card-body">
            <div>
              <div className="summary-label">Total Item</div>
              <div className="summary-value">{String(items.length).padStart(2, '0')}</div>
            </div>

            <button className="round-icon-btn add-item-btn" title="Add Item" onClick={handleAddNew}>
              <FaPlus size={16} />
            </button>
          </CCardBody>
        </CCard>
      )}

      {showForm && (
        <CCard className="item-master-form-card mb-3">
          <CCardBody className="item-master-form-card-body">
            <button className="round-icon-btn back-btn card-back-btn" title="Back" onClick={handleBack}>
              <FaArrowLeft size={14} />
            </button>

            <div className="section-title">Basic Information</div>

            <CRow className="g-3">
              <CCol md={4}>
                <label className="custom-label">
                  <strong>Item Number</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="itemNumber"
                  placeholder="Enter Item Number"
                  value={form.itemNumber}
                  className={errors.itemNumber ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.itemNumber && <small className="text-danger">{errors.itemNumber}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Item Name</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  ref={itemNameRef}
                  name="itemName"
                  placeholder="Enter Item Name"
                  value={form.itemName}
                  className={errors.itemName ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.itemName && <small className="text-danger">{errors.itemName}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Item Type</strong> <span className="required">*</span>
                </label>

                <div className={errors.itemTypeId ? 'react-select-error' : ''}>
                  <CreatableSelect
                    classNamePrefix="react-select"
                    placeholder="Select or type Item Type"
                    options={itemTypes}
                    value={
                      form.itemTypeId === 0
                        ? { value: 0, label: itemTypeInput }
                        : itemTypes.find((x) => String(x.value) === String(form.itemTypeId)) || null
                    }
                    onChange={(selected) => {
                      setForm({ ...form, itemTypeId: selected?.value || '' })
                      setItemTypeInput((selected?.label || '').toUpperCase())
                      clearError('itemTypeId')
                    }}
                    onCreateOption={(inputValue) => {
                      const upperValue = inputValue.toUpperCase()
                      setItemTypeInput(upperValue)
                      setForm({ ...form, itemTypeId: 0 })
                      clearError('itemTypeId')
                    }}
                    formatCreateLabel={(inputValue) => `Create "${inputValue.toUpperCase()}"`}
                  />
                </div>

                {errors.itemTypeId && <small className="text-danger">{errors.itemTypeId}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Item Group</strong> <span className="required">*</span>
                </label>
                <div className={errors.itemGroupId ? 'react-select-error' : ''}>
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Item Group"
                    options={itemGroupOptions}
                    value={itemGroupOptions.find((x) => String(x.value) === String(form.itemGroupId)) || null}
                    onChange={(selected) => {
                      setForm({ ...form, itemGroupId: selected?.value || '' })
                      clearError('itemGroupId')
                    }}
                    isClearable
                  />
                </div>
                {errors.itemGroupId && <small className="text-danger">{errors.itemGroupId}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label"><strong>HSN Code</strong></label>
                <CFormInput
                  name="hsnCode"
                  placeholder="Enter HSN Code"
                  value={form.hsnCode}
                  onChange={handleChange}
                />
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Unit Price</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  type="number"
                  name="unitPrice"
                  placeholder="Enter Unit Price"
                  value={form.unitPrice}
                  className={errors.unitPrice ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.unitPrice && <small className="text-danger">{errors.unitPrice}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>UOM</strong> <span className="required">*</span>
                </label>

                {/* Changed from free-text input to CreatableSelect —
                    same dropdown-with-add-new pattern as Item Type. */}
                <div className={errors.uom ? 'react-select-error' : ''}>
                  <CreatableSelect
                    classNamePrefix="react-select"
                    placeholder="Select or type UOM (e.g. KG, PCS)"
                    options={uomOptions}
                    value={form.uom ? { value: form.uom, label: form.uom } : null}
                    onChange={(selected) => {
                      setForm({ ...form, uom: selected?.value || '' })
                      clearError('uom')
                    }}
                    onCreateOption={(inputValue) => {
                      const upperValue = inputValue.toUpperCase()
                      setForm({ ...form, uom: upperValue })
                      clearError('uom')
                    }}
                    formatCreateLabel={(inputValue) => `Create "${inputValue.toUpperCase()}"`}
                  />
                </div>

                {errors.uom && <small className="text-danger">{errors.uom}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label"><strong>Weight (per Unit)</strong></label>
                <div className="input-with-suffix">
                  <CFormInput
                    type="number"
                    name="weightPerUnit"
                    placeholder="Enter Weight"
                    value={form.weightPerUnit}
                    onChange={handleChange}
                  />
                  <span className="input-suffix">KG</span>
                </div>
              </CCol>

              <CCol md={4}>
                <label className="custom-label"><strong>Stuff Quantity</strong></label>
                <CFormInput
                  type="number"
                  name="stuffQuantity"
                  placeholder="Enter Stuff Quantity"
                  value={form.stuffQuantity}
                  onChange={handleChange}
                />
              </CCol>

              <CCol md={4}>
                <label className="custom-label"><strong>Item Model</strong></label>
                <CFormInput
                  name="itemModel"
                  placeholder="Enter Model"
                  value={form.itemModel}
                  onChange={handleChange}
                />
              </CCol>

              <CCol md={4}>
                <label className="custom-label"><strong>Usage</strong></label>
                <CFormInput
                  name="usage"
                  placeholder="Enter Usage"
                  value={form.usage}
                  onChange={handleChange}
                />
              </CCol>

              <CCol md={4}>
                <label className="custom-label"><strong>Dimension (L x W x H)</strong></label>
                <div className="dimension-row">
                  <CFormInput
                    type="number"
                    name="length"
                    placeholder="Length"
                    value={form.length}
                    onChange={handleChange}
                  />
                  <CFormInput
                    type="number"
                    name="width"
                    placeholder="Width"
                    value={form.width}
                    onChange={handleChange}
                  />
                  <CFormInput
                    type="number"
                    name="height"
                    placeholder="Height"
                    value={form.height}
                    onChange={handleChange}
                  />
                  <span className="input-suffix">mm</span>
                </div>
              </CCol>

              <CCol md={4}>
                <label className="custom-label"><strong>Description</strong></label>
                <CFormInput
                  name="description"
                  placeholder="Enter Item Description"
                  value={form.description}
                  onChange={handleChange}
                />
              </CCol>
            </CRow>

            <div className="section-title stock-section-title">Stock Level Information</div>

            <CRow className="g-3">
              <CCol md={4}>
                <label className="custom-label">
                  <strong>Safety Level</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  type="number"
                  name="safetyLevel"
                  placeholder="Enter Safety Level"
                  value={form.safetyLevel}
                  className={errors.safetyLevel ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.safetyLevel && <small className="text-danger">{errors.safetyLevel}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Reorder Level</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  type="number"
                  name="reorderLevel"
                  placeholder="Enter Reorder Level"
                  value={form.reorderLevel}
                  className={errors.reorderLevel ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.reorderLevel && <small className="text-danger">{errors.reorderLevel}</small>}
              </CCol>

              <CCol md={4}>
                <label className="custom-label">
                  <strong>Danger Level</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="dangerLevel"
                  placeholder="Enter Danger Level"
                  value={form.dangerLevel}
                  className={errors.dangerLevel ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.dangerLevel && <small className="text-danger">{errors.dangerLevel}</small>}
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
            data={filteredItems}
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
          <p>Are you sure you want to delete this Item?</p>

          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
            <div>
              <strong>Item Number :</strong>{' '}
              <span className="text-primary fw-bold">{deleteItem?.itemNumber}</span>
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

export default ItemMaster
