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

import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaArrowLeft,
} from 'react-icons/fa'

import { toast } from 'react-toastify'
import Select from 'react-select'

import API from '../../api.js'
import '../../assets/CSS/storeMaster.css'
import usePrivilege from '../hooks/usePrivilege.js'


// ============================================================
// Constants
// ============================================================

const DEFAULT_COLOUR = '#1E88E5'

const EMPTY_FORM = {
  storeLocation: '',
  palletTypeId: '',
  colourCode: '#1E88E5',
  partNumberId: '',
}


// ============================================================
// Error Message Helper
// ============================================================

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data

  if (!data) {
    return fallback
  }

  if (typeof data === 'string') {
    return data
  }

  if (data.message || data.error) {
    return data.message || data.error
  }

  if (data.errors && typeof data.errors === 'object') {
    const firstField = Object.keys(data.errors)[0]

    const firstMessage =
      data.errors[firstField]?.[0]

    if (firstMessage) {
      return firstMessage
    }
  }

  return fallback
}


// ============================================================
// Component
// ============================================================

const StoreMaster = () => {

  const locationRef = useRef(null)

  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------

  const [stores, setStores] = useState([])

  const [palletTypes, setPalletTypes] = useState([])

  const [parts, setParts] = useState([])

  const [form, setForm] = useState({
    ...EMPTY_FORM,
  })

  const [errors, setErrors] = useState({
    storeLocation: '',
    palletTypeId: '',
    colourCode: '',
  })

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deleteStore, setDeleteStore] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const {
    privileges: userPrivileges = [],
  } = usePrivilege()

  const uPrivilege =
    userPrivileges.find(
      (p) => p.menuName === 'Pallet Master'
    ) || {}


  // ==========================================================
  // Initial Load
  // ==========================================================

  useEffect(() => {
    loadStores()
    loadPalletTypes()
    loadParts()
  }, [])


  // ==========================================================
  // Load Stores
  // ==========================================================

  const loadStores = async () => {
    try {

      const res =
        await API.get('/StoreMaster')

      setStores(res.data || [])

    } catch (err) {

      console.error(err)

      toast.error(
        'Failed to load store list'
      )
    }
  }


  // ==========================================================
  // Load Pallet Types
  // ==========================================================

  const loadPalletTypes = async () => {
    try {

      /*
       * This API returns:
       *   Id
       *   PalletName
       *   CurrentSequence
       *   RangeFrom
       *   RangeTo
       *
       * Pallet Type is only used to generate/display
       * the pallet number. Colour is entered separately
       * by the user in this form.
       */

      const res =
        await API.get('/StoreMaster/pallet-types')

      setPalletTypes(res.data || [])

    } catch (err) {

      console.error(
        'Failed to load pallet types:',
        err
      )

      toast.error(
        'Failed to load pallet types'
      )
    }
  }


  // ==========================================================
  // Load Parts
  // ==========================================================

  const loadParts = async () => {
    try {

      const res =
        await API.get('/StoreMaster/parts-list')

      setParts(res.data || [])

    } catch (err) {

      console.error(err)

      toast.error(
        'Failed to load parts'
      )
    }
  }


  // ==========================================================
  // Focus Location When Form Opens
  // ==========================================================

  useEffect(() => {

    if (showForm) {

      setTimeout(() => {

        locationRef.current?.focus()

      }, 200)
    }

  }, [showForm])


  // ==========================================================
  // Clear Error
  // ==========================================================

  const clearError = (name) => {

    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }


  // ==========================================================
  // Pallet Type Dropdown Options
  // ==========================================================

  const palletTypeOptions =
    palletTypes.map((p) => {

      const currentSequence =
        Number(p.currentSequence || 0)

      const rangeFrom =
        Number(p.rangeFrom || 1)

      const rangeTo =
        Number(p.rangeTo || 0)

      /*
       * If sequence is still 0,
       * start from RangeFrom.
       *
       * Example:
       * RangeFrom = 1
       * CurrentSequence = 0
       * Next = 1
       */

      const nextSequence =
        currentSequence === 0
          ? rangeFrom
          : currentSequence + 1

      const isRangeCompleted =
        nextSequence > rangeTo

      const palletName =
        p.palletName ||
        p.label ||
        ''

      return {
        value:
          p.value ??
          p.id,

        label:
          isRangeCompleted
            ? `${palletName} (Range Completed)`
            : `${palletName} (Next: ${palletName}-${String(nextSequence).padStart(2, '0')})`,

        disabled:
          isRangeCompleted,
      }
    })


  // ==========================================================
  // Normal Input Change
  // ==========================================================

  const handleChange = (e) => {

    const {
      name,
      value,
    } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))

    clearError(name)
  }


  // ==========================================================
  // Part Number Change
  // ==========================================================

  const handlePartChange = (selected) => {

    setForm((prev) => ({
      ...prev,

      partNumberId:
        selected?.value || '',
    }))
  }


  // ==========================================================
  // Pallet Type Change
  // ==========================================================

  const handlePalletTypeChange = (selected) => {

    /*
     * Pallet Type only controls the pallet type/sequence.
     * Colour is entered separately by the user.
     */

    setForm((prev) => ({
      ...prev,

      palletTypeId:
        selected?.value || '',
    }))

    clearError('palletTypeId')
  }


  // ==========================================================
  // Validation
  // ==========================================================

  const validate = () => {

    const temp = {
      storeLocation: '',
      palletTypeId: '',
      colourCode: '',
    }


    // Store Location

    if (
      !form.storeLocation.trim()
    ) {

      temp.storeLocation =
        'Store Location is required'
    }


    // Pallet Type

    if (
      !editId &&
      !form.palletTypeId
    ) {

      temp.palletTypeId =
        'Pallet Type is required'
    }


    // Pallet Colour

    if (!form.colourCode?.trim()) {

      temp.colourCode =
        'Pallet Colour is required'

    } else if (
      !/^#[0-9A-Fa-f]{6}$/.test(
        form.colourCode.trim()
      )
    ) {

      temp.colourCode =
        'Enter a valid colour in #RRGGBB format'
    }


    setErrors(temp)

    return !Object.values(temp)
      .some((x) => x)
  }


  // ==========================================================
  // Submit
  // ==========================================================

  const handleSubmit = async () => {

    if (!validate()) {
      return
    }

    try {

      // ========================================================
      // UPDATE
      // ========================================================

      if (editId) {

        await API.put(
          `/StoreMaster/${editId}`,
          {
            storeLocation:
              form.storeLocation.trim(),

            colourCode:
              form.colourCode.trim().toUpperCase(),

            partNumberId:
              form.partNumberId
                ? Number(form.partNumberId)
                : null,
          }
        )

        toast.success(
          'Store Updated Successfully'
        )
      }


      // ========================================================
      // CREATE
      // ========================================================

      else {

        /*
         * Pallet Type and Pallet Colour are independent.
         * ColourCode is entered manually by the user.
         */

        await API.post(
          '/StoreMaster',
          {
            storeLocation:
              form.storeLocation.trim(),

            palletTypeId:
              Number(form.palletTypeId),

            colourCode:
              form.colourCode.trim().toUpperCase(),

            partNumberId:
              form.partNumberId
                ? Number(form.partNumberId)
                : null,
          }
        )

        toast.success(
          'Store Saved Successfully'
        )
      }


      // ========================================================
      // Refresh
      // ========================================================

      await loadStores()

      await loadPalletTypes()

      resetForm()

    } catch (err) {

      console.error(err)

      toast.error(
        getErrorMessage(
          err,
          'Save Failed'
        )
      )
    }
  }


  // ==========================================================
  // Edit
  // ==========================================================

  const handleEdit = async (row) => {

    try {

      const res =
        await API.get(
          `/StoreMaster/${row.id}`
        )

      const d = res.data

      setEditId(row.id)

      setShowForm(true)

      /*
       * ColourCode is intentionally NOT placed in form.
       *
       * Existing pallet type determines the colour.
       */

      setForm({
        storeLocation:
          d.storeLocation || '',

        palletTypeId:
          d.palletTypeId || '',

        colourCode:
          d.colourCode || '#1E88E5',

        partNumberId:
          d.partNumberId || '',
      })

      setErrors({
        storeLocation: '',
        palletTypeId: '',
        colourCode: '',
      })

    } catch (err) {

      console.error(err)

      toast.error(
        'Failed to load store record'
      )
    }
  }


  // ==========================================================
  // Reset Form
  // ==========================================================

  const resetForm = () => {

    setForm({
      ...EMPTY_FORM,
    })

    setErrors({
      storeLocation: '',
      palletTypeId: '',
      colourCode: '',
    })

    setEditId(null)

    setTimeout(() => {

      locationRef.current?.focus()

    }, 100)
  }


  // ==========================================================
  // Add New
  // ==========================================================

  const handleAddNew = () => {

    resetForm()

    setShowForm(true)
  }


  // ==========================================================
  // Back
  // ==========================================================

  const handleBack = () => {

    resetForm()

    setShowForm(false)
  }


  // ==========================================================
  // Delete
  // ==========================================================

  const confirmDelete = async () => {

    try {

      await API.delete(
        `/StoreMaster/${deleteId}`
      )

      toast.success(
        'Deleted Successfully'
      )

      resetForm()

      await loadStores()

    } catch (err) {

      toast.error(
        getErrorMessage(
          err,
          'Delete Failed'
        )
      )

    } finally {

      setShowDeleteModal(false)

      setDeleteId(null)

      setDeleteStore(null)
    }
  }


  // ==========================================================
  // Search
  // ==========================================================

  const filteredStores =
    stores.filter((s) => {

      const searchText =
        search.toLowerCase()

      return (

        (s.storeLocation || '')
          .toLowerCase()
          .includes(searchText)

        ||

        (s.palletNumber || '')
          .toLowerCase()
          .includes(searchText)

        ||

        (s.palletTypeName || '')
          .toLowerCase()
          .includes(searchText)

        ||

        (s.partNumberCode || '')
          .toLowerCase()
          .includes(searchText)
      )
    })


  // ==========================================================
  // DataTable Columns
  // ==========================================================

  const columns = [

    // --------------------------------------------------------
    // SL.NO
    // --------------------------------------------------------

    {
      name: 'SL.NO',
      width: '90px',
      center: true,
      cell: (row, index) =>
        (currentPage - 1) * rowsPerPage + index + 1,
    },


    // --------------------------------------------------------
    // STORE LOCATION
    // --------------------------------------------------------

    {
      name: 'STORE LOCATION',

      selector: (row) =>
        row.storeLocation,

      wrap: true,
    },


    // --------------------------------------------------------
    // PART NUMBER
    // --------------------------------------------------------

    {
      name: 'PART NUMBER',

      selector: (row) =>
        row.partNumberCode || '-',

      wrap: true,
    },


    // --------------------------------------------------------
    // PALLET NUMBER
    // --------------------------------------------------------

    {
      name: 'PALLET NUMBER',

      selector: (row) =>
        row.palletNumber,

      center: true,
    },


    // --------------------------------------------------------
    // PALLET TYPE
    // --------------------------------------------------------

    {
      name: 'PALLET TYPE',

      selector: (row) =>
        row.palletTypeName,

      center: true,
    },


    // --------------------------------------------------------
    // PALLET COLOUR
    // --------------------------------------------------------

    {
      name: 'PALLET COLOUR',

      center: true,

      cell: (row) => (

        <span
          title={row.palletTypeName || 'Pallet Colour'}

          style={{
            width: '24px',
            height: '24px',

            borderRadius: '5px',

            backgroundColor:
              row.colourCode ||
              DEFAULT_COLOUR,

            border:
              '1px solid #ccc',

            display:
              'inline-block',
          }}
        />

      ),
    },


    // --------------------------------------------------------
    // ACTION
    // --------------------------------------------------------

    {
      name: 'ACTION',

      center: true,

      cell: (row) => (

        <div className="action-wrapper">

          {uPrivilege?.canEdit && (

            <button
              className="table-action-btn edit-btn"

              title="Edit"

              onClick={() =>
                handleEdit(row)
              }
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

                setDeleteStore(row)

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


  // ==========================================================
  // Table Styles
  // ==========================================================

  const customStyles = {

    rows: {
      style: {
        minHeight: '34px',
      },
    },

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


  // ==========================================================
  // Render
  // ==========================================================

  return (

    <div className="store-master-page">

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      {!showForm && (

        <CCard className="mb-3">

          <CCardBody
            className="summary-card-body"
          >

            <div>

              <div className="summary-label">
                Total Pallets
              </div>

              <div className="summary-value">
                {String(
                  stores.length
                ).padStart(2, '0')}
              </div>

            </div>


            <button
              className="round-icon-btn add-item-btn"

              title="Add Store"

              onClick={handleAddNew}
            >
              <FaPlus size={16} />
            </button>

          </CCardBody>

        </CCard>

      )}


      {/* ======================================================
          FORM
      ====================================================== */}

      {showForm && (

        <CCard
          className="store-master-form-card mb-3"
        >

          <CCardBody
            className="store-master-form-card-body"
          >

            {/* Back */}

            <button
              className="round-icon-btn back-btn card-back-btn"

              title="Back"

              onClick={handleBack}
            >
              <FaArrowLeft size={14} />
            </button>


            {/* Section Title */}

            <div className="section-title">
              Basic Information
            </div>


            <CRow className="g-3">

              {/* =================================================
                  PALLET LOCATION
              ================================================= */}

              <CCol md={3}>

                <label className="custom-label">

                  <strong>
                    Store Location
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  ref={locationRef}

                  name="storeLocation"

                  placeholder="Enter Store Location"

                  value={form.storeLocation}

                  className={
                    errors.storeLocation
                      ? 'error-input'
                      : ''
                  }

                  onChange={handleChange}
                />


                {errors.storeLocation && (

                  <small className="text-danger">
                    {errors.storeLocation}
                  </small>

                )}

              </CCol>


              {/* =================================================
                  PART NUMBER
              ================================================= */}

              <CCol md={3}>

                <label className="custom-label">

                  <strong>
                    Part Number
                  </strong>

                </label>


                <Select

                  classNamePrefix="react-select"

                  placeholder="Select Part Number"

                  options={parts}

                  value={
                    parts.find(
                      (x) =>
                        String(x.value) ===
                        String(form.partNumberId)
                    ) || null
                  }

                  onChange={
                    handlePartChange
                  }

                  isClearable

                />

              </CCol>


              {/* =================================================
                  PALLET TYPE
              ================================================= */}

              <CCol md={3}>

                <label className="custom-label">

                  <strong>
                    Pallet Type
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                {/* -------------------------------------------------
                    CREATE
                ------------------------------------------------- */}

                {!editId && (

                  <div
                    className={
                      errors.palletTypeId
                        ? 'react-select-error'
                        : ''
                    }
                  >

                    <Select

                      classNamePrefix="react-select"

                      placeholder="Select Pallet Type"

                      options={
                        palletTypeOptions
                      }
                      value={

                        palletTypeOptions.find(
                          (x) =>
                            String(x.value) ===
                            String(form.palletTypeId)
                        ) || null

                      }

                      onChange={
                        handlePalletTypeChange
                      }

                      isOptionDisabled={
                        (option) =>
                          option.disabled
                      }

                      isClearable

                    />

                  </div>

                )}


                {/* -------------------------------------------------
                    EDIT
                ------------------------------------------------- */}

                {editId && (

                  <CFormInput
                    value={
                      stores.find(
                        (s) =>
                          s.id === editId
                      )?.palletNumber || ''
                    }

                    disabled
                  />

                )}


                {errors.palletTypeId && (

                  <small className="text-danger">
                    {errors.palletTypeId}
                  </small>

                )}

              </CCol>

              {/* =================================================
                  PALLET COLOUR
              ================================================= */}

              <CCol md={3}>

                <label className="custom-label">

                  <strong>
                    Pallet Colour
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >

                  <input
                    type="color"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(
                        form.colourCode || ''
                      )
                        ? form.colourCode
                        : '#1E88E5'
                    }
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        colourCode:
                          e.target.value.toUpperCase(),
                      }))

                      clearError('colourCode')
                    }}
                    style={{
                      width: '46px',
                      height: '38px',
                      padding: '2px',
                      border: '1px solid #ced4da',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      background: '#fff',
                    }}
                    title="Select Pallet Colour"
                  />

                  <CFormInput
                    name="colourCode"
                    value={
                      form.colourCode || ''
                    }
                    placeholder="#1E88E5"
                    maxLength={7}
                    className={
                      errors.colourCode
                        ? 'error-input'
                        : ''
                    }
                    onChange={(e) => {
                      let value =
                        e.target.value.toUpperCase()

                      if (
                        value &&
                        !value.startsWith('#')
                      ) {
                        value = `#${value}`
                      }

                      value =
                        '#' +
                        value
                          .replace(/#/g, '')
                          .replace(/[^0-9A-F]/g, '')
                          .slice(0, 6)

                      setForm((prev) => ({
                        ...prev,
                        colourCode: value,
                      }))

                      clearError('colourCode')
                    }}
                  />

                </div>

                {errors.colourCode && (

                  <small className="text-danger">
                    {errors.colourCode}
                  </small>

                )}

              </CCol>

            </CRow>


            {/* =================================================
                BUTTONS
            ================================================= */}

            <div className="form-button-area">

              <CButton
                className={
                  editId
                    ? 'update-btn'
                    : 'save-btn'
                }

                onClick={handleSubmit}
              >

                {editId
                  ? 'Update'
                  : 'Save'}

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


      {/* ======================================================
          STORE LIST
      ====================================================== */}

      <CCard className="mt-3">

        <CCardBody>

          <div className="table-header">

            <div className="table-title">
              Pallet List
            </div>


            <CFormInput
              placeholder="Search..."
              className="search-box"
              style={{
                width: '320px',
              }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
            />

          </div>


          <DataTable
            columns={columns}
            data={filteredStores}

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


      {/* ======================================================
          DELETE MODAL
      ====================================================== */}

      <CModal

        visible={
          showDeleteModal
        }

        onClose={() =>
          setShowDeleteModal(false)
        }

        alignment="center"

        backdrop="static"
      >
        <CModalHeader
          className="border-0"
        >

          <CModalTitle
            className="w-100 text-center text-danger fw-bold"
          >
            ⚠ Confirm Delete
          </CModalTitle>
        </CModalHeader>

        <CModalBody
          className="text-center"
        >
          <p>
            Are you sure you want
            to delete this Store record?
          </p>


          <div
            style={{
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '10px',
            }}
          >

            <div>
              <strong>
                Pallet Number :
              </strong>{' '}
              <span
                className="text-primary fw-bold"
              >
                {
                  deleteStore?.palletNumber
                }
              </span>
            </div>
          </div>
        </CModalBody>


        <CModalFooter
          className="border-0 d-flex justify-content-center"
        >
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

            onClick={
              confirmDelete
            }
          >
            Delete
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default StoreMaster