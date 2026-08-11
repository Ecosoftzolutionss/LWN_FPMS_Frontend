import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react'
import { FaEye, FaEdit, FaTrash, FaCheckCircle, FaFileAlt, FaPrint, FaTimes, FaDownload, FaRegCalendarAlt, FaBoxOpen, FaRegFileAlt } from 'react-icons/fa'
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

  const [labelGrn, setLabelGrn] = useState(null) // { grnNumber, supplierInvoiceNumber, supplierInvoiceDate, line: {...} }
  const [showLabel, setShowLabel] = useState(false)

  const [deleteLineTarget, setDeleteLineTarget] = useState(null)
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

  const buildLabelFromLine = (grn, line) => ({
    grnNumber: grn.grnNumber,
    supplierInvoiceNumber: grn.supplierInvoiceNumber,
    supplierInvoiceDate: grn.supplierInvoiceDate,
    line,
  })

  const handlePostLine = async (line) => {
    try {
      await API.put(`/GrnEntry/line/${line.id}/post`)
      toast.success(`${line.partNumber} Posted Successfully`)

      // Reload the GRN so the modal's grid + status badges reflect the
      // new posted state, and immediately show the label for this item.
      const res = await API.get(`/GrnEntry/${detailsGrn.id}`)
      setDetailsGrn(res.data)
      await loadRows()

      const postedLine = res.data.lines.find((l) => l.id === line.id)
      setLabelGrn(buildLabelFromLine(res.data, postedLine))
      setShowLabel(true)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Post Failed'))
    }
  }

  const handleReprintLine = (line) => {
    setLabelGrn(buildLabelFromLine(detailsGrn, line))
    setShowLabel(true)
  }

  const handleViewLine = (line) => {
    if (!line.isPosted) {
      toast.info('This item has not been posted yet — nothing to view')
      return
    }
    setLabelGrn(buildLabelFromLine(detailsGrn, line))
    setShowLabel(true)
  }

  const handleDeleteLineClick = (line) => {
    setDeleteLineTarget(line)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteLine = async () => {
    if (!deleteLineTarget) return

    try {
      await API.delete(`/GrnEntry/line/${deleteLineTarget.id}`)
      toast.success('Deleted Successfully')

      const res = await API.get(`/GrnEntry/${detailsGrn.id}`)
      setDetailsGrn(res.data)
      await loadRows()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setShowDeleteConfirm(false)
      setDeleteLineTarget(null)
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

  const firstLine = labelGrn?.line

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
            { name: 'PALLET COUNT', selector: (row) => row.lineCount, center: true, width: '130px' },
            { name: 'SUPPLIER NAME', selector: (row) => row.supplierName, wrap: true },
            { name: 'INVOICE NO', selector: (row) => row.supplierInvoiceNumber },
            {
              name: 'INVOICE DATE',
              selector: (row) => row.supplierInvoiceDate,
              cell: (row) => formatDate(row.supplierInvoiceDate),
            },
          ]}
          data={filteredRows}
          pagination
          striped
          responsive
          highlightOnHover
          pointerOnHover
          onRowClicked={handleView}
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

      {/* ---------- GRN Item-wise modal ---------- */}
      <CModal visible={showDetails && !!detailsGrn} onClose={() => setShowDetails(false)} alignment="center" size="xl" scrollable>
        {detailsGrn && (
          <>
            <CModalHeader>
              <CModalTitle>GRN {detailsGrn.grnNumber} — Items</CModalTitle>
            </CModalHeader>

            <CModalBody>
              <div className="grn-info-grid grn-info-grid-compact">
                <div><span>SUPPLIER NAME</span><strong>{detailsGrn.supplierName}</strong></div>
                <div><span>PO NUMBER</span><strong>{detailsGrn.poNumber}</strong></div>
                <div><span>INVOICE NUMBER</span><strong>{detailsGrn.supplierInvoiceNumber}</strong></div>
                <div><span>INVOICE DATE</span><strong>{formatDate(detailsGrn.supplierInvoiceDate)}</strong></div>
              </div>

              <div className="grn-modal-section-title">Items</div>

              <table className="grn-modal-items-table">
                <thead>
                  <tr>
                    <th>PART</th>
                    <th>PART DESC</th>
                    <th>QTY</th>
                    <th>PALLET QTY</th>
                    <th>RATE (₹)</th>
                    <th>TOTAL VALUE (₹)</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsGrn.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.partNumber}</td>
                      <td>{l.partName}</td>
                      <td>{l.quantity}</td>
                      <td>{l.palletQuantity ?? '—'}</td>
                      <td>{Number(l.rate).toFixed(2)}</td>
                      <td>{Number(l.totalValue).toFixed(2)}</td>
                      <td>
                        <span className={`line-status-badge ${l.isPosted ? 'posted' : 'unposted'}`}>
                          {l.isPosted ? 'Posted' : 'Not Posted'}
                        </span>
                      </td>
                      <td>
                        <div className="grn-post-actions">
                          <button
                            className="icon-btn view-btn"
                            title="View"
                            onClick={() => handleViewLine(l)}
                          >
                            <FaEye size={13} />
                          </button>
                          <button className="icon-btn edit-btn" title="Edit not supported yet" disabled>
                            <FaEdit size={13} />
                          </button>
                          <button
                            className="icon-btn delete-btn"
                            title="Delete"
                            disabled={l.isPosted}
                            onClick={() => handleDeleteLineClick(l)}
                          >
                            <FaTrash size={13} />
                          </button>
                          {l.isPosted ? (
                            <button className="reprint-btn" onClick={() => handleReprintLine(l)}>
                              <FaPrint size={12} /> Reprint
                            </button>
                          ) : (
                            <button className="post-btn" onClick={() => handlePostLine(l)}>
                              <FaCheckCircle size={12} /> Post
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="grn-modal-total-row">
                    <td colSpan={2}></td>
                    <td><strong>{totalQuantity(detailsGrn)}</strong></td>
                    <td colSpan={5}><strong>Total Value: ₹{totalValue(detailsGrn).toFixed(2)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </CModalBody>

            <CModalFooter>
              <CButton className="grn-modal-close-btn" onClick={() => setShowDetails(false)}>
                <FaTimes size={12} /> Close
              </CButton>
            </CModalFooter>
          </>
        )}
      </CModal>

      {/* ---------- Delete confirm ---------- */}
      <CModal visible={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} alignment="center" backdrop="static">
        <CModalHeader className="border-0">
          <CModalTitle className="w-100 text-center text-danger fw-bold">⚠ Confirm Delete</CModalTitle>
        </CModalHeader>
        <CModalBody className="text-center">
          <p>Are you sure you want to delete this GRN?</p>
        </CModalBody>
        <CModalFooter className="border-0 d-flex justify-content-center">
          <CButton color="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</CButton>
          <CButton color="danger" onClick={confirmDeleteLine}>Delete</CButton>
        </CModalFooter>
      </CModal>

      {/* ---------- FIFO GRN Label modal ---------- */}
      <CModal visible={showLabel && !!labelGrn} onClose={() => setShowLabel(false)} alignment="center" size="lg" scrollable>
        {labelGrn && (
          <>
            <CModalHeader>
              <div>
                <CModalTitle><FaPrint size={16} /> FIFO GRN LABEL</CModalTitle>
                <small className="text-muted">Review GRN details before printing</small>
              </div>
            </CModalHeader>

            <CModalBody>
              <div className="fifo-card" id="fifo-print-area">
                <div className="fifo-card-header">
                  <div className="fifo-logo-wrap">
                    <img src="/GLOVIS.png" alt="Leewon" className="fifo-logo-img" crossOrigin="anonymous" />
                    <span className="fifo-logo-text">LEEWON</span>
                  </div>
                  <div className="fifo-title-wrap">
                    <span className="fifo-dash" />
                    <span className="fifo-title">FIFO CARD</span>
                    <span className="fifo-dash" />
                  </div>
                </div>

                <div className="fifo-card-main">
                  <div className="fifo-left-col">
                    <div className="fifo-box">
                      <div className="fifo-box-label">PALLET NO.</div>
                      <div className="fifo-box-value">{firstLine?.palletNo || '—'}</div>
                    </div>
                    <div className="fifo-box">
                      <div className="fifo-box-label">FIFO PALLET NO.</div>
                      <div className="fifo-box-value small">{firstLine?.fifoPalletNo || '—'}</div>
                    </div>
                    <div className="fifo-qr-box">
                      <img
                        className="fifo-qr-img"
                        alt="Scan for details"
                        crossOrigin="anonymous"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(
                          JSON.stringify({
                            grn: labelGrn.grnNumber,
                            fifoPalletNo: firstLine?.fifoPalletNo,
                            palletNo: firstLine?.palletNo,
                            part: firstLine?.partNumber,
                          }),
                        )}`}
                      />
                      <div className="fifo-qr-caption">SCAN FOR DETAILS</div>
                    </div>
                  </div>

                  <div className="fifo-right-col">
                    <div className="fifo-meta-grid">
                      <div><FaRegFileAlt className="fifo-meta-icon" /> <span>SUP. INV. NO. :</span> {labelGrn.supplierInvoiceNumber}</div>
                      <div><FaRegCalendarAlt className="fifo-meta-icon" /> <span>DATE :</span> {formatDate(labelGrn.supplierInvoiceDate)}</div>
                      <div><FaBoxOpen className="fifo-meta-icon" /> <span>QTY :</span> {firstLine?.quantity ?? 0} Nos.</div>
                      <div><FaRegFileAlt className="fifo-meta-icon" /> <span>GRN NO. :</span> {labelGrn.grnNumber}</div>
                      <div><FaRegCalendarAlt className="fifo-meta-icon" /> <span>DATE :</span> {formatDate(firstLine?.postedDate)}</div>
                      <div><FaBoxOpen className="fifo-meta-icon" /> <span>QTY :</span> {firstLine?.palletQuantity ?? 0} Nos.</div>
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
            </CModalBody>

            <CModalFooter>
              <CButton className="grn-modal-download-btn" onClick={handleDownloadLabel}>
                <FaDownload size={12} /> Download
              </CButton>
              <CButton className="grn-modal-print-btn" onClick={handlePrintLabel}>
                <FaPrint size={12} /> Print FIFO GRN Label
              </CButton>
            </CModalFooter>
          </>
        )}
      </CModal>
    </div>
  )
}

export default GRNPost
