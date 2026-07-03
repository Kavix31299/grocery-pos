const express = require('express');
const returnsController = require('../controllers/returnsController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);
router.use(checkUserRole(ROLES.MANAGER, ROLES.CASHIER));

router.route('/')
  .get(returnsController.listReturns)
  .post(returnsController.createReturn);

router.get('/:id', returnsController.getReturn);
router.patch('/:id/status', returnsController.updateReturnStatus);

module.exports = router;
