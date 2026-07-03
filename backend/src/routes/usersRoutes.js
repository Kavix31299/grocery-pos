const express = require('express');
const usersController = require('../controllers/usersController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);
router.use(checkUserRole(ROLES.ADMIN));

router.route('/')
  .get(usersController.listUsers)
  .post(usersController.createManagedUser);

router.route('/:id')
  .get(usersController.getUser)
  .patch(usersController.updateUser)
  .delete(usersController.deactivateUser);

module.exports = router;
