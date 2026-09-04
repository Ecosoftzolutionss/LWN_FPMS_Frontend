import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  FaArrowLeft,
  FaSignOutAlt,
  FaInfoCircle,
  FaFileAlt,
  FaShieldAlt,
  FaSave,
  FaLock,
} from 'react-icons/fa';

import API from '../../api';
import '../../assets/CSS/storeVerification.css';
import {
  getAllPallets,
  queuePendingVerification,
  getAllPendingVerifications,
  getAllVerifiedIds,
  getAllPalletStatus,
} from './offlineDb';

// ==========================================
// Store Verification
// ==========================================
//
// Flow:
//   1. Scan a GRN/Pallet label -> matched against the same synced
//      pallets cache Material Issue uses (populated by Data Sync's
//      /StoreMovement/available-pallets download). A match resolves
//      GRN No, Part No, Pallet No, Qty and enables Save. An
//      unmatched / ambiguous / mismatched scan shows an error and
//      keeps Save disabled — nothing is guessed or half-filled.
//   2. Save writes the verification to the LOCAL offline DB
//      (queuePendingVerification) — same "queue now, sync later"
//      pattern as Material Issue's pending issues. Uploaded to the
//      server on the next Data Sync.
//
// Duplicate guard sources (BOTH required, see bug history):
//   - getAllPendingVerifications(): pallets verified on THIS device
//     but not yet synced to the server.
//   - getAllVerifiedIds(): pallets the SERVER already has on record
//     (from a prior sync, possibly from a different device). Without
//     this second source, a pallet becomes re-scannable the instant
//     its pending record syncs and is removed from the local queue —
//     which is exactly the bug that let GI-02 verify twice.
//
// Scan input behavior (fixed):
//   The raw scanned text (scannedRaw) is now cleared IMMEDIATELY
//   after every scan attempt — whether it resolves to success or
//   error — instead of lingering in the box until the next Save/
//   reset. This is done inside applyScannedLabel/reject themselves,
//   not just in resetScan(), so the operator sees a clean input the
//   instant a scan is processed and can fire the next scan right
//   away. The result/error message is shown separately below the
//   input (sv-value-box), so clearing the raw text does not lose
//   any information the operator needs.
// ==========================================

const EMPTY_RESULT = {
  palletId: null,
  grnNo: '',
  partLabel: '',
  itemId: '',
  palletNo: '',
  quantity: '',
  storeLocation: '',
};

