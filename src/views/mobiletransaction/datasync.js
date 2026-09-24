import React from 'react';
import {
  FaCheck,
  FaDatabase,
  FaServer,
  FaExclamationTriangle,
} from 'react-icons/fa';

import '../../assets/CSS/dataSyncModal.css';

const DataSyncModal = ({
  open,
  onClose,
  downloadedCount = 0,
  uploadedCount = 0,
  failedCount = 0,
  downloadLabel = 'pallets',
  uploadLabel = 'records',
}) => {
  if (!open) return null;

  const downloaded = Number(downloadedCount || 0);
  const uploaded = Number(uploadedCount || 0);
  const failed = Number(failedCount || 0);

  const hasFailures = failed > 0;

  return (
    <div className="dsm-overlay" onClick={onClose}>
      <div
        className="dsm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =====================================================
            ICON
        ===================================================== */}
        <div className="dsm-icon-wrap">
          <div
            className={`dsm-icon-ring ${
              hasFailures ? 'has-warning' : ''
            }`}
          >
            <div
              className={`dsm-icon-circle ${
                hasFailures ? 'has-warning' : ''
              }`}
            >
              {hasFailures ? (
                <FaExclamationTriangle />
              ) : (
                <FaCheck />
              )}
            </div>
          </div>
        </div>

        {/* =====================================================
            TITLE
        ===================================================== */}
        <h2 className="dsm-title">
          {hasFailures ? (
            <>
              Data Synced
              <br />
              with Issues
            </>
          ) : (
            <>
              Data Synced
              <br />
              Successfully!
            </>
          )}
        </h2>

        {/* =====================================================
            SUMMARY
            ONLY PALLET COUNT IS DISPLAYED AS DOWNLOAD COUNT
        ===================================================== */}
        <p className="dsm-subtitle">
          {downloaded} {downloadLabel} cached locally

          {uploaded > 0 && (
            <>
              {' — '}
              {uploaded} {uploadLabel} uploaded
            </>
          )}

          {hasFailures && (
            <>
              {' — '}
              {failed} {uploadLabel}
              {failed === 1 ? '' : 's'} still pending,
              will retry next sync
            </>
          )}

          .
        </p>

        {/* =====================================================
            STATUS LIST
        ===================================================== */}
        <div className="dsm-status-list">
          {/* LOCAL CACHE */}
          <div className="dsm-status-row">
            <div className="dsm-status-icon">
              <FaDatabase />
            </div>

            <div className="dsm-status-content">
              <div className="dsm-status-title">
                Local Cache
              </div>

              <div className="dsm-status-sub">
                {downloaded} {downloadLabel} saved to this device
              </div>
            </div>

            <div className="dsm-status-check">
              <FaCheck />
            </div>
          </div>

          {/* SERVER UPLOAD */}
          <div className="dsm-status-row">
            <div className="dsm-status-icon">
              <FaServer />
            </div>

            <div className="dsm-status-content">
              <div className="dsm-status-title">
                Server Upload
              </div>

              <div className="dsm-status-sub">
                {uploaded > 0
                  ? `${uploaded} ${uploadLabel} sent to server`
                  : `No ${uploadLabel} were waiting to upload`}

                {hasFailures && ` (${failed} failed)`}
              </div>
            </div>

            <div
              className={`dsm-status-check ${
                hasFailures ? 'has-warning' : ''
              }`}
            >
              {hasFailures ? (
                <FaExclamationTriangle />
              ) : (
                <FaCheck />
              )}
            </div>
          </div>
        </div>

        {/* =====================================================
            OK BUTTON
        ===================================================== */}
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
