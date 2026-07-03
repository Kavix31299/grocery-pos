import ManagementPage from './ManagementPage.jsx';
import { formatCurrency } from '../utils/formatters.js';

const Expenses = () => (
  <ManagementPage
    eyebrow="Operations"
    title="Expenses"
    description="Store operating expenses and expense categories."
    endpoint="/expenses"
    dataKey="expenses"
    idKey="expenseId"
    fields={[
      { name: 'expenseCategory', label: 'Category', required: true },
      { name: 'amount', label: 'Amount', type: 'number', valueType: 'number', min: 0, step: '0.01', required: true },
      { name: 'expenseDate', label: 'Expense date', type: 'date' },
      { name: 'description', label: 'Description', type: 'textarea', fullWidth: true, required: true }
    ]}
    columns={[
      { key: 'expenseCategory', label: 'Category' },
      { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount) },
      { key: 'expenseDate', label: 'Date' },
      { key: 'recordedByName', label: 'Recorded by' }
    ]}
  />
);

export default Expenses;
