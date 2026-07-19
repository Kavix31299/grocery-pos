import { useEffect, useMemo, useState } from 'react';
import ManagementPage from './ManagementPage.jsx';
import { getResource } from '../api/resourcesApi.js';
import { formatCurrency, formatQuantity } from '../utils/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';

const Products = () => {
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    let ignore = false;

    const loadOptions = async () => {
      try {
        const [categoriesResponse, suppliersResponse] = await Promise.all([
          getResource('/categories', { isActive: true, limit: 100 }),
          getResource('/suppliers', { isActive: true, limit: 100 })
        ]);

        if (!ignore) {
          setCategories(categoriesResponse.data.categories || []);
          setSuppliers(suppliersResponse.data.suppliers || []);
        }
      } catch (error) {
        if (!ignore) {
          setCategories([]);
          setSuppliers([]);
        }
      }
    };

    loadOptions();

    return () => {
      ignore = true;
    };
  }, []);

  const fields = useMemo(() => [
    {
      name: 'categoryId',
      label: 'Category',
      type: 'select',
      valueType: 'integer',
      required: true,
      options: [
        { value: '', label: 'Select category' },
        ...categories.map((category) => ({
          value: category.categoryId,
          label: `${category.categoryName} (#${category.categoryId})`
        }))
      ]
    },
    {
      name: 'supplierId',
      label: 'Supplier',
      type: 'select',
      valueType: 'integer',
      options: [
        { value: '', label: 'No supplier' },
        ...suppliers.map((supplier) => ({
          value: supplier.supplierId,
          label: `${supplier.supplierName} (#${supplier.supplierId})`
        }))
      ]
    },
    { name: 'productName', label: 'Product name', required: true },
    { name: 'barcode', label: 'Barcode', required: true },
    { name: 'sku', label: 'SKU' },
    { name: 'unit', label: 'Unit', defaultValue: 'pcs' },
    { name: 'costPrice', label: 'Cost price (LKR)', type: 'number', valueType: 'number', min: 0, step: '0.01', defaultValue: 0 },
    { name: 'sellingPrice', label: 'Selling price (LKR)', type: 'number', valueType: 'number', min: 0, step: '0.01', defaultValue: 0 },
    { name: 'retailPrice', label: 'Retail price (LKR)', type: 'number', valueType: 'number', min: 0, step: '0.01', defaultValue: 0 },
    { name: 'wholesalePrice', label: 'Wholesale price (LKR)', type: 'number', valueType: 'number', min: 0, step: '0.01', defaultValue: 0 },
    { name: 'currentStock', label: 'Current stock', type: 'number', valueType: 'number', min: 0, step: '0.01', defaultValue: 0 },
    { name: 'reorderLevel', label: 'Reorder level', type: 'number', valueType: 'number', min: 0, step: '0.01', defaultValue: 0 },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
    { name: 'description', label: 'Description', type: 'textarea', fullWidth: true }
  ], [categories, suppliers]);

  return (
    <ManagementPage
      eyebrow="Inventory"
      title="Products"
      description="Product catalog, pricing, stock, and reorder levels."
      endpoint="/products"
      dataKey="products"
      idKey="productId"
      createRoles={['Admin', 'Manager', 'Cashier']}
      editRoles={['Admin', 'Manager', 'Cashier']}
      fields={fields}
      columns={[
        { key: 'productName', label: 'Product' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'categoryName', label: 'Category' },
        { key: 'currentStock', label: 'Stock', render: (row) => formatQuantity(row.currentStock) },
        { key: 'sellingPrice', label: 'Selling (LKR)', render: (row) => formatCurrency(row.sellingPrice) },
        { key: 'retailPrice', label: 'Retail (LKR)', render: (row) => formatCurrency(row.retailPrice) },
        { key: 'wholesalePrice', label: 'Wholesale (LKR)', render: (row) => formatCurrency(row.wholesalePrice) },
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
};

export default Products;
