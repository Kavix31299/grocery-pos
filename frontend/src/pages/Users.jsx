import ManagementPage from './ManagementPage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const roleOptions = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Cashier', label: 'Cashier' }
];

const Users = () => (
  <ManagementPage
    eyebrow="Admin"
    title="Users"
    description="Staff accounts, roles, and active status."
    endpoint="/users"
    dataKey="users"
    idKey="userId"
    deleteLabel="Deactivate"
    fields={[
      { name: 'fullName', label: 'Full name', required: true },
      { name: 'username', label: 'Username', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'role', label: 'Role', type: 'select', options: roleOptions, defaultValue: 'Cashier', sourceKey: 'roleName', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true, hideOnEdit: true },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true }
    ]}
    columns={[
      { key: 'fullName', label: 'Name' },
      { key: 'username', label: 'Username' },
      { key: 'email', label: 'Email' },
      { key: 'roleName', label: 'Role' },
      {
        key: 'isActive',
        label: 'Status',
        render: (row) => (
          <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
            {row.isActive ? 'Active' : 'Inactive'}
          </StatusBadge>
        )
      }
    ]}
  />
);

export default Users;
