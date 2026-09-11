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

import '../../assets/CSS/materialIssueReport.css'


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
// DATE TIME FORMAT
// ============================================================

const formatDateTime = (value) => {
  if (!value) return ''

  const d = new Date(value)

  if (Number.isNaN(d.getTime())) {
    return ''
  }

  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')

  return `${formatDate(value)} ${hh}:${mm}`
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
// TOOLTIP CELL
// Shows the complete value when grid content is truncated
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
      <span className="mi-report-tooltip-cell">
        {text}
      </span>
    </CTooltip>
  )
}


// ============================================================
// MATERIAL ISSUE REPORT
// ============================================================

const MaterialIssueReport = () => {

  // ==========================================================
  // STATE
  // ==========================================================

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState([])

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalRows, setTotalRows] = useState(0)

  // Server-side summary values
  const [totalQuantity, setTotalQuantity] = useState(0)
  const [uniquePartsCount, setUniquePartsCount] = useState(0)

  const [loading, setLoading] = useState(false)

  const [hasSearched, setHasSearched] = useState(false)


  // ==========================================================
  // DATE INPUT REFERENCES
  // ==========================================================

  const fromDateRef = useRef(null)
  const toDateRef = useRef(null)


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
  // LOAD REPORT - SERVER SIDE PAGINATION
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
      customFromDate !== undefined
        ? customFromDate
        : fromDate

    const selectedToDate =
      customToDate !== undefined
        ? customToDate
        : toDate

    const selectedSearch =
      customSearch !== undefined
        ? customSearch
        : search

    // --------------------------------------------------------
    // DATE VALIDATION
    // --------------------------------------------------------

    if (
      selectedFromDate &&
      selectedToDate &&
      selectedFromDate > selectedToDate
    ) {

      toast.error(
        'From Date cannot be after To Date',
      )

      return
    }

    setLoading(true)

    try {

      const params = {
        page: exportAll ? 1 : customPage,
        pageSize: exportAll ? 1000000 : customPageSize,
      }

      if (selectedFromDate) {
        params.fromDate = selectedFromDate
      }

      if (selectedToDate) {
        params.toDate = selectedToDate
      }

      if (selectedSearch?.trim()) {
        params.search = selectedSearch.trim()
      }

      if (exportAll) {
        params.exportAll = true
      }

      const res = await API.get(
        '/Reports/material-issue',
        {
          params,
        },
      )

      // Export requests return the array directly.
      if (exportAll) {
        return res.data || []
      }

      // Normal grid requests return paged data + total count + summary.
      setRows(res.data?.data || [])
      setTotalRows(res.data?.totalRows || 0)
      setTotalQuantity(res.data?.totalQuantity || 0)
      setUniquePartsCount(res.data?.uniquePartsCount || 0)
      setCurrentPage(res.data?.page || customPage)
      setRowsPerPage(res.data?.pageSize || customPageSize)
      setHasSearched(true)

    } catch (err) {

      toast.error(
        getErrorMessage(
          err,
          'Failed to load Material Issue report',
        ),
      )

    } finally {

      setLoading(false)

    }
  }

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {

    loadReport(
      undefined,
      undefined,
      1,
      10,
      '',
    )

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

    await loadReport(
      '',
      '',
      1,
      rowsPerPage,
      '',
    )

  }


  // ==========================================================
  // SERVER SIDE SEARCH
  // ==========================================================

  useEffect(() => {

    const timer = setTimeout(() => {

      // Search only after the user pauses typing.
      // This prevents an API request for every keystroke.
      if (hasSearched) {
        setCurrentPage(1)

        loadReport(
          undefined,
          undefined,
          1,
          rowsPerPage,
          search,
        )
      }

    }, 400)

    return () => clearTimeout(timer)

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [search])


  // ==========================================================
  // EXPORT TO EXCEL
  // ==========================================================

  const handleExportExcel = async () => {

    setLoading(true)

    try {

      const exportRows = await loadReport(
        undefined,
        undefined,
        1,
        rowsPerPage,
        search,
        true,
      )

      if (!exportRows || exportRows.length === 0) {

        toast.error(
          'Nothing to export — run a search first',
        )

        return
      }

      const exportData = exportRows.map((r) => ({

        'Issue Number':
          r.issueNumber,

        'Part Number':
          r.partNumber,

        'Part Name':
          r.partName,

        Quantity:
          r.quantity,

        'Issued To':
          r.issuedTo,

        'Issued By':
          r.issuedBy,

        'Store Location':
          r.storeLocation,

        'Pallet No':
          r.palletNo,

        'GRN No':
          r.grnNumber,

        Remarks:
          r.remarks,

        'Issue Date':
          formatDateTime(r.issueDate),

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
        'Material Issue Report',
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
        `Material_Issue_Report_${rangeLabel}.xlsx`,
      )

    } catch (err) {

      toast.error(
        getErrorMessage(
          err,
          'Failed to export Material Issue report',
        ),
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


    {
      name: 'S.NO',
      width: '65px',
      center: true,
      cell: (row, index) => (
        <TooltipCell
          value={
            (currentPage - 1) * rowsPerPage + index + 1
          }
        />
      ),
    },

    {
      name: 'PART NUMBER',
      selector: (row) => row.partNumber,
      sortable: true,
      width: '120px',

      cell: (row) => (
        <TooltipCell value={row.partNumber} />
      ),
    },

    {
      name: 'PART NAME',
      selector: (row) => row.partName,
      wrap: true,
      minWidth: '150px',

      cell: (row) => (
        <TooltipCell value={row.partName} />
      ),
    },

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

    {
      name: 'PALLET NO',
      selector: (row) => row.palletNo ?? '—',
      width: '110px',

      cell: (row) => (
        <TooltipCell
          value={row.palletNo ?? '—'}
        />
      ),
    },

    {
      name: 'GRN NO',
      selector: (row) => row.grnNumber ?? '—',
      minWidth: '110px',

      cell: (row) => (
        <TooltipCell
          value={row.grnNumber ?? '—'}
        />
      ),
    },


    // {
    //   name: 'ISSUED TO',
    //   selector: (row) => row.issuedTo,
    //   sortable: true,
    //   wrap: true,
    //   minWidth: '120px',

    //   cell: (row) => (
    //     <TooltipCell value={row.issuedTo} />
    //   ),
    // },

    {
      name: 'ISSUE NO',
      selector: (row) => row.issueNumber,
      sortable: true,
      minWidth: '120px',

      cell: (row) => (
        <TooltipCell value={row.issueNumber} />
      ),
    },

    {
      name: 'ISSUED BY',
      selector: (row) => row.issuedTo,
      minWidth: '110px',

      cell: (row) => (
        <TooltipCell value={row.issuedTo} />
      ),
    },

    // {
    //   name: 'STORE LOCATION',
    //   selector: (row) => row.storeLocation ?? '—',
    //   minWidth: '130px',

    //   cell: (row) => (
    //     <TooltipCell
    //       value={row.storeLocation ?? '—'}
    //     />
    //   ),
    // },


    {
      name: 'ISSUE DATE',
      selector: (row) => row.issueDate,
      sortable: true,
      minWidth: '155px',

      cell: (row) => (
        <TooltipCell
          value={formatDateTime(row.issueDate)}
        />
      ),
    },
  ]

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
  // UI
  // ==========================================================

  return (

    <div className="mi-report-page">
      <CCard
        className="mi-report-filter-card"
      >
        <CCardBody>
          {/* TITLE */}
          <div className="section-title">
            Material Issue Report
          </div>
          <div className="mi-report-filter-row">
            <div
              className="mi-report-filter-field"
            >
              <label className="custom-label">
                From Date
              </label>


              <div
                className="mi-report-date-wrapper"
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

                  className="mi-report-date-input"

                  aria-label="From Date"
                />
              </div>
            </div>

            <div
              className="mi-report-filter-field"
            >
              <label className="custom-label">
                To Date
              </label>


              <div
                className="mi-report-date-wrapper"
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
                  className="mi-report-date-input"
                  aria-label="To Date"
                />
              </div>
            </div>
          </div>


          {/* ==================================================
              CENTER SEARCH + CLEAR
              ================================================== */}

          <div className="mi-report-date-actions">
            <CButton
              type="button"
              className="mi-report-search-btn"
              onClick={() =>
                loadReport()
              }

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

              className="mi-report-clear-btn"

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

      <CCard
        className="mi-report-result-card"
      >

        <CCardBody>


          {/* ==================================================
              SUMMARY
              ================================================== */}

          {/* <div className="mi-report-summary-row">


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
                Total Quantity
              </span>

              <strong>
                {totalQuantity.toLocaleString()}
              </strong>

            </div>


            <div>

              <span>
                Distinct Parts
              </span>

              <strong>
                {uniquePartsCount}
              </strong>

            </div>


          </div> */}


         

          <div className="mi-report-result-toolbar">
            <div className="mi-report-export-wrapper">
              <CButton
                type="button"
                className="mi-report-export-btn"
                onClick={
                  handleExportExcel
                }
              >

                <FaFileExcel size={13} />
                <span>
                  Export
                </span>
              </CButton>
            </div>

            <div className="mi-report-grid-search">
              <CFormInput
                type="text"

                className="mi-report-search-input"

                placeholder="Search by Issue No, Pallet No, Issued To, Part..."

                value={search}

                onChange={(e) =>
                  setSearch(
                    e.target.value,
                  )
                }

                aria-label="Search Material Issue Report"
              />

            </div>
          </div>
          <div className="mi-report-table-wrapper">
            <DataTable
              columns={columns}

              data={rows}

              pagination

              paginationServer

              paginationTotalRows={totalRows}

              paginationPerPage={rowsPerPage}

              paginationRowsPerPageOptions={[
                10,
                25,
                50,
                100,
              ]}

              onChangePage={(page) => {
                setCurrentPage(page)

                loadReport(
                  undefined,
                  undefined,
                  page,
                  rowsPerPage,
                  search,
                )
              }}

              onChangeRowsPerPage={(newPerPage, page) => {
                setRowsPerPage(newPerPage)
                setCurrentPage(page)

                loadReport(
                  undefined,
                  undefined,
                  page,
                  newPerPage,
                  search,
                )
              }}

              persistTableHead

              striped

              responsive

              highlightOnHover

              progressPending={
                loading
              }

              noDataComponent={

                <div className="mi-report-empty">

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
export default MaterialIssueReport