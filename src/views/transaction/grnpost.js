import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from 'react-data-table-component';
import { CButton, CFormInput, CFormSelect, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react';
import { FaEye, FaEdit, FaTrash, FaCheckCircle, FaFileAlt, FaPrint, FaTimes, FaDownload, FaRegCalendarAlt, FaBoxOpen, FaRegFileAlt, FaLayerGroup } from 'react-icons/fa';
import { toast } from 'react-toastify'
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import API from '../../api.js';
import '../../assets/CSS/grnPost.css';
import usePrivilege from '../hooks/usePrivilege.js';

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

// The three label sizes the user can pick before printing/downloading.
// widthMm/heightMm drive the physical output size (preview + @page + PDF).
const LABEL_SIZE_OPTIONS = [
  {
    value: '',
    label: 'Select Label Size',
    widthMm: 0,
    heightMm: 0,
  },
  {
    value: '150x100',
    label: 'Size (100 x 150mm)',
    widthMm: 150,
    heightMm: 100,
  },
  {
    value: '50x25',
    label: 'Size (50 x 25mm)',
    widthMm: 50,
    heightMm: 25,
  },
  {
    value: '100x75',
    label: 'Size (100 x 75mm)',
    widthMm: 100,
    heightMm: 75,
  },
]

// ★ NEW: the FIFO card is always designed/laid out at this one "master"
// size. Every label size option is produced by uniformly scaling this
// exact design down (or up) to fit inside the chosen physical label,
// then centering it. This guarantees the card looks identical — same
// logo, boxes, QR, meta grid, part row, footer — at every size, just
// smaller, instead of needing a different hand-built layout per size.
const BASE_CARD_WIDTH_MM = 150
const BASE_CARD_HEIGHT_MM = 100

// Shared scale-to-fit math used both by the single-label preview and the
// bulk-label preview, so both stay pixel-for-pixel identical.
const computeCardTransform = (activeSize) => {
  if (!activeSize) return { scale: 0, offsetXmm: 0, offsetYmm: 0 }
  const scale = Math.min(
    activeSize.widthMm / BASE_CARD_WIDTH_MM,
    activeSize.heightMm / BASE_CARD_HEIGHT_MM
  )
  return {
    scale,
    offsetXmm: (activeSize.widthMm - BASE_CARD_WIDTH_MM * scale) / 2,
    offsetYmm: (activeSize.heightMm - BASE_CARD_HEIGHT_MM * scale) / 2,
  }
}

const GRNPost = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState('unposted') // 'unposted' | 'reprint'
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')

  const [detailsGrn, setDetailsGrn] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  // Read-only "GRN Details" modal — this is what the eye/View icon on a
  // line opens, instead of jumping straight to the printable FIFO label.
  const [viewLineTarget, setViewLineTarget] = useState(null)
  const [showLineDetails, setShowLineDetails] = useState(false)

  const [labelGrn, setLabelGrn] = useState(null) // { grnNumber, supplierInvoiceNumber, supplierInvoiceDate, line: {...} }
  const [showLabel, setShowLabel] = useState(false)

  // Chosen label size, defaults to the first option.
  const [labelSize, setLabelSize] = useState('')

  // ★ NEW: rows checked in the GRN Details items table, used to drive
  // Bulk Post / Bulk Print. Reset (via toggleClearSelectedLines) after
  // any bulk action so stale selections don't linger.
  const [selectedLines, setSelectedLines] = useState([])
  const [toggleClearSelectedLines, setToggleClearSelectedLines] = useState(false)
  const [bulkPosting, setBulkPosting] = useState(false)

  // ★ NEW: bulk FIFO label modal — same card design as the single-label
  // modal, one frame per selected line, sized/scaled together.
  const [bulkLabelGrn, setBulkLabelGrn] = useState(null) // { grnNumber, supplierInvoiceNumber, supplierInvoiceDate, totalQuantity, lines: [...] }
  const [showBulkLabel, setShowBulkLabel] = useState(false)
  const [bulkLabelSize, setBulkLabelSize] = useState('')

  const [deleteLineTarget, setDeleteLineTarget] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { privileges: userPrivileges = [] } = usePrivilege()
  const uPrivilege = userPrivileges.find((p) => p.menuName === 'GRN Post') || {}

const getCurrentUsername = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    return user?.username || ''
  } catch {
    return ''
  }
}

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
      setSelectedLines([])
      setShowDetails(true)
    } catch {
      toast.error('Failed to load GRN details')
    }
  }

  const buildLabelFromLine = (grn, line) => ({
    grnNumber: grn.grnNumber,
    supplierInvoiceNumber: grn.supplierInvoiceNumber,
    supplierInvoiceDate: grn.supplierInvoiceDate,
    totalQuantity: totalQuantity(grn),
    line,
  })

  const handlePostLine = async (line) => {
    try {
      await API.put(`/GrnEntry/line/${line.id}/post`, {
  postedBy: getCurrentUsername(),
})
      toast.success(`${line.partNumber} Posted Successfully`)

      const res = await API.get(`/GrnEntry/${detailsGrn.id}`)
      setDetailsGrn(res.data)
      await loadRows()

      const postedLine = res.data.lines.find((l) => l.id === line.id)
      setLabelGrn(buildLabelFromLine(res.data, postedLine))
      setLabelSize('')
      setShowLabel(true)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Post Failed'))
    }
  }

  const handleReprintLine = (line) => {
    setLabelSize('')
    setLabelGrn(buildLabelFromLine(detailsGrn, line))
    setShowLabel(true)
  }

  // ★ NEW: Bulk GRN Post — posts every currently-unposted line the user
  // has checked, in one API call. Successes and failures are reported
  // back per-line (e.g. a part with no Store Master pallet config won't
  // block the rest of the batch), then the freshly posted lines are
  // offered straight into the Bulk Print view.
  const handleBulkPost = async () => {
    const targets = selectedLines.filter((l) => !l.isPosted)
    if (targets.length === 0) {
      toast.info('Select at least one unposted item to post')
      return
    }

    setBulkPosting(true)
    try {
      const res = await API.put('/GrnEntry/lines/post-bulk', {
        lineIds: targets.map((l) => l.id),
        postedBy: getCurrentUsername(),
      })

      const postedList = res.data?.posted || []
      const errorList = res.data?.errors || []

      if (postedList.length > 0) {
        toast.success(`${postedList.length} item(s) posted successfully`)
      }
      errorList.forEach((e) => toast.error(e.message || 'Failed to post an item'))

      const refreshed = await API.get(`/GrnEntry/${detailsGrn.id}`)
      setDetailsGrn(refreshed.data)
      await loadRows()

      setSelectedLines([])
      setToggleClearSelectedLines((prev) => !prev)

      if (postedList.length > 0) {
        const postedIds = new Set(postedList.map((p) => p.id))
        const postedLines = refreshed.data.lines.filter((l) => postedIds.has(l.id))
        openBulkLabel(refreshed.data, postedLines)
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Bulk Post Failed'))
    } finally {
      setBulkPosting(false)
    }
  }

  // ★ NEW: Bulk GRN Print — opens the multi-label preview for every
  // already-posted line the user has checked, without touching anything
  // on the server (pure reprint of existing pallet/FIFO numbers).
  const handleBulkPrint = () => {
    const targets = selectedLines.filter((l) => l.isPosted)
    if (targets.length === 0) {
      toast.info('Select at least one posted item to print')
      return
    }
    openBulkLabel(detailsGrn, targets)
  }

  const openBulkLabel = (grn, lines) => {
    setBulkLabelGrn({
      grnNumber: grn.grnNumber,
      supplierInvoiceNumber: grn.supplierInvoiceNumber,
      supplierInvoiceDate: grn.supplierInvoiceDate,
      totalQuantity: totalQuantity(grn),
      lines,
    })
    setBulkLabelSize('')
    setShowBulkLabel(true)
  }

  // The View/eye action opens the read-only GRN Details modal for this
  // line, instead of jumping straight to the printable FIFO label.
  const handleViewLine = (line) => {
    setViewLineTarget(line)
    setShowLineDetails(true)
  }

  const handleEditGrn = () => {
    if (!detailsGrn) return

    // The update API replaces all lines, so don't allow editing
    // if any line has already been posted.
    if (detailsGrn.isPosted || detailsGrn.lines?.some((line) => line.isPosted)) {
      toast.info('A posted GRN cannot be edited')
      return
    }

    setShowDetails(false)

    navigate('/transaction/grnentry', {
      state: {
        editGrnId: detailsGrn.id,
      },
    })
  }

  // From inside the GRN Details modal, the user can still jump to the
  // printable label explicitly (only meaningful once posted).
  const handleOpenLabelFromDetails = () => {
    if (!viewLineTarget?.isPosted) {
      toast.info('This item has not been posted yet — nothing to print')
      return
    }
    setShowLineDetails(false)
    setLabelSize('')
    setLabelGrn(buildLabelFromLine(detailsGrn, viewLineTarget))
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

  // Builds a temporary <style> tag with an @page rule matching the
  // chosen label size, so window.print() outputs at that exact physical
  // size instead of the browser's default page size. Removed right
  // after the print dialog is triggered.
  const applyPrintPageSize = () => {
    const size = LABEL_SIZE_OPTIONS.find((s) => s.value === labelSize) || LABEL_SIZE_OPTIONS[0]
    const styleTag = document.createElement('style')
    styleTag.id = 'grn-label-print-size'
    styleTag.innerHTML = `
      @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
      @media print {
        body * { visibility: hidden; }
        #fifo-print-area, #fifo-print-area * { visibility: visible; }
        #fifo-print-area {
          position: fixed;
          top: 0;
          left: 0;
          width: ${size.widthMm}mm;
          height: ${size.heightMm}mm;
          margin: 0;
        }
      }
    `
    document.head.appendChild(styleTag)
    return styleTag
  }

  const handlePrintLabel = () => {
    const styleTag = applyPrintPageSize()
    window.print()
    // Give the print dialog a moment to read the styles before cleanup.
    setTimeout(() => {
      styleTag.remove()
    }, 1000)
  }

  const handleDownloadLabel = async () => {
    const node = document.getElementById('fifo-print-area')
    if (!node) {
      toast.error('Label not found — try reopening it')
      return
    }

    const size = LABEL_SIZE_OPTIONS.find((s) => s.value === labelSize) || LABEL_SIZE_OPTIONS[0]

    try {
      const canvas = await html2canvas(node, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
      })

      const imgData = canvas.toDataURL('image/png')

      // The PDF page is sized to the chosen label size (mm) rather than
      // derived from the canvas pixel dimensions, so Download always
      // matches what Print produces.
      const pdf = new jsPDF({
        orientation: size.widthMm >= size.heightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [size.widthMm, size.heightMm],
      })

      pdf.addImage(imgData, 'PNG', 0, 0, size.widthMm, size.heightMm)
      pdf.save(`FIFO-Label-${labelGrn?.fifoPalletNo || labelGrn?.grnNumber || 'card'}-${size.value}.pdf`)
    } catch (err) {
      toast.error('Failed to generate the label PDF for download')
    }
  }

  // ★ NEW: bulk-print page-size styling. Identical @page sizing to the
  // single-label version, but adds a page-break after every label frame
  // so each posted line prints on its own physical label/page, with no
  // break after the very last one.
  const applyBulkPrintPageSize = () => {
    const size = LABEL_SIZE_OPTIONS.find((s) => s.value === bulkLabelSize) || LABEL_SIZE_OPTIONS[0]
    const styleTag = document.createElement('style')
    styleTag.id = 'grn-bulk-label-print-size'
    styleTag.innerHTML = `
      @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
      @media print {
        body * { visibility: hidden; }
        #fifo-bulk-print-area, #fifo-bulk-print-area * { visibility: visible; }
        #fifo-bulk-print-area {
          position: fixed;
          top: 0;
          left: 0;
        }
        .fifo-bulk-label-frame {
          width: ${size.widthMm}mm;
          height: ${size.heightMm}mm;
          margin: 0;
          page-break-after: always;
        }
        .fifo-bulk-label-frame:last-child {
          page-break-after: auto;
        }
      }
    `
    document.head.appendChild(styleTag)
    return styleTag
  }

  const handlePrintBulkLabel = () => {
    const styleTag = applyBulkPrintPageSize()
    window.print()
    setTimeout(() => {
      styleTag.remove()
    }, 1000)
  }

  // ★ NEW: bulk download — captures each label frame individually (by
  // its own id) and stitches them into one multi-page PDF, one page per
  // selected line, all at the chosen label size.
  const handleDownloadBulkLabel = async () => {
    if (!bulkLabelGrn?.lines?.length) {
      toast.error('No labels to download')
      return
    }

    const size = LABEL_SIZE_OPTIONS.find((s) => s.value === bulkLabelSize) || LABEL_SIZE_OPTIONS[0]
    const orientation = size.widthMm >= size.heightMm ? 'landscape' : 'portrait'

    try {
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: [size.widthMm, size.heightMm],
      })

      for (let i = 0; i < bulkLabelGrn.lines.length; i++) {
        const line = bulkLabelGrn.lines[i]
        const node = document.getElementById(`fifo-bulk-frame-${line.id}`)
        if (!node) continue

        const canvas = await html2canvas(node, {
          scale: 3,
          backgroundColor: '#ffffff',
          useCORS: true,
        })
        const imgData = canvas.toDataURL('image/png')

        if (i > 0) {
          pdf.addPage([size.widthMm, size.heightMm], orientation)
        }
        pdf.addImage(imgData, 'PNG', 0, 0, size.widthMm, size.heightMm)
      }

      pdf.save(`FIFO-Labels-Bulk-${bulkLabelGrn.grnNumber}-${size.value}.pdf`)
    } catch (err) {
      toast.error('Failed to generate the bulk label PDF for download')
    }
  }

  const totalQuantity = (grn) => (grn?.lines || []).reduce((sum, l) => sum + Number(l.quantity || 0), 0)
  const totalPalletQuantity = (grn) => (grn?.lines || []).reduce((sum, l) => sum + Number(l.palletQuantity || 0), 0)
  const totalValue = (grn) => (grn?.lines || []).reduce((sum, l) => sum + Number(l.totalValue || 0), 0)

  const firstLine = labelGrn?.line

  // Current label size's mm dimensions, used for the live on-screen
  // preview / print / download frame.
  const activeSize = LABEL_SIZE_OPTIONS.find(
    (s) => s.value === labelSize
  )

  // ★ Uniform scale-to-fit: the card is always drawn at
  // BASE_CARD_WIDTH_MM x BASE_CARD_HEIGHT_MM, then scaled down (or up)
  // to fit inside the chosen physical label and centered. This is what
  // keeps the design identical — logo, boxes, QR, meta grid, part row,
  // footer — across every label size instead of needing bespoke,
  // easily-broken layouts per size.
  const { scale: cardScale, offsetXmm: cardOffsetXmm, offsetYmm: cardOffsetYmm } = computeCardTransform(activeSize)

  // ★ NEW: same scale-to-fit math, driven by the bulk modal's own size
  // selector so a user can pick a different label size for a bulk run
  // than whatever was last used for a single reprint.
  const bulkActiveSize = LABEL_SIZE_OPTIONS.find((s) => s.value === bulkLabelSize)
  const { scale: bulkCardScale, offsetXmm: bulkCardOffsetXmm, offsetYmm: bulkCardOffsetYmm } = computeCardTransform(bulkActiveSize)

  // Renders the actual FIFO card markup for one line. Shared by both the
  // single-label modal and the bulk-label modal so the design can never
  // drift between the two — only the wrapping frame differs.
  const renderFifoCard = (grnMeta, line, scale, offsetXmm, offsetYmm) => (
    <div
      className="fifo-card"
      style={{
        width: `${BASE_CARD_WIDTH_MM}mm`,
        height: `${BASE_CARD_HEIGHT_MM}mm`,
        transform: `translate(${offsetXmm}mm, ${offsetYmm}mm) scale(${scale})`,
      }}
    >
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
            <div className="fifo-box-value">{line?.palletNo || '—'}</div>
          </div>
          <div className="fifo-box">
            <div className="fifo-box-label">FIFO PALLET NO.</div>
            <div className="fifo-box-value small">{line?.fifoPalletNo || '—'}</div>
          </div>
          <div className="fifo-qr-box">
            <img
              className="fifo-qr-img"
              alt="Scan for details"
              crossOrigin="anonymous"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(
                JSON.stringify({
                  grn: grnMeta.grnNumber,
                  fifoPalletNo: line?.fifoPalletNo,
                  palletNo: line?.palletNo,
                  part: line?.partNumber,
                  qty: line?.quantity ?? line?.palletQuantity ?? 0,
                  location: line?.storeLocation || line?.location || '',
                }),
              )}`}
            />
            <div className="fifo-qr-caption">SCAN FOR DETAILS</div>
          </div>
        </div>

        <div className="fifo-right-col">
          <div className="fifo-meta-grid">
            <div><FaRegFileAlt className="fifo-meta-icon" /> <span>S.I.NO:</span> {grnMeta.supplierInvoiceNumber}</div>
            <div><FaRegCalendarAlt className="fifo-meta-icon" /> <span>DATE:</span> {formatDate(grnMeta.supplierInvoiceDate)}</div>
            <div><FaBoxOpen className="fifo-meta-icon" /> <span>QTY :</span> {grnMeta.totalQuantity ?? 0} Nos.</div>
            <div><FaRegFileAlt className="fifo-meta-icon" /> <span>GRN NO:</span> {grnMeta.grnNumber}</div>
            <div><FaRegCalendarAlt className="fifo-meta-icon" /> <span>DATE:</span> {formatDate(line?.postedDate)}</div>
            <div><FaBoxOpen className="fifo-meta-icon" /> <span>PQTY:</span> {line?.palletQuantity ?? 0} Nos.</div>
          </div>

          <div className="fifo-part-row">
            <div>
              <div className="fifo-part-label">PART NUMBER &amp; NAME</div>
              <div className="fifo-part-value">{line?.partNumber}</div>
              <div className="fifo-part-name">{line?.partName?.toUpperCase()}</div>
            </div>
            <div className="fifo-pallet-qty">
              <div className="fifo-part-label">PALLET QTY (Nos.)</div>
              <div className="fifo-qty-value">{line?.palletQuantity ?? line?.quantity ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="fifo-card-footer">
        <div className="fifo-sign">STORES INCHARGE</div>
        <div className="fifo-sign">QA APPROVED</div>
      </div>
    </div>
  )

  const selectedUnpostedCount = selectedLines.filter((l) => !l.isPosted).length
  const selectedPostedCount = selectedLines.filter((l) => l.isPosted).length

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
          persistTableHead
          striped
          responsive
          highlightOnHover
          pointerOnHover
          onRowClicked={handleView}
          noDataComponent={<div className="grn-post-empty">No records to display</div>}
          customStyles={{
            rows: { style: { minHeight: '38px' } },
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

      {/* ---------- GRN Item-wise modal (row click) ---------- */}
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

              <div
                className="grn-modal-section-title"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}
              >
                <span>Items</span>

                {/* ★ NEW: Bulk Post / Bulk Print toolbar — driven by the
                    checkboxes on the table below. Each button only acts on
                    the subset of the current selection it applies to
                    (unposted lines for Post, posted lines for Print), and
                    is disabled when that subset is empty. */}
                <div className="grn-bulk-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {selectedLines.length > 0 && (
                    <span className="text-muted small">{selectedLines.length} selected</span>
                  )}
                  <button
                    className="post-btn"
                    disabled={selectedUnpostedCount === 0 || bulkPosting}
                    onClick={handleBulkPost}
                    title="Post all selected unposted items"
                  >
                    <FaLayerGroup size={12} /> {bulkPosting ? 'Posting…' : `Bulk Post (${selectedUnpostedCount})`}
                  </button>
                  <button
                    className="reprint-btn"
                    disabled={selectedPostedCount === 0}
                    onClick={handleBulkPrint}
                    title="Print/download labels for all selected posted items"
                  >
                    <FaPrint size={12} /> {`Bulk Print (${selectedPostedCount})`}
                  </button>
                </div>
              </div>

              <DataTable
                columns={[
                  { name: 'PART', selector: (row) => row.partNumber, minWidth: '90px' },
                  { name: 'PART DESC', selector: (row) => row.partName, grow: 2, wrap: true },
                  { name: 'QTY', selector: (row) => row.quantity, center: true, width: '80px' },
                  { name: 'PALLET QTY', selector: (row) => row.palletQuantity ?? '—', center: true, width: '110px' },
                  { name: 'RATE (₹)', selector: (row) => Number(row.rate).toFixed(2), center: true, width: '100px' },
                  { name: 'TOTAL VALUE (₹)', selector: (row) => Number(row.totalValue).toFixed(2), center: true, minWidth: '130px' },
                  {
                    name: 'STATUS',
                    center: true,
                    width: '110px',
                    cell: (row) => (
                      <span className={`line-status-badge ${row.isPosted ? 'posted' : 'unposted'}`}>
                        {row.isPosted ? 'Posted' : 'Not Posted'}
                      </span>
                    ),
                  },
                  {
                    name: 'ACTION',
                    center: true,
                    minWidth: '230px',
                    cell: (row) => (
                      <div className="grn-post-actions">
                        {uPrivilege.canView && (
                          <button
                            className="icon-btn view-btn"
                            title="View GRN Details"
                            onClick={() => handleViewLine(row)}
                          >
                            <FaEye size={13} />
                          </button>
                        )}
                        {uPrivilege.canEdit && (
                          <button
                            className="icon-btn edit-btn"
                            title={
                              row.isPosted || detailsGrn.lines?.some((l) => l.isPosted)
                                ? 'Posted GRN cannot be edited'
                                : 'Edit GRN'
                            }
                            disabled={
                              row.isPosted ||
                              detailsGrn.lines?.some((l) => l.isPosted)
                            }
                            onClick={handleEditGrn}
                          >
                            <FaEdit size={13} />
                          </button>
                        )}
                        {uPrivilege.canDelete && (
                          <button
                            className="icon-btn delete-btn"
                            title="Delete"
                            disabled={row.isPosted}
                            onClick={() => handleDeleteLineClick(row)}
                          >
                            <FaTrash size={13} />
                          </button>
                        )}
                        {row.isPosted ? (
                          <button className="reprint-btn" onClick={() => handleReprintLine(row)}>
                            <FaPrint size={12} /> Reprint
                          </button>
                        ) : (
                          <button className="post-btn" onClick={() => handlePostLine(row)}>
                            <FaCheckCircle size={12} /> Post
                          </button>
                        )}
                      </div>
                    ),
                  },
                ]}
                data={detailsGrn.lines}
                keyField="id"
                selectableRows
                selectableRowsHighlight
                clearSelectedRows={toggleClearSelectedLines}
                onSelectedRowsChange={(state) => setSelectedLines(state.selectedRows)}
                pagination
                paginationPerPage={5}
                paginationRowsPerPageOptions={[5, 10, 25, 50]}
                persistTableHead
                striped
                responsive
                highlightOnHover
                noDataComponent={<div className="grn-post-empty">No items on this GRN</div>}
                customStyles={{
                  rows: { style: { minHeight: '38px' } },
                  headRow: { style: { backgroundColor: '#f1f4fa' } },
                  headCells: {
                    style: {
                      justifyContent: 'center',
                      fontSize: '11px',
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
                }}
              />

              {/* Totals — summed across ALL lines, not just the current
                  DataTable page. DataTable has no built-in tfoot, so this
                  is a small summary bar below it instead of an in-table
                  total row. */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 28,
                  padding: '12px 16px',
                  marginTop: 8,
                  background: '#f7f9fd',
                  border: '1px solid #dbe2ee',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span>Total Qty: <strong>{totalQuantity(detailsGrn)}</strong></span>
                <span>Total Pallet Qty: <strong>{totalPalletQuantity(detailsGrn)}</strong></span>
                <span>Total Value: <strong>₹{totalValue(detailsGrn).toFixed(2)}</strong></span>
              </div>
            </CModalBody>

            <CModalFooter>
              <CButton className="grn-modal-close-btn" onClick={() => setShowDetails(false)}>
                <FaTimes size={12} /> Close
              </CButton>
            </CModalFooter>
          </>
        )}
      </CModal>

      {/* ═══════════ GRN DETAILS (read-only, opened by the eye/View icon) ═══════════ */}
      <CModal
        visible={showLineDetails && !!viewLineTarget && !!detailsGrn}
        onClose={() => setShowLineDetails(false)}
        alignment="center"
        size="lg"
        scrollable
      >
        {viewLineTarget && detailsGrn && (
          <>
            <CModalHeader className="border-0">
              <CModalTitle>GRN Details</CModalTitle>
            </CModalHeader>

            <CModalBody>
              <div className="grn-modal-section-title">GRN Information</div>
              <div className="grn-info-grid">
                <div><span>GRN NUMBER</span><strong>{detailsGrn.grnNumber}</strong></div>
                <div><span>SUPPLIER NAME</span><strong>{detailsGrn.supplierName}</strong></div>
                <div><span>PO NUMBER</span><strong>{detailsGrn.poNumber}</strong></div>
                <div><span>PO DATE</span><strong>{formatDate(detailsGrn.poDate)}</strong></div>
                <div><span>INVOICE NUMBER</span><strong>{detailsGrn.supplierInvoiceNumber}</strong></div>
                <div><span>INVOICE DATE</span><strong>{formatDate(detailsGrn.supplierInvoiceDate)}</strong></div>
                <div><span>GRN TYPE</span><strong>{detailsGrn.grnType}</strong></div>
                <div>
                  <span>STATUS</span>
                  <strong>
                    <span className={`line-status-badge ${viewLineTarget.isPosted ? 'posted' : 'unposted'}`}>
                      {viewLineTarget.isPosted ? 'Posted' : 'Not Posted'}
                    </span>
                  </strong>
                </div>
              </div>

              <div className="grn-modal-section-title">GRN Items</div>

              <table className="grn-modal-items-table">
                <thead>
                  <tr>
                    <th>PART</th>
                    <th>PART DESCRIPTION</th>
                    <th>QUANTITY</th>
                    <th>PALLET QTY</th>
                    <th>RATE (₹)</th>
                    <th>TOTAL VALUE (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{viewLineTarget.partNumber}</td>
                    <td>{viewLineTarget.partName}</td>
                    <td>{viewLineTarget.quantity}</td>
                    <td>{viewLineTarget.palletQuantity ?? '—'}</td>
                    <td>{Number(viewLineTarget.rate).toFixed(2)}</td>
                    <td>{Number(viewLineTarget.totalValue).toFixed(2)}</td>
                  </tr>
                  <tr className="grn-modal-total-row">
                    <td colSpan={2}><strong>Total</strong></td>
                    <td><strong>{viewLineTarget.quantity}</strong></td>
                    <td>—</td>
                    <td></td>
                    <td><strong>{Number(viewLineTarget.totalValue).toFixed(2)}</strong></td>
                  </tr>
                </tbody>
              </table>

              {viewLineTarget.isPosted && (
                <div className="grn-info-grid" style={{ marginTop: 12 }}>
                  <div><span>PALLET NO.</span><strong>{viewLineTarget.palletNo || '—'}</strong></div>
                  <div><span>FIFO PALLET NO.</span><strong>{viewLineTarget.fifoPalletNo || '—'}</strong></div>
                  <div><span>POSTED DATE</span><strong>{formatDate(viewLineTarget.postedDate)}</strong></div>
                </div>
              )}
            </CModalBody>

            <CModalFooter className="d-flex justify-content-between">
              {viewLineTarget.isPosted ? (
                <CButton className="reprint-btn" onClick={handleOpenLabelFromDetails}>
                  <FaPrint size={12} /> View / Print Label
                </CButton>
              ) : (
                <span className="text-muted small">Post this item to generate a printable label</span>
              )}

              <CButton className="grn-modal-close-btn" onClick={() => setShowLineDetails(false)}>
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

      {/* ---------- FIFO GRN Label modal (single line) ---------- */}
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
              {/* Label size selector */}
              <div className="grn-label-size-row">
                <label className="grn-label-size-label">Label Size</label>
                <CFormSelect
                  value={labelSize}
                  onChange={(e) => setLabelSize(e.target.value)}
                  style={{ maxWidth: 260 }}
                >
                  {LABEL_SIZE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </CFormSelect>
              </div>

              {/* ★ Outer frame = exact physical label size (this is what gets
                  printed / captured for download). The card inside is always
                  drawn at the master design size and uniformly scaled +
                  centered to fit the frame, so the design never changes
                  shape — it only shrinks or grows. */}
              {!labelSize ? (
                <div className="fifo-select-size-message">
                  Please select a label size
                </div>
              ) : (
                <div className="fifo-print-preview-wrap">
                  <div
                    className="fifo-label-frame"
                    id="fifo-print-area"
                    style={{
                      width: `${activeSize.widthMm}mm`,
                      height: `${activeSize.heightMm}mm`,
                    }}
                  >
                    {renderFifoCard(labelGrn, firstLine, cardScale, cardOffsetXmm, cardOffsetYmm)}
                  </div>
                </div>
              )}
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

      {/* ═══════════ ★ NEW: BULK FIFO GRN Label modal (multiple lines) ═══════════ */}
      <CModal
        visible={showBulkLabel && !!bulkLabelGrn}
        onClose={() => setShowBulkLabel(false)}
        alignment="center"
        size="lg"
        scrollable
      >
        {bulkLabelGrn && (
          <>
            <CModalHeader>
              <div>
                <CModalTitle><FaLayerGroup size={16} /> BULK FIFO GRN LABELS</CModalTitle>
                <small className="text-muted">
                  {bulkLabelGrn.lines.length} label{bulkLabelGrn.lines.length === 1 ? '' : 's'} will be printed/downloaded
                </small>
              </div>
            </CModalHeader>

            <CModalBody>
              <div className="grn-label-size-row">
                <label className="grn-label-size-label">Label Size</label>
                <CFormSelect
                  value={bulkLabelSize}
                  onChange={(e) => setBulkLabelSize(e.target.value)}
                  style={{ maxWidth: 260 }}
                >
                  {LABEL_SIZE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </CFormSelect>
              </div>

              {!bulkLabelSize ? (
                <div className="fifo-select-size-message">
                  Please select a label size
                </div>
              ) : (
                <div
                  className="fifo-print-preview-wrap"
                  id="fifo-bulk-print-area"
                  style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}
                >
                  {bulkLabelGrn.lines.map((line) => (
                    <div
                      key={line.id}
                      className="fifo-label-frame fifo-bulk-label-frame"
                      id={`fifo-bulk-frame-${line.id}`}
                      style={{
                        width: `${bulkActiveSize.widthMm}mm`,
                        height: `${bulkActiveSize.heightMm}mm`,
                      }}
                    >
                      {renderFifoCard(bulkLabelGrn, line, bulkCardScale, bulkCardOffsetXmm, bulkCardOffsetYmm)}
                    </div>
                  ))}
                </div>
              )}
            </CModalBody>

            <CModalFooter>
              <CButton className="grn-modal-download-btn" onClick={handleDownloadBulkLabel} disabled={!bulkLabelSize}>
                <FaDownload size={12} /> Download All ({bulkLabelGrn.lines.length})
              </CButton>
              <CButton className="grn-modal-print-btn" onClick={handlePrintBulkLabel} disabled={!bulkLabelSize}>
                <FaPrint size={12} /> Print All FIFO GRN Labels
              </CButton>
            </CModalFooter>
          </>
        )}
      </CModal>
    </div>
  )
}

export default GRNPost
