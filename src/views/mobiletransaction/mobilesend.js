import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
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
  getAllPendingVerifications,
  removePendingVerification,
  countPendingVerifications,
  clearAllPendingVerifications,
  replaceVerifiedIdsCache,
  replacePalletStatusCache, 
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
        const issueCount = await countPendingIssues();
        const verificationCount = await countPendingVerifications();
        setPendingCount(issueCount + verificationCount);
      } catch (error) {
        console.error('Failed to read pending counts:', error);
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
      toast.error(
        'You need Wi-Fi/internet to sync. Please connect and try again.'
      );
      return;
    }

    if (syncing) {
      return;
    }

    setSyncing(true);

    let uploadedCount = 0;
    let failedCount = 0;
    let downloadedCount = 0;

    try {

      // ============================================================
      // 1. UPLOAD PENDING MATERIAL ISSUES
      // ============================================================

      const pendingIssues = await getAllPendingIssues();

      console.log(
        '[DATA SYNC] Pending Material Issues:',
        pendingIssues.length,
        pendingIssues
      );

      for (const issue of pendingIssues) {

        // Refresh the broader pallet-status cache (in-stock + issued), used
// by Store Verification to give an accurate reason when a scanned
// pallet isn't in the "available" list — e.g. because it was
// already issued out, rather than never existing at all.
try {

  const statusRes = await API.get(
    '/StoreMovement/all-pallets-status'
  );

  const statusPallets =
    Array.isArray(statusRes.data)
      ? statusRes.data
      : [];

  console.log(
    '[DATA SYNC] Downloaded pallet status records:',
    statusPallets.length
  );

  await replacePalletStatusCache(statusPallets);

} catch (err) {

  console.error(
    '[DATA SYNC] Pallet status download failed:',
    {
      status: err?.response?.status,
      responseData: err?.response?.data,
      message: err?.message
    }
  );

  // Same reasoning as the other downloads — don't let this failure
  // undo successfully uploaded/downloaded data.
}
        try {

          const {
            localId,
            ...payload
          } = issue;

          console.log(
            '[DATA SYNC] Uploading Material Issue:',
            payload
          );

          const response = await API.post(
            '/MaterialIssue',
            payload
          );

          console.log(
            '[DATA SYNC] Material Issue uploaded:',
            response.status,
            response.data
          );

          // Delete only after successful API call
          await removePendingIssue(localId);

          uploadedCount++;

        } catch (err) {

          const status =
            err?.response?.status;

          const responseData =
            err?.response?.data;

          const message =
            responseData?.message ||
            (
              typeof responseData === 'string'
                ? responseData
                : null
            ) ||
            err?.message ||
            'Unknown error';

          console.error(
            '[DATA SYNC] Material Issue upload failed',
            {
              status,
              message,
              responseData,
              error: err
            }
          );

          failedCount++;
        }
      }


      // ============================================================
      // 2. UPLOAD PENDING STORE VERIFICATIONS
      // ============================================================

      const pendingVerifications =
        await getAllPendingVerifications();

      console.log(
        '[DATA SYNC] ========================================'
      );

      console.log(
        '[DATA SYNC] Pending Store Verifications:',
        pendingVerifications.length,
        pendingVerifications
      );

      console.log(
        '[DATA SYNC] Store Verification endpoint:',
        '/StoreVerification'
      );

      console.log(
        '[DATA SYNC] ========================================'
      );


      for (const verification of pendingVerifications) {

        try {

          // --------------------------------------------------------
          // IndexedDB-only fields must NOT be sent to backend
          // --------------------------------------------------------

          const {
            localId,
            palletId,
            partLabel,
            itemId,
            grnNumber,
            palletNo,
            quantity,
            storeLocation,
            verifiedAt
          } = verification;


          // --------------------------------------------------------
          // Build EXACT backend payload
          // --------------------------------------------------------

          const payload = {
            palletId: Number(palletId),
            itemId: Number(itemId),
            grnNumber: grnNumber === null || grnNumber === undefined ? null : String(grnNumber).trim(),
            palletNo: palletNo === null || palletNo === undefined ? '' : String(palletNo).trim(),
            quantity: Number(quantity),
            storeLocation: storeLocation === null || storeLocation === undefined ? null : String(storeLocation).trim(),
            verifiedAt: verifiedAt ? verifiedAt : new Date().toISOString()
          };


          // --------------------------------------------------------
          // Validate before API call
          // --------------------------------------------------------

          if (!Number.isInteger(payload.palletId) || payload.palletId <= 0) {
            throw new Error(`Invalid palletId: ${palletId}`);
          }

          if (!Number.isInteger(payload.itemId) ||
              payload.itemId <= 0) {

            throw new Error(
              `Invalid ItemId: ${itemId}`
            );
          }


          if (!payload.palletNo) {

            throw new Error(
              'Pallet No is required'
            );
          }


          if (
            !Number.isFinite(payload.quantity) ||
            payload.quantity <= 0
          ) {

            throw new Error(
              `Invalid quantity: ${quantity}`
            );
          }


          console.log(
            '[DATA SYNC] Store Verification payload:',
            JSON.stringify(payload, null, 2)
          );


          // --------------------------------------------------------
          // ACTUAL API CALL
          // --------------------------------------------------------

          const response = await API.post(
            '/StoreVerification',
            payload
          );


          console.log(
            '[DATA SYNC] Store Verification API SUCCESS:',
            {
              status: response.status,
              data: response.data
            }
          );


          // --------------------------------------------------------
          // Delete local record ONLY after API success
          // --------------------------------------------------------

          await removePendingVerification(
            localId
          );

          uploadedCount++;

          console.log(
            `[DATA SYNC] Store Verification ${localId} synced successfully`
          );

        } catch (err) {

          const status =
            err?.response?.status;

          const responseData =
            err?.response?.data;

          const message =
            responseData?.message ||
            (
              typeof responseData === 'string'
                ? responseData
                : null
            ) ||
            err?.message ||
            'Unknown error';

          // A 409 Conflict means the backend's own duplicate guard
          // caught it — treat this as "already handled", not a
          // failure to retry. Remove the local record so it doesn't
          // sit in the queue forever trying (and failing) again.
          if (status === 409) {
            console.warn(
              '[DATA SYNC] Store Verification duplicate rejected by server — removing from local queue:',
              { localId: verification?.localId, message }
            );
            await removePendingVerification(verification.localId);
            continue;
          }

          console.error(
            '[DATA SYNC] Store Verification upload FAILED',
            {
              localId: verification?.localId,
              itemId: verification?.itemId,
              palletNo: verification?.palletNo,
              status,
              message,
              responseData,
              error: err
            }
          );

          // IMPORTANT:
          // Do NOT remove the IndexedDB record.
          // It will retry on the next Data Sync.
          failedCount++;
        }
      }


      // ============================================================
      // 3. DOWNLOAD LATEST PALLET DATA + VERIFIED-PALLET-IDS
      // ============================================================

      try {

        const response = await API.get(
          '/StoreMovement/available-pallets'
        );

        const pallets =
          Array.isArray(response.data)
            ? response.data
            : [];

        console.log(
          '[DATA SYNC] Downloaded pallets:',
          pallets.length
        );

        await replacePalletsCache(
          pallets
        );

        downloadedCount =
          pallets.length;

      } catch (err) {

        const status =
          err?.response?.status;

        const responseData =
          err?.response?.data;

        console.error(
          '[DATA SYNC] Pallet download failed:',
          {
            status,
            responseData,
            message: err?.message
          }
        );

        // Download failure should not destroy
        // successfully uploaded records.
      }

      // Refresh the server-confirmed verified-pallet-ids cache. This
      // is what lets the duplicate guard in StoreVerification.jsx
      // survive app restarts and stay correct even after a pending
      // verification uploads and disappears from the local queue.
      try {

        const verifiedRes = await API.get(
          '/StoreVerification/verified-pallet-ids'
        );

        const verifiedIds =
          Array.isArray(verifiedRes.data)
            ? verifiedRes.data
            : [];

        console.log(
          '[DATA SYNC] Downloaded verified pallet ids:',
          verifiedIds.length
        );

        await replaceVerifiedIdsCache(verifiedIds);

      } catch (err) {

        console.error(
          '[DATA SYNC] Verified-pallet-ids download failed:',
          {
            status: err?.response?.status,
            responseData: err?.response?.data,
            message: err?.message
          }
        );

        // Same reasoning as the pallets download — don't let this
        // failure undo successfully uploaded/downloaded data.
      }


      // ============================================================
      // 4. GET ACTUAL REMAINING PENDING COUNT
      // ============================================================

      const remainingIssues =
        await countPendingIssues();

      const remainingVerifications =
        await countPendingVerifications();

      const totalRemaining =
        remainingIssues +
        remainingVerifications;


      console.log(
        '[DATA SYNC] Remaining Material Issues:',
        remainingIssues
      );

      console.log(
        '[DATA SYNC] Remaining Store Verifications:',
        remainingVerifications
      );

      console.log(
        '[DATA SYNC] Total Pending:',
        totalRemaining
      );


      setPendingCount(
        totalRemaining
      );


      // ============================================================
      // 5. SET MODAL RESULT
      // ============================================================

      setSyncStats({
        downloadedCount,
        uploadedCount,
        failedCount
      });

      setDataSinkModalOpen(
        true
      );

    } catch (err) {

      console.error(
        '[DATA SYNC] Unexpected sync error:',
        err
      );

      toast.error(
        'Data Sync failed. Please try again.'
      );

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

      await clearAllPendingVerifications();

      setPendingCount(0);

      toast.success(
        'All pending local data cleared. You can start fresh.'
      );

    } catch (err) {

      console.error(
        'Failed to clear local data:',
        err
      );

      toast.error(
        'Failed to clear local data. Please try again.'
      );

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

        {/* <button
          type="button"
          className="mobility-menu-button"
          aria-label="Menu"
        >

          <FaBars />

        </button> */}


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

        {/* {pendingCount > 0 && (
          // <button
          //   type="button"
          //   className="mobility-clear-local-btn"
          //   onClick={handleClearLocalDataClick}
          // >
          //   Clear Local Data ({pendingCount} pending)
          // </button>
        )} */}

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
        uploadLabel="records"
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