import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import {
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CRow,
  CTooltip,
} from '@coreui/react'
import { FaSearch, FaFileExcel } from 'react-icons/fa'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import API from '../../api.js'
import '../../assets/CSS/user.css'

const Reports = () => {
  const [reports, setReports] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [tableSearch, setTableSearch] = useState('')

  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    despatchId: '',
  })

  useEffect(() => {
    loadReports()
  }, [])

  useEffect(() => {
    if (!tableSearch.trim()) {
      setFiltered(reports)
    } else {
      const q = tableSearch.toLowerCase()

      setFiltered(
        reports.filter(
          (r) =>
            (r.invoice_Number || '').toLowerCase().includes(q) ||
            (r.part_Number || '').toLowerCase().includes(q) ||
            (r.despatch_ID || '').toLowerCase().includes(q),
        ),
      )
    }

    setCurrentPage(1)
  }, [reports, tableSearch])

  const loadReports = async (f = filters) => {
    setLoading(true)

    try {
      const res = await API.get('/reports', { params: f })
      const data = Array.isArray(res.data) ? res.data : res.data.data || []

      setReports(data)
      setTableSearch('')
    } catch {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (filters.fromDate && filters.toDate) {
      const from = new Date(filters.fromDate)
      const to = new Date(filters.toDate)

      if (to < from) {
        toast.error('To date should not be earlier than From date')
        return
      }
    }

    setCurrentPage(1)
    loadReports(filters)
  }

  const handleTableSearchChange = (e) => {
    setTableSearch(e.target.value)
  }

  const handleExportExcel = () => {
    const dataToExport = filtered.length > 0 ? filtered : reports

    if (dataToExport.length === 0) {
      toast.warning('No data to export')
      return
    }

    const rows = dataToExport.map((r, i) => ({
      'SL.NO': i + 1,
      'DESPATCH ID': r.despatch_ID || '-',
      'INVOICE NO': r.invoice_Number || '-',
      'PART NO': r.part_Number || '-',
      'INVOICE QTY': r.invoice_Qty ?? 0,
      'BOX QTY': r.box_Qty ?? 0,
      'PART QTY': r.part_Qty ?? 0,
      STATUS: r.status || '-',
      TIME: r.time || '-',
      'USER NAME': r.user_Name || '-',
      GATE: r.gate || '-',
      'GATE OUT STATUS': r.gate_Out_Status || '-',
      'GATE OUT NO': r.gate_Out_No || '-',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(wb, ws, 'Reports')
    XLSX.writeFile(wb, `Report_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const StatusBadge = ({ value, type }) => {
    const bg =
      type === 'danger'
        ? '#fde8e8'
        : type === 'warning'
          ? '#fff3cd'
          : type === 'success'
            ? '#e8f8f0'
            : '#f0f0f0'

    const color =
      type === 'danger'
        ? '#e53935'
        : type === 'warning'
          ? '#e65100'
          : type === 'success'
            ? '#27ae60'
            : '#666'

    return (
      <span
        style={{
          padding: '3px 10px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: '700',
          display: 'inline-block',
          background: bg,
          color,
        }}
      >
        {value || '-'}
      </span>
    )
  }

  const TooltipCell = ({ value }) => (
    <CTooltip content={value || '-'}>
      <div
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {value || '-'}
      </div>
    </CTooltip>
  )

  const columns = [
    {
      name: 'S.NO',
      width: '90px',
      cell: (_, i) => (
        <div style={{ textAlign: 'center', width: '100%' }}>
          {(currentPage - 1) * rowsPerPage + i + 1}
        </div>
      ),
    },
    {
      name: 'DISPATCH ID',
      center: true,
      width: '150px',
      sortable: true,
      cell: (r) => <TooltipCell value={r.despatch_ID} />,
    },
    {
      name: 'INVOICE NO',
      center: true,
      width: '145px',
      sortable: true,
      cell: (r) => <TooltipCell value={r.invoice_Number} />,
    },
    {
      name: 'PART NO',
      center: true,
      width: '145px',
      sortable: true,
      cell: (r) => <TooltipCell value={r.part_Number} />,
    },
    {
      name: 'INVOICE QTY',
      center: true,
      width: '140px',
      cell: (r) => <TooltipCell value={r.invoice_Qty} />,
    },
    {
      name: 'BOX QTY',
      center: true,
      width: '100px',
      cell: (r) => <TooltipCell value={r.box_Qty} />,
    },
    {
      name: 'PART QTY',
      center: true,
      width: '120px',
      cell: (r) => <TooltipCell value={r.part_Qty} />,
    },
    {
      name: 'STATUS',
      center: true,
      width: '130px',
      cell: (r) => (
  <CTooltip content={r.status}>
    <div style={{ width: '100%', textAlign: 'center' }}>
      <StatusBadge
        value={r.status}
        type={
          r.status === 'ACTIVATE'
            ? 'success'
            : r.status === 'DEACTIVATE'
            ? 'warning'
            : 'danger'
        }
      />
    </div>
  </CTooltip>
),
    },
    {
      name: 'TIME',
      center: true,
      width: '170px',
      cell: (r) => <TooltipCell value={r.time} />,
    },
    {
      name: 'USER NAME',
      center: true,
      width: '120px',
      cell: (r) => <TooltipCell value={r.user_Name} />,
    },
    {
      name: 'GATE NO',
      center: true,
      width: '100px',
      cell: (r) => <TooltipCell value={r.gate} />,
    },
    {
      name: 'GATE OUT STATUS',
      center: true,
      width: '170px',
      cell: (r) => (
        <CTooltip content={r.gate_Out_Status}>
          <div style={{ width: '100%', textAlign: 'center' }}>
            <StatusBadge
              value={r.gate_Out_Status}
              type={r.gate_Out_Status === 'Verified' ? 'success' : 'warning'}
            />
          </div>
        </CTooltip>
      ),
    },
    {
      name: 'GATE OUT NO',
      center: true,
      width: '160px',
      cell: (r) => <TooltipCell value={r.gate_Out_No} />,
    },
  ]

  const customStyles = {
    headRow: {
      style: {
        backgroundColor: '#f3f1fb',
      },
    },
    headCells: {
      style: {
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: '700',
        color: '#0b4bd3',
      },
    },
    cells: {
      style: {
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '12px',
      },
    },
    rows: {
      style: {
        minHeight: '56px',
      },
    },
  }

  return (
    <div className="user-master-page reports-page">
      <CCard className="user-form-card mb-3">
        <CCardBody>
          <CRow className="align-items-end g-2">
            <CCol md={3}>
              <label className="form-label mb-1">From</label>

              <CFormInput
                type="date"
                value={filters.fromDate}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, fromDate: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </CCol>

            <CCol md={3}>
              <label className="form-label mb-1">To</label>

              <CFormInput
                type="date"
                value={filters.toDate}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, toDate: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </CCol>

            <CCol md={3}>
              <label className="form-label mb-1">Dispatch ID</label>

              <CFormInput
                placeholder="Enter Dispatch ID"
                value={filters.despatchId}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, despatchId: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </CCol>

            <CCol md={3}>
              <CButton
                className="scan-save-btn w-100 mt-3"
                onClick={handleSearch}
                disabled={loading}
              >
                <FaSearch className="me-2" />
                {loading ? 'Loading…' : 'Search'}
              </CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      <CCard className="table-card">
        <CCardBody>
          <div className="d-flex justify-content-end align-items-center mb-3 gap-2">
            <CButton
              className="scan-cancel-btn"
              onClick={handleExportExcel}
              style={{ whiteSpace: 'nowrap' }}
            >
              <FaFileExcel className="me-10" /> Export Excel
            </CButton>

            <CFormInput
              style={{ maxWidth: '280px' }}
              placeholder="Filter by Invoice / Part / Despatch ID"
              value={tableSearch}
              onChange={handleTableSearchChange}
            />
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            customStyles={customStyles}
            progressPending={loading}
            pagination
            paginationPerPage={rowsPerPage}
            paginationRowsPerPageOptions={[10, 25, 50, 100]}
            onChangePage={(page) => setCurrentPage(page)}
            onChangeRowsPerPage={(perPage, page) => {
              setRowsPerPage(perPage)
              setCurrentPage(page)
            }}
            responsive
            striped
            highlightOnHover
            persistTableHead
            noDataComponent={
              <div style={{ padding: '40px', color: '#aaa' }}>
                No records found
              </div>
            }
          />
        </CCardBody>
      </CCard>
    </div>
  )
}

export default Reports