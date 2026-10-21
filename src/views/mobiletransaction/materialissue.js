import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDeviceId } from './deviceId';
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
} from '@coreui/react';
import {
  FaArrowLeft,
  FaSignOutAlt,
  FaSearch,
  FaQrcode,
  FaThLarge,
  FaBox,
  FaCube,
  FaClipboardCheck,
  FaTimes,
  FaTrash,
  FaLayerGroup,
} from 'react-icons/fa';
import Select from 'react-select';
import { Tooltip } from 'react-tooltip';

import API from '../../api';
import '../../assets/CSS/materialIssue.css';
import {
  getAllPallets,
  queuePendingIssue,
  getAllPendingIssues,
  getAllSuppliers,
  getAllCustomers,
} from './offlineDb';

// NOTE: createIssueNumber() below uses `API` (your axios instance).
// Make sure it is imported in your project, e.g.
//   import API from '../../api';

// ==========================================
// Constants & helpers
// ==========================================

const SUMMARY_CONFIG = [
  { key: 'REGULAR', label: 'REGULAR', icon: FaThLarge, tone: 'blue' },
  { key: 'SAMPLE', label: 'SAMPLE', icon: FaBox, tone: 'green' },
];

const GRN_TYPE_OPTIONS = ['REGULAR', 'SAMPLE'];
const DEFAULT_TYPE = 'REGULAR';

const typeOf = (p) => (p?.type || 'REGULAR').toUpperCase();
const byMovementDate = (a, b) =>
  new Date(a.movementDate || 0) - new Date(b.movementDate || 0);

// Avoid floating point noise (0.1 + 0.2) when comparing quantities.
const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// REGULAR by default; falls back to SAMPLE only if there is no REGULAR stock.
const pickDefaultType = (list) => {
  const hasRegular = (list || []).some((p) => typeOf(p) === 'REGULAR');
  const hasSample = (list || []).some((p) => typeOf(p) === 'SAMPLE');
  if (hasRegular) return 'REGULAR';
  if (hasSample) return 'SAMPLE';
  return DEFAULT_TYPE;
};

const createIssueNumber = async () => {
  const now = new Date();

  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const datePrefix = `${year}${month}${day}`;

  let maxSequence = 0;

  const scan = (records) => {
    (records || []).forEach((record) => {
      const issueNumber = String(record.issueNumber || '').trim();
      if (!issueNumber.startsWith(datePrefix)) return;

      const sequencePart = issueNumber.slice(datePrefix.length);
      if (/^\d{3}$/.test(sequencePart)) {
        const sequence = Number(sequencePart);
        if (sequence > maxSequence) maxSequence = sequence;
      }
    });
  };

  // 1. Already saved issues from the API
  try {
    const response = await API.get('/MaterialIssue');
    scan(response.data || []);
  } catch (error) {
    console.warn('Unable to read existing Material Issue numbers:', error);
  }

  // 2. Pending offline issues
  try {
    scan(await getAllPendingIssues());
  } catch (error) {
    console.warn('Unable to read pending Material Issue numbers:', error);
  }

  // 3. Last number used on THIS device today. This keeps numbers unique
  //    even when the server cannot be reached and earlier slips have
  //    already been synced (and so are gone from the pending queue).
  const localKey = `miLastSeq:${datePrefix}`;
  try {
    const localSeq = Number(localStorage.getItem(localKey) || 0);
    if (Number.isFinite(localSeq) && localSeq > maxSequence) maxSequence = localSeq;
  } catch (error) {
    console.warn('Unable to read local issue sequence:', error);
  }

  // 4. Next number
  const nextSequence = maxSequence + 1;

  if (nextSequence > 999) {
    throw new Error(`Issue number sequence exceeded 999 for ${datePrefix}.`);
  }

  try {
    localStorage.setItem(localKey, String(nextSequence));
  } catch (error) {
    console.warn('Unable to store local issue sequence:', error);
  }

  return `${datePrefix}${String(nextSequence).padStart(3, '0')}`;
};

