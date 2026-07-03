export const roleHomePaths = {
  Admin: '/admin/dashboard',
  Manager: '/manager/dashboard',
  Cashier: '/pos'
};

export const getHomePathForRole = (role) => roleHomePaths[role] || '/login';

export const navigationItems = [
  {
    label: 'POS',
    path: '/pos',
    roles: ['Admin', 'Manager', 'Cashier']
  },
  {
    label: 'Products',
    path: '/products',
    roles: ['Admin', 'Manager']
  },
  {
    label: 'Categories',
    path: '/categories',
    roles: ['Admin', 'Manager']
  },
  {
    label: 'Suppliers',
    path: '/suppliers',
    roles: ['Admin', 'Manager']
  },
  {
    label: 'Customers',
    path: '/customers',
    roles: ['Admin', 'Manager', 'Cashier']
  },
  {
    label: 'Purchases',
    path: '/purchases',
    roles: ['Admin', 'Manager']
  },
  {
    label: 'Returns',
    path: '/returns',
    roles: ['Admin', 'Manager', 'Cashier']
  },
  {
    label: 'Expenses',
    path: '/expenses',
    roles: ['Admin', 'Manager']
  },
  {
    label: 'Sales',
    path: '/sales',
    roles: ['Admin', 'Manager', 'Cashier']
  },
  {
    label: 'Reports',
    path: '/reports',
    roles: ['Admin', 'Manager']
  },
  {
    label: 'Users',
    path: '/users',
    roles: ['Admin']
  },
  {
    label: 'Store Settings',
    path: '/store-settings',
    roles: ['Admin']
  }
];

export const getNavigationForRole = (role) => navigationItems.filter((item) => (
  item.roles.includes(role)
));
