import React, {
  useEffect,
  useRef,
  useState,

} from 'react'

import DataTable from 'react-data-table-component'

import {
  CButton,
  CFormInput,
  CCard,
  CCardBody,
   CTooltip,
} from '@coreui/react'

import {
  FaFileExcel,
  FaSearch,
  FaSyncAlt,
} from 'react-icons/fa'

import { toast } from 'react-toastify'

import * as XLSX from 'xlsx'

import API from '../../api.js'

import '../../assets/CSS/Grnreport.css'


// ============================================================
// DATE FORMAT
// ============================================================

const formatDate = (value) => {
  if (!value) return ''

  const d = new Date(value)

  if (Number.isNaN(d.getTime())) {
    return ''
  }

  return `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1,
  ).padStart(2, '0')}/${d.getFullYear()}`
}

// ============================================================
// TOOLTIP CELL
// Shows complete value when grid text is truncated
// ============================================================

const TooltipCell = ({ value }) => {
  const text =
    value === null ||
    value === undefined ||
    value === ''
      ? '—'
      : String(value)

  return (
    <CTooltip
      content={text}
      placement="top"
    >
      <span className="grn-report-tooltip-cell">
        {text}
      </span>
    </CTooltip>
  )
}


// ============================================================
// ERROR MESSAGE
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

  return fallback
}


// ============================================================
// GRN REPORT
// ============================================================

const GrnReport = () => {

  // ==========================================================
  // STATE
  // ==========================================================

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState([])

  // Server-side pagination: only one page is loaded into the browser.
  const [totalRows, setTotalRows] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Summary values are returned by the server for the complete filtered result.
  const [summary, setSummary] = useState({
    totalQuantity: 0,
    totalValue: 0,
    postedCount: 0,
  })

  const [loading, setLoading] = useState(false)

  const [hasSearched, setHasSearched] = useState(false)


  // ==========================================================
  // DATE INPUT REFERENCES
  // ==========================================================

  const fromDateRef = useRef(null)
  const toDateRef = useRef(null)
  const searchMountedRef = useRef(false)
  const skipNextSearchEffectRef = useRef(false)


  // ==========================================================
  // OPEN DATE PICKER
  // Clicking anywhere inside date input opens picker
  // ==========================================================

  const openDatePicker = (inputRef) => {

    const input = inputRef.current

    if (!input) {
      return
    }

    try {

      if (typeof input.showPicker === 'function') {
        input.showPicker()
      } else {
        input.focus()
        input.click()
      }

    } catch (error) {

      input.focus()
      input.click()

    }
  }


  // ==========================================================
  // LOAD REPORT
  // ==========================================================

  const loadReport = async (
    customFromDate,
    customToDate,
    customPage = currentPage,
    customPageSize = rowsPerPage,
    customSearch = search,
    exportAll = false,
  ) => {
    const selectedFromDate =
      customFromDate !== undefined ? customFromDate : fromDate

    const selectedToDate =
      customToDate !== undefined ? customToDate : toDate

    const selectedSearch =
      customSearch !== undefined ? customSearch : search

    if (
      selectedFromDate &&
      selectedToDate &&
      selectedFromDate > selectedToDate
    ) {
      toast.error('From Date cannot be after To Date')
      return
    }

    setLoading(true)

    try {
      const params = {
        page: customPage,
        pageSize: customPageSize,
      }

      if (selectedFromDate) params.fromDate = selectedFromDate
      if (selectedToDate) params.toDate = selectedToDate
      if (selectedSearch?.trim()) params.search = selectedSearch.trim()

      if (exportAll) {
        params.exportAll = true
      }

      const res = await API.get('/Reports/grn', { params })

      if (exportAll) {
        return res.data || []
      }

      const result = res.data || {}

      setRows(Array.isArray(result.data) ? result.data : [])
      setTotalRows(Number(result.totalRows) || 0)

      setSummary({
        totalQuantity: Number(result.totalQuantity) || 0,
        totalValue: Number(result.totalValue) || 0,
        postedCount: Number(result.postedCount) || 0,
      })

      setHasSearched(true)
    } catch (err) {
      toast.error(
        getErrorMessage(err, 'Failed to load GRN report'),
      )

      if (!exportAll) {
        setRows([])
        setTotalRows(0)
      }
    } finally {
      setLoading(false)
    }
  }


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {

    loadReport()

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [])


  // ==========================================================
  // CLEAR
  // ==========================================================

  const handleClear = async () => {
    setFromDate('')
    setToDate('')
    setSearch('')
    setCurrentPage(1)
    skipNextSearchEffectRef.current = true

    await loadReport('', '', 1, rowsPerPage, '')
  }


  // ==========================================================
  // TEXT SEARCH
  // ==========================================================

  // Filtering is performed by the API now, so the browser never loads
  // the complete report just to search it.
  const filteredRows = rows


  // ==========================================================
  // SERVER-SIDE TEXT SEARCH
  // Wait briefly while the user types, then request only the
  // first page of matching records from the API.
  // ==========================================================

  useEffect(() => {
    // Initial data is loaded by the dedicated initial-load effect below.
    if (!searchMountedRef.current) {
      searchMountedRef.current = true
      return
    }

    if (skipNextSearchEffectRef.current) {
      skipNextSearchEffectRef.current = false
      return
    }

    const timer = setTimeout(() => {
      setCurrentPage(1)
      loadReport(undefined, undefined, 1, rowsPerPage, search)
    }, 400)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])


  // ==========================================================
  // EXPORT TO EXCEL
  // ==========================================================

  const handleExportExcel = async () => {
    if (totalRows === 0) {
      toast.error('Nothing to export — run a search first')
      return
    }

    setLoading(true)

    try {
      const exportRows = await loadReport(
        undefined,
        undefined,
        1,
        1000000,
        search,
        true,
      )

      if (!Array.isArray(exportRows) || exportRows.length === 0) {
        toast.error('Nothing to export for the selected filters')
        return
      }

      const exportData =
      filteredRows.map((r) => ({

        'GRN No':
          r.grnNumber,

        'Supplier Name':
          r.supplierName,

        'PO Number':
          r.poNumber,

        'PO Date':
          formatDate(r.poDate),

        'GRN Type':
          r.grnType,

        'Invoice Number':
          r.supplierInvoiceNumber,

        'Invoice Date':
          formatDate(
            r.supplierInvoiceDate,
          ),

        'Part Number':
          r.partNumber,

        'Part Name':
          r.partName,

        Quantity:
          r.quantity,

        'Pallet Quantity':
          r.palletQuantity,

        Rate:
          r.rate,

        'Total Value':
          r.totalValue,

        Status:
          r.isPosted
            ? 'Posted'
            : 'Not Posted',

        'Pallet No':
          r.palletNo,

        'FIFO Pallet No':
          r.fifoPalletNo,

      }))


    const worksheet =
      XLSX.utils.json_to_sheet(
        exportData,
      )


    const workbook =
      XLSX.utils.book_new()


    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'GRN Report',
    )


    const rangeLabel =
      fromDate && toDate

        ? `${fromDate}_to_${toDate}`

        : fromDate

          ? `from_${fromDate}`

          : toDate

            ? `to_${toDate}`

            : 'all'


      XLSX.writeFile(
        workbook,
        `GRN_Report_${rangeLabel}.xlsx`,
      )
    } catch (err) {
      toast.error(
        getErrorMessage(err, 'Failed to export GRN report'),
      )
    } finally {
      setLoading(false)
    }
  }


  // ==========================================================
  // TABLE COLUMNS
  // ==========================================================

