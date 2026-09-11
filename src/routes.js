import React from 'react'

const Dashboard = React.lazy(() => import('./views/dashboard/dashboard'))

const Users = React.lazy(() => import('./views/masters/users'))
const ItemGroupMaster = React.lazy(() => import('./views/masters/itemgroupmaster'))
const ItemMaster = React.lazy(() => import('./views/masters/Itemmaster'))
const SupplierGroupMaster = React.lazy(() => import('./views/masters/suppliergroupmaster'))
const SupplierMaster = React.lazy(() => import('./views/masters/suppliermaster'))
const CustomerGroupMaster = React.lazy(() => import('./views/masters/customergroupmaster'))
const CustomerMaster = React.lazy(() => import('./views/masters/customermaster'))
const PriceMaster = React.lazy(() => import('./views/masters/pricemaster'))
const StoreMaster = React.lazy(() => import('./views/masters/storemaster'))
const LocationMaster = React.lazy(() => import('./views/masters/locationmaster'))
const MailSettings = React.lazy(() => import('./views/masters/mailsetting'))
const GRNEntry = React.lazy(() => import('./views/transaction/grnentry'))
const GRNPost = React.lazy(() => import('./views/transaction/grnpost'))
const MaterialIssueSlip = React.lazy(() => import('./views/transaction/materialissueslip'))
const StoreMovement = React.lazy(() => import('./views/transaction/storemovement'))
//const Reports = React.lazy(() => import('./views/report/reports'))
const GrnReport = React.lazy(()=> import('./views/report/Grnreport'))
const MaterialIssueReport = React.lazy(()=> import('./views/report/MaterialIssueReport'))
const StoreReport = React.lazy(()=> import('./views/report/StoreReport'))
const StockReport = React.lazy(()=> import('./views/report/StockReport'))


const routes = [
  { path: '/', exact: true, name: 'Home' },

  // Dashboard
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },

  // Masters
  { path: '/masters/users', name: 'User Master', element: Users },
  { path: '/masters/Itemgroupmaster', name: 'Part Group Master', element: ItemGroupMaster },
  { path: '/masters/Itemmaster', name: 'Part Master', element: ItemMaster },
  { path: '/masters/suppliermaster', name: 'Supplier Master', element: SupplierMaster},
  { path: '/masters/suppliergroupmaster', name: 'Supplier Group Master', element: SupplierGroupMaster},
  { path: '/masters/customergroupmaster', name: 'Customer Group Master', element: CustomerGroupMaster },
  { path: '/masters/customermaster', name: 'Customer Master', element: CustomerMaster },
  { path: '/masters/pricemaster', name: 'Price Master', element: PriceMaster },
  { path: '/masters/storemaster', name: 'Store Master', element: StoreMaster },
  { path: '/masters/locationmaster', name: 'Location Master', element: LocationMaster },
  { path: '/masters/mailsetting', name: 'Mail Settings', element: MailSettings },

  // Transaction
  { path: '/transaction/grnentry', name: 'GRN Entry', element: GRNEntry },
  { path: '/transaction/grnpost', name: 'GRN Post', element: GRNPost },
  { path: '/transaction/materialissueslip', name: 'Material Issue Slip', element: MaterialIssueSlip },
  { path: '/transaction/storemovement', name: 'Store Movement', element: StoreMovement },

  // Reports
  //{ path: '/report/reports', name: 'Reports', element: Reports },
  { path: '/report/Grnreport', name: 'GRN Report', element: GrnReport },
  { path: '/report/MaterialIssueReport', name: 'Material Issue Report', element: MaterialIssueReport },
  { path: '/report/StoreReport', name: 'Store Report', element: StoreReport },
  { path: '/report/StockReport', name: 'Stock Report', element: StockReport }
]

export default routes