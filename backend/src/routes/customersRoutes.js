const express = require('express');
const customersController = require('../controllers/customersController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);

router.route('/')
  .get(checkUserRole(ROLES.MANAGER, ROLES.CASHIER), customersController.listCustomers)
  .post(checkUserRole(ROLES.MANAGER, ROLES.CASHIER), customersController.createCustomer);

router.route('/:id')
  .get(checkUserRole(ROLES.MANAGER, ROLES.CASHIER), customersController.getCustomer)
  .post(checkUserRole(ROLES.MANAGER, ROLES.CASHIER), customersController.addCustomerPayment)
  .patch(checkUserRole(ROLES.MANAGER, ROLES.CASHIER), customersController.updateCustomer)
  .delete(checkUserRole(ROLES.MANAGER), customersController.deleteCustomer);

module.exports = router;