const createIdempotencyKey = (deviceId, issueNumber, palletId) => {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${deviceId}-${issueNumber}-${palletId}-${stamp}-${random}`;
};

// Quantity is the requested issue quantity for the CURRENT part.
// The actual pallet quantity always comes from synced data.
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
      backgroundColor: '#f3e8ff',
      color: '#5b21b6',
      borderLeft: '4px solid #8b5cf6',
      fontWeight: 600,
    },
  },
];

const searchConditionalRowStyles = [
  {
    when: (row) => !!row.edited,
    style: {
      backgroundColor: '#f3e8ff',
      color: '#6d28d9',
      fontWeight: 600,
      borderLeft: '4px solid #8b5cf6',
    },
  },
  {
    when: (row) => row.fifoMatched === true && !row.edited,
    style: {
      backgroundColor: '#dcfce7',
      color: '#166534',
      fontWeight: 600,
      borderLeft: '4px solid #22c55e',
    },
  },
];

// partLabel comes through as "PKG-005 - Self Adhesive Packaging".
// Split on the first " - " to get the part code and the description.
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

// Defined OUTSIDE the component so DataTable does not remount every
// cell on each render (which caused flicker / lost tooltips).
const GridTooltipCell = ({ value, id }) => {
  const displayValue =
    value === undefined || value === null || value === '' ? '—' : String(value);

  return (
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
  );
};

const TOOLTIP_ID = 'material-issue-grid-tooltip';

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : '—';

const partGridColumns = [
  {
    name: 'GRN No',
    selector: (row) => row.grnNo || '—',
    cell: (row) => <GridTooltipCell id={TOOLTIP_ID} value={row.grnNo} />,
    sortable: true,
  },
  {
    name: 'GR Date',
    selector: (row) => formatDate(row.movementDate),
    cell: (row) => <GridTooltipCell id={TOOLTIP_ID} value={formatDate(row.movementDate)} />,
    sortable: true,
  },
  {
    name: 'Pallet No',
    selector: (row) => row.palletNo || '—',
    cell: (row) => <GridTooltipCell id={TOOLTIP_ID} value={row.palletNo} />,
    sortable: true,
  },
  {
    name: 'FIFO No',
    selector: (row) => row.fifoPalletNo || row.fifoNo || '—',
    cell: (row) => <GridTooltipCell id={TOOLTIP_ID} value={row.fifoPalletNo || row.fifoNo || '—'} />,
    sortable: true,
  },
  {
    name: 'Part No',
    selector: (row) => splitPartLabel(row.partLabel).itemNo || row.itemId,
    cell: (row) => (
      <GridTooltipCell id={TOOLTIP_ID} value={splitPartLabel(row.partLabel).itemNo || row.itemId} />
    ),
    sortable: true,
  },
  {
    name: 'Part Name',
    selector: (row) => splitPartLabel(row.partLabel).itemName,
    cell: (row) => <GridTooltipCell id={TOOLTIP_ID} value={splitPartLabel(row.partLabel).itemName} />,
    sortable: true,
  },
  {
    name: 'Location',
    selector: (row) => row.storeLocation ?? row.location ?? '—',
    cell: (row) => <GridTooltipCell id={TOOLTIP_ID} value={row.storeLocation ?? row.location ?? '—'} />,
    sortable: true,
  },
  {
    name: 'Qty',
    selector: (row) => row.quantity ?? row.qty ?? 0,
    cell: (row) => <GridTooltipCell id={TOOLTIP_ID} value={row.quantity ?? row.qty ?? 0} />,
    sortable: true,
    width: '90px',
  },
];

// ==========================================
// Material Issue
// ==========================================
//
// Flow (MULTIPLE PARTS in ONE slip):
//   1. REGULAR is selected by default. Select a Part + Quantity ->
//      Search lists all unused pallets for that part in FIFO order;
//      the pallets needed to satisfy the quantity are highlighted.
//   2. Click a Search Parts row (or scan a label) -> enter Issue Qty
//      -> the pallet goes to Confirmed Parts.
//   3. Once that part is complete, select ANOTHER part + Quantity and
//      repeat steps 1-2. Confirmed Parts can hold many parts.
//   4. Click "Issue Material" -> every part's pallets are saved to the
//      local offline queue under ONE issue number (one slip).
// ==========================================

const MaterialIssue = () => {
  const navigate = useNavigate();

  const [pallets, setPallets] = useState([]);
  const [palletsLoaded, setPalletsLoaded] = useState(false);

  const [activeType, setActiveType] = useState(null); // 'REGULAR' | 'SAMPLE'

  const [form, setForm] = useState(EMPTY_FORM);

  const [searchResults, setSearchResults] = useState([]);
  const [gridFilter, setGridFilter] = useState('');

  const [confirmedRows, setConfirmedRows] = useState([]);

  // Requested quantity per part for this slip: { [itemId]: qty }
  // Recorded when pallets are confirmed for that part.
  const [requestedByPart, setRequestedByPart] = useState({});

  const [changePartCount, setChangePartCount] = useState(0);

  // Pallets fully exhausted by issues saved on this device. Keyed by the
  // pallet's real unique `id` (palletNo / fifoPalletNo labels get recycled
  // across GRNs, so labels are NOT safe as identity).
  const [issuedPalletIds, setIssuedPalletIds] = useState(new Set());

  const sessionUser = useMemo(() => getSessionUser(), []);
  const [issuedTo, setIssuedTo] = useState('');
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [customerOptions, setCustomerOptions] = useState([]);
  const issuedBy = sessionUser?.name || sessionUser?.username || sessionUser?.userName || 'Unknown';

  // "Issued To" is limited to the Supplier / Customer of the GRN(s) the
  // confirmed pallets belong to (GRN_HEADER.SupplierId / CustomerId).
  // - Nothing confirmed yet  -> no options (add a GRN pallet first)
  // - Pallet data has no party info (old sync) -> falls back to all
  const issuedToOptions = useMemo(() => {
    if (confirmedRows.length === 0) return [];

    const suppliers = (supplierOptions || []).map((s) => ({
      value: `SUPPLIER:${s.id}`,
      label: `${s.supplierCode || s.id} - ${s.supplierName || ''}`.trim(),
      partyType: 'Supplier',
    }));

    const customers = (customerOptions || []).map((c) => ({
      value: `CUSTOMER:${c.id}`,
      label: `${c.customerCode || c.id} - ${c.customerName || ''}`.trim(),
      partyType: 'Customer',
    }));

    const all = [...suppliers, ...customers];

    const hasValue = (v) => v !== undefined && v !== null && v !== '';
    const allowed = new Set();

    confirmedRows.forEach((row) => {
      const pallet = pallets.find((p) => p.id === row.palletId);
      if (!pallet) return;

      const supplierId = pallet.supplierId ?? pallet.grnSupplierId;
      const customerId = pallet.customerId ?? pallet.grnCustomerId;

      if (hasValue(supplierId)) allowed.add(`SUPPLIER:${supplierId}`);
      if (hasValue(customerId)) allowed.add(`CUSTOMER:${customerId}`);
    });

    if (allowed.size === 0) {
      console.warn(
        'Pallet records have no supplierId / customerId — showing all parties. ' +
        'Include them from GRN_HEADER in the pallet sync.'
      );
      return all;
    }

    return all.filter((o) => allowed.has(o.value));
  }, [supplierOptions, customerOptions, confirmedRows, pallets]);

  // One party on the GRN -> pre-select it. Drop a selection that is no
  // longer valid (e.g. a pallet was removed).
  useEffect(() => {
    if (issuedToOptions.length === 1) {
      setIssuedTo((cur) => (cur === issuedToOptions[0].label ? cur : issuedToOptions[0].label));
    } else {
      setIssuedTo((cur) =>
        cur && !issuedToOptions.some((o) => o.label === cur) ? '' : cur
      );
    }
  }, [issuedToOptions]);

  // Issue Quantity modal
  const [issueQtyModalOpen, setIssueQtyModalOpen] = useState(false);
  const [issueQtyTarget, setIssueQtyTarget] = useState(null);
  const [issueQty, setIssueQty] = useState('');

  // Edit modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState(null);
  const [grnType, setGrnType] = useState('REGULAR');
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editSource, setEditSource] = useState('confirmed'); // 'confirmed' | 'search'

  const [saving, setSaving] = useState(false);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    window.dispatchEvent(new Event('authChange'));
    navigate('/login', { replace: true });
  };

  const scanInputRef = useRef(null);

  // ------------------------------------------
  // Initial load
  // ------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const [cached, pending] = await Promise.all([
          getAllPallets(),
          getAllPendingIssues(),
        ]);

        // Quantity already queued for issue on this device, per pallet.
        const pendingMap = new Map();
        (pending || []).forEach((p) => {
          const palletId = p.palletId ?? p.grnPalletId;
          const qty = Number(p.quantity || 0);

          if (palletId !== undefined && palletId !== null && Number.isFinite(qty) && qty > 0) {
            pendingMap.set(palletId, (pendingMap.get(palletId) || 0) + qty);
          }
        });

        // Cached quantity minus pending offline issues = quantity
        // currently available on this device.
        const adjusted = (cached || [])
          .map((p) => {
            const originalQty = Number(p.quantity || 0);
            const pendingQty = Number(pendingMap.get(p.id) || 0);

            return {
              ...p,
              originalQuantity: originalQty,
              quantity: round3(Math.max(originalQty - pendingQty, 0)),
            };
          })
          .filter((p) => Number(p.quantity || 0) > 0);

        setPallets(adjusted);

        // REGULAR card is selected by default.
        setActiveType(pickDefaultType(adjusted));

        // Supplier / Customer masters (refreshed by Data Sync).
        const [cachedSuppliers, cachedCustomers] = await Promise.all([
          getAllSuppliers(),
          getAllCustomers(),
        ]);
        // Only parties that appear on a GRN (ids saved by Data Sync).
        let grnParties = null;
        try {
          grnParties = JSON.parse(localStorage.getItem('grnParties') || 'null');
        } catch {
          grnParties = null;
        }

        const keepOnly = (list, ids) => {
          if (!grnParties || !Array.isArray(ids)) return list || [];
          const allowedIds = new Set(ids.map(String));
          return (list || []).filter((x) => allowedIds.has(String(x.id)));
        };

        setSupplierOptions(keepOnly(cachedSuppliers, grnParties?.supplierIds));
        setCustomerOptions(keepOnly(cachedCustomers, grnParties?.customerIds));
      } catch (err) {
        console.error('Failed to load material issue stock:', err);
        toast.error('Could not load stock data. Please run Data Sync and reopen this page.');
        setActiveType(DEFAULT_TYPE);
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

  // Pallets already confirmed or exhausted — cannot be added again.
  const usedPalletIds = useMemo(() => {
    const used = new Set();
    confirmedRows.forEach((r) => {
      if (r.palletId !== undefined && r.palletId !== null) used.add(r.palletId);
    });
    issuedPalletIds.forEach((id) => used.add(id));
    return used;
  }, [confirmedRows, issuedPalletIds]);

  // Drop any search result that has since been used.
  useEffect(() => {
    setSearchResults((rows) => rows.filter((r) => !usedPalletIds.has(r.id)));
  }, [usedPalletIds]);

  // Pallets still available per type (drives the summary cards).
  const availableCounts = useMemo(() => {
    const totals = { REGULAR: 0, SAMPLE: 0 };

    pallets.forEach((p) => {
      if (usedPalletIds.has(p.id)) return;
      const type = typeOf(p);
      if (totals[type] !== undefined) totals[type] += 1;
    });

    return totals;
  }, [pallets, usedPalletIds]);

  // Pallets of a part + type that can still be issued (same rules
  // used by Search and by the "available stock" hint).
  const getPartPool = (type, itemId) =>
    pallets.filter(
      (p) =>
        typeOf(p) === type &&
        String(p.itemId) === String(itemId) &&
        !usedPalletIds.has(p.id) &&
        // Edited Regular pallets are skipped from FIFO
        !(type === 'REGULAR' && p.fifoSkipped === true)
    );

  const hasConfirmed = confirmedRows.length > 0;

  const handleSummaryCardClick = (typeKey) => {
    if (typeKey === 'CHANGE_PART') return;
    if (typeKey === activeType) return;

    if (hasConfirmed) {
      toast.warning(
        'You have confirmed parts. Issue them, or click "Clear All", before switching between REGULAR and SAMPLE.'
      );
      return;
    }

    setActiveType(typeKey);

    // The user must pick the part manually.
    setForm((f) => ({ ...f, itemId: '', quantity: '' }));
    setSearchResults([]);
    setRequestedByPart({});
  };

  // Part list is scoped to the selected REGULAR / SAMPLE card.
  const partOptions = useMemo(() => {
    const seen = new Map();

    if (!activeType) return [];

    pallets
      .filter((p) => typeOf(p) === activeType && !usedPalletIds.has(p.id))
      .forEach((p) => {
        if (!seen.has(p.itemId)) {
          seen.set(p.itemId, p.partLabel || p.itemId);
        }
      });

    return Array.from(seen.entries()).map(([itemId, partLabel]) => ({
      value: itemId,
      label: partLabel,
    }));
  }, [pallets, activeType, usedPalletIds]);

  // Selecting a part (any time — also while other parts are already
  // confirmed). If this part already has a requested quantity in this
  // slip, it is restored so the user can continue it.
  const handlePartSelect = (itemId) => {
    setForm((f) => ({
      ...f,
      itemId,
      quantity: itemId && requestedByPart[String(itemId)] !== undefined
        ? String(requestedByPart[String(itemId)])
        : '',
    }));
    setSearchResults([]);
  };

  // Stock figures for the CURRENT part (used by hints + validation).
  const confirmedQtyForPart = round3(
    confirmedRows
      .filter((r) => String(r.itemId) === String(form.itemId))
      .reduce((sum, r) => sum + Number(r.qty || r.quantity || 0), 0)
  );

  const availableStock = useMemo(() => {
    if (!form.itemId || !activeType) return 0;
    return round3(
      pallets
        .filter(
          (p) =>
            typeOf(p) === activeType &&
            String(p.itemId) === String(form.itemId) &&
            !usedPalletIds.has(p.id) &&
            !(activeType === 'REGULAR' && p.fifoSkipped === true)
        )
        .reduce((sum, p) => sum + Number(p.quantity || 0), 0)
    );
  }, [pallets, activeType, form.itemId, usedPalletIds]);

  const requestedQtyNumber = Number(form.quantity);
  const requestedValid = Number.isFinite(requestedQtyNumber) && requestedQtyNumber > 0;
  const totalIssuableForPart = round3(availableStock + confirmedQtyForPart);
  const exceedsStock = !!form.itemId && requestedValid && requestedQtyNumber > totalIssuableForPart;

  // ------------------------------------------
  // FIFO — for REGULAR, only the oldest unused
  // pallet of the PART may be taken next.
  // ------------------------------------------
  const getNextRegularPallet = (itemId = null) => {
    const unusedRegular = pallets.filter((p) => {
      if (typeOf(p) !== 'REGULAR') return false;
      if (usedPalletIds.has(p.id)) return false;
      if (p.fifoSkipped === true) return false;

      // FIFO is PART-WISE. Another part must never block this part.
      if (itemId !== null && itemId !== undefined && itemId !== '') {
        if (String(p.itemId) !== String(itemId)) return false;
      }

      return true;
    });

    if (unusedRegular.length === 0) return null;

    return [...unusedRegular].sort(byMovementDate)[0];
  };

  // ------------------------------------------
  // SEARCH
  // ------------------------------------------
  const handleSearchParts = () => {
    if (!activeType) {
      toast.warning('Please select REGULAR or SAMPLE first.');
      return;
    }

    if (!form.itemId) {
      toast.error('Please select a part first.');
      return;
    }

    if (!requestedValid) {
      toast.error('Please enter the Quantity you want to issue for this part.');
      return;
    }

    const requestedQty = round3(requestedQtyNumber);
    const selectedType = activeType;

    if (requestedQty < confirmedQtyForPart) {
      toast.warning(
        `You have already confirmed ${confirmedQtyForPart} for this part, which is more than the requested ${requestedQty}. ` +
        `Increase the Quantity or remove some confirmed pallets.`
      );
      return;
    }

    const matches = getPartPool(selectedType, form.itemId);

    if (matches.length === 0) {
      toast.error('No available pallets found for this part.');
      setSearchResults([]);
      return;
    }

    // ---- STOCK VALIDATION ----
    const availableTotal = matches.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
    const maxIssuable = round3(availableTotal + confirmedQtyForPart);

    if (requestedQty > maxIssuable) {
      toast.error(
        `Insufficient stock. You requested ${requestedQty}, but only ${maxIssuable} ` +
        `${selectedType} quantity is available for this part.`
      );
      setSearchResults([]);
      return;
    }

    // FIFO order = oldest Store Movement date first.
    const ordered = [...matches].sort(byMovementDate);

    // Highlight the pallets needed to satisfy the still-pending quantity.
    const pendingQty = round3(requestedQty - confirmedQtyForPart);
    let cumulativeQty = 0;
    let quantitySatisfied = pendingQty <= 0;

    const highlightedRows = ordered.map((p) => {
      const palletQty = Number(p.quantity || 0);
      let fifoMatch = false;

      if (!quantitySatisfied && palletQty > 0) {
        fifoMatch = true;
        cumulativeQty += palletQty;
        if (cumulativeQty >= pendingQty) quantitySatisfied = true;
      }

      return {
        ...p,
        fifoMatched: fifoMatch,
        cumulativeQty,
        requestedQty,
      };
    });

    setSearchResults(highlightedRows);
  };

  const handleClearSearch = () => {
    setForm(EMPTY_FORM);
    setSearchResults([]);
    setConfirmedRows([]);
    setRequestedByPart({});
    setGridFilter('');

    setIssueQtyModalOpen(false);
    setIssueQtyTarget(null);
    setIssueQty('');
    setDetailsOpen(false);
    setDetailsRow(null);
    setEditForm(EMPTY_EDIT_FORM);

    // Go back to the default card (REGULAR).
    setActiveType(pickDefaultType(pallets));

    toast.info('Search and Confirmed Parts cleared.');
    refocusScanInput();
  };

  // ------------------------------------------
  // Remove one confirmed pallet (frees it again)
  // ------------------------------------------
  const handleRemoveConfirmed = (row) => {
    setConfirmedRows((rows) => rows.filter((r) => r.id !== row.id));

    // Drop the part's requested quantity if nothing is left for it.
    setRequestedByPart((prev) => {
      const stillHasRows = confirmedRows.some(
        (r) => r.id !== row.id && String(r.itemId) === String(row.itemId)
      );
      if (stillHasRows) return prev;
      const next = { ...prev };
      delete next[String(row.itemId)];
      return next;
    });

    toast.info(
      `Pallet ${row.palletNo} removed. Click Search again to see it in the list.`
    );
  };

  // ------------------------------------------
  // VALIDATED PALLET -> Confirmed Parts
  // ------------------------------------------
  const addConfirmedRow = ({
    palletId,
    itemId,
    partLabel,
    palletNo,
    storeLocation,
    quantity,
    grnNo,
    remarks,
    type,
    movementDate,
    fifoPalletNo,
  }) => {
    if (!itemId || !quantity || !palletNo) {
      toast.error('This pallet is missing required fields (part, quantity or pallet number).');
      return false;
    }

    if (palletId === undefined || palletId === null) {
      toast.error('Internal error — this pallet has no verified identity and cannot be added. Please re-scan.');
      return false;
    }

    if (issuedPalletIds.has(palletId)) {
      toast.error(
        `Pallet ${palletNo} (GRN ${grnNo || '—'}) was already issued and saved on this device. ` +
        `It cannot be added again until it is synced and re-stocked.`
      );
      return false;
    }

    if (usedPalletIds.has(palletId)) {
      toast.error(`Pallet ${palletNo} (GRN ${grnNo || '—'}) has already been added.`);
      return false;
    }

    // FIFO enforcement (compared by id — labels can repeat).
    if ((type || 'REGULAR').toUpperCase() === 'REGULAR') {
      const nextAllowed = getNextRegularPallet(itemId);
      if (nextAllowed && nextAllowed.id !== palletId) {
        toast.error(
          `FIFO order required — add pallet ${nextAllowed.palletNo} (GRN ${nextAllowed.grnNo || '—'}) first (oldest in store).`
        );
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
      fifoPalletNo: fifoPalletNo || '',
      fifoNo: fifoPalletNo || '',
      type: (type || 'REGULAR').toUpperCase(),
      edited: false,
    };

    setConfirmedRows((rows) => [...rows, row]);
    toast.success(`Pallet ${palletNo} (GRN ${grnNo || '—'}) confirmed.`);

    return true;
  };

  // ------------------------------------------
  // ISSUE QUANTITY MODAL
  // ------------------------------------------
  // Remaining quantity for the CURRENT part only.
  const getRemainingRequestedQty = (itemId) => {
    const requested = Number(form.quantity);

    if (!Number.isFinite(requested) || requested <= 0) return 0;

    const alreadyConfirmed = confirmedRows
      .filter((r) => String(r.itemId) === String(itemId))
      .reduce((sum, r) => sum + Number(r.qty || 0), 0);

    return round3(Math.max(requested - alreadyConfirmed, 0));
  };

  const openIssueQtyModal = (row) => {
    if (!row) return;

    // The part and quantity must be chosen first — they define
    // how much is still needed.
    if (!form.itemId) {
      toast.warning('Please select a part first, then pick or scan a pallet.');
      return;
    }

    if (!requestedValid) {
      toast.warning('Please enter the Quantity first, then pick or scan a pallet.');
      return;
    }

    // A pallet of another part cannot be added to the part being worked on.
    // To add another part, select it in "Select Part" first.
    if (String(row.itemId) !== String(form.itemId)) {
      const picked = splitPartLabel(row.partLabel).itemNo || row.itemId;
      const selected =
        partOptions.find((o) => String(o.value) === String(form.itemId))?.label || form.itemId;
      toast.error(
        `This pallet belongs to part ${picked}, but the selected part is ${selected}. ` +
        `Select part ${picked} (and its quantity) first to add it to this slip.`
      );
      return;
    }

    // Manual clicks / scans must not bypass FIFO.
    if (typeOf(row) === 'REGULAR' && row.fifoMatched !== true) {
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
      toast.info(
        'The requested quantity for this part is already satisfied. ' +
        'Select another part to add it, or click "Issue Material".'
      );
      return;
    }

    if (!Number.isFinite(availableQty) || availableQty <= 0) {
      toast.error('This pallet has no available quantity.');
      return;
    }

    // Default never exceeds the pallet stock or the remaining request.
    setIssueQtyTarget(row);
    setIssueQty(String(round3(Math.min(availableQty, remainingQty))));
    setIssueQtyModalOpen(true);
  };

  const closeIssueQtyModal = () => {
    setIssueQtyModalOpen(false);
    setIssueQtyTarget(null);
    setIssueQty('');
    refocusScanInput();
  };

  const handleAddFromIssueQtyModal = () => {
    if (!issueQtyTarget) return;

    const availableQty = Number(issueQtyTarget.quantity || 0);
    const enteredQty = round3(issueQty);
    const remainingQty = getRemainingRequestedQty(issueQtyTarget.itemId);

    if (!Number.isFinite(enteredQty) || enteredQty <= 0) {
      toast.error('Please enter a valid Issue Qty greater than 0.');
      return;
    }

    if (enteredQty > availableQty) {
      toast.error(`Issue Qty cannot exceed the pallet's available quantity (${availableQty}).`);
      return;
    }

    if (enteredQty > remainingQty) {
      toast.error(`Issue Qty cannot exceed the remaining requested quantity (${remainingQty}).`);
      return;
    }

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
      fifoPalletNo: issueQtyTarget.fifoPalletNo || issueQtyTarget.fifoNo || '',
    });

    if (added) {
      // Remember what was requested for this part in this slip.
      setRequestedByPart((prev) => ({
        ...prev,
        [String(issueQtyTarget.itemId)]: round3(requestedQtyNumber),
      }));

      setSearchResults((rows) => rows.filter((r) => r.id !== issueQtyTarget.id));
      closeIssueQtyModal();
    }
  };

  // ------------------------------------------
  // Scan Pallet / GRN Label
  // ------------------------------------------

  // Stopgap for a known label-printer bug: the "grn" field is built with
  // SQL-style quoting instead of JSON. Only that exact shape is repaired.
  const repairKnownGrnFieldBug = (value) =>
    value.replace(/"grn"\s*;\s*'([^']*)'\s*,/, '"grn":"$1",');

  const resetScanInput = () => {
    setForm((f) => ({ ...f, grnNo: '' }));
    refocusScanInput();
  };

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
        toast.error(
          `Scanned code is not valid JSON — the label is malformed. ` +
          `Raw value: ${raw.length > 140 ? raw.slice(0, 140) + '…' : raw}`
        );
        resetScanInput();
        return;
      }
    }

    if (wasRepaired) {
      console.warn('Scanned label had a malformed "grn" field (SQL-style quoting) and was auto-repaired. The QR/label generator needs fixing.');
      toast.info('Label format was malformed but recovered — please report this so the label generator can be fixed.');
    }

    const scannedPalletNo = parsed.palletNo;
    const scannedFifoNo = parsed.fifoPalletNo;
    const scannedGrn = parsed.grn;
    const scannedQty = parsed.qty;
    const scannedLocation = parsed.location;

    if (!scannedPalletNo && !scannedFifoNo) {
      toast.error('Scanned code is missing Pallet No / FIFO Pallet No — not a valid GRN label.');
      resetScanInput();
      return;
    }

    if (
      scannedGrn !== undefined &&
      scannedGrn !== null &&
      typeof scannedGrn !== 'string' &&
      typeof scannedGrn !== 'number'
    ) {
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

    // ALL synced pallets whose label matches (labels are reused across GRNs).
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
      if (!scannedGrn) {
        toast.error(
          `Pallet "${scannedPalletNo || scannedFifoNo}" is ambiguous — ${candidates.length} different pallets share this label ` +
          `(labels get reused across GRNs) and this scan has no GRN number. Scan rejected. ` +
          `Please use a label that includes the GRN number.`
        );
        resetScanInput();
        return;
      }

      const grnMatches = candidates.filter((p) => p.grnNo && String(p.grnNo) === String(scannedGrn));

      if (grnMatches.length === 1) {
        match = grnMatches[0];
      } else if (grnMatches.length === 0) {
        toast.error(
          `Pallet "${scannedPalletNo || scannedFifoNo}" exists under other GRNs, but none match GRN ${scannedGrn} on this label. Scan rejected.`
        );
        resetScanInput();
        return;
      } else {
        toast.error(
          `Pallet "${scannedPalletNo || scannedFifoNo}" under GRN ${scannedGrn} is still ambiguous in synced data. ` +
          `Scan rejected — run Data Sync and check for duplicate records.`
        );
        resetScanInput();
        return;
      }
    }

    if (!match) {
      toast.error(
        `Pallet "${scannedPalletNo || scannedFifoNo}" was not found in synced data. ` +
        `This GRN may not exist, may not be posted yet, or hasn't been synced to this device. ` +
        `Run Data Sync and try again — the scan was not added.`
      );
      resetScanInput();
      return;
    }

    // Already used / issued?
    if (usedPalletIds.has(match.id)) {
      toast.error(`Pallet ${match.palletNo} (GRN ${match.grnNo || '—'}) has already been added.`);
      resetScanInput();
      return;
    }

    const matchType = typeOf(match);

    if (activeType && matchType !== activeType) {
      toast.error(`This is a ${matchType} pallet. Please select the ${matchType} card first.`);
      resetScanInput();
      return;
    }

    // Label GRN must agree with the matched pallet's GRN.
    if (scannedGrn && match.grnNo && String(match.grnNo) !== String(scannedGrn)) {
      toast.error(
        `Pallet ${match.palletNo} belongs to GRN ${match.grnNo}, not ${scannedGrn}. Scan rejected — please check the label.`
      );
      resetScanInput();
      return;
    }

    // FIFO check immediately after scan (part-wise, REGULAR only).
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

    // Scan identifies the pallet only; the user enters the Issue Qty.
    openIssueQtyModal({
      ...match,
      storeLocation: scannedLocation || match.storeLocation,
      grnNo: match.grnNo || scannedGrn,
    });

    resetScanInput();
  };

  const handleScanInputChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, grnNo: value }));

    // Auto-process as soon as a complete JSON payload lands in the field
    // (covers scanners that don't send Enter).
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
  // Per-part summary of the slip being built
  // ------------------------------------------
  const slipSummary = useMemo(() => {
    const byPart = new Map();

    confirmedRows.forEach((r) => {
      const key = String(r.itemId);
      const entry = byPart.get(key) || {
        itemId: r.itemId,
        label: r.partLabel,
        confirmed: 0,
        pallets: 0,
      };
      entry.confirmed = round3(entry.confirmed + Number(r.qty || r.quantity || 0));
      entry.pallets += 1;
      byPart.set(key, entry);
    });

    return Array.from(byPart.entries()).map(([key, entry]) => {
      // The part currently in the form uses the live Quantity field.
      let requested = requestedByPart[key];
      if (key === String(form.itemId) && requestedValid) {
        requested = round3(requestedQtyNumber);
      }

      return { ...entry, key, requested };
    });
  }, [confirmedRows, requestedByPart, form.itemId, requestedValid, requestedQtyNumber]);

  // ------------------------------------------
  // ISSUE MATERIAL — ONE click = ONE slip.
  // All confirmed pallets (of ALL parts) share the same IssueNumber;
  // IdempotencyKey stays unique per pallet.
  // ------------------------------------------
  const handleIssueMaterial = async () => {
    if (saving) return;

    if (confirmedRows.length === 0) {
      toast.error('Please add the required quantity to Confirmed Parts before issuing.');
      return;
    }

    // Every part in the slip must be exactly complete.
    for (const part of slipSummary) {
      const partName = splitPartLabel(part.label).itemNo || part.itemId;

      if (part.requested === undefined || part.requested <= 0) {
        toast.error(`Please enter the requested Quantity for part ${partName}.`);
        return;
      }

      if (part.confirmed < part.requested) {
        const shortage = round3(part.requested - part.confirmed);
        toast.warning(
          `Part ${partName}: requested ${part.requested}, but only ${part.confirmed} is confirmed. ` +
          `Please add ${shortage} more (select the part, then pick or scan pallets).`
        );
        return;
      }

      if (part.confirmed > part.requested) {
        toast.warning(
          `Part ${partName}: requested ${part.requested}, but ${part.confirmed} is confirmed. ` +
          `Please adjust the confirmed quantity to exactly ${part.requested}.`
        );
        return;
      }
    }

    if (!issuedTo || !issuedTo.trim()) {
      toast.error('Please select Issued To (Supplier / Customer) before clicking Issue Material.');
      return;
    }

    // Lock the button immediately so a double tap cannot create two slips.
    setSaving(true);

    try {
      const deviceId = getDeviceId();
      const createdAt = new Date().toISOString();
      const issueNumber = await createIssueNumber();

      const queuedIssues = [];

      for (const row of confirmedRows) {
        const palletId = row.palletId;
        const quantity = Number(row.qty || row.quantity || 0);

        if (palletId === undefined || palletId === null) {
          throw new Error(`Pallet identity is missing for ${row.palletNo || 'selected pallet'}.`);
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Invalid issue quantity for pallet ${row.palletNo || palletId}.`);
        }

        await queuePendingIssue({
          palletId,
          grnPalletId: palletId,
          itemId: Number(row.itemId),
          quantity,
          issuedTo: issuedTo.trim(),
          issuedBy: String(issuedBy).trim(),
          storeLocation: row.storeLocation || row.location || null,
          palletNo: row.palletNo || null,
          grnNumber: row.grnNo && row.grnNo !== '—' ? String(row.grnNo).trim() : null,
          remarks: row.remarks || form.remarks || null,

          // Same for every pallet / part in this operation.
          issueNumber,

          // Unique per queued transaction.
          idempotencyKey: createIdempotencyKey(deviceId, issueNumber, palletId),

          deviceId,
          issueDate: createdAt,
          createdDate: createdAt,
          fifoPalletNo: row.fifoPalletNo || row.fifoNo || null,
        });

        queuedIssues.push({
          issueNumber,
          palletNo: row.palletNo || '—',
          grnNo: row.grnNo || '—',
          quantity,
        });
      }

      // Quantity issued now, per pallet.
      const issuedNowByPallet = new Map();
      confirmedRows.forEach((row) => {
        const qty = Number(row.qty || row.quantity || 0);
        issuedNowByPallet.set(row.palletId, round3((issuedNowByPallet.get(row.palletId) || 0) + qty));
      });

      // Reduce local stock; pallets that reach zero disappear.
      const updatedPallets = pallets
        .map((p) => {
          const issuedQty = Number(issuedNowByPallet.get(p.id) || 0);
          if (issuedQty <= 0) return p;
          return { ...p, quantity: round3(Math.max(Number(p.quantity || 0) - issuedQty, 0)) };
        })
        .filter((p) => Number(p.quantity || 0) > 0);

      const exhaustedIds = pallets
        .filter((p) => {
          const issuedQty = Number(issuedNowByPallet.get(p.id) || 0);
          return issuedQty > 0 && issuedQty >= Number(p.quantity || 0);
        })
        .map((p) => p.id);

      setPallets(updatedPallets);

      if (exhaustedIds.length > 0) {
        setIssuedPalletIds((prev) => {
          const next = new Set(prev);
          exhaustedIds.forEach((id) => next.add(id));
          return next;
        });
      }

      const grnCount = new Set(
        confirmedRows.map((row) => row.grnNo).filter((grn) => grn && grn !== '—')
      ).size;

      const partCount = slipSummary.length;

      toast.success(
        `Material Issue ${issueNumber} saved as ONE slip` +
        ` with ${partCount} part${partCount === 1 ? '' : 's'},` +
        ` ${queuedIssues.length} pallet${queuedIssues.length === 1 ? '' : 's'}` +
        ` across ${grnCount || 1} GRN${grnCount === 1 ? '' : 's'}` +
        `${isOnline ? '' : ' offline — will sync when online'}.`
      );

      // Reset the screen and keep REGULAR selected by default.
      setForm(EMPTY_FORM);
      setConfirmedRows([]);
      setRequestedByPart({});
      setSearchResults([]);
      setGridFilter('');
      setIssuedTo('');
      setActiveType(pickDefaultType(updatedPallets));
      refocusScanInput();
    } catch (err) {
      console.error('Failed to save issue to offline queue:', err);
      toast.error(err?.message || 'Failed to save the issue. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const totalParts = slipSummary.length;
  const totalPallets = confirmedRows.length;
  const totalQuantity = round3(confirmedRows.reduce((sum, r) => sum + Number(r.qty || 0), 0));
  const stillNeeded = requestedValid && form.itemId
    ? round3(Math.max(requestedQtyNumber - confirmedQtyForPart, 0))
    : null;

  // ------------------------------------------
  // EDIT (kept for when the Action column is re-enabled)
  // ------------------------------------------
  const openEdit = (row, source = 'confirmed') => {
    setDetailsRow(row);
    setEditSource(source);
    setGrnType(typeOf(row));

    setEditForm({
      palletNo: row?.palletNo || '',
      partLabel: row?.partLabel || '',
      location: row?.location || row?.storeLocation || row?.store_location || '',
      qty: row?.qty ?? row?.quantity ?? '',
    });

    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsRow(null);
    setEditSource('confirmed');
    setEditForm(EMPTY_EDIT_FORM);
  };

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

    if (editSource === 'search') {
      setSearchResults((rows) =>
        rows.map((r) => (r.id === detailsRow.id ? { ...r, ...updatedFields } : r))
      );
    } else {
      setConfirmedRows((rows) =>
        rows.map((r) => (r.id === detailsRow.id ? { ...r, ...updatedFields } : r))
      );
    }

    setChangePartCount((c) => c + 1);
    toast.success('Pallet details updated successfully.');
    closeDetails();
  };

  // ------------------------------------------
  // Grid data
  // ------------------------------------------
  const searchColumns = partGridColumns;

  // Confirmed grid = same columns + a Remove button per row.
  const confirmedColumns = useMemo(
    () => [
      ...partGridColumns,
      {
        name: 'Action',
        width: '80px',
        ignoreRowClick: true,
        cell: (row) => (
          <button
            type="button"
            aria-label={`Remove pallet ${row.palletNo}`}
            title="Remove from Confirmed Parts"
            onClick={() => handleRemoveConfirmed(row)}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <FaTrash />
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirmedRows]
  );

  const filteredSearchResults = useMemo(() => {
    const search = gridFilter.trim().toLowerCase();

    if (!search) return searchResults;

    return searchResults.filter((row) => {
      const values = [
        row.grnNo,
        row.movementDate,
        row.palletNo,
        row.fifoPalletNo,
        row.itemId,
        row.partLabel,
        row.storeLocation,
        row.location,
      ];

      return values.some((value) => String(value ?? '').toLowerCase().includes(search));
    });
  }, [searchResults, gridFilter]);

  const searchDisabled = !form.itemId || !requestedValid;

  return (
    <div className="mi-page">
      <Tooltip
        id={TOOLTIP_ID}
        place="top"
        delayShow={250}
        style={{
          zIndex: 9999,
          maxWidth: '420px',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      />

      {/* HEADER */}
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

      {/* BODY */}
      <main className="mi-body">
        {/* SUMMARY CARDS */}
        <div
          className={`mi-summary-row ${SUMMARY_CONFIG.length === 3 ? 'mi-summary-row-3' : 'mi-summary-row-2'}`}
        >
          {SUMMARY_CONFIG.map((card) => {
            const Icon = card.icon;
            const isChangePart = card.key === 'CHANGE_PART';
            const isActive = activeType === card.key;

            const value = isChangePart
              ? changePartCount
              : palletsLoaded
                ? availableCounts[card.key]
                : '—';

            const sub = isChangePart ? 'Edited Parts' : 'Pallets';

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

        {/* SELECT PART + QUANTITY */}
        <div className="mi-grid-2">
          <div className="mi-field">
            <label className="mi-label">
              Select Part <span className="mi-req">*</span>
            </label>

            <Select
              classNamePrefix="react-select"
              placeholder={palletsLoaded ? 'Select part number' : 'Loading synced parts…'}
              noOptionsMessage={() => 'No parts available'}
              options={partOptions}
              value={partOptions.find((o) => String(o.value) === String(form.itemId)) || null}
              onChange={(selected) => handlePartSelect(selected?.value || '')}
              isClearable
              isDisabled={!palletsLoaded || !activeType || partOptions.length === 0}
            />
            {hasConfirmed && (
              <div className="mi-issue-modal-help">
                You can select another part to add it to the same slip.
              </div>
            )}
          </div>

          <div className="mi-field">
            <label className="mi-label">Quantity <span className="mi-req">*</span></label>
            <input
              type="number"
              className="mi-input-real"
              placeholder="Enter quantity"
              min="0.001"
              step="0.001"
              value={form.quantity}
              onChange={(e) => {
                const value = e.target.value;

                // digits with up to 3 decimals
                if (/^\d*\.?\d{0,3}$/.test(value)) {
                  setForm((f) => ({ ...f, quantity: value }));
                }
              }}
              onKeyDown={(e) => {
                if (['e', 'E', '+', '-'].includes(e.key)) {
                  e.preventDefault();
                }
                if (e.key === 'Enter' && !searchDisabled) {
                  e.preventDefault();
                  handleSearchParts();
                }
              }}
            />

            {form.itemId && (
              <div
                className="mi-issue-modal-help"
                style={exceedsStock ? { color: '#dc2626', fontWeight: 600 } : undefined}
              >
                {exceedsStock
                  ? `Only ${totalIssuableForPart} ${activeType} stock is available for this part.`
                  : `Available stock: ${totalIssuableForPart}`}
              </div>
            )}
          </div>
        </div>

        <div className="mi-search-actions">
          <button
            type="button"
            className="mi-search-btn"
            onClick={handleSearchParts}
            disabled={searchDisabled}
            title={searchDisabled ? 'Select a part and enter quantity first' : 'Search pallets'}
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

        {/* SEARCH PARTS GRID */}
        <div className="mi-grid-header">
          <div>
            <div className="mi-section-title">Search Parts</div>

            {searchResults.length > 0 && (
              <div className="mi-search-hint">
                Green rows are the FIFO pallets needed. Tap a row to enter the Issue Qty
              </div>
            )}
          </div>

          <div className="mi-grid-filter">
            <FaSearch className="mi-grid-filter-icon" />

            <input
              type="text"
              value={gridFilter}
              onChange={(e) => setGridFilter(e.target.value)}
              placeholder="Search by GRN, Pallet, Part..."
              className="mi-grid-filter-input"
            />

            {gridFilter && (
              <button
                type="button"
                className="mi-grid-filter-clear"
                onClick={() => setGridFilter('')}
                aria-label="Clear filter"
              >
                <FaTimes />
              </button>
            )}
          </div>
        </div>

        <div className="mi-table-wrap">
          <DataTable
            columns={searchColumns}
            data={filteredSearchResults}
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

        {/* SCAN */}
        <div className="mi-field">
          <label className="mi-label">Scan Pallet / GRN Label</label>
          <div className="mi-scan-input">
            <input
              ref={scanInputRef}
              className="mi-scan-input-inner"
              placeholder="Select part & quantity, then scan a label"
              value={form.grnNo}
              onChange={handleScanInputChange}
              onKeyDown={handleScanInputKeyDown}
              autoFocus
            />
            <FaQrcode className="mi-scan-icon" />
          </div>
        </div>

        {/* CONFIRMED PARTS */}
        <div className="mi-section-title">Confirmed Parts</div>

        {stillNeeded !== null && (
          <div
            className="mi-search-hint"
            style={
              stillNeeded === 0
                ? { color: '#166534', fontWeight: 600 }
                : { color: '#b45309', fontWeight: 600 }
            }
          >
            Current part — Requested: {round3(requestedQtyNumber)} · Confirmed: {confirmedQtyForPart} ·{' '}
            {stillNeeded === 0
              ? 'Complete. Select another part or issue.'
              : `Still needed: ${stillNeeded}`}
          </div>
        )}

        {/* Per-part progress for the whole slip */}
        {slipSummary.length > 0 && (
          <div style={{ margin: '6px 0 10px', display: 'grid', gap: '4px' }}>
            {slipSummary.map((part) => {
              const complete =
                part.requested !== undefined && part.confirmed === part.requested;
              const partNo = splitPartLabel(part.label).itemNo || part.itemId;

              return (
                <button
                  type="button"
                  key={part.key}
                  onClick={() => handlePartSelect(part.itemId)}
                  title="Click to continue working on this part"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${complete ? '#86efac' : '#fcd34d'}`,
                    background: complete ? '#f0fdf4' : '#fffbeb',
                    color: complete ? '#166534' : '#b45309',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{partNo}</span>
                  <span>
                    {part.confirmed} / {part.requested ?? '—'} · {part.pallets} pallet
                    {part.pallets === 1 ? '' : 's'} · {complete ? 'Ready' : 'Incomplete'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

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

        {/* ISSUED TO / BY / REMARKS */}
        <div className="mi-grid-2">
          <div className="mi-field">
            <label className="mi-label">Issued To <span className="mi-req">*</span></label>
            <Select
              classNamePrefix="react-select"
              placeholder={hasConfirmed ? 'Select Supplier / Customer' : 'Add GRN pallets first'}
              options={issuedToOptions}
              value={issuedToOptions.find((option) => option.label === issuedTo) || null}
              onChange={(selected) => setIssuedTo(selected?.label || '')}
              isClearable
              isSearchable
              isDisabled={!hasConfirmed}
              noOptionsMessage={() => 'No Supplier / Customer found for this GRN'}
            />
          </div>
          <div className="mi-field">
            <label className="mi-label">Issued By</label>
            <input className="mi-input-real" value={issuedBy} readOnly />
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

        <div className="mi-totals-row">
          <div className="mi-total-card mi-total-blue">
            <div className="mi-total-icon"><FaLayerGroup /></div>
            <div>
              <div className="mi-total-label">Total Parts</div>
              <div className="mi-total-value">{totalParts}</div>
            </div>
          </div>

          <div className="mi-total-card mi-total-blue">
            <div className="mi-total-icon"><FaCube /></div>
            <div>
              <div className="mi-total-label">Total Pallets</div>
              <div className="mi-total-value">{totalPallets}</div>
            </div>
          </div>

          {/* <div className="mi-total-card mi-total-green">
            <div className="mi-total-icon"><FaClipboardCheck /></div>
            <div>
              <div className="mi-total-label">Total Quantity</div>
              <div className="mi-total-value">{totalQuantity}</div>
            </div>
          </div> */}
        </div>

        <div className="mi-body-spacer" />
      </main>

      {/* FOOTER */}
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

      {/* ISSUE QUANTITY MODAL */}
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
            <CFormInput value={issueQtyTarget?.grnNo || ''} readOnly disabled />
          </div>

          <div className="mi-issue-modal-field">
            <label>Pallet No</label>
            <CFormInput value={issueQtyTarget?.palletNo || ''} readOnly disabled />
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
            <CFormInput value={issueQtyTarget?.quantity ?? ''} readOnly disabled />
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
              onKeyDown={(e) => {
                if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFromIssueQtyModal();
                }
              }}
              autoFocus
            />
            <div className="mi-issue-modal-help">
              Maximum: {round3(
                Math.min(
                  Number(issueQtyTarget?.quantity || 0),
                  getRemainingRequestedQty(issueQtyTarget?.itemId)
                )
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

      {/* EDIT MODAL (only reachable if an edit action is re-enabled) */}
      <CModal
        visible={detailsOpen}
        onClose={closeDetails}
        alignment="center"
        backdrop="static"
      >
        <CModalHeader>
          <CModalTitle>
            Edit Part Details
            <div className="mi-modal-subtitle">Update Confirmed Parts row</div>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          <div className="mi-modal-field">
            <div className="mi-modal-label">GRN No.</div>
            <CFormInput value={detailsRow?.grnNo || ''} disabled readOnly />
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">GRN Type</div>
            <CFormSelect value={grnType} onChange={(e) => setGrnType(e.target.value)}>
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
              onChange={(e) => setEditForm((f) => ({ ...f, palletNo: e.target.value }))}
            />
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Part Details</div>
            <CFormInput
              value={editForm.partLabel}
              onChange={(e) => setEditForm((f) => ({ ...f, partLabel: e.target.value }))}
            />
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Location</div>
            <CFormInput
              value={editForm.location}
              onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
            />
          </div>

          <div className="mi-modal-field">
            <div className="mi-modal-label">Quantity <span className="mi-req">*</span></div>
            <CFormInput
              type="number"
              min="0.001"
              step="0.001"
              required
              value={editForm.qty}
              onChange={(e) => setEditForm((f) => ({ ...f, qty: e.target.value }))}
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
