const express = require('express');
const salesController = require('../controllers/salesController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);
router.use(checkUserRole(ROLES.MANAGER, ROLES.CASHIER));

router.route('/')
  .get(salesController.listSales)
  .post(salesController.createSale);

router.get('/:id/invoice', salesController.getSaleInvoice);
router.get('/:id', salesController.getSale);
router.patch('/:id/cancel', salesController.cancelSale);

module.exports = router;
