import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from 'react-data-table-component';
import { CButton, CFormInput, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react';
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

// =========================================================
// AUTO-FIT FONT HELPERS
// ---------------------------------------------------------
// Compact (50x25 / 100x50) sizes are now COMPUTED from the text length
// and the real column width (average bold glyph width ~0.6 x font size),
// so long values such as 1000000 or 24210-04087D always fit and are
// never cut off.
// =========================================================
const AVG_GLYPH = 0.6 // average bold Arial glyph width as a fraction of font size

const fitFontMm = (length, widthMm, maxMm, minMm = 1.4) => {
  const n = Math.max(Number(length) || 0, 1)
  const size = widthMm / (AVG_GLYPH * n)
  return Number(Math.max(minMm, Math.min(maxMm, size)).toFixed(2))
}

// Pallet value is shown on TWO lines:  TWEX-01  ->  "TWEX" / "01".
const splitPalletNo = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return ['—', '']

  const dash = text.lastIndexOf('-')
  if (dash > 0 && dash < text.length - 1) {
    return [text.slice(0, dash).trim(), text.slice(dash + 1).trim()]
  }

  const m = text.match(/^([A-Za-z]+)(\d+)$/)
  if (m) return [m[1], m[2]]

  return [text, '']
}

const longestPalletLine = (value) =>
  Math.max(...splitPalletNo(value).map((line) => line.length), 1)

const getPalletNoFontSize = (value) => {
  const n = longestPalletLine(value)

  if (n <= 4) return 44
  if (n <= 5) return 37
  if (n <= 6) return 31
  if (n <= 7) return 27
  if (n <= 8) return 23
  if (n <= 10) return 18
  if (n <= 12) return 15
  return 12
}

const getPalletNoScaleY = (value) => {
  const len = String(value ?? '').trim().length
  if (len <= 4) return 2.5
  if (len <= 5) return 2.3
  if (len <= 7) return 2.0
  if (len <= 9) return 1.75
  if (len <= 12) return 1.5
  if (len <= 15) return 1.3
  return 1.15
}

// Compact pallet number (mm): two lines in a ~13.4mm wide box.
const getCompactPalletNoFontSize = (value) => {
  const n = longestPalletLine(value)

  if (n <= 4) return 4.0
  if (n <= 5) return 3.4
  if (n <= 6) return 2.9
  if (n <= 7) return 2.6
  if (n <= 8) return 2.25
  if (n <= 10) return 1.8
  if (n <= 12) return 1.5
  return 1.2
}

const getPartNumberFontSize = (value, compact = false) => {
  const len = String(value ?? '').trim().length

  if (compact) {
    // part number now has the full row width; kept slightly condensed
    return fitFontMm(len, 26, 4.2, 1.6)
  }

  if (len <= 8) return 40
  if (len <= 10) return 37
  if (len <= 12) return 33
  if (len <= 14) return 30
  if (len <= 18) return 26
  return 22
}

const getPartNameFontSize = (value, compact = false) => {
  const len = String(value ?? '').trim().length

  if (compact) {
    // wraps onto up to 3 lines inside ~21mm
    if (len <= 14) return 2.3
    if (len <= 20) return 2.0
    if (len <= 28) return 1.8
    if (len <= 40) return 1.55
    return 1.3
  }

  if (len <= 20) return 32
  if (len <= 28) return 28
  if (len <= 48) return 23
  return 18
}

const getQtyFontSize = (value, compact = false) => {
  const digits = String(value ?? '').replace(/[^0-9]/g, '').length

  if (compact) {
    // qty column is 11mm wide (minus left shift) -> ~9.4mm for the digits
    return fitFontMm(digits, 9.4, 4.0, 1.4)
  }

  if (digits <= 2) return 50
  if (digits <= 3) return 42
  if (digits <= 4) return 34
  if (digits <= 5) return 30
  if (digits <= 6) return 26
  if (digits <= 7) return 22
  return 19
}

// The label sizes the user can pick before printing/downloading.
//   layout 'landscape' -> 150x100 master design, drawn 1:1
//   layout 'compact'   -> 50x25 geometry, drawn 1:1
//   layout 'compact2x' -> the same 50x25 card scaled exactly 2x = 100x50
const LABEL_SIZE_OPTIONS = [
  { value: '', label: 'Select Label Size', widthMm: 0, heightMm: 0, layout: '' },
  { value: '150x100', label: 'Size (150 x 100mm)', widthMm: 150, heightMm: 100, layout: 'landscape' },
  { value: '100x50', label: 'Size (100 x 50mm)', widthMm: 100, heightMm: 50, layout: 'compact2x' },
  { value: '50x25', label: 'Size (50 x 25mm)', widthMm: 50, heightMm: 25, layout: 'compact' },
]

