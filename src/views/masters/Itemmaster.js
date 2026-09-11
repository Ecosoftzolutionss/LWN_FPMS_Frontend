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
  itemGroupId: '',
  hsnCode: '',
  unitPrice: '',
  customerOrSupplier: '',
  effectiveDate: '',
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
  const itemNumberRef = useRef()
  const effectiveDateRef = useRef()

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

  // UOM dropdown — options come from the Item Master UOM API.
  // come from GET /ItemMaster/uom-list; the value is stored as a plain
  // string on form.uom (ItemMaster.Uom is a string column, not a FK).
  const [uomOptions, setUomOptions] = useState([])
  const [uomInputValue, setUomInputValue] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)


  const [form, setForm] = useState(EMPTY_FORM)

  const [errors, setErrors] = useState({
    itemNumber: '',
    itemName: '',
    itemGroupId: '',
    unitPrice: '',
    customerOrSupplier: '',
    effectiveDate: '',
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
  const uPrivilege = userPrivileges.find((p) => p.menuName === 'Part Master') || {}

  useEffect(() => {
    loadItems()
    loadItemGroups()
    loadUomOptions()
  }, [])

  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        itemNumberRef.current?.focus()
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

  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const validate = () => {
    const temp = {
      itemNumber: '',
      itemName: '',
      itemGroupId: '',
      unitPrice: '',
      customerOrSupplier: '',
      effectiveDate: '',
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
    if (!form.itemGroupId) temp.itemGroupId = 'Item Group is required'
    if (form.unitPrice === '' || form.unitPrice === null) temp.unitPrice = 'Unit Price is required'
    if (!form.customerOrSupplier) temp.customerOrSupplier = 'Customer / Supplier is required'
    if (!form.effectiveDate) {
      temp.effectiveDate = 'Effective Date is required'
    } else if (form.effectiveDate < getTodayDate()) {
      temp.effectiveDate = 'Effective Date cannot be a past date'
    }
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
        itemGroupId: Number(form.itemGroupId),
        hsnCode: form.hsnCode.trim(),
        unitPrice: Number(form.unitPrice) || 0,
        customerOrSupplier: form.customerOrSupplier,
        effectiveDate: form.effectiveDate,
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
      await loadUomOptions()
      resetForm()
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
        itemGroupId: d.itemGroupId || '',
        hsnCode: d.hsnCode || '',
        unitPrice: d.unitPrice ?? '',
        customerOrSupplier: d.customerOrSupplier || '',
        effectiveDate: d.effectiveDate ? d.effectiveDate.substring(0, 10) : '',
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

      setErrors({
        itemNumber: '',
        itemName: '',
        itemGroupId: '',
        unitPrice: '',
        customerOrSupplier: '',
        effectiveDate: '',
        uom: '',
        safetyLevel: '',
        reorderLevel: '',
        dangerLevel: '',
      })

      // Show the edit form
      setShowForm(true)

      // Scroll page to the top
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        })

        // Focus Part Number
        itemNumberRef.current?.focus()
      }, 200)
    } catch {
      toast.error('Failed to load item')
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)


    setErrors({
      itemNumber: '',
      itemName: '',
      itemGroupId: '',
      unitPrice: '',
      customerOrSupplier: '',
      effectiveDate: '',
      uom: '',
      safetyLevel: '',
      reorderLevel: '',
      dangerLevel: '',
    })

    setEditId(null)

    setTimeout(() => {
      itemNumberRef.current?.focus()
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

  // Dimensions are relevant only for PCS items. Hide and clear them for other UOMs.
  const showDimension = String(form.uom || '').trim().toUpperCase() === 'PCS'

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
      name: 'S.NO',
      width: '90px',
      center: true,
      cell: (row, index) =>
        (currentPage - 1) * rowsPerPage + index + 1,
    },
    {
      name: 'PART NUMBER',
      selector: (row) => row.itemNumber,
      minWidth: '150px',
      width: '150px',
      cell: (row) => <TooltipCell value={row.itemNumber} />,
    },
    {
      name: 'PART NAME',
      selector: (row) => row.itemName,
      minWidth: '120px',
      wrap: true,
      cell: (row) => <TooltipCell value={row.itemName} />,
    },
    {
      name: 'PART GROUP',
      selector: (row) => row.itemGroupName,
      minWidth: '120px',
      wrap: true,
      cell: (row) => <TooltipCell value={row.itemGroupName} />,
    },
    {
      name: 'HSN /SAC CODE',
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
      name: 'CUSTOMER / SUPPLIER',
      selector: (row) => row.customerOrSupplier,
      minWidth: '170px',
      width: '170px',
      center: true,
      cell: (row) => <TooltipCell value={row.customerOrSupplier} />,
    },
    {
      name: 'EFFECTIVE DATE',
      selector: (row) => row.effectiveDate,
      minWidth: '140px',
      width: '140px',
      center: true,
      cell: (row) => (
        <TooltipCell
          value={
            row.effectiveDate
              ? new Date(row.effectiveDate).toLocaleDateString('en-GB')
              : '—'
          }
        />
      ),
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
      name: 'DESCRIPTION',
      selector: (row) => row.description,
      minWidth: '130px',
      wrap: true,
      cell: (row) => <TooltipCell value={row.description} />,
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
              <div className="summary-label">Total Parts</div>
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
              <CCol md={3}>
                <label className="custom-label">
                  <strong>Part Number</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  ref={itemNumberRef}
                  name="itemNumber"
                  placeholder="Enter Part Number"
                  value={form.itemNumber}
                  className={errors.itemNumber ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.itemNumber && <small className="text-danger">{errors.itemNumber}</small>}
              </CCol>
              <CCol md={3}>
                <label className="custom-label">
                  <strong>Part Name</strong> <span className="required">*</span>
                </label>
                <CFormInput
                  name="itemName"
                  placeholder="Enter Part Name"
                  value={form.itemName}
                  className={errors.itemName ? 'error-input' : ''}
                  onChange={handleChange}
                />
                {errors.itemName && <small className="text-danger">{errors.itemName}</small>}
              </CCol>
              <CCol md={3}>
                <label className="custom-label">
                  <strong>Part Group</strong> <span className="required">*</span>
                </label>
                <div className={errors.itemGroupId ? 'react-select-error' : ''}>
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Part Group"
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
              <CCol md={3}>
                <label className="custom-label">
                  <strong>HSN/SAC Code</strong>
                </label>

                <CFormInput
                  name="hsnCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Enter HSN/SAC Code"
                  value={form.hsnCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 8)

                    setForm((prev) => ({
                      ...prev,
                      hsnCode: value,
                    }))
                  }}
                />
              </CCol>
              <CCol md={3}>
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
                    inputValue={uomInputValue}

                    onInputChange={(inputValue, { action }) => {
                      if (action === 'input-change') {
                        // Allow alphabetic characters only
                        const alphabeticValue = inputValue.replace(/[^a-zA-Z]/g, '')

                        setUomInputValue(alphabeticValue)
                      }

                      return inputValue
                    }}

                    onChange={(selected) => {
                      const selectedUom = (selected?.value || '').toString().trim().toUpperCase()

                      setForm((prev) => ({
                        ...prev,
                        uom: selectedUom,
                        ...(selectedUom === 'PCS'
                          ? {}
                          : {
                            length: '',
                            width: '',
                            height: '',
                          }),
                      }))

                      setUomInputValue('')
                      clearError('uom')
                    }}

                    onCreateOption={(inputValue) => {
                      // Extra validation before creating a new UOM
                      if (!/^[a-zA-Z]+$/.test(inputValue)) {
                        return
                      }

                      const upperValue = inputValue.toUpperCase()

                      setForm((prev) => ({
                        ...prev,
                        uom: upperValue,
                      }))

                      setUomInputValue('')
                      clearError('uom')
                    }}

                    isValidNewOption={(inputValue) => {
                      return /^[a-zA-Z]+$/.test(inputValue)
                    }}

                    formatCreateLabel={(inputValue) => `Create "${inputValue.toUpperCase()}"`}
                  />
                </div>

                {errors.uom && <small className="text-danger">{errors.uom}</small>}
              </CCol>
              <CCol md={3}>
                <label className="custom-label">
                  <strong>Customer / Supplier</strong> <span className="required">*</span>
                </label>
                <div className={errors.customerOrSupplier ? 'react-select-error' : ''}>
                  <Select
                    classNamePrefix="react-select"
                    placeholder="Select Customer / Supplier"
                    options={[
                      { value: 'Customer', label: 'Customer' },
                      { value: 'Supplier', label: 'Supplier' },
                    ]}
                    value={
                      form.customerOrSupplier
                        ? {
                          value: form.customerOrSupplier,
                          label: form.customerOrSupplier,
                        }
                        : null
                    }
                    onChange={(selected) => {
                      setForm((prev) => ({
                        ...prev,
                        customerOrSupplier: selected?.value || '',
                      }))
                      clearError('customerOrSupplier')
                    }}
                    isClearable
                  />
                </div>
                {errors.customerOrSupplier && (
                  <small className="text-danger">{errors.customerOrSupplier}</small>
                )}
              </CCol>
              <CCol md={3}>
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
              <CCol md={3}>
                <label className="custom-label"><strong>Stuff Quantity</strong></label>
                <CFormInput
                  type="number"
                  name="stuffQuantity"
                  placeholder="Enter Stuff Quantity"
                  value={form.stuffQuantity}
                  onChange={handleChange}
                />
              </CCol>
              <CCol md={3}>
                <label className="custom-label"><strong>Item Model</strong></label>
                <CFormInput
                  name="itemModel"
                  placeholder="Enter Model"
                  value={form.itemModel}
                  onChange={handleChange}
                />
              </CCol>
              <CCol md={3}>
                <label className="custom-label">
                  <strong>Usage</strong>
                </label>

                <CFormInput
                  name="usage"
                  placeholder="Enter Usage"
                  value={form.usage}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^a-zA-Z\s]/g, '')

                    setForm((prev) => ({
                      ...prev,
                      usage: value,
                    }))
                  }}
                />
              </CCol>

              {showDimension && (
                <CCol md={4}>
                  <label className="custom-label">
                    <strong>Dimension (L x W x H)</strong>
                  </label>
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
                    <span className="input-suffix">MM</span>
                  </div>
                </CCol>
              )}

              <CCol md={4}>
                <label className="custom-label"><strong>Description</strong></label>
                <CFormInput
                  name="description"
                  placeholder="Enter Item Description"
                  value={form.description}
                  onChange={handleChange}
                />
              </CCol>

              <div className="section-title price-section-title">
                Price Information
              </div>

              <CRow className="g-3">
                <CCol md={4}>
                  <label className="custom-label">
                    <strong>Unit Price</strong>{' '}
                    <span className="required">*</span>
                  </label>

                  <CFormInput
                    type="number"
                    name="unitPrice"
                    placeholder="Enter Unit Price"
                    value={form.unitPrice}
                    className={errors.unitPrice ? 'error-input' : ''}
                    onChange={handleChange}
                  />

                  {errors.unitPrice && (
                    <small className="text-danger">
                      {errors.unitPrice}
                    </small>
                  )}
                </CCol>

                <CCol md={4}>
                  <label className="custom-label">
                    <strong>Effective Date</strong>{' '}
                    <span className="required">*</span>
                  </label>

                  <CFormInput
                    ref={effectiveDateRef}
                    type="date"
                    name="effectiveDate"
                    min={getTodayDate()}
                    value={form.effectiveDate}
                    className={errors.effectiveDate ? 'error-input' : ''}
                    onClick={(e) => {
                      if (e.currentTarget.showPicker) {
                        e.currentTarget.showPicker()
                      }
                    }}
                    onChange={handleChange}
                  />

                  {errors.effectiveDate && (
                    <small className="text-danger">
                      {errors.effectiveDate}
                    </small>
                  )}
                </CCol>
              </CRow>

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
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter Danger Level"
                  value={form.dangerLevel}
                  className={errors.dangerLevel ? 'error-input' : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')

                    setForm((prev) => ({
                      ...prev,
                      dangerLevel: value,
                    }))

                    clearError('dangerLevel')
                  }}
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
            <div className="table-title">Part List</div>

            <CFormInput
              placeholder="Search by Part Number, Name, Group, HSN Code..."
              className="search-box"
              style={{ width: '320px' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <DataTable
            columns={columns}
            data={filteredItems}
            pagination
            paginationPerPage={rowsPerPage}
            paginationRowsPerPageOptions={[10, 20, 30, 50, 100]}
            onChangePage={(page) => {
              setCurrentPage(page)
            }}
            onChangeRowsPerPage={(newPerPage, page) => {
              setRowsPerPage(newPerPage)
              setCurrentPage(page)
            }}
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
          <p>Are you sure you want to delete this Part?</p>

          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
            <div>
              <strong>Part Number :</strong>{' '}
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
