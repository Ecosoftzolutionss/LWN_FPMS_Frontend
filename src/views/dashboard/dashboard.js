import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from 'react-data-table-component'
import { CCard, CCardBody, CTooltip } from '@coreui/react'
import { FaArrowDown, FaArrowUp, FaBox, FaExchangeAlt, FaChartBar, FaDolly, FaExclamationTriangle } from 'react-icons/fa'
import { toast } from 'react-toastify'
import API from '../../api.js'
import '../../assets/CSS/dashboard.css'

// One locale for EVERY number on the page (KPI cards, chart axis,
// chart labels, table). Previously KPI used the browser locale
// (297,249) while the chart used en-IN (2,97,249).
const LOCALE = 'en-IN'

const num = (value) => Number(value || 0).toLocaleString(LOCALE)
const money = (value) =>
  Number(value || 0).toLocaleString(LOCALE, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })

const ACTIVITY_META = {
  'GRN Entry': { icon: FaArrowDown, color: '#1e7e34' },
  'Material Issue': { icon: FaExchangeAlt, color: '#e8792b' },
  'Store Movement': { icon: FaDolly, color: '#8b5cf6' },
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const getFiscalYearRange = (year, month) => {
  const fiscalStartYear = month >= 4 ? year : year - 1
  const fiscalEndYear = fiscalStartYear + 1
  return {
    fiscalStartYear,
    fiscalEndYear,
    label: `Apr ${fiscalStartYear} - Mar ${fiscalEndYear}`,
  }
}

// 12 fiscal months (Apr -> Mar) with numeric year/month keys so the
// API rows are matched by number, not by a culture dependent label.
const buildFiscalMonths = (fiscalStartYear) => {
  const months = []
  for (let i = 0; i < 12; i++) {
    const monthIndex = (3 + i) % 12 // 3 = April (0-indexed)
    const yr = fiscalStartYear + (monthIndex < 3 ? 1 : 0)
    months.push({
      year: yr,
      month: monthIndex + 1,
      label: `${MONTH_SHORT[monthIndex]} ${yr}`,
    })
  }
  return months
}

const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null) return Number(obj[k]) || 0
  }
  return 0
}