// ============================================================
// TABLE COLUMNS
// ============================================================

const columns = [
  // ----------------------------------------------------------
  // GRN NO
  // ----------------------------------------------------------
  {
    name: 'GRN NO',
    selector: (row) => row.grnNumber,
    sortable: true,
    minWidth: '110px',

    cell: (row) => (
      <TooltipCell value={row.grnNumber} />
    ),
  },

  // ----------------------------------------------------------
  // SUPPLIER
  // ----------------------------------------------------------
  {
    name: 'SUPPLIER',
    selector: (row) => row.supplierName,
    sortable: true,
    wrap: true,
    minWidth: '145px',

    cell: (row) => (
      <TooltipCell value={row.supplierName} />
    ),
  },

  // ----------------------------------------------------------
  // PO NUMBER
  // ----------------------------------------------------------
  {
    name: 'PO NUMBER',
    selector: (row) => row.poNumber,
    sortable: true,
    minWidth: '120px',

    cell: (row) => (
      <TooltipCell value={row.poNumber} />
    ),
  },

  // ----------------------------------------------------------
  // PO DATE
  // ----------------------------------------------------------
  {
    name: 'PO DATE',
    selector: (row) => row.poDate,
    sortable: true,
    width: '110px',

    cell: (row) => (
      <TooltipCell
        value={formatDate(row.poDate)}
      />
    ),
  },

  // ----------------------------------------------------------
  // SUPPLIER INVOICE NUMBER
  // ----------------------------------------------------------
  {
    name: 'SUPPLIER INVOICE NO',
    selector: (row) => row.supplierInvoiceNumber,
    sortable: true,
    minWidth: '185px',

    cell: (row) => (
      <TooltipCell
        value={row.supplierInvoiceNumber}
      />
    ),
  },

  // ----------------------------------------------------------
  // PART
  // ----------------------------------------------------------
  {
    name: 'PART',
    selector: (row) => row.partNumber,
    sortable: true,
    width: '105px',

    cell: (row) => (
      <TooltipCell value={row.partNumber} />
    ),
  },

  // ----------------------------------------------------------
  // PART NAME
  // ----------------------------------------------------------
  {
    name: 'PART NAME',
    selector: (row) => row.partName,
    wrap: true,
    minWidth: '150px',

    cell: (row) => (
      <TooltipCell value={row.partName} />
    ),
  },

  // ----------------------------------------------------------
  // QTY
  // ----------------------------------------------------------
  {
    name: 'QTY',
    selector: (row) => row.quantity ?? 0,
    sortable: true,
    center: true,
    width: '75px',

    cell: (row) => (
      <TooltipCell
        value={row.quantity ?? 0}
      />
    ),
  },

  // ----------------------------------------------------------
  // PALLET QTY
  // ----------------------------------------------------------
  {
    name: 'PALLET QTY',
    selector: (row) => row.palletQuantity ?? '—',
    center: true,
    width: '105px',

    cell: (row) => (
      <TooltipCell
        value={row.palletQuantity ?? '—'}
      />
    ),
  },

  // ----------------------------------------------------------
  // RATE
  // ----------------------------------------------------------
  {
    name: 'RATE (₹)',
    selector: (row) =>
      row.rate != null
        ? Number(row.rate).toFixed(2)
        : '—',

    center: true,
    width: '105px',

    cell: (row) => (
      <TooltipCell
        value={
          row.rate != null
            ? Number(row.rate).toFixed(2)
            : '—'
        }
      />
    ),
  },

  // ----------------------------------------------------------
  // TOTAL VALUE
  // ----------------------------------------------------------
  {
    name: 'TOTAL VALUE (₹)',

    selector: (row) =>
      row.totalValue != null
        ? Number(row.totalValue).toFixed(2)
        : '—',

    sortable: true,
    center: true,
    minWidth: '125px',

    cell: (row) => (
      <TooltipCell
        value={
          row.totalValue != null
            ? Number(row.totalValue).toFixed(2)
            : '—'
        }
      />
    ),
  },

  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------
  {
    name: 'STATUS',
    center: true,
    width: '110px',

    cell: (row) => (
      <span
        className={`grn-report-status-badge ${
          row.isPosted
            ? 'posted'
            : 'unposted'
        }`}
      >
        {row.isPosted
          ? 'Posted'
          : 'Not Posted'}
      </span>
    ),
  },
]

  // ==========================================================
  // DATA TABLE STYLES
  // ==========================================================

  const customStyles = {

    table: {

      style: {
        width: '100%',
      },

    },


    rows: {

      style: {
        minHeight: '44px',
      },

    },


    headRow: {

      style: {

        minHeight: '46px',

        backgroundColor:
          '#f1f4fa',

        borderBottom:
          '1px solid #d8deea',

      },

    },


    headCells: {

      style: {

        justifyContent:
          'center',

        textAlign:
          'center',

        fontSize:
          '12px',

        fontWeight:
          700,

        color:
          '#23395d',

        textTransform:
          'uppercase',

        backgroundColor:
          '#f1f4fa',

      },

    },


    cells: {

      style: {

        justifyContent:
          'center',

        textAlign:
          'center',

        fontSize:
          '13px',

        color:
          '#1f2937',

      },

    },


    pagination: {

      style: {

        borderTop:
          'none',

        minHeight:
          '52px',

        paddingRight:
          '10px',

      },

    },

  }


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const totalQuantity = summary.totalQuantity
  const totalValue = summary.totalValue
  const postedCount = summary.postedCount


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="grn-report-page">


      {/* ======================================================
          FIRST CARD
          DATE + CENTER BUTTONS
          ====================================================== */}

      <CCard
        className="grn-report-filter-card"
      >

        <CCardBody>


          {/* TITLE */}

          <div className="section-title">
            GRN Report
          </div>


          {/* ==================================================
              DATE ROW
              ================================================== */}

          <div className="grn-report-filter-row">


            {/* FROM DATE */}

            <div
              className="grn-report-filter-field"
            >

              <label className="custom-label">
                From Date
              </label>


              <div
                className="grn-report-date-wrapper"
                onClick={() =>
                  openDatePicker(
                    fromDateRef,
                  )
                }
              >

                <CFormInput
                  ref={fromDateRef}

                  type="date"

                  value={fromDate}

                  onChange={(e) =>
                    setFromDate(
                      e.target.value,
                    )
                  }

                  className="grn-report-date-input"

                  aria-label="From Date"
                />

              </div>

            </div>


            {/* TO DATE */}

            <div
              className="grn-report-filter-field"
            >

              <label className="custom-label">
                To Date
              </label>


              <div
                className="grn-report-date-wrapper"
                onClick={() =>
                  openDatePicker(
                    toDateRef,
                  )
                }
              >

                <CFormInput
                  ref={toDateRef}

                  type="date"

                  value={toDate}

                  onChange={(e) =>
                    setToDate(
                      e.target.value,
                    )
                  }

                  className="grn-report-date-input"

                  aria-label="To Date"
                />

              </div>

            </div>

          </div>


          {/* ==================================================
              CENTER BUTTONS
              ================================================== */}

          <div className="grn-report-date-actions">

            <CButton
              type="button"

              className="grn-report-search-btn"

              onClick={() => {
                setCurrentPage(1)
                loadReport(undefined, undefined, 1, rowsPerPage, search)
              }}

              disabled={loading}
            >

              <FaSearch size={12} />

              <span>
                {loading
                  ? 'Loading...'
                  : 'Search'}
              </span>

            </CButton>


            <CButton
              type="button"

              className="grn-report-clear-btn"

              onClick={
                handleClear
              }
            >

              <FaSyncAlt size={12} />

              <span>
                Clear
              </span>

            </CButton>

          </div>


        </CCardBody>

      </CCard>



      {/* ======================================================
          SECOND CARD
          SUMMARY + EXPORT + SEARCH + GRID
          ====================================================== */}

      <CCard
        className="grn-report-result-card"
      >

        <CCardBody>


          {/* ==================================================
              SUMMARY
              ================================================== */}

          <div className="grn-report-summary-row">


            <div>

              <span>
                Total Records
              </span>

              <strong>
                {totalRows}
              </strong>

            </div>


            <div>

              <span>
                Posted Items
              </span>

              <strong>
                {postedCount}
              </strong>

            </div>


            <div>

              <span>
                Total Quantity
              </span>

              <strong>
                {totalQuantity.toLocaleString()}
              </strong>

            </div>


            <div>

              <span>
                Total Value
              </span>

              <strong>
                ₹{totalValue.toFixed(2)}
              </strong>

            </div>


          </div>


          {/* ==================================================
              SECOND CARD TOOLBAR

              LEFT  = EXPORT
              RIGHT = SEARCH INPUT
              ================================================== */}

          <div className="grn-report-result-toolbar">


            {/* EXPORT - LEFT */}

            <div className="grn-report-export-wrapper">

              <CButton
                type="button"

                className="grn-report-export-btn"

                onClick={handleExportExcel}
                disabled={loading || totalRows === 0}
              >

                <FaFileExcel size={13} />

                <span>
                  Export to Excel
                </span>

              </CButton>

            </div>


            {/* SEARCH - RIGHT */}

          <div className="grn-report-grid-search">

  <CFormInput
    type="text"
    className="grn-report-search-input"
    placeholder="Search by GRN No, Supplier, PO Number, Invoice Number, Part..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    aria-label="Search GRN report"
  />

</div>

          </div>


          {/* ==================================================
              GRN GRID
              ================================================== */}

          <div className="grn-report-table-wrapper">

            <DataTable

              columns={columns}

              data={filteredRows}

              pagination
              paginationServer
              paginationTotalRows={totalRows}
              paginationDefaultPage={currentPage}
              paginationPerPage={rowsPerPage}
              paginationRowsPerPageOptions={[
                10,
                25,
                50,
                100,
              ]}
              onChangePage={(page) => {
                setCurrentPage(page)
                loadReport(undefined, undefined, page, rowsPerPage, search)
              }}
              onChangeRowsPerPage={(newPerPage, page) => {
                setRowsPerPage(newPerPage)
                setCurrentPage(page)
                loadReport(undefined, undefined, page, newPerPage, search)
              }}

              persistTableHead

              striped

              responsive

              highlightOnHover

              progressPending={
                loading
              }

              noDataComponent={

                <div className="grn-report-empty">

                  {hasSearched

                    ? 'No records found for the selected filters'

                    : 'Run a search to see results'}

                </div>

              }

              customStyles={
                customStyles
              }

            />

          </div>


        </CCardBody>

      </CCard>


    </div>

  )
}


export default GrnReport