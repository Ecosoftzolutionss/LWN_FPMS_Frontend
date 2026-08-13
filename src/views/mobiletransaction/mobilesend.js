import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  FaBars,
  FaSignOutAlt,
  FaChartPie,
  FaClipboardList,
  FaQrcode,
  FaArrowRight,
  FaTh,
  FaExclamationTriangle,
} from 'react-icons/fa';

import '../../assets/CSS/mobility.css';

import API from '../../api';
import DataSyncModal from './DataSync';
import {
  replacePalletsCache,
  getAllPendingIssues,
  removePendingIssue,
  countPendingIssues,
  clearAllPendingIssues,
} from './offlineDb';


// ==========================================
// Mobility
// ==========================================

const Mobility = () => {

  const navigate = useNavigate();


  // ========================================
  // User
  // ========================================

  const user = JSON.parse(
    sessionStorage.getItem('user') || '{}'
  );


  // ========================================
  // Data Sync state
  // ========================================

  const [dataSinkModalOpen, setDataSinkModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState({
    downloadedCount: 0,
    uploadedCount: 0,
    failedCount: 0,
  });
  const [pendingCount, setPendingCount] = useState(0);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);


  useEffect(() => {

    const loadPendingCount = async () => {
      try {
        const count = await countPendingIssues();
        setPendingCount(count);
      } catch (error) {
        console.error('Failed to read pending issue count:', error);
      }
    };

    loadPendingCount();

  }, []);


  // ========================================
  // Logout
  // ========================================

  const handleLogout = async () => {

    try {

      await API.post('/Auth/logout');

    } catch (error) {

      console.error(
        'Logout API error:',
        error
      );

    }


    sessionStorage.clear();

    window.dispatchEvent(
      new Event('authChange')
    );

    navigate(
      '/login',
      {
        replace: true,
      }
    );

  };


  // ========================================
  // Data Sink — real offline sync
  // ========================================

  const handleDataSink = async () => {

    if (!navigator.onLine) {
      toast.error('You need Wi-Fi/internet to sync. Please connect and try again.');
      return;
    }

    setSyncing(true);

    let uploadedCount = 0;
    let failedCount = 0;
    let downloadedCount = 0;

    try {

      // ---- 1. Upload pending issues ----

      const pending = await getAllPendingIssues();

      for (const issue of pending) {

        try {

          const { localId, ...payload } = issue;

          await API.post('/MaterialIssue', payload);
          await removePendingIssue(localId);

          uploadedCount += 1;

        } catch (err) {

          const detail = err?.response?.data?.message || err.message;
          console.error(`Failed to upload pending issue: ${detail}`, err);
          failedCount += 1;

        }

      }

      // ---- 2. Download real in-store pallets (now excludes
      //         already-issued pallets, server-side) ----

      try {

        const res = await API.get('/StoreMovement/available-pallets');
        const pallets = res.data || [];

        await replacePalletsCache(pallets);
        downloadedCount = pallets.length;

      } catch (err) {

        console.error('Failed to refresh pallets cache:', err);

      }

      setSyncStats({ downloadedCount, uploadedCount, failedCount });

      const remaining = await countPendingIssues();
      setPendingCount(remaining);

      setDataSinkModalOpen(true);

    } catch (err) {

      console.error('Sync failed:', err);
      toast.error('Sync failed. Please try again.');

    } finally {

      setSyncing(false);

    }

  };


  // ========================================
  // Clear Local Data
  // ========================================

  const handleClearLocalDataClick = () => {
    setClearConfirmOpen(true);
  };

  const handleConfirmClearLocalData = async () => {

    try {
      await clearAllPendingIssues();
      setPendingCount(0);
      toast.success('Local pending data cleared. You can start fresh.');
    } catch (err) {
      console.error('Failed to clear local data:', err);
      toast.error('Failed to clear local data. Please try again.');
    } finally {
      setClearConfirmOpen(false);
    }

  };


  // ========================================
  // Material Issue
  // ========================================

  const handleMaterialIssue = () => {

    navigate(
      '/mobiletransaction/materialissue'
    );

  };


  // ========================================
  // Store Verification
  // ========================================

  const handleStoreVerification = () => {

    navigate(
      '/mobiletransaction/storeverification'
    );

  };


  // ========================================
  // Keyboard Handler
  // ========================================

  const handleCardKeyDown = (
    event,
    handler
  ) => {

    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {

      event.preventDefault();

      handler();

    }

  };


  // ========================================
  // Render
  // ========================================

  return (

    <div className="mobility-page">


      {/* ======================================
          HEADER
      ====================================== */}

      <header className="mobility-header">


        {/* Hamburger */}

        <button
          type="button"
          className="mobility-menu-button"
          aria-label="Menu"
        >

          <FaBars />

        </button>


        {/* Logo */}

        <div className="mobility-logo">

          <div className="mobility-logo-title">
            FPMS
          </div>

          <div className="mobility-logo-subtitle">
            PALLET OUTWARD
          </div>

        </div>


        {/* Logout */}

        <button
          type="button"
          className="mobility-header-logout"
          onClick={handleLogout}
          title="Logout"
          aria-label="Logout"
        >

          <FaSignOutAlt />

        </button>

      </header>


      {/* ======================================
          MAIN
      ====================================== */}

      <main className="mobility-main">


        {/* ====================================
            SECTION HEADER
        ==================================== */}

        <div className="mobility-section-header">

          <div className="mobility-section-title-row">

            <div className="mobility-section-icon">

              <FaTh />

            </div>

            <h2>
              Choose an Option
            </h2>

          </div>


          <p>
            Select an option to continue with
            pallet outward process.
          </p>

        </div>


        {/* ====================================
            OPTIONS
        ==================================== */}

        <div className="mobility-options">


          {/* ==================================
              DATA SYNC
          ================================== */}

          <div
            className="mobility-option-card"
            onClick={handleDataSink}
            onKeyDown={(event) =>
              handleCardKeyDown(
                event,
                handleDataSink
              )
            }
            role="button"
            tabIndex={0}
          >

            <div className="mobility-option-left">


              <div className="mobility-option-icon">

                <FaChartPie />

              </div>


              <div className="mobility-option-content">

                <h3>
                  Data Sync
                  {pendingCount > 0 && (
                    <span className="mobility-pending-badge">
                      {pendingCount}
                    </span>
                  )}
                </h3>

                <p>
                  {syncing
                    ? 'Syncing local data…'
                    : 'Fetch store-moved pallets and sync data.'}
                </p>

              </div>

            </div>


            <div
              className="mobility-arrow-button"
              aria-label="Open Data Sync"
            >

              <FaArrowRight />

            </div>

          </div>


          {/* ==================================
              MATERIAL ISSUE
          ================================== */}

          <div
            className="mobility-option-card"
            onClick={handleMaterialIssue}
            onKeyDown={(event) =>
              handleCardKeyDown(
                event,
                handleMaterialIssue
              )
            }
            role="button"
            tabIndex={0}
          >

            <div className="mobility-option-left">


              <div className="mobility-option-icon">

                <FaClipboardList />

              </div>


              <div className="mobility-option-content">

                <h3>
                  Material Issue
                </h3>

                <p>
                  Issue material/pallets to production
                  or other departments.
                </p>

              </div>

            </div>


            <div
              className="mobility-arrow-button"
              aria-label="Open Material Issue"
            >

              <FaArrowRight />

            </div>

          </div>


          {/* ==================================
              STORE VERIFICATION
          ================================== */}

          <div
            className="mobility-option-card"
            onClick={handleStoreVerification}
            onKeyDown={(event) =>
              handleCardKeyDown(
                event,
                handleStoreVerification
              )
            }
            role="button"
            tabIndex={0}
          >

            <div className="mobility-option-left">
              <div className="mobility-option-icon">
                <FaQrcode />
              </div>
              <div className="mobility-option-content">
                <h3>
                  Store Verification
                </h3>
                <p>
                  Scan Store Label and GRN Label.
                </p>
              </div>
            </div>
            <div
              className="mobility-arrow-button"
              aria-label="Open Store Verification"
            >
              <FaArrowRight />
            </div>
          </div>

        </div>

        {pendingCount > 0 && (
          <button
            type="button"
            className="mobility-clear-local-btn"
            onClick={handleClearLocalDataClick}
          >
            Clear Local Data ({pendingCount} pending)
          </button>
        )}

      </main>


      {/* ======================================
          DATA SYNC RESULT MODAL
      ====================================== */}

      <DataSyncModal
        open={dataSinkModalOpen}
        onClose={() => setDataSinkModalOpen(false)}
        downloadedCount={syncStats.downloadedCount}
        uploadedCount={syncStats.uploadedCount}
        failedCount={syncStats.failedCount}
        downloadLabel="pallets"
        uploadLabel="issues"
      />


      {/* ======================================
          CLEAR LOCAL DATA — in-app confirm modal
      ====================================== */}

      {clearConfirmOpen && (
        <div
          className="mobility-confirm-overlay"
          onClick={() => setClearConfirmOpen(false)}
        >
          <div
            className="mobility-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="mobility-confirm-icon">
              <FaExclamationTriangle />
            </div>

            <div className="mobility-confirm-title">
              Clear Local Data?
            </div>

            <div className="mobility-confirm-message">
              This will permanently delete <strong>{pendingCount}</strong> unsent
              record{pendingCount === 1 ? '' : 's'} saved on this device. They will
              NOT be uploaded. This cannot be undone.
            </div>

            <div className="mobility-confirm-actions">

              <button
                type="button"
                className="mobility-confirm-cancel-btn"
                onClick={() => setClearConfirmOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="mobility-confirm-delete-btn"
                onClick={handleConfirmClearLocalData}
              >
                Clear Data
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};


export default Mobility;
