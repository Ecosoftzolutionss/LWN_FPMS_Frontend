import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput } from '@coreui/react'
import { FaEye, FaTrash, FaWarehouse, FaCheckCircle, FaArrowLeft, FaTimes } from 'react-icons/fa'
import { toast } from 'react-toastify'
import API from '../../api.js'
import '../../assets/CSS/storeMovement.css'

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
  const [stuffQty, setStuffQty] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null) // { rackRowId, slotNumber }

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

  const loadRackSlots = async () => {
    try {
      const res = await API.get('/StoreMovement/rack-slots')
      setRackStores(res.data || [])
    } catch {
      toast.error('Failed to load store locations')
    }
  }

  const openStore = async (grn) => {
    setActiveGrn(grn)
    setStuffQty('')
    setSelectedSlot(null)
    await loadPallets(grn.id)
    await loadRackSlots()
  }

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

  const handleSelectSlot = (rackRowId, slotNumber) => {
    setSelectedSlot({ rackRowId, slotNumber })
  }

  const handleStuff = async () => {
    if (!activePallet) {
      toast.error('Pick a pallet from the left first')
      return
    }
    if (!selectedSlot) {
      toast.error('Select an available slot on the right')
      return
    }
    const qty = Number(stuffQty)
    if (!qty || qty <= 0) {
      toast.error('Enter a quantity to stuff')
      return
    }
    if (qty > remainingQty) {
      toast.error(`Only ${remainingQty} remaining on this pallet`)
      return
    }

    try {
      await API.post('/StoreMovement/stuff-rack-slot', {
        grnPalletId: activePallet.id,
        rackRowId: selectedSlot.rackRowId,
        slotNumber: selectedSlot.slotNumber,
        side,
        quantity: qty,
      })

      toast.success('Stuffed Successfully')
      setStuffQty('')
      setSelectedSlot(null)
      await loadPallets(activeGrn.id)
      await loadRackSlots()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Stuff Failed'))
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
                    <button className="sm-icon-btn view" onClick={() => handleView(row)}><FaEye size={13} /></button>
                    <button className="sm-icon-btn delete" onClick={() => handleDeleteClick(row)}><FaTrash size={13} /></button>
                    <button className="sm-store-btn" onClick={() => openStore(row)}>
                      <FaWarehouse size={12} /> Store
                    </button>
                  </div>
                ),
              },
            ]}
            data={filteredGrns}
            pagination
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

        {/* ---------- GRN Details modal ---------- */}
        {showDetails && detailsGrn && (
          <div className="sm-modal-overlay" onClick={() => setShowDetails(false)}>
            <div className="sm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sm-modal-header">
                <h3>GRN Details</h3>
                <button onClick={() => setShowDetails(false)}><FaTimes /></button>
              </div>

              <div className="sm-modal-body">
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

                <table className="sm-modal-items-table">
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
                    {detailsGrn.lines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.partNumber}</td>
                        <td>{l.partName}</td>
                        <td>{l.quantity}</td>
                        <td>{l.palletQuantity ?? '—'}</td>
                        <td>{Number(l.rate).toFixed(2)}</td>
                        <td>{Number(l.totalValue).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sm-modal-footer">
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

            <table className="sm-pallet-table">
              <thead>
                <tr>
                  <th>PALLET NO</th>
                  <th>QUANTITY</th>
                  <th>RATE (₹)</th>
                  <th>STUFFED QTY</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pallets.map((p) => (
                  <tr
                    key={p.id}
                    className={activePallet?.id === p.id ? 'sm-pallet-row-active' : ''}
                    onClick={() => setActivePallet(p)}
                  >
                    <td>{p.palletNo}</td>
                    <td>{p.quantity}</td>
                    <td>{Number(p.rate).toFixed(2)}</td>
                    <td>{p.stuffedQty}</td>
                    <td>
                      {p.assignments.length > 0 ? (
                        p.assignments.map((a) => (
                          <span key={a.id} className="sm-assign-chip">
                            {a.storeLocation}-{a.positionCode}
                            <button onClick={(e) => { e.stopPropagation(); handleUndo(a.id) }}>×</button>
                          </span>
                        ))
                      ) : (
                        <span className="sm-no-assign">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                                        const isSelected =
                                          selectedSlot?.rackRowId === row.id && selectedSlot?.slotNumber === slotNumber

                                        return (
                                          <button
                                            key={slotNumber}
                                            type="button"
                                            className={`sm-slot-btn ${occupied ? 'occupied' : 'available'} ${isSelected ? 'selected' : ''}`}
                                            disabled={occupied}
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

          <div className="sm-stuff-form">
            <input
              type="number"
              className="sm-stuff-qty-input"
              placeholder="Quantity to stuff"
              value={stuffQty}
              onChange={(e) => setStuffQty(e.target.value)}
            />
            <CButton className="sm-select-btn" onClick={handleStuff}>
              Select This Pallet
            </CButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StoreMovement
