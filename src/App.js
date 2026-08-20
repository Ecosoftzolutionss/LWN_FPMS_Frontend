import React, {useState,useEffect,Suspense,} from 'react';
import {HashRouter,Routes,Route,Navigate,} from 'react-router-dom';
import { CSpinner } from '@coreui/react';
import { ToastContainer } from 'react-toastify';
import './scss/style.scss';
import './scss/examples.scss';
import 'react-toastify/dist/ReactToastify.css';
// import {startSessionTracking,} from './sessionActivity';


// ==========================================
// Lazy Loaded Components
// ==========================================
const DefaultLayout = React.lazy(() =>   import('./layout/DefaultLayout'));
const Login = React.lazy(() =>import('./views/pages/login/Login'));
const MobileSend = React.lazy(() =>import('./views/mobiletransaction/mobilesend'));
const MaterialIssue = React.lazy(() =>import('./views/mobiletransaction/materialissue'));
const StoreVerification = React.lazy(() =>import('./views/mobiletransaction/storeverification'));
// ==========================================
// Helper
// ==========================================

const getStoredUser = () => {
  try {
    const storedUser =
      sessionStorage.getItem('user');
    if (!storedUser) {
      return null;
    }
    return JSON.parse(storedUser);
  } catch (error) {
    console.error(
      'Error reading user session:',
      error
    );
    return null;
  }
};


// ==========================================
// App
// ==========================================

function App() {
  const [user, setUser] = useState(getStoredUser());
  useEffect(() => {
    const syncUser = () => {
      const storedUser =
        getStoredUser();
      setUser(storedUser);
    };


    // Cross-tab storage change
    window.addEventListener(
      'storage',
      syncUser
    );


    // Same-tab login/logout
    window.addEventListener(
      'authChange',
      syncUser
    );


    return () => {

      window.removeEventListener(
        'storage',
        syncUser
      );

      window.removeEventListener(
        'authChange',
        syncUser
      );
    };
  }, []);


  // ========================================
  // Session Tracking
  // ========================================

  // useEffect(() => {
  //   if (user?.sessionId) {
  //     startSessionTracking();
  //   }
  // }, [user]);


  // ========================================
  // IMPORTANT
  //
  // Always check sessionStorage directly
  // for routing.
  // ========================================

  const currentUser =
    getStoredUser();

  const isAuth =
    !!currentUser;


  const isMobile =
    !!currentUser &&
    currentUser.mobilityWithoutCheck !== true;


  // ========================================
  // Render
  // ========================================

  return (

    <HashRouter>

      {/* ====================================
          Toast
      ==================================== */}

      <ToastContainer
        position="top-right"
        autoClose={3000}
      />


      {/* ====================================
          Suspense
      ==================================== */}

      <Suspense
        fallback={
          <div className="pt-3 text-center">
            <CSpinner
              color="primary"
              variant="grow"
            />
          </div>
        }
      >
        <Routes>

          <Route
            path="/"
            element={

              !isAuth ? (

                <Navigate
                  to="/login"
                  replace
                />

              ) : isMobile ? (

                <Navigate
                  to="/m/send"
                  replace
                />

              ) : (

                <Navigate
                  to="/dashboard"
                  replace
                />

              )

            }
          />


          {/* ==================================
              LOGIN
          ================================== */}

          <Route
            path="/login"
            element={

              isAuth ? (

                <Navigate
                  to="/"
                  replace
                />

              ) : (

                <Login />

              )

            }
          />


          {/* ==================================
              MOBILE HOME
          ================================== */}

          <Route
            path="/m/send"
            element={

              isAuth ? (

                <MobileSend />

              ) : (

                <Navigate
                  to="/login"
                  replace
                />

              )

            }
          />


          {/* ==================================
              MATERIAL ISSUE
          ================================== */}

          <Route
            path="/mobiletransaction/materialissue"
            element={

              isAuth ? (

                <MaterialIssue />

              ) : (

                <Navigate
                  to="/login"
                  replace
                />

              )

            }
          />


          {/* ==================================
              STORE VERIFICATION
          ================================== */}

          <Route
            path="/mobiletransaction/storeverification"
            element={

              isAuth ? (

                <StoreVerification />

              ) : (

                <Navigate
                  to="/login"
                  replace
                />

              )

            }
          />


          {/* ==================================
              DEFAULT LAYOUT
              
              Dashboard
              Masters
              Transactions
              Reports
          ================================== */}

          <Route
            path="/*"
            element={

              isAuth ? (

                <DefaultLayout />

              ) : (

                <Navigate
                  to="/login"
                  replace
                />

              )

            }
          />


        </Routes>

      </Suspense>

    </HashRouter>

  );

}


export default App;