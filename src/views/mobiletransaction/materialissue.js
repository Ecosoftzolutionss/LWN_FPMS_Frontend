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
  FaEdit,
  FaCube,
  FaClipboardCheck,
  FaSyncAlt,
  FaTimes,
} from 'react-icons/fa';
import Select from 'react-select';
import { Tooltip } from 'react-tooltip';

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

// Quantity is used only as the requested issue quantity for FIFO
// highlighting. The actual pallet quantity always comes from synced data.
const EMPTY_FORM = {
  itemId: '',
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


const conditionalRowStyles = [
  {
    when: (row) => !!row.edited,
    style: {
      backgroundColor: '#fff7e6',
      borderLeft: '3px solid #f59e0b',
    },
  },
];

const searchConditionalRowStyles = [
  {
    when: (row) => row.fifoMatched === true,
    style: {
      backgroundColor: '#dcfce7',
      color: '#166534',
      fontWeight: 600,
      borderLeft: '4px solid #22c55e',
    },
  },
];
// The MaterialIssue backend model requires IssuedBy. Pull it from
// the logged-in session rather than re-typing it every time.
// The Item No / Item Name grid columns need to show the human part
// code (e.g. "PKG-005") and its description (e.g. "Self Adhesive
// Packaging") separately — but the only field we get per pallet is
// partLabel, which comes through as "PKG-005 - Self Adhesive
// Packaging". Split on the first " - " to recover both; itemId is
// the internal DB key and was never meant to be shown as "Item No."
const splitPartLabel = (label) => {
  if (!label) return { itemNo: '', itemName: '' };
  const idx = label.indexOf(' - ');
  if (idx === -1) return { itemNo: label, itemName: label };
  return { itemNo: label.slice(0, idx).trim(), itemName: label.slice(idx + 3).trim() };
};

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
// Flow:
//   1. Select a Part + Quantity -> all unused pallets for that part
//      currently in Store appear in Search Parts, ordered FIFO by
//      Store Movement date. The FIFO pallets needed to satisfy the
//      requested quantity are highlighted green.
//   2. Click a Search Parts row -> it is validated and goes directly
//      to Confirmed Parts.
//      -- OR --
//      Scan a valid label -> it is validated and goes directly to
//      Confirmed Parts.
//   3. Click "Issue Material" -> Confirmed Parts are saved to the
//      local offline queue.
// ==========================================

const MaterialIssue = () => {
  const navigate = useNavigate();

  const [pallets, setPallets] = useState([]);
  const [palletsLoaded, setPalletsLoaded] = useState(false);

  const [activeType, setActiveType] = useState(null); // 'REGULAR' | 'SAMPLE' | null
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const [form, setForm] = useState(EMPTY_FORM);

  // Results of the manual "Select Part" + "Search" flow — populated
  // by handleSearchParts, cleared by handleClearSearch or once a
  // part is changed.
  const [searchResults, setSearchResults] = useState([]);

  // Validated scans and Search-row clicks go directly to Confirmed Parts.
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

  // Quantity already queued for issue on this device, keyed by
  // the real GrnPalletId. A pallet remains available until its
  // remaining stock reaches zero.
  const [pendingIssueQtyByPallet, setPendingIssueQtyByPallet] = useState(new Map());

  // Required by the backend model — collected once per issuing
  // session, not per pallet row.
  const sessionUser = useMemo(() => getSessionUser(), []);
  const [issuedTo, setIssuedTo] = useState('');
  const issuedBy = sessionUser?.name || sessionUser?.username || sessionUser?.userName || 'Unknown';

  // Search-row Issue Quantity modal.
  // It lets the user issue only the quantity required from the
  // selected pallet, instead of automatically taking the full pallet.
  const [issueQtyModalOpen, setIssueQtyModalOpen] = useState(false);
  const [issueQtyTarget, setIssueQtyTarget] = useState(null);
  const [issueQty, setIssueQty] = useState('');

  // Edit-only details modal for Confirmed Parts.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState(null);
  const [grnType, setGrnType] = useState('REGULAR');
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const [saving, setSaving] = useState(false);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    window.dispatchEvent(new Event('authChange'));
    navigate('/login', { replace: true });
  };

  const scanInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [cached, pending] = await Promise.all([
          getAllPallets(),
          getAllPendingIssues(),
        ]);

        const pendingMap = new Map();

        (pending || []).forEach((p) => {
          const palletId = p.palletId ?? p.grnPalletId;
          const qty = Number(p.quantity || 0);

          if (
            palletId !== undefined &&
            palletId !== null &&
            Number.isFinite(qty) &&
            qty > 0
          ) {
            pendingMap.set(
              palletId,
              (pendingMap.get(palletId) || 0) + qty
            );
          }
        });

        setPendingIssueQtyByPallet(pendingMap);

        // Cached quantity minus pending offline issues = current
        // quantity available on this device.
        const adjusted = (cached || [])
          .map((p) => {
            const originalQty = Number(p.quantity || 0);
            const pendingQty = Number(pendingMap.get(p.id) || 0);

            return {
              ...p,
              originalQuantity: originalQty,
              quantity: Math.max(originalQty - pendingQty, 0),
            };
          })
          .filter((p) => Number(p.quantity || 0) > 0);

        setPallets(adjusted);

        // Only fully exhausted pallets are locked.
        setIssuedPalletIds(
          new Set(
            (cached || [])
              .filter((p) => {
                const originalQty = Number(p.quantity || 0);
                const pendingQty = Number(pendingMap.get(p.id) || 0);
                return originalQty > 0 && pendingQty >= originalQty;
              })
              .map((p) => p.id)
          )
        );
      } catch (err) {
        console.error('Failed to load material issue stock:', err);
      } finally {
        setPalletsLoaded(true);
      }
    };

    load();
  }, []);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const refocusScanInput = () => {
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };


  const usedPalletIds = useMemo(() => {
    const used = new Set();
    confirmedRows.forEach((r) => { if (r.palletId !== undefined && r.palletId !== null) used.add(r.palletId); });
    issuedPalletIds.forEach((id) => used.add(id));
    return used;
  }, [confirmedRows, issuedPalletIds]);

  // Drop any search result that has since been used (scanned,
  // confirmed, or issued) so the grid never offers a pallet the
  // user can't actually add anymore.
  useEffect(() => {
    setSearchResults((rows) => rows.filter((r) => !usedPalletIds.has(r.id)));
  }, [usedPalletIds]);

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
    if (typeKey === 'CHANGE_PART') return;

    const matches = pallets.filter(
      (p) =>
        (p.type || 'REGULAR').toUpperCase() === typeKey &&
        !usedPalletIds.has(p.id)
    );

    const ordered =
      typeKey === 'REGULAR'
        ? [...matches].sort(
          (a, b) =>
            new Date(a.movementDate) - new Date(b.movementDate)
        )
        : matches;

    setActiveType(typeKey);
    setQueue(ordered);
    setQueueIndex(0);

    // Do NOT auto-select the first part.
    // User must manually select the Part.
    setForm((f) => ({ ...f, itemId: '', quantity: '' }));
    setSearchResults([]);
  };

  // "Select Part" now always lists every synced part — no REGULAR /
  // SAMPLE scoping. Which physical pallet gets attached to a part
  // is decided by Search (below) or by scanning a label directly.
  const partOptions = useMemo(() => {
    const seen = new Map();

    pallets.forEach((p) => {
      if (!seen.has(p.itemId)) seen.set(p.itemId, p.partLabel || p.itemId);
    });

    return Array.from(seen.entries()).map(([itemId, partLabel]) => ({ itemId, partLabel }));
  }, [pallets]);

  const handlePartSelect = (itemId) => {
    setForm((f) => ({ ...f, itemId }));
    setSearchResults([]);
  };

  // ------------------------------------------
  // FIFO enforcement — for REGULAR type, only
  // the oldest unused pallet is allowed in.
  // ------------------------------------------

  const getNextRegularPallet = (itemId = null) => {
    const unusedRegular = pallets.filter((p) => {
      if ((p.type || 'REGULAR').toUpperCase() !== 'REGULAR') return false;
      if (usedPalletIds.has(p.id)) return false;

      // FIFO is PART-WISE. Another part must never block this part.
      if (itemId !== null && itemId !== undefined && itemId !== '') {
        if (String(p.itemId) !== String(itemId)) return false;
      }

      return true;
    });

    if (unusedRegular.length === 0) return null;

    // Use the Store Movement date supplied by the current API.
    return [...unusedRegular].sort(
      (a, b) =>
        new Date(a.movementDate || 0) -
        new Date(b.movementDate || 0)
    )[0];
  };

  // ------------------------------------------
  // SEARCH — "Select Part" + Quantity + "Search"
  // button. Lists every unused synced pallet for
  // the chosen part whose available Max Qty can
  // cover the requested Quantity (oldest first)
  // in the Search Parts grid below. Quantity is
  // a FILTER only — nothing is added to Scanned
  // Items until the user clicks Add on a
  // specific row, and that row's real Qty always
  // comes from the matched pallet's own synced
  // value, never from this typed-in number.
  // ------------------------------------------

  const handleSearchParts = () => {
    if (!form.itemId) {
      toast.error('Select a part first.');
      return;
    }

    const requestedQty = Number(form.quantity);

    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      toast.error('Enter a valid quantity to search by.');
      return;
    }

    // ---------------------------------------------------------
    // Get ALL unused pallets for the selected PART.
    // Do NOT filter pallet quantity against requested quantity.
    // We need all pallets displayed so the user can see the
    // complete FIFO/store-movement sequence.
    // ---------------------------------------------------------
    const matches = pallets.filter((p) => {
      if (String(p.itemId) !== String(form.itemId)) {
        return false;
      }

      if (usedPalletIds.has(p.id)) {
        return false;
      }

      return true;
    });

    if (matches.length === 0) {
      toast.error('No available pallets found for this part.');
      setSearchResults([]);
      return;
    }

    // ---------------------------------------------------------
    // FIFO order = oldest Store Movement date first.
    // All pallets for the selected PART are shown.
    // ---------------------------------------------------------
    const ordered = [...matches].sort(
      (a, b) =>
        new Date(a.movementDate || 0) -
        new Date(b.movementDate || 0)
    );

    // ---------------------------------------------------------
    // Calculate cumulative quantity.
    //
    // Example:
    // Requested Qty = 100
    //
    // Pallet 1 = 40  -> GREEN
    // Pallet 2 = 35  -> GREEN
    // Pallet 3 = 25  -> GREEN
    // Pallet 4 = 50  -> NORMAL
    //
    // Once cumulative quantity reaches requested quantity,
    // remaining pallets stay normal.
    // ---------------------------------------------------------
    let cumulativeQty = 0;
    let quantitySatisfied = false;

    const highlightedRows = ordered.map((p) => {
      const palletQty = Number(p.quantity || 0);

      let fifoMatch = false;

      if (!quantitySatisfied && palletQty > 0) {
        fifoMatch = true;

        cumulativeQty += palletQty;

        if (cumulativeQty >= requestedQty) {
          quantitySatisfied = true;
        }
      }

      return {
        ...p,

        // UI-only values
        fifoMatched: fifoMatch,
        cumulativeQty,
        requestedQty,
      };
    });

    setSearchResults(highlightedRows);
  };

  const handleClearSearch = () => {
    // Clear both Search Parts and Confirmed Parts.
    setForm(EMPTY_FORM);
    setSearchResults([]);
    setConfirmedRows([]);

    // Close any open modal and reset its state.
    setIssueQtyModalOpen(false);
    setIssueQtyTarget(null);
    setIssueQty('');
    setDetailsOpen(false);
    setDetailsRow(null);
    setEditForm(EMPTY_EDIT_FORM);

    setActiveType(null);
    setQueue([]);
    setQueueIndex(0);

    toast.info('Search and Confirmed Parts cleared.');
    refocusScanInput();
  };

  // ------------------------------------------
  // VALIDATED PALLET — a scan or Search-row click
  // goes directly into Confirmed Parts.
  // ------------------------------------------

  const addConfirmedRow = ({ palletId, itemId, partLabel, palletNo, storeLocation, quantity, grnNo, remarks, type, movementDate }) => {

    if (!itemId || !quantity || !palletNo) {
      toast.error('This pallet is missing required fields (part, quantity or pallet number).');
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

    // Identity checks use the unique palletId, NOT the palletNo
    // label — palletNo/fifoPalletNo get recycled across different
    // GRNs, so checking by label alone could either wrongly block a
    // different, legitimate pallet that shares an old label, or
    // fail to catch a real duplicate.
    if (issuedPalletIds.has(palletId)) {
      toast.error(`Pallet ${palletNo} (GRN ${grnNo || '—'}) was already Issued and saved to this device. It cannot be added again until it's synced and re-stocked.`);
      return false;
    }

    if (usedPalletIds.has(palletId)) {
      toast.error(`Pallet ${palletNo} (GRN ${grnNo || '—'}) has already been added this session.`);
      return false;
    }

    // FIFO enforcement — a Regular pallet can only be added if it's
    // the oldest unused one. Compared by id, since two different
    // pallets can share the same displayed palletNo.
    if ((type || 'REGULAR').toUpperCase() === 'REGULAR') {
      const nextAllowed = getNextRegularPallet(itemId);
      if (nextAllowed && nextAllowed.id !== palletId) {
        toast.error(`FIFO order required — add pallet ${nextAllowed.palletNo} (GRN ${nextAllowed.grnNo || '—'}) first (oldest in store).`);
        return false;
      }
    }

    const row = {
      id: `${Date.now()}-${palletId}`,
      palletId,
      itemId,
      partLabel: partLabel || itemId,
      grnNo: grnNo || '—',
      movementDate: movementDate || null,
      palletNo,
      storeLocation: storeLocation || '',
      location: storeLocation || '',
      quantity: Number(quantity),
      qty: Number(quantity),
      remarks: remarks || '',
      type: (type || 'REGULAR').toUpperCase(),
      edited: false,
    };

    // Validated scan/search row goes directly to Confirmed Parts.
    setConfirmedRows((rows) => [...rows, row]);
    toast.success(`Pallet ${palletNo} (GRN ${grnNo || '—'}) confirmed.`);

    if (activeType && queue.length > 0) {
      const remaining = queue.filter((p) => p.id !== palletId);
      setQueue(remaining);
      if (remaining.length === 0) {
        setActiveType(null);
      }
      setQueueIndex(0);
    }

    return true;

  };

  // ------------------------------------------
  // SEARCH ROW -> ISSUE QUANTITY MODAL
  // ------------------------------------------
  // Clicking a Search Parts row does NOT immediately add the
  // complete pallet quantity. First open the Issue Quantity modal.
  //
  // Example:
  // Requested = 21
  // Pallet 1 available = 20 -> modal defaults Issue Qty = 20
  // Pallet 2 available = 6  -> modal defaults Issue Qty = 1
  // ------------------------------------------

  const getRemainingRequestedQty = (itemId) => {
    const requested = Number(form.quantity);

    if (!Number.isFinite(requested) || requested <= 0) {
      return 0;
    }

    const alreadyConfirmed = confirmedRows
      .filter((r) => String(r.itemId) === String(itemId))
      .reduce((sum, r) => sum + Number(r.qty || 0), 0);

    return Math.max(requested - alreadyConfirmed, 0);
  };

  const openIssueQtyModal = (row) => {
    if (!row) return;

    // Prevent manual Search Parts clicks from bypassing FIFO.
    // Only the current FIFO pallet for the part may open the modal.
    if (
      (row.type || 'REGULAR').toUpperCase() === 'REGULAR' &&
      row.fifoMatched !== true
    ) {
      const nextAllowed = getNextRegularPallet(row.itemId);

      if (nextAllowed && nextAllowed.id !== row.id) {
        toast.error(
          `FIFO order required — select pallet ${nextAllowed.palletNo} ` +
          `(GRN ${nextAllowed.grnNo || '—'}) first.`
        );
        return;
      }
    }

    const remainingQty = getRemainingRequestedQty(row.itemId);
    const availableQty = Number(row.quantity || 0);

    if (remainingQty <= 0) {
      toast.info('The requested quantity has already been satisfied.');
      return;
    }

    if (!Number.isFinite(availableQty) || availableQty <= 0) {
      toast.error('This pallet has no available quantity.');
      return;
    }

    // Never allow the default Issue Qty to exceed either:
    // 1. the pallet's available quantity, or
    // 2. the user's remaining requested quantity.
    const defaultIssueQty = Math.min(availableQty, remainingQty);

    setIssueQtyTarget(row);
    setIssueQty(String(defaultIssueQty));
    setIssueQtyModalOpen(true);
  };

  const closeIssueQtyModal = () => {
    setIssueQtyModalOpen(false);
    setIssueQtyTarget(null);
    setIssueQty('');
  };

  const handleAddFromIssueQtyModal = () => {
    if (!issueQtyTarget) return;

    const requestedQty = Number(form.quantity);
    const availableQty = Number(issueQtyTarget.quantity || 0);
    const enteredQty = Number(issueQty);
    const remainingQty = getRemainingRequestedQty(issueQtyTarget.itemId);

    if (!Number.isFinite(enteredQty) || enteredQty <= 0) {
      toast.error('Enter a valid Issue Qty.');
      return;
    }

    if (enteredQty > availableQty) {
      toast.error(`Issue Qty cannot exceed available quantity ${availableQty}.`);
      return;
    }

    if (enteredQty > remainingQty) {
      toast.error(`Issue Qty cannot exceed the remaining requested quantity ${remainingQty}.`);
      return;
    }

    // Keep the original FIFO / duplicate / validation rules.
    const added = addConfirmedRow({
      palletId: issueQtyTarget.id,
      itemId: issueQtyTarget.itemId,
      partLabel: issueQtyTarget.partLabel,
      palletNo: issueQtyTarget.palletNo,
      storeLocation: issueQtyTarget.storeLocation,
      quantity: enteredQty,
      grnNo: issueQtyTarget.grnNo,
      remarks: form.remarks,
      type: issueQtyTarget.type,
      movementDate: issueQtyTarget.movementDate,
    });

    if (added) {
      setSearchResults((rows) =>
        rows.filter((r) => r.id !== issueQtyTarget.id)
      );
      closeIssueQtyModal();
    }
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

      // FIFO CHECK MUST HAPPEN IMMEDIATELY AFTER SCAN.
      // For REGULAR stock FIFO is PART-WISE: only the oldest
      // available pallet for the scanned part may be scanned next.
      // This check runs before opening the Issue Qty modal.
      const matchType = (match.type || 'REGULAR').toUpperCase();

      if (matchType === 'REGULAR') {
        const nextAllowed = getNextRegularPallet(match.itemId);

        if (nextAllowed && nextAllowed.id !== match.id) {
          toast.error(
            `FIFO order required — scan pallet ${nextAllowed.palletNo} ` +
            `(GRN ${nextAllowed.grnNo || '—'}) first. ` +
            `It is the oldest available pallet for part ` +
            `${splitPartLabel(match.partLabel).itemNo || match.itemId}.`
          );
          resetScanInput();
          return;
        }
      }

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

      // Scan identifies the verified pallet only.
      // Do not add the complete pallet quantity automatically.
      openIssueQtyModal({
        ...match,
        storeLocation: scannedLocation || match.storeLocation,
        grnNo: match.grnNo || scannedGrn,
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
  // CONFIRMED ITEMS — direct result of a valid
  // scan or Search Parts row click.
  // ------------------------------------------

  // ------------------------------------------
  // STEP 3 — Issue Material saves every row in
  // Confirmed Parts to the LOCAL offline DB.
  // Field names match the backend MaterialIssue
  // model exactly: ItemId, Quantity, IssuedTo,
  // IssuedBy, StoreLocation, PalletNo,
  // GrnNumber, Remarks.
  // ------------------------------------------

  const handleIssueMaterial = async () => {

    if (confirmedRows.length === 0) {
      toast.error('Add at least one pallet to Confirmed Parts before issuing.');
      return;
    }

    // Issued To is validated ONLY when the user clicks Issue Material.
    // It is not required while adding/searching/confirming pallets.
    if (!issuedTo || !issuedTo.trim()) {
      toast.error('Please enter Issued To before clicking Issue Material.');
      return;
    }

    setSaving(true);

    try {

      for (const row of confirmedRows) {
        await queuePendingIssue({
          palletId: row.palletId,
          grnPalletId: row.palletId,
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

      // Update this device's stock immediately.
      // A partially consumed pallet remains available for its
      // remaining quantity.
      const newlyIssuedByPallet = new Map();

      confirmedRows.forEach((row) => {
        const id = row.palletId;
        const qty = Number(row.qty || 0);

        if (
          id !== undefined &&
          id !== null &&
          Number.isFinite(qty) &&
          qty > 0
        ) {
          newlyIssuedByPallet.set(
            id,
            (newlyIssuedByPallet.get(id) || 0) + qty
          );
        }
      });

      setPendingIssueQtyByPallet((prev) => {
        const next = new Map(prev);

        newlyIssuedByPallet.forEach((qty, id) => {
          next.set(id, (next.get(id) || 0) + qty);
        });

        return next;
      });

      setPallets((prev) =>
        prev
          .map((p) => {
            const issuedNow = Number(newlyIssuedByPallet.get(p.id) || 0);

            return issuedNow
              ? {
                ...p,
                quantity: Math.max(
                  Number(p.quantity || 0) - issuedNow,
                  0
                ),
              }
              : p;
          })
          .filter((p) => Number(p.quantity || 0) > 0)
      );

      setSearchResults([]);
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

  const openEdit = (row) => {
    setDetailsRow(row);

    setGrnType(
      (row?.type || 'REGULAR').toUpperCase()
    );

    setEditForm({
      palletNo: row?.palletNo || '',
      partLabel: row?.partLabel || '',
      location: row?.location || '',
      qty: row?.qty ?? row?.quantity ?? '',
    });

    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsRow(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  // Saves only the Confirmed Parts row being edited.
  const handleUpdateEdit = () => {
    if (!detailsRow) {
      closeDetails();
      return;
    }

    const enteredQty =
      editForm.qty === ''
        ? Number(detailsRow.qty ?? detailsRow.quantity)
        : Number(editForm.qty);

    if (!Number.isFinite(enteredQty) || enteredQty <= 0) {
      toast.error('Enter a valid quantity greater than 0.');
      return;
    }
    const updatedFields = {
      palletNo: (editForm.palletNo || '').trim() || detailsRow.palletNo,
      partLabel: (editForm.partLabel || '').trim() || detailsRow.partLabel,
      location: (editForm.location || '').trim(),
      storeLocation: (editForm.location || '').trim(),
      quantity: enteredQty,
      qty: enteredQty,
      type: grnType,
      edited: true,
    };

    setConfirmedRows((rows) =>
      rows.map((r) =>
        r.id === detailsRow.id
          ? { ...r, ...updatedFields }
          : r
      )
    );
    setChangePartCount((c) => c + 1);
    toast.success('Pallet details updated.');
    closeDetails();
  };
  // ---------------------------------------------------------
  // GRID TOOLTIP
  // ---------------------------------------------------------
  // Shows the complete cell value when the mouse is placed over a
  // grid cell. The displayed text stays compact so long values do
  // not make the table unnecessarily wide.
  const GridTooltipCell = ({ value, id }) => {
    const displayValue =
      value === undefined || value === null || value === ''
        ? '—'
        : String(value);

    return (
      <>
        <div
          data-tooltip-id={id}
          data-tooltip-content={displayValue}
          style={{
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'help',
          }}
        >
          {displayValue}
        </div>
      </>
    );
  };

  const partGridColumns = [
    {
      name: 'GRN No.',
      selector: (row) => row.grnNo || '—',
      cell: (row) => (
        <GridTooltipCell
          id="material-issue-grid-tooltip"
          value={row.grnNo}
        />
      ),
      sortable: true,
    },
    {
      name: 'GR Date',
      selector: (row) =>
        row.movementDate
          ? new Date(row.movementDate).toLocaleDateString()
          : '—',
      cell: (row) => (
        <GridTooltipCell
          id="material-issue-grid-tooltip"
          value={
            row.movementDate
              ? new Date(row.movementDate).toLocaleDateString()
              : '—'
          }
        />
      ),
      sortable: true,
    },
    {
      name: 'Pallet No.',
      selector: (row) => row.palletNo || '—',
      cell: (row) => (
        <GridTooltipCell
          id="material-issue-grid-tooltip"
          value={row.palletNo}
        />
      ),
      sortable: true,
    },
    {
      name: 'Part No.',
      selector: (row) =>
        splitPartLabel(row.partLabel).itemNo || row.itemId,
      cell: (row) => (
        <GridTooltipCell
          id="material-issue-grid-tooltip"
          value={splitPartLabel(row.partLabel).itemNo || row.itemId}
        />
      ),
      sortable: true,
    },
    {
      name: 'Part Name',
      selector: (row) =>
        splitPartLabel(row.partLabel).itemName,
      cell: (row) => (
        <GridTooltipCell
          id="material-issue-grid-tooltip"
          value={splitPartLabel(row.partLabel).itemName}
        />
      ),
      sortable: true,
    },
    {
      name: 'Location',
      selector: (row) =>
        row.storeLocation ?? row.location ?? '—',
      cell: (row) => (
        <GridTooltipCell
          id="material-issue-grid-tooltip"
          value={row.storeLocation ?? row.location ?? '—'}
        />
      ),
      sortable: true,
    },
    {
      name: 'Quantity',
      selector: (row) =>
        row.quantity ?? row.qty ?? 0,
      cell: (row) => (
        <GridTooltipCell
          id="material-issue-grid-tooltip"
          value={row.quantity ?? row.qty ?? 0}
        />
      ),
      sortable: true,
      width: '90px',
    },
  ];

  const searchColumns = partGridColumns;

  const confirmedColumns = [
    ...partGridColumns,
    {
      name: 'Action',
      cell: (row) => (
        <div className="mi-row-actions">
          <button
            type="button"
            className="mi-action-btn mi-action-edit"
            onClick={() => openEdit(row)}
            title="Edit"
            aria-label="Edit pallet"
          >
            <FaEdit />
          </button>
        </div>
      ),
      width: '70px',
    },
  ];

  return (
    <div className="mi-page">
      <Tooltip
        id="material-issue-grid-tooltip"
        place="top"
        delayShow={250}
        style={{
          zIndex: 9999,
          maxWidth: '420px',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      />


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

        <button
          type="button"
          className="mi-icon-btn"
          aria-label="Logout"
          onClick={handleLogout}
        >
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
                <div className="mi-summary-top">
                  <span className="mi-summary-icon"><Icon /></span>
                  <span className="mi-summary-label">{card.label}</span>
                </div>
                <div className="mi-summary-bottom">
                  <span className="mi-summary-value">{value}</span>
                  <span className="mi-summary-unit">{sub}</span>
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

        {/* SELECT PART + QUANTITY — always lists every synced part.
            Quantity is a search filter (only pallets whose Max Qty
            covers it will show up) — it does NOT get saved onto a
            row; the row's real Qty always comes from the matched
            pallet's own synced value. Search fills the Search Parts
            grid below; nothing is added until the user clicks Add
            on a row. */}

        <div className="mi-grid-2">
          <div className="mi-field">
            <label className="mi-label">
              Select Part <span className="mi-req">*</span>
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

          <div className="mi-field">
            <label className="mi-label">Quantity</label>
            <input
              type="number"
              className="mi-input-real"
              placeholder="Enter quantity"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </div>
        </div>

        <div className="mi-search-actions">
          <button
            type="button"
            className="mi-search-btn"
            onClick={handleSearchParts}
            disabled={!form.itemId}
          >
            <FaSearch /> Search
          </button>

          <button
            type="button"
            className="mi-clear-btn"
            onClick={handleClearSearch}
          >
            <FaTimes /> Clear All
          </button>
        </div>

        {/* REMARKS — free-text, applies to whatever gets added next
            (scan or Search-result Add). */}



        {/* SEARCH PARTS GRID — result of Select Part + Search */}

        <div className="mi-section-title">Search Parts</div>
        {searchResults.length > 0 && (
          <div className="mi-search-hint">Tap a pallet row to enter the Issue Qty</div>
        )}

        <div className="mi-table-wrap">
          <DataTable
            columns={searchColumns}
            data={searchResults}
            customStyles={tableCustomStyles}
            conditionalRowStyles={searchConditionalRowStyles}
            onRowClicked={(row) => openIssueQtyModal(row)}
            pointerOnHover
            highlightOnHover
            noHeader
            dense
            noDataComponent={
              <div className="mi-empty-grid">
                Select a part and enter quantity, then click Search
              </div>
            }
          />
        </div>

        {/* SCAN PALLET / GRN — scan identifies pallet and opens Issue Qty modal */}

        <div className="mi-field">
          <label className="mi-label">Scan Pallet / GRN Label</label>
          <div className="mi-scan-input">
            <input
              ref={scanInputRef}
              className="mi-scan-input-inner"
              placeholder="Scan a label — enter Issue Qty"
              value={form.grnNo}
              onChange={handleScanInputChange}
              onKeyDown={handleScanInputKeyDown}
              autoFocus
            />
            <FaQrcode className="mi-scan-icon" />
          </div>
        </div>

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


        {/* CONFIRMED ITEMS GRID — valid scan/search rows, saved on Issue Material */}

        <div className="mi-section-title">Confirmed Parts</div>

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
          saves Confirmed Parts to local DB
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
          ISSUE QUANTITY MODAL
          Opens when a Search Parts row is clicked.
      ====================================== */}

      <CModal
        visible={issueQtyModalOpen}
        onClose={closeIssueQtyModal}
        alignment="center"
        backdrop="static"
      >
        <CModalHeader>
          <CModalTitle>
            Part Details
            <div className="mi-modal-subtitle">
              Enter the quantity to issue from this pallet
            </div>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          <div className="mi-issue-modal-field">
            <label>GRN No</label>
            <CFormInput
              value={issueQtyTarget?.grnNo || ''}
              readOnly
              disabled
            />
          </div>

          <div className="mi-issue-modal-field">
            <label>Part No</label>
            <CFormInput
              value={splitPartLabel(issueQtyTarget?.partLabel).itemNo || issueQtyTarget?.itemId || ''}
              readOnly
              disabled
            />
          </div>

          <div className="mi-issue-modal-field">
            <label>Available Qty</label>
            <CFormInput
              value={issueQtyTarget?.quantity ?? ''}
              readOnly
              disabled
            />
          </div>

          <div className="mi-issue-modal-field">
            <label>
              Issue Qty <span className="mi-req">*</span>
            </label>
            <CFormInput
              type="number"
              min="0.001"
              step="0.001"
              value={issueQty}
              onChange={(e) => setIssueQty(e.target.value)}
              autoFocus
            />
            <div className="mi-issue-modal-help">
              Maximum: {Math.min(
                Number(issueQtyTarget?.quantity || 0),
                getRemainingRequestedQty(issueQtyTarget?.itemId)
              )}
            </div>
          </div>
        </CModalBody>

        <CModalFooter className="mi-issue-modal-footer">
          <CButton
            type="button"
            className="mi-issue-close-btn"
            onClick={closeIssueQtyModal}
          >
            Close
          </CButton>

          <CButton
            type="button"
            className="mi-issue-add-btn"
            onClick={handleAddFromIssueQtyModal}
          >
            Add to Grid
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ======================================
          EDIT CONFIRMED PALLET
          Only EDIT is available for Confirmed Parts.
          View/Delete have been intentionally removed.
      ====================================== */}

      <CModal
        visible={detailsOpen}
        onClose={closeDetails}
        alignment="center"
        backdrop="static"
      >
        <CModalHeader>
          <CModalTitle>
            Edit Pallet Details
            <div className="mi-modal-subtitle">
              Update Confirmed Parts row
            </div>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>

          <div className="mi-modal-field">
            <div className="mi-modal-label">GRN No.</div>
            <CFormInput
              value={detailsRow?.grnNo || ''}
              disabled
              readOnly
            />
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">GRN Type</div>
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
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Pallet No.</div>
            <CFormInput
              value={editForm.palletNo}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  palletNo: e.target.value,
                }))
              }
            />
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Part Details</div>
            <CFormInput
              value={editForm.partLabel}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  partLabel: e.target.value,
                }))
              }
            />
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Location</div>
            <CFormInput
              value={editForm.location}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  location: e.target.value,
                }))
              }
            />
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Quantity</div>
            <CFormInput
              type="number"
              min="0.001"
              step="0.001"
              value={editForm.qty}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  qty: e.target.value,
                }))
              }
            />
          </div>

        </CModalBody>

        <CModalFooter>
          <CButton
            color="primary"
            variant="outline"
            className="flex-fill mi-modal-cancel-btn"
            onClick={closeDetails}
          >
            Cancel
          </CButton>

          <CButton
            color="primary"
            className="flex-fill mi-modal-update-btn"
            onClick={handleUpdateEdit}
          >
            Update
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default MaterialIssue;
