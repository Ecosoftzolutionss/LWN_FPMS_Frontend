import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput } from '@coreui/react'
import { FaEye, FaTrash, FaWarehouse, FaCheckCircle, FaArrowLeft, FaTimes, FaSearch, FaSave } from 'react-icons/fa'
import { toast } from 'react-toastify'
import API from '../../api.js'
import '../../assets/CSS/storeMovement.css'
import usePrivilege from '../hooks/usePrivilege.js'

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.message || data.error) return data.message || data.error
  return fallback
}

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}


// Keep Store Movement slot numbering exactly the same as Location Master.
// LTR = Left to Right, RTL = Right to Left.
const STORAGE_DIRECTION_LTR = 'LTR'
const STORAGE_DIRECTION_RTL = 'RTL'

const normalizeStorageDirection = (value) =>
  String(value || '').toUpperCase() === STORAGE_DIRECTION_RTL
    ? STORAGE_DIRECTION_RTL
    : STORAGE_DIRECTION_LTR

const normalizeRowIndex = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  if (raw === 'G') return 0
  return Number(raw.replace(/^G/i, '').replace(/^R/i, '')) || 0
}

const getDefaultStorageDirection = (rowIndex) =>
  rowIndex % 2 === 0 ? STORAGE_DIRECTION_LTR : STORAGE_DIRECTION_RTL

// Same continuous numbering used by Location Master.
// Example with 4 columns and Fixture = 2:
// G  (LTR): A1 -> 1,2 | A2 -> 3,4 | A3 -> 5,6 | A4 -> 7,8
// G1 (RTL): A1 -> 16,15 | A2 -> 14,13 | A3 -> 12,11 | A4 -> 10,9
// G2 (LTR): A1 -> 17,18 | A2 -> 19,20 | ...
//
// Front and Rear use the same numeric sequence independently.
// The F/R suffix identifies the side.
const getDirectionalSlotNumbers = (columns, columnIndex, rowNo) => {
  if (!Array.isArray(columns) || columns.length === 0) return []

  const targetRowIndex = normalizeRowIndex(rowNo)

  const currentColumn = columns[columnIndex]
  const currentRow = currentColumn?.rows?.find(
    (r) => normalizeRowIndex(r.rowNo) === targetRowIndex,
  )

  const currentFixture = Math.max(1, Number(currentRow?.fixture) || 1)

  const rowNumbers = Array.from(
    new Set(
      columns.flatMap((col) =>
        (col.rows || []).map((row) => normalizeRowIndex(row.rowNo)),
      ),
    ),
  ).sort((a, b) => a - b)

  const getRowTotal = (rowIndex) =>
    columns.reduce((total, col) => {
      const row = (col.rows || []).find(
        (r) => normalizeRowIndex(r.rowNo) === rowIndex,
      )
      return total + Math.max(1, Number(row?.fixture) || 1)
    }, 0)

  const previousRowsOffset = rowNumbers
    .filter((index) => index < targetRowIndex)
    .reduce((total, index) => total + getRowTotal(index), 0)

  const previousColumnsOffset = columns
    .slice(0, columnIndex)
    .reduce((total, col) => {
      const row = (col.rows || []).find(
        (r) => normalizeRowIndex(r.rowNo) === targetRowIndex,
      )
      return total + Math.max(1, Number(row?.fixture) || 1)
    }, 0)

  const rowTotal = getRowTotal(targetRowIndex)

  // Location Master stores the configured direction on every row.
  // If an older API response does not contain it, use the same alternating
  // default used when a new rack is generated in Location Master.
  const directionValue =
    currentRow?.storageDirection ??
    currentRow?.StorageDirection ??
    getDefaultStorageDirection(targetRowIndex)

  const direction = normalizeStorageDirection(directionValue)

  if (direction === STORAGE_DIRECTION_RTL) {
    const startNumber =
      previousRowsOffset +
      rowTotal -
      previousColumnsOffset -
      currentFixture +
      1

    return Array.from(
      { length: currentFixture },
      (_, i) => startNumber + currentFixture - 1 - i,
    )
  }

  const startNumber = previousRowsOffset + previousColumnsOffset + 1

  return Array.from(
    { length: currentFixture },
    (_, i) => startNumber + i,
  )
}

