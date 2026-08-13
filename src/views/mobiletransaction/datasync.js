import React from 'react';
import { FaCheck, FaDatabase, FaServer, FaExclamationTriangle } from 'react-icons/fa';

import '../../assets/CSS/dataSyncModal.css';

// ==========================================
// Data Sync Success Modal
// ==========================================
//
// Props:
//   open           : boolean - show/hide modal
//   onClose        : function - called when OK is clicked
//   downloadedCount: number - records cached locally this sync (default 0)
//   uploadedCount  : number - records uploaded to the server this sync (default 0)
//   failedCount    : number - records that failed to upload (default 0)
//   downloadLabel  : string - what was downloaded, e.g. "pallets", "locations" (default "records")
//   uploadLabel    : string - what was uploaded, e.g. "issues", "verifications" (default "records")
//
// Same UI/layout as before — only the text content is now driven by
// real sync results instead of being hardcoded.
// ==========================================

const DataSyncModal = ({
  open,
  onClose,
  downloadedCount = 0,
  uploadedCount = 0,
  failedCount = 0,
  downloadLabel = 'records',
  uploadLabel = 'records',
}) => {

  if (!open) return null;

  const hasFailures = failedCount > 0;

  return (

    <div className="dsm-overlay" onClick={onClose}>

      <div className="dsm-modal" onClick={(e) => e.stopPropagation()}>

        {/* ==================================
            SUCCESS ICON
        ================================== */}

        <div className="dsm-icon-wrap">
          <div className={`dsm-icon-ring ${hasFailures ? 'has-warning' : ''}`}>
            <div className={`dsm-icon-circle ${hasFailures ? 'has-warning' : ''}`}>
              {hasFailures ? <FaExclamationTriangle /> : <FaCheck />}
            </div>
          </div>
        </div>


        {/* ==================================
            TITLE
        ================================== */}

        <h2 className="dsm-title">
          {hasFailures ? (
            <>Data Synced<br />with Issues</>
          ) : (
            <>Data Synced<br />Successfully!</>
          )}
        </h2>

        <p className="dsm-subtitle">
          {downloadedCount} {downloadLabel} cached locally
          {uploadedCount > 0 && `, ${uploadedCount} ${uploadLabel} uploaded`}
          {hasFailures && ` — ${failedCount} ${uploadLabel} still pending, will retry next sync`}.
        </p>


        {/* ==================================
            STATUS ROWS
        ================================== */}

        <div className="dsm-status-list">

          <div className="dsm-status-row">

            <div className="dsm-status-icon">
              <FaDatabase />
            </div>

            <div className="dsm-status-content">
              <div className="dsm-status-title">Local Cache</div>
              <div className="dsm-status-sub">
                {downloadedCount} {downloadLabel} saved to this device
              </div>
            </div>

            <div className="dsm-status-check">
              <FaCheck />
            </div>

          </div>

          <div className="dsm-status-row">

            <div className="dsm-status-icon">
              <FaServer />
            </div>

            <div className="dsm-status-content">
              <div className="dsm-status-title">Server Upload</div>
              <div className="dsm-status-sub">
                {uploadedCount > 0
                  ? `${uploadedCount} ${uploadLabel} sent to server`
                  : `No ${uploadLabel} were waiting to upload`}
                {hasFailures && ` (${failedCount} failed)`}
              </div>
            </div>

            <div className={`dsm-status-check ${hasFailures ? 'has-warning' : ''}`}>
              {hasFailures ? <FaExclamationTriangle /> : <FaCheck />}
            </div>

          </div>

        </div>


        {/* ==================================
            OK BUTTON
        ================================== */}

        <button
          type="button"
          className="dsm-ok-btn"
          onClick={onClose}
        >
          OK
        </button>

      </div>

    </div>

  );

};

export default DataSyncModal;
