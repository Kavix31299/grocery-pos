const express = require('express');
const expensesController = require('../controllers/expensesController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);
router.use(checkUserRole(ROLES.MANAGER));

router.route('/')
  .get(expensesController.listExpenses)
  .post(expensesController.createExpense);

router.route('/:id')
  .get(expensesController.getExpense)
  .patch(expensesController.updateExpense)
  .delete(expensesController.deleteExpense);

module.exports = router;
