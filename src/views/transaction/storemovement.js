import React, { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'
import { CButton, CFormInput } from '@coreui/react'
import { FaEye, FaTrash, FaWarehouse, FaCheckCircle } from 'react-icons/fa'
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

  const [activeGrn, setActiveGrn] = useState(null)
  const [pallets, setPallets] = useState([])
  const [positions, setPositions] = useState([])

  const [activePallet, setActivePallet] = useState(null)
  const [side, setSide] = useState('Front')
  const [stuffQty, setStuffQty] = useState('')
  const [selectedPositionId, setSelectedPositionId] = useState(null)

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

  const loadPallets = async (grnId) => {
    try {
      const res = await API.get(`/StoreMovement/grn/${grnId}/pallets`)
      setPallets(res.data || [])
      setActivePallet((prev) => res.data.find((p) => p.id === prev?.id) || res.data[0] || null)
    } catch {
      toast.error('Failed to load pallets for this GRN')
    }
  }

  const loadPositions = async () => {
    try {
      const res = await API.get('/StoreMovement/positions')
      setPositions(res.data || [])
    } catch {
      toast.error('Failed to load store positions')
    }
  }

  const openStore = async (grn) => {
    setActiveGrn(grn)
    setStuffQty('')
    setSelectedPositionId(null)
    await loadPallets(grn.id)
    await loadPositions()
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

  const handleSelectPosition = (posId) => {
    setSelectedPositionId(posId)
  }

  const handleStuff = async () => {
    if (!activePallet) {
      toast.error('Pick a pallet from the left first')
      return
    }
    if (!selectedPositionId) {
      toast.error('Select a store position on the right')
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
      await API.post('/StoreMovement/stuff', {
        grnPalletId: activePallet.id,
        storePositionId: selectedPositionId,
        side,
        quantity: qty,
      })

      toast.success('Stuffed Successfully')
      setStuffQty('')
      setSelectedPositionId(null)
      await loadPallets(activeGrn.id)
      await loadPositions()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Stuff Failed'))
    }
  }

  const handleUndo = async (movementId) => {
    try {
      await API.delete(`/StoreMovement/${movementId}`)
      toast.success('Movement Undone')
      await loadPallets(activeGrn.id)
      await loadPositions()
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
                    <button className="sm-icon-btn view"><FaEye size={13} /></button>
                    <button className="sm-icon-btn delete"><FaTrash size={13} /></button>
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
      </div>
    )
  }

  // ---------- STUFFING WORKSPACE ----------
  return (
    <div className="store-movement-page">
      <button className="sm-back-link" onClick={closeStore}>← Back to GRN list</button>

      <div className="sm-workspace">
        {/* LEFT: GRN Summary + Pallet Details */}
        <div className="sm-left-col">
          <div className="sm-card">
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

          <div className="sm-card-title">SELECT PALLET</div>

          <div className="sm-store-grid">
            {positions.map((store) => (
              <div key={store.id} className="sm-store-block">
                <div className="sm-store-block-header">
                  <span><FaWarehouse size={12} /> {store.storeLocation}</span>
                  <span className="sm-available-badge">● Available</span>
                </div>
                <div className="sm-position-count">{store.positions.length} Pallet(s)</div>

                <div className="sm-position-cards">
                  {store.positions.map((pos) => {
                    const available = pos.capacity - pos.stuffed
                    const isFull = available <= 0
                    const isSelected = selectedPositionId === pos.id

                    return (
                      <div
                        key={pos.id}
                        className={`sm-position-card ${isSelected ? 'selected' : ''} ${isFull ? 'full' : ''}`}
                        onClick={() => !isFull && handleSelectPosition(pos.id)}
                      >
                        <div className="sm-position-code">{pos.positionCode}</div>
                        <div className="sm-pallet-icon">🟫</div>
                        <div className={`sm-position-status ${isFull ? 'full' : 'free'}`}>
                          {isSelected && <FaCheckCircle size={11} />} {pos.positionCode} - {isFull ? 'FULL' : 'FREE'}
                          <div className="sm-space-label">Space</div>
                          <div className="sm-space-value">Available: {available.toLocaleString()}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

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
