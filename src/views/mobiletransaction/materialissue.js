import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from 'react-data-table-component';
import { toast } from 'react-toastify';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormInput,
  CFormSelect,
  CBadge,
} from '@coreui/react';
import {
  FaArrowLeft,
  FaSignOutAlt,
  FaSearch,
  FaQrcode,
  FaThLarge,
  FaBox,
  FaEye,
  FaEdit,
  FaTrash,
  FaPlus,
  FaCube,
  FaClipboardCheck,
} from 'react-icons/fa';

import '../../assets/CSS/materialIssue.css';
import {
  getAllPallets,
  queuePendingIssue,
  getAllPendingIssues,
} from './offlineDb';

// ==========================================
// Summary card config
// ==========================================

const SUMMARY_CONFIG = [
  { key: 'REGULAR', label: 'REGULAR', icon: FaThLarge, tone: 'blue' },
  { key: 'SAMPLE', label: 'SAMPLE', icon: FaBox, tone: 'green' },
];

const GRN_TYPE_OPTIONS = ['GRN Entry', 'GRN Post', 'Store Movement', 'Material Issue'];

const EMPTY_FORM = {
  itemId: '',
  storeLocation: '',
  palletNo: '',
  quantity: '',
  remarks: '',
  grnNo: '',
};

