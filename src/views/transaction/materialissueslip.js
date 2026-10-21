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
    FaPrint,
    FaTimes,
} from 'react-icons/fa'

import { toast } from 'react-toastify'
import API from '../../api.js'

import '../../assets/CSS/materialIssueSlip.css'

// One printed slip (sheet) holds this many item rows, like the paper
// form. Anything above this continues on the next slip (next page)
// with the same header, signatures and "Page n/N".
const ROWS_PER_SLIP = 8

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
        item?.fifoPalletNo,
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

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000

// IMPORTANT:
// One IssueNumber represents one physical Material Issue Slip.
// The slip lists ONE ROW PER PART (like the paper form):
//   S.NO | PART NO | PART NAME | QUANTITY | ISSUED QTY | M/C. / FIFO No.
// All pallets of the same part are added together, and their FIFO
// numbers are listed in the last column.
const consolidateItems = (items = []) => {
    const grouped = new Map()

    items.forEach((item, index) => {
        const partNumber = String(
            item?.partNumber ?? item?.itemNumber ?? item?.partNo ?? ''
        ).trim()

        const partName = item?.partName ?? item?.itemName ?? '—'
        const quantity = Number(item?.quantity ?? item?.qty ?? 0) || 0
        const fifoNumbers = getItemFifoNumbers(item)
        const palletNumbers = getItemPalletNumbers(item)
        const grnNumbers = getItemGrnNumbers(item)

        const groupKey = partNumber.toLowerCase() || `__part_${index}`

        if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
                partNumber: partNumber || '—',
                partName,
                quantity,
                fifoNumbers,
                palletNumbers,
                grnNumbers,
            })
            return
        }

        const existing = grouped.get(groupKey)
        existing.quantity += quantity
        existing.fifoNumbers = uniqueDisplayValues([existing.fifoNumbers, fifoNumbers])
        existing.palletNumbers = uniqueDisplayValues([existing.palletNumbers, palletNumbers])
        existing.grnNumbers = uniqueDisplayValues([existing.grnNumbers, grnNumbers])
    })

    return Array.from(grouped.values()).map((row) => ({
        ...row,
        quantity: round3(row.quantity),
    }))
}

// Split the item rows into slips of ROWS_PER_SLIP rows each.
// An empty list still produces one (blank) slip.
const chunkItems = (items, size) => {
    if (!items.length) return [[]]

    const pages = []

    for (let i = 0; i < items.length; i += size) {
        pages.push(items.slice(i, i + size))
    }

    return pages
}

