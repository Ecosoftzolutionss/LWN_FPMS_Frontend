import React, { useEffect, useRef, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput } from '@coreui/react'
import {
  FaEye,
  FaTrash,
  FaWarehouse,
  FaCheckCircle,
  FaArrowLeft,
  FaTimes,
  FaSearch,
  FaSave,
  FaMagic,
  FaBell,
  FaArrowUp,
} from 'react-icons/fa'
import { toast } from 'react-toastify'
import API from '../../api.js'
import '../../assets/CSS/storeMovement.css'
import usePrivilege from '../hooks/usePrivilege.js'

const GROUND_POLL_MS = 30000

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

  return Array.from({ length: currentFixture }, (_, i) => startNumber + i)
}

// All slots of one side for ONE part, in the real storage order of each rack.
// Slot numbers already follow the zig-zag path, so sorting by slot number
// gives the physical fill order. Pure function so it can be used for the
// selected pallet (workspace) and for ground pallets (any part).
const buildOrderedSlotsFrom = (stores, itemId, sideName) => {
  const list = []
  ;(stores || []).forEach((store) => {
    // never use a store that is configured for a different part
    if (
      itemId &&
      store.partNumberId &&
      Number(store.partNumberId) !== Number(itemId)
    )
      return
    ;(store.racks || []).forEach((rack) => {
      const cols = rack.columns || []
      const rackSlots = []
      cols.forEach((col, columnIndex) => {
        ;(col.rows || []).forEach((row) => {
          const enabled = sideName === 'Front' ? row.hasFront : row.hasRear
          if (!enabled) return
          getDirectionalSlotNumbers(cols, columnIndex, row.rowNo).forEach((slotNumber) => {
            rackSlots.push({
              row,
              slotNumber,
              side: sideName,
              locationCode: `${col.columnNo}-${row.rowNo}-${slotNumber}${sideName === 'Front' ? 'F' : 'R'}`,
            })
          })
        })
      })
      rackSlots.sort((a, b) => a.slotNumber - b.slotNumber)
      list.push(...rackSlots)
    })
  })
  return list
}