const tableCustomStyles = {
  headRow: { style: { backgroundColor: '#f7f9fd', minHeight: '38px' } },
  headCells: { style: { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' } },
  rows: { style: { minHeight: '42px', fontSize: '12px', color: '#1f2937' } },
};

// The MaterialIssue backend model requires IssuedBy. Pull it from
// the logged-in session rather than re-typing it every time.
const getSessionUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

// ==========================================
// Material Issue
// ==========================================
//
// Flow (exactly as requested):
//   1. Scan a label -> row appears in SCANNED ITEMS (pending review,
//      not yet saved anywhere).
//   2. Click "Add Scanned Pallet" -> every row currently sitting in
//      Scanned Items moves into CONFIRMED ITEMS. Nothing is saved
//      to the device yet — still just in memory.
//   3. Click "Issue Material" -> every row in Confirmed Items is
//      saved to the LOCAL offline DB (queuePendingIssue). On
//      success: toast + Confirmed Items grid clears (data itself
//      stays safe in local storage, ready for the next Data Sync).
// ==========================================

const MaterialIssue = () => {
  const navigate = useNavigate();

  const [pallets, setPallets] = useState([]);
  const [palletsLoaded, setPalletsLoaded] = useState(false);

  const [activeType, setActiveType] = useState(null); // 'REGULAR' | 'SAMPLE' | null
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const [form, setForm] = useState(EMPTY_FORM);

  // Step 1: scan lands here.
  const [scannedRows, setScannedRows] = useState([]);
  // Step 2: "Add Scanned Pallet" moves rows here.
  const [confirmedRows, setConfirmedRows] = useState([]);

  // PERSISTENT duplicate guard — pallets already saved to the local
  // DB via Issue Material. This does NOT reset when confirmedRows
  // is cleared after a successful save, otherwise the app "forgets"
  // a pallet was issued the moment the grid empties, letting the
  // same physical pallet be scanned and issued again. Seeded on
  // mount from whatever's already sitting in the local pending
  // queue (e.g. from an earlier session that hasn't synced yet).
  const [issuedPalletNos, setIssuedPalletNos] = useState(new Set());

  // Required by the backend model — collected once per issuing
  // session, not per pallet row.
  const sessionUser = useMemo(() => getSessionUser(), []);
  const [issuedTo, setIssuedTo] = useState('');
  const issuedBy = sessionUser?.name || sessionUser?.username || sessionUser?.userName || 'Unknown';

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsMode, setDetailsMode] = useState('view');
  const [detailsRow, setDetailsRow] = useState(null);
  const [grnType, setGrnType] = useState('GRN Entry');

  const [saving, setSaving] = useState(false);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const scanInputRef = useRef(null);

  useEffect(() => {

    const load = async () => {
      try {
        const cached = await getAllPallets();
        setPallets(cached);
      } catch (err) {
        console.error('Failed to load cached pallets:', err);
      } finally {
        setPalletsLoaded(true);
      }
    };

    load();

    // Seed the persistent duplicate guard from whatever's already
    // queued locally (unsynced) — e.g. from before a page refresh.
    const loadAlreadyIssued = async () => {
      try {
        const pending = await getAllPendingIssues();
        setIssuedPalletNos(new Set(pending.map((p) => p.palletNo).filter(Boolean)));
      } catch (err) {
        console.error('Failed to load already-issued pallets:', err);
      }
    };

    loadAlreadyIssued();

  }, []);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const refocusScanInput = () => {
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  // Pallets already used this session — checked across ALL THREE:
  // Scanned Items, Confirmed Items, AND the persistent issuedPalletNos
  // set (pallets already saved to local DB, even after their grid
  // row was cleared). This is what actually blocks rescanning P001
  // after it was already Issued.
  const usedPalletNos = useMemo(() => {
    const used = new Set();
    scannedRows.forEach((r) => used.add(r.palletNo));
    confirmedRows.forEach((r) => used.add(r.palletNo));
    issuedPalletNos.forEach((p) => used.add(p));
    return used;
  }, [scannedRows, confirmedRows, issuedPalletNos]);

  const summaryCounts = useMemo(() => {

    const totals = { REGULAR: 0, SAMPLE: 0 };

    pallets.forEach((p) => {
      const type = (p.type || 'REGULAR').toUpperCase();
      if (totals[type] !== undefined) {
        totals[type] += 1;
      }
    });

    return totals;

  }, [pallets]);

  const handleSummaryCardClick = (typeKey) => {

    const matches = pallets.filter(
      (p) => (p.type || 'REGULAR').toUpperCase() === typeKey && !usedPalletNos.has(p.palletNo)
    );

    const ordered = typeKey === 'REGULAR'
      ? [...matches].sort((a, b) => new Date(a.movementDate) - new Date(b.movementDate))
      : matches;

    setActiveType(typeKey);
    setQueue(ordered);
    setQueueIndex(0);

    if (ordered.length > 0) {
      applyPalletToForm(ordered[0]);
    } else {
      setForm(EMPTY_FORM);
    }

  };

  const applyPalletToForm = (pallet) => {
    setForm((f) => ({
      ...f,
      itemId: pallet.itemId,
      storeLocation: pallet.storeLocation || '',
      palletNo: pallet.palletNo || '',
      quantity: pallet.quantity ? String(pallet.quantity) : '',
    }));
  };

  const partOptions = useMemo(() => {
    const seen = new Map();
    pallets.forEach((p) => {
      if (!seen.has(p.itemId)) seen.set(p.itemId, p.partLabel || p.itemId);
    });
    return Array.from(seen.entries()).map(([itemId, partLabel]) => ({ itemId, partLabel }));
  }, [pallets]);

  const handlePartSelect = (itemId) => {

    const matches = pallets.filter(
      (p) => String(p.itemId) === String(itemId) && !usedPalletNos.has(p.palletNo)
    );

    if (matches.length === 0) {
      setForm((f) => ({ ...f, itemId, storeLocation: '', palletNo: '', quantity: '' }));
      return;
    }

    const isRegular = matches[0].type === 'REGULAR';

    const chosen = isRegular
      ? [...matches].sort((a, b) => new Date(a.movementDate) - new Date(b.movementDate))[0]
      : matches[0];

    applyPalletToForm({ ...chosen, itemId });
    setActiveType(null);

  };

  // ------------------------------------------
  // FIFO enforcement — for REGULAR type, only
  // the oldest unused pallet is allowed in.
  // ------------------------------------------

  const getNextRegularPallet = () => {
    const unusedRegular = pallets.filter(
      (p) => (p.type || 'REGULAR').toUpperCase() === 'REGULAR' && !usedPalletNos.has(p.palletNo)
    );
    if (unusedRegular.length === 0) return null;
    return [...unusedRegular].sort(
      (a, b) => new Date(a.movementDate) - new Date(b.movementDate)
    )[0];
  };

  // ------------------------------------------
  // STEP 1 — a validated scan lands in
  // Scanned Items (not Confirmed yet).
  // ------------------------------------------

  const addScannedRow = ({ itemId, partLabel, palletNo, storeLocation, quantity, grnNo, remarks, type }) => {

    if (!itemId || !quantity || !palletNo) {
      toast.error('Scanned label is missing required fields (part, quantity or pallet number).');
      return false;
    }

    if (!issuedTo.trim()) {
      toast.error('Enter "Issued To" before scanning — required to save.');
      return false;
    }

    if (issuedPalletNos.has(palletNo)) {
      toast.error(`Pallet ${palletNo} was already Issued and saved to this device. It cannot be scanned again until it's synced and re-stocked.`);
      return false;
    }

    if (usedPalletNos.has(palletNo)) {
      toast.error(`Pallet ${palletNo} has already been scanned this session.`);
      return false;
    }

    // FIFO enforcement — a Regular pallet can only be scanned if it's
    // the oldest unused one.
    if ((type || 'REGULAR').toUpperCase() === 'REGULAR') {
      const nextAllowed = getNextRegularPallet();
      if (nextAllowed && nextAllowed.palletNo !== palletNo) {
        toast.error(`FIFO order required — scan pallet ${nextAllowed.palletNo} first (oldest in store).`);
        return false;
      }
    }

    const row = {
      id: `${Date.now()}`,
      itemId,
      partLabel: partLabel || itemId,
      grnNo: grnNo || '—',
      palletNo,
      location: storeLocation || '',
      qty: Number(quantity),
      remarks: remarks || '',
    };

    setScannedRows((rows) => [...rows, row]);
    toast.success(`Pallet ${palletNo} scanned.`);

    if (activeType && queue.length > 0) {
      const remaining = queue.filter((p) => p.palletNo !== palletNo);
      setQueue(remaining);
      if (remaining.length > 0) {
        applyPalletToForm(remaining[0]);
        setQueueIndex(0);
      } else {
        setForm(EMPTY_FORM);
        setActiveType(null);
      }
    } else {
      setForm(EMPTY_FORM);
    }

    return true;

  };

  // ------------------------------------------
  // Scan Pallet / GRN Label
  // ------------------------------------------

  const applyScannedPallet = (raw) => {

    if (!raw) return;

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      toast.error('Scanned code is not a valid GRN label QR.');
      resetScanInput();
      return;
    }

    const scannedPalletNo = parsed.palletNo;
    const scannedFifoNo = parsed.fifoPalletNo;
    const scannedGrn = parsed.grn;
    const scannedPart = parsed.part;
    const scannedQty = parsed.qty;
    const scannedLocation = parsed.location;

    if (!scannedPalletNo && !scannedFifoNo) {
      toast.error('Scanned code is missing Pallet No / FIFO Pallet No — not a valid GRN label.');
      resetScanInput();
      return;
    }

    const match =
      pallets.find((p) => p.palletNo && p.palletNo === scannedPalletNo) ||
      pallets.find((p) => p.fifoPalletNo && p.fifoPalletNo === scannedFifoNo);

    if (match) {

      addScannedRow({
        itemId: match.itemId,
        partLabel: match.partLabel,
        palletNo: match.palletNo,
        storeLocation: scannedLocation || match.storeLocation,
        quantity: scannedQty ?? match.quantity,
        grnNo: scannedGrn,
        type: match.type,
      });

      setActiveType(match.type || activeType);

    } else if (scannedPart && scannedQty !== undefined) {

      toast.info('Pallet not found in synced data — added using scanned values. Run Data Sync when possible.');

      addScannedRow({
        itemId: scannedPart,
        partLabel: scannedPart,
        palletNo: scannedPalletNo || scannedFifoNo,
        storeLocation: scannedLocation,
        quantity: scannedQty,
        grnNo: scannedGrn,
        type: 'SAMPLE',
      });

    } else {
      toast.error('Scanned pallet was not found in synced data and the label has no usable quantity.');
    }

    resetScanInput();

  };

  const resetScanInput = () => {
    setForm((f) => ({ ...f, grnNo: '' }));
    refocusScanInput();
  };

  const handleScanInputChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, grnNo: value }));

    // Auto-process the instant a complete JSON payload has landed in
    // the field — covers scanners that don't send a trailing Enter.
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      applyScannedPallet(trimmed);
    }
  };

  const handleScanInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyScannedPallet(e.target.value.trim());
    }
  };

  // ------------------------------------------
  // STEP 2 — "Add Scanned Pallet" moves every
  // row currently in Scanned Items into
  // Confirmed Items. Still no local save yet.
  // ------------------------------------------

  const handleMoveToConfirmed = () => {

    if (scannedRows.length === 0) {
      toast.error('Scan at least one pallet first.');
      return;
    }

    setConfirmedRows((rows) => [...rows, ...scannedRows]);
    setScannedRows([]);
    toast.success(`${scannedRows.length} pallet(s) moved to Confirmed Items.`);

  };

  const handleDeleteScanned = (id) => {
    setScannedRows((rows) => rows.filter((r) => r.id !== id));
  };

  const handleDeleteConfirmed = (id) => {
    setConfirmedRows((rows) => rows.filter((r) => r.id !== id));
  };

  // ------------------------------------------
  // STEP 3 — Issue Material saves every row in
  // Confirmed Items to the LOCAL offline DB.
  // Field names match the backend MaterialIssue
  // model exactly: ItemId, Quantity, IssuedTo,
  // IssuedBy, StoreLocation, PalletNo,
  // GrnNumber, Remarks.
  // ------------------------------------------

  const handleIssueMaterial = async () => {

    if (confirmedRows.length === 0) {
      toast.error('Move at least one pallet to Confirmed Items before issuing.');
      return;
    }

    if (!issuedTo.trim()) {
      toast.error('Enter "Issued To" before issuing.');
      return;
    }

    setSaving(true);

    try {

      for (const row of confirmedRows) {
        await queuePendingIssue({
          itemId: row.itemId,
          quantity: row.qty,
          issuedTo: issuedTo.trim(),
          issuedBy,
          storeLocation: row.location,
          palletNo: row.palletNo,
          grnNumber: row.grnNo === '—' ? null : row.grnNo,
          remarks: row.remarks,
          createdAt: new Date().toISOString(),
        });
      }

      toast.success(`Material Issued Successfully — ${confirmedRows.length} pallet(s) saved to this device.`);

      // Lock these pallets against being scanned/issued again — this
      // set is NOT cleared, unlike confirmedRows below.
      setIssuedPalletNos((prev) => {
        const next = new Set(prev);
        confirmedRows.forEach((row) => next.add(row.palletNo));
        return next;
      });

      // Clear the grid — the data itself is safe in the local DB,
      // waiting for the next Data Sync.
      setConfirmedRows([]);

    } catch (err) {
      console.error('Failed to save offline:', err);
      toast.error('Failed to save locally. Nothing was cleared — please try again.');
    } finally {
      setSaving(false);
    }

  };

  const totalPallets = confirmedRows.length;
  const totalQuantity = confirmedRows.reduce((sum, r) => sum + Number(r.qty || 0), 0);

  const openView = (row) => {
    setDetailsRow(row);
    setDetailsMode('view');
    setDetailsOpen(true);
  };

  const openEdit = (row) => {
    setDetailsRow(row);
    setDetailsMode('edit');
    setGrnType('GRN Entry');
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
  };

  const scannedColumns = [
    { name: 'GRN No.', selector: (row) => row.grnNo, sortable: true },
    { name: 'Pallet No.', selector: (row) => row.palletNo, sortable: true },
    { name: 'Location', selector: (row) => row.location, sortable: true },
    { name: 'Qty', selector: (row) => row.qty, sortable: true, width: '70px' },
    {
      name: 'Action',
      cell: (row) => (
        <div className="mi-row-actions">
          <button type="button" className="mi-action-btn mi-action-view" onClick={() => openView(row)}>
            <FaEye />
          </button>
          <button type="button" className="mi-action-btn mi-action-edit" onClick={() => openEdit(row)}>
            <FaEdit />
          </button>
          <button type="button" className="mi-action-btn mi-action-delete" onClick={() => handleDeleteScanned(row.id)}>
            <FaTrash />
          </button>
        </div>
      ),
      width: '110px',
    },
  ];

  const confirmedColumns = [
    { name: 'GRN No.', selector: (row) => row.grnNo, sortable: true },
    { name: 'Pallet No.', selector: (row) => row.palletNo, sortable: true },
    { name: 'Location', selector: (row) => row.location, sortable: true },
    { name: 'Qty', selector: (row) => row.qty, sortable: true, width: '70px' },
    {
      name: 'Action',
      cell: (row) => (
        <div className="mi-row-actions">
          <button type="button" className="mi-action-btn mi-action-view" onClick={() => openView(row)}>
            <FaEye />
          </button>
          <button type="button" className="mi-action-btn mi-action-delete" onClick={() => handleDeleteConfirmed(row.id)}>
            <FaTrash />
          </button>
        </div>
      ),
      width: '80px',
    },
  ];

  return (
    <div className="mi-page">

      {/* ======================================
          HEADER (fixed)
      ====================================== */}

      <header className="mi-topbar">

        <button
          type="button"
          className="mi-icon-btn"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          <FaArrowLeft />
        </button>

        <div className="mi-topbar-title">
          <div className="mi-topbar-main">Material Issue</div>
          <div className="mi-topbar-sub">
            {isOnline ? 'Issue material/pallets to departments' : 'Offline — saving locally'}
          </div>
        </div>

        <button type="button" className="mi-icon-btn" aria-label="Logout">
          <FaSignOutAlt />
        </button>

      </header>


      {/* ======================================
          SCROLLABLE BODY
      ====================================== */}

      <main className="mi-body">

        {/* SUMMARY CARDS */}

        <div className="mi-summary-row mi-summary-row-2">
          {SUMMARY_CONFIG.map((card) => {
            const Icon = card.icon;
            const isActive = activeType === card.key;
            return (
              <button
                type="button"
                key={card.key}
                className={`mi-summary-card mi-tone-${card.tone} ${isActive ? 'mi-summary-active' : ''}`}
                onClick={() => handleSummaryCardClick(card.key)}
              >
                <div className="mi-summary-icon"><Icon /></div>
                <div className="mi-summary-label">{card.label}</div>
                <div className="mi-summary-value">
                  {palletsLoaded ? summaryCounts[card.key] : '—'}
                </div>
                <div className="mi-summary-unit">
                  {isActive ? `${queue.length} remaining` : 'Pallets'}
                </div>
              </button>
            );
          })}
        </div>

        {activeType === 'REGULAR' && (
          <div className="mi-fifo-banner">
            FIFO mode: issuing oldest stuffed pallet first, one at a time.
          </div>
        )}

        {/* ISSUED TO / ISSUED BY — required by backend, collected once */}

        <div className="mi-grid-2">
          <div className="mi-field">
            <label className="mi-label">Issued To <span className="mi-req">*</span></label>
            <input
              className="mi-input-real"
              placeholder="Department or person receiving"
              value={issuedTo}
              onChange={(e) => setIssuedTo(e.target.value)}
            />
          </div>

          <div className="mi-field">
            <label className="mi-label">Issued By</label>
            <input
              className="mi-input-real"
              value={issuedBy}
              readOnly
            />
          </div>
        </div>

        {/* SELECT PART + SEARCH — browse/reference only. Does NOT add
            a row by itself; only a scanned label adds to the grid. */}

        <div className="mi-field">
          <label className="mi-label">Select Part (browse only — scan to add)</label>
          <div className="mi-part-row">
            <select
              className="mi-select-real"
              value={form.itemId}
              onChange={(e) => handlePartSelect(e.target.value)}
            >
              <option value="">
                {palletsLoaded ? 'Select part number' : 'Loading synced parts…'}
              </option>
              {partOptions.map((p) => (
                <option key={p.itemId} value={p.itemId}>
                  {p.partLabel}
                </option>
              ))}
            </select>
            <button type="button" className="mi-search-btn">
              <FaSearch /> Search
            </button>
          </div>
        </div>

        {/* STORE LOCATION + PALLET NUMBER (auto-filled) */}

        <div className="mi-grid-2">
          <div className="mi-field">
            <label className="mi-label">Store Location <span className="mi-req">*</span></label>
            <input
              className="mi-input-real"
              placeholder="Store location"
              value={form.storeLocation}
              readOnly
            />
          </div>

          <div className="mi-field">
            <label className="mi-label">Pallet Number <span className="mi-req">*</span></label>
            <input
              className="mi-input-real"
              placeholder="Pallet number"
              value={form.palletNo}
              readOnly
            />
          </div>
        </div>

        {/* QUANTITY + REMARKS */}

        <div className="mi-grid-2">
          <div className="mi-field">
            <label className="mi-label">Quantity <span className="mi-req">*</span></label>
            <input
              type="number"
              className="mi-input-real"
              placeholder="Enter quantity"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>

          <div className="mi-field">
            <label className="mi-label">Remarks</label>
            <input
              className="mi-input-real"
              placeholder="Enter remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>
        </div>

        {/* SCAN PALLET / GRN — step 1: lands in Scanned Items */}

        <div className="mi-field">
          <label className="mi-label">Scan Pallet / GRN Label</label>
          <div className="mi-scan-input">
            <input
              ref={scanInputRef}
              className="mi-scan-input-inner"
              placeholder="Scan a label — adds automatically"
              value={form.grnNo}
              onChange={handleScanInputChange}
              onKeyDown={handleScanInputKeyDown}
              autoFocus
            />
            <FaQrcode className="mi-scan-icon" />
          </div>
        </div>

        {/* SCANNED ITEMS GRID — step 1 result */}

        <div className="mi-section-title">Scanned Items</div>

        <div className="mi-table-wrap">
          <DataTable
            columns={scannedColumns}
            data={scannedRows}
            customStyles={tableCustomStyles}
            noHeader
            dense
            noDataComponent={<div className="mi-empty-grid">No items scanned yet</div>}
          />
        </div>

        {/* STEP 2: move Scanned Items -> Confirmed Items */}

        <button
          type="button"
          className="mi-add-btn"
          onClick={handleMoveToConfirmed}
          disabled={scannedRows.length === 0}
        >
          <FaPlus /> Add Scanned Pallet{scannedRows.length > 0 ? ` (${scannedRows.length})` : ''}
        </button>

        {/* CONFIRMED ITEMS GRID — step 2 result, saved on Issue Material */}

        <div className="mi-section-title">Confirmed Items</div>

        <div className="mi-table-wrap">
          <DataTable
            columns={confirmedColumns}
            data={confirmedRows}
            customStyles={tableCustomStyles}
            noHeader
            dense
            noDataComponent={<div className="mi-empty-grid">Nothing confirmed yet</div>}
          />
        </div>

        {/* TOTALS */}

        <div className="mi-totals-row">
          <div className="mi-total-card mi-total-blue">
            <div className="mi-total-icon"><FaCube /></div>
            <div>
              <div className="mi-total-label">Total Pallets</div>
              <div className="mi-total-value">{totalPallets}</div>
            </div>
          </div>

          <div className="mi-total-card mi-total-green">
            <div className="mi-total-icon"><FaClipboardCheck /></div>
            <div>
              <div className="mi-total-label">Total Quantity</div>
              <div className="mi-total-value">{totalQuantity}</div>
            </div>
          </div>
        </div>

        <div className="mi-body-spacer" />

      </main>


      {/* ======================================
          FIXED FOOTER — STEP 3: ISSUE MATERIAL
          saves Confirmed Items to local DB
      ====================================== */}

      <div className="mi-footer">
        <button
          type="button"
          className="mi-submit-btn"
          onClick={handleIssueMaterial}
          disabled={saving || confirmedRows.length === 0}
        >
          <FaThLarge /> {saving ? 'Saving…' : 'Issue Material'}
        </button>
      </div>


      {/* ======================================
          PALLET DETAILS MODAL (CoreUI)
      ====================================== */}

      <CModal visible={detailsOpen} onClose={closeDetails} alignment="center">

        <CModalHeader>
          <CModalTitle>
            Pallet Details
            <div className="mi-modal-subtitle">
              {detailsMode === 'view' ? 'View' : 'Edit'}
            </div>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>

          <div className="mi-modal-field">
            <div className="mi-modal-label">GRN No.</div>
            {detailsMode === 'view' ? (
              <div className="mi-modal-value">{detailsRow?.grnNo}</div>
            ) : (
              <CFormInput value={detailsRow?.grnNo || ''} disabled readOnly />
            )}
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">GRN Type</div>
            {detailsMode === 'view' ? (
              <CBadge color="info" shape="rounded-pill" className="mi-modal-badge">
                {grnType}
              </CBadge>
            ) : (
              <CFormSelect
                value={grnType}
                onChange={(e) => setGrnType(e.target.value)}
              >
                {GRN_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </CFormSelect>
            )}
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Pallet No.</div>
            {detailsMode === 'view' ? (
              <div className="mi-modal-value">{detailsRow?.palletNo}</div>
            ) : (
              <CFormInput defaultValue={detailsRow?.palletNo || ''} />
            )}
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Part Details</div>
            {detailsMode === 'view' ? (
              <div className="mi-modal-value">{detailsRow?.partLabel}</div>
            ) : (
              <CFormInput defaultValue={detailsRow?.partLabel || ''} />
            )}
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Location</div>
            {detailsMode === 'view' ? (
              <div className="mi-modal-value">{detailsRow?.location}</div>
            ) : (
              <CFormInput defaultValue={detailsRow?.location || ''} />
            )}
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Quantity</div>
            {detailsMode === 'view' ? (
              <div className="mi-modal-value">{detailsRow?.qty}</div>
            ) : (
              <CFormInput type="number" defaultValue={detailsRow?.qty || 0} />
            )}
          </div>

        </CModalBody>

        <CModalFooter>
          {detailsMode === 'view' ? (
            <CButton color="primary" variant="outline" className="w-100" onClick={closeDetails}>
              Close
            </CButton>
          ) : (
            <>
              <CButton color="primary" variant="outline" className="flex-fill mi-modal-cancel-btn" onClick={closeDetails}>
                Cancel
              </CButton>
              <CButton color="primary" className="flex-fill mi-modal-update-btn" onClick={closeDetails}>
                Update
              </CButton>
            </>
          )}
        </CModalFooter>

      </CModal>

    </div>
  );
};

export default MaterialIssue;
