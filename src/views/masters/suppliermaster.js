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

import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaArrowLeft,
} from 'react-icons/fa'

import { toast } from 'react-toastify'
import Select from 'react-select'

import API from '../../api.js'
import '../../assets/CSS/supplierMaster.css'
import usePrivilege from '../hooks/usePrivilege.js'


// =========================================================
// REGEX
// =========================================================

const CONTACT_REGEX = /^[0-9]{10}$/

const GST_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

const PAN_REGEX =
  /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/


// =========================================================
// EMPTY FORM
// =========================================================

const EMPTY_FORM = {
  supplierCode: '',
  supplierName: '',
  supplierGroupId: '',
  email: '',
  contactNumber: '',
  personToContact: '',
  gstNo: '',
  panNo: '',
}


// =========================================================
// ERROR MESSAGE HELPER
// =========================================================

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

  if (
    data.errors &&
    typeof data.errors === 'object'
  ) {
    const firstField =
      Object.keys(data.errors)[0]

    const firstMessage =
      data.errors[firstField]?.[0]

    if (firstMessage) {
      return firstMessage
    }
  }

  return fallback
}


// =========================================================
// COMPONENT
// =========================================================

const SupplierMaster = () => {

  const supplierIdRef = useRef(null)


  // =========================================================
  // TABLE STYLES
  // =========================================================

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


  // =========================================================
  // STATES
  // =========================================================

  const [suppliers, setSuppliers] =
    useState([])

  const [supplierGroups, setSupplierGroups] =
    useState([])

  const [showForm, setShowForm] =
    useState(false)

  const [form, setForm] =
    useState({ ...EMPTY_FORM })

  const [errors, setErrors] =
    useState({})

  const [editId, setEditId] =
    useState(null)

  const [search, setSearch] =
    useState('')

  const [deleteId, setDeleteId] =
    useState(null)

  const [deleteSupplier, setDeleteSupplier] =
    useState(null)

  const [showDeleteModal, setShowDeleteModal] =
    useState(false)


  // =========================================================
  // PRIVILEGES
  // =========================================================

  const {
    privileges: userPrivileges = [],
  } = usePrivilege()

  const uPrivilege =
    userPrivileges.find(
      (p) => p.menuName === 'Supplier Master'
    ) || {}


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadSuppliers()
    loadSupplierGroups()
  }, [])


  // =========================================================
  // FOCUS SUPPLIER ID WHEN FORM OPENS
  // =========================================================

  useEffect(() => {

    if (showForm) {

      const timer = setTimeout(() => {
        supplierIdRef.current?.focus()
      }, 200)

      return () => clearTimeout(timer)
    }

  }, [showForm])


  // =========================================================
  // CLEAR ERROR
  // =========================================================

  const clearError = (name) => {

    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }


  // =========================================================
  // LOAD SUPPLIERS
  // =========================================================

  const loadSuppliers = async () => {

    try {

      const res =
        await API.get('/SupplierMaster')

      setSuppliers(res.data || [])

    } catch (err) {

      toast.error(
        getErrorMessage(
          err,
          'Failed to load suppliers'
        )
      )
    }
  }


  // =========================================================
  // LOAD SUPPLIER GROUPS
  // =========================================================

  const loadSupplierGroups = async () => {

    try {

      const res =
        await API.get('/SupplierGroup')

      setSupplierGroups(
        res.data || []
      )

    } catch (err) {

      toast.error(
        getErrorMessage(
          err,
          'Failed to load supplier groups'
        )
      )
    }
  }


  // =========================================================
  // NORMAL INPUT CHANGE
  // =========================================================

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


  // =========================================================
  // SUPPLIER NAME
  // =========================================================

  const handleSupplierNameChange = (e) => {

    const value =
      e.target.value.replace(
        /[^a-zA-Z\s]/g,
        ''
      )

    setForm((prev) => ({
      ...prev,
      supplierName: value,
    }))

    clearError('supplierName')
  }


  // =========================================================
  // VALIDATION
  // =========================================================

  const validate = () => {

    const temp = {}


    // -------------------------------------------------------
    // SUPPLIER ID
    // -------------------------------------------------------
    const supplierCode = form.supplierCode.trim()

    if (!supplierCode) {

      temp.supplierCode = 'Supplier ID is required'

    } else if (!SUPPLIER_ID_REGEX.test(supplierCode.toUpperCase())) {

      temp.supplierCode =
        'Supplier ID can contain only letters, numbers and hyphen (-)'

    } else {

      const duplicateCode = suppliers.some(
        (s) =>
          s.supplierCode?.trim().toLowerCase() ===
          supplierCode.toLowerCase() &&
          s.id !== editId
      )

      if (duplicateCode) {
        temp.supplierCode = 'Supplier ID already exists'
      }
    }



    // -------------------------------------------------------
    // SUPPLIER NAME
    // -------------------------------------------------------

    const supplierName =
      form.supplierName.trim()

    if (!supplierName) {

      temp.supplierName =
        'Supplier Name is required'

    } else {

      const duplicateName =
        suppliers.some(
          (s) =>
            s.supplierName
              ?.trim()
              .toLowerCase()
            === supplierName.toLowerCase()
            &&
            s.id !== editId
        )

      if (duplicateName) {

        temp.supplierName =
          'Supplier Name already exists'
      }
    }


    // -------------------------------------------------------
    // SUPPLIER GROUP
    // -------------------------------------------------------

    if (!form.supplierGroupId) {

      temp.supplierGroupId =
        'Supplier Group is required'
    }


    // -------------------------------------------------------
    // EMAIL
    // -------------------------------------------------------

    const email =
      form.email.trim()

    if (!email) {

      temp.email =
        'Email is required'

    } else if (!EMAIL_REGEX.test(email)) {

      temp.email =
        'Enter a valid email address'
    }


    // -------------------------------------------------------
    // CONTACT NUMBER
    // -------------------------------------------------------

    const contactNumber =
      form.contactNumber.trim()

    if (!contactNumber) {

      temp.contactNumber =
        'Contact Number is required'

    } else if (
      !CONTACT_REGEX.test(contactNumber)
    ) {

      temp.contactNumber =
        'Contact Number must be exactly 10 digits'
    }


    // -------------------------------------------------------
    // PERSON TO CONTACT
    // -------------------------------------------------------

    if (!form.personToContact.trim()) {

      temp.personToContact =
        'Person to Contact is required'
    }


    // -------------------------------------------------------
    // GST NUMBER
    // -------------------------------------------------------

    const gstNo =
      form.gstNo.trim().toUpperCase()

    if (!gstNo) {

      temp.gstNo =
        'GST No is required'

    } else if (!GST_REGEX.test(gstNo)) {

      temp.gstNo =
        'Enter a valid 15-character GSTIN (e.g. 33ABCDE1234F1Z5)'

    } else {

      const duplicateGST =
        suppliers.some(
          (s) =>
            s.gstNo
              ?.trim()
              .toUpperCase()
            === gstNo
            &&
            s.id !== editId
        )

      if (duplicateGST) {

        temp.gstNo =
          'GST No already exists'
      }
    }


    // -------------------------------------------------------
    // PAN NUMBER
    // -------------------------------------------------------

    const panNo =
      form.panNo.trim().toUpperCase()

    if (!panNo) {

      temp.panNo =
        'PAN No is required'

    } else if (!PAN_REGEX.test(panNo)) {

      temp.panNo =
        'Enter a valid 10-character PAN (e.g. ABCDE1234F)'

    } else {

      const duplicatePAN =
        suppliers.some(
          (s) =>
            s.panNo
              ?.trim()
              .toUpperCase()
            === panNo
            &&
            s.id !== editId
        )

      if (duplicatePAN) {

        temp.panNo =
          'PAN No already exists'
      }
    }


    setErrors(temp)

    return Object.keys(temp).length === 0
  }


  // =========================================================
  // SAVE / UPDATE
  // =========================================================

  const handleSubmit = async () => {

    if (!validate()) {
      return
    }


    try {

      const payload = {

        supplierCode:
          form.supplierCode
            .trim()
            .toUpperCase(),

        supplierName:
          form.supplierName.trim(),

        supplierGroupId:
          Number(form.supplierGroupId),

        email:
          form.email.trim(),

        contactNumber:
          form.contactNumber.trim(),

        personToContact:
          form.personToContact.trim(),

        gstNo:
          form.gstNo
            .trim()
            .toUpperCase(),

        panNo:
          form.panNo
            .trim()
            .toUpperCase(),
      }


      // -----------------------------------------------------
      // UPDATE
      // -----------------------------------------------------

      if (editId) {

        await API.put(
          `/SupplierMaster/${editId}`,
          payload
        )

        toast.success(
          'Supplier Updated Successfully'
        )

      }

      // -----------------------------------------------------
      // CREATE
      // -----------------------------------------------------

      else {

        await API.post(
          '/SupplierMaster',
          payload
        )

        toast.success(
          'Supplier Saved Successfully'
        )
      }


      await loadSuppliers()

      resetForm()

    } catch (err) {

      toast.error(
        getErrorMessage(
          err,
          'Save Failed'
        )
      )
    }
  }


  // =========================================================
  // EDIT SUPPLIER
  // =========================================================

  const handleEdit = async (row) => {

    try {

      const res =
        await API.get(
          `/SupplierMaster/${row.id}`
        )

      const d = res.data


      setEditId(row.id)

      setShowForm(true)


      setForm({

        supplierCode:
          d.supplierCode || '',

        supplierName:
          d.supplierName || '',

        supplierGroupId:
          d.supplierGroupId || '',

        email:
          d.email || '',

        contactNumber:
          d.contactNumber || '',

        personToContact:
          d.personToContact || '',

        gstNo:
          d.gstNo || '',

        panNo:
          d.panNo || '',
      })


      setErrors({})

         // Open edit form
    setShowForm(true)

    // Scroll to top and focus Supplier ID
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })

      supplierIdRef.current?.focus()
    }, 250)

    } catch (err) {

      toast.error(
        getErrorMessage(
          err,
          'Failed to load supplier'
        )
      )
    }
  }


  // =========================================================
  // RESET FORM
  // =========================================================

  const resetForm = () => {

    setForm({
      ...EMPTY_FORM,
    })

    setErrors({})

    setEditId(null)


    setTimeout(() => {

      supplierIdRef.current?.focus()

    }, 100)
  }


  // =========================================================
  // ADD NEW
  // =========================================================

  const handleAddNew = () => {

    resetForm()

    setShowForm(true)
  }


  // =========================================================
  // BACK
  // =========================================================

  const handleBack = () => {

    resetForm()

    setShowForm(false)
  }


  // =========================================================
  // DELETE
  // =========================================================

  const confirmDelete = async () => {

    try {

      await API.delete(
        `/SupplierMaster/${deleteId}`
      )

      toast.success(
        'Deleted Successfully'
      )

      await loadSuppliers()

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

      setDeleteSupplier(null)
    }
  }


  // =========================================================
  // SEARCH
  // =========================================================

  const searchText =
    search.trim().toLowerCase()


  const filteredSuppliers =
    suppliers.filter(
      (s) =>

        (s.supplierName || '')
          .toLowerCase()
          .includes(searchText)

        ||

        (s.supplierCode || '')
          .toLowerCase()
          .includes(searchText)

        ||

        (s.personToContact || '')
          .toLowerCase()
          .includes(searchText)

        ||

        (s.contactNumber || '')
          .toLowerCase()
          .includes(searchText)

        ||

        (s.gstNo || '')
          .toLowerCase()
          .includes(searchText)

        ||

        (s.panNo || '')
          .toLowerCase()
          .includes(searchText)

        ||

        (s.email || '')
          .toLowerCase()
          .includes(searchText)
    )


  // =========================================================
  // SUPPLIER GROUP OPTIONS
  // =========================================================

  const supplierGroupOptions =
    supplierGroups.map((g) => ({
      value: g.id,
      label: g.supplierGroupType,
    }))


  // =========================================================
  // TOOLTIP CELL
  // =========================================================

  const TooltipCell = ({ value }) => {

    if (!value) {
      return <span>—</span>
    }

    return (
      <CTooltip
        content={value}
        placement="top"
      >
        <span className="supplier-table-cell-text">
          {value}
        </span>
      </CTooltip>
    )
  }


  // =========================================================
  // TABLE COLUMNS
  // =========================================================

  const columns = [

    {
      name: 'SL.NO',
      selector: (row, index) => index + 1,
      width: '80px',
      center: true,
    },

    {
      name: 'SUPPLIER ID',
      selector: (row) =>
        row.supplierCode,

      width: '130px',

      cell: (row) => (
        <TooltipCell
          value={row.supplierCode}
        />
      ),
    },

    {
      name: 'SUPPLIER NAME',
      selector: (row) =>
        row.supplierName,

      width: '180px',

      wrap: true,

      cell: (row) => (
        <TooltipCell
          value={row.supplierName}
        />
      ),
    },

    {
      name: 'SUPPLIER GROUP',
      selector: (row) =>
        row.supplierGroupName,

      width: '170px',

      wrap: true,

      cell: (row) => (
        <TooltipCell
          value={row.supplierGroupName}
        />
      ),
    },

    {
      name: 'CONTACT PERSON',
      selector: (row) =>
        row.personToContact,

      width: '170px',

      wrap: true,

      cell: (row) => (
        <TooltipCell
          value={row.personToContact}
        />
      ),
    },

    {
      name: 'CONTACT NUMBER',
      selector: (row) =>
        row.contactNumber,

      width: '160px',

      cell: (row) => (
        <TooltipCell
          value={row.contactNumber}
        />
      ),
    },

    {
      name: 'EMAIL',
      selector: (row) =>
        row.email,

      width: '220px',

      wrap: true,

      cell: (row) => (
        <TooltipCell
          value={row.email}
        />
      ),
    },

    {
      name: 'GST NO.',
      selector: (row) =>
        row.gstNo,

      width: '170px',

      cell: (row) => (
        <TooltipCell
          value={row.gstNo}
        />
      ),
    },

    {
      name: 'PAN NO.',
      selector: (row) =>
        row.panNo,

      width: '140px',

      cell: (row) => (
        <TooltipCell
          value={row.panNo}
        />
      ),
    },

    {
      name: 'ACTION',

      center: true,

      width: '130px',

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

                setDeleteSupplier(row)

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


  // =========================================================
  // RETURN
  // =========================================================

  return (

    <div className="supplier-master-page">


      {/* =====================================================
          SUMMARY
          ===================================================== */}

      {!showForm && (

        <CCard className="mb-3">

          <CCardBody className="summary-card-body">

            <div>

              <div className="summary-label">
                Total Suppliers
              </div>

              <div className="summary-value">
                {String(
                  suppliers.length
                ).padStart(2, '0')}
              </div>

            </div>


            <button
              className="round-icon-btn add-item-btn"
              title="Add Supplier"
              onClick={handleAddNew}
            >
              <FaPlus size={16} />
            </button>

          </CCardBody>

        </CCard>
      )}


      {/* =====================================================
          SUPPLIER FORM
          ===================================================== */}

      {showForm && (

        <CCard className="supplier-master-form-card mb-3">

          <CCardBody className="supplier-master-form-card-body">


            {/* BACK BUTTON */}

            <button
              className="round-icon-btn back-btn card-back-btn"
              title="Back"
              onClick={handleBack}
            >
              <FaArrowLeft size={14} />
            </button>


            {/* SECTION TITLE */}

            <div className="section-title">
              Basic Information
            </div>


            {/* =================================================
                FORM FIELDS
                ================================================= */}

            <CRow className="g-3">


              {/* -------------------------------------------------
                  SUPPLIER ID
                  ------------------------------------------------- */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Supplier ID
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  name="supplierCode"
                  ref={supplierIdRef}
                  placeholder="Enter Supplier ID"
                  value={form.supplierCode}
                  maxLength={30}
                  className={
                    errors.supplierCode
                      ? 'error-input'
                      : ''
                  }

                  onChange={(e) => {
                    const value = e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9-]/g, '')

                    handleChange({
                      target: {
                        name: 'supplierCode',
                        value,
                      },
                    })
                  }}
                />


                {errors.supplierCode && (

                  <small className="text-danger">
                    {errors.supplierCode}
                  </small>

                )}

              </CCol>


              {/* -------------------------------------------------
                  SUPPLIER NAME
                  ------------------------------------------------- */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Supplier Name
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  name="supplierName"
                  placeholder="Enter Supplier Name"
                  value={form.supplierName}
                  maxLength={150}
                  className={
                    errors.supplierName
                      ? 'error-input'
                      : ''
                  }

                  onChange={
                    handleSupplierNameChange
                  }
                />


                {errors.supplierName && (

                  <small className="text-danger">
                    {errors.supplierName}
                  </small>

                )}

              </CCol>


              {/* -------------------------------------------------
                  SUPPLIER GROUP
                  ------------------------------------------------- */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Supplier Group
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <div
                  className={
                    errors.supplierGroupId
                      ? 'react-select-error'
                      : ''
                  }
                >

                  <Select

                    classNamePrefix="react-select"

                    placeholder="Select Supplier Group"

                    options={
                      supplierGroupOptions
                    }

                    value={
                      supplierGroupOptions.find(
                        (x) =>
                          String(x.value)
                          ===
                          String(
                            form.supplierGroupId
                          )
                      ) || null
                    }

                    onChange={(selected) => {

                      setForm((prev) => ({
                        ...prev,
                        supplierGroupId:
                          selected?.value || '',
                      }))

                      clearError(
                        'supplierGroupId'
                      )
                    }}

                    isClearable

                  />

                </div>


                {errors.supplierGroupId && (

                  <small className="text-danger">
                    {errors.supplierGroupId}
                  </small>

                )}

              </CCol>


              {/* -------------------------------------------------
                  EMAIL
                  ------------------------------------------------- */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Email
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  type="email"
                  name="email"
                  placeholder="Enter Email Address"
                  value={form.email}
                  maxLength={100}
                  className={
                    errors.email
                      ? 'error-input'
                      : ''
                  }
                  onChange={handleChange}
                />


                {errors.email && (

                  <small className="text-danger">
                    {errors.email}
                  </small>

                )}

              </CCol>


              {/* -------------------------------------------------
                  CONTACT NUMBER
                  ------------------------------------------------- */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Contact Number
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  name="contactNumber"
                  placeholder="Enter Contact Number"
                  value={form.contactNumber}
                  maxLength={10}
                  className={
                    errors.contactNumber
                      ? 'error-input'
                      : ''
                  }

                  onChange={(e) => {

                    handleChange({
                      target: {
                        name: 'contactNumber',

                        value:
                          e.target.value.replace(
                            /[^0-9]/g,
                            ''
                          ),
                      },
                    })

                  }}
                />


                {errors.contactNumber && (

                  <small className="text-danger">
                    {errors.contactNumber}
                  </small>

                )}

              </CCol>


              {/* -------------------------------------------------
                  PERSON TO CONTACT
                  ------------------------------------------------- */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Person to Contact
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  name="personToContact"
                  placeholder="Enter Person to Contact"
                  value={form.personToContact}
                  maxLength={100}
                  className={
                    errors.personToContact
                      ? 'error-input'
                      : ''
                  }

                  onChange={handleChange}
                />


                {errors.personToContact && (

                  <small className="text-danger">
                    {errors.personToContact}
                  </small>

                )}

              </CCol>


              {/* -------------------------------------------------
                  GST
                  ------------------------------------------------- */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    GST No.
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  name="gstNo"
                  placeholder="Enter GST Number"
                  value={form.gstNo}
                  maxLength={15}
                  className={
                    errors.gstNo
                      ? 'error-input'
                      : ''
                  }

                  onChange={(e) => {

                    handleChange({
                      target: {
                        name: 'gstNo',

                        value:
                          e.target.value
                            .toUpperCase(),
                      },
                    })

                  }}
                />


                {errors.gstNo && (

                  <small className="text-danger">
                    {errors.gstNo}
                  </small>

                )}

              </CCol>


              {/* -------------------------------------------------
                  PAN
                  ------------------------------------------------- */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    PAN No.
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  name="panNo"
                  placeholder="Enter PAN Number"
                  value={form.panNo}
                  maxLength={10}
                  className={
                    errors.panNo
                      ? 'error-input'
                      : ''
                  }

                  onChange={(e) => {

                    handleChange({
                      target: {
                        name: 'panNo',

                        value:
                          e.target.value
                            .toUpperCase(),
                      },
                    })

                  }}
                />


                {errors.panNo && (

                  <small className="text-danger">
                    {errors.panNo}
                  </small>

                )}

              </CCol>

            </CRow>


            {/* =================================================
                FORM BUTTONS
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


      {/* =====================================================
          SUPPLIER LIST
          ===================================================== */}

      <CCard className="mt-3">

        <CCardBody>

          <div className="table-header">

            <div className="table-title">
              Supplier List
            </div>


            <CFormInput
              placeholder="Search..."
              className="search-box"
              style={{
                width: '320px',
              }}

              value={search}

              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

          </div>


          <DataTable
            columns={columns}

            data={filteredSuppliers}

            pagination

            striped

            responsive

            highlightOnHover

            customStyles={customStyles}

            noDataComponent="No suppliers found"

          />
        </CCardBody>
      </CCard>


      {/* =====================================================
          DELETE MODAL
          ===================================================== */}

      <CModal
        visible={showDeleteModal}
        onClose={() =>
          setShowDeleteModal(false)
        }

        alignment="center"

        backdrop="static"
      >

        <CModalHeader className="border-0">
          <CModalTitle
            className="w-100 text-center text-danger fw-bold"
          >
            ⚠ Confirm Delete
          </CModalTitle>
        </CModalHeader>
        <CModalBody className="text-center">
          <p>
            Are you sure you want to delete this Supplier?
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
                Supplier ID :
              </strong>

              {' '}

              <span className="text-primary fw-bold">
                {
                  deleteSupplier?.supplierCode
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
            onClick={confirmDelete}
          >
            Delete
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}


export default SupplierMaster