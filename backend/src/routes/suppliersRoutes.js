const express = require('express');
const suppliersController = require('../controllers/suppliersController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);

router.route('/')
  .get(checkUserRole(ROLES.MANAGER, ROLES.CASHIER), suppliersController.listSuppliers)
  .post(checkUserRole(ROLES.MANAGER), suppliersController.createSupplier);

router.route('/:id')
  .get(checkUserRole(ROLES.MANAGER, ROLES.CASHIER), suppliersController.getSupplier)
  .patch(checkUserRole(ROLES.MANAGER, ROLES.CASHIER), suppliersController.updateSupplier)
  .delete(checkUserRole(ROLES.MANAGER), suppliersController.deleteSupplier);

module.exports = router;
