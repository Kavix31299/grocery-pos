const { query } = require('../config/db');
const {
  appendPagination,
  getPagination,
  mapDatabaseError,
  sendList
} = require('../utils/controllerHelpers');

const REPORTS = {
  dailySales: {
    key: 'dailySales',
    label: 'Daily sales',
    view: 'daily_sales_report',
    dateColumn: 'report_date',
    orderBy: 'report_date DESC'
  },
  monthlySales: {
    key: 'monthlySales',
    label: 'Monthly sales',
    view: 'monthly_sales_report',
    dateColumn: 'report_month',
    orderBy: 'report_month DESC'
  },
  productSales: {
    key: 'productSales',
    label: 'Product sales',
    view: 'product_sales_report',
    searchColumns: ['product_name', 'barcode', 'sku', 'category_name'],
    orderBy: 'product_name ASC'
  },
  cashierSales: {
    key: 'cashierSales',
    label: 'Cashier sales',
    view: 'cashier_sales_report',
    searchColumns: ['cashier_name', 'username'],
    orderBy: 'cashier_name ASC'
  },
  stockAvailable: {
    key: 'stockAvailable',
    label: 'Stock available',
    view: 'stock_available_report',
    searchColumns: ['product_name', 'barcode', 'sku', 'category_name', 'supplier_name'],
    orderBy: 'product_name ASC'
  },
  lowStock: {
    key: 'lowStock',
    label: 'Low stock',
    view: 'low_stock_report',
    searchColumns: ['product_name', 'barcode', 'sku', 'category_name', 'supplier_name'],
    orderBy: 'shortage_quantity DESC, product_name ASC'
  },
  outOfStock: {
    key: 'outOfStock',
    label: 'Out of stock',
    view: 'out_of_stock_report',
    searchColumns: ['product_name', 'barcode', 'sku', 'category_name', 'supplier_name'],
    orderBy: 'product_name ASC'
  },
  expiringProducts: {
    key: 'expiringProducts',
    label: 'Expiring products',
    view: 'expiring_products_report',
    dateColumn: 'expiry_date',
    searchColumns: ['product_name', 'barcode', 'sku', 'category_name', 'supplier_name', 'batch_number'],
    orderBy: 'expiry_date ASC, product_name ASC'
  },
  profit: {
    key: 'profit',
    label: 'Profit',
    view: 'profit_report',
    dateColumn: 'report_date',
    orderBy: 'report_date DESC'
  },
  expenses: {
    key: 'expenses',
    label: 'Expense report',
    view: 'expense_report',
    dateColumn: 'report_date',
    searchColumns: ['expense_category', 'recorded_by_name'],
    orderBy: 'report_date DESC, expense_category ASC'
  },
  supplierDues: {
    key: 'supplierDues',
    label: 'Supplier dues',
    view: 'supplier_due_report',
    searchColumns: ['supplier_name', 'contact_person', 'phone', 'email'],
    orderBy: 'due_amount DESC, supplier_name ASC'
  },
  customerCredit: {
    key: 'customerCredit',
    label: 'Customer credit',
    view: 'customer_credit_report',
    searchColumns: ['customer_name', 'phone', 'email'],
    orderBy: 'credit_balance DESC, customer_name ASC'
  }
};

const listReports = (req, res) => res.json({
  reports: Object.values(REPORTS).map((report) => ({
    key: report.key,
    label: report.label
  }))
});

const runReport = (config) => async (req, res, next) => {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const filters = [];

    if (config.dateColumn && req.query.dateFrom) {
      values.push(req.query.dateFrom);
      filters.push(`${config.dateColumn} >= $${values.length}`);
    }

    if (config.dateColumn && req.query.dateTo) {
      values.push(req.query.dateTo);
      filters.push(`${config.dateColumn} <= $${values.length}`);
    }

    if (config.searchColumns && req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      filters.push(`(${config.searchColumns.map((column) => `${column} ILIKE $${values.length}`).join(' OR ')})`);
    }

    const result = await query(
      `
        SELECT *
        FROM ${config.view}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY ${config.orderBy}
        ${appendPagination(values, pagination)}
      `,
      values
    );

    return sendList(res, config.key, result.rows, pagination);
  } catch (error) {
    return next(mapDatabaseError(error));
  }
};

module.exports = {
  getCashierSalesReport: runReport(REPORTS.cashierSales),
  getCustomerCreditReport: runReport(REPORTS.customerCredit),
  getDailySalesReport: runReport(REPORTS.dailySales),
  getExpenseReport: runReport(REPORTS.expenses),
  getExpiringProductsReport: runReport(REPORTS.expiringProducts),
  getLowStockReport: runReport(REPORTS.lowStock),
  getMonthlySalesReport: runReport(REPORTS.monthlySales),
  getOutOfStockReport: runReport(REPORTS.outOfStock),
  getProductSalesReport: runReport(REPORTS.productSales),
  getProfitReport: runReport(REPORTS.profit),
  getStockAvailableReport: runReport(REPORTS.stockAvailable),
  getSupplierDueReport: runReport(REPORTS.supplierDues),
  listReports
};
