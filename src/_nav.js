import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilSettings,
  cilUser,
  cilList,
  cilBarcode,
  cilFactory,
  cilTruck,
  cilGroup,
  cilBuilding,
  cilEnvelopeClosed,
  cilStorage,
  cilDescription,
  cilChartLine,
  cilDollar,
  
} from '@coreui/icons'

import { CNavGroup, CNavItem } from '@coreui/react'

const _nav = [
  // Dashboard //daaddd
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },

  // Masters
  {
    component: CNavGroup,
    name: 'Masters',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'User Master',
        to: '/masters/users',
        icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Item Group Master',
        to: '/masters/Itemgroupmaster',
        icon: <CIcon icon={cilList} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Item Master',
        to: '/masters/Itemmaster',
        icon: <CIcon icon={cilBarcode} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Supplier Group Master',
        to: '/masters/suppliergroupmaster',
        icon: <CIcon icon={cilGroup} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Supplier Master',
        to: '/masters/suppliermaster',
        icon: <CIcon icon={cilTruck} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Customer Group Master',
        to: '/masters/customergroupmaster',
        icon: <CIcon icon={cilGroup} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Customer Master',
        to: '/masters/customermaster',
        icon: <CIcon icon={cilBuilding} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Price Master',
        to: '/masters/pricemaster',
        icon: <CIcon icon={cilDollar} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Store Master',
        to: '/masters/storemaster',
        icon: <CIcon icon={cilStorage} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Location Master',
        to: '/masters/locationmaster',
        icon: <CIcon icon={cilDescription} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Mail Settings',
        to: '/masters/mailsetting',
        icon: <CIcon icon={cilEnvelopeClosed} customClassName="nav-icon" />,
      },
    ],
  },

  // Transaction
  {
    component: CNavGroup,
    name: 'Transaction',
    icon: <CIcon icon={cilStorage} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'GRN Entry',
        to: '/transaction/grnentry',
        icon: <CIcon icon={cilDescription} customClassName="nav-icon" />,
      },
    ],
  },

  // Reports
  {
    component: CNavItem,
    name: 'Reports',
    to: '/report/reports',
    icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
  },
]

export default _nav