const ROLES = Object.freeze({
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CASHIER: 'Cashier'
});

const ROLE_ACCESS = Object.freeze({
  [ROLES.ADMIN]: ['*'],
  [ROLES.MANAGER]: [
    'products:manage',
    'categories:manage',
    'suppliers:manage',
    'customers:manage',
    'purchases:manage',
    'sales:manage',
    'returns:manage',
    'expenses:manage',
    'reports:view'
  ],
  [ROLES.CASHIER]: [
    'pos:billing',
    'products:edit',
    'categories:edit',
    'suppliers:edit',
    'customers:edit',
    'sales:manage',
    'returns:manage'
  ]
});

const isValidRole = (roleName) => Object.values(ROLES).includes(roleName);

module.exports = {
  ROLES,
  ROLE_ACCESS,
  isValidRole
};
