import {
  cilSpeedometer,
  cilUser,
  cilList,
  cilBarcode,
  cilGroup,
  cilTruck,
  cilBuilding,
  cilEnvelopeClosed,
  cilDescription,
  cilChart,
  cilLocationPin,
  cilStorage,
  cilBell,
  cilTransfer,
  cilNotes,
  cilSettings,
} from '@coreui/icons'

export const MENU_CONFIG = [
  {
    name: 'Dashboard',
    icon: cilSpeedometer,
  },
  {
    name: 'User Master',
    icon: cilUser,
  },
  {
    name: 'Part Group Master',
    icon: cilList,
  },
  {
    name: 'Part Master',
    icon: cilBarcode,
  },
  {
    name: 'Supplier Group Master',
    icon: cilGroup,
  },
  {
    name: 'Supplier Master',
    icon: cilTruck,
  },
  {
    name: 'Customer Group Master',
    icon: cilGroup,
  },
  {
    name: 'Customer Master',
    icon: cilBuilding,
  },

  // {
  //   name: 'Price Master',
  //    icon: cilDollar,
  // },
  {
    name: 'Pallet Master',
    icon: cilStorage,
  },
  {
    name: 'Location Master',
    icon: cilDescription,
  },
  {
    name: 'Mail Settings',
    icon: cilEnvelopeClosed,
  },
  {
    name: 'GRN Entry',
    icon: cilDescription,
  },
  {
    name: 'GRN Post',
    icon: cilDescription,
  },
  {
    name: 'Store Movement',
    icon: cilDescription,
  },
  {
    name: 'Material Issue Slip',
    icon: cilNotes,
  },
  // {
  //   name: 'Reports',
  //   icon: cilChartLine,
  // },


  {
    name: 'GRN Report',
    icon: cilNotes,
  },
  {
    name: 'Store Report',
    icon: cilLocationPin,
  },
  {
    name: 'Stock Report',
    icon: cilStorage,
  },
  {
    name: 'Alert Report',
    icon: cilBell,
  },
  {
    name: 'Material Issue Report',
    icon: cilTransfer,
  },

  {
    name: 'Dashboard Settings',
    icon: cilSettings,
  },
]