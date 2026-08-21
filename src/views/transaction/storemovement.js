import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput } from '@coreui/react'
import { FaEye, FaTrash, FaWarehouse, FaCheckCircle, FaArrowLeft, FaTimes } from 'react-icons/fa'
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

const StoreMovement = () => {
  const [grns, setGrns] = useState([])
  const [search, setSearch] = useState('')

  const [detailsGrn, setDetailsGrn] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [activeGrn, setActiveGrn] = useState(null)
  const [pallets, setPallets] = useState([])
  const [rackStores, setRackStores] = useState([]) // real Store -> Rack -> Column -> Row -> Slots

  const [activePallet, setActivePallet] = useState(null)
  const [side, setSide] = useState('Front')
  const [selectedSlot, setSelectedSlot] = useState(null) // { rackRowId, slotNumber }
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
      setGrns(res.data || [])
    } catch {
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
    await loadPallets(grn.id)
  }

  // NEW: re-filter Select Location whenever the chosen pallet changes,
  // since each pallet's Part Number may be configured to a different store.
  useEffect(() => {
    if (activePallet) {
      loadRackSlots(activePallet.itemId)
    }
  }, [activePallet?.id])

  const closeStore = () => {
    setActiveGrn(null)
    setPallets([])
    setActivePallet(null)
  }

  const filteredGrns = grns.filter(
    (g) =>
      (g.grnNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.supplierInvoiceNumber || '').toLowerCase().includes(search.toLowerCase()),
  )

  const remainingQty = activePallet
    ? activePallet.quantity - activePallet.stuffedQty
    : 0

  // Front slots use odd numbers (1,3,5...), Rear uses even (2,4,6...),
  // each running the full Fixture count — same convention as Location Master.
  const buildSlotNumbers = (fixture, useSide) =>
    Array.from({ length: fixture }, (_, i) => (useSide === 'Front' ? i * 2 + 1 : i * 2 + 2))

  const isSlotOccupied = (row, slotNumber) =>
    row.occupiedSlots.some((o) => o.slotNumber === slotNumber && o.side === side)

  const getOccupiedPalletNo = (row, slotNumber) => {
    const match = row.occupiedSlots.find((o) => o.slotNumber === slotNumber && o.side === side)
    return match?.palletNo || null
  }

  const handleSelectSlot = async (rackRowId, slotNumber) => {
    if (!activePallet) {
      toast.error('Pick a pallet from the left first')
      return
    }

    if (remainingQty <= 0) {
      toast.error('This pallet has already been fully stuffed')
      return
    }

    // Each pallet (GRN line) is already a whole, pre-split unit from GRN
    // Entry's Quantity / Pallet Quantity split — so stuffing always moves
    // the pallet's full remaining quantity into the slot, no manual
    // amount to type in.
    setSelectedSlot({ rackRowId, slotNumber })

    try {
      await API.post('/StoreMovement/stuff-rack-slot', {
        grnPalletId: activePallet.id,
        rackRowId,
        slotNumber,
        side,
        quantity: remainingQty,
        createdBy: getCurrentUsername(),
      })

      toast.success(`Pallet ${activePallet.palletNo} stuffed successfully`)
      setSelectedSlot(null)
      await loadPallets(activeGrn.id)
      await loadRackSlots()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Stuff Failed'))
      setSelectedSlot(null)
    }
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
              rows: { style: { minHeight: '48px' } },
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
              onRowClicked={(row) => setActivePallet(row)}
              conditionalRowStyles={[
                {
                  when: (row) => activePallet?.id === row.id,
                  style: { backgroundColor: '#e3ecfd' },
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
              <button className={side === 'Front' ? 'active' : ''} onClick={() => setSide('Front')}>Front</button>
              <button className={side === 'Rear' ? 'active' : ''} onClick={() => setSide('Rear')}>Rear</button>
            </div>
          </div>

          <div className="sm-card-title">SELECT LOCATION</div>

          {rackStores.length === 0 ? (
            <div className="sm-empty-slots">No stores/racks configured yet in Location Master.</div>
          ) : (
            <div className="sm-rack-store-grid">
              {rackStores.map((store) => (
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
                          {rack.columns.map((col) => (
                            <div key={col.id} className="sm-rack-column">
                              <div className="sm-rack-column-title">{col.columnNo}</div>

                              {[...col.rows].reverse().map((row) => {
                                const enabled = side === 'Front' ? row.hasFront : row.hasRear
                                if (!enabled) return null

                                const slotNumbers = buildSlotNumbers(row.fixture, side)

                                return (
                                  <div key={row.id} className="sm-rack-row">
                                    <div className="sm-rack-row-label">{row.rowNo}</div>
                                    <div className="sm-rack-row-slots">
                                      {slotNumbers.map((slotNumber) => {
                                        const occupied = isSlotOccupied(row, slotNumber)
                                        const occupiedPalletNo = occupied ? getOccupiedPalletNo(row, slotNumber) : null
                                        const isSelected =
                                          selectedSlot?.rackRowId === row.id && selectedSlot?.slotNumber === slotNumber

                                        const tooltipText = occupied
                                          ? `Occupied — ${occupiedPalletNo || 'Unknown Pallet'}`
                                          : 'Available'

                                        return (
                                          <button
                                            key={slotNumber}
                                            type="button"
                                            className={`sm-slot-btn ${occupied ? 'occupied' : 'available'} ${isSelected ? 'selected' : ''}`}
                                            disabled={occupied}
                                            data-tooltip={tooltipText}
                                            data-tooltip-type={occupied ? 'occupied' : 'available'}
                                            onClick={() => handleSelectSlot(row.id, slotNumber)}
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
            <div className="sm-stuff-hint">Pick a pallet from the left, then click any available slot to place it there.</div>
          ) : (
            <div className="sm-stuff-hint">
              Click an available slot to place <strong>{activePallet.palletNo}</strong> ({remainingQty} units) there.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StoreMovement
