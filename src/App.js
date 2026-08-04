import React, { useState, useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CSpinner } from '@coreui/react';
import { ToastContainer } from 'react-toastify';
import './scss/style.scss';
import './scss/examples.scss';
import 'react-toastify/dist/ReactToastify.css';
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'));
const Login = React.lazy(() => import('./views/pages/login/Login'));
const MobileSend = React.lazy(() => import('./views/mobiletransaction/mobilesend'));
const ScanInvoice = React.lazy(() => import('./views/mobiletransaction/ScanInvoice'));
const GateExit = React.lazy(() => import('./views/mobiletransaction/gateexit'));
const PartScan = React.lazy(() => import('./views/mobiletransaction/PartScan'));
import { startSessionTracking } from "./sessionActivity";

function App() {
  const [user, setUser] = useState(
    JSON.parse(
      sessionStorage.getItem('user') || 'null'
    )
  )

  useEffect(() => {
    const syncUser = () => {
      setUser(
        JSON.parse(
          sessionStorage.getItem('user') || 'null'
        )
      )
    }
    window.addEventListener('storage', syncUser)
    return () =>
      window.removeEventListener(
        'storage',
        syncUser
      )
  }, [])

useEffect(() => {
    if (user?.sessionId) {
        startSessionTracking();
    }
}, [user]);

  const isAuth = !!user
  const isMasterUser =
    user?.mobilityWithoutCheck === true
  return (
    <HashRouter>
      <ToastContainer position="top-right" autoClose={3000} />

      <Suspense
        fallback={
          <div className="pt-3 text-center">
            <CSpinner color="primary" variant="grow" />
          </div>
        }
      >
        <Routes>

          <Route
            path="/"
            element={
              !isAuth ? (
                <Navigate to="/login" replace />
              ) : isMasterUser ? (
                <Navigate to="/masters/users" replace />
              ) : (
                <Navigate to="/m/send" replace />  // ← non-master users go to mobile send
              )
            }
          />
          <Route
            path="/login"
            element={<Login />}
          />
          <Route
            path="/m/send"
            element={
              isAuth ? (
                <MobileSend />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/mobiletransaction/ScanInvoice"
            element={
              isAuth ? (
                <ScanInvoice />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/mobiletransaction/gateexit"
            element={
              isAuth ? (
                <GateExit />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/mobiletransaction/partscan"
            element={
              isAuth ? (
                <PartScan />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/*"
            element={
              isAuth ? (
                <DefaultLayout />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}

export default App