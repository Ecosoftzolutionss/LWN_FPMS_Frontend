import React, { Suspense } from 'react'
import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import {
  CContainer,
  CSpinner,
} from '@coreui/react'

// Routes configuration
import routes from '../routes'

const AppContent = () => {
  return (
    <CContainer fluid className="px-4">

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

          {routes.map((route, idx) => {

            return (
              route.element && (
                <Route
                  key={idx}
                  path={route.path}
                  exact={route.exact}
                  name={route.name}
                  element={<route.element />}
                />
              )
            )

          })}

          {/* Default page */}
          <Route
            path="/"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

        </Routes>

      </Suspense>

    </CContainer>
  )
}

export default React.memo(AppContent)