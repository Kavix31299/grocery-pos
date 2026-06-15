const express = require('express');
const authController = require('../controllers/authController');
const {
  verifyAuthToken,
  optionalAuthToken,
  allowFirstUserOrRole
} = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.post('/register', optionalAuthToken, allowFirstUserOrRole(ROLES.ADMIN), authController.register);
router.post('/login', authController.login);
router.get('/profile', verifyAuthToken, authController.getProfile);

module.exports = router;
