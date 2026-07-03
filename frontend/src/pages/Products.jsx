import ManagementPage from './ManagementPage.jsx';
import { formatCurrency } from '../utils/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';

const Products = () => (
  <ManagementPage
    eyebrow="Inventory"
    title="Products"
    description="Product catalog, pricing, stock, and reorder levels."
    endpoint="/products"
    dataKey="products"
    idKey="productId"
    fields={[
      { name: 'categoryId', label: 'Category ID', type: 'number', valueType: 'integer', min: 1, required: true },
      { name: 'supplierId', label: 'Supplier ID', type: 'number', valueType: 'integer', min: 1 },
      { name: 'productName', label: 'Product name', required: true },
      { name: 'barcode', label: 'Barcode', required: true },
      { name: 'sku', label: 'SKU' },
      { name: 'unit', label: 'Unit', defaultValue: 'pcs' },
      { name: 'costPrice', label: 'Cost price (LKR)', type: 'number', valueType: 'number', min: 0, step: '0.01', defaultValue: 0 },
      { name: 'sellingPrice', label: 'Selling price (LKR)', type: 'number', valueType: 'number', min: 0, step: '0.01', defaultValue: 0 },
      { name: 'currentStock', label: 'Current stock', type: 'number', valueType: 'integer', min: 0, defaultValue: 0 },
      { name: 'reorderLevel', label: 'Reorder level', type: 'number', valueType: 'integer', min: 0, defaultValue: 0 },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
      { name: 'description', label: 'Description', type: 'textarea', fullWidth: true }
    ]}
    columns={[
      { key: 'productName', label: 'Product' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'categoryName', label: 'Category' },
      { key: 'currentStock', label: 'Stock' },
      { key: 'sellingPrice', label: 'Price (LKR)', render: (row) => formatCurrency(row.sellingPrice) },
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

export default Products;
