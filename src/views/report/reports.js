import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput, CCard, CCardBody } from '@coreui/react'
import { FaFileExcel, FaSearch, FaSyncAlt } from 'react-icons/fa'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import API from '../../api.js'
import '../../assets/CSS/reports.css'

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.message || data.error) return data.message || data.error
  return fallback
}

const Reports = () => {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const customStyles = {
    rows: { style: { minHeight: '44px' } },
    headRow: { style: { backgroundColor: '#f1f4fa' } },
    headCells: {
      style: {
        justifyContent: 'center',
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
        fontSize: '13px',
      },
    },
  }

  const loadReport = async () => {
    if (fromDate && toDate && fromDate > toDate) {
      toast.error('From Date cannot be after To Date')
      return
    }

    setLoading(true)
    try {
      const params = {}
      if (fromDate) params.fromDate = fromDate
      if (toDate) params.toDate = toDate

      const res = await API.get('/Reports/grn', { params })
      setRows(res.data || [])
      setHasSearched(true)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load report'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClear = () => {
    setFromDate('')
    setToDate('')
  }

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.error('Nothing to export — run a search first')
      return
    }

    const exportData = rows.map((r) => ({
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
      'Status': r.isPosted ? 'Posted' : 'Not Posted',
      'Pallet No': r.palletNo,
      'FIFO Pallet No': r.fifoPalletNo,
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'GRN Report')

    const rangeLabel =
      fromDate && toDate
        ? `${fromDate}_to_${toDate}`
        : fromDate
          ? `from_${fromDate}`
          : toDate
            ? `to_${toDate}`
            : 'all'

    XLSX.writeFile(workbook, `GRN_Report_${rangeLabel}.xlsx`)
  }

  const columns = [
    { name: 'GRN NO', selector: (row) => row.grnNumber },
    { name: 'SUPPLIER', selector: (row) => row.supplierName, wrap: true },
    { name: 'PO DATE', selector: (row) => row.poDate, cell: (row) => formatDate(row.poDate) },
    { name: 'PART', selector: (row) => row.partNumber },
    { name: 'PART NAME', selector: (row) => row.partName, wrap: true },
    { name: 'QTY', selector: (row) => row.quantity },
    { name: 'PALLET QTY', selector: (row) => row.palletQuantity ?? '—' },
    { name: 'RATE (₹)', selector: (row) => (row.rate != null ? Number(row.rate).toFixed(2) : '—') },
    { name: 'TOTAL VALUE (₹)', selector: (row) => (row.totalValue != null ? Number(row.totalValue).toFixed(2) : '—') },
    {
      name: 'STATUS',
      center: true,
      cell: (row) => (
        <span className={`report-status-badge ${row.isPosted ? 'posted' : 'unposted'}`}>
          {row.isPosted ? 'Posted' : 'Not Posted'}
        </span>
      ),
    },
  ]

  const totalQuantity = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
  const totalValue = rows.reduce((sum, r) => sum + (Number(r.totalValue) || 0), 0)

  return (
    <div className="reports-page">
      <CCard className="reports-filter-card mb-3">
        <CCardBody>
          <div className="section-title">GRN Report</div>

          <div className="reports-filter-row">
            <div className="reports-filter-field">
              <label className="custom-label">From Date</label>
              <CFormInput
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="reports-filter-field">
              <label className="custom-label">To Date</label>
              <CFormInput
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="reports-filter-actions">
              <CButton className="reports-search-btn" onClick={loadReport} disabled={loading}>
                <FaSearch size={12} /> {loading ? 'Loading...' : 'Search'}
              </CButton>
              <CButton className="reports-clear-btn" onClick={handleClear}>
                <FaSyncAlt size={12} /> Clear
              </CButton>
              <CButton className="reports-export-btn" onClick={handleExportExcel}>
                <FaFileExcel size={13} /> Export to Excel
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
          </div>

          <DataTable
            columns={columns}
            data={rows}
            pagination
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