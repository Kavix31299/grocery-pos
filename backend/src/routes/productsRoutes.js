const express = require('express');
const productsController = require('../controllers/productsController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);

router.get('/', checkUserRole(ROLES.MANAGER, ROLES.CASHIER), productsController.listProducts);
router.get('/:id', checkUserRole(ROLES.MANAGER, ROLES.CASHIER), productsController.getProduct);
router.post('/', checkUserRole(ROLES.MANAGER), productsController.createProduct);
router.patch('/:id', checkUserRole(ROLES.MANAGER), productsController.updateProduct);
router.delete('/:id', checkUserRole(ROLES.MANAGER), productsController.deleteProduct);

module.exports = router;