const StoreMovement = () => {
  const [grns, setGrns] = useState([])
  const [search, setSearch] = useState('')

  const [detailsGrn, setDetailsGrn] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [activeGrn, setActiveGrn] = useState(null)
  const [pallets, setPallets] = useState([])
  const [rackStores, setRackStores] = useState([]) // real Store -> Rack -> Column -> Row -> Slots
  const [locationSearch, setLocationSearch] = useState('')

  const [activePallet, setActivePallet] = useState(null)
  const [side, setSide] = useState('Front')
  const [selectedSlot, setSelectedSlot] = useState(null) // current draft location
  const [movementQty, setMovementQty] = useState('')
  // Draft movements are kept in memory until the single Save button is clicked.
  // This allows multiple pallets and multiple locations to be prepared together.
  const [pendingMoves, setPendingMoves] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const { privileges: userPrivileges = [] } = usePrivilege()
  const uPrivilege = userPrivileges.find((p) => p.menuName === 'Store Movement') || {}

  const getCurrentUsername = () => {
    try {
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      return user?.username || ''
    } catch {
      return ''
    }
  }


  useEffect(() => {
    loadGrns()
  }, [])

  const loadGrns = async () => {
    try {
      const res = await API.get('/GrnEntry?posted=true')
      const postedGrns = res.data || []

      const availableGrns = await Promise.all(
        postedGrns.map(async (grn) => {
          try {
            const palletRes = await API.get(
              `/StoreMovement/grn/${grn.id}/pallets`
            )

            const pallets = palletRes.data || []

            // Show GRN only when at least one pallet
            // still has quantity pending for Store Movement.
            const hasRemainingPallet = pallets.some(
              (pallet) =>
                Number(pallet.quantity || 0) >
                Number(pallet.stuffedQty || 0)
            )

            return hasRemainingPallet ? grn : null
          } catch (err) {
            console.error(
              `Failed to check Store Movement status for GRN ${grn.id}`,
              err
            )

            // Do NOT show the GRN when its pallet status
            // could not be verified.
            return null
          }
        })
      )

      setGrns(availableGrns.filter(Boolean))
    } catch (err) {
      console.error('Failed to load GRN list', err)
      toast.error('Failed to load GRN list')
    }
  }

  const handleView = async (row) => {
    try {
      const res = await API.get(`/GrnEntry/${row.id}`)
      setDetailsGrn(res.data)
      setShowDetails(true)
    } catch {
      toast.error('Failed to load GRN details')
    }
  }

  const handleDeleteClick = (row) => {
    setDeleteTarget(row)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    try {
      await API.delete(`/GrnEntry/${deleteTarget.id}`)
      toast.success('Deleted Successfully')
      await loadGrns()
    } catch (err) {
      // Posted GRNs are intentionally locked against deletion on the
      // backend — this surfaces that real message rather than pretending
      // the delete succeeded.
      toast.error(getErrorMessage(err, 'Delete Failed'))
    } finally {
      setDeleteTarget(null)
    }
  }

  const loadPallets = async (grnId) => {
    try {
      const res = await API.get(`/StoreMovement/grn/${grnId}/pallets`)
      setPallets(res.data || [])
      setActivePallet((prev) => res.data.find((p) => p.id === prev?.id) || res.data[0] || null)
    } catch {
      toast.error('Failed to load pallets for this GRN')
    }
  }

  const loadRackSlots = async (itemId) => {
    try {
      const url = itemId
        ? `/StoreMovement/rack-slots?itemId=${itemId}`
        : '/StoreMovement/rack-slots'
      const res = await API.get(url)
      setRackStores(res.data || [])
    } catch {
      toast.error('Failed to load store locations')
    }
  }

  const openStore = async (grn) => {
    setActiveGrn(grn)
    setSelectedSlot(null)
    setMovementQty('')
    setPendingMoves([])
    setLocationSearch('')
    await loadPallets(grn.id)
  }

  // Re-filter locations when the chosen pallet changes. Pending drafts are
  // intentionally preserved so multiple pallets can be saved together.
  useEffect(() => {
    if (activePallet) {
      loadRackSlots(activePallet.itemId)
    }
  }, [activePallet?.id])

  const closeStore = () => {
    setActiveGrn(null)
    setPallets([])
    setActivePallet(null)
    setSelectedSlot(null)
    setMovementQty('')
    setPendingMoves([])
    setLocationSearch('')

    // Re-check completed GRNs whenever the workspace is closed.
    loadGrns()
  }

  const filteredGrns = grns.filter(
    (g) =>
      (g.grnNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.supplierInvoiceNumber || '').toLowerCase().includes(search.toLowerCase()),
  )

  const getPendingQtyForPallet = (palletId) =>
    pendingMoves
      .filter((move) => move.grnPalletId === palletId)
      .reduce((sum, move) => sum + Number(move.quantity || 0), 0)

  // Remaining quantity includes both already-saved quantity and quantities
  // staged in the current multi-save batch.
  const remainingQty = activePallet
    ? Number(activePallet.quantity || 0) -
      Number(activePallet.stuffedQty || 0) -
      getPendingQtyForPallet(activePallet.id)
    : 0

  const getPendingMoveForSlot = (rackRowId, slotNumber, slotSide) =>
    pendingMoves.find(
      (move) =>
        move.rackRowId === rackRowId &&
        move.slotNumber === slotNumber &&
        move.side === slotSide,
    )

  const isSlotOccupied = (row, slotNumber) =>
    row.occupiedSlots.some((o) => o.slotNumber === slotNumber && o.side === side) ||
    Boolean(getPendingMoveForSlot(row.id, slotNumber, side))

  const getOccupiedPalletNo = (row, slotNumber) => {
    const match = row.occupiedSlots.find((o) => o.slotNumber === slotNumber && o.side === side)
    if (match?.palletNo) return match.palletNo

    const pending = getPendingMoveForSlot(row.id, slotNumber, side)
    return pending ? `${pending.palletNo} (Pending)` : null
  }

  // Search the complete location hierarchy. Slot search uses the same
  // continuous/directional numbering as Location Master.
  // A matching parent keeps all of its children visible; otherwise only
  // matching racks/columns/rows/slots are shown.
  const normalizedLocationSearch = locationSearch.trim().toLowerCase()

  const filteredRackStores = rackStores
    .map((store) => {
      if (!normalizedLocationSearch) return store

      const storeMatches = [store.storeLocation, store.storeCode]
        .some((value) => String(value || '').toLowerCase().includes(normalizedLocationSearch))

      const racks = (store.racks || [])
        .map((rack) => {
          const rackMatches = String(rack.rackNo || '').toLowerCase().includes(normalizedLocationSearch)

          const rackColumns = rack.columns || []

          const columns = rackColumns
            .map((col, columnIndex) => {
              const columnMatches = String(col.columnNo || '').toLowerCase().includes(normalizedLocationSearch)

              const rows = (col.rows || [])
                .map((row) => {
                  const rowMatches = String(row.rowNo || '').toLowerCase().includes(normalizedLocationSearch)
                  const slotNumbers = getDirectionalSlotNumbers(rackColumns, columnIndex, row.rowNo)
                  const slotMatches = slotNumbers.some((slotNumber) =>
                    `${col.columnNo}-${row.rowNo}-${slotNumber}${side === 'Front' ? 'F' : 'R'}`
                      .toLowerCase()
                      .includes(normalizedLocationSearch),
                  )

                  return rowMatches || slotMatches || columnMatches || rackMatches || storeMatches
                    ? row
                    : null
                })
                .filter(Boolean)

              return columnMatches || rows.length > 0 ? { ...col, rows } : null
            })
            .filter(Boolean)

          return rackMatches || columns.length > 0 ? { ...rack, columns } : null
        })
        .filter(Boolean)

      return storeMatches || racks.length > 0 ? { ...store, racks } : null
    })
    .filter(Boolean)

  // Add the current location/quantity to the in-memory batch before moving
  // to another location or another pallet.
  const stageCurrentSelection = () => {
    if (!selectedSlot || !activePallet) return true

    const qty = Number(movementQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Enter a valid quantity before selecting another pallet/location')
      return false
    }

    const savedRemaining =
      Number(activePallet.quantity || 0) -
      Number(activePallet.stuffedQty || 0) -
      getPendingQtyForPallet(activePallet.id)

    if (qty > savedRemaining) {
      toast.error(`Only ${savedRemaining} remaining on pallet ${activePallet.palletNo}`)
      return false
    }

    const alreadyPending = pendingMoves.some(
      (move) =>
        move.rackRowId === selectedSlot.rackRowId &&
        move.slotNumber === selectedSlot.slotNumber &&
        move.side === selectedSlot.side,
    )

    if (alreadyPending) {
      toast.error('This location is already selected in the pending list')
      return false
    }

    setPendingMoves((prev) => [
      ...prev,
      {
        id: `${activePallet.id}-${selectedSlot.rackRowId}-${selectedSlot.slotNumber}-${selectedSlot.side}-${Date.now()}`,
        grnPalletId: activePallet.id,
        palletNo: activePallet.palletNo,
        rackRowId: selectedSlot.rackRowId,
        slotNumber: selectedSlot.slotNumber,
        side: selectedSlot.side,
        quantity: qty,
        locationCode: selectedSlot.locationCode,
      },
    ])

    setSelectedSlot(null)
    setMovementQty('')
    return true
  }

  const handlePalletSelect = (row) => {
    // Preserve the current pallet/location draft when the user changes pallet.
    if (!stageCurrentSelection()) return

    setActivePallet(row)
  }

  const handleSelectSlot = (rackRowId, slotNumber, columnNo, rowNo) => {
    if (!activePallet) {
      toast.error('Pick a pallet from the left first')
      return
    }

    if (remainingQty <= 0) {
      toast.error('No remaining quantity on this pallet')
      return
    }

    const pendingAtLocation = getPendingMoveForSlot(rackRowId, slotNumber, side)
    if (pendingAtLocation) {
      toast.error(`Location ${columnNo}-${rowNo}-${slotNumber}${side === 'Front' ? 'F' : 'R'} is already pending`)
      return
    }

    // If another location is currently being edited, stage it first. This
    // lets one pallet use multiple locations without pressing Save each time.
    const hadCurrentDraft = Boolean(selectedSlot)
    const currentDraftQty = hadCurrentDraft ? Number(movementQty) : 0

    if (selectedSlot) {
      if (!stageCurrentSelection()) return
    }

    setSelectedSlot({
      rackRowId,
      slotNumber,
      side,
      locationCode: `${columnNo}-${rowNo}-${slotNumber}${side === 'Front' ? 'F' : 'R'}`,
    })

    // Default to the quantity still available after earlier pending drafts
    // and the location draft that was just staged (if any).
    const palletRemainingAfterPending =
      Number(remainingQty) - (hadCurrentDraft ? currentDraftQty : 0)
    setMovementQty(String(Math.max(0, palletRemainingAfterPending)))
  }

  const handleSaveSlot = async () => {
    if (!activeGrn) {
      toast.error('GRN is not selected')
      return
    }

    // Build the current draft synchronously before changing React state.
    const currentQty = selectedSlot ? Number(movementQty) : 0
    const currentMove = selectedSlot && activePallet
      ? {
          id: `${activePallet.id}-${selectedSlot.rackRowId}-${selectedSlot.slotNumber}-${selectedSlot.side}-current`,
          grnPalletId: activePallet.id,
          palletNo: activePallet.palletNo,
          rackRowId: selectedSlot.rackRowId,
          slotNumber: selectedSlot.slotNumber,
          side: selectedSlot.side,
          quantity: currentQty,
          locationCode: selectedSlot.locationCode,
        }
      : null

    if (currentMove) {
      if (!Number.isFinite(currentQty) || currentQty <= 0) {
        toast.error('Enter a valid quantity before Save')
        return
      }

      const serverRemaining =
        Number(activePallet.quantity || 0) -
        Number(activePallet.stuffedQty || 0) -
        getPendingQtyForPallet(activePallet.id)

      if (currentQty > serverRemaining) {
        toast.error(`Only ${serverRemaining} remaining on pallet ${activePallet.palletNo}`)
        return
      }
    }

    const movesToSave = currentMove ? [...pendingMoves, currentMove] : [...pendingMoves]

    if (movesToSave.length === 0) {
      toast.error('Select at least one pallet and location before Save')
      return
    }

    // Validate quantity totals per pallet one final time.
    const totals = movesToSave.reduce((map, move) => {
      map[move.grnPalletId] = (map[move.grnPalletId] || 0) + Number(move.quantity || 0)
      return map
    }, {})

    for (const [palletId, totalQty] of Object.entries(totals)) {
      const pallet = pallets.find((p) => p.id === Number(palletId))
      if (!pallet) {
        toast.error(`Pallet ${palletId} is no longer available`)
        return
      }

      const serverRemaining =
        Number(pallet.quantity || 0) - Number(pallet.stuffedQty || 0)

      if (totalQty > serverRemaining) {
        toast.error(
          `Pallet ${pallet.palletNo}: only ${serverRemaining} remaining, but ${totalQty} selected`
        )
        return
      }
    }

    setIsSaving(true)

    try {
      // Save every staged pallet/location as a separate StoreMovement record.
      // Sequential calls avoid two requests racing for the same physical slot.
      const savedMoves = []

      for (const move of movesToSave) {
        await API.post('/StoreMovement/stuff-rack-slot', {
          grnPalletId: move.grnPalletId,
          rackRowId: move.rackRowId,
          slotNumber: move.slotNumber,
          side: move.side,
          quantity: Number(move.quantity),
          createdBy: getCurrentUsername(),
        })
        savedMoves.push(move)
      }

      toast.success(`${savedMoves.length} store movement${savedMoves.length > 1 ? 's' : ''} saved successfully`)

      setPendingMoves([])
      setSelectedSlot(null)
      setMovementQty('')

      const palletRes = await API.get(`/StoreMovement/grn/${activeGrn.id}/pallets`)
      const updatedPallets = palletRes.data || []
      setPallets(updatedPallets)

      const currentPalletId = activePallet?.id
      const updatedActivePallet =
        updatedPallets.find((p) => p.id === currentPalletId) ||
        updatedPallets[0] ||
        null

      setActivePallet(updatedActivePallet)

      if (updatedActivePallet) {
        await loadRackSlots(updatedActivePallet.itemId)
      }

      const hasRemainingPallet = updatedPallets.some(
        (pallet) =>
          Number(pallet.quantity || 0) >
          Number(pallet.stuffedQty || 0)
      )

      if (!hasRemainingPallet) {
        setGrns((prev) => prev.filter((grn) => grn.id !== activeGrn.id))
        toast.success(`${activeGrn.grnNumber} Store Movement completed`)
        setActiveGrn(null)
        setPallets([])
        setActivePallet(null)
        setSelectedSlot(null)
        setMovementQty('')
        setPendingMoves([])
        setLocationSearch('')
      } else {
        await loadGrns()
      }
    } catch (err) {
      // If one request fails, already-saved requests remain saved on the
      // server. Reloading here prevents the UI from showing stale slots.
      toast.error(getErrorMessage(err, 'One or more Store Movements could not be saved'))
      setPendingMoves([])
      setSelectedSlot(null)
      setMovementQty('')

      try {
        await loadPallets(activeGrn.id)
        if (activePallet) await loadRackSlots(activePallet.itemId)
      } catch {
        // The main error is already shown to the user.
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearSlot = () => {
    setSelectedSlot(null)
    setMovementQty('')
  }

  const removePendingMove = (moveId) => {
    setPendingMoves((prev) => prev.filter((move) => move.id !== moveId))
  }

  const handleUndo = async (movementId) => {
    try {
      await API.delete(`/StoreMovement/${movementId}`)
      toast.success('Movement Undone')
      await loadPallets(activeGrn.id)
      await loadRackSlots()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Undo Failed'))
    }
  }

  // ---------- LIST VIEW ----------
  if (!activeGrn) {
    return (
      <div className="store-movement-page">
        <div className="sm-toolbar">
          <div className="sm-search">
            <CFormInput placeholder="Search....." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="sm-table-card">
          <DataTable
            columns={[
              { name: 'S.NO', selector: (row, index) => index + 1, width: '70px' },
              { name: 'GRN NUMBER', selector: (row) => row.grnNumber },
              { name: 'SUPPLIER NAME', selector: (row) => row.supplierName, wrap: true },
              { name: 'INVOICE NUMBER', selector: (row) => row.supplierInvoiceNumber },
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
                  <div className="sm-actions">
                    {uPrivilege.canView && (
                      <button className="sm-icon-btn view" onClick={() => handleView(row)}><FaEye size={13} /></button>
                    )}
                    {uPrivilege.canDelete && (
                      <button className="sm-icon-btn delete" onClick={() => handleDeleteClick(row)}><FaTrash size={13} /></button>
                    )}
                    {uPrivilege.canEdit && (
                      <button className="sm-store-btn" onClick={() => openStore(row)}>
                        <FaWarehouse size={12} /> Store
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={filteredGrns}
            pagination
            persistTableHead
            striped
            responsive
            highlightOnHover
            noDataComponent={<div className="sm-empty">No posted GRNs to display</div>}
            customStyles={{
              rows: { style: { minHeight: '38px' } },
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
                  fontSize: '14px',
                },
              },
            }}
          />
        </div>

        {/* ---------- GRN Details modal ----------
            ★ FIX: the modal box itself now caps its height and only its
            body scrolls internally (overflowY: auto on sm-modal-body).
            Previously the modal had no max-height, so a long items list
            pushed the whole card taller than the viewport and the page
            itself had to be scrolled to reach the Close button — which
            looked like a stray scrollbar cutting the modal off, and the
            footer/close action was never reliably reachable. Header and
            footer are now flex-shrink: 0 so they always stay visible,
            pinned to the top and bottom of the modal. */}
        {showDetails && detailsGrn && (
          <div className="sm-modal-overlay" onClick={() => setShowDetails(false)}>
            <div
              className="sm-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '85vh',
                overflow: 'hidden',
              }}
            >
              <div className="sm-modal-header" style={{ flexShrink: 0 }}>
                <h3>GRN Details</h3>
                <button onClick={() => setShowDetails(false)}><FaTimes /></button>
              </div>

              <div
                className="sm-modal-body"
                style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}
              >
                <div className="sm-modal-section-title">GRN Information</div>

                <div className="sm-info-grid">
                  <div><span>GRN NUMBER</span><strong>{detailsGrn.grnNumber}</strong></div>
                  <div><span>SUPPLIER NAME</span><strong>{detailsGrn.supplierName}</strong></div>
                  <div><span>PO NUMBER</span><strong>{detailsGrn.poNumber}</strong></div>
                  <div><span>PO DATE</span><strong>{formatDate(detailsGrn.poDate)}</strong></div>
                  <div><span>INVOICE NUMBER</span><strong>{detailsGrn.supplierInvoiceNumber}</strong></div>
                  <div><span>INVOICE DATE</span><strong>{formatDate(detailsGrn.supplierInvoiceDate)}</strong></div>
                  <div><span>GRN TYPE</span><strong>{detailsGrn.grnType}</strong></div>
                </div>

                <div className="sm-modal-section-title">GRN Items</div>

                <DataTable
                  columns={[
                    { name: 'PART', selector: (row) => row.partNumber, minWidth: '90px' },
                    { name: 'PART DESCRIPTION', selector: (row) => row.partName, grow: 2, wrap: true },
                    { name: 'QUANTITY', selector: (row) => row.quantity, center: true, width: '100px' },
                    { name: 'PALLET QTY', selector: (row) => row.palletQuantity ?? '—', center: true, width: '110px' },
                    { name: 'RATE (₹)', selector: (row) => Number(row.rate).toFixed(2), center: true, width: '100px' },
                    { name: 'TOTAL VALUE (₹)', selector: (row) => Number(row.totalValue).toFixed(2), center: true, minWidth: '130px' },
                  ]}
                  data={detailsGrn.lines}
                  keyField="id"
                  pagination
                  paginationPerPage={5}
                  paginationRowsPerPageOptions={[5, 10, 25, 50]}
                  persistTableHead
                  striped
                  responsive
                  highlightOnHover
                  noDataComponent={<div className="sm-empty">No items on this GRN</div>}
                  customStyles={{
                    rows: { style: { minHeight: '48px' } },
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
              </div>

              <div className="sm-modal-footer" style={{ flexShrink: 0 }}>
                <CButton className="sm-modal-close-btn" onClick={() => setShowDetails(false)}>
                  <FaTimes size={12} /> Close
                </CButton>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Confirm Delete modal ---------- */}
        {deleteTarget && (
          <div className="sm-modal-overlay" onClick={() => setDeleteTarget(null)}>
            <div className="sm-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sm-confirm-title">⚠ Confirm Delete</div>
              <p>Are you sure you want to delete this GRN?</p>

              <div className="sm-confirm-id-box">
                <strong>GRN Number :</strong>{' '}
                <span className="sm-confirm-id-value">{deleteTarget.grnNumber}</span>
              </div>

              <div className="sm-confirm-actions">
                <CButton color="secondary" onClick={() => setDeleteTarget(null)}>Cancel</CButton>
                <CButton color="danger" onClick={confirmDelete}>Delete</CButton>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- STUFFING WORKSPACE ----------
  return (
    <div className="store-movement-page">
      <div className="sm-workspace">
        {/* LEFT: GRN Summary + Pallet Details */}
        <div className="sm-left-col">
          <div className="sm-card sm-summary-card">
            {/* Back button lives inside the card, top-right corner */}
            <button
              className="round-icon-btn back-btn card-back-btn"
              title="Back"
              onClick={closeStore}
            >
              <FaArrowLeft size={14} />
            </button>

            <div className="sm-card-title">GRN SUMMARY</div>

            <div className="sm-summary-grid">
              <div>
                <span>GRN NUMBER</span>
                <strong className="sm-link">{activeGrn.grnNumber}</strong>
              </div>
              <div>
                <span>TOTAL QUANTITY</span>
                <strong>{activeGrn.totalQuantity?.toLocaleString()}</strong>
              </div>
              <div>
                <span>PART</span>
                <strong>{activePallet?.partNumber} - {activePallet?.partName}</strong>
              </div>
              <div>
                <span>SELECTED QUANTITY</span>
                <strong>{activePallet?.stuffedQty ?? 0}</strong>
              </div>
              <div>
                <span>RATE</span>
                <strong>₹{Number(activePallet?.rate || 0).toFixed(2)}</strong>
              </div>
              <div>
                <span>REMAINING QUANTITY</span>
                <strong>{remainingQty}</strong>
              </div>
            </div>
          </div>

          <div className="sm-card">
            <div className="sm-card-title">PALLET DETAILS</div>

            <DataTable
              columns={[
                { name: 'PALLET NO', selector: (row) => row.palletNo, width: '110px' },
                { name: 'QUANTITY', selector: (row) => row.quantity, center: true, width: '100px' },
                { name: 'RATE (₹)', selector: (row) => Number(row.rate).toFixed(2), center: true, width: '100px' },
                { name: 'STUFFED QTY', selector: (row) => row.stuffedQty, center: true, width: '120px' },
                {
                  name: 'ACTION',
                  grow: 2,
                  cell: (row) =>
                    row.assignments.length > 0 ? (
                      row.assignments.map((a) => (
                        <span key={a.id} className="sm-assign-chip">
                          {a.storeLocation}-{a.positionCode}
                          <button onClick={(e) => { e.stopPropagation(); handleUndo(a.id) }}>×</button>
                        </span>
                      ))
                    ) : (
                      <span className="sm-no-assign">—</span>
                    ),
                },
              ]}
              data={pallets}
              keyField="id"
              pagination
              paginationPerPage={5}
              paginationRowsPerPageOptions={[5, 10, 25, 50]}
              persistTableHead
              striped
              responsive
              highlightOnHover
              pointerOnHover
              onRowClicked={handlePalletSelect}
              conditionalRowStyles={[
                {
                  // A pallet is available when it still has quantity remaining.
                  // Available pallets are highlighted in green for easy identification.
                  when: (row) =>
                    Number(row.quantity || 0) > Number(row.stuffedQty || 0) &&
                    activePallet?.id !== row.id,
                  style: {
                    backgroundColor: '#e8f7ed',
                    color: '#198754',
                    fontWeight: 600,
                  },
                },
                {
                  // Keep the currently selected pallet highlighted separately.
                  when: (row) => activePallet?.id === row.id,
                  style: {
                    backgroundColor: '#e3ecfd',
                  },
                },
              ]}
              noDataComponent={<div className="sm-empty">No pallets for this GRN yet</div>}
              customStyles={{
                rows: { style: { minHeight: '48px' } },
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
          </div>
        </div>

        {/* RIGHT: Select Pallet */}
        <div className="sm-right-col sm-card">
          <div className="sm-select-header">
            <div className="sm-select-header-info">
              <span className="sm-header-icon"><FaWarehouse size={14} /></span>
              <div>
                <span className="sm-header-label">GRN NO:</span>
                <strong>{activeGrn.grnNumber}</strong>
              </div>
              <div className="sm-header-divider" />
              <div>
                <span className="sm-header-label">PART:</span>
                <strong>{activePallet?.partNumber} - {activePallet?.partName}</strong>
              </div>
            </div>

            <div className="sm-side-toggle">
              <button
                className={side === 'Front' ? 'active' : ''}
                onClick={() => {
                  if (!stageCurrentSelection()) return
                  setSide('Front')
                }}
              >
                Front
              </button>
              <button
                className={side === 'Rear' ? 'active' : ''}
                onClick={() => {
                  if (!stageCurrentSelection()) return
                  setSide('Rear')
                }}
              >
                Rear
              </button>
            </div>
          </div>

          <div className="sm-location-toolbar">
            <div className="sm-location-search">
              <FaSearch size={12} />
              <CFormInput
                placeholder="Search store / rack / column / row / slot..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
              />
            </div>

            <div className="sm-location-actions">
              <CFormInput
                type="number"
                min="1"
                max={remainingQty > 0 ? remainingQty : undefined}
                value={movementQty}
                placeholder="Qty"
                disabled={!selectedSlot || !activePallet || remainingQty <= 0}
                onChange={(e) => setMovementQty(e.target.value)}
                style={{ width: '100px' }}
              />
              <CButton
                className="sm-location-save-btn"
                onClick={handleSaveSlot}
                disabled={isSaving || ((!selectedSlot || !movementQty) && pendingMoves.length === 0)}
              >
                <FaSave size={12} /> {isSaving ? 'Saving...' : `Save${pendingMoves.length > 0 ? ` (${pendingMoves.length + (selectedSlot ? 1 : 0)})` : ''}`}
              </CButton>
              <CButton
                className="sm-location-clear-btn"
                onClick={handleClearSlot}
                disabled={!selectedSlot}
              >
                <FaTimes size={12} /> Clear
              </CButton>
            </div>
          </div>

          {pendingMoves.length > 0 && (
            <div className="sm-selected-location" style={{ marginBottom: '6px' }}>
              <strong>{pendingMoves.length} pending movement{pendingMoves.length > 1 ? 's' : ''}</strong>
              <span> — will be saved together</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {pendingMoves.map((move) => (
                  <span key={move.id} className="sm-assign-chip">
                    {move.palletNo} → {move.locationCode} ({move.quantity})
                    <button
                      type="button"
                      onClick={() => removePendingMove(move.id)}
                      title="Remove pending movement"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedSlot && (
            <div className="sm-selected-location">
              Selected Location: <strong>{selectedSlot.locationCode}</strong>
              <span> — Qty {movementQty || 0}. Select another pallet/location or click Save.</span>
            </div>
          )}

          {rackStores.length === 0 ? (
            <div className="sm-empty-slots">No stores/racks configured yet in Location Master.</div>
          ) : (
            <div className="sm-rack-store-grid">
              {filteredRackStores.map((store) => (
                <div key={store.id} className="sm-rack-store-block">
                  <div className="sm-store-block-header">
                    <span><FaWarehouse size={12} /> {store.storeLocation} ({store.storeCode})</span>
                  </div>

                  {store.racks.length === 0 ? (
                    <div className="sm-empty-slots">No racks added for this store.</div>
                  ) : (
                    store.racks.map((rack) => (
                      <div key={rack.id} className="sm-rack-block">
                        <div className="sm-rack-block-title">Rack {rack.rackNo}</div>

                        <div className="sm-rack-columns">
                          {rack.columns.map((col, columnIndex) => (
                            <div key={col.id} className="sm-rack-column">
                              <div className="sm-rack-column-title">{col.columnNo}</div>

                              {[...col.rows].reverse().map((row) => {
                                const enabled = side === 'Front' ? row.hasFront : row.hasRear
                                if (!enabled) return null

                                const slotNumbers = getDirectionalSlotNumbers(rack.columns, columnIndex, row.rowNo)
                                const directionValue =
                                  row.storageDirection ??
                                  row.StorageDirection ??
                                  getDefaultStorageDirection(normalizeRowIndex(row.rowNo))
                                const direction = normalizeStorageDirection(directionValue)

                                return (
                                  <div key={row.id} className="sm-rack-row">
                                    <div className="sm-rack-row-label">
                                      <div>{row.rowNo}</div>
                                      <small
                                        style={{
                                          display: 'block',
                                          fontSize: 8,
                                          fontWeight: 600,
                                          marginTop: 2,
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {direction === STORAGE_DIRECTION_RTL ? '← RTL' : '→ LTR'}
                                      </small>
                                    </div>
                                    <div className="sm-rack-row-slots">
                                      {slotNumbers.map((slotNumber) => {
                                        const occupied = isSlotOccupied(row, slotNumber)
                                        const occupiedPalletNo = occupied ? getOccupiedPalletNo(row, slotNumber) : null
                                        const isSelected =
                                          selectedSlot?.rackRowId === row.id &&
                                          selectedSlot?.slotNumber === slotNumber &&
                                          selectedSlot?.side === side

                                        const tooltipText = occupied
                                          ? `Occupied — ${occupiedPalletNo || 'Unknown Pallet'}`
                                          : 'Available'

                                        return (
                                          <button
                                            key={slotNumber}
                                            type="button"
                                            className={`sm-slot-btn ${occupied ? 'occupied' : 'available'} ${isSelected ? 'selected' : ''}`}
                                            style={
                                              !occupied && !isSelected
                                                ? {
                                                    backgroundColor: '#dff5e5',
                                                    border: '1px solid #39a85b',
                                                    color: '#198754',
                                                    fontWeight: 600,
                                                  }
                                                : undefined
                                            }
                                            disabled={occupied}
                                            data-tooltip={tooltipText}
                                            data-tooltip-type={occupied ? 'occupied' : 'available'}
                                            onClick={() => handleSelectSlot(row.id, slotNumber, col.columnNo, row.rowNo)}
                                          >
                                            {isSelected && <FaCheckCircle size={10} />} {col.columnNo}-{row.rowNo}-{slotNumber}
                                            {side === 'Front' ? 'F' : 'R'}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}

          {!activePallet ? (
            <div className="sm-stuff-hint">Pick a pallet, select a location and quantity. Select more pallets/locations, then click one Save to save them all.</div>
          ) : selectedSlot ? (
            <div className="sm-stuff-hint">
              <strong>{activePallet.palletNo}</strong> ({remainingQty} units remaining after pending movements) is selected for <strong>{selectedSlot.locationCode}</strong>. Select another pallet/location to add it to the batch, then click one Save.
            </div>
          ) : (
            <div className="sm-stuff-hint">
              Select an available slot for <strong>{activePallet.palletNo}</strong> ({remainingQty} units). It will be kept as a pending movement until you click Save.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StoreMovement
