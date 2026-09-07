import React, { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CCard, CCardBody, CTooltip } from '@coreui/react'
import {
  FaArrowDown,
  FaArrowUp,
  FaBox,
  FaExchangeAlt,
  FaChartBar,
  FaDolly,
} from 'react-icons/fa'
import { toast } from 'react-toastify'
import API from '../../api.js'
import '../../assets/CSS/dashboard.css'

const num = (value) => Number(value || 0).toLocaleString()

const money = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })

const formatDateTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const datePart = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

const ACTIVITY_META = {
  'GRN Entry': { icon: FaArrowDown, color: '#1e7e34' },
  'Material Issue': { icon: FaExchangeAlt, color: '#e8792b' },
  'Store Movement': { icon: FaDolly, color: '#8b5cf6' },
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ---------------------------------------------------------------
// Inward vs Outward bar chart — plain SVG, no charting library.
// ---------------------------------------------------------------
const BarChart = ({ months, valueKeyInward, valueKeyOutward, formatter }) => {
  const width = 760
  const height = 300
  const padding = { top: 20, right: 20, bottom: 40, left: 55 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const maxVal = Math.max(
    1,
    ...months.map((m) => Math.max(m[valueKeyInward] || 0, m[valueKeyOutward] || 0))
  )

  const niceMax = (() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal || 1)))
    return Math.ceil((maxVal / magnitude) * 1.15) * magnitude || 1
  })()

  const gridLines = 5
  const groupWidth = chartW / months.length
  const barWidth = Math.min(28, groupWidth / 3)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="dashboard-chart-svg">
      {/* grid + y labels */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = padding.top + (chartH / gridLines) * i
        const val = niceMax - (niceMax / gridLines) * i
        return (
          <g key={i}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#eef1f8"
              strokeWidth="1"
            />
            <text x={padding.left - 10} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
              {formatter ? formatter(val) : num(val)}
            </text>
          </g>
        )
      })}

      {/* bars */}
      {months.map((m, idx) => {
        const groupX = padding.left + groupWidth * idx
        const inwardH = (Math.max(m[valueKeyInward] || 0, 0) / niceMax) * chartH
        const outwardH = (Math.max(m[valueKeyOutward] || 0, 0) / niceMax) * chartH
        const gap = 4

        const inwardX = groupX + groupWidth / 2 - barWidth - gap / 2
        const outwardX = groupX + groupWidth / 2 + gap / 2

        return (
          <g key={m.label}>
            <rect
              x={inwardX}
              y={padding.top + chartH - inwardH}
              width={barWidth}
              height={inwardH}
              rx="3"
              fill="#1d5cff"
            >
              <title>{`${m.label} — Inward: ${formatter ? formatter(m[valueKeyInward]) : num(m[valueKeyInward])}`}</title>
            </rect>
            <rect
              x={outwardX}
              y={padding.top + chartH - outwardH}
              width={barWidth}
              height={outwardH}
              rx="3"
              fill="#14b8a6"
            >
              <title>{`${m.label} — Outward: ${formatter ? formatter(m[valueKeyOutward]) : num(m[valueKeyOutward])}`}</title>
            </rect>
            <text
              x={groupX + groupWidth / 2}
              y={height - padding.bottom + 16}
              fontSize="10"
              fill="#64748b"
              textAnchor="middle"
            >
              {m.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------
// Stock Status donut — Safety (green) / Reorder (orange) / Danger (red)
// ---------------------------------------------------------------
const StockStatusDonut = ({ safetyPct, reorderPct, dangerPct, total }) => {
  const radius = 42
  const circumference = 2 * Math.PI * radius

  const getDashArray = (percentage) => {
    const value = (percentage / 100) * circumference
    return `${value} ${circumference - value}`
  }

  const getDashOffset = (previousPercentage) => -((previousPercentage / 100) * circumference)

  return (
    <div className="dashboard-donut">
      <svg width="180" height="180" viewBox="0 0 100 100" className="dashboard-donut-svg">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />

        {safetyPct > 0 && (
          <circle
            cx="50" cy="50" r={radius} fill="none" stroke="#22c55e" strokeWidth="12"
            strokeDasharray={getDashArray(safetyPct)} strokeDashoffset="0"
            pathLength="100" transform="rotate(-90 50 50)" className="dashboard-donut-segment"
          >
            <title>Safety: {safetyPct}%</title>
          </circle>
        )}

        {reorderPct > 0 && (
          <circle
            cx="50" cy="50" r={radius} fill="none" stroke="#f97316" strokeWidth="12"
            strokeDasharray={getDashArray(reorderPct)} strokeDashoffset={getDashOffset(safetyPct)}
            pathLength="100" transform="rotate(-90 50 50)" className="dashboard-donut-segment"
          >
            <title>Reorder: {reorderPct}%</title>
          </circle>
        )}

        {dangerPct > 0 && (
          <circle
            cx="50" cy="50" r={radius} fill="none" stroke="#ef4444" strokeWidth="12"
            strokeDasharray={getDashArray(dangerPct)} strokeDashoffset={getDashOffset(safetyPct + reorderPct)}
            pathLength="100" transform="rotate(-90 50 50)" className="dashboard-donut-segment"
          >
            <title>Danger: {dangerPct}%</title>
          </circle>
        )}
      </svg>

      <div className="dashboard-donut-center">
        <div className="dashboard-donut-total">{num(total)}</div>
        <div className="dashboard-donut-total-label">TOTAL ITEMS</div>
      </div>
    </div>
  )
}


// Tooltip for complete grid-cell values
const TooltipCell = ({ value }) => {
  const displayValue = value ?? '—'

  return (
    <CTooltip content={String(displayValue)} placement="top">
      <span
        style={{
          display: 'block',
          width: '100%',
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

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('qty') // 'qty' | 'value'

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const yearOptions = useMemo(() => {
    const currentYear = now.getFullYear()
    const years = []
    for (let y = currentYear; y >= currentYear - 5; y--) years.push(y)
    return years
  }, [])

  useEffect(() => {
    loadSummary(year, month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  const loadSummary = async (selectedYear, selectedMonth) => {
    setLoading(true)
    try {
      const res = await API.get('/Dashboard/summary', {
        params: { year: selectedYear, month: selectedMonth },
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

  const kpi = data.kpi || {}
  const chartMonths = Array.isArray(data.chart) ? data.chart : []
  const stock = data.stockStatus || { totalItems: 0, safety: {}, reorder: {}, danger: {} }
  const recentActivities = Array.isArray(data.recentActivities) ? data.recentActivities : []

  const isValueMode = mode === 'value'
  const fmt = isValueMode ? money : num

  const kpiCards = [
    {
      label: 'Total Inwards',
      value: isValueMode ? money(kpi.inwardValue) : num(kpi.inwardQty),
      icon: <FaArrowDown />,
      tone: 'blue',
    },
    {
      label: 'Total Outward',
      value: isValueMode ? money(kpi.outwardValue) : num(kpi.outwardQty),
      icon: <FaArrowUp />,
      tone: 'green',
    },
    {
      label: 'Total Available',
      value: isValueMode ? money(kpi.availableValue) : num(kpi.availableQty),
      icon: <FaBox />,
      tone: 'orange',
    },
  ]

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-mode-toggle">
          <label className="dashboard-radio">
            <input
              type="radio"
              name="dashboard-mode"
              checked={mode === 'qty'}
              onChange={() => setMode('qty')}
            />
            Quantity
          </label>
          <label className="dashboard-radio">
            <input
              type="radio"
              name="dashboard-mode"
              checked={mode === 'value'}
              onChange={() => setMode('value')}
            />
            Value
          </label>
        </div>

        <select
          className="dashboard-select"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          className="dashboard-select"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((m, idx) => (
            <option key={m} value={idx + 1}>{m}</option>
          ))}
        </select>
      </div>

      {/* ---------- KPI cards ---------- */}
      <div className="dashboard-kpi-grid dashboard-kpi-grid-3">
        {kpiCards.map((k) => (
          <CCard key={k.label} className={`dashboard-kpi-card tone-${k.tone}`}>
            <CCardBody>
              <div className="dashboard-kpi-icon">{k.icon}</div>
              <div className="dashboard-kpi-label">{k.label}</div>
              <div className="dashboard-kpi-value">{k.value}</div>
            </CCardBody>
          </CCard>
        ))}
      </div>

      {/* ---------- Chart + Stock Status ---------- */}
      <div className="dashboard-mid-grid-2">
        <CCard className="dashboard-chart-card">
          <CCardBody>
            <div className="dashboard-card-header-row">
              <div className="section-title">
                <FaChartBar style={{ marginRight: 6 }} />
                Inward vs Outward
              </div>
              <div className="dashboard-chart-legend">
                <span><span className="dashboard-legend-dot dot-blue" /> Inward</span>
                <span><span className="dashboard-legend-dot dot-teal" /> Outward</span>
              </div>
            </div>

            {chartMonths.length === 0 ? (
              <div className="dashboard-empty">No data for this range</div>
            ) : (
              <BarChart
                months={chartMonths}
                valueKeyInward={isValueMode ? 'inwardValue' : 'inwardQty'}
                valueKeyOutward={isValueMode ? 'outwardValue' : 'outwardQty'}
                formatter={isValueMode ? money : num}
              />
            )}
          </CCardBody>
        </CCard>

        <CCard className="dashboard-status-card">
          <CCardBody>
            <div className="section-title">Stock Status</div>

            <div className="dashboard-donut-row">
              <StockStatusDonut
                safetyPct={stock.safety?.pct || 0}
                reorderPct={stock.reorder?.pct || 0}
                dangerPct={stock.danger?.pct || 0}
                total={stock.totalItems}
              />

              <div className="dashboard-donut-legend">
                <div className="dashboard-legend-item">
                  <span className="dashboard-legend-dot dot-safety" />
                  <div>
                    <div className="dashboard-legend-value">
                      Safety Level {num(stock.safety?.count)} <span className="dashboard-legend-pct">{stock.safety?.pct || 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-legend-item">
                  <span className="dashboard-legend-dot dot-reorder" />
                  <div>
                    <div className="dashboard-legend-value">
                      Reorder Level {num(stock.reorder?.count)} <span className="dashboard-legend-pct">{stock.reorder?.pct || 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-legend-item">
                  <span className="dashboard-legend-dot dot-danger" />
                  <div>
                    <div className="dashboard-legend-value">
                      Danger Level {num(stock.danger?.count)} <span className="dashboard-legend-pct">{stock.danger?.pct || 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </div>

      {/* ---------- Recent Activities ---------- */}
      <CCard className="mt-3">
        <CCardBody>
          <div className="section-title">Recent Activities</div>

          <DataTable
            columns={[
              {
                name: 'DATE & TIME',
                selector: (row) => row.date,
                cell: (row) => <TooltipCell value={formatDateTime(row.date)} />,
                minWidth: '160px',
              },
              {
                name: 'ACTIVITY',
                minWidth: '150px',
                cell: (row) => {
                  const meta = ACTIVITY_META[row.type] || ACTIVITY_META['GRN Entry']
                  const Icon = meta.icon
                  return (
                    <CTooltip content={row.type || '—'} placement="top">
                      <span
                        className="dashboard-activity-label"
                        style={{ color: meta.color, cursor: 'default' }}
                      >
                        <Icon size={11} /> {row.type || '—'}
                      </span>
                    </CTooltip>
                  )
                },
              },
              {
                name: 'REF NO',
                selector: (row) => row.refNo ?? '—',
                cell: (row) => <TooltipCell value={row.refNo ?? '—'} />,
              },
              {
                name: 'SUPPLIER',
                selector: (row) => row.supplier ?? '—',
                cell: (row) => <TooltipCell value={row.supplier ?? '—'} />,
              },
              {
                name: 'PART NAME',
                selector: (row) => row.partName ?? '—',
                cell: (row) => <TooltipCell value={row.partName ?? '—'} />,
              },
              {
                name: 'QUANTITY',
                selector: (row) => num(row.quantity),
                cell: (row) => (
                  <CTooltip content={num(row.quantity)} placement="top">
                    <span style={{ cursor: 'default' }}>{num(row.quantity)}</span>
                  </CTooltip>
                ),
                center: true,
              },
              {
                name: 'USER NAME',
                selector: (row) => row.userName ?? '—',
                cell: (row) => <TooltipCell value={row.userName ?? '—'} />,
              },
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