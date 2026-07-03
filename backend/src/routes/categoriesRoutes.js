const express = require('express');
const categoriesController = require('../controllers/categoriesController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);

router.get('/', checkUserRole(ROLES.MANAGER, ROLES.CASHIER), categoriesController.listCategories);
router.get('/:id', checkUserRole(ROLES.MANAGER, ROLES.CASHIER), categoriesController.getCategory);
router.post('/', checkUserRole(ROLES.MANAGER), categoriesController.createCategory);
router.patch('/:id', checkUserRole(ROLES.MANAGER), categoriesController.updateCategory);
router.delete('/:id', checkUserRole(ROLES.MANAGER), categoriesController.deleteCategory);

module.exports = router;
