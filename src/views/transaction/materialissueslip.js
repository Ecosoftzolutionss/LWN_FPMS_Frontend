import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import {
    CButton,
    CCard,
    CCardBody,
    CFormInput,
    CModal,
    CModalBody,
    CModalHeader,
    CModalTitle,
} from '@coreui/react'

import {
    FaEdit,
    FaPrint,
    FaSearch,
    FaTimes,
} from 'react-icons/fa'

import { toast } from 'react-toastify'
import API from '../../api.js'

import '../../assets/CSS/materialIssueSlip.css'

const formatDateTime = (value) => {
    if (!value) return '—'

    const d = new Date(value)

    if (Number.isNaN(d.getTime())) {
        return '—'
    }

    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()

    let hours = d.getHours()

    const minutes = String(
        d.getMinutes()
    ).padStart(2, '0')

    const ampm =
        hours >= 12 ? 'PM' : 'AM'

    hours = hours % 12 || 12

    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`
}

const MaterialIssueSlip = () => {

    const [rows, setRows] = useState([])

    const [loading, setLoading] =
        useState(false)

    const [search, setSearch] =
        useState('')

    const [modalVisible, setModalVisible] =
        useState(false)

    const [selectedSlip, setSelectedSlip] =
        useState(null)

    // =====================================================
    // LOAD EXISTING MOBILE ISSUE RECORDS
    // =====================================================

    const loadMaterialIssues = async () => {

        setLoading(true)

        try {

            const response =
                await API.get('/MaterialIssue')

            setRows(response.data || [])

        } catch (error) {

            toast.error(
                error?.response?.data?.message ||
                'Failed to load Material Issue records'
            )

        } finally {

            setLoading(false)

        }
    }

    useEffect(() => {

        loadMaterialIssues()

    }, [])

    // =====================================================
    // OPEN SLIP
    // =====================================================

    const openSlip = async (id) => {

        try {

            const response =
                await API.get(
                    `/MaterialIssue/${id}`
                )

            setSelectedSlip(response.data)

            setModalVisible(true)

        } catch (error) {

            toast.error(
                error?.response?.data?.message ||
                'Failed to load Material Issue Slip'
            )

        }
    }

    // =====================================================
    // SEARCH
    // =====================================================

    const filteredRows = rows.filter((row) => {

        const value =
            search.trim().toLowerCase()

        if (!value) {
            return true
        }

        return (
            String(row.grnNumber || '')
                .toLowerCase()
                .includes(value) ||

            String(row.issueNumber || '')
                .toLowerCase()
                .includes(value) ||

            String(row.partNumber || '')
                .toLowerCase()
                .includes(value) ||

            String(row.palletNo || '')
                .toLowerCase()
                .includes(value)
        )
    })

    // =====================================================
    // TABLE COLUMNS
    // =====================================================

    const columns = [

        {
            name: 'S.No',
            width: '80px',
            center: true,

            cell: (row, index) =>
                index + 1,
        },

        {
            name: 'GRN NO',
            selector: row =>
                row.grnNumber || '—',

            center: true,
            minWidth: '150px',
        },

        {
            name: 'ISSUE SLIP NO',
            selector: row =>
                row.issueNumber || '—',

            center: true,
            minWidth: '170px',
        },

        {
            name: 'DATE & TIME',

            selector: row =>
                row.issueDate,

            cell: row =>
                formatDateTime(
                    row.issueDate
                ),

            center: true,
            minWidth: '180px',
        },

        {
            name: 'QUANTITY',

            selector: row =>
                row.quantity ?? 0,

            center: true,
            width: '120px',
        },

        {
            name: 'ACTION',

            center: true,
            width: '150px',

            cell: row => (

                <div className="mis-action-wrapper">
{/* 
                    <CButton
                        className="mis-edit-btn"
                        title="View Material Issue Slip"
                        onClick={() =>
                            openSlip(row.id)
                        }
                    >
                        <FaEdit />
                    </CButton> */}

                    <CButton
                        className="mis-print-btn"
                        title="Print Material Issue Slip"
                        onClick={() =>
                            openSlip(row.id)
                        }
                    >
                        <FaPrint />
                    </CButton>

                </div>

            ),
        },
    ]

    return (

        <div className="material-issue-slip-page">

            {/* =================================================
          GENERATED ISSUE SLIP
      ================================================= */}

            <CCard>

                <CCardBody>

                    <div className="mis-table-header">

                        <div className="mis-table-title">

                            Generated Issue Slip

                        </div>

                        <CFormInput
                            className="mis-search"
                            placeholder="Search pallet ID / number..."
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                        />

                    </div>


                    <DataTable

                        columns={columns}

                        data={filteredRows}

                        pagination

                        paginationPerPage={10}

                        paginationRowsPerPageOptions={[
                            10,
                            25,
                            50,
                            100,
                        ]}

                        persistTableHead

                        striped

                        highlightOnHover

                        responsive

                        progressPending={loading}

                        noDataComponent={

                            <div className="mis-empty">

                                No Material Issue Slip Found

                            </div>

                        }

                    />

                </CCardBody>

            </CCard>


            {/* =================================================
          MATERIAL ISSUE SLIP MODAL
      ================================================= */}

            <CModal

                visible={modalVisible}

                onClose={() =>
                    setModalVisible(false)
                }

                size="xl"

                alignment="center"

                backdrop="static"

            >

                <CModalHeader>

                    <CModalTitle>

                        <div className="mis-modal-title">

                            <FaPrint />

                            <div>

                                <strong>
                                    Material Issue Slip
                                </strong>

                                <small>
                                    Review Material Issue before printing
                                </small>

                            </div>

                        </div>

                    </CModalTitle>

                </CModalHeader>


                <CModalBody>

                    {selectedSlip && (

                        <>

                            <div className="issue-slip">

                                {/* ==============================
                    TITLE
                ============================== */}

                      <div className="slip-title">

    <div className="leewon-brand">
        <img
            src="/GLOVIS.png"
            alt="LEEWON Logo"
            className="leewon-logo"
        />

        <span className="leewon-text">
            LEEWON
        </span>
    </div>

    <span className="slip-heading">
        MATERIAL ISSUE SLIP
    </span>

</div>


                                {/* ==============================
                    HEADER
                ============================== */}

                                <div className="header-grid">

                                    <div className="header-cell">

                                        <strong>
                                            GRN NO.
                                        </strong>

                                        <div className="value-line">

                                            {selectedSlip.grnNumber || ''}

                                        </div>

                                    </div>


                                    <div className="header-cell">

                                        <strong>
                                            ISSUE SLIP NO.
                                        </strong>

                                        <div className="value-line">

                                            {selectedSlip.issueNumber || ''}

                                        </div>

                                    </div>


                                    <div className="header-cell">

                                        <strong>
                                            DATE & TIME
                                        </strong>

                                        <div className="value-line">

                                            {formatDateTime(
                                                selectedSlip.issueDate
                                            )}

                                        </div>

                                    </div>


                                    <div className="header-cell">

                                        <strong>
                                            TOTAL QUANTITY
                                        </strong>

                                        <div className="value-line">

                                            {selectedSlip.totalQuantity || 0}

                                        </div>

                                    </div>

                                </div>


                                {/* ==============================
                    FROM / TO
                ============================== */}

                              <div className="from-to">

    {/* ==============================
        FROM - BILLING ADDRESS
    ============================== */}

    <div className="from-to-box">

        <strong>
            FROM
        </strong>

        <div className="address-content">

            <div>
                <strong>
                    {selectedSlip.supplier?.billingCompanyName ||
                        selectedSlip.supplier?.supplierName ||
                        '—'}
                </strong>
            </div>
            <div>
                {selectedSlip.supplier?.billingAddressLine1 || ''}
            </div>
            {selectedSlip.supplier?.billingAddressLine2 && (
                <div>
                    {selectedSlip.supplier.billingAddressLine2}
                </div>
            )}
            <div>
                {selectedSlip.supplier?.billingState || ''}
                {selectedSlip.supplier?.billingStateCode
                    ? ` - ${selectedSlip.supplier.billingStateCode}`
                    : ''}
            </div>
            <div>
                PIN: {selectedSlip.supplier?.billingPinCode || '—'}
            </div>
            {selectedSlip.supplier?.gstNo && (
                <div>
                    GSTIN: {selectedSlip.supplier.gstNo}
                </div>
            )}
        </div>
    </div>


    {/* ==============================
        TO - SHIPPING ADDRESS
    ============================== */}

    <div className="from-to-box">
        <strong>
            TO
        </strong>
        <div className="address-content">
            <div>
                <strong>
                    {selectedSlip.supplier?.shippingCompanyName ||
                        selectedSlip.supplier?.supplierName ||
                        '—'}
                </strong>
            </div>
            <div>
                {selectedSlip.supplier?.shippingAddressLine1 || ''}
            </div>
            {selectedSlip.supplier?.shippingAddressLine2 && (
                <div>
                    {selectedSlip.supplier.shippingAddressLine2}
                </div>
            )}
            <div>
                {selectedSlip.supplier?.shippingState || ''}
                {selectedSlip.supplier?.shippingStateCode
                    ? ` - ${selectedSlip.supplier.shippingStateCode}`
                    : ''}
            </div>
            <div>
                PIN: {selectedSlip.supplier?.shippingPinCode || '—'}
            </div>
        </div>
    </div>
</div>


                                {/* ==============================
                    ITEM
                ============================== */}

                                <table className="items-table">
                                    <thead>
                                        <tr>
                                            <th>SL. NO.</th>
                                            <th>ITEM NO.</th>
                                            <th>ITEM NAME</th>
                                            <th>QTY</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {(selectedSlip.items || []).map((item, index) => (
                                            <tr key={item.id || index}>
                                                <td>{index + 1}</td>

                                                <td>
                                                    {item.partNumber || '—'}
                                                </td>

                                                <td>
                                                    {item.partName || '—'}
                                                </td>

                                                <td>
                                                    {item.quantity || 0}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>


                                {/* ==============================
                    REMARKS
                ============================== */}

                                <div className="remarks">

                                    <strong>
                                        Remarks
                                    </strong>

                                    <br />

                                    {selectedSlip.remarks || ''}

                                </div>


                                {/* ==============================
                    APPROVAL
                ============================== */}

                                <div className="approval-grid">

                                    <div className="approval-box">

                                        PREPARED BY

                                        <br />
                                        <br />

                                        {selectedSlip.issuedBy || ''}

                                    </div>


                                    <div className="approval-box">

                                        CHECKED BY

                                    </div>


                                    <div className="approval-box">

                                        APPROVED BY

                                    </div>

                                </div>


                                <div className="thank-you">

                                    Thank You!

                                </div>

                            </div>


                            {/* ==============================
                  BUTTONS
              ============================== */}

                            <div className="mis-modal-actions">

                                <CButton
                                    color="secondary"
                                    onClick={() =>
                                        setModalVisible(false)
                                    }
                                >

                                    <FaTimes />

                                    Close

                                </CButton>


                                <CButton
                                    color="primary"
                                    onClick={() =>
                                        window.print()
                                    }
                                >

                                    <FaPrint />

                                    Print

                                </CButton>

                            </div>

                        </>

                    )}

                </CModalBody>

            </CModal>

        </div>
    )
}

export default MaterialIssueSlip