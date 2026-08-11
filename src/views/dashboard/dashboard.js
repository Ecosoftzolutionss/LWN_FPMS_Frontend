import React, { useEffect, useState } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import {
  FaBoxOpen,
  FaTruck,
  FaUsers,
  FaWarehouse,
  FaFileInvoice,
  FaRupeeSign,
  FaCheckCircle,
  FaHourglassHalf,
} from 'react-icons/fa'
import { toast } from 'react-toastify'
import API from '../../api.js'
import '../../assets/CSS/dashboard.css'

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const shortDay = (isoDate) => {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSummary()
  }, [])

  const loadSummary = async () => {
    setLoading(true)
    try {
      const res = await API.get('/Dashboard/summary')
      setData(res.data)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const kpiCards = data
    ? [
        { label: 'Total Items', value: data.totalItems, icon: <FaBoxOpen />, color: '#1d5cff' },
        { label: 'Total Suppliers', value: data.totalSuppliers, icon: <FaTruck />, color: '#f59e0b' },
        { label: 'Total Customers', value: data.totalCustomers, icon: <FaUsers />, color: '#8b5cf6' },
        { label: 'Total Stores', value: data.totalStores, icon: <FaWarehouse />, color: '#0ea5e9' },
        { label: 'Total GRNs', value: data.totalGrns, icon: <FaFileInvoice />, color: '#e53935' },
        { label: 'Stock Value (₹)', value: `₹${Number(data.totalStockValue).toLocaleString()}`, icon: <FaRupeeSign />, color: '#1e7e34' },
      ]
    : []

  const maxTrendCount = data ? Math.max(1, ...data.trend.map((t) => t.count)) : 1

  return (
    <div className="dashboard-page">
      {loading && !data ? (
        <div className="dashboard-loading">Loading dashboard...</div>
      ) : (
        <>
          <div className="dashboard-kpi-grid">
            {kpiCards.map((k) => (
              <CCard key={k.label} className="dashboard-kpi-card">
                <CCardBody>
                  <div className="dashboard-kpi-icon" style={{ background: `${k.color}1a`, color: k.color }}>
                    {k.icon}
                  </div>
                  <div>
                    <div className="dashboard-kpi-value">{k.value}</div>
                    <div className="dashboard-kpi-label">{k.label}</div>
                  </div>
                </CCardBody>
              </CCard>
            ))}
          </div>

          <div className="dashboard-mid-grid">
            <CCard className="dashboard-status-card">
              <CCardBody>
                <div className="section-title">GRN Item Status</div>

                <div className="dashboard-status-row">
                  <div className="dashboard-status-item">
                    <div className="dashboard-status-icon posted"><FaCheckCircle /></div>
                    <div>
                      <div className="dashboard-status-value">{data.postedLines}</div>
                      <div className="dashboard-status-label">Posted Items</div>
                    </div>
                  </div>

                  <div className="dashboard-status-item">
                    <div className="dashboard-status-icon unposted"><FaHourglassHalf /></div>
                    <div>
                      <div className="dashboard-status-value">{data.unpostedLines}</div>
                      <div className="dashboard-status-label">Awaiting Post</div>
                    </div>
                  </div>
                </div>

                <div className="dashboard-status-bar">
                  <div
                    className="dashboard-status-bar-fill"
                    style={{
                      width: `${data.totalLines ? (data.postedLines / data.totalLines) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="dashboard-status-bar-caption">
                  {data.totalLines ? Math.round((data.postedLines / data.totalLines) * 100) : 0}% of all GRN items posted
                </div>
              </CCardBody>
            </CCard>

            <CCard className="dashboard-trend-card">
              <CCardBody>
                <div className="section-title">GRNs — Last 7 Days</div>

                <div className="dashboard-trend-chart">
                  {data.trend.map((t) => (
                    <div key={t.date} className="dashboard-trend-col">
                      <div className="dashboard-trend-bar-track">
                        <div
                          className="dashboard-trend-bar"
                          style={{ height: `${(t.count / maxTrendCount) * 100}%` }}
                          title={`${t.count} GRN(s)`}
                        />
                      </div>
                      <div className="dashboard-trend-count">{t.count}</div>
                      <div className="dashboard-trend-day">{shortDay(t.date)}</div>
                    </div>
                  ))}
                </div>
              </CCardBody>
            </CCard>
          </div>

          <CCard className="mt-3">
            <CCardBody>
              <div className="section-title">Recent GRNs</div>

              {data.recentGrns.length === 0 ? (
                <div className="dashboard-empty">No GRNs recorded yet</div>
              ) : (
                <table className="dashboard-recent-table">
                  <thead>
                    <tr>
                      <th>GRN NO</th>
                      <th>SUPPLIER</th>
                      <th>PO DATE</th>
                      <th>PARTS</th>
                      <th>TOTAL VALUE (₹)</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentGrns.map((g) => (
                      <tr key={g.grnNumber}>
                        <td>{g.grnNumber}</td>
                        <td>{g.supplierName}</td>
                        <td>{formatDate(g.poDate)}</td>
                        <td>{g.lineCount}</td>
                        <td>{Number(g.totalValue).toFixed(2)}</td>
                        <td>
                          <span className={`dashboard-status-badge ${g.postedLineCount === g.lineCount && g.lineCount > 0 ? 'posted' : g.postedLineCount > 0 ? 'partial' : 'unposted'}`}>
                            {g.postedLineCount === g.lineCount && g.lineCount > 0
                              ? 'Fully Posted'
                              : g.postedLineCount > 0
                                ? `${g.postedLineCount}/${g.lineCount} Posted`
                                : 'Not Posted'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CCardBody>
          </CCard>
        </>
      )}
    </div>
  )
} 

export default Dashboard
