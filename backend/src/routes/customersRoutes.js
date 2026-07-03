const express = require('express');
const customersController = require('../controllers/customersController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);
router.use(checkUserRole(ROLES.MANAGER, ROLES.CASHIER));

router.route('/')
  .get(customersController.listCustomers)
  .post(customersController.createCustomer);

router.route('/:id')
  .get(customersController.getCustomer)
  .patch(customersController.updateCustomer)
  .delete(customersController.deleteCustomer);

module.exports = router;
