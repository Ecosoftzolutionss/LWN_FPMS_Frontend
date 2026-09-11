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

import { CTooltip } from '@coreui/react'
import { FaEdit, FaTrash, FaPlus, FaArrowLeft } from 'react-icons/fa'
import { toast } from 'react-toastify'
import Select from 'react-select'

import API from '../../api.js'
import '../../assets/CSS/customerMaster.css'
import usePrivilege from '../hooks/usePrivilege.js'


// =========================================================
// EMPTY FORM
// =========================================================

const EMPTY_FORM = {
  customerCode: '',
  customerName: '',
  customerDivision: '',
  customerGroupId: '',
  mobileNumber: '',
  emailId: '',
  gstNo: '',
}


// =========================================================
// REGEX
// =========================================================

const GST_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

const MOBILE_REGEX =
  /^[0-9]{10}$/

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const NAME_REGEX =
  /^[A-Za-z0-9_ ]+$/


// =========================================================
// ERROR MESSAGE
// =========================================================

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data

  if (!data) return fallback

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


// =========================================================
// COMPONENT
// =========================================================

const CustomerMaster = () => {

  const customerCodeRef = useRef(null)

  // =========================================================
  // DATATABLE STYLE
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

  const [customers, setCustomers] = useState([])

  const [customerGroups, setCustomerGroups] =
    useState([])

  const [showForm, setShowForm] =
    useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const [form, setForm] =
    useState({ ...EMPTY_FORM })

  const [errors, setErrors] = useState({
    customerCode: '',
    customerName: '',
    customerDivision: '',
    customerGroupId: '',
    mobileNumber: '',
    emailId: '',
    gstNo: '',
  })

  const [editId, setEditId] =
    useState(null)

  const [search, setSearch] =
    useState('')

  const [deleteId, setDeleteId] =
    useState(null)

  const [deleteCustomer, setDeleteCustomer] =
    useState(null)

  const [showDeleteModal, setShowDeleteModal] =
    useState(false)


  // =========================================================
  // PRIVILEGES
  // =========================================================

  const { privileges: userPrivileges = [] } =
    usePrivilege()

  const uPrivilege =
    userPrivileges.find(
      (p) => p.menuName === 'Customer Master'
    ) || {}


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadCustomers()
    loadCustomerGroups()
  }, [])


  // =========================================================
  // FOCUS CUSTOMER ID WHEN FORM OPENS
  // =========================================================

  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        customerCodeRef.current?.focus()
      }, 200)
    }
  }, [showForm])


  // =========================================================
  // CLEAR SINGLE ERROR
  // =========================================================

  const clearError = (name) => {
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }


  // =========================================================
  // LOAD CUSTOMERS
  // =========================================================

  const loadCustomers = async () => {
    try {
      const res =
        await API.get('/CustomerMaster')

      setCustomers(res.data || [])
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          'Failed to load customers'
        )
      )
    }
  }


  // =========================================================
  // LOAD CUSTOMER GROUPS
  // =========================================================

  const loadCustomerGroups = async () => {
    try {
      const res =
        await API.get('/CustomerGroup')

      setCustomerGroups(res.data || [])
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          'Failed to load customer groups'
        )
      )
    }
  }


  // =========================================================
  // CUSTOMER GROUP OPTIONS
  //
  // Only Internal and External
  // =========================================================

  const customerDivisionOptions =
    customerGroups
      .filter((g) => {
        const type =
          (g.customerGroupType || '')
            .trim()
            .toLowerCase()

        return (
          type === 'internal' ||
          type === 'external'
        )
      })
      .map((g) => ({
        value: g.customerGroupType,
        label: g.customerGroupType,
        id: g.id,
      }))


  // =========================================================
  // NORMAL INPUT CHANGE
  // =========================================================

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))

    clearError(name)
  }


  // =========================================================
  // CUSTOMER GROUP CHANGE
  //
  // External -> GST visible
  // Internal -> GST hidden + cleared
  // =========================================================

  const handleCustomerGroupChange = (selected) => {

    const customerGroup =
      selected?.value || ''

    const customerGroupId =
      selected?.id || ''

    setForm((prev) => ({
      ...prev,

      customerDivision:
        customerGroup,

      customerGroupId:
        customerGroupId,

      // Internal customers do not use GST
      gstNo:
        customerGroup === 'Internal'
          ? ''
          : prev.gstNo,
    }))

    clearError('customerDivision')
    clearError('customerGroupId')
    clearError('gstNo')
  }


  // =========================================================
  // VALIDATION
  // =========================================================

  const validate = () => {

    const temp = {
      customerCode: '',
      customerName: '',
      customerDivision: '',
      customerGroupId: '',
      mobileNumber: '',
      emailId: '',
      gstNo: '',
    }


    // -------------------------------------------------------
    // CUSTOMER ID
    // -------------------------------------------------------

    const customerCode =
      form.customerCode.trim()

    if (!customerCode) {

      temp.customerCode =
        'Customer ID is required'

    } else if (
      customers.some(
        (c) =>
          c.customerCode
            ?.trim()
            .toLowerCase() ===
          customerCode.toLowerCase() &&
          c.id !== editId
      )
    ) {

      temp.customerCode =
        'Customer ID already exists'
    }


    // -------------------------------------------------------
    // CUSTOMER NAME
    // -------------------------------------------------------

    const customerName =
      form.customerName.trim()

    if (!customerName) {

      temp.customerName =
        'Customer Name is required'

    } else if (
      !NAME_REGEX.test(customerName)
    ) {

      temp.customerName =
        'Only letters, numbers, underscore and spaces are allowed (e.g. Test_233)'

    } else if (
      customers.some(
        (c) =>
          c.customerName
            ?.trim()
            .toLowerCase() ===
          customerName.toLowerCase() &&
          c.id !== editId
      )
    ) {

      temp.customerName =
        'Customer Name already exists'
    }


    // -------------------------------------------------------
    // CUSTOMER GROUP
    // -------------------------------------------------------

    if (!form.customerDivision.trim()) {

      temp.customerDivision =
        'Customer Group is required'
    }

    if (!form.customerGroupId) {

      temp.customerGroupId =
        'Customer Group is required'
    }


    // -------------------------------------------------------
    // MOBILE NUMBER
    // -------------------------------------------------------

    const mobileNumber =
      form.mobileNumber.trim()

    if (!mobileNumber) {

      temp.mobileNumber =
        'Customer Mobile Number is required'

    } else if (
      !MOBILE_REGEX.test(mobileNumber)
    ) {

      temp.mobileNumber =
        'Mobile Number must be exactly 10 digits'
    }


    // -------------------------------------------------------
    // EMAIL
    // -------------------------------------------------------

    const email =
      form.emailId.trim()

    if (!email) {

      temp.emailId =
        'Customer Email ID is required'

    } else if (
      !EMAIL_REGEX.test(email)
    ) {

      temp.emailId =
        'Enter a valid email address'

    } else if (
      customers.some(
        (c) =>
          c.emailId
            ?.trim()
            .toLowerCase() ===
          email.toLowerCase() &&
          c.id !== editId
      )
    ) {

      temp.emailId =
        'Email ID already exists'
    }


    // -------------------------------------------------------
    // GST
    //
    // ONLY External requires GST
    // -------------------------------------------------------

    const gstNo =
      form.gstNo.trim().toUpperCase()

    if (
      form.customerDivision
        .trim()
        .toLowerCase() === 'external'
    ) {

      if (!gstNo) {

        temp.gstNo =
          'GST No is required for External customers'

      } else if (
        !GST_REGEX.test(gstNo)
      ) {

        temp.gstNo =
          'Enter a valid 15-character GSTIN (e.g. 33ABCDE1234F1Z5)'

      } else if (
        customers.some(
          (c) =>
            c.gstNo
              ?.trim()
              .toUpperCase() ===
            gstNo &&
            c.id !== editId &&
            c.gstNo?.toUpperCase() !==
            'NOTPROVIDED'
        )
      ) {

        temp.gstNo =
          'GST No already exists'
      }

    } else {

      // Internal customer
      temp.gstNo = ''
    }


    setErrors(temp)

    return !Object.values(temp).some(
      (x) => x
    )
  }


  // =========================================================
  // SUBMIT
  // =========================================================

  const handleSubmit = async () => {

    if (!validate()) {
      return
    }

    try {

      const isExternal =
        form.customerDivision
          .trim()
          .toLowerCase() ===
        'external'


      const payload = {

        customerCode:
          form.customerCode.trim(),

        customerName:
          form.customerName.trim(),

        customerDivision:
          form.customerDivision.trim(),

        customerGroupId:
          Number(form.customerGroupId),

        mobileNumber:
          form.mobileNumber.trim(),

        emailId:
          form.emailId.trim(),

        // External -> actual GST
        // Internal -> NOTPROVIDED
        gstNo:
          isExternal
            ? form.gstNo
              .trim()
              .toUpperCase()
            : 'NOTPROVIDED',
      }


      // -----------------------------------------------------
      // UPDATE
      // -----------------------------------------------------

      if (editId) {

        await API.put(
          `/CustomerMaster/${editId}`,
          payload
        )

        toast.success(
          'Customer Updated Successfully'
        )

      }

      // -----------------------------------------------------
      // CREATE
      // -----------------------------------------------------

      else {

        await API.post(
          '/CustomerMaster',
          payload
        )

        toast.success(
          'Customer Saved Successfully'
        )
      }


      await loadCustomers()

      resetForm()

      setShowForm(false)

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
  // EDIT
  // =========================================================

  const handleEdit = async (row) => {

    try {

      const res =
        await API.get(
          `/CustomerMaster/${row.id}`
        )

      const d = res.data


      // -----------------------------------------------------
      // Customer Group ID
      // -----------------------------------------------------

      const groupId =
        d.customerGroupId ||
        d.customerGroup?.id ||
        ''


      // -----------------------------------------------------
      // Customer Group Type
      // -----------------------------------------------------

      const groupType =
        d.customerDivision ||
        d.customerGroup?.customerGroupType ||
        ''


      setEditId(row.id)

      setForm({

        customerCode:
          d.customerCode || '',

        customerName:
          d.customerName || '',

        customerDivision:
          groupType,

        customerGroupId:
          groupId,

        mobileNumber:
          d.mobileNumber || '',

        emailId:
          d.emailId || '',

        gstNo:
          d.gstNo &&
            d.gstNo.toUpperCase() !==
            'NOTPROVIDED'
            ? d.gstNo
            : '',
      })


      setErrors({
        customerCode: '',
        customerName: '',
        customerDivision: '',
        customerGroupId: '',
        mobileNumber: '',
        emailId: '',
        gstNo: '',
      })


      setShowForm(true)


      // -----------------------------------------------------
      // Scroll + focus
      // -----------------------------------------------------

      setTimeout(() => {

        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        })

        customerCodeRef.current?.focus()

      }, 250)

    } catch (err) {

      toast.error(
        getErrorMessage(
          err,
          'Failed to load customer'
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

    setErrors({
      customerCode: '',
      customerName: '',
      customerDivision: '',
      customerGroupId: '',
      mobileNumber: '',
      emailId: '',
      gstNo: '',
    })

    setEditId(null)
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
        `/CustomerMaster/${deleteId}`
      )

      toast.success(
        'Deleted Successfully'
      )

      await loadCustomers()

      resetForm()

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

      setDeleteCustomer(null)
    }
  }


  // =========================================================
  // FILTER
  // =========================================================

  const filteredCustomers =
    customers.filter((c) => {

      const searchValue =
        search.trim().toLowerCase()

      return (

        (c.customerName || '')
          .toLowerCase()
          .includes(searchValue)

        ||

        (c.customerCode || '')
          .toLowerCase()
          .includes(searchValue)

        ||

        (c.customerDivision || '')
          .toLowerCase()
          .includes(searchValue)

        ||

        (c.mobileNumber || '')
          .toString()
          .includes(search.trim())

        ||

        (c.emailId || '')
          .toLowerCase()
          .includes(searchValue)

        ||

        (c.gstNo || '')
          .toLowerCase()
          .includes(searchValue)
      )
    })


  // =========================================================
  // TOOLTIP CELL
  // =========================================================

  const TooltipCell = ({ value }) => {

    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return <span>—</span>
    }

    return (

      <CTooltip
        content={value}
        placement="top"
      >

        <span className="customer-table-cell-text">
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
      name: 'S.NO',
      width: '80px',
      center: true,
      cell: (row, index) =>
        (currentPage - 1) * rowsPerPage + index + 1,
    },

    {
      name: 'CUSTOMER ID',

      selector: (row) =>
        row.customerCode,

      cell: (row) => (
        <TooltipCell
          value={row.customerCode}
        />
      ),
    },


    {
      name: 'CUSTOMER NAME',

      selector: (row) =>
        row.customerName,

      minWidth: '190px',

      width: '190px',

      cell: (row) => (
        <TooltipCell
          value={row.customerName}
        />
      ),
    },


    {
      name: 'CUSTOMER GROUP',

      selector: (row) =>
        row.customerDivision,

      minWidth: '170px',

      width: '170px',

      cell: (row) => (
        <TooltipCell
          value={row.customerDivision}
        />
      ),
    },


    {
      name: 'MOBILE NUMBER',

      selector: (row) =>
        row.mobileNumber,

      minWidth: '150px',

      width: '150px',

      cell: (row) => (
        <TooltipCell
          value={row.mobileNumber}
        />
      ),
    },


    {
      name: 'CUSTOMER EMAIL ID',

      selector: (row) =>
        row.emailId,

      minWidth: '190px',

      width: '190px',

      cell: (row) => (
        <TooltipCell
          value={row.emailId}
        />
      ),
    },


    {
      name: 'GST NO.',

      selector: (row) =>
        row.gstNo,

      minWidth: '170px',

      cell: (row) => {

        // Internal customers
        // show dash instead of NOTPROVIDED
        if (
          row.customerDivision
            ?.trim()
            .toLowerCase() ===
          'internal'
        ) {
          return <span>—</span>
        }

        return (
          <TooltipCell
            value={row.gstNo}
          />
        )
      },
    },


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

                setDeleteCustomer(row)

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

    <div className="customer-master-page">


      {/* =====================================================
          SUMMARY CARD
      ===================================================== */}

      {!showForm && (

        <CCard className="mb-3">

          <CCardBody className="summary-card-body">

            <div>

              <div className="summary-label">
                Total Customers
              </div>

              <div className="summary-value">
                {String(
                  customers.length
                ).padStart(2, '0')}
              </div>

            </div>


            <button
              className="round-icon-btn add-item-btn"
              title="Add Customer"
              onClick={handleAddNew}
            >
              <FaPlus size={16} />
            </button>

          </CCardBody>

        </CCard>
      )}


      {/* =====================================================
          FORM
      ===================================================== */}

      {showForm && (

        <CCard className="customer-master-form-card mb-3">

          <CCardBody className="customer-master-form-card-body">


            {/* BACK BUTTON */}

            <button
              className="round-icon-btn back-btn card-back-btn"
              title="Back"
              onClick={handleBack}
            >
              <FaArrowLeft size={14} />
            </button>


            {/* =================================================
                BASIC INFORMATION
            ================================================= */}

            <div className="section-title">
              Basic Information
            </div>


            <CRow className="g-3">


              {/* CUSTOMER ID */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Customer ID
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  ref={customerCodeRef}
                  name="customerCode"
                  placeholder="Enter Customer ID"
                  value={form.customerCode}
                  className={
                    errors.customerCode
                      ? 'error-input'
                      : ''
                  }
                  onChange={handleChange}
                />


                {errors.customerCode && (

                  <small className="text-danger">
                    {errors.customerCode}
                  </small>

                )}

              </CCol>


              {/* CUSTOMER NAME */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Customer Name
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  name="customerName"
                  placeholder="Enter Customer Name (e.g. Test_233)"
                  value={form.customerName}
                  className={
                    errors.customerName
                      ? 'error-input'
                      : ''
                  }
                  onChange={(e) =>
                    handleChange({
                      target: {
                        name: 'customerName',

                        value:
                          e.target.value.replace(
                            /[^A-Za-z0-9_ ]/g,
                            ''
                          ),
                      },
                    })
                  }
                />


                {errors.customerName && (

                  <small className="text-danger">
                    {errors.customerName}
                  </small>

                )}

              </CCol>


              {/* MOBILE */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Customer Mobile Number
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <CFormInput
                  name="mobileNumber"
                  placeholder="Enter Customer Mobile Number"
                  value={form.mobileNumber}
                  maxLength={10}
                  className={
                    errors.mobileNumber
                      ? 'error-input'
                      : ''
                  }
                  onChange={(e) =>
                    handleChange({
                      target: {
                        name: 'mobileNumber',

                        value:
                          e.target.value.replace(
                            /[^0-9]/g,
                            ''
                          ),
                      },
                    })
                  }
                />


                {errors.mobileNumber && (

                  <small className="text-danger">
                    {errors.mobileNumber}
                  </small>

                )}

              </CCol>


              {/* CUSTOMER GROUP */}

              <CCol md={4}>

                <label className="custom-label">

                  <strong>
                    Customer Group
                  </strong>

                  <span className="required">
                    *
                  </span>

                </label>


                <div
                  className={
                    errors.customerDivision ||
                      errors.customerGroupId
                      ? 'react-select-error'
                      : ''
                  }
                >

                  <Select
                    classNamePrefix="react-select"

                    placeholder="Select Customer Group"

                    options={
                      customerDivisionOptions
                    }

                    value={
                      customerDivisionOptions.find(
                        (x) =>
                          x.value ===
                          form.customerDivision
                      ) || null
                    }

                    onChange={
                      handleCustomerGroupChange
                    }

                    isClearable
                  />
                </div>


                {(errors.customerDivision ||
                  errors.customerGroupId) && (
                    <small className="text-danger">
                      {errors.customerDivision ||
                        errors.customerGroupId}
                    </small>
                  )}
              </CCol>


              {/* EMAIL */}

              <CCol md={4}>
                <label className="custom-label">
                  <strong>
                    Customer Email ID
                  </strong>
                  <span className="required">
                    *
                  </span>
                </label>
                <CFormInput
                  type="email"
                  name="emailId"
                  placeholder="Enter Customer Email ID"
                  value={form.emailId}
                  className={
                    errors.emailId
                      ? 'error-input'
                      : ''
                  }
                  onChange={handleChange}
                />


                {errors.emailId && (

                  <small className="text-danger">
                    {errors.emailId}
                  </small>

                )}
              </CCol>


              {/* =================================================
                  GST
                  ONLY EXTERNAL
              ================================================= */}

              {form.customerDivision
                ?.trim()
                .toLowerCase() ===
                'external' && (

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

                      placeholder="Enter GSTIN (e.g. 33ABCDE1234F1Z5)"

                      value={form.gstNo}

                      maxLength={15}

                      className={
                        errors.gstNo
                          ? 'error-input'
                          : ''
                      }

                      onChange={(e) =>
                        handleChange({
                          target: {
                            name: 'gstNo',

                            value:
                              e.target.value
                                .toUpperCase()
                                .replace(
                                  /[^0-9A-Z]/g,
                                  ''
                                ),
                          },
                        })
                      }
                    />

                    {errors.gstNo && (

                      <small className="text-danger">
                        {errors.gstNo}
                      </small>

                    )}
                  </CCol>
                )}
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


      {/* =====================================================
          CUSTOMER LIST
      ===================================================== */}

      <CCard className="mt-3">
        <CCardBody>
          <div className="table-header">
            <div className="table-title">
              Customer List
            </div>
            <CFormInput
              placeholder="Search by Customer ID, Name, Mobile Number..."
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
            data={filteredCustomers}

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
          <CModalTitle className="w-100 text-center text-danger fw-bold">
            ⚠ Confirm Delete
          </CModalTitle>
        </CModalHeader>


        <CModalBody className="text-center">
          <p>
            Are you sure you want to delete this Customer?
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
                Customer ID :
              </strong>{' '}
              <span className="text-primary fw-bold">
                {deleteCustomer?.customerCode}
              </span>
            </div>


            <div className="mt-1">
              <strong>
                Customer Name :
              </strong>{' '}
              <span>
                {deleteCustomer?.customerName}
              </span>
            </div>


            <div className="mt-1">
              <strong>
                Customer Group :
              </strong>{' '}
              <span>
                {deleteCustomer?.customerDivision}
              </span>
            </div>
          </div>
        </CModalBody>


        <CModalFooter className="border-0 d-flex justify-content-center">
          <CButton
            color="secondary"
            onClick={() => {
              setShowDeleteModal(false)
              setDeleteId(null)
              setDeleteCustomer(null)
            }}
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


export default CustomerMaster