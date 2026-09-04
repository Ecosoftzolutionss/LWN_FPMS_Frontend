import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CCard, CCardBody } from '@coreui/react'
import {
  FaCube,
  FaArrowUp,
  FaExpandArrowsAlt,
  FaFileAlt,
  FaWarehouse,
  FaClipboardList,
  FaCheckDouble,
  FaArrowDown,
  FaExchangeAlt,
  FaDolly,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import API from '../../api.js';
import '../../assets/CSS/dashboard.css';
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const formatDateTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const datePart = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0)

// ★ Safe formatter — every .toLocaleString() call in this file goes
// through here instead of calling it directly on a raw API value.
// A single missing/undefined field from the backend (e.g. a still-
// building dev server serving a stale/partial response) used to
// crash the whole page with "Cannot read properties of undefined
// (reading 'toLocaleString')"; this just renders "0" instead.
const num = (value) => Number(value || 0).toLocaleString()

  const DonutChart = ({
    available,
    issued,
    closed,
    total
  }) => {
    const availablePct = pct(available, total)
    const issuedPct = pct(issued, total)
    const closedPct = pct(closed, total)

    const radius = 42
    const circumference = 2 * Math.PI * radius

    const getDashArray = (percentage) => {
      const value = (percentage / 100) * circumference
      return `${value} ${circumference - value}`
    }

    const getDashOffset = (previousPercentage) => {
      return -((previousPercentage / 100) * circumference)
    }

    return (
      <div className="dashboard-donut">
        <svg
          width="150"
          height="150"
          viewBox="0 0 100 100"
          className="dashboard-donut-svg"
        >
          {/* Background */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="12"
          />

          {/* Available - Blue */}
          {availablePct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#1d5cff"
              strokeWidth="12"
              strokeDasharray={getDashArray(availablePct)}
              strokeDashoffset="0"
              pathLength="100"
              transform="rotate(-90 50 50)"
              className="dashboard-donut-segment"
            >
              <title>
                Available: {availablePct}%
              </title>
            </circle>
          )}

          {/* Issued - Orange */}
          {issuedPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#f97316"
              strokeWidth="12"
              strokeDasharray={getDashArray(issuedPct)}
              strokeDashoffset={getDashOffset(availablePct)}
              pathLength="100"
              transform="rotate(-90 50 50)"
              className="dashboard-donut-segment"
            >
              <title>
                Issued: {issuedPct}%
              </title>
            </circle>
          )}

          {/* Closed / Others - Grey */}
          {closedPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="12"
              strokeDasharray={getDashArray(closedPct)}
              strokeDashoffset={getDashOffset(
                availablePct + issuedPct
              )}
              pathLength="100"
              transform="rotate(-90 50 50)"
              className="dashboard-donut-segment"
            >
              <title>
                Closed / Others: {closedPct}%
              </title>
            </circle>
          )}
        </svg>

        {/* Center */}
        <div className="dashboard-donut-center">
          <div className="dashboard-donut-total">
            {num(total)}
          </div>

          <div className="dashboard-donut-total-label">
            TOTAL
          </div>
        </div>
      </div>
    )
  }

// ★ NEW: activity type -> icon + color, used both for the Recent
// Activities table row label and its leading icon.
const ACTIVITY_META = {
  'GRN Entry': { icon: FaArrowDown, color: '#1e7e34' },
  'Material Issue': { icon: FaExchangeAlt, color: '#e8792b' },
  'Store Movement': { icon: FaDolly, color: '#8b5cf6' },
}

