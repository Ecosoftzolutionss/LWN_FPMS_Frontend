import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CCard, CCardBody } from '@coreui/react';
import {FaFileInvoice,
  FaBoxOpen,
  FaSignOutAlt,
  FaChevronRight,
} from 'react-icons/fa';
import '../../assets/CSS/mobility.css';
import usePrivilege from '../hooks/usePrivilege.js';
import API from '../../api';


const Mobility = () => {
  const navigate = useNavigate();

  const { privileges = [] } = usePrivilege();

  const canScanInvoice = privileges.some(
    (p) => p.menuName === 'Scan Invoice' && p.canView === true
  );

  const canPartScan = privileges.some(
    (p) => p.menuName === 'Part Scan' && p.canView === true
  );

  const canGateExit = privileges.some(
    (p) => p.menuName === 'Gate Exit' && p.canView === true
  );

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

 const handleLogout = async () => {

    try {
        await API.post("/Auth/logout");
    }
    catch { }

    sessionStorage.clear();

    navigate("/login");
};

  return (
    <div className="mobility-container">

      {/* Header */}
      <div className="mobility-header">
        <div>
          <h3>Select Option</h3>
          <p>Choose the option to continue</p>
        </div>

        <div
          className="mobility-logout-icon"
          onClick={handleLogout}
          title="Logout"
        >
          <FaSignOutAlt />
        </div>
      </div>

      {/* Welcome Section */}
      <div className="welcome-section">
        <div className="welcome-icon">
          <FaFileInvoice />
        </div>
        <h2>Welcome, {user?.username || 'User'}!</h2>
        <p>Please select a scan type to continue</p>
      </div>

      {/* Scan Invoice */}
      {canScanInvoice && (
        <CCard
          className="mobility-card invoice-card"
          onClick={() => navigate('/mobiletransaction/ScanInvoice')}
          role="button"
        >
          <CCardBody className="mobility-card-content">
            <div className="mobility-card-left">
              <div className="icon-circle invoice-bg">
                <FaFileInvoice />
              </div>
              <div>
                <h6>SCAN INVOICE</h6>
                <p>Scan and verify invoice details before processing.</p>
              </div>
            </div>
            <FaChevronRight className="arrow-icon" />
          </CCardBody>
        </CCard>
      )}

      {/* Part Scan */}
      {canPartScan && (
        <CCard
          className="mobility-card mobility-part-card"
          onClick={() => navigate('/mobiletransaction/partscan')}
          role="button"
        >
          <CCardBody className="mobility-card-content">
            <div className="mobility-card-left">
              <div className="icon-circle part-bg">
                <FaBoxOpen />
              </div>
              <div>
                <h6>SCAN PART & BOX LABEL</h6>
                <p>Scan part labels and verify box details.</p>
              </div>
            </div>
            <FaChevronRight className="arrow-icon" />
          </CCardBody>
        </CCard>
      )}

      {/* Gate Exit */}
      {canGateExit && (
        <CCard
          className="mobility-card gate-card"
          onClick={() => navigate('/mobiletransaction/gateexit')}
          role="button"
        >
          <CCardBody className="mobility-card-content">
            <div className="mobility-card-left">
              <div className="icon-circle gate-bg">
                <FaSignOutAlt />
              </div>
              <div>
                <h6>GATE EXIT</h6>
                <p>Verify invoice and complete gate exit process.</p>
              </div>
            </div>
            <FaChevronRight className="arrow-icon" />
          </CCardBody>
        </CCard>
      )}
    </div>
  );
};

export default Mobility;