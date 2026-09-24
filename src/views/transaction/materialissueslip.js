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


const toDisplayArray = (value) => {
    if (Array.isArray(value)) {
        return value.flatMap((v) => toDisplayArray(v)).filter(Boolean)
    }
    if (value === null || value === undefined || value === '') return []
    if (typeof value === 'string') {
        return value.split(',').map((v) => v.trim()).filter(Boolean)
    }
    return [String(value)]
}

const uniqueDisplayValues = (values) => {
    const result = []
    const seen = new Set()

    values.flatMap((value) => toDisplayArray(value)).forEach((value) => {
        const key = String(value).trim()
        if (!key) return
        const normalized = key.toLowerCase()
        if (!seen.has(normalized)) {
            seen.add(normalized)
            result.push(key)
        }
    })

    return result
}

const getGrnNumbers = (slip) => {
    if (!slip) return []
    return uniqueDisplayValues([
        slip.grnNumbers,
        slip.grnNos,
        slip.grns,
        slip.grnNumber,
    ])
}

const getItemFifoNumbers = (item) => {
    const nested = Array.isArray(item?.palletDetails)
        ? item.palletDetails.flatMap((p) => [
            p?.fifoNo, p?.fifoNumber, p?.fifoNos, p?.fifoNumbers,
        ])
        : []

    return uniqueDisplayValues([
        item?.fifoNo,
        item?.fifoNumber,
        item?.fifoNos,
        item?.fifoNumbers,
        nested,
    ])
}

const getItemPalletNumbers = (item) => {
    const nested = Array.isArray(item?.palletDetails)
        ? item.palletDetails.flatMap((p) => [
            p?.palletNo, p?.palletNumber, p?.palletNos, p?.palletNumbers,
        ])
        : []

    return uniqueDisplayValues([
        item?.palletNo,
        item?.palletNumber,
        item?.palletNos,
        item?.palletNumbers,
        nested,
    ])
}

const getItemGrnNumbers = (item) => {
    const nested = Array.isArray(item?.palletDetails)
        ? item.palletDetails.flatMap((p) => [
            p?.grnNo, p?.grnNumber, p?.grnNos, p?.grnNumbers,
        ])
        : []

    return uniqueDisplayValues([
        item?.grnNo,
        item?.grnNumber,
        item?.grnNos,
        item?.grnNumbers,
        nested,
    ])
}

const makeDisplayKey = (values) =>
    uniqueDisplayValues(values)
        .map((value) => String(value).trim().toLowerCase())
        .join('|') || '—'

