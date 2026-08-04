import React from 'react'
import { CFooter } from '@coreui/react'

const AppFooter = () => {
  return (
    <CFooter className="px-4">
      {/* LEFT SIDE */}
      <div>
        <span>&copy; 2026 Ecosoft Zolutions.</span>
      </div>

      {/* RIGHT SIDE */}
      <div className="ms-auto">
        <span className="me-1">Powered by</span>
        <a href="https://ecosoftzolutions.com/" target="_blank" rel="noopener noreferrer">
          Ecosoft Zolutions
        </a>
      </div>
    </CFooter>
  )
}

export default React.memo(AppFooter)