const StoreVerification = () => {

  const navigate = useNavigate();

  const [pallets, setPallets] = useState([]);
  const [palletsLoaded, setPalletsLoaded] = useState(false);

  // Persistent guard — pallets already verified, whether still
  // pending locally OR already confirmed synced to the server.
  // Keyed by the pallet's unique `id`, not the recyclable
  // palletNo/fifoPalletNo label (labels get reused across GRNs —
  // see Material Issue's offlineDb.js comments for why).
  const [verifiedPalletIds, setVerifiedPalletIds] = useState(new Set());

  // 'idle' -> nothing scanned yet
  // 'success' -> matched a real pallet, details shown, Save enabled
  // 'error' -> scan was rejected, reason shown below
  const [scanState, setScanState] = useState('idle');
  const [scannedRaw, setScannedRaw] = useState('');
  const [scannedError, setScannedError] = useState('');
  const [result, setResult] = useState(EMPTY_RESULT);

  const [saving, setSaving] = useState(false);


  const scanInputRef = useRef(null);


  const [palletStatus, setPalletStatus] = useState([]);

  useEffect(() => {
    const loadPallets = async () => {
      try {
        const cached = await getAllPallets();
        setPallets(cached);
      } catch (err) {
        console.error('Failed to load cached pallets:', err);
      } finally {
        setPalletsLoaded(true);
      }
    };
    loadPallets();

    // Broader status cache (in-stock + issued), used to give a
    // precise rejection reason instead of a generic "not found" when
    // a scanned pallet has already been issued out.
    const loadPalletStatus = async () => {
      try {
        const cached = await getAllPalletStatus();
        setPalletStatus(cached);
      } catch (err) {
        console.error('Failed to load pallet status cache:', err);
      }
    };
    loadPalletStatus();

    const loadAlreadyVerified = async () => {
      try {
        const [pending, syncedIds] = await Promise.all([
          getAllPendingVerifications(),
          getAllVerifiedIds(),
        ]);

        const pendingIds = pending
          .map((p) => p.palletId)
          .filter((id) => id !== undefined && id !== null);

        setVerifiedPalletIds(new Set([...pendingIds, ...syncedIds]));
      } catch (err) {
        console.error('Failed to load already-verified pallets:', err);
      }
    };
    loadAlreadyVerified();
  }, []);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const refocusScanInput = () => {
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };


  // ==========================================
  // Logout / Back
  // ==========================================

  const handleLogout = async () => {
    try {
      await API.post('/Auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
    }
    sessionStorage.clear();
    navigate('/login', { replace: true });
  };

  const handleBack = () => {
    navigate('/m/send');
  };


  // ==========================================
  // Reset / reject helpers
  // ==========================================

  const resetScan = () => {
    setScanState('idle');
    setScannedRaw('');
    setScannedError('');
    setResult(EMPTY_RESULT);
    refocusScanInput();
  };

  // FIX: clear the raw scanned text immediately when a scan is
  // rejected, and refocus the input so the next scan can go straight
  // in. Previously scannedRaw was left untouched here, so the
  // rejected JSON stayed sitting in the box.
  const reject = (message) => {
    setScanState('error');
    setScannedError(message);
    setResult(EMPTY_RESULT);
    setScannedRaw('');
    toast.error(message);
    refocusScanInput();
  };


  // ==========================================
  // Apply a scanned label — same matching rules
  // as Material Issue: match by palletNo OR
  // fifoPalletNo, resolve ambiguity by GRN,
  // reject anything that can't be verified
  // against real synced data.
  // ==========================================

  const applyScannedLabel = (raw) => {

    if (!raw) return;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      reject(
        `Scanned code is not valid JSON — the label is malformed. ` +
        `Raw value: ${raw.length > 140 ? raw.slice(0, 140) + '…' : raw}`
      );
      return;
    }

    const scannedPalletNo = parsed.palletNo;
    const scannedFifoNo = parsed.fifoPalletNo;
    const scannedGrn = parsed.grn;

    if (!scannedPalletNo && !scannedFifoNo) {
      reject('Scanned code is missing Pallet No / FIFO Pallet No — not a valid GRN label.');
      return;
    }

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
        reject(
          `Pallet "${scannedPalletNo || scannedFifoNo}" is ambiguous — ${candidates.length} pallets ` +
          `in synced data share this label (labels get reused across GRNs). This scan has no GRN ` +
          `to tell them apart — rejected. Ask for a label that includes the GRN number.`
        );
        return;
      }
      const grnMatches = candidates.filter((p) => p.grnNo && String(p.grnNo) === String(scannedGrn));
      if (grnMatches.length === 1) {
        match = grnMatches[0];
      } else {
        reject(
          `Pallet "${scannedPalletNo || scannedFifoNo}" under GRN ${scannedGrn} could not be uniquely ` +
          `resolved in synced data — rejected. Run Data Sync and check for duplicate records.`
        );
        return;
      }
    }

    if (!match) {

      // Not in the in-stock list — check the broader status cache before
      // giving up, so an issued pallet gets an accurate reason instead
      // of the generic "not found" message.
      const statusMatch = palletStatus.find((p) =>
        (scannedPalletNo && p.palletNo === scannedPalletNo) ||
        (scannedFifoNo && p.fifoPalletNo === scannedFifoNo)
      );

      if (statusMatch && statusMatch.status === 'ISSUED') {
        reject(
          `Pallet ${statusMatch.palletNo} (GRN ${statusMatch.grnNo || '—'}) has already been issued out ` +
          `and is no longer in the warehouse. It cannot be verified.`
        );
        return;
      }

      reject(
        `Pallet "${scannedPalletNo || scannedFifoNo}" was not found in synced data. This GRN may not ` +
        `exist, may not be posted/stuffed yet, or hasn't been synced to this device. Run Data Sync and try again.`
      );
      return;
    }
    if (scannedGrn && match.grnNo && String(match.grnNo) !== String(scannedGrn)) {
      reject(`Pallet ${match.palletNo} belongs to GRN ${match.grnNo}, not ${scannedGrn} — scan rejected. Check the label.`);
      return;
    }

    if (verifiedPalletIds.has(match.id)) {
      reject(
        `Pallet ${match.palletNo} (GRN ${match.grnNo || '—'}) was already verified — it cannot be verified again. If this is a mistake, contact an admin.`
      );
      return;
    }

    setResult({
      palletId: match.id,
      grnNo: match.grnNo || '—',
      partLabel: match.partLabel || String(match.itemId),
      itemId: match.itemId,
      palletNo: match.palletNo,
      quantity: match.quantity,
      storeLocation: match.storeLocation || '',
    });
    setScanState('success');
    setScannedError('');
    // FIX: clear the raw scanned text immediately on a successful
    // match too — the verified details are shown in their own card
    // below, so the input box doesn't need to keep holding the JSON.
    setScannedRaw('');
    toast.success(`Pallet ${match.palletNo} (GRN ${match.grnNo || '—'}) verified.`);
    refocusScanInput();
  };


  // ==========================================
  // Scan input handlers
  // ==========================================

  const handleScanChange = (e) => {
    const value = e.target.value;
    setScannedRaw(value);

    const trimmed = value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      applyScannedLabel(trimmed);
    }
  };

  const handleScanKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyScannedLabel(e.target.value.trim());
    }
  };


  // ==========================================
  // Save — writes the verified pallet to the
  // LOCAL offline DB, ready for next Data Sync.
  // ==========================================

  const handleSave = async () => {

    if (scanState !== 'success' || !result.palletId) {
      toast.error('Scan a valid label before saving.');
      return;
    }

    // Guard against a double-click / re-triggered save inserting the
    // same pallet twice before the Set state updates.
    if (verifiedPalletIds.has(result.palletId)) {
      reject(`Pallet ${result.palletNo} was already verified — cannot save again.`);
      return;
    }

    setSaving(true);

    try {
      await queuePendingVerification({
        palletId: result.palletId,
        itemId: result.itemId,
        grnNumber: result.grnNo === '—' ? null : result.grnNo,
        partLabel: result.partLabel,
        palletNo: result.palletNo,
        quantity: result.quantity,
        storeLocation: result.storeLocation,
        verifiedAt: new Date().toISOString(),
      });

      setVerifiedPalletIds((prev) => new Set(prev).add(result.palletId));
      toast.success(`Pallet ${result.palletNo} verification saved to this device.`);
      resetScan();

    } catch (err) {
      console.error('Failed to save verification offline:', err);
      toast.error('Failed to save locally. Please try again.');
    } finally {
      setSaving(false);
    }

  };


  const isMatched = scanState === 'success';


  // ==========================================
  // Render
  // ==========================================

  return (

    <div className="sv-page">

      <header className="sv-topbar">
        <button type="button" className="sv-icon-btn" onClick={handleBack} title="Back" aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="sv-topbar-title">
          <div className="sv-topbar-main">FPMS</div>
          <div className="sv-topbar-sub">STORE VERIFICATION</div>
        </div>
        <button type="button" className="sv-icon-btn" onClick={handleLogout} title="Logout" aria-label="Logout">
          <FaSignOutAlt />
        </button>
      </header>

      <main className="sv-body">

        <div className="sv-info-banner">
          <div className="sv-info-icon"><FaInfoCircle /></div>
          <div>
            <div className="sv-info-title">Scan GRN Label</div>
            <div className="sv-info-sub">Scan the GRN label to verify and enable saving.</div>
          </div>
        </div>

        <div className="sv-step-card">

          <div className="sv-step-header">
            <div className="sv-step-icon"><FaFileAlt /></div>
            <div>
              <div className="sv-step-title">1. Scan GRN Label</div>
              <div className="sv-step-sub">
                {palletsLoaded ? 'Scan the GRN label to continue' : 'Loading synced pallets…'}
              </div>
            </div>
          </div>

          <input
            ref={scanInputRef}
            className="sv-scan-input"
            placeholder="Scan a label — verifies automatically"
            value={scannedRaw}
            onChange={handleScanChange}
            onKeyDown={handleScanKeyDown}
            disabled={!palletsLoaded}
            autoFocus
          />

          <div
            className={
              'sv-value-box ' +
              (scanState === 'idle' ? 'sv-value-idle' : scanState === 'success' ? 'sv-value-success' : 'sv-value-error')
            }
          >
            {scanState === 'error'
              ? scannedError
              : scanState === 'success'
                ? `${result.palletNo} — GRN ${result.grnNo}`
                : 'Scanned value will appear here'}
          </div>

        </div>

        {scanState === 'success' && (
          <div className="sv-step-card">
            <div className="sv-step-title" style={{ marginBottom: 10 }}>Verified Details</div>
            <div className="sv-detail-row"><span>GRN No.</span><strong>{result.grnNo}</strong></div>
            <div className="sv-detail-row"><span>Part No.</span><strong>{result.partLabel}</strong></div>
            <div className="sv-detail-row"><span>Pallet No.</span><strong>{result.palletNo}</strong></div>
            <div className="sv-detail-row"><span>Quantity</span><strong>{result.quantity}</strong></div>
            <div className="sv-detail-row"><span>Location</span><strong>{result.storeLocation || '—'}</strong></div>
          </div>
        )}

        <div className={`sv-match-card ${isMatched ? 'sv-match-ok' : ''}`}>
          <div className="sv-match-icon"><FaShieldAlt /></div>
          <div>
            <div className="sv-match-title">Match Status</div>
            <div className="sv-match-sub">
              {isMatched
                ? 'Label verified against synced data. You can save now.'
                : scanState === 'error'
                  ? scannedError
                  : 'Please scan the GRN label to verify.'}
            </div>
          </div>
        </div>

        <div className="sv-body-spacer" />

      </main>

      <div className="sv-footer">
        <button type="button" className="sv-save-btn" disabled={!isMatched || saving} onClick={handleSave}>
          <FaSave /> {saving ? 'Saving…' : 'Save'}
        </button>
        <div className="sv-footer-hint">
          <FaLock /> Save will be enabled once the label is verified
        </div>
      </div>

    </div>
  );
};

export default StoreVerification;