const isServerSlotFree = (slot) =>
  !(slot.row.occupiedSlots || []).some(
    (o) => o.slotNumber === slot.slotNumber && o.side === slot.side,
  )

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
  const [pendingMoves, setPendingMoves] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  // Auto mode: clicking a slot (or pressing "Auto Select") assigns ALL remaining
  // pallets of the part to the next free slots automatically.
  const [autoMode, setAutoMode] = useState(true)

  // ---------- GROUND STORAGE ----------
  // Pallets kept on the ground because every rack location of the part was full.
  // The backend returns them in FIFO order with `canMoveNow` set when a rack
  // slot has become free for them.
  const [groundPallets, setGroundPallets] = useState([])
  const [isGroundBusy, setIsGroundBusy] = useState(false)
  const [showGroundConfirm, setShowGroundConfirm] = useState(false)
  const [groundConfirmQueue, setGroundConfirmQueue] = useState([])
  const notifiedGroundRef = useRef(new Set())

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

  // ---------- GROUND LOADING + FIFO NOTIFICATION ----------
  const loadGroundPallets = async (silent = true) => {
    try {
      const res = await API.get('/StoreMovement/ground-pallets')
      const list = res.data || []
      setGroundPallets(list)

      const movableIds = new Set(list.filter((g) => g.canMoveNow).map((g) => g.movementId))

      // forget pallets that are no longer movable so they can notify again later
      notifiedGroundRef.current.forEach((id) => {
        if (!movableIds.has(id)) notifiedGroundRef.current.delete(id)
      })

      // notify once for every newly movable pallet (oldest FIFO first)
      list
        .filter((g) => g.canMoveNow && !notifiedGroundRef.current.has(g.movementId))
        .forEach((g) => {
          notifiedGroundRef.current.add(g.movementId)
          toast.info(
            `Location available! Ground pallet ${g.palletNo} (${g.partLabel}) can now be stored in the rack - FIFO #${g.fifoRank}.`,
            { autoClose: 10000 },
          )
        })
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err, 'Failed to load ground pallets'))
    }
  }

  useEffect(() => {
    loadGrns()
    loadGroundPallets()

    // Re-check regularly so the user is told as soon as a location becomes free
    // (for example after Material Issue frees a slot).
    const timer = setInterval(() => loadGroundPallets(), GROUND_POLL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadGrns = async () => {
    try {
      const res = await API.get('/GrnEntry?posted=true')
      const postedGrns = res.data || []

      const availableGrns = await Promise.all(
        postedGrns.map(async (grn) => {
          try {
            const palletRes = await API.get(`/StoreMovement/grn/${grn.id}/pallets`)
            const list = palletRes.data || []

            // Show GRN only when at least one pallet still has quantity
            // pending for Store Movement (ground quantity counts as stored).
            const hasRemainingPallet = list.some(
              (pallet) => Number(pallet.quantity || 0) > Number(pallet.stuffedQty || 0),
            )

            return hasRemainingPallet ? grn : null
          } catch (err) {
            console.error(`Failed to check Store Movement status for GRN ${grn.id}`, err)
            return null
          }
        }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePallet?.id])

  const closeStore = () => {
    setActiveGrn(null)
    setPallets([])
    setActivePallet(null)
    setSelectedSlot(null)
    setMovementQty('')
    setPendingMoves([])
    setLocationSearch('')

    // Re-check completed GRNs and ground pallets whenever the workspace is closed.
    loadGrns()
    loadGroundPallets()
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

  // Search the complete location hierarchy.
  const normalizedLocationSearch = locationSearch.trim().toLowerCase()

  const filteredRackStores = rackStores
    .map((store) => {
      if (!normalizedLocationSearch) return store

      const storeMatches = [store.storeLocation, store.storeCode].some((value) =>
        String(value || '').toLowerCase().includes(normalizedLocationSearch),
      )

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

  // ---------- FREE SLOT INFO (saved data only, pending drafts ignored) ----------
  const serverFreeSlots = activePallet
    ? ['Front', 'Rear'].reduce(
        (total, sideName) =>
          total +
          buildOrderedSlotsFrom(rackStores, activePallet.itemId, sideName).filter(isServerSlotFree).length,
        0,
      )
    : 0

  const rackIsFull =
    Boolean(activePallet) && rackStores.length > 0 && serverFreeSlots === 0 && pendingMoves.length === 0

  // ---------- AUTO SELECT ----------
  const buildOrderedSlots = (sideName) =>
    buildOrderedSlotsFrom(rackStores, activePallet?.itemId, sideName)

  // Assign every pallet that still has quantity (same part, FIFO / pallet-number order)
  // to the next free slots. Result is staged as pending movements - the user still
  // clicks Save.
  const autoAssign = (start) => {
    if (!activePallet) {
      toast.error('Pick a pallet from the left first')
      return
    }

    const queue = pallets
      .filter((p) => p.itemId === activePallet.itemId)
      .map((p) => ({
        pallet: p,
        qty: Number(p.quantity || 0) - Number(p.stuffedQty || 0) - getPendingQtyForPallet(p.id),
      }))
      .filter((x) => x.qty > 0)

    if (queue.length === 0) {
      toast.error('No pallet with remaining quantity')
      return
    }

    const taken = new Set(pendingMoves.map((m) => `${m.rackRowId}|${m.slotNumber}|${m.side}`))

    // ---- ZIG-ZAG FILL (G: left->right, G1: right->left, G2: left->right ...) ----
    // One continuous path = every slot of the selected side in zig-zag order,
    // then every slot of the other side. Pallets continue AFTER the last stored
    // location and complete the whole path; only when the end is reached does
    // it go back to the first location (where earlier freed slots are reused).
    const sideOrder = side === 'Front' ? ['Front', 'Rear'] : ['Rear', 'Front']
    const fullPath = sideOrder.flatMap((sideName) => buildOrderedSlots(sideName))

    const getOccupiedId = (slot) =>
      (slot.row.occupiedSlots || []).find(
        (o) => o.slotNumber === slot.slotNumber && o.side === slot.side,
      )?.id

    let startIdx = 0
    if (start) {
      // user clicked a slot: start exactly there
      const clickedSide = start.side || side
      const idx = fullPath.findIndex(
        (x) =>
          x.row.id === start.rackRowId &&
          x.slotNumber === start.slotNumber &&
          x.side === clickedSide,
      )
      startIdx = idx > 0 ? idx : 0
    } else {
      // continue after the most recently stored location (highest movement id)
      let lastIdx = -1
      let lastId = -1
      fullPath.forEach((slot, i) => {
        const id = getOccupiedId(slot)
        if (id !== undefined && id !== null && Number(id) > lastId) {
          lastId = Number(id)
          lastIdx = i
        }
      })
      startIdx = lastIdx >= 0 ? (lastIdx + 1) % fullPath.length : 0
    }

    const orderedPath = [...fullPath.slice(startIdx), ...fullPath.slice(0, startIdx)]

    const freeSlots = orderedPath.filter(
      (c) => isServerSlotFree(c) && !taken.has(`${c.row.id}|${c.slotNumber}|${c.side}`),
    )

    const totalFree = freeSlots.length
    if (totalFree === 0) {
      toast.warning('All rack locations are full. Use "Store on Ground" to keep the pallets on the ground.')
      return
    }

    const stamp = Date.now()
    const moves = []
    queue.forEach(({ pallet, qty }, i) => {
      const slot = freeSlots[i]
      if (!slot) return
      moves.push({
        id: `${pallet.id}-${slot.row.id}-${slot.slotNumber}-${slot.side}-${stamp}-${i}`,
        grnPalletId: pallet.id,
        palletNo: pallet.palletNo,
        rackRowId: slot.row.id,
        slotNumber: slot.slotNumber,
        side: slot.side,
        quantity: qty,
        locationCode: slot.locationCode,
      })
    })

    setPendingMoves((prev) => [...prev, ...moves])
    setSelectedSlot(null)
    setMovementQty('')

    if (queue.length > moves.length) {
      toast.warning(
        `${moves.length} of ${queue.length} pallets assigned. Rack is full for the rest - Save, then use "Store on Ground" for the remaining pallets.`,
      )
    } else {
      toast.success(`${moves.length} pallet${moves.length > 1 ? 's' : ''} assigned automatically. Click Save.`)
    }
  }

  // ---------- STORE ON GROUND ----------
  // Used only when the rack is full. All remaining pallets of the part are kept
  // on the ground (FIFO / pallet-number order). They are listed in the
  // "Pallets on Ground" panel and the user is notified when a rack slot is free.
  // Open an in-page confirmation dialog instead of the browser's window.confirm().
  const storeOnGround = () => {
    if (!activePallet) {
      toast.error('Please select a pallet first.')
      return
    }

    if (pendingMoves.length > 0 || selectedSlot) {
      toast.error('Please save or clear the pending rack movements before storing pallets on the ground.')
      return
    }

    const queue = pallets
      .filter((p) => Number(p.itemId) === Number(activePallet.itemId))
      .map((p) => ({
        pallet: p,
        qty: Number(p.quantity || 0) - Number(p.stuffedQty || 0),
      }))
      .filter((x) => x.qty > 0)

    if (queue.length === 0) {
      toast.info('There are no remaining pallets to store on the ground.')
      return
    }

    setGroundConfirmQueue(queue)
    setShowGroundConfirm(true)
  }

  const confirmStoreOnGround = async () => {
    if (groundConfirmQueue.length === 0 || isGroundBusy) return

    setIsGroundBusy(true)
    try {
      let saved = 0
      for (const { pallet, qty } of groundConfirmQueue) {
        await API.post('/StoreMovement/store-ground', {
          grnPalletId: pallet.id,
          quantity: Number(qty),
          createdBy: getCurrentUsername(),
        })
        saved++
      }

      setShowGroundConfirm(false)
      setGroundConfirmQueue([])
      toast.success(`${saved} pallet${saved === 1 ? '' : 's'} stored on the ground successfully.`)
      await afterGroundChange()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to store the pallets on the ground. Please try again.'))
      await afterGroundChange()
    } finally {
      setIsGroundBusy(false)
    }
  }

  // Refresh GRN workspace / lists after a ground change.
  const afterGroundChange = async () => {
    await loadGroundPallets()

    if (activeGrn) {
      const palletRes = await API.get(`/StoreMovement/grn/${activeGrn.id}/pallets`)
      const updatedPallets = palletRes.data || []
      setPallets(updatedPallets)

      const updatedActive =
        updatedPallets.find((p) => p.id === activePallet?.id) || updatedPallets[0] || null
      setActivePallet(updatedActive)

      if (updatedActive) await loadRackSlots(updatedActive.itemId)

      const hasRemaining = updatedPallets.some(
        (p) => Number(p.quantity || 0) > Number(p.stuffedQty || 0),
      )

      if (!hasRemaining) {
        toast.success(`${activeGrn.grnNumber} Store Movement completed`)
        setActiveGrn(null)
        setPallets([])
        setActivePallet(null)
        setSelectedSlot(null)
        setMovementQty('')
        setPendingMoves([])
        setLocationSearch('')
      }
    }

    await loadGrns()
  }

  // Move a ground pallet into the first free rack slot (FIFO is checked again
  // by the server). Works from the list view and from the workspace.
  const moveGroundToRack = async (g) => {
    setIsGroundBusy(true)
    try {
      const res = await API.get(`/StoreMovement/rack-slots?itemId=${g.itemId}`)
      const stores = res.data || []

      const candidates = ['Front', 'Rear']
        .flatMap((sideName) => buildOrderedSlotsFrom(stores, g.itemId, sideName))
        .filter(isServerSlotFree)

      // prefer Front, then Rear, each in physical storage order
      const slot = candidates[0]

      if (!slot) {
        toast.warning('No free rack location yet for this pallet')
        await loadGroundPallets()
        return
      }

      await API.post('/StoreMovement/move-ground-to-rack', {
        groundMovementId: g.movementId,
        rackRowId: slot.row.id,
        slotNumber: slot.slotNumber,
        side: slot.side,
      })

      toast.success(`Pallet ${g.palletNo} moved to ${slot.locationCode}`)
      await loadGroundPallets()

      if (activeGrn && activePallet) await loadRackSlots(activePallet.itemId)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Move to rack failed'))
      await loadGroundPallets()
    } finally {
      setIsGroundBusy(false)
    }
  }

  const handlePalletSelect = (row) => {
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

    if (autoMode) {
      autoAssign({ rackRowId, slotNumber })
      return
    }

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

    const palletRemainingAfterPending =
      Number(remainingQty) - (hadCurrentDraft ? currentDraftQty : 0)
    setMovementQty(String(Math.max(0, palletRemainingAfterPending)))
  }

  const handleSaveSlot = async () => {
    if (!activeGrn) {
      toast.error('GRN is not selected')
      return
    }

    const currentQty = selectedSlot ? Number(movementQty) : 0
    const currentMove =
      selectedSlot && activePallet
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

      const serverRemaining = Number(pallet.quantity || 0) - Number(pallet.stuffedQty || 0)

      if (totalQty > serverRemaining) {
        toast.error(
          `Pallet ${pallet.palletNo}: only ${serverRemaining} remaining, but ${totalQty} selected`,
        )
        return
      }
    }

    setIsSaving(true)

    try {
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
        updatedPallets.find((p) => p.id === currentPalletId) || updatedPallets[0] || null

      setActivePallet(updatedActivePallet)

      if (updatedActivePallet) {
        await loadRackSlots(updatedActivePallet.itemId)
      }

      const hasRemainingPallet = updatedPallets.some(
        (pallet) => Number(pallet.quantity || 0) > Number(pallet.stuffedQty || 0),
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

      await loadGroundPallets()
    } catch (err) {
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

  // Clear the current draft AND every pending movement created by
  // Auto Select / manual selection (nothing is saved to the server yet).
  const handleClearSlot = () => {
    setSelectedSlot(null)
    setMovementQty('')
    setPendingMoves([])
  }

  const removePendingMove = (moveId) => {
    setPendingMoves((prev) => prev.filter((move) => move.id !== moveId))
  }

  const handleUndo = async (movementId) => {
    try {
      await API.delete(`/StoreMovement/${movementId}`)
      toast.success('Movement Undone')
      await loadPallets(activeGrn.id)
      await loadRackSlots(activePallet?.itemId)
      await loadGroundPallets()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Undo Failed'))
    }
  }

  // ---------- GROUND PANEL (shared by list view and workspace) ----------
  const movableGroundCount = groundPallets.filter((g) => g.canMoveNow).length

  const renderGroundPanel = () => {
    if (groundPallets.length === 0) return null

    return (
      <div
        className="sm-card"
        style={{
          marginBottom: 10,
          border: movableGroundCount > 0 ? '2px solid #198754' : '1px solid #e0a800',
        }}
      >
        <div
          className="sm-card-title"
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
        >
          <FaWarehouse size={13} /> PALLETS ON GROUND ({groundPallets.length}) - FIFO ORDER
          {movableGroundCount > 0 && (
            <span style={{ color: '#198754', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <FaBell size={12} /> Location available for {movableGroundCount} pallet
              {movableGroundCount > 1 ? 's' : ''} - move to rack now
            </span>
          )}
        </div>

        <DataTable
          columns={[
            { name: 'FIFO', selector: (row) => row.fifoRank, width: '70px', center: true },
            { name: 'PALLET NO', selector: (row) => row.palletNo, width: '110px' },
            { name: 'GRN', selector: (row) => row.grnNo, width: '130px' },
            { name: 'PART', selector: (row) => row.partLabel, grow: 2, wrap: true },
            { name: 'QTY', selector: (row) => row.quantity, center: true, width: '90px' },
            {
              name: 'ON GROUND SINCE',
              selector: (row) => row.movementDate,
              cell: (row) => formatDate(row.movementDate),
              width: '140px',
              center: true,
            },
            {
              name: 'FREE (F/R)',
              cell: (row) => `${row.freeFront} / ${row.freeRear}`,
              width: '110px',
              center: true,
            },
            {
              name: 'ACTION',
              minWidth: '170px',
              center: true,
              cell: (row) =>
                row.canMoveNow ? (
                  uPrivilege.canEdit ? (
                    <button
                      className="sm-store-btn"
                      disabled={isGroundBusy}
                      onClick={() => moveGroundToRack(row)}
                      title="Move this pallet from the ground to a free rack location"
                    >
                      <FaArrowUp size={12} /> Move to Rack
                    </button>
                  ) : (
                    <span style={{ color: '#198754', fontWeight: 600 }}>Location available</span>
                  )
                ) : (
                  <span style={{ color: '#b58100', fontWeight: 600 }}>Waiting for location</span>
                ),
            },
          ]}
          data={groundPallets}
          keyField="movementId"
          dense
          persistTableHead
          striped
          responsive
          highlightOnHover
          conditionalRowStyles={[
            {
              when: (row) => row.canMoveNow,
              style: { backgroundColor: '#e8f7ed', color: '#198754', fontWeight: 600 },
            },
          ]}
          customStyles={{
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
            cells: { style: { justifyContent: 'center', fontSize: '13px' } },
          }}
        />
      </div>
    )
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

        {movableGroundCount > 0 && (
          <div
            className="sm-selected-location"
            style={{ marginBottom: 8, background: '#e8f7ed', color: '#198754', fontWeight: 600 }}
          >
            <FaBell size={12} /> Location is now available. {movableGroundCount} ground pallet
            {movableGroundCount > 1 ? 's' : ''} can be stored in the rack (FIFO order).
          </div>
        )}

        {renderGroundPanel()}

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

        {/* ---------- GRN Details modal ---------- */}
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
                  cell: (row) => {
                    const rackChips = row.assignments || []
                    const groundChips = row.groundAssignments || []

                    if (rackChips.length === 0 && groundChips.length === 0) {
                      return <span className="sm-no-assign">—</span>
                    }

                    return (
                      <>
                        {rackChips.map((a) => (
                          <span key={a.id} className="sm-assign-chip">
                            {a.storeLocation}-{a.positionCode}
                            <button onClick={(e) => { e.stopPropagation(); handleUndo(a.id) }}>×</button>
                          </span>
                        ))}
                        {groundChips.map((a) => (
                          <span
                            key={`g-${a.id}`}
                            className="sm-assign-chip"
                            style={{ background: '#fff3cd', color: '#8a6d00', borderColor: '#e0a800' }}
                          >
                            Ground ({a.quantity})
                            <button onClick={(e) => { e.stopPropagation(); handleUndo(a.id) }}>×</button>
                          </span>
                        ))}
                      </>
                    )
                  },
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
          {movableGroundCount > 0 && (
            <div
              className="sm-selected-location"
              style={{ marginBottom: 8, background: '#e8f7ed', color: '#198754', fontWeight: 600 }}
            >
              <FaBell size={12} /> Location is now available for {movableGroundCount} ground pallet
              {movableGroundCount > 1 ? 's' : ''} (FIFO). Move them to the rack below.
            </div>
          )}

          {renderGroundPanel()}

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
              <label
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}
                title="ON: click a slot and all remaining pallets are placed automatically from that slot"
              >
                <input
                  type="checkbox"
                  checked={autoMode}
                  onChange={(e) => setAutoMode(e.target.checked)}
                />
                Auto
              </label>
              <CButton
                className="sm-location-save-btn"
                onClick={() => autoAssign(selectedSlot)}
                disabled={isSaving || !activePallet || remainingQty <= 0}
                title="Assign all remaining pallets to the next free slots"
              >
                <FaMagic size={12} /> Auto Select
              </CButton>
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
                disabled={isSaving || (!selectedSlot && pendingMoves.length === 0)}
              >
                <FaTimes size={12} /> Clear
              </CButton>
            </div>
          </div>

          {/* Rack full -> offer ground storage */}
          {rackIsFull && remainingQty > 0 && (
            <div
              className="sm-selected-location"
              style={{
                marginBottom: 8,
                background: '#fff3cd',
                color: '#8a6d00',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span>
                <strong>All rack locations are full</strong> for this part. You can keep the remaining
                pallets on the ground. You will be notified when a location becomes free (FIFO).
              </span>
              {uPrivilege.canEdit && (
                <CButton
                  className="sm-location-save-btn"
                  onClick={storeOnGround}
                  disabled={isGroundBusy || isSaving}
                >
                  <FaWarehouse size={12} /> {isGroundBusy ? 'Saving...' : 'Store on Ground'}
                </CButton>
              )}
            </div>
          )}

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
              {autoMode ? 'Auto mode: click the first slot (or press Auto Select) - pallets follow the zig-zag path after the last stored location, complete all locations, then restart from the first location. Click Save.' : <>Select an available slot for <strong>{activePallet.palletNo}</strong> ({remainingQty} units). It will be kept as a pending movement until you click Save.</>}
            </div>
          )}
        </div>
      </div>

      {showGroundConfirm && (
        <div
          role="presentation"
          onClick={() => {
            if (!isGroundBusy) {
              setShowGroundConfirm(false)
              setGroundConfirmQueue([])
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.58)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ground-confirm-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
              overflow: 'hidden',
              fontFamily: 'inherit',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '18px 22px',
                background: '#f0f7ff',
                borderBottom: '1px solid #dbeafe',
              }}
            >
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FaWarehouse size={18} />
              </span>
              <div>
                <h3 id="ground-confirm-title" style={{ margin: 0, fontSize: 18, color: '#172554', fontWeight: 700 }}>
                  Store Pallets on Ground
                </h3>
                <div style={{ marginTop: 3, fontSize: 12, color: '#64748b' }}>
                  Rack capacity reached
                </div>
              </div>
            </div>

            <div style={{ padding: '22px', color: '#334155', fontSize: 14, lineHeight: 1.65 }}>
              <p style={{ margin: '0 0 12px' }}>
                All rack locations for this part are currently full.
              </p>
              <p style={{ margin: '0 0 12px' }}>
                Do you want to store <strong>{groundConfirmQueue.length} pallet{groundConfirmQueue.length === 1 ? '' : 's'}</strong> on the ground?
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9,
                  padding: 12,
                  borderRadius: 8,
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  color: '#9a3412',
                  fontSize: 13,
                }}
              >
                <FaBell size={14} style={{ marginTop: 3, flexShrink: 0 }} />
                <span>
                  The pallets will remain in FIFO order. You will receive an in-app notification when a rack location becomes available.
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '14px 22px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <button
                type="button"
                disabled={isGroundBusy}
                onClick={() => {
                  setShowGroundConfirm(false)
                  setGroundConfirmQueue([])
                }}
                style={{
                  padding: '9px 17px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: isGroundBusy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGroundBusy}
                onClick={confirmStoreOnGround}
                style={{
                  padding: '9px 17px',
                  border: '1px solid #1d4ed8',
                  borderRadius: 8,
                  background: isGroundBusy ? '#93c5fd' : '#1d4ed8',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: isGroundBusy ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FaWarehouse size={12} />
                {isGroundBusy ? 'Storing...' : 'Yes, Store on Ground'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StoreMovement