// IMPORTANT:
// One IssueNumber represents one physical Material Issue Slip.
// Rows are consolidated only when PART + FIFO NO + PALLET NO are the
// same. This means if GRN 260003 and GRN 260004 were issued in the
// same click and both use the same FIFO/Pallet, the slip shows ONE row:
//   GRN: 260003, 260004 | FIFO: F26090003 | Pallet: BR-03
// If FIFO/Pallet differs, they remain separate rows so the physical
// traceability is never lost.
const consolidateItems = (items = []) => {
    const grouped = new Map()

    items.forEach((item, index) => {
        const partNumber = String(
            item?.partNumber ?? item?.itemNumber ?? item?.partNo ?? ''
        ).trim()

        const partName = item?.partName ?? item?.itemName ?? '—'
        const fifoNumbers = getItemFifoNumbers(item)
        const palletNumbers = getItemPalletNumbers(item)
        const grnNumbers = getItemGrnNumbers(item)

        const groupKey = [
            partNumber.toLowerCase() || `__part_${index}`,
            makeDisplayKey(fifoNumbers),
            makeDisplayKey(palletNumbers),
        ].join('||')

        if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
                ...item,
                partNumber: partNumber || item?.partNumber || '—',
                partName,
                quantity: Number(item?.quantity ?? item?.qty ?? 0) || 0,
                fifoNumbers,
                palletNumbers,
                grnNumbers,
            })
            return
        }

        const existing = grouped.get(groupKey)
        existing.quantity += Number(item?.quantity ?? item?.qty ?? 0) || 0
        existing.grnNumbers = uniqueDisplayValues([
            existing.grnNumbers,
            grnNumbers,
        ])
        existing.fifoNumbers = uniqueDisplayValues([
            existing.fifoNumbers,
            fifoNumbers,
        ])
        existing.palletNumbers = uniqueDisplayValues([
            existing.palletNumbers,
            palletNumbers,
        ])
    })

    return Array.from(grouped.values())
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
        const value = String(search || '').trim().toLowerCase();

        if (!value) {
            return true;
        }

        const searchableValues = [
            getGrnNumbers(row).join(', '),
            row.issueNumber,
            row.partNumber,
            row.palletNo,
        ];

        return searchableValues.some((item) =>
            String(item ?? '').toLowerCase().includes(value)
        );
    });

    // =====================================================
    // PRINT MATERIAL ISSUE SLIP
    // Opens only the slip in a clean print window.
    // This avoids CoreUI modal layout causing a blank first page.
    // =====================================================
    const printMaterialIssueSlip = () => {
        const slipElement = document.querySelector('.issue-slip')

        if (!slipElement) {
            toast.error('Material Issue Slip is not available for printing')
            return
        }

        const printWindow = window.open(
            '',
            '_blank',
            'width=1200,height=850,scrollbars=yes,resizable=yes'
        )

        if (!printWindow) {
            toast.error('Please allow pop-ups to print the Material Issue Slip')
            return
        }

        // Copy the application's loaded CSS into the print window.
        // Same-origin stylesheets can be read safely; inaccessible sheets
        // are simply skipped.
        let pageStyles = ''

        Array.from(document.styleSheets).forEach((sheet) => {
            try {
                const rules = Array.from(sheet.cssRules || [])
                    .map((rule) => rule.cssText)
                    .join('\n')

                pageStyles += rules
            } catch (error) {
                // Ignore stylesheets that the browser does not allow us to read.
            }
        })

        const slipHtml = slipElement.outerHTML

        printWindow.document.open()
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8" />
                    <title>Material Requisition and Issue Slip</title>

                    <style>
                        ${pageStyles}

                        @page {
                            size: A4 landscape;
                            margin: 8mm;
                        }

                        html,
                        body {
                            width: 100%;
                            min-height: 0 !important;
                            height: auto !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #fff !important;
                            overflow: visible !important;
                        }

                        body {
                            display: block !important;
                        }

                        .issue-slip {
                            position: relative !important;
                            display: block !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            height: auto !important;
                            min-height: 0 !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            box-sizing: border-box !important;
                            border: 1.2px solid #111 !important;
                            background: #fff !important;
                            color: #111 !important;
                            box-shadow: none !important;
                        }

                        .mis-modal-actions,
                        .mis-modal-title,
                        .modal-header,
                        .btn-close {
                            display: none !important;
                        }

                        .items-table {
                            width: 100% !important;
                            table-layout: fixed !important;
                            border-collapse: collapse !important;
                        }

                        .items-table th,
                        .items-table td {
                            border: 1px solid #111 !important;
                            vertical-align: middle !important;
                        }

                        .items-table th:nth-child(1),
                        .items-table td:nth-child(1) {
                            width: 6% !important;
                        }

                        .items-table th:nth-child(2),
                        .items-table td:nth-child(2) {
                            width: 15% !important;
                        }

                        .items-table th:nth-child(3),
                        .items-table td:nth-child(3) {
                            width: 13% !important;
                        }

                        .items-table th:nth-child(4),
                        .items-table td:nth-child(4) {
                            width: 24% !important;
                        }

                        .items-table th:nth-child(5),
                        .items-table td:nth-child(5) {
                            width: 8% !important;
                        }

                        .items-table th:nth-child(6),
                        .items-table td:nth-child(6) {
                            width: 17% !important;
                        }

                        .items-table th:nth-child(7),
                        .items-table td:nth-child(7) {
                            width: 17% !important;
                        }

                        .header-grid {
                            display: grid !important;
                            grid-template-columns: repeat(4, 1fr) !important;
                        }

                        .approval-grid {
                            display: grid !important;
                            grid-template-columns: repeat(3, 1fr) !important;
                        }

                        .slip-title {
                            height: 58px !important;
                            display: flex !important;
                            align-items: center !important;
                        }

                        .slip-heading {
                            white-space: nowrap !important;
                        }

                        .items-table tr,
                        .approval-grid,
                        .remarks {
                            break-inside: avoid !important;
                            page-break-inside: avoid !important;
                        }
                    </style>
                </head>

                <body>
                    ${slipHtml}
                </body>
            </html>
        `)

        printWindow.document.close()

        // Wait for the logo and other resources before opening Chrome's
        // print dialog.
        const waitForImages = () => {
            const images = Array.from(printWindow.document.images)

            if (!images.length) {
                return Promise.resolve()
            }

            return Promise.all(
                images.map((image) => {
                    if (image.complete) {
                        return Promise.resolve()
                    }

                    return new Promise((resolve) => {
                        image.onload = resolve
                        image.onerror = resolve
                    })
                })
            )
        }

        waitForImages().then(() => {
            printWindow.focus()

            // Small delay lets Chrome finish calculating the A4 landscape page.
            setTimeout(() => {
                printWindow.print()

                setTimeout(() => {
                    printWindow.close()
                }, 700)
            }, 250)
        })
    }


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
                getGrnNumbers(row).join(', ') || '—',

            cell: row => (
                <div style={{ whiteSpace: 'normal', textAlign: 'center' }}>
                    {getGrnNumbers(row).length
                        ? getGrnNumbers(row).join(', ')
                        : '—'}
                </div>
            ),

            center: true,
            minWidth: '150px',
        },

        {
            name: 'ISSUE NO',
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
                        (() => {
                            const slipGrnNumbers = getGrnNumbers(selectedSlip)
                            const consolidatedItems = consolidateItems(
                                selectedSlip.items || []
                            )

                            return (
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

                                        {/* <span className="leewon-text">
                                           
                                        </span> */}
                                    </div>

                                    <span className="slip-heading">
                                        MATERIAL REQUISITION AND ISSUE SLIP
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

                                            {slipGrnNumbers.length ? slipGrnNumbers.join(', ') : '—'}
                                        </div>

                                    </div>


                                    <div className="header-cell">

                                        <strong>
                                            ISSUE NO.
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

                                {/* <div className="from-to">

 

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
                                </div> */}


                                {/* ==============================
                    ITEM
                ============================== */}

                                <table className="items-table">
                                    <thead>
                                        <tr>
                                            <th>SL. NO.</th>
                                            <th>GRN NO.</th>
                                            <th>ITEM NO.</th>
                                            <th>ITEM NAME</th>
                                            <th>QTY</th>
                                            <th>FIFO NO.</th>
                                            <th>PALLET NO.</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {consolidatedItems.map((item, index) => (
                                            <tr key={`${item.partNumber}-${index}`}>
                                                <td>{index + 1}</td>
                                                <td>{item.grnNumbers?.length ? item.grnNumbers.join(', ') : '—'}</td>
                                                <td>{item.partNumber || '—'}</td>
                                                <td>{item.partName || '—'}</td>
                                                <td>{item.quantity || 0}</td>
                                                <td>
                                                    {item.fifoNumbers?.length
                                                        ? item.fifoNumbers.join(', ')
                                                        : '—'}
                                                </td>
                                                <td>
                                                    {item.palletNumbers?.length
                                                        ? item.palletNumbers.join(', ')
                                                        : '—'}
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
                                        Remarks:
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
                                        {selectedSlip.issuedTo || ''}
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
                                    onClick={printMaterialIssueSlip}
                                >

                                    <FaPrint />

                                    Print

                                </CButton>

                            </div>

                        </>
                            )
                        })()
                    )}
                </CModalBody>
            </CModal>
        </div>
    )
}

export default MaterialIssueSlip