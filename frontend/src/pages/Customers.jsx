import ManagementPage from './ManagementPage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const Customers = () => (
  <ManagementPage
    eyebrow="Sales"
    title="Customers"
    description="Customer profiles, contact details, and loyalty points."
    endpoint="/customers"
    dataKey="customers"
    idKey="customerId"
    fields={[
      { name: 'customerName', label: 'Customer name', required: true },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'loyaltyPoints', label: 'Loyalty points', type: 'number', valueType: 'integer', min: 0, defaultValue: 0 },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
      { name: 'address', label: 'Address', type: 'textarea', fullWidth: true }
    ]}
    columns={[
      { key: 'customerName', label: 'Customer' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'loyaltyPoints', label: 'Points' },
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

export default Customers;
