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
  cilChartLine,
  cilDollar,
  cilStorage,
  cilNotes,
  cilCloudDownload,
  cilListRich,
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
    icon: cilCloudDownload,
  },

  {
    name: 'Store Report',
    icon: cilCloudDownload,
  },
  {
    name: 'Material Issue Report',
    icon: cilListRich,
  },
   {
    name: 'Stock Report',
    icon: cilListRich,
  },
]