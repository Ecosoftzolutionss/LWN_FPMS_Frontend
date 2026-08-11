import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { CSidebar, CSidebarBrand, CSidebarFooter, CSidebarHeader } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilAccountLogout } from '@coreui/icons';
import { AppSidebarNav } from './AppSidebarNav';
import usePrivilege from '../../src/views/hooks/usePrivilege';
import { useNavigate } from 'react-router-dom';
import API from '../api.js';

import navigation from '../_nav'

const AppSidebar = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const { canView } = usePrivilege()

  const filteredNav = navigation
    .filter((item) => {
      if (item.name === 'Dashboard') {
        return canView('Dashboard')
      }
      if (item.items) {
        return true
      }
      if (item.children) {
        return (
          canView(item.name) ||
          item.children.some((child) => canView(child.name))
        )
      }
      return canView(item.name)
    })
    .map((item) => {
      if (item.items) {
        return { ...item, items: item.items.filter((sub) => canView(sub.name)) }
      }
      if (item.children) {
        return { ...item, children: item.children.filter((child) => canView(child.name)) }
      }
      return item
    })
    .filter((item) => {
      if (item.items) return item.items.length > 0
      if (item.children) return item.children.length > 0
      return true
    })

const handleLogout = async () => {

  try {

    await API.post("/Auth/logout");

  } catch (error) {

    console.error(
      "Logout API error:",
      error
    );

  }

  // ========================================
  // Clear login session
  // ========================================

  sessionStorage.clear();


  // ========================================
  // Notify App.js
  // ========================================

  window.dispatchEvent(
    new Event("authChange")
  );


  // ========================================
  // Go directly to Login
  // ========================================

  navigate(
    "/login",
    {
      replace: true,
    }
  );

};

  return (
    <CSidebar
      className="custom-sidebar"
      colorScheme="dark"
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch({ type: 'set', sidebarShow: visible })
      }}
    >
      <CSidebarHeader className="custom-sidebar-header">
        <CSidebarBrand className="sidebar-title-container">
          <div className="sidebar-title">FPMS</div>
          <div className="sidebar-subtitle">FIFO Pallet Management System</div>
        </CSidebarBrand>
      </CSidebarHeader>

      <AppSidebarNav items={filteredNav} />

      <CSidebarFooter className="custom-sidebar-footer">
        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
          aria-label="Log out"
        >
          <span className="logout-icon">
            <CIcon icon={cilAccountLogout} width={16} />
          </span>
          <span className="logout-text">LOGOUT</span>
        </button>
      </CSidebarFooter>
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