const SIZE_CHIP_NOTES = {
  '150x100': 'Large · full details',
  '100x50': 'Medium · standard',
  '50x25': 'Small · compact',
}

const BASE_CARD_WIDTH_MM = 150
const BASE_CARD_HEIGHT_MM = 100

const computeCardTransform = (activeSize) => {
  if (!activeSize || !activeSize.widthMm) {
    return { scaleX: 0, scaleY: 0, offsetXmm: 0, offsetYmm: 0 }
  }

  if (
    activeSize.layout === 'portrait' ||
    activeSize.layout === 'compact' ||
    activeSize.layout === 'compact2x'
  ) {
    return { scaleX: 1, scaleY: 1, offsetXmm: 0, offsetYmm: 0 }
  }

  return {
    scaleX: activeSize.widthMm / BASE_CARD_WIDTH_MM,
    scaleY: activeSize.heightMm / BASE_CARD_HEIGHT_MM,
    offsetXmm: 0,
    offsetYmm: 0,
  }
}

// =========================================================
// PRINT HELPERS
// =========================================================

const waitForImages = async (doc) => {
  const images = Array.from(doc.images || [])
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()

      return new Promise((resolve) => {
        let finished = false
        const done = () => {
          if (finished) return
          finished = true
          resolve()
        }

        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', done, { once: true })
        setTimeout(done, 5000)
      })
    })
  )
}

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const inlineImagesInElement = async (root) => {
  if (!root) return

  const images = Array.from(root.querySelectorAll('img'))

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return

      try {
        const response = await fetch(src, {
          mode: 'cors',
          cache: 'force-cache',
        })

        if (!response.ok) throw new Error(`Image request failed: ${response.status}`)

        const blob = await response.blob()
        const dataUrl = await blobToDataUrl(blob)
        img.setAttribute('src', dataUrl)
        img.removeAttribute('crossorigin')
      } catch (error) {
        console.warn('Could not inline FIFO label image:', src, error)
      }
    })
  )
}

const waitForStylesheets = async (doc) => {
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
  await Promise.all(
    links.map((link) => {
      try {
        if (link.sheet && link.sheet.cssRules) return Promise.resolve()
      } catch {
        // still loading (or cross-origin)
      }
      return new Promise((resolve) => {
        link.addEventListener('load', resolve, { once: true })
        link.addEventListener('error', resolve, { once: true })
        setTimeout(resolve, 2000)
      })
    })
  )
}

const buildPrintHead = (title, extraStyle) => {
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => `<link rel="stylesheet" href="${link.href}">`)
    .join('')
  const styleTags = Array.from(document.querySelectorAll('style'))
    .map((style) => style.outerHTML)
    .join('')

  return `
    <meta charset="UTF-8" />
    <title>${title}</title>
    ${styleLinks}
    ${styleTags}
    <style>${extraStyle}</style>
    <style>
      /* Last <style> in <head>: protects the label from unrelated
         "@media print" rules copied from other features of the app. */
      html, body {
        visibility: visible !important;
        display: block !important;
        opacity: 1 !important;
      }
      .print-container, .bulk-print-page,
      .fifo-label-frame, .fifo-card, .fifo-card * {
        visibility: visible !important;
        opacity: 1 !important;
      }
    </style>
  `
}

const printHtmlDocument = (bodyHtml, headHtml) =>
  new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    const cleanup = () => {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }, 1000)
    }

    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(`<!DOCTYPE html><html><head>${headHtml}</head><body>${bodyHtml}</body></html>`)
    doc.close()

    const runPrint = async () => {
      try {
        await waitForStylesheets(doc)
        await waitForImages(doc)
        await new Promise((r) => setTimeout(r, 300))
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } catch (error) {
        console.error('Print error:', error)
        toast.error('Failed to print the FIFO GRN label')
      } finally {
        resolve()
        cleanup()
      }
    }

    if (doc.readyState === 'complete') {
      runPrint()
    } else {
      iframe.onload = runPrint
      setTimeout(runPrint, 2500)
    }
  })

