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
    'reports:view'
  ],
  [ROLES.CASHIER]: [
    'pos:billing',
    'sales:own'
  ]
});

const isValidRole = (roleName) => Object.values(ROLES).includes(roleName);

module.exports = {
  ROLES,
  ROLE_ACCESS,
  isValidRole
};
