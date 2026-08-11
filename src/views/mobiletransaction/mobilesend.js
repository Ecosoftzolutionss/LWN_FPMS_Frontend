import React from 'react';
import { useNavigate } from 'react-router-dom';

import {
  FaBars,
  FaSignOutAlt,
  FaChartPie,
  FaClipboardList,
  FaQrcode,
  FaArrowRight,
  FaTh,
} from 'react-icons/fa';

import '../../assets/CSS/mobility.css';

import API from '../../api';


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


    // Clear current session
    sessionStorage.clear();


    // IMPORTANT:
    // Tell App.js that authentication changed
    window.dispatchEvent(
      new Event('authChange')
    );


    // Go to login
    navigate(
      '/login',
      {
        replace: true,
      }
    );

  };


  // ========================================
  // Data Sink
  // ========================================

  const handleDataSink = () => {

    console.log(
      'Data Sink selected'
    );

    // Add Data Sink route here later
    // navigate('/mobiletransaction/datasink');

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
              DATA SINK
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
                  Data Sink
                </h3>

                <p>
                  Fetch pallets directly from store
                  and Sink Data.
                </p>

              </div>

            </div>


            <div
              className="mobility-arrow-button"
              aria-label="Open Data Sink"
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
{/* 
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

          </div> */}


        </div>

      </main>

    </div>

  );

};


export default Mobility;