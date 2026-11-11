
import React, { useEffect, useRef, useState } from 'react'

import DataTable from 'react-data-table-component'
import Select from 'react-select'

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
import '../../assets/CSS/AlertReport.css'

// ============================================================
// ERROR MESSAGE
// ============================================================

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data

  if (!data) return fallback

  if (typeof data === 'string') return data

  return data.message || data.error || fallback
}

// ============================================================
// TOOLTIP CELL
// ============================================================

const TooltipCell = ({ value }) => {
  const text =
    value === null || value === undefined || value === ''
      ? '—'
      : String(value)

  return (
    <CTooltip content={text} placement="top">
      <span className="grn-report-tooltip-cell">
        {text}
      </span>
    </CTooltip>
  )
}

// ============================================================
// NUMBER FORMAT
// ============================================================

const fmtNum = (value) =>
  Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })

const fmtCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

// ============================================================
// REACT SELECT STYLES
// Same as GRN Report
// ============================================================

const alertSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '40px',
    height: '40px',
    borderRadius: '6px',
    borderColor: state.isFocused ? '#3d7ff0' : '#c4d3ea',
    boxShadow: state.isFocused
      ? '0 0 0 3px rgba(61, 127, 240, 0.18)'
      : 'none',
    '&:hover': {
      borderColor: '#4d8df7',
    },
    fontSize: '13px',
    cursor: 'pointer',
  }),

  valueContainer: (base) => ({
    ...base,
    height: '40px',
    padding: '0 12px',
  }),

  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    fontSize: '13px',
  }),

  singleValue: (base) => ({
    ...base,
    color: '#1f2937',
    fontSize: '13px',
  }),

  placeholder: (base) => ({
    ...base,
    color: '#94a9cf',
    fontSize: '13px',
  }),

  indicatorsContainer: (base) => ({
    ...base,
    height: '40px',
  }),

  menu: (base) => ({
    ...base,
    zIndex: 9999,
    fontSize: '13px',
  }),

  option: (base, state) => ({
    ...base,
    fontSize: '13px',
    cursor: 'pointer',
    backgroundColor: state.isSelected
      ? '#0d47a1'
      : state.isFocused
        ? '#eef4ff'
        : '#ffffff',
    color: state.isSelected ? '#ffffff' : '#1f2937',
  }),
}

// ============================================================
// ALERT REPORT COMPONENT
// ============================================================

