const express = require('express');
const suppliersController = require('../controllers/suppliersController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);
router.use(checkUserRole(ROLES.MANAGER));

router.route('/')
  .get(suppliersController.listSuppliers)
  .post(suppliersController.createSupplier);

router.route('/:id')
  .get(suppliersController.getSupplier)
  .patch(suppliersController.updateSupplier)
  .delete(suppliersController.deleteSupplier);

module.exports = router;
