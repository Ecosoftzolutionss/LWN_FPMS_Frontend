import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput } from '@coreui/react'
import { FaEye, FaEdit, FaTrash, FaCheckCircle, FaFileAlt, FaPrint, FaTimes, FaDownload } from 'react-icons/fa'
import { toast } from 'react-toastify'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import API from '../../api.js'
import '../../assets/CSS/grnPost.css'

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.message || data.error) return data.message || data.error

  if (data.errors && typeof data.errors === 'object') {
    const firstField = Object.keys(data.errors)[0]
    const firstMessage = data.errors[firstField]?.[0]
    if (firstMessage) return firstMessage
  }

  return fallback
}

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const GRNPost = () => {
  const [tab, setTab] = useState('unposted') // 'unposted' | 'reprint'
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')

  const [detailsGrn, setDetailsGrn] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  const [labelGrn, setLabelGrn] = useState(null)
  const [showLabel, setShowLabel] = useState(false)

  const [deleteId, setDeleteId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    loadRows()
  }, [tab])

  const loadRows = async () => {
    try {
      const posted = tab === 'reprint'
      const res = await API.get(`/GrnEntry?posted=${posted}`)
      setRows(res.data || [])
    } catch {
      toast.error('Failed to load GRN list')
    }
  }

  const filteredRows = rows.filter(
    (r) =>
      (r.grnNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.supplierInvoiceNumber || '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleView = async (row) => {
    try {
      const res = await API.get(`/GrnEntry/${row.id}`)
      setDetailsGrn(res.data)
      setShowDetails(true)
    } catch {
      toast.error('Failed to load GRN details')
    }
  }

  const handlePost = async (row) => {
    try {
      await API.put(`/GrnEntry/${row.id}/post`)
      toast.success(`${row.grnNumber} Posted Successfully`)
      await loadRows()

      // Immediately show the FIFO label for what was just posted, using
      // the full record (now includes the assigned PalletNo/FifoPalletNo).
      const full = await API.get(`/GrnEntry/${row.id}`)
      setLabelGrn(full.data)
      setShowLabel(true)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Post Failed'))
    }
  }

  const handleDeleteClick = (row) => {
    setDeleteId(row.id)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    try {
      await API.delete(`/GrnEntry/${deleteId}`)
      toast.success('Deleted Successfully')
      await loadRows()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteConfirm(false)
      setDeleteId(null)
    }
  }

  const handleReprintLabel = async (row) => {
    try {
      const res = await API.get(`/GrnEntry/${row.id}`)
      setLabelGrn(res.data)
      setShowLabel(true)
    } catch {
      toast.error('Failed to load GRN for label')
    }
  }

  const handlePrintLabel = () => {
    window.print()
  }

  const handleDownloadLabel = async () => {
    const node = document.getElementById('fifo-print-area')
    if (!node) {
      toast.error('Label not found — try reopening it')
      return
    }

    try {
      const canvas = await html2canvas(node, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true, // required so the cross-origin QR image actually renders
      })

      const imgData = canvas.toDataURL('image/png')

      // Fit the captured card into a PDF page sized to match its own
      // aspect ratio (landscape, since the card is wider than it is tall).
      const pxToMm = 0.264583
      const widthMm = canvas.width * pxToMm
      const heightMm = canvas.height * pxToMm

      const pdf = new jsPDF({
        orientation: widthMm > heightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [widthMm, heightMm],
      })

      pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm)
      pdf.save(`FIFO-Label-${labelGrn?.fifoPalletNo || labelGrn?.grnNumber || 'card'}.pdf`)
    } catch (err) {
      toast.error('Failed to generate the label PDF for download')
    }
  }

  const totalQuantity = (grn) => (grn?.lines || []).reduce((sum, l) => sum + Number(l.quantity || 0), 0)
  const totalValue = (grn) => (grn?.lines || []).reduce((sum, l) => sum + Number(l.totalValue || 0), 0)

  const firstLine = labelGrn?.lines?.[0]

  return (
    <div className="grn-post-page">
      <div className="grn-post-toolbar">
        <button
          className={`grn-tab-btn tab-post ${tab === 'unposted' ? 'active' : ''}`}
          onClick={() => setTab('unposted')}
        >
          <FaFileAlt size={13} /> Show All GRN Post
        </button>

        <button
          className={`grn-tab-btn tab-reprint ${tab === 'reprint' ? 'active' : ''}`}
          onClick={() => setTab('reprint')}
        >
          <FaPrint size={13} /> GRN Reprint
        </button>

        <div className="grn-post-search">
          <CFormInput placeholder="Search....." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grn-post-table-card">
        <DataTable
          columns={[
            { name: 'S.NO', selector: (row, index) => index + 1, width: '70px' },
            { name: 'GRN NO', selector: (row) => row.grnNumber },
            { name: 'SUPPLIER NAME', selector: (row) => row.supplierName, wrap: true },
            { name: 'INVOICE NO', selector: (row) => row.supplierInvoiceNumber },
            {
              name: 'INVOICE DATE',
              selector: (row) => row.supplierInvoiceDate,
              cell: (row) => formatDate(row.supplierInvoiceDate),
            },
            {
              name: 'ACTION',
              center: true,
              minWidth: '220px',
              cell: (row) => (
                <div className="grn-post-actions">
                  <button className="icon-btn view-btn" title="View" onClick={() => handleView(row)}>
                    <FaEye size={13} />
                  </button>

                  {tab === 'unposted' && (
                    <>
                      <button className="icon-btn edit-btn" title="Edit">
                        <FaEdit size={13} />
                      </button>
                      <button className="icon-btn delete-btn" title="Delete" onClick={() => handleDeleteClick(row)}>
                        <FaTrash size={13} />
                      </button>
                      <button className="post-btn" onClick={() => handlePost(row)}>
                        <FaCheckCircle size={12} /> Post
                      </button>
                    </>
                  )}

                  {tab === 'reprint' && (
                    <>
                      <button className="icon-btn delete-btn" title="Delete" onClick={() => handleDeleteClick(row)}>
                        <FaTrash size={13} />
                      </button>
                      <button className="reprint-btn" onClick={() => handleReprintLabel(row)}>
                        <FaPrint size={12} /> Reprint Label
                      </button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          data={filteredRows}
          pagination
          striped
          responsive
          highlightOnHover
          noDataComponent={<div className="grn-post-empty">No records to display</div>}
          customStyles={{
            rows: { style: { minHeight: '48px' } },
            headRow: {
              style: {
                backgroundColor: '#f1f4fa',
              },
            },
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
                fontSize: '14px',
              },
            },
          }}
        />
      </div>

      {/* ---------- GRN Details modal ---------- */}
      {showDetails && detailsGrn && (
        <div className="grn-modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="grn-modal" onClick={(e) => e.stopPropagation()}>
            <div className="grn-modal-header">
              <h3>GRN Details</h3>
              <button onClick={() => setShowDetails(false)}><FaTimes /></button>
            </div>

            <div className="grn-modal-body">
              <div className="grn-modal-section-title">GRN Information</div>

              <div className="grn-info-grid">
                <div><span>GRN NUMBER</span><strong>{detailsGrn.grnNumber}</strong></div>
                <div><span>SUPPLIER NAME</span><strong>{detailsGrn.supplierName}</strong></div>
                <div><span>PO NUMBER</span><strong>{detailsGrn.poNumber}</strong></div>
                <div><span>PO DATE</span><strong>{formatDate(detailsGrn.poDate)}</strong></div>
                <div><span>INVOICE NUMBER</span><strong>{detailsGrn.supplierInvoiceNumber}</strong></div>
                <div><span>INVOICE DATE</span><strong>{formatDate(detailsGrn.supplierInvoiceDate)}</strong></div>
                <div><span>GRN TYPE</span><strong>{detailsGrn.grnType}</strong></div>
              </div>

              <div className="grn-modal-section-title">GRN Items</div>

              <table className="grn-modal-items-table">
                <thead>
                  <tr>
                    <th>PART</th>
                    <th>PART DESCRIPTION</th>
                    <th>QUANTITY</th>
                    <th>RATE (₹)</th>
                    <th>TOTAL VALUE (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsGrn.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.partNumber}</td>
                      <td>{l.partName}</td>
                      <td>{l.quantity}</td>
                      <td>{Number(l.rate).toFixed(2)}</td>
                      <td>{Number(l.totalValue).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="grn-modal-total-row">
                    <td colSpan={2}></td>
                    <td><strong>Total Quantity</strong><br />{totalQuantity(detailsGrn)}</td>
                    <td colSpan={2}><strong>Total Value</strong><br />₹{totalValue(detailsGrn).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grn-modal-footer">
              <CButton className="grn-modal-close-btn" onClick={() => setShowDetails(false)}>
                <FaTimes size={12} /> Close
              </CButton>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Delete confirm ---------- */}
      {showDeleteConfirm && (
        <div className="grn-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="grn-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="grn-confirm-title">⚠ Confirm Delete</div>
            <p>Are you sure you want to delete this GRN?</p>
            <div className="grn-confirm-actions">
              <CButton color="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</CButton>
              <CButton color="danger" onClick={confirmDelete}>Delete</CButton>
            </div>
          </div>
        </div>
      )}

      {/* ---------- FIFO GRN Label modal ---------- */}
      {showLabel && labelGrn && (
        <div className="grn-modal-overlay" onClick={() => setShowLabel(false)}>
          <div className="grn-label-modal" onClick={(e) => e.stopPropagation()}>
            <div className="grn-modal-header">
              <div>
                <h3><FaPrint size={16} /> FIFO GRN LABEL</h3>
                <small>Review GRN details before printing</small>
              </div>
              <button onClick={() => setShowLabel(false)}><FaTimes /></button>
            </div>

            <div className="grn-modal-body">
              <div className="fifo-card" id="fifo-print-area">
                <div className="fifo-card-header">
                  <img src="/GLOVIS.png" alt="Leewon" className="fifo-logo-img" crossOrigin="anonymous" />
                  <span className="fifo-title">FIFO CARD</span>
                </div>

                <div className="fifo-card-main">
                  <div className="fifo-left-col">
                    <div className="fifo-box">
                      <div className="fifo-box-label">PALLET NO.</div>
                      <div className="fifo-box-value">{labelGrn.palletNo || '—'}</div>
                    </div>
                    <div className="fifo-box">
                      <div className="fifo-box-label">FIFO PALLET NO.</div>
                      <div className="fifo-box-value small">{labelGrn.fifoPalletNo || '—'}</div>
                    </div>
                    <div className="fifo-qr-box">
                      <img
                        className="fifo-qr-img"
                        alt="Scan for details"
                        crossOrigin="anonymous"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(
                          JSON.stringify({
                            grn: labelGrn.grnNumber,
                            fifoPalletNo: labelGrn.fifoPalletNo,
                            palletNo: labelGrn.palletNo,
                            part: firstLine?.partNumber,
                          }),
                        )}`}
                      />
                      <div className="fifo-qr-caption">SCAN FOR DETAILS</div>
                    </div>
                  </div>

                  <div className="fifo-right-col">
                    <div className="fifo-meta-grid">
                      <div><span>SUP. INV. NO. :</span> {labelGrn.supplierInvoiceNumber}</div>
                      <div><span>DATE :</span> {formatDate(labelGrn.supplierInvoiceDate)}</div>
                      <div><span>QTY :</span> {totalQuantity(labelGrn)} Nos.</div>
                      <div><span>GRN NO. :</span> {labelGrn.grnNumber}</div>
                      <div><span>DATE :</span> {formatDate(labelGrn.postedDate)}</div>
                      <div><span>QTY :</span> {firstLine?.quantity ?? 0} Nos.</div>
                    </div>

                    <div className="fifo-part-row">
                      <div>
                        <div className="fifo-part-label">PART NUMBER &amp; NAME</div>
                        <div className="fifo-part-value">{firstLine?.partNumber}</div>
                        <div className="fifo-part-name">{firstLine?.partName?.toUpperCase()}</div>
                      </div>
                      <div className="fifo-pallet-qty">
                        <div className="fifo-part-label">PALLET QTY (Nos.)</div>
                        <div className="fifo-qty-value">{firstLine?.palletQuantity ?? firstLine?.quantity ?? 0}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="fifo-card-footer">
                  <div className="fifo-sign">STORES INCHARGE</div>
                  <div className="fifo-sign">QA APPROVED</div>
                </div>
              </div>

              {labelGrn.lines?.length > 1 && (
                <small className="text-muted fifo-note">
                  This GRN has {labelGrn.lines.length} parts — the label above shows the first line
                  ({firstLine?.partNumber}). A real per-pallet FIFO system prints one label per
                  physical pallet; say the word if you want that level of breakdown built out.
                </small>
              )}
            </div>

            <div className="grn-modal-footer">
              <CButton className="grn-modal-download-btn" onClick={handleDownloadLabel}>
                <FaDownload size={12} /> Download
              </CButton>
              <CButton className="grn-modal-print-btn" onClick={handlePrintLabel}>
                <FaPrint size={12} /> Print FIFO GRN Label
              </CButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GRNPost
