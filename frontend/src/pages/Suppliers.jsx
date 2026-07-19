import ManagementPage from './ManagementPage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const Suppliers = () => (
  <ManagementPage
    eyebrow="Purchasing"
    title="Suppliers"
    description="Supplier contact records and purchasing partners."
    endpoint="/suppliers"
    dataKey="suppliers"
    idKey="supplierId"
    createRoles={['Admin', 'Manager', 'Cashier']}
    editRoles={['Admin', 'Manager', 'Cashier']}
    fields={[
      { name: 'supplierName', label: 'Supplier name', required: true },
      { name: 'contactPerson', label: 'Contact person' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
      { name: 'address', label: 'Address', type: 'textarea', fullWidth: true }
    ]}
    columns={[
      { key: 'supplierId', label: 'ID' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'contactPerson', label: 'Contact' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
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

export default Suppliers;
