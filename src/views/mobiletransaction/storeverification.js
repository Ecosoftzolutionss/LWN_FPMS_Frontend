import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  FaArrowLeft,
  FaSignOutAlt,
  FaInfoCircle,
  FaFileAlt,
  FaThLarge,
  FaShieldAlt,
  FaSave,
  FaLock,
} from 'react-icons/fa';

import API from '../../api';
import '../../assets/CSS/storeVerification.css';

// ==========================================
// Store Verification
// ==========================================

const StoreVerification = () => {

  const navigate = useNavigate();

  // UI-only demo state: 'idle' | 'success' | 'error'
  const [scanState, setScanState] = useState('idle');
  const [scannedValue, setScannedValue] = useState('');

  const isMatched = scanState === 'success';


  // ==========================================
  // Logout
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


  // ==========================================
  // Back
  // ==========================================

  const handleBack = () => {
    navigate('/m/send');
  };


  // ==========================================
  // Demo scan trigger (UI only — no real scanning)
  // ==========================================

  const handleScanClick = () => {
    // Cycles through demo states just to preview the UI
    if (scanState === 'idle') {
      setScanState('success');
      setScannedValue('QL-12589756');
    } else if (scanState === 'success') {
      setScanState('error');
      setScannedValue('QL-12589556');
    } else {
      setScanState('idle');
      setScannedValue('');
    }
  };


  // ==========================================
  // Render
  // ==========================================

  return (

    <div className="sv-page">

      {/* ======================================
          HEADER (fixed)
      ====================================== */}

      <header className="sv-topbar">

        <button
          type="button"
          className="sv-icon-btn"
          onClick={handleBack}
          title="Back"
          aria-label="Back"
        >
          <FaArrowLeft />
        </button>

        <div className="sv-topbar-title">
          <div className="sv-topbar-main">FPMS</div>
          <div className="sv-topbar-sub">STORE VERIFICATION</div>
        </div>

        <button
          type="button"
          className="sv-icon-btn"
          onClick={handleLogout}
          title="Logout"
          aria-label="Logout"
        >
          <FaSignOutAlt />
        </button>

      </header>


      {/* ======================================
          SCROLLABLE BODY
      ====================================== */}

      <main className="sv-body">

        {/* INFO BANNER */}

        <div className="sv-info-banner">
          <div className="sv-info-icon">
            <FaInfoCircle />
          </div>
          <div>
            <div className="sv-info-title">Scan Store Label and GRN Label</div>
            <div className="sv-info-sub">Both labels must match to enable saving.</div>
          </div>
        </div>

        {/* STEP 1 — SCAN STORE LABEL */}

        <div className="sv-step-card">

          <div className="sv-step-header">
            <div className="sv-step-icon">
              <FaFileAlt />
            </div>
            <div>
              <div className="sv-step-title">1. Scan Store Label</div>
              <div className="sv-step-sub">Scan the store label to begin</div>
            </div>
          </div>

          <button type="button" className="sv-scan-btn">
            <FaThLarge /> Scan Store Label
          </button>

          <div className="sv-value-box sv-value-idle">
            Scanned value will appear here
          </div>

        </div>

        {/* STEP 2 — SCAN GRN LABEL */}

        <div className="sv-step-card">

          <div className="sv-step-header">
            <div className="sv-step-icon">
              <FaFileAlt />
            </div>
            <div>
              <div className="sv-step-title">2. Scan GRN Label</div>
              <div className="sv-step-sub">Scan the GRN label to continue</div>
            </div>
          </div>

          <button type="button" className="sv-scan-btn" onClick={handleScanClick}>
            <FaThLarge /> Scan GRN Label
          </button>

          <div
            className={
              'sv-value-box ' +
              (scanState === 'idle'
                ? 'sv-value-idle'
                : scanState === 'success'
                ? 'sv-value-success'
                : 'sv-value-error')
            }
          >
            {scannedValue || 'Scanned value will appear here'}
          </div>

        </div>

        {/* MATCH STATUS */}

        <div className={`sv-match-card ${isMatched ? 'sv-match-ok' : ''}`}>
          <div className="sv-match-icon">
            <FaShieldAlt />
          </div>
          <div>
            <div className="sv-match-title">Match Status</div>
            <div className="sv-match-sub">
              {isMatched
                ? 'Labels match. You can save now.'
                : scanState === 'error'
                ? 'Labels do not match.'
                : 'Please scan both labels to verify.'}
            </div>
          </div>
        </div>

        <div className="sv-body-spacer" />

      </main>


      {/* ======================================
          FIXED FOOTER — SAVE
      ====================================== */}

      <div className="sv-footer">

        <button
          type="button"
          className="sv-save-btn"
          disabled={!isMatched}
        >
          <FaSave /> Save
        </button>

        <div className="sv-footer-hint">
          <FaLock /> Save will be enabled when labels match
        </div>

      </div>

    </div>

  );

};

export default StoreVerification;
