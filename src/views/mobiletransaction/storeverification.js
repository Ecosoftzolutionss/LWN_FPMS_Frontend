import React from 'react';
import { useNavigate } from 'react-router-dom';

import {
  FaBars,
  FaSignOutAlt,
  FaArrowLeft,
  FaQrcode,
  FaStore,
} from 'react-icons/fa';

import '../../assets/CSS/mobility.css';

import API from '../../api';


// ==========================================
// Store Verification
// ==========================================

const StoreVerification = () => {

  const navigate = useNavigate();


  // ==========================================
  // Logout
  // ==========================================

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

    navigate(
      '/login',
      { replace: true }
    );

  };


  // ==========================================
  // Back
  // ==========================================

  const handleBack = () => {

    navigate('/m/send');

  };


  // ==========================================
  // Render
  // ==========================================

  return (

    <div className="mobility-page">

      {/* ======================================
          HEADER
      ====================================== */}

      <header className="mobility-header">

        <button
          type="button"
          className="mobility-menu-button"
          onClick={handleBack}
          title="Back"
          aria-label="Back"
        >
          <FaArrowLeft />
        </button>


        <div className="mobility-logo">

          <div className="mobility-logo-title">
            FPMS
          </div>

          <div className="mobility-logo-subtitle">
            STORE VERIFICATION
          </div>

        </div>


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


        <div className="mobility-section-header">

          <div className="mobility-section-title-row">

            <div className="mobility-section-icon">
              <FaQrcode />
            </div>

            <h2>
              Store Verification
            </h2>

          </div>


          <p>
            Scan Store Label and GRN Label to
            verify the pallet.
          </p>

        </div>


        {/* ====================================
            STORE LABEL
        ==================================== */}

        <div className="mobility-form-card">

          <div className="mobility-verification-option">

            <div className="mobility-verification-icon">
              <FaStore />
            </div>


            <div className="mobility-verification-content">

              <h3>
                Store Label
              </h3>

              <p>
                Scan the Store Label to continue.
              </p>

            </div>


            <button
              type="button"
              className="mobility-arrow-button"
            >
              <FaQrcode />
            </button>

          </div>


          {/* ==================================
              GRN LABEL
          ================================== */}

          <div className="mobility-verification-option">

            <div className="mobility-verification-icon">
              <FaQrcode />
            </div>


            <div className="mobility-verification-content">

              <h3>
                GRN Label
              </h3>

              <p>
                Scan the GRN Label to continue.
              </p>

            </div>


            <button
              type="button"
              className="mobility-arrow-button"
            >
              <FaQrcode />
            </button>

          </div>

        </div>


      </main>

    </div>

  );

};


export default StoreVerification;