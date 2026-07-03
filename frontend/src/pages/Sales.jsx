import ResourcePage from './ResourcePage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

const Sales = () => (
  <ResourcePage
    eyebrow="POS"
    title="Sales"
    description="Invoices, payment status, cashier, and customer history."
    endpoint="/sales"
    dataKey="sales"
    columns={[
      { key: 'invoiceNumber', label: 'Invoice' },
      { key: 'customerName', label: 'Customer' },
      { key: 'cashierName', label: 'Cashier' },
      { key: 'saleDate', label: 'Date', render: (row) => formatDateTime(row.saleDate) },
      { key: 'totalAmount', label: 'Total', render: (row) => formatCurrency(row.totalAmount) },
      {
        key: 'saleStatus',
        label: 'Status',
        render: (row) => <StatusBadge tone="info">{row.saleStatus}</StatusBadge>
      }
    ]}
  />
);

export default Sales;