// =========================================================
// SMALL UI PIECES (label modals)
// =========================================================

// Label size picker — big tappable chips instead of a plain dropdown.
const LabelSizePicker = ({ value, onChange }) => (
  <div className="grn-size-picker">
    <div className="grn-size-picker-title">Label Size</div>
    <div className="grn-size-chips">
      {LABEL_SIZE_OPTIONS.filter((s) => s.value).map((s) => (
        <button
          type="button"
          key={s.value}
          className={`grn-size-chip ${value === s.value ? 'active' : ''}`}
          onClick={() => onChange(s.value)}
        >
          <span className="grn-size-chip-main">{s.widthMm} × {s.heightMm} mm</span>
          <span className="grn-size-chip-sub">{SIZE_CHIP_NOTES[s.value]}</span>
        </button>
      ))}
    </div>
  </div>
)

const GRNPost = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState('unposted') // 'unposted' | 'reprint'
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')

  const [detailsGrn, setDetailsGrn] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  const [viewLineTarget, setViewLineTarget] = useState(null)
  const [showLineDetails, setShowLineDetails] = useState(false)

  const [labelGrn, setLabelGrn] = useState(null)
  const [showLabel, setShowLabel] = useState(false)

  const [labelSize, setLabelSize] = useState('')

  const [selectedLines, setSelectedLines] = useState([])
  const [toggleClearSelectedLines, setToggleClearSelectedLines] = useState(false)
  const [bulkPosting, setBulkPosting] = useState(false)

  const [bulkLabelGrn, setBulkLabelGrn] = useState(null)
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

  // Bulk GRN Post — posts every checked unposted line in one API call.
  const handleBulkPost = async () => {
    if (selectedLines.length === 0) {
      toast.warning('Please select at least one record')
      return
    }

    const alreadyPosted = selectedLines.filter((l) => l.isPosted)

    if (alreadyPosted.length > 0) {
      toast.warning(
        'Selected record(s) are already posted. Please select only unposted record(s).'
      )
      return
    }

    const targets = selectedLines.filter((l) => !l.isPosted)

    if (targets.length === 0) {
      toast.warning('Please select at least one unposted record')
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

      errorList.forEach((e) =>
        toast.error(e.message || 'Failed to post an item')
      )

      const refreshed = await API.get(`/GrnEntry/${detailsGrn.id}`)

      setDetailsGrn(refreshed.data)

      await loadRows()

      setSelectedLines([])
      setToggleClearSelectedLines((prev) => !prev)

      if (postedList.length > 0) {
        const postedIds = new Set(postedList.map((p) => p.id))

        const postedLines = refreshed.data.lines.filter(
          (l) => postedIds.has(l.id)
        )

        openBulkLabel(refreshed.data, postedLines)
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Bulk Post Failed'))
    } finally {
      setBulkPosting(false)
    }
  }

  // Bulk GRN Print — pure reprint of already-posted lines.
  const handleBulkPrint = () => {
    if (selectedLines.length === 0) {
      toast.warning('Please select at least one record')
      return
    }

    const unposted = selectedLines.filter((l) => !l.isPosted)

    if (unposted.length > 0) {
      toast.warning(
        'Selected record(s) are not posted yet. Please select only posted record(s) for printing.'
      )
      return
    }

    const targets = selectedLines.filter((l) => l.isPosted)

    if (targets.length === 0) {
      toast.warning('Please select at least one posted record')
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

  const handleViewLine = (line) => {
    setViewLineTarget(line)
    setShowLineDetails(true)
  }

  const handleEditGrn = () => {
    if (!detailsGrn) return

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

  const handleDownloadLabel = async () => {
    const node = document.getElementById('fifo-print-area')
    if (!node) {
      toast.error('Label not found — try reopening it')
      return
    }

    const size = LABEL_SIZE_OPTIONS.find((s) => s.value === labelSize) || LABEL_SIZE_OPTIONS[0]

    if (!size.widthMm) {
      toast.warning('Please select a label size')
      return
    }

    try {
      await inlineImagesInElement(node)

      const canvas = await html2canvas(node, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
      })

      const imgData = canvas.toDataURL('image/png')

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

  // Page-level print CSS (page size, centering, page breaks only —
  // ALL label geometry lives in grnPost.css).
  const buildSinglePrintCss = (size) => `
    @page {
      size: ${size.widthMm}mm ${size.heightMm}mm;
      margin: 0;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${size.widthMm}mm;
      height: ${size.heightMm}mm;
      background: #ffffff !important;
      overflow: hidden !important;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .print-container {
      width: ${size.widthMm}mm;
      height: ${size.heightMm}mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      position: relative;
      background: #ffffff;
    }
    .fifo-label-frame {
      width: ${size.widthMm}mm !important;
      height: ${size.heightMm}mm !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      position: relative !important;
      background: #ffffff !important;
    }
    .fifo-card {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    @media print {
      html, body {
        width: ${size.widthMm}mm !important;
        height: ${size.heightMm}mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      .print-container {
        width: ${size.widthMm}mm !important;
        height: ${size.heightMm}mm !important;
      }
    }
  `

  const buildBulkPrintCss = (size) => `
    @page {
      size: ${size.widthMm}mm ${size.heightMm}mm;
      margin: 0;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }
    body {
      width: ${size.widthMm}mm;
      margin: 0;
      padding: 0;
    }
    .bulk-print-page {
      width: ${size.widthMm}mm;
      height: ${size.heightMm}mm;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden;
      position: relative;
      page-break-after: always;
      break-after: page;
      background: #ffffff;
    }
    .bulk-print-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .fifo-label-frame {
      width: ${size.widthMm}mm !important;
      height: ${size.heightMm}mm !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      position: relative !important;
      background: #ffffff !important;
    }
    .fifo-card {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      .bulk-print-page {
        page-break-after: always;
        break-after: page;
      }
      .bulk-print-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }
  `

  // =========================================================
  // SINGLE LABEL PRINT
  // =========================================================
  const handlePrintLabel = async () => {
    if (!labelSize) {
      toast.warning('Please select a label size')
      return
    }

    const size = LABEL_SIZE_OPTIONS.find((s) => s.value === labelSize)

    if (!size || !size.widthMm || !size.heightMm) {
      toast.error('Invalid label size')
      return
    }

    const source = document.getElementById('fifo-print-area')

    if (!source) {
      toast.error('Label not found — please reopen the label')
      return
    }

    const clonedLabel = source.cloneNode(true)
    clonedLabel.removeAttribute('id')
    await inlineImagesInElement(clonedLabel)

    const headHtml = buildPrintHead('FIFO GRN Label', buildSinglePrintCss(size))

    await printHtmlDocument(`<div class="print-container">${clonedLabel.outerHTML}</div>`, headHtml)
  }

  // =========================================================
  // BULK LABEL PRINT
  // =========================================================
  const handlePrintBulkLabel = async () => {
    if (!bulkLabelSize) {
      toast.warning('Please select a label size')
      return
    }

    if (!bulkLabelGrn?.lines || bulkLabelGrn.lines.length === 0) {
      toast.warning('No labels available to print')
      return
    }

    const size = LABEL_SIZE_OPTIONS.find((s) => s.value === bulkLabelSize)

    if (!size || !size.widthMm || !size.heightMm) {
      toast.error('Invalid label size')
      return
    }

    const labelHtmlParts = await Promise.all(
      bulkLabelGrn.lines.map(async (line) => {
        const existing = document.getElementById(`fifo-bulk-frame-${line.id}`)
        if (!existing) return ''

        const cloned = existing.cloneNode(true)
        cloned.removeAttribute('id')
        await inlineImagesInElement(cloned)

        return `<div class="bulk-print-page">${cloned.outerHTML}</div>`
      })
    )

    const labelsHtml = labelHtmlParts.join('')

    const headHtml = buildPrintHead(
      `FIFO GRN Labels - ${bulkLabelGrn.grnNumber}`,
      buildBulkPrintCss(size),
    )

    await printHtmlDocument(labelsHtml, headHtml)
  }

  // Bulk download — one PDF page per selected line.
  const handleDownloadBulkLabel = async () => {
    if (!bulkLabelGrn?.lines?.length) {
      toast.error('No labels to download')
      return
    }

    const size = LABEL_SIZE_OPTIONS.find((s) => s.value === bulkLabelSize) || LABEL_SIZE_OPTIONS[0]

    if (!size.widthMm) {
      toast.warning('Please select a label size')
      return
    }

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

        await inlineImagesInElement(node)

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

  const activeSize = LABEL_SIZE_OPTIONS.find((s) => s.value === labelSize)
  const { scaleX: cardScaleX, scaleY: cardScaleY, offsetXmm: cardOffsetXmm, offsetYmm: cardOffsetYmm } = computeCardTransform(activeSize)

  const bulkActiveSize = LABEL_SIZE_OPTIONS.find((s) => s.value === bulkLabelSize)
  const { scaleX: bulkCardScaleX, scaleY: bulkCardScaleY, offsetXmm: bulkCardOffsetXmm, offsetYmm: bulkCardOffsetYmm } = computeCardTransform(bulkActiveSize)

  // Renders the FIFO card markup for one line. Shared by the single and
  // bulk modals so the design can never drift between the two.
  // layout: 'landscape' | 'portrait' | 'compact' | 'compact2x'
  const renderFifoCard = (grnMeta, line, scaleX, scaleY, offsetXmm, offsetYmm, layout = 'landscape') => {
    const compact = layout === 'compact' || layout === 'compact2x'
    const portrait = layout === 'portrait'

    const cardStyle = compact
      ? {
          width: '50mm',
          height: '25mm',
          // 100x50 = the 50x25 card scaled exactly 2x (same 2:1 shape)
          transform: layout === 'compact2x' ? 'scale(2)' : 'none',
          transformOrigin: 'top left',
          boxSizing: 'border-box',
        }
      : portrait
        ? {
            width: '100mm',
            height: '150mm',
            transform: 'none',
            transformOrigin: 'top left',
            boxSizing: 'border-box',
          }
        : {
            width: `${BASE_CARD_WIDTH_MM}mm`,
            height: `${BASE_CARD_HEIGHT_MM}mm`,
            transformOrigin: 'top left',
            transform: `translate(${offsetXmm}mm, ${offsetYmm}mm) scaleX(${scaleX}) scaleY(${scaleY})`,
          }

    const palletFont = compact
      ? `${getCompactPalletNoFontSize(line?.palletNo)}mm`
      : `${getPalletNoFontSize(line?.palletNo)}px`

    const qtyValue = line?.palletQuantity ?? line?.quantity ?? 0

    return (
      <div
        className={`fifo-card ${compact ? 'fifo-card-compact' : ''} ${portrait ? 'fifo-card-portrait' : ''}`}
        style={cardStyle}
      >
        <div className="fifo-card-header">
          <div className="fifo-logo-wrap">
            <img src="/GLOVIS.png" alt="Leewon" className="fifo-logo-img" crossOrigin="anonymous" />
            <span className="fifo-logo-text">LEEWON</span>
          </div>
          <div className="fifo-title-wrap">
            <span className="fifo-title">FIFO CARD</span>
          </div>
        </div>

        <div className="fifo-card-main">
          <div className="fifo-left-col">
            <div className="fifo-box">
              <div className="fifo-box-label">
                <span className="fifo-compact-label-text">
                  <span>FIFO</span>
                  <span>PALLET NO</span>
                </span>
              </div>
              <div className={`fifo-box-value ${compact ? 'fifo-compact-pallet-value' : ''}`}>
                <span
                  className="fifo-pallet-number-text"
                  style={{
                    fontSize: palletFont,
                    '--fifo-pallet-font-size': palletFont,
                    '--fifo-pallet-scale-y': `${getPalletNoScaleY(line?.palletNo)}`,
                    '--fifo-compact-pallet-font-size': compact ? palletFont : undefined,
                  }}
                >
                  {splitPalletNo(line?.palletNo).map((part, idx) =>
                    part ? (
                      <span key={idx} className="fifo-pallet-line">{part}</span>
                    ) : null,
                  )}
                </span>
              </div>
            </div>

            <div className="fifo-qr-box">
              <img
                className="fifo-qr-img"
                alt="Scan for details"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(
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
            </div>
          </div>

          <div className="fifo-right-col">
            <div className="fifo-meta-grid">
              <div><FaRegFileAlt className="fifo-meta-icon" /><span className="fifo-meta-label">SUP.INV.NO</span><span className="fifo-meta-colon">:</span><span className="fifo-meta-value">{grnMeta.supplierInvoiceNumber || '—'}</span></div>
              <div><FaRegCalendarAlt className="fifo-meta-icon" /><span className="fifo-meta-label">DATE</span><span className="fifo-meta-colon">:</span><span className="fifo-meta-value">{formatDate(grnMeta.supplierInvoiceDate) || '—'}</span></div>
              <div><FaBoxOpen className="fifo-meta-icon" /><span className="fifo-meta-label">QTY</span><span className="fifo-meta-colon">:</span><span className="fifo-meta-value">{grnMeta.totalQuantity ?? 0} Nos.</span></div>
              <div><FaRegFileAlt className="fifo-meta-icon" /><span className="fifo-meta-label">GRN NO</span><span className="fifo-meta-colon">:</span><span className="fifo-meta-value">{grnMeta.grnNumber || '—'}</span></div>
              <div><FaRegCalendarAlt className="fifo-meta-icon" /><span className="fifo-meta-label">DATE</span><span className="fifo-meta-colon">:</span><span className="fifo-meta-value">{formatDate(line?.postedDate) || '—'}</span></div>
              <div><FaBoxOpen className="fifo-meta-icon" /><span className="fifo-meta-label">PQTY</span><span className="fifo-meta-colon">:</span><span className="fifo-meta-value">{line?.palletQuantity ?? 0} Nos.</span></div>
            </div>

            <div className="fifo-part-row">
              <div className="fifo-part-label">PART NUMBER &amp; NAME</div>
              <div
                className="fifo-part-value"
                style={{
                  fontSize: compact
                    ? `${getPartNumberFontSize(line?.partNumber, true)}mm`
                    : `${getPartNumberFontSize(line?.partNumber, false)}px`,
                  '--fifo-part-number-font-size': `${getPartNumberFontSize(line?.partNumber, false)}px`,
                  '--fifo-compact-part-number-font-size': compact
                    ? `${getPartNumberFontSize(line?.partNumber, true)}mm`
                    : undefined,
                }}
              >
                {line?.partNumber || '—'}
              </div>

              <div className="fifo-part-bottom">
                <div
                  className="fifo-part-name"
                  style={{
                    fontSize: compact
                      ? `${getPartNameFontSize(line?.partName, true)}mm`
                      : `${getPartNameFontSize(line?.partName, false)}px`,
                    '--fifo-compact-part-name-font-size': compact
                      ? `${getPartNameFontSize(line?.partName, true)}mm`
                      : undefined,
                  }}
                >
                  {line?.partName?.toUpperCase() || '—'}
                </div>

                <div className="fifo-pallet-qty">
                  <div className="fifo-part-label">PALLET QTY (Nos.)</div>
                  <div
                    className="fifo-qty-value"
                    style={{
                      fontSize: compact
                        ? `${getQtyFontSize(qtyValue, true)}mm`
                        : `${getQtyFontSize(qtyValue, false)}px`,
                      '--fifo-qty-font-size': compact
                        ? `${getQtyFontSize(qtyValue, true)}mm`
                        : `${getQtyFontSize(qtyValue, false)}px`,
                      '--fifo-compact-qty-font-size': compact
                        ? `${getQtyFontSize(qtyValue, true)}mm`
                        : undefined,
                    }}
                  >
                    {qtyValue}
                  </div>
                </div>
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
  }

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

                <div className="grn-bulk-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {selectedLines.length > 0 && (
                    <span className="text-muted small">{selectedLines.length} selected</span>
                  )}
                  <button
                    className="post-btn"
                    disabled={bulkPosting}
                    onClick={handleBulkPost}
                    title="Bulk Post selected records"
                  >
                    <FaLayerGroup size={12} />
                    {bulkPosting
                      ? 'Posting…'
                      : `Bulk Post (${selectedLines.length})`}
                  </button>
                  <button
                    className="reprint-btn"
                    disabled={false}
                    onClick={handleBulkPrint}
                    title="Print/download labels for selected records"
                  >
                    <FaPrint size={12} />
                    {`Bulk Print (${selectedLines.length})`}
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

                        {/* VIEW — posted and unposted */}
                        {uPrivilege.canView && (
                          <button
                            className="icon-btn view-btn"
                            title="View GRN Details"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewLine(row)
                            }}
                          >
                            <FaEye size={13} />
                          </button>
                        )}

                        {/* UNPOSTED ONLY — Edit + Delete + Post */}
                        {!row.isPosted && (
                          <>
                            {uPrivilege.canEdit && (
                              <button
                                className="icon-btn edit-btn"
                                title="Edit GRN"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditGrn()
                                }}
                              >
                                <FaEdit size={13} />
                              </button>
                            )}

                            {uPrivilege.canDelete && (
                              <button
                                className="icon-btn delete-btn"
                                title="Delete"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteLineClick(row)
                                }}
                              >
                                <FaTrash size={13} />
                              </button>
                            )}

                            <button
                              className="post-btn"
                              title="Post GRN"
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePostLine(row)
                              }}
                            >
                              <FaCheckCircle size={12} />
                              Post
                            </button>
                          </>
                        )}

                        {/* POSTED ONLY — Reprint */}
                        {row.isPosted && (
                          <button
                            className="reprint-btn"
                            title="Reprint FIFO Label"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReprintLine(row)
                            }}
                          >
                            <FaPrint size={12} />
                            Reprint
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
                <small className="text-muted">Choose a label size, review the preview, then print or download</small>
              </div>
            </CModalHeader>

            <CModalBody>
              <div className="grn-label-summary">
                <span>GRN: <strong>{labelGrn.grnNumber || '—'}</strong></span>
                <span>Part: <strong>{firstLine?.partNumber || '—'}</strong></span>
                <span>Pallet: <strong>{firstLine?.palletNo || '—'}</strong></span>
                <span>Pallet Qty: <strong>{firstLine?.palletQuantity ?? firstLine?.quantity ?? 0}</strong></span>
              </div>

              <LabelSizePicker value={labelSize} onChange={setLabelSize} />

              {!labelSize ? (
                <div className="fifo-select-size-message">
                  Please select a label size to see the preview
                </div>
              ) : (
                <>
                  <div className="fifo-print-preview-wrap">
                    <div
                      className={`fifo-label-frame ${labelSize === '100x75' ? 'fifo-label-frame-100x75' : ''}`}
                      id="fifo-print-area"
                      style={{
                        width: `${activeSize.widthMm}mm`,
                        height: `${activeSize.heightMm}mm`,
                      }}
                    >
                      {renderFifoCard(
                        labelGrn,
                        firstLine,
                        cardScaleX,
                        cardScaleY,
                        cardOffsetXmm,
                        cardOffsetYmm,
                        activeSize.layout,
                      )}
                    </div>
                  </div>
                  <p className="grn-label-hint">
                    Preview is shown at the real print size ({activeSize.widthMm} × {activeSize.heightMm} mm).
                  </p>
                </>
              )}
            </CModalBody>

            <CModalFooter>
              <CButton className="grn-modal-close-btn" onClick={() => setShowLabel(false)}>
                <FaTimes size={12} /> Close
              </CButton>
              <CButton className="grn-modal-download-btn" onClick={handleDownloadLabel} disabled={!labelSize}>
                <FaDownload size={12} /> Download
              </CButton>
              <CButton className="grn-modal-print-btn" onClick={handlePrintLabel} disabled={!labelSize}>
                <FaPrint size={12} /> Print FIFO GRN Label
              </CButton>
            </CModalFooter>
          </>
        )}
      </CModal>

      {/* ═══════════ BULK FIFO GRN Label modal (multiple lines) ═══════════ */}
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
              <div className="grn-label-summary">
                <span>GRN: <strong>{bulkLabelGrn.grnNumber || '—'}</strong></span>
                <span>Labels: <strong>{bulkLabelGrn.lines.length}</strong></span>
              </div>

              <LabelSizePicker value={bulkLabelSize} onChange={setBulkLabelSize} />

              {!bulkLabelSize ? (
                <div className="fifo-select-size-message">
                  Please select a label size to see the preview
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
                      className={`fifo-label-frame fifo-bulk-label-frame ${bulkLabelSize === '100x75' ? 'fifo-bulk-label-frame-100x75' : ''}`}
                      id={`fifo-bulk-frame-${line.id}`}
                      style={{
                        width: `${bulkActiveSize.widthMm}mm`,
                        height: `${bulkActiveSize.heightMm}mm`,
                      }}
                    >
                      {renderFifoCard(
                        bulkLabelGrn,
                        line,
                        bulkCardScaleX,
                        bulkCardScaleY,
                        bulkCardOffsetXmm,
                        bulkCardOffsetYmm,
                        bulkActiveSize.layout,
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CModalBody>

            <CModalFooter>
              <CButton className="grn-modal-close-btn" onClick={() => setShowBulkLabel(false)}>
                <FaTimes size={12} /> Close
              </CButton>
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
