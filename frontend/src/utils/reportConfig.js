import { formatCurrency, formatDate, formatDateTime } from './formatters.js';

const currency = (key) => ({
  key,
  label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
  render: (row) => formatCurrency(row[key])
});

const number = (key, label) => ({
  key,
  label: label || key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
});

const date = (key, label) => ({
  key,
  label: label || 'Date',
  render: (row) => formatDate(row[key])
});

const dateTime = (key, label) => ({
  key,
  label: label || 'Date',
  render: (row) => formatDateTime(row[key])
});

export const reportConfigs = {
  dailySales: {
    key: 'dailySales',
    slug: 'daily-sales',
    label: 'Daily sales',
    endpoint: '/reports/daily-sales',
    description: 'Daily invoice count, sold items, sales, refunds, and net sales.',
    supportsDateFilter: true,
    supportsSearch: false,
    columns: [
      date('reportDate', 'Date'),
      number('invoiceCount', 'Invoices'),
      number('itemsSold', 'Items sold'),
      currency('salesAmount'),
      currency('refundAmount'),
      currency('netSalesAmount'),
      currency('paidAmount'),
      currency('balanceAmount')
    ]
  },
  monthlySales: {
    key: 'monthlySales',
    slug: 'monthly-sales',
    label: 'Monthly sales',
    endpoint: '/reports/monthly-sales',
    description: 'Monthly sales totals, refunds, paid amounts, and balances.',
    supportsDateFilter: true,
    supportsSearch: false,
    columns: [
      date('reportMonth', 'Month'),
      number('invoiceCount', 'Invoices'),
      number('itemsSold', 'Items sold'),
      currency('salesAmount'),
      currency('refundAmount'),
      currency('netSalesAmount'),
      currency('paidAmount'),
      currency('balanceAmount')
    ]
  },
  productSales: {
    key: 'productSales',
    slug: 'product-sales',
    label: 'Product sales',
    endpoint: '/reports/product-sales',
    description: 'Product quantities sold, returned, revenue, and estimated profit.',
    supportsDateFilter: false,
    supportsSearch: true,
    columns: [
      number('productId', 'ID'),
      number('productName', 'Product'),
      number('categoryName', 'Category'),
      number('quantitySold', 'Sold'),
      number('quantityReturned', 'Returned'),
      currency('netSalesAmount'),
      currency('estimatedProfitAmount'),
      dateTime('lastSoldAt', 'Last sold')
    ]
  },
  cashierSales: {
    key: 'cashierSales',
    slug: 'cashier-sales',
    label: 'Cashier sales',
    endpoint: '/reports/cashier-sales',
    description: 'Cashier invoice counts, sales totals, refunds, and balances.',
    supportsDateFilter: false,
    supportsSearch: true,
    columns: [
      number('cashierId', 'ID'),
      number('cashierName', 'Cashier'),
      number('username', 'Username'),
      number('invoiceCount', 'Invoices'),
      number('itemsSold', 'Items sold'),
      currency('netSalesAmount'),
      currency('paidAmount'),
      dateTime('lastSaleAt', 'Last sale')
    ]
  },
  stockAvailable: {
    key: 'stockAvailable',
    slug: 'stock-available',
    label: 'Stock available',
    endpoint: '/reports/stock-available',
    description: 'Available stock, reorder status, and stock value by product.',
    supportsDateFilter: false,
    supportsSearch: true,
    columns: [
      number('productId', 'ID'),
      number('productName', 'Product'),
      number('categoryName', 'Category'),
      number('supplierName', 'Supplier'),
      number('currentStock', 'Stock'),
      number('reorderLevel', 'Reorder'),
      currency('stockCostValue'),
      number('stockStatus', 'Status')
    ]
  },
  lowStock: {
    key: 'lowStock',
    slug: 'low-stock',
    label: 'Low stock',
    endpoint: '/reports/low-stock',
    description: 'Products that are at or below their reorder level.',
    supportsDateFilter: false,
    supportsSearch: true,
    columns: [
      number('productId', 'ID'),
      number('productName', 'Product'),
      number('categoryName', 'Category'),
      number('supplierName', 'Supplier'),
      number('currentStock', 'Stock'),
      number('reorderLevel', 'Reorder'),
      number('shortageQuantity', 'Shortage'),
      currency('sellingPrice')
    ]
  },
  outOfStock: {
    key: 'outOfStock',
    slug: 'out-of-stock',
    label: 'Out of stock',
    endpoint: '/reports/out-of-stock',
    description: 'Active products with no stock available.',
    supportsDateFilter: false,
    supportsSearch: true,
    columns: [
      number('productId', 'ID'),
      number('productName', 'Product'),
      number('barcode', 'Barcode'),
      number('categoryName', 'Category'),
      number('supplierName', 'Supplier'),
      number('currentStock', 'Stock'),
      number('reorderLevel', 'Reorder'),
      currency('sellingPrice')
    ]
  },
  expiringProducts: {
    key: 'expiringProducts',
    slug: 'expiring-products',
    label: 'Expiring products',
    endpoint: '/reports/expiring-products',
    description: 'Received product batches that are expired or expiring soon.',
    supportsDateFilter: true,
    supportsSearch: true,
    columns: [
      number('productName', 'Product'),
      number('batchNumber', 'Batch'),
      number('supplierName', 'Supplier'),
      number('purchasedQuantity', 'Purchased'),
      number('currentStock', 'Stock'),
      date('expiryDate', 'Expiry'),
      number('daysToExpiry', 'Days'),
      number('expiryStatus', 'Status')
    ]
  },
  profit: {
    key: 'profit',
    slug: 'profit',
    label: 'Profit',
    endpoint: '/reports/profit',
    description: 'Daily sales, cost of goods, expenses, gross profit, and net profit.',
    supportsDateFilter: true,
    supportsSearch: false,
    columns: [
      date('reportDate', 'Date'),
      currency('salesAmount'),
      currency('refundAmount'),
      currency('costOfGoodsSold'),
      currency('expenseAmount'),
      currency('grossProfitAmount'),
      currency('netProfitAmount')
    ]
  },
  expenses: {
    key: 'expenses',
    slug: 'expenses',
    label: 'Expenses',
    endpoint: '/reports/expenses',
    description: 'Expense totals grouped by date, category, and staff member.',
    supportsDateFilter: true,
    supportsSearch: true,
    columns: [
      date('reportDate', 'Date'),
      number('expenseCategory', 'Category'),
      number('recordedByName', 'Recorded by'),
      number('expenseCount', 'Count'),
      currency('totalExpenseAmount')
    ]
  },
  supplierDues: {
    key: 'supplierDues',
    slug: 'supplier-dues',
    label: 'Supplier due',
    endpoint: '/reports/supplier-dues',
    description: 'Outstanding supplier balances and due purchase totals.',
    supportsDateFilter: false,
    supportsSearch: true,
    columns: [
      number('supplierId', 'ID'),
      number('supplierName', 'Supplier'),
      number('phone', 'Phone'),
      number('purchaseCount', 'Purchases'),
      currency('totalPurchaseAmount'),
      currency('amountPaid'),
      currency('dueAmount'),
      dateTime('latestPurchaseAt', 'Latest purchase')
    ]
  }
};

export const reportList = Object.values(reportConfigs);

export const getReportBySlug = (slug) => reportList.find((report) => report.slug === slug);