const formatRangeDate = (date) => {
  if (!date) return ''

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatApiDate = (date) => {
  if (!date) return ''

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const getCurrentWeek = () => {
    const today = new Date()

    const day = today.getDay()

    const from = new Date(today)
    from.setDate(today.getDate() - day)

    const to = new Date(from)
    to.setDate(from.getDate() + 6)

    return {
      from: formatDateForInput(from),
      to: formatDateForInput(to),
    }
  }

  const formatDateForInput = (date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')

    return `${yyyy}-${mm}-${dd}`
  }

  const initialRange = getCurrentWeek()

  const [dateRange, setDateRange] = useState([
    new Date(`${initialRange.from}T00:00:00`),
    new Date(`${initialRange.to}T00:00:00`),
  ])

  const [fromDate, toDate] = dateRange
  useEffect(() => {
    loadSummary()
  }, [])

  const loadSummary = async (
    selectedFrom = fromDate,
    selectedTo = toDate
  ) => {
    if (!selectedFrom || !selectedTo) return

    const apiFromDate = formatApiDate(selectedFrom)
    const apiToDate = formatApiDate(selectedTo)

    if (apiFromDate > apiToDate) {
      toast.error('From Date cannot be greater than To Date')
      return
    }

    setLoading(true)

    try {
      const res = await API.get('/Dashboard/summary', {
        params: {
          fromDate: apiFromDate,
          toDate: apiToDate,
        },
      })

      setData(res.data)
    } catch (err) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }
  if (loading && !data) {
    return <div className="dashboard-page"><div className="dashboard-loading">Loading dashboard...</div></div>
  }

  if (!data) return null

  const totalPallets = data.totalPallets || 0
  const availablePallets = data.availablePallets || 0
  const issuedPallets = data.issuedPallets || 0
  const closedPallets = data.palletStatus?.closed || 0

  const kpiCards = [
    {
      label: 'TOTAL PALLETS',
      value: num(totalPallets),
      sub: 'Across all locations',
      icon: <FaCube />,
      tone: 'blue',
    },
    {
      label: 'AVAILABLE PALLETS',
      value: num(availablePallets),
      sub: `${pct(availablePallets, totalPallets)}% of total`,
      icon: <FaArrowUp />,
      tone: 'green',
    },
    {
      label: 'ISSUED PALLETS',
      value: num(issuedPallets),
      sub: `${pct(issuedPallets, totalPallets)}% of total`,
      icon: <FaExpandArrowsAlt />,
      tone: 'orange',
    },
    {
      label: 'TOTAL ISSUES',
      value: num(data.totalIssuesThisWeek),
      sub: 'This week',
      icon: <FaFileAlt />,
      tone: 'purple',
    },
  ]


  // =====================================================
  // DONUT CHART WITH HOVER PERCENTAGE
  // =====================================================



  // Donut chart built with a conic-gradient — no charting library
  // needed. Segment order: Available (blue) -> Issued (orange) ->
  // Closed/Others (grey).


  const locations = Array.isArray(data.locations) ? data.locations : []
  const maxLocationQty = Math.max(1, ...locations.map((l) => l.availableCount || 0))

  const transactionRows = [
    { label: 'GRN Entries', value: data.transactionSummary?.grnEntries ?? 0, icon: FaFileAlt, tone: 'blue' },
    { label: 'Pallets Received', value: data.transactionSummary?.palletsReceived ?? 0, icon: FaArrowDown, tone: 'green' },
    { label: 'Material Issues', value: data.transactionSummary?.materialIssues ?? 0, icon: FaExchangeAlt, tone: 'orange' },
    { label: 'Pallets Issued', value: data.transactionSummary?.palletsIssued ?? 0, icon: FaDolly, tone: 'orange' },
    { label: 'Store Verifications', value: data.transactionSummary?.storeVerifications ?? 0, icon: FaCheckDouble, tone: 'blue' },
  ]

  const recentActivities = Array.isArray(data.recentActivities) ? data.recentActivities : []

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-date-filter">
          <DatePicker
            selectsRange
            startDate={fromDate}
            endDate={toDate}
            onChange={(update) => {
              setDateRange(update)

              const [start, end] = update

              if (start && end) {
                loadSummary(start, end)
              }
            }}
            dateFormat="dd MMM yyyy"
            isClearable={false}
            showPopperArrow={false}
            placeholderText="Select date range"
            customInput={
              <button
                type="button"
                className="dashboard-date-range-button"
              >
                <span className="dashboard-calendar-icon">
                  📅
                </span>

                <span className="dashboard-date-range-text">
                  {fromDate && toDate
                    ? `${formatRangeDate(fromDate)} - ${formatRangeDate(toDate)}`
                    : 'Select date range'}
                </span>

                <span className="dashboard-date-range-arrow">
                  ˅
                </span>
              </button>
            }
          />
        </div>
      </div>

      {/* ---------- KPI cards ---------- */}
      <div className="dashboard-kpi-grid">
        {kpiCards.map((k) => (
          <CCard key={k.label} className={`dashboard-kpi-card tone-${k.tone}`}>
            <CCardBody>
              <div className="dashboard-kpi-icon">{k.icon}</div>
              <div className="dashboard-kpi-label">{k.label}</div>
              <div className="dashboard-kpi-value">{k.value}</div>
              <div className="dashboard-kpi-sub">{k.sub}</div>
            </CCardBody>
          </CCard>
        ))}
      </div>

      {/* ---------- Status donut / Location bars / Transaction summary ---------- */}
      <div className="dashboard-mid-grid-3">
        <CCard className="dashboard-status-card">
          <CCardBody>
            <div className="section-title">PALLET STATUS OVERVIEW</div>

            <div className="dashboard-donut-row">
              <div className="dashboard-donut-row">

                <DonutChart
                  available={availablePallets}
                  issued={issuedPallets}
                  closed={closedPallets}
                  total={totalPallets}
                />

                <div className="dashboard-donut-legend">

                  <div className="dashboard-legend-item">
                    <span className="dashboard-legend-dot dot-blue" />
                    <div>
                      <div className="dashboard-legend-value">
                        {num(availablePallets)} ({pct(availablePallets, totalPallets)}%)
                      </div>
                      <div className="dashboard-legend-label">
                        Available
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-legend-item">
                    <span className="dashboard-legend-dot dot-orange" />
                    <div>
                      <div className="dashboard-legend-value">
                        {num(issuedPallets)} ({pct(issuedPallets, totalPallets)}%)
                      </div>
                      <div className="dashboard-legend-label">
                        Issued
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-legend-item">
                    <span className="dashboard-legend-dot dot-grey" />
                    <div>
                      <div className="dashboard-legend-value">
                        {num(closedPallets)} ({pct(closedPallets, totalPallets)}%)
                      </div>
                      <div className="dashboard-legend-label">
                        Closed / Others
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </CCardBody>
        </CCard>

        <CCard className="dashboard-location-card">
          <CCardBody>
            <div className="section-title">PALLETS BY LOCATION (AVAILABILITY)</div>

            {locations.length === 0 ? (
              <div className="dashboard-empty">No stuffed pallets yet</div>
            ) : (
              <div className="dashboard-location-list">
                {locations.map((loc, idx) => (
                  <div key={loc.storeLocation || idx} className="dashboard-location-row">
                    <div className="dashboard-location-label">{loc.storeLocation || 'Unassigned'}</div>
                    <div className="dashboard-location-bar-track">
                      <div
                        className="dashboard-location-bar-fill"
                        style={{ width: `${((loc.availableCount || 0) / maxLocationQty) * 100}%` }}
                      />
                    </div>
                    <div className="dashboard-location-value">{num(loc.availableCount)}</div>
                  </div>
                ))}
              </div>
            )}
          </CCardBody>
        </CCard>

        <CCard className="dashboard-transaction-card">
          <CCardBody>
            <div className="section-title">TRANSACTION SUMMARY (THIS WEEK)</div>

            <div className="dashboard-transaction-list">
              {transactionRows.map((t) => {
                const Icon = t.icon
                return (
                  <div key={t.label} className="dashboard-transaction-row">
                    <div className="dashboard-transaction-left">
                      <span className={`dashboard-transaction-icon tone-${t.tone}`}><Icon /></span>
                      <span className="dashboard-transaction-label">{t.label}</span>
                    </div>
                    <div className="dashboard-transaction-value">{num(t.value)}</div>
                  </div>
                )
              })}
            </div>
          </CCardBody>
        </CCard>
      </div>

      {/* ---------- Recent Activities ---------- */}
      <CCard className="mt-3">
        <CCardBody>
          <div className="section-title">RECENT ACTIVITIES</div>

          <DataTable
            columns={[
              { name: 'DATE & TIME', selector: (row) => row.date, cell: (row) => formatDateTime(row.date), minWidth: '160px' },
              {
                name: 'ACTIVITY',
                minWidth: '150px',
                cell: (row) => {
                  const meta = ACTIVITY_META[row.type] || ACTIVITY_META['GRN Entry']
                  const Icon = meta.icon
                  return (
                    <span className="dashboard-activity-label" style={{ color: meta.color }}>
                      <Icon size={11} /> {row.type}
                    </span>
                  )
                },
              },
              { name: 'REF NO', selector: (row) => row.refNo ?? '—' },
              { name: 'PALLET NO', selector: (row) => row.palletNo ?? '—' },
              { name: 'LOCATION', selector: (row) => row.location ?? '—' },
              { name: 'QUANTITY', selector: (row) => num(row.quantity), center: true },
              // Real, dynamic creator (GrnHeader.CreatedBy /
              // StoreMovement.CreatedBy / MaterialIssue.IssuedBy) — no
              // hardcoded "Vendor"/"Admin" placeholder.
              { name: 'CREATED BY', selector: (row) => row.createdBy || '—' },
            ]}
            data={recentActivities}
            pagination
            paginationPerPage={5}
            paginationRowsPerPageOptions={[5, 10, 25, 50]}
            persistTableHead
            striped
            responsive
            highlightOnHover
            noDataComponent={<div className="dashboard-empty">No recent activity yet</div>}
            customStyles={{
              rows: { style: { minHeight: '46px' } },
              headRow: { style: { backgroundColor: '#fff', borderBottom: '1px solid #eef1f8' } },
              headCells: {
                style: {
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#94a3b8',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                },
              },
              cells: {
                style: {
                  fontSize: '14px',
                  color: '#1f2937',
                },
              },
            }}
          />
        </CCardBody>
      </CCard>
    </div>
  )
}

export default Dashboard
