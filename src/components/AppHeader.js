import React, { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CNavLink,
  CNavItem,
  useColorModes,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilBell,
  cilContrast,
  cilEnvelopeOpen,
  cilList,
  cilMenu,
  cilMoon,
  cilSun,
} from '@coreui/icons'

import { AppBreadcrumb } from './index'
import { AppHeaderDropdown } from './header/index'

const AppHeader = () => {
  const [currentTime, setCurrentTime] = useState('')
  const user = JSON.parse(sessionStorage.getItem('user'))

  const formatDateTime = () => {
    const now = new Date()
    const pad = (n) => n.toString().padStart(2, '0')
    return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} 
  ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }
  const headerRef = useRef()
  // const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')

  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)

  useEffect(() => {
    const handleScroll = () => {
      headerRef.current &&
        headerRef.current.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0)
    }

    document.addEventListener('scroll', handleScroll)
    return () => document.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()

      const pad = (n) => n.toString().padStart(2, '0')

      setCurrentTime(
        `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} 
       ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
      )
    }

    updateTime()

    const timer = setInterval(updateTime, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom  header-relative" fluid>
        {/* LEFT */}
        <CHeaderToggler
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: '-14px' }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>

      
          <AppBreadcrumb />
      

        {/* RIGHT */}
        <CHeaderNav className="ms-auto d-flex align-items-center gap-3">
          <div style={{ fontSize: '18px' }}>{currentTime}</div>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>{user?.username}</div>
          <AppHeaderDropdown />
        </CHeaderNav>
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
