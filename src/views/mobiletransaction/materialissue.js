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
  FaSyncAlt,
} from 'react-icons/fa';
import Select from 'react-select';

import '../../assets/CSS/materialIssue.css';
import {
  getAllPallets,
  queuePendingIssue,
  getAllPendingIssues,
} from './offlineDb';

// ==========================================
// Summary card config
// ==========================================
//
// CHANGE_PART is a third, purely informational card — it has no
// pallet pool behind it (unlike REGULAR / SAMPLE) so it is not
// clickable and never drives the pallet queue. It just reports how
// many rows have been edited via the pencil icon this session.

const SUMMARY_CONFIG = [
  { key: 'REGULAR', label: 'REGULAR', icon: FaThLarge, tone: 'blue' },
  { key: 'SAMPLE', label: 'SAMPLE', icon: FaBox, tone: 'green' },
  { key: 'CHANGE_PART', label: 'CHANGE PART', icon: FaSyncAlt, tone: 'orange' },
];

const GRN_TYPE_OPTIONS = ['REGULAR', 'SAMPLE'];

const EMPTY_FORM = {
  itemId: '',
  storeLocation: '',
  palletNo: '',
  quantity: '',
  remarks: '',
  grnNo: '',
};

const EMPTY_EDIT_FORM = {
  palletNo: '',
  partLabel: '',
  location: '',
  qty: '',
};