const BarChart = ({
  months,
  valueKeyInward,
  valueKeyOutward,
  formatter,
  isValueMode,
  onBarClick,
}) => {
  const width = 900
  const height = 260

  const padding = {
    top: 38,
    right: 14,
    bottom: 40,
    left: 58,
  }

  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const chartData = (Array.isArray(months) ? months : []).map((m) => {
    const inward = Number(m?.[valueKeyInward] ?? 0)
    const outward = Number(m?.[valueKeyOutward] ?? 0)

    return {
      ...m,
      inward: Number.isFinite(inward) ? inward : 0,
      outward: Number.isFinite(outward) ? outward : 0,
    }
  })

  const maxValue = Math.max(
    1,
    ...chartData.flatMap((m) => [m.inward, m.outward])
  )

  const niceMax =
    maxValue <= 10
      ? 10
      : maxValue <= 20
        ? 20
        : maxValue <= 50
          ? 50
          : maxValue <= 100
            ? 100
            : Math.ceil(maxValue / 50) * 50

  const gridLines = 5

  const groupWidth = chartW / Math.max(chartData.length, 1)

  const barWidth = 14
  const barGap = 16

  const shortValue = (value) => {
    const n = Number(value || 0)
    return isValueMode ? money(n) : num(Math.round(n))
  }

  return (
    <div className="dashboard-chart-scroll">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="dashboard-chart-svg"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        {/* GRID LINES */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padding.top + (chartH / gridLines) * i
          const value = niceMax - (niceMax / gridLines) * i

          return (
            <g key={`grid-${i}`}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#e8edf5"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="end"
              >
                {formatter ? formatter(value) : num(value)}
              </text>
            </g>
          )
        })}

        {/* MONTH DATA */}
        {chartData.map((m, index) => {
          const inwardValue = Math.max(Number(m.inward) || 0, 0)
          const outwardValue = Math.max(Number(m.outward) || 0, 0)

          const inwardHeight = (inwardValue / niceMax) * chartH
          const outwardHeight = (outwardValue / niceMax) * chartH

          const groupX = padding.left + groupWidth * index
          const centerX = groupX + groupWidth / 2

          const inwardX = centerX - barWidth - barGap / 2
          const outwardX = centerX + barGap / 2

          const inwardY = padding.top + chartH - inwardHeight
          const outwardY = padding.top + chartH - outwardHeight

          return (
            <g key={`${m.label}-${index}`}>
              {/* INWARD BAR - BLUE */}
              <rect
                x={inwardX}
                y={inwardY}
                width={barWidth}
                height={inwardHeight}
                rx={3}
                ry={3}
                fill="#2563eb"
                style={{ cursor: 'pointer' }}
                onClick={() => onBarClick?.({
                  type: 'inward',
                  month: m.label,
                  value: inwardValue,
                })}
                role="button"
                tabIndex={0}
                aria-label={`Open GRN Report for inward ${m.label}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onBarClick?.({
                      type: 'inward',
                      month: m.label,
                      value: inwardValue,
                    })
                  }
                }}
              >
                <title>{`Inward ${m.label}: ${shortValue(inwardValue)}`}</title>
              </rect>
              {inwardValue > 0 && (
                // Anchored to the bar's right edge so the text grows
                // LEFT and can never collide with the outward label.
                <text
                  className="dashboard-chart-value-label"
                  x={inwardX + barWidth}
                  y={Math.max(padding.top + 12, inwardY - 6)}
                  fill="#2563eb"
                  textAnchor="end"
                >
                  {shortValue(inwardValue)}
                </text>
              )}

              {/* OUTWARD BAR - TEAL */}
              <rect
                x={outwardX}
                y={outwardY}
                width={barWidth}
                height={outwardHeight}
                rx={3}
                ry={3}
                fill="#14b8a6"
                style={{ cursor: 'pointer' }}
                onClick={() => onBarClick?.({
                  type: 'outward',
                  month: m.label,
                  value: outwardValue,
                })}
                role="button"
                tabIndex={0}
                aria-label={`Open Material Issue Report for outward ${m.label}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onBarClick?.({
                      type: 'outward',
                      month: m.label,
                      value: outwardValue,
                    })
                  }
                }}
              >
                <title>{`Outward ${m.label}: ${shortValue(outwardValue)}`}</title>
              </rect>
              {outwardValue > 0 && (
                // Anchored to the bar's left edge so the text grows RIGHT.
                <text
                  className="dashboard-chart-value-label"
                  x={outwardX}
                  y={Math.max(padding.top + 12, outwardY - 6)}
                  fill="#14b8a6"
                  textAnchor="start"
                >
                  {shortValue(outwardValue)}
                </text>
              )}

              {/* MONTH LABEL */}
              <text
                x={centerX}
                y={height - 14}
                fontSize="9.5"
                fill="#64748b"
                fontWeight="600"
                textAnchor="middle"
              >
                {m.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

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
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('qty') // 'qty' | 'value'
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [partNo, setPartNo] = useState('')
  const [debouncedPartNo, setDebouncedPartNo] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPartNo(partNo.trim()), 400)
    return () => clearTimeout(t)
  }, [partNo])

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let y = currentYear; y >= currentYear - 5; y--) years.push(y)
    return years
  }, [])

  // Load data. The `cancelled` flag drops out-of-order responses, so
  // typing a part number quickly can no longer leave the screen
  // showing numbers from an OLDER request (another source of "mismatch").
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const res = await API.get('/Dashboard/summary', {
          params: {
            year,
            month,
            partNo: debouncedPartNo || undefined,
          },
        })
        if (!cancelled) setData(res.data)
      } catch (err) {
        if (!cancelled) toast.error('Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [year, month, debouncedPartNo])

  if (loading && !data) {
    return <div className="dashboard-page"><div className="dashboard-loading">Loading dashboard...</div></div>
  }

  if (!data) return null

  const kpi = data.kpi || {}

  const { fiscalStartYear, label: fiscalYearLabel } = getFiscalYearRange(year, month)

  // Index API rows by numeric year-month (fallback: label).
  const apiChartRows = Array.isArray(data.chart) ? data.chart : []
  const apiChartByKey = new Map()
  apiChartRows.forEach((m) => {
    const y = m.year ?? m.Year
    const mo = m.month ?? m.Month
    if (y != null && mo != null) apiChartByKey.set(`${y}-${mo}`, m)
    const lbl = m.label ?? m.monthLabel
    if (lbl) apiChartByKey.set(String(lbl), m)
  })

  const chartMonths = buildFiscalMonths(fiscalStartYear).map(({ year: y, month: mo, label }) => {
    const m = apiChartByKey.get(`${y}-${mo}`) || apiChartByKey.get(label) || {}
    return {
      label,
      inwardQty: pick(m, ['inwardQty', 'inwardQuantity', 'InwardQty', 'InwardQuantity']),
      outwardQty: pick(m, ['outwardQty', 'outwardQuantity', 'OutwardQty', 'OutwardQuantity']),
      inwardValue: pick(m, ['inwardValue', 'InwardValue']),
      outwardValue: pick(m, ['outwardValue', 'OutwardValue']),
    }
  })

  const stock = data.stockStatus || { totalItems: 0, safety: {}, reorder: {}, danger: {} }
  const recentActivities = Array.isArray(data.recentActivities) ? data.recentActivities : []

  const isValueMode = mode === 'value'
  const stockAlerts = Number(stock.reorder?.count || 0) + Number(stock.danger?.count || 0)

  const periodText = `${MONTH_SHORT[month - 1]} ${year}`

  // Inward / Outward are for the SELECTED MONTH.
  // Available is the CURRENT stock (all dates) - it is a balance,
  // not a monthly figure, so it is labelled differently on purpose.
  const kpiCards = [
    {
      label: 'Inward Parts',
      value: isValueMode ? money(kpi.inwardValue ?? 0) : num(kpi.inwardPartCount ?? 0),
      icon: <FaArrowDown />,
      tone: 'blue',
      sub: isValueMode
        ? `Inward value · ${periodText}`
        : `Inward quantity · ${periodText}`,
    },
    {
      label: 'Outward Parts',
      value: isValueMode ? money(kpi.outwardValue ?? 0) : num(kpi.outwardPartCount ?? 0),
      icon: <FaArrowUp />,
      tone: 'green',
      sub: isValueMode
        ? `Outward value · ${periodText}`
        : `Outward quantity · ${periodText}`,
    },
    {
      label: 'Available Parts',
      value: isValueMode ? money(kpi.availableValue ?? 0) : num(kpi.availablePartCount ?? 0),
      icon: <FaBox />,
      tone: 'orange',
      sub: isValueMode
        ? 'Current stock value · all dates'
        : 'Current stock (all inward − all outward)',
    },
    {
      label: 'Stock Alerts',
      value: num(stockAlerts),
      icon: <FaExclamationTriangle />,
      tone: 'red',
      sub: 'Items need attention',
      onClick: () => navigate('/report/alertreport'),
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

        {/* Part No search box */}
        <div className="dashboard-partno-search">
          <input
            type="text"
            className="dashboard-select dashboard-partno-input"
            placeholder="Search Part No..."
            value={partNo}
            onChange={(e) => setPartNo(e.target.value)}
          />
          {partNo && (
            <button
              type="button"
              className="dashboard-partno-clear"
              onClick={() => setPartNo('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ---------- KPI cards ---------- */}
      <div className="dashboard-kpi-grid dashboard-kpi-grid-4">
        {kpiCards.map((k) => (
          <CCard
            key={k.label}
            className={`dashboard-kpi-card tone-${k.tone} ${k.onClick ? 'dashboard-clickable-card' : ''}`}
            onClick={k.onClick}
            role={k.onClick ? 'button' : undefined}
            tabIndex={k.onClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (k.onClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                k.onClick()
              }
            }}
          >
            <CCardBody>
              <div className="dashboard-kpi-icon">{k.icon}</div>
              <div className="dashboard-kpi-label">{k.label}</div>
              <div className="dashboard-kpi-value">{k.value}</div>
              <div className="dashboard-kpi-sub">{k.sub}</div>
            </CCardBody>
          </CCard>
        ))}
      </div>

      {/* ---------- Chart + Stock Status ---------- */}
      <div className="dashboard-mid-grid-2">
        <CCard className="dashboard-chart-card">
          <CCardBody>
            <div className="dashboard-card-header-row">
              <div className="dashboard-chart-title-wrap">
                <div className="section-title">
                  <FaChartBar style={{ marginRight: 6 }} />
                  {isValueMode ? 'Inward vs Outward Value' : 'Inward vs Outward Quantity'}
                </div>
                <span className="dashboard-period-badge">{fiscalYearLabel}</span>
              </div>
              <div className="dashboard-chart-legend">
                <span>
                  <span className="dashboard-legend-dot dot-blue" />
                  {isValueMode ? 'Inward Value' : 'Inward Quantity'}
                </span>
                <span>
                  <span className="dashboard-legend-dot dot-teal" />
                  {isValueMode ? 'Outward Value' : 'Outward Quantity'}
                </span>
              </div>
            </div>

            <BarChart
              months={chartMonths}
              valueKeyInward={isValueMode ? 'inwardValue' : 'inwardQty'}
              valueKeyOutward={isValueMode ? 'outwardValue' : 'outwardQty'}
              formatter={isValueMode ? money : num}
              isValueMode={isValueMode}
              onBarClick={({ type }) => {
                // Inward -> GRN Report
                // Outward -> Material Issue Report
                if (type === 'inward') {
                  navigate('/report/Grnreport')
                } else if (type === 'outward') {
                  navigate('/report/MaterialIssueReport')
                }
              }}
            />
          </CCardBody>
        </CCard>

        <CCard className="dashboard-status-card">
          <CCardBody>
            <div className="section-title">Stock Status</div>

            <div className="dashboard-donut-row">
              <div
                role="button"
                tabIndex={0}
                title="Open Stock Report"
                onClick={() => navigate('/report/StockReport')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate('/report/StockReport')
                  }
                }}
                style={{
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <StockStatusDonut
                  safetyPct={stock.safety?.pct || 0}
                  reorderPct={stock.reorder?.pct || 0}
                  dangerPct={stock.danger?.pct || 0}
                  total={stock.totalItems}
                />
              </div>

              <div className="dashboard-donut-legend">
                <div className="dashboard-legend-item">
                  <span className="dashboard-legend-dot dot-safety" />
                  <div>
                    <div className="dashboard-legend-value">
                      Safety <strong>{num(stock.safety?.count)}</strong>
                      <span className="dashboard-legend-pct">{stock.safety?.pct || 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-legend-item">
                  <span className="dashboard-legend-dot dot-reorder" />
                  <div>
                    <div className="dashboard-legend-value">
                      Reorder <strong>{num(stock.reorder?.count)}</strong>
                      <span className="dashboard-legend-pct">{stock.reorder?.pct || 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-legend-item">
                  <span className="dashboard-legend-dot dot-danger" />
                  <div>
                    <div className="dashboard-legend-value">
                      Danger <strong>{num(stock.danger?.count)}</strong>
                      <span className="dashboard-legend-pct">{stock.danger?.pct || 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-stock-alert-note">
                  {stockAlerts > 0
                    ? `${num(stockAlerts)} item${stockAlerts === 1 ? '' : 's'} need attention`
                    : 'All items are within stock limits'}
                </div>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </div>

      <CCard className="dashboard-recent-card">
        <CCardBody>
          <div className="section-title">Recent Activities</div>

          <DataTable
            columns={[
              {
                name: 'SUPPLIER NAME',
                selector: (row) => row.supplier ?? '—',
                cell: (row) => <TooltipCell value={row.supplier ?? '—'} />,
              },
              {
                name: 'PART NAME',
                selector: (row) => row.partName ?? '—',
                cell: (row) => <TooltipCell value={row.partName ?? '—'} />,
              },
              {
                name: 'PART NUMBER',
                selector: (row) => row.partNumber ?? '—',
                cell: (row) => <TooltipCell value={row.partNumber ?? '—'} />,
              },
              {
                name: 'QUANTITY',
                selector: (row) => Number(row.quantity || 0),
                cell: (row) => (
                  <CTooltip content={num(row.quantity)} placement="top">
                    <span style={{ cursor: 'default' }}>{num(row.quantity)}</span>
                  </CTooltip>
                ),
                center: true,
                sortable: true,
              },
              {
                name: 'REF NO',
                selector: (row) => row.refNo ?? '—',
                cell: (row) => <TooltipCell value={row.refNo ?? '—'} />,
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
            ]}
            data={recentActivities}
            pagination
            paginationPerPage={5}
            paginationRowsPerPageOptions={[5, 10, 20]}
            persistTableHead
            striped
            responsive
            highlightOnHover
            noDataComponent={<div className="dashboard-empty">No recent activity yet</div>}
            customStyles={{
              rows: { style: { minHeight: '34px' } },
              headRow: { style: { backgroundColor: '#fff', borderBottom: '1px solid #eef1f8' } },
              headCells: {
                style: {
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#94a3b8',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                },
              },
              cells: {
                style: {
                  fontSize: '11px',
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
