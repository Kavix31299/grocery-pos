const express = require('express');
const reportsController = require('../controllers/reportsController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);
router.use(checkUserRole(ROLES.MANAGER));

router.get('/', reportsController.listReports);
router.get('/daily-sales', reportsController.getDailySalesReport);
router.get('/monthly-sales', reportsController.getMonthlySalesReport);
router.get('/product-sales', reportsController.getProductSalesReport);
router.get('/cashier-sales', reportsController.getCashierSalesReport);
router.get('/stock-available', reportsController.getStockAvailableReport);
router.get('/low-stock', reportsController.getLowStockReport);
router.get('/out-of-stock', reportsController.getOutOfStockReport);
router.get('/expiring-products', reportsController.getExpiringProductsReport);
router.get('/profit', reportsController.getProfitReport);
router.get('/expenses', reportsController.getExpenseReport);
router.get('/supplier-dues', reportsController.getSupplierDueReport);
router.get('/customer-credit', reportsController.getCustomerCreditReport);

module.exports = router;
