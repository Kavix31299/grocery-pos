import ManagementPage from './ManagementPage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const Categories = () => (
  <ManagementPage
    eyebrow="Inventory"
    title="Categories"
    description="Product grouping and category status."
    endpoint="/categories"
    dataKey="categories"
    idKey="categoryId"
    fields={[
      { name: 'categoryName', label: 'Category name', required: true },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
      { name: 'description', label: 'Description', type: 'textarea', fullWidth: true }
    ]}
    columns={[
      { key: 'categoryId', label: 'ID' },
      { key: 'categoryName', label: 'Category' },
      { key: 'description', label: 'Description' },
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

export default Categories;