// =========================================================
// SLIP STYLES
// Self-contained: used for the on-screen preview AND the print
// window, so both look exactly the same.
// =========================================================
const SLIP_CSS = `
.mis2-slip {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    background: #ffffff;
    color: #111827;
    border: 1.5px solid #111827;
    font-family: Arial, Helvetica, sans-serif;
    box-sizing: border-box;
}
.mis2-slip * { box-sizing: border-box; }
.mis2-slip + .mis2-slip { margin-top: 16px; }

.mis2-title {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 6px 12px;
    border-bottom: 1px solid #111827;
}
.mis2-logo {
    width: 38px;
    height: 28px;
    margin-right: 12px;
    object-fit: contain;
    display: block;
    flex-shrink: 0;
}
.mis2-heading {
    flex: 1;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 1.4px;
    line-height: 1.15;
    color: #111827;
}
.mis2-page {
    width: 50px;
    flex-shrink: 0;
    text-align: right;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
}

.mis2-info {
    display: grid;
    grid-template-columns: 1.7fr 1.2fr 1.4fr 1fr;
    border-bottom: 1px solid #111827;
}
.mis2-info-cell {
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-width: 0;
    padding: 5px 10px;
    border-right: 1px solid #111827;
    font-size: 11.5px;
    line-height: 1.3;
}
.mis2-info-cell:last-child { border-right: none; }
.mis2-info-label { font-weight: 700; white-space: nowrap; }
.mis2-info-value { font-weight: 600; word-break: break-word; }

.mis2-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin: 0;
}
.mis2-table th,
.mis2-table td {
    border: 1px solid #111827;
    padding: 4px 6px;
    font-size: 11px;
    line-height: 1.25;
    text-align: center;
    vertical-align: middle;
    word-break: break-word;
}
.mis2-table th {
    background: #eef2f7;
    font-weight: 700;
    padding: 5px 6px;
}
.mis2-table td { height: 32px; }
.mis2-table thead th { border-top: none; }
.mis2-table th:first-child,
.mis2-table td:first-child { border-left: none; }
.mis2-table th:last-child,
.mis2-table td:last-child { border-right: none; }
.mis2-table td.mis2-left { text-align: left; }

.mis2-table .c-sno   { width: 7%; }
.mis2-table .c-part  { width: 15%; }
.mis2-table .c-name  { width: 31%; }
.mis2-table .c-qty   { width: 11%; }
.mis2-table .c-iss   { width: 12%; }
.mis2-table .c-fifo  { width: 24%; }

.mis2-remarks {
    min-height: 30px;
    padding: 5px 10px;
    border-top: 1px solid #111827;
    font-size: 11px;
    line-height: 1.3;
}
.mis2-remarks strong { margin-right: 4px; }

.mis2-sign {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-top: 1px solid #111827;
}
.mis2-sign-box {
    height: 54px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 8px 5px;
    border-right: 1px solid #111827;
    font-size: 10.5px;
    font-weight: 700;
    text-align: center;
}
.mis2-sign-box:last-child { border-right: none; }

.mis2-thanks {
    border-top: 1px solid #111827;
    padding: 4px;
    font-size: 10.5px;
    font-weight: 700;
    text-align: center;
}
`

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
    // Opens only the slip(s) in a clean print window.
    // Every slip (8 rows each) prints on its own page.
    // The slip uses its own self-contained styles (SLIP_CSS),
    // so the printout matches the on-screen preview.
    // =====================================================
    const printMaterialIssueSlip = () => {
        const slipElements = Array.from(
            document.querySelectorAll('.mis2-slip')
        )

        if (!slipElements.length) {
            toast.error('Material Issue Slip is not available for printing')
            return
        }

        const printWindow = window.open(
            '',
            '_blank',
            'width=1280,height=900,scrollbars=yes,resizable=yes'
        )

        if (!printWindow) {
            toast.error('Please allow pop-ups to print the Material Issue Slip')
            return
        }

        const slipHtml = slipElements
            .map((element) => element.outerHTML)
            .join('')

        printWindow.document.open()
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8" />
                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1.0"
                    />
                    <title>Material Requisition and Issue Slip</title>

                    <style>
                        ${SLIP_CSS}

                        @page {
                            size: A4 landscape;
                            margin: 8mm;
                        }

                        html,
                        body {
                            margin: 0;
                            padding: 0;
                            background: #ffffff;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }

                        .mis2-slip {
                            max-width: none;
                            width: calc(100% - 4px);
                            margin: 2px auto;
                            break-inside: avoid;
                            page-break-inside: avoid;
                            break-after: page;
                            page-break-after: always;
                        }

                        .mis2-slip + .mis2-slip {
                            margin-top: 2px;
                        }

                        .mis2-slip:last-child {
                            break-after: auto;
                            page-break-after: auto;
                        }

                        .mis2-table tr,
                        .mis2-sign {
                            break-inside: avoid;
                            page-break-inside: avoid;
                        }
                    </style>
                </head>

                <body>
                    ${slipHtml}
                </body>
            </html>
        `)

        printWindow.document.close()

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

            setTimeout(() => {
                printWindow.print()

                // Give Chrome time to open/close the native print dialog.
                setTimeout(() => {
                    try {
                        printWindow.close()
                    } catch (error) {
                        // Ignore close errors.
                    }
                }, 1000)
            }, 350)
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
                className="mis-modal"
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


                <CModalBody className="mis-modal-body">

                    {selectedSlip && (
                        (() => {
                            const slipGrnNumbers = getGrnNumbers(selectedSlip)
                            const consolidatedItems = consolidateItems(
                                selectedSlip.items || []
                            )
                            const slipPages = chunkItems(
                                consolidatedItems,
                                ROWS_PER_SLIP
                            )

                            return (
                                <>

                                    <style>{SLIP_CSS}</style>

                                    <div className="mis-document-toolbar">
                                        <div className="mis-document-label">
                                            Ready to print
                                        </div>

                                        <div className="mis-document-meta">
                                            A4 Landscape • Material Issue Slip
                                            {slipPages.length > 1
                                                ? ` • ${slipPages.length} pages`
                                                : ''}
                                        </div>
                                    </div>

                                    <div className="mis-document-frame">

                                        {slipPages.map((pageItems, pageIndex) => {
                                            const blankRowCount = Math.max(
                                                ROWS_PER_SLIP - pageItems.length,
                                                0
                                            )

                                            return (
                                                <div
                                                    className="mis2-slip"
                                                    key={`slip-page-${pageIndex}`}
                                                >

                                                    {/* ==============================
                                                        TITLE
                                                    ============================== */}

                                                    <div className="mis2-title">
                                                        <img
                                                            src="/GLOVIS.png"
                                                            alt="Logo"
                                                            className="mis2-logo"
                                                        />

                                                        <span className="mis2-heading">
                                                            MATERIAL REQUISITION AND ISSUE SLIP
                                                        </span>

                                                        <span className="mis2-page">
                                                            {slipPages.length > 1
                                                                ? `Page ${pageIndex + 1}/${slipPages.length}`
                                                                : ''}
                                                        </span>
                                                    </div>


                                                    {/* ==============================
                                                        HEADER FIELDS (label : value)
                                                    ============================== */}

                                                    <div className="mis2-info">

                                                        <div className="mis2-info-cell">
                                                            <span className="mis2-info-label">GRN No :</span>
                                                            <span className="mis2-info-value">
                                                                {slipGrnNumbers.length
                                                                    ? slipGrnNumbers.join(', ')
                                                                    : '—'}
                                                            </span>
                                                        </div>

                                                        <div className="mis2-info-cell">
                                                            <span className="mis2-info-label">Issue No :</span>
                                                            <span className="mis2-info-value">
                                                                {selectedSlip.issueNumber || '—'}
                                                            </span>
                                                        </div>

                                                        <div className="mis2-info-cell">
                                                            <span className="mis2-info-label">Date &amp; Time :</span>
                                                            <span className="mis2-info-value">
                                                                {formatDateTime(selectedSlip.issueDate)}
                                                            </span>
                                                        </div>

                                                        <div className="mis2-info-cell">
                                                            <span className="mis2-info-label">Total Qty :</span>
                                                            <span className="mis2-info-value">
                                                                {selectedSlip.totalQuantity || 0}
                                                            </span>
                                                        </div>

                                                    </div>


                                                    {/* ==============================
                                                        ITEMS — one row per part,
                                                        8 rows per slip
                                                    ============================== */}

                                                    <table className="mis2-table">
                                                        <thead>
                                                            <tr>
                                                                <th className="c-sno">S.NO.</th>
                                                                <th className="c-part">PART NO.</th>
                                                                <th className="c-name">PART NAME</th>
                                                                <th className="c-qty">QUANTITY</th>
                                                                <th className="c-iss">ISSUED QTY.</th>
                                                                <th className="c-fifo">M/C. / FIFO No.</th>
                                                            </tr>
                                                        </thead>

                                                        <tbody>
                                                            {pageItems.map((item, itemIndex) => (
                                                                <tr key={`${item.partNumber}-${pageIndex}-${itemIndex}`}>
                                                                    <td>{pageIndex * ROWS_PER_SLIP + itemIndex + 1}</td>
                                                                    <td>{item.partNumber || '—'}</td>
                                                                    <td className="mis2-left">{item.partName || '—'}</td>
                                                                    <td>{item.quantity || 0}</td>
                                                                    <td>{item.quantity || 0}</td>
                                                                    <td>
                                                                        {item.fifoNumbers?.length
                                                                            ? item.fifoNumbers.join(', ')
                                                                            : item.palletNumbers?.length
                                                                                ? item.palletNumbers.join(', ')
                                                                                : '—'}
                                                                    </td>
                                                                </tr>
                                                            ))}

                                                            {/* Blank rows keep every slip at 8 rows */}
                                                            {Array.from({ length: blankRowCount }).map((_, blankIndex) => (
                                                                <tr key={`blank-${pageIndex}-${blankIndex}`}>
                                                                    <td>&nbsp;</td>
                                                                    <td>&nbsp;</td>
                                                                    <td>&nbsp;</td>
                                                                    <td>&nbsp;</td>
                                                                    <td>&nbsp;</td>
                                                                    <td>&nbsp;</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>


                                                    {/* ==============================
                                                        REMARKS
                                                    ============================== */}

                                                    <div className="mis2-remarks">
                                                        <strong>Remarks :</strong>
                                                        {selectedSlip.remarks || ''}
                                                    </div>


                                                    {/* ==============================
                                                        APPROVAL
                                                    ============================== */}

                                                    <div className="mis2-sign">
                                                        <div className="mis2-sign-box">
                                                            <span>PREPARED BY</span>
                                                        </div>

                                                        <div className="mis2-sign-box">
                                                            <span>CHECKED BY</span>
                                                        </div>

                                                        <div className="mis2-sign-box">
                                                            <span>APPROVED BY</span>
                                                        </div>
                                                    </div>


                                                    <div className="mis2-thanks">
                                                        Thank You!
                                                    </div>

                                                </div>
                                            )
                                        })}

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
