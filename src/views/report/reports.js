import React, { useEffect, useMemo, useRef, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput, CFormCheck, CCard, CCardBody, CTooltip, } from '@coreui/react'
import { FaFileExcel, FaSearch, FaSyncAlt } from 'react-icons/fa'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx';
import API from '../../api.js';
import '../../assets/CSS/reports.css';
import Select from 'react-select';

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const formatDateTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(value)} ${hh}:${mm}`
}

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.message || data.error) return data.message || data.error
  return fallback
}

const TooltipCell = ({ value }) => {
  const displayValue =
    value === null || value === undefined || value === ''
      ? '—'
      : String(value)

  return (
    <CTooltip content={displayValue} placement="top">
      <span
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'default',
        }}
      >
        {displayValue}
      </span>
    </CTooltip>
  )
}

// ★ CHANGED: no more separate GRN / Material Issue tabs. This is now
// ONE merged report covering the full pallet lifecycle — GRN Entry/Post,
// Store Movement, and Material Issue — sourced from the single
// GET /Reports/full endpoint, which already joins all three server-side.
const Reports = () => {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [search, setSearch] = useState('')
  const fromDateRef = useRef(null)
  const toDateRef = useRef(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedItemGroup, setSelectedItemGroup] = useState(null)
  const [selectedSupplier, setSelectedSupplier] = useState(null)

  const [itemOptions, setItemOptions] = useState([])
  const [itemGroupOptions, setItemGroupOptions] = useState([])
  const [supplierOptions, setSupplierOptions] = useState([])

  // ==========================================================
  // Additional checkbox filters
  // ==========================================================
  //
  //   Inward  — rows not yet issued (status !== 'Issued')
  //   Outward — rows that HAVE been issued (status === 'Issued')
  //   Closed  — rows belonging to a GRN where every line has
  //             been issued (fully closed out), computed client
  //             side by grouping the loaded rows by GRN number
  //   Rate / Value — pure column visibility toggles, not row
  //             filters. Off by default; the user turns them on
  //             manually when needed.
  //
  // All five start unchecked. Inward / Outward / Closed are OR'd
  // together — a row is kept if it matches ANY checked category.
  // With none checked (the default), no status restriction is
  // applied at all — every row shows until the user opts into a
  // category — which is also why "no filters checked" behaves the
  // same as "show everything" rather than "show nothing".
  // ==========================================================

  const [inward, setInward] = useState(false)
  const [outward, setOutward] = useState(false)
  const [closed, setClosed] = useState(false)
  const [showRate, setShowRate] = useState(false)
  const [showValue, setShowValue] = useState(false)



  const openDatePicker = (ref) => {
    if (ref.current?.showPicker) {
      ref.current.showPicker()
    }
  }

  const customStyles = {
    rows: {
      style: {
        minHeight: '44px',
      },
    },

    headRow: {
      style: {
        backgroundColor: '#f1f4fa',
      },
    },

    headCells: {
      style: {
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 700,
        color: '#23395d',
        textTransform: 'uppercase',
        backgroundColor: '#f1f4fa',
      },
    },

    cells: {
      style: {
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '13px',
        paddingLeft: '8px',
        paddingRight: '8px',
      },
    },
  }

  useEffect(() => {
    loadReport()
    loadDropdowns()
  }, [])


  const loadReport = async () => {
    if (fromDate && toDate && fromDate > toDate) {
      toast.error('From Date cannot be after To Date')
      return
    }

    setLoading(true)

    try {
      const params = {}

      // Date filters
      if (fromDate) {
        params.fromDate = fromDate
      }

      if (toDate) {
        params.toDate = toDate
      }

      // Item filter
      if (selectedItem?.value) {
        params.itemId = selectedItem.value
      }

      // Item Group filter
      if (selectedItemGroup?.value) {
        params.itemGroupId = selectedItemGroup.value
      }

      // Supplier filter
      if (selectedSupplier?.value) {
        params.supplierId = selectedSupplier.value
      }

      console.log('Report Filters:', params)

      const res = await API.get('/Reports/full', { params })

      setRows(res.data || [])
      setHasSearched(true)
    } catch (err) {
      console.error('Report filter error:', err)
      toast.error(getErrorMessage(err, 'Failed to load report'))
    } finally {
      setLoading(false)
    }
  }


  const loadDropdowns = async () => {
    try {
      const [itemRes, itemGroupRes, supplierRes] = await Promise.all([
        API.get('/ItemMaster'),
        API.get('/ItemGroup'),
        API.get('/SupplierMaster'),
      ])

      setItemOptions(
        (itemRes.data || []).map((x) => ({
          value: x.id,
          label: `${x.itemNumber} - ${x.itemName}`,
        }))
      )

      setItemGroupOptions(
        (itemGroupRes.data || []).map((x) => ({
          value: x.id,
          label: x.groupName,
        }))
      )

      setSupplierOptions(
        (supplierRes.data || []).map((x) => ({
          value: x.id,
          label: x.supplierName,
        }))
      )
    } catch (error) {
      console.error('Failed to load dropdowns', error)
    }
  }

  const handleClear = async () => {
    setFromDate('')
    setToDate('')
    setSearch('')

    setSelectedItem(null)
    setSelectedItemGroup(null)
    setSelectedSupplier(null)

    // Reset the checkbox filters back to their defaults too.
    setInward(false)
    setOutward(false)
    setClosed(false)
    setShowRate(false)
    setShowValue(false)

    setLoading(true)

    try {
      const res = await API.get('/Reports/full')
      setRows(res.data || [])
      setHasSearched(true)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to clear report'))
    } finally {
      setLoading(false)
    }
  }

  // Which GRNs are fully closed — every row loaded for that GRN
  // number has status "Issued". Recomputed whenever the underlying
  // (unfiltered) rows change.
  const closedGrnNumbers = useMemo(() => {
    const byGrn = new Map()

    rows.forEach((r) => {
      const key = r.grnNumber
      if (!byGrn.has(key)) byGrn.set(key, [])
      byGrn.get(key).push(r)
    })

    const closedSet = new Set()
    byGrn.forEach((groupRows, grnNumber) => {
      const allIssued = groupRows.length > 0 && groupRows.every((r) => r.status === 'Issued')
      if (allIssued) closedSet.add(grnNumber)
    })

    return closedSet
  }, [rows])

  const filteredRows = useMemo(() => {
    const searchValue = search.trim().toLowerCase()
    const anyStatusFilterActive = inward || outward || closed

    return rows.filter((row) => {

      if (searchValue) {
        const matchesSearch =
          String(row.grnNumber ?? '').toLowerCase().includes(searchValue) ||
          String(row.partNumber ?? '').toLowerCase().includes(searchValue)
        if (!matchesSearch) return false
      }

      if (anyStatusFilterActive) {
        const isOutwardRow = row.status === 'Issued'
        const isInwardRow = !isOutwardRow
        const isClosedRow = closedGrnNumbers.has(row.grnNumber)

        const matchesCategory =
          (inward && isInwardRow) ||
          (outward && isOutwardRow) ||
          (closed && isClosedRow)

        if (!matchesCategory) return false
      }

      return true
    })
  }, [rows, search, inward, outward, closed, closedGrnNumbers])

  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      toast.error('Nothing to export — run a search first')
      return
    }

    // Exports whatever is currently visible in the table (respects
    // search + Inward/Outward/Closed filters). Rate and Value are
    // always included in the export regardless of the on-screen
    // Rate/Value toggles — those toggles only control what's shown
    // on screen, not what a deliberate export contains.
    const exportData = filteredRows.map((r) => ({
      'GRN No': r.grnNumber,
      'Supplier Name': r.supplierName,
      'PO Number': r.poNumber,
      'PO Date': formatDate(r.poDate),
      'GRN Type': r.grnType,
      'Invoice Number': r.supplierInvoiceNumber,
      'Invoice Date': formatDate(r.supplierInvoiceDate),
      'Part Number': r.partNumber,
      'Part Name': r.partName,
      'Quantity': r.quantity,
      'Pallet Quantity': r.palletQuantity,
      'Rate': r.rate,
      'Total Value': r.totalValue,
      'Label Pallet No': r.labelPalletNo,
      'FIFO Pallet No': r.fifoPalletNo,
      'Store Pallet No': r.storePalletNo,
      'Store Location': r.storeLocation,
      'Movement Date': formatDateTime(r.movementDate),
      'Issued To': r.issuedTo,
      'Issued By': r.issuedBy,
      'Issue Date': formatDateTime(r.issueDate),
      'Status': r.status,
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Full Report')

    const rangeLabel =
      fromDate && toDate
        ? `${fromDate}_to_${toDate}`
        : fromDate
          ? `from_${fromDate}`
          : toDate
            ? `to_${toDate}`
            : 'all'

    XLSX.writeFile(workbook, `Full_Report_${rangeLabel}.xlsx`)
  }

  // One flat column set spanning GRN -> Store Movement -> Material
  // Issue. STATUS reflects the furthest stage each pallet has reached:
  // Not Posted -> Posted -> In Store -> Issued.
  //
  // RATE and TOTAL VALUE are inserted conditionally based on the
  // Rate / Value checkboxes — off by default so cost figures aren't
  // shown unless explicitly requested.
  const columns = useMemo(() => {
    const cols = [
      {
        name: 'GRN NO',
        selector: (row) => row.grnNumber,
        minWidth: '100px',
        cell: (row) => (
          <TooltipCell value={row.grnNumber} />
        ),
      },

      {
        name: 'SUPPLIER',
        selector: (row) => row.supplierName,
        minWidth: '130px',
        cell: (row) => (
          <TooltipCell value={row.supplierName} />
        ),
      },

      {
        name: 'PO DATE',
        selector: (row) => row.poDate,
        width: '100px',
        center: true,
        cell: (row) => (
          <TooltipCell value={formatDate(row.poDate)} />
        ),
      },

      {
        name: 'PART',
        selector: (row) => row.partNumber,
        width: '90px',
        cell: (row) => (
          <TooltipCell value={row.partNumber} />
        ),
      },

      {
        name: 'PART NAME',
        selector: (row) => row.partName,
        minWidth: '120px',
        cell: (row) => (
          <TooltipCell value={row.partName} />
        ),
      },

      {
        name: 'QTY',
        selector: (row) => row.quantity ?? '—',
        center: true,
        width: '70px',
        cell: (row) => (
          <TooltipCell value={row.quantity ?? '—'} />
        ),
      },

      {
        name: 'PALLET QTY',
        selector: (row) => row.palletQuantity ?? '—',
        center: true,
        width: '100px',
        cell: (row) => (
          <TooltipCell value={row.palletQuantity ?? '—'} />
        ),
      },
    ]

    if (showRate) {
      cols.push({
        name: 'RATE (₹)',
        selector: (row) =>
          row.rate != null ? Number(row.rate).toFixed(2) : '—',
        center: true,
        minWidth: '110px',
        cell: (row) => (
          <TooltipCell
            value={row.rate != null ? Number(row.rate).toFixed(2) : '—'}
          />
        ),
      })
    }

    if (showValue) {
      cols.push({
        name: 'TOTAL VALUE (₹)',
        selector: (row) =>
          row.totalValue != null
            ? Number(row.totalValue).toFixed(2)
            : '—',
        center: true,
        minWidth: '160px',
        cell: (row) => (
          <TooltipCell
            value={
              row.totalValue != null
                ? Number(row.totalValue).toFixed(2)
                : '—'
            }
          />
        ),
      })
    }

    cols.push(
      {
        name: 'STORE PALLET',
        selector: (row) => row.storePalletNo ?? '—',
        width: '140px',
        cell: (row) => (
          <TooltipCell value={row.storePalletNo ?? '—'} />
        ),
      },

      {
        name: 'STORE LOCATION',
        selector: (row) => row.storeLocation ?? '—',
        minWidth: '150px',
        cell: (row) => (
          <TooltipCell value={row.storeLocation ?? '—'} />
        ),
      },

      {
        name: 'ISSUED TO',
        selector: (row) => row.issuedTo ?? '—',
        minWidth: '110px',
        cell: (row) => (
          <TooltipCell value={row.issuedTo ?? '—'} />
        ),
      },

      {
        name: 'ISSUE DATE',
        selector: (row) => row.issueDate,
        minWidth: '130px',
        cell: (row) => (
          <TooltipCell
            value={formatDateTime(row.issueDate) || '—'}
          />
        ),
      },

      {
        name: 'STATUS',
        center: true,
        width: '110px',
        cell: (row) => (
          <CTooltip
            content={row.status || '—'}
            placement="top"
          >
            <span
              className={`report-status-badge status-${(
                row.status || ''
              )
                .toLowerCase()
                .replace(/\s+/g, '-')}`}
            >
              {row.status || '—'}
            </span>
          </CTooltip>
        ),
      },
    )

    return cols
  }, [showRate, showValue])

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '38px',
      height: '38px',
      borderRadius: '6px',
      borderColor: state.isFocused ? '#2f6fed' : '#c4d3ea',
      boxShadow: state.isFocused
        ? '0 0 0 3px rgba(47, 111, 237, 0.15)'
        : 'none',
      '&:hover': {
        borderColor: '#7aa7ea',
      },
      fontSize: '13px',
      backgroundColor: '#fff',
    }),

    valueContainer: (base) => ({
      ...base,
      height: '38px',
      padding: '0 10px',
    }),

    indicatorsContainer: (base) => ({
      ...base,
      height: '38px',
    }),

    placeholder: (base) => ({
      ...base,
      color: '#9aa7bd',
      fontSize: '13px',
    }),

    singleValue: (base) => ({
      ...base,
      color: '#1f2937',
      fontSize: '13px',
    }),

    option: (base, state) => ({
      ...base,
      fontSize: '13px',
      backgroundColor: state.isSelected
        ? '#1d5cff'
        : state.isFocused
          ? '#f0f5ff'
          : '#fff',
      color: state.isSelected ? '#fff' : '#1f2937',
      cursor: 'pointer',
    }),

    menu: (base) => ({
      ...base,
      zIndex: 9999,
    }),
  }

  const totalQuantity = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
  const totalValue = rows.reduce((sum, r) => sum + (Number(r.totalValue) || 0), 0)
  const totalIssued = rows.filter((r) => r.status === 'Issued').length

  return (
    <div className="reports-page">
      <CCard className="reports-filter-card mb-3">
        <CCardBody>
          <div className="section-title">Full Report — GRN, Store Movement &amp; Material Issue</div>

          <div className="reports-filter-row">
            <div className="reports-filter-field">
              <label className="custom-label">From Date</label>
              <CFormInput
                ref={fromDateRef}
                type="date"
                value={fromDate}
                onClick={() => openDatePicker(fromDateRef)}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="reports-filter-field">
              <label className="custom-label">To Date</label>
              <CFormInput
                ref={toDateRef}
                type="date"
                value={toDate}
                onClick={() => openDatePicker(toDateRef)}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="reports-filter-field">
              <label className="custom-label">
                Item-wise Report
              </label>

              <Select
                options={itemOptions}
                value={selectedItem}
                onChange={setSelectedItem}
                placeholder="Select Item"
                isClearable
                isSearchable
                styles={selectStyles}
              />
            </div>

            <div className="reports-filter-field">
              <label className="custom-label">
                Item Group-wise Report
              </label>

              <Select
                options={itemGroupOptions}
                value={selectedItemGroup}
                onChange={setSelectedItemGroup}
                placeholder="Select Item Group"
                isClearable
                isSearchable
                styles={selectStyles}
              />
            </div>

            

            <div className="reports-filter-field">
              <label className="custom-label">
                Supplier-wise Report
              </label>

              <Select
                options={supplierOptions}
                value={selectedSupplier}
                onChange={setSelectedSupplier}
                placeholder="Select Supplier"
                isClearable
                isSearchable
                styles={selectStyles}
              />
            </div>

            <div className="reports-filter-checkboxes">
              <CFormCheck
                inline
                label="Inward"
                checked={inward}
                onChange={(e) => setInward(e.target.checked)}
              />
              <CFormCheck
                inline
                label="Outward"
                checked={outward}
                onChange={(e) => setOutward(e.target.checked)}
              />
              <CFormCheck
                inline
                label="Rate"
                checked={showRate}
                onChange={(e) => setShowRate(e.target.checked)}
              />
              <CFormCheck
                inline
                label="Value"
                checked={showValue}
                onChange={(e) => setShowValue(e.target.checked)}
              />
              <CFormCheck
                inline
                label="closed"
                checked={closed}
                onChange={(e) => setClosed(e.target.checked)}
              />
            </div>

            <div className="reports-filter-actions">
              <CButton
                className="reports-search-btn"
                onClick={loadReport}
                disabled={loading}
              >
                <FaSearch size={12} />
                {loading ? 'Loading...' : 'Search'}
              </CButton>

              <CButton
                className="reports-clear-btn"
                onClick={handleClear}
              >
                <FaSyncAlt size={12} />
                Clear
              </CButton>
            </div>
          </div>
        </CCardBody>
      </CCard>

      <CCard>
        <CCardBody>
          <div className="reports-summary-row">
            <div><span>Total Records</span><strong>{rows.length}</strong></div>
            <div><span>Total Quantity</span><strong>{totalQuantity.toLocaleString()}</strong></div>
            <div><span>Total Value</span><strong>₹{totalValue.toFixed(2)}</strong></div>
            <div><span>Issued Pallets</span><strong>{totalIssued}</strong></div>
          </div>

          <div className="reports-table-search">
            <CButton
              className="reports-export-btn"
              onClick={handleExportExcel}
            >
              <FaFileExcel size={13} />
              Export to Excel
            </CButton>

            <CFormInput
              placeholder="Search by GRN No or Part No..."
              className="search-box"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredRows}
            pagination
            paginationPerPage={10}
            paginationRowsPerPageOptions={[10, 25, 50, 100]}
            persistTableHead
            striped
            responsive
            highlightOnHover
            progressPending={loading}
            noDataComponent={
              <div className="reports-empty">
                {hasSearched ? 'No records found for the selected date range' : 'Run a search to see results'}
              </div>
            }
            customStyles={customStyles}
          />
        </CCardBody>
      </CCard>
    </div>
  )
}

export default Reports