const AlertReport = () => {
  // ----------------------------------------------------------
  // FILTER STATES
  // ----------------------------------------------------------

  const [search, setSearch] = useState('')
  const [selectedItemGroup, setSelectedItemGroup] = useState('')
  const [selectedPartNumber, setSelectedPartNumber] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('Alert')

  // ----------------------------------------------------------
  // DROPDOWN STATES
  // ----------------------------------------------------------

  const [itemGroupOptions, setItemGroupOptions] = useState([])
  const [partNumberOptions, setPartNumberOptions] = useState([])

  const statusOptions = [
    { value: 'Alert', label: 'All Alerts' },
    { value: 'Danger', label: 'Danger' },
    { value: 'Reorder', label: 'Reorder' },
  ]

  // ----------------------------------------------------------
  // TABLE STATES
  // ----------------------------------------------------------

  const [rows, setRows] = useState([])
  const [totalRows, setTotalRows] = useState(0)

  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------

  const [summary, setSummary] = useState({
    totalOnHandQty: 0,
    totalStockValue: 0,
    dangerCount: 0,
    reorderCount: 0,
  })

  const searchMountedRef = useRef(false)
  const skipNextSearchEffectRef = useRef(false)

  // ==========================================================
  // LOAD ALERT REPORT
  // ==========================================================

  const loadReport = async (
    customPage = 1,
    customPageSize = rowsPerPage,
    customSearch = search,
    customItemGroup = selectedItemGroup,
    customPartNumber = selectedPartNumber,
    customStatus = selectedStatus,
    exportAll = false,
  ) => {
    setLoading(true)

    try {
      const params = {
        page: customPage,
        pageSize: customPageSize,

        // Backend filters Danger + Reorder.
        status: customStatus || 'Alert',
      }

      if (customSearch?.trim()) {
        params.search = customSearch.trim()
      }

      if (customItemGroup) {
        params.itemGroupId = customItemGroup
      }

      if (customPartNumber) {
        params.partNumber = customPartNumber
      }

      if (exportAll) {
        params.exportAll = true
      }

      const res = await API.get('/Reports/stock', {
        params,
      })

      const result = res.data || {}

      // ------------------------------------------------------
      // EXPORT RESPONSE
      // ------------------------------------------------------

      if (exportAll) {
        return Array.isArray(result.data) ? result.data : []
      }

      // ------------------------------------------------------
      // TABLE DATA
      // ------------------------------------------------------

      setRows(
        Array.isArray(result.data) ? result.data : [],
      )

      setTotalRows(
        Number(result.totalRows) || 0,
      )

      // ------------------------------------------------------
      // DROPDOWN OPTIONS
      // ------------------------------------------------------

      if (Array.isArray(result.itemGroups)) {
        setItemGroupOptions(
          result.itemGroups.map((x) => ({
            value: String(x.id),
            label: x.groupName,
          })),
        )
      }

      if (Array.isArray(result.partNumbers)) {
        setPartNumberOptions(
          result.partNumbers.map((x) => ({
            value: x,
            label: x,
          })),
        )
      }

      // ------------------------------------------------------
      // SUMMARY
      // ------------------------------------------------------

      setSummary({
        totalOnHandQty: Number(result.totalOnHandQty) || 0,
        totalStockValue: Number(result.totalStockValue) || 0,
        dangerCount: Number(result.dangerCount) || 0,
        reorderCount: Number(result.reorderCount) || 0,
      })

      setHasSearched(true)

    } catch (err) {
      toast.error(
        getErrorMessage(err, 'Failed to load Alert Report'),
      )

      if (!exportAll) {
        setRows([])
        setTotalRows(0)
      }

      return exportAll ? [] : undefined

    } finally {
      setLoading(false)
    }
  }

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadReport(
      1,
      10,
      '',
      '',
      '',
      'Alert',
    )

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ==========================================================
  // SERVER-SIDE FILTER SEARCH
  // ==========================================================

  useEffect(() => {
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

      loadReport(
        1,
        rowsPerPage,
        search,
        selectedItemGroup,
        selectedPartNumber,
        selectedStatus,
      )
    }, 400)

    return () => clearTimeout(timer)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    selectedItemGroup,
    selectedPartNumber,
    selectedStatus,
  ])

  // ==========================================================
  // SEARCH BUTTON
  // ==========================================================

  const handleSearch = () => {
    setCurrentPage(1)

    loadReport(
      1,
      rowsPerPage,
      search,
      selectedItemGroup,
      selectedPartNumber,
      selectedStatus,
    )
  }

  // ==========================================================
  // CLEAR BUTTON
  // ==========================================================

  const handleClear = () => {
    setSearch('')
    setSelectedItemGroup('')
    setSelectedPartNumber('')
    setSelectedStatus('Alert')

    setCurrentPage(1)

    skipNextSearchEffectRef.current = true

    loadReport(
      1,
      rowsPerPage,
      '',
      '',
      '',
      'Alert',
    )
  }

  // ==========================================================
  // EXPORT EXCEL
  // ==========================================================

  const handleExportExcel = async () => {
    if (totalRows === 0) {
      toast.error('No alert parts available to export')
      return
    }

    try {
      const exportRows = await loadReport(
        1,
        1000000,
        search,
        selectedItemGroup,
        selectedPartNumber,
        selectedStatus,
        true,
      )

      if (!exportRows.length) {
        toast.error('No records found for export')
        return
      }

      const exportData = exportRows.map((r, index) => ({
        'S.NO': index + 1,
        'PART NUMBER': r.partNumber,
        'PART NAME': r.partName,
        'PART GROUP': r.itemGroupName,
        'RECEIVED QTY': r.receivedQty,
        'ISSUED QTY': r.issuedQty,
        'STOCK IN HAND': r.onHandQty,
        'REORDER LEVEL': r.reorderLevel,
        'SAFETY LEVEL': r.safetyLevel,
        'STOCK VALUE': r.stockValue,
        'ALERT STATUS': r.status,
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)

      const workbook = XLSX.utils.book_new()

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Alert Report',
      )

      XLSX.writeFile(
        workbook,
        'Alert_Report.xlsx',
      )

      toast.success('Alert Report exported successfully')

    } catch (err) {
      toast.error(
        getErrorMessage(err, 'Failed to export Alert Report'),
      )
    }
  }

  // ==========================================================
  // TABLE COLUMNS
  // ==========================================================

  const columns = [
    {
      name: 'S.NO',
      width: '75px',
      center: true,
      cell: (row, index) => (
        <TooltipCell
          value={(currentPage - 1) * rowsPerPage + index + 1}
        />
      ),
    },

    {
      name: 'PART NUMBER',
      selector: (row) => row.partNumber,
      sortable: true,
      minWidth: '140px',
      cell: (row) => (
        <TooltipCell value={row.partNumber} />
      ),
    },

    {
      name: 'PART NAME',
      selector: (row) => row.partName,
      sortable: true,
      minWidth: '190px',
      cell: (row) => (
        <TooltipCell value={row.partName} />
      ),
    },

    {
      name: 'PART GROUP',
      selector: (row) => row.itemGroupName,
      sortable: true,
      minWidth: '160px',
      cell: (row) => (
        <TooltipCell value={row.itemGroupName} />
      ),
    },

    {
      name: 'RECEIVED QTY',
      selector: (row) => row.receivedQty,
      sortable: true,
      center: true,
      minWidth: '120px',
      cell: (row) => (
        <TooltipCell value={fmtNum(row.receivedQty)} />
      ),
    },

    {
      name: 'ISSUED QTY',
      selector: (row) => row.issuedQty,
      sortable: true,
      center: true,
      minWidth: '110px',
      cell: (row) => (
        <TooltipCell value={fmtNum(row.issuedQty)} />
      ),
    },

    {
      name: 'STOCK IN HAND',
      selector: (row) => row.onHandQty,
      sortable: true,
      center: true,
      minWidth: '125px',
      cell: (row) => (
        <TooltipCell value={fmtNum(row.onHandQty)} />
      ),
    },

    {
      name: 'REORDER LEVEL',
      selector: (row) => row.reorderLevel,
      sortable: true,
      center: true,
      minWidth: '120px',
      cell: (row) => (
        <TooltipCell value={fmtNum(row.reorderLevel)} />
      ),
    },

    {
      name: 'SAFETY LEVEL',
      selector: (row) => row.safetyLevel,
      sortable: true,
      center: true,
      minWidth: '115px',
      cell: (row) => (
        <TooltipCell value={fmtNum(row.safetyLevel)} />
      ),
    },

    {
      name: 'STOCK VALUE',
      selector: (row) => row.stockValue,
      sortable: true,
      center: true,
      minWidth: '125px',
      cell: (row) => (
        <TooltipCell value={fmtCurrency(row.stockValue)} />
      ),
    },

    {
      name: 'ALERT STATUS',
      selector: (row) => row.status,
      center: true,
      minWidth: '120px',
      cell: (row) => (
        <span
          className={`alert-report-status-badge ${
            row.status?.toLowerCase() === 'danger'
              ? 'danger'
              : 'reorder'
          }`}
        >
          {row.status?.toUpperCase()}
        </span>
      ),
    },
  ]

  // ==========================================================
  // DATATABLE STYLES
  // ==========================================================

  const customStyles = {
    table: {
      style: {
        width: '100%',
      },
    },

    rows: {
      style: {
        minHeight: '34px',
        height: '34px',
      },
    },

    headRow: {
      style: {
        minHeight: '38px',
        height: '38px',
        backgroundColor: '#f1f4fa',
        borderBottom: '1px solid #d8deea',
      },
    },

    headCells: {
      style: {
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: 700,
        color: '#23395d',
        textTransform: 'uppercase',
        backgroundColor: '#f1f4fa',
        paddingLeft: '8px',
        paddingRight: '8px',
      },
    },

    cells: {
      style: {
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '12px',
        color: '#1f2937',
        paddingLeft: '8px',
        paddingRight: '8px',
      },
    },

    pagination: {
      style: {
        borderTop: 'none',
        minHeight: '45px',
        paddingRight: '10px',
      },
    },
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="grn-report-page alert-report-page">

      {/* ====================================================
          FILTER CARD
          ==================================================== */}

      <CCard className="grn-report-filter-card">
        <CCardBody>

          <div className="section-title">
            Alert Report
          </div>

          <div className="grn-report-filter-row">

            {/* PART GROUP */}

            <div className="grn-report-filter-field">
              <label className="custom-label">
                Part Group
              </label>

              <Select
                className="grn-report-react-select"
                classNamePrefix="grn-select"
                styles={alertSelectStyles}
                options={itemGroupOptions}
                value={
                  itemGroupOptions.find(
                    (x) => String(x.value) === String(selectedItemGroup),
                  ) || null
                }
                onChange={(option) => {
                  setSelectedItemGroup(option?.value || '')
                  setCurrentPage(1)
                }}
                isClearable
                isSearchable
                placeholder="Select Part Group"
              />
            </div>

            {/* PART NUMBER */}

            <div className="grn-report-filter-field">
              <label className="custom-label">
                Part Number
              </label>

              <Select
                className="grn-report-react-select"
                classNamePrefix="grn-select"
                styles={alertSelectStyles}
                options={partNumberOptions}
                value={
                  partNumberOptions.find(
                    (x) => String(x.value) === String(selectedPartNumber),
                  ) || null
                }
                onChange={(option) => {
                  setSelectedPartNumber(option?.value || '')
                  setCurrentPage(1)
                }}
                isClearable
                isSearchable
                placeholder="Select Part Number"
              />
            </div>

            {/* ALERT STATUS */}

            <div className="grn-report-filter-field">
              <label className="custom-label">
                Alert Status
              </label>

              <Select
                className="grn-report-react-select"
                classNamePrefix="grn-select"
                styles={alertSelectStyles}
                options={statusOptions}
                value={
                  statusOptions.find(
                    (x) => x.value === selectedStatus,
                  ) || statusOptions[0]
                }
                onChange={(option) => {
                  setSelectedStatus(option?.value || 'Alert')
                  setCurrentPage(1)
                }}
                isSearchable={false}
                placeholder="Select Alert Status"
              />
            </div>

          </div>

          {/* SEARCH / CLEAR BUTTONS */}

          <div className="grn-report-date-actions">

            <CButton
              type="button"
              className="grn-report-search-btn"
              onClick={handleSearch}
              disabled={loading}
            >
              <FaSearch size={12} />
              <span>{loading ? 'Loading...' : 'Search'}</span>
            </CButton>

            <CButton
              type="button"
              className="grn-report-clear-btn"
              onClick={handleClear}
            >
              <FaSyncAlt size={12} />
              <span>Clear</span>
            </CButton>

          </div>

        </CCardBody>
      </CCard>

      {/* ====================================================
          RESULT CARD
          ==================================================== */}

      <CCard className="grn-report-result-card">
        <CCardBody>

          {/* SUMMARY */}

          {/* <div className="alert-report-summary">

            <div className="alert-summary-item">
              <span>Total Alert Parts</span>
              <strong>{fmtNum(totalRows)}</strong>
            </div>

            <div className="alert-summary-item danger-summary">
              <span>Danger Parts</span>
              <strong>{fmtNum(summary.dangerCount)}</strong>
            </div>

            <div className="alert-summary-item reorder-summary">
              <span>Reorder Parts</span>
              <strong>{fmtNum(summary.reorderCount)}</strong>
            </div>

            <div className="alert-summary-item">
              <span>Total Stock Value</span>
              <strong>{fmtCurrency(summary.totalStockValue)}</strong>
            </div>

          </div> */}

          {/* TOOLBAR */}

          <div className="grn-report-result-toolbar">

            <div className="grn-report-export-wrapper">

              <CButton
                type="button"
                className="grn-report-export-btn"
                onClick={handleExportExcel}
                disabled={loading || totalRows === 0}
              >
                <FaFileExcel size={13} />
                <span>Export</span>
              </CButton>

            </div>

            <div className="grn-report-grid-search">

              <CFormInput
                type="text"
                className="grn-report-search-input"
                placeholder="Search by Part Number or Part Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

            </div>

          </div>

          {/* ALERT TABLE */}

          <div className="grn-report-table-wrapper">

            <DataTable
              columns={columns}
              data={rows}

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

                loadReport(
                  page,
                  rowsPerPage,
                  search,
                  selectedItemGroup,
                  selectedPartNumber,
                  selectedStatus,
                )
              }}

              onChangeRowsPerPage={(newPerPage, page) => {
                setRowsPerPage(newPerPage)
                setCurrentPage(page)

                loadReport(
                  page,
                  newPerPage,
                  search,
                  selectedItemGroup,
                  selectedPartNumber,
                  selectedStatus,
                )
              }}

              persistTableHead
              striped
              responsive
              highlightOnHover

              progressPending={loading}

              noDataComponent={
                <div className="grn-report-empty">
                  {hasSearched
                    ? 'No alert parts found for the selected filters'
                    : 'Loading Alert Report...'}
                </div>
              }

              customStyles={customStyles}
            />

          </div>

        </CCardBody>
      </CCard>

    </div>
  )
}

export default AlertReport
