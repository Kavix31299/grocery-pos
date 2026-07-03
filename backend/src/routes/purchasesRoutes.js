const express = require('express');
const purchasesController = require('../controllers/purchasesController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);
router.use(checkUserRole(ROLES.MANAGER));

router.route('/')
  .get(purchasesController.listPurchases)
  .post(purchasesController.createPurchase);

router.get('/:id', purchasesController.getPurchase);
router.patch('/:id/status', purchasesController.updatePurchaseStatus);

module.exports = router;