const tableCustomStyles = {
  headRow: { style: { backgroundColor: '#f7f9fd', minHeight: '38px' } },
  headCells: { style: { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' } },
  rows: { style: { minHeight: '42px', fontSize: '12px', color: '#1f2937' } },
};

// Rows that have been edited (via the pencil icon / Update) render
// with a distinct highlight so they're easy to spot in the grid.
const conditionalRowStyles = [
  {
    when: (row) => !!row.edited,
    style: {
      backgroundColor: '#fff7e6',
      borderLeft: '3px solid #f59e0b',
    },
  },
];

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

  // Running tally for the "CHANGE PART" summary card — incremented
  // every time a row is saved via the Edit modal. This is a
  // one-way counter (like issuedPalletIds), it does NOT reset when
  // rows move between grids or get cleared, so it reflects total
  // edit activity this session, not "currently edited row count".
  const [changePartCount, setChangePartCount] = useState(0);

  // PERSISTENT duplicate guard — pallets already saved to the local
  // DB via Issue Material. This does NOT reset when confirmedRows
  // is cleared after a successful save, otherwise the app "forgets"
  // a pallet was issued the moment the grid empties, letting the
  // same physical pallet be scanned and issued again. Seeded on
  // mount from whatever's already sitting in the local pending
  // queue (e.g. from an earlier session that hasn't synced yet).
  //
  // Keyed by the pallet's real unique `id` — NOT by palletNo. The
  // human-readable palletNo/fifoPalletNo labels get RECYCLED across
  // different GRNs (confirmed from the GRN_PALLET data: "GI-01" /
  // "F26080001" show up under more than one GRN after a sequence
  // reset), so using the label as identity would either block a
  // legitimately different pallet that happens to share an old
  // label, or worse, fail to distinguish two different physical
  // pallets entirely. Only the DB id is safe to key on.
  const [issuedPalletIds, setIssuedPalletIds] = useState(new Set());

  // Required by the backend model — collected once per issuing
  // session, not per pallet row.
  const sessionUser = useMemo(() => getSessionUser(), []);
  const [issuedTo, setIssuedTo] = useState('');
  const issuedBy = sessionUser?.name || sessionUser?.username || sessionUser?.userName || 'Unknown';

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteTargetType, setDeleteTargetType] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [detailsMode, setDetailsMode] = useState('view');
  const [detailsRow, setDetailsRow] = useState(null);
  // Which grid the row being viewed/edited came from — needed so
  // Update knows whether to patch scannedRows or confirmedRows.
  const [detailsRowSource, setDetailsRowSource] = useState(null); // 'SCANNED' | 'CONFIRMED'
  const [grnType, setGrnType] = useState('GRN Entry');
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

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
        setIssuedPalletIds(new Set(pending.map((p) => p.palletId).filter((id) => id !== undefined && id !== null)));
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
  // Scanned Items, Confirmed Items, AND the persistent issuedPalletIds
  // set (pallets already saved to local DB, even after their grid
  // row was cleared). Keyed by the unique pallet `id`, not the
  // recyclable palletNo label — see issuedPalletIds comment above.
  const usedPalletIds = useMemo(() => {
    const used = new Set();
    scannedRows.forEach((r) => { if (r.palletId !== undefined && r.palletId !== null) used.add(r.palletId); });
    confirmedRows.forEach((r) => { if (r.palletId !== undefined && r.palletId !== null) used.add(r.palletId); });
    issuedPalletIds.forEach((id) => used.add(id));
    return used;
  }, [scannedRows, confirmedRows, issuedPalletIds]);

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

    // CHANGE_PART is a static counter card — it has no pallet pool
    // and doesn't drive the queue/dropdown filtering below.
    if (typeKey === 'CHANGE_PART') return;

    const matches = pallets.filter(
      (p) => (p.type || 'REGULAR').toUpperCase() === typeKey && !usedPalletIds.has(p.id)
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

  // "Select Part" now respects whichever summary card is active:
  //   - REGULAR active -> only REGULAR-type parts listed
  //   - SAMPLE active  -> only SAMPLE-type parts listed
  //   - nothing active -> every synced part listed (old behavior)
  const partOptions = useMemo(() => {
    const seen = new Map();

    const scoped = (activeType === 'REGULAR' || activeType === 'SAMPLE')
      ? pallets.filter((p) => (p.type || 'REGULAR').toUpperCase() === activeType)
      : pallets;

    scoped.forEach((p) => {
      if (!seen.has(p.itemId)) seen.set(p.itemId, p.partLabel || p.itemId);
    });

    return Array.from(seen.entries()).map(([itemId, partLabel]) => ({ itemId, partLabel }));
  }, [pallets, activeType]);

  const handlePartSelect = (itemId) => {

    const matches = pallets.filter(
      (p) => String(p.itemId) === String(itemId) && !usedPalletIds.has(p.id)
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

  };

  // ------------------------------------------
  // FIFO enforcement — for REGULAR type, only
  // the oldest unused pallet is allowed in.
  // ------------------------------------------

  const getNextRegularPallet = () => {
    const unusedRegular = pallets.filter(
      (p) => (p.type || 'REGULAR').toUpperCase() === 'REGULAR' && !usedPalletIds.has(p.id)
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

  const addScannedRow = ({ palletId, itemId, partLabel, palletNo, storeLocation, quantity, grnNo, remarks, type }) => {

    if (!itemId || !quantity || !palletNo) {
      toast.error('Scanned label is missing required fields (part, quantity or pallet number).');
      return false;
    }

    // palletId is the pallet's real unique database id, resolved by
    // the caller against synced data — it must always be present by
    // the time we get here. If it's missing, something upstream let
    // an unverified/unmatched pallet through, which is exactly what
    // we're trying to prevent.
    if (palletId === undefined || palletId === null) {
      toast.error('Internal error — this pallet has no verified identity and cannot be added. Please re-scan.');
      return false;
    }

    if (!issuedTo.trim()) {
      toast.error('Enter "Issued To" before scanning — required to save.');
      return false;
    }

    // Identity checks use the unique palletId, NOT the palletNo
    // label — palletNo/fifoPalletNo get recycled across different
    // GRNs, so checking by label alone could either wrongly block a
    // different, legitimate pallet that shares an old label, or
    // fail to catch a real duplicate.
    if (issuedPalletIds.has(palletId)) {
      toast.error(`Pallet ${palletNo} (GRN ${grnNo || '—'}) was already Issued and saved to this device. It cannot be scanned again until it's synced and re-stocked.`);
      return false;
    }

    if (usedPalletIds.has(palletId)) {
      toast.error(`Pallet ${palletNo} (GRN ${grnNo || '—'}) has already been scanned this session.`);
      return false;
    }

    // FIFO enforcement — a Regular pallet can only be scanned if it's
    // the oldest unused one. Compared by id, since two different
    // pallets can share the same displayed palletNo.
    if ((type || 'REGULAR').toUpperCase() === 'REGULAR') {
      const nextAllowed = getNextRegularPallet();
      if (nextAllowed && nextAllowed.id !== palletId) {
        toast.error(`FIFO order required — scan pallet ${nextAllowed.palletNo} (GRN ${nextAllowed.grnNo || '—'}) first (oldest in store).`);
        return false;
      }
    }

    const row = {
      id: `${Date.now()}`,
      palletId,
      itemId,
      partLabel: partLabel || itemId,
      grnNo: grnNo || '—',
      palletNo,
      location: storeLocation || '',
      qty: Number(quantity),
      remarks: remarks || '',
      type: (type || 'REGULAR').toUpperCase(),
      edited: false,
    };

    setScannedRows((rows) => [...rows, row]);
    toast.success(`Pallet ${palletNo} (GRN ${grnNo || '—'}) scanned.`);

    if (activeType && queue.length > 0) {
      const remaining = queue.filter((p) => p.id !== palletId);
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

  // Known, narrow corruption seen from the label printer: the "grn"
  // field is built with SQL-string syntax instead of JSON —
  //   {"grn";'260245','fifoPalletNo":"F26080001",...}
  // instead of the correct
  //   {"grn":"260245","fifoPalletNo":"F26080001",...}
  // This ONLY targets that exact shape (semicolon + single-quoted
  // value right after "grn"). It does not attempt to guess-fix
  // arbitrary broken JSON — if the payload doesn't match this exact
  // pattern, we don't touch it and let it fail normally. The real
  // fix belongs in whatever generates the QR/label content; this is
  // a stopgap so scanning isn't blocked while that gets fixed.
  const repairKnownGrnFieldBug = (value) =>
    value.replace(/"grn"\s*;\s*'([^']*)'\s*,/, '"grn":"$1",');

  const applyScannedPallet = (raw) => {

    if (!raw) return;

    let parsed;
    let wasRepaired = false;

    try {
      parsed = JSON.parse(raw);
    } catch (firstErr) {

      const repairedRaw = repairKnownGrnFieldBug(raw);

      try {
        parsed = JSON.parse(repairedRaw);
        wasRepaired = repairedRaw !== raw;
      } catch (secondErr) {
        // Still not parseable — show the actual raw value so the
        // real cause (a broken label template, not this app) is
        // obvious and reportable.
        toast.error(
          `Scanned code is not valid JSON — the label is malformed. ` +
          `Raw value: ${raw.length > 140 ? raw.slice(0, 140) + '…' : raw}`
        );
        resetScanInput();
        return;
      }

    }

    if (wasRepaired) {
      // Don't hide this — someone needs to know the label generator
      // is producing malformed output, even though this particular
      // scan was recovered.
      console.warn('Scanned label had a malformed "grn" field (SQL-style quoting) and was auto-repaired. The QR/label generator needs fixing.');
      toast.info('Label format was malformed but recovered — please report this to fix the label generator.');
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

    // Shape validation — the JSON can parse fine and still carry
    // garbage values (wrong type, empty string, negative/NaN qty).
    // Catch that here with a specific reason instead of failing
    // confusingly later (e.g. NaN silently reaching the grid).
    if (scannedGrn !== undefined && scannedGrn !== null &&
        typeof scannedGrn !== 'string' && typeof scannedGrn !== 'number') {
      toast.error('Scanned code has an invalid GRN value.');
      resetScanInput();
      return;
    }

    if (scannedQty !== undefined) {
      const qtyNum = Number(scannedQty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        toast.error('Scanned code has an invalid quantity — must be a positive number.');
        resetScanInput();
        return;
      }
    }

    // Build the set of ALL synced pallets whose label matches what
    // was scanned — NOT just the first one found. Because palletNo
    // and fifoPalletNo get recycled across different GRNs (confirmed
    // from your GRN_PALLET data: "GI-01" / "F26080001" appear under
    // more than one GRN after a sequence reset), a plain .find()
    // here would silently return whichever stale record happens to
    // come first — which is exactly how scanning "GI-01" surfaced
    // unrelated data ("GI-06") from a different pallet in the grid.
    const candidatesById = new Map();
    pallets.forEach((p) => {
      const labelMatches =
        (scannedPalletNo && p.palletNo === scannedPalletNo) ||
        (scannedFifoNo && p.fifoPalletNo === scannedFifoNo);
      if (labelMatches && p.id !== undefined && p.id !== null) {
        candidatesById.set(p.id, p);
      }
    });
    const candidates = Array.from(candidatesById.values());

    let match = null;

    if (candidates.length === 1) {

      match = candidates[0];

    } else if (candidates.length > 1) {

      // The label alone is ambiguous — more than one real pallet in
      // synced data shares it. Only the GRN on the label can break
      // the tie safely.
      if (!scannedGrn) {
        toast.error(
          `Pallet "${scannedPalletNo || scannedFifoNo}" is ambiguous — ${candidates.length} different pallets in synced data share this label ` +
          `(labels get reused across GRNs). This scan doesn't include a GRN to tell them apart — scan rejected. ` +
          `Ask for a label that includes the GRN number.`
        );
        resetScanInput();
        return;
      }

      const grnMatches = candidates.filter((p) => p.grnNo && String(p.grnNo) === String(scannedGrn));

      if (grnMatches.length === 1) {
        match = grnMatches[0];
      } else if (grnMatches.length === 0) {
        toast.error(
          `Pallet "${scannedPalletNo || scannedFifoNo}" was found under other GRNs, but none match GRN ${scannedGrn} from this label — scan rejected.`
        );
        resetScanInput();
        return;
      } else {
        // Should not happen (same label + same GRN twice), but don't
        // guess if it does.
        toast.error(
          `Pallet "${scannedPalletNo || scannedFifoNo}" under GRN ${scannedGrn} is still ambiguous in synced data — scan rejected. Run Data Sync and check for duplicate records.`
        );
        resetScanInput();
        return;
      }

    }

    if (match) {

      // Extra check: if the label carries a GRN number, and the
      // matched pallet's own GRN is known, they must agree. This
      // catches a label that happens to reuse a real pallet number
      // but was printed/edited for a different GRN. (For the
      // ambiguous-candidates path above, this is already guaranteed
      // by construction, but it's kept here as a safety net for the
      // single-candidate path too.)
      if (scannedGrn && match.grnNo && String(match.grnNo) !== String(scannedGrn)) {
        toast.error(
          `Pallet ${match.palletNo} belongs to GRN ${match.grnNo}, not ${scannedGrn} — scan rejected. Check the label.`
        );
        resetScanInput();
        return;
      }

      addScannedRow({
        palletId: match.id,
        itemId: match.itemId,
        partLabel: match.partLabel,
        palletNo: match.palletNo,
        storeLocation: scannedLocation || match.storeLocation,
        // Quantity always comes from synced data, never trusted
        // from the raw scan — a label can't be used to inflate or
        // shrink what's actually on record for this pallet.
        quantity: match.quantity,
        grnNo: match.grnNo || scannedGrn,
        type: match.type,
      });

      setActiveType(match.type || activeType);

    } else {

      // No match in synced data — this pallet/GRN either was never
      // created, wasn't posted/stuffed yet, or the label is wrong.
      // Do NOT fall back to trusting the raw scanned values; reject
      // it outright so bad/nonexistent GRNs can never reach the
      // Material Issue grid.
      toast.error(
        `Pallet "${scannedPalletNo || scannedFifoNo}" was not found in synced data. ` +
        `This GRN may not exist, may not be posted yet, or hasn't been synced to this device. ` +
        `Run Data Sync and try again — the scan was not added.`
      );

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

  const handleDeleteScanned = (row) => {
    setDeleteTarget(row);
    setDeleteTargetType('SCANNED');
    setShowDeleteModal(true);
  };

  const handleDeleteConfirmed = (row) => {
    setDeleteTarget(row);
    setDeleteTargetType('CONFIRMED');
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    if (deleteTargetType === 'SCANNED') {
      setScannedRows((rows) =>
        rows.filter((r) => r.id !== deleteTarget.id)
      );
    }

    if (deleteTargetType === 'CONFIRMED') {
      setConfirmedRows((rows) =>
        rows.filter((r) => r.id !== deleteTarget.id)
      );
    }

    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeleteTargetType(null);

    toast.success('Deleted Successfully');
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
          palletId: row.palletId,
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
      // set is NOT cleared, unlike confirmedRows below. Locked by
      // the unique palletId, not the palletNo label (which can be
      // recycled onto a different, legitimate pallet later).
      setIssuedPalletIds((prev) => {
        const next = new Set(prev);
        confirmedRows.forEach((row) => {
          if (row.palletId !== undefined && row.palletId !== null) next.add(row.palletId);
        });
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

    setGrnType(
      (row?.type || 'REGULAR').toUpperCase()
    );

    setDetailsOpen(true);
  };

  const openEdit = (row, source) => {
    setDetailsRow(row);
    setDetailsRowSource(source);
    setDetailsMode('edit');

    setGrnType(
      (row?.type || 'REGULAR').toUpperCase()
    );

    setEditForm({
      palletNo: row?.palletNo || '',
      partLabel: row?.partLabel || '',
      location: row?.location || '',
      qty: row?.qty ?? '',
    });

    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsRowSource(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  // Saves the Edit modal's fields back onto the row it came from,
  // flags the row as edited (drives the row highlight color), and
  // bumps the CHANGE PART counter. This previously did nothing —
  // "Update" just closed the modal without saving.
  const handleUpdateEdit = () => {

    if (!detailsRow) {
      closeDetails();
      return;
    }

    const updatedFields = {
      palletNo: (editForm.palletNo || '').trim() || detailsRow.palletNo,
      partLabel: (editForm.partLabel || '').trim() || detailsRow.partLabel,
      location: (editForm.location || '').trim(),
      qty: editForm.qty === '' ? detailsRow.qty : Number(editForm.qty),
      type: grnType,
      edited: true,
    };

    const patchRows = (rows) =>
      rows.map((r) => (r.id === detailsRow.id ? { ...r, ...updatedFields } : r));

    if (detailsRowSource === 'SCANNED') {
      setScannedRows(patchRows);
    } else if (detailsRowSource === 'CONFIRMED') {
      setConfirmedRows(patchRows);
    }

    setChangePartCount((c) => c + 1);
    toast.success('Pallet details updated.');
    closeDetails();

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
          <button
            type="button"
            className="mi-action-btn mi-action-view"
            onClick={() => openView(row)}
          >
            <FaEye />
          </button>

          <button
            type="button"
            className="mi-action-btn mi-action-edit"
            onClick={() => openEdit(row, 'SCANNED')}
          >
            <FaEdit />
          </button>

          <button
            type="button"
            className="mi-action-btn mi-action-delete"
            onClick={() => handleDeleteScanned(row)}
          >
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
          <button
            type="button"
            className="mi-action-btn mi-action-view"
            onClick={() => openView(row)}
          >
            <FaEye />
          </button>

          <button
            type="button"
            className="mi-action-btn mi-action-edit"
            onClick={() => openEdit(row, 'CONFIRMED')}
          >
            <FaEdit />
          </button>

          <button
            type="button"
            className="mi-action-btn mi-action-delete"
            onClick={() => handleDeleteConfirmed(row)}
          >
            <FaTrash />
          </button>
        </div>
      ),
      width: '110px',
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

        {/* SUMMARY CARDS — REGULAR / SAMPLE / CHANGE PART */}

        <div className="mi-summary-row mi-summary-row-3">
          {SUMMARY_CONFIG.map((card) => {
            const Icon = card.icon;
            const isChangePart = card.key === 'CHANGE_PART';
            const isActive = activeType === card.key;

            const value = isChangePart
              ? changePartCount
              : (palletsLoaded ? summaryCounts[card.key] : '—');

            const sub = isChangePart
              ? 'Edited pallets'
              : (isActive ? `${queue.length} remaining` : 'Pallets');

            return (
              <button
                type="button"
                key={card.key}
                className={`mi-summary-card mi-tone-${card.tone} ${isActive ? 'mi-summary-active' : ''} ${isChangePart ? 'mi-summary-static' : ''}`}
                onClick={() => handleSummaryCardClick(card.key)}
              >
                <div className="mi-summary-icon"><Icon /></div>
                <div className="mi-summary-label">{card.label}</div>
                <div className="mi-summary-value">{value}</div>
                <div className="mi-summary-unit">{sub}</div>
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
            a row by itself; only a scanned label adds to the grid.
            Options are scoped to the active summary card (REGULAR /
            SAMPLE) when one is selected. */}

        <div className="mi-field">
          <label className="mi-label">
            Select Part <span className="mi-req">*</span>
            {(activeType === 'REGULAR' || activeType === 'SAMPLE') && (
              <span className="mi-scope-hint"> ({activeType})</span>
            )}
          </label>

          <Select
            classNamePrefix="react-select"
            placeholder={
              palletsLoaded
                ? 'Select part number'
                : 'Loading synced parts…'
            }
            options={partOptions.map((p) => ({
              value: p.itemId,
              label: p.partLabel,
            }))}
            value={
              partOptions
                .map((p) => ({
                  value: p.itemId,
                  label: p.partLabel,
                }))
                .find(
                  (option) =>
                    String(option.value) === String(form.itemId)
                ) || null
            }
            onChange={(selected) =>
              handlePartSelect(selected?.value || '')
            }
            isClearable
            isDisabled={!palletsLoaded}
          />
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
            conditionalRowStyles={conditionalRowStyles}
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
            conditionalRowStyles={conditionalRowStyles}
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
              <span
                className={`mi-grn-type-badge ${String(grnType).toUpperCase() === 'SAMPLE'
                  ? 'sample'
                  : 'regular'
                  }`}
              >
                {String(grnType).toUpperCase()}
              </span>
            ) : (
              <CFormSelect
                value={grnType}
                onChange={(e) => setGrnType(e.target.value)}
              >
                {GRN_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </CFormSelect>
            )}
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Pallet No.</div>
            {detailsMode === 'view' ? (
              <div className="mi-modal-value">{detailsRow?.palletNo}</div>
            ) : (
              <CFormInput
                value={editForm.palletNo}
                onChange={(e) => setEditForm((f) => ({ ...f, palletNo: e.target.value }))}
              />
            )}
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Part Details</div>
            {detailsMode === 'view' ? (
              <div className="mi-modal-value">{detailsRow?.partLabel}</div>
            ) : (
              <CFormInput
                value={editForm.partLabel}
                onChange={(e) => setEditForm((f) => ({ ...f, partLabel: e.target.value }))}
              />
            )}
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Location</div>
            {detailsMode === 'view' ? (
              <div className="mi-modal-value">{detailsRow?.location}</div>
            ) : (
              <CFormInput
                value={editForm.location}
                onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
              />
            )}
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Quantity</div>
            {detailsMode === 'view' ? (
              <div className="mi-modal-value">{detailsRow?.qty}</div>
            ) : (
              <CFormInput
                type="number"
                value={editForm.qty}
                onChange={(e) => setEditForm((f) => ({ ...f, qty: e.target.value }))}
              />
            )}
          </div>

        </CModalBody>

        <CModalFooter>
          {detailsMode === 'view' ? (
            <CButton
              type="button"
              className="mi-modal-close-btn"
              onClick={closeDetails}
            >
              Close
            </CButton>
          ) : (
            <>
              <CButton color="primary" variant="outline" className="flex-fill mi-modal-cancel-btn" onClick={closeDetails}>
                Cancel
              </CButton>
              <CButton color="primary" className="flex-fill mi-modal-update-btn" onClick={handleUpdateEdit}>
                Update
              </CButton>
            </>
          )}
        </CModalFooter>

      </CModal>

      <CModal
        visible={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
          setDeleteTargetType(null);
        }}
        alignment="center"
        backdrop="static"
      >
        <CModalHeader className="border-0">
          <CModalTitle className="w-100 text-center text-danger fw-bold">
            ⚠ Confirm Delete
          </CModalTitle>
        </CModalHeader>

        <CModalBody className="text-center">
          <p>
            Are you sure you want to delete this pallet?
          </p>

          <div className="mi-delete-info">
            <div>
              <strong>Pallet No. :</strong>{' '}
              <span>{deleteTarget?.palletNo || '-'}</span>
            </div>

            <div>
              <strong>GRN No. :</strong>{' '}
              <span>{deleteTarget?.grnNo || '-'}</span>
            </div>

            <div>
              <strong>GRN Type :</strong>{' '}
              <span>
                {(deleteTarget?.type || 'REGULAR').toUpperCase()}
              </span>
            </div>
          </div>
        </CModalBody>

        <CModalFooter className="border-0 d-flex justify-content-center gap-2">
          <CButton
            className="mi-delete-cancel-btn"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteTarget(null);
              setDeleteTargetType(null);
            }}
          >
            Cancel
          </CButton>

          <CButton
            className="mi-delete-confirm-btn"
            onClick={confirmDelete}
          >
            Delete
          </CButton>
        </CModalFooter>
      </CModal>

    </div>
  );
};

export default MaterialIssue;